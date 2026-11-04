// The rooms the camera may move in (Blender x and y, plus a ceiling). The camera stays in the room I am standing in;
// in a doorway between two, it keeps the room I was last in.
export function makeRegions(regions) {
  let current = regions[0];
  const inside = (r, x, y, m) => x >= r.min[0] - m && x <= r.max[0] + m && y >= r.min[1] - m && y <= r.max[1] + m;
  return {
    at(x, y) {
      if (!inside(current, x, y, 0.3)) current = regions.find(r => inside(r, x, y, 0.3)) || current;
      return current;
    },
    // Clamp a camera position (three axes: Blender y is -z) into a room.
    clamp(r, p, floorY) {
      p.x = Math.min(Math.max(p.x, r.min[0]), r.max[0]);
      p.z = Math.min(Math.max(p.z, -r.max[1]), -r.min[1]);
      p.y = Math.min(Math.max(p.y, floorY + 0.4), r.top);
      return p;
    },
  };
}
