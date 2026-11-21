import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, START_BPM, SWING, onScale, step, phase, ticks, armAngle, retime, weightAt } from '../../web/src/pure/metronome.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('the tempo steps along a real metronome\'s marks and stops at both ends', () => {
  assert.deepEqual([MARKS[0], MARKS.at(-1)], [40, 208]);
  for (let i = 1; i < MARKS.length; i++) assert.ok(MARKS[i] > MARKS[i - 1]);
  assert.ok(MARKS.includes(START_BPM));
  assert.equal(step(96, 1), 100);
  assert.equal(step(96, -1), 92);
  assert.equal(step(60, 1), 63);
  assert.equal(step(40, -1), 40);
  assert.equal(step(208, 1), 208);
  // Anything kept from another visit lands on the nearest mark; nonsense starts at the usual tempo.
  assert.equal(onScale(97), 96);
  assert.equal(onScale(10), 40);
  assert.equal(onScale(999), 208);
  assert.equal(onScale('abc'), START_BPM);
  assert.equal(onScale(null), 40);
  assert.equal(step(97, 1), 100);
});

test('the ticks come once a beat, the first half a beat after the start, with none lost or doubled across slices', () => {
  const t0 = 10, bpm = 120;
  assert.deepEqual(ticks(10, 12, t0, bpm), [10.25, 10.75, 11.25, 11.75]);
  // Nothing before the start, even when asked from earlier.
  assert.deepEqual(ticks(0, 10.3, t0, bpm), [10.25]);
  // Scheduling in slices of any size gives exactly the same ticks as one long slice.
  for (const slice of [0.05, 0.3, 0.37, 1.5]) {
    const all = [];
    for (let a = 9; a < 40; a += slice) all.push(...ticks(a, a + slice, t0, bpm));
    const once = ticks(9, 9 + slice * Math.ceil(31 / slice), t0, bpm);
    assert.equal(all.length, once.length, `slice ${slice}`);
    all.forEach((t, i) => assert.ok(close(t, once[i], 1e-6)));
  }
  // A tick exactly on a slice edge belongs to the later slice only.
  assert.deepEqual(ticks(10, 10.25, t0, bpm), []);
  assert.deepEqual(ticks(10.25, 10.5, t0, bpm), [10.25]);
  for (const b of MARKS) {
    const ts = ticks(0, 30, 0, b);
    for (let i = 1; i < ts.length; i++) assert.ok(close(ts[i] - ts[i - 1], 60 / b, 1e-9));
  }
});

test('the arm leaves the middle without a jump and is at the end of its swing on every tick', () => {
  const t0 = 3, bpm = 72;
  assert.equal(armAngle(2, t0, bpm), 0);
  assert.equal(armAngle(3, t0, bpm), 0);
  assert.ok(Math.abs(armAngle(3.001, t0, bpm)) < 0.01);
  ticks(3, 20, t0, bpm).forEach((t, i) => {
    assert.ok(close(Math.abs(armAngle(t, t0, bpm)), SWING, 1e-9), `tick ${i}`);
    // Each tick is the other side from the one before.
    assert.equal(Math.sign(armAngle(t, t0, bpm)), i % 2 ? -1 : 1);
  });
  for (let t = 3; t < 20; t += 0.013) assert.ok(Math.abs(armAngle(t, t0, bpm)) <= SWING + 1e-12);
});

test('a new tempo carries the swing on from where the arm is', () => {
  const t0 = 1, t = 7.3;
  for (const [a, b] of [[96, 100], [96, 40], [40, 208], [120, 60]]) {
    const n0 = retime(t, t0, a, b);
    assert.ok(close(phase(t, n0, b), phase(t, t0, a), 1e-9));
    assert.ok(close(armAngle(t, n0, b), armAngle(t, t0, a), 1e-9));
    // The next tick at the new tempo is the next end of the swing, not a skip back.
    const next = ticks(t, t + 5, n0, b)[0];
    assert.ok(next > t && next - t <= 60 / b + 1e-9);
  }
});

test('the weight rides high for slow tempos and low for fast ones, always on the arm', () => {
  for (let i = 1; i < MARKS.length; i++) assert.ok(weightAt(MARKS[i]) < weightAt(MARKS[i - 1]));
  assert.ok(weightAt(40) <= 0.95 && weightAt(208) >= 0.2);
});
