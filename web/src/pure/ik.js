// Two bones reaching for a point: a leg (hip, knee, ankle) or an arm (shoulder, elbow, wrist). Points are [x, y, z].

// Where the middle joint goes so the end lands on `target`, the bones keeping their lengths. The joint bends the way it
// already bends (so the pose's own knee or elbow is kept), or toward `pole` when the limb is straight. A target out of
// reach is reached for as far as the limb goes, never further; one inside the hip is held off at the shortest bend.
// The answer is written into `out` (pass the same one each frame: nothing new is made).
export function reach(root, mid, end, target, pole, out = { mid: [0, 0, 0], end: [0, 0, 0], short: 0 }) {
  const rx = root[0], ry = root[1], rz = root[2];
  const l1 = Math.hypot(mid[0] - rx, mid[1] - ry, mid[2] - rz), l2 = Math.hypot(end[0] - mid[0], end[1] - mid[1], end[2] - mid[2]);
  let ux = target[0] - rx, uy = target[1] - ry, uz = target[2] - rz;
  const d0 = Math.hypot(ux, uy, uz);
  if (d0 <= 1e-9) { ux = end[0] - rx; uy = end[1] - ry; uz = end[2] - rz; }
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9999);
  // The bend: the middle joint's way off the line from the root to the target.
  let px = mid[0] - rx, py = mid[1] - ry, pz = mid[2] - rz, k = px * ux + py * uy + pz * uz;
  px -= ux * k; py -= uy * k; pz -= uz * k;
  if (Math.hypot(px, py, pz) < 1e-4 * (l1 + l2)) {
    k = pole[0] * ux + pole[1] * uy + pole[2] * uz;
    px = pole[0] - ux * k; py = pole[1] - uy * k; pz = pole[2] - uz * k;
  }
  if (Math.hypot(px, py, pz) < 1e-9) { if (Math.abs(uy) < 0.9) { px = -uz; py = 0; pz = ux; } else { px = 1; py = 0; pz = 0; } }
  const pl = Math.hypot(px, py, pz);
  px /= pl; py /= pl; pz /= pl;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  out.mid[0] = rx + ux * a + px * h; out.mid[1] = ry + uy * a + py * h; out.mid[2] = rz + uz * a + pz * h;
  out.end[0] = rx + ux * d; out.end[1] = ry + uy * d; out.end[2] = rz + uz * d;
  out.short = Math.max(0, d0 - d);
  return out;
}
