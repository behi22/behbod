// The realistic hand's math: its bones from MakeHuman's joints (pure/handrig.js), poses as joint angles held to a grown
// man's range, and fitting it round things (a pad onto a point, fingers closed onto a shape, the palm onto a surface),
// checked against points spread over its whole skin, so no finger goes into what it holds.
// Hand space, for a right hand: x from the wrist to the middle knuckle, y out of the back, z toward the little finger.
// A left hand is its mirror image across z: it is solved as a right hand on the mirrored shape and mirrored back.
// A pose: { at, q } places the hand (its wrist and turn) in the space of what it holds; digits holds each digit's angles:
// a finger's [spread, knuckle, middle, end] from straight along its palm bone, a thumb's [out, across, knuckle, end,
// roll] from its rest; cup closes the palm's little-finger side round a grip.
import { BONES, JOINTS, NAILS, PADS, PALM, POINTS } from './handrig.js';
import { qAxis, qMul, qConj, qRot, qFrame, qSlerp, add, sub, scale, dot, len, norm, lerp, rod } from './hands.js';

export { BONES };
export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
export const DIGITS = [...FINGERS, 'thumb'];
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], ID = [0, 0, 0, 1];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const N = { thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5 };
const J = (d, k) => JOINTS[`finger-${N[d]}-${k}`];
const META = { index: 'hand-3', middle: 'hand-3', ring: 'hand-2', pinky: 'hand-2' };
// How much each palm bone turns as the palm cups: the little finger's most, the ring's half.
const CUP = { index: 0, middle: 0, ring: 0.5, pinky: 1 };
const turn = (s, f) => qMul(qAxis(Y, s), qAxis(Z, -f));
// The angles that turn x onto u (a bone's way in its parent's axes): out round y, then down round z.
const anglesOf = u => [Math.atan2(-u[2], u[0]), Math.asin(clamp(-u[1], -1, 1))];
export const bi = name => BONES.indexOf(name);

// ---------- the bones at rest, from the joints ----------
const R = {};
for (const d of FINGERS) {
  const base = JOINTS[META[d]], k1 = J(d, 1), k2 = J(d, 2), k3 = J(d, 3), tip = J(d, 4);
  const meta = qFrame(sub(k1, base), NAILS[d]);
  const [s1, f1] = anglesOf(qRot(qConj(meta), norm(sub(k2, k1)))), q1 = qMul(meta, turn(s1, f1));
  const [s2, f2] = anglesOf(qRot(qConj(q1), norm(sub(k3, k2)))), q2 = qMul(q1, turn(s2, f2));
  const [s3, f3] = anglesOf(qRot(qConj(q2), norm(sub(tip, k3))));
  R[d] = { base, meta, len: [len(sub(k1, base)), len(sub(k2, k1)), len(sub(k3, k2)), len(sub(tip, k3))], splay: [s2, s3], rest: [s1, f1, f2, f3] };
}
{
  const t1 = J('thumb', 1), t2 = J('thumb', 2), t3 = J('thumb', 3), tip = J('thumb', 4);
  const first = qFrame(sub(t2, t1), NAILS.thumb);
  const [s2, f2] = anglesOf(qRot(qConj(first), norm(sub(t3, t2)))), q2 = qMul(first, turn(s2, f2));
  const [s3, f3] = anglesOf(qRot(qConj(q2), norm(sub(tip, t3))));
  R.thumb = { base: t1, first, len: [len(sub(t2, t1)), len(sub(t3, t2)), len(sub(tip, t3))], splay: [s2, s3], bend: [f2, f3] };
}
const ARM = qFrame(sub(JOINTS.elbow, JOINTS.hand), Y);

// Each digit at rest, and the reach of a grown man's joints. A finger's spread is limited round where it rests.
export const REST = Object.freeze({ ...Object.fromEntries(FINGERS.map(d => [d, R[d].rest.slice()])), thumb: [0, 0, 0, 0, 0] });
const SPREAD = { index: 0.45, middle: 0.25, ring: 0.3, pinky: 0.5 }, MCP = { index: 1.6, middle: 1.6, ring: 1.65, pinky: 1.7 };
export const LIMITS = Object.freeze({
  ...Object.fromEntries(FINGERS.map(d => [d, { lo: [R[d].rest[0] - SPREAD[d], -0.35, 0, -0.08], hi: [R[d].rest[0] + SPREAD[d], MCP[d], 1.9, 1.4] }])),
  // The thumb from its rest: out from the palm and back, across it and away, its knuckle and end joints from how they
  // rest to their own limits, and a little roll.
  thumb: { lo: [-0.6, -0.5, -0.25 - R.thumb.bend[0], -0.25 - R.thumb.bend[1], -0.7], hi: [0.9, 1.1, 1.0 - R.thumb.bend[0], 1.4 - R.thumb.bend[1], 0.7] },
});
// Each digit's angles held to its limits.
export const within = (d, a) => a.map((v, i) => clamp(v, LIMITS[d].lo[i], LIMITS[d].hi[i]));
export const rest = () => ({ at: [0, 0, 0], q: ID.slice(), digits: Object.fromEntries(DIGITS.map(d => [d, REST[d].slice()])), cup: 0 });
// A hand hanging loose: a little more curl than at rest, each finger a touch more than the one before.
export function relaxed() {
  const out = {};
  FINGERS.forEach((d, i) => { const r = R[d].rest; out[d] = [r[0], 0.3 + 0.06 * i, 0.45 + 0.07 * i, 0.3 + 0.04 * i]; });
  out.thumb = [0.05, 0.1, 0.1, 0.15, 0];
  return out;
}

// ---------- a posed right hand's bones, as places and turns in the pose's space ----------
// Each bone's turn against its parent and its place in it, the way three's bones take them; `elbow` aims the forearm.
export function locals(pose, elbow = null) {
  const out = new Array(BONES.length), q = pose.q, cup = pose.cup || 0;
  const arm = elbow ? qFrame(sub(elbow, pose.at), qRot(q, Y)) : qMul(q, ARM);
  out[bi('arm')] = { p: pose.at, q: arm };
  out[bi('hand')] = { p: [0, 0, 0], q: qMul(qConj(arm), q) };
  for (const d of FINGERS) {
    const r = R[d], a = pose.digits[d];
    out[bi(d + '0')] = { p: r.base, q: qMul(qAxis(X, cup * CUP[d]), r.meta) };
    out[bi(d + '1')] = { p: [r.len[0], 0, 0], q: turn(a[0], a[1]) };
    out[bi(d + '2')] = { p: [r.len[1], 0, 0], q: turn(r.splay[0], a[2]) };
    out[bi(d + '3')] = { p: [r.len[2], 0, 0], q: turn(r.splay[1], a[3]) };
  }
  const t = R.thumb, a = pose.digits.thumb;
  out[bi('thumb1')] = { p: t.base, q: qMul(qMul(t.first, turn(a[0], a[1])), qAxis(X, a[4] || 0)) };
  out[bi('thumb2')] = { p: [t.len[0], 0, 0], q: turn(t.splay[0], t.bend[0] + a[2]) };
  out[bi('thumb3')] = { p: [t.len[1], 0, 0], q: turn(t.splay[1], t.bend[1] + a[3]) };
  return out;
}
const PARENT = BONES.map(b => (b === 'arm' ? -1 : b === 'hand' ? bi('arm') : /0$|thumb1/.test(b) ? bi('hand') : bi(b.replace(/\d$/, n => String(+n - 1)))));
// Every bone's place and turn in the pose's space.
export function world(pose, elbow = null) {
  const L = locals(pose, elbow), out = new Array(BONES.length);
  for (let i = 0; i < BONES.length; i++) {
    const par = PARENT[i];
    out[i] = par < 0 ? { p: L[i].p, q: L[i].q } : { p: add(out[par].p, qRot(out[par].q, L[i].p)), q: qMul(out[par].q, L[i].q) };
  }
  return out;
}
const REST_WORLD = world(rest(), JOINTS.elbow);
const toLocal = (b, p) => qRot(qConj(REST_WORLD[b].q), sub(p, REST_WORLD[b].p));
const fromLocal = (f, l) => add(f.p, qRot(f.q, l));

// ---------- points on the skin, each carried by its two strongest bones ----------
const PTS = [];
for (let i = 0; i < POINTS.w.length; i++) {
  const p = POINTS.p.slice(i * 3, i * 3 + 3), j0 = POINTS.j[i * 2], j1 = POINTS.j[i * 2 + 1];
  PTS.push({ j0, j1, w: POINTS.w[i], l0: toLocal(j0, p), l1: toLocal(j1, p), rest: p });
}
const skin = (F, s) => (s.w >= 0.999 ? fromLocal(F[s.j0], s.l0) : add(scale(fromLocal(F[s.j0], s.l0), s.w), scale(fromLocal(F[s.j1], s.l1), 1 - s.w)));
// Which points move with each joint of each digit: those carried at all by that joint's bone or one past it.
const CHAIN = d => (d === 'thumb' ? ['thumb1', 'thumb2', 'thumb3'] : [d + '1', d + '2', d + '3']).map(bi);
const MOVED = Object.fromEntries(DIGITS.map(d => {
  const c = CHAIN(d);
  return [d, [0, 1, 2].map(k => PTS.filter(s => c.slice(k).includes(s.j0) || (s.w < 0.999 && c.slice(k).includes(s.j1))))];
}));
// The pad of each digit's end bone, and the points over the palm, each on the bone that carries it.
const PAD = Object.fromEntries(DIGITS.map(d => [d, toLocal(CHAIN(d)[2], PADS[d])]));
const PALM_PTS = PALM.map(p => toLocal(bi('hand'), p));
// A right hand's pad in its digit's end bone's own axes (where a check finds it on the bones in the page).
export const padLocal = d => PAD[d].slice();

// Where each digit's pad is, and every skin point, for a posed right hand.
export const padAt = (pose, d, F = world(pose)) => fromLocal(F[CHAIN(d)[2]], PAD[d]);
export const skinPoints = (pose, F = world(pose)) => PTS.map(s => skin(F, s));

// ---------- the mirror: a left hand is a right hand in a world turned inside out across z ----------
const mz = p => [p[0], p[1], -p[2]], mq = q => [-q[0], -q[1], q[2], q[3]];
export const mirrorPose = pose => ({ ...pose, at: mz(pose.at), q: mq(pose.q) });
const asRight = (side, sdf) => (side === 'left' ? p => sdf(mz(p)) : sdf);
const flip = (side, p) => (side === 'left' ? mz(p) : p);
// A posed hand's bones (local and world) for either side.
export function localsFor(side, pose, elbow = null) {
  if (side !== 'left') return locals(pose, elbow);
  return locals(mirrorPose(pose), elbow && mz(elbow)).map(b => ({ p: mz(b.p), q: mq(b.q) }));
}
export function worldFor(side, pose, elbow = null) {
  if (side !== 'left') return world(pose, elbow);
  return world(mirrorPose(pose), elbow && mz(elbow)).map(b => ({ p: mz(b.p), q: mq(b.q) }));
}
export const padFor = (side, pose, d) => flip(side, padAt(side === 'left' ? mirrorPose(pose) : pose, d));

// ---------- the wrist ----------
// The forearm's way from the wrist in the hand's own axes, the wrist relaxed.
const FOREARM = norm(JOINTS.elbow);
const slope = (v, k) => Math.atan2(v[k], -v[0]);
// How a wrist is bent, the forearm running toward `elbow` (radians): flex, the palm bent toward the forearm (less than
// none is the back bent toward it); radial, the hand bent toward the thumb (less than none, toward the little finger).
export function wrist(side, pose, elbow) {
  const P = side === 'left' ? mirrorPose(pose) : pose, e = qRot(qConj(P.q), norm(sub(flip(side, elbow), P.at)));
  return { flex: slope(FOREARM, 1) - slope(e, 1), radial: slope(FOREARM, 2) - slope(e, 2) };
}
// How far a relaxed wrist goes each way without strain (radians): the palm bent in a little, the back bent in more,
// toward the thumb a little, toward the little finger more.
export const WRIST = { flex: 0.35, extend: 0.7, radial: 0.21, ulnar: 0.52 };
// Where the forearm runs: toward `elbow` as far as the wrist goes without strain, so no wrist ever looks broken.
export function forearm(side, pose, elbow) {
  const b = wrist(side, pose, elbow), u = b.flex / (b.flex > 0 ? WRIST.flex : WRIST.extend), v = b.radial / (b.radial > 0 ? WRIST.radial : WRIST.ulnar);
  const k = Math.hypot(u, v);
  if (k <= 1) return elbow;
  const P = side === 'left' ? mirrorPose(pose) : pose, d = len(sub(elbow, pose.at));
  const e = norm([-1, Math.tan(slope(FOREARM, 1) - b.flex / k), Math.tan(slope(FOREARM, 2) - b.radial / k)]);
  return flip(side, add(P.at, scale(qRot(P.q, e), d)));
}

// ---------- fitting ----------
const deepestOf = (list, F, sdf) => { let m = Infinity; for (const s of list) m = Math.min(m, sdf(skin(F, s))); return m; };
// How deep any point of the posed hand goes into a shape (negative is into it), all of it or some digits only.
export function deepest(side, pose, sdf, digits = null) {
  const P = side === 'left' ? mirrorPose(pose) : pose, S = asRight(side, sdf), F = world(P);
  const list = digits ? [...new Set(digits.flatMap(d => MOVED[d][0]))] : PTS;
  return deepestOf(list, F, S);
}

// The palm's points on a posed hand: how near the palm is to a shape (negative is into it).
export function palmGap(side, pose, sdf) {
  const F = worldFor(side, pose);
  return Math.min(...PALM_PTS.map(l => sdf(flipBack(side, F, l))));
}
// How deep the hand's body (not its digits) goes into a shape.
const BODY = PTS.filter(s => /^(hand|arm|index0|middle0|ring0|pinky0)$/.test(BONES[s.j0]));
export function deepestBody(side, pose, sdf) {
  const P = side === 'left' ? mirrorPose(pose) : pose;
  return deepestOf(BODY, world(P), asRight(side, sdf));
}

// Curls a digit round a shape the way a hand closes: every joint bends together, the knuckle a little ahead of the
// others, and each stops the moment bending it further would press what it carries into the shape; the steps get finer
// until nothing more can bend, so each bone ends up resting on the shape. A finger on nothing curls right in.
const RATE = [0, 1, 0.9, 0.7];
export function wrap(side, d, pose, sdf, { from = null, joints = [1, 2, 3], squash = 0.0006 } = {}) {
  const P = side === 'left' ? mirrorPose(pose) : pose, S = asRight(side, sdf), L = LIMITS[d];
  let a = (from || P.digits[d]).slice();
  const sunk = (b, k) => deepestOf(MOVED[d][k], world({ ...P, digits: { ...P.digits, [d]: b } }), S) < -squash;
  for (let step = 0.12; step > 0.003; step /= 2) {
    for (let moved = true; moved;) {
      moved = false;
      for (const j of joints) {
        if (a[j] >= L.hi[j]) continue;
        const b = a.slice(); b[j] = Math.min(L.hi[j], a[j] + step * RATE[j]);
        if (!sunk(b, j - 1)) { a = b; moved = true; }
      }
    }
  }
  return a;
}

// The angles that put a digit's pad on a point, kept out of `sdf`, found by a small sure search started at `from`.
// A finger's end joint follows its middle one (`follow`); a thumb's end follows its knuckle.
export function reach(side, d, pose, target, { from = null, follow = d === 'thumb' ? 0.8 : 0.7, sdf = null, keep = 0.0008, sweep = true } = {}) {
  const P = side === 'left' ? mirrorPose(pose) : pose, S = sdf && asRight(side, sdf), T = flip(side, target), L = LIMITS[d], thumb = d === 'thumb';
  const free = thumb ? [0, 1, 2, 4] : [0, 1, 2], start = (from || P.digits[d]).slice();
  const angles = x => { const a = x.slice(); a[3] = clamp(x[2] * follow, L.lo[3], L.hi[3]); return a; };
  const cost = x => {
    const a = angles(x), D = { ...P.digits, [d]: a }, F = world({ ...P, digits: D }), e = sub(padAt(P, d, F), T);
    let c = dot(e, e) + 1e-7 * free.reduce((s, i) => s + (x[i] - start[i]) ** 2, 0);
    if (S) { const m = deepestOf(MOVED[d][0], F, S) - keep; if (m < 0) c += m * m * 2e4; }
    return c;
  };
  const search = x => {
    let fx = cost(x), step = 0.25;
    while (step > 2e-4) {
      let moved = false;
      for (const i of free) for (const dir of [1, -1]) {
        const y = x.slice(); y[i] = clamp(y[i] + dir * step, L.lo[i], L.hi[i]);
        const fy = cost(y);
        if (fy < fx - 1e-14) { x = y; fx = fy; moved = true; }
      }
      if (!moved) step /= 2;
    }
    return [x, fx];
  };
  const starts = [start.slice()];
  if (S && sweep) starts.push(...(thumb ? [[0.3, 0.2, 0], [-0.3, 0.3, 0.4], [0.2, -0.2, -0.3], [0.5, 0.6, 0.5]] : [[0, 0.3, 0.2], [0, -0.2, -0.2], [0.15, -0.3, 0.9], [0.25, 0, 1.2]]).map(k => {
    const s = start.slice(); s[0] = clamp(s[0] + k[0], L.lo[0], L.hi[0]); s[1] = clamp(s[1] + k[1], L.lo[1], L.hi[1]); if (thumb) s[4] = clamp(s[4] + k[2], L.lo[4], L.hi[4]); else s[2] = clamp(s[2] + k[2], L.lo[2], L.hi[2]); return s;
  }));
  // Round anything in the way: the best of a coarse sweep through the digit's whole range is one more start.
  if (S && sweep) {
    const n = thumb ? 6 : 9, grid = [];
    const axis = i => Array.from({ length: n }, (_, k) => L.lo[i] + (L.hi[i] - L.lo[i]) * k / (n - 1));
    const walk = (k, x) => { if (k === free.length) { grid.push([x.slice(), cost(x)]); return; } for (const v of axis(free[k])) { x[free[k]] = v; walk(k + 1, x); } };
    walk(0, start.slice());
    grid.sort((a, b) => a[1] - b[1]);
    starts.push(grid[0][0], grid[1][0]);
  }
  let best = null;
  for (const x of starts) { const r = search(x); if (!best || r[1] < best[1]) best = r; }
  return angles(best[0]);
}
// How far a digit's pad is from a point.
export const miss = (side, pose, d, target) => len(sub(padFor(side, pose, d), target));

// Moves a hand along `dir` until its palm rests on the shape, `gap` off it: from `range` back it comes in until the
// palm first touches; if it never does, it stops where it came nearest.
export function seat(side, pose, sdf, dir, { gap = 0.0006, range = 0.06 } = {}) {
  const n = norm(dir);
  const near = k => { const at = add(pose.at, scale(n, k)), F = worldFor(side, { ...pose, at }); return Math.min(...PALM_PTS.map(l => sdf(flipBack(side, F, l)))); };
  let prev = -range, best = -range, bestD = near(-range);
  for (let k = -range + 0.002; k <= range + 1e-9; k += 0.002) {
    const d = near(k);
    if (d <= gap) {
      let lo = prev, hi = k;
      for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (near(m) > gap) lo = m; else hi = m; }
      return { ...pose, at: add(pose.at, scale(n, lo)) };
    }
    if (d < bestD) { bestD = d; best = k; }
    prev = k;
  }
  return { ...pose, at: add(pose.at, scale(n, best)) };
}
// A palm point (in the right hand's axes) on a posed hand of either side.
const flipBack = (side, F, l) => fromLocal(F[bi('hand')], side === 'left' ? mz(l) : l);

// The posed hand's fingers as round bars, so another hand can close round them.
const RADIUS = (() => {
  const r = new Array(BONES.length).fill(0), c = new Array(BONES.length).fill(0);
  for (const s of PTS) if (s.w > 0.8) { const b = s.j0, L = len([0, s.l0[1], s.l0[2]]); r[b] += L; c[b]++; }
  return r.map((v, i) => (c[i] ? v / c[i] : 0.008));
})();
export function fingersShape(side, pose) {
  const F = worldFor(side, pose), bars = [];
  for (const d of DIGITS) {
    const c = CHAIN(d), Ls = d === 'thumb' ? R.thumb.len : R[d].len.slice(1);
    c.forEach((b, k) => bars.push([F[b].p, add(F[b].p, qRot(F[b].q, [Ls[k], 0, 0])), RADIUS[b]]));
  }
  return p => { let m = Infinity; for (const [a, b, r] of bars) m = Math.min(m, rod(p, a, b, r)); return m; };
}

// Between two poses: the wrist moves straight, the hand turns the short way, every angle eases across.
export function blend(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const digits = {};
  for (const d of DIGITS) digits[d] = a.digits[d].map((v, i) => v + (b.digits[d][i] - v) * k);
  return { at: lerp(a.at, b.at, k), q: qSlerp(a.q, b.q, k), digits, cup: (a.cup || 0) + ((b.cup || 0) - (a.cup || 0)) * k };
}
