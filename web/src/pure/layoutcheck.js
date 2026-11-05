// Checks the built world for the things that make a room feel cramped or sloppy: furniture inside other furniture or
// pushed into walls, rugs running over steps or edges, wall pieces overlapping, and things you use with no room to
// stand. Works on world.json (Blender axes: x east, y north, z up). Returns a list of problems in plain words.
const TOL = 0.01;

const overlaps = (a, b) => a.min[0] < b.max[0] - TOL && b.min[0] < a.max[0] - TOL && a.min[1] < b.max[1] - TOL && b.min[1] < a.max[1] - TOL
  && a.min[2] < b.max[2] - TOL && b.min[2] < a.max[2] - TOL;
const depth = (a, b) => Math.min(...[0, 1, 2].map(i => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i])));
const rectDist = (x, y, c) => Math.hypot(Math.max(c.min[0] - x, 0, x - c.max[0]), Math.max(c.min[1] - y, 0, y - c.max[1]));

export function checkLayout(meta, { clearance = 0.3, wallDepth = 0.02 } = {}) {
  const problems = [];
  // Furniture colliders reach below their floor so nothing slips under them; measure them from the floor they stand on.
  const standsOn = c => {
    const x = (c.min[0] + c.max[0]) / 2, y = (c.min[1] + c.max[1]) / 2;
    const under = meta.floors.filter(f => x >= f.min[0] && x <= f.max[0] && y >= f.min[1] && y <= f.max[1] && f.z < c.max[2] - TOL).map(f => f.z);
    return under.length ? { ...c, min: [c.min[0], c.min[1], Math.max(c.min[2], Math.max(...under))] } : c;
  };
  const solids = meta.colliders.filter(c => c.kind === 'solid').map(standsOn);
  const structure = meta.colliders.filter(c => c.kind === 'structure');
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    if (overlaps(solids[i], solids[j])) problems.push(`${solids[i].name} runs into ${solids[j].name}`);
  }
  for (const s of solids) for (const w of structure) {
    if (overlaps(s, w) && depth(s, w) > wallDepth) problems.push(`${s.name} is pushed ${depth(s, w).toFixed(2)} m into ${w.name}`);
  }
  // A floor holds a rug only if the whole rug fits on one stretch of floor at its own height.
  const onFloor = (r, f) => Math.abs(f.z - r.z) < 0.02 && r.min[0] >= f.min[0] - TOL && r.max[0] <= f.max[0] + TOL && r.min[1] >= f.min[1] - TOL && r.max[1] <= f.max[1] + TOL;
  for (const r of meta.rugs || []) if (!meta.floors.some(f => onFloor(r, f))) problems.push(`rug ${r.name} runs over a step or an edge`);
  for (const it of meta.interact || []) {
    const [x, y, z] = it.at;
    const floor = meta.floors.some(f => Math.abs(f.z - z) < 0.06 && x >= f.min[0] && x <= f.max[0] && y >= f.min[1] && y <= f.max[1]);
    if (!floor) problems.push(`${it.id}: its spot is not on a floor`);
    const near = solids.concat(structure).filter(c => c.min[2] < z + 1.7 && c.max[2] > z + 0.05)
      .map(c => ({ c, d: rectDist(x, y, c) })).filter(o => o.d < clearance);
    if (near.length) problems.push(`${it.id}: no room to stand, ${near.map(o => o.c.name).join(', ')} within ${clearance} m`);
  }
  const walls = meta.walls || [];
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j];
    if (a.wall === b.wall && a.u[0] < b.u[1] - TOL && b.u[0] < a.u[1] - TOL && a.z[0] < b.z[1] - TOL && b.z[0] < a.z[1] - TOL) problems.push(`${a.name} and ${b.name} overlap on the ${a.wall} wall`);
  }
  return problems;
}
