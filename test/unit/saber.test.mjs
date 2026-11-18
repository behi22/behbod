import test from 'node:test';
import assert from 'node:assert/strict';
import { BLADE, REACH, VIEW, guard, bladeEnds, segDist, meets, hum, LEVELS, TELL, PAIR_GAP, FIRST, levelOf, rng, newTraining, nextAim, stepTraining, blocked, stung, returned, rest } from '../../web/src/pure/saber.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const len = v => Math.hypot(...v);
const run = (tr, seconds, dt = 1 / 60) => { const ev = []; for (let t = 0; t < seconds - 1e-9; t += dt) ev.push(...stepTraining(tr, dt)); return ev; };

// A wide desktop, a laptop, a phone held upright and on its side: the blade has to fit them all.
const VIEWS = {
  laptop: VIEW,
  wide: { tanX: Math.tan(27.5 * Math.PI / 180) * 2.2, tanY: Math.tan(27.5 * Math.PI / 180) },
  upright: { tanX: Math.tan(Math.PI / 6) * 390 / 844, tanY: Math.tan(Math.PI / 6) },
  sideways: { tanX: Math.tan(Math.PI / 6) * 844 / 390, tanY: Math.tan(Math.PI / 6) },
};
const onScreen = (p, v) => [p[0] / -p[2] / v.tanX, p[1] / -p[2] / v.tanY];

test('on every screen shape the hand stays in the lower view and the whole blade stays in the picture', () => {
  for (const [name, v] of Object.entries(VIEWS)) for (const x of [-1, -0.5, 0, 0.5, 1]) for (const y of [-1, -0.3, 0, 0.6, 1]) {
    const g = guard(x, y, v), { a, b } = bladeEnds(g);
    const h = onScreen(a, v), t = onScreen(b, v);
    assert.ok(a[2] < -0.3 && b[2] < a[2], `${name}: the blade points away from the eye`);
    assert.ok(Math.abs(h[0]) <= 0.8 + 1e-9 && h[1] >= -0.85 - 1e-9 && h[1] <= 0.15 + 1e-9, `${name} ${x},${y}: hand at ${h}`);
    assert.ok(Math.abs(t[0]) < 0.98 && t[1] < 0.98 && t[1] > -0.3, `${name} ${x},${y}: tip at ${t}`);
    assert.ok(near(len(g.dir), 1, 1e-12));
  }
});

test('the hand follows the pointer, and the blade leans out the same way and rises with it', () => {
  const right = guard(0.8, 0), left = guard(-0.8, 0), mid = guard(0, 0);
  assert.ok(right.hand[0] > 0 && left.hand[0] < 0 && near(mid.hand[0], 0));
  assert.ok(right.dir[0] > 0.1 && left.dir[0] < -0.1 && near(mid.dir[0], 0));
  const low = bladeEnds(guard(0, -1)), high = bladeEnds(guard(0, 1));
  assert.ok(high.a[1] > low.a[1] && high.b[1] > low.b[1]);
});

test('the blade grows from the emitter as it lights, to its full length', () => {
  const g = guard(0.2, 0.1);
  const off = bladeEnds(g, 0), half = bladeEnds(g, 0.5), full = bladeEnds(g, 1), over = bladeEnds(g, 3);
  assert.ok(near(len([off.b[0] - off.a[0], off.b[1] - off.a[1], off.b[2] - off.a[2]]), 0));
  assert.ok(near(len([half.b[0] - half.a[0], half.b[1] - half.a[1], half.b[2] - half.a[2]]), BLADE / 2, 1e-12));
  assert.ok(near(len([full.b[0] - full.a[0], full.b[1] - full.a[1], full.b[2] - full.a[2]]), BLADE, 1e-12));
  assert.deepEqual(over.b, full.b, 'never longer than the blade');
});

test('a pointer off the screen or not a number is held at the edge or the middle', () => {
  assert.deepEqual(guard(5, -5), guard(1, -1));
  assert.deepEqual(guard(NaN, undefined), guard(0, 0));
});

test('segment distance: crossing, parallel, apart, end to end and points', () => {
  assert.ok(near(segDist([-1, 0, 0], [1, 0, 0], [0, -1, 0.3], [0, 1, 0.3]), 0.3, 1e-12), 'crossing at a gap');
  assert.ok(near(segDist([0, 0, 0], [1, 0, 0], [0, 0.5, 0], [1, 0.5, 0]), 0.5, 1e-12), 'parallel');
  assert.ok(near(segDist([0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]), 1, 1e-12), 'in a line, apart');
  assert.ok(near(segDist([0, 0, 0], [0, 0, 0], [3, 4, 0], [3, 4, 0]), 5, 1e-12), 'two points');
  assert.ok(near(segDist([0, 0, 0], [0, 0, 0], [-1, 1, 0], [1, 1, 0]), 1, 1e-12), 'a point and a segment');
  assert.ok(near(segDist([0, 0, 0], [1, 0, 0], [1.5, 1, 0], [3, 1, 0]), Math.hypot(0.5, 1), 1e-12), 'nearest at the ends');
});

test('a bolt flying into the blade is blocked; one that passes wide is not', () => {
  const pose = bladeEnds(guard(0, 0)), mid = pose.a.map((v, i) => v + pose.dir[i] * BLADE * 0.6);
  // Straight at the eye through the middle of the blade.
  const from = [mid[0], mid[1], mid[2] - 0.05], to = [mid[0], mid[1], mid[2] + 0.05];
  assert.equal(meets(from, to, pose, pose).hit, true);
  const wide = [mid[0] + REACH * 2, mid[1], mid[2] - 0.05], wideTo = [mid[0] + REACH * 2, mid[1], mid[2] + 0.05];
  assert.equal(meets(wide, wideTo, pose, pose).hit, false);
});

test('a fast swing that carries the blade across a bolt between two frames still blocks it', () => {
  const was = bladeEnds(guard(-0.9, 0)), now = bladeEnds(guard(0.9, 0));
  // The bolt sits still where the middle of the blade passes; the blade is far left one frame and far right the next.
  const a = was.a.map((v, i) => (v + now.a[i]) / 2), b = was.b.map((v, i) => (v + now.b[i]) / 2), mid = a.map((v, i) => (v + b[i]) / 2);
  assert.equal(meets(mid, mid, was, was).hit, false, 'not at the start');
  assert.equal(meets(mid, mid, now, now).hit, false, 'not at the end');
  assert.equal(meets(mid, mid, was, now).hit, true, 'but on the way across');
  // A bolt well behind the blade's path is not touched by the swing.
  const behind = [mid[0], mid[1], mid[2] - 0.3];
  assert.equal(meets(behind, behind, was, now).hit, false);
});

test('a bolt fast enough to jump the blade in one frame is still caught', () => {
  const pose = bladeEnds(guard(0, 0)), mid = pose.a.map((v, i) => v + pose.dir[i] * BLADE * 0.5);
  const from = [mid[0], mid[1], mid[2] - 0.6], to = [mid[0], mid[1], mid[2] + 0.6];
  assert.equal(meets(from, to, pose, pose).hit, true);
});

test('the hum rises and brightens with the swing, and rests below a gentle wave', () => {
  const still = hum(0), gentle = hum(0.5), mid = hum(3), fast = hum(10);
  assert.deepEqual(still, { pitch: 1, swing: 0, bright: 700 });
  assert.deepEqual(gentle, still);
  assert.ok(mid.pitch > 1 && mid.pitch < fast.pitch && mid.swing > 0 && mid.swing < 1);
  assert.ok(near(fast.pitch, 1.26) && fast.swing === 1 && fast.bright === 3000);
  assert.deepEqual(hum(NaN), still);
});

test('levels: four clean blocks to the next, faster and closer each time, capped at the last', () => {
  assert.deepEqual([0, 3, 4, 7, 8, 15, 16, 99, -3].map(levelOf), [0, 0, 1, 1, 2, 3, 4, 4, 0]);
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].speed > LEVELS[i - 1].speed && LEVELS[i].gap < LEVELS[i - 1].gap && LEVELS[i].pair >= LEVELS[i - 1].pair);
  }
});

test('the seeded random source repeats and stays in 0..1', () => {
  const a = rng(42), b = rng(42), c = rng(43);
  const xs = Array.from({ length: 200 }, a), ys = Array.from({ length: 200 }, b), zs = Array.from({ length: 200 }, c);
  assert.deepEqual(xs, ys);
  assert.notDeepEqual(xs, zs);
  assert.ok(xs.every(v => v >= 0 && v < 1));
});

test('the drone waits, warns, then fires; never a shot without a warning first', () => {
  const tr = newTraining(7);
  assert.deepEqual(run(tr, FIRST - 0.05), [], 'quiet at first');
  const ev = run(tr, TELL + 0.2);
  assert.deepEqual(ev.map(e => e.type), ['tell', 'fire']);
  const f = ev[1];
  assert.ok(Math.abs(f.aim[0]) <= 0.85 && Math.abs(f.aim[1]) <= 0.8 && f.along >= 0.4 && f.along <= 0.85 && f.speed === LEVELS[0].speed);
});

test('at the first level shots are a gap apart and each one comes somewhere new', () => {
  const tr = newTraining(3), ev = run(tr, 30);
  const fires = ev.filter(e => e.type === 'fire');
  assert.ok(fires.length >= 12 && fires.length <= 14, `${fires.length} shots in 30 s`);
  for (let i = 1; i < fires.length; i++) assert.ok(Math.hypot(fires[i].aim[0] - fires[i - 1].aim[0], fires[i].aim[1] - fires[i - 1].aim[1]) >= 0.5);
  assert.ok(ev.every((e, i) => e.type !== 'fire' || ev[i - 1]?.type === 'tell'), 'every shot warned');
});

test('high up, some shots come in pairs, never three at once, and a pair never skips its warning', () => {
  const tr = newTraining(11);
  tr.streak = 16;
  const ev = run(tr, 60, 1 / 60);
  let pairs = 0, triple = false;
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].type !== 'fire') continue;
    if (ev[i - 1]?.type === 'fire') { pairs++; if (ev[i - 2]?.type === 'fire') triple = true; }
    else assert.equal(ev[i - 1]?.type, 'tell');
    assert.equal(ev[i].speed, LEVELS[4].speed);
  }
  assert.ok(pairs >= 5, `${pairs} pairs`);
  assert.equal(triple, false);
});

test('one long frame fires everything that was due, in order', () => {
  const a = newTraining(5), b = newTraining(5);
  const slow = run(a, 10, 1 / 120), fast = stepTraining(b, 10);
  assert.deepEqual(fast.map(e => e.type), slow.map(e => e.type));
  assert.deepEqual(fast.filter(e => e.type === 'fire').map(e => e.aim), slow.filter(e => e.type === 'fire').map(e => e.aim));
});

test('no time, no shots: a stopped clock or a bad step does nothing', () => {
  const tr = newTraining(1);
  for (const dt of [0, -1, NaN, undefined]) assert.deepEqual(stepTraining(tr, dt), []);
  assert.equal(tr.t, 0);
});

test('blocks build the streak and the best; a sting clears the streak but keeps the best', () => {
  const tr = newTraining(1, 4);
  assert.equal(tr.best, 4);
  for (let i = 0; i < 5; i++) blocked(tr);
  assert.equal(tr.streak, 5); assert.equal(tr.best, 5);
  stung(tr);
  assert.equal(tr.streak, 0); assert.equal(tr.best, 5); assert.equal(tr.stung, 1);
  blocked(tr); returned(tr);
  assert.equal(tr.blocked, 6); assert.equal(tr.returned, 1); assert.equal(tr.streak, 1);
  assert.equal(newTraining(1, 'x').best, 0, 'a bad stored best starts at none');
});

test('switching the blade off and on lets the drone start over gently, streak kept', () => {
  const tr = newTraining(9);
  run(tr, FIRST + TELL - 0.1);
  assert.equal(tr.phase, 'tell');
  blocked(tr); blocked(tr);
  rest(tr);
  assert.equal(tr.phase, 'wait'); assert.equal(tr.left, FIRST); assert.equal(tr.streak, 2);
  assert.deepEqual(run(tr, FIRST - 0.05), []);
});

test('the next aim moves far enough from the last, further once the drone gets serious', () => {
  const tr = newTraining(21);
  let moved = 0;
  for (let i = 0; i < 200; i++) {
    const prev = tr.last, { aim } = nextAim(tr);
    if (!prev || Math.hypot(aim[0] - prev[0], aim[1] - prev[1]) >= 0.5) moved++;
    tr.last = aim;
  }
  assert.equal(moved, 200);
  tr.streak = 8;
  let far = 0;
  for (let i = 0; i < 200; i++) { const prev = tr.last, { aim } = nextAim(tr); if (Math.hypot(aim[0] - prev[0], aim[1] - prev[1]) >= 0.8) far++; tr.last = aim; }
  assert.ok(far >= 195, `${far} of 200 moved at least 0.8`);
  assert.ok(PAIR_GAP < LEVELS[LEVELS.length - 1].gap);
});
