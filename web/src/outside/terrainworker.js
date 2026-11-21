// Works out the land's numbers off the page's thread: a change of quality used to build them on it, half a second on
// a slowed phone. The same code as on the page, so the land is the same.
import { terrainData } from '../pure/terrain.js';

onmessage = ({ data: { q } }) => {
  try {
    const d = terrainData(q);
    postMessage(d, [d.pos.buffer, d.kind.buffer, d.index.buffer, d.normal.buffer, d.sil.el.buffer, d.sil.dist.buffer, d.sil.tower.buffer]);
  } catch (e) {
    postMessage({ error: String(e?.message || e) });
  }
};
