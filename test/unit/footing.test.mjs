import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeFooting, FOOT } from '../../web/src/pure/footing.js';
import { makeCollision } from '../../web/src/pure/collide.js';

const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url)));
const col = makeCollision(meta);
const { under, foot } = makeFooting(col.floors, col.boxes);
// Blender's (x, y) to three's (x, z).
const at = (x, y) => [x, -y];

test('on the stairs each foot finds its own tread, one riser at a time up and down', () => {
  const treads = meta.floors.filter(f => f.min[0] === 0.15 && f.max[0] === 1.35).sort((a, b) => a.z - b.z);
  assert.equal(treads.length, 16);
  for (let i = 1; i < treads.length; i++) {
    const t = treads[i], below = treads[i - 1], mid = (t.min[1] + t.max[1]) / 2, [x, z] = at(0.75, mid);
    // Standing on the tread below, a foot over this one is one riser up.
    assert.equal(foot(x, z, ...at(0.75, (below.min[1] + below.max[1]) / 2), below.z), t.z);
    // Standing on this one, a foot over the tread below is one riser down.
    assert.equal(foot(...at(0.75, (below.min[1] + below.max[1]) / 2), x, z, t.z), below.z);
  }
});

test('reaching two treads ahead on the stairs still finds the tread, not the floor under the stairs', () => {
  // The body on tread 4 (0.75 up), the foot two treads further up (1.125).
  assert.equal(foot(...at(0.75, 7.02), ...at(0.75, 7.5), 0.75), 1.125);
  assert.equal(foot(...at(0.75, 7.5), ...at(0.75, 7.02), 1.125), 0.75);
});

test('the studio steps and the lounge pit steps: a foot on the step below or above', () => {
  // Studio: platform 0.45, steps 0.3 and 0.15, floor 0, going south (Blender y up).
  assert.equal(foot(...at(16, 5.4), ...at(16, 5.62), 0.3), 0.45);
  assert.equal(foot(...at(16, 5.62), ...at(16, 5.87), 0.15), 0.3);
  assert.equal(foot(...at(16, 5.87), ...at(16, 6.2), 0), 0.15);
  assert.equal(foot(...at(16, 5.62), ...at(16, 5.4), 0.45), 0.3);
  // The lounge pit: floor 0, steps -0.15 and -0.3, the pit -0.45.
  assert.equal(foot(...at(9.65, 10), ...at(9.9, 10), 0), -0.15);
  assert.equal(foot(...at(9.35, 10), ...at(9.65, 10), -0.15), -0.3);
  assert.equal(foot(...at(9.0, 10), ...at(9.35, 10), -0.3), -0.45);
});

test('at a drop deeper than a step (the pit edge, the studio edge) the foot stays on the edge above', () => {
  // On the pit's north rim, a foot reaching over the 0.45 drop into the pit.
  assert.equal(foot(...at(6, 13.4), ...at(6, 13.75), 0), 0);
  // On the studio platform's front edge, a foot over the drop to the floor.
  assert.equal(foot(...at(13, 6.2), ...at(13, 5.9), 0.45), 0.45);
  assert.ok(0.45 > FOOT.ledge && 0.1875 < FOOT.ledge);
});

test('a body hanging over an edge stands its feet at its own height, and a foot never climbs a box it could not step on', () => {
  assert.equal(foot(...at(6, 13.4), ...at(6, 13.5), 0), 0);
  // The dog bed (0.18) is a step the body can take; the crate (0.32) is not.
  assert.equal(foot(...at(13.6, 14.25), ...at(13.6, 13.75), 0), 0.18);
  assert.equal(foot(...at(17.4, 14.35), ...at(17.4, 14), 0), 0);
});

test('under the mezzanine the floor is the room\'s, and on it the mezzanine\'s', () => {
  assert.equal(under(...at(5, 2), 0), 0);
  assert.equal(under(...at(5, 2), 3), 3);
});
