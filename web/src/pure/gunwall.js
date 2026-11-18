// Places are in Blender's axes (x east, y north, z up), like the world file's mounts.
import { GUNS } from './arsenal.js';
import { totalStars } from './stages.js';

// The shelf top and the slatted panel, from blender/zones/range.py.
export const SHELF = 0.9;
export const PANEL = { y: [-5.6, -1.2], z: [0.5, 2.4] };
// Never on the wall: attachments, whatever is fitted to a mount, the spent case, the extended magazine's top round.
export const HIDDEN = /_att_|_mount_|casing|round_ext/;

export function wall(best, { all = false, held = 'pistol' } = {}) {
  const stars = totalStars(best);
  return GUNS.map((g, i) => {
    const owned = all || g.stars <= stars;
    return { id: g.id, name: g.name, kind: g.kind, mount: i, need: g.stars, more: owned ? 0 : g.stars - stars, owned, held: owned && g.id === held };
  });
}
export const ownedGuns = (best, all = false) => wall(best, { all }).filter(m => m.owned).map(m => m.id);

const stars = n => `${n} star${n === 1 ? '' : 's'}`, kind = k => (k === k.toUpperCase() ? k : k.toLowerCase());
export function prompt(m) {
  if (!m.owned) return `The ${m.name}: ${stars(m.need)}`;
  return m.held ? `The ${m.name}, in your hands` : `Take the ${m.name}`;
}
export function said(m) {
  if (!m.owned) return `The ${m.name} (${kind(m.kind)}) unlocks at ${stars(m.need)}. ${stars(m.more)} to go.`;
  if (m.held) return `The ${m.name} is in your hands. Step up to the line.`;
  return `You take the ${m.name}. Step up to the line.`;
}
export const coming = m => `One moment: fetching the ${m.name}.`;
export function summary(list) {
  const n = list.filter(m => m.owned).length;
  return n === list.length ? `The gun wall: all ${n} guns are yours. Walk up to one to take it.`
    : `The gun wall: ${n} of the ${list.length} guns are yours so far. Stars at the line earn the rest.`;
}

// The long guns stand upright: lying flat they overlap their neighbours; the pistol hangs where it always has.
export function hang(id, box, at) {
  if (id === 'pistol') return { at: [at[0], at[1] + 0.08, at[2] + 0.05], upright: false, scale: 1.25 };
  return { at: [at[0], at[1] - (box[1] + box[3]) / 2, SHELF - box[0]], upright: true, scale: 1 };
}
// [y0, y1, z0, z1]: flat, the muzzle points south; upright, up, with the gun's top to the north.
export function footprint(h, box) {
  const [x0, y0, x1, y1] = box, s = h.scale, [, ay, az] = h.at;
  return h.upright ? [ay + y0 * s, ay + y1 * s, az + x0 * s, az + x1 * s] : [ay - x1 * s, ay - x0 * s, az + y0 * s, az + y1 * s];
}

// From the glTF's JSON alone, so a test can tell when a gun file has changed without decoding it.
export function outline(json) {
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const local = n => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  const walk = (i, parent) => {
    const n = json.nodes[i];
    if (HIDDEN.test(n.name || '')) return;
    const m = mul(parent, local(n));
    for (const p of n.mesh === undefined ? [] : json.meshes[n.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION], d = a.normalized ? NORM[a.componentType] : 1;
      if (!a.min || !a.max) continue;
      for (const k of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const v = [0, 1, 2].map(j => ((k >> j) & 1 ? a.max[j] : a.min[j]) / d);
        for (const j of [0, 1]) { const w = m[j] * v[0] + m[4 + j] * v[1] + m[8 + j] * v[2] + m[12 + j]; lo[j] = Math.min(lo[j], w); hi[j] = Math.max(hi[j], w); }
      }
    }
    for (const c of n.children || []) walk(c, m);
  };
  for (const r of json.scenes[json.scene || 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return [lo[0], lo[1], hi[0], hi[1]].map(v => +v.toFixed(4));
}
