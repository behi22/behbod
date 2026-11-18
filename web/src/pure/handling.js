import { roundBox, qFrame, qRot as rotate, norm, add, sub, scale, cross, seat, wrap, reach, digit, relaxed, FINGERS, DIGITS, rod } from './hands.js';

// How each gun is held: its shape, where the hands go, what a thumb presses; gun space (x muzzle, y up, z right).
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

// ---------- the long guns (blender/build_guns.py): the P-22's grip and guard under each receiver ----------
const longLower = (p, x0, x1) => Math.min(p22Grip(p), roundBox(p, [(x0 + x1) / 2, -0.0085, 0], [(x1 - x0) / 2, 0.0085, 0.0131], 0.002),
  Math.max(roundBox(p, [0.058, -0.035, 0], [0.03, 0.0175, 0.0085], 0.004), -roundBox(p, [0.0575, -0.0355, 0], [0.024, 0.012, 0.02], 0.002)));
const box = (p, a, b, r = 0) => roundBox(p, a.map((v, i) => (v + b[i]) / 2), a.map((v, i) => Math.abs(b[i] - v) / 2), r);

// The Vesper: its receiver, rail, handguard, the magazine well's housing and the charging handle's knob.
function vesper(p) {
  return Math.min(longLower(p, -0.062, 0.205), box(p, [0.086, -0.07, -0.0131], [0.139, 0, 0.0131], 0.002),
    box(p, [-0.068, 0, -0.019], [0.205, 0.053, 0.019], 0.003), box(p, [-0.05, 0.053, -0.0105], [0.14, 0.0595, 0.0105], 0.001),
    box(p, [0.205, -0.008, -0.023], [0.335, 0.052, 0.023], 0.008), rod(p, [0.175, 0.034, -0.019], [0.175, 0.034, -0.043], 0.0055));
}
const vesperMag = p => Math.min(box(p, [0.0915, -0.185, -0.0105], [0.1235, 0.01, 0.0105], 0.001), box(p, [0.0875, -0.196, -0.0125], [0.1275, -0.182, 0.0125], 0.0015));
// The Keeper: its receiver, the rail end to end, the handguard, the well's housing and the side charger's knob.
function keeper(p) {
  return Math.min(longLower(p, -0.075, 0.22), box(p, [0.089, -0.078, -0.0131], [0.16, 0, 0.0131], 0.002),
    box(p, [-0.078, 0, -0.0185], [0.222, 0.05, 0.0185], 0.003), box(p, [-0.072, 0.05, -0.0105], [0.48, 0.0565, 0.0105], 0.001),
    box(p, [0.222, -0.006, -0.021], [0.48, 0.05, 0.021], 0.006), rod(p, [0.005, 0.038, -0.0185], [0.005, 0.038, -0.0425], 0.006));
}
// Its curved magazine as two straight pieces, and the foot.
const keeperMag = p => Math.min(box(p, [0.096, -0.09, -0.0108], [0.153, 0.008, 0.0108], 0.001), box(p, [0.104, -0.19, -0.0108], [0.172, -0.085, 0.0108], 0.001),
  box(p, [0.12, -0.204, -0.0128], [0.186, -0.172, 0.0128], 0.002));

// The Longview: its chassis, the round receiver and its base, the rail, the slim forend under the barrel, the bolt
// body behind the receiver and its handle's knob (where they rest, closed).
function longview(p) {
  return Math.min(longLower(p, -0.09, 0.21), box(p, [0.092, -0.07, -0.0131], [0.17, 0, 0.0131], 0.002),
    box(p, [-0.05, 0, -0.016], [0.15, 0.03, 0.016], 0.002), rod(p, [-0.05, 0.034, 0], [0.15, 0.034, 0], 0.017),
    box(p, [-0.045, 0.051, -0.0105], [0.14, 0.0575, 0.0105], 0.001), box(p, [0.17, -0.014, -0.02], [0.52, 0.026, 0.02], 0.008),
    rod(p, [-0.115, 0.034, 0], [-0.05, 0.034, 0], 0.0095), rod(p, [-0.062, 0.034, 0.012], [-0.07, 0.014, 0.042], 0.0035),
    Math.hypot(p[0] + 0.072, p[1] - 0.01, p[2] - 0.046) - 0.0075);
}
const longviewMag = p => Math.min(box(p, [0.097, -0.07, -0.0115], [0.163, 0.006, 0.0115], 0.001), box(p, [0.094, -0.082, -0.0132], [0.166, -0.068, 0.0132], 0.0015));

// The Gatekeeper: its receiver and feed cover with the rail, the handguard and the barrel's shroud, the charging
// handle's knob and the belt going up into the feed port on the left.
function gatekeeper(p) {
  return Math.min(longLower(p, -0.11, 0.095), box(p, [-0.115, 0, -0.024], [0.22, 0.066, 0.024], 0.003),
    box(p, [-0.06, 0.066, -0.022], [0.16, 0.08, 0.022], 0.002), box(p, [-0.04, 0.08, -0.0105], [0.13, 0.0865, 0.0105], 0.001),
    box(p, [0.22, -0.03, -0.022], [0.45, 0.02, 0.022], 0.006), rod(p, [0.22, 0.042, 0], [0.47, 0.042, 0], 0.024),
    rod(p, [0.205, 0.016, -0.024], [0.205, 0.016, -0.042], 0.006), box(p, [0.115, -0.005, -0.042], [0.165, 0.052, -0.024], 0.002));
}
const gatekeeperBox = p => box(p, [0.105, -0.125, -0.05], [0.205, -0.005, 0.02], 0.004);

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
  // The long guns' right hands are the pistol's on the same grip; the free hand holds the handguard (fore), cups a
  // magazine, and works what the gun has (extra), each by its fingers' way, the back of the hand, a knuckle and the thumb.
  smg: {
    shape: vesper, mag: vesperMag,
    trigger: { pin: [0.051, -0.0155, 0], pad: [0.0645, -0.0335, -0.0015], pull: 0.24 },
    thumbs: { right: [0.004, -0.019, -0.0248] }, release: [0.0295, -0.0275, -0.0249], straight: [0.079, -0.0118, 0.0212],
    right: { back: 6, droop: -12, knuckle: [0.0062, -0.065, 0.029] },
    fore: { fingers: [0.3, 0.15, 1], back: [0, -1, 0.15], knuckle: [0.262, -0.014, 0.016], thumb: [0.285, 0.036, -0.027] },
    cup: { fingers: [1, 0, 0], back: [0, 0, -1], knuckle: [0.118, -0.135, -0.016], thumb: [0.091, -0.118, -0.006] },
    // The knob in the palm from the left, the hand's web pushing it back; the forearm comes from below.
    extra: { charge: { fingers: [1, 0.35, 0], back: [0, 0, -1], knuckle: [0.207, 0.05, -0.05], thumb: [0.163, 0.022, -0.04] } },
  },
  rifle: {
    shape: keeper, mag: keeperMag,
    trigger: { pin: [0.051, -0.0155, 0], pad: [0.0645, -0.0335, -0.0015], pull: 0.24 },
    thumbs: { right: [0.004, -0.019, -0.0248] }, release: [0.0295, -0.0275, -0.0249], straight: [0.079, -0.0118, 0.0212],
    right: { back: 6, droop: -12, knuckle: [0.0062, -0.065, 0.029] },
    fore: { fingers: [0.3, 0.15, 1], back: [0, -1, 0.15], knuckle: [0.36, -0.012, 0.014], thumb: [0.385, 0.034, -0.025] },
    cup: { fingers: [1, -0.15, 0], back: [0, 0, -1], knuckle: [0.162, -0.13, -0.016], thumb: [0.108, -0.115, -0.006] },
    // As on the Vesper: the knob in the palm from the left, the forearm from below.
    extra: { charge: { fingers: [1, 0.35, 0], back: [0, 0, -1], knuckle: [0.037, 0.054, -0.051], thumb: [-0.007, 0.026, -0.044] } },
  },
  sniper: {
    shape: longview, mag: longviewMag,
    trigger: { pin: [0.051, -0.0155, 0], pad: [0.0645, -0.0335, -0.0015], pull: 0.24 },
    thumbs: { right: [0.004, -0.019, -0.0248] }, release: [0.0295, -0.0275, -0.0249], straight: [0.079, -0.0118, 0.0212],
    right: { back: 6, droop: -12, knuckle: [0.0062, -0.065, 0.029] },
    fore: { fingers: [0.3, 0.15, 1], back: [0, -1, 0.15], knuckle: [0.4, -0.02, 0.012], thumb: [0.425, 0.02, -0.023] },
    // The short magazine is held only out of the gun, so the hand is fitted to it alone.
    cup: { fingers: [1, 0, 0], back: [0, 0, -1], knuckle: [0.158, -0.05, -0.018], thumb: [0.096, -0.04, -0.008], alone: true },
    // The right hand off the grip, the bolt's knob in its palm from outside, fingers over the bolt.
    rightExtra: { bolt: { fingers: [1, 0.35, 0], back: [0, 0, 1], knuckle: [-0.042, 0.03, 0.062], thumb: [-0.088, 0.0, 0.05] } },
  },
  lmg: {
    shape: gatekeeper, mag: gatekeeperBox,
    trigger: { pin: [0.051, -0.0155, 0], pad: [0.0645, -0.0335, -0.0015], pull: 0.24 },
    thumbs: { right: [0.004, -0.019, -0.0248] }, straight: [0.079, -0.0118, 0.0212],
    right: { back: 6, droop: -12, knuckle: [0.0062, -0.065, 0.029] },
    fore: { fingers: [0.3, 0.15, 1], back: [0, -1, 0.15], knuckle: [0.33, -0.036, 0.015], thumb: [0.355, 0.012, -0.025] },
    // The box held by its left face, fingers round its front; it is only carried off the gun.
    cup: { fingers: [1, 0, 0], back: [0, 0, -1], knuckle: [0.196, -0.068, -0.058], thumb: [0.13, -0.012, -0.054], alone: true, gap: 0.0025 },
    extra: {
      // From the left, fingers up over the feed cover's edge to lift it and press it shut; the forearm stays low and
      // out of the view (from above, a hand this near the eye hid the whole picture).
      cover: { fingers: [0, 1, 0], back: [0, 0, -1], knuckle: [0.005, 0.066, -0.031], thumb: [0.04, 0.03, -0.034] },
      // Pressing the belt's end into the feed port from the left.
      belt: { fingers: [1, 0.35, 0], back: [0, 0, -1], knuckle: [0.172, 0.045, -0.054], thumb: [0.12, 0.02, -0.046] },
      charge: { fingers: [1, 0.35, 0], back: [0, 0, -1], knuckle: [0.237, 0.032, -0.05], thumb: [0.193, 0.004, -0.044] },
    },
  },
};
// Where the free hand waits out of sight, and where each forearm hangs from: the eye's axes (x right, y up, -z ahead).
export const LOW = { at: [-0.17, -0.4, -0.2], fingers: [0.1, 0.55, -1], back: [-1, 0.1, 0] };
export const ELBOWS = { right: [0.17, -0.5, -0.06], left: [-0.17, -0.5, -0.08] };

// The back of the hand faces out from the grip, turned back by `back` degrees and tipped down by `droop`.
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
  // A hand hooking something small (a charging handle's knob) is placed where its knuckle is put, with nothing to rest on.
  return set.seat === false ? pose : seat(side, pose, shape, scale(rotate(q, [0, 1, 0]), -1), { gap: set.gap ?? 0.0008 });
}

// Signed distance to a posed hand's fingers, so the other hand can wrap round them.
export function fingersShape(side, pose) {
  const bones = [];
  for (const d of DIGITS) { const { pts, r } = digit(side, d, pose.digits[d]); for (let b = 0; b < 3; b++) bones.push([pts[b], pts[b + 1], (r[b] + r[b + 1]) / 2]); }
  const world = bones.map(([a, b, r]) => [add(pose.at, rotate(pose.q, a)), add(pose.at, rotate(pose.q, b)), r]);
  return p => { let d = Infinity; for (const [a, b, r] of world) d = Math.min(d, rod(p, a, b, r)); return d; };
}

// Every pose a gun's clips ask for, both hands, solved ahead of time by blender/holds.js.
export function solveHolds(gunId) {
  const H = GUN_HOLDS[gunId];
  if (!H) return null;
  const right = solveRight(H), { left, both, magged } = solveLeft(H, right.grip);
  return { right, left, shape: H.shape, both, magged };
}

// The right hand: three fingers round the grip, the first on the trigger (or pulled, or straight), the thumb resting or pressing.
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
  if (H.release) right.release = { ...right.straight, digits: { ...right.straight.digits, thumb: reach('right', 'thumb', R, H.release, { from: thumbR, sdf: null }) } };
  if (H.stop) right.stop = { ...right.straight, digits: { ...right.straight.digits, thumb: reach('right', 'thumb', R, H.stop, { from: thumbR, sdf: null }) } };
  for (const [name, set] of Object.entries(H.rightExtra || {})) right[name] = grasp('right', set, shape);
  return right;
}

// A hand placed by its own frame, its fingers closed round the shape and its thumb on a point.
function grasp(side, set, shape) {
  const P = place(side, set, shape);
  for (const d of FINGERS) P.digits[d] = wrap(side, d, P, shape, { from: [0, -0.1, 0, 0] });
  P.digits.thumb = reach(side, 'thumb', P, set.thumb, { from: [0, 0.3, 0.3, 0.2], sdf: shape });
  return P;
}

// The free hand: closed over the right hand's fingers, cupping a fresh magazine, and over the slide; on a long gun,
// round the handguard, cupping a magazine and on whatever else the gun has.
export function solveLeft(H, R) {
  if (H.fore) {
    const magged = H.cup.alone ? H.mag : p => Math.min(H.mag(p), H.shape(p)), left = { grip: grasp('left', H.fore, H.shape), mag: grasp('left', H.cup, magged) };
    for (const [name, set] of Object.entries(H.extra || {})) left[name] = grasp('left', set, H.shape);
    return { left, both: H.shape, magged };
  }
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
