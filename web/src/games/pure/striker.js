// Penalty shootout rules, shot maths and the keeper. Goal coordinates are metres seen from the penalty spot:
// x across from the middle (posts at -3.66 and 3.66), y up from the grass (crossbar at 2.44).
export const GOAL_W = 7.32, GOAL_H = 2.44, HALF = GOAL_W / 2, BALL_R = 0.11, SPOT = 11;
export const KICKS = 5;
export const KEEPER = { x: 0, y: 1.0, diveTime: 0.55, hang: 0.12, maxX: 3.05, minY: 0.3, maxY: 2.15 };

export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = rng => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- the shootout ----------
// You shoot five, then keep five, then sudden death a pair at a time, you first.
export const newShootout = () => ({ kicks: [] });
export const recordKick = (st, by, result) => ({ kicks: st.kicks.concat([{ by, result }]) });

export function tally(st) {
  const t = { you: 0, them: 0, youTaken: 0, themTaken: 0 };
  for (const k of st.kicks) {
    if (k.by === 'you') { t.youTaken++; if (k.result === 'goal') t.you++; }
    else { t.themTaken++; if (k.result === 'goal') t.them++; }
  }
  return t;
}

export function outcome(st) {
  const t = tally(st), n = st.kicks.length;
  if (n <= KICKS * 2) {
    if (t.you + (KICKS - t.youTaken) < t.them) return 'lose';
    if (t.them + (KICKS - t.themTaken) < t.you) return 'win';
    return null;
  }
  if ((n - KICKS * 2) % 2) return null;
  return t.you > t.them ? 'win' : t.them > t.you ? 'lose' : null;
}

export function nextKick(st) {
  if (outcome(st)) return null;
  const n = st.kicks.length;
  if (n < KICKS) return { by: 'you', round: n + 1, sudden: false };
  if (n < KICKS * 2) return { by: 'them', round: n - KICKS + 1, sudden: false };
  const k = n - KICKS * 2;
  return { by: k % 2 ? 'them' : 'you', round: KICKS + 1 + (k >> 1), sudden: true };
}

// ---------- the shot ----------
export const SWEET = [0.58, 0.86];
export const BOT_PACE = 1.2;

// Where the ball really goes. Off the sweet spot it strays more, and a blasted shot climbs.
export function shoot(aim, power, rng = Math.random, pace = 1) {
  const over = Math.max(0, power - SWEET[1]) / (1 - SWEET[1]);
  const under = Math.max(0, SWEET[0] - power) / SWEET[0];
  const spread = 0.16 + over * 0.55 + under * 0.3;
  const x = aim.x + gauss(rng) * spread;
  let y = aim.y + gauss(rng) * spread * 0.6 + over * (0.35 + rng() * 0.9) - under * 0.45 * aim.y;
  y = Math.max(BALL_R, y);
  const flight = (0.95 - 0.55 * clamp(power, 0, 1)) * pace;
  return { x, y, flight, result: judge(x, y) };
}

export function judge(x, y) {
  const ax = Math.abs(x);
  const nearPost = ax > HALF - BALL_R && ax < HALF + BALL_R + 0.04 && y < GOAL_H + BALL_R;
  const nearBar = y > GOAL_H - BALL_R && y < GOAL_H + BALL_R + 0.04 && ax < HALF + BALL_R;
  if (nearPost || nearBar) return 'post';
  if (ax >= HALF + BALL_R) return 'wide';
  if (y >= GOAL_H + BALL_R) return 'over';
  return 'on';
}

// ---------- the keeper ----------
// plan: where the keeper dives and when he leaves, in seconds from the kick (negative means he went early).
export function keeperAt(plan, t) {
  if (!plan || t <= plan.start) return { x: KEEPER.x, y: KEEPER.y, p: 0, lean: 0 };
  const p = clamp((t - plan.start) / KEEPER.diveTime, 0, 1);
  const e = 1 - (1 - p) * (1 - p);
  const tx = clamp(plan.x, -KEEPER.maxX, KEEPER.maxX), ty = clamp(plan.y, KEEPER.minY, KEEPER.maxY);
  const x = KEEPER.x + (tx - KEEPER.x) * e, lean = clamp(Math.abs(x) / 1.6, 0, 1);
  let y = KEEPER.y + (ty - KEEPER.y) * e;
  // A dive that is finished drops back to the grass, so going far too early leaves him lying there.
  const late = t - plan.start - KEEPER.diveTime - KEEPER.hang;
  if (late > 0) y = Math.max(Math.min(y, KEEPER.y - 0.12 - 0.6 * lean), y - 4.9 * late * late);
  return { x, y, p: e, lean };
}

// The keeper's body as an ellipse: tall when standing, long and flat at full stretch.
export function reach(k) {
  return { rx: 0.7 + 0.35 * k.lean, ry: 1.05 - 0.45 * k.lean };
}

export function saves(plan, ball, t = ball.flight) {
  const k = keeperAt(plan, t), r = reach(k);
  const dx = (ball.x - k.x) / r.rx, dy = (ball.y - k.y) / r.ry;
  return dx * dx + dy * dy <= 1;
}

// The bot in goal: reads slow or central shots, otherwise guesses, leaning to the side you keep picking.
export function keeperPlan(ball, history = [], rng = Math.random) {
  const central = Math.abs(ball.x) < 1.2;
  const read = clamp(0.1 + (ball.flight - 0.45) * 1.3 + (central ? 0.25 : 0), 0.05, 0.8);
  if (rng() < read) return { x: ball.x + gauss(rng) * 0.3, y: ball.y + gauss(rng) * 0.25, start: 0.08 + rng() * 0.08, read: true };
  const left = history.filter(x => x < -1).length, right = history.filter(x => x > 1).length;
  const mid = history.length - left - right;
  if (rng() < clamp(0.14 + mid * 0.06, 0.14, 0.4)) return { x: gauss(rng) * 0.25, y: 1 + rng() * 0.9, start: 0.05, read: false };
  const lean = (left + 1) / (left + right + 2);
  const side = rng() < 0.35 + 0.3 * lean ? -1 : 1;
  return { x: side * (1.7 + rng() * 1.3), y: 0.35 + rng() * 1.7, start: -0.06 + rng() * 0.14, read: false };
}

// The bot taking a penalty. If you leave early, he usually rolls it the other way.
export function botAim(rng = Math.random, early = null) {
  let x, y;
  if (rng() < 0.12) { x = gauss(rng) * 0.35; y = rng() < 0.5 ? 0.25 : 1.5 + rng() * 0.7; }
  else { x = (rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 1.95); y = 0.2 + rng() * 2.0; }
  if (early && Math.abs(early.x) > 0.8 && rng() < 0.7) x = -Math.sign(early.x) * (1.7 + rng() * 1.6);
  const power = 0.5 + rng() * 0.48;
  return { aim: { x, y }, power };
}

// Arc of the ball from the spot to the goal line: s runs 0 to 1, height above a straight line peaks mid flight.
export function ballPath(ball, s) {
  const lift = 0.12 + 0.22 * clamp(ball.y / GOAL_H, 0, 1.4);
  return { x: ball.x * s, y: BALL_R + (ball.y - BALL_R) * s + Math.sin(Math.PI * clamp(s, 0, 1)) * lift, z: SPOT * (1 - s) };
}
