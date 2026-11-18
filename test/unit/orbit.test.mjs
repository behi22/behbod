import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKY, newOrbit, step, score, rate, place } from '../../web/src/pure/orbit.js';

const seeded = (a = 5) => () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
// Flies with `pilot(o)` deciding whether to hold the button; returns the game and its events.
function fly(pilot, seconds = 90, dt = 1 / 60, seed = 5) {
  const o = newOrbit(), rng = seeded(seed), all = [];
  for (let t = 0; t < seconds && !o.over; t += dt) all.push(...step(o, dt, pilot(o), rng));
  return { o, all };
}
// Holds a height: climb when below it.
const hold = h => o => o.r < h;

test('letting go falls into the planet; holding on drifts off into space', () => {
  const down = fly(() => false);
  assert.equal(down.o.why, 'planet');
  assert.ok(down.o.t < 4, `burned up after ${down.o.t.toFixed(1)} s`);
  const up = fly(() => true);
  assert.equal(up.o.why, 'space');
  assert.equal(up.all.at(-1).type, 'crash');
});

test('tapping holds a height; rocks then decide how long it lasts', () => {
  const steady = fly(hold(124), 3);
  assert.equal(steady.o.over, false);
  assert.ok(Math.abs(steady.o.r - 124) < 12, `holding ${steady.o.r.toFixed(0)}`);
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const still = seeds.map(seed => fly(hold(124), 200, 1 / 60, seed).o);
  assert.ok(still.every(o => o.over && o.why === 'rock'), 'a pilot who never dodges is hit in the end');
  // A pilot who looks ahead and changes height for the rock in the way lasts far longer, and can make the minute.
  const dodge = o => {
    const ahead = o.rocks.filter(k => { const gap = Math.atan2(Math.sin(k.a - o.a), Math.cos(k.a - o.a)); return gap > -0.25 && gap < 1.1 && Math.abs(k.r - o.r) < k.size + 30; });
    if (!ahead.length) return o.r < 124;
    const k = ahead.sort((p, q) => Math.abs(p.r - o.r) - Math.abs(q.r - o.r))[0];
    const up = k.r < o.r ? o.r < SKY.high - 26 : o.r < SKY.low + 26;
    return up;
  };
  const sharp = seeds.map(seed => fly(dodge, 200, 1 / 60, seed).o);
  const mean = list => list.reduce((n, o) => n + o.t, 0) / list.length;
  assert.ok(mean(sharp) > mean(still) * 2, `dodging lasts ${mean(sharp).toFixed(0)} s against ${mean(still).toFixed(0)} s`);
  // (This simple pilot only ever looks at one rock; a person who plans ahead does better. The mark to beat is a minute.)
  assert.ok(Math.max(...sharp.map(o => o.t)) >= 45, `its best run: ${Math.max(...sharp.map(o => o.t)).toFixed(0)} s`);
});

test('rocks arrive one by one, away from the ship, and never more than the most', () => {
  const o = newOrbit(), rng = seeded(9);
  let near = 0;
  for (let t = 0; t < 120 && !o.over; t += 1 / 60) {
    for (const e of step(o, 1 / 60, o.r < 150, rng)) {
      if (e.type !== 'rock') continue;
      const k = o.rocks.find(x => x.id === e.id), gap = Math.abs(Math.atan2(Math.sin(k.a - o.a), Math.cos(k.a - o.a)));
      if (gap < 1.5) near++;
      assert.ok(k.r > SKY.low && k.r < SKY.high);
    }
    assert.ok(o.rocks.length <= SKY.rocksMost);
    // The rocks near the ship are cleared away for this test: it is about how they arrive.
    o.rocks = o.rocks.filter(k => Math.abs(k.r - o.r) > 40);
  }
  assert.equal(near, 0, 'none appears beside the ship');
  assert.ok(o.t > 30);
});

test('the score is the seconds lasted and three for each spark', () => {
  const o = newOrbit();
  o.t = 12.9; o.sparks = 2;
  assert.equal(score(o), 18);
  const r = fly(o2 => (o2.spark ? o2.r < o2.spark.r : o2.r < 124), 60, 1 / 60, 2);
  assert.ok(r.all.some(e => e.type === 'spark') || r.o.t < 20, 'a pilot who flies for the sparks gets some');
});

test('the same flight comes out the same at any frame rate, and a finished one stays finished', () => {
  const ends = [1 / 30, 1 / 60, 1 / 144].map(dt => fly(() => false, 10, dt).o.t);
  assert.ok(Math.max(...ends) - Math.min(...ends) < 0.08, ends.map(t => t.toFixed(3)).join(' '));
  const done = fly(() => false).o, before = JSON.stringify(done);
  assert.deepEqual(step(done, 1, true), []);
  assert.equal(JSON.stringify(done), before);
  assert.deepEqual(step(newOrbit(), 0, true), []);
  assert.ok(rate(SKY.low + 5) > rate(SKY.high - 5), 'lower is quicker round');
  assert.deepEqual(place(0, 100), [SKY.size / 2 + 100, SKY.size / 2]);
});
