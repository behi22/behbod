import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteCorners, NOTE_LINES, NOTE_SIZE, NOTE_IN, SAYS } from '../../web/src/pure/aria.js';

const meta = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url), 'utf8'));
const screen = meta.screens.main, aria = meta.points.aria, tattoo = meta.points.postit;
const [tl, tr, bl, br] = noteCorners(screen);
const mid = (a, b) => a.map((q, i) => (q + b[i]) / 2);
const sub = (a, b) => a.map((q, i) => q - b[i]);
const len = v => Math.hypot(...v);

test('the note is the tattoo post-it mirrored to Aria\'s end of the bezel, further out toward her', () => {
  const top = mid(tl, tr), a = Math.asin((screen.w / 2 - NOTE_IN) / screen.r);
  // The tattoo note's point is its top edge's middle, 4 cm down; both hang 3.5 mm proud of the bezel.
  assert.ok(Math.abs(top[1] - screen.center[1] - screen.r * Math.sin(a) + 0.0035 * Math.sin(a)) < 0.002, `y ${top[1]}`);
  assert.ok(top[1] - screen.center[1] > screen.center[1] - tattoo[1] + 0.04, 'further out than the tattoo note');
  assert.ok(Math.abs(top[2] - 0.04 - tattoo[2]) < 0.002, `z ${top[2]}`);
  assert.ok(Math.abs(top[0] - screen.center[0] + screen.r * (1 - Math.cos(a)) + 0.0035 * Math.cos(a)) < 0.002, `x ${top[0]}`);
  for (const [a, b] of [[tl, tr], [bl, br], [tl, bl], [tr, br]]) assert.ok(Math.abs(len(sub(a, b)) - NOTE_SIZE) < 1e-9);
});

test('it hangs below the screen, faces the chair, and sits between the screen and Aria', () => {
  const bottom = screen.center[2] - screen.h / 2;
  for (const c of [tl, tr, bl, br]) assert.ok(c[2] < bottom, `corner at ${c[2]} is on the screen`);
  // Seen from the chair (looking along +x), its left is +y: a front face whose normal points back at the chair.
  const e1 = sub(bl, tl), e2 = sub(br, tl), n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  assert.ok(n[0] < 0 && tl[1] > tr[1]);
  assert.ok(Math.min(tl[1], bl[1]) > screen.center[1] && Math.max(tl[1], bl[1]) < aria[1] - 0.075);
  assert.ok(Math.min(bl[2], br[2]) > aria[2] - 0.12, 'it stops above the desk top');
});

test('the words are short and plain', () => {
  for (const s of [...NOTE_LINES, ...SAYS]) assert.ok(!/[\u2013\u2014]/.test(s), s);
  for (const s of NOTE_LINES) assert.ok(s.length <= 14, s);
  for (const s of SAYS) assert.ok(s.length <= 110 && s.startsWith('Aria: "') && s.endsWith('"'), s);
});
