import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInteract, headingToFacing } from '../../web/src/pure/interact.js';
import { makeRegions } from '../../web/src/pure/regions.js';
import { makeCollision } from '../../web/src/pure/collide.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('the nearest thing in reach wins', () => {
  const it = makeInteract([{ id: 'a', at: [0, 0, 0], r: 1 }, { id: 'b', at: [1.5, 0, 0], r: 1 }]);
  assert.equal(it.nearest({ x: 0.2, y: 0, z: 0 }).id, 'a');
  assert.equal(it.nearest({ x: 1.0, y: 0, z: 0 }).id, 'b');
});

test('nothing out of reach, and nothing on another floor', () => {
  const it = makeInteract([{ id: 'desk', at: [5, 2, 0.45], r: 1.2 }, { id: 'book', at: [5, 2, 2.9], r: 1.2 }]);
  assert.equal(it.nearest({ x: 0, y: 0, z: 0 }), null);
  assert.equal(it.nearest({ x: 5, y: 0.45, z: -2 }).id, 'desk');
  assert.equal(it.nearest({ x: 5, y: 2.9, z: -2 }).id, 'book');
});

test('Blender north is three -z for things you use', () => {
  const it = makeInteract([{ id: 'n', at: [0, 3, 0], r: 0.5 }]);
  assert.equal(it.nearest({ x: 0, y: 0, z: -3 }).id, 'n');
  assert.equal(it.nearest({ x: 0, y: 0, z: 3 }), null);
});

test('headings turn the character the right way', () => {
  // Facing angle f looks along three (sin f, cos f): south is +z, north -z, east +x.
  for (const [deg, x, z] of [[270, 0, 1], [90, 0, -1], [0, 1, 0], [180, -1, 0]]) {
    const f = headingToFacing(deg);
    near(Math.sin(f), x); near(Math.cos(f), z);
  }
});

const R = [{ id: 'loft', min: [0, 0], max: [16, 12], top: 5.8 }, { id: 'balcony', min: [2, 12.2], max: [14, 14.4], top: 4 }, { id: 'range', min: [4.8, -3], max: [15.4, -0.4], top: 2.8 }];

test('the camera keeps the room I stand in, and keeps it through a doorway', () => {
  const r = makeRegions(R);
  assert.equal(r.at(8, 6).id, 'loft');
  assert.equal(r.at(8, 13).id, 'balcony');
  assert.equal(r.at(8, 12.1).id, 'balcony');
  assert.equal(r.at(8, 11.9).id, 'balcony');
  assert.equal(r.at(8, 10).id, 'loft');
  assert.equal(r.at(7, -1.5).id, 'range');
  assert.equal(r.at(50, 50).id, 'range');
});

test('a camera position is clamped inside the room and above my head', () => {
  const r = makeRegions(R);
  const p = r.clamp(R[2], { x: 20, y: 9, z: 5 }, 0);
  assert.deepEqual(p, { x: 15.4, y: 2.8, z: 3 });
  const q = r.clamp(R[0], { x: 3, y: 0.1, z: -3 }, 0.45);
  assert.equal(q.y, 0.45 + 0.4);
});

test('an open door stops being solid, and closing it brings it back', () => {
  const col = makeCollision({ floors: [{ min: [0, 0], max: [4, 4], z: 0 }], colliders: [{ name: 'door', min: [1, 1, 0], max: [2, 1.2, 2.1] }] });
  const p = { x: 1.5, z: -1.05 };
  col.pushOut(p, 0);
  assert.notDeepEqual(p, { x: 1.5, z: -1.05 });
  col.setSolid('door', false);
  const q = { x: 1.5, z: -1.05 };
  col.pushOut(q, 0);
  assert.deepEqual(q, { x: 1.5, z: -1.05 });
  assert.equal(col.cameraRoom({ x: 1.5, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 3), 3);
  col.setSolid('door', true);
  assert.ok(col.cameraRoom({ x: 1.5, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 3) < 3);
});
