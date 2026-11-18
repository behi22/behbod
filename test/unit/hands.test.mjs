import test from 'node:test';
import assert from 'node:assert/strict';
import { qAxis, qMul, qRot, qFrame, qSlerp, digit, boneTurns, wrap, reach, seat, blend, relaxed, palmPoints, toOuter, rod, roundBox, deepest, HAND, FINGERS, DIGITS, sub, len, norm } from '../../web/src/pure/hands.js';

const near = (a, b, eps = 1e-9) => a.every((x, i) => Math.abs(x - b[i]) < eps);
const ID = { at: [0, 0, 0], q: [0, 0, 0, 1], digits: relaxed() };
const zero = d => (d === 'thumb' ? [0, 0, 0, 0, 0] : [0, 0, 0, 0]);
// The least room between a digit's bones and a shape (negative is into it).
function room(side, pose, d, sdf) {
  const { pts, r } = digit(side, d, pose.digits[d]), out = [];
  for (let b = 0; b < 3; b++) {
    let m = Infinity;
    for (let k = 1; k <= 8; k++) { const u = k / 8, p = pts[b].map((x, i) => x + (pts[b + 1][i] - x) * u); m = Math.min(m, sdf(toOuter(pose, p)) - (r[b] + (r[b + 1] - r[b]) * u)); }
    out.push(m);
  }
  return out;
}

test('turns: a frame turns x and y where it was asked, products and blends agree', () => {
  const q = qFrame([0, 0, 1], [1, 1, 0]);
  assert.ok(near(qRot(q, [1, 0, 0]), [0, 0, 1], 1e-12));
  assert.ok(near(qRot(q, [0, 1, 0]), norm([1, 1, 0]), 1e-12));
  const a = qAxis([0, 1, 0], 0.7), b = qAxis([1, 0, 0], -1.1), v = [0.3, -0.2, 0.9];
  assert.ok(near(qRot(qMul(a, b), v), qRot(a, qRot(b, v)), 1e-12));
  assert.ok(near(qSlerp(a, b, 0), a, 1e-12) && near(qSlerp(a, b, 1), b, 1e-12));
  const half = qSlerp(qAxis([0, 0, 1], 0), qAxis([0, 0, 1], 1), 0.5);
  assert.ok(near(half, qAxis([0, 0, 1], 0.5), 1e-12));
});

test('a straight finger runs along x from its knuckle, the full length of its bones', () => {
  const { pts } = digit('right', 'middle', zero('middle')), def = HAND.fingers.middle;
  assert.ok(near(pts[0], def.at));
  assert.ok(near(pts[3], [def.at[0] + def.len[0] + def.len[1] + def.len[2], def.at[1], def.at[2]], 1e-12));
});

test('a left hand is a right hand mirrored, for the same angles', () => {
  const a = { index: [0.2, 0.5, 0.4, 0.3], middle: [0, 1.1, 0.9, 0.5], ring: [-0.1, 0.3, 1.2, 0.2], pinky: [0.1, 0.8, 0.2, 1], thumb: [0.4, 0.6, 0.5, 0.3, -0.7] };
  for (const d of DIGITS) {
    const r = digit('right', d, a[d]).pts, l = digit('left', d, a[d]).pts;
    for (let i = 0; i < 4; i++) assert.ok(near(l[i], [r[i][0], r[i][1], -r[i][2]], 1e-12), `${d} joint ${i}`);
  }
});

test('bending a finger brings its tip in toward the palm', () => {
  const open = digit('right', 'index', [0, 0, 0, 0]).pts[3], shut = digit('right', 'index', [0, 1.2, 1.2, 0.8]).pts[3];
  assert.ok(shut[1] < open[1] - 0.03, `tip went from y ${open[1]} to ${shut[1]}`);
  assert.ok(shut[0] < open[0] - 0.04);
});

test('a thumb\'s roll changes the way it bends, and no roll is no change', () => {
  const plain = boneTurns('right', 'thumb', [0.2, 0.3, 0.4, 0.3]), zeroRoll = boneTurns('right', 'thumb', [0.2, 0.3, 0.4, 0.3, 0]);
  assert.deepEqual(plain, zeroRoll);
  const a = digit('right', 'thumb', [0.2, 0.3, 0.9, 0.7, 0]).pts[3], b = digit('right', 'thumb', [0.2, 0.3, 0.9, 0.7, 1]).pts[3];
  assert.ok(len(sub(a, b)) > 0.01);
});

test('wrapping: each bone closes until it touches a bar, and none goes into it', () => {
  // A bar of 3 cm across, lying along z just under the fingers' palm side, ahead of the knuckles.
  const bar = p => rod(p, [0.115, -0.03, -1], [0.115, -0.03, 1], 0.015);
  for (const d of FINGERS) {
    const pose = { ...ID, digits: { ...relaxed() } };
    pose.digits[d] = wrap('right', d, pose, bar, { from: [0, 0, 0, 0] });
    const r = room('right', pose, d, bar);
    assert.ok(Math.min(...r) > -0.0012, `${d} goes ${r} into the bar`);
    assert.ok(r[0] < 0.004 && r[1] < 0.003, `${d}'s first bones should rest on the bar: ${r}`);
  }
});

test('wrapping round nothing curls a finger all the way in', () => {
  const none = () => 1;
  const a = wrap('right', 'ring', ID, none);
  assert.deepEqual(a.slice(1), [1.7, 1.85, 1.35]);
});

test('reaching: a tip goes to a point it can reach, and around a shape in the way', () => {
  const target = [0.13, -0.035, -0.01];
  const a = reach('right', 'index', ID, target);
  assert.ok(len(sub(digit('right', 'index', a).pts[3], target)) < 0.001);
  const wall = p => roundBox(p, [0.11, 0.0, -0.01], [0.012, 0.012, 0.05]);
  const b = reach('right', 'index', ID, [0.135, -0.03, -0.01], { from: [0, 0.6, 0.6, 0.4], sdf: wall });
  const r = room('right', { ...ID, digits: { ...relaxed(), index: b } }, 'index', wall);
  assert.ok(Math.min(...r) > -0.002, `the finger goes ${r} into the wall`);
});

test('reaching: a thumb with its roll gets to a point a fixed thumb cannot', () => {
  const t = [0.06, -0.045, 0.012];
  const a = reach('right', 'thumb', ID, t, { from: [0, 0.3, 0.3, 0.2, 0] });
  assert.ok(len(sub(digit('right', 'thumb', a).pts[3], t)) < 0.002, `missed by ${len(sub(digit('right', 'thumb', a).pts[3], t))}`);
});

test('seating: a palm pressed toward a wall stops just off it', () => {
  const wall = p => p[1] + 0.02;
  const placed = seat('right', { ...ID, at: [0, 0.03, 0] }, wall, [0, -1, 0], { gap: 0.001 });
  const lowest = Math.min(...palmPoints('right').map(p => wall(toOuter(placed, p))));
  assert.ok(Math.abs(lowest - 0.001) < 1e-4, `palm sits ${lowest} off the wall`);
});

test('blending: the ends are the poses, the middle is between', () => {
  const a = { at: [0, 0, 0], q: [0, 0, 0, 1], digits: relaxed() }, b = { at: [1, 2, 3], q: qAxis([0, 1, 0], 1), digits: { ...relaxed(), index: [0, 1, 1, 1] } };
  assert.equal(blend(a, b, 0), a); assert.equal(blend(a, b, 1), b);
  const m = blend(a, b, 0.5);
  assert.ok(near(m.at, [0.5, 1, 1.5]) && near(m.q, qAxis([0, 1, 0], 0.5), 1e-12));
  assert.ok(near(m.digits.index, relaxed().index.map((v, i) => (v + [0, 1, 1, 1][i]) / 2)));
  assert.equal(m.digits.thumb.length, 5);
});

test('deepest finds a finger pushed into a shape', () => {
  const box = p => roundBox(p, [0.1, 0, 0], [0.05, 0.05, 0.05]);
  assert.ok(deepest('right', ID, box) < -0.005);
  assert.ok(deepest('right', ID, () => 1) > 0.9);
});
