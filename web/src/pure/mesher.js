// Surface nets. `lip` is how far the function may understate distance, so far blocks are skipped safely.
// `due` says a build on the page has used up its share of the frame: it stops there and carries on next frame.
export const never = () => false;
const grow = (a, need) => { if (need <= a.length) return a; const b = new a.constructor(Math.max(need, a.length * 2)); b.set(a); return b; };

export function* meshSdf(f, bounds, { points = 260000, lip = 1.6, maxCells = 160, cell = 0, due = never } = {}) {
  const [bx0, by0, bz0, bx1, by1, bz1] = bounds;
  const vol = (bx1 - bx0) * (by1 - by0) * (bz1 - bz0);
  let h = cell || Math.cbrt(vol / points);
  h = Math.max(h, Math.max(bx1 - bx0, by1 - by0, bz1 - bz0) / maxCells);
  const x0 = bx0 - 2 * h, y0 = by0 - 2 * h, z0 = bz0 - 2 * h;
  const nx = Math.ceil((bx1 - bx0) / h) + 5, ny = Math.ceil((by1 - by0) / h) + 5, nz = Math.ceil((bz1 - bz0) / h) + 5;
  const sxy = nx * ny, v = new Float32Array(sxy * nz);
  const B = 4, reach = ((B - 1) / 2) * h * Math.sqrt(3), skip = (reach + 2 * h) * lip;
  let evals = 0;
  for (let bk = 0; bk < nz; bk += B) {
    for (let bj = 0; bj < ny; bj += B) {
      for (let bi = 0; bi < nx; bi += B) {
        const d = f(x0 + (bi + (B - 1) / 2) * h, y0 + (bj + (B - 1) / 2) * h, z0 + (bk + (B - 1) / 2) * h);
        evals++;
        if (due()) yield evals;
        const far = Math.abs(d) > skip, ke = Math.min(nz, bk + B), je = Math.min(ny, bj + B), ie = Math.min(nx, bi + B);
        for (let k = bk; k < ke; k++) {
          const z = z0 + k * h;
          for (let j = bj; j < je; j++) {
            const y = y0 + j * h, row = k * sxy + j * nx;
            for (let i = bi; i < ie; i++) {
              if (far) { v[row + i] = d; continue; }
              v[row + i] = f(x0 + i * h, y, z);
              evals++;
              if (due()) yield evals;
            }
          }
        }
      }
    }
  }
  // The outer layer of points is always outside, so the mesh closes.
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      const row = k * sxy + j * nx;
      if (k === 0 || j === 0 || k === nz - 1 || j === ny - 1) { for (let i = 0; i < nx; i++) if (v[row + i] < h) v[row + i] = h; }
      else { if (v[row] < h) v[row] = h; if (v[row + nx - 1] < h) v[row + nx - 1] = h; }
      if (due()) yield evals;
    }
  }

  // Each cell's vertex number plus one, so a fresh (zeroed) array means none yet.
  const cellVert = new Int32Array(sxy * nz);
  let pos = new Float64Array(1 << 15), n = 0;
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const OX = [0, 1, 0, 1, 0, 1, 0, 1], OY = [0, 0, 1, 1, 0, 0, 1, 1], OZ = [0, 0, 0, 0, 1, 1, 1, 1];
  const c = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const o = k * sxy + j * nx + i;
        let mask = 0;
        for (let q = 0; q < 8; q++) { c[q] = v[o + OX[q] + OY[q] * nx + OZ[q] * sxy]; if (c[q] < 0) mask |= 1 << q; }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, m = 0;
        for (const [a, b] of EDGES) {
          if ((c[a] < 0) === (c[b] < 0)) continue;
          const t = c[a] / (c[a] - c[b]);
          sx += OX[a] + (OX[b] - OX[a]) * t; sy += OY[a] + (OY[b] - OY[a]) * t; sz += OZ[a] + (OZ[b] - OZ[a]) * t; m++;
        }
        pos = grow(pos, n * 3 + 3);
        pos[n * 3] = x0 + (i + sx / m) * h; pos[n * 3 + 1] = y0 + (j + sy / m) * h; pos[n * 3 + 2] = z0 + (k + sz / m) * h;
        cellVert[o] = ++n;
      }
      if (due()) yield evals;
    }
  }
  let index = new Uint32Array(1 << 16), ni = 0;
  const quad = (a, b, cc, d, flip) => {
    if (a < 0 || b < 0 || cc < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    const P = pos, d1 = (P[a * 3] - P[cc * 3]) ** 2 + (P[a * 3 + 1] - P[cc * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[cc * 3 + 2]) ** 2;
    const d2 = (P[b * 3] - P[d * 3]) ** 2 + (P[b * 3 + 1] - P[d * 3 + 1]) ** 2 + (P[b * 3 + 2] - P[d * 3 + 2]) ** 2;
    index = grow(index, ni + 6);
    if (d1 <= d2) { index[ni] = a; index[ni + 1] = b; index[ni + 2] = cc; index[ni + 3] = a; index[ni + 4] = cc; index[ni + 5] = d; }
    else { index[ni] = a; index[ni + 1] = b; index[ni + 2] = d; index[ni + 3] = b; index[ni + 4] = cc; index[ni + 5] = d; }
    ni += 6;
  };
  const cv = o => cellVert[o] - 1;
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const o = k * sxy + j * nx + i, inside = v[o] < 0;
        if (inside !== (v[o + 1] < 0)) quad(cv(o - nx - sxy), cv(o - sxy), cv(o), cv(o - nx), !inside);
        if (inside !== (v[o + nx] < 0)) quad(cv(o - sxy - 1), cv(o - 1), cv(o), cv(o - sxy), !inside);
        if (inside !== (v[o + sxy] < 0)) quad(cv(o - 1 - nx), cv(o - nx), cv(o), cv(o - 1), !inside);
      }
      if (due()) yield evals;
    }
  }
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), open = new Float32Array(n), e = h * 0.35;
  for (let a = 0; a < n * 3; a += 1 << 16) { P.set(pos.subarray(a, Math.min(n * 3, a + (1 << 16))), a); if (due()) yield evals; }
  for (let p = 0; p < n; p++) {
    let x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2];
    const d = f(x, y, z);
    let gx = f(x + e, y, z) - d, gy = f(x, y + e, z) - d, gz = f(x, y, z + e) - d;
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl; gy /= gl; gz /= gl;
    if (Math.abs(d) < h) { x -= gx * d; y -= gy * d; z -= gz * d; }
    P[p * 3] = x; P[p * 3 + 1] = y; P[p * 3 + 2] = z;
    N[p * 3] = gx; N[p * 3 + 1] = gy; N[p * 3 + 2] = gz;
    let occ = 0;
    for (const [s, w] of [[1.5, 0.5], [3.5, 0.3], [7, 0.2]]) {
      const t = s * h, dd = f(x + gx * t, y + gy * t, z + gz * t);
      occ += w * Math.max(0, Math.min(1, (t - dd) / t));
    }
    open[p] = 1 - occ;
    if (due()) yield evals + p * 7;
  }
  return { pos: P, normal: N, open, index: index.slice(0, ni), h, evals: evals + n * 7 };
}

export function finish(gen) {
  for (;;) { const r = gen.next(); if (r.done) return r.value; }
}
