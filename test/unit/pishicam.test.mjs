import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAMS, pickCam, SWITCH_BY, fovFor, FOV_MIN, FOV_MAX, FRAME, placeOf, doingOf } from '../../web/src/pure/pishicam.js';

const WORLD = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const LOFT = WORLD.regions.find(r => r.id === 'loft');
const flat = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('every camera hangs inside the house, below its ceiling, each with its own number', () => {
  assert.deepEqual(CAMS.map(c => c.n), CAMS.map((_, i) => i + 1));
  for (const { at } of CAMS) assert.ok(at[0] > LOFT.min[0] && at[0] < LOFT.max[0] && at[1] > LOFT.min[1] && at[1] < LOFT.max[1] && at[2] > 1.8 && at[2] < LOFT.top, String(at));
});

test('the nearest camera takes her, and another takes over only once it is clearly nearer', () => {
  for (let x = 0.5; x < 21.5; x += 0.5) for (let y = 0.5; y < 14.5; y += 0.5) {
    const c = pickCam([x, y]);
    assert.ok(CAMS.every(o => flat(c.at, [x, y]) <= flat(o.at, [x, y]) + 1e-9));
    for (const now of CAMS) {
      const k = pickCam([x, y], now.n);
      assert.ok(k === now ? flat(now.at, [x, y]) <= flat(c.at, [x, y]) + SWITCH_BY : flat(now.at, [x, y]) > flat(c.at, [x, y]) + SWITCH_BY);
    }
  }
  assert.equal(pickCam([5, 5], 99), pickCam([5, 5]));
});

test('the lens closes in with distance so she stays the same size, within its limits', () => {
  const at = [0, 0, 2];
  let last = Infinity;
  for (let d = 0.5; d < 20; d += 0.5) {
    const f = fovFor(at, [d, 0, 2]);
    assert.ok(f >= FOV_MIN && f <= FOV_MAX && f <= last);
    last = f;
  }
  assert.equal(fovFor(at, [0.2, 0, 2]), FOV_MAX);
  assert.equal(fovFor(at, [40, 0, 2]), FOV_MIN);
  // In the middle range, FRAME metres across fill the picture's height.
  const d = 4, f = fovFor(at, [d, 0, 2]) * Math.PI / 180;
  assert.ok(Math.abs(2 * d * Math.tan(f / 2) - FRAME) < 1e-9);
});

test('her place in the words of the house: the sill, the tree, the perch, the desk, then the rooms', () => {
  assert.equal(placeOf([5.4, 14.7, 0.53], 'window'), 'window sill');
  assert.equal(placeOf([0.7, 10.6, 3.08], 'perch'), 'perch by the fire');
  assert.equal(placeOf([20.9, 1.3, 0.8], 'keys'), 'desk');
  assert.equal(placeOf([0.88, 14.2, 1.2], 'treesit'), 'cat tree');
  assert.equal(placeOf([0.8, 14.05, 0.62], 'climb'), 'cat tree');
  assert.equal(placeOf([0.16, 12.85, 2.32], 'climb'), 'wall shelves');
  assert.equal(placeOf([7, 10.2, -0.45], 'sit'), 'lounge');
  assert.equal(placeOf([20.1, 0.4, 0], 'sit'), 'studio');
  assert.equal(placeOf([1.2, 10, 0], 'sit'), 'by the fire');
  assert.equal(placeOf([8, 14.2, 0], 'wander'), 'by the window');
  assert.equal(placeOf([18.3, 10, 0], 'wander'), 'piano corner');
  assert.equal(placeOf([11.5, 11, 0], 'sit'), 'tea bar');
  assert.equal(placeOf([2.5, 1.2, 0], 'wander'), 'front door');
  assert.equal(placeOf([6.6, 6.4, 0], 'sit'), 'hall');
  // Anywhere in the house has a name.
  for (let x = 0.3; x < 21.8; x += 0.7) for (let y = 0.3; y < 14.8; y += 0.7) assert.ok(placeOf([x, y, 0], 'wander').length > 2);
});

test('what she is doing, from what she is up to, in plain words', () => {
  assert.equal(doingOf('perch'), 'asleep');
  assert.equal(doingOf('window'), 'watching outside');
  assert.equal(doingOf('keys'), 'walking on the keyboard');
  assert.equal(doingOf('sit'), 'sitting');
  assert.equal(doingOf('sit', true), 'grooming');
  assert.equal(doingOf('treat'), 'eating a treat');
  // The treat jar on the desk branch walks her to it in a state of its own.
  assert.equal(doingOf('totreat'), 'off for a treat');
  assert.equal(doingOf('something new'), 'around');
  for (const s of ['window', 'towindow', 'climb', 'perch', 'treesit', 'flee', 'wander', 'down', 'todesk', 'keys', 'play', 'treat', 'petted', 'sit'])
    assert.ok(/^[a-z ]+$/.test(doingOf(s)) && doingOf(s) !== 'around', s);
});

test('every state Pishi has in the code has words', () => {
  const src = readFileSync(new URL('../../web/src/creatures.js', import.meta.url), 'utf8');
  const states = new Set([...src.matchAll(/pishi\.state = '(\w+)'/g), ...src.matchAll(/pishi, \{ state: '(\w+)'/g)].map(m => m[1]));
  assert.ok(states.size >= 10, [...states].join(' '));
  for (const s of states) assert.notEqual(doingOf(s), 'around', s);
});
