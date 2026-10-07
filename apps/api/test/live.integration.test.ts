import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { calculateSpellDamage, calculateWeaponDamage, evaluateBuild, getSpellLevel, type Catalog, type JobReceipt, type JobSnapshot, type OptimizationRequest } from '@dofus/shared';

test('Live stack: unrequested equipment maluses reduce the score and survive Redis/WebSocket recovery', {
  skip: !process.env.API_URL, timeout: 15_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const item = catalog.items.find(value => value.slotType === 'hat' && !value.conditions
    && !value.dataWarnings?.length && !value.unsupportedEffects?.length
    && (value.stats.agility < 0 || value.stats.tackleEvade < 0 || value.stats.intelligence < 0));
  assert.ok(item);
  const input: OptimizationRequest = {
    character: { classId: catalog.classes[0].id, level: 200, allocationMode: 'manual', baseStats: {} },
    constraints: [{ id: 'level', kind: 'stat', statKey: 'level', target: 200, relation: 'atLeast', priority: 0, strict: true }],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], allowedItemIds: [item.id], lockedSlots: { hat: item.id } },
    prices: { server: catalog.servers[0], values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3,
  };
  const expected = evaluateBuild(catalog, input, { slots: { hat: item.id } });
  assert.ok(expected.valid && expected.maluses.penalty > 0);
  assert.equal(expected.score, 100 - expected.maluses.penalty);
  const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 201, await response.clone().text());
  const receipt = await response.json() as JobReceipt;
  const socket = new SocketProbe(base);
  try {
    const subscribed = await socket.subscribe(receipt.id, receipt.token);
    assert.equal(subscribed.ok, true);
    const complete = subscribed.snapshot?.status === 'completed' ? subscribed.snapshot
      : await socket.waitFor(value => value.id === receipt.id && value.status === 'completed');
    assert.equal(complete.results[0].score, expected.score);
    assert.deepEqual(complete.results[0].maluses, expected.maluses);
    const recovered = await fetch(`${base}/api/jobs/${receipt.id}`, { headers: { Authorization: `Bearer ${receipt.token}` } }).then(response => response.json()) as JobSnapshot;
    assert.deepEqual(recovered.results[0].maluses, expected.maluses);
    assert.equal(recovered.results[0].score, expected.score);
  } finally { socket.close(); }
});

test('Live stack: native conditional spell scenarios remain distinct through optimization and WebSocket recovery', {
  skip: !process.env.API_URL, timeout: 20_000,
}, async()=>{
  const base=process.env.API_URL!.replace(/\/$/,''),catalog=await fetch(`${base}/api/catalog`).then(r=>r.json()) as Catalog;
  assert.ok(catalog.combatSpells?.length&&catalog.combatStates?.length&&catalog.summons?.length);
  const item=catalog.items.find(i=>i.slotType==='hat'&&!i.conditions&&!i.dataWarnings?.length&&!i.unsupportedEffects?.length)!,spell=catalog.spells.find(s=>s.name==='Glas')!;
  assert.ok(item&&spell);
  const input:OptimizationRequest={character:{classId:5,level:200,baseStats:{},allocationMode:'manual'},target:{percent:{},flat:{},criticalResistance:0,distance:'ranged'},constraints:[
    {id:'low-charge',kind:'spell',spellId:spell.id,metric:'min',mode:'normal',target:24,relation:'atLeast',priority:0,strict:true,scenario:{casterStates:[707],baseDamageBonus:3}},
    {id:'high-charge',kind:'spell',spellId:spell.id,metric:'min',mode:'normal',target:84,relation:'atLeast',priority:0,strict:true,scenario:{casterStates:[707],baseDamageBonus:18}},
  ],filters:{excludedItemIds:[],excludedTypeIds:[],excludedCategories:[],allowedItemIds:[item.id],lockedSlots:{hat:item.id}},prices:{server:catalog.servers[0],values:{},ownedItemIds:[],mode:'total'},seconds:3};
  const expected=evaluateBuild(catalog,input,{slots:{hat:item.id}}).constraints;
  assert.ok(expected[1].value>expected[0].value);
  const response=await fetch(`${base}/api/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  assert.equal(response.status,201,await response.clone().text());
  const receipt=await response.json() as JobReceipt,socket=new SocketProbe(base);
  try{
    const subscribed=await socket.subscribe(receipt.id,receipt.token);assert.equal(subscribed.ok,true);
    const complete=subscribed.snapshot?.status==='completed'?subscribed.snapshot:await socket.waitFor(value=>value.id===receipt.id&&value.status==='completed');
    assert.ok(complete.results.length>0);
    assert.deepEqual(complete.results[0].constraints,expected);
    const recovered=await fetch(`${base}/api/jobs/${receipt.id}`, { headers: { Authorization: `Bearer ${receipt.token}` } }).then(r=>r.json()) as JobSnapshot;
    assert.deepEqual(recovered.results[0].constraints,expected);
  }finally{socket.close();}
});

test('Live stack: with-power and plain stat objectives keep distinct values through HTTP, Redis and WebSocket recovery', {
  skip: !process.env.API_URL, timeout: 15_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const item = catalog.items.find(value => value.slotType === 'hat' && value.stats.damagePercent > 0
    && !value.conditions && !value.dataWarnings?.length);
  assert.ok(item, 'An unconditional hat with permanent power must be present.');
  const strength = 150 + (item.stats.strength || 0);
  const combined = strength + item.stats.damagePercent;
  const input: OptimizationRequest = {
    character: { classId: catalog.classes[0].id, level: 200, allocationMode: 'manual', baseStats: { strength: 100 }, scrollStats: { strength: 50 } },
    constraints: [
      { id: 'with-power', kind: 'stat', statKey: 'strength', includePower: true, target: combined, relation: 'atLeast', priority: 0, strict: true },
      { id: 'plain', kind: 'stat', statKey: 'strength', target: strength, relation: 'atMost', priority: 0, strict: true },
    ],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], allowedItemIds: [item.id], lockedSlots: { hat: item.id } },
    prices: { server: catalog.servers[0], values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3,
  };
  const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 201, await response.clone().text());
  const receipt = await response.json() as JobReceipt;
  const socket = new SocketProbe(base);
  try {
    const subscribed = await socket.subscribe(receipt.id, receipt.token);
    assert.equal(subscribed.ok, true);
    const complete = subscribed.snapshot?.status === 'completed' ? subscribed.snapshot
      : await socket.waitFor(value => value.id === receipt.id && value.status === 'completed');
    assert.ok(complete.results.length > 0);
    assert.deepEqual(complete.results[0].constraints.map(entry => [entry.value, entry.satisfied]), [[combined, true], [strength, true]]);
    assert.equal(complete.results[0].stats.strength, strength);
    const recovered = await fetch(`${base}/api/jobs/${receipt.id}`, { headers: { Authorization: `Bearer ${receipt.token}` } }).then(value => value.json()) as JobSnapshot;
    assert.deepEqual(recovered.results[0].constraints, complete.results[0].constraints);
  } finally { socket.close(); }
});

test('Live stack: maintenance and server prices are readable, catalog revisions and impossible stat caps are validated', {
  skip: !process.env.API_URL, timeout: 10_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  assert.match(catalog.revision || '', /^[a-f0-9]{64}$/);
  const report = await fetch(`${base}/api/maintenance`);
  assert.equal(report.status, 200);
  const maintenance = await report.json() as { running: boolean; cron: string; timezone: string };
  assert.equal(typeof maintenance.running, 'boolean');
  assert.ok(maintenance.cron && maintenance.timezone);
  const priceResponse = await fetch(`${base}/api/prices?server=${encodeURIComponent(catalog.servers[0])}`);
  assert.equal(priceResponse.status, 200);
  const prices = await priceResponse.json() as { server: string; values: Record<string, number>; status: string };
  assert.equal(prices.server, catalog.servers[0]);
  assert.ok(['available', 'unconfigured', 'unavailable'].includes(prices.status));
  assert.equal((await fetch(`${base}/api/prices?server=does-not-exist`)).status, 400);
  const request: OptimizationRequest = {
    catalogRevision: catalog.revision,
    character: { classId: catalog.classes[0].id, level: 200, baseStats: {} },
    constraints: [{ id: 'impossible', kind: 'stat', statKey: 'earthElementResistPercent', target: 51, relation: 'atLeast', priority: 0, strict: true }],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} },
    prices: { server: catalog.servers[0], values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3,
  };
  const post = (input: OptimizationRequest) => fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal((await post(request)).status, 400);
  assert.equal((await post({ ...request, constraints: [], catalogRevision: '0'.repeat(64) })).status, 400);
});

/** Minimal Engine.IO/Socket.IO client: no browser test dependency is required. */
class SocketProbe {
  readonly snapshots: JobSnapshot[] = [];
  private readonly socket: WebSocket;
  private sequence = 0;
  private readonly acknowledgements = new Map<number, (payload: { ok: boolean; snapshot?: JobSnapshot }) => void>();
  readonly connected: Promise<void>;

  constructor(url: string) {
    this.socket = new WebSocket(url.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket');
    this.connected = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5_000);
      this.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed')); });
      this.socket.addEventListener('message', event => {
        const payload = String(event.data);
        if (payload.startsWith('0')) this.socket.send('40');
        else if (payload === '2') this.socket.send('3');
        else if (payload.startsWith('40')) { clearTimeout(timeout); resolve(); }
        else if (payload.startsWith('42')) {
          const [name, snapshot] = JSON.parse(payload.slice(2));
          if (name === 'job:update') this.snapshots.push(snapshot);
        } else {
          const ack = payload.match(/^43(\d+)(\[.*)$/);
          if (ack) {
            const callback = this.acknowledgements.get(Number(ack[1]));
            this.acknowledgements.delete(Number(ack[1]));
            callback?.(JSON.parse(ack[2])[0]);
          }
        }
      });
    });
  }

  async subscribe(jobId: string, token: string): Promise<{ ok: boolean; snapshot?: JobSnapshot }> {
    await this.connected;
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timeout = setTimeout(() => { this.acknowledgements.delete(id); reject(new Error('Subscription timeout')); }, 5_000);
      this.acknowledgements.set(id, value => { clearTimeout(timeout); resolve(value); });
      this.socket.send(`42${id}${JSON.stringify(['subscribe', { jobId, token }])}`);
    });
  }

  async waitFor(predicate: (snapshot: JobSnapshot) => boolean, timeout = 10_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const matching = this.snapshots.find(predicate);
      if (matching) return matching;
      await delay(30);
    }
    throw new Error('Expected job update did not arrive');
  }

  close() { this.socket.close(); }
}

test('Live stack: equipped weapon damage and critical chance survive the queue and WebSocket', {
  skip: !process.env.API_URL, timeout: 20_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const target = { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' as const };
  const weapon = catalog.items.find(item => {
    if (item.slotType !== 'weapon' || !item.weapon || item.conditions || item.unsupportedEffects?.length) return false;
    const damage = calculateWeaponDamage(item, item.stats, target, 200);
    return damage.supported && (damage.critical?.min || 0) > 0 && damage.critChance > 0;
  });
  assert.ok(weapon, 'The deployed catalogue must expose verified weapon metadata and direct damage.');
  const input: OptimizationRequest = {
    catalogRevision: catalog.revision,
    character: { classId: catalog.classes[0].id, level: 200, baseStats: {} }, constraints: [], target,
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {}, allowedItemIds: [weapon.id] },
    prices: { server: catalog.servers[0], values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3,
  };
  const baseline = evaluateBuild(catalog, input, { slots: { weapon: weapon.id } });
  const expected = calculateWeaponDamage(weapon, baseline.stats, target, 200);
  input.constraints = [
    { id: 'weapon-damage', kind: 'weapon', mode: 'critical', metric: 'min', target: expected.critical!.min, relation: 'atLeast', priority: 0, strict: true },
    { id: 'weapon-chance', kind: 'weapon', metric: 'criticalChance', target: expected.critChance, relation: 'atLeast', priority: 0, strict: true },
  ];
  const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 201, await response.clone().text());
  const receipt = await response.json() as JobReceipt;
  const socket = new SocketProbe(base);
  try {
    const subscription = await socket.subscribe(receipt.id, receipt.token);
    assert.equal(subscription.ok, true);
    const complete = subscription.snapshot?.status === 'completed' ? subscription.snapshot
      : await socket.waitFor(snapshot => snapshot.id === receipt.id && snapshot.status === 'completed');
    assert.ok(complete.results.length > 0);
    assert.equal(complete.results[0].build.slots.weapon, weapon.id);
    assert.deepEqual(complete.results[0].constraints.map(criterion => [criterion.value, criterion.satisfied]),
      [[expected.critical!.min, true], [expected.critChance, true]]);
    assert.equal(complete.results[0].valid, true);
  } finally { socket.close(); }
});

test('Live stack: capabilities isolate jobs, Redis pushes progress, reconnect recovers and cancellation stops work', {
  skip: !process.env.API_URL,
  timeout: 30_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const health = await fetch(`${base}/api/health`).then(response => response.json()) as { redis: boolean; workers: number };
  assert.equal(health.redis, true);
  assert.ok(health.workers >= 1);
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const request: OptimizationRequest = {
    character: { classId: catalog.classes.find(value => value.id === 9)?.id || catalog.classes[0].id, level: 200, baseStats: {} },
    constraints: [{ id: 'live-test', kind: 'stat', statKey: 'vitality', target: 4_000, relation: 'maximize', priority: 0, strict: false }],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} },
    prices: { server: catalog.servers[0] || 'Test local', values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3, seed: 16,
  };
  const create = async (input: OptimizationRequest) => {
    const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(response.status, 201, await response.clone().text());
    return response.json() as Promise<JobReceipt>;
  };
  const invalid = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, seconds: 601 }) });
  assert.equal(invalid.status, 400);
  const first = await create(request);
  assert.equal((await fetch(`${base}/api/jobs/${first.id}`)).status, 404);
  assert.equal((await fetch(`${base}/api/jobs/${first.id}?token=${first.token}`)).status, 404);
  assert.equal((await fetch(`${base}/api/jobs/${first.id}`, { headers: { Authorization: `Bearer ${'x'.repeat(43)}` } })).status, 404);
  const unauthorized = new SocketProbe(base);
  const subscribed = new SocketProbe(base);
  let reconnect: SocketProbe | undefined;
  try {
    assert.equal((await unauthorized.subscribe(first.id, 'invalid')).ok, false);
    assert.equal((await subscribed.subscribe(first.id, first.token)).ok, true);
    const complete = await subscribed.waitFor(value => value.id === first.id && value.status === 'completed');
    assert.ok(complete.progress.evaluated > 0);
    assert.equal(complete.progress.percent, 100);
    assert.match(complete.message || '', /Durée choisie écoulée/);
    assert.ok(complete.results.every(value => value.valid));
    assert.equal(unauthorized.snapshots.length, 0);
    const recovered = await fetch(`${base}/api/jobs/${first.id}`, { headers: { Authorization: `Bearer ${first.token}` } }).then(response => response.json()) as JobSnapshot;
    assert.equal(recovered.status, 'completed');
    assert.equal(recovered.progress.evaluated, complete.progress.evaluated);
    subscribed.close();
    reconnect = new SocketProbe(base);
    const initial = await reconnect.subscribe(first.id, first.token);
    assert.equal(initial.ok, true);
    assert.equal(initial.snapshot?.status, 'completed');
    const second = await create({ ...request, seconds: 600 });
    assert.equal((await reconnect.subscribe(second.id, second.token)).ok, true);
    await reconnect.waitFor(value => value.id === second.id && value.status === 'running');
    const cancel = await fetch(`${base}/api/jobs/${second.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${second.token}` }, body: '{}' });
    assert.equal(cancel.status, 200);
    const cancelled = await reconnect.waitFor(value => value.id === second.id && value.status === 'cancelled');
    assert.ok(cancelled.progress.elapsedMs < 30_000);
    assert.equal(unauthorized.snapshots.length, 0);
  } finally {
    unauthorized.close();
    subscribed.close();
    reconnect?.close();
  }
});

test('Live stack: allocated points, scrolling and a global PA bonus survive the queue and WebSocket', {
  skip: !process.env.API_URL,
  timeout: 20_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const item = catalog.items.find(value => value.slotType === 'hat' && !value.stats.actionPoints
    && !value.conditions && !value.dataWarnings?.length);
  assert.ok(item, 'The live catalogue must contain a hat without conditional equipment rules or natural PA.');
  const input: OptimizationRequest = {
    character: { classId: catalog.classes[0].id, level: 200,
      baseStats: { strength: 300, vitality: 300 }, scrollStats: { strength: 100, vitality: 100 } },
    constraints: [
      { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: true },
      { id: 'budget', kind: 'price', target: 750_000, relation: 'atMost', priority: 1, strict: true },
    ],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [],
      allowedItemIds: [item.id], allowedExos: ['actionPoints'],
      lockedSlots: { hat: item.id } },
    prices: { server: catalog.servers[0], values: { [item.id]: 1 }, exoCosts: { actionPoints: 500_000 },
      ownedItemIds: [item.id], mode: 'remaining' },
    seconds: 3,
  };
  const overAllocated = { ...input, character: { ...input.character, baseStats: { strength: 400 } } };
  const invalid = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(overAllocated) });
  assert.equal(invalid.status, 400);
  const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 201, await response.clone().text());
  const receipt = await response.json() as JobReceipt;
  const socket = new SocketProbe(base);
  try {
    const subscribed = await socket.subscribe(receipt.id, receipt.token);
    assert.equal(subscribed.ok, true);
    const complete = subscribed.snapshot?.status === 'completed' ? subscribed.snapshot
      : await socket.waitFor(value => value.id === receipt.id && value.status === 'completed');
    assert.ok(complete.results.length > 0);
    const result = complete.results[0];
    assert.equal(result.characterPoints.available, 995);
    assert.equal(result.characterPoints.spent, 900);
    assert.equal(result.breakdown.strength.base, 300);
    assert.equal(result.breakdown.strength.scroll, 100);
    assert.equal(result.stats.actionPoints, 8);
    assert.deepEqual(result.build.exoBonuses, ['actionPoints']);
    assert.deepEqual(result.build.slots, { hat: item.id });
    assert.equal('exos' in result.build, false);
    assert.equal(result.cost, 500_000);
  } finally { socket.close(); }
});

test('Live stack: automatic allocation optimizes without manually entered stats and recovers after a lower level', {
  skip: !process.env.API_URL,
  timeout: 20_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const item = catalog.items.find(value => value.slotType === 'hat' && value.level <= 100
    && !value.conditions && !value.dataWarnings?.length);
  assert.ok(item);
  const input: OptimizationRequest = {
    character: { classId: catalog.classes[0].id, level: 200, allocationMode: 'automatic',
      baseStats: {}, scrollStats: { strength: 100 } },
    constraints: [{ id: 'strength', kind: 'stat', statKey: 'strength', target: 500, relation: 'maximize', priority: 0, strict: false }],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], allowedItemIds: [item.id], lockedSlots: { hat: item.id } },
    prices: { server: catalog.servers[0], values: {}, ownedItemIds: [], mode: 'total' },
    seconds: 3, seed: 16,
  };
  const socket = new SocketProbe(base);
  const run = async () => {
    const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(response.status, 201, await response.clone().text());
    const receipt = await response.json() as JobReceipt;
    const subscribed = await socket.subscribe(receipt.id, receipt.token);
    assert.equal(subscribed.ok, true);
    const complete = subscribed.snapshot?.status === 'completed' ? subscribed.snapshot
      : await socket.waitFor(value => value.id === receipt.id && value.status === 'completed');
    assert.ok(complete.results.length > 0);
    return complete.results[0];
  };
  try {
    const maximum = await run();
    assert.equal(maximum.build.baseStats?.strength, 398);
    assert.equal(maximum.build.baseStats?.vitality, 3);
    assert.equal(maximum.characterPoints.spent, 995);
    assert.equal(maximum.breakdown.strength.scroll, 100);
    input.character.level = 100;
    input.initialBuild = maximum.build;
    const lowered = await run();
    assert.equal(lowered.build.baseStats?.strength, 265);
    assert.equal(lowered.characterPoints.available, 495);
    assert.equal(lowered.characterPoints.spent, 495);
    assert.equal(lowered.characterPoints.valid, true);
  } finally { socket.close(); }
});

test('Live stack: zero, one and two global exo ceilings survive HTTP, Redis and WebSocket publication', {
  skip: !process.env.API_URL,
  timeout: 20_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const item = catalog.items.find(value => value.slotType === 'hat' && !value.stats.actionPoints && !value.stats.movementPoints
    && !value.conditions && !value.dataWarnings?.length && !value.unsupportedEffects?.length);
  assert.ok(item);
  const input: OptimizationRequest = {
    character: { classId: catalog.classes[0].id, level: 200, baseStats: {} },
    constraints: [
      { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: false },
      { id: 'pm', kind: 'stat', statKey: 'movementPoints', target: 6, relation: 'atLeast', priority: 1, strict: false },
      { id: 'budget', kind: 'price', target: 750_000, relation: 'atMost', priority: 2, strict: true },
    ],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [],
      allowedItemIds: [item.id], allowedExos: ['actionPoints', 'movementPoints'], lockedSlots: { hat: item.id }, maxExos: 0 },
    prices: { server: catalog.servers[0], values: { [item.id]: 1 },
      exoCosts: { actionPoints: 500_000, movementPoints: 100_000 }, ownedItemIds: [item.id], mode: 'remaining' },
    seconds: 3,
  };
  const invalid = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, filters: { ...input.filters, maxExos: 3 } }) });
  assert.equal(invalid.status, 400);
  const socket = new SocketProbe(base);
  try {
    for (const maxExos of [0, 1, 2]) {
      input.filters.maxExos = maxExos;
      const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      assert.equal(response.status, 201, await response.clone().text());
      const receipt = await response.json() as JobReceipt;
      const subscribed = await socket.subscribe(receipt.id, receipt.token);
      assert.equal(subscribed.ok, true);
      const complete = subscribed.snapshot?.status === 'completed' ? subscribed.snapshot
        : await socket.waitFor(value => value.id === receipt.id && value.status === 'completed');
      assert.ok(complete.results.length > 0);
      assert.ok(complete.results.every(value => value.valid && (value.build.exoBonuses?.length || 0) <= maxExos));
      assert.deepEqual(complete.results[0].build.exoBonuses, [[], ['actionPoints'], ['actionPoints', 'movementPoints']][maxExos]);
      assert.deepEqual(complete.results[0].build.slots, { hat: item.id });
      assert.equal(complete.results[0].cost, [0, 500_000, 600_000][maxExos]);
      const recovered = await fetch(`${base}/api/jobs/${receipt.id}`, { headers: { Authorization: `Bearer ${receipt.token}` } }).then(value => value.json()) as JobSnapshot;
      assert.deepEqual(recovered.results[0].build.exoBonuses, complete.results[0].build.exoBonuses);
    }
  } finally { socket.close(); }
});

test('Live stack: independent critical chance and damage criteria survive validation, Redis and WebSocket recovery', {
  skip: !process.env.API_URL,
  timeout: 20_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  const item = catalog.items.find(value => value.slotType === 'hat' && value.stats.criticalHit > 0
    && !value.conditions && !value.dataWarnings?.length && !value.unsupportedEffects?.length);
  assert.ok(item, 'The catalogue must contain an unconditional hat with a critical chance bonus.');
  const spell = catalog.spells.find(value => value.classIds.includes(9) && !value.dataWarnings?.length
    && (getSpellLevel(value, 200)?.criticalHitProbability || 0) > 0
    && calculateSpellDamage(value, item.stats).supported && (calculateSpellDamage(value, item.stats).critical?.min || 0) > 0);
  assert.ok(spell, 'A supported Crâ damage spell must also have a known critical chance.');
  const chance = Math.min(100, getSpellLevel(spell, 200)!.criticalHitProbability + item.stats.criticalHit);
  const damage = calculateSpellDamage(spell, item.stats).critical!.min;
  const input: OptimizationRequest = {
    character: { classId: 9, level: 200, baseStats: {} },
    constraints: [
      { id: 'spell-chance', kind: 'spell', spellId: spell.id, metric: 'criticalChance', target: chance,
        relation: 'atLeast', priority: 0, strict: true },
      { id: 'spell-damage', kind: 'spell', spellId: spell.id, metric: 'min', mode: 'critical', target: damage,
        relation: 'atLeast', priority: 0, strict: true },
    ],
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [],
      allowedItemIds: [item.id], lockedSlots: { hat: item.id } },
    prices: { server: catalog.servers[0], values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3,
  };
  const invalidInput = { ...input, constraints: [{ ...input.constraints[0], target: 101 }] };
  const invalid = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invalidInput) });
  assert.equal(invalid.status, 400);
  const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 201, await response.clone().text());
  const receipt = await response.json() as JobReceipt;
  const socket = new SocketProbe(base);
  try {
    const subscribed = await socket.subscribe(receipt.id, receipt.token);
    assert.equal(subscribed.ok, true);
    const complete = subscribed.snapshot?.status === 'completed' ? subscribed.snapshot
      : await socket.waitFor(value => value.id === receipt.id && value.status === 'completed');
    assert.ok(complete.results.length > 0);
    const expected = [
      { id: 'spell-chance', value: chance, satisfied: true, supported: true },
      { id: 'spell-damage', value: damage, satisfied: true, supported: true },
    ];
    const measured = complete.results[0].constraints.map(({ id, value, satisfied, supported }) => ({ id, value, satisfied, supported }));
    assert.deepEqual(measured, expected);
    const recovered = await fetch(`${base}/api/jobs/${receipt.id}`, { headers: { Authorization: `Bearer ${receipt.token}` } }).then(value => value.json()) as JobSnapshot;
    assert.equal(recovered.status, 'completed');
    assert.deepEqual(recovered.results[0].constraints, complete.results[0].constraints);
  } finally { socket.close(); }
});
