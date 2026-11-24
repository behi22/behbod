import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeNav } from '../../web/src/pure/nav.js';
import { TREE, inPocket } from '../../web/src/pure/residents.js';

const W = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const nav = makeNav(W, { off: n => n === 'slider_slide' });
const FROM = [[7, 10.2, -0.45], [5.4, 13.9, 0], [6.6, 6.4, 0], [14.0, 10.5, 0]];
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
