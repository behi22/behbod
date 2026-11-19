// Where the mosaic over the toy head goes in the picture. Points are [x, y, z].
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The picture's UVs span its full height, and a head of radius r at distance d covers r / (d tan(fov/2)) of half of it.
export const veilRadius = (r, d, fovDeg) => (d > 0 ? (0.5 * r) / d / Math.tan((fovDeg * Math.PI) / 360) : 0);

// The head as a flat mirror shows it: its image behind the glass, or null when the head or the eye is behind the mirror
// or none of its image lands on the glass (a head of radius `reach` shows there shrunk by t, the glass's share of the
// eye's way to the image).
// m: { p: centre, n: unit normal on the side it reflects, u and v: unit axes along its width and height, w, h }.
export function mirrorImage(head, eye, m, reach = 0) {
  const s = dot(sub(head, m.p), m.n), e = dot(sub(eye, m.p), m.n);
  if (!(s > 0) || !(e > 0)) return null;
  const img = head.map((c, i) => c - 2 * s * m.n[i]);
  const t = e / (e + s), margin = reach * t;
  const off = sub(eye.map((c, i) => c + t * (img[i] - c)), m.p);
  if (Math.abs(dot(off, m.u)) > m.w / 2 + margin || Math.abs(dot(off, m.v)) > m.h / 2 + margin) return null;
  return img;
}
