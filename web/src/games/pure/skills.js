// The Skills Shooter's rules: four blasters, skills drifting down to be shot for points, bugs that zigzag and fire back,
// and Claude, whose badge powers the blaster up for a few seconds. The field is W by H; y grows downward.
export const W = 800, H = 640, SHIP_Y = H - 70;
export const BLASTERS = [
  { id: 'pulse', name: 'Pulse', line: 'Fast single shots', color: '#3dd6b5', cool: 0.14 },
  { id: 'spread', name: 'Spread', line: 'Three-way burst', color: '#a78bfa', cool: 0.3 },
  { id: 'rail', name: 'Rail', line: 'Pierces everything in a line', color: '#e6edf3', cool: 0.7 },
  { id: 'ion', name: 'Ion', line: 'Slow orbs that seek a target', color: '#f0a35b', cool: 0.45 },
];
export const SKILLS = ['TS', 'JS', 'Python', 'React', 'Node', 'WebSockets', 'Agents', 'RAG', 'Voice AI', 'Prompts', 'Guardrails', 'OpenAI', 'AWS', 'Docker', 'CI/CD'];
export const POWER_TIME = 6, LIVES = 3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const newGame = () => ({ x: W / 2, shots: [], foes: [], foeShots: [], score: 0, lives: LIVES, blaster: 0, cool: 0, spawn: 0.6, t: 0, combo: 0, power: 0, over: false });

// How often things arrive: faster as the score climbs, never quicker than half the starting gap.
export const spawnGap = (score, rand) => (0.45 + rand() * 0.55) * Math.max(0.5, 1 - score / 3000);
// Points for a kill: skills 10, bugs 25, Claude 50, times the combo (one more for every five in a row, up to four).
export const points = (kind, combo) => ({ skill: 10, bug: 25, claude: 50 }[kind] * Math.min(4, 1 + Math.floor(combo / 5)));

export function spawn(st, rand) {
  const r = rand(), x = 60 + rand() * (W - 120);
  // One in twenty arrivals is Claude, about one in five a bug.
  if (r < 0.05) st.foes.push({ kind: 'claude', x, y: -30, vy: 70, hp: 1 });
  else if (r < 0.27) st.foes.push({ kind: 'bug', x, y: -30, vy: 70 + rand() * 40, hp: 2, ph: rand() * 6 });
  else st.foes.push({ kind: 'skill', x, y: -30, vy: 55 + rand() * 40, hp: 1, label: SKILLS[Math.floor(rand() * SKILLS.length)] });
}

export function fire(st) {
  const B = BLASTERS[st.blaster], y = SHIP_Y - 10;
  if (st.power > 0) { for (const a of [-0.36, -0.18, 0, 0.18, 0.36]) st.shots.push({ x: st.x, y, vx: Math.sin(a) * 640, vy: -Math.cos(a) * 640, r: 5, claude: true }); return; }
  if (B.id === 'pulse') st.shots.push({ x: st.x, y, vx: 0, vy: -720, r: 4 });
  if (B.id === 'spread') for (const a of [-0.25, 0, 0.25]) st.shots.push({ x: st.x, y, vx: Math.sin(a) * 600, vy: -Math.cos(a) * 600, r: 4 });
  if (B.id === 'rail') st.shots.push({ x: st.x, y, vx: 0, vy: -1400, r: 3, rail: true });
  if (B.id === 'ion') st.shots.push({ x: st.x, y, vx: 0, vy: -320, r: 8, seek: true });
}

const hits = (s, f) => (s.rail ? Math.abs(s.x - f.x) < 40 && s.y < f.y + 20 : Math.abs(s.x - f.x) < 42 && Math.abs(s.y - f.y) < 22);

// One step of play. `input`: { left, right, fire }. Returns what happened, for the sounds and the score line.
export function step(st, dt, input, rand) {
  const ev = [];
  if (st.over) return ev;
  st.t += dt; st.cool -= dt; st.spawn -= dt; st.power = Math.max(0, st.power - dt);
  if (input.left) st.x -= 420 * dt;
  if (input.right) st.x += 420 * dt;
  st.x = clamp(st.x, 40, W - 40);
  if (input.fire && st.cool <= 0) { st.cool = st.power > 0 ? 0.16 : BLASTERS[st.blaster].cool; fire(st); ev.push('fire'); }
  if (st.spawn <= 0) { st.spawn = spawnGap(st.score, rand); spawn(st, rand); }
  for (const s of st.shots) {
    if (s.seek) {
      let best = null;
      for (const f of st.foes) if (!best || Math.hypot(f.x - s.x, f.y - s.y) < Math.hypot(best.x - s.x, best.y - s.y)) best = f;
      if (best) s.vx += clamp(best.x - s.x, -1, 1) * 900 * dt;
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
  }
  for (const f of st.foes) {
    f.y += f.vy * dt;
    if (f.kind === 'bug') {
      f.x = clamp(f.x + Math.sin(st.t * 3 + f.ph) * 120 * dt, 30, W - 30);
      if (rand() < dt * 0.5) st.foeShots.push({ x: f.x, y: f.y + 16, vy: 240 });
    }
  }
  for (const s of st.foeShots) s.y += s.vy * dt;
  for (const f of st.foes) for (const s of st.shots) {
    if (f.dead || s.dead || !hits(s, f)) continue;
    f.hp--;
    if (!s.rail) s.dead = true;
    if (f.hp > 0) continue;
    f.dead = true;
    st.combo++;
    st.score += points(f.kind, st.combo);
    if (f.kind === 'claude') { st.power = POWER_TIME; ev.push('power'); }
    ev.push({ kill: f.kind, x: f.x, y: f.y });
  }
  const hurt = () => { st.lives--; st.combo = 0; ev.push('hurt'); };
  for (const f of st.foes) if (!f.dead && f.y > SHIP_Y - 30 && Math.abs(f.x - st.x) < 46) { f.dead = true; hurt(); }
  for (const s of st.foeShots) if (!s.dead && s.y > SHIP_Y - 25 && Math.abs(s.x - st.x) < 26) { s.dead = true; hurt(); }
  // A skill that gets past breaks the combo; a bug that gets past is just gone.
  for (const f of st.foes) if (!f.dead && f.y > H + 20 && f.kind !== 'bug') st.combo = 0;
  st.shots = st.shots.filter(s => !s.dead && s.y > -40 && s.x > -20 && s.x < W + 20);
  st.foes = st.foes.filter(f => !f.dead && f.y < H + 40);
  st.foeShots = st.foeShots.filter(s => !s.dead && s.y < H + 20);
  if (st.lives <= 0) { st.over = true; ev.push('over'); }
  return ev;
}

export const setBlaster = (st, i) => { st.blaster = ((i % BLASTERS.length) + BLASTERS.length) % BLASTERS.length; };
