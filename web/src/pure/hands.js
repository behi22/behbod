// The shared toy hand and its solvers. Hand space: x to the fingers, y the back; angles [spread, knuckle, middle, end].

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => scale(a, 1 / (len(a) || 1));
export const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const qAxis = (ax, t) => { const s = Math.sin(t / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(t / 2)]; };
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qConj = q => [-q[0], -q[1], -q[2], q[3]];
export function qRot(q, v) {
  const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
// The turn whose axes are x, y and x cross y (x first, y made square to it).
export function qFrame(xv, yv) {
  const x = norm(xv), y = norm(sub(yv, scale(x, dot(x, yv)))), z = cross(x, y);
  const [m00, m10, m20] = x, [m01, m11, m21] = y, [m02, m12, m22] = z, tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  const n = Math.hypot(...q);
  return q.map(c => c / n);
}
export function qSlerp(a, b, k) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = d < 0 ? (d = -d, b.map(c => -c)) : b;
  if (d > 0.9995) { const q = a.map((c, i) => c + (bb[i] - c) * k), n = Math.hypot(...q); return q.map(c => c / n); }
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - k) * th) / s, wb = Math.sin(k * th) / s;
  return a.map((c, i) => c * wa + bb[i] * wb);
}

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
export const DIGITS = [...FINGERS, 'thumb'];

// About a grown man's hand; places are for a right hand, and a left hand mirrors them across z.
export const HAND = {
  palm: { centre: [0.045, -0.0008, 0.0035], half: [0.046, 0.0122, 0.0345], wrist: 0.74 },
  fingers: {
    index: { at: [0.084, 0.0005, -0.0235], len: [0.042, 0.025, 0.02], r: [0.0087, 0.008, 0.0075, 0.0068], spread: 0.05 },
    middle: { at: [0.088, 0.0012, -0.0045], len: [0.046, 0.028, 0.021], r: [0.0088, 0.0082, 0.0076, 0.007], spread: 0 },
    ring: { at: [0.084, 0.0005, 0.0138], len: [0.043, 0.026, 0.02], r: [0.0084, 0.0078, 0.0073, 0.0066], spread: -0.05 },
    pinky: { at: [0.076, -0.001, 0.0308], len: [0.034, 0.02, 0.018], r: [0.0077, 0.0071, 0.0066, 0.0061], spread: -0.12 },
  },
  // The thumb's first bone starts deep in the heel of the hand; `dir` is where it points at rest, `nail` its back.
  thumb: { at: [0.02, -0.0075, -0.021], dir: [0.6, -0.36, -0.715], nail: [0.1, 0.62, -0.78], len: [0.042, 0.031, 0.026], r: [0.0122, 0.0101, 0.009, 0.0079] },
};
const LIMITS = { finger: { lo: [-0.35, -0.3, -0.15, -0.1], hi: [0.35, 1.7, 1.85, 1.35] }, thumb: { lo: [-1.1, -0.7, -0.35, -0.3, -1.6], hi: [1.1, 1.2, 1.3, 1.4, 1.6] } };
export const limits = d => (d === 'thumb' ? LIMITS.thumb : LIMITS.finger);

const sideOf = side => (side === 'left' ? -1 : 1);
const mirror = (v, s) => [v[0], v[1], v[2] * s];

// A digit's first bone at rest: a finger along x turned by its spread, the thumb along its own line, nail out.
export function restTurn(side, d) {
  const s = sideOf(side);
  if (d === 'thumb') return qFrame(mirror(HAND.thumb.dir, s), mirror(HAND.thumb.nail, s));
  return qAxis(Y, s * HAND.fingers[d].spread);
}
export const digitDef = d => (d === 'thumb' ? HAND.thumb : HAND.fingers[d]);
export const baseOf = (side, d) => mirror(digitDef(d).at, sideOf(side));

// Each bone's turn against its parent; a thumb's fifth angle rolls it, which turns the way its joints bend.
export function boneTurns(side, d, a) {
  const s = sideOf(side);
  let first = qMul(restTurn(side, d), qMul(qAxis(Y, s * a[0]), qAxis(Z, -a[1])));
  if (a[4]) first = qMul(first, qAxis(X, s * a[4]));
  return [first, qAxis(Z, -a[2]), qAxis(Z, -a[3])];
}

// A digit's joints and each bone's turn, in hand space.
export function digit(side, d, a) {
  const def = digitDef(d), t = boneTurns(side, d, a), pts = [baseOf(side, d)], turns = [];
  let q = [0, 0, 0, 1];
  for (let i = 0; i < 3; i++) { q = qMul(q, t[i]); turns.push(q); pts.push(add(pts[i], qRot(q, [def.len[i], 0, 0]))); }
  return { pts, turns, r: def.r };
}

// Points over the palm's inside face, in hand space: what touches a grip.
export function palmPoints(side) {
  const s = sideOf(side), { centre: c, half: h } = HAND.palm, out = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    const x = c[0] - h[0] * 0.75 + h[0] * 1.5 * i / 4, taper = HAND.palm.wrist + (1 - HAND.palm.wrist) * (i / 4);
    out.push([x, c[1] - h[1], s * (c[2] + (j / 2 - 1) * h[2] * 0.8 * taper)]);
  }
  return out;
}

// ---------- a hand placed on something: { at, q } in its space, digits as angles ----------
export const toOuter = (pose, p) => add(pose.at, qRot(pose.q, p));
export const toHand = (pose, p) => qRot(qConj(pose.q), sub(p, pose.at));

// How deep a digit's bone goes into a shape (signed distance), worst point first; `upto` keeps to the bone's start.
function sink(side, d, a, bone, pose, sdf, upto = 1) {
  const { pts, r } = digit(side, d, a);
  let worst = Infinity;
  for (let k = 1; k <= 10; k++) {
    const u = upto * k / 10, p = lerp(pts[bone], pts[bone + 1], u), rad = r[bone] + (r[bone + 1] - r[bone]) * u;
    worst = Math.min(worst, sdf(toOuter(pose, p)) - rad);
  }
  return worst;
}

// Closes a digit joint by joint, each short of pressing the next bone in (a finger on nothing curls right in).
export function wrap(side, d, pose, sdf, { from = [0, 0, 0, 0], joints = [1, 2, 3], squash = 0.0006 } = {}) {
  const a = from.slice(), L = limits(d);
  for (const j of joints) {
    const bone = j - 1, at = x => {
      const b = a.slice(); b[j] = x;
      if (sink(side, d, b, bone, pose, sdf) < -squash) return true;
      if (j < 3) { b[j + 1] = L.lo[j + 1]; return sink(side, d, b, bone + 1, pose, sdf) < -squash; }
      return false;
    };
    let lo = L.lo[j], hit = null;
    if (at(lo)) { a[j] = lo; continue; }
    for (let x = lo + 0.03; x <= L.hi[j] + 1e-9; x += 0.03) { if (at(x)) { hit = x; break; } lo = x; }
    if (hit === null) { a[j] = L.hi[j]; continue; }
    for (let i = 0; i < 12; i++) { const m = (lo + hit) / 2; if (at(m)) hit = m; else lo = m; }
    a[j] = lo;
  }
  return a;
}

// A small, sure search for the angles that put a tip on a point, kept out of `sdf`, started round `from`.
export function reach(side, d, pose, target, { from = [0, 0, 0.3, 0.25, 0], follow = d === 'thumb' ? 0.8 : 0.75, sdf = null } = {}) {
  const t = toHand(pose, target), L = limits(d), thumb = d === 'thumb', free = thumb ? [0, 1, 2, 4] : [0, 1, 2];
  const angles = x => { const a = [x[0], x[1], x[2], clamp(x[2] * follow, L.lo[3], L.hi[3])]; if (thumb) a.push(x[4]); return a; };
  const cost = x => {
    const a = angles(x), { pts } = digit(side, d, a), e = sub(pts[3], t);
    let c = dot(e, e) + 1.6e-7 * free.reduce((sum, i) => sum + (x[i] - (from[i] || 0)) ** 2, 0);
    if (sdf) for (let b = 0; b < 3; b++) { const s = sink(side, d, a, b, pose, sdf); if (s < 0) c += s * s * 100; }
    return c;
  };
  const search = x => {
    let fx = cost(x), step = 0.3;
    while (step > 2e-4) {
      let moved = false;
      for (const i of free) {
        for (const dir of [1, -1]) {
          const y = x.slice(); y[i] = clamp(y[i] + dir * step, L.lo[i], L.hi[i]);
          const fy = cost(y);
          if (fy < fx - 1e-14) { x = y; fx = fy; moved = true; break; }
        }
        if (moved) break;
      }
      if (!moved) step /= 2;
    }
    return [x, fx];
  };
  const start = [from[0] || 0, from[1] || 0, from[2] || 0, 0, from[4] || 0];
  const starts = [start];
  // Also start from the answer that ignores the shape: a finger threading a narrow gap is found by easing that out.
  if (sdf) { const a = reach(side, d, pose, target, { from, follow }); starts.push([a[0], a[1], a[2], 0, a[4] || 0]); }
  if (sdf) for (const k of thumb ? [[0.5, 0, -0.9], [-0.5, 0, 0.9], [0, 0.6, 0], [0.5, -0.4, 0.9], [-0.5, -0.4, -0.9]] : [[0.25, 0.4, 0], [-0.25, -0.2, 0]]) {
    starts.push([clamp(start[0] + k[0], L.lo[0], L.hi[0]), clamp(start[1] + k[1], L.lo[1], L.hi[1]), start[2], 0, thumb ? clamp(start[4] + k[2], L.lo[4], L.hi[4]) : 0]);
  }
  let best = null;
  for (const x of starts) { const r = search(x); if (!best || r[1] < best[1]) best = r; }
  return angles(best[0]);
}

// How far a digit's tip is from a point, for checking a reach.
export const miss = (side, d, pose, a, target) => len(sub(toOuter(pose, digit(side, d, a).pts[3]), target));

// Moves a hand along `dir` (outer space) until its palm rests on the shape, `gap` off it.
export function seat(side, pose, sdf, dir, { gap = 0.0005, range = 0.06 } = {}) {
  const pts = palmPoints(side), n = norm(dir);
  const near = k => { const at = add(pose.at, scale(n, k)), p = { ...pose, at }; return Math.min(...pts.map(q => sdf(toOuter(p, q)))); };
  let lo = -range, hi = range;
  // Moving along dir brings the palm closer, so nearness falls as k grows.
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (near(m) > gap) lo = m; else hi = m; }
  return { ...pose, at: add(pose.at, scale(n, lo)) };
}

// The deepest any bone of a posed hand goes into a shape (negative means into it), for checks.
export function deepest(side, pose, sdf, digits = DIGITS) {
  let worst = Infinity;
  for (const d of digits) for (let b = 0; b < 3; b++) worst = Math.min(worst, sink(side, d, pose.digits[d], b, pose, sdf));
  return worst;
}

// Between two poses: the wrist moves straight, the hand turns the short way, every angle eases across.
export function blend(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const digits = {};
  for (const d of DIGITS) digits[d] = a.digits[d].map((v, i) => v + (b.digits[d][i] - v) * k);
  return { at: lerp(a.at, b.at, k), q: qSlerp(a.q, b.q, k), digits };
}

// A hand at rest, slightly closed, the way a hand hangs.
export const relaxed = () => ({ index: [0, 0.25, 0.35, 0.25], middle: [0, 0.32, 0.42, 0.3], ring: [0, 0.38, 0.48, 0.32], pinky: [0, 0.45, 0.5, 0.35], thumb: [0, 0.1, 0.2, 0.15, 0] });

// ---------- shapes for grips: a rounded box (centre, half sizes, edge radius), negative inside ----------
export function roundBox(p, c, h, r = 0) {
  const q = [Math.abs(p[0] - c[0]) - h[0] + r, Math.abs(p[1] - c[1]) - h[1] + r, Math.abs(p[2] - c[2]) - h[2] + r];
  return Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], q[1], q[2]), 0) - r;
}
// A round bar from a to b of radius r (a fore grip, a hand guard).
export function rod(p, a, b, r) {
  const ab = sub(b, a), u = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1);
  return len(sub(p, add(a, scale(ab, u)))) - r;
}
