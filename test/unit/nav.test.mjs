import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { makeNav } from '../../web/src/pure/nav.js';

// A 10 by 6 room split by a wall with a 1.2 m gap at its north end.
const room = { floors: [{ min: [0, 0], max: [10, 6], z: 0 }], colliders: [{ name: 'wall', min: [4.9, 0, 0], max: [5.1, 4.4, 3], kind: 'structure' }] };

test('a path goes round the wall through the gap', () => {
  const p = makeNav(room).path([1, 1, 0], [9, 1, 0]);
  assert.ok(p, 'no path');
  assert.ok(p.some(([, y]) => y > 4.4), 'the path should pass the gap at the north end');
  for (const [x, y] of p) assert.ok(!(x > 4.6 && x < 5.4 && y < 4.4), `a point lies in the wall: ${x}, ${y}`);
});

test('no path when the way is shut, and one when the door opens', () => {
  const shut = { ...room, colliders: [...room.colliders, { name: 'door', min: [4.9, 4.4, 0], max: [5.1, 6, 2.2], kind: 'structure' }] };
  assert.equal(makeNav(shut).path([1, 1, 0], [9, 1, 0]), null);
  assert.ok(makeNav(shut, { off: n => n === 'door' }).path([1, 1, 0], [9, 1, 0]));
});

test('stairs connect two floors, a sheer edge does not', () => {
  const steps = Array.from({ length: 10 }, (_, i) => ({ min: [6, 0.3 * i], max: [7, 0.3 * (i + 1)], z: 0.2 * (i + 1) }));
  const world = { floors: [{ min: [0, 0], max: [6, 6], z: 0 }, ...steps, { min: [6, 3], max: [10, 6], z: 2.0 }], colliders: [] };
  const up = makeNav(world).path([1, 1, 0], [9, 5, 2.0]);
  assert.ok(up, 'the stairs should lead up');
  assert.ok(up.some(([x]) => x >= 6 && x <= 7), 'the path should use the stairs');
  assert.equal(up.at(-1)[2], 2.0);
  const cliff = { floors: [{ min: [0, 0], max: [5, 6], z: 0 }, { min: [5, 0], max: [10, 6], z: 1.0 }], colliders: [] };
  assert.equal(makeNav(cliff).path([1, 1, 0], [9, 1, 1.0]), null);
});

test('furniture blocks the cells around it', () => {
  const world = { floors: [{ min: [0, 0], max: [6, 6], z: 0 }], colliders: [{ name: 'sofa', min: [2, 2, 0], max: [4, 4, 0.8], kind: 'solid' }] };
  const nav = makeNav(world);
  assert.equal(nav.walkable(3, 3, 0), true, 'nearest free cell is still found from inside');
  const p = nav.path([1, 3, 0], [5, 3, 0]);
  for (const [x, y] of p) assert.ok(!(x > 1.8 && x < 4.2 && y > 1.8 && y < 4.2), `through the sofa at ${x}, ${y}`);
});

const WORLD = new URL('../../web/assets/world.json', import.meta.url);
test('in the loft you can walk from the front door to the desk, the mezzanine, the balcony and the piano', { skip: !existsSync(WORLD) }, () => {
  const meta = JSON.parse(readFileSync(WORLD, 'utf8'));
  const nav = makeNav(meta, { off: n => n === 'slider_slide' });
  const start = meta.points.spawn;
  for (const [name, to] of [['desk', meta.points.desk_use], ['mezzanine', [6.8, 2.75, 3.0]], ['balcony', [11.7, 16.5, 0]], ['piano', [19.1, 9.95, 0.3]], ['lounge', meta.spots.lounge]]) {
    const p = nav.path(start, to);
    assert.ok(p, `no path to the ${name}`);
  }
});
