import test from 'node:test';
import assert from 'node:assert/strict';
import { FINGERS, DIGITS, deepest, deepestBody, miss, fingersShape, LIMITS, within, padFor } from '../../web/src/pure/realhand.js';
import { solveHolds, onSurface, SHOOT, typing, onMouse, resting, keyTop, HOME, DESK, deskShape, mouseShape } from '../../web/src/pure/realholds.js';
import { roundBox } from '../../web/src/pure/hands.js';
import { TRAVEL } from '../../web/src/pure/typing.js';
import { GUNS, DESK_POSES } from '../../web/src/pure/realposes.js';
import { GUN_HOLDS, rotTrigger } from '../../web/src/pure/handling.js';
import { CLIPS } from '../../web/src/pure/clips.js';
import { RIGS } from '../../web/src/pure/rigs.js';
import { stats } from '../../web/src/pure/arsenal.js';

const r6 = x => Math.round(x * 1e6) / 1e6;
const bake = p => ({ at: p.at.map(r6), q: p.q.map(r6), cup: r6(p.cup || 0), digits: Object.fromEntries(Object.entries(p.digits).map(([d, a]) => [d, a.map(r6)])) });
// Within the joints' range, give or take the baked poses' rounding to a millionth.
const inRange = p => DIGITS.every(d => within(d, p.digits[d]).every((v, i) => Math.abs(v - p.digits[d][i]) <= 5e-7));

test('the poses the bench reads are the ones the solver gives (else run node blender/realposes.js)', () => {
  assert.deepEqual(DESK_POSES.home.right, bake(typing('right')));
  assert.deepEqual(DESK_POSES.mouse.left, bake(onMouse('left')));
  assert.deepEqual(DESK_POSES.rest.right, bake(resting('right', [-0.06, 0, 0.21])));
  const h = solveHolds('pistol');
  for (const side of ['right', 'left']) for (const [name, p] of Object.entries(h[side])) assert.deepEqual(GUNS.pistol[side][name], bake(p), `${side} ${name}`);
  assert.deepEqual(Object.keys(GUNS).sort(), Object.keys(GUN_HOLDS).sort());
});

// What each pose holds: the gun; a magazine as it sits home (the pistol's longer one by its own foot); the pistol's
// support hand closes over the shooting hand's fingers too.
function heldBy(id, side, name) {
  const H = GUN_HOLDS[id], shape = H.shape;
  if (side === 'left' && name === 'mag') return H.fore && H.cup.alone ? H.mag : p => Math.min(H.mag(p), shape(p));
  if (side === 'left' && name === 'magX') return p => Math.min(H.long.mag(p), shape(p));
  if (side === 'left' && name === 'grip' && !H.fore) { const over = fingersShape('right', GUNS[id].right.grip); return p => Math.min(shape(p), over(p)); }
  return shape;
}

test('every pose the clips ask of the hands is fitted, on every gun, and every pose that rides a part', () => {
  for (const id of Object.keys(RIGS)) {
    const C = CLIPS[id](stats(id, []));
    for (const c of Object.values(C)) for (const side of ['right', 'left']) for (const [, pose] of c[side] || []) assert.ok(pose === 'low' || GUNS[id][side][pose], `${id}: no ${side} ${pose}`);
    for (const side of ['right', 'left']) for (const pose of Object.keys(RIGS[id].rides[side] || {})) assert.ok(GUNS[id][side][pose], `${id}: ${side} ${pose} rides a part`);
  }
});

test('in every pose on every gun: no digit more than a millimetre into what it holds, the palm no deeper than skin gives', () => {
  for (const [id, g] of Object.entries(GUNS)) for (const side of ['right', 'left']) for (const [name, P] of Object.entries(g[side])) {
    const S = heldBy(id, side, name);
    assert.ok(inRange(P), `${id} ${side} ${name}: within the joints' range`);
    for (const d of DIGITS) assert.ok(deepest(side, P, S, [d]) > -0.00101, `${id} ${side} ${name} ${d}: ${deepest(side, P, S, [d])}`);
    assert.ok(deepestBody(side, P, S) > -0.003, `${id} ${side} ${name} palm: ${deepestBody(side, P, S)}`);
  }
});

test('the shooting hand: three fingers closed on the grip, the first on the trigger and following it back, or laid along the frame', () => {
  for (const [id, g] of Object.entries(GUNS)) {
    const H = GUN_HOLDS[id], shape = H.shape, R = g.right;
    for (const d of ['middle', 'ring', 'pinky']) {
      assert.ok(deepest('right', R.grip, shape, [d]) < 0.001, `${id} right ${d} touches`);
      assert.ok(R.grip.digits[d][1] + R.grip.digits[d][2] > 1.2, `${id} right ${d} closed`);
    }
    assert.ok(miss('right', R.grip, 'index', H.trigger.pad) < 0.0045, `${id} trigger ${miss('right', R.grip, 'index', H.trigger.pad)}`);
    assert.ok(miss('right', R.pull, 'index', rotTrigger(H.trigger, 1)) < 0.002, `${id} pulled ${miss('right', R.pull, 'index', rotTrigger(H.trigger, 1))}`);
    const off = deepest('right', R.straight, shape, ['index']);
    assert.ok(off < 0.0015 && miss('right', R.straight, 'index', H.trigger.pad) > 0.015, `${id} straight: ${off}`);
    // A shot, a reload or a look over moves only the first finger and the thumb; the hand stays on the grip.
    for (const name of Object.keys(R).filter(n => n !== 'bolt')) assert.deepEqual([R[name].at, R[name].q], [R.grip.at, R.grip.q], `${id} ${name}`);
  }
});

test('the shooting thumb wraps round the back of the grip and rests on its left side, as a shooter\'s does', () => {
  for (const [id, g] of Object.entries(GUNS)) {
    const H = GUN_HOLDS[id], spot = onSurface(H.shape, SHOOT.thumb), pad = padFor('right', g.right.grip, 'thumb');
    assert.ok(miss('right', g.right.grip, 'thumb', spot) < 0.002, `${id} thumb ${miss('right', g.right.grip, 'thumb', spot)} from its spot`);
    assert.ok(pad[2] < -0.012 && H.shape(pad) < 0.003, `${id}: on the left side, resting on it: ${pad}`);
    assert.ok(deepest('right', g.right.grip, H.shape, ['thumb']) < 0.0015, `${id} touching`);
  }
});

test('the support hand: over the shooting hand\'s fingers on the pistol, round the handguard on the long guns, thumb on its mark', () => {
  for (const [id, g] of Object.entries(GUNS)) {
    const H = GUN_HOLDS[id], shape = heldBy(id, 'left', 'grip');
    // Every finger rests on something.
    for (const d of FINGERS) assert.ok(deepest('left', g.left.grip, shape, [d]) < 0.001, `${id} left ${d} touches`);
    const mark = H.fore ? H.fore.thumb : H.thumbs.left;
    assert.ok(miss('left', g.left.grip, 'thumb', mark) < 0.006, `${id} left thumb ${miss('left', g.left.grip, 'thumb', mark)}`);
  }
  // Over the slide on the way in and out, the open hand clears it.
  assert.ok(deepest('left', GUNS.pistol.left.over, GUN_HOLDS.pistol.shape) > 0.002);
});

test('typing: each finger rests on its own key, a pressed key pressed, nothing through the keys', () => {
  const K = DESK.key, own = (row, col, down = 0) => { const t = keyTop(row, col, down); return p => roundBox(p, [t[0], t[1] - K.h / 2, t[2]], [K.w / 2, K.h / 2, K.d / 2], 0.002); };
  for (const side of ['left', 'right']) {
    const P = DESK_POSES.home[side];
    for (const d of FINGERS) { const k = deepest(side, P, own(...HOME[side][d]), [d]); assert.ok(k > -0.001 && k < 0.0012, `${side} ${d} on its key: ${k}`); }
    assert.ok(deepest(side, P, deskShape) > -0.0015, side);
    // The fingers arch down onto the keys, as a typist's do; the little finger may lie straighter.
    for (const d of ['index', 'middle', 'ring']) assert.ok(P.digits[d][2] > 0.35, `${side} ${d} arched: ${P.digits[d]}`);
  }
  const e = deepest('left', DESK_POSES.press.left, own(3, 11, TRAVEL), ['middle']);
  assert.ok(e > -0.001 && e < 0.001, `the left middle finger presses E down: ${e}`);
});

test('on the mouse and at rest: resting on it, not in it', () => {
  const M = DESK_POSES.mouse.left;
  assert.ok(deepest('left', M, mouseShape) > -0.0015 && deepest('left', M, mouseShape) < 0.002);
  for (const side of ['left', 'right']) {
    const R = DESK_POSES.rest[side], d = deepest(side, R, p => p[1]);
    assert.ok(d > -0.0015 && d < 0.002, `${side} rest ${d}`);
  }
  assert.ok(LIMITS.index.hi[1] > 1.5);
});
