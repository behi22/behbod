// Walkable floors and solid boxes from the world metadata, in three's axes (Blender y becomes -z).
export const R = 0.27, STEP = 0.32;

export function makeCollision(meta) {
  const floors = meta.floors.map(f => ({ x0: f.min[0], x1: f.max[0], z0: -f.max[1], z1: -f.min[1], y: f.z }));
  const boxes = meta.colliders.map(c => ({ name: c.name, x0: c.min[0], x1: c.max[0], z0: -c.max[1], z1: -c.min[1], y0: c.min[2], y1: c.max[2], off: false }));

  function groundAt(x, z, feet) {
    let g = -10;
    for (const f of floors) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && f.y <= feet + STEP && f.y > g) g = f.y;
    for (const b of boxes) if (!b.off && b.y1 < 3 && x >= b.x0 - 0.05 && x <= b.x1 + 0.05 && z >= b.z0 - 0.05 && z <= b.z1 + 0.05 && b.y1 <= feet + 0.05 && b.y1 > g) g = b.y1;
    return g;
  }

  function pushOut(p, feet) {
    for (const b of boxes) {
      if (b.off || b.y1 <= feet + 0.05 || b.y0 >= feet + 1.7) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (R - d) / d; p.x += dx * k; p.z += dz * k; continue; }
      const ex = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z], i = ex.indexOf(Math.min(...ex));
      if (i === 0) p.x = b.x0 - R; else if (i === 1) p.x = b.x1 + R; else if (i === 2) p.z = b.z0 - R; else p.z = b.z1 + R;
    }
  }

  // How far the camera can sit along its arm before something solid is in the way.
  function cameraRoom(o, d, want) {
    let best = want;
    for (const b of boxes) {
      if (b.off || (b.y1 - b.y0 > 4.5 && b.name.startsWith('wall'))) continue;
      let t0 = 0, t1 = want;
      for (const [oo, dd, lo, hi] of [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]]) {
        if (Math.abs(dd) < 1e-6) { if (oo < lo || oo > hi) { t0 = Infinity; break; } continue; }
        let a = (lo - oo) / dd, c = (hi - oo) / dd;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 > 0.05) best = Math.min(best, t0 - 0.12);
    }
    return Math.max(0.9, best);
  }

  // A door that opens stops being solid.
  const setSolid = (name, on) => { for (const b of boxes) if (b.name === name) b.off = !on; };

  return { floors, boxes, groundAt, pushOut, cameraRoom, setSolid };
}
