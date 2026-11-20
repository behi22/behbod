// Signed distances in centimetres, y up, a model's front facing +z.
const { sqrt, abs, max, min, cos, sin, atan2, PI } = Math;
const len3 = (x, y, z) => sqrt(x * x + y * y + z * z);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

export function sphere(r, [a = 0, b = 0, c = 0] = []) {
  return (x, y, z) => len3(x - a, y - b, z - c) - r;
}
// A close bound for a stretched sphere (exact for a sphere).
export function ellipsoid([rx, ry, rz], [a = 0, b = 0, c = 0] = []) {
  return (x, y, z) => {
    const px = (x - a) / rx, py = (y - b) / ry, pz = (z - c) / rz, k0 = len3(px, py, pz);
    if (k0 < 1e-9) return -min(rx, ry, rz);
    const k1 = len3(px / rx, py / ry, pz / rz);
    return (k0 * (k0 - 1)) / k1;
  };
}
export function box([hx, hy, hz], [a = 0, b = 0, c = 0] = [], r = 0) {
  return (x, y, z) => {
    const qx = abs(x - a) - hx + r, qy = abs(y - b) - hy + r, qz = abs(z - c) - hz + r;
    return len3(max(qx, 0), max(qy, 0), max(qz, 0)) + min(max(qx, qy, qz), 0) - r;
  };
}
export function rod([ax, ay, az], [bx, by, bz], ra, rb = ra) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz, l = sqrt(l2), rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  if (abs(rr) < 1e-9 || l < 1e-9) {
    return (x, y, z) => {
      const px = x - ax, py = y - ay, pz = z - az, h = clamp01((px * dx + py * dy + pz * dz) * il2);
      return len3(px - dx * h, py - dy * h, pz - dz * h) - ra;
    };
  }
  // The round cone (iq): two spheres joined by their common tangent cone.
  return (x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az, pd = px * dx + py * dy + pz * dz;
    const yv = pd - l2, ox = px * l2 - dx * pd, oy = py * l2 - dy * pd, oz = pz * l2 - dz * pd, x2 = ox * ox + oy * oy + oz * oz;
    const y2 = pd * pd * l2, z2 = yv * yv * l2, k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(yv) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(pd) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - ra;
    return (sqrt(x2 * a2 * il2) + pd * rr) * il2 - ra;
  };
}
export function cylinder(rad, y0, y1, [a = 0, c = 0] = [], r = 0) {
  const mid = (y0 + y1) / 2, h = (y1 - y0) / 2;
  return (x, y, z) => {
    const dx = sqrt((x - a) ** 2 + (z - c) ** 2) - rad + r, dy = abs(y - mid) - h + r;
    return min(max(dx, dy), 0) + sqrt(max(dx, 0) ** 2 + max(dy, 0) ** 2) - r;
  };
}
export function torus(R, r, [a = 0, b = 0, c = 0] = [], axis = 'y') {
  return (x, y, z) => {
    const px = x - a, py = y - b, pz = z - c;
    const [u, v, w] = axis === 'y' ? [px, pz, py] : axis === 'x' ? [py, pz, px] : [px, py, pz];
    return sqrt((sqrt(u * u + v * v) - R) ** 2 + w * w) - r;
  };
}

export function polygon(pts) {
  const n = pts.length, xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const bx0 = min(...xs), bx1 = max(...xs), by0 = min(...ys), by1 = max(...ys);
  return (px, py) => {
    // Far from the outline's box, the distance to the box is close enough and much quicker.
    const ox = max(bx0 - px, px - bx1, 0), oy = max(by0 - py, py - by1, 0);
    if (ox + oy > 1.5) return sqrt(ox * ox + oy * oy);
    let d = Infinity, s = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j], ex = xj - xi, ey = yj - yi, wx = px - xi, wy = py - yi;
      const h = clamp01((wx * ex + wy * ey) / (ex * ex + ey * ey || 1)), bx = wx - ex * h, by = wy - ey * h;
      d = min(d, bx * bx + by * by);
      const c1 = py >= yi, c2 = py < yj, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * sqrt(d);
  };
}
export function lathe(profile, [a = 0, c = 0] = []) {
  const f = polygon(profile.concat([[-1e-3, profile[profile.length - 1][1]], [-1e-3, profile[0][1]]]));
  return (x, y, z) => f(sqrt((x - a) ** 2 + (z - c) ** 2), y);
}
// A flat outline f2(u, v) given thickness along `axis`; u and v are the other two axes in order (z: x, y; x: z, y; y: x, z).
export function extrude(f2, half, center = 0, axis = 'z') {
  return (x, y, z) => {
    const [u, v, w] = axis === 'z' ? [x, y, z] : axis === 'x' ? [z, y, x] : [x, z, y];
    const d = f2(u, v), e = abs(w - center) - half;
    return min(max(d, e), 0) + sqrt(max(d, 0) ** 2 + max(e, 0) ** 2);
  };
}

export const union = (...fs) => (x, y, z) => { let d = fs[0](x, y, z); for (let i = 1; i < fs.length; i++) { const e = fs[i](x, y, z); if (e < d) d = e; } return d; };
export function blend(k, ...fs) {
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) {
      const e = fs[i](x, y, z), h = max(k - abs(d - e), 0) / k;
      d = min(d, e) - h * h * k * 0.25;
    }
    return d;
  };
}
export const cut = (f, ...gs) => (x, y, z) => { let d = f(x, y, z); for (const g of gs) d = max(d, -g(x, y, z)); return d; };
export function carve(k, f, g) {
  return (x, y, z) => {
    const a = f(x, y, z), b = -g(x, y, z), h = max(k - abs(a - b), 0) / k;
    return max(a, b) + h * h * k * 0.25;
  };
}
// Where both are. Put the cheap one first: far outside it, the other is never asked.
export const meet = (f, g) => (x, y, z) => { const a = f(x, y, z); return a > 1 ? a : max(a, g(x, y, z)); };
export const inflate = (f, r) => (x, y, z) => f(x, y, z) - r;

export const move = (f, [a = 0, b = 0, c = 0]) => (x, y, z) => f(x - a, y - b, z - c);
export const scale = (f, s) => (x, y, z) => f(x / s, y / s, z / s) * s;
export const mirrorX = f => (x, y, z) => f(abs(x), y, z);
// For a model seen side on (facing +x), whose left and right are along z.
export const mirrorZ = f => (x, y, z) => f(x, y, abs(z));
export function turn(f, axis, ang, [a = 0, b = 0, c = 0] = []) {
  const cs = cos(ang), sn = sin(ang);
  if (axis === 'y') return (x, y, z) => { const px = x - a, pz = z - c; return f(a + cs * px - sn * pz, y, c + sn * px + cs * pz); };
  if (axis === 'x') return (x, y, z) => { const py = y - b, pz = z - c; return f(x, b + cs * py + sn * pz, c - sn * py + cs * pz); };
  return (x, y, z) => { const px = x - a, py = y - b; return f(a + cs * px + sn * py, b - sn * px + cs * py, z); };
}
// Copies a shape n times round the upright axis (fins, crown points, petals), each copy built at angle 0 on +z.
export function around(f, n, offset = 0) {
  const step = (2 * PI) / n;
  return (x, y, z) => {
    let a = atan2(x, z) - offset;
    a -= step * Math.round(a / step);
    const r = sqrt(x * x + z * z);
    return f(r * sin(a), y, r * cos(a));
  };
}
export const above = y0 => (x, y) => y0 - y;
export const onBed = f => (x, y, z) => max(f(x, y, z), -y);
