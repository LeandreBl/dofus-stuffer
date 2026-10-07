const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('./app.js');

test('initial criteria are valid and tied PA/PM have the same coefficient', () => {
  const state = model.initialState();
  assert.equal(model.validate(state), true);
  assert.deepEqual(model.weights(state), { g1: 3, g2: 2, g3: 1 });
  assert.equal(model.find(state, 's2').group, model.find(state, 's3').group);
});

test('moving budget to the damage level ties them and removes its empty former level', () => {
  const state = model.initialState();
  assert.equal(model.relocate(state, 's4', 'g1'), true);
  assert.equal(model.find(state, 's4').group, model.find(state, 's1').group);
  assert.deepEqual(model.weights(state), { g1: 2, g2: 1 });
  assert.equal(model.validate(state), true);
});

test('an empty drop target does not alter existing weights', () => {
  const state = model.initialState();
  state.groups.splice(1, 0, { id: 'gempty', items: [] });
  assert.deepEqual(model.weights(state), { g1: 3, gempty: 0, g2: 2, g3: 1 });
});

test('reordering a level updates its weight without splitting tied criteria', () => {
  const state = model.initialState();
  assert.equal(model.reorder(state, 'g2', -1), true);
  assert.equal(model.weights(state).g2, 3);
  assert.deepEqual(state.groups[0].items.map(item => item.id), ['s2', 's3']);
  assert.equal(model.reorder(state, 'g2', -1), false);
});

test('invalid moves preserve the complete state', () => {
  const state = model.initialState();
  const before = JSON.stringify(state);
  assert.equal(model.relocate(state, 's1', 'missing'), false);
  assert.equal(model.relocate(state, 'missing', 'g1'), false);
  assert.equal(model.relocate(state, 's1', 'g1'), false);
  assert.equal(JSON.stringify(state), before);
});

test('saved settings reject malicious or corrupted identifiers and values', () => {
  for (const mutate of [
    state => { state.groups[0].id = 'g" onclick="bad'; },
    state => { state.groups[0].items[0].type = '__proto__'; },
    state => { state.groups[1].items[0].id = 's1'; },
    state => { state.groups[0].items[0].value = NaN; },
    state => { state.groups[0].items[0].value = -1; },
    state => { state.groups[0].items[0].mode = 'invalid'; },
    state => { state.groups[1].items[0].value = 2.5; },
    state => { state.groups[0].items[0].strict = 'false'; },
  ]) {
    const state = model.initialState(); mutate(state);
    assert.equal(model.validate(state), false);
  }
});

test('strict budget and decimal millions survive persistence', () => {
  const state = model.initialState();
  const price = model.find(state, 's4').item;
  price.strict = true;
  price.value = 12.5;
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(model.validate(restored), true);
  assert.equal(model.find(restored, 's4').item.value, 12.5);
  assert.equal(model.find(restored, 's4').item.strict, true);
});
