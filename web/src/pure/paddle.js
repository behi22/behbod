// Paddle Duel, on the computer: your paddle along the bottom, the computer's along the top, one ball. Let it past
// you and the computer scores; first to five. Pure: `step` moves the game on and says what happened.
export const COURT = { w: 720, h: 420, paddle: 96, thick: 12, ball: 8, edge: 26, to: 5 };
export const LEVELS = {
  easy: { name: 'Easy', speed: 250, slip: 80, think: 0.26, ball: 300, top: 520 },
  normal: { name: 'Normal', speed: 380, slip: 38, think: 0.14, ball: 340, top: 640 },
  hard: { name: 'Hard', speed: 560, slip: 12, think: 0.06, ball: 390, top: 780 },
};
const YOU_SPEED = 620, QUICKER = 1.045, SERVE = 0.9;

export function newDuel(level = 'normal') {
  const L = Object.hasOwn(LEVELS, level) ? level : 'normal';
  const d = { level: L, you: COURT.w / 2, ai: COURT.w / 2, score: { you: 0, ai: 0 }, rally: 0, best: 0, hits: 0, wait: SERVE, to: 'you', aim: COURT.w / 2, thinkT: 0, over: false, winner: null,
    ball: { x: COURT.w / 2, y: COURT.h / 2, vx: 0, vy: 0 } };
  return d;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Where the ball will cross the height `y`, folding its path off the side walls.
export function crossing(ball, y) {
  if (!ball.vy || (y - ball.y) / ball.vy < 0) return ball.x;
  const span = COURT.w - 2 * COURT.ball, raw = ball.x - COURT.ball + ball.vx * ((y - ball.y) / ball.vy);
  const u = ((raw % (2 * span)) + 2 * span) % (2 * span);
  return COURT.ball + (u <= span ? u : 2 * span - u);
}

// input: { left, right } held keys, or { to: x } to follow a pointer. Events: serve, wall, hit { by }, point { to }, win { by }.
export function step(d, dt, input = {}, rng = Math.random) {
  const ev = [];
  if (d.over || !(dt > 0)) return ev;
  const L = LEVELS[d.level], half = COURT.paddle / 2, b = d.ball;
  // My paddle: the keys, or straight to the pointer (no faster than a quick hand).
  const want = Number.isFinite(input.to) ? clamp(input.to, half, COURT.w - half) : d.you + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * YOU_SPEED * dt;
  d.you = clamp(d.you + clamp(want - d.you, -YOU_SPEED * dt * 1.6, YOU_SPEED * dt * 1.6), half, COURT.w - half);
  // The computer: it looks again every `think` seconds, aims where the ball will arrive, off by its slip.
  d.thinkT -= dt;
  if (d.thinkT <= 0) {
    d.thinkT = L.think;
    d.aim = b.vy < 0 ? crossing(b, COURT.edge + COURT.thick) + (rng() * 2 - 1) * L.slip : COURT.w / 2 + (b.x - COURT.w / 2) * 0.25;
  }
  d.ai = clamp(d.ai + clamp(d.aim - d.ai, -L.speed * dt, L.speed * dt), half, COURT.w - half);

  if (d.wait > 0) {
    d.wait -= dt;
    b.x = COURT.w / 2; b.y = COURT.h / 2; b.vx = b.vy = 0;
    if (d.wait <= 0) {
      d.wait = 0;
      const a = (rng() * 2 - 1) * 0.5;
      b.vx = Math.sin(a) * L.ball; b.vy = Math.cos(a) * L.ball * (d.to === 'you' ? 1 : -1);
      ev.push({ type: 'serve' });
    }
    return ev;
  }
  // The ball moves in short steps so a fast one cannot pass through a paddle.
  const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6));
  for (let i = 0; i < n && d.wait <= 0; i++) {
    b.x += b.vx * dt / n; b.y += b.vy * dt / n;
    if (b.x < COURT.ball) { b.x = COURT.ball; b.vx = Math.abs(b.vx); ev.push({ type: 'wall' }); }
    else if (b.x > COURT.w - COURT.ball) { b.x = COURT.w - COURT.ball; b.vx = -Math.abs(b.vx); ev.push({ type: 'wall' }); }
    for (const [who, px, face, dir] of [['you', d.you, COURT.h - COURT.edge - COURT.thick, -1], ['ai', d.ai, COURT.edge + COURT.thick, 1]]) {
      const coming = dir < 0 ? b.vy > 0 : b.vy < 0, past = dir < 0 ? b.y + COURT.ball >= face : b.y - COURT.ball <= face;
      const deep = dir < 0 ? b.y - COURT.ball > face + COURT.thick : b.y + COURT.ball < face - COURT.thick;
      if (!coming || !past || deep || Math.abs(b.x - px) > half + COURT.ball) continue;
      // Off the paddle: the further from its middle, the wider the angle; every hit is a little quicker.
      const speed = Math.min(L.top, Math.hypot(b.vx, b.vy) * QUICKER), a = clamp((b.x - px) / half, -1, 1) * 1.05;
      b.vx = Math.sin(a) * speed; b.vy = Math.cos(a) * speed * dir;
      b.y = face + dir * COURT.ball;
      d.rally++; d.hits++; d.best = Math.max(d.best, d.rally);
      ev.push({ type: 'hit', by: who });
    }
    const out = b.y > COURT.h + COURT.ball ? 'ai' : b.y < -COURT.ball ? 'you' : null;
    if (out) {
      d.score[out]++; d.rally = 0;
      ev.push({ type: 'point', to: out });
      if (d.score[out] >= COURT.to) { d.over = true; d.winner = out; ev.push({ type: 'win', by: out }); return ev; }
      // The one who lost the point is served to.
      d.to = out === 'you' ? 'ai' : 'you'; d.wait = SERVE;
    }
  }
  return ev;
}
