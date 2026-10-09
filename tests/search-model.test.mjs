import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCharacterStats, defaultCharacter, defaultTarget, evaluateBuild, SLOTS, slotType } from '../packages/shared/dist/index.js';
import { createSearch } from '../packages/shared/dist/search.js';

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));

test('the fast search model scores random real builds exactly like evaluateBuild', () => {
  const spell = catalog.spells.find(entry => entry.classIds.includes(9) && entry.levels.some(level => level.effects.some(effect => effect.effectId >= 91 && effect.effectId <= 100)));
  const prices = Object.fromEntries(catalog.items.filter((_, index) => index % 3).map(item => [String(item.id), item.level * 1000]));
  const request = {
    character: { ...defaultCharacter(), allocationMode: 'automatic' },
    constraints: [
      { id: 'ap', kind: 'stat', statKey: 'actionPoints', target: 11, relation: 'atLeast', priority: 0, strict: true },
      { id: 'str', kind: 'stat', statKey: 'strength', target: 1000, relation: 'maximize', priority: 1, strict: false, includePower: true },
      { id: 'res', kind: 'stat', statKey: 'fireElementResistPercent', target: 30, relation: 'atLeast', priority: 2, strict: false },
      { id: 'spell', kind: 'spell', spellId: spell.id, target: 500, relation: 'maximize', priority: 1, strict: false, metric: 'average' },
      { id: 'crit', kind: 'weapon', target: 30, relation: 'atLeast', priority: 3, strict: false, metric: 'criticalChance' },
      { id: 'hit', kind: 'weapon', target: 200, relation: 'maximize', priority: 3, strict: false, metric: 'average' },
      { id: 'price', kind: 'price', target: 2_000_000, relation: 'atMost', priority: 2, strict: false },
    ],
    target: defaultTarget(),
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {}, allowedExos: ['actionPoints', 'movementPoints'], maxExos: 2 },
    prices: { server: 'test', values: prices, ownedItemIds: [], mode: 'total', exoCosts: { actionPoints: 1000 } },
    seconds: 3,
  };
  const search = createSearch(catalog, request, 1);
  const pools = Object.fromEntries(SLOTS.map(slot => [slot, catalog.items.filter(item => item.slotType === slotType(slot) && !item.dataWarnings?.length)]));
  let state = 7;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  let valid = 0;
  for (let n = 0; n < 300; n += 1) {
    const slots = Object.fromEntries(SLOTS.filter(() => random() < 0.9).map(slot => [slot, pools[slot][Math.floor(random() * pools[slot].length)]?.id]).filter(([, id]) => id));
    const exoBonuses = [[], ['actionPoints'], ['movementPoints'], ['actionPoints', 'movementPoints']][n % 4];
    const baseStats = allocateCharacterStats(request.character, { [['strength', 'agility', 'vitality', 'wisdom'][n % 4]]: 1 });
    const build = { slots, exoBonuses, baseStats };
    const exact = evaluateBuild(catalog, request, build);
    const fast = search.inspect(build);
    assert.equal(fast.valid, exact.valid, `validity of ${JSON.stringify(build)}: ${exact.violations.join(' / ')}`);
    assert.ok(Math.abs(fast.soft - exact.score) < 1e-6, `score of ${JSON.stringify(build)}: ${fast.soft} vs ${exact.score}`);
    if (exact.valid) valid += 1;
  }
  assert.ok(valid > 0, 'the sample contains valid builds');
});
