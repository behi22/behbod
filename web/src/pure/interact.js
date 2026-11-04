// Things you walk up to and press E on. Positions come in Blender axes; `nearest` takes my position in three's axes
// (x, height, -north) and returns the closest thing in reach on my own floor, or null.
export function makeInteract(list) {
  const items = list.map(i => ({ ...i, x: i.at[0], y: i.at[2], z: -i.at[1] }));
  return {
    items,
    nearest(p) {
      let best = null, bd = Infinity;
      for (const it of items) {
        if (Math.abs(p.y - it.y) > 1.0) continue;
        const d = Math.hypot(p.x - it.x, p.z - it.z);
        if (d <= it.r && d < bd) { bd = d; best = it; }
      }
      return best;
    },
  };
}

// A Blender heading in degrees (0 east, 90 north) as the character's turn about three's y axis.
export const headingToFacing = deg => Math.atan2(Math.cos(deg * Math.PI / 180), -Math.sin(deg * Math.PI / 180));
