import test from 'node:test';
import assert from 'node:assert/strict';
import { BONES, REST, LIMITS, DIGITS, FINGERS, rest, relaxed, within, world, worldFor, locals, skinPoints, padAt, padFor, mirrorPose, wrap, reach, seat, deepest, palmGap, miss, blend, fingersShape, wrist, forearm, WRIST } from '../../web/src/pure/realhand.js';
import { JOINTS, POINTS } from '../../web/src/pure/handrig.js';
import { qAxis, qMul, qRot, rod, add, sub, norm, dot } from '../../web/src/pure/hands.js';

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

// How far past its relaxed range a wrist is bent toward an elbow: at most 1 is within it.
const strain = (side, P, elbow) => {
  const b = wrist(side, P, elbow);
  return Math.hypot(b.flex / (b.flex > 0 ? WRIST.flex : WRIST.extend), b.radial / (b.radial > 0 ? WRIST.radial : WRIST.ulnar));
};
test('the wrist: straight at rest, each way it bends read right, and the forearm drawn never past its relaxed range', () => {
  const elbowOf = P => add(P.at, qRot(P.q, JOINTS.elbow));
  for (const side of ['right', 'left']) {
    const P = { ...rest(), at: [0.1, 0.2, -0.3], q: qAxis(norm([1, 2, 3]), 0.7) }, E = side === 'left' ? add(mirrorPose(P).at, qRot(mirrorPose(P).q, JOINTS.elbow)).map((v, i) => (i === 2 ? -v : v)) : elbowOf(P);
    const b = wrist(side, P, E);
    assert.ok(Math.abs(b.flex) < 1e-9 && Math.abs(b.radial) < 1e-9, `${side} straight ${JSON.stringify(b)}`);
    // An elbow within the range is kept as it is.
    assert.deepEqual(forearm(side, P, E), E);
  }
  // The hand turned palm-ward against a fixed forearm is flexed; toward the little finger, ulnar (right hand).
  const P = { ...rest(), at: [0, 0, 0] }, E = qRot([0, 0, 0, 1], JOINTS.elbow);
  assert.ok(wrist('right', { ...P, q: qAxis([0, 0, 1], -0.3) }, E).flex > 0.25, 'flexed');
  assert.ok(wrist('right', { ...P, q: qAxis([0, 1, 0], -0.3) }, E).radial < -0.25, 'toward the little finger');
  // Any elbow at all, for hands turned every way: the forearm drawn stays within the range, and as near as it can.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < 400; i++) {
    const side = i % 2 ? 'left' : 'right', Q = { ...rest(), at: [rnd() * 0.2, rnd() * 0.2, rnd() * 0.2], q: qAxis(norm([rnd(), rnd(), rnd()]), rnd() * 3) };
    const elbow = add(Q.at, [rnd() * 0.4, rnd() * 0.4, rnd() * 0.4]), F = forearm(side, Q, elbow);
    assert.ok(strain(side, Q, F) < 1 + 1e-6, `${i} ${strain(side, Q, F)}`);
    assert.ok(Math.abs(Math.hypot(...sub(F, Q.at)) - Math.hypot(...sub(elbow, Q.at))) < 1e-9, 'as long');
  }
});

test('the forearm drawn follows the elbow smoothly all the way round, ahead of the wrist too, never jumping', () => {
  const turn = (a, b) => Math.acos(Math.min(1, Math.max(-1, dot(norm(a), norm(b))))) * 180 / Math.PI;
  // Elbows on great circles all round each hand, half a degree a step: the forearm never turns ten times as far.
  const step = Math.PI / 360, hands = [['right', rest()], ['left', { ...rest(), at: [0.1, 0.2, -0.3], q: qAxis(norm([1, 2, 3]), 0.7) }]];
  for (const [side, P] of hands) for (let tilt = 0; tilt < 180; tilt += 9) for (let spin = 0; spin < 360; spin += 30) {
    const t = tilt * Math.PI / 180, s = spin * Math.PI / 180, n = [Math.sin(t) * Math.cos(s), Math.sin(t) * Math.sin(s), Math.cos(t)];
    const u = norm(Math.abs(n[0]) < 0.9 ? [0, -n[2], n[1]] : [-n[1], n[0], 0]), w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    let prev = null;
    for (let a = 0; a <= 2 * Math.PI + 1e-9; a += step) {
      const F = sub(forearm(side, P, add(P.at, u.map((x, i) => 0.3 * (Math.cos(a) * x + Math.sin(a) * w[i])))), P.at);
      if (prev) assert.ok(turn(prev, F) < 5, `${side} circle ${tilt} ${spin} at ${(a * 180 / Math.PI).toFixed(1)}: ${turn(prev, F).toFixed(1)} degrees`);
      prev = F;
    }
  }
  // Where it jumped 25 to 43 degrees: an elbow ahead of the wrist moved a fraction of a millimetre across a middle plane.
  for (const side of ['right', 'left']) for (const [a, b] of [[[0.3, -0.15, 0.0005], [0.3, -0.15, -0.0005]], [[0.3, 0.0005, 0.15], [0.3, -0.0005, 0.15]]]) {
    assert.ok(turn(forearm(side, rest(), a), forearm(side, rest(), b)) < 1, `${side} ${a} ${b}`);
  }
});
