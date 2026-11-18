import { roundBox, qFrame, qRot as rotate, norm, add, sub, scale, cross, seat, wrap, reach, digit, relaxed, FINGERS, DIGITS, rod } from './hands.js';

// How each gun is held: its shape as the hands feel it, where the hands go on it, and the places a thumb or a
// finger presses. The view solves the hands' poses from this once, when the gun is loaded. Every place is in the
// gun's own space with three's axes (x to the muzzle, y up, z to the shooter's right), the gun file's own.
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---------- the P-22 (blender/build_guns.py: the same lines, turned into three's axes) ----------
const front = y => Math.min(0.027 + (y + 0.05) * 0.353, 0.0285);
const back = y => -0.022 + (y + 0.018) * 0.25 - 0.0035 * Math.sin(Math.PI * clamp((-y - 0.035) / 0.08, 0, 1));
const width = y => { const u = clamp((-y - 0.022) / 0.09, 0, 1); return 0.0131 + 0.0014 * Math.min(1, u / 0.3) + 0.0011 * Math.sin(Math.PI * u); };
// The grip as a stack of rounded sections down its slant, ending at the magazine's foot.
function p22Grip(p) {
  const y = clamp(p[1], -0.112, -0.022), f = front(y), b = back(y), hx = (f - b) / 2, hz = width(y), r = 0.5 * Math.min(hx, hz);
  const qx = Math.abs(p[0] - (f + b) / 2) - hx + r, qz = Math.abs(p[2]) - hz + r;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
  return Math.max(d, -0.1235 - p[1], p[1]);
}
function p22(p) {
  const frame = roundBox(p, [0.06, -0.0085, 0], [0.0935, 0.0085, 0.0131], 0.002);
  const slide = roundBox(p, [0.065, 0.01375, 0], [0.093, 0.01375, 0.013], 0.003);
  const guard = Math.max(roundBox(p, [0.058, -0.035, 0], [0.03, 0.0175, 0.0085], 0.004), -roundBox(p, [0.0575, -0.0355, 0], [0.024, 0.012, 0.02], 0.002));
  return Math.min(p22Grip(p), frame, slide, guard);
}
// The magazine where it sits when home: its body up the well and its wider foot.
function p22Mag(p) {
  const y = clamp(p[1], -0.1125, -0.0105), f = front(y);
  const body = Math.max(Math.abs(p[0] - (f - 0.02175)) - 0.01675, Math.abs(p[2]) - 0.00525, -0.1125 - p[1], p[1] + 0.0105);
  const foot = roundBox(p, [front(-0.1175) - 0.021, -0.1175, 0], [0.0235, 0.005, 0.0071], 0.003);
  return Math.min(body, foot);
}

// The grip's line, down toward the foot, and the way back square to it.
const DOWN = norm([-0.333, -0.943, 0]), AFT = norm([-0.943, 0.333, 0]);
const turned = (a, deg) => { const t = deg * Math.PI / 180; return add(scale(a.u, Math.cos(t)), scale(a.v, Math.sin(t))); };

export const GUN_HOLDS = {
  pistol: {
    shape: p22, mag: p22Mag,
    // The trigger turns about this pin; the pad of the trigger finger sits here on its face.
    trigger: { pin: [0.051, -0.0155, 0], pad: [0.0645, -0.0335, -0.0015], pull: 0.24 },
    // Where the thumbs rest and press (the middle of the thumb's tip).
    thumbs: { right: [0.004, -0.019, -0.0248], left: [0.068, -0.0125, -0.0228] },
    release: [0.0295, -0.0275, -0.0249], stop: [0.0055, 0.0098, -0.0175],
    // The trigger finger off the trigger, laid along the frame (a reload, an inspect).
    straight: [0.079, -0.0118, 0.0212],
    // The hands, each by the turn of its back away from the grip's side and a point its middle knuckle aims for.
    right: { back: 6, droop: -12, knuckle: [0.0062, -0.065, 0.029] },
    left: { back: 30, droop: 0, knuckle: [0.04, -0.075, -0.04] },
    // The free hand cupping a fresh magazine's foot (palm up the well), and over the slide's back end to pull it.
    cup: { fingers: [0.943, -0.333, 0], back: DOWN, knuckle: [0.02, -0.12, 0.002], thumb: [-0.015, -0.108, -0.0149] },
    over: { fingers: [0, 0, 1], back: [0, 1, 0], knuckle: [0.004, 0.031, 0.019], thumb: [-0.016, 0.012, -0.0218] },
  },
};
// Where the free hand waits out of sight, and where each forearm hangs from: the eye's axes (x right, y up, -z ahead).
export const LOW = { at: [-0.17, -0.4, -0.2], fingers: [0.1, 0.55, -1], back: [-1, 0.1, 0] };
export const ELBOWS = { right: [0.17, -0.5, -0.06], left: [-0.17, -0.5, -0.08] };

// A hand's turn from its settings: the back of the hand faces out from the grip's side, turned toward the back of
// the gun by `back` degrees, the fingers tipped down by `droop`.
function gripTurn(side, set) {
  const out = side === 'right' ? [0, 0, 1] : [0, 0, -1];
  const backv = turned({ u: out, v: AFT }, set.back);
  // The little finger's side runs down the grip: z for a right hand, -z for a left.
  const along = side === 'right' ? DOWN : scale(DOWN, -1);
  let fingers = cross(backv, along);
  const t = set.droop * Math.PI / 180, down = side === 'right' ? along : scale(along, -1);
  fingers = norm(add(scale(fingers, Math.cos(t)), scale(down, Math.sin(t))));
  return qFrame(fingers, backv);
}

// Places a hand: its turn, its middle knuckle on the aim point, then pressed in until the palm meets the shape.
function place(side, set, shape) {
  const q = set.fingers ? qFrame(set.fingers, set.back) : gripTurn(side, set), knuckle = rotate(q, digit(side, 'middle', [0, 0, 0, 0]).pts[0]);
  const pose = { at: sub(set.knuckle, knuckle), q, digits: relaxed() };
  return seat(side, pose, shape, scale(rotate(q, [0, 1, 0]), -1), { gap: 0.0008 });
}

// Signed distance to a posed hand's fingers, so the other hand can wrap round them.
export function fingersShape(side, pose) {
  const bones = [];
  for (const d of DIGITS) { const { pts, r } = digit(side, d, pose.digits[d]); for (let b = 0; b < 3; b++) bones.push([pts[b], pts[b + 1], (r[b] + r[b + 1]) / 2]); }
  const world = bones.map(([a, b, r]) => [add(pose.at, rotate(pose.q, a)), add(pose.at, rotate(pose.q, b)), r]);
  return p => { let d = Infinity; for (const [a, b, r] of world) d = Math.min(d, rod(p, a, b, r)); return d; };
}

// Every pose a gun's clips ask for, solved once: the right hand on the grip with its finger on the trigger, pulled,
// straight, and its thumb resting or pressing; the left hand wrapped over it, cupping a magazine, and over the slide.
export function solveHolds(gunId) {
  const H = GUN_HOLDS[gunId];
  if (!H) return null;
  const right = solveRight(H), { left, both, magged } = solveLeft(H, right.grip);
  return { right, left, shape: H.shape, both, magged };
}

// The right hand on the grip: three fingers closed round it, the first on the trigger (or pulled, or laid straight),
// the thumb resting, or pressing the magazine release or the slide stop.
export function solveRight(H) {
  const shape = H.shape;
  let R = place('right', H.right, shape);
  for (const d of ['middle', 'ring', 'pinky']) R.digits[d] = wrap('right', d, R, shape, { from: [0, -0.1, 0, 0] });
  const thumbR = reach('right', 'thumb', R, H.thumbs.right, { from: [0, 0.3, 0.3, 0.2], sdf: shape });
  const onTrigger = reach('right', 'index', R, H.trigger.pad, { from: [0, 0.6, 0.9, 0.6], sdf: shape });
  R = { ...R, digits: { ...R.digits, index: onTrigger, thumb: thumbR } };
  const right = {
    grip: R,
    // Pulled: the finger's last two joints close a little more, taking the pad back with the trigger.
    pull: { ...R, digits: { ...R.digits, index: [onTrigger[0], onTrigger[1] + 0.02, onTrigger[2] + 0.08, onTrigger[3] + 0.06] } },
    straight: { ...R, digits: { ...R.digits, index: reach('right', 'index', R, H.straight, { from: [0, 0.1, 0.1, 0.05], sdf: shape }) } },
  };
  right.release = { ...right.straight, digits: { ...right.straight.digits, thumb: reach('right', 'thumb', R, H.release, { from: thumbR, sdf: null }) } };
  right.stop = { ...right.straight, digits: { ...right.straight.digits, thumb: reach('right', 'thumb', R, H.stop, { from: thumbR, sdf: null }) } };
  return right;
}

// The free hand: closed over the right hand's fingers, cupping a fresh magazine, and over the slide.
export function solveLeft(H, R) {
  const shape = H.shape, over = fingersShape('right', R), both = p => Math.min(shape(p), over(p));
  const L = place('left', H.left, both);
  for (const d of FINGERS) L.digits[d] = wrap('left', d, L, both, { from: [0, -0.1, 0, 0] });
  L.digits.thumb = reach('left', 'thumb', L, H.thumbs.left, { from: [0, 0.3, 0.3, 0.2], sdf: both });
  // Cupping a magazine: solved against it sitting home, so the fingers stop where the grip begins.
  const magged = p => Math.min(H.mag(p), shape(p)), C = place('left', H.cup, magged);
  for (const d of FINGERS) C.digits[d] = wrap('left', d, C, magged, { from: [0, -0.1, 0, 0] });
  C.digits.thumb = reach('left', 'thumb', C, H.cup.thumb, { from: [0, 0.3, 0.3, 0.2], sdf: magged });
  // Over the slide: open on the way in and out, closed on it.
  const P = place('left', H.over, shape);
  for (const d of FINGERS) P.digits[d] = wrap('left', d, P, shape, { from: [0, -0.1, 0, 0] });
  P.digits.thumb = reach('left', 'thumb', P, H.over.thumb, { from: [0, 0.3, 0.3, 0.2], sdf: shape });
  const left = {
    grip: L, mag: C, pinch: P,
    over: { ...P, at: add(P.at, [0, 0.014, 0]), digits: { ...relaxed(), thumb: [0, -0.1, 0.1, 0.1, 0] } },
  };
  return { left, both, magged };
}

// The poses alone, as plain numbers, for blender/holds.js to write into web/src/range/holds.js.
export function bake(holds) {
  const r = x => Math.round(x * 1e6) / 1e6, pose = p => ({ at: p.at.map(r), q: p.q.map(r), digits: Object.fromEntries(Object.entries(p.digits).map(([d, a]) => [d, a.map(r)])) });
  const side = set => Object.fromEntries(Object.entries(set).map(([name, p]) => [name, pose(p)]));
  return { right: side(holds.right), left: side(holds.left) };
}

// Where the trigger's pad is with the trigger pulled k of the way.
export function rotTrigger(T, k) {
  const a = -T.pull * k, c = Math.cos(a), s = Math.sin(a), dx = T.pad[0] - T.pin[0], dy = T.pad[1] - T.pin[1];
  return [T.pin[0] + dx * c - dy * s, T.pin[1] + dx * s + dy * c, T.pad[2]];
}
