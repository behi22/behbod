import test from 'node:test';
import assert from 'node:assert/strict';
import { GUNS, GUN, ATTACHMENTS, ATTACHMENT_IDS, fit, toggle, stats, damageAt, gunsFor, nextGun } from '../../web/src/pure/arsenal.js';
import { newWeapon, step, spreadNow, scatter, reloadProgress } from '../../web/src/pure/weapon.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
// Runs the gun for `seconds` in small steps with the same input, collecting what happened.
function run(w, s, seconds, input, rng = seq(0.5)) {
  const out = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 120) out.push(...step(w, s, 1 / 120, input, rng));
  return out;
}
const ready = s => { const w = newWeapon(s); run(w, s, s.draw + 0.05, {}); return w; };
const count = (ev, type) => ev.filter(e => e.type === type).length;

test('five guns: pistol, SMG, rifle, sniper and machine gun, the pistol owned from the start', () => {
  assert.deepEqual(GUNS.map(g => g.id), ['pistol', 'smg', 'rifle', 'sniper', 'lmg']);
  assert.equal(GUN.pistol.stars, 0);
  for (const g of GUNS) {
    assert.ok(g.mag > 0 && g.rpm > 0 && g.damage > 0 && g.draw > 0, g.id);
    assert.ok(g.reload.out < g.reload.in && g.reload.in <= g.reload.partial && g.reload.rack <= g.reload.empty, `${g.id} reload marks in order`);
    assert.ok(g.spread.ads <= g.spread.hip, `${g.id} is steadier aimed`);
    assert.ok(g.falloff[0] < g.falloff[1] && g.falloff[2] > 0 && g.falloff[2] <= 1, g.id);
  }
  // No gun is named after a real maker or model.
  assert.ok(!GUNS.some(g => /glock|colt|beretta|sig|ak-?47|m4|m16|mp5|uzi|barrett|remington|m249/i.test(g.name)));
});

test('every gun takes all five attachments, with a size for its long scope and its extended magazine', () => {
  assert.deepEqual(ATTACHMENT_IDS, ['light', 'suppressor', 'holo', 'scope', 'mag']);
  for (const g of GUNS) {
    assert.ok(ATTACHMENTS.scope.zoom[g.id] > 1, `${g.id} scope`);
    assert.ok(ATTACHMENTS.mag.size[g.id] > g.mag, `${g.id} extended mag holds more`);
  }
});

test('only one optic at a time: the later pick takes the other off', () => {
  assert.deepEqual(fit(['holo', 'scope']), ['scope']);
  assert.deepEqual(fit(['scope', 'holo']), ['holo']);
  assert.deepEqual(fit(['light', 'mag', 'suppressor', 'holo']), ['light', 'suppressor', 'holo', 'mag']);
  assert.deepEqual(fit(['laser', 'light', 'light', '__proto__', null]), ['light'], 'unknown names and repeats are dropped');
  assert.deepEqual(fit(undefined), []);
  assert.deepEqual(toggle(['holo'], 'scope'), ['scope']);
  assert.deepEqual(toggle(['scope', 'light'], 'scope'), ['light']);
  assert.deepEqual(toggle([], 'mag'), ['mag']);
});

test('attachments change the numbers they should and nothing else', () => {
  const plain = stats('pistol'), kitted = stats('pistol', ['suppressor', 'scope', 'mag', 'light']);
  assert.equal(plain.mag, 15); assert.equal(kitted.mag, 21);
  assert.ok(kitted.damage < plain.damage && kitted.damage > plain.damage * 0.9, 'a suppressor costs a little damage');
  assert.ok(kitted.loud < 0.5 && kitted.flash < 0.5 && plain.loud === 1 && plain.flash === 1);
  assert.ok(kitted.kick.up < plain.kick.up);
  assert.equal(kitted.zoom, 2.5); assert.ok(kitted.ads > plain.ads, 'a long scope is slower to raise');
  assert.ok(stats('pistol', ['holo']).ads < plain.ads, 'a holo sight is quicker');
  for (const g of GUNS) {
    assert.equal(stats(g.id, ['holo']).zoom, stats(g.id).zoom, `${g.id}: a holo sight does not zoom out`);
    assert.ok(stats(g.id, ['scope']).zoom > stats(g.id).zoom, `${g.id}: the long scope zooms in`);
  }
  assert.ok(kitted.reload.partial > plain.reload.partial, 'a bigger magazine is a little slower to swap');
  assert.equal(kitted.light, true); assert.equal(plain.light, false);
  assert.equal(kitted.interval, plain.interval);
  assert.equal(stats('sniper', ['scope']).zoom, 8);
  assert.equal(stats('nope'), null);
  for (const odd of ['constructor', '__proto__', 'toString', undefined]) assert.equal(stats(odd), null, String(odd));
});

test('damage holds to the first mark and eases to the floor by the second', () => {
  const s = stats('pistol');
  assert.equal(damageAt(s, 5), 34);
  assert.equal(damageAt(s, 18), 34);
  assert.ok(Math.abs(damageAt(s, 45) - 34 * 0.6) < 1e-9);
  assert.ok(Math.abs(damageAt(s, 500) - 34 * 0.6) < 1e-9);
  assert.ok(damageAt(s, 30) < 34 && damageAt(s, 30) > 34 * 0.6);
});

test('stars unlock the guns in order', () => {
  assert.deepEqual(gunsFor(0), ['pistol']);
  assert.deepEqual(gunsFor(1), ['pistol', 'smg']);
  assert.deepEqual(gunsFor(6), ['pistol', 'smg', 'rifle']);
  assert.deepEqual(gunsFor(15), ['pistol', 'smg', 'rifle', 'sniper', 'lmg']);
  assert.deepEqual(nextGun(0), { id: 'smg', name: 'Vesper', kind: 'SMG', need: 1 });
  assert.equal(nextGun(5).need, 2);
  assert.equal(nextGun(10), null);
});

test('a gun cannot fire while it is being drawn', () => {
  const s = stats('pistol'), w = newWeapon(s);
  assert.equal(count(run(w, s, s.draw - 0.05, { fire: true }), 'shot'), 0);
  assert.equal(w.ammo, 15);
});

test('the pistol fires once per pull however long the trigger is held', () => {
  const s = stats('pistol'), w = ready(s);
  assert.equal(count(run(w, s, 1, { fire: true }), 'shot'), 1);
  run(w, s, 0.2, { fire: false });
  assert.equal(count(run(w, s, 0.05, { fire: true }), 'shot'), 1);
  assert.equal(w.ammo, 13);
});

test('an automatic keeps firing at its rate while the trigger is held', () => {
  const s = stats('smg'), w = ready(s);
  const shots = count(run(w, s, 1, { fire: true }), 'shot');
  assert.ok(Math.abs(shots - 860 / 60) <= 1, `${shots} shots in a second`);
});

test('shots open the aim up, rest closes it, and aiming is steadier', () => {
  const s = stats('rifle'), w = ready(s);
  const still = spreadNow(w, s, 0);
  run(w, s, 0.5, { fire: true });
  assert.ok(spreadNow(w, s, 0) > still, 'firing opens it');
  assert.ok(spreadNow(w, s, 1) < spreadNow(w, s, 0), 'aimed is tighter');
  assert.ok(w.bloom <= s.spread.max);
  run(w, s, 2, {});
  assert.equal(spreadNow(w, s, 0), still, 'it settles back');
  assert.equal(spreadNow(w, s, 1), s.spread.ads);
});

test('a burst climbs, and the climb starts over after a pause', () => {
  const s = stats('rifle'), w = ready(s);
  const ups = run(w, s, 1, { fire: true }).filter(e => e.type === 'shot').map(e => e.up);
  assert.ok(ups.at(-1) > ups[0] * 1.5, 'later shots in a burst kick more');
  run(w, s, 0.5, {});
  const again = run(w, s, 0.05, { fire: true }).find(e => e.type === 'shot');
  assert.equal(again.up, ups[0]);
});

test('a reload with rounds left keeps the one in the chamber, and the moments come in order', () => {
  const s = stats('pistol'), w = ready(s);
  run(w, s, 0.05, { fire: true }); run(w, s, 0.3, {});
  assert.equal(w.ammo, 14);
  const ev = run(w, s, 0.02, { reload: true }).concat(run(w, s, s.reload.partial + 0.05, {}));
  assert.deepEqual(ev.map(e => e.type), ['reload', 'mag_out', 'mag_in', 'ready']);
  assert.equal(ev[0].empty, false);
  assert.equal(w.ammo, 16, 'fifteen in the magazine and one in the chamber');
  assert.equal(count(run(w, s, 0.1, { reload: true }), 'reload'), 0, 'a full gun does not reload');
});

test('no shot can be fired in the middle of a reload, and progress runs 0 to 1', () => {
  const s = stats('pistol'), w = ready(s);
  run(w, s, 0.05, { fire: true }); run(w, s, 0.3, {});
  run(w, s, 0.05, { reload: true });
  assert.ok(reloadProgress(w, s) > 0 && reloadProgress(w, s) < 0.1);
  assert.equal(count(run(w, s, 0.6, { fire: true }), 'shot'), 0);
  run(w, s, 2, {});
  assert.equal(reloadProgress(w, s), 0);
});

test('an empty gun clicks once, reloads by itself, and racks the slide at the end', () => {
  const s = stats('pistol'), w = ready(s);
  for (let i = 0; i < 15; i++) { run(w, s, 0.02, { fire: true }); run(w, s, 0.2, { fire: false }); }
  assert.equal(w.ammo, 0);
  const ev = run(w, s, 0.02, { fire: true }).concat(run(w, s, s.reload.empty + 0.05, { fire: true }));
  assert.deepEqual(ev.map(e => e.type), ['dry', 'reload', 'mag_out', 'mag_in', 'rack', 'ready']);
  assert.equal(ev[1].empty, true);
  assert.equal(w.ammo, 15, 'nothing was in the chamber');
});

test('the last round says so, for the slide to lock back', () => {
  const s = stats('pistol'), w = ready(s);
  let last = null;
  for (let i = 0; i < 15; i++) { last = run(w, s, 0.02, { fire: true }).find(e => e.type === 'shot'); run(w, s, 0.2, { fire: false }); }
  assert.equal(last.last, true);
});

test('the sniper works its bolt between shots', () => {
  const s = stats('sniper'), w = ready(s);
  const ev = run(w, s, 0.05, { fire: true });
  assert.deepEqual(ev.map(e => e.type), ['shot', 'bolt']);
  run(w, s, 0.1, { fire: false });
  assert.equal(count(run(w, s, s.bolt - 0.3, { fire: true }), 'shot'), 0, 'not until the bolt is home');
  run(w, s, 0.4, { fire: false });
  assert.equal(count(run(w, s, 0.05, { fire: true }), 'shot'), 1);
});

test('a suppressed shot is quieter and flashes less', () => {
  const s = stats('smg', ['suppressor']), w = ready(s);
  const shot = run(w, s, 0.05, { fire: true }).find(e => e.type === 'shot');
  assert.ok(shot.loud < 0.5 && shot.flash < 0.5);
});

test('tapping slowly lets the aim settle between shots; a held burst does not', () => {
  const s = stats('smg'), held = ready(s), tapped = ready(s);
  run(held, s, 0.6, { fire: true });
  for (let i = 0; i < 4; i++) { run(tapped, s, 0.02, { fire: true }); run(tapped, s, 0.5, {}); }
  assert.ok(held.bloom > s.spread.bloom * 4, 'the burst piles up');
  assert.equal(tapped.bloom, 0);
});

test('scatter stays inside the spread circle', () => {
  let n = 0; const rng = () => (n = (n * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 500; i++) { const [x, y] = scatter(2, rng); assert.ok(Math.hypot(x, y) <= 2 + 1e-9); }
  assert.deepEqual(scatter(0, rng).map(Math.abs), [0, 0]);
});

test('the rate of fire is the gun\'s own at any frame rate', () => {
  for (const id of ['smg', 'rifle', 'lmg']) {
    const s = stats(id, ['mag']), want = 2 / s.interval;
    for (const fps of [30, 45, 60, 90, 144]) {
      const w = ready(s);
      let shots = 0;
      for (let t = 0; t < 2 - 1e-9; t += 1 / fps) shots += count(step(w, s, 1 / fps, { fire: true }, seq(0.5)), 'shot');
      assert.ok(Math.abs(shots - want) <= 1.5, `${id} at ${fps} fps fired ${shots}, its rate gives ${want.toFixed(1)}`);
    }
  }
});

test('a long frame fires the shots it covers, never more than the magazine holds', () => {
  const s = stats('smg'), w = ready(s);
  const shots = count(step(w, s, 0.5, { fire: true }), 'shot');
  assert.ok(shots >= 6 && shots <= 8, `${shots} shots in half a second at once`);
  const w2 = ready(s);
  assert.equal(count(step(w2, s, 60, { fire: true }), 'shot'), 30);
  assert.equal(w2.ammo, 0);
});

test('an automatic held past its last round clicks, reloads and carries on', () => {
  const s = stats('smg'), w = ready(s);
  const ev = run(w, s, 6, { fire: true });
  assert.equal(ev.filter(e => e.type === 'dry').length, 1);
  assert.equal(ev.filter(e => e.type === 'reload').length, 1);
  assert.ok(count(ev, 'shot') > 30, 'it fires again after the reload');
});

test('a pull a moment early still fires: fast clicking loses no more than the gun\'s own rate', () => {
  const s = stats('pistol'), w = ready(s);
  let shots = 0;
  // Ten clicks a second for two seconds; the pistol allows seven shots a second.
  for (let i = 0; i < 20; i++) { shots += count(run(w, s, 0.04, { fire: true }), 'shot'); shots += count(run(w, s, 0.06, { fire: false }), 'shot'); }
  assert.ok(shots >= 13 && shots <= 15, `${shots} shots from 20 clicks`);
});

test('holding the reload key does not reload twice; a second press tops the chamber up', () => {
  const s = stats('pistol'), w = ready(s);
  for (let i = 0; i < 15; i++) { run(w, s, 0.02, { fire: true }); run(w, s, 0.2, {}); }
  run(w, s, 0.02, { fire: true });
  const held = run(w, s, s.reload.empty + 1.5, { reload: true });
  assert.equal(count(held, 'reload'), 0, 'the empty gun was already reloading; the held key adds nothing');
  assert.equal(w.ammo, 15);
  run(w, s, 0.05, {});
  run(w, s, 0.02, { reload: true }); run(w, s, s.reload.partial + 0.1, {});
  assert.equal(w.ammo, 16);
});

test('guns that fire from an open bolt or a fixed magazine hold no extra round; a bigger magazine holds its own count', () => {
  for (const [id, att, full] of [['lmg', [], 100], ['sniper', [], 5], ['pistol', ['mag'], 22], ['lmg', ['mag'], 150]]) {
    const s = stats(id, att), w = ready(s);
    run(w, s, 0.02, { fire: true }); run(w, s, s.bolt + 0.3, {});
    run(w, s, 0.02, { reload: true }); run(w, s, s.reload.partial + 0.1, {});
    assert.equal(w.ammo, full, `${id} ${att}`);
  }
});

test('the sniper\'s last round needs no bolt; the next pull clicks and reloads', () => {
  const s = stats('sniper'), w = ready(s);
  let ev = [];
  for (let i = 0; i < 5; i++) { ev = run(w, s, 0.02, { fire: true }); run(w, s, s.bolt + 0.2, {}); }
  assert.deepEqual(ev.map(e => e.type), ['shot']);
  assert.equal(ev[0].last, true);
  assert.deepEqual(run(w, s, 0.02, { fire: true }).map(e => e.type), ['dry', 'reload']);
});

test('a reload asked for while the bolt is cycling or the gun is being drawn starts as soon as it is free', () => {
  const s = stats('sniper'), w = ready(s);
  run(w, s, 0.02, { fire: true });
  // A tap on reload a third of the way through the bolt's travel.
  run(w, s, 0.3, {}); run(w, s, 0.03, { reload: true });
  const ev = run(w, s, s.bolt, {});
  assert.deepEqual(ev.map(e => e.type).slice(0, 2), ['ready', 'reload']);
  run(w, s, s.reload.partial + 0.1, {});
  assert.equal(w.ammo, 5);
  // Held down from the draw onward on a full gun (the machine gun holds no extra round): nothing to reload, and
  // the press is not kept for after the next shot.
  const m = stats('lmg'), fresh = newWeapon(m);
  assert.equal(count(run(fresh, m, m.draw + 0.5, { reload: true }), 'reload'), 0);
  run(fresh, m, 0.05, {}); run(fresh, m, 0.02, { fire: true });
  assert.equal(count(run(fresh, m, 0.5, {}), 'reload'), 0);
});
