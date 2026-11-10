import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, step, points, spawnGap, setBlaster, fire, BLASTERS, POWER_TIME, LIVES, SHIP_Y, W, H } from '../../web/src/games/pure/skills.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const idle = { left: false, right: false, fire: false };
// A game with nothing arriving, so a test sets up exactly what is on the field.
const quiet = () => Object.assign(newGame(), { spawn: 1e9 });

test('points: skills 10, bugs 25, Claude 50, and the combo multiplies up to four times', () => {
  assert.equal(points('skill', 1), 10);
  assert.equal(points('bug', 1), 25);
  assert.equal(points('claude', 1), 50);
  assert.equal(points('skill', 5), 20);
  assert.equal(points('skill', 100), 40);
});

test('things arrive faster as the score climbs, but never quicker than half the starting gap', () => {
  const r = () => 0.5;
  assert.ok(spawnGap(0, r) > spawnGap(1500, r));
  assert.equal(spawnGap(3000, r), spawnGap(9000, r));
  assert.ok(spawnGap(9000, () => 0) >= 0.45 * 0.5 - 1e-9);
});

test('the ship moves with the keys and stays on the field', () => {
  const st = quiet();
  step(st, 0.5, { ...idle, left: true }, Math.random);
  assert.ok(st.x < W / 2);
  for (let i = 0; i < 20; i++) step(st, 0.5, { ...idle, left: true }, Math.random);
  assert.equal(st.x, 40);
  for (let i = 0; i < 40; i++) step(st, 0.5, { ...idle, right: true }, Math.random);
  assert.equal(st.x, W - 40);
});

test('each blaster fires its own pattern, and holding fire waits for the cooldown', () => {
  const counts = BLASTERS.map((_, i) => { const st = quiet(); setBlaster(st, i); fire(st); return st.shots.length; });
  assert.deepEqual(counts, [1, 3, 1, 1]);
  const st = quiet();
  step(st, 0.01, { ...idle, fire: true }, Math.random);
  step(st, 0.01, { ...idle, fire: true }, Math.random);
  assert.equal(st.shots.length, 1, 'the second press is inside the cooldown');
  step(st, BLASTERS[0].cool, { ...idle, fire: true }, Math.random);
  assert.equal(st.shots.length, 2);
});

test('a skill falls to one hit and scores; a bug takes two', () => {
  const st = quiet();
  st.foes.push({ kind: 'skill', x: W / 2, y: 300, vy: 0, hp: 1, label: 'Python' }, { kind: 'bug', x: 200, y: 300, vy: 0, hp: 2, ph: 0 });
  st.shots.push({ x: W / 2, y: 300, vx: 0, vy: 0, r: 4 });
  const ev = step(st, 0.001, idle, () => 0.99);
  assert.ok(ev.some(e => e.kill === 'skill'));
  assert.equal(st.score, 10);
  const bug = st.foes.find(f => f.kind === 'bug');
  st.shots.push({ x: bug.x, y: bug.y, vx: 0, vy: 0, r: 4 });
  step(st, 0.001, idle, () => 0.99);
  assert.equal(st.foes.filter(f => f.kind === 'bug').length, 1, 'still there after one hit');
  st.shots.push({ x: bug.x, y: bug.y, vx: 0, vy: 0, r: 4 });
  step(st, 0.001, idle, () => 0.99);
  assert.equal(st.foes.filter(f => f.kind === 'bug').length, 0);
  assert.equal(st.score, 10 + 25);
});

test('the rail passes through everything in its line', () => {
  const st = quiet();
  // The beam trails behind the shot, so it takes everything in its column it has already passed.
  st.foes.push({ kind: 'skill', x: 400, y: 200, vy: 0, hp: 1 }, { kind: 'skill', x: 400, y: 320, vy: 0, hp: 1 });
  st.shots.push({ x: 400, y: 150, vx: 0, vy: 0, r: 3, rail: true });
  step(st, 0.001, idle, () => 0.99);
  assert.equal(st.foes.length, 0);
});

test('Claude powers the blaster up: five-way fire for a few seconds, then back to normal', () => {
  const st = quiet();
  st.foes.push({ kind: 'claude', x: 400, y: 300, vy: 0, hp: 1 });
  st.shots.push({ x: 400, y: 300, vx: 0, vy: 0, r: 4 });
  const ev = step(st, 0.001, idle, () => 0.99);
  assert.ok(ev.includes('power'));
  assert.equal(st.score, 50);
  st.shots = []; st.cool = 0;
  step(st, 0.01, { ...idle, fire: true }, () => 0.99);
  assert.equal(st.shots.filter(s => s.claude).length, 5);
  step(st, POWER_TIME, idle, () => 0.99);
  st.shots = []; st.cool = 0;
  step(st, 0.01, { ...idle, fire: true }, () => 0.99);
  assert.equal(st.shots.length, 1);
});

test('three hits end the game, and nothing moves after it is over', () => {
  const st = quiet();
  for (let i = 0; i < LIVES; i++) {
    st.foeShots.push({ x: st.x, y: SHIP_Y, vy: 0 });
    step(st, 0.001, idle, () => 0.99);
  }
  assert.equal(st.lives, 0);
  assert.equal(st.over, true);
  const x = st.x;
  assert.deepEqual(step(st, 1, { ...idle, left: true }, Math.random), []);
  assert.equal(st.x, x);
});

test('a skill that gets past breaks the combo; a bug that gets past does not', () => {
  const st = quiet();
  st.combo = 7;
  st.foes.push({ kind: 'bug', x: 100, y: H + 30, vy: 0, hp: 2, ph: 0 });
  step(st, 0.001, idle, () => 0.99);
  assert.equal(st.combo, 7);
  st.foes.push({ kind: 'skill', x: 100, y: H + 30, vy: 0, hp: 1 });
  step(st, 0.001, idle, () => 0.99);
  assert.equal(st.combo, 0);
});

test('arrivals: about one in twenty is Claude, about one in five a bug, the rest skills', () => {
  const kinds = { claude: 0, bug: 0, skill: 0 };
  for (const r of [0.01, 0.1, 0.2, 0.5, 0.9]) {
    const st = Object.assign(newGame(), { spawn: 0 });
    // The gap to the next arrival draws first, then the arrival itself.
    step(st, 0.001, idle, seq(0.5, r, 0.5, 0.5));
    kinds[st.foes[0].kind]++;
  }
  assert.deepEqual(kinds, { claude: 1, bug: 2, skill: 2 });
});

test('switching blaster wraps round both ways', () => {
  const st = newGame();
  setBlaster(st, -1);
  assert.equal(st.blaster, BLASTERS.length - 1);
  setBlaster(st, BLASTERS.length);
  assert.equal(st.blaster, 0);
});
