import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PEG_BOXES, trianglesInside, foldTriangles, newBob, nudgeBob, stepBob, pixelText } from '../../web/src/pure/figures.js';

// The studio's baked model as the page gets it: its joined mesh's positions and index, read from the .glb.
function baked() {
  const b = readFileSync(new URL('../../web/assets/zones/studio.glb', import.meta.url));
  const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), bin = 20 + len + 8;
  const prim = j.meshes[j.nodes.find(n => n.name === 'studio_baked').mesh].primitives[0];
  const read = (a, T) => { const A = j.accessors[a], v = j.bufferViews[A.bufferView], n = A.count * (A.type === 'VEC3' ? 3 : 1), at = bin + (v.byteOffset || 0) + (A.byteOffset || 0); return new T(b.buffer.slice(b.byteOffset + at, b.byteOffset + at + n * 4)); };
  return { pos: read(prim.attributes.POSITION, Float32Array), idx: read(prim.indices, Uint32Array) };
}

test('only triangles wholly inside a box are picked', () => {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0.5, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5]);
  const idx = new Uint32Array([0, 1, 2, 0, 1, 4, 4, 5, 6, 3, 1, 2]);
  const box = { min: [-0.1, -0.1, -0.1], max: [1.1, 1.1, 0.1] };
  assert.deepEqual(trianglesInside(idx, pos, [box]), [0, 9]);
  assert.deepEqual(trianglesInside(idx, pos, [box, { min: [4.9, 4.9, 4.9], max: [6.1, 6.1, 5.1] }]), [0, 6, 9]);
  assert.deepEqual(trianglesInside(idx, pos, []), []);
});

test('looked at in parts, the same triangles are picked as all at once', () => {
  const { pos, idx } = baked();
  const whole = trianglesInside(idx, pos, PEG_BOXES), out = [], part = 30000;
  for (let from = 0; from < idx.length; from += part) trianglesInside(idx, pos, PEG_BOXES, from, from + part, out);
  assert.deepEqual(out, whole);
  assert.deepEqual(trianglesInside(idx, pos, PEG_BOXES, 0, 0), []);
});

test('folded triangles collapse onto one corner and the changed run of the index is reported', () => {
  const idx = new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(foldTriangles(idx, [3, 9]), { start: 3, count: 9 });
  assert.deepEqual(Array.from(idx), [0, 1, 2, 3, 3, 3, 6, 7, 8, 9, 9, 9]);
  assert.equal(foldTriangles(idx, []), null);
});

test('the three baked peg figures are found whole in the studio model, and nothing else round them is', () => {
  const { pos, idx } = baked();
  const starts = trianglesInside(idx, pos, PEG_BOXES);
  // Each peg is a 24-sided body and a ball head: 172 triangles, joined one after another.
  assert.equal(starts.length, 3 * 172);
  assert.equal(starts.at(-1) - starts[0], (starts.length - 1) * 3);
  // No triangle has only some of its corners inside a box, so folding the pegs leaves the shelf and the books whole.
  const inBox = (v, b) => [0, 1, 2].every(k => pos[v * 3 + k] >= b.min[k] && pos[v * 3 + k] <= b.max[k]);
  let partial = 0;
  for (let t = 0; t < idx.length; t += 3) for (const b of PEG_BOXES) { const n = [0, 1, 2].filter(k => inBox(idx[t + k], b)).length; if (n > 0 && n < 3) partial++; }
  assert.equal(partial, 0);
});

test('a nudge sets the head nodding, it rings down and stops, and it never tips over', () => {
  const b = newBob();
  assert.equal(stepBob(b, 1 / 60), false);
  nudgeBob(b, 3, -1.2);
  let t = 0, most = 0, crossings = 0, prev = 0;
  while (stepBob(b, 1 / 60) && t < 10) { t += 1 / 60; most = Math.max(most, Math.abs(b.a[0]), Math.abs(b.a[1])); if (Math.sign(b.a[0]) !== Math.sign(prev) && prev) crossings++; prev = b.a[0]; }
  assert.ok(t > 1.5 && t < 6, `rang for ${t.toFixed(2)} s`);
  assert.ok(most > 0.1 && most <= 0.55, `tipped ${most}`);
  assert.ok(crossings >= 8, `${crossings} swings`);
  assert.deepEqual(b.a, [0, 0]);
  assert.equal(b.on, false);
  // A slow frame is taken in small steps and does not blow up.
  nudgeBob(b, 3, 0);
  stepBob(b, 0.5);
  assert.ok(Math.abs(b.a[0]) <= 0.55 && Number.isFinite(b.v[0]));
});

test('BEHI 22 in three by five squares', () => {
  const t = pixelText('BEHI 22');
  assert.equal(t.cols, 27);
  assert.equal(t.rows, 5);
  assert.equal(t.cells.length, 10 + 10 + 11 + 9 + 0 + 11 + 11);
  assert.ok(t.cells.every(([c, r]) => c >= 0 && c < 27 && r >= 0 && r < 5 && c % 4 !== 3));
  // The 2's top row is full and its middle row runs back to the left.
  const two = pixelText('2').cells;
  assert.deepEqual(two.filter(([, r]) => r === 0).map(([c]) => c), [0, 1, 2]);
  assert.deepEqual(two.filter(([, r]) => r === 3).map(([c]) => c), [0]);
});
