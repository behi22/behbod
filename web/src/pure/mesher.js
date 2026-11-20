// Surface nets. `lip` is how far the function may understate distance, so far blocks are skipped safely.
export function* meshSdf(f, bounds, { points = 260000, lip = 1.6, maxCells = 160, cell = 0 } = {}) {
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
        const far = Math.abs(d) > skip, ke = Math.min(nz, bk + B), je = Math.min(ny, bj + B), ie = Math.min(nx, bi + B);
        for (let k = bk; k < ke; k++) {
          const z = z0 + k * h;
          for (let j = bj; j < je; j++) {
            const y = y0 + j * h, row = k * sxy + j * nx;
            for (let i = bi; i < ie; i++) {
              if (far) { v[row + i] = d; continue; }
              v[row + i] = f(x0 + i * h, y, z);
              evals++;
            }
          }
        }
      }
      yield evals;
    }
  }
  // The outer layer of points is always outside, so the mesh closes.
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) v[k * sxy + j * nx + i] = Math.max(v[k * sxy + j * nx + i], h);
  }

  const cellVert = new Int32Array(sxy * nz).fill(-1), pos = [];
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
        cellVert[o] = pos.length / 3;
        pos.push(x0 + (i + sx / m) * h, y0 + (j + sy / m) * h, z0 + (k + sz / m) * h);
      }
    }
    yield evals;
  }
  const index = [];
  const quad = (a, b, cc, d, flip) => {
    if (a < 0 || b < 0 || cc < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    const P = pos, d1 = (P[a * 3] - P[cc * 3]) ** 2 + (P[a * 3 + 1] - P[cc * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[cc * 3 + 2]) ** 2;
    const d2 = (P[b * 3] - P[d * 3]) ** 2 + (P[b * 3 + 1] - P[d * 3 + 1]) ** 2 + (P[b * 3 + 2] - P[d * 3 + 2]) ** 2;
    if (d1 <= d2) index.push(a, b, cc, a, cc, d); else index.push(a, b, d, b, cc, d);
  };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const o = k * sxy + j * nx + i, inside = v[o] < 0;
        if (inside !== (v[o + 1] < 0)) quad(cellVert[o - nx - sxy], cellVert[o - sxy], cellVert[o], cellVert[o - nx], !inside);
        if (inside !== (v[o + nx] < 0)) quad(cellVert[o - sxy - 1], cellVert[o - 1], cellVert[o], cellVert[o - sxy], !inside);
        if (inside !== (v[o + sxy] < 0)) quad(cellVert[o - 1 - nx], cellVert[o - nx], cellVert[o], cellVert[o - 1], !inside);
      }
    }
    if ((k & 3) === 3) yield evals;
  }
  const n = pos.length / 3, P = new Float32Array(pos), N = new Float32Array(n * 3), open = new Float32Array(n), e = h * 0.35;
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
    if ((p & 511) === 511) yield evals + p * 7;
  }
  return { pos: P, normal: N, open, index: new Uint32Array(index), h, evals: evals + n * 7 };
}

export function finish(gen) {
  for (;;) { const r = gen.next(); if (r.done) return r.value; }
}
