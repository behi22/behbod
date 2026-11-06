import test from 'node:test';
import assert from 'node:assert/strict';
import { solvedCube, turn, undo, isSolved, scramble, solution, quarter } from '../../web/src/pure/rubik.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

test('a new cube is solved and one turn unsolves it', () => {
  const c = solvedCube();
  assert.equal(c.length, 27);
  assert.ok(isSolved(c));
  turn(c, { axis: 1, layer: 1, dir: 1 });
  assert.ok(!isSolved(c));
  turn(c, undo({ axis: 1, layer: 1, dir: 1 }));
  assert.ok(isSolved(c));
});

test('four quarter turns of a layer come back round', () => {
  for (let axis = 0; axis < 3; axis++) for (const layer of [-1, 0, 1]) {
    const c = solvedCube();
    for (let i = 0; i < 4; i++) turn(c, { axis, layer, dir: 1 });
    assert.ok(isSolved(c), `axis ${axis} layer ${layer}`);
  }
});

test('a turn moves only its own nine pieces, and keeps them on the cube', () => {
  const c = solvedCube();
  turn(c, { axis: 0, layer: -1, dir: -1 });
  const moved = c.filter(p => p.at.some((v, i) => v !== p.home[i]) || p.turn.some((v, i) => v !== (i % 4 === 0 ? 1 : 0)));
  assert.equal(moved.length, 9);
  assert.ok(moved.every(p => p.home[0] === -1 && p.at[0] === -1));
  assert.ok(c.every(p => p.at.every(v => v >= -1 && v <= 1)));
});

test('quarter turns are proper rotations', () => {
  for (let axis = 0; axis < 3; axis++) for (const dir of [1, -1]) {
    const q = quarter(axis, dir);
    const det = q[0] * (q[4] * q[8] - q[5] * q[7]) - q[1] * (q[3] * q[8] - q[5] * q[6]) + q[2] * (q[3] * q[7] - q[4] * q[6]);
    assert.equal(det, 1);
  }
});

test('playing the scramble backwards solves it', () => {
  const rand = seeded(42);
  for (let round = 0; round < 20; round++) {
    const moves = scramble(22, rand);
    assert.equal(moves.length, 22);
    const c = solvedCube();
    for (const m of moves) turn(c, m);
    assert.ok(!isSolved(c));
    for (const m of solution(moves)) turn(c, m);
    assert.ok(isSolved(c));
  }
});

test('a scramble never undoes its last move or turns a layer three times running', () => {
  const moves = scramble(500, seeded(7));
  for (let i = 1; i < moves.length; i++) {
    const a = moves[i - 1], m = moves[i];
    assert.ok(!(a.axis === m.axis && a.layer === m.layer && a.dir === -m.dir));
    if (i > 1) { const b = moves[i - 2]; assert.ok(![a, b].every(o => o.axis === m.axis && o.layer === m.layer && o.dir === m.dir)); }
  }
});
