import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { RIGS, partNames } from '../../web/src/pure/rigs.js';
import { CLIPS, sample } from '../../web/src/pure/clips.js';
import { GUN_HOLDS, solveHolds } from '../../web/src/pure/handling.js';
import { HOLDS } from '../../web/src/range/holds.js';
import { GUN_SOUNDS, gunSound, soundsFor } from '../../web/src/audio/pure/gunsound.js';
import { stats, GUN } from '../../web/src/pure/arsenal.js';
import { deepest, toOuter, palmPoints, digit, miss } from '../../web/src/pure/hands.js';

const IDS = Object.keys(RIGS);
// The names of every node in a packed gun file (its JSON chunk).
function nodeNames(file) {
  const b = readFileSync(new URL('../../web/' + file, import.meta.url));
  assert.equal(b.toString('latin1', 0, 4), 'glTF');
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  return new Set((json.nodes || []).map(n => n.name).filter(Boolean));
}

test('every gun that can be held has its numbers, its hands, its moves, its sounds and its file', () => {
  for (const id of IDS) {
    assert.ok(GUN[id], `${id} in arsenal.js`);
    assert.ok(GUN_HOLDS[id] && HOLDS[id], `${id}: hands fitted (node blender/holds.js)`);
    assert.ok(CLIPS[id], `${id}: clips`);
    assert.ok(GUN_SOUNDS[id], `${id}: sounds`);
    assert.ok(existsSync(new URL('../../web/' + RIGS[id].file, import.meta.url)), `${id}: ${RIGS[id].file}`);
  }
});

test('each gun file holds every part, anchor and attachment mount the page looks up', () => {
  for (const id of IDS) {
    const names = nodeNames(RIGS[id].file), p = RIGS[id].prefix;
    for (const n of [...partNames(id), `${p}_muzzle`, `${p}_eject`, `${p}_aim_iron`]) assert.ok(names.has(n), `${id}: ${n}`);
    if (id !== 'pistol') for (const m of ['muzzle', 'optic', 'rail', 'mag']) assert.ok(names.has(`${p}_mount_${m}`), `${id}: mount ${m}`);
    for (const side of ['left', 'right']) for (const [pose, key] of Object.entries(RIGS[id].rides[side] || {})) {
      assert.ok(RIGS[id].parts[key], `${id}: ${pose} rides ${key}, a part`);
      assert.ok(HOLDS[id][side][pose], `${id}: the ${side} hand has a ${pose} pose`);
    }
  }
});

test('the clips: every pose they name is fitted, every cue is a sound the gun makes, all inside their time', () => {
  for (const id of IDS) {
    const s = stats(id, []), C = CLIPS[id](s);
    assert.ok(Math.abs(C.reload.T - s.reload.partial) < 1e-9 && Math.abs(C.reloadEmpty.T - s.reload.empty) < 1e-9, `${id}: reloads last the weapon's own times`);
    for (const [name, c] of Object.entries(C)) {
      for (const side of ['right', 'left']) for (const [t, pose] of c[side] || []) {
        assert.ok(t >= 0 && t <= c.T + 1e-9, `${id} ${name}: ${side} key at ${t}`);
        assert.ok(pose === 'low' || HOLDS[id][side][pose], `${id} ${name}: no ${side} ${pose}`);
      }
      for (const [t, cue] of c.cues || []) {
        assert.ok(t >= 0 && t <= c.T, `${id} ${name}: cue ${cue} at ${t}`);
        assert.ok(cue === 'eject' || gunSound(cue, id), `${id} ${name}: ${cue} is not a sound of this gun`);
      }
      if (c.held) {
        assert.ok(c.held[0] < c.held[1] && c.held[1] <= c.T, `${id} ${name}: held ${c.held}`);
        for (const [, v] of c.slide) assert.ok(v >= 0 && v <= 1);
      }
    }
    // A gun whose bolt is hauled back by hand lets it go exactly when the weapon says the action is home.
    if (RIGS[id].action === 'bolt') {
      const E = C.reloadEmpty;
      assert.ok(Math.abs(E.held[1] - s.reload.rack) < 1e-9, `${id}: let go at ${E.held[1]}, the rack at ${s.reload.rack}`);
      assert.ok(E.slide.some(([t, v]) => v === 1 && t < s.reload.rack), `${id}: hauled all the way back first`);
    }
  }
});

test('a bolt worked by hand: after a shot it is lifted, drawn back to throw the case, closed, all inside the bolt\'s time', () => {
  for (const id of IDS.filter(x => RIGS[x].action === 'turn')) {
    const s = stats(id, []), C = CLIPS[id](s);
    for (const c of [C.cycle, C.reloadEmpty]) {
      const at = name => c.cues.find(([, n]) => n === name)[0], drawn = t => sample(c, t).bolt;
      assert.ok(drawn(at('eject'))[1] > 0.9 && drawn(at('eject'))[0] > 0.99, `${id}: the case flies with the bolt back`);
      assert.deepEqual(sample(c, c.T).bolt, [0, 0]);
      assert.ok(at('boltOpen') < at('eject') && at('eject') < at('boltClose'));
    }
    assert.ok(Math.abs(C.cycle.T - s.bolt) < 1e-9);
    assert.ok(C.reloadEmpty.bolt.at(-1)[0] <= s.reload.empty && !C.reload.bolt, `${id}: only from empty is the bolt worked`);
    // The free hand stays on the forend while the bolt is worked (a clip that leaves a hand out keeps it on its grip;
    // it once left the hand with no pose and stopped the page).
    assert.deepEqual(sample(C.cycle, 0.5).left, { a: 'grip', b: 'grip', k: 0 });
  }
});

test('a feed cover: lifted before the box comes off, the belt hidden from the box\'s going to its laying, shut before the end', () => {
  for (const id of IDS.filter(x => RIGS[x].parts.cover)) {
    const s = stats(id, []), C = CLIPS[id](s);
    for (const c of [C.reload, C.reloadEmpty]) {
      assert.ok(sample(c, s.reload.out).cover > 0.99, `${id}: open when the box comes off`);
      assert.equal(sample(c, s.reload.out + 0.01).belt, false);
      assert.equal(sample(c, s.reload.in).belt, true);
      assert.equal(sample(c, c.T).cover, 0);
      assert.equal(sample(c, 0).belt, true);
    }
  }
});

test('each gun\'s sounds are clean two-channel takes ending in silence, and the suppressed shot waits for a suppressor', () => {
  for (const id of IDS) {
    const list = soundsFor(id);
    assert.ok(list.length > 10 && !list.some(([n]) => n === 'shotQuiet'), id);
    for (const [n, t] of list.filter(([name]) => name === 'shot' || name === 'slideRelease')) {
      const [L, R] = gunSound(n, id, t);
      assert.equal(L.length, R.length);
      assert.ok(L[L.length - 1] === 0, `${id} ${n} ends on ${L[L.length - 1]}`);
      let peak = 0;
      for (const v of L) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
      assert.ok(peak > 0.2 && peak <= 0.951, `${id} ${n} peaks at ${peak}`);
    }
  }
  assert.notDeepEqual(gunSound('shot', 'smg')[0].slice(0, 2000), gunSound('shot', 'pistol')[0].slice(0, 2000), 'the Vesper has its own shot');
});

// ---------- the hands on the long guns ----------
const palm = (side, pose, sdf) => Math.min(...palmPoints(side).map(p => sdf(toOuter(pose, p))));
const DEEP = -0.0025;
for (const id of IDS.filter(x => GUN_HOLDS[x].fore)) {
  const H = GUN_HOLDS[id], h = solveHolds(id);
  test(`${id}: the right hand closes round the grip with its finger on the trigger, as on the pistol`, () => {
    assert.ok(deepest('right', h.right.grip, H.shape, ['middle', 'ring', 'pinky']) > DEEP);
    assert.ok(miss('right', 'index', h.right.grip, h.right.grip.digits.index, H.trigger.pad) < 0.005);
    const p = palm('right', h.right.grip, H.shape);
    assert.ok(p > 0 && p < 0.002, `palm ${p}`);
  });
  test(`${id}: the free hand holds the handguard from below, fingers up its right side, thumb on its left`, () => {
    const L = h.left.grip, p = palm('left', L, H.shape);
    assert.ok(p > 0 && p < 0.003, `palm ${p} off the handguard`);
    assert.ok(deepest('left', L, H.shape) > DEEP, `${deepest('left', L, H.shape)}`);
    const tip = d => toOuter(L, digit('left', d, L.digits[d]).pts[3]);
    for (const d of ['index', 'middle', 'ring']) assert.ok(tip(d)[2] > 0.005, `${d} tip at ${tip(d)}`);
    assert.ok(tip('thumb')[2] < -0.01, `thumb at ${tip('thumb')}`);
    assert.ok(L.at[1] < H.fore.knuckle[1] + 0.03 && L.at[0] > 0.15, 'under the handguard, ahead of the magazine');
  });
  test(`${id}: a fresh magazine is held in the free hand, fingers round its front`, () => {
    const C = h.left.mag, p = palm('left', C, h.magged);
    assert.ok(p > 0 && p < 0.003, `palm ${p}`);
    assert.ok(deepest('left', C, h.magged) > DEEP);
    assert.ok(toOuter(C, digit('left', 'middle', C.digits.middle).pts[3])[2] > 0, 'the middle finger reaches round to the far side');
  });
  for (const [name] of Object.entries(H.rightExtra || {})) test(`${id}: the right hand's ${name} pose rests on what it works and keeps out of the gun`, () => {
    const P = h.right[name], p = palm('right', P, H.shape);
    assert.ok(p > 0 && p < 0.003 && deepest('right', P, H.shape) > DEEP, `palm ${p}, deepest ${deepest('right', P, H.shape)}`);
  });
  for (const [name] of Object.entries(H.extra || {})) test(`${id}: the free hand's ${name} pose keeps out of the gun`, () => {
    assert.ok(deepest('left', h.left[name], H.shape) > -0.006, `${deepest('left', h.left[name], H.shape)}`);
  });
}

test('the Vesper\'s free hand takes its charging handle: the knob in the palm, fingers over the top, the arm from below', () => {
  const C = HOLDS.smg.left.charge, knob = p => Math.hypot(p[0] - 0.175, p[1] - 0.034) + Math.max(0, Math.abs(p[2] + 0.031) - 0.012);
  assert.ok(Math.min(...palmPoints('left').map(q => knob(toOuter(C, q)))) < 0.02, 'the knob is in the palm');
  const tips = ['index', 'middle'].map(d => toOuter(C, digit('left', d, C.digits[d]).pts[3]));
  assert.ok(tips.every(t => t[1] > 0.045 && t[2] > 0), `over the top: ${JSON.stringify(tips)}`);
  assert.ok(C.at[1] < 0.034, 'the wrist below the knob');
});

test('the Keeper\'s free hand takes its side charger the same way: the knob in the palm, the arm from below', () => {
  const C = HOLDS.rifle.left.charge, knob = p => Math.hypot(p[0] - 0.005, p[1] - 0.038) + Math.max(0, Math.abs(p[2] + 0.0305) - 0.012);
  assert.ok(Math.min(...palmPoints('left').map(q => knob(toOuter(C, q)))) < 0.02, 'the knob is in the palm');
  assert.ok(C.at[1] < 0.038, 'the wrist below the knob');
});

test('the Gatekeeper\'s feed cover is worked from its left edge, the wrist below it (a hand from above hid the view)', () => {
  const C = HOLDS.lmg.left.cover, tips = ['index', 'middle', 'ring'].map(d => toOuter(C, digit('left', d, C.digits[d]).pts[3]));
  assert.ok(C.at[1] < 0.03 && C.at[2] < -0.02, `wrist at ${C.at}`);
  assert.ok(tips.every(t => t[1] > 0.066), `fingers over the cover: ${JSON.stringify(tips)}`);
});
