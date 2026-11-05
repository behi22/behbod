import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { checkLayout } from '../../web/src/pure/layoutcheck.js';

const floor = { min: [0, 0], max: [10, 10], z: 0 };
const base = extra => ({ floors: [floor, { min: [10, 0], max: [12, 10], z: 0.45 }], colliders: [], rugs: [], interact: [], walls: [], ...extra });
const solid = (name, min, max) => ({ name, min, max, kind: 'solid' });

test('furniture inside other furniture is a problem, furniture side by side is not', () => {
  assert.deepEqual(checkLayout(base({ colliders: [solid('sofa', [0, 0, 0], [2, 1, 0.8]), solid('table', [1.5, 0.5, 0], [2.5, 1.5, 0.5])] })), ['sofa runs into table']);
  assert.deepEqual(checkLayout(base({ colliders: [solid('sofa', [0, 0, 0], [2, 1, 0.8]), solid('table', [2, 0, 0], [3, 1, 0.5])] })), []);
});

test('furniture may touch a wall but not sink into it', () => {
  const wall = { name: 'wall_s', min: [-1, -1, 0], max: [11, 0, 6], kind: 'structure' };
  assert.deepEqual(checkLayout(base({ colliders: [wall, solid('shelf', [1, -0.01, 0], [2, 0.4, 2])] })), []);
  assert.equal(checkLayout(base({ colliders: [wall, solid('shelf', [1, -0.2, 0], [2, 0.4, 2])] })).length, 1);
});

test('a rug must sit on one floor, never across a step', () => {
  assert.deepEqual(checkLayout(base({ rugs: [{ name: 'rug', min: [2, 2], max: [4, 4], z: 0 }] })), []);
  assert.deepEqual(checkLayout(base({ rugs: [{ name: 'rug', min: [9, 2], max: [11, 4], z: 0 }] })), ['rug rug runs over a step or an edge']);
});

test('a thing you use needs a floor and room to stand', () => {
  const desk = solid('desk', [4, 4, 0], [5, 5, 0.8]);
  assert.deepEqual(checkLayout(base({ colliders: [desk], interact: [{ id: 'desk', at: [3.5, 4.5, 0] }] })), []);
  assert.equal(checkLayout(base({ colliders: [desk], interact: [{ id: 'desk', at: [3.85, 4.5, 0] }] }))[0], 'desk: no room to stand, desk within 0.3 m');
  assert.equal(checkLayout(base({ interact: [{ id: 'ghost', at: [20, 20, 0] }] }))[0], 'ghost: its spot is not on a floor');
});

test('furniture is measured from the floor it stands on, not the room below', () => {
  const meta = base({ floors: [floor, { min: [0, 0], max: [4, 4], z: 3 }], colliders: [solid('shelf_below', [0, 0, -1], [2, 0.4, 2.7]), solid('table_above', [0, 0, 2], [1, 1, 3.4])] });
  assert.deepEqual(checkLayout(meta), []);
});

test('wall pieces on the same wall must not overlap', () => {
  const walls = [{ name: 'tv', wall: 'w', u: [1, 3], z: [1, 2] }, { name: 'frame', wall: 'w', u: [2.5, 3.5], z: [1.5, 2.5] }, { name: 'clock', wall: 'e', u: [1, 3], z: [1, 2] }];
  assert.deepEqual(checkLayout(base({ walls })), ['tv and frame overlap on the w wall']);
});

// The real loft: nothing cramped, nothing over a step, everything you use has room around it.
const WORLD = new URL('../../web/assets/world.json', import.meta.url);
test('the built loft passes the layout check', { skip: !existsSync(WORLD) }, () => {
  const problems = checkLayout(JSON.parse(readFileSync(WORLD, 'utf8')));
  assert.deepEqual(problems, []);
});
