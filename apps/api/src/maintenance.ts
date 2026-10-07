import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { Catalog } from '@dofus/shared';
import { redisUrl } from './config.js';
import { baselineCatalogPath } from './catalog.service.js';
import { atomicJson, catalogRevision, compareVersions, publicSource, readJson, runtimeDirectory, runtimePath } from './maintenance-store.js';
import { validateCatalog, validatePrices, type PriceFeed } from './maintenance-validation.js';

export const MAINTENANCE_QUEUE = 'dofus-maintenance';
export const DEFAULT_CRON = '0 3 * * 1';
export const DEFAULT_TIMEZONE = 'Europe/Paris';
export const DEFAULT_PATCH_FEED = 'https://www.dofus.com/fr/rss/changelog.xml';
type CheckState = 'updated' | 'unchanged' | 'older' | 'error' | 'unconfigured';
export interface CheckReport { status: CheckState; checkedAt: string; message: string; source?: string; sourceVersion?: string; }
export interface PatchReport { title: string; url: string; publishedAt?: string; excerpt: string; version?: string; }
export interface MaintenanceStatus {
  running: boolean; cron: string; timezone: string; startedAt: string; completedAt?: string;
  catalog?: CheckReport; prices?: CheckReport; patch?: CheckReport; latestPatch?: PatchReport;
  catalogVersion: string; catalogRevision: string;
}
export interface SavedPrices { servers: Record<string, { values: Record<string, number>; exoCosts?: PriceFeed['servers'][string]['exoCosts']; updatedAt: string; source: string }>; }
export interface MaintenanceOptions {
  directory: string; baselinePath: string; catalogFeed?: string; priceFeed?: string; patchFeed?: string;
  refreshScript?: string; cron: string; timezone: string;
  fetcher?: typeof fetch;
}
export function maintenanceOptions(): MaintenanceOptions {
  return { directory: runtimeDirectory(), baselinePath: baselineCatalogPath(),
    catalogFeed: process.env.CATALOG_FEED_URL || undefined, priceFeed: process.env.PRICE_FEED_URL || undefined,
    patchFeed: process.env.PATCH_FEED_URL || DEFAULT_PATCH_FEED,
    refreshScript: resolve(process.cwd(), 'scripts/refresh-catalog.mjs'),
    cron: process.env.MAINTENANCE_CRON || DEFAULT_CRON, timezone: process.env.MAINTENANCE_TIMEZONE || DEFAULT_TIMEZONE };
}
export async function fetchLimited(url: string, maxBytes: number, fetcher: typeof fetch = fetch): Promise<string> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Le flux doit utiliser HTTP ou HTTPS.');
  const response = await fetcher(url, { signal: AbortSignal.timeout(45_000), headers: { 'User-Agent': 'Dofus-Stuffer/0.2 (+weekly-data-refresh)' } });
  if (!response.ok) throw new Error(`Source indisponible (HTTP ${response.status}).`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Flux trop volumineux.');
  if (!response.body) throw new Error('Flux vide.');
  const reader = response.body.getReader(), parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) throw new Error('Flux trop volumineux.');
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(parts).toString('utf8');
}
function plainText(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|#160);/gi, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
}
/** The changelog is evidence for review. Narrative text is never executed or converted into invented stats. */
export function parsePatchFeed(xml: string, baseUrl: string): PatchReport {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Flux de notes non pris en charge.');
  const entries = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].map(match => {
    const entry = match[1];
    const field = (tag: string) => entry.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '';
    const title = plainText(field('title')).slice(0, 300);
    const link = plainText(field('link')) || entry.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || '';
    let url: URL;
    try { url = new URL(link, baseUrl); } catch { return null; }
    const official = ['dofus.com', 'ankama.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    if (!title || !link || url.protocol !== 'https:' || !official || url.username || url.password) return null;
    url.search = ''; url.hash = '';
    const date = Date.parse(plainText(field('pubDate') || field('published') || field('updated')));
    const excerpt = plainText(field('description') || field('content:encoded') || field('content') || field('summary')).slice(0, 5_000);
    return { title, url: url.href, publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : undefined,
      excerpt, version: title.match(/\b(\d+\.\d+(?:\.\d+){0,3})\b/)?.[1] };
  }).filter(value => value !== null);
  if (!entries.length) throw new Error('Aucune note de mise à jour lisible dans ce flux.');
  return entries.sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))[0];
}
function safeError(error: unknown): string {
  // Never echo provider URLs, tokens, stack traces or response bodies into the public status.
  if (error instanceof Error && /^(Source indisponible|Flux |Catalogue |Version |Identifiants |Caractéristique |Classe |Date |Serveur |Prix |Le flux |Aucune note)/.test(error.message)) return error.message;
  return 'La source n’a pas pu être vérifiée. Les dernières données valides sont conservées.';
}
export async function runMaintenance(options: MaintenanceOptions): Promise<MaintenanceStatus> {
  mkdirSync(options.directory, { recursive: true });
  const statusPath = join(options.directory, 'maintenance.json'), catalogPath = join(options.directory, 'catalog.json');
  const previous = readJson<MaintenanceStatus>(statusPath);
  let catalog = validateCatalog(JSON.parse(readFileSync(options.baselinePath, 'utf8')));
  let savedCatalog = readJson<Catalog>(catalogPath);
  try {
    if (savedCatalog && compareVersions(savedCatalog.version, catalog.version) >= 0) catalog = validateCatalog(savedCatalog);
    else savedCatalog = undefined;
  } catch { savedCatalog = undefined; /* Recover from corrupt storage using the packaged catalogue; other sources still run. */ }
  const status: MaintenanceStatus = { running: true, cron: options.cron, timezone: options.timezone,
    startedAt: new Date().toISOString(), catalogVersion: catalog.version, catalogRevision: catalogRevision(catalog), latestPatch: previous?.latestPatch };
  atomicJson(statusPath, status);
  const check = async (name: 'catalog' | 'prices' | 'patch', source: string | undefined, work: () => Promise<Omit<CheckReport, 'checkedAt'>>) => {
    try { status[name] = { ...await work(), checkedAt: new Date().toISOString(), source: source ? publicSource(source) : undefined }; }
    catch (error) { status[name] = { status: 'error', checkedAt: new Date().toISOString(), message: safeError(error), source: source ? publicSource(source) : undefined }; }
    atomicJson(statusPath, status);
  };
  await check('catalog', options.catalogFeed || 'https://github.com/dofusdude/dofus3-main/releases', async () => {
    let candidate: Catalog;
    if (options.catalogFeed) candidate = validateCatalog(JSON.parse(await fetchLimited(options.catalogFeed, 64 * 1024 * 1024, options.fetcher)));
    else if (options.refreshScript && existsSync(options.refreshScript)) {
      const output = join(options.directory, `candidate-${randomUUID()}.json`);
      // The executable and arguments are fixed by application code, never by feed or patch-note content.
      try {
        const current = savedCatalog && compareVersions(savedCatalog.version, catalog.version) >= 0 ? catalogPath : options.baselinePath;
        const { stdout } = await promisify(execFile)(process.execPath, [options.refreshScript, '--output', output, '--current', current],
          { timeout: 600_000, maxBuffer: 1024 * 1024, windowsHide: true });
        const summary = JSON.parse(stdout.trim().split('\n').at(-1) || '{}') as { status?: string; sourceVersion?: string };
        if (!existsSync(output)) {
          if (!['unchanged', 'older'].includes(summary.status || '')) throw new Error('Catalogue indisponible auprès de la source.');
          return { status: summary.status as 'unchanged' | 'older', sourceVersion: summary.sourceVersion,
            message: summary.status === 'older' ? 'La source publique est plus ancienne : le catalogue installé est conservé.' : 'Le catalogue est déjà à jour auprès de cette source.' };
        }
        candidate = validateCatalog(JSON.parse(readFileSync(output, 'utf8')));
      } finally { rmSync(output, { force: true }); }
    } else return { status: 'unconfigured', message: 'Aucune source de catalogue configurée.' };
    if (compareVersions(candidate.version, catalog.version) < 0) return { status: 'older', sourceVersion: candidate.version, message: 'La source est plus ancienne : le catalogue installé est conservé.' };
    // A partial export must not silently remove most of the game's equipment or spells.
    if (candidate.items.length < catalog.items.length * 0.8 || candidate.spells.length < catalog.spells.length * 0.8
      || candidate.classes.length < catalog.classes.length || candidate.stats.length < catalog.stats.length * 0.8) throw new Error('Catalogue incomplet : données conservées.');
    const revision = catalogRevision(candidate);
    if (revision === status.catalogRevision) return { status: 'unchanged', sourceVersion: candidate.version, message: 'Catalogue inchangé.' };
    catalog = { ...candidate, revision };
    atomicJson(catalogPath, catalog, true);
    status.catalogVersion = catalog.version; status.catalogRevision = revision;
    return { status: 'updated', sourceVersion: candidate.version, message: 'Statistiques, conditions, panoplies et sorts actualisés depuis les données structurées.' };
  });
  await check('prices', options.priceFeed, async () => {
    if (!options.priceFeed) return { status: 'unconfigured', message: 'Les prix automatiques ne sont pas encore configurés. Les relevés manuels restent disponibles.' };
    const feed = validatePrices(JSON.parse(await fetchLimited(options.priceFeed, 16 * 1024 * 1024, options.fetcher)), catalog);
    const path = join(options.directory, 'prices.json'), saved = readJson<SavedPrices>(path) || { servers: {} };
    let updated = 0;
    for (const [server, book] of Object.entries(feed.servers)) {
      if (saved.servers[server] && Date.parse(saved.servers[server].updatedAt) > Date.parse(feed.updatedAt)) continue;
      saved.servers[server] = { ...book, updatedAt: feed.updatedAt, source: publicSource(options.priceFeed) };
      updated++;
    }
    if (!updated) return { status: 'older', message: 'Prix reçus plus anciens : les derniers prix sont conservés.' };
    atomicJson(path, saved, true);
    return { status: 'updated', message: `Prix actualisés pour ${updated} serveur(s).` };
  });
  await check('patch', options.patchFeed, async () => {
    if (!options.patchFeed) return { status: 'unconfigured', message: 'Aucun flux de notes de mise à jour configuré.' };
    const patch = parsePatchFeed(await fetchLimited(options.patchFeed, 2 * 1024 * 1024, options.fetcher), options.patchFeed);
    const unchanged = status.latestPatch?.url === patch.url && status.latestPatch?.excerpt === patch.excerpt;
    status.latestPatch = patch;
    return { status: unchanged ? 'unchanged' : 'updated', sourceVersion: patch.version,
      message: 'Dernière note relevée. Les modifications chiffrées sont appliquées via le catalogue structuré lorsqu’il est disponible.' };
  });
  status.running = false; status.completedAt = new Date().toISOString();
  atomicJson(statusPath, status);
  return status;
}
export function getMaintenanceStatus() {
  return readJson<MaintenanceStatus>(runtimePath('maintenance.json')) || { running: false, cron: process.env.MAINTENANCE_CRON || DEFAULT_CRON,
    timezone: process.env.MAINTENANCE_TIMEZONE || DEFAULT_TIMEZONE, message: 'Première vérification en attente.' };
}
export function getServerPrices(server: string) {
  const saved = readJson<SavedPrices>(runtimePath('prices.json'))?.servers[server];
  const state = readJson<MaintenanceStatus>(runtimePath('maintenance.json'))?.prices;
  return { server, values: saved?.values || {}, exoCosts: saved?.exoCosts || {}, updatedAt: saved?.updatedAt,
    source: saved?.source, configured: state?.status !== 'unconfigured' && Boolean(state),
    status: saved ? 'available' : state?.status === 'unconfigured' ? 'unconfigured' : 'unavailable',
    lastCheck: state };
}
export async function startMaintenance() {
  const connection = new Redis(redisUrl(), { maxRetriesPerRequest: null });
  connection.on('error', () => console.warn('Maintenance : connexion Redis indisponible.'));
  const queue = new Queue(MAINTENANCE_QUEUE, { connection, defaultJobOptions: { attempts: 1, removeOnComplete: 30, removeOnFail: 30 } });
  if (process.argv.includes('--once')) {
    const events = new QueueEvents(MAINTENANCE_QUEUE, { connection });
    try {
      await events.waitUntilReady();
      const job = await queue.add('manual-refresh', {});
      const report = await job.waitUntilFinished(events, 900_000);
      console.log(JSON.stringify(report));
    } finally { await events.close(); await queue.close(); await connection.quit(); }
    return;
  }
  const options = maintenanceOptions();
  await queue.setGlobalConcurrency(1);
  await queue.upsertJobScheduler('weekly-data-refresh', { pattern: options.cron, tz: options.timezone }, { name: 'weekly-refresh', data: {} });
  const worker = new Worker(MAINTENANCE_QUEUE, async () => runMaintenance(options), { connection, concurrency: 1 });
  worker.on('error', () => console.error('Maintenance : erreur de connexion au planificateur.'));
  worker.on('failed', () => console.error('Maintenance interrompue ; les dernières données valides sont conservées.'));
  worker.on('completed', (_job, result: MaintenanceStatus) => console.log(JSON.stringify({ event: 'maintenance-completed',
    catalog: result.catalog?.status, prices: result.prices?.status, patch: result.patch?.status, catalogVersion: result.catalogVersion })));
  await queue.add('startup-refresh', {}, { jobId: `startup-${Math.floor(Date.now() / 60_000)}` });
  let closing = false;
  const close = async () => { if (closing) return; closing = true; await worker.close(); await queue.close(); await connection.quit(); };
  process.once('SIGTERM', () => { void close(); }); process.once('SIGINT', () => { void close(); });
  console.log(`Maintenance hebdomadaire active : ${options.cron} (${options.timezone}).`);
}
