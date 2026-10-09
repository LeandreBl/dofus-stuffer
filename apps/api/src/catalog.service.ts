import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Catalog } from '@dofus/shared';

export function baselineCatalogPath(): string {
  const localPath = resolve(process.cwd(), 'data/catalog.json');
  return process.env.CATALOG_PATH || (existsSync(localPath) ? localPath : resolve(process.cwd(), '../../data/catalog.json'));
}
export function catalogRevision(catalog: Catalog): string {
  // Observation timestamps do not constitute a gameplay-data change.
  const { fetchedAt: _date, revision: _revision, ...content } = catalog as Catalog & { revision?: string };
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
let cached: Catalog | undefined;
export function loadCatalog(): Catalog {
  if (cached) return cached;
  const path = baselineCatalogPath();
  let catalog: Catalog;
  try { catalog = JSON.parse(readFileSync(path, 'utf8')) as Catalog; }
  catch { throw new Error(`Catalogue absent ou invalide : ${path}. Lancez l’import des données avant de démarrer.`); }
  if (!catalog.version || !Array.isArray(catalog.spells) || !Array.isArray(catalog.items)
    || !Array.isArray(catalog.stats) || !Array.isArray(catalog.classes) || !Array.isArray(catalog.sets)) {
    throw new Error('Le catalogue ne respecte pas le format attendu. Relancez l’import.');
  }
  return cached = { ...catalog, revision: catalogRevision(catalog) };
}

@Injectable()
export class CatalogService { get data() { return loadCatalog(); } }
