import test from 'node:test';
import assert from 'node:assert/strict';
import { FM_RUNES, fmAdvice, fmExoLine, fmItemWeight, fmLineCap, fmLines, fmOdds, fmPerfectWeight } from '../packages/shared/dist/index.js';

const rune = (name) => FM_RUNES.find(entry => entry.name === name);
const item = { effects: [
  { effectId: 125, diceNum: 300, diceSide: 400, value: 0 },
  { effectId: 118, diceNum: 60, diceSide: 80, value: 0 },
  { effectId: 157, diceNum: 5, diceSide: 10, value: 0 },
  { effectId: 115, diceNum: 4, diceSide: 0, value: 0 },
] };

test('item lines carry weights, malus bounds and caps', () => {
  const lines = fmLines(item);
  assert.deepEqual(lines.map(line => [line.stat, line.min, line.max]), [['vitality', 300, 400], ['strength', 60, 80], ['criticalHit', 4, 4]]);
  assert.equal(fmLineCap(lines[0]), 505);
  assert.equal(fmLineCap(lines[1]), 101);
  assert.equal(fmPerfectWeight(lines), 80 + 80 + 40);
  assert.equal(fmItemWeight(lines, { 125: 300, 118: -10 }), 60 - 5);
  assert.deepEqual(fmLines({ effects: [{ effectId: 157, diceNum: 5, diceSide: 10, value: 0 }] }).map(l => [l.min, l.max]), [[-10, -5]]);
});

test('odds follow the item fill, the rune reach and the cap', () => {
  const lines = fmLines(item);
  const empty = fmOdds(lines, {}, lines[1], rune('Fo'));
  assert.ok(Math.abs(empty.clean - 0.66) < 1e-9 && empty.failure === 0);
  const perfect = { 125: 400, 118: 80, 115: 4 };
  const ra = fmOdds(lines, { ...perfect, 118: 95 }, lines[1], rune('Ra Fo'));
  assert.equal(ra.failure, 1, '105 strength is past the 101 cap');
  assert.ok(fmOdds(lines, perfect, lines[1], rune('Fo')).clean < fmOdds(lines, { ...perfect, 118: 70 }, lines[1], rune('Fo')).clean);
  const pa = fmOdds([...lines, fmExoLine(111)], perfect, fmExoLine(111), rune('Ga Pa'));
  assert.equal(pa.clean, 0.01);
  for (const odds of [empty, ra, pa]) assert.ok(Math.abs(odds.clean + odds.partial + odds.failure - 1) < 1e-9);
});

test('advice goes heavy line first, with the biggest rune that stays within the perfect jet', () => {
  const lines = fmLines(item);
  const advice = fmAdvice(lines, { 125: 300, 118: 60, 115: 3 }, { 125: 400, 118: 65, 115: 4 });
  assert.equal(advice.line.stat, 'criticalHit');
  const next = fmAdvice(lines, { 125: 300, 118: 60, 115: 4 }, { 125: 400, 118: 65, 115: 4 });
  assert.equal(next.line.stat, 'strength');
  assert.equal(next.rune.name, 'Ra Fo', '60 + 10 stays under the 80 jet');
  assert.equal(fmAdvice(lines, { 118: 65 }, { 118: 65 }), undefined);
});

test('screen text from the forgemagic window becomes line values', async () => {
  const { fmEffectLabels, fmParseScreen } = await import('../packages/shared/dist/index.js');
  const { readFileSync } = await import('node:fs');
  const labels = fmEffectLabels(JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')));
  const read = fmParseScreen('312 Vitalité\n-5 Intelligence\n8% Critique\n12 Dommages Feu\n7 Dommages\n1 PA\n45 Forse\n% Résistance Terre\nReliquat : 12,5\n', labels);
  assert.equal(fmParseScreen('Reliquat : O', labels).pool, 0);
  assert.deepEqual(read.values, { 125: 312, 126: -5, 115: 8, 424: 12, 112: 7, 111: 1, 118: 45 });
  assert.equal(read.pool, 12.5);
  assert.ok(read.exact.has(424) && !read.exact.has(118), 'OCR typo "Forse" is a loose match');
});

test('a loss takes the pool first, then whole points whose excess refills the pool', async () => {
  const { fmApply } = await import('../packages/shared/dist/index.js');
  const lines = fmLines({ effects: [{ effectId: 111, diceNum: 1, diceSide: 0, value: 0 }, { effectId: 118, diceNum: 10, diceSide: 20, value: 0 }] });
  const [pa, force] = lines;
  const always = () => 0.99; // never a harmless failure
  assert.deepEqual(fmApply(lines, { values: { 111: 1, 118: 10 }, pool: 5 }, force, rune('Pa Fo'), 'partial', always), { values: { 111: 1, 118: 13 }, pool: 2 });
  // No pool: a neutral success spares the rune's line, so the AP goes and its 97 extra weight becomes pool.
  assert.deepEqual(fmApply(lines, { values: { 111: 1, 118: 10 }, pool: 0 }, force, rune('Pa Fo'), 'partial', always), { values: { 111: 0, 118: 13 }, pool: 97 });
  assert.deepEqual(fmApply(lines, { values: { 111: 1, 118: 10 }, pool: 0 }, pa, rune('Ga Pa'), 'clean', always), { values: { 111: 2, 118: 10 }, pool: 0 });
});

test('the rollout planner ranks the runes by chance of reaching the targets', async () => {
  const { fmPlan } = await import('../packages/shared/dist/index.js');
  const lines = fmLines(item);
  const plan = fmPlan(lines, { values: { 125: 300, 118: 60, 115: 4 }, pool: 0 }, { 125: 400, 118: 80, 115: 4 }, { rollouts: 40 });
  assert.ok(plan.length > 0 && plan.every(option => option.success >= 0 && option.success <= 1));
  assert.ok(plan[0].success >= Math.max(...plan.map(option => option.success)) - 0.15, 'the best chance comes first, up to simulation noise');
  assert.ok(plan.every(option => ['vitality', 'strength'].includes(option.line.stat)), 'only missing lines are candidates');
  assert.deepEqual(fmPlan(lines, { values: { 125: 400, 118: 80, 115: 4 }, pool: 0 }, { 125: 400, 118: 80, 115: 4 }), []);
});

test('the in-game forgemagic table read by the OCR gives every line and the pool', async () => {
  const { fmEffectLabels, fmParseScreen } = await import('../packages/shared/dist/index.js');
  const { readFileSync } = await import('node:fs');
  const labels = fmEffectLabels(JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')));
  // Real OCR output (sparse text, words regrouped by row) of a level 200 forgemagic window.
  const read = fmParseScreen(`reliquat : 4,4 =
FUSIONNER TOUT FUSIONNER
Min Max Effets / Carac Modif Pa Ra
201 250 & 225 Vitalité 241 87) 57)
81 100 è 99 Chance +10 475 72, og)
4 5 ! 3% Critique
16 20 é 16 Dommages Eau cd
7 10 Ÿ 5% Résistance Eau __ 5
7 10 (6) 5% Résistance Eau -2 67`, labels);
  assert.deepEqual(read.values, { 125: 225, 123: 99, 115: 3, 426: 16, 211: 5 });
  assert.equal(read.pool, 4.4);
});

test('the planner never overshoots a target with a bigger rune than needed', async () => {
  const { fmPlan } = await import('../packages/shared/dist/index.js');
  const lines = fmLines({ effects: [{ effectId: 125, diceNum: 201, diceSide: 250, value: 0 }, { effectId: 123, diceNum: 81, diceSide: 100, value: 0 }] });
  const plan = fmPlan(lines, { values: { 125: 219, 123: 99 }, pool: 4.4 }, { 125: 250, 123: 99 }, { rollouts: 30 });
  assert.ok(plan.length && plan.every(option => option.rune.name !== 'Ra Vi'));
});

test('a small rune almost never passes on a big line, a bigger one still does', () => {
  const lines = fmLines({ effects: [{ effectId: 125, diceNum: 201, diceSide: 250, value: 0 }] });
  const values = { 125: 225 };
  const small = fmOdds(lines, values, lines[0], rune('Vi'));
  assert.ok(small.clean <= 0.011 && small.failure >= 0.85, 'Vi (+5) at 225 vitality fails');
  assert.ok(fmOdds(lines, values, lines[0], rune('Pa Vi')).clean > 0.3, 'Pa Vi (+15) at 225 vitality');
  assert.ok(fmOdds(lines, { 125: 60 }, lines[0], rune('Vi')).clean > 0.3, 'Vi at 60 vitality');
});

test('outcomes are recognised from the item before and after a rune', async () => {
  const { fmDetectOutcome } = await import('../packages/shared/dist/index.js');
  const lines = fmLines(item);
  const before = { values: { 125: 300, 118: 60, 115: 4 }, pool: 0 };
  const clean = fmDetectOutcome(lines, before, { values: { ...before.values, 118: 63 }, pool: 0 });
  assert.equal(clean.outcome, 'clean'); assert.equal(clean.rune.name, 'Pa Fo');
  assert.equal(fmDetectOutcome(lines, before, { values: { 125: 285, 118: 63, 115: 4 }, pool: 0 }).outcome, 'partial');
  assert.deepEqual(fmDetectOutcome(lines, before, { values: { ...before.values, 115: 3 }, pool: 7 }), { outcome: 'failure' });
  assert.equal(fmDetectOutcome(lines, before, before), undefined, 'a harmless failure cannot be seen');
  assert.equal(fmDetectOutcome(lines, { ...before, pool: 4 }, { ...before, pool: 40 }), undefined, 'a pool that only grew is a misread');
  assert.equal(fmDetectOutcome(lines, before, { values: { 125: 305, 118: 63, 115: 4 }, pool: 0 }), undefined, 'two lines up is a misread');
});

test('calibration moves the odds toward real outcomes, slowly with few runes', async () => {
  const { fmCalibration } = await import('../packages/shared/dist/index.js');
  const odds = { clean: 0.5, partial: 0.45, failure: 0.05 };
  assert.equal(fmCalibration([]).cleanScale, 1);
  const unlucky = Array.from({ length: 60 }, (_, i) => ({ ...odds, outcome: i % 5 === 0 ? 'clean' : 'partial', seen: 'manual' }));
  const fitted = fmCalibration(unlucky);
  assert.ok(fitted.cleanScale < 0.6 && fitted.cleanScale > 0.3, `critical successes seen 20% of the time, predicted 50% (${fitted.cleanScale})`);
  assert.ok(fmCalibration(unlucky.slice(0, 5)).cleanScale > fitted.cleanScale, 'few runes stay near the model');
  assert.equal(fitted.count, 60);
});

test('successive halving gives the most simulations to the best options', async () => {
  const { fmPlan } = await import('../packages/shared/dist/index.js');
  const lines = fmLines(item);
  const plan = fmPlan(lines, { values: { 125: 300, 118: 60, 115: 4 }, pool: 0 }, { 125: 400, 118: 80, 115: 4 }, { rollouts: 8, maxRollouts: 64 });
  assert.ok(plan[0].rollouts >= plan[plan.length - 1].rollouts);
  assert.ok(plan.every(option => option.rollouts >= 8 && option.rollouts <= 64));
});

test('an unreachable last point is flagged, and equal options prefer a rune that passes', async () => {
  const { fmHardLines, fmPlan } = await import('../packages/shared/dist/index.js');
  const lines = fmLines({ effects: [{ effectId: 123, diceNum: 81, diceSide: 100, value: 0 }, { effectId: 115, diceNum: 4, diceSide: 5, value: 0 }] });
  const hard = fmHardLines(lines, { 123: 99, 115: 4 }, { 123: 100, 115: 5 });
  assert.deepEqual(hard.map(entry => entry.rune.name), ['Cha'], 'only a +1 fits on 99 chance, and it fails');
  const plan = fmPlan(lines, { values: { 123: 99, 115: 4 }, pool: 0 }, { 123: 100, 115: 5 }, { rollouts: 32 });
  assert.equal(plan[0].rune.name, 'Cri');
});

test('the biggest roll is the aim: a +10 may pass the target, never the perfect jet', async () => {
  const { fmAdvice, fmPlan } = await import('../packages/shared/dist/index.js');
  const lines = fmLines({ effects: [{ effectId: 123, diceNum: 81, diceSide: 100, value: 0 }, { effectId: 125, diceNum: 201, diceSide: 250, value: 0 }] });
  assert.equal(fmAdvice(lines, { 123: 87, 125: 250 }, { 123: 90, 125: 250 }).rune.name, 'Ra Cha');
  assert.equal(fmPlan(lines, { values: { 123: 87, 125: 250 }, pool: 0 }, { 123: 90, 125: 250 }, { rollouts: 32 })[0].rune.name, 'Ra Cha');
  assert.ok(fmPlan(lines, { values: { 123: 100, 125: 219 }, pool: 0 }, { 123: 100, 125: 250 }, { rollouts: 16 }).every(option => option.rune.name !== 'Ra Vi'), '219 + 50 is past the 250 jet');
});
