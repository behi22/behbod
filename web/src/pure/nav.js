// A walk grid over every floor (Blender axes: x east, y north, z up) and A* paths across it, for click-to-walk, the
// phone chips, BH-22 and the pets. Cells are free when a floor covers them and nothing solid stands within `radius`
// at body height; neighbours connect when their heights differ by no more than a step.
const STEP = 0.32;

// Cells must be smaller than the shallowest stair tread (0.24 m), or a tread can fall between cell centres.
export function makeNav(meta, { cell = 0.2, radius = 0.3, height = 1.6, off = () => false } = {}) {
  const xs = meta.floors.flatMap(f => [f.min[0], f.max[0]]), ys = meta.floors.flatMap(f => [f.min[1], f.max[1]]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const nx = Math.ceil((Math.max(...xs) - x0) / cell), ny = Math.ceil((Math.max(...ys) - y0) / cell);
  const boxes = meta.colliders.filter(c => !off(c.name));
  // Each cell holds the heights you can stand at there (more than one under the mezzanine).
  const levels = new Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell;
    const zs = [];
    for (const f of meta.floors) {
      if (x < f.min[0] || x > f.max[0] || y < f.min[1] || y > f.max[1]) continue;
      // A floor counts only where no higher floor sits within a body height above it at this spot.
      if (zs.some(z => Math.abs(z - f.z) < 0.05)) continue;
      const blocked = boxes.some(b => b.min[2] < f.z + height && b.max[2] > f.z + 0.06
        && x > b.min[0] - radius && x < b.max[0] + radius && y > b.min[1] - radius && y < b.max[1] + radius);
      if (!blocked) zs.push(f.z);
    }
    levels[j * nx + i] = zs;
  }
  // Under a raised floor nobody stands at the lower height if the upper one is within head room.
  for (const zs of levels) {
    zs.sort((a, b) => a - b);
    for (let k = zs.length - 2; k >= 0; k--) if (zs[k + 1] - zs[k] < height) zs.splice(k, 1);
  }
  const id = (i, j, k) => ((j * nx + i) << 2) | k;
  const unpack = n => ({ i: (n >> 2) % nx, j: Math.floor((n >> 2) / nx), k: n & 3 });
  const pointOf = n => { const { i, j, k } = unpack(n); return [x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell, levels[j * nx + i][k]]; };

  function nodeAt(x, y, z) {
    const ci = Math.floor((x - x0) / cell), cj = Math.floor((y - y0) / cell);
    let best = null, bd = Infinity;
    for (let r = 0; r <= 12 && best === null; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      levels[j * nx + i].forEach((lz, k) => {
        if (Math.abs(lz - z) > 0.6) return;
        const d = Math.hypot(di, dj) + Math.abs(lz - z);
        if (d < bd) { bd = d; best = id(i, j, k); }
      });
    }
    return best;
  }
  function* neighbours(n) {
    const { i, j, k } = unpack(n), z = levels[j * nx + i][k];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      // Diagonals need both straight neighbours open, so paths never cut a corner.
      if (di && dj && (!levels[j * nx + a].some(lz => Math.abs(lz - z) <= STEP) || !levels[b * nx + i].some(lz => Math.abs(lz - z) <= STEP))) continue;
      const zs = levels[b * nx + a];
      for (let q = 0; q < zs.length; q++) if (Math.abs(zs[q] - z) <= STEP) yield [id(a, b, q), Math.hypot(di, dj) * cell + Math.abs(zs[q] - z)];
    }
  }
  // Straight-line check across the grid, used to pull the path tight.
  function clear(p, q) {
    const steps = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (cell * 0.5));
    let z = p[2];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
      const i = Math.floor((x - x0) / cell), j = Math.floor((y - y0) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return false;
      const zs = levels[j * nx + i], k = zs.findIndex(lz => Math.abs(lz - z) <= STEP);
      if (k < 0) return false;
      z = zs[k];
    }
    return Math.abs(z - q[2]) <= STEP;
  }
  function path(from, to) {
    const s = nodeAt(...from), g = nodeAt(...to);
    if (s === null || g === null) return null;
    const goal = pointOf(g), h = n => { const p = pointOf(n); return Math.hypot(p[0] - goal[0], p[1] - goal[1], p[2] - goal[2]); };
    const heap = [], cost = new Map([[s, 0]]), came = new Map(), closed = new Set();
    const push = (f, n) => {
      heap.push([f, n]);
      for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top[1];
    };
    push(h(s), s);
    let guard = 0;
    while (heap.length && guard++ < 200000) {
      let n = pop();
      if (closed.has(n)) continue;
      if (n === g) {
        const out = [pointOf(n)];
        while (came.has(n)) { n = came.get(n); out.push(pointOf(n)); }
        out.reverse();
        const tight = [out[0]];
        for (let a = 0; a < out.length - 1;) {
          let b = out.length - 1;
          while (b > a + 1 && !clear(out[a], out[b])) b--;
          tight.push(out[b]);
          a = b;
        }
        return tight;
      }
      closed.add(n);
      for (const [m, c] of neighbours(n)) {
        if (closed.has(m)) continue;
        const nc = cost.get(n) + c;
        if (nc < (cost.get(m) ?? Infinity)) { cost.set(m, nc); came.set(m, n); push(nc + h(m), m); }
      }
    }
    return null;
  }
  return { path, nodeAt, clear, cells: nx * ny, free: levels.reduce((a, zs) => a + zs.length, 0), walkable: (x, y, z) => nodeAt(x, y, z) !== null };
}
