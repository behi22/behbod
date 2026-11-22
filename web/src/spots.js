// More things to press E on, tap or click: the Shahnameh on the mezzanine's side table (it opens the reader), the five
// project frames up the stairs (each opens the projects at its own), the foot of the stairs (all the projects), and
// the game shelf by the TV (its covers).
import * as THREE from 'three';
import { b2t } from './engine.js';
import { makeGameShelf } from './gameshelf.js';
import { makeLookPanels } from './lookpanels.js';

// The book (mezz.py: 0.26 by 0.2 by 0.06 on the side table at 5.0, 2.6, turned 0.3) and where you stand to read it.
const BOOK = { at: [5.02, 2.7, 3.48], size: [0.3, 0.24, 0.1], turn: 0.3 };
const BOOK_SPOT = { id: 'shahnameh_book', label: 'Read the Shahnameh', at: [5.0, 2.05, 3.0], r: 0.45 };
// Each frame hangs 1.5 m over the step below it (gallery.py); you stand on that step, mid-stair.
const FRAME_HANG = 1.5, STAIR_MID = 0.75;
// The painting starts once the house has been up this long.
const SETTLE = 3000;

const item = o => ({ ...o, x: o.at[0], y: o.at[2], z: -o.at[1] });

export function makeSpots({ scene, meta, panels, desktop, adopt, renderer = null, coarse = false }) {
  const look = makeLookPanels(panels, { coarse });
  const names = meta.projects || [];
  const frames = names.map((project, i) => {
    const s = meta.screens?.[`proj${i}`];
    return s ? item({ id: `proj${i}`, project, label: `See ${project}`, at: [STAIR_MID, s.center[1], s.center[2] - FRAME_HANG], r: 0.38 }) : null;
  }).filter(Boolean);
  const frameMeshes = frames.map(f => scene.getObjectByName(`screen_${f.id}`)).filter(Boolean);
  const shelf = makeGameShelf(scene, { adopt, renderer });
  const book = item(BOOK_SPOT);
  // An unseen box round the book, only for clicks: the book itself is part of the room's baked mesh.
  const bookBox = new THREE.Mesh(new THREE.BoxGeometry(BOOK.size[0], BOOK.size[2], BOOK.size[1]), new THREE.MeshBasicMaterial());
  bookBox.position.copy(b2t(...BOOK.at));
  bookBox.rotation.y = BOOK.turn;
  bookBox.updateMatrixWorld(true);
  let firstTick = 0;
  const clear = (ray, h, blockers) => !!h && (!blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < h.distance - 0.05));

  return {
    items: [book, ...frames, shelf.spot],
    // Opens what an id belongs to; false for anything else.
    act(id) {
      if (id === book.id) { look.reader(desktop); return true; }
      const f = frames.find(x => x.id === id);
      if (f) { look.projects(names, f.project); return true; }
      if (id === 'projects') { look.projects(names); return true; }
      if (id === shelf.spot.id) { look.games(); return true; }
      return false;
    },
    // What a click lands on, unless something in `blockers` is in front of it.
    hit(ray, blockers) {
      if (clear(ray, ray.intersectObject(bookBox, false)[0], blockers)) return book;
      const h = ray.intersectObjects(frameMeshes, false)[0];
      if (clear(ray, h, blockers)) return frames.find(f => `screen_${f.id}` === h.object.name) || null;
      return shelf.hit(ray, blockers);
    },
    tick(day, player) {
      const now = performance.now();
      firstTick ||= now;
      shelf.tick(day, now - firstTick > SETTLE, player);
    },
  };
}
