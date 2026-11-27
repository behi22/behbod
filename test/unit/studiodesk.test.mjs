import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The studio's baked model as the page gets it (glTF axes: x to the wall, y up, z = -Blender y), read from the .glb.
const b = readFileSync(new URL('../../web/assets/zones/studio.glb', import.meta.url));
const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), bin = 20 + len + 8;
function mesh(name) {
  const prim = j.meshes[j.nodes.find(n => n.name === name).mesh].primitives[0];
  const read = a => { const A = j.accessors[a], v = j.bufferViews[A.bufferView], T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[A.componentType], n = A.count * (A.type === 'VEC3' ? 3 : 1), at = bin + (v.byteOffset || 0) + (A.byteOffset || 0); return new T(b.buffer.slice(b.byteOffset + at, b.byteOffset + at + n * T.BYTES_PER_ELEMENT)); };
  const pos = read(prim.attributes.POSITION), idx = read(prim.indices), tris = [];
  for (let t = 0; t < idx.length; t += 3) tris.push([0, 1, 2].map(k => [pos[3 * idx[t + k]], pos[3 * idx[t + k] + 1], pos[3 * idx[t + k] + 2]]));
  return tris;
}
const BAKED = mesh('studio_baked');
const DZ = 1.21;
const sub = (a, c) => a.map((v, i) => v - c[i]), dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
const unit = a => a.map(v => v / Math.hypot(...a));
const normal = t => unit(cross(sub(t[1], t[0]), sub(t[2], t[0])));
const area = t => Math.hypot(...cross(sub(t[1], t[0]), sub(t[2], t[0]))) / 2;
const key = p => p.map(v => Math.round(v * 1e4)).join(',');
// Edges met by only one triangle: a surface with a side missing, which vanishes when seen from behind.
function openEdges(tris) {
  const n = new Map();
  for (const t of tris) for (let k = 0; k < 3; k++) { const e = [key(t[k]), key(t[(k + 1) % 3])].sort().join('|'); n.set(e, (n.get(e) || 0) + 1); }
  return [...n.values()].filter(c => c === 1).length;
}
// Triangles all of whose corners lie a given distance from a line along x through c (y, z in glTF axes), on its two
// rims half either side of c.
const onRing = (c, r0, r1, half) => BAKED.filter(t => area(t) > 1e-10 && t.every(p => { const r = Math.hypot(p[1] - c[1], p[2] - c[2]); return r > r0 && r < r1 && Math.abs(Math.abs(p[0] - c[0]) - half) < 0.0002; }));

test('the headset band and the desk fan\'s cage are closed all round, so no side of them vanishes', () => {
  // Blender (15.72, 1.14) on the desk plus (6, -1): the band's arc round x, 8.2 to 8.9 cm out, 3 cm wide.
  const band = onRing([21.72, DZ + 0.19, -0.14], 0.0815, 0.0895, 0.015);
  assert.ok(band.length > 150, `band ${band.length} triangles`);
  assert.equal(openEdges(band), 0, 'the band has open edges');
  // Each side of the stand has the band over it, and its top rests on the hanger.
  for (const s of [-1, 1]) assert.ok(band.some(t => t.every(p => s * (p[2] + 0.14) > 0.05)), `no band on side ${s}`);
  const cage = onRing([21.8, DZ + 0.16, -2.3], 0.0635, 0.0705, 0.02);
  assert.ok(cage.length > 80, `cage ${cage.length} triangles`);
  assert.equal(openEdges(cage), 0, 'the cage has open edges');
});

test('the three mini screens stand on feet on the desk mat, not in the air', () => {
  for (const [nm, x, y] of [['pishi', 15.3, 2.66], ['loss', 15.475, 2.2], ['contrib', 15.41, 1.78]]) {
    const c = [x + 6, -(y - 1)];
    const under = BAKED.filter(t => t.every(p => Math.abs(p[0] - c[0]) < 0.02 && Math.abs(p[2] - c[1]) < 0.06 && p[1] > DZ + 0.0035 && p[1] < DZ + 0.0186));
    const low = Math.min(...under.flat().map(p => p[1])), high = Math.max(...under.flat().map(p => p[1]));
    assert.ok(under.length > 0 && low < DZ + 0.0045 && high > DZ + 0.017, `${nm}: under the case from ${low} to ${high}`);
  }
});

test('the phone\'s screen lies on its face, leaning back in its stand with it', () => {
  const screen = mesh('screen_phone'), n = normal(screen[0]);
  // The phone's own front: the baked faces round it turned the same way as the screen, toward my seat.
  const front = BAKED.filter(t => t.every(p => Math.abs(p[0] - 21.3) < 0.03 && Math.abs(p[2] + 2.08) < 0.04 && p[1] > DZ + 0.005 && p[1] < DZ + 0.16) && area(t) > 1e-5 && dot(normal(t), n) > 0.9995);
  assert.ok(front.length > 0, 'no face of the phone turned like its screen');
  assert.ok(n[0] < -0.9 && n[1] > 0.2, `the screen faces ${n.map(v => v.toFixed(2))}: toward my seat and a little up, as a phone leaning back does`);
  const gap = screen.flat().map(p => dot(sub(p, front[0][0]), n));
  assert.ok(Math.min(...gap) > 0.0003 && Math.max(...gap) < 0.003, `the screen sits ${gap.map(g => (g * 1000).toFixed(1))} mm off the phone's face`);
});

// Two faces in one plane, one over the other, take turns drawing and flicker.
test('nothing on or round the desk lies in the same plane as something it overlaps', () => {
  const near = BAKED.filter(t => t.every(p => p[0] > 19.9 && p[0] < 22.15 && p[2] > -2.55 && p[2] < 0.15 && p[1] > DZ - 0.2 && p[1] < DZ + 1.1) && area(t) > 2e-6);
  const planes = near.map(t => { const n = normal(t); return { t, n, d: dot(n, t[0]) }; });
  const buckets = new Map();
  planes.forEach((f, i) => { const k = `${f.n.map(v => Math.round(v * 20)).join(',')}`; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(i); });
  // Shrunk by half a millimetre, so triangles that only share an edge do not count as overlapping.
  const shrink = t => { const c = [0, 1, 2].map(k => (t[0][k] + t[1][k] + t[2][k]) / 3); return t.map(p => { const v = sub(p, c), l = Math.hypot(...v); return c.map((x, k) => x + v[k] * Math.max(0, 1 - 0.0005 / l)); }); };
  const overlap2d = (a, c) => {
    for (const poly of [a, c]) for (let k = 0; k < 3; k++) {
      const e = [poly[(k + 1) % 3][0] - poly[k][0], poly[(k + 1) % 3][1] - poly[k][1]], ax = [-e[1], e[0]];
      const pa = a.map(p => p[0] * ax[0] + p[1] * ax[1]), pc = c.map(p => p[0] * ax[0] + p[1] * ax[1]);
      if (Math.max(...pa) <= Math.min(...pc) || Math.max(...pc) <= Math.min(...pa)) return false;
    }
    return true;
  };
  const hits = [];
  for (const ids of buckets.values()) {
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const f = planes[ids[x]], g = planes[ids[y]];
      if (dot(f.n, g.n) < 0.9999 || Math.abs(dot(f.n, g.t[0]) - f.d) > 0.0002 || Math.abs(dot(g.n, f.t[0]) - g.d) > 0.0002) continue;
      const ax = [0, 1, 2].reduce((m, k) => Math.abs(f.n[k]) > Math.abs(f.n[m]) ? k : m, 0), [u, v] = [0, 1, 2].filter(k => k !== ax);
      const flat = t => shrink(t).map(p => [p[u], p[v]]);
      if (overlap2d(flat(f.t), flat(g.t))) hits.push(f.t[0].map(c => c.toFixed(3)).join(' '));
    }
  }
  assert.equal(hits.length, 0, `${hits.length} overlapping coplanar pairs, first at ${hits.slice(0, 4).join(' / ')}`);
});
