import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeNav } from '../../web/src/pure/nav.js';
import { midsummer } from '../../web/src/pure/sunbeams.js';
import { TREE, inPocket, PIANO, SEATS, PEN, PLANTS, SCOPE, TOY, HOWL, TEA, atTea, SUN_SPOTS, sunSpot, WHITES, keyUnder, pawNotes, STALK_HIT, BACK_SLEEP } from '../../web/src/pure/residents.js';

const W = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const nav = makeNav(W, { off: n => n === 'slider_slide' });
const FROM = [[7, 10.2, -0.45], [5.4, 13.9, 0], [6.6, 6.4, 0], [14.0, 10.5, 0]];
// Where a path planned from the lounge to `p` ends, and how far that is from `p`.
const miss = p => { const r = nav.path(FROM[0], p); return r ? Math.hypot(r.at(-1)[0] - p[0], r.at(-1)[1] - p[1]) : Infinity; };
// How close a straight walk from a to b at floor height comes to any piece of furniture or wall.
function closest(a, b, zLo = 0.02, zHi = 0.3) {
  let best = Infinity;
  for (let s = 0; s <= 100; s++) {
    const x = a[0] + (b[0] - a[0]) * s / 100, y = a[1] + (b[1] - a[1]) * s / 100, z = a[2];
    for (const c of W.colliders) {
      if (c.max[2] < z + zLo || c.min[2] > z + zHi) continue;
      best = Math.min(best, Math.hypot(Math.max(c.min[0] - x, 0, x - c.max[0]), Math.max(c.min[1] - y, 0, y - c.max[1])));
    }
  }
  return best;
}

test('the cat tree: the walk grid reaches the spot by it, and a short straight walk the rest, clear of everything', () => {
  // The old foot of the tree, the pocket the grid cannot enter: this is why she never got there.
  assert.equal(nav.path(FROM[0], [1.35, 14.1, 0]), null);
  for (const f of FROM) {
    const r = nav.path(f, TREE.reach);
    assert.ok(r && Math.hypot(r.at(-1)[0] - TREE.reach[0], r.at(-1)[1] - TREE.reach[1]) < 0.12, String(f));
  }
  // Pishi is about 0.17 m wide: the gap between the console shelf and the egg chair, then on to the tree's foot.
  assert.ok(closest(TREE.reach, TREE.gap) >= 0.18, String(closest(TREE.reach, TREE.gap)));
  assert.ok(closest(TREE.gap, TREE.foot) >= 0.18, String(closest(TREE.gap, TREE.foot)));
  // From the foot, the first deck is a short hop.
  assert.ok(Math.hypot(TREE.foot[0] - 0.8, TREE.foot[1] - 14.05) < 0.7);
  assert.ok(inPocket(TREE.foot) && inPocket(TREE.gap) && !inPocket(TREE.reach));
  for (const f of FROM) assert.equal(inPocket(f), false);
});

test('every spot a routine walks to is on the walk grid', () => {
  const spots = { piano: PIANO.reach, chair: SEATS.chair.reach, bench: SEATS.bench.reach, pen: PEN.reach, scope: SCOPE.stand, toy: TOY, howl: HOWL, tea: TEA.at, ...Object.fromEntries(PLANTS.map((p, i) => [`plant${i}`, p.stand])), ...Object.fromEntries(SUN_SPOTS.map((p, i) => [`sun${i}`, p])) };
  for (const [k, p] of Object.entries(spots)) assert.ok(miss(p) < 0.16, `${k} ${miss(p)}`);
});

test('the pen falls clear of the chair and the desk, and BH-22 rolls in for it without touching either', () => {
  assert.ok(closest(PEN.fall, PEN.fall) >= 0.15, String(closest(PEN.fall, PEN.fall)));
  // BH-22 is 0.2 m across.
  assert.ok(closest(PEN.reach, PEN.pick) >= 0.11, String(closest(PEN.reach, PEN.pick)));
  assert.ok(Math.hypot(PEN.pick[0] - PEN.fall[0], PEN.pick[1] - PEN.fall[1]) < 0.3, 'it picks the pen up from beside it');
  // The pen lies on the desk, near its front edge.
  const desk = W.colliders.find(c => c.name === 'desk');
  assert.ok(PEN.home[0] > desk.min[0] && PEN.home[0] - desk.min[0] < 0.15 && Math.abs(PEN.home[2] - desk.max[2]) < 0.01);
});

test('BH-22 waters each plant from beside its pot, the last bit rolled straight up to it', () => {
  for (const { pot, stand } of PLANTS) {
    const c = W.colliders.filter(o => Math.hypot((o.min[0] + o.max[0]) / 2 - pot[0], (o.min[1] + o.max[1]) / 2 - pot[1]) < 0.05);
    assert.equal(c.length, 1, String(pot));
    const d = Math.hypot(stand[0] - pot[0], stand[1] - pot[1]);
    assert.ok(d < 0.85, String(pot));
    const end = [pot[0] + (stand[0] - pot[0]) / d * 0.4, pot[1] + (stand[1] - pot[1]) / d * 0.4, pot[2]];
    const box = c[0], out = Math.hypot(Math.max(box.min[0] - end[0], 0, end[0] - box.max[0]), Math.max(box.min[1] - end[1], 0, end[1] - box.max[1]));
    assert.ok(out > 0.05, `rolls up to the pot, not into it: ${pot}`);
  }
});

test('a nap in the sun: a spot the morning sun reaches through the glass, none without one', () => {
  const s = midsummer(2026), spot = sunSpot(s);
  assert.ok(SUN_SPOTS.includes(spot));
  assert.equal(sunSpot(null), null);
  assert.equal(sunSpot([0.5, 0.5, 0.7]), null, 'the sun to the south never comes through the north glass');
  assert.equal(sunSpot([0.7, -0.1, -0.7]), null, 'nor one below the horizon');
});

test('the keys under her paws: white keys from A0 to C8, left to right, now and then two at once', () => {
  assert.equal(WHITES.length, 52);
  assert.equal(keyUnder(PIANO.keys.x0 - 1), 21);
  assert.equal(keyUnder(PIANO.keys.x1 + 1), 108);
  let last = 0;
  for (let x = PIANO.keys.x0; x <= PIANO.keys.x1; x += 0.01) { const m = keyUnder(x); assert.ok(m >= last && WHITES.includes(m)); last = m; }
  assert.equal(pawNotes(18.3, 0.9).length, 1);
  const two = pawNotes(18.3, 0.1);
  assert.equal(two.length, 2);
  assert.equal(WHITES.indexOf(two[1]) - WHITES.indexOf(two[0]), 1);
});

test('her pounce mostly misses; Jessi sometimes sleeps on her back; the tea bar has a size', () => {
  assert.ok(STALK_HIT > 0 && STALK_HIT < 0.5);
  assert.ok(BACK_SLEEP > 0 && BACK_SLEEP < 0.5);
  assert.ok(atTea(TEA.at) && atTea([13.9, 10.5, 0]) && !atTea([19.6, 1.2, 0.45]) && !atTea([7, 10.2, 0]));
});
