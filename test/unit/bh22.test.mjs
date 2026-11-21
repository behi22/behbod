import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, heart, arch, cross, holoNow, HOLO_ODDS, HOLO_TEXT } from '../../web/src/pure/bh22.js';

const box = pts => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
// Twice the signed area: positive for an outline that runs anticlockwise (the side a flat shape faces).
const area = pts => pts.reduce((a, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return a + x * v - u * y; }, 0);

test('three moods, each with eyes of its own and a short time', () => {
  assert.deepEqual(Object.keys(MOODS).sort(), ['dizzy', 'happy', 'love']);
  assert.deepEqual(Object.values(MOODS).map(m => m.eyes).sort(), ['arcs', 'hearts', 'x']);
  for (const m of Object.values(MOODS)) {
    assert.ok(m.time >= 2 && m.time <= 4);
    assert.ok(m.colour === null || (m.colour.length === 3 && Math.max(...m.colour) > 1.3), 'as bright as the eyes glow, so the light switch leaves them be');
  }
});

test('each eye shape fits where a round eye was, about its middle, and is the same both sides', () => {
  for (const [name, pts] of [['heart', heart()], ['arch', arch()], ...cross().map((c, i) => [`bar ${i}`, c])]) {
    const [x0, y0, x1, y1] = box(pts);
    assert.ok(x1 - x0 <= 0.0265 && y1 - y0 <= 0.027, `${name} ${x1 - x0} by ${y1 - y0}`);
    assert.ok(Math.abs(x0 + x1) < 1e-9, `${name} is not centred across`);
    assert.ok(Math.abs(y0 + y1) < 0.004, `${name} sits ${(y0 + y1) / 2} off the middle`);
    assert.ok(area(pts) !== 0);
  }
  const [x0, , x1] = box(heart());
  assert.ok(x1 - x0 > 0.018, 'a heart as wide as the eye');
  const [b0, b1] = cross();
  assert.deepEqual(box(b0).map(v => +v.toFixed(9)), box(b1).map(v => +v.toFixed(9)));
});

test('the arch is open below: in the middle it is only its top band, its feet reach down at the sides', () => {
  const pts = arch(), [, y0] = box(pts);
  assert.ok(!pts.some(([x, y]) => Math.abs(x) < 0.003 && y < 0));
  assert.ok(y0 < -0.003);
});

test('the hologram is rare: never on the first chat, never twice a visit, then one chat in HOLO_ODDS', () => {
  assert.equal(holoNow({ talks: 1, shown: false, roll: 0 }), false);
  assert.equal(holoNow({ talks: 2, shown: false, roll: 0 }), true);
  assert.equal(holoNow({ talks: 2, shown: false, roll: 1 / HOLO_ODDS }), false);
  assert.equal(holoNow({ talks: 9, shown: true, roll: 0 }), false);
  assert.equal(holoNow({ talks: 1, shown: false, roll: 0.99, force: true }), true, '?holo shows it on the first chat');
  assert.equal(holoNow({ talks: 1, shown: true, roll: 0, force: true }), false);
  let seen = 0;
  for (let i = 0; i < 80000; i++) if (holoNow({ talks: 2 + (i % 5), shown: false, roll: (i * 0.6180339887) % 1 })) seen++;
  assert.ok(Math.abs(seen / 80000 - 1 / HOLO_ODDS) < 0.005, `${seen / 80000}`);
});

test('the message is plain and short: no dashes, no emoji, a few words a line', () => {
  for (const s of [HOLO_TEXT.head, ...HOLO_TEXT.lines]) {
    assert.ok(!/[–—]|--/.test(s), s);
    assert.ok(/^[\x20-\x7e]+$/.test(s), s);
    assert.ok(s.length <= 24, `${s} is ${s.length} long`);
  }
  assert.ok(HOLO_TEXT.lines.length <= 3);
});
