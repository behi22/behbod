import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seatView, frameBox, onView, TOP, BACK, WIDE } from '../../web/src/pure/seatview.js';

const S = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url))).screens.main;
// The keyboard's back edge and where my fingers rest on it, from the monitor's middle (blender/zones/studio.py).
const KEYS = [-0.175, -0.37, 0], FINGERS = [-0.25, -0.33, 0];
const SHAPES = { '16:9': 16 / 9, '16:10': 1.6, '3:2': 1.5, '4:3': 4 / 3, 'ultrawide 21:9': 21 / 9, 'phone on its side': 844 / 390, 'upright phone': 390 / 844, 'upright tablet': 0.75 };

test('a desktop shape: the monitor fills 82% of the width, its top 6% down, its bottom and the keyboard in view', () => {
  for (const name of ['16:9', '16:10', '3:2', '4:3']) {
    const a = SHAPES[name], v = seatView(S, a), b = frameBox(S, v, a);
    assert.ok(Math.abs(b.x1 - b.x0 - WIDE.width) < 0.002, `${name} width ${b.x1 - b.x0}`);
    assert.ok(Math.abs(b.x0 - (1 - b.x1)) < 0.002, `${name} centred: ${b.x0} ${1 - b.x1}`);
    assert.ok(Math.abs(b.y0 - TOP) < 0.002 && b.bar > 0.02, `${name} top ${b.y0}, light bar ${b.bar}`);
    assert.ok(b.y1 < 0.75, `${name} bottom ${b.y1}`);
    const k = onView(KEYS, v, a), f = onView(FINGERS, v, a);
    assert.ok(k.front && k.y > b.y1 && k.y < 0.95 && f.y < 0.95, `${name} keyboard ${k.y}, fingers ${f.y}`);
    assert.equal(v.range, 0);
  }
});

test('the eye never sits behind my eyes in the chair or nearer than a lean in; a narrow shape widens the lens instead', () => {
  for (const [name, a] of Object.entries(SHAPES)) {
    const v = seatView(S, a);
    assert.ok(v.back >= BACK.min - 1e-9 && v.back <= BACK.max + 1e-9, `${name} back ${v.back}`);
    assert.ok(v.pitch > 0 && v.pitch < 0.3, `${name} looks down a little: ${v.pitch}`);
  }
  assert.equal(seatView(S, 16 / 9).fov, WIDE.fov);
  const v43 = seatView(S, 4 / 3);
  assert.ok(v43.back === BACK.max && v43.fov > WIDE.fov, JSON.stringify(v43));
});

test('a wide shape (a phone on its side, an ultrawide): the monitor is held to 66% of the height so the keyboard still shows', () => {
  for (const name of ['ultrawide 21:9', 'phone on its side']) {
    const a = SHAPES[name], v = seatView(S, a), b = frameBox(S, v, a);
    assert.ok(Math.abs(b.y1 - b.y0 - WIDE.maxH) < 0.002, `${name} height ${b.y1 - b.y0}`);
    assert.ok(b.x0 > 0 && b.x1 < 1 && b.x1 - b.x0 > 0.6, `${name} width ${b.x1 - b.x0}`);
    assert.ok(onView(KEYS, v, a).y < 0.98, `${name} keyboard ${onView(KEYS, v, a).y}`);
  }
});

test('an upright shape: the monitor\'s whole height with the keyboard below, and a pan that reaches either end', () => {
  for (const name of ['upright phone', 'upright tablet']) {
    const a = SHAPES[name], v = seatView(S, a), b = frameBox(S, v, a);
    assert.ok(Math.abs(b.y0 - TOP) < 0.002 && b.y1 < 0.6, `${name} ${b.y0} ${b.y1}`);
    assert.ok(onView(KEYS, v, a).y < 0.9, `${name} keyboard`);
    assert.ok(v.range > 0, `${name} pans`);
    // Panned all the way, the frame's end comes into view on that side.
    const left = frameBox(S, { ...v, pan: -v.range }, a), right = frameBox(S, { ...v, pan: v.range }, a);
    assert.ok(left.x0 > 0 && left.x0 < 0.2 && right.x1 < 1 && right.x1 > 0.8, `${name} ${left.x0} ${right.x1}`);
  }
});

test('a point straight ahead lands mid view; one behind the eye is not in front', () => {
  const v = { fov: 42, back: 1, up: 0, pitch: 0 }, a = 1.6;
  const m = onView([0, 0, 0], v, a);
  assert.ok(Math.abs(m.x - 0.5) < 1e-12 && Math.abs(m.y - 0.5) < 1e-12 && m.front);
  assert.equal(onView([-2, 0, 0], v, a).front, false);
  // Looking down, what is ahead sits higher in the view.
  assert.ok(onView([0, 0, 0], { ...v, pitch: 0.1 }, a).y < 0.5);
});
