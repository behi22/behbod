// His games on the console unit beside the TV: twenty cases in a row between two steel bookends, one mesh, every spine
// painted once into one shared texture. The texture is painted a few spines at a time in the page's quiet moments, a
// few seconds after the house is up; until then the shelf shows the old blank cases the new row stands over.
import * as THREE from 'three';
import { b2t } from './engine.js';
import { GAMES, SHELF, shelfSlots } from './pure/shelf.js';
import { paintSpine, coverCanvas, coverReady } from './covers.js';

// The texture: the spines side by side, each SW by SH (13 by 213 mm at about 3.6 px a mm), and a column of flat colours
// for the other faces: each case's plastic top and its sides, and the bookends' steel.
const SW = 48, SH = 768, AW = 1024, AH = 768, SWATCH = 960;
const swatch = (i, k) => [(SWATCH + 16 + k * 32) / AW, 1 - (i * 32 + 16) / AH];
const STEEL = 20;
// Up to 4 ms of painting at a time; the covers are drawn ahead once you are this near the shelf, in metres.
const SLICE = 4, NEAR = 5;

export function makeGameShelf(scene, { adopt = () => {} } = {}) {
  const later = typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: 1500 }) : f => setTimeout(() => f({ timeRemaining: () => SLICE }), 200);
  const slots = shelfSlots();
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = AH;
  // Painted on the processor, a slice at a time: a graphics-card canvas would save all the drawing for the frame that
  // first shows it.
  const g = canvas.getContext('2d', { willReadFrequently: true });
  let mesh = null, material = null, painted = 0, started = false, coversAsked = false, dayK = -1;
  // Up close to the cases: the console's own spot is a step behind, the egg chair just north.
  const spot = { id: 'game_shelf', label: 'Look at my games', at: [1.08, 12.5, 0], r: 0.36 };
  Object.assign(spot, { x: spot.at[0], y: spot.at[2], z: -spot.at[1] });

  // Each case's top in its own colour, darker, with the plastic edges showing either side, so the row reads as cases.
  function paintSwatches(g) {
    GAMES.forEach((game, i) => {
      g.fillStyle = game.bg; g.fillRect(SWATCH, i * 32, 64, 32);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(SWATCH, i * 32, 32, 32);
      g.fillStyle = '#0d0e11'; g.fillRect(SWATCH, i * 32, 4, 32); g.fillRect(SWATCH + 28, i * 32, 4, 32);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(SWATCH + 32, i * 32, 32, 32);
    });
    g.fillStyle = '#2b2d31'; g.fillRect(SWATCH, STEEL * 32, 64, 32);
  }
  // One box, its faces mapped by the way they look: the spine faces the room (+x), the plastic top up, the rest the
  // case's own darker colour, steel for a bookend. `spine` is where its spine starts in the texture, or null.
  function box(w, h, d, at, spine, i) {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let v = 0; v < pos.count; v++) {
      const nx = nor.getX(v), ny = nor.getY(v);
      let u, t;
      if (i === STEEL) [u, t] = [(SWATCH + 32) / AW, 1 - (STEEL * 32 + 16) / AH];
      else if (spine !== null && nx > 0.5) { u = (spine + (0.5 - pos.getZ(v) / d) * SW) / AW; t = 1 - (0.5 - pos.getY(v) / h) * SH / AH; }
      else if (ny > 0.5) { u = (SWATCH + 1 + (0.5 - pos.getZ(v) / d) * 30) / AW; t = swatch(i, 0)[1]; }
      else [u, t] = swatch(i, 1);
      uv.setXY(v, u, t);
    }
    geo.translate(at.x, at.y, at.z);
    return geo;
  }
  function build() {
    const geos = [];
    slots.forEach((s, i) => geos.push(box(SHELF.depth, SHELF.height, s.t, b2t(SHELF.x, s.y, SHELF.z + SHELF.height / 2), i * SW, i)));
    // The bookends: a steel plate against each end of the row (their feet are under the cases).
    const first = slots[0], last = slots.at(-1);
    for (const y of [first.y - first.t / 2 - SHELF.end / 2, last.y + last.t / 2 + SHELF.end / 2]) geos.push(box(0.12, 0.15, SHELF.end, b2t(SHELF.x - 0.01, y, SHELF.z + 0.075), null, STEEL));
    const geo = mergeAll(geos);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    material = new THREE.MeshBasicMaterial({ map: tex, fog: true });
    mesh = new THREE.Mesh(geo, material);
    mesh.name = 'game_shelf';
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    dayK = -1;
    adopt(mesh);
  }
  function mergeAll(geos) {
    const n = geos.reduce((a, g) => a + g.attributes.position.count, 0), p = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of geos) { p.set(g.attributes.position.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(p, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
  // A few spines each quiet moment, then the mesh goes in with the finished texture.
  function work(deadline) {
    if (painted === 0) paintSwatches(g);
    const until = performance.now() + Math.min(SLICE, Math.max(1, deadline?.timeRemaining?.() ?? SLICE));
    while (painted < GAMES.length && performance.now() < until) {
      g.save(); g.translate(painted * SW, 0); paintSpine(g, GAMES[painted], painted + 1, SW, SH); g.restore();
      painted++;
    }
    if (painted < GAMES.length) later(work); else build();
  }
  // The covers for the games panel, a few each quiet moment.
  function covers(deadline) {
    const until = performance.now() + Math.min(SLICE, Math.max(1, deadline?.timeRemaining?.() ?? SLICE));
    const next = () => GAMES.findIndex(g => !coverReady(g));
    for (let i = next(); i >= 0 && performance.now() < until; i = next()) coverCanvas(GAMES[i], i + 1);
    if (next() >= 0) later(covers);
  }

  return {
    spot,
    // Starts the painting once, when asked (the house has been up a few seconds), and the covers once `player` (three's
    // axes) comes within a few metres; `day` brightens the shelf as the room does.
    tick(day = 0, start = false, player = null) {
      if (start && !started) { started = true; later(work); }
      if (start && !coversAsked && player && Math.hypot(player.x - spot.x, player.z - spot.z) < NEAR) { coversAsked = true; later(covers); }
      if (!material || Math.abs(day - dayK) < 0.02) return;
      dayK = day;
      material.color.setRGB(0.8 * (1 + 0.12 * day), 0.8 * (1 + 0.12 * day), 0.8 * (1 + 0.18 * day));
    },
    hit(ray, blockers) {
      if (!mesh) return null;
      const h = ray.intersectObject(mesh, false)[0];
      if (!h) return null;
      return !blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < h.distance - 0.05) ? spot : null;
    },
  };
}
