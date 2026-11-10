// The projective map that sends the four corners of a w by h box onto four points on the page, as a CSS matrix3d,
// so a flat HTML layer can sit exactly on a screen seen in perspective. Corners go top-left, top-right,
// bottom-right, bottom-left.
export function homography(w, h, dst) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const s = solve(A, b);
  if (!s) return null;
  const [a, bb, c, d, e, f, g, hh] = s;
  return [a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1];
}

// Where the map puts a point of the box, for the checks.
export function apply(m, x, y) {
  const X = m[0] * x + m[4] * y + m[12], Y = m[1] * x + m[5] * y + m[13], Wt = m[3] * x + m[7] * y + m[15];
  return [X / Wt, Y / Wt];
}

function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}
