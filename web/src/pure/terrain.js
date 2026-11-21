import { WATER_Y, EYE, landHeight, landKind, wx, wz } from './outside.js';

export const SIL_N = 1024;
const RES = { low: [380, 100], medium: [720, 160], high: [960, 200] };

// The land as numbers, worked out the same here or in a worker: a polar grid around the eye, fine near and coarse far
// so every ridge gets about the same pixels; the kind of ground at each point; the skyline over it; the triangles; and
// the normals and bounding sphere done step for step as three does them, so the land is the same to the last bit.
// Written as steps (a generator yielding between pieces) so the page can spread it over frames when no worker does it.
const whole = steps => { for (;;) { const r = steps.next(); if (r.done) return r.value; } };
export const terrainData = q => whole(terrainSteps(q));
export const vertexNormals = (pos, index) => whole(normalSteps(pos, index));
export const boundingSphere = pos => whole(sphereSteps(pos));
export function* terrainSteps(q) {
  const [cols, rows] = RES[q] || RES.medium, a0 = -128 * Math.PI / 180, a1 = 128 * Math.PI / 180, r0 = 16, r1 = 28000;
  const n = cols * rows, pos = new Float32Array(n * 3), kind = new Float32Array(n * 4);
  const ratio = Math.pow(r1 / r0, 1 / (rows - 1));
  const colEl = new Float32Array(cols).fill(-0.05), colDist = new Float32Array(cols).fill(30000);
  const mirrorY = WATER_Y - (EYE[1] - WATER_Y);
  for (let c = 0; c < cols; c++) {
    const a = a0 + (a1 - a0) * c / (cols - 1), sa = Math.sin(a), ca = Math.cos(a);
    for (let r = 0, rad = r0; r < rows; r++, rad *= ratio) {
      const dx = sa * rad, dn = ca * rad, h = landHeight(dx, dn), i = c * rows + r;
      const y = WATER_Y + (h < -2 ? -14 : h);
      pos[i * 3] = wx(dx); pos[i * 3 + 1] = y; pos[i * 3 + 2] = wz(dn);
      kind.set(landKind(dx, dn, h), i * 4);
      if (rad > 90) {
        const el = Math.atan2(y - mirrorY, rad);
        if (el > colEl[c]) { colEl[c] = el; colDist[c] = rad; }
      }
    }
    yield;
  }
  // Sample the columns per texel, so no texel is left empty where the two grids beat against each other.
  const sil = { el: new Float32Array(SIL_N).fill(-0.05), dist: new Float32Array(SIL_N).fill(30000), tower: new Float32Array(SIL_N) };
  for (let b = 0; b < SIL_N; b++) {
    const fc = (((b + 0.5) / SIL_N - 0.5) * Math.PI * 2 - a0) / (a1 - a0) * (cols - 1);
    if (fc < 0 || fc > cols - 1) continue;
    const c0 = Math.floor(fc), c1 = Math.min(cols - 1, c0 + 1), c = colEl[c0] > colEl[c1] ? c0 : c1;
    sil.el[b] = colEl[c]; sil.dist[b] = colDist[c];
  }
  // three keeps an index in 16 bits unless a vertex number reaches 65535.
  const index = new (n - 1 >= 65535 ? Uint32Array : Uint16Array)((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const i = c * rows + r, j = i + rows;
      index[k++] = i; index[k++] = j; index[k++] = i + 1; index[k++] = j; index[k++] = j + 1; index[k++] = i + 1;
    }
    if (c % 32 === 31) yield;
  }
  const normal = yield* normalSteps(pos, index), sphere = yield* sphereSteps(pos);
  return { pos, kind, index, normal, sphere, sil };
}

// As three's computeVertexNormals: each triangle's unnormalised normal is added to its three corners (all three read
// before any is written, as three does), stored in 32-bit floats, then each sum is scaled by one over its length.
function* normalSteps(pos, index) {
  const nm = new Float32Array(pos.length);
  for (let i = 0; i < index.length; i += 3) {
    if (i % 24576 === 24573) yield;
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const cbx = pos[c] - pos[b], cby = pos[c + 1] - pos[b + 1], cbz = pos[c + 2] - pos[b + 2];
    const abx = pos[a] - pos[b], aby = pos[a + 1] - pos[b + 1], abz = pos[a + 2] - pos[b + 2];
    const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx;
    const ax = nm[a] + x, ay = nm[a + 1] + y, az = nm[a + 2] + z, bx = nm[b] + x, by = nm[b + 1] + y, bz = nm[b + 2] + z;
    const cx = nm[c] + x, cy = nm[c + 1] + y, cz = nm[c + 2] + z;
    nm[a] = ax; nm[a + 1] = ay; nm[a + 2] = az; nm[b] = bx; nm[b + 1] = by; nm[b + 2] = bz; nm[c] = cx; nm[c + 1] = cy; nm[c + 2] = cz;
  }
  for (let v = 0; v < nm.length; v += 3) {
    if (v % 49152 === 49149) yield;
    const x = nm[v], y = nm[v + 1], z = nm[v + 2], s = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    nm[v] = x * s; nm[v + 1] = y * s; nm[v + 2] = z * s;
  }
  return nm;
}

// As three's computeBoundingSphere: the centre of the bounding box, and the farthest point from it.
function* sphereSteps(pos) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    if (i % 49152 === 49149) yield;
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[i + a]); max[a] = Math.max(max[a], pos[i + a]); }
  }
  const center = pos.length ? [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5] : [0, 0, 0];
  let most = 0;
  for (let i = 0; i < pos.length; i += 3) {
    if (i % 49152 === 49149) yield;
    const dx = center[0] - pos[i], dy = center[1] - pos[i + 1], dz = center[2] - pos[i + 2];
    most = Math.max(most, dx * dx + dy * dy + dz * dz);
  }
  return { center, radius: Math.sqrt(most) };
}
