// The realistic hand's poses on things: every hold each range gun's clips ask of the hands (carried over from the range's
// own, pure/handling.js), and at the desk, typing on its keyboard, on its mouse, and resting.
import { GUN_HOLDS, rotTrigger } from './handling.js';
import { HOLDS } from '../range/holds.js';
import { digit as toyDigit, qFrame, qRot, qMul, qAxis, sub, add, scale, norm, roundBox } from './hands.js';
import { JOINTS } from './handrig.js';
import { FINGERS, wrap, reach, seat, fingersShape, relaxed, deepest, deepestBody, LIMITS, worldFor, bi, miss } from './realhand.js';
import { HOME as TYPE_HOME, DESK } from './typing.js';

const mz = p => [p[0], p[1], -p[2]];
const knuckle = side => (side === 'left' ? mz(JOINTS['finger-3-1']) : JOINTS['finger-3-1']);
// Fingers from open, closed round the shape one joint at a time.
const OPEN = d => [relaxed()[d][0], LIMITS[d].lo[1], 0, 0];

// ---------- on the range's guns: the range's own holds, carried over onto this hand ----------
// The support hand on the pistol: its fingers' way, its back's, and where its middle knuckle goes (gun space).
const SUPPORT = { fingers: [0.6, -0.6, 0.5], back: [0.05, -0.35, -1], knuckle: [0.04, -0.07, -0.045] };
// The turn that best lays one set of points onto another (Horn's quaternion method; the largest eigenvector found by
// repeated multiplication, shifted so it is the dominant one).
function bestTurn(from, to) {
  const ca = from.reduce((s, p) => add(s, p), [0, 0, 0]).map(v => v / from.length), cb = to.reduce((s, p) => add(s, p), [0, 0, 0]).map(v => v / to.length);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  from.forEach((p, i) => { const a = sub(p, ca), b = sub(to[i], cb); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += a[r] * b[c]; });
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [[xx + yy + zz, yz - zy, zx - xz, xy - yx], [yz - zy, xx - yy - zz, xy + yx, zx + xz], [zx - xz, xy + yx, -xx + yy - zz, yz + zy], [xy - yx, zx + xz, yz + zy, -xx - yy + zz]];
  const shift = Math.abs(xx) + Math.abs(yy) + Math.abs(zz) + Math.abs(xy) + Math.abs(xz) + Math.abs(yx) + Math.abs(yz) + Math.abs(zx) + Math.abs(zy);
  let v = [1, 0.1, 0.1, 0.1];
  for (let k = 0; k < 400; k++) { const w = N.map((row, r) => row.reduce((s, x, c) => s + x * v[c], 0) + shift * v[r]); const l = Math.hypot(...w); v = w.map(x => x / l); }
  const q = [v[1], v[2], v[3], v[0]];
  return { q, at: sub(cb, qRot(q, ca)) };
}
// Where the toy hand's knuckles, thumb root and wrist are in a hold, and where this hand's are in its own axes.
export function carried(side, toy) {
  const m = side === 'left' ? mz : p => p, out = [toy.at], mine = [[0, 0, 0]];
  for (const [d, n] of [['index', 2], ['middle', 3], ['ring', 4], ['pinky', 5], ['thumb', 1]]) {
    out.push(add(toy.at, qRot(toy.q, toyDigit(side, d, toy.digits[d]).pts[0])));
    mine.push(m(JOINTS[`finger-${n}-1`]));
  }
  const { q, at } = bestTurn(mine, out);
  return { at, q, digits: relaxed(), cup: 0.25 };
}
// Where the toy hand's digit tip was in a hold.
const toyTip = (side, toy, d) => add(toy.at, qRot(toy.q, toyDigit(side, d, toy.digits[d]).pts[3]));
// A carried hold settled onto the shape: pressed in along its palm until it rests there, its fingers closed round it.
// `ahead`: how much further along its fingers this hand goes than the toy's knuckles did, its fingers being shorter
// past them, so they still reach round what the toy's closed round.
function settle(side, toy, shape, { fingers = FINGERS, thumb = null, ahead = 0 } = {}) {
  const P = carried(side, toy), to = thumb || toyTip(side, toy, 'thumb');
  return closed(side, seated(side, { ...P, at: add(P.at, scale(qRot(P.q, [1, 0, 0]), ahead)) }, shape), shape, fingers,
    Q => reach(side, 'thumb', Q, to, { from: OPEN_THUMB, sdf: shape }));
}
const OPEN_THUMB = [0.4, 0.5, 0.3, 0.2, -0.3];
// A palm brought onto a shape along its own normal. Skin gives a couple of millimetres where it presses on something;
// any part of the palm deeper than that comes out.
function seated(side, P, shape) {
  P = seat(side, P, shape, scale(qRot(P.q, [0, 1, 0]), -1), { gap: -0.001 });
  const out = scale(qRot(P.q, [0, 1, 0]), 0.0005);
  for (let i = 0; i < 16 && deepestBody(side, P, shape) < -0.0025; i++) P = { ...P, at: add(P.at, out) };
  return P;
}
// Fingers closed round the shape, and the thumb by `thumb` if given; a digit whose root still presses in more than a
// millimetre takes the palm out.
function closed(side, P, shape, fingers, thumb = null) {
  const out = scale(qRot(P.q, [0, 1, 0]), 0.0005), digits = thumb ? [...fingers, 'thumb'] : fingers;
  for (let i = 0; i < 16; i++) {
    P = { ...P, digits: { ...P.digits } };
    for (const d of fingers) P.digits[d] = wrap(side, d, P, shape, { from: OPEN(d) });
    if (thumb) P.digits.thumb = thumb(P);
    if (digits.every(d => deepest(side, P, shape, [d]) > -0.001)) break;
    P = { ...P, at: add(P.at, out) };
  }
  return P;
}

// The range's marks were where the toy hand's digit ends went, inside the digit; this hand's pads are its skin, so they
// are aimed at the spot on the surface under a mark, `gap` off it.
export function onSurface(sdf, p, gap = 0.0008) {
  const e = 1e-4;
  let q = p.slice();
  for (let i = 0; i < 6; i++) {
    const n = norm([0, 1, 2].map(k => { const a = q.slice(), b = q.slice(); a[k] += e; b[k] -= e; return sdf(a) - sdf(b); }));
    q = sub(q, scale(n, sdf(q) - gap));
  }
  return q;
}
const deg = Math.PI / 180, DOWN = norm([-0.333, -0.943, 0]);
const turned = (P, pivot, q) => ({ ...P, at: add(pivot, qRot(q, sub(P.at, pivot))), q: qMul(q, P.q) });
// The shooting hand on the grip all five guns share: the toy's, turned about its first knuckle (fingers up `pitch` degrees, round the grip
// `roll`), moved by `shift`, its thumb's spot on the grip's left side. The trigger sits further forward than on a real
// pistol, so with the first finger on it this thumb cannot reach the toy's mark high on the frame: it wraps round the
// back of the grip instead, its pad resting on the left side.
export const SHOOT = { pitch: 10, roll: -1, shift: [0.001, 0.001, 0], thumb: [-0.016, -0.03, -0.03] };
function shooting(gunId) {
  const H = GUN_HOLDS[gunId], shape = H.shape, P0 = carried('right', HOLDS[gunId].right.grip), pivot = worldFor('right', P0)[bi('index1')].p;
  let P = turned(P0, pivot, qMul(qAxis(DOWN, SHOOT.roll * deg), qAxis([0, 0, 1], SHOOT.pitch * deg)));
  P = closed('right', seated('right', { ...P, at: add(P.at, SHOOT.shift), digits: relaxed() }, shape), shape, ['middle', 'ring', 'pinky']);
  P.digits.index = reach('right', 'index', P, H.trigger.pad, { from: [0.13, 0.5, 1.0, 0.6], sdf: shape });
  P.digits.thumb = reach('right', 'thumb', P, onSurface(shape, SHOOT.thumb), { from: OPEN_THUMB, sdf: shape });
  return P;
}
// Off the trigger, the first finger laid along the frame above it, as far toward the toy's mark as it reaches.
function alongFrame(P, H) {
  let out = null;
  for (let back = 0; back <= 0.0281; back += 0.004) {
    const to = onSurface(H.shape, [H.straight[0] - back, H.straight[1], H.straight[2]]);
    out = { ...P, digits: { ...P.digits, index: reach('right', 'index', P, to, { from: [relaxed().index[0], 0.1, 0.1, 0.05], sdf: H.shape }) } };
    if (miss('right', out, 'index', to) < 0.002) break;
  }
  return out;
}
// The thumb toward a button or lever: on these guns they are beyond its reach from the grip (even turning the hand
// round it), so it goes as far toward them as it can, never into the gun.
const pressing = (P, H, at) => ({ ...P, digits: { ...P.digits, thumb: reach('right', 'thumb', P, onSurface(H.shape, at, 0), { from: P.digits.thumb, sdf: H.shape, keep: 0, sweep: false }) } });
// A hand laid as the toy's was in a pose, settled on what it holds, its thumb on the spot under the toy's mark.
const laid = (side, toy, shape, mark, opts = {}) => settle(side, toy, shape, { ...opts, thumb: onSurface(shape, mark) });

// Every pose a gun's clips ask of the hands (pure/clips.js), both hands, from the range's own (web/src/range/holds.js):
// this hand laid where the toy hand was in each and settled on what it holds, its digits closed round and on their
// marks. The pistol's support hand has its own pose, over the shooting hand's fingers.
export function solveHolds(gunId) {
  const H = GUN_HOLDS[gunId], T = HOLDS[gunId], shape = H.shape, grip = shooting(gunId);
  const right = {
    grip,
    // Pulled: the pad follows the trigger's face round its pin.
    pull: { ...grip, digits: { ...grip.digits, index: reach('right', 'index', grip, rotTrigger(H.trigger, 1), { from: grip.digits.index, sdf: shape, sweep: false }) } },
    straight: alongFrame(grip, H),
  };
  if (H.release) right.release = pressing(right.straight, H, H.release);
  if (H.stop) right.stop = pressing(right.straight, H, H.stop);
  for (const [name, set] of Object.entries(H.rightExtra || {})) right[name] = laid('right', T.right[name], shape, set.thumb);
  if (H.fore) {
    const magged = H.cup.alone ? H.mag : p => Math.min(H.mag(p), shape(p));
    const left = { grip: settle('left', T.left.grip, shape, { thumb: H.fore.thumb }), mag: laid('left', T.left.mag, magged, H.cup.thumb) };
    for (const [name, set] of Object.entries(H.extra || {})) left[name] = laid('left', T.left[name], shape, set.thumb);
    return { right, left };
  }
  // On the pistol the toy's support hand sat too far out for this one's shorter fingers to reach round, so it has its
  // own: palm on the grip's left side, fingers down and round the front over the right hand's, thumb along the frame.
  const over = fingersShape('right', grip), both = p => Math.min(shape(p), over(p));
  const q = qFrame(SUPPORT.fingers, SUPPORT.back);
  let L = { at: sub(SUPPORT.knuckle, qRot(q, knuckle('left'))), q, digits: relaxed(), cup: 0.2 };
  L = seat('left', L, both, scale(qRot(q, [0, 1, 0]), -1), { gap: -0.001 });
  for (const d of FINGERS) L.digits[d] = wrap('left', d, L, both, { from: OPEN(d) });
  L.digits.thumb = reach('left', 'thumb', L, H.thumbs.left, { from: OPEN_THUMB, sdf: both });
  // A magazine is cupped as it sits home, so the fingers stop where the grip begins; the longer one by its own foot.
  const magged = p => Math.min(H.mag(p), shape(p)), longer = p => Math.min(H.long.mag(p), shape(p));
  const pinch = laid('left', T.left.pinch, shape, H.over.thumb);
  // Over the slide on the way in and out: the pinch lifted clear, the hand open.
  let lift = { ...pinch, at: add(pinch.at, [0, 0.014, 0]), digits: relaxed() };
  while (deepest('left', lift, shape) < -0.001) lift = { ...lift, at: add(lift.at, [0, 0.002, 0]) };
  return { right, left: { grip: L, mag: laid('left', T.left.mag, magged, H.cup.thumb), magX: laid('left', T.left.magX, longer, H.long.cup.thumb), pinch, over: lift } };
}

// ---------- the desk (blender/zones/studio.py), from the keyboard's middle on the desk: x toward the monitor, y up, z right ----------
export { DESK };
// The middle of a key's top: row 0 the nearest, column 0 the furthest right.
export const keyTop = (row, col, press = 0) => [DESK.key.x0 + row * DESK.key.dx, DESK.key.top - press, DESK.key.z0 - col * DESK.key.dz];
// Where a typing finger's pad is aimed from the middle of its key's top: its tip is what lands on the key.
export const PAD_ON_KEY = [-0.004, 0.002, 0];
// Home keys, by row and column, from pure/typing.js.
export { TYPE_HOME as HOME };
// The keyboard as a shape, any pressed keys (by `row,col`) pushed down by their press.
const keysShape = (p, down = {}) => {
  const K = DESK.key, row = Math.round((p[0] - K.x0) / K.dx), col = Math.round((K.z0 - p[2]) / K.dz);
  let d = Infinity;
  for (let r = Math.max(0, row - 1); r <= Math.min(K.rows - 1, row + 1); r++) for (let c = Math.max(0, col - 1); c <= Math.min(K.cols - 1, col + 1); c++) {
    const t = keyTop(r, c, down[`${r},${c}`] || 0);
    d = Math.min(d, roundBox(p, [t[0], t[1] - K.h / 2, t[2]], [K.w / 2, K.h / 2, K.d / 2], 0.002));
  }
  return Math.min(d, roundBox(p, DESK.case.at, DESK.case.size.map(v => v / 2), 0.004), roundBox(p, DESK.rest.at, DESK.rest.size.map(v => v / 2), 0.006), p[1]);
};
export const deskShape = p => Math.min(keysShape(p), mouseShape(p));
export const mouseShape = p => roundBox(p, DESK.mouse.at, DESK.mouse.size.map(v => v / 2), DESK.mouse.r);

// A typing hand's wrist: floating over the wrist rest, high enough that the fingers arch down onto their home keys, the
// fingers a little down and in toward the keyboard's middle, the back tipped toward the little finger's side.
export const TYPING = { back: -0.125, up: 0.05, side: 0.005, turn: 0.1 };
export function typingHand(side) {
  const s = side === 'left' ? -1 : 1, H = TYPE_HOME[side], mid = keyTop(2, (H.index[1] + H.pinky[1]) / 2);
  return { at: add(mid, [TYPING.back, TYPING.up, TYPING.side * s]), q: qFrame([1, -0.1, -TYPING.turn * s], [0.1, 1, 0.28 * s]), cup: 0.1 };
}
// How far the wrist goes along with a finger to a key that finger cannot reach from home: part of the way across the
// rows and columns it has to travel past its neighbours.
export function wristShift(side, digit, [row, col]) {
  const [hr, hc] = TYPE_HOME[side][digit], dr = row - hr, dc = col - hc, K = DESK.key;
  const past = (d, free) => Math.sign(d) * Math.max(0, Math.abs(d) - free);
  return [past(dr, 1) * K.dx * 0.6, 0, -past(dc, digit === 'thumb' ? 2 : 1) * K.dz * 0.6];
}
// The angles that put a digit on a key: resting on its top, pressed `press` metres down, or lifted `lift` metres over it.
export function keyAngles(side, digit, key, { press = 0, lift = 0, from = null, sweep = true } = {}) {
  const base = typingHand(side), P = { ...base, at: add(base.at, wristShift(side, digit, key)), digits: relaxed() };
  // Pressing, the keys either side in its row go down with it as far as the board's shape goes: a fingertip wider than
  // the gap may brush them, but never sinks into its own key.
  const down = press > 0 ? { [key.join()]: press, [[key[0], key[1] - 1].join()]: press, [[key[0], key[1] + 1].join()]: press } : {}, board = p => keysShape(p, down);
  const t = add(keyTop(key[0], key[1], press), digit === 'thumb' ? [0.002, 0.0015 + lift, 0] : [PAD_ON_KEY[0], PAD_ON_KEY[1] + lift, 0]);
  const start = from || (digit === 'thumb' ? [0.3, 0.5, 0.2, 0.2, 0] : [relaxed()[digit][0], 0.6, 1.0, 0.5]);
  const sdf = digit === 'thumb' ? p => board(p) + 0.0015 : board;
  return reach(side, digit, P, t, { from: start, follow: digit === 'thumb' ? 0.8 : 0.6, sdf, keep: 0.0003, sweep });
}
// A hand over the keyboard, every finger resting on its home key (or, by `keys`, another, pressed `press` down).
export function typing(side, { keys = {}, press = {} } = {}) {
  const P = { ...typingHand(side), digits: relaxed() };
  for (const d of [...FINGERS, 'thumb']) P.digits[d] = keyAngles(side, d, keys[d] || TYPE_HOME[side][d], { press: press[d] || 0 });
  return P;
}

// A hand on the mouse: palm over its back, the first two fingers along its buttons, the thumb on its near side, the
// last two curled round its far side.
export function onMouse(side) {
  const M = DESK.mouse, s = side === 'left' ? -1 : 1, top = M.at[1] + M.size[1] / 2;
  const q = qFrame([1, -0.18, 0.05 * s], [0, 1, 0.12 * s]);
  let P = { at: [M.at[0] - 0.115, top + 0.022, M.at[2] + 0.004 * s], q, digits: relaxed(), cup: 0.15 };
  P = seat(side, P, mouseShape, [0, -1, 0], { gap: 0.0008 });
  for (const d of FINGERS) P.digits[d] = wrap(side, d, P, mouseShape, { from: [P.digits[d][0], 0, 0, 0] });
  P.digits.thumb = reach(side, 'thumb', P, [M.at[0] - 0.012, M.at[1] - 0.002, M.at[2] - s * (M.size[2] / 2 + 0.002)], { from: [0.2, 0.3, 0.2, 0.2, 0], sdf: mouseShape });
  return P;
}

// A hand at rest on the desk beside the keyboard: loose, the heel of the palm and the finger tips on the desk.
export function resting(side, at = [-0.02, 0, 0.36]) {
  const s = side === 'left' ? -1 : 1, desk = p => p[1];
  const loose = Object.fromEntries(FINGERS.map((d, i) => [d, [relaxed()[d][0], 0.1, 0.3 + 0.05 * i, 0.2]]));
  let P = { at: add(at, [0, 0.05, 0]), q: qFrame([1, -0.08, -0.18 * s], [0.05, 1, 0.3 * s]), digits: { ...relaxed(), ...loose }, cup: 0 };
  // Down until the first of it touches the desk, then each finger lets its knuckle fall until its tip does.
  let lo = 0, hi = 0.1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (deepest(side, { ...P, at: add(P.at, [0, -m, 0]) }, desk) > 0.0005) lo = m; else hi = m; }
  P = { ...P, at: add(P.at, [0, -lo, 0]) };
  for (const d of FINGERS) P.digits[d] = wrap(side, d, P, desk, { from: P.digits[d], joints: [1] });
  // The fingers' bend can carry the skin round a knuckle a little lower: lifted back to resting on the desk.
  while (deepest(side, P, desk) < -0.0006) P = { ...P, at: add(P.at, [0, 0.0002, 0]) };
  return P;
}
