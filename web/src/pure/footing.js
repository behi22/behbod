// Where each foot stands, read from the house's floor plan: the same floors and boxes the walking collision is built
// from, so placing both feet costs a few hundred comparisons a frame and no ray against the scene.
//   up: how far above the hips' floor a floor still counts as one to step on (two stair risers and a little)
//   upBox: the same for a box: as high as the walking body itself can step up (the physics' autostep)
//   ledge: a drop bigger than this between the body and a foot is an edge to stand at, not a step to reach down to
//   margin: how far round a box its top still holds a foot (as the walking collision has it)
export const FOOT = { up: 0.4, upBox: 0.2, ledge: 0.26, margin: 0.05 };

export function makeFooting(floors, boxes, o = FOOT) {
  // The highest floor or box top under (x, z) that is not above base by more than a step.
  function under(x, z, base) {
    let g = -Infinity;
    for (const f of floors) if (f.y > g && f.y <= base + o.up && x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) g = f.y;
    for (const b of boxes) if (!b.off && b.y1 > g && b.y1 <= base + o.upBox && x >= b.x0 - o.margin && x <= b.x1 + o.margin && z >= b.z0 - o.margin && z <= b.z1 + o.margin) g = b.y1;
    return g;
  }
  // The floor a foot at (fx, fz) stands on, for a body standing at (bx, bz) on height base. The way from the body to
  // the foot is read in two halves, so a stair (risers a tread apart) is stepped down one riser at a time, while a
  // drop bigger than `ledge` (the lounge pit, the studio's edge) keeps the foot on the edge above it.
  function foot(fx, fz, bx, bz, base) {
    let g = under(bx, bz, base + 0.1);
    if (g === -Infinity || base - g > o.ledge) g = base;
    for (const k of [0.5, 1]) {
      const h = under(bx + (fx - bx) * k, bz + (fz - bz) * k, g);
      if (h === -Infinity || g - h > o.ledge) return g;
      g = h;
    }
    return g;
  }
  return { under, foot };
}
