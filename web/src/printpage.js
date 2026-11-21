// A print built on the page, for a browser whose workers cannot build it: fetched only then, and run a slice of a frame at a time.
import { buildPrint } from './pure/printbuild.js';
import { drawLetters, letterField } from './pure/keychain.js';

let cv = null;
// The keychain's words drawn here, also for a worker without a canvas of its own.
export function letters(text, due) {
  return drawLetters(text, (w, h) => {
    cv ||= document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv.getContext('2d', { willReadFrequently: true });
  }, due);
}
export function* onPage(print, points, due) {
  const field = print.model === 'word' ? yield* letterField(yield* letters(print.text, due), due) : null;
  return yield* buildPrint(print, { field, points, due });
}
