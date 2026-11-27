import test from 'node:test';
import assert from 'node:assert/strict';
import { FINGERS, DIGITS, deepest, deepestBody, miss, fingersShape, LIMITS, within, padFor, palmGap, worldFor, bi, forearm } from '../../web/src/pure/realhand.js';
import { solveHolds, onSurface, foreThumb, SHOOT, SUPPORT, typing, onMouse, resting, REST_LEFT, HOME, KEY, landing, deskShape, mouseShape } from '../../web/src/pure/realholds.js';
import { qAxis, qMul, qRot, sub, norm } from '../../web/src/pure/hands.js';
import { GUNS, DESK_POSES } from '../../web/src/pure/realposes.js';
import { GUN_HOLDS, rotTrigger, ELBOWS } from '../../web/src/pure/handling.js';
import { CLIPS } from '../../web/src/pure/clips.js';
import { RIGS } from '../../web/src/pure/rigs.js';
import { stats } from '../../web/src/pure/arsenal.js';

const r6 = x => Math.round(x * 1e6) / 1e6;
const bake = p => ({ at: p.at.map(r6), q: p.q.map(r6), cup: r6(p.cup || 0), digits: Object.fromEntries(Object.entries(p.digits).map(([d, a]) => [d, a.map(r6)])) });
// Within the joints' range, give or take the baked poses' rounding to a millionth.
const inRange = p => DIGITS.every(d => within(d, p.digits[d]).every((v, i) => Math.abs(v - p.digits[d][i]) <= 5e-7));

test('the poses the bench reads are the ones the solver gives (else run node blender/realposes.js)', () => {
  assert.deepEqual(DESK_POSES.home.right, bake(typing('right')));
  assert.deepEqual(DESK_POSES.mouse.right, bake(onMouse('right')));
  assert.deepEqual(DESK_POSES.rest.left, bake(resting('left', REST_LEFT)));
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
    assert.ok(miss('right', g.right.grip, 'thumb', spot) < 0.005, `${id} thumb ${miss('right', g.right.grip, 'thumb', spot)} from its spot`);
    assert.ok(pad[2] < -0.012 && H.shape(pad) < 0.005, `${id}: on the left side, resting on it: ${pad}`);
    assert.ok(deepest('right', g.right.grip, H.shape, ['thumb']) < 0.0015, `${id} touching`);
  }
});

test('the trigger finger: its pad on the trigger, bent at its middle and end joints as a shooter\'s is', () => {
  for (const [id, g] of Object.entries(GUNS)) {
    const a = g.right.grip.digits.index;
    assert.ok(miss('right', g.right.grip, 'index', GUN_HOLDS[id].trigger.pad) < 0.0025, `${id} on the trigger`);
    assert.ok(a[2] > 0.45 && a[3] > 0.3 && a[1] < 0.6, `${id} bent: ${a}`);
  }
});

test('the pistol in two hands: the support palm in the grip\'s open left side, its fingers over the shooting hand\'s under the guard, both thumbs forward on the left', () => {
  const H = GUN_HOLDS.pistol, R = GUNS.pistol.right.grip, L = GUNS.pistol.left.grip, over = fingersShape('right', R);
  assert.ok(palmGap('left', L, p => Math.min(H.shape(p), over(p))) < 0.006 && deepestBody('left', L, H.shape) < 0.0015 && worldFor('left', L)[bi('hand')].p[2] < -0.02, `palm on the left side: ${palmGap('left', L, H.shape)}`);
  // Its first finger up under the trigger guard, the next ones resting on the shooting hand's, none hooked into the guard.
  const padI = padFor('left', L, 'index');
  assert.ok(deepest('left', L, H.shape, ['index']) < 0.0015 && padI[1] < -0.05 && padI[1] > -0.06, `first finger under the guard: ${padI}`);
  assert.ok(['middle', 'ring', 'pinky'].filter(d => deepest('left', L, over, [d]) < 0.0015).length >= 2, 'over the shooting fingers');
  const guard = p => p[0] > 0.0335 && p[0] < 0.0815 && p[1] > -0.0475 && p[1] < -0.0235 && Math.abs(p[2]) < 0.012;
  for (const d of FINGERS) assert.ok(!guard(padFor('left', L, d)), `${d} not in the trigger guard`);
  // Its thumb forward along the frame above the guard, pointing at the muzzle; the shooting thumb on the same side.
  const pad = padFor('left', L, 'thumb'), way = norm(sub(pad, worldFor('left', L)[bi('thumb2')].p));
  assert.ok(pad[0] > 0.03 && pad[1] > -0.025 && pad[2] < -0.01 && way[0] > 0.6, `support thumb ${pad} ${way}`);
  assert.ok(padFor('right', R, 'thumb')[2] < -0.012);
});

// The gun's turn and place in the eye's space at the hip (gun.js: the rig, then the gun turned to point ahead).
function gunTurn(id) {
  const [rx, ry, rz] = RIGS[id].hip.r;
  return qMul(qMul(qMul(qAxis([0, 1, 0], ry), qAxis([1, 0, 0], rx)), qAxis([0, 0, 1], rz)), qAxis([0, 1, 0], Math.PI / 2));
}
const eyeToGun = (id, p) => { const q = gunTurn(id); return qRot([-q[0], -q[1], -q[2], q[3]], sub(p, RIGS[id].hip.p)); };
test('the forearms: each hand\'s forearm, drawn toward its elbow, runs down and back toward me at the hip, never up or ahead', () => {
  for (const [id, g] of Object.entries(GUNS)) for (const side of ['right', 'left']) {
    const P = g[side].grip, E = eyeToGun(id, (RIGS[id].elbows || ELBOWS)[side]), way = qRot(gunTurn(id), norm(sub(forearm(side, P, E), P.at)));
    assert.ok(way[1] < -0.1 && way[2] > 0.5 && (side === 'right' ? way[0] > -0.4 : way[0] < 0.1), `${id} ${side} ${way}`);
  }
});

test('the support hand: over the shooting hand\'s fingers on the pistol, round the handguard on the long guns, thumb on its mark', () => {
  for (const [id, g] of Object.entries(GUNS)) {
    const H = GUN_HOLDS[id], shape = heldBy(id, 'left', 'grip');
    // Every finger rests on something.
    for (const d of FINGERS) assert.ok(deepest('left', g.left.grip, shape, [d]) < 0.001, `${id} left ${d} touches`);
    // Its thumb on its mark: up the handguard's left side on a long gun (the pad sits inside the thumb's side resting
    // there), forward along the frame on the pistol.
    const mark = H.fore ? foreThumb(H, H.shape) : onSurface(H.shape, SUPPORT.thumb), pad = padFor('left', g.left.grip, 'thumb');
    assert.ok(miss('left', g.left.grip, 'thumb', mark) < (H.fore ? 0.012 : 0.006), `${id} left thumb ${miss('left', g.left.grip, 'thumb', mark)}`);
    assert.ok(pad[2] < -0.015 && deepest('left', g.left.grip, H.shape, ['thumb']) < 0.0015, `${id} left thumb on the left side, resting: ${pad}`);
  }
  // Over the slide on the way in and out, the open hand clears it.
  assert.ok(deepest('left', GUNS.pistol.left.over, GUN_HOLDS.pistol.shape) > 0.002);
});

test('typing: each finger rests on its own home key, its tip on the cap, the fingers arched; E pressed by the left middle finger', () => {
  for (const side of ['left', 'right']) {
    const P = DESK_POSES.home[side];
    for (const d of [...FINGERS, 'thumb']) {
      const k = KEY[HOME[side][d]], r = landing(side, d, k, P, 0);
      assert.ok(r.inside && r.off < 0.004 && r.gap > -0.0006 && r.gap < 0.0025, `${side} ${d} on ${k.id}: ${JSON.stringify(r)}`);
    }
    assert.ok(deepest(side, P, deskShape) > -0.0015, side);
    // The fingers arch down onto the keys, as a typist's do; the little finger may lie straighter.
    for (const d of ['index', 'middle', 'ring']) assert.ok(P.digits[d][2] > 0.35, `${side} ${d} arched: ${P.digits[d]}`);
  }
  const e = landing('left', 'middle', KEY.KeyE, DESK_POSES.press.left);
  assert.ok(e.inside && e.gap < 0.002 && e.gap > -0.0006, `the left middle finger presses E down: ${JSON.stringify(e)}`);
});

test('between words: the right hand on the mouse, resting on it, not in it; the left resting on the desk', () => {
  const M = DESK_POSES.mouse.right;
  assert.ok(deepest('right', M, mouseShape) > -0.0015 && deepest('right', M, mouseShape) < 0.002);
  const d = deepest('left', DESK_POSES.rest.left, p => p[1]);
  assert.ok(d > -0.0015 && d < 0.002, `left rest ${d}`);
  assert.ok(LIMITS.index.hi[1] > 1.5);
});
