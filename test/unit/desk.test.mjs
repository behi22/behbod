import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEPLOY_SPOT, pressDepth } from '../../web/src/pure/desk.js';

const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const solid = meta.colliders.filter(c => c.max[2] > 0.5 && c.min[2] < 2);
const clear = (p, pad) => !solid.find(c => p[0] > c.min[0] - pad && p[0] < c.max[0] + pad && p[1] > c.min[1] - pad && p[1] < c.max[1] + pad);

test('the button goes straight down, holds, and comes back up within half a second', () => {
  assert.equal(pressDepth(-1), 0);
  assert.equal(pressDepth(NaN), 0);
  assert.equal(pressDepth(0), 0);
  assert.equal(pressDepth(0.1), 1);
  assert.equal(pressDepth(0.25), 1);
  assert.equal(pressDepth(0.5), 0);
  assert.equal(pressDepth(3), 0);
  for (let e = 0; e < 0.06; e += 0.005) assert.ok(pressDepth(e + 0.005) >= pressDepth(e));
  for (let e = 0.28; e < 0.5; e += 0.01) assert.ok(pressDepth(e + 0.01) <= pressDepth(e));
});

test('where I stand for DEPLOY is clear floor in the studio, the button in reach, away from the desk\'s own spot', () => {
  const btn = meta.points.deploy, desk = meta.interact.find(i => i.id === 'desk');
  assert.ok(clear(DEPLOY_SPOT, 0.3), 'I am 60 cm across');
  assert.equal(DEPLOY_SPOT[2], meta.points.desk_use[2], 'on the studio floor');
  assert.ok(Math.hypot(DEPLOY_SPOT[0] - btn[0], DEPLOY_SPOT[1] - btn[1]) < 0.7);
  assert.ok(Math.hypot(DEPLOY_SPOT[0] - desk.at[0], DEPLOY_SPOT[1] - desk.at[1]) > desk.r + 0.1, 'standing to sit at the desk does not offer DEPLOY instead');
});
