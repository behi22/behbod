import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reach } from '../../web/src/pure/ik.js';

const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const close = (a, b, e = 1e-9) => assert.ok(d(a, b) < e, `${a} vs ${b}`);
// A standing leg: hip 0.9 up, knee a little forward, ankle on the floor below the hip; thigh 0.45, shin 0.45.
const HIP = [0, 0.9, 0], KNEE = [0, 0.45, 0.02], ANKLE = [0, 0.0004, 0];
const L1 = d(HIP, KNEE), L2 = d(KNEE, ANKLE);

test('the end lands on a target in reach and both bones keep their lengths', () => {
  for (const t of [[0, 0.2, 0], [0.1, 0.3, 0.2], [0, 0.6, 0.3], [-0.2, 0.1, -0.1]]) {
    const s = reach(HIP, KNEE, ANKLE, t, [0, 0, 1]);
    close(s.end, t);
    assert.ok(Math.abs(d(HIP, s.mid) - L1) < 1e-9);
    assert.ok(Math.abs(d(s.mid, s.end) - L2) < 1e-9);
    assert.equal(s.short, 0);
  }
});

test('the knee bends the way the pose already bends it: forward, here', () => {
  const s = reach(HIP, KNEE, ANKLE, [0, 0.25, 0], [0, 0, -1]);
  assert.ok(s.mid[2] > 0.1, `knee forward ${s.mid[2]}`);
  // Bent the other way in the pose, it stays bent that way.
  const back = reach(HIP, [0, 0.45, -0.02], ANKLE, [0, 0.25, 0], [0, 0, 1]);
  assert.ok(back.mid[2] < -0.1);
});

test('a straight leg bends toward the pole', () => {
  const s = reach(HIP, [0, 0.45, 0], [0, 0, 0], [0, 0.3, 0], [0, 0, 1]);
  assert.ok(s.mid[2] > 0.1);
  const t = reach(HIP, [0, 0.45, 0], [0, 0, 0], [0, 0.3, 0], [1, 0, 0]);
  assert.ok(t.mid[0] > 0.1 && Math.abs(t.mid[2]) < 1e-9);
});

test('a target out of reach is reached toward as far as the limb goes, and says how far short it is', () => {
  const s = reach(HIP, KNEE, ANKLE, [0, -0.5, 0], [0, 0, 1]);
  assert.ok(Math.abs(d(HIP, s.end) - (L1 + L2) * 0.9999) < 1e-9);
  assert.ok(s.end[1] < 0 && Math.abs(s.end[0]) < 1e-12);
  assert.ok(Math.abs(s.short - (1.4 - (L1 + L2) * 0.9999)) < 1e-9);
});

test('a target right at the hip is held off at the shortest bend, and nothing comes out as NaN', () => {
  const s = reach(HIP, KNEE, ANKLE, HIP, [0, 0, 1]);
  for (const v of [...s.mid, ...s.end]) assert.ok(Number.isFinite(v));
  assert.ok(d(HIP, s.end) <= Math.abs(L1 - L2) + 2e-4);
  // A pole along the limb and a straight limb still give a bend.
  const z = reach([0, 1, 0], [0, 0.5, 0], [0, 0, 0], [0, 0.5, 0], [0, 1, 0]);
  assert.ok(Math.abs(d([0, 1, 0], z.mid) - 0.5) < 1e-9);
});

test('an arm the same: the elbow keeps its side as the wrist goes to the keys', () => {
  const sh = [0, 1.4, 0], el = [0.05, 1.12, 0.1], wr = [0.0, 0.95, 0.3];
  const s = reach(sh, el, wr, [0.05, 1.05, 0.35], [0, -1, 0]);
  close(s.end, [0.05, 1.05, 0.35]);
  assert.ok(s.mid[0] > 0, 'the elbow stays out to its side');
});

test('nothing new is made per frame: the answer goes into the one handed in, the same as a fresh one', () => {
  const out = { mid: [0, 0, 0], end: [0, 0, 0], short: 0 };
  for (const t of [[0.1, 0.3, 0.2], [0, -0.5, 0], [0, 0.25, 0]]) {
    const fresh = reach(HIP, KNEE, ANKLE, t, [0, 0, 1]), r = reach(HIP, KNEE, ANKLE, t, [0, 0, 1], out);
    assert.equal(r, out);
    assert.deepEqual(r, fresh);
  }
});
