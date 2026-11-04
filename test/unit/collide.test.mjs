import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCollision, R } from '../../web/src/pure/collide.js';

// A 4 by 4 floor at 0, a raised step at 0.3, a desk box and a tall wall, in Blender axes (y north, z up).
const meta = {
  floors: [{ min: [0, 0], max: [4, 4], z: 0 }, { min: [2, 0], max: [4, 1], z: 0.3 }],
  colliders: [
    { name: 'desk', min: [1, 2, 0], max: [2, 3, 0.75] },
    { name: 'wall_north', min: [0, 4, 0], max: [4, 4.2, 6] },
    { name: 'shelf_high', min: [0, 0, 2], max: [1, 1, 2.2] },
  ],
};
const col = makeCollision(meta);

test('Blender y turns into negative three z', () => {
  assert.deepEqual(col.floors[0], { x0: 0, x1: 4, z0: -4, z1: -0, y: 0 });
  assert.equal(col.boxes[0].z0, -3);
  assert.equal(col.boxes[0].z1, -2);
});

test('groundAt picks the highest floor I can step onto', () => {
  assert.equal(col.groundAt(3, -0.5, 0), 0.3);
  assert.equal(col.groundAt(3, -2, 0), 0);
});

test('groundAt ignores a floor higher than one step', () => {
  assert.equal(col.groundAt(3, -0.5, -0.1), 0);
});

test('groundAt stands me on top of a low box and ignores boxes above my head', () => {
  assert.equal(col.groundAt(1.5, -2.5, 0.8), 0.75);
  assert.equal(col.groundAt(0.5, -0.5, 0), 0);
});

test('groundAt is far below when nothing is under me', () => {
  assert.equal(col.groundAt(10, 10, 0), -10);
});

test('pushOut moves me out of a box by my radius', () => {
  const p = { x: 2.1, z: -2.5 };
  col.pushOut(p, 0);
  assert.ok(Math.abs(p.x - (2 + R)) < 1e-9);
  assert.equal(p.z, -2.5);
});

test('pushOut from deep inside goes to the nearest side', () => {
  const p = { x: 1.95, z: -2.5 };
  col.pushOut(p, 0);
  assert.equal(p.x, 2 + R);
});

test('pushOut leaves me alone when I am clear, above or below a box', () => {
  const clear = { x: 3, z: -2.5 };
  col.pushOut(clear, 0);
  assert.deepEqual(clear, { x: 3, z: -2.5 });
  const onTop = { x: 1.5, z: -2.5 };
  col.pushOut(onTop, 0.75);
  assert.deepEqual(onTop, { x: 1.5, z: -2.5 });
  const under = { x: 0.5, z: -0.5 };
  col.pushOut(under, 0);
  assert.deepEqual(under, { x: 0.5, z: -0.5 });
});

test('cameraRoom shortens the arm in front of furniture', () => {
  const room = col.cameraRoom({ x: 1.5, y: 0.5, z: -0.5 }, { x: 0, y: 0, z: -1 }, 4);
  assert.ok(Math.abs(room - (1.5 - 0.12)) < 1e-9);
});

test('cameraRoom looks through tall walls and never goes under 0.9', () => {
  assert.equal(col.cameraRoom({ x: 2, y: 1, z: -3.5 }, { x: 0, y: 0, z: -1 }, 3), 3);
  assert.equal(col.cameraRoom({ x: 1.5, y: 0.5, z: -1.9 }, { x: 0, y: 0, z: -1 }, 3), 0.9);
});
