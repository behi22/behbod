import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JAR } from '../../web/src/pure/jar.js';

const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const box = name => meta.colliders.find(c => c.name === name);
const inside = ([x, y], c, pad = 0) => x > c.min[0] - pad && x < c.max[0] + pad && y > c.min[1] - pad && y < c.max[1] + pad;

test('the jar stands on the radiator, at the end of Jessi\'s bed', () => {
  const r = box('radiator'), bed = box('dog_bed'), R = 0.06;
  assert.ok(JAR.at[0] - R > r.min[0] && JAR.at[0] + R < r.max[0], 'along it');
  assert.ok(JAR.at[1] - R > r.min[1] - 0.05 && JAR.at[1] + R < box('glass_e').min[1], 'on its top, short of the glass');
  assert.equal(JAR.at[2], r.max[2]);
  assert.ok(Math.abs(JAR.at[0] - bed.max[0]) < 0.25, 'at the bed\'s end');
});

test('where I stand and where the pets eat are clear floor, in reach, and apart', () => {
  const solid = meta.colliders.filter(c => c.max[2] > 0.05 && c.min[2] < 1.8);
  for (const [name, p, pad] of [['me', JAR.stand, 0.3], ['Pishi', JAR.spots.pishi, 0.15], ['Jessi', JAR.spots.jessi, 0.18]]) {
    assert.equal(p[2], 0, `${name} on the floor`);
    const hit = solid.find(c => inside(p, c, pad));
    assert.ok(!hit, `${name} runs into ${hit?.name}`);
  }
  assert.ok(Math.hypot(JAR.stand[0] - JAR.at[0], JAR.stand[1] - JAR.at[1]) < 0.75, 'the jar in reach');
  assert.ok(Math.hypot(JAR.spots.pishi[0] - JAR.spots.jessi[0], JAR.spots.pishi[1] - JAR.spots.jessi[1]) > 1, 'Pishi runs from Jessi under 0.9 m');
  // The balcony door opens for anyone within its reach; shaking the jar must not open it.
  const door = meta.doors.find(d => d.id === 'balcony');
  for (const p of [JAR.stand, JAR.spots.jessi]) assert.ok(Math.hypot(p[0] - door.at[0], p[1] - door.at[1]) > door.auto + 0.2);
});
