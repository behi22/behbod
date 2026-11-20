import { buildPrint } from './pure/printbuild.js';
import { letterField, drawLetters } from './pure/keychain.js';
import { finish } from './pure/mesher.js';

const canDraw = (() => { try { return !!new OffscreenCanvas(1, 1).getContext('2d'); } catch { return false; } })();

self.onmessage = ({ data }) => {
  try {
    // Drawn here where a worker has a canvas; otherwise the page draws them and sends them on.
    let bitmap = data.bitmap;
    if (!bitmap && data.print.model === 'word') {
      if (!canDraw) { self.postMessage({ id: data.id, letters: true }); return; }
      bitmap = finish(drawLetters(data.print.text, (w, h) => new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })));
    }
    const field = bitmap ? finish(letterField(bitmap)) : null;
    const b = finish(buildPrint(data.print, { field, points: data.points }));
    self.postMessage({ id: data.id, b }, [b.pos.buffer, b.colour.buffer, b.uv.buffer, b.index.buffer, b.path.buffer]);
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e?.message || e) });
  }
};
