import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

// Exercise the same pure frontend function on every Node version supported by the project.
const helper = ts.transpileModule(readFileSync(new URL('../apps/web/src/character-look.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { characterLook } = await import(`data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`);

const manifest = JSON.parse(readFileSync(new URL('../apps/web/public/characters/manifest.json', import.meta.url)));
const file = (relative) => new URL(`../apps/web/public${manifest.assetBase}${relative}`, import.meta.url);

test('equipped native models use exact ids and female/male appearances', () => {
  const mapping = { ...manifest, items: { 11: { male: 99, female: 100, folder: 'skins', category: 'hat' } } };
  assert.deepEqual(characterLook(mapping, 9, 'male', { hat: 11 }).look.skins, [90, 2140, 99]);
  assert.deepEqual(characterLook(mapping, 9, 'female', { hat: 11 }).look.skins, [91, 2148, 100]);
  assert.deepEqual(characterLook(mapping, 9, 'male', { hat: 11, ring1: 123 }).look, characterLook(mapping, 9, 'male', { hat: 11 }).look);
  assert.deepEqual(characterLook(mapping, 9, 'male', {}).look.skins, [90, 2140]);
});

test('unknown or incompatible appearance is reported and never guessed', () => {
  const result = characterLook(manifest, 9, 'male', { hat: 999999, cape: 2411 });
  assert.deepEqual(result.missing, ['hat', 'cape']);
  assert.deepEqual(result.look.skins, [90, 2140]);
});

test('familiar and petsmount use distinct native attachment points', () => {
  const pets = Object.entries(manifest.items).filter(([, item]) => item.category === 'pet');
  const [pet] = pets.find(([, item]) => item.petType === 'familier');
  const [mount] = pets.find(([, item]) => item.petType === 'montilier');
  const familiarLook = characterLook(manifest, 9, 'male', { pet: Number(pet) }).look;
  assert.equal(familiarLook.bonesId, 1);
  assert.equal(familiarLook.subEntities[0].bindingPointCategory, 'PET');
  const mountLook = characterLook(manifest, 9, 'male', { pet: Number(mount) }).look;
  assert.equal(mountLook.bonesId, manifest.items[mount].male);
  assert.equal(mountLook.subEntities[0].bindingPointCategory, 'MOUNT_DRIVER');
  assert.equal(mountLook.subEntities[0].subEntityLook.bonesId, 2);
});

test('every published item and class model is packaged, with valid metadata and animation data', () => {
  const bodyData = JSON.parse(readFileSync(file('Content/Data/bodiesdataroot.json'))).objectsById;
  const slotsData = JSON.parse(readFileSync(file('Content/Data/skinslotsrulesdataroot.json'))).objectsById;
  assert.ok(bodyData[21]?.skins === '90');
  assert.ok(slotsData[239]?.slotRulesList);
  const required = new Set(['Bones/1-static', 'Bones/2']);
  for (const genders of Object.values(manifest.breeds)) for (const look of Object.values(genders)) for (const skin of look.skins) required.add(`Skins/${skin}`);
  for (const item of Object.values(manifest.items)) for (const id of [item.male, item.female]) required.add(`${item.folder === 'bones' ? 'Bones' : 'Skins'}/${id}`);
  for (const path of required) {
    const skin = JSON.parse(readFileSync(file(`Content/Characters/${path}/skin.json`)));
    for (let index = 0; index < skin.textures.length; index++) assert.ok(existsSync(file(`Content/Characters/${path}/${index}.webp`)), `${path} texture ${index}`);
    if (path.startsWith('Bones/')) {
      const bone = JSON.parse(readFileSync(file(`Content/Characters/${path}/bone.json`)));
      assert.ok(bone.animations.length, `${path}: idle poses`);
      for (const animation of bone.animations) assert.ok(existsSync(file(`Content/Characters/${path}/${animation.name}.dat`)), `${path}: ${animation.name}`);
    }
  }
});
