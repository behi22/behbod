import { test } from 'node:test';
import assert from 'node:assert/strict';
import { khatamStrip, role, roleAt, sideOf, tileSide, UNITS, KHATAM } from '../../web/src/pure/khatam.js';

const centroid = t => [(t.p[0] + t.p[2] + t.p[4]) / 3, (t.p[1] + t.p[3] + t.p[5]) / 3];
const area = t => Math.abs((t.p[2] - t.p[0]) * (t.p[5] - t.p[1]) - (t.p[4] - t.p[0]) * (t.p[3] - t.p[1])) / 2;

test('a star is twelve triangles: six in its middle hexagon, one on each of its six points', () => {
  // The six triangles round the star centre at lattice point (0, 0).
  const middle = [[1 / 3, 1 / 3], [-1 / 3, 2 / 3], [-2 / 3, 1 / 3], [-1 / 3, -1 / 3], [1 / 3, -2 / 3], [2 / 3, -1 / 3]];
  for (const [u, v] of middle) assert.equal(role(u, v), 'core', `${u},${v}`);
  // The triangles across each outer edge of that hexagon.
  const points = [[2 / 3, 2 / 3], [-2 / 3, 4 / 3], [-4 / 3, 2 / 3], [-2 / 3, -2 / 3], [2 / 3, -4 / 3], [4 / 3, -2 / 3]];
  for (const [u, v] of points) assert.equal(role(u, v), 'tip', `${u},${v}`);
});

test('between three stars is a hexagon of dark wood, and the next star along the row is whole again', () => {
  // Lattice point (2, 0) is the middle of the stars at (0, 0), (2, 2) and (4, -2).
  for (const [u, v] of [[2 + 1 / 3, 1 / 3], [2 - 1 / 3, 2 / 3], [2 - 2 / 3, 1 / 3], [2 - 1 / 3, -1 / 3], [2 + 1 / 3, -2 / 3], [2 + 2 / 3, -1 / 3]]) assert.equal(role(u, v), 'gap', `${u},${v}`);
  assert.equal(role(6 + 1 / 3, 1 / 3), 'core');
  assert.equal(role(-6 + 1 / 3, 1 / 3), 'core');
});

test('the looked-up role of every triangle is the one the stars give it, far from the middle too', () => {
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
    assert.equal(roleAt(i, j, true), role(i + 1 / 3, j + 1 / 3), `up ${i},${j}`);
    assert.equal(roleAt(i, j, false), role(i + 2 / 3, j + 2 / 3), `down ${i},${j}`);
  }
});

test('the strip fits its height exactly: border, a row of stars two root three sides high, border', () => {
  const h = 22, k = khatamStrip(300, h);
  assert.ok(Math.abs(k.s - sideOf(h)) < 1e-12 && Math.abs(UNITS * k.s - h) < 1e-9);
  assert.ok(Math.abs(k.bands.at(-1)[1] - h) < 1e-9, 'the last brass line ends on the inner edge');
  assert.equal(k.bands[0][0], 0);
  for (const t of k.tris) for (let i = 1; i < 6; i += 2) assert.ok(t.p[i] >= -1e-9 && t.p[i] <= h + 1e-9, 'every piece inside the strip');
  for (const [a, b] of k.bands) assert.ok(b > a);
});

test('every piece is cut from one of the materials, and the pieces tile the strip with no gap or overlap', () => {
  const len = 300, h = 22, k = khatamStrip(len, h);
  for (const t of k.tris) assert.ok(Object.hasOwn(KHATAM, t.m), t.m);
  // Clip each triangle's area to the strip by its centroid: over a long strip the total is the strip's area less the brass.
  const brass = k.bands.reduce((a, [y0, y1]) => a + (y1 - y0), 0);
  const covered = k.tris.filter(t => { const [x] = centroid(t); return x >= 0 && x < len; }).reduce((a, t) => a + area(t), 0);
  const want = len * (h - brass);
  assert.ok(Math.abs(covered - want) / want < 0.01, `${covered.toFixed(1)} of ${want.toFixed(1)}`);
});

test('each 6-side repeat holds 12 middle pieces, 12 points and 24 between, the same all the way along', () => {
  const k = khatamStrip(400, 30), s = k.s, mid = 200;
  const count = x0 => {
    const n = { brass: 0, green: 0, bone: 0, ebony: 0, walnut: 0 };
    for (const t of k.tris) {
      const [x, y] = centroid(t);
      if (x >= x0 && x < x0 + 6 * s && Math.abs(y - 15) < s * Math.sqrt(3)) n[t.m]++;
    }
    return n;
  };
  const a = count(mid - 3 * s), b = count(mid + 3 * s), c = count(mid - 21 * s);
  assert.equal(a.brass + a.green, 12);
  assert.equal(a.bone, 12);
  assert.equal(a.ebony + a.walnut, 24);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('the middle of the strip is the middle of a star', () => {
  const len = 260, h = 18, k = khatamStrip(len, h);
  const near = k.tris.filter(t => { const [x, y] = centroid(t); return Math.hypot(x - len / 2, y - h / 2) < k.s * 0.6; });
  assert.equal(near.length, 6);
  assert.ok(near.every(t => t.m === 'brass' || t.m === 'green'));
});

test('a drawn repeat is a whole number of pixels wide, so strips filled from it have no seams, and keeps the strip height', () => {
  for (const k of [1, 1.25, 1.5, 2, 3]) for (const h of [9, 12, 13, 16, 20, 31, 44]) {
    const s = tileSide(h, k), px = 6 * s * k;
    assert.ok(Math.abs(px - Math.round(px)) < 1e-9, `${h} at ${k}: ${px}`);
    assert.ok(Math.abs(UNITS * s - h) * k <= UNITS * 0.5 / 6 + 1e-9, `${h} at ${k}: height ${UNITS * s}`);
  }
});
