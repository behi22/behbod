import { MODELS, MODEL } from './pure/catalog.js';
import { COLOURS, SWATCHES, SHOWN, TOO_LONG, cleanText, describe, wordColour, parsePrint } from './pure/printer.js';

// The pictures are one sheet, fetched the first time the screen opens.
export const SHEET = { url: 'assets/printer/models.webp', cols: 6, tile: 128 };
// Its rules go in when this code arrives (in a quiet moment, or as you come near), not as the screen opens: new rules restyle the page.
export const CSS = `
.pn.pn-printer { place-items: stretch end; background: transparent; pointer-events: none; padding: 12px; }
.pn.pn-printer .pn-box { pointer-events: auto; width: min(392px, 100%); max-height: none; height: calc(100dvh - 24px); display: flex; flex-direction: column;
  padding: 14px 14px 12px; border-radius: 18px; background: linear-gradient(180deg, #141820, #0b0e14); border: 1px solid rgba(62,230,196,.22);
  box-shadow: 0 0 0 4px rgba(6,8,12,.85), 0 18px 50px rgba(0,0,0,.45); overflow: hidden; font: 400 13px/1.45 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; }
.pn-printer .pn-box h2 { margin-bottom: 8px; font-family: inherit; font-weight: 700; }
.ps-status { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); }
.ps-status .ps-pic { width: 44px; height: 44px; flex: none; }
.ps-status .ps-what { flex: 1; min-width: 0; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
.ps-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,.1); margin-top: 6px; overflow: hidden; }
.ps-bar i { display: block; height: 100%; width: 100%; background: #3ee6c4; border-radius: 2px; transform-origin: left center; transform: scaleX(0); transition: transform .25s linear; }
.ps-bar.ps-warm i { width: 30%; transform: none; animation: ps-warm 1.1s ease-in-out infinite alternate; background: #f2b630; }
@keyframes ps-warm { from { transform: translateX(0); } to { transform: translateX(233.33%); } }
.ps-label { font: 700 11px/1.2 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; letter-spacing: .12em; color: #8a93a6; margin: 12px 2px 6px; display: flex; justify-content: space-between; }
.ps-grid { flex: 1 1 auto; min-height: 96px; overflow-y: auto; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; align-content: start; padding: 2px; overscroll-behavior: contain; }
.pn-box .ps-tile { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px 5px; border-radius: 12px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.07);
  font: 400 10.5px/1.2 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #c9d1dd; white-space: normal; text-align: center; min-width: 0; }
.pn-box .ps-tile[aria-pressed="true"] { background: rgba(62,230,196,.12); border-color: #3ee6c4; color: #fff; }
.ps-tile .ps-pic { width: 100%; max-width: 72px; aspect-ratio: 1; }
.ps-pic { background-repeat: no-repeat; }
.ps-word { display: grid; place-items: center; font: 700 22px/1 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #3ee6c4; }
.ps-word::before { content: 'Aa'; }
.ps-swatches { display: grid; grid-template-columns: repeat(13, minmax(0, 1fr)); gap: 4px; }
.pn-box .ps-sw { width: 100%; max-width: 28px; aspect-ratio: 1; padding: 0; border-radius: 50%; border: 2px solid rgba(255,255,255,.18); justify-self: center; }
.pn-box .ps-sw[aria-pressed="true"] { border-color: #fff; box-shadow: 0 0 0 2px #3ee6c4; }
.ps-size { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 12px; color: #8a93a6; }
.ps-size input { flex: 1; accent-color: #3ee6c4; }
.ps-size output { width: 40px; text-align: right; color: #dfe5ee; font-variant-numeric: tabular-nums; }
.pn-box .ps-print { width: 100%; margin-top: 10px; padding: 11px 12px; border-radius: 12px; font: 700 14px/1.2 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #071512; background: #3ee6c4; border: none; }
.pn-box .ps-print:disabled { opacity: .5; }
.pn-box .ps-type { display: flex; gap: 6px; margin-top: 8px; }
.pn-printer .pn-box button, .pn-printer .pn-box input { font-family: inherit; }
.pn-box .ps-type input { margin: 0; flex: 1; min-width: 0; padding: 7px 10px; }
.pn-printer .pn-said { font-size: 12px; margin: 6px 2px 0; min-height: 1.3em; }
.pn-printer .dim { margin: 2px 2px 0; font-size: 11px; }
body[data-mode="printer"] .keys, body[data-mode="printer"] .joy, body[data-mode="printer"] .touch, body[data-mode="printer"] #who,
body[data-mode="printer"] #hood, body[data-mode="printer"] #closet { display: none; }
@media (max-width: 560px) and (orientation: portrait) {
  .pn.pn-printer { place-items: end stretch; padding: 8px; }
  .pn.pn-printer .pn-box { width: 100%; height: min(60dvh, 540px); padding: 12px 12px 10px; }
  .ps-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }
  .pn-box .ps-tile { font-size: 9.5px; padding: 5px 1px 4px; }
  .ps-label { margin: 9px 2px 5px; }
  .pn-printer .dim { display: none; }
}
@media (max-height: 500px) and (orientation: landscape) {
  .pn.pn-printer { padding: 6px; }
  .pn.pn-printer .pn-box { width: min(52vw, 440px); height: calc(100dvh - 12px); padding: 8px 10px; }
  .pn-printer .pn-box h2 { margin-bottom: 4px; }
  .ps-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
  .pn-box .ps-tile { font-size: 8.5px; padding: 3px 1px; }
  .ps-label, .pn-printer .dim { display: none; }
  .ps-status { padding: 4px 8px; }
  .ps-status .ps-pic { width: 28px; height: 28px; }
  .ps-swatches { margin-top: 6px; }
  .ps-size { margin-top: 4px; }
  .pn-box .ps-print { margin-top: 4px; padding: 8px; }
  .pn-box .ps-type { margin-top: 4px; }
  .pn-box .ps-type input { padding: 5px 8px; }
  .pn-printer .pn-said { margin-top: 2px; min-height: 0; }
}
`;
if (typeof document !== 'undefined' && !document.getElementById('ps-css')) document.head.append(Object.assign(document.createElement('style'), { id: 'ps-css', textContent: CSS }));
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
const index = Object.fromEntries(MODELS.map((m, i) => [m.id, i]));
function picture(id, node = el('span', { className: 'ps-pic' })) {
  node.className = 'ps-pic';
  node.style.cssText = '';
  if (id === 'word' || !(id in index)) { node.classList.add('ps-word'); return node; }
  const rows = Math.ceil(MODELS.length / SHEET.cols), i = index[id];
  node.style.backgroundImage = `url(${SHEET.url})`;
  node.style.backgroundSize = `${SHEET.cols * 100}% ${rows * 100}%`;
  node.style.backgroundPosition = `${((i % SHEET.cols) / (SHEET.cols - 1)) * 100}% ${(Math.floor(i / SHEET.cols) / Math.max(1, rows - 1)) * 100}%`;
  return node;
}
const plainColour = c => (c === 'gray' ? 'grey' : c);

export function printScreen(pr, { touch = false } = {}) {
  const now = pr.print;
  const pick = { model: now.model, text: now.model === 'word' ? now.text : '', colour: plainColour(now.colour), size: Math.round(now.size * 100) };
  let colourChosen = false, said = '';

  const pic = picture(now.model), what = el('div'), bar = el('div', { className: 'ps-bar' }, el('i'));
  const status = el('div', { className: 'ps-status' }, pic, el('div', { className: 'ps-what' }, what, bar));
  const tiles = new Map();
  const tile = id => {
    const b = el('button', { type: 'button', className: 'ps-tile' }, id === 'word' ? el('span', { className: 'ps-pic ps-word' }) : picture(id), el('span', { textContent: id === 'word' ? 'Your word' : MODEL[id].name }));
    b.addEventListener('click', () => choose(id));
    tiles.set(id, b);
    return b;
  };
  // A few tiles a frame, so opening the screen never holds one up.
  const grid = el('div', { className: 'ps-grid' }), queue = [...SHOWN, 'word'];
  let filling = 0;
  const fill = () => { filling = 0; grid.append(...queue.splice(0, 10).map(tile)); show(); if (queue.length) filling = requestAnimationFrame(fill); };
  const swatches = new Map();
  const sw = el('div', { className: 'ps-swatches' }, ...SWATCHES.map(c => {
    const b = el('button', { type: 'button', className: 'ps-sw', ariaLabel: c, title: c });
    b.style.background = COLOURS[c];
    b.addEventListener('click', () => { pick.colour = c; colourChosen = true; show(); });
    swatches.set(c, b);
    return b;
  }));
  const size = el('input', { type: 'range', min: 50, max: 150, step: 5, value: pick.size, ariaLabel: 'Size' }), out = el('output', { textContent: `${pick.size}%` });
  size.addEventListener('input', () => { pick.size = +size.value; out.textContent = `${pick.size}%`; show(); });
  const go = el('button', { type: 'button', className: 'ps-print' });
  const box = el('input', { maxLength: 60, placeholder: 'Or type: any word, taller, twist, red', ariaLabel: 'Type to the printer', enterKeyHint: 'go', autocomplete: 'off', spellcheck: false });
  const form = el('form', { className: 'ps-type' }, box, el('button', { type: 'submit', textContent: 'Go' }));
  const line = el('p', { className: 'pn-said', role: 'status' });
  const tip = el('p', { className: 'dim', textContent: 'At the desk you can type it too: print rocket taller red' });

  function choose(id) {
    pick.model = id;
    if (id === 'word') {
      if (!pick.text) pick.text = cleanText(box.value);
      if (!colourChosen && pick.text) pick.colour = wordColour(pick.text);
      if (!pick.text) { said = 'Type the words for your keychain below.'; box.focus(); } else if (box.value.trim() && !pr.fits(box.value)) said = TOO_LONG;
    } else if (!colourChosen) pick.colour = MODEL[id].colour;
    show();
  }
  function print() {
    if (pick.model === 'word') {
      const typed = box.value.trim() ? box.value : pick.text, t = cleanText(typed);
      if (!t) { said = 'Type the words for your keychain first.'; box.focus(); show(); return; }
      // Words that would print too small to read stay in the box, with the reason under the button.
      if (!pr.fits(typed)) { said = TOO_LONG; show(); return; }
      pick.text = t;
    }
    said = pr.start({ model: pick.model, text: pick.text, colour: pick.colour, size: pick.size / 100 }) || 'That one would not print.';
    box.value = '';
    show(); tick();
  }
  go.addEventListener('click', print);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = box.value.trim();
    if (!t) return;
    // Typed words work as at the terminal; with "Your word" picked they are the keychain's, unless they only adjust the one on the bed.
    const now = pr.print, r = parsePrint(t, now);
    if (pick.model === 'word' && !(now.model === 'word' && r?.p.model === 'word' && r.p.text === now.text)) { print(); return; }
    const answer = pr.ask(t);
    said = answer || 'Nothing to print there. Try a model, or any word at all.';
    if (answer !== TOO_LONG) box.value = '';
    const p = pr.print;
    Object.assign(pick, { model: p.model, text: p.model === 'word' ? p.text : '', colour: plainColour(p.colour), size: Math.round(p.size * 100) });
    size.value = pick.size; out.textContent = `${pick.size}%`;
    show(); tick();
  });
  box.addEventListener('input', () => {
    if (pick.model !== 'word') return;
    pick.text = cleanText(box.value);
    if (!colourChosen && pick.text) pick.colour = wordColour(pick.text);
    // Said as soon as the words get too long, and taken back once they fit again.
    if (pick.text && !pr.fits(box.value)) said = TOO_LONG; else if (said === TOO_LONG) said = '';
    show();
  });

  function show() {
    for (const [id, b] of tiles) b.setAttribute('aria-pressed', String(id === pick.model));
    for (const [c, b] of swatches) b.setAttribute('aria-pressed', String(c === pick.colour));
    const q = { model: pick.model, text: pick.text || '...', colour: pick.colour };
    go.textContent = pick.model === 'word' && !pick.text ? 'Print a keychain' : `Print ${describe(q).replace(/ that says .*/, '')}`;
    line.textContent = said;
  }
  let shown = null, failed = false;
  function tick() {
    const p = pr.print, k = pr.progress, d = describe(p);
    if (p.model !== shown) { shown = p.model; picture(p.model, pic); }
    // The line under the button said it was printing; once it could not, only the status says so.
    if (pr.failed !== failed) { failed = pr.failed; if (failed) { said = ''; show(); } }
    // The bar moves by transform only, so a slow phone's page is not laid out again every frame while it prints.
    bar.classList.toggle('ps-warm', pr.mine && pr.heating);
    bar.firstChild.style.transform = pr.mine && pr.heating ? '' : `scaleX(${Math.round(k * 100) / 100})`;
    const text = pr.failed ? 'That one could not be printed. Press Print to try again, or pick another.'
      : !pr.mine ? `On the bed: ${d}, part way through. Pick one to print your own.`
        : pr.heating ? `Warming up the nozzle for ${d}.`
          : k < 1 ? `Printing ${d}: ${Math.round(k * 100)}%` : `Done: ${d}.`;
    if (what.textContent !== text) what.textContent = text;
  }
  show(); tick();
  filling = requestAnimationFrame(fill);
  const clock = setInterval(tick, 250);
  // A moment's wait, so the E that opened the screen is not typed into it.
  if (!touch) setTimeout(() => box.isConnected && box.focus({ preventScroll: true }), 80);
  return {
    nodes: [status, el('div', { className: 'ps-label' }, el('span', { textContent: 'PICK A MODEL' })), grid,
      el('div', { className: 'ps-label' }, el('span', { textContent: 'COLOUR' })), sw,
      el('label', { className: 'ps-size' }, el('span', { textContent: 'Size' }), size, out), go, form, line, tip],
    stop: () => { clearInterval(clock); cancelAnimationFrame(filling); },
  };
}
