// Keepy-ups in the keeper's corner: a ball that falls, bounces, rolls and comes to rest, and the rules for a touch.
// Three's axes (y up, the corner's floor at 0), metres and seconds. The ball stays inside `bounds` and out of `solids`.
export const R = 0.1, G = 9.81, REACH = 1.0;
const AIR = 0.05, BOUNCE = 0.68, SKID = 0.86, ROLL = 1.0, SETTLE = 0.45, STILL = 0.03, WALL = 0.5, BODY = 0.28, TALL = 1.75, CARRY = 1.0, SLIP = 0.6;
// A touch sends the ball this high above where it was met; a press that comes too early locks out the next for a moment.
export const RISE = [0.95, 1.25], COOL = 0.25, EARLY = 0.45, PUSH = 0.8;

export function newBall(home) {
  return { p: [home[0], R, home[2]], v: [0, 0, 0], spin: [0, 0, 0], home: [home[0], home[2]], rest: true, floor: true, on: null, count: 0, best: 0, last: 0, cool: 0, lock: 0 };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = (x, z) => Math.hypot(x, z);

// How high the bottom of the ball is off the floor.
export const height = b => b.p[1] - R;

// A touch meets the ball on its way down and in reach, or off the floor. `aim`: a push across the floor in metres a
// second (a tap on one side of the ball sends it the other way); `rand`: Math.random or a seeded stand-in. Returns
// 'touch', 'early' (still rising or out of reach: the next press is locked out a moment, so pressing over and over
// does not work) or 'wait' (straight after a touch, or after a press that came too early).
export function touch(b, aim = [0, 0], rand = Math.random) {
  if (b.lock > 0 || b.cool > 0) return 'wait';
  const h = height(b);
  if (!b.floor && (h > REACH || b.v[1] > 0)) { b.lock = EARLY; return 'early'; }
  // Met low it goes up cleanly; met at the top of reach it scatters more. It always drifts back toward its spot.
  const scatter = 0.12 + 0.3 * clamp(h / REACH, 0, 1);
  const rise = RISE[0] + (RISE[1] - RISE[0]) * rand();
  const hx = (b.home[0] - b.p[0]) * 0.7 + aim[0] + (rand() - 0.5) * 2 * scatter;
  const hz = (b.home[1] - b.p[2]) * 0.7 + aim[1] + (rand() - 0.5) * 2 * scatter;
  const s = hyp(hx, hz), k = s > PUSH ? PUSH / s : 1;
  b.v = [hx * k, Math.sqrt(2 * G * rise), hz * k];
  b.spin = [-b.v[2] / R * 0.3 + (rand() - 0.5) * 6, (rand() - 0.5) * 4, b.v[0] / R * 0.3];
  b.count += 1;
  b.rest = false; b.floor = false; b.cool = COOL;
  return 'touch';
}

// I am a solid upright body (a circle `BODY` across, `TALL` high): walking into the ball pushes it along, no faster
// than a gentle roll. True when it pressed against me this step.
function body(b, player, ev) {
  if (!player || b.p[1] > TALL + R) return false;
  const dx = b.p[0] - player.x, dz = b.p[2] - player.z, d = hyp(dx, dz), min = BODY + R;
  if (d >= min) return false;
  const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
  b.p[0] = player.x + nx * min; b.p[2] = player.z + nz * min;
  const pv = player.v || [0, 0], into = (b.v[0] - pv[0]) * nx + (b.v[2] - pv[1]) * nz;
  if (into < 0) { b.v[0] -= into * nx * 1.3; b.v[2] -= into * nz * 1.3; ev.push({ type: 'nudge' }); }
  const s = hyp(b.v[0], b.v[2]);
  if (s > CARRY) { b.v[0] *= CARRY / s; b.v[2] *= CARRY / s; }
  b.rest = false;
  return true;
}

// Out of a solid box { min: [x, z], max: [x, z], top, give }: back out of its nearest face, keeping `give` of the speed
// (none while I squeeze it against the box: then it is a press, not a knock). Coming down onto its top is a landing
// like the floor's: that returns the speed it came down at, and the step bounces it.
function solid(b, s, ev, pressed) {
  const c = [clamp(b.p[0], s.min[0], s.max[0]), clamp(b.p[1], 0, s.top), clamp(b.p[2], s.min[1], s.max[1])];
  const d3 = [b.p[0] - c[0], b.p[1] - c[1], b.p[2] - c[2]], d = Math.hypot(...d3);
  if (d >= R) return null;
  let n, push;
  if (d > 1e-6) { n = d3.map(v => v / d); push = R - d; }
  else {
    // The centre is inside: out through the nearest side or the top.
    const out = [[b.p[0] - s.min[0], [-1, 0, 0]], [s.max[0] - b.p[0], [1, 0, 0]], [b.p[2] - s.min[1], [0, 0, -1]], [s.max[1] - b.p[2], [0, 0, 1]], [s.top - b.p[1], [0, 1, 0]]];
    const near = out.reduce((a, o) => (o[0] < a[0] ? o : a));
    n = near[1]; push = near[0] + R;
  }
  for (let i = 0; i < 3; i++) b.p[i] += n[i] * push;
  const into = b.v[0] * n[0] + b.v[1] * n[1] + b.v[2] * n[2];
  if (into >= 0) return null;
  if (n[1] > 0.7) return -into;
  for (let i = 0; i < 3; i++) b.v[i] -= (1 + (pressed ? 0 : s.give ?? WALL)) * into * n[i];
  if (!pressed && -into > 0.4) ev.push({ type: 'wall', speed: -into });
  return null;
}
// Still lying on a box's top: its middle over the top, at the top's height.
const onTop = (b, s) => b.p[0] >= s.min[0] && b.p[0] <= s.max[0] && b.p[2] >= s.min[1] && b.p[2] <= s.max[1] && Math.abs(b.p[1] - s.top - R) < 0.01;

// One step of `dt` seconds. `world`: { bounds: { min: [x, z], max: [x, z], top }, solids: [...], player: { x, z, v: [vx, vz] } }.
// Returns events: bounce (with its speed), land (the run of touches that ended, and whether it beat the best), wall,
// nudge, rest.
export function stepBall(b, dt, world) {
  const ev = [];
  b.cool = Math.max(0, b.cool - dt); b.lock = Math.max(0, b.lock - dt);
  const pressed = body(b, world.player, ev);
  if (b.rest) return ev;
  const air = !b.floor;
  if (air) {
    b.v[1] -= G * dt;
    const k = 1 - AIR * dt;
    for (let i = 0; i < 3; i++) b.v[i] *= k;
  } else {
    // Rolling: it slows to a stop, turning as it goes.
    const s = hyp(b.v[0], b.v[2]), ns = Math.max(0, s - ROLL * dt);
    if (s > 1e-9) { b.v[0] *= ns / s; b.v[2] *= ns / s; }
    b.v[1] = 0;
    b.spin = [-b.v[2] / R, 0, b.v[0] / R];
  }
  for (let i = 0; i < 3; i++) b.p[i] += b.v[i] * dt;
  let landed = null;
  if (b.p[1] <= R) { b.p[1] = R; b.on = null; if (b.v[1] < 0) landed = -b.v[1]; }
  // The corner's edges (its walls, and where its floor ends), and the low ceiling under the mezzanine. Squeezed
  // against an edge by me, it stops against it and squirts off sideways, away from me, rather than knocking.
  const B = world.bounds;
  const edge = (i, at, into) => {
    b.p[i] = at;
    if (!into) return;
    if (!pressed) { if (Math.abs(b.v[i]) > 0.4) ev.push({ type: 'wall', speed: Math.abs(b.v[i]) }); b.v[i] *= -WALL; return; }
    b.v[i] = 0;
    const k = 2 - i, off = b.p[k] - (k === 0 ? world.player.x : world.player.z);
    if (Math.abs(b.v[k]) < SLIP) b.v[k] = (off < 0 ? -1 : 1) * SLIP;
  };
  for (const [i, j] of [[0, 0], [2, 1]]) {
    if (b.p[i] < B.min[j] + R) edge(i, B.min[j] + R, b.v[i] < 0);
    if (b.p[i] > B.max[j] - R) edge(i, B.max[j] - R, b.v[i] > 0);
  }
  if (b.p[1] > B.top - R) { b.p[1] = B.top - R; if (b.v[1] > 0) b.v[1] *= -WALL; }
  for (const s of world.solids || []) { const l = solid(b, s, ev, pressed); if (l !== null) { landed = l; b.on = s; } }
  // Down on the floor or a top: a bounce, lower each time, until it settles and rolls. Any landing ends a run.
  if (landed !== null) {
    ev.push({ type: 'bounce', speed: landed });
    if (b.count) { const record = b.count > b.best; b.last = b.count; b.best = Math.max(b.best, b.count); ev.push({ type: 'land', count: b.count, record }); b.count = 0; }
    if (landed * BOUNCE < SETTLE) { b.v[1] = 0; b.floor = true; }
    else { b.v[1] = landed * BOUNCE; b.v[0] *= SKID; b.v[2] *= SKID; b.floor = false; b.spin = [-b.v[2] / R, b.spin[1] * 0.5, b.v[0] / R]; }
  }
  // Rolled off the edge of a top, it falls.
  if (b.floor && b.on && !onTop(b, b.on)) { b.floor = false; b.on = null; }
  if (b.floor && hyp(b.v[0], b.v[2]) < STILL) { b.v = [0, 0, 0]; b.spin = [0, 0, 0]; b.rest = true; ev.push({ type: 'rest' }); }
  return ev;
}

// A stretch of time in fixed steps, so a slow frame never lets the ball pass through a wall or the floor.
export const STEP = 1 / 120;
export function advance(b, dt, world, max = 0.1) {
  const ev = [];
  let left = Math.min(dt, max);
  while (left > 1e-9) { const h = Math.min(STEP, left); ev.push(...stepBall(b, h, world)); left -= h; }
  return ev;
}

// The ball's corner in three's axes, from the room's colliders (Blender axes): the floor under the mezzanine from the
// library's east bookshelf to the partition, the mini goal solid inside it (its net gives little back). The ball's own
// spot is north of the goal's lane, clear of the penalty run.
export function cornerOf(meta) {
  const col = n => (meta.colliders || []).find(c => c.name === n);
  const goal = col('goal'), part = col('wall_partition'), shelf = col('bookshelf_e'), slab = col('mezz_slab'), line = meta.points?.pen_line;
  if (!goal || !part || !shelf || !slab || !line) return null;
  const east = part.min[0], north = Math.min(part.max[1], slab.max[1]) - 0.1;
  const bounds = { min: [line[0] - 1.95, -north], max: [east, -shelf.max[1]], top: slab.min[2] };
  const solids = [{ min: [goal.min[0], -goal.max[1]], max: [goal.max[0], -goal.min[1]], top: goal.max[2], give: 0.2 }];
  const home = [east - 0.85, R, -(goal.max[1] + 0.9)];
  return { bounds, solids, home };
}
