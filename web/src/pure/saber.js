// The saber in the hand and the training drone: where the blade is for a pointer on the screen, how the hum follows a
// swing, whether a bolt meets the blade, and the drone's run of shots. Eye space throughout: x right, y up, -z ahead,
// in metres.
export const BLADE = 0.78, REACH = 0.075;
// How far the view reaches sideways and up at one metre (the tangents of half its angles); this one is 55 degrees
// high at 16:10. The hand sits half a metre out, and the blade points at a place about 1.1 m out.
export const VIEW = { tanX: 0.8329, tanY: 0.5206 };
const HAND_D = 0.5, TIP_D = 1.12;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const gap = (a, b) => Math.hypot(...sub(a, b));

// The guard for a pointer at (x, y) on the screen, each -1..1 with y up: the hand follows it in the lower part of the
// view and the blade leans a little further out the same way, so the whole blade stays in view on any screen shape.
export function guard(x, y, view = VIEW) {
  const px = clamp(Number.isFinite(x) ? x : 0, -1, 1), py = clamp(Number.isFinite(y) ? y : 0, -1, 1);
  const hx = px * 0.8, hy = -0.85 + (py + 1) * 0.5, tx = clamp(hx + px * 0.25, -0.95, 0.95), ty = Math.min(0.9, hy + 0.75);
  const hand = [hx * view.tanX * HAND_D, hy * view.tanY * HAND_D, -HAND_D], tip = [tx * view.tanX * TIP_D, ty * view.tanY * TIP_D, -TIP_D];
  const d = sub(tip, hand), n = Math.hypot(...d);
  return { hand, dir: d.map(v => v / n) };
}

// The blade from the hand: `a` the emitter, `b` the tip. `k` is how far it is out (0 to 1).
export function bladeEnds(pose, k = 1, length = BLADE) {
  const a = pose.hand.slice(), L = length * clamp(Number.isFinite(k) ? k : 0, 0, 1);
  return { a, b: [a[0] + pose.dir[0] * L, a[1] + pose.dir[1] * L, a[2] + pose.dir[2] * L], dir: pose.dir.slice() };
}

// The closest two segments come to each other (p1-q1 and p2-q2), after Ericson's Real-Time Collision Detection.
export function segDist(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a < 1e-12 && e < 1e-12) { s = t = 0; }
  else if (a < 1e-12) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = dot(d1, r);
    if (e < 1e-12) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = lerp3(p1, q1, s), c2 = lerp3(p2, q2, t);
  return Math.hypot(...sub(c1, c2));
}

// Whether a bolt that moved from `from` to `to` this frame met a blade that moved from `was` to `now` ({ a, b } each).
// A fast swing can carry the blade right past a bolt between two frames, so both are followed together in steps
// shorter than the reach.
export function meets(from, to, was, now, reach = REACH) {
  const steps = Math.min(32, Math.max(1, Math.ceil(Math.max(gap(was.a, now.a), gap(was.b, now.b), gap(from, to)) / reach)));
  let best = Infinity;
  for (let i = 0; i < steps; i++) {
    const u0 = i / steps, u1 = (i + 1) / steps, um = (i + 0.5) / steps;
    const a = lerp3(was.a, now.a, um), b = lerp3(was.b, now.b, um);
    best = Math.min(best, segDist(lerp3(from, to, u0), lerp3(from, to, u1), a, b));
  }
  return { hit: best <= reach, dist: best };
}

// How the hum answers a swing of the tip at `speed` metres a second: a little higher and brighter, with the rush of
// the swing on top. Below a gentle wave the hum is left as it is.
export function hum(speed) {
  const s = clamp(((Number.isFinite(speed) ? speed : 0) - 0.6) / 5.4, 0, 1), k = s * s * (3 - 2 * s);
  return { pitch: 1 + 0.26 * k, swing: k, bright: 700 + 2300 * k };
}

// ---------- the training drone ----------
// Each level is a few clean blocks in a row: the bolts come faster, closer together and, from the fourth, in pairs.
export const LEVELS = [
  { speed: 2.3, gap: 1.7, pair: 0 },
  { speed: 2.8, gap: 1.45, pair: 0 },
  { speed: 3.3, gap: 1.25, pair: 0 },
  { speed: 3.8, gap: 1.1, pair: 0.35 },
  { speed: 4.3, gap: 1.0, pair: 0.5 },
];
export const TELL = 0.55, PAIR_GAP = 0.32, FIRST = 1.4;
export const levelOf = streak => Math.min(LEVELS.length - 1, Math.floor(Math.max(0, streak) / 4));

// A small seeded random source, so a run of shots can be replayed in the tests.
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function newTraining(seed = 1, best = 0) {
  return { t: 0, phase: 'wait', left: FIRST, streak: 0, best: Math.max(0, best | 0), blocked: 0, stung: 0, returned: 0, shots: 0, last: null, rand: rng(seed) };
}

// Somewhere the blade can reach, never close to where the last bolt came: the drone makes you move.
export function nextAim(tr) {
  const r = tr.rand, far = levelOf(tr.streak) >= 2 ? 0.8 : 0.5;
  let aim = null;
  for (let i = 0; i < 12; i++) {
    aim = [(r() * 2 - 1) * 0.85, (r() * 2 - 1) * 0.8];
    if (!tr.last || Math.hypot(aim[0] - tr.last[0], aim[1] - tr.last[1]) >= far) break;
  }
  return { aim, along: 0.4 + r() * 0.45 };
}

// Moves the run on by dt while the blade is lit. Events: { type: 'tell' } just before a shot, and { type: 'fire', aim,
// along, speed } for each bolt (aim: the pointer place that guards it; along: how far up that guard's blade it passes).
export function stepTraining(tr, dt) {
  const out = [];
  if (!(dt > 0)) return out;
  tr.t += dt; tr.left -= dt;
  while (tr.left <= 0) {
    const L = LEVELS[levelOf(tr.streak)];
    if (tr.phase === 'wait') { tr.phase = 'tell'; tr.left += TELL; out.push({ type: 'tell' }); continue; }
    const second = tr.phase === 'pair', shot = nextAim(tr);
    tr.last = shot.aim; tr.shots++;
    out.push({ type: 'fire', aim: shot.aim, along: shot.along, speed: L.speed });
    if (!second && L.pair && tr.rand() < L.pair) { tr.phase = 'pair'; tr.left += PAIR_GAP; continue; }
    tr.phase = 'wait'; tr.left += L.gap;
  }
  return out;
}

// What happened to a bolt: blocked (the streak grows), it reached you (the streak is gone), or a block that flew back
// into the drone (a bonus, the streak is already counted).
export function blocked(tr) { tr.streak++; tr.blocked++; if (tr.streak > tr.best) tr.best = tr.streak; return tr.streak; }
export function stung(tr) { tr.streak = 0; tr.stung++; return tr.streak; }
export function returned(tr) { tr.returned++; return tr.returned; }

// Turning the blade off and on again starts the drone over gently, without losing the streak.
export function rest(tr) { tr.phase = 'wait'; tr.left = FIRST; return tr; }
