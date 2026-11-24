// Two bones reaching for a point: a leg (hip, knee, ankle) or an arm (shoulder, elbow, wrist). Points are [x, y, z].
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const along = (a, d, k) => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];

// Where the middle joint goes so the end lands on `target`, the bones keeping their lengths. The joint bends the way it
// already bends (so the pose's own knee or elbow is kept), or toward `pole` when the limb is straight. A target out of
// reach is reached for as far as the limb goes, never further; one inside the hip is held off at the shortest bend.
export function reach(root, mid, end, target, pole) {
  const l1 = len(sub(mid, root)), l2 = len(sub(end, mid));
  const to = sub(target, root), d0 = len(to);
  const u = d0 > 1e-9 ? to.map(c => c / d0) : norm(sub(end, root));
  const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9999);
  let p = sub(mid, root);
  p = along(p, u, -dot(p, u));
  if (len(p) < 1e-4 * (l1 + l2)) p = along(pole, u, -dot(pole, u));
  if (len(p) < 1e-9) p = Math.abs(u[1]) < 0.9 ? [-u[2], 0, u[0]] : [1, 0, 0];
  const pl = len(p);
  p = p.map(c => c / pl);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: along(along(root, u, a), p, h), end: along(root, u, d), short: Math.max(0, d0 - d) };
}

function norm(a) { const l = len(a) || 1; return a.map(c => c / l); }
