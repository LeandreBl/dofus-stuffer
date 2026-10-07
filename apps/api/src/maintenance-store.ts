import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Catalog } from '@dofus/shared';

export const runtimeDirectory = () => process.env.DATA_RUNTIME_DIR || resolve(process.cwd(), 'data/runtime');
export const runtimePath = (name: string) => join(runtimeDirectory(), name);
export function readJson<T>(path: string): T | undefined {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return undefined; }
}
/** Readers see the entire old snapshot or the entire new snapshot, never a partial write. */
export function atomicJson(path: string, value: unknown, backup = false) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  if (backup && existsSync(path)) copyFileSync(path, `${path}.previous`);
  renameSync(temporary, path);
}
export function compareVersions(left: string, right: string): number {
  if (!/^\d+(?:\.\d+){1,5}$/.test(left) || !/^\d+(?:\.\d+){1,5}$/.test(right)) throw new Error('Version de catalogue non reconnue.');
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
}
export function catalogRevision(catalog: Catalog): string {
  // Observation timestamps do not constitute a gameplay-data change.
  const { fetchedAt: _date, revision: _revision, ...content } = catalog as Catalog & { revision?: string };
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
export function publicSource(url: string): string {
  try { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}`; } catch { return 'Source configurée'; }
}
