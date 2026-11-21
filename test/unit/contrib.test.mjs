import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContrib, fromCache, toCache, levels, cells, total, WEEKS } from '../../web/src/pure/contrib.js';
import { makeContrib, CONTRIB_URL } from '../../web/src/contrib.js';

// Shaped like the published file: a start date, an end date and two 365-day series. No real counts.
const days = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const FILE = { start: '2025-11-21', end: '2026-11-20', personal: days(365, i => i % 3), other: days(365, i => (i % 7 === 0 ? 4 : 0)) };

test('the two series are added together day by day, under the file\'s start date', () => {
  const g = parseContrib(FILE);
  assert.equal(g.start, '2025-11-21');
  assert.equal(g.days.length, 365);
  for (const i of [0, 1, 6, 7, 100, 364]) assert.equal(g.days[i], FILE.personal[i] + FILE.other[i]);
  assert.equal(total(g.days), total(FILE.personal) + total(FILE.other));
  assert.deepEqual(parseContrib({ start: '2025-11-21', personal: [1, 2, 3] }).days, [1, 2, 3]);
});

test('a file that is not what it should be is refused whole, never half drawn', () => {
  const bad = [null, undefined, 0, 'x', [], [1, 2], {}, { start: '2025-11-21' },
    { ...FILE, start: 'yesterday' }, { ...FILE, start: '2025-02-30' }, { ...FILE, start: 20251121 }, { ...FILE, start: undefined },
    { ...FILE, personal: FILE.personal.slice(1) }, { ...FILE, other: [] }, { ...FILE, other: days(500, () => 1), personal: days(500, () => 1) },
    { ...FILE, personal: [...FILE.personal.slice(1), -1] }, { ...FILE, personal: [...FILE.personal.slice(1), 1.5] },
    { ...FILE, personal: [...FILE.personal.slice(1), '3'] }, { ...FILE, personal: [...FILE.personal.slice(1), null] },
    { ...FILE, personal: [...FILE.personal.slice(1), NaN] }, { ...FILE, personal: [...FILE.personal.slice(1), 1e9] },
    { ...FILE, other: [...FILE.other.slice(1), [1]] }];
  for (const j of bad) assert.equal(parseContrib(j), null, JSON.stringify(j)?.slice(0, 80));
});

test('the copy kept in the browser holds only the added-up days, and reads back the same; anything else reads as nothing', () => {
  const g = parseContrib(FILE), text = toCache(g, 1700000000000);
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ['at', 'days', 'start']);
  assert.deepEqual(fromCache(text), { start: g.start, days: g.days, at: 1700000000000 });
  for (const t of [null, undefined, '', 'not json', '[]', '{}', 'null', JSON.stringify({ start: g.start, days: g.days }), JSON.stringify({ start: 'x', days: g.days, at: 1 }),
    JSON.stringify({ start: g.start, days: [1, -1], at: 1 }), JSON.stringify({ start: g.start, days: g.days, at: 'soon' })]) assert.equal(fromCache(t), null, String(t));
});

test('the five shades: none for an empty day, then the busy days in quarters, the busiest darkest', () => {
  assert.deepEqual(levels([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(levels([0, 1, 2, 3, 4]), [0, 1, 2, 3, 4]);
  assert.deepEqual(levels([5]), [1]);
  const lv = levels(days(365, i => (i * 37) % 23));
  assert.ok(lv.every(v => v >= 0 && v <= 4));
  assert.ok([1, 2, 3, 4].every(k => lv.includes(k)));
  const d = days(365, i => (i * 37) % 23);
  for (let i = 0; i < d.length; i++) for (let j = 0; j < d.length; j += 17) if (d[i] < d[j]) assert.ok(lv[i] <= lv[j]);
});

test('each day in its square as on GitHub: a week a column, Sunday on top, the newest day last, never more than the screen\'s weeks', () => {
  // 2025-11-21 was a Friday.
  const k = cells(parseContrib(FILE));
  assert.equal(k.length, 365);
  assert.deepEqual([k[0].col, k[0].row], [0, 5]);
  assert.deepEqual([k[2].col, k[2].row], [1, 0]);
  assert.equal(k.at(-1).row, 5);
  assert.equal(Math.max(...k.map(c => c.col)), 52);
  assert.ok(k.every(c => c.col >= 0 && c.col < WEEKS && c.row >= 0 && c.row < 7));
  assert.equal(new Set(k.map(c => c.col * 7 + c.row)).size, 365);
  // A longer file keeps its newest weeks.
  const long = cells({ start: '2025-01-05', days: days(400, () => 1) });
  assert.ok(long.length <= WEEKS * 7 && long.every(c => c.col >= 0 && c.col < WEEKS));
  assert.deepEqual([long.at(-1).col, long.at(-1).row], [WEEKS - 1, (0 + 399) % 7]);
});

// A canvas that takes every drawing call and keeps the text it was given.
function fakeSurface() {
  const said = [];
  const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'fillText' ? s => said.push(s) : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  return { c: { width: 320, height: 190 }, g, t: { needsUpdate: false }, said };
}
const memory = (init = {}) => { const m = { ...init }; return { get: k => m[k] ?? null, set: (k, v) => { m[k] = v; }, m }; };
const answer = body => async () => ({ ok: true, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });

test('a fresh visit: loading first, then the live graph, and the added-up days kept for next time', async () => {
  const sf = fakeSurface(), store = memory(), asked = [];
  const c = makeContrib(sf, { store, font: 'mono', fetch: async (url, o) => { asked.push([url, o.credentials]); return answer(FILE)(); }, now: () => 42 });
  assert.equal(c.state, 'waiting');
  assert.ok(sf.said.includes('loading') && sf.t.needsUpdate);
  assert.equal(await c.refresh(), 'live');
  assert.deepEqual(asked, [[CONTRIB_URL, 'omit']]);
  assert.equal(c.total, total(FILE.personal) + total(FILE.other));
  assert.ok(sf.said.includes(c.total.toLocaleString('en-US')));
  assert.deepEqual(fromCache(store.m['home.contrib']), { ...parseContrib(FILE), at: 42 });
});

test('the kept copy shows at once, and stays when the read fails, answers badly or sends a bad file', async () => {
  const kept = toCache(parseContrib(FILE), 7);
  for (const fetch of [async () => { throw new TypeError('offline'); }, async () => ({ ok: false, status: 500, json: async () => FILE }), answer({ ...FILE, start: 'x' }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('bad json'); } })]) {
    const sf = fakeSurface(), store = memory({ 'home.contrib': kept });
    const c = makeContrib(sf, { store, font: 'mono', fetch });
    assert.equal(c.state, 'saved');
    assert.equal(c.total, total(FILE.personal) + total(FILE.other));
    assert.equal(await c.refresh(), 'saved');
    assert.equal(store.m['home.contrib'], kept);
    assert.ok(!sf.said.includes("can't load the graph right now"));
  }
});

test('nothing ever loaded and the read fails: a plain empty screen that says so, never made-up squares', async () => {
  const sf = fakeSurface(), store = memory({ 'home.contrib': 'garbage' });
  const c = makeContrib(sf, { store, font: 'mono', fetch: async () => { throw new TypeError('offline'); } });
  assert.equal(c.state, 'waiting');
  assert.equal(await c.refresh(), 'none');
  assert.equal(c.total, null);
  assert.ok(sf.said.includes("can't load the graph right now"));
  assert.equal(store.m['home.contrib'], 'garbage');
  // It comes back once a read works.
  const ok = makeContrib(sf, { store, font: 'mono', fetch: answer(FILE) });
  assert.equal(await ok.refresh(), 'live');
});

test('one read at a time: a second ask while the first is out waits for the same answer', async () => {
  let calls = 0, release;
  const gate = new Promise(r => { release = r; });
  const c = makeContrib(fakeSurface(), { store: memory(), font: 'mono', fetch: async () => { calls++; await gate; return answer(FILE)(); } });
  const a = c.refresh(), b = c.refresh();
  release();
  assert.deepEqual(await Promise.all([a, b]), ['live', 'live']);
  assert.equal(calls, 1);
  await c.refresh();
  assert.equal(calls, 2);
});
