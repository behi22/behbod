// A five-a-side match, for the live game on the TV and for joining in: the pitch is 40 m by 24 m, x from one goal to
// the other (home attacks +x), y across. Players dribble, pass, shoot, press and keep their shape; keepers track the
// ball and save what they reach. One player can be taken over: `control` steers them instead of the bots.
export const LEN = 20, WID = 12, GOAL = 2.5, SPEED = 5, BALL_FRICTION = 1.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Where each player stands when their team sets up, as fractions of the half they defend (home side, x < 0).
const SHAPE = [['keeper', -0.95, 0], ['back', -0.55, -0.35], ['back', -0.55, 0.35], ['forward', -0.12, -0.3], ['forward', -0.12, 0.3]];

export function newMatch({ kickoff = 0 } = {}) {
  const players = [];
  for (const team of [0, 1]) SHAPE.forEach(([role, fx, fy], i) => {
    const s = team ? -1 : 1, hx = fx * LEN * s, hy = fy * WID;
    players.push({ team, role, num: team ? [1, 4, 5, 9, 11][i] : [1, 3, 6, 22, 10][i], x: hx, y: hy, hx, hy, dive: 0 });
  });
  const m = { players, ball: { x: 0, y: 0, vx: 0, vy: 0, owner: null, shot: null, held: 0, heldBy: null }, score: [0, 0], clock: 0, phase: 'play', wait: 0, possession: kickoff, aggro: [1, 1] };
  restart(m, kickoff);
  return m;
}

// Everyone back to their places, the ball on the spot with team `to`'s forward.
export function restart(m, to) {
  for (const p of m.players) { p.x = p.hx; p.y = p.hy; p.dive = 0; }
  const f = m.players.find(p => p.team === to && p.num === (to ? 9 : 22));
  Object.assign(m.ball, { x: 0, y: 0, vx: 0, vy: 0, owner: f, shot: null });
  f.x = to ? 0.4 : -0.4; f.y = 0;
  m.phase = 'play';
}

const goalX = team => (team ? -LEN : LEN);
const ahead = (p, q) => (p.team ? q.x < p.x : q.x > p.x);

export function kick(m, p, tx, ty, speed, shot = false) {
  const b = m.ball, d = Math.hypot(tx - b.x, ty - b.y) || 1;
  Object.assign(b, { owner: null, vx: ((tx - b.x) / d) * speed, vy: ((ty - b.y) / d) * speed, shot: shot ? p.team : null, last: p });
  p.cool = 0.4;
}
export const shoot = (m, p, aimY, rand) => kick(m, p, goalX(p.team), clamp(aimY + (rand() - 0.5) * 1.6, -GOAL * 1.4, GOAL * 1.4), 17, true);
export function pass(m, p) {
  const mates = m.players.filter(q => q.team === p.team && q !== p && q.role !== 'keeper');
  if (!mates.length) return false;
  const best = mates.reduce((a, q) => ((ahead(p, q) ? 1 : 0) - dist(p, q) / 30 > (ahead(p, a) ? 1 : 0) - dist(p, a) / 30 ? q : a));
  kick(m, p, best.x + (best.team ? -1.5 : 1.5), best.y, 12);
  return true;
}

// The bots' choice for whoever has the ball: shoot when close and clear, pass when pressed, else carry it forward.
function decide(m, p, dt, rand, ev) {
  // A keeper with the ball in hand looks up, then throws it out to a teammate; it never dribbles up the pitch.
  if (p.role === 'keeper') { if (m.ball.held > 0.8 && pass(m, p)) ev.push('pass'); return; }
  const gx = goalX(p.team), toGoal = Math.abs(gx - p.x), close = toGoal < 11 + 3 * (m.aggro[p.team] - 1);
  const press = m.players.some(q => q.team !== p.team && dist(p, q) < 1.6 && q.role !== 'keeper');
  // Close in, a shot (always, before walking into the keeper); from distance, now and then a long one. Most go for
  // the side away from the keeper; one in four is snatched.
  if (toGoal < 7 || (close && rand() < dt * 1.8 * m.aggro[p.team]) || (toGoal < 17 && rand() < dt * 0.06)) {
    const k = m.players.find(q => q.team !== p.team && q.role === 'keeper');
    const away = -(Math.sign(k.y - p.y) || 1) * (0.9 + rand() * 1.3);
    shoot(m, p, rand() < 0.25 ? (rand() - 0.5) * 3.6 : away, rand); ev.push('shot'); return;
  }
  if (press && rand() < dt * 1.6 && pass(m, p)) { ev.push('pass'); return; }
  const dir = Math.sign(gx - p.x), wob = Math.sin(m.clock * 1.3 + p.num) * 0.6;
  p.x += dir * SPEED * 0.92 * dt; p.y = clamp(p.y + (wob - p.y * 0.05) * dt, -WID + 1, WID - 1);
}

function moveTo(p, tx, ty, speed, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return;
  const s = Math.min(d, speed * dt);
  p.x += (dx / d) * s; p.y += (dy / d) * s;
}

// One step. `control`: { player, dx, dy, shoot, pass, dive } for a person playing one of the ten. Returns events.
export function stepMatch(m, dt, rand, control = null) {
  const ev = [], b = m.ball, you = control?.player || null;
  m.clock += dt;
  if (m.phase === 'goal') { m.wait -= dt; if (m.wait <= 0) restart(m, m.possession); return ev; }
  for (const p of m.players) { p.cool = Math.max(0, (p.cool || 0) - dt); p.dive = Math.max(0, p.dive - dt); }
  // The person playing.
  if (you) {
    const run = you.role === 'keeper' ? 4.5 : 6.2, d = Math.hypot(control.dx, control.dy);
    if (d > 0) { you.x += (control.dx / d) * run * dt * (you.dive ? 2.2 : 1); you.y += (control.dy / d) * run * dt * (you.dive ? 2.2 : 1); }
    if (you.role === 'keeper') { const gx = -goalX(you.team); you.x = clamp(you.x, Math.min(gx, gx * 0.82), Math.max(gx, gx * 0.82)); you.y = clamp(you.y, -GOAL - 1.5, GOAL + 1.5); }
    you.x = clamp(you.x, -LEN, LEN); you.y = clamp(you.y, -WID, WID);
    if (control.dive && you.role === 'keeper' && !you.dive) { you.dive = 0.45; ev.push('dive'); }
    if (b.owner === you) {
      if (control.shoot) { shoot(m, you, control.dy * 2.2, rand); ev.push('shot'); }
      else if (control.pass && pass(m, you)) ev.push('pass');
      // A keeper who holds on too long throws it out anyway, as the bots' keeper does.
      else if (you.role === 'keeper' && b.heldBy === you && b.held > 1.5 && pass(m, you)) ev.push('pass');
    }
  }
  // The ball: carried by its owner, or rolling and slowing down.
  if (b.owner) {
    const o = b.owner, dir = o.team ? -1 : 1;
    if (b.heldBy !== o) { b.heldBy = o; b.held = 0; } else b.held += dt;
    if (o !== you) decide(m, o, dt, rand, ev);
    // Whoever carries the ball is the last to touch it, so a goal walked in is theirs.
    if (b.owner === o) { b.x = o.x + dir * 0.45; b.y = o.y; b.last = o; }
  } else {
    b.x += b.vx * dt; b.y += b.vy * dt;
    const f = Math.max(0, 1 - BALL_FRICTION * dt);
    b.vx *= f; b.vy *= f;
    if (Math.hypot(b.vx, b.vy) < 3) b.shot = null;
  }
  // Keepers: stay between the ball and the goal, and save a shot they can reach.
  for (const k of m.players.filter(p => p.role === 'keeper')) {
    const gx = -goalX(k.team);
    // With a shot already on its way, a bot keeper only has time for a short step across.
    const incoming = b.shot !== null && b.shot !== k.team;
    if (k !== you) moveTo(k, gx * 0.94, clamp(b.y * 0.6, -GOAL + 0.3, GOAL - 0.3), incoming ? 1.0 : 4.2, dt);
    const reach = k.dive ? 1.6 : k === you ? 0.95 : 0.7 + (m.aggro[k.team ? 0 : 1] < 1 ? 0.35 : 0);
    const coming = !b.owner && Math.sign(b.vx) === Math.sign(gx) && Math.hypot(b.vx, b.vy) > 0.5;
    if (((b.shot !== null && b.shot !== k.team) || coming) && dist(k, b) < reach) {
      ev.push(b.shot !== null ? (k === you ? 'save' : 'bot-save') : 'claim');
      Object.assign(b, { owner: k, vx: 0, vy: 0, shot: null });
    }
  }
  // Outfield bots: chase a loose ball, press its carrier, or hold their place shifted with the play.
  const loose = !b.owner, inHand = b.owner?.role === 'keeper';
  const chasers = [0, 1].map(t => m.players.filter(p => p.team === t && p.role !== 'keeper' && p !== you).sort((a, q) => dist(a, b) - dist(q, b))[0]);
  for (const p of m.players) {
    if (p === you || p.role === 'keeper' || p === b.owner) continue;
    const shift = clamp(b.x * 0.45, -LEN * 0.4, LEN * 0.4);
    // While a keeper holds the ball everyone drops back into shape instead of crowding the keeper.
    if ((loose || (b.owner.team !== p.team && !inHand)) && chasers[p.team] === p) moveTo(p, b.x, b.y, loose ? SPEED : SPEED * 0.88, dt);
    else moveTo(p, clamp(p.hx + shift, -LEN + 2, LEN - 2), p.hy + (b.y - p.hy) * 0.25, SPEED * 0.8, dt);
  }
  // Winning the ball: a loose ball goes to whoever reaches it; a carrier can be tackled.
  for (const p of m.players) {
    if (p.cool || p === b.owner) continue;
    const d = dist(p, b);
    if (loose && d < 0.6 && !(b.shot !== null && b.shot !== p.team && Math.hypot(b.vx, b.vy) > 9 && p.role !== 'keeper')) { b.owner = p; b.shot = null; m.possession = p.team; break; }
    // A keeper comes out for a dribbler in front of the goal, and is quicker to it than an outfield tackle.
    const keeper = p.role === 'keeper';
    // Nobody can take the ball off a keeper holding it.
    if (!loose && b.owner && b.owner.role !== 'keeper' && b.owner.team !== p.team && d < (keeper ? 0.95 : 0.7) && rand() < dt * (keeper ? 3 : 0.8)) { b.owner.cool = 0.6; b.owner = p; m.possession = p.team; ev.push('tackle'); break; }
  }
  // Goals and the ball going out.
  if (Math.abs(b.x) >= LEN) {
    const team = b.x > 0 ? 0 : 1;
    if (Math.abs(b.y) < GOAL) { m.score[team]++; m.phase = 'goal'; m.wait = 2.5; m.possession = 1 - team; ev.push({ goal: team, by: b.last || null }); return ev; }
    const k = m.players.find(p => p.team === 1 - team && p.role === 'keeper');
    Object.assign(b, { owner: k, vx: 0, vy: 0, shot: null, x: k.x, y: k.y });
    m.possession = k.team;
  } else if (Math.abs(b.y) >= WID) {
    const t = b.last ? 1 - b.last.team : 1 - m.possession, p = m.players.filter(q => q.team === t && q.role !== 'keeper').sort((a, q) => dist(a, b) - dist(q, b))[0];
    b.y = clamp(b.y, -WID + 0.3, WID - 0.3);
    p.x = b.x; p.y = b.y;
    Object.assign(b, { owner: p, vx: 0, vy: 0, shot: null });
    m.possession = t;
  }
  for (const p of m.players) { p.x = clamp(p.x, -LEN, LEN); p.y = clamp(p.y, -WID, WID); }
  return ev;
}
