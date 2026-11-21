// Panels over the room for things you look at: the Shahnameh reader (the computer's reader app, from the book on the
// mezzanine) and the projects (the computer's Projects app, from the frames up the stairs). Each opens through the
// house's own panel, so Esc, Close and a click outside put you back where you stood.
import { STORIES, storyById } from './pure/shahnameh.js';
import { PROJECTS, GITHUB } from './pure/desktop.js';
import { paintStory } from './shah/scenes.js';

const CSS = `
.pn.pn-wide .pn-box { width: min(880px, 100%); }
.pn.pn-wide .pn-box > h2, .pn.pn-look .pn-box > h2 { position: sticky; top: -18px; z-index: 1; margin: -18px -20px 10px; padding: 18px 20px 10px; background: #0c0f16; }
.lp-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 2px 0 14px; }
.pn-box .lp-tabs button.on { color: #05070b; background: #3ee6c4; border-color: #3ee6c4; }
.lp-story { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 20px; align-items: start; }
.lp-pic { display: block; width: 100%; aspect-ratio: 1; border-radius: 10px; background: #1a1410; }
.lp-text h3 { margin: 0 0 8px; font: 600 18px/1.35 Georgia, 'Times New Roman', serif; color: #ffd9a0; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; align-items: baseline; }
.lp-fa { font: 500 20px/1.9 'Noto Nastaliq Urdu', serif; color: #e8c98a; }
.lp-text p { margin: 0 0 10px; font: 400 15px/1.6 Georgia, 'Times New Roman', serif; color: #e8e1d4; }
.lp-projects li { padding: 10px 12px; border-radius: 10px; border-top: 0; margin-top: 6px; background: rgba(255,255,255,.03); }
.lp-projects li.lp-on { background: rgba(62,230,196,.08); box-shadow: inset 3px 0 0 #3ee6c4; }
.lp-line { display: block; color: #aeb7c6; margin: 2px 0 8px; }
.lp-links { display: flex; gap: 8px; flex-wrap: wrap; }
.pn-box .lp-links a { font: 500 12px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #e8edf5; text-decoration: none; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: 6px 12px; }
.pn-box .lp-links a:hover, .pn-box .lp-links a:focus-visible { border-color: #3ee6c4; color: #3ee6c4; }
@media (max-width: 640px) {
  .lp-story { grid-template-columns: 1fr; gap: 14px; }
}
`;
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
function style() {
  if (document.getElementById('lp-css')) return;
  document.head.append(el('style', { id: 'lp-css', textContent: CSS }));
}
// A canvas sized to where it sits, painted once the panel has laid it out; kept, so opening again costs nothing.
function painted(cache, key, label, cls) {
  let c = cache.get(key);
  if (!c) { c = el('canvas', { className: cls }); c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); cache.set(key, c); }
  return c;
}
function fill(c, paint) {
  const w = c.clientWidth, h = c.clientHeight, k = Math.min(2, devicePixelRatio || 1), at = `${w}x${h}@${k}`;
  if (!w || !h || c.dataset.at === at) return false;
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d');
  g.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
  paint(g, w, h);
  c.dataset.at = at;
  return true;
}

export function makeLookPanels(panels, { coarse = false } = {}) {
  const pictures = new Map();
  return {
    // The Shahnameh: the reader app's four stories. Picking one here picks it on the computer too.
    reader(desktop) {
      style();
      let at = storyById(desktop?.reader?.story)?.id || STORIES[0].id;
      panels.show('SHAHNAMEH', render => {
        const story = storyById(at);
        const tabs = el('div', { className: 'lp-tabs' }, ...STORIES.map(s => {
          const b = el('button', { type: 'button', textContent: s.tab, className: s.id === at ? 'on' : '' });
          b.setAttribute('aria-pressed', String(s.id === at));
          b.addEventListener('click', () => { if (s.id === at) return; at = s.id; desktop?.readerGo(`read:${s.id}`); render(); });
          return b;
        }));
        tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Stories');
        const pic = painted(pictures, story.id, story.pic, 'lp-pic');
        requestAnimationFrame(() => fill(pic, (g, w, h) => paintStory(g, story.id, w, h)));
        const title = el('h3', {}, el('span', { textContent: story.title }), el('span', { className: 'lp-fa', lang: 'fa', dir: 'rtl', textContent: story.fa }));
        return [tabs, el('div', { className: 'lp-story' }, pic, el('div', { className: 'lp-text' }, title, ...story.text.map(p => el('p', { textContent: p }))))];
      }, 'wide');
    },
    // The projects: the computer's Projects app, the one you came from marked. Links open in a new tab.
    projects(names, focus = null) {
      style();
      panels.show('PROJECTS', () => {
        const link = (text, href, label) => { const a = el('a', { href, target: '_blank', rel: 'noopener noreferrer', textContent: text }); a.setAttribute('aria-label', label); return a; };
        const list = el('ul', { className: 'pn-list lp-projects' }, ...names.filter(n => Object.hasOwn(PROJECTS, n)).map(n => {
          const info = PROJECTS[n], label = info.siteLabel || 'Open';
          const links = [...(info.site ? [link(label, info.site, `${label} ${n}`)] : []), link('Code', `${GITHUB}/${n}`, `The code of ${n}, on GitHub`)];
          return el('li', { className: n === focus ? 'lp-on' : '' }, el('b', { textContent: n }), el('span', { className: 'lp-line', textContent: info.line }), el('div', { className: 'lp-links' }, ...links));
        }));
        requestAnimationFrame(() => {
          const on = list.querySelector('.lp-on');
          on?.scrollIntoView({ block: 'nearest' });
          if (on && !coarse) on.querySelector('a')?.focus({ preventScroll: true });
        });
        return [el('p', { className: 'dim', textContent: 'Each link opens in a new tab.' }), list];
      }, 'look');
    },
  };
}
