import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Catalog } from '@dofus/shared';
import { catalogRevision, compareVersions, runtimePath } from './maintenance-store.js';
import { validateCatalog } from './maintenance-validation.js';

export function baselineCatalogPath(): string {
  const localPath = resolve(process.cwd(), 'data/catalog.json');
  return process.env.CATALOG_PATH || (existsSync(localPath) ? localPath : resolve(process.cwd(), '../../data/catalog.json'));
}
let cached: { signature: string; data: Catalog } | undefined;
export function loadCatalog(): Catalog {
  const path = baselineCatalogPath(), livePath = runtimePath('catalog.json');
  const signatureFor = (file: string) => { try { const s = statSync(file); return `${file}:${s.mtimeMs}:${s.size}:${s.ino}`; } catch { return `${file}:absent`; } };
  const signature = `${signatureFor(path)}|${signatureFor(livePath)}`;
  if (cached?.signature === signature) return cached.data;
  let catalog: Catalog;
  try { catalog = JSON.parse(readFileSync(path, 'utf8')) as Catalog; }
  catch { throw new Error(`Catalogue absent ou invalide : ${path}. Lancez l’import des données avant de démarrer.`); }
  if (!catalog.version || !Array.isArray(catalog.spells) || !Array.isArray(catalog.items)
    || !Array.isArray(catalog.stats) || !Array.isArray(catalog.classes) || !Array.isArray(catalog.sets)) {
    throw new Error('Le catalogue ne respecte pas le format attendu. Relancez l’import.');
  }
  if (existsSync(livePath)) {
    try {
      const live = validateCatalog(JSON.parse(readFileSync(livePath, 'utf8')));
      const versionOrder=compareVersions(live.version,catalog.version);
      const hasCombatData=!catalog.combatSpells?.length||Boolean(live.combatSpells?.length&&live.combatStates?.length&&live.summons?.length);
      if (hasCombatData&&(versionOrder>0||versionOrder===0&&Date.parse(live.fetchedAt)>=Date.parse(catalog.fetchedAt))) catalog = live;
    } catch { /* A failed refresh must not take the packaged catalogue offline. */ }
  }
  catalog = { ...catalog, revision: catalogRevision(catalog) };
  cached = { signature, data: catalog };
  return catalog;
}

@Injectable()
export class CatalogService { get data() { return loadCatalog(); } }
