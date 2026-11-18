import * as THREE from 'three';
import { PLACES, makeSayer } from '../pure/persia.js';
import { makeSimorgh } from './simorgh.js';
export { addPersia } from '../pure/persia.js';

// The Shahnameh and ancient Persia through the house: the Simorgh over the stairs. `day` is the daylight outside, 0 to 1,
// which the baked room follows too.
export function makePersia(scene, { day = () => 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'persia';
  scene.add(group);
  const simorgh = makeSimorgh(PLACES.simorgh);
  group.add(simorgh.group);
  let dayK = -1;
  // Everything carrying its own light brightens a little by day, as the baked room does.
  const mats = new Set(), lit = g => g.traverse(o => { if (o.material?.vertexColors) mats.add(o.material); });
  lit(group);
  const say = makeSayer();
  return {
    group, simorgh,
    poke: id => say(id),
    tick() {
      const k = day();
      if (Math.abs(k - dayK) >= 0.02) { dayK = k; for (const m of mats) m.color.setRGB(1 + 0.12 * k, 1 + 0.12 * k, 1 + 0.18 * k); }
    },
  };
}
