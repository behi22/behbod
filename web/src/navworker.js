// Plans walking paths off the main thread, so a long search (up to several milliseconds, more on a slow laptop) never
// costs a frame. Two grids: the bookcase shut and open; the balcony slider is always treated as open.
import { makeNav } from './pure/nav.js';

let navs = null;
onmessage = e => {
  const m = e.data;
  if (m.type === 'init') {
    navs = {
      shut: makeNav(m.meta, { off: n => n === 'slider_slide' }),
      open: makeNav(m.meta, { off: n => n === 'slider_slide' || n === 'secret_door' }),
    };
  } else if (m.type === 'path') {
    postMessage({ id: m.id, path: navs ? navs[m.which].path(m.from, m.to) : null });
  }
};
