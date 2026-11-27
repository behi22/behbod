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

// A flat layer laid through a curved screen's four corners bulges past its top and bottom edges between them, since
// those edges curve away from the eye, and hides the frame there. Slides the layer's top corners down its sides and its
// bottom corners up, each pair as little as keeps that edge inside the screen's, given as points on the page.
export function insetToEdges(corners, top, bottom) {
  const [tl, tr, br, bl] = corners;
  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const yOn = (a, b, x) => a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  // How far the worst point sits on the wrong side of the layer's edge (page pixels down for the top, up for the bottom).
  const overTop = t => Math.max(...top.map(q => q[1] - yOn(at(tl, bl, t), at(tr, br, t), q[0])));
  const overBottom = t => Math.max(...bottom.map(q => yOn(at(bl, tl, t), at(br, tr, t), q[0]) - q[1]));
  const least = over => {
    if (over(0) <= 0) return 0;
    let lo = 0, hi = 0.25;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (over(m) > 0) lo = m; else hi = m; }
    return hi;
  };
  const t = least(overTop), u = least(overBottom);
  return [at(tl, bl, t), at(tr, br, t), at(br, tr, u), at(bl, tl, u)];
}
