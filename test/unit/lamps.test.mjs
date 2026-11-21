import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { onSwitch, roomLight, bulbLight, fillLight, settle, lightRole, indoors, GLASS_Y, OFF, SWITCH, SPOT, label, said, lightsCommand, MOVIE, dimsLamps, SCENE_RATE } from '../../web/src/pure/lamps.js';
import { checkLayout } from '../../web/src/pure/layoutcheck.js';
import { makeInteract } from '../../web/src/pure/interact.js';

const WORLD = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const fresh = () => JSON.parse(JSON.stringify(WORLD));
// Every mesh in the house's zones with the material it uses, read from the files themselves.
const ZONES = new URL('../../web/assets/zones/', import.meta.url);
const MESHES = readdirSync(ZONES).filter(f => f.endsWith('.glb') && !f.startsWith('range')).flatMap(f => {
  const b = readFileSync(new URL(f, ZONES)), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  const mats = (j.materials || []).map(m => m.name);
  return (j.nodes || []).filter(n => n.mesh !== undefined).flatMap(n => j.meshes[n.mesh].primitives.map(p => ({ name: n.name, mat: mats[p.material] })));
});
// The three.js loader drops the dots from names (shelf_led.001 arrives as shelf_led001).
const loaded = n => n.replace(/\./g, '');

const ON = ['ceiling_light0', 'ceiling_light7', 'downlight0', 'downlight5', 'read_lamp_bulb', 'console_lamp_bulb', 'lounge_lamp_bulb', 'arc_lamp_bulb', 'pianolamp_glow',
  'tea_lamp0_bulb', 'tea_lamp1_bulb', 'video_lamp0_glow', 'lightbar_glow', 'shelf_led', 'shelf_led.001', 'island_led', 'tea_cabinet_glow', 'kilim_light_glow', 'trophy_led0', 'trophy_led2'];
const STAY = ['bulb2', 'bulb38', 'neon', 'lava_glass', 'aria_tip', 'tread0_led', 'tread15_led', 'dais_led', 'dais_led2', 'pit_edge_led', 'pit_step0_led', 'studio_step1_led', 'mezz_under_led'];

test('the switch works the lamps, the ceiling lights and the shelf and cove strips, and nothing that glows on its own', () => {
  const warm = MESHES.filter(m => m.mat === 'E_warm' || m.mat === 'E_warm_soft');
  const names = new Set(warm.map(m => m.name));
  for (const n of [...ON, ...STAY]) assert.ok(names.has(n), `${n} is a real warm light in the house`);
  for (const m of warm) {
    const expect = ON.includes(m.name) || /^(ceiling_light|downlight|trophy_led)\d+$/.test(m.name);
    assert.equal(onSwitch(loaded(m.name), m.mat), expect, m.name);
  }
  // Only warm lights: a screen, the RGB, the fire, LEDs of other colours never go out.
  for (const m of MESHES.filter(m => !/^E_warm/.test(m.mat || ''))) assert.equal(onSwitch(loaded(m.name), m.mat), false, `${m.name} ${m.mat}`);
  assert.equal(onSwitch('read_lamp_bulb', 'E_teal'), false);
});

test('with the lamps on, every level is exactly one whatever the time of day: the house looks as it always has', () => {
  for (const d of [0, 0.25, 0.5, 0.731, 1, -2, 7]) {
    assert.deepEqual(roomLight(d, 1), [1, 1, 1]);
    assert.equal(bulbLight(d, 1), 1);
    assert.equal(fillLight(d, 1), 1);
  }
});

test('with the lamps off the room keeps the daylight: dark and cool at night, still bright by day', () => {
  const night = roomLight(0, 0), day = roomLight(1, 0);
  night.forEach((v, i) => assert.ok(Math.abs(v - OFF.night[i]) < 1e-12 && Math.abs(day[i] - OFF.day[i]) < 1e-12));
  for (let i = 0; i < 3; i++) assert.ok(night[i] < 0.2 && day[i] > 0.45 && day[i] < 1 && night[i] < day[i]);
  assert.ok(night[2] > night[0], 'moonlit: bluer than it is red');
  assert.ok(bulbLight(0, 0) < 0.1 && bulbLight(1, 0) < 0.25 && fillLight(0, 0) < fillLight(1, 0));
  // More lamp is always more light, and more day is never less.
  for (const d of [0, 0.5, 1]) for (let s = 0, k = 0; s < 10; s++, k = s / 10) {
    for (let i = 0; i < 3; i++) assert.ok(roomLight(d, k + 0.1)[i] > roomLight(d, k)[i] && roomLight(Math.min(1, d + 0.1), k)[i] >= roomLight(d, k)[i]);
    assert.ok(bulbLight(d, k + 0.1) > bulbLight(d, k) && fillLight(d, k + 0.1) > fillLight(d, k));
  }
});

test('flipping it fades the lights out in a blink and back on a touch slower, landing exactly on off or on', () => {
  const run = (k, on) => { let t = 0; while (k !== (on ? 1 : 0) && t < 2) { const n = settle(k, on, 1 / 60); assert.ok(on ? n >= k && n <= 1 : n <= k && n >= 0); k = n; t += 1 / 60; } return t; };
  const off = run(1, false), back = run(0, true);
  assert.ok(off > 0.1 && off < 0.4, `off in ${off.toFixed(2)} s`);
  assert.ok(back > off && back < 0.5, `on in ${back.toFixed(2)} s`);
  assert.equal(settle(1, true, 0.016), 1);
  assert.equal(settle(0, false, 0.5), 0);
  // A long frame (a hidden tab) jumps straight there.
  assert.equal(settle(1, false, 1), 0);
});

test('the lights on the people: the fill and the indoor lamps dim; the RGB, the screens, the fire, the balcony and the range keep theirs', () => {
  const roles = WORLD.lights.map(l => [l, lightRole(l)]);
  assert.equal(roles.filter(([, r]) => r === 'fill').length, 2);
  const lamps = roles.filter(([, r]) => r === 'lamp').map(([l]) => l);
  assert.equal(lamps.length, 9);
  for (const l of lamps) assert.ok(l.at[1] > 0 && l.at[1] < GLASS_Y && l.at[2] >= 1);
  const kept = roles.filter(([l]) => l.kind === 'point' && (l.role === 'rgb' || l.at[1] > GLASS_Y || l.at[1] < 0 || l.at[2] < 1));
  assert.equal(kept.length, 4, 'the RGB, the balcony, the range and the fire');
  for (const [l, r] of kept) assert.equal(r, null, JSON.stringify(l));
  assert.equal(lightRole({ kind: 'point', color: '#c4d4ff', at: [21.3, 1.2, 1.61] }), null, 'the cool glow of the screens');
});

test('the glass line sits between the window and the balcony floor', () => {
  const win = WORLD.window.center[1], deck = WORLD.floors.find(f => f.min[1] >= 15 && f.z === 0 && f.max[1] > 17);
  assert.ok(win < GLASS_Y && GLASS_Y < deck.min[1], `${win} < ${GLASS_Y} < ${deck.min[1]}`);
  assert.ok(indoors(win) && indoors(0.5) && !indoors(deck.min[1] + 0.01) && !indoors(17));
});

test('the switch is on the entry wall by the corner, at switch height, clear of everything else on that wall', () => {
  const meta = fresh(), wall = meta.colliders.find(c => c.name === 'wall_entry');
  assert.equal(SWITCH.wall, wall.min[0], 'flat on the partition\'s face toward the door');
  assert.ok(SWITCH.y - SWITCH.w / 2 > wall.min[1] + 0.2 && SWITCH.y + SWITCH.w / 2 < wall.max[1], 'on the wall, a hand\'s width from the corner');
  assert.ok(SWITCH.z >= 1.1 && SWITCH.z <= 1.3);
  for (const w of meta.walls.filter(w => w.wall === 'entry')) {
    const gapU = Math.max(w.u[0] - (SWITCH.y + SWITCH.w / 2), (SWITCH.y - SWITCH.w / 2) - w.u[1]), gapZ = Math.max(w.z[0] - (SWITCH.z + SWITCH.h / 2), (SWITCH.z - SWITCH.h / 2) - w.z[1]);
    assert.ok(gapU > 0.4 || gapZ > 0.4, `${w.name}: ${gapU.toFixed(2)} ${gapZ.toFixed(2)}`);
  }
  // From where you stand, it is beside you, not hidden behind you: a little to the side of the spot.
  assert.ok(SPOT.at[1] - SWITCH.y >= 0.25 && SWITCH.wall - SPOT.at[0] > 0.4 && SWITCH.wall - SPOT.at[0] < 0.7);
});

test('its spot has room to stand, answers only there, and does not show at the front door', () => {
  const meta = fresh();
  meta.interact.push({ ...SPOT, at: [...SPOT.at] });
  assert.deepEqual(checkLayout(meta).filter(p => p.startsWith(SPOT.id)), []);
  const it = makeInteract(meta.interact), [x, y] = SPOT.at;
  assert.equal(it.nearest({ x, y: 0, z: -y }).id, SPOT.id);
  for (const o of WORLD.interact.filter(o => Math.abs(o.at[2]) < 0.5)) {
    const d = Math.hypot(o.at[0] - x, o.at[1] - y);
    assert.ok(d > o.r && d > SPOT.r, `${o.id} ${d.toFixed(2)}`);
    assert.equal(it.nearest({ x: o.at[0], y: o.at[2], z: -o.at[1] })?.id, o.id);
  }
  const [sx, sy] = WORLD.points.spawn;
  assert.notEqual(it.nearest({ x: sx, y: 0, z: -sy })?.id, SPOT.id);
});

test('what it says: plain and short, and the terminal can always turn them back on', () => {
  assert.equal(label(true), 'Turn the lights off');
  assert.equal(label(false), 'Turn the lights on');
  assert.equal(said(true), 'Lights on.');
  assert.equal(said(false), 'Lights off.');
  assert.deepEqual(lightsCommand('on', false), { set: true, lines: ['lights on.'] });
  assert.deepEqual(lightsCommand(' OFF ', true), { set: false, lines: ['lights off. the switch by the front door turns them back on.'] });
  assert.deepEqual(lightsCommand('', true), { set: null, lines: ['the lights are on. lights on  or  lights off'] });
  assert.deepEqual(lightsCommand(undefined, false).lines, ['the lights are off. lights on  or  lights off']);
  assert.deepEqual(lightsCommand('dim', true), { set: null, lines: ['lights on  or  lights off'] });
  for (const s of [label(true), label(false), said(true), said(false), ...['on', 'off', '', 'x'].flatMap(a => lightsCommand(a, true).lines)]) {
    assert.ok(s.length <= 60 && !/[–—]/.test(s), s);
  }
});

test('the Movie scene: the lamps low and warm, at any time of day, and only the Movie scene asks for it', () => {
  assert.ok(dimsLamps('movie') && !['chill', 'focus', 'matchday', 'off', 'party', 'visualizer', 'holiday', '', undefined].some(dimsLamps));
  for (const d of [0, 0.4, 1]) {
    const r = roomLight(d, 1, 1), off = roomLight(d, 0);
    // The lamps' share is warm: redder against blue than the window's light alone, and outright warm at night.
    assert.ok(r[0] / r[2] > off[0] / off[2] && (d > 0 || (r[0] > r[1] && r[1] > r[2])), `warm: ${r}`);
    for (let i = 0; i < 3; i++) assert.ok(r[i] < 1 && r[i] > off[i], `between off and on: ${r} ${off}`);
    assert.ok(bulbLight(d, 1, 1) < 0.6 && bulbLight(d, 1, 1) > bulbLight(d, 0) && fillLight(d, 1, 1) < 1 && fillLight(d, 1, 1) > fillLight(d, 0));
  }
  // At night the room sits near a third of its light.
  assert.ok(Math.abs(roomLight(0, 1, 1)[0] - (1 - (1 - OFF.night[0]) * (1 - MOVIE.level))) < 1e-12);
});

test('the Movie scene leaves the switch in charge: off is off whatever the scene, and with no Movie every level is as before, to the bit', () => {
  const old = (off, k) => 1 - (1 - off) * (1 - k);
  for (const d of [0, 0.3, 1]) for (const k of [0, 0.2, 0.5, 0.97, 1]) {
    for (const m of [0, 0.4, 1]) {
      assert.deepEqual(roomLight(d, 0, m), roomLight(d, 0));
      assert.equal(bulbLight(d, 0, m), bulbLight(d, 0));
    }
    assert.deepEqual(roomLight(d, k, 0), OFF.night.map((n, i) => old(n + (OFF.day[i] - n) * d, k)));
    assert.equal(fillLight(d, k, 0), fillLight(d, k));
  }
  assert.deepEqual(roomLight(0.5, 1, 0), [1, 1, 1]);
  // Fading in, the room only ever gets dimmer; fading out, brighter.
  for (let m = 0; m < 1; m += 0.05) for (let i = 0; i < 3; i++) assert.ok(roomLight(0, 1, m + 0.05)[i] < roomLight(0, 1, m)[i]);
});

test('a scene fades in and out more slowly than the switch, and still lands exactly', () => {
  const run = (k, on, rate) => { let t = 0; while (k !== (on ? 1 : 0) && t < 5) { k = settle(k, on, 1 / 60, rate); t += 1 / 60; } return [k, t]; };
  const [inK, inT] = run(0, true, SCENE_RATE), [outK, outT] = run(1, false, SCENE_RATE), [, flip] = run(1, false);
  assert.equal(inK, 1); assert.equal(outK, 0);
  assert.ok(inT > 1 && inT < 2.5 && outT > 1 && outT < 2.5 && outT > flip * 3, `${inT} ${outT} ${flip}`);
});

