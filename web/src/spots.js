// More things to press E on, tap or click: the Shahnameh on the mezzanine's side table, which opens the reader.
import * as THREE from 'three';
import { b2t } from './engine.js';
import { makeLookPanels } from './lookpanels.js';

// The book (mezz.py: 0.26 by 0.2 by 0.06 on the side table at 5.0, 2.6, turned 0.3) and where you stand to read it.
const BOOK = { at: [5.02, 2.7, 3.48], size: [0.3, 0.24, 0.1], turn: 0.3 };
const BOOK_SPOT = { id: 'shahnameh_book', label: 'Read the Shahnameh', at: [5.0, 2.05, 3.0], r: 0.45 };

const item = o => ({ ...o, x: o.at[0], y: o.at[2], z: -o.at[1] });

export function makeSpots({ panels, desktop }) {
  const look = makeLookPanels(panels);
  const book = item(BOOK_SPOT);
  // An unseen box round the book, only for clicks: the book itself is part of the room's baked mesh.
  const bookBox = new THREE.Mesh(new THREE.BoxGeometry(BOOK.size[0], BOOK.size[2], BOOK.size[1]), new THREE.MeshBasicMaterial());
  bookBox.position.copy(b2t(...BOOK.at));
  bookBox.rotation.y = BOOK.turn;
  bookBox.updateMatrixWorld(true);
  const clear = (ray, h, blockers) => !!h && (!blockers || !(ray.intersectObjects(blockers, true)[0]?.distance < h.distance - 0.05));

  return {
    items: [book],
    // Opens what an id belongs to; false for anything else.
    act(id) {
      if (id === book.id) { look.reader(desktop); return true; }
      return false;
    },
    // What a click lands on, unless something in `blockers` is in front of it.
    hit(ray, blockers) {
      return clear(ray, ray.intersectObject(bookBox, false)[0], blockers) ? book : null;
    },
  };
}
