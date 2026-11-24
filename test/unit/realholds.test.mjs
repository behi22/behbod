import test from 'node:test';
import assert from 'node:assert/strict';
import { FINGERS, DIGITS, deepest, deepestBody, miss, fingersShape, LIMITS, within } from '../../web/src/pure/realhand.js';
import { solveGrip, typing, onMouse, resting, keyTop, HOME, DESK, deskShape, mouseShape } from '../../web/src/pure/realholds.js';
import { roundBox } from '../../web/src/pure/hands.js';
import { GUNS, DESK_POSES } from '../../web/src/pure/realposes.js';
import { GUN_HOLDS } from '../../web/src/pure/handling.js';

const r6 = x => Math.round(x * 1e6) / 1e6;
const bake = p => ({ at: p.at.map(r6), q: p.q.map(r6), cup: r6(p.cup || 0), digits: Object.fromEntries(Object.entries(p.digits).map(([d, a]) => [d, a.map(r6)])) });
const inRange = p => DIGITS.every(d => within(d, p.digits[d]).every((v, i) => Math.abs(v - p.digits[d][i]) < 1e-9));

test('the poses the bench reads are the ones the solver gives (else run node blender/realposes.js)', () => {
  assert.deepEqual(DESK_POSES.home.right, bake(typing('right')));
  assert.deepEqual(DESK_POSES.mouse.left, bake(onMouse('left')));
  assert.deepEqual(DESK_POSES.rest.right, bake(resting('right')));
  const g = solveGrip('pistol');
  assert.deepEqual(GUNS.pistol.right, bake(g.right));
  assert.deepEqual(GUNS.pistol.left, bake(g.left));
  assert.deepEqual(Object.keys(GUNS).sort(), Object.keys(GUN_HOLDS).sort());
});

test('on every gun: no finger in the gun, the palm pressed no deeper than skin gives, the trigger finger on the trigger', () => {
  for (const [id, g] of Object.entries(GUNS)) {
    const H = GUN_HOLDS[id], shape = H.shape;
    assert.ok(inRange(g.right) && inRange(g.left), `${id}: within the joints' range`);
    for (const d of DIGITS) assert.ok(deepest('right', g.right, shape, [d]) > -0.001, `${id} right ${d}`);
    assert.ok(deepestBody('right', g.right, shape) > -0.003, `${id} right palm`);
    // The three lower fingers are closed and resting on the grip, not hanging off it.
    for (const d of ['middle', 'ring', 'pinky']) {
      assert.ok(deepest('right', g.right, shape, [d]) < 0.001, `${id} right ${d} touches`);
      assert.ok(g.right.digits[d][1] + g.right.digits[d][2] > 1.2, `${id} right ${d} closed`);
    }
    assert.ok(miss('right', g.right, 'index', H.trigger.pad) < 0.0045, `${id} trigger ${miss('right', g.right, 'index', H.trigger.pad)}`);
  }
});

test('the support hand: over the shooting hand\'s fingers on the pistol, round the handguard on the long guns, thumb on its mark', () => {
  for (const [id, g] of Object.entries(GUNS)) {
    const H = GUN_HOLDS[id], over = fingersShape('right', g.right), shape = H.fore ? H.shape : p => Math.min(H.shape(p), over(p));
    for (const d of DIGITS) assert.ok(deepest('left', g.left, shape, [d]) > -0.0035, `${id} left ${d}: ${deepest('left', g.left, shape, [d])}`);
    assert.ok(deepestBody('left', g.left, shape) > -0.0035, `${id} left palm`);
    // Every finger rests on something.
    for (const d of FINGERS) assert.ok(deepest('left', g.left, shape, [d]) < 0.001, `${id} left ${d} touches`);
    const mark = H.fore ? H.fore.thumb : H.thumbs.left;
    assert.ok(miss('left', g.left, 'thumb', mark) < 0.006, `${id} left thumb ${miss('left', g.left, 'thumb', mark)}`);
  }
});

test('typing: each finger rests on its own key, a pressed key pressed, nothing through the keys', () => {
  const K = DESK.key, own = (row, col, down = 0) => { const t = keyTop(row, col, down); return p => roundBox(p, [t[0], t[1] - 0.006, t[2]], [K.w / 2, 0.006, K.d / 2], 0.002); };
  for (const side of ['left', 'right']) {
    const P = DESK_POSES.home[side];
    for (const d of FINGERS) { const k = deepest(side, P, own(2, HOME[side][d]), [d]); assert.ok(k > -0.001 && k < 0.001, `${side} ${d} on its key: ${k}`); }
    assert.ok(deepest(side, P, deskShape) > -0.001, side);
    // The fingers arch down onto the keys, as a typist's do; the little finger may lie straighter.
    for (const d of ['index', 'middle', 'ring']) assert.ok(P.digits[d][2] > 0.35, `${side} ${d} arched: ${P.digits[d]}`);
  }
  const e = deepest('left', DESK_POSES.press.left, own(3, 11, 0.003), ['middle']);
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
