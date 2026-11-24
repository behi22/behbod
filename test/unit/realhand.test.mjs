import test from 'node:test';
import assert from 'node:assert/strict';
import { BONES, REST, LIMITS, DIGITS, FINGERS, rest, relaxed, within, world, worldFor, locals, skinPoints, padAt, padFor, mirrorPose, wrap, reach, seat, deepest, palmGap, miss, blend, fingersShape } from '../../web/src/pure/realhand.js';
import { JOINTS, POINTS } from '../../web/src/pure/handrig.js';
import { qAxis, qRot, rod } from '../../web/src/pure/hands.js';

const near = (a, b, eps) => a.every((x, i) => Math.abs(x - b[i]) < eps);
const N = { thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5 };
const bone = name => BONES.indexOf(name);

test('at rest every bone sits on MakeHuman\'s own joint, and the skin points where the mesh put them', () => {
  const F = world(rest());
  for (const d of DIGITS) for (let k = 1; k <= 3; k++) {
    const b = F[bone(d === 'thumb' ? 'thumb' + k : d + k)].p;
    assert.ok(near(b, JOINTS[`finger-${N[d]}-${k}`], 1e-9), `${d}${k}`);
  }
  const P = skinPoints(rest());
  for (let i = 0; i < P.length; i++) assert.ok(near(P[i], POINTS.p.slice(i * 3, i * 3 + 3), 1e-9), `point ${i}`);
});

test('a grown man\'s hand: about 19 cm wrist to fingertip, fingers in their usual order of length', () => {
  const tip = d => padAt(rest(), d);
  assert.ok(Math.abs(JOINTS['finger-3-4'][0] - 0.188) < 1e-9);
  const reachOf = d => Math.hypot(...tip(d));
  assert.ok(reachOf('middle') > reachOf('index') && reachOf('middle') > reachOf('ring') && reachOf('ring') > reachOf('pinky'));
  // The thumb is on the first finger's side (-z), the little finger on the other.
  assert.ok(tip('thumb')[2] < tip('index')[2] && tip('index')[2] < tip('middle')[2] && tip('middle')[2] < tip('ring')[2] && tip('ring')[2] < tip('pinky')[2]);
});

test('joint limits: rest and a loose hand are within them; anything else is held to them', () => {
  for (const d of DIGITS) {
    assert.deepEqual(within(d, REST[d]), REST[d]);
    assert.deepEqual(within(d, relaxed()[d]), relaxed()[d]);
    const wild = within(d, REST[d].map(() => 9));
    assert.deepEqual(wild, LIMITS[d].hi);
    if (d !== 'thumb') {
      // A knuckle bends about 90 degrees, a middle joint over 100, an end joint about 80, and none bends backward much.
      assert.ok(LIMITS[d].hi[1] > 1.5 && LIMITS[d].hi[1] < 1.75 && LIMITS[d].hi[2] > 1.8 && LIMITS[d].hi[2] < 2 && LIMITS[d].hi[3] > 1.3 && LIMITS[d].hi[3] < 1.45);
      assert.ok(LIMITS[d].lo[1] > -0.4 && LIMITS[d].lo[2] >= 0 && LIMITS[d].lo[3] > -0.1);
    }
  }
});

test('bending a finger curls it toward the palm; a left hand is the right one mirrored', () => {
  const p = rest(), bent = { ...p, digits: { ...p.digits, index: [p.digits.index[0], 1.2, 1.3, 0.8] } };
  const a0 = padAt(p, 'index'), a1 = padAt(bent, 'index');
  assert.ok(a1[0] < a0[0] - 0.05 && a1[1] < a0[1] - 0.008, `back toward the wrist and down into the palm: ${a0} ${a1}`);
  const placed = { ...bent, at: [0.1, 0.2, 0.3], q: qAxis([0.3, 1, 0.2].map(v => v / Math.hypot(0.3, 1, 0.2)), 0.7) };
  const L = worldFor('left', placed), R = world(mirrorPose(placed));
  L.forEach((b, i) => assert.ok(near(b.p, [R[i].p[0], R[i].p[1], -R[i].p[2]], 1e-12)));
  assert.ok(near(padFor('left', placed, 'thumb'), (p => [p[0], p[1], -p[2]])(padAt(mirrorPose(placed), 'thumb')), 1e-12));
  // locals put back together give the same bones as world.
  const Lc = locals(placed);
  assert.ok(near(Lc[bone('arm')].p, placed.at, 1e-12));
});

test('a finger on nothing curls right in; on a bar it stops resting on it, not in it', () => {
  const p = rest(), none = () => 1;
  assert.deepEqual(wrap('right', 'middle', p, none, { from: [p.digits.middle[0], 0, 0, 0] }).slice(1), LIMITS.middle.hi.slice(1));
  // A round bar across the fingers a little below the palm, where a grip would be.
  const a = [0.12, -0.035, -0.06], b = [0.12, -0.035, 0.08], bar = q => rod(q, a, b, 0.016);
  for (const side of ['right', 'left']) {
    const s = side === 'left' ? -1 : 1, B = q => rod(q, [a[0], a[1], a[2] * s], [b[0], b[1], b[2] * s], 0.016);
    for (const d of FINGERS) {
      const ang = wrap(side, d, p, B, { from: [p.digits[d][0], 0, 0, 0] }), P = { ...p, digits: { ...p.digits, [d]: ang } };
      const deep = deepest(side, P, B, [d]);
      assert.ok(deep > -0.0015 && deep < 0.002, `${side} ${d}: ${deep}`);
      assert.ok(ang[1] > 0.2, `${side} ${d} closed: ${ang}`);
    }
  }
  assert.ok(bar([0.12, -0.035, 0]) < 0);
});

test('a pad reaches a point within its reach, and keeps out of a shape it is told to', () => {
  // A point the pad can reach: where it is with the finger half closed.
  const p = rest(), t = padAt({ ...p, digits: { ...p.digits, index: [p.digits.index[0] + 0.05, 0.6, 0.7, 0.45] } }, 'index');
  const a = reach('right', 'index', p, t, { from: [p.digits.index[0], 0.2, 0.2, 0.1] });
  assert.ok(miss('right', { ...p, digits: { ...p.digits, index: a } }, 'index', t) < 0.001);
  const wall = q => q[1] + 0.045;
  const b = reach('right', 'index', p, [0.16, -0.06, -0.03], { from: [p.digits.index[0], 0.5, 0.5, 0.3], sdf: wall });
  assert.ok(deepest('right', { ...p, digits: { ...p.digits, index: b } }, wall, ['index']) > -0.001);
  const th = reach('left', 'thumb', p, [0.1, -0.06, 0.03]);
  assert.ok(miss('left', { ...p, digits: { ...p.digits, thumb: th } }, 'thumb', [0.1, -0.06, 0.03]) < 0.003);
});

test('the palm comes to rest on a surface, from wherever it starts', () => {
  const desk = q => q[1] + 0.05;
  for (const side of ['right', 'left']) for (const y0 of [0.02, -0.08]) {
    const P = seat(side, { ...rest(), at: [0, y0 + 0.05, 0] }, desk, [0, -1, 0], { gap: 0.0006, range: 0.12 });
    assert.ok(Math.abs(palmGap(side, P, desk) - 0.0006) < 2e-4, `${side} ${y0}: ${palmGap(side, P, desk)}`);
  }
});

test('between two poses everything eases across; another hand can close round the fingers', () => {
  const a = rest(), b = { ...rest(), at: [0.1, 0, 0], cup: 0.4, digits: relaxed() };
  assert.equal(blend(a, b, 0), a); assert.equal(blend(a, b, 1), b);
  const m = blend(a, b, 0.5);
  assert.ok(near(m.at, [0.05, 0, 0], 1e-12) && Math.abs(m.cup - 0.2) < 1e-12);
  const S = fingersShape('right', rest());
  assert.ok(S(padAt(rest(), 'middle')) < 0.004 && S([0.1, 0.2, 0]) > 0.1);
});
