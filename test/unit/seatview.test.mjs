import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seatView, frameBox, onView, TOP, BACK, WIDE, TALL } from '../../web/src/pure/seatview.js';

const W = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url))), S = W.screens.main;
// The keyboard's back edge and where my fingers rest on it, from the monitor's middle (blender/zones/studio.py).
const KEYS = [-0.175, -0.37, 0], FINGERS = [-0.25, -0.33, 0];
const SHAPES = { '16:9': 16 / 9, '16:10': 1.6, '3:2': 1.5, '4:3': 4 / 3, 'ultrawide 21:9': 21 / 9, 'phone on its side': 844 / 390, 'upright phone': 390 / 844, 'upright tablet': 0.75 };

test('a desktop shape: the monitor fills about 80% of the width, its top 5% down, its bottom and the keyboard in view', () => {
  for (const name of ['16:9', '16:10', '3:2', '4:3']) {
    const a = SHAPES[name], v = seatView(S, a), b = frameBox(S, v, a);
    assert.ok(Math.abs(b.x1 - b.x0 - WIDE.width) < 0.002, `${name} width ${b.x1 - b.x0}`);
    assert.ok(Math.abs(b.x0 - (1 - b.x1)) < 0.002, `${name} centred: ${b.x0} ${1 - b.x1}`);
    assert.ok(Math.abs(b.y0 - TOP) < 0.002 && b.bar > 0.01, `${name} top ${b.y0}, light bar ${b.bar}`);
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

test('a wide shape (a phone on its side, an ultrawide): the monitor is held to 61% of the height so the keyboard still shows', () => {
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
    assert.ok(Math.abs(b.y0 - TALL.top) < 0.002 && b.y1 < 0.6, `${name} ${b.y0} ${b.y1}`);
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

// The Pishi cam's case in front of the monitor, bottom left (blender/zones/studio.py): its screen's middle sits 2.6 cm
// in front of the case's and 7.8 cm over the desk, the case 5 by 18 by 11.5 cm standing on the desk 7.5 cm up.
const P = W.screens.pishi.center, toSeat = ([x, y, z]) => [x - S.center[0], z - S.center[2], -(y - S.center[1])];
const PISHI = [];
for (const dx of [-0.025, 0.025]) for (const dy of [-0.09, 0.09]) for (const dz of [-0.0575, 0.0575]) PISHI.push(toSeat([P[0] + 0.026 + dx, P[1] + dy, P[2] - 0.003 + dz]));

// The page's camera (desk.js eye() and aim(), three's lookAt with y up and its perspective), worked out on its own.
function camera(p, v, aspect) {
  const eye = [-v.back, v.up, v.pan || 0], aim = [eye[0] + Math.cos(v.pitch) * v.back, eye[1] - Math.sin(v.pitch) * v.back, eye[2]];
  const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = a => a.map(x => x / Math.hypot(...a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const z = unit(sub(eye, aim)), x = unit(cross([0, 1, 0], z)), y = cross(z, x), d = sub(p, eye), f = 1 / Math.tan(v.fov * Math.PI / 360);
  const vz = dot(d, z);
  return { x: (f / aspect * dot(d, x) / -vz + 1) / 2, y: (1 - f * dot(d, y) / -vz) / 2, front: vz < 0 };
}

test('seated, the Pishi cam\'s whole case is in view, on every desktop shape and a phone on its side', () => {
  for (const name of ['16:9', '16:10', '3:2', '4:3', 'ultrawide 21:9', 'phone on its side']) {
    const a = SHAPES[name], v = seatView(S, a), q = PISHI.map(p => onView(p, v, a));
    for (const [i, p] of PISHI.entries()) {
      const c = camera(p, v, a);
      assert.ok(Math.abs(c.x - q[i].x) < 1e-9 && Math.abs(c.y - q[i].y) < 1e-9 && c.front && q[i].front, `${name}: the page's camera puts corner ${i} at ${c.x}, ${c.y}, onView at ${q[i].x}, ${q[i].y}`);
    }
    const x0 = Math.min(...q.map(p => p.x)), y1 = Math.max(...q.map(p => p.y));
    assert.ok(x0 > 0.005 && y1 < 0.99, `${name}: the case from ${x0.toFixed(3)} across, down to ${y1.toFixed(3)}`);
  }
});
