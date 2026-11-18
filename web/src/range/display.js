import * as THREE from 'three';
import { lit } from './lit.js';
import { prepare } from './room.js';
import { camoCanvas } from './camos.js';
import { makeCharm } from './charms.js';

// The loadout room dressed for the gunsmith; every piece is made ready before it shows, so none stalls a frame.
const BOARD = [
  // [piece, size, how it stands]: the light and suppressor upright, the scope level, the magazine as it hangs in a gun.
  ['KIT_light', 3.4, 'up'], ['KIT_sup_rifle', 2.7, 'up'], ['KIT_scope', 2.1, 'level'], ['KIT_mag_rifle', 1.85, 'level'],
];
const CAMOS = ['tidepool', 'pine', 'dune', 'glacier', 'candy', 'circuit'], CHARMS = ['pomegranate', 'rivet', 'cat', 'die'];

// low: phones and the low tier, which leave the bench top bare (the copy of the gun is most of the cost).
export function makeDisplay({ stage, places, B, fitter, renderer, camera, low = false }) {
  const group = new THREE.Group();
  group.name = 'gunsmith_display';
  group.visible = false;
  stage.add(group);
  const box = new THREE.Box3(), part = new THREE.Box3(), mid = new THREE.Vector3();
  // A piece put so the middle of its outline is `at` and its back rests on the board just behind it.
  function hang(o, at, back) {
    group.add(o);
    o.updateMatrixWorld(true);
    box.setFromObject(o); box.getCenter(mid);
    o.position.add(at.clone().sub(mid));
    o.position.z += back - (box.min.z - mid.z + at.z);
  }
  let made = null, onBench = null, benchJob = 0;
  // The board's pieces in a lighter gunmetal, so they read against the dark board (glass and glowing parts kept).
  const lighter = new Map();
  const showroom = m => {
    if (!lighter.has(m)) {
      const c = m.clone();
      if (!m.transparent) lit(c);
      const glows = m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0;
      if (!m.transparent && !glows && c.color.r + c.color.g + c.color.b < 0.45) { c.color.setRGB(0.3, 0.32, 0.35); c.metalness = Math.min(c.metalness, 0.6); }
      lighter.set(m, c);
    }
    return lighter.get(m);
  };
  const api = {
    get group() { return group; },
    get bench() { return onBench; },
    // Fetches the kit and puts everything up; resolves once it shows.
    build() {
      made ||= (async () => {
        const kit = await fitter.loadKit();
        BOARD.forEach(([name, k, how], i) => {
          const src = kit.getObjectByName(name);
          if (!src || !places.attachments[i]) return;
          const o = src.clone(true);
          o.traverse(c => { c.frustumCulled = true; if (c.isMesh) c.material = showroom(c.material); });
          o.position.set(0, 0, 0); o.scale.setScalar(k);
          if (how === 'up') o.rotation.z = Math.PI / 2;
          const at = B(...places.attachments[i]);
          // The board's face is 2 cm behind the outline's spot.
          hang(o, at, at.z - 0.02);
        });
        CAMOS.forEach((id, i) => {
          const pic = camoCanvas(id), at = places.camos[i];
          if (!pic || !at) return;
          const t = new THREE.CanvasTexture(pic);
          t.colorSpace = THREE.SRGBColorSpace;
          t.repeat.set(1, 0.85);
          const card = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.205), lit(new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1 })));
          card.position.copy(B(...at));
          group.add(card);
        });
        CHARMS.forEach((id, i) => {
          const c = makeCharm(id, 3.2), at = places.charms[i];
          if (!c || !at) return;
          c.root.traverse(o => { o.frustumCulled = true; });
          c.root.position.copy(B(...at));
          // Its face toward the room.
          c.root.rotation.y = Math.PI;
          group.add(c.root);
        });
        await prepare(renderer, stage, camera);
        group.visible = true;
      })();
      made.catch(e => { made = null; console.warn('[range] the loadout room\'s gunsmith pieces were not put up', e); });
      return made;
    },
    // The gun in the hand, as it is fitted, standing on the bench with its left side to the room.
    async showGun(g) {
      const job = ++benchJob;
      if (!g || !places.bench || low) return;
      const copy = g.model.clone(true), lights = [];
      // Its muzzle's glow stays behind: a light more in the room would change every shader there.
      copy.traverse(o => { if (o.isLight) lights.push(o); o.frustumCulled = true; });
      for (const o of lights) o.parent.remove(o);
      copy.rotation.set(0, Math.PI - 0.3, 0);
      copy.scale.setScalar(1.25);
      group.add(copy);
      copy.updateMatrixWorld(true);
      // Only what shows (the P-22's spare pieces and the magazine kept for dropping are hidden).
      box.makeEmpty();
      copy.traverseVisible(o => { if (o.isMesh) { o.geometry.boundingBox || o.geometry.computeBoundingBox(); box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); } });
      box.getCenter(mid);
      copy.visible = false;
      const top = B(...places.bench);
      copy.position.set(top.x - mid.x, top.y - box.min.y + 0.002, top.z - mid.z);
      await made;
      await prepare(renderer, stage, camera);
      if (job !== benchJob) { group.remove(copy); return; }
      if (onBench) group.remove(onBench);
      onBench = copy;
      copy.visible = true;
    },
  };
  return api;
}
