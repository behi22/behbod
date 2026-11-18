import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, KINDS, newHunt, step, swat, left } from '../../web/src/pure/bughunt.js';

const seeded = (a = 3) => () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
// Runs a hunt; `hunter(h)` may return a bug to swat each frame.
function hunt(hunter, seed = 3, dt = 1 / 60) {
  const h = newHunt(), rng = seeded(seed), all = [];
  while (!h.over) { all.push(...step(h, dt, rng)); const b = hunter(h); if (b) all.push(...swat(h, b.x, b.y)); }
  return { h, all };
}

test('a hunt lasts forty-five seconds and ends once', () => {
  const { h, all } = hunt(() => null);
  assert.equal(h.t, FIELD.time);
  assert.equal(left(h), 0);
  assert.equal(all.filter(e => e.type === 'end').length, 1);
  assert.equal(h.score, 0);
  assert.ok(h.escaped > 20, `${h.escaped} dug in`);
  assert.deepEqual(step(h, 1), []);
  assert.deepEqual(swat(h, 10, 10), []);
});

test('squashing every bug on the page (and sparing the ladybird) scores well past fifty bugs', () => {
  const on = b => b.x > 0 && b.x < FIELD.w && b.y > 0 && b.y < FIELD.h;
  const { h, all } = hunt(h2 => h2.bugs.find(b => b.kind !== 'friend' && on(b)));
  assert.ok(h.squashed >= 50, `${h.squashed} squashed`);
  assert.equal(all.filter(e => e.type === 'ouch').length, 0);
  assert.equal(h.misses, 0);
  assert.ok(h.comboBest >= 5);
  assert.ok(h.score > h.squashed * 10, 'combos and quick ones pay more than the plain ten');
});

test('a combo builds on quick squashes and breaks on a miss or a wait', () => {
  const h = newHunt();
  const put = (kind, x, y) => { h.bugs.push({ id: ++h.ids, kind, x, y, vx: 0, vy: 0, born: h.t, turn: 9 }); };
  put('bug', 100, 100); put('bug', 200, 100); put('quick', 300, 100); put('bug', 400, 100);
  assert.deepEqual(swat(h, 100, 100), [{ type: 'squash', id: 1, kind: 'bug', points: 10, combo: 1 }]);
  assert.equal(swat(h, 205, 104)[0].points, 11, 'the second in a row is worth a tenth more');
  assert.equal(swat(h, 300, 100)[0].points, 30, 'a quick one, third in a row');
  assert.deepEqual(swat(h, 600, 300), [{ type: 'miss' }]);
  assert.equal(h.combo, 0);
  assert.equal(swat(h, 400, 100)[0].combo, 1, 'the miss started it over');
  h.t += 5; put('bug', 100, 300);
  assert.equal(swat(h, 100, 300)[0].combo, 1, 'so does a long wait');
  assert.equal(h.squashed, 5);
});

test('swatting the ladybird costs five seconds and no points; the nearest bug under a click is the one hit', () => {
  const h = newHunt();
  h.t = 10;
  h.bugs.push({ id: 1, kind: 'friend', x: 100, y: 100, vx: 0, vy: 0, born: 10, turn: 9 }, { id: 2, kind: 'bug', x: 118, y: 100, vx: 0, vy: 0, born: 10, turn: 9 });
  assert.equal(swat(h, 116, 100)[0].id, 2, 'the bug right beside her, not her');
  assert.deepEqual(swat(h, 100, 100), [{ type: 'ouch', id: 1 }]);
  assert.equal(h.t, 10 + KINDS.friend.cost);
  assert.equal(h.score, 10);
  for (const bad of [[NaN, 5], [5, undefined], ['a', 'b'], [Infinity, 0]]) assert.deepEqual(swat(h, ...bad), []);
  h.t = FIELD.time - 1; h.bugs.push({ id: 9, kind: 'friend', x: 5, y: 5, vx: 0, vy: 0, born: h.t, turn: 9 });
  swat(h, 5, 5);
  assert.ok(h.t <= FIELD.time, 'the clock never runs past the end');
});

test('never more than a dozen bugs, each comes in from an edge, and they stay on the page once on it', () => {
  const h = newHunt(), rng = seeded(8);
  for (let t = 0; t < 40; t += 1 / 60) {
    for (const e of step(h, 1 / 60, rng)) {
      if (e.type !== 'spawn') continue;
      const b = h.bugs.find(x => x.id === e.id);
      assert.ok(b.x <= 0 || b.x >= FIELD.w || b.y <= 0 || b.y >= FIELD.h, 'starts off the page');
      assert.ok(Object.hasOwn(KINDS, b.kind));
    }
    assert.ok(h.bugs.length <= 12);
    for (const b of h.bugs) if (h.t - b.born > 3.2) assert.ok(b.x > -30 && b.x < FIELD.w + 30 && b.y > -30 && b.y < FIELD.h + 30, `${b.kind} wandered off to ${b.x.toFixed(0)}, ${b.y.toFixed(0)}`);
  }
});
