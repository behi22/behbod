import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWeekSave } from '../../web/src/weeksave.js';
import { KEY, pack, unpack } from '../../web/src/pure/replay.js';

// Spare moments run by hand, a storage in memory (or one that throws), and a clock the test moves.
function rig({ date = '2026-11-25T20:00:00Z', blocked = false } = {}) {
  const q = [], mem = new Map(), at = { date: new Date(date) };
  const storage = () => {
    if (blocked) throw new Error('blocked');
    return { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  };
  const ws = makeWeekSave({ now: () => at.date, storage, idle: f => q.push(f) });
  const drain = () => { let n = 0; while (q.length) { q.shift()({ didTimeout: false, timeRemaining: () => 50 }); n++; } return n; };
  return { ws, q, mem, at, drain };
}

test('nothing is played until it is started, then only in spare moments, a slice at a time', async () => {
  const { ws, q, drain } = rig();
  assert.equal(ws.stats.started, false);
  assert.equal(ws.stats.week, null);
  ws.start();
  assert.equal(q.length, 1);
  ws.start();
  assert.equal(q.length, 1, 'started twice, still one wait for a spare moment');
  assert.ok(drain() > 1);
  assert.equal(ws.stats.done, true);
  assert.equal(ws.stats.week, '2026-W48');
  const save = await ws.get();
  assert.equal(save.who, 'house');
  assert.equal(save.week, '2026-W48');
});

test('my save replaces the house\'s only when it is better, and only a better one of mine replaces it', async () => {
  const { ws, mem, drain } = rig();
  ws.start(); drain();
  const house = await ws.get();
  assert.equal(ws.offer({ ...house, points: house.points }), true, 'my first save is kept, even when no better than the house\'s');
  assert.equal((await ws.get()).who, 'house', 'but the house\'s stays the save of the week while it is as good');
  assert.equal(ws.offer({ ...house, points: house.points + 1 }), true);
  let save = await ws.get();
  assert.equal(save.who, 'you');
  assert.equal(save.points, house.points + 1);
  assert.equal(unpack(mem.get(KEY), '2026-W48').points, house.points + 1);
  assert.equal(ws.offer({ ...house, points: house.points + 1 }), false, 'as good as mine is not better');
  assert.equal(ws.offer({ ...house, points: house.points + 0.5 }), false);
  assert.equal(ws.offer({ ...house, points: house.points + 2 }), true);
  save = await ws.get();
  assert.equal(save.points, house.points + 2);
});

test('with storage blocked my save still counts for this visit, and nothing throws', async () => {
  const { ws, drain } = rig({ blocked: true });
  ws.start(); drain();
  const house = await ws.get();
  assert.equal(ws.offer({ ...house, points: house.points + 1 }), true);
  assert.equal((await ws.get()).who, 'you');
  assert.equal(ws.offer({ ...house, points: house.points + 0.5 }), false);
});

test('a save kept from last week is not this week\'s', async () => {
  const { ws, mem, drain } = rig();
  ws.start(); drain();
  const house = await ws.get();
  mem.set(KEY, pack({ ...house, week: '2026-W47', points: 99 }));
  assert.equal((await ws.get()).who, 'house');
});

test('Monday brings a new match, even with the page left open: my save from last week goes', async () => {
  const { ws, q, at, drain } = rig({ date: '2026-11-29T20:00:00Z' });
  ws.start(); drain();
  const sunday = await ws.get();
  assert.equal(sunday.week, '2026-W48');
  ws.offer({ ...sunday, points: sunday.points + 1 });
  assert.equal((await ws.get()).who, 'you');
  at.date = new Date('2026-11-30T20:00:00Z');
  let monday = null;
  const next = ws.get().then(s => (monday = s));
  await new Promise(ok => setTimeout(ok, 0));
  assert.equal(monday, null, 'last week\'s save is not handed out while the new week\'s match waits');
  assert.equal(q.length, 1, 'the new week\'s match waits for a spare moment');
  drain();
  await next;
  assert.equal(monday.week, '2026-W49');
  assert.equal(monday.who, 'house');
  assert.notDeepEqual(monday.frames, sunday.frames);
});
