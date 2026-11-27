// The realistic hand's poses on things: every hold each range gun's clips ask of the hands (carried over from the range's
// own, pure/handling.js), and at the desk, typing on its keyboard, on its mouse, and resting.
import { GUN_HOLDS, rotTrigger } from './handling.js';
import { HOLDS } from '../range/holds.js';
import { digit as toyDigit, qFrame, qRot, qMul, qAxis, sub, add, scale, norm, roundBox } from './hands.js';
import { JOINTS } from './handrig.js';
import { FINGERS, wrap, reach, seat, fingersShape, relaxed, deepest, deepestBody, LIMITS, worldFor, bi, miss, tipPoints } from './realhand.js';
import { HOME as TYPE_HOME, DESK, KEYS, KEY, U, TRAVEL, spotOn } from './typing.js';

const mz = p => [p[0], p[1], -p[2]];
const knuckle = side => (side === 'left' ? mz(JOINTS['finger-3-1']) : JOINTS['finger-3-1']);
// Fingers from open, closed round the shape one joint at a time.
const OPEN = d => [relaxed()[d][0], LIMITS[d].lo[1], 0, 0];
// From half curled, so fingers close round a grip without catching on what stands just ahead of it (a long gun's
// magazine well).
const CURLED = d => [relaxed()[d][0], 0.4, 0.6, 0.4];

// ---------- on the range's guns: the range's own holds, carried over onto this hand ----------
// The support hand on the pistol: its fingers' way, its back's, and where its middle knuckle goes (gun space).
export const SUPPORT = { fingers: [0.891, -0.255, 0.377], back: [0.211, -0.502, -0.839], knuckle: [0.035, -0.08, -0.032], thumb: [0.045, -0.013, -0.02] };
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
// Fingers closed round the shape from `start`, and the thumb by `thumb` if given; a digit whose root still presses in
// more than a millimetre takes the palm out.
function closed(side, P, shape, fingers, thumb = null, start = OPEN) {
  const out = scale(qRot(P.q, [0, 1, 0]), 0.0005), digits = thumb ? [...fingers, 'thumb'] : fingers;
  for (let i = 0; i < 16; i++) {
    P = { ...P, digits: { ...P.digits } };
    for (const d of fingers) P.digits[d] = wrap(side, d, P, shape, { from: start(d) });
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
// The shooting hand on the grip all five guns share: the toy's, turned about its first knuckle (fingers up `pitch`
// degrees, round the grip `roll`, out at the wrist `yaw`) and moved by `shift`, so the first finger reaches the trigger
// with its joints bent as a shooter's are. The trigger sits further forward than on a real pistol, so this thumb cannot
// reach the toy's mark high on the frame: it wraps round the back of the grip instead, its pad resting on the left side.
export const SHOOT = { pitch: 11.46, roll: -14.32, yaw: 5.73, shift: [0.0135, -0.002, -0.001], thumb: [-0.018, -0.032, -0.03] };
function shooting(gunId) {
  const H = GUN_HOLDS[gunId], shape = H.shape, P0 = carried('right', HOLDS[gunId].right.grip), pivot = worldFor('right', P0)[bi('index1')].p;
  let P = turned(P0, pivot, qMul(qAxis([0, 1, 0], SHOOT.yaw * deg), qMul(qAxis(DOWN, SHOOT.roll * deg), qAxis([0, 0, 1], SHOOT.pitch * deg))));
  P = closed('right', seated('right', { ...P, at: add(P.at, SHOOT.shift), digits: relaxed() }, shape), shape, ['middle', 'ring', 'pinky'], null, CURLED);
  P.digits.index = reach('right', 'index', P, H.trigger.pad, { from: [0, 0.5, 0.7, 0.5], sdf: shape });
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

// The free hand under a long gun's handguard: palm up against it, fingers across its underside and round its right
// side, thumb up its left; the back of the wrist bends a little to the forearm coming up from below.
// Its middle knuckle goes `shift` from the range's mark, its thumb `thumb` from there, up the handguard's left side.
export const FORE = { fingers: [0.6, 0, 0.8], back: [0, -1, -0.25], shift: [0.008, -0.006, 0.004], thumb: [0.02, 0.045, -0.04] };
export const foreThumb = (H, shape) => onSurface(shape, add(add(H.fore.knuckle, FORE.shift), FORE.thumb));
function underHandguard(H, shape) {
  const q = qFrame(FORE.fingers, FORE.back);
  const L = closed('left', seated('left', { at: sub(add(H.fore.knuckle, FORE.shift), qRot(q, knuckle('left'))), q, digits: relaxed(), cup: 0.2 }, shape), shape, FINGERS);
  L.digits.thumb = reach('left', 'thumb', L, foreThumb(H, shape), { from: [0.4, -0.3, 0.2, 0.2, -0.3], sdf: shape, keep: -0.0005 });
  return L;
}

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
    const left = { grip: underHandguard(H, shape), mag: laid('left', T.left.mag, magged, H.cup.thumb) };
    for (const [name, set] of Object.entries(H.extra || {})) left[name] = laid('left', T.left[name], shape, set.thumb);
    return { right, left };
  }
  // On the pistol the toy's support hand sat too far out for this one's shorter fingers to reach round, so it has its
  // own: palm on the grip's left side, fingers down and round the front over the right hand's, thumb along the frame.
  const over = fingersShape('right', grip), both = p => Math.min(shape(p), over(p));
  const q = qFrame(SUPPORT.fingers, SUPPORT.back);
  let L = { at: sub(SUPPORT.knuckle, qRot(q, knuckle('left'))), q, digits: relaxed(), cup: 0.2 };
  L = closed('left', seat('left', L, both, scale(qRot(q, [0, 1, 0]), -1), { gap: -0.001 }), both, FINGERS);
  L.digits.thumb = reach('left', 'thumb', L, onSurface(shape, SUPPORT.thumb), { from: [0.2, 0.3, 0.1, 0.1, 0], sdf: both });
  // A magazine is cupped as it sits home, so the fingers stop where the grip begins; the longer one by its own foot.
  const magged = p => Math.min(H.mag(p), shape(p)), longer = p => Math.min(H.long.mag(p), shape(p));
  const pinch = laid('left', T.left.pinch, shape, H.over.thumb);
  // Over the slide on the way in and out: the pinch lifted clear, the hand open.
  let lift = { ...pinch, at: add(pinch.at, [0, 0.014, 0]), digits: relaxed() };
  while (deepest('left', lift, shape) < -0.001) lift = { ...lift, at: add(lift.at, [0, 0.002, 0]) };
  return { right, left: { grip: L, mag: laid('left', T.left.mag, magged, H.cup.thumb), magX: laid('left', T.left.magX, longer, H.long.cup.thumb), pinch, over: lift } };
}

// ---------- the desk (blender/zones/studio.py), from the keyboard's middle on the desk: x toward the monitor, y up, z right ----------
export { DESK, KEYS, KEY };
// The top of a key, pressed `press` down: its middle, or for a finger the spot it lands on (pure/typing.js spotOn).
export function keyTop(key, press = 0, side = null, digit = null) {
  const [x, z] = side ? spotOn(key, side, digit) : [key.x, key.z];
  return [x, DESK.key.top - press, z];
}
export { TYPE_HOME as HOME };
const ROW = [0, 1, 2, 3, 4].map(r => KEYS.filter(k => k.row === r));
// One key's cap as a shape, pressed `down`.
export const capShape = (key, down = 0) => p => roundBox(p, [key.x, DESK.key.top - DESK.key.h / 2 - down, key.z], [key.d / 2, DESK.key.h / 2, key.w / 2], 0.002);
// The keyboard as a shape, any pressed keys (by id) pushed down by their press.
const keysShape = (p, down = {}) => {
  const row = Math.round(p[0] / U + 2);
  let d = Infinity;
  for (let r = Math.max(0, row - 1); r <= Math.min(4, row + 1); r++) for (const k of ROW[r]) {
    if (Math.abs(p[2] - k.z) < k.w / 2 + 0.025) d = Math.min(d, capShape(k, down[k.id] || 0)(p));
  }
  return Math.min(d, roundBox(p, DESK.case.at, DESK.case.size.map(v => v / 2), 0.004), roundBox(p, DESK.rest.at, DESK.rest.size.map(v => v / 2), 0.006), p[1]);
};
export const deskShape = p => Math.min(keysShape(p), mouseShape(p));
export const mouseShape = p => roundBox(p, DESK.mouse.at, DESK.mouse.size.map(v => v / 2), DESK.mouse.r);

// A typing hand, as a typist holds one: the wrist behind its middle finger's home key, floating over the wrist rest,
// the back of the hand level but for its knuckles held a little higher (`pitch`), tipped toward the little finger's
// side and turned a little in, the fingers curving down from the knuckles onto the keys. It holds still while it
// types: only the fingers move. These six were fitted so every finger rests on its home key.
export const TYPING = { back: -0.132, up: 0.031, side: 0.029, turn: 0.12, tilt: 0.325, pitch: 0.23 };
// A typist's fingers curve down from the knuckles: each knuckle bent at least 17 degrees, the middle joints of the first
// three fingers 23 (the little finger may lie straighter), never a joint bent back, nor the thumb's knuckle.
const CURVE = [undefined, 0.3, 0.4];
export const TYPE_LO = { index: CURVE, middle: CURVE, ring: CURVE, pinky: [undefined, 0.3, 0.1], thumb: [undefined, undefined, -0.05] };
// Pressing, the finger bends a little further: its tip goes down with the key, rolling back along it a little.
export const ROLL = 0.08;
export function typingHand(side) {
  const s = side === 'left' ? -1 : 1, mid = [0, DESK.key.top, KEY[TYPE_HOME[side].middle].z];
  return { at: add(mid, [TYPING.back, TYPING.up, TYPING.side * s]), q: qFrame([1, TYPING.pitch, -TYPING.turn * s], [0, 1, TYPING.tilt * s]), cup: 0.1 };
}
// A first guess at how far the wrist goes along with a finger to a key it cannot reach from home: part of the way
// across the rows and the width it has to travel past its neighbours, and most of the way back to a nearer row, so a
// curved finger reaches it by reaching out, not by curling under.
export function wristShift(side, digit, key) {
  const [hx, hz] = spotOn(KEY[TYPE_HOME[side][digit]], side, digit), [kx, kz] = spotOn(key, side, digit);
  const past = (d, free) => Math.sign(d) * Math.max(0, Math.abs(d) - free);
  return [kx < hx && digit !== 'thumb' ? (kx - hx) * 0.8 : past(kx - hx, U) * 0.6, 0, past(kz - hz, (digit === 'thumb' ? 2 : 1) * U) * 0.6];
}
// Where a digit's tip goes on a key: on its spot on the key's top (a fifth of a millimetre over it), pressed `press`
// metres down, or lifted `lift` over it.
export const tipTarget = (side, digit, key, press = 0, lift = 0) => add(keyTop(key, press, side, digit), [0, 0.0002 + lift, 0]);
// The hand with its wrist shifted and one digit's angles.
const shifted = (side, shift, digits) => { const b = typingHand(side); return { ...b, at: add(b.at, shift), digits }; };
// The other digits held up out of the way while one is fitted, so the skin they share with it near the knuckles
// never stands in for it touching the keys.
const UP = () => ({ ...Object.fromEntries(FINGERS.map(d => [d, [relaxed()[d][0], -0.2, 0.15, 0.1]])), thumb: [0.3, -0.3, 0, 0, 0] });
// The angles that put a digit's tip on a key, the wrist shifted by `shift`: resting on its top, pressed `press` down,
// or lifted `lift` over it.
export function keyAngles(side, digit, key, { press = 0, lift = 0, from = null, sweep = true, shift = wristShift(side, digit, key), level = 1, hold = [] } = {}) {
  const P = shifted(side, shift, UP());
  // Pressing, the keys round it go down with it as far as the board's shape goes: a fingertip wider than the gap may
  // brush them, but never sinks into its own key.
  const down = {};
  if (press > 0) for (const k of KEYS) if (Math.abs(k.row - key.row) <= 1 && Math.abs(k.z - key.z) < (k.w + key.w) / 2 + 0.002) down[k.id] = press;
  const board = p => keysShape(p, down), t = tipTarget(side, digit, key, press, lift);
  // Rolling along it as it presses, the tip stays two millimetres in from the cap's edges.
  const cap = level < 1 ? { at: [key.x, key.z], half: [key.d / 2 - 0.002, key.w / 2 - 0.002] } : null;
  const start = from || (digit === 'thumb' ? [0.3, 0.5, 0.2, 0.2, 0] : [relaxed()[digit][0], 0.6, 1.0, 0.5]);
  return reach(side, digit, P, t, { from: start, follow: digit === 'thumb' ? 0.8 : 0.6, sdf: board, keep: 0.0002, sweep, tip: true, lo: TYPE_LO[digit], level, cap, hold });
}
// A digit on a key: the wrist shifted along with it until its tip lands on its spot (the shift that came nearest is
// kept), and its angles resting on the key, pressed to the bottom of its travel and lifted over it on the way.
export function onKey(side, digit, key, from = null) {
  const [x, z] = spotOn(key, side, digit), home = key.id === TYPE_HOME[side][digit];
  let shift = wristShift(side, digit, key), best = null;
  // A finger's own home key: the hand stays exactly as it rests.
  for (let i = 0; i < (home ? 1 : 10); i++) {
    const top = keyAngles(side, digit, key, { shift, from: best ? best.top : from, sweep: !best });
    // How near: across the key, and how far the tip is held up over it (a finger curled under itself).
    const r = landing(side, digit, key, shifted(side, shift, { ...relaxed(), [digit]: top }), 0);
    const e = [x - r.at[0], 0, z - r.at[2]], off = Math.hypot(e[0], e[2], Math.max(0, r.gap - 0.0005));
    if (!best || off < best.off) best = { shift, top, off };
    if (off < 0.001) break;
    shift = add(best.shift, scale(e, 0.7));
  }
  ({ shift } = best);
  const top = best.top, press = keyAngles(side, digit, key, { shift, press: TRAVEL, from: top, level: ROLL, sweep: false, hold: [0] });
  const lift = keyAngles(side, digit, key, { shift, lift: 0.007, from: top, sweep: false });
  return { shift, top, press, lift };
}
// Where a digit's tip meets its key in a pose: the lowest point of its tip, how far that is from the spot it is aimed at
// across the key's top, whether it is on the key's cap, and how far over the cap's top pressed `press` down it is.
export function landing(side, digit, key, P, press = TRAVEL) {
  let low = null;
  for (const p of tipPoints(side, P, digit)) if (!low || p[1] < low[1]) low = p;
  const [x, z] = spotOn(key, side, digit);
  const inside = Math.abs(low[0] - key.x) < key.d / 2 - 0.0015 && Math.abs(low[2] - key.z) < key.w / 2 - 0.0015;
  return { off: Math.hypot(low[0] - x, low[2] - z), inside, gap: low[1] - (DESK.key.top - press), at: low };
}
// A hand over the keyboard, every finger resting on its home key (or, by `keys`, another, pressed `press` down).
export function typing(side, { keys = {}, press = {} } = {}) {
  const P = { ...typingHand(side), digits: relaxed() };
  for (const d of [...FINGERS, 'thumb']) P.digits[d] = keyAngles(side, d, KEY[keys[d] || TYPE_HOME[side][d]], { press: press[d] || 0, shift: [0, 0, 0] });
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

// Where the left hand's wrist rests between words: on the desk left of the keyboard, clear of its keys.
export const REST_LEFT = [-0.11, 0, -0.27];
// A hand at rest on the desk beside the keyboard: loose, the heel of the palm and the finger tips on the desk.
export function resting(side, at) {
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
