import { HEADS, HEAD_NAMES, FITS, ACCESSORIES, PALETTE, OUTFITS, hoodUp } from './pure/look.js';

const CSS = `
.wd { position: fixed; right: calc(16px + env(safe-area-inset-right, 0px)); top: calc(64px + env(safe-area-inset-top, 0px)); width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 96px); overflow: auto;
  background: rgba(8, 12, 18, .92); border: 1px solid rgba(62, 230, 196, .35); border-radius: 10px; padding: 14px; z-index: 7; color: #e8edf5; font: 12px 'JetBrains Mono', ui-monospace, monospace; }
.wd h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: .12em; color: #3ee6c4; display: flex; justify-content: space-between; align-items: center; }
.wd h3 { margin: 12px 0 6px; font-size: 11px; color: #8a93a6; font-weight: 400; letter-spacing: .08em; text-transform: uppercase; }
.wd .row { display: flex; flex-wrap: wrap; gap: 6px; }
.wd button { font: inherit; color: #e8edf5; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 5px 10px; cursor: pointer; }
.wd button[aria-pressed="true"] { border-color: #3ee6c4; color: #3ee6c4; }
.wd button:disabled { opacity: .35; cursor: default; }
.wd .sw { width: 22px; height: 22px; padding: 0; border-radius: 50%; }
.wd .sw[aria-pressed="true"] { outline: 2px solid #3ee6c4; outline-offset: 2px; }
.wd input[type=color] { width: 30px; height: 24px; border: 0; background: none; padding: 0; cursor: pointer; }
.wd .note { color: #8a93a6; margin: 6px 0 0; }
`;

// The wardrobe panel: heads, the hood, fits, colours, accessories and the looks you earn. Changes apply as you click.
export function makeWardrobe(me, { unlocked, onClose }) {
  if (!document.getElementById('wd-css')) { const st = document.createElement('style'); st.id = 'wd-css'; st.textContent = CSS; document.head.append(st); }
  let el = null;
  const btn = (label, pressed, on, extra = {}) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(pressed));
    Object.assign(b, extra);
    b.addEventListener('click', () => { on(); render(); });
    return b;
  };
  const section = (title, children, note) => {
    const h = document.createElement('h3'); h.textContent = title;
    const row = document.createElement('div'); row.className = 'row'; row.append(...children);
    const out = [h, row];
    if (note) { const p = document.createElement('p'); p.className = 'note'; p.textContent = note; out.push(p); }
    return out;
  };
  function swatches(part) {
    const look = me.look, items = PALETTE.map(hex => {
      const b = btn('', look.colours[part] === hex, () => me.setLook({ colours: { [part]: hex }, outfit: null }), { className: 'sw', title: hex, ariaLabel: `${part} colour ${hex}` });
      b.style.background = hex;
      return b;
    });
    const pick = document.createElement('input');
    pick.type = 'color'; pick.value = look.colours[part]; pick.ariaLabel = `any ${part} colour`;
    pick.addEventListener('input', () => me.setLook({ colours: { [part]: pick.value }, outfit: null }));
    return [...items, pick];
  }
  function render() {
    if (!el) return;
    const look = me.look, got = unlocked();
    el.replaceChildren();
    const h2 = document.createElement('h2'); h2.textContent = 'WARDROBE';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', hide);
    h2.append(close);
    el.append(h2,
      ...section('Head', HEADS.filter(h => h !== 'mosaic' || me.mosaicUnlocked).map(h => btn(HEAD_NAMES[h], look.head === h, () => me.setLook({ head: h, hood: null })))),
      ...section('Hood', [btn('Up', hoodUp(look), () => me.setLook({ hood: true })), btn('Down', !hoodUp(look), () => me.setLook({ hood: false }))], 'G flips it any time.'),
      ...section('Hoodie fit', Object.keys(FITS.hoodie).map(f => btn(f, look.fit.hoodie === f, () => me.setLook({ fit: { hoodie: f } })))),
      ...section('Cargos', Object.keys(FITS.pants).map(f => btn(f, look.fit.pants === f, () => me.setLook({ fit: { pants: f } })))),
      ...section('Hoodie colour', swatches('hoodie')),
      ...section('Cargo colour', swatches('pants')),
      ...section('Shoe colour', swatches('shoes')),
      ...section('Accessories', ACCESSORIES.map(a => btn(a, look.acc.includes(a), () => me.setLook({ acc: look.acc.includes(a) ? look.acc.filter(x => x !== a) : [...look.acc, a] })))),
      ...section('Earned', [
        ...Object.entries(OUTFITS).map(([id, o]) => btn(o.label, look.outfit === id, () => me.setLook({ outfit: look.outfit === id ? null : id }), { disabled: !got.includes(id) })),
        btn('Red visor', look.visor === 'red', () => me.setLook({ visor: look.visor === 'red' ? 'teal' : 'red' }), { disabled: !got.includes('visor') }),
      ], got.length ? '' : 'Win these with a top score at the holo range.'));
  }
  function show() {
    if (el) return;
    el = document.createElement('div'); el.className = 'wd'; el.setAttribute('role', 'dialog'); el.ariaLabel = 'Wardrobe';
    document.body.append(el);
    render();
  }
  function hide() { el?.remove(); el = null; onClose?.(); }
  return { show, hide, toggle() { el ? hide() : show(); }, get open() { return !!el; }, render };
}
