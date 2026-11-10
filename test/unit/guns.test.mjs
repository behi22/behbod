import test from 'node:test';
import assert from 'node:assert/strict';
import { GUNS, newArsenal, select, startReload, pull, tickArsenal, hitPoints } from '../../web/src/pure/guns.js';

test('six original creatures, each with its own way of shooting', () => {
  assert.deepEqual(GUNS.map(g => g.name), ['Snorkel', 'Grumble', 'Vix', 'Mochi', 'Zap', 'Dusty']);
  for (const g of GUNS) {
    assert.ok(g.ammo > 0 && g.cool > 0 && g.reload > 0, g.name);
    assert.ok(['single', 'splash', 'line', 'spread', 'chain'].includes(g.shot), g.name);
    assert.ok(g.lines.length >= 3, `${g.name} has things to say`);
  }
});

test('a pull fires once, then waits out the cooldown', () => {
  const st = newArsenal();
  assert.deepEqual(pull(st, Math.random), [[0, 0]]);
  assert.equal(st.ammo[0], GUNS[0].ammo - 1);
  assert.equal(pull(st, Math.random), null, 'still cooling down');
  tickArsenal(st, GUNS[0].cool);
  assert.ok(pull(st, Math.random));
});

test('the spread guns fire several pellets inside their spread', () => {
  const st = newArsenal();
  for (const id of ['mochi', 'dusty']) {
    const i = GUNS.findIndex(g => g.id === id), g = GUNS[i];
    select(st, i); tickArsenal(st, 1);
    const shots = pull(st, Math.random);
    assert.equal(shots.length, g.pellets);
    for (const [x, y] of shots) assert.ok(Math.abs(x) <= g.spread && Math.abs(y) <= g.spread);
  }
});

test('the last shot starts a reload by itself, and the reload fills the gun', () => {
  const st = newArsenal(), g = GUNS[4];
  select(st, 4); tickArsenal(st, 1);
  for (let i = 0; i < g.ammo; i++) { assert.ok(pull(st, Math.random), `shot ${i + 1}`); tickArsenal(st, g.cool); }
  assert.equal(st.ammo[4], 0);
  assert.ok(st.reloading > 0);
  assert.equal(pull(st, Math.random), null, 'nothing while reloading');
  let done = false;
  for (let t = 0; t < g.reload + 0.1 && !done; t += 0.05) done = tickArsenal(st, 0.05);
  assert.ok(done);
  assert.equal(st.ammo[4], g.ammo);
});

test('switching keeps what each gun had left and cancels a reload', () => {
  const st = newArsenal();
  pull(st, Math.random); tickArsenal(st, 1); pull(st, Math.random);
  startReload(st);
  assert.ok(st.reloading > 0);
  assert.ok(select(st, 2));
  assert.equal(st.reloading, 0);
  assert.equal(st.ammo[0], GUNS[0].ammo - 2);
  assert.equal(select(st, 2), false, 'already holding it');
  select(st, -1);
  assert.equal(st.gun, GUNS.length - 1, 'wraps round');
});

test("switching away and back does not cut short a slow gun's wait between shots", () => {
  const st = newArsenal(), zap = GUNS.findIndex(g => g.id === 'zap');
  select(st, zap); tickArsenal(st, 1);
  assert.ok(pull(st, Math.random));
  select(st, zap + 1); select(st, zap);
  assert.ok(st.cool > 0.25, `still cooling: ${st.cool}`);
  tickArsenal(st, 0.3);
  assert.equal(pull(st, Math.random), null, 'Zap cannot fire again 0.3 s after its shot');
});

test('a full gun does not reload', () => {
  const st = newArsenal();
  assert.equal(startReload(st), false);
});

test('hits score one, gold three', () => {
  assert.equal(hitPoints(false), 1);
  assert.equal(hitPoints(true), 3);
});
