// In desktop pixels so the monitor and the seated view draw it alike; `scroll` (a phone) keeps the story in one piece.
import { TITLE, STYLE, textWidth, fit, wrap } from './desktop.js';
import { STORIES, storyById } from './shahnameh.js';

export const newReader = () => ({ story: STORIES[0].id, page: 0 });
const PILL_H = 30, PILL_PAD = 12, LH = 22, PGAP = 9, PAD = 18, PX = STYLE.small;
const pillW = label => textWidth(label, STYLE.small) + 2 * PILL_PAD;
const text = (s, x, y, px, c, b = 400) => ({ s, x, y, px, c, b });

// The buttons: `read:<id>` picks a story, `page:next` and `page:back` turn its pages.
export function readerGo(st, act) {
  const [kind, arg] = act.split(':');
  if (kind === 'read' && storyById(arg)) { const changed = st.story !== arg || st.page !== 0; st.story = arg; st.page = 0; return changed; }
  if (kind === 'page' && (arg === 'next' || arg === 'back')) { const was = st.page; st.page = Math.max(0, st.page + (arg === 'next' ? 1 : -1)); return st.page !== was; }
  return false;
}

export function readerLayout(w, st, { scroll = false } = {}) {
  const texts = [], pills = [], story = storyById(st.story) || STORIES[0];
  const x0 = w.x + PAD, right = w.x + w.w - PAD, top = w.y + TITLE + 10;
  // The tabs, running on to a second row in a narrow window.
  let px = x0, py = top;
  for (const s of STORIES) {
    const pw = pillW(s.tab);
    if (px > x0 && px + pw > right) { px = x0; py += PILL_H + 8; }
    pills.push({ label: s.tab, act: `read:${s.id}`, on: s.id === story.id, x: px, y: py, w: pw, h: PILL_H });
    px += pw + 8;
  }
  const body = py + PILL_H + 14, side = w.w >= 760;
  // The picture: beside the story in a wide window, over it in a narrow one.
  const pic = side
    ? { x: x0, y: body, w: Math.round(Math.min(420, (w.w - 2 * PAD) * 0.38)), h: Math.max(120, w.y + w.h - PAD - body) }
    : { x: x0, y: body, w: right - x0, h: Math.round(Math.min(260, Math.max(140, (right - x0) * 0.5))) };
  if (scroll && side) pic.h = Math.min(pic.h, 420);
  const tx = side ? pic.x + pic.w + 24 : x0, ty = side ? body : pic.y + pic.h + 18, tw = right - tx;
  texts.push(text(fit(story.title, STYLE.text, tw), tx, ty + 19, STYLE.text, 'warm', 700));
  const cols = Math.max(12, Math.floor(tw / (PX * 0.6)));
  const lines = story.text.flatMap((p, i) => wrap(p, cols).map((s, k) => ({ s, gap: i > 0 && k === 0 })));
  // Pages: as many lines as fit above the row of page buttons.
  const start = ty + 19 + 16 + LH, stop = scroll ? Infinity : w.y + w.h - PAD - PILL_H - 10;
  const pages = [];
  let y = start, page = [];
  for (const l of lines) {
    const dy = (l.gap && page.length ? PGAP : 0);
    if (page.length && y + dy > stop) { pages.push(page); page = []; y = start; }
    y += page.length ? dy : 0;
    page.push({ s: l.s, y });
    y += LH;
  }
  pages.push(page);
  const at = Math.min(st.page, pages.length - 1);
  for (const l of pages[at]) texts.push(text(l.s, tx, l.y, PX, 'ink'));
  let bottom = pages[at].at(-1).y + 10;
  if (pages.length > 1) {
    const by = w.y + w.h - PAD - PILL_H, next = { label: 'Next', act: 'page:next', on: false, w: pillW('Next'), h: PILL_H, y: by };
    next.x = right - next.w;
    const back = { label: 'Back', act: 'page:back', on: false, w: pillW('Back'), h: PILL_H, y: by, x: next.x - 8 - pillW('Back') };
    if (at > 0) pills.push(back);
    if (at < pages.length - 1) pills.push(next);
    const n = `page ${at + 1} of ${pages.length}`;
    texts.push(text(n, tx, by + PILL_H / 2 + 5, PX, 'dim'));
    bottom = by + PILL_H;
  }
  return { texts, pills, pic, story: story.id, page: at, pages: pages.length, bottom: Math.max(bottom, pic.y + pic.h) };
}
