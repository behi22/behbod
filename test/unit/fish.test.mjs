import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swim, reach, SPEED, AMP, DRIFT } from '../../web/src/pure/fish.js';

const PERIOD = 2 * Math.PI / SPEED;

test('heading +x the fish faces +x, heading -x it faces -x, and it is side on for most of each length', () => {
  let side = 0, n = 0;
  for (let t = 0; t < PERIOD; t += 0.01, n++) {
    const { yaw } = swim(t, 0), dir = Math.cos(t * SPEED);
    if (dir > 0.35) assert.equal(yaw, 0);
    if (dir < -0.35) assert.equal(yaw, Math.PI);
    if (yaw === 0 || yaw === Math.PI) side++;
  }
  assert.ok(side / n > 0.75, `${side} of ${n}`);
});

test('it turns round smoothly: never more than a small step from one frame to the next, at 30 frames a second', () => {
  for (const ph of [0, 1.7, 3.4, 5.1, 6.8]) {
    let last = swim(0, ph);
    for (let t = 1 / 30; t < PERIOD * 2; t += 1 / 30) {
      const now = swim(t, ph);
      assert.ok(Math.abs(now.yaw - last.yaw) < 0.2, `yaw jumped ${now.yaw - last.yaw} at ${t}`);
      assert.ok(Math.abs(now.dx - last.dx) < 0.01 && Math.abs(now.dz - last.dz) < 0.005);
      last = now;
    }
  }
});

test('the turn takes about a second and a half and happens at the ends of the swim', () => {
  const turning = [];
  for (let t = 0; t < PERIOD; t += 0.005) { const { yaw, dx } = swim(t, 0); if (yaw > 0.01 && yaw < Math.PI - 0.01) turning.push([t, dx]); }
  const first = turning.filter(([t]) => t < PERIOD / 2), long = first.at(-1)[0] - first[0][0];
  assert.ok(long > 1.2 && long < 1.9, `${long} s`);
  for (const [, dx] of turning) assert.ok(Math.abs(dx) > AMP * 0.9, `turning at ${dx}`);
});

test('it drifts only while it turns, a little toward where its head points, and comes back', () => {
  for (let t = 0; t < PERIOD; t += 0.01) {
    const { yaw, dz } = swim(t, 0);
    assert.ok(dz <= 0 && dz >= -DRIFT - 1e-12);
    if (yaw === 0 || yaw === Math.PI) assert.ok(Math.abs(dz) < 1e-12);
  }
  assert.ok(Math.abs(swim(Math.PI / 2 / SPEED, 0).dz + DRIFT) < 1e-9);
});

test('a fish swims only as far as keeps it inside the water', () => {
  // The tank in the house: water from x 2.63 to 4.57, fish 11.4 cm long.
  const half = 0.057, lo = 2.63, hi = 4.57;
  for (const mid of [2.9, 3.2, 3.4, 3.9, 4.3]) {
    const a = reach(mid, half, lo, hi);
    assert.ok(a > 0 && a <= AMP);
    assert.ok(mid - a - half >= lo + 0.01 - 1e-12 && mid + a + half <= hi - 0.01 + 1e-12, `${mid}: ${a}`);
  }
  assert.equal(reach(3.6, half, lo, hi), AMP);
  assert.equal(reach(2.6, half, lo, hi), 0);
  assert.equal(swim(1, 0, 0).dx, 0);
});
