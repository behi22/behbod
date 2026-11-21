import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, GOAL_TIME, GOAL_BEAT, GOAL_GAP, settle, follow, kicked, fade, pulse, toBands, lively, goalFlash, goalStart, goalView, unseen } from '../../web/src/pure/leds.js';

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

test('a goal flashes white and gold, the two strip colours out of step, one change a beat', () => {
  const [a, b] = goalFlash(0), [c, d] = goalFlash(GOAL_BEAT + 0.01);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, d);
  assert.deepEqual(b, c);
  assert.deepEqual(goalFlash(GOAL_BEAT - 0.01), goalFlash(0));
  assert.ok([a, b].every(x => x.every(v => v >= 0 && v <= 1)));
  assert.ok(GOAL_TIME > 1 && GOAL_TIME < 4);
  // The flash ends on a beat, so its last change is a whole beat after the one before.
  assert.ok(Math.abs(GOAL_TIME / GOAL_BEAT - Math.round(GOAL_TIME / GOAL_BEAT)) < 1e-9);
});

// Frame times: steady, or with the frame due at `when` held up `late` seconds (the ones it covers never come).
const steady = (fps, offset) => Array.from({ length: Math.ceil((7 - offset) * fps) }, (_, i) => offset + i / fps);
const held = (fps, offset, when, late) => { const ts = steady(fps, offset), i = ts.findIndex(t => t >= when); return [...ts.slice(0, i), ts[i] + late, ...ts.slice(i).filter(t => t > ts[i] + late)]; };
// The strips as world.js drives them, frame by frame: every change of what they show (the scene, or a flash colour).
function run(goals, fps, offset, still = false, times = steady(fps, offset)) {
  let f = null, v = unseen(), shown = 'scene', g = 0;
  const at = [], frames = [];
  for (const t of times) {
    while (g < goals.length && goals[g] <= t) f = goalStart(f, goals[g++]);
    v = goalView(v, f, t, still);
    const now = v.show ? v.show[0].join() : 'scene';
    frames.push([t, now]);
    if (now !== shown) { at.push(t); shown = now; }
  }
  return { at, end: shown, frames };
}
const GOALS = [[0], [0, 0.3], [0, 1], [0, 1.72], [0, 1.85], [0, 1.95], [0, GOAL_TIME - 0.01], [0, GOAL_TIME], [0, GOAL_TIME + 0.02],
  [0, GOAL_TIME + GOAL_BEAT - 0.01], [0, GOAL_TIME + GOAL_BEAT + 0.01], [0, 1.8, 3.6], [0, 0.1, 0.2, 0.3, 2.3, 2.4]];

test('the goal flash stays under three flashes in any second, however the goals and the frames fall, and ends on the scene', () => {
  for (const goals of GOALS) for (const fps of [144, 60, 30, 24]) for (const offset of [0, 0.004, 0.013]) {
    const { at, end, frames } = run(goals, fps, offset), what = `${goals} at ${fps} fps +${offset}: ${at.map(x => x.toFixed(3)).join(' ')}`;
    assert.equal(end, 'scene', what);
    for (let i = 0; i < at.length; i++) {
      // A flash is two changes; three flashes would be six changes within a second.
      assert.ok(at.filter(x => x >= at[i] && x - at[i] <= 1).length <= 5, what);
      if (i) assert.ok(at[i] - at[i - 1] >= GOAL_BEAT - 1 / fps - 1e-9, what);
    }
    // Every goal shows: the strips are flashing within a beat of it.
    for (const t of goals) assert.ok(frames.some(([x, c]) => x >= t && x <= t + GOAL_BEAT + 1 / fps + 1e-9 && c !== 'scene'), `${what}: the goal at ${t} never flashed`);
  }
});

test('asked for less motion, a goal holds white and gold still, one change in and one out', () => {
  for (let s = 0; s < GOAL_TIME; s += 0.01) assert.deepEqual(goalFlash(s, true), goalFlash(0, true));
  for (const goals of GOALS) {
    const { at, end } = run(goals, 60, 0.004, true);
    assert.equal(end, 'scene');
    assert.ok(at.length % 2 === 0 && at.length <= 2 * goals.length, `${goals}: ${at.length} changes`);
    for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= GOAL_BEAT - 1 / 60 - 1e-9, `${goals}: ${at.join(' ')}`);
  }
});

test('a late frame never brings two changes closer than GOAL_GAP, and the flash still stays under three a second and ends on the scene', () => {
  for (const goals of [[0], [0, 1], [0, 1.85]]) for (const fps of [144, 60, 30]) for (const late of [0.03, 0.06, 0.105, 0.2, 0.3]) {
    for (let when = 0.02; when < GOAL_TIME + 2.1; when += 0.01) {
      const { at, end, frames } = run(goals, fps, 0.004, false, held(fps, 0.004, when, late)), what = `${goals} at ${fps} fps, ${late} s late at ${when.toFixed(2)}: ${at.map(x => x.toFixed(3)).join(' ')}`;
      assert.equal(end, 'scene', what);
      for (let i = 0; i < at.length; i++) {
        assert.ok(at.filter(x => x >= at[i] && x - at[i] <= 1).length <= 5, what);
        if (i) assert.ok(at[i] - at[i - 1] >= GOAL_GAP - 1e-9, what);
      }
      for (const t of goals) assert.ok(frames.some(([x, c]) => x >= t && x <= t + GOAL_BEAT + late + 1 / fps + 1e-9 && c !== 'scene'), `${what}: the goal at ${t} never flashed`);
    }
  }
});

test('the frame after a late one waits: 105 ms late on a beat, the next change comes 200 ms after it, not 145', () => {
  const { at } = run([0], 60, 0, false, held(60, 0, GOAL_BEAT, 0.105));
  const late = at.find(x => x > GOAL_BEAT), next = at.find(x => x > late);
  assert.ok(late >= GOAL_BEAT + 0.105 - 1e-9 && next - late >= GOAL_GAP - 1e-9 && next - late < GOAL_GAP + 1 / 60 + 1e-9, at.map(x => x.toFixed(3)).join(' '));
});

