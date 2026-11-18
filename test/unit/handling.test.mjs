import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solveHolds, rotTrigger, bake, GUN_HOLDS } from '../../web/src/pure/handling.js';
import { HOLDS } from '../../web/src/range/holds.js';
import { digit, toOuter, miss, palmPoints, FINGERS } from '../../web/src/pure/hands.js';

const H = GUN_HOLDS.pistol;
const t0 = performance.now(), holds = solveHolds('pistol'), took = performance.now() - t0;
// The least room between each bone of a digit and a shape, finely sampled (negative is into it).
function room(side, pose, d, sdf) {
  const { pts, r } = digit(side, d, pose.digits[d]), out = [];
  for (let b = 0; b < 3; b++) {
    let m = Infinity;
    for (let k = 1; k <= 16; k++) { const u = k / 16, p = pts[b].map((x, i) => x + (pts[b + 1][i] - x) * u); m = Math.min(m, sdf(toOuter(pose, p)) - (r[b] + (r[b + 1] - r[b]) * u)); }
    out.push(m);
  }
  return out;
}
const palmRoom = (side, pose, sdf) => Math.min(...palmPoints(side).map(p => sdf(toOuter(pose, p))));
const DEEP = -0.0025;

test('the poses the page reads are the ones the solver gives, for every gun (else run node blender/holds.js)', () => {
  assert.deepEqual(Object.keys(HOLDS).sort(), Object.keys(GUN_HOLDS).sort());
  assert.deepEqual(HOLDS.pistol, bake(holds));
  assert.equal(solveHolds('nothing'), null);
  assert.ok(took < 10000, `solving took ${took.toFixed(0)} ms`);
});

test('the right hand: three fingers closed round the grip, none in it, the palm on it', () => {
  const R = holds.right.grip;
  for (const d of ['middle', 'ring', 'pinky']) {
    const r = room('right', R, d, H.shape);
    assert.ok(Math.min(...r) > DEEP, `${d} goes ${r.map(x => x.toFixed(4))} into the gun`);
    assert.ok(Math.max(...r) < 0.003, `${d} should touch the grip along its length: ${r.map(x => x.toFixed(4))}`);
    // It goes round the front: its tip ends on the far (left) side.
    assert.ok(toOuter(R, digit('right', d, R.digits[d]).pts[3])[2] < -0.01, `${d} does not reach round the grip`);
  }
  const p = palmRoom('right', R, H.shape);
  assert.ok(p > 0 && p < 0.002, `palm sits ${p} off the grip`);
});

test('the trigger finger is on the trigger, and follows it when pulled', () => {
  assert.ok(miss('right', 'index', holds.right.grip, holds.right.grip.digits.index, H.trigger.pad) < 0.005);
  const pulled = rotTrigger(H.trigger, 1), P = holds.right.pull;
  assert.ok(miss('right', 'index', P, P.digits.index, pulled) < miss('right', 'index', P, P.digits.index, H.trigger.pad), 'pulled, the pad is nearer the pulled trigger');
  // Pulled, the pad has gone back.
  const a = toOuter(holds.right.grip, digit('right', 'index', holds.right.grip.digits.index).pts[3]);
  const b = toOuter(holds.right.pull, digit('right', 'index', holds.right.pull.digits.index).pts[3]);
  assert.ok(b[0] < a[0] - 0.002 && b[0] > a[0] - 0.008, `the pad moved from ${a[0]} to ${b[0]}`);
  assert.ok(Math.min(...room('right', P, 'index', H.shape)) > DEEP);
  // Off the trigger it lies along the frame, out of the guard.
  const s = toOuter(holds.right.straight, digit('right', 'index', holds.right.straight.digits.index).pts[3]);
  assert.ok(s[0] > 0.07 && s[2] > 0.015, `straight finger tip at ${s}`);
  assert.ok(Math.min(...room('right', holds.right.straight, 'index', H.shape)) > DEEP);
});

test('the right thumb rests on the far side, and reaches the magazine release and the slide stop', () => {
  for (const [name, at] of [['grip', H.thumbs.right], ['release', H.release], ['stop', H.stop]]) {
    const pose = holds.right[name];
    assert.ok(miss('right', 'thumb', pose, pose.digits.thumb, at) < 0.004, `${name}: thumb misses by ${miss('right', 'thumb', pose, pose.digits.thumb, at)}`);
  }
  assert.ok(Math.min(...room('right', holds.right.grip, 'thumb', H.shape)) > DEEP);
});

test('the left hand closes over the right hand\'s fingers without going into them or the gun', () => {
  const L = holds.left.grip;
  for (const d of [...FINGERS, 'thumb']) {
    const r = room('left', L, d, holds.both);
    assert.ok(Math.min(...r) > DEEP, `${d} goes ${r.map(x => x.toFixed(4))} in`);
  }
  for (const d of ['middle', 'ring']) assert.ok(Math.min(...room('left', L, d, holds.both)) < 0.003, `${d} should touch`);
  assert.ok(miss('left', 'thumb', L, L.digits.thumb, H.thumbs.left) < 0.012);
  assert.ok(toOuter(L, [0, 0, 0])[2] < 0, 'the left wrist is on the left');
});

test('the free hand cups a magazine from below and takes the slide from above', () => {
  const C = holds.left.mag, down = [-0.333, -0.943, 0], foot = [-0.0186, -0.1235, 0];
  // The palm is under the magazine's foot (down the well from it) and pressed to it.
  const below = palmPoints('left').map(p => toOuter(C, p)).map(p => p.reduce((s, x, i) => s + (x - foot[i]) * down[i], 0));
  assert.ok(below.every(d => d > -0.004), `the palm is under the foot: ${below.map(d => d.toFixed(4))}`);
  assert.ok(palmRoom('left', C, holds.magged) < 0.002);
  for (const d of [...FINGERS, 'thumb']) assert.ok(Math.min(...room('left', C, d, holds.magged)) > DEEP, `${d} into the magazine or grip`);
  const P = holds.left.pinch;
  assert.ok(palmPoints('left').map(p => toOuter(P, p)).every(p => p[1] > 0.025), 'the palm is over the slide');
  for (const d of FINGERS) assert.ok(Math.min(...room('left', P, d, H.shape)) > DEEP, `${d} into the slide`);
  assert.ok(Math.min(...['middle', 'ring'].flatMap(d => room('left', P, d, H.shape))) < 0.003, 'the fingers hold the slide');
  // Open over it before taking it.
  assert.ok(palmRoom('left', holds.left.over, H.shape) > 0.01);
});

test('the gun\'s shape here matches the gun file: its moving parts sit where the shape says', () => {
  const glb = readFileSync(new URL('../../web/assets/range/p22.glb', import.meta.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
  const node = name => json.nodes.find(n => n.name === name).translation;
  const trig = node('P22_trigger');
  assert.ok(Math.hypot(trig[0] - H.trigger.pin[0], trig[1] - H.trigger.pin[1], trig[2] - H.trigger.pin[2]) < 1e-4, `trigger pin ${trig}`);
  // The magazine release and the slide stop are on the left side face, where the thumb presses them.
  const rel = node('P22_magrelease'), stop = node('P22_slidestop');
  assert.ok(Math.abs(H.release[0] - rel[0]) < 0.002 && Math.abs(H.release[1] - rel[1]) < 0.002 && rel[2] < 0 && H.release[2] < rel[2]);
  assert.ok(stop[2] < 0 && H.stop[2] < stop[2] && Math.abs(H.stop[0] - stop[0]) < 0.03);
  // The shape: inside the grip, on its surface at the straps, outside beside it.
  assert.ok(H.shape([-0.008, -0.07, 0]) < -0.01);
  assert.ok(Math.abs(H.shape([0.0199, -0.07, 0])) < 0.0015 && Math.abs(H.shape([-0.0384, -0.07, 0])) < 0.0015);
  assert.ok(H.shape([-0.008, -0.07, 0.03]) > 0.01);
});
