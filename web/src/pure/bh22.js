// BH-22's moods show in its eyes: hearts when it is fond of someone, happy arcs when something good happens, x x when it
// is knocked about or loses. `colour` (linear, as bright as the eyes glow) is null where the eyes keep their colour.
export const MOODS = {
  love: { eyes: 'hearts', colour: [2.6, 0.55, 1.35], time: 3 },
  happy: { eyes: 'arcs', colour: null, time: 3.6 },
  dizzy: { eyes: 'x', colour: [2.6, 0.75, 0.3], time: 2.6 },
};

// The eye shapes as flat outlines, in metres about each eye's middle (x right, y up), sized to the round eyes they
// replace (1.7 cm wide, 2.6 cm tall).
export function heart(w = 0.024, n = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    pts.push([x * w / 34, (y + 2.5) * w / 34]);
  }
  return pts;
}
// A happy eye: an arch, open below.
export function arch(r = 0.012, t = 0.0045, n = 14) {
  const out = [], inn = [], a0 = 0.18, a1 = Math.PI - 0.18;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([Math.cos(a) * r, Math.sin(a) * r - r * 0.45]);
    inn.unshift([Math.cos(a) * (r - t), Math.sin(a) * (r - t) - r * 0.45]);
  }
  return out.concat(inn);
}
// An x: two bars, each as a four-corner outline.
export function cross(len = 0.024, t = 0.0055) {
  return [Math.PI / 4, -Math.PI / 4].map(a => {
    const c = Math.cos(a), s = Math.sin(a), hx = len / 2, hy = t / 2;
    return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  });
}
