// The realistic hand's poses on things: each range gun's grip (from the same descriptions as the range's own hands,
// pure/handling.js), and at the desk, typing on its keyboard, on its mouse, and resting.
import { GUN_HOLDS } from './handling.js';
import { HOLDS } from '../range/holds.js';
import { digit as toyDigit, qFrame, qRot, sub, add, scale, roundBox } from './hands.js';
import { JOINTS } from './handrig.js';
import { FINGERS, wrap, reach, seat, fingersShape, relaxed, deepest, deepestBody, LIMITS } from './realhand.js';
import { HOME as TYPE_HOME } from './typing.js';

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
  let P = carried(side, toy);
  P = { ...P, at: add(P.at, scale(qRot(P.q, [1, 0, 0]), ahead)) };
  P = seat(side, P, shape, scale(qRot(P.q, [0, 1, 0]), -1), { gap: -0.001 });
  // Skin gives a couple of millimetres where it presses on something; any part of the palm deeper than that comes out.
  const out = scale(qRot(P.q, [0, 1, 0]), 0.0005);
  for (let i = 0; i < 16 && deepestBody(side, P, shape) < -0.0025; i++) P = { ...P, at: add(P.at, out) };
  for (const d of fingers) P.digits[d] = wrap(side, d, P, shape, { from: OPEN(d) });
  P.digits.thumb = reach(side, 'thumb', P, thumb || toyTip(side, toy, 'thumb'), { from: [0.4, 0.5, 0.3, 0.2, -0.3], sdf: shape });
  return P;
}

// A gun's hold, from the range's own (web/src/range/holds.js): this hand laid where the toy hand's knuckles were, its
// palm settled on the grip, the first finger's pad on the trigger, the others and the thumb closed round. The left on
// the pistol closes over the right hand's fingers, on the long guns round the handguard.
export function solveGrip(gunId) {
  const H = GUN_HOLDS[gunId], T = HOLDS[gunId], shape = H.shape;
  const R = settle('right', T.right.grip, shape, { fingers: ['middle', 'ring', 'pinky'], thumb: H.thumbs.right });
  R.digits.index = reach('right', 'index', R, H.trigger.pad, { from: [0.13, 0.5, 1.0, 0.6], sdf: shape });
  if (H.fore) return { right: R, left: settle('left', T.left.grip, shape, { thumb: H.fore.thumb }), shape };
  // On the pistol the toy's support hand sat too far out for this one's shorter fingers to reach round, so it has its
  // own: palm on the grip's left side, fingers down and round the front over the right hand's, thumb along the frame.
  const over = fingersShape('right', R), both = p => Math.min(shape(p), over(p));
  const q = qFrame(SUPPORT.fingers, SUPPORT.back);
  let L = { at: sub(SUPPORT.knuckle, qRot(q, knuckle('left'))), q, digits: relaxed(), cup: 0.2 };
  L = seat('left', L, both, scale(qRot(q, [0, 1, 0]), -1), { gap: -0.001 });
  for (const d of FINGERS) L.digits[d] = wrap('left', d, L, both, { from: OPEN(d) });
  L.digits.thumb = reach('left', 'thumb', L, H.thumbs.left, { from: [0.4, 0.5, 0.3, 0.2, -0.3], sdf: both });
  return { right: R, left: L, shape };
}

// ---------- the desk (blender/zones/studio.py), from the keyboard's middle on the desk: x toward the monitor, y up, z right ----------
export const DESK = {
  // 15 keys across and 5 deep, 19 mm apart like a real keyboard's, 17.5 mm square, their tops 3.9 cm over the desk.
  key: { cols: 15, rows: 5, dx: 0.019, dz: 0.019, x0: -0.038, z0: 0.133, w: 0.0175, d: 0.0175, top: 0.039, h: 0.01 },
  case: { at: [0, 0.018, 0], size: [0.115, 0.022, 0.3] },
  rest: { at: [-0.095, 0.012, 0], size: [0.07, 0.016, 0.3] },
  // The mouse sits left of the keyboard.
  mouse: { at: [0.02, 0.018, -0.48], size: [0.11, 0.035, 0.065], r: 0.016 },
};
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
