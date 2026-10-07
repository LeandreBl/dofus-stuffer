import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Optional supplement for models absent from an older local client. No runtime external calls.
const source = 'https://static.souff.fr/StreamingAssets/';
const publicRoot = path.resolve('apps/web/public');
const manifestFile = path.join(publicRoot, 'characters/manifest.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
const mapping = JSON.parse(await readFile('data/character-appearances.json', 'utf8'));
const output = path.resolve(publicRoot, '.' + manifest.assetBase);
if (!output.startsWith(path.join(publicRoot, 'characters') + path.sep)) throw new Error('Invalid character asset destination');
const imported = [];
for (const itemId of manifest.missingItems) {
  const item = mapping.items[itemId];
  if (!item || item.folder !== 'skins') continue;
  try {
    for (const id of new Set([item.male, item.female])) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid skin id');
      const remotePath = `Content/Characters/Skins/${id}/`;
      const response = await fetch(source + remotePath + 'skin.json', { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Skin ${id}: HTTP ${response.status}`);
      const skin = await response.json();
      if (!Array.isArray(skin.m_keys) || !Array.isArray(skin.m_values) || !Array.isArray(skin.textures) || skin.textures.length > 16) throw new Error('Invalid native skin asset');
      const textures = await Promise.all(skin.textures.map(async (_, index) => {
        const response = await fetch(source + remotePath + `${index}.webp`, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Skin ${id}: missing texture ${index}`);
        return Buffer.from(await response.arrayBuffer());
      }));
      const folder = path.join(output, remotePath);
      await mkdir(folder, { recursive: true });
      for (let index = 0; index < textures.length; index++) await writeFile(path.join(folder, `${index}.webp`), textures[index]);
      await writeFile(path.join(folder, 'skin.json'), JSON.stringify(skin));
    }
    manifest.items[itemId] = item;
    imported.push(itemId);
  } catch (error) {
    console.warn(`Appearance ${itemId} remains unavailable: ${error.message}`);
  }
}
if (imported.length) {
  const response = await fetch(source + 'Content/Data/skinslotsrulesdataroot.json', { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('Missing hair/hat masking rules for supplementary assets');
  const remoteRules = (await response.json()).objectsById;
  const rulesPath = path.join(output, 'Content/Data/skinslotsrulesdataroot.json');
  const rules = JSON.parse(await readFile(rulesPath, 'utf8'));
  for (const itemId of imported) for (const id of [mapping.items[itemId].male, mapping.items[itemId].female]) {
    if (remoteRules[id]) rules.objectsById[id] = remoteRules[id];
  }
  await writeFile(rulesPath, JSON.stringify(rules));
  manifest.missingItems = manifest.missingItems.filter((id) => !imported.includes(id));
  manifest.supplements = [...(manifest.supplements || []), { source, importedAt: new Date().toISOString(), itemIds: imported }];
  await writeFile(manifestFile, JSON.stringify(manifest));
}
console.log(`Supplemented ${imported.length} models; ${manifest.missingItems.length} remain unavailable.`);
