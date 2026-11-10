import test from 'node:test';
import assert from 'node:assert/strict';
import { keeperGuess, penaltyResult, landing, REACH_Y, REACH_Z } from '../../web/src/pure/penalties.js';

// The mini goal as built (META.penalty in web/assets/world.json).
const W = 0.85, H = 0.575;
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('outside the frame is wide or over, whatever the keeper does', () => {
  const stay = { dy: 0, hop: 0.05 };
  assert.equal(penaltyResult({ y: 0.47, z: 0.2 }, stay, W, H), 'wide');
  assert.equal(penaltyResult({ y: -0.47, z: 0.2 }, stay, W, H), 'wide');
  assert.equal(penaltyResult({ y: 0.1, z: 0.62 }, stay, W, H), 'over');
});

test('BH-22 saves what it lands on, low enough for its height and hop', () => {
  const right = { dy: 0.27, hop: 0.05 };
  assert.equal(penaltyResult({ y: 0.3, z: 0.2 }, right, W, H), 'saved');
  assert.equal(penaltyResult({ y: 0.3, z: REACH_Z + 0.05 + 0.03 }, right, W, H), 'goal', 'over its head');
  assert.equal(penaltyResult({ y: 0.3, z: REACH_Z + 0.1 }, { dy: 0.27, hop: 0.18 }, W, H), 'saved', 'a hop reaches higher');
  assert.equal(penaltyResult({ y: 0.27 - REACH_Y - 0.01, z: 0.2 }, right, W, H), 'goal', 'just past its reach');
  assert.equal(penaltyResult({ y: -0.3, z: 0.2 }, right, W, H), 'goal', 'the wrong way');
});

test('when BH-22 reads the kick it goes the right way; otherwise it picks left, middle or right', () => {
  const read = keeperGuess({ y: 0.3, z: 0.4 }, W, H, seq(0.05));
  assert.ok(read.dy > 0 && read.hop > 0.1, 'read: right way, and up for a high one');
  assert.equal(keeperGuess({ y: 0.02, z: 0.1 }, W, H, seq(0.05)).dy, 0, 'a kick down the middle, read, it stays');
  const sides = [0.0, 0.5, 0.9].map(r => keeperGuess({ y: 0.3, z: 0.2 }, W, H, seq(0.9, r, 0.9)).dy);
  assert.deepEqual(sides.map(Math.sign), [-1, 0, 1]);
  for (const g of sides) assert.ok(Math.abs(g) <= W / 2);
});

test('a kick lands near its aim and never under the floor', () => {
  const at = landing({ y: 0.1, z: 0.3 }, [0.02, -0.01]);
  assert.ok(Math.abs(at.y - 0.12) < 1e-9 && Math.abs(at.z - 0.29) < 1e-9);
  assert.equal(landing({ y: 0, z: 0.01 }, [0, -0.05]).z, 0.02);
});

test('over many kicks to the corners, BH-22 saves some but not most', () => {
  let s = 7; const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  let saved = 0, n = 2000;
  for (let i = 0; i < n; i++) {
    const aim = { y: (rand() < 0.5 ? -1 : 1) * (0.2 + rand() * 0.2), z: 0.08 + rand() * 0.45 };
    if (penaltyResult(landing(aim, [(rand() - 0.5) * 0.06, (rand() - 0.5) * 0.05]), keeperGuess(aim, W, H, rand), W, H) === 'saved') saved++;
  }
  assert.ok(saved / n > 0.15 && saved / n < 0.5, `saves ${(saved / n * 100).toFixed(0)}%`);
});

test('at the goal as built, no low kick inside the posts is a sure goal, and the corners are saved about a third of the time', () => {
  for (let y = 0; y <= W / 2 - 0.03; y += 0.005) {
    const saves = [-1, 0, 1].some(side => penaltyResult({ y, z: 0.15 }, keeperGuess({ y, z: 0.15 }, W, H, seq(0.9, (side + 1) / 3 + 0.01, 0.9)), W, H) === 'saved');
    assert.ok(saves, `y ${y.toFixed(3)} beats every dive`);
  }
  let s = 11; const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  let saved = 0, n = 4000;
  for (let i = 0; i < n; i++) {
    const aim = { y: (rand() < 0.5 ? -1 : 1) * 0.36, z: rand() < 0.5 ? 0.15 : 0.45 };
    if (penaltyResult(landing(aim, [(rand() - 0.5) * 0.06, (rand() - 0.5) * 0.05]), keeperGuess(aim, W, H, rand), W, H) === 'saved') saved++;
  }
  assert.ok(saved / n > 0.22 && saved / n < 0.42, `corners saved ${(saved / n * 100).toFixed(0)}%`);
});
