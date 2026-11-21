import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terrainData, terrainSteps, vertexNormals, boundingSphere, SIL_N } from '../../web/src/pure/terrain.js';

// The plain way, in full precision: each corner's normal is the sum of its triangles' normals, made unit length.
function plainNormals(pos, index) {
  const out = new Float64Array(pos.length);
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i] * 3, index[i + 1] * 3, index[i + 2] * 3];
    const u = [pos[c] - pos[b], pos[c + 1] - pos[b + 1], pos[c + 2] - pos[b + 2]], w = [pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) out[v + k] += n[k];
  }
  for (let v = 0; v < out.length; v += 3) { const l = Math.hypot(out[v], out[v + 1], out[v + 2]) || 1; for (let k = 0; k < 3; k++) out[v + k] /= l; }
  return out;
}

test('normals: a flat square points one way at every corner, and a bent one agrees with the plain way of working them out', () => {
  const quad = new Uint16Array([0, 2, 1, 2, 3, 1]);
  assert.deepEqual([...vertexNormals(new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1]), quad)], [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]);
  const bent = new Float32Array([0, 0, 0, 0, 0.3, 1, 1, -0.2, 0, 1, 1, 1.4]), got = vertexNormals(bent, quad), want = plainNormals(bent, quad);
  got.forEach((g, i) => assert.ok(Math.abs(g - want[i]) < 1e-6, `${[...got]} against ${[...want]}`));
});

test('bounding sphere: the box centre and the farthest point from it', () => {
  const s = boundingSphere(new Float32Array([0, 0, 0, 2, 0, 0, 0, 4, 0]));
  assert.deepEqual(s.center, [1, 2, 0]);
  assert.equal(s.radius, Math.sqrt(5));
  assert.deepEqual(boundingSphere(new Float32Array(0)), { center: [0, 0, 0], radius: 0 });
});

test('the land: the same numbers every time, an index in 16 bits only while it fits, unit normals, a full skyline', () => {
  for (const [q, cols, rows] of [['low', 380, 100], ['medium', 720, 160]]) {
    const a = terrainData(q), b = terrainData(q);
    for (const k of ['pos', 'kind', 'index', 'normal']) assert.deepEqual(a[k], b[k], `${q} ${k} again`);
    assert.deepEqual(a.sphere, b.sphere);
    assert.equal(a.pos.length, cols * rows * 3);
    assert.equal(a.index.length, (cols - 1) * (rows - 1) * 6);
    assert.ok(q === 'low' ? a.index instanceof Uint16Array : a.index instanceof Uint32Array, `${q} index type`);
    assert.ok(a.index.reduce((m, v) => Math.max(m, v), 0) < cols * rows);
    for (let v = 0; v < a.normal.length; v += 3) {
      const l = Math.hypot(a.normal[v], a.normal[v + 1], a.normal[v + 2]);
      if (Math.abs(l - 1) > 1e-5) assert.fail(`${q} normal ${v / 3} has length ${l}`);
    }
    assert.equal(a.sil.el.length, SIL_N); assert.equal(a.sil.dist.length, SIL_N); assert.equal(a.sil.tower.length, SIL_N);
  }
});

test('the land worked out a step at a time is the same to the last bit as all at once, and yields often', () => {
  for (const q of ['low', 'medium']) {
    const steps = terrainSteps(q), whole = terrainData(q);
    let yields = 0, r;
    while (!(r = steps.next()).done) yields++;
    for (const k of ['pos', 'kind', 'index', 'normal']) assert.deepEqual(r.value[k], whole[k], `${q} ${k}`);
    assert.deepEqual(r.value.sphere, whole.sphere);
    assert.deepEqual(r.value.sil, whole.sil);
    assert.ok(yields >= 100, `${q}: ${yields} steps`);
  }
});
