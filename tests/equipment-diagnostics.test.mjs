import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCharacter, defaultTarget, evaluateBuild, formatItemCondition, inspectEquipment } from '../packages/shared/dist/index.js';

const item = (id, slotType, rest = {}) => ({ id, name: `Objet ${id}`, level: 1, typeId: id, typeName: slotType, category: 'Équipements', slotType, stats: {}, icon: '', ...rest });
const condition = (stat, operator, value) => ({ kind: 'stat', stat, operator, value });
const catalog = (items = [], sets = []) => ({ version: 'test', fetchedAt: '', source: '', classes: [{ id: 9, name: 'Crâ', icon: '' }], stats: [], spells: [], servers: [], items, sets });
const request = () => ({ character: defaultCharacter(), constraints: [], target: defaultTarget(), filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {}, allowedExos: ['actionPoints', 'movementPoints'], maxExos: 2 }, prices: { server: 'Draconiros', values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3 });
function inspect(data, input, build) {
  return inspectEquipment(data, input, evaluateBuild(data, input, build));
}

test('PA prerequisites use raw equipment totals and flag the restrictive item plus positive contributors', () => {
  const data = catalog([
    item(1, 'amulet', { stats: { actionPoints: 5 }, conditions: condition('actionPoints', '<', 13) }),
    item(2, 'hat', { stats: { actionPoints: 1 } }),
    item(3, 'cape'),
  ]);
  const result = inspect(data, request(), { slots: { amulet: 1, hat: 2, cape: 3 } });
  assert.equal(result.limits.actionPoints.raw, 13);
  assert.equal(result.limits.actionPoints.effective, 12);
  assert.equal(result.items.amulet.condition.actual, 13);
  assert.equal(result.items.amulet.invalid, true);
  assert.equal(result.items.hat.invalid, true);
  assert.equal(result.items.cape.invalid, false);
  assert.deepEqual(result.issues[0].slots.sort(), ['amulet', 'hat']);
  assert.equal(result.limits.actionPoints.equipmentMaximum, 12);
});

test('a legal PA-restricted build explains why an otherwise allowed exo would break it', () => {
  const data = catalog([item(1, 'amulet', { stats: { actionPoints: 4 }, conditions: condition('actionPoints', '<', 12) })]);
  const result = inspect(data, request(), { slots: { amulet: 1 } });
  assert.equal(result.items.amulet.invalid, false);
  assert.equal(result.items.amulet.condition.text, 'PA : au plus 11');
  assert.equal(result.limits.actionPoints.equipmentMaximum, 11);
  assert.equal(result.exos.actionPoints.status, 'blocked');
  assert.deepEqual([result.exos.actionPoints.before, result.exos.actionPoints.after], [11, 12]);
  assert.match(result.exos.actionPoints.reasons.join(' '), /PA : au plus 11.*actuel : 12/);
  assert.deepEqual(result.exos.actionPoints.affectedSlots, ['amulet']);
  assert.equal(result.exos.movementPoints.status, 'possible');
});

test('OR branches remain alternatives and a satisfied alternate branch removes the conditional PA maximum', () => {
  const limited = item(1, 'amulet', { stats: { actionPoints: 4 }, conditions: { kind: 'or', children: [condition('actionPoints', '<', 11), condition('strength', '>=', 100)] } });
  const data = catalog([limited, item(2, 'hat', { stats: { strength: 100 } })]);
  const valid = inspect(data, request(), { slots: { amulet: 1, hat: 2 } });
  assert.equal(valid.items.amulet.condition.satisfied, true);
  assert.equal(valid.items.amulet.invalid, false);
  assert.equal(valid.issues.length, 0);
  assert.equal(valid.limits.actionPoints.equipmentMaximum, null);
  assert.equal(valid.exos.actionPoints.status, 'possible');
  const failed = inspect(data, request(), { slots: { amulet: 1 } });
  assert.equal(failed.items.amulet.invalid, true);
  assert.equal(failed.limits.actionPoints.equipmentMaximum, 10);
});

test('nested AND/OR and strict inequalities derive exact conditional integer maxima', () => {
  const rule = { kind: 'and', children: [condition('movementPoints', '>=', 3), { kind: 'or', children: [condition('actionPoints', '<', 10), condition('actionPoints', '=', 11)] }] };
  const data = catalog([item(1, 'amulet', { stats: { actionPoints: 4 }, conditions: rule })]);
  const result = inspect(data, request(), { slots: { amulet: 1 } });
  assert.equal(result.limits.actionPoints.equipmentMaximum, 11);
  assert.equal(result.exos.actionPoints.status, 'blocked');
  assert.equal(formatItemCondition(rule, data), 'PM : au moins 3 ET (PA : au plus 9 OU PA : exactement 11)');
});

test('nested equipment prerequisites are readable in both details and build violations without changing their meaning', () => {
  const rule = { kind: 'and', children: [condition('strength', '>', 299), { kind: 'or', children: [
    condition('intelligence', '>', 299), condition('chance', '>', 299), condition('agility', '>', 299),
  ] }] };
  const raw = 'CS>299&(CI>299|CC>299|CA>299)';
  const staff = item(1, 'weapon', { conditions: rule, conditionsText: raw });
  const data = catalog([staff]);
  const label = 'Force : au moins 300 ET (Intelligence : au moins 300 OU Chance : au moins 300 OU Agilité : au moins 300)';
  assert.equal(formatItemCondition(rule, data), label);
  const invalid = evaluateBuild(data, request(), { slots: { weapon: 1 } });
  assert.ok(invalid.violations.some(message => message.includes(label)));
  assert.ok(invalid.violations.every(message => !message.includes(raw)));
  const input = request();
  input.character.allocationMode = 'manual';
  input.character.baseStats = { strength: 200, chance: 200 };
  input.character.scrollStats = { strength: 100, chance: 100 };
  assert.equal(evaluateBuild(data, input, { slots: { weapon: 1 } }).valid, true);
  input.character.baseStats.chance = 199;
  assert.equal(evaluateBuild(data, input, { slots: { weapon: 1 } }).valid, false);
});

test('elemental prerequisites require 200 real stats for > 199, including set bonuses but excluding positive or negative power', () => {
  for (const stat of ['strength', 'intelligence', 'chance', 'agility']) {
    for (const power of [1_000, -1_000]) {
      for (const setBonus of [24, 25]) {
        const rule = condition(stat, '>', 199);
        const data = catalog([
          item(1, 'hat', { setId: 10, stats: { [stat]: 25, damagePercent: power }, conditions: rule }),
          item(2, 'ring', { setId: 10 }),
        ], [{ id: 10, name: 'Panoplie de test', bonuses: [{ count: 2, stats: { [stat]: setBonus } }] }]);
        const input = request();
        input.character.allocationMode = 'manual';
        input.character.baseStats = { [stat]: 100 };
        input.character.scrollStats = { [stat]: 50 };
        input.constraints = [{ id: 'with-power', kind: 'stat', statKey: stat, includePower: true,
          target: 200, relation: 'atLeast', priority: 0, strict: false }];
        const evaluation = evaluateBuild(data, input, { slots: { hat: 1, ring1: 2 } });
        const diagnostic = inspectEquipment(data, input, evaluation).items.hat.condition;
        const actual = 175 + setBonus;
        assert.equal(evaluation.stats[stat], actual);
        assert.equal(evaluation.constraints[0].value, actual + power, 'Power applies only to the explicitly enabled objective.');
        assert.equal(diagnostic.actual, actual);
        assert.match(diagnostic.text, /au moins 200$/);
        assert.equal(diagnostic.satisfied, actual >= 200);
        assert.equal(evaluation.valid, actual >= 200, `${stat}=${actual}, power=${power}`);
      }
    }
  }
});

test('uninterpreted condition codes stay unverified and do not leak into player-facing messages', () => {
  const rule = { kind: 'unknown', description: 'PJ>2,40|PJ>24,40' };
  const data = catalog([item(1, 'cape', { conditions: rule, conditionsText: rule.description })]);
  assert.equal(formatItemCondition(rule, data), 'Condition particulière à vérifier en jeu');
  assert.equal(formatItemCondition({ kind: 'unknown', description: 'État du personnage requis' }, data), 'État du personnage requis');
  const result = inspect(data, request(), { slots: { cape: 1 } });
  assert.equal(result.items.cape.condition.satisfied, null);
  assert.ok(result.issues.every(issue => !issue.message.includes('PJ>')));
  const evaluation = evaluateBuild(data, request(), { slots: { cape: 1 } });
  assert.equal(evaluation.valid, false);
  assert.ok(evaluation.violations.every(message => !message.includes('PJ>')));
});

test('numeric inequalities and class names retain readable exact requirements', () => {
  const data = catalog();
  assert.equal(formatItemCondition(condition('actionPoints', '<', 12), data), 'PA : au plus 11');
  assert.equal(formatItemCondition(condition('strength', '>', -2), data), 'Force : au moins -1');
  assert.equal(formatItemCondition(condition('classId', '=', 9), data), 'Classe : Crâ');
  assert.equal(formatItemCondition(condition('classId', '!=', 9), data), 'Classe : autre que Crâ');
});

test('unknown conditions remain unverified instead of inventing an upper bound', () => {
  const data = catalog([item(1, 'amulet', { conditions: { kind: 'or', children: [condition('actionPoints', '<', 7), { kind: 'unknown', description: 'État du personnage requis' }] } })]);
  const result = inspect(data, request(), { slots: { amulet: 1 } });
  assert.equal(result.items.amulet.condition.satisfied, null);
  assert.equal(result.items.amulet.invalid, false);
  assert.equal(result.issues[0].severity, 'unknown');
  assert.equal(result.limits.actionPoints.equipmentMaximum, null);
  assert.equal(result.exos.actionPoints.status, 'blocked');
  assert.match(result.exos.actionPoints.reasons.join(' '), /à vérifier/);
});

test('a mandatory AND ceiling remains visible when another prerequisite is missing or unknown', () => {
  for (const other of [condition('wisdom', '>', 99), { kind: 'unknown', description: 'Condition inconnue' }]) {
    const data = catalog([item(1, 'amulet', { conditions: { kind: 'and', children: [condition('actionPoints', '<', 12), other] } })]);
    const result = inspect(data, request(), { slots: { amulet: 1 } });
    assert.equal(result.limits.actionPoints.equipmentMaximum, 11);
  }
});

test('an undecided OR inside a failing AND does not accuse PA contributors', () => {
  const data = catalog([
    item(1, 'amulet', { conditions: { kind: 'and', children: [condition('strength', '>', 100), { kind: 'or', children: [condition('actionPoints', '<', 12), { kind: 'unknown', description: 'État requis' }] }] } }),
    item(2, 'hat', { stats: { actionPoints: 5 } }),
  ]);
  const result = inspect(data, request(), { slots: { amulet: 1, hat: 2 } });
  assert.equal(result.items.amulet.invalid, true);
  assert.equal(result.items.hat.invalid, false);
  assert.equal(result.limits.actionPoints.equipmentMaximum, null);
  assert.deepEqual(result.issues[0].slots, ['amulet']);
});

test('all duplicate set-ring, Dofus and prysmaradite slots are marked; ordinary duplicate rings stay legal', () => {
  const ring = item(1, 'ring', { setId: 10 });
  const data = catalog([ring, item(2, 'dofus'), item(3, 'dofus', { typeId: 217 }), item(4, 'dofus', { typeId: 217 }), item(5, 'ring')]);
  const result = inspect(data, request(), { slots: { ring1: 1, ring2: 1, dofus1: 2, dofus2: 2, dofus3: 3, dofus4: 4 } });
  for (const slot of ['ring1', 'ring2', 'dofus1', 'dofus2', 'dofus3', 'dofus4']) assert.equal(result.items[slot].invalid, true, slot);
  const ordinary = inspect(data, request(), { slots: { ring1: 5, ring2: 5 } });
  assert.equal(ordinary.issues.length, 0);
});

test('a broken active-panoply condition highlights its trophy and the pieces of both active sets', () => {
  const data = catalog([
    item(1, 'dofus', { conditions: condition('activeSetCount', '<', 2) }),
    item(2, 'hat', { setId: 10 }), item(3, 'cape', { setId: 10 }),
    item(4, 'belt', { setId: 20 }), item(5, 'boots', { setId: 20 }), item(6, 'weapon', { setId: 30 }),
  ]);
  const result = inspect(data, request(), { slots: { dofus1: 1, hat: 2, cape: 3, belt: 4, boots: 5, weapon: 6 } });
  assert.equal(result.items.dofus1.condition.actual, 2);
  assert.deepEqual(result.issues[0].slots.sort(), ['belt', 'boots', 'cape', 'dofus1', 'hat']);
  assert.equal(result.items.weapon.invalid, false);
});

test('PA gained through a set bonus identifies its pieces as contributors', () => {
  const data = catalog([
    item(1, 'dofus', { conditions: condition('actionPoints', '<', 8) }),
    item(2, 'hat', { setId: 10 }), item(3, 'cape', { setId: 10 }), item(4, 'boots'),
  ], [{ id: 10, name: 'Panoplie test', bonuses: [{ count: 2, stats: { actionPoints: 1 } }] }]);
  const result = inspect(data, request(), { slots: { dofus1: 1, hat: 2, cape: 3, boots: 4 } });
  assert.deepEqual(result.issues[0].slots.sort(), ['cape', 'dofus1', 'hat']);
});

test('level requirements and negative PM contributors are explicit', () => {
  const input = request();
  input.character.level = 100;
  const data = catalog([
    item(1, 'amulet', { conditions: condition('movementPoints', '>=', 3) }),
    item(2, 'hat', { stats: { movementPoints: -1 }, level: 150 }), item(3, 'boots'),
  ]);
  const result = inspect(data, input, { slots: { amulet: 1, hat: 2, boots: 3 } });
  assert.equal(result.items.hat.invalid, true);
  assert.equal(result.items.boots.invalid, false);
  assert.ok(result.issues.some(issue => issue.code === 'level' && issue.message.includes('150')));
  assert.deepEqual(result.issues.find(issue => issue.code === 'condition').slots.sort(), ['amulet', 'hat']);
});

test('exo previews separate global strict maxima, allowed counts and caps from price or damage preferences', () => {
  const input = request();
  input.constraints = [
    { id: 'budget', kind: 'price', target: 0, relation: 'atMost', strict: true, priority: 0 },
    { id: 'damage', kind: 'spell', spellId: 999, target: 10000, relation: 'atLeast', strict: true, priority: 0 },
    { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 7, relation: 'atMost', strict: false, priority: 0 },
  ];
  const data = catalog([item(1, 'hat')]);
  const build = { slots: { hat: 1 } };
  const possible = inspect(data, input, build);
  assert.equal(possible.issues.length, 0);
  assert.equal(possible.exos.actionPoints.status, 'possible');
  input.constraints[2].strict = true;
  const restricted = inspect(data, input, build);
  assert.equal(restricted.limits.actionPoints.strictMaximum, 7);
  assert.equal(restricted.exos.actionPoints.status, 'blocked');
  assert.match(restricted.exos.actionPoints.reasons[0], /contrainte globale.*PA ≤ 7/);
  assert.deepEqual(restricted.exos.actionPoints.affectedSlots, []);
  input.constraints = [];
  input.filters.maxExos = 0;
  assert.match(inspect(data, input, build).exos.actionPoints.reasons[0], /maximum autorisé de 0/);
  input.filters.maxExos = 2;
  input.filters.allowedExos = ['movementPoints'];
  assert.match(inspect(data, input, build).exos.actionPoints.reasons[0], /n’est pas autorisé/);
});

test('already active exos remain removable even after filters change; capped additions have no gain', () => {
  const data = catalog([item(1, 'amulet', { stats: { actionPoints: 5, movementPoints: 3 } })]);
  const input = request();
  const capped = inspect(data, input, { slots: { amulet: 1 } });
  assert.equal(capped.exos.actionPoints.status, 'noGain');
  assert.equal(capped.exos.movementPoints.status, 'noGain');
  assert.match(capped.exos.actionPoints.reasons[0], /12 PA/);
  input.filters.allowedExos = [];
  input.filters.maxExos = 0;
  const active = inspect(data, input, { slots: { amulet: 1 }, exoBonuses: ['actionPoints'] });
  assert.equal(active.exos.actionPoints.status, 'active');
  assert.match(active.exos.actionPoints.reasons[0], /retirer/);
  assert.match(active.exos.actionPoints.reasons.join(' '), /aucun PA utilisable/);
});

test('exo previews keep the exact automatic characteristic allocation and do not mutate the result', () => {
  const data = catalog([item(1, 'amulet', { conditions: condition('strength', '>=', 100) })]);
  const input = request();
  const evaluation = evaluateBuild(data, input, { slots: { amulet: 1 }, baseStats: { strength: 100 } });
  const original = structuredClone(evaluation);
  const result = inspectEquipment(data, input, evaluation);
  assert.equal(result.exos.actionPoints.status, 'possible');
  assert.deepEqual(evaluation, original);
});
