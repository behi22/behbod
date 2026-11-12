// The range's five stages: what appears, when and where, for each difficulty. A stage is a script of targets worked out
// from a seed, so the same seed always gives the same run. Places are in range space: x metres across the hall (0 is
// the middle lane), d metres downrange from the firing line, h metres above the floor.
import { GUNS } from './arsenal.js';

export const HALL = { half: 5.6, near: 7, far: 28, tunnel: [42, 74], tunnelHalf: 1.0 };
export const DIFFICULTIES = {
  easy: { name: 'Easy', speed: 0.8, life: 1.35, hp: 0.8, bolts: 0, shields: 3, score: 0.8 },
  normal: { name: 'Normal', speed: 1, life: 1, hp: 1, bolts: 0, shields: 3, score: 1 },
  hard: { name: 'Hard', speed: 1.3, life: 0.78, hp: 1.25, bolts: 1, shields: 3, score: 1.3 },
};
// What each kind of target is worth, how much it takes, and how its parts multiply a hit.
export const KINDS = {
  plate: { points: 100, hp: 1, zones: { plate: 1 } },
  walker: { points: 300, hp: 110, zones: { core: 2.5, head: 1.5, body: 1, limb: 0.6 }, weak: 'core', bolt: 4.2 },
  drone: { points: 250, hp: 55, zones: { eye: 2.2, body: 1 }, weak: 'eye', bolt: 3.4 },
};
export const STAGES = [
  { id: 'warmup', name: 'Warm-up', line: 'Steel plates. Learn the sights.', time: 60, dark: false },
  { id: 'walkers', name: 'Walkers', line: 'Robots cross the hall. The core is the weak spot.', time: 75, dark: false },
  { id: 'swarm', name: 'Swarm', line: 'Drones. They do not hold still.', time: 75, dark: false },
  { id: 'dark', name: 'Lights out', line: 'The hall goes dark. Bring the flashlight.', time: 75, dark: true },
  { id: 'long', name: 'The long shot', line: 'Plates far down the tunnel, and everything else.', time: 90, dark: false },
];
export const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));
// Stars are measured against the stage's plain total (every target, no streak): a good run with streaks beats it.
export const STAR_MARKS = [0.4, 0.75, 1.1];
export const MAX_STARS = STAGES.length * 3;

// A small seeded generator (mulberry32): the same seed always gives the same stage.
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function script(stageId, difficulty = 'normal', seed = 1) {
  const st = STAGE[stageId], D = DIFFICULTIES[difficulty];
  if (!st || !D) return [];
  const rnd = seeded(seed * 7919 + STAGES.indexOf(st) * 104729 + 13), out = [];
  const pick = (a, b) => a + (b - a) * rnd(), side = () => (rnd() < 0.5 ? -1 : 1);
  const add = (t, kind, o) => out.push({ t: +t.toFixed(2), kind, hp: Math.round(KINDS[kind].hp * (kind === 'plate' ? 1 : D.hp)), points: KINDS[kind].points, ...o });
  const plate = (t, d, life, o = {}) => add(t, 'plate', { x: +pick(-HALL.half + 0.6, HALL.half - 0.6).toFixed(2), d: +d.toFixed(1), h: +pick(0.9, 1.9).toFixed(2), life: +(life * D.life).toFixed(2), slide: 0, size: 1, ...o });
  const slider = (t, d, life) => plate(t, d, life, { slide: +(side() * pick(0.9, 1.6) * D.speed).toFixed(2) });
  const far = (t, life) => plate(t, pick(...HALL.tunnel), life, { x: +pick(-HALL.tunnelHalf + 0.25, HALL.tunnelHalf - 0.25).toFixed(2), h: +pick(0.8, 1.7).toFixed(2), size: 0.7 });
  // A walker crosses the hall at one depth, from one side to the other, and is gone when it gets there.
  const walker = (t, d) => { const s = side(), speed = pick(1.0, 1.5) * D.speed; add(t, 'walker', { x: -s * (HALL.half + 0.8), x1: s * (HALL.half + 0.8), d: +d.toFixed(1), h: 0, speed: +speed.toFixed(2), life: +((2 * HALL.half + 1.6) / speed).toFixed(2) }); };
  // A drone circles a point in the air on two sine waves, for a while, then leaves.
  // Its swing to either side stops short of the hall's walls, wherever its middle is.
  const drone = (t, life) => { const x = +pick(-3.5, 3.5).toFixed(2); add(t, 'drone', { x, d: +pick(10, 22).toFixed(1), h: +pick(1.7, 3.0).toFixed(2),
    ax: +Math.min(pick(1.2, 2.4), HALL.half - 0.4 - Math.abs(x)).toFixed(2), ah: +pick(0.3, 0.8).toFixed(2), ad: +pick(0.5, 2).toFixed(2),
    fx: +(pick(0.5, 0.9) * D.speed).toFixed(2), fh: +(pick(0.9, 1.5) * D.speed).toFixed(2), ph: +pick(0, 6.28).toFixed(2), life: +(life * D.life).toFixed(2) }); };

  if (st.id === 'warmup') {
    for (let i = 0; i < 6; i++) plate(1.5 + i * 2.6, pick(8, 13), 3.2);
    for (let i = 0; i < 5; i++) { const t = 17.5 + i * 3.4; plate(t, pick(10, 18), 3.0); plate(t + 0.5, pick(10, 18), 3.0); }
    for (let i = 0; i < 5; i++) slider(35 + i * 2.9, pick(12, 20), 3.2);
    for (let i = 0; i < 5; i++) { const t = 49.5 + i * 1.9; plate(t, pick(20, 27), 2.6, { size: 0.8 }); }
  } else if (st.id === 'walkers') {
    for (let i = 0; i < 9; i++) walker(2 + i * 7.4 + pick(0, 1.5), pick(9, 24));
    for (let i = 0; i < 9; i++) (i % 3 ? plate : slider)(5.5 + i * 7.4 + pick(0, 2), pick(9, 22), 3.0);
  } else if (st.id === 'swarm') {
    for (let w = 0; w < 5; w++) for (let i = 0; i < 2 + (w > 1) + (w > 3); i++) drone(2 + w * 13.5 + i * 1.3, 9.5);
    for (let i = 0; i < 6; i++) slider(8 + i * 10.5 + pick(0, 2), pick(10, 20), 2.8);
  } else if (st.id === 'dark') {
    for (let i = 0; i < 6; i++) walker(3 + i * 10.5 + pick(0, 2), pick(8, 20));
    for (let w = 0; w < 4; w++) for (let i = 0; i < 2; i++) drone(8 + w * 15.5 + i * 1.6, 9.5);
    for (let i = 0; i < 8; i++) plate(5 + i * 8.2 + pick(0, 2), pick(8, 18), 3.4);
  } else {
    for (let i = 0; i < 12; i++) far(2 + i * 6.6 + pick(0, 1.5), 4.6);
    for (let i = 0; i < 5; i++) walker(12 + i * 14.5 + pick(0, 2), pick(16, 27));
    for (let w = 0; w < 3; w++) for (let i = 0; i < 3; i++) drone(26 + w * 19 + i * 1.4, 9.5);
  }
  // Nothing appears so late that it cannot be dealt with before the clock runs out.
  return out.filter(s => s.t <= st.time - 2).sort((a, b) => a.t - b.t).map((s, i) => ({ id: i + 1, ...s }));
}

// Where a target is `age` seconds after it appeared: { x, d, h, heading } in range space. Heading is the way a walker
// faces along x (1 or -1); plates and drones face the firing line.
export function place(s, age) {
  if (s.kind === 'walker') return { x: s.x + Math.sign(s.x1 - s.x) * s.speed * age, d: s.d, h: 0, heading: Math.sign(s.x1 - s.x) };
  if (s.kind === 'drone') return { x: s.x + Math.sin(age * s.fx + s.ph) * s.ax, d: s.d + Math.sin(age * s.fx * 0.7 + s.ph * 1.3) * s.ad, h: s.h + Math.sin(age * s.fh + s.ph) * s.ah, heading: 0 };
  // A sliding plate turns back at the hall's (or the tunnel's) side walls.
  const half = (s.d > HALL.far ? HALL.tunnelHalf : HALL.half) - 0.3, span = 2 * half;
  if (!s.slide || span <= 0) return { x: s.x, d: s.d, h: s.h, heading: 0 };
  const u = (((s.x + half + s.slide * age) % (2 * span)) + 2 * span) % (2 * span);
  return { x: (u <= span ? u : 2 * span - u) - half, d: s.d, h: s.h, heading: 0 };
}

// The score a stage holds with every target taken and no streak: what the stars are measured against.
export const par = spawns => spawns.reduce((n, s) => n + s.points, 0);
export function starsFor(score, parScore) {
  if (!(parScore > 0)) return 0;
  return STAR_MARKS.filter(m => score >= Math.round(parScore * m)).length;
}
export const starScores = parScore => STAR_MARKS.map(m => Math.round(parScore * m));

// Stars across the stages: for each stage the most earned on any difficulty. `best` maps stage id to { easy, normal, hard } stars.
export function totalStars(best) {
  let n = 0;
  for (const st of STAGES) { const b = best?.[st.id]; if (b) n += Math.max(0, Math.min(3, Math.max(b.easy | 0, b.normal | 0, b.hard | 0))); }
  return n;
}
// A stage opens once the one before it has a star (on any difficulty); the first is always open.
export function openStages(best) {
  const open = [];
  for (const [i, st] of STAGES.entries()) {
    const prev = STAGES[i - 1], b = prev && best?.[prev.id];
    if (i === 0 || (b && Math.max(b.easy | 0, b.normal | 0, b.hard | 0) > 0)) open.push(st.id); else break;
  }
  return open;
}
// Three stars on every stage on Hard: the mark the old range's top unlocks move to.
export const legend = best => STAGES.every(st => (best?.[st.id]?.hard | 0) >= 3);
export const starsToOwnEverything = Math.max(...GUNS.map(g => g.stars));
