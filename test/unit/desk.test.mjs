import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEPLOY_SPOT, pressDepth, COOL, CALL, FAN_FROM_DEPLOY, FAN_SPOT, newFan, fanStep, fanSet, fanSpin } from '../../web/src/pure/desk.js';

const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const layout = JSON.parse(readFileSync(new URL('../../blender/zones/desklayout.json', import.meta.url), 'utf8'));
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

// ---------- the fan ----------
const studio = readFileSync(new URL('../../blender/zones/studio.py', import.meta.url), 'utf8');

test('a quiet PC never calls BH-22, and the fan stays off', () => {
  const s = newFan();
  for (let t = 0; t < 300; t += 0.5) assert.equal(fanStep(s, false, t), null);
  assert.equal(s.on, false);
});

test('a busy PC calls BH-22 until the fan is on, and for a while after a short burst', () => {
  const s = newFan();
  assert.equal(fanStep(s, true, 10), 'call');
  // A deploy is three seconds; BH-22 may still be on its way after it.
  for (let t = 10.5; t < 13; t += 0.5) assert.equal(fanStep(s, true, t), 'call');
  assert.equal(fanStep(s, false, 13 + CALL - 3.5), 'call');
  assert.equal(fanStep(s, false, 13 + CALL + 0.5), null);
});

test('on, it keeps running while the PC is busy, then spins down COOL seconds after it goes quiet', () => {
  const s = newFan();
  fanStep(s, true, 0); fanSet(s, true, 5);
  for (let t = 5; t <= 200; t += 1) assert.equal(fanStep(s, true, t), null);
  assert.equal(fanStep(s, false, 200 + COOL - 0.5), null);
  assert.equal(fanStep(s, false, 200 + COOL + 0.5), 'off');
});

test('once it has spun down, BH-22 is not sent to switch it on again until the PC gets busy again', () => {
  const s = newFan();
  fanStep(s, true, 0); fanSet(s, true, 4);
  assert.equal(fanStep(s, false, 5), null);
  assert.equal(fanStep(s, false, 5 + COOL + 0.5), 'off');
  fanSet(s, false, 5 + COOL + 0.5);
  for (let t = 26; t < 5 + CALL + 10; t += 0.5) assert.equal(fanStep(s, false, t), null);
  assert.equal(fanStep(s, true, 60), 'call');
});

test('switched on after the PC went quiet, it still runs its COOL seconds from then', () => {
  const s = newFan();
  fanStep(s, true, 0); fanStep(s, false, 3);
  fanSet(s, true, 25);
  assert.equal(fanStep(s, false, 25 + COOL - 0.5), null);
  assert.equal(fanStep(s, false, 25 + COOL + 0.5), 'off');
});

test('set by hand it stays as set, until the PC next gets busy', () => {
  const s = newFan();
  fanStep(s, true, 0); fanSet(s, false, 1, true);
  for (let t = 1; t < 60; t += 1) assert.equal(fanStep(s, true, t), null, 'switched off by hand while busy: BH-22 leaves it off');
  for (let t = 60; t < 200; t += 1) assert.equal(fanStep(s, false, t), null);
  assert.equal(fanStep(s, true, 200), 'call', 'the next busy spell is the rules\' again');
  const h = newFan();
  fanSet(h, true, 0, true);
  for (let t = 0; t < 500; t += 5) assert.equal(fanStep(h, false, t), null, 'switched on by hand: it keeps running');
  fanStep(h, true, 500);
  assert.equal(fanStep(h, false, 500 + COOL + 1), 'off');
});

test('the blades come up to speed in about a second and coast down to a dead stop in a few', () => {
  let k = 0, n = 0;
  while (k < 1) { k = fanSpin(k, true, 1 / 60); n++; }
  assert.equal(k, 1);
  assert.ok(n / 60 > 0.8 && n / 60 < 1.4, `${n / 60} s up`);
  n = 0;
  let last = k;
  while (k > 0) { k = fanSpin(k, false, 1 / 60); assert.ok(k < last); last = k; n++; }
  assert.equal(k, 0);
  assert.ok(n / 60 > 2.5 && n / 60 < 8, `${n / 60} s down`);
  assert.equal(fanSpin(0, false, 1 / 60), 0);
});

test('the blades sit in the fan the studio build bakes, found from the DEPLOY button the same build places', () => {
  const at = re => { const m = studio.match(re); assert.ok(m, String(re)); return [+m[1], +m[2], +m[3]]; };
  const cage = at(/(?:cyl|ring)\('fan_cage', [^(]*\(([\d.]+), ([\d.]+), DZ \+ ([\d.]+)\)/), btn = [...layout.things.deploy.at, +at(/point\('deploy', \(DP\.x, DP\.y, DZ \+ ([\d.]+)()()\)\)/)[0]];
  FAN_FROM_DEPLOY.forEach((d, i) => assert.ok(Math.abs(d - (cage[i] - btn[i])) < 1e-9, `axis ${i}: ${d} vs ${cage[i] - btn[i]}`));
  // In the house: on the desk's top, inside the room, clear of the east wall.
  const [x, y, z] = meta.points.deploy.map((v, i) => v + FAN_FROM_DEPLOY[i]);
  const desk = meta.colliders.find(c => c.name === 'desk'), wall = meta.colliders.find(c => c.name === 'wall_e');
  assert.ok(x > desk.min[0] && x < desk.max[0] && y > desk.min[1] && y < desk.max[1], `${x} ${y}`);
  assert.ok(z - 0.07 > desk.max[2], 'the round cage clears the desk top');
  assert.ok(x + 0.02 < wall.min[0], 'and the wall');
});

test('where BH-22 stands for the fan is clear floor in the studio, in reach of it, and not where I stand for DEPLOY', () => {
  const fan = meta.points.deploy.map((v, i) => v + FAN_FROM_DEPLOY[i]);
  assert.ok(clear(FAN_SPOT, 0.16), 'BH-22 is 20 cm across');
  assert.equal(FAN_SPOT[2], meta.points.desk_use[2], 'on the studio floor');
  assert.ok(Math.hypot(FAN_SPOT[0] - fan[0], FAN_SPOT[1] - fan[1]) < 1.0);
  assert.ok(Math.hypot(DEPLOY_SPOT[0] - FAN_SPOT[0], DEPLOY_SPOT[1] - FAN_SPOT[1]) > 0.5, 'BH-22 does not stand in me');
});
