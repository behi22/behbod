import * as THREE from 'three';
import { PLACES, makeSayer } from '../pure/persia.js';
import { makeSimorgh } from './simorgh.js';
import { makeShelf } from './relics.js';
import { makeMiniature } from './miniature.js';
export { addPersia, feastAt } from '../pure/persia.js';

// The Shahnameh and ancient Persia through the house: the Simorgh over the stairs, the Cyrus Cylinder and a Persepolis
// bookend in the library, the miniature on the mezzanine, and on their days the haft-sin or the Yalda table in the
// lounge (its code is fetched only then). `day` is the daylight outside, 0 to 1, which the baked room follows too.
export function makePersia(scene, { feast = null, day = () => 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'persia';
  scene.add(group);
  const simorgh = makeSimorgh(PLACES.simorgh), shelf = makeShelf(PLACES.shelf), mini = makeMiniature(PLACES.miniature);
  group.add(simorgh.group, shelf.group, mini.group);
  let dayK = -1;
  // The painting is drawn when the page has a quiet moment, soon after the house is up.
  const later = typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: 2500 }) : f => setTimeout(f, 1200);
  later(() => mini.paint());
  // Everything carrying its own light brightens a little by day, as the baked room does.
  const mats = new Set(), lit = g => g.traverse(o => { if (o.material?.vertexColors) mats.add(o.material); });
  lit(group);
  let table = null;
  const tableReady = feast
    ? import('./feasts.js').then(m => { table = m.makeFeast(feast, PLACES.table); if (table) { group.add(table.group); lit(table.group); dayK = -1; } return table; })
      .catch(e => { console.warn('[loft] the holiday table could not be set', e); return null; })
    : Promise.resolve(null);
  const say = makeSayer();
  return {
    group, feast, simorgh, shelf, mini, tableReady,
    get table() { return table; },
    poke: id => say(id),
    tick(dt, t) {
      const k = day();
      if (Math.abs(k - dayK) >= 0.02) { dayK = k; for (const m of mats) m.color.setRGB(1 + 0.12 * k, 1 + 0.12 * k, 1 + 0.18 * k); }
      table?.tick(dt, t);
    },
  };
}
