import test from 'node:test';
import assert from 'node:assert/strict';
import { GUNS, ATTACHMENTS, stats } from '../../web/src/pure/arsenal.js';
import { CLIPS, sample } from '../../web/src/pure/clips.js';
import { newWeapon, step } from '../../web/src/pure/weapon.js';
import { SLOTS, BLURBS, CAMOS, CHARMS, CAMO, CHARM, BARS, optionsFor, isOpen, lockLine, readKit, readKits, choose, inSlot, bars, compare } from '../../web/src/pure/smith.js';

const IDS = GUNS.map(g => g.id);
// Every way a gun can be fitted: each slot empty or holding one of its attachments.
const KITS = (() => {
  let out = [[]];
  for (const slot of ['rail', 'muzzle', 'optic', 'mag']) out = out.flatMap(k => [k, ...optionsFor(slot).map(a => [...k, a])]);
  return out;
})();

test('every attachment has a slot on the bench and a line saying what it does', () => {
  assert.deepEqual(SLOTS.map(s => s.id), ['muzzle', 'optic', 'rail', 'mag', 'camo', 'charm']);
  for (const [id, a] of Object.entries(ATTACHMENTS)) {
    assert.ok(SLOTS.some(s => s.id === a.slot), id);
    assert.ok(BLURBS[id], id);
  }
  assert.deepEqual(optionsFor('optic'), ['holo', 'scope']);
  assert.equal(KITS.length, 2 * 2 * 3 * 2);
});

test('the weight out front slows the aim a little; the holo sight still quickens it', () => {
  for (const id of IDS) {
    const bare = stats(id).ads;
    for (const a of ['light', 'suppressor', 'mag', 'scope']) assert.ok(stats(id, [a]).ads > bare, `${id} ${a}`);
    assert.ok(stats(id, ['holo']).ads < bare, `${id} holo`);
    // Nothing else moves the aim time: fire rate, draw and damage stay the gun's own.
    assert.equal(stats(id, ['light']).interval, stats(id).interval);
    assert.equal(stats(id, ['mag', 'light', 'holo']).draw, stats(id).draw);
    assert.equal(stats(id, ['light']).damage, stats(id).damage);
  }
  assert.ok(Math.abs(stats('pistol', ['light']).ads - 0.17 * 1.04) < 1e-12);
  assert.ok(Math.abs(stats('rifle', ['suppressor', 'mag', 'holo', 'light']).ads - 0.24 * 1.05 * 1.05 * 0.92 * 1.04) < 1e-12);
});

test('every clip of every gun however fitted: keys in order, inside its time, the reload as long as the weapon says', () => {
  for (const id of IDS) for (const att of KITS) {
    const s = stats(id, att), C = CLIPS[id](s);
    assert.ok(Math.abs(C.reload.T - s.reload.partial) < 1e-9 && Math.abs(C.reloadEmpty.T - s.reload.empty) < 1e-9, `${id} ${att}`);
    for (const [name, c] of Object.entries(C)) {
      for (const track of ['right', 'left', 'gun', 'mag', 'slide', 'bolt', 'cover', 'cues']) {
        const keys = c[track] || [];
        for (let i = 1; i < keys.length; i++) assert.ok(keys[i][0] >= keys[i - 1][0], `${id} ${att} ${name} ${track} out of order at ${keys[i][0]}`);
        for (const [t] of keys) assert.ok(t >= 0 && t <= c.T + 1e-9, `${id} ${att} ${name} ${track} at ${t} of ${c.T}`);
      }
    }
  }
});

test('the Gatekeeper\'s bigger box keeps the reload in step: the box home and the belt laid the same time before the rounds count', () => {
  const at = (c, cue) => c.cues.find(([, n]) => n === cue)[0];
  for (const empty of [false, true]) {
    const gap = att => { const s = stats('lmg', att), c = CLIPS.lmg(s)[empty ? 'reloadEmpty' : 'reload']; return [s.reload.in - at(c, 'magIn'), s.reload.in - at(c, 'beltIn'), s.reload.in - c.beltOn]; };
    const plain = gap([]), big = gap(['mag']);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(plain[i] - big[i]) < 1e-9, `${empty ? 'empty' : 'partial'}: ${plain} against ${big}`);
    assert.ok(Math.abs(plain[0] - 0.6) < 1e-9 && Math.abs(plain[1] - 0.35) < 1e-9, 'the plain box keeps its old moments');
    // The hand lets go of the box as it seats and takes the belt; the box is home before the hand leaves it.
    const s = stats('lmg', ['mag']), c = CLIPS.lmg(s)[empty ? 'reloadEmpty' : 'reload'];
    assert.deepEqual(sample(c, at(c, 'magIn')).mag, [0, 0]);
    assert.equal(sample(c, s.reload.in).belt, true);
  }
});

test('the reload run against the weapon with the extended magazine: every event on its cue', () => {
  for (const id of IDS) {
    const s = stats(id, ['mag']), C = CLIPS[id](s), w = newWeapon(s);
    for (let t = 0; t < s.draw + 0.1; t += 1 / 60) step(w, s, 1 / 60, {});
    for (let i = 0; i < s.mag + 2 && w.ammo > 0; i++) { step(w, s, 1 / 60, { fire: true }); for (let t = 0; t < Math.max(s.interval, s.bolt || 0) + 0.05; t += 1 / 60) step(w, s, 1 / 60, {}); }
    assert.equal(w.ammo, 0, id);
    const ev = [];
    for (let t = 0; t < s.reload.empty + 0.5; t += 1 / 120) for (const e of step(w, s, 1 / 120, { fire: t < 0.02 })) ev.push([w.phase === 'reload' ? w.t : s.reload.empty, e.type]);
    assert.equal(w.ammo, s.mag, `${id} holds ${s.mag}`);
    const inAt = ev.find(([, e]) => e === 'mag_in')[0];
    assert.ok(Math.abs(inAt - s.reload.in) < 0.01, `${id}: the rounds count at ${inAt}, the clip says ${s.reload.in}`);
    assert.ok(C.reloadEmpty.cues.some(([t, n]) => n === 'magIn' && t <= s.reload.in + 1e-9), id);
  }
});

test('finishes and charms: original names, unique ids, and a few earned with stars', () => {
  for (const list of [CAMOS, CHARMS]) {
    assert.equal(new Set(list.map(x => x.id)).size, list.length);
    assert.ok(list.some(x => x.unlock?.stars), 'some are earned');
    assert.ok(list.filter(x => !x.unlock).length >= 5, 'most are free');
  }
  assert.equal(CAMOS[0].id, 'factory'); assert.equal(CHARMS[0].id, 'none');
  for (const c of CAMOS.filter(x => x.kind !== 'none')) {
    assert.ok(c.colours.every(h => /^#[0-9a-f]{6}$/.test(h)), c.id);
    assert.ok(c.metres > 0 && c.rough >= 0 && c.rough <= 1 && c.metal >= 0 && c.metal <= 1, c.id);
  }
  assert.ok(!/(multicam|marpat|kryptek|realtree|mossy oak|glock|sig)/i.test(JSON.stringify([CAMOS, CHARMS])), 'no real pattern or maker names');
});

test('locks: stars open what they say, achievements stay shut until there are any', () => {
  assert.equal(isOpen(CAMO.gold, 14), false);
  assert.equal(isOpen(CAMO.gold, 15), true);
  assert.equal(isOpen(CAMO.tidepool, 0), true);
  assert.equal(isOpen(CHARM.star, 4), false);
  assert.equal(isOpen(CHARM.star, 5), true);
  const later = { id: 'x', unlock: { achievement: 'kitted' } };
  assert.equal(isOpen(later, 15), false);
  assert.equal(isOpen(later, 15, id => id === 'kitted'), true);
  assert.equal(isOpen(later, 15, () => false), false);
  assert.equal(isOpen(null), false); assert.equal(isOpen(undefined, 99), false);
  assert.equal(lockLine(CAMO.gold), '15 range stars'); assert.equal(lockLine(later), 'An achievement'); assert.equal(lockLine(CAMO.dune), '');
});

test('a saved loadout is read safely: broken, old or edited, only what exists and is open comes back', () => {
  assert.deepEqual(readKit(null), { att: [], camo: 'factory', charm: 'none' });
  assert.deepEqual(readKit({ att: ['scope', 'holo', 'laser', 7, 'mag'], camo: 'tidepool', charm: 'die' }), { att: ['holo', 'mag'], camo: 'tidepool', charm: 'die' });
  assert.deepEqual(readKit({ att: 'scope', camo: 'gold', charm: 'star' }, 4), { att: [], camo: 'factory', charm: 'none' }, 'locked ones fall back');
  assert.deepEqual(readKit({ camo: 'gold', charm: 'star' }, 15), { att: [], camo: 'gold', charm: 'star' });
  assert.deepEqual(readKit({ camo: '__proto__', charm: 'constructor' }), { att: [], camo: 'factory', charm: 'none' });
  assert.deepEqual(readKit([1, 2]), { att: [], camo: 'factory', charm: 'none' });
  const all = readKits(JSON.stringify({ pistol: { att: ['light'] }, nope: { att: ['mag'] }, __proto__: { att: ['mag'] } }));
  assert.deepEqual(Object.keys(all), IDS);
  assert.deepEqual(all.pistol.att, ['light']); assert.deepEqual(all.smg.att, []);
  for (const bad of ['', '{', 'null', '[]', '"x"', '42']) assert.deepEqual(readKits(bad).rifle, { att: [], camo: 'factory', charm: 'none' }, bad);
});

test('choosing in a slot replaces what was there and touches nothing else', () => {
  let k = readKit({ att: ['light', 'holo'], camo: 'dune', charm: 'cat' });
  k = choose(k, 'optic', 'scope');
  assert.deepEqual(k, { att: ['light', 'scope'], camo: 'dune', charm: 'cat' });
  assert.equal(inSlot(k, 'optic'), 'scope'); assert.equal(inSlot(k, 'muzzle'), 'none'); assert.equal(inSlot(k, 'camo'), 'dune');
  k = choose(k, 'optic', 'none');
  assert.deepEqual(k.att, ['light']);
  assert.deepEqual(choose(k, 'muzzle', 'scope').att, ['light'], 'an attachment only goes in its own slot');
  assert.deepEqual(choose(k, 'mag', 'mag').att, ['light', 'mag']);
  assert.equal(choose(k, 'camo', 'nope').camo, 'dune');
  assert.equal(choose(k, 'charm', 'none').charm, 'none');
  const before = JSON.stringify(k); choose(k, 'rail', 'none');
  assert.equal(JSON.stringify(k), before, 'the kit given is never changed');
});

test('the bars: every gun however fitted reads between 0 and 1, with its real number', () => {
  for (const id of IDS) for (const att of KITS) for (const b of bars(id, att)) {
    assert.ok(b.k >= 0 && b.k <= 1 && Number.isFinite(b.k), `${id} ${att} ${b.id} ${b.k}`);
    assert.equal(typeof b.text, 'string');
  }
  assert.deepEqual(bars('nope'), []);
  const p = Object.fromEntries(bars('pistol').map(b => [b.id, b.text]));
  assert.deepEqual(p, { damage: '34', range: '45 m', rate: '420 rpm', aim: '170 ms', control: '2.23', hip: '1.10°', stealth: 'Loud', mag: '15', reload: '1.50 s', zoom: '1.25x' });
  // The bolt sets the Longview's real rate, not its trigger.
  assert.equal(bars('sniper').find(b => b.id === 'rate').text, '63 rpm');
  assert.ok(BARS.every(b => typeof b.name === 'string' && b.name.length < 16));
});

test('before and after: each attachment moves the bars it should, the right way', () => {
  const ch = (id, att) => Object.fromEntries(compare(id, [], [att]).filter(r => r.change).map(r => [r.id, r.change]));
  for (const id of IDS) {
    assert.deepEqual(ch(id, 'suppressor'), { damage: -1, aim: -1, control: 1, stealth: 1 }, id);
    assert.deepEqual(ch(id, 'holo'), { aim: 1, hip: 1 }, id);
    assert.deepEqual(ch(id, 'scope'), { aim: -1, zoom: 1 }, id);
    assert.deepEqual(ch(id, 'mag'), { aim: -1, mag: 1, reload: -1 }, id);
    assert.deepEqual(ch(id, 'light'), { aim: -1 }, id);
    assert.ok(compare(id, ['holo'], ['holo']).every(r => r.change === 0 && r.fromText === r.toText));
  }
  const r = compare('smg', [], ['mag']).find(x => x.id === 'mag');
  assert.deepEqual([r.fromText, r.toText], ['30', '45']);
});

test('the P-22\'s free hand cups the extended magazine by its own foot, into neither the magazine nor the grip', async () => {
  const { GUN_HOLDS, solveHolds, bake } = await import('../../web/src/pure/handling.js');
  const { HOLDS } = await import('../../web/src/range/holds.js');
  const { digit, toOuter, palmPoints, FINGERS } = await import('../../web/src/pure/hands.js');
  const H = GUN_HOLDS.pistol, holds = solveHolds('pistol'), C = holds.left.magX;
  assert.deepEqual(HOLDS.pistol.left.magX, bake(holds).left.magX, 'run node blender/holds.js');
  const magged = p => Math.min(H.long.mag(p), H.shape(p)), down = [-0.333, -0.943, 0], foot = [-0.0298, -0.1515, 0];
  const below = palmPoints('left').map(p => toOuter(C, p)).map(p => p.reduce((s, x, i) => s + (x - foot[i]) * down[i], 0));
  assert.ok(below.every(d => d > -0.004), `the palm is under the long foot: ${below.map(d => d.toFixed(4))}`);
  assert.ok(Math.min(...palmPoints('left').map(p => magged(toOuter(C, p)))) < 0.002, 'and pressed to it');
  for (const d of [...FINGERS, 'thumb']) {
    const { pts, r } = digit('left', d, C.digits[d]);
    for (let b = 0; b < 3; b++) for (let k = 1; k <= 16; k++) {
      const u = k / 16, p = pts[b].map((x, i) => x + (pts[b + 1][i] - x) * u);
      assert.ok(magged(toOuter(C, p)) - (r[b] + (r[b + 1] - r[b]) * u) > -0.0025, `${d} into the magazine or grip`);
    }
  }
  // The standard magazine's cup would sit inside the long one: that is why it has its own.
  assert.ok(Math.min(...palmPoints('left').map(p => H.long.mag(toOuter(holds.left.mag, p)))) < 0, 'the old cup is inside the long magazine');
});

test('the kit file holds every piece and mark the long guns ask for; each gun says where its charm hangs', async () => {
  const { readFileSync } = await import('node:fs');
  const { RIGS } = await import('../../web/src/pure/rigs.js');
  const b = readFileSync(new URL('../../web/assets/range/kit.glb', import.meta.url));
  const names = new Set(JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))).nodes.map(n => n.name));
  for (const n of ['KIT_light', 'KIT_light_lens', 'KIT_holo', 'KIT_holo_aim', 'KIT_scope', 'KIT_scope_aim', 'KIT_scope_long', 'KIT_scope_long_aim', 'KIT_riser']) assert.ok(names.has(n), n);
  for (const id of IDS) {
    const k = RIGS[id].kit;
    assert.ok(k && k.hook.length === 3 && k.hook.every(Number.isFinite) && k.hook[2] < 0, `${id}: a hook on its left side`);
    for (const n of [`KIT_sup_${id}`, `KIT_sup_${id}_end`, ...(k.own?.includes('mag') ? [] : [`KIT_mag_${id}`]), ...(k.light ? [k.light, k.light + '_lens'] : [])]) assert.ok(names.has(n), n);
    if (k.scope) assert.ok(names.has(k.scope) && names.has(k.scope + '_aim'), k.scope);
    if (k.optic) assert.ok(RIGS[id].parts[k.optic], `${id}: the optic rides ${k.optic}, a part`);
  }
  assert.ok(b.length < 600 * 1024, `kit.glb is ${b.length} bytes`);
  // No piece packed from a mesh with a point flung far off (the packing then hides the whole piece).
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  for (const n of json.nodes) for (const v of [...(n.translation || []), ...(n.scale || [])]) assert.ok(Math.abs(v) < 2, `${n.name}: ${v}`);
});
