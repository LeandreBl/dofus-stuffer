import { readFile, writeFile } from 'node:fs/promises';

const source = 'https://barbofus.com/skinator';
const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Appearance mapping source returned ${response.status}`);
const html = await response.text();
function embedded(name) {
  const value = html.match(new RegExp(`${name}: (.+),\\r?\\n`))?.[1];
  if (!value) throw new Error(`Missing public ${name} dataset`);
  return JSON.parse(value); // Parse data only; never execute page scripts.
}
const catalog = JSON.parse(await readFile('data/catalog.json', 'utf8'));
const catalogIds = new Set(catalog.items.map((item) => item.id));
const rawItems = embedded('allItems');
const rawBreeds = embedded('breedInfos');
if (rawItems.length < 1000 || rawBreeds.length < 19) throw new Error('Incomplete appearance source');
const breeds = Object.fromEntries(rawBreeds.map((breed) => [breed.dofus_id,
  Object.fromEntries(['male', 'female'].map((sex) => [sex, {
    skins: [Number(breed.bodies[sex][1].skins), Number(breed.heads[sex][0].skins)],
    colors: breed.colors[sex],
  }]))]));
const items = Object.fromEntries(rawItems.filter((item) => catalogIds.has(item.dofus_id)
  && ['hat', 'cape', 'shield', 'weapon', 'pet'].includes(item.category)).map((item) => [item.dofus_id, {
  male: item.asset_id, female: item.female_asset_id || item.asset_id,
  folder: item.folder, category: item.category, petType: item.pet_type,
}]));
for (const item of Object.values(items)) {
  if (!['skins', 'bones'].includes(item.folder) || ![item.male, item.female].every((id) => Number.isSafeInteger(id) && id > 0)) throw new Error('Invalid native model identifier');
}
await writeFile('data/character-appearances.json', JSON.stringify({
  source: { url: source, retrievedAt: new Date().toISOString(), description: 'Explicit game item to native wearable model ids; models extracted from the installed client.' },
  breeds, items,
}, null, 2) + '\n');
console.log(`Mapped ${Object.keys(items).length} equipment appearances and ${Object.keys(breeds).length} classes.`);
