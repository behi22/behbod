import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KEYS, U, DESK } from '../../web/src/pure/typing.js';
import { PEN } from '../../web/src/pure/residents.js';
import { DESK_POSES } from '../../web/src/pure/realposes.js';
import { skinPoints, mirrorPose } from '../../web/src/pure/realhand.js';
import { noteCorners } from '../../web/src/pure/aria.js';
import { seatView, onView } from '../../web/src/pure/seatview.js';

// The desk's things as blender/zones/studio.py builds them (desk frame: x toward the wall, y left).
const L = JSON.parse(readFileSync(new URL('../../blender/zones/desklayout.json', import.meta.url), 'utf8'));
const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const T = L.things, DZ = 1.21, TO_WORLD = [6, -1];
// A thing's footprint as a box [x0, x1, y0, y1]; a turned one by its turned corners.
function box(t) {
  if (t.r) return [t.at[0] - t.r, t.at[0] + t.r, t.at[1] - t.r, t.at[1] + t.r];
  const a = (t.turn || 0) * Math.PI / 180, hx = t.size[0] / 2, hy = t.size[1] / 2;
  const ex = Math.abs(hx * Math.cos(a)) + Math.abs(hy * Math.sin(a)), ey = Math.abs(hx * Math.sin(a)) + Math.abs(hy * Math.cos(a));
  return [t.at[0] - ex, t.at[0] + ex, t.at[1] - ey, t.at[1] + ey];
}
// How far apart two things stand: round ones by their edges, others by their boxes.
function apart(a, b) {
  if (a.r && b.r) return Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) - a.r - b.r;
  const p = box(a), q = box(b);
  return Math.hypot(Math.max(p[0] - q[1], q[0] - p[1], 0), Math.max(p[2] - q[3], q[2] - p[3], 0)) * (Math.max(p[0] - q[1], q[0] - p[1]) > 0 || Math.max(p[2] - q[3], q[2] - p[3]) > 0 ? 1 : -1);
}
const CLEAR = 0.025;

test('every thing on the desk has its own space: none closer than 2.5 cm to another, nothing touching', () => {
  const names = Object.keys(T);
  let near = { d: Infinity };
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = T[names[i]], b = T[names[j]];
    if ((a.group && a.group === b.group) || a.on === names[j] || b.on === names[i]) continue;
    const d = apart(a, b);
    if (d < near.d) near = { d, a: names[i], b: names[j] };
    assert.ok(d >= CLEAR, `${names[i]} and ${names[j]} are ${(d * 100).toFixed(1)} cm apart`);
  }
  assert.ok(near.d >= CLEAR, JSON.stringify(near));
});

test('everything stands on the desk\'s top, clear of its edges; what lies on another thing lies within it', () => {
  const on = ([x0, x1, y0, y1], [a0, a1, b0, b1], m) => x0 >= a0 + m && x1 <= a1 - m && y0 >= b0 + m && y1 <= b1 - m;
  for (const [name, t] of Object.entries(T)) {
    if (t.on) { assert.ok(on(box(t), box(T[t.on]), 0), `${name} on ${t.on}`); continue; }
    assert.ok(on(box(t), L.desk.main, 0.005) || on(box(t), L.desk.return, 0.005), `${name} on the desk`);
  }
});

test('the page\'s keyboard, wrist rest and mouse are the ones the studio builds, key for key', () => {
  const kb = T.keyboard.at, mouse = T.mouse.at;
  assert.deepEqual([DESK.case.size[0], DESK.case.size[2]], T.keyboard.size);
  assert.deepEqual([DESK.rest.size[0], DESK.rest.size[2]], T.wrist_rest.size);
  assert.ok(Math.abs(DESK.rest.at[0] - (T.wrist_rest.at[0] - kb[0])) < 1e-9 && DESK.rest.at[2] === kb[1] - T.wrist_rest.at[1]);
  assert.ok(Math.abs(DESK.mouse.at[0] - (mouse[0] - kb[0])) < 1e-9 && Math.abs(DESK.mouse.at[2] - (kb[1] - mouse[1])) < 1e-9);
  assert.deepEqual([DESK.mouse.size[0], DESK.mouse.size[2]], T.mouse.size);
  // The mouse is on the right of the keyboard.
  assert.ok(mouse[1] < kb[1] - T.keyboard.size[1] / 2);
  const K = L.keys;
  assert.equal(K.pitch, U);
  let i = 0;
  K.rows.forEach((row, r) => { let u = 0; for (const w of row) { const k = KEYS[i++]; assert.ok(k.row === r && Math.abs(k.z - (u + w / 2 - 8) * U) < 1e-12 && Math.abs(k.w - (w * U - K.gap)) < 1e-12, k.id); u += w; } });
  assert.equal(i, KEYS.length);
});

test('the pen lies where the desk keeps its spot, beside the sticky notes, and Pishi sits on the notes to knock it off', () => {
  const pen = T.pen.at, sticky = box(T.sticky);
  assert.ok(Math.abs(PEN.home[0] - TO_WORLD[0] - pen[0]) < 1e-9 && Math.abs(PEN.home[1] - TO_WORLD[1] - pen[1]) < 1e-9);
  const [sx, sy] = [PEN.sit[0] - TO_WORLD[0], PEN.sit[1] - TO_WORLD[1]];
  assert.ok(sx > sticky[0] && sx < sticky[1] && sy > sticky[2] && sy < sticky[3] && PEN.sit[2] > DZ);
});

// A hand between words, its skin in the desk frame.
function skinOf(side, P) {
  const kb = T.keyboard.at, pts = side === 'left' ? skinPoints(mirrorPose(P)).map(p => [p[0], p[1], -p[2]]) : skinPoints(P);
  return pts.map(p => [kb[0] + p[0], kb[1] - p[2], p[1]]);
}
test('between words: the right hand on the mouse and the left resting beside the keys, each clear of everything else', () => {
  const kb = box(T.keyboard);
  const hands = { left: skinOf('left', DESK_POSES.rest.left), right: skinOf('right', DESK_POSES.mouse.right) };
  // Beside the keys, not over them.
  assert.ok(Math.min(...hands.left.map(p => p[1])) > kb[3] + 0.005, `left hand ${Math.min(...hands.left.map(p => p[1])) - kb[3]}`);
  assert.ok(Math.max(...hands.right.map(p => p[1])) < kb[2] - 0.005, `right hand ${kb[2] - Math.max(...hands.right.map(p => p[1]))}`);
  for (const [side, pts] of Object.entries(hands)) for (const [name, t] of Object.entries(T)) {
    if (name === 'mouse' && side === 'right') continue;
    const [x0, x1, y0, y1] = box(t), d = Math.min(...pts.map(p => Math.hypot(Math.max(x0 - p[0], p[0] - x1, 0), Math.max(y0 - p[1], p[1] - y1, 0))));
    assert.ok(d > 0.01, `${side} hand ${(d * 100).toFixed(1)} cm from ${name}`);
  }
});

test('seated, the Aria note shows whole above the Pishi cam in front of it, on every desktop shape', () => {
  const screen = meta.screens.main, C = screen.center, rel = p => [p[0] - C[0], p[2] - C[2], -(p[1] - C[1])];
  const [, , bl, br] = noteCorners(screen), [x0, , y0, y1] = box(T.mini_pishi), top = DZ + 0.075 + 0.0575;
  const cam = [[x0, y0], [x0, y1]].map(([x, y]) => [x + TO_WORLD[0], y + TO_WORLD[1], top]);
  for (const aspect of [16 / 9, 16 / 10, 21 / 9, 4 / 3, 844 / 390]) {
    const v = seatView(screen, aspect), noteLow = Math.max(...[bl, br].map(p => onView(rel(p), v, aspect).y)), camTop = Math.min(...cam.map(p => onView(rel(p), v, aspect).y));
    assert.ok(noteLow < camTop, `${aspect.toFixed(2)}: the note's bottom at ${noteLow.toFixed(3)}, the cam's top at ${camTop.toFixed(3)}`);
  }
});
