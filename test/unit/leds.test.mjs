import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, GOAL_TIME, settle, follow, kicked, fade, pulse, toBands, lively, goalFlash } from '../../web/src/pure/leds.js';

test('with the music not counting, the strips are exactly the scene: 1, whatever the level or the beat', () => {
  for (const level of [0, 0.2, 0.7, 1]) for (const kick of [0, 0.6, 1]) assert.equal(pulse(level, 0.4, kick, 0), 1);
});

test('the pulse: louder is brighter, a beat is brighter still, and it stays within its bounds', () => {
  const at = l => pulse(l, 0.5, 0, 1);
  assert.ok(at(0.2) < at(0.5) && at(0.5) < at(0.8));
  assert.ok(pulse(0.5, 0.5, 1, 1) > pulse(0.5, 0.5, 0, 1));
  for (let l = 0; l <= 1; l += 0.05) for (const kick of [0, 0.5, 1]) for (const avg of [0, 0.05, 0.3, 0.9]) {
    const m = pulse(l, avg, kick, 1);
    assert.ok(m >= 0.3 && m <= 1.8, `${l} ${avg} ${kick}: ${m}`);
  }
  // Half the music, half the move.
  assert.ok(Math.abs((pulse(0.9, 0.5, 1, 0.5) - 1) - (pulse(0.9, 0.5, 1, 1) - 1) / 2) < 1e-12);
});

test('a quiet record moves the strips as much as a loud one, once the average has caught up', () => {
  let quiet = 0.4, loud = 0.4;
  for (let i = 0; i < 1500; i++) { quiet = follow(quiet, 0.25, 1 / 60); loud = follow(loud, 0.65, 1 / 60); }
  assert.ok(Math.abs(quiet - 0.25) < 0.01 && Math.abs(loud - 0.65) < 0.01);
  assert.ok(Math.abs(pulse(0.25 * 1.3, quiet, 0, 1) - pulse(0.65 * 1.3, loud, 0, 1)) < 0.02);
});

test('easing in and out lands exactly on 0 and 1, so the strips end exactly where they began', () => {
  let k = 0, n = 0;
  while (k !== 1 && n++ < 1000) k = settle(k, true, 1 / 60);
  assert.equal(k, 1);
  assert.ok(n > 30 && n < 200, `${n} frames`);
  n = 0;
  while (k !== 0 && n++ < 1000) k = settle(k, false, 1 / 60);
  assert.equal(k, 0);
  assert.equal(settle(0, false, 0.016), 0);
  assert.equal(settle(1, true, 0.5), 1);
});

test('a beat kicks, the bar\'s first beat hardest, and the kick dies within half a second', () => {
  assert.equal(kicked(0, 0.6), 0.6);
  assert.equal(kicked(0.6, 1), 1);
  assert.equal(kicked(0.9, 0.6), 0.9);
  assert.equal(kicked(0, 'x'), 0);
  assert.equal(kicked(0, 7), 1);
  let k = 1;
  for (let i = 0; i < 30; i++) k = fade(k, 1 / 60);
  assert.ok(k < 0.02, String(k));
});

const bins = (fn, n = 512) => Uint8Array.from({ length: n }, (_, i) => fn(i * 48000 / 1024));

test('the spectrum: silence is dark, everything at full is lit, and every band is 0 to 1', () => {
  const out = new Float32Array(BANDS);
  assert.ok(toBands(bins(() => 0), 48000, 1024, out).every(v => v === 0));
  assert.ok(toBands(bins(() => 255), 48000, 1024, out).every(v => v === 1));
  for (const sr of [44100, 48000, 96000]) {
    toBands(Uint8Array.from({ length: 512 }, (_, i) => (i * 37) % 256), sr, 1024, out);
    assert.ok(out.every(v => v >= 0 && v <= 1 && Number.isFinite(v)), String(sr));
  }
});

test('the spectrum: a bass note lights the low bands only, a cymbal the high ones only', () => {
  const out = new Float32Array(BANDS);
  toBands(bins(f => (f < 120 ? 230 : 0)), 48000, 1024, out);
  assert.ok(out[0] > 0.5 && out[2] > 0.5, Array.from(out).join(' '));
  assert.ok(out.slice(5).every(v => v === 0));
  toBands(bins(f => (f > 6000 ? 230 : 0)), 48000, 1024, out);
  assert.ok(out[BANDS - 1] > 0.5 && out.slice(0, 10).every(v => v === 0), Array.from(out).join(' '));
});

test('each band moves against its own usual level: steady sits at 0.4, a hit lights it, a drop darkens it', () => {
  const avg = new Float32Array(4).fill(-1), out = new Float32Array(4);
  lively(Float32Array.from([0.9, 0.2, 0, 1]), avg, out, 1 / 60);
  assert.ok(Array.from(out).every(v => Math.abs(v - 0.4) < 1e-6), 'first heard: as usual');
  for (let i = 0; i < 600; i++) lively(Float32Array.from([0.9, 0.2, 0, 1]), avg, out, 1 / 60);
  assert.ok(Array.from(out).every(v => Math.abs(v - 0.4) < 1e-3), Array.from(out).join(' '));
  lively(Float32Array.from([1, 0.35, 0, 0.7]), avg, out, 1 / 60);
  assert.ok(out[0] > 0.7 && out[1] > 0.9 && Math.abs(out[2] - 0.4) < 1e-3 && out[3] === 0, Array.from(out).join(' '));
  for (const v of [0, 0.3, 1]) for (let i = 0; i < 50; i++) { lively(Float32Array.from([v, 1 - v, v, 0.5]), avg, out, 0.05); assert.ok(out.every(x => x >= 0 && x <= 1)); }
});

test('a goal flashes white and gold, the two strip colours out of step, under three flashes a second', () => {
  const [a, b] = goalFlash(0), [c, d] = goalFlash(0.21);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, d);
  assert.deepEqual(b, c);
  assert.ok([a, b].every(x => x.every(v => v >= 0 && v <= 1)));
  let changes = 0;
  for (let ms = 1; ms <= 1000; ms++) if (goalFlash(ms / 1000)[0] !== goalFlash((ms - 1) / 1000)[0]) changes++;
  assert.ok(changes <= 6 && changes >= 2, `${changes} changes in a second`);
  assert.ok(GOAL_TIME > 1 && GOAL_TIME < 4);
});

test('asked for less motion, a goal holds white and gold still', () => {
  for (let s = 0; s < GOAL_TIME; s += 0.01) assert.deepEqual(goalFlash(s, true), goalFlash(0, true));
});
