import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { R, G, REACH, RISE, EARLY, PUSH, STEP, newBall, touch, stepBall, advance, height, cornerOf } from '../../web/src/pure/keepy.js';

const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url)));
const corner = cornerOf(meta);
const world = (player = null) => ({ bounds: corner.bounds, solids: corner.solids, player });
// A seeded stand-in for Math.random.
const seeded = (s = 7) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const run = (b, secs, w = world()) => { const ev = []; for (let t = 0; t < secs; t += STEP) ev.push(...stepBall(b, STEP, w)); return ev; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inGoal = (b, s) => Math.hypot(b.p[0] - clamp(b.p[0], s.min[0], s.max[0]), b.p[1] - clamp(b.p[1], 0, s.top), b.p[2] - clamp(b.p[2], s.min[1], s.max[1])) < R - 1e-6;
function inside(b) {
  const B = corner.bounds, e = 1e-6;
  return b.p[0] >= B.min[0] + R - e && b.p[0] <= B.max[0] - R + e && b.p[2] >= B.min[1] + R - e && b.p[2] <= B.max[1] - R + e && b.p[1] >= R - e && b.p[1] <= B.top - R + e;
}

test('the corner is the floor under the mezzanine from the east bookshelf to the partition, the goal solid in it', () => {
  const B = corner.bounds, goal = meta.colliders.find(c => c.name === 'goal');
  assert.equal(B.max[0], 11.1);
  assert.equal(B.max[1], -0.38);
  assert.equal(B.top, 2.75);
  assert.ok(Math.abs(B.min[0] - 8.7) < 1e-9 && Math.abs(B.min[1] + 4.4) < 1e-9);
  assert.deepEqual(corner.solids[0].min, [goal.min[0], -goal.max[1]]);
  // Its own spot is clear of the goal and of the penalty lane (the spot to the line, y 2.25).
  const [hx, , hz] = corner.home;
  assert.ok(hx > B.min[0] + 0.5 && hx < B.max[0] - 0.5 && -hz > goal.max[1] + 0.5 && -hz < -B.min[1] - 0.5);
  assert.equal(cornerOf({ ...meta, colliders: meta.colliders.filter(c => c.name !== 'goal') }), null);
  assert.equal(cornerOf({ colliders: [] }), null);
});

test('a dropped ball bounces lower each time, then lies still on the floor and stays there', () => {
  const b = newBall(corner.home);
  b.p[1] = 1.5; b.rest = false; b.floor = false;
  const ev = run(b, 6), bounces = ev.filter(e => e.type === 'bounce').map(e => e.speed);
  assert.ok(bounces.length >= 3, `${bounces.length} bounces`);
  for (let i = 1; i < bounces.length; i++) assert.ok(bounces[i] < bounces[i - 1]);
  assert.ok(Math.abs(bounces[0] - Math.sqrt(2 * G * (1.5 - R))) < 0.1);
  assert.ok(b.rest && b.floor && b.p[1] === R);
  assert.equal(ev.filter(e => e.type === 'rest').length, 1);
  const at = b.p.slice();
  assert.deepEqual(run(b, 2), []);
  assert.deepEqual(b.p, at);
});

test('a touch sends it up as high as it says and it comes back down in about a second', () => {
  const b = newBall(corner.home), rand = seeded(3);
  assert.equal(touch(b, [0, 0], rand), 'touch');
  assert.equal(b.count, 1);
  let top = 0, t = 0;
  while (!b.floor && t < 3) { stepBall(b, STEP, world()); top = Math.max(top, height(b)); if (b.p[1] <= R + 1e-9) break; t += STEP; }
  assert.ok(top > RISE[0] - 0.05 && top < RISE[1] + 0.02, `top ${top}`);
  assert.ok(t > 0.85 && t < 1.05, `${t} s in the air`);
});

test('pressing while it rises, or before it drops into reach, locks out the next press for a moment', () => {
  const b = newBall(corner.home), rand = seeded(5);
  touch(b, [0, 0], rand);
  run(b, 0.3);
  assert.ok(b.v[1] > 0);
  assert.equal(touch(b, [0, 0], rand), 'early');
  run(b, EARLY / 2);
  assert.equal(touch(b, [0, 0], rand), 'wait');
  run(b, EARLY);
  // Over the top and still above reach.
  const c = newBall(corner.home);
  c.p[1] = REACH + R + 0.4; c.v = [0, -0.5, 0]; c.rest = false; c.floor = false;
  assert.equal(touch(c, [0, 0], rand), 'early');
  // Falling into reach, and lying on the floor, it can be touched.
  const d = newBall(corner.home);
  d.p[1] = R + 0.5; d.v = [0, -2, 0]; d.rest = false; d.floor = false;
  assert.equal(touch(d, [0, 0], rand), 'touch');
  assert.equal(touch(newBall(corner.home), [0, 0], rand), 'touch');
  // Pressing every tenth of a second all the way down never gets a touch in: each early press locks the next out.
  const b2 = newBall(corner.home);
  touch(b2, [0, 0], rand);
  let touches = 0;
  for (let i = 0; i < 9; i++) { run(b2, 0.1); if (touch(b2, [0, 0], rand) === 'touch') touches++; }
  assert.ok(touches <= 1, `${touches} touches from pressing ten times a second`);
});

test('a touch straight after a touch does nothing', () => {
  const b = newBall(corner.home);
  assert.equal(touch(b, [0, 0], seeded(1)), 'touch');
  assert.equal(touch(b, [0, 0], seeded(1)), 'wait');
  assert.equal(b.count, 1);
});

test('touches made in time keep it up and are counted; the run ends when it lands, and the best is kept', () => {
  const b = newBall(corner.home), rand = seeded(11);
  touch(b, [0, 0], rand);
  for (let n = 2; n <= 6; n++) {
    // Wait for it to come down into reach, then meet it half way down.
    while (!(b.v[1] < 0 && height(b) < 0.5)) stepBall(b, STEP, world());
    assert.equal(touch(b, [0, 0], rand), 'touch');
    assert.equal(b.count, n);
  }
  const ev = run(b, 3), land = ev.filter(e => e.type === 'land');
  assert.deepEqual(land.map(e => [e.count, e.record]), [[6, true]]);
  assert.equal(b.count, 0);
  assert.equal(b.best, 6);
  assert.equal(b.last, 6);
  // A shorter run after it leaves the best alone, and says it was no record.
  touch(b, [0, 0], rand);
  assert.deepEqual(run(b, 3).filter(e => e.type === 'land').map(e => [e.count, e.record]), [[1, false]]);
  assert.equal(b.best, 6);
  assert.equal(b.last, 1);
});

test('wherever it is touched it drifts back toward its spot, and a push is capped', () => {
  const b = newBall(corner.home), mid = () => 0.5;
  b.p[0] = corner.home[0] - 0.8; b.p[2] = corner.home[2] + 0.5;
  touch(b, [0, 0], mid);
  const dx = corner.home[0] - b.p[0], dz = corner.home[2] - b.p[2];
  assert.ok(b.v[0] * dx + b.v[2] * dz > 0);
  const c = newBall(corner.home);
  touch(c, [5, -5], mid);
  assert.ok(Math.hypot(c.v[0], c.v[2]) <= PUSH + 1e-9);
});

test('it never leaves the corner, goes into the goal, through the floor or the ceiling, whatever is done to it', () => {
  const rand = seeded(19);
  for (let trial = 0; trial < 40; trial++) {
    const b = newBall(corner.home);
    // Start anywhere, flung hard in any direction, touched at random with hard pushes.
    b.p = [corner.bounds.min[0] + 0.2 + rand() * 2, 0.2 + rand() * 2, corner.bounds.min[1] + 0.2 + rand() * 3.5];
    b.v = [(rand() - 0.5) * 30, (rand() - 0.5) * 30, (rand() - 0.5) * 30];
    b.rest = false; b.floor = false;
    for (let i = 0; i < 1200; i++) {
      advance(b, rand() < 0.05 ? 0.5 : 1 / 60, world());
      if (rand() < 0.08) touch(b, [(rand() - 0.5) * 8, (rand() - 0.5) * 8], rand);
      assert.ok(inside(b), `trial ${trial} step ${i}: ${b.p.map(v => v.toFixed(3))}`);
      assert.ok(!inGoal(b, corner.solids[0]), `in the goal: ${b.p.map(v => v.toFixed(3))}`);
    }
  }
});

test('a long frame is taken in small steps, so even a fast ball cannot pass through the goal', () => {
  const b = newBall(corner.home), s = corner.solids[0];
  b.p = [s.min[0] - 0.3, R, (s.min[1] + s.max[1]) / 2]; b.v = [12, 0, 0]; b.rest = false; b.floor = true;
  advance(b, 0.5, world());
  assert.ok(b.p[0] < s.min[0], `${b.p[0]}`);
  assert.ok(b.v[0] < 0);
});

test('I am solid to it: walking into it pushes it along, gently, and it stays in the corner', () => {
  const b = newBall(corner.home);
  const me = { x: b.p[0] - 0.2, z: b.p[2], v: [1.9, 0] };
  stepBall(b, STEP, world(me));
  assert.ok(Math.hypot(b.p[0] - me.x, b.p[2] - me.z) >= 0.28 + R - 1e-9);
  assert.ok(!b.rest && b.v[0] > 0 && Math.hypot(b.v[0], b.v[2]) <= 1.0 + 1e-9);
  // Running into it from far off still sends it no faster than a gentle roll, and walking it into the wall keeps it in.
  const c = newBall(corner.home);
  for (let i = 0; i < 600; i++) { const p = { x: c.p[0] - 0.3, z: c.p[2], v: [5.6, 0] }; stepBall(c, STEP, world(p)); assert.ok(Math.hypot(c.v[0], c.v[2]) <= 1.0 + 1e-9 && inside(c)); }
  assert.ok(Math.abs(c.p[0] - (corner.bounds.max[0] - R)) < 1e-9);
  // Squeezed against the wall it does not knock against it over and over: it squirts off along the wall, away from me.
  const w = newBall(corner.home), z0 = w.p[2];
  w.p[0] = corner.bounds.max[0] - R; w.rest = false;
  const knocks = [];
  for (let i = 0; i < 240; i++) { const p = { x: w.p[0] - 0.3, z: w.p[2] - 0.05, v: [1.9, 0] }; knocks.push(...stepBall(w, STEP, world(p)).filter(e => e.type === 'wall')); assert.ok(inside(w)); }
  assert.equal(knocks.length, 0);
  assert.ok(w.p[2] - z0 > 0.2, `slid ${(w.p[2] - z0).toFixed(3)} m along the wall`);
  // Squeezed against the goal, the same.
  const s = corner.solids[0], g = newBall(corner.home);
  g.p = [s.min[0] - R, R, (s.min[1] + s.max[1]) / 2]; g.rest = false;
  const hits = [];
  for (let i = 0; i < 120; i++) { const p = { x: g.p[0] - 0.3, z: g.p[2], v: [1.9, 0] }; hits.push(...stepBall(g, STEP, world(p)).filter(e => e.type === 'wall')); }
  assert.equal(hits.length, 0);
  // Away from it, it pays me no mind.
  const d = newBall(corner.home);
  assert.deepEqual(stepBall(d, STEP, world({ x: d.p[0] + 2, z: d.p[2], v: [0, 0] })), []);
  assert.ok(d.rest);
});

test("landing on the mini goal's top is a landing: it ends a run, and the ball can lie there, or roll off and drop", () => {
  const s = corner.solids[0], mid = [(s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2];
  const b = newBall(corner.home);
  b.p = [mid[0], s.top + R + 0.8, mid[1]]; b.v = [0, 0, 0]; b.rest = false; b.floor = false; b.count = 3;
  const ev = run(b, 4);
  assert.deepEqual(ev.filter(e => e.type === 'land').map(e => e.count), [3]);
  assert.ok(b.rest && Math.abs(b.p[1] - (s.top + R)) < 0.011, `${b.p[1]}`);
  // Lying there it is still in reach of a touch.
  assert.equal(touch(b, [0, 0], seeded(2)), 'touch');
  // Rolling across the top, it goes over the edge and down to the floor.
  const c = newBall(corner.home);
  c.p = [mid[0], s.top + R, mid[1]]; c.v = [0, 0, -1.3]; c.rest = false; c.floor = true; c.on = s;
  run(c, 4);
  assert.ok(c.rest && Math.abs(c.p[1] - R) < 1e-9 && c.p[2] < s.min[1], c.p.map(v => v.toFixed(3)).join());
});
