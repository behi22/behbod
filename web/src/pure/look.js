// The wardrobe: what the character can wear, the defaults he picked, and a check that any saved look is valid (it
// comes back from the visitor's own storage, so it is never trusted as is).
export const HEADS = ['hood', 'tv', 'visor', 'emoji', 'mosaic'];
export const HEAD_NAMES = { hood: 'Hood', tv: 'TV', visor: 'Visor', emoji: 'Emoji', mosaic: 'The real you' };
// The hood head lives under its hood and the real you hides behind the mosaic; the screen heads go hood down.
export const DEFAULT_HOOD = { hood: true, tv: false, visor: false, emoji: false, mosaic: true };
export const FITS = { hoodie: { boxy: '', short: '_short', relaxed: '_relaxed' }, pants: { straight: '', tapered: '_tapered' } };
export const ACCESSORIES = ['headphones', 'watch', 'backpack'];
export const PALETTE = ['#1f2a44', '#141518', '#eceae4', '#2b2f3a', '#7b2ff7', '#3ee6c4', '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad',
  '#d35400', '#7f8c8d', '#bdc3c7', '#ffffff', '#5d4037', '#ff6b81', '#00b894', '#0a3d62'];
// Colourways you earn at the range.
export const OUTFITS = {
  kit: { label: 'BEHI 22 keeper kit', colours: { hoodie: '#111114', pants: '#111114', shoes: '#f2f2f2' }, rib: '#7b2ff7' },
  gold: { label: 'Gold', colours: { hoodie: '#c9a227', pants: '#2b2b2b', shoes: '#c9a227' }, rib: '#8a6d12' },
};
export const DEFAULT_LOOK = { head: 'hood', hood: null, fit: { hoodie: 'relaxed', pants: 'tapered' }, acc: [], colours: { hoodie: '#1f2a44', pants: '#141518', shoes: '#eceae4' }, outfit: null, visor: 'teal' };

const HEX = /^#[0-9a-f]{6}$/i;

export function sanitizeLook(raw, { unlocked = [], mosaic = false } = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const look = structuredClone(DEFAULT_LOOK);
  if (HEADS.includes(r.head) && (r.head !== 'mosaic' || mosaic)) look.head = r.head;
  if (typeof r.hood === 'boolean') look.hood = r.hood;
  for (const part of Object.keys(FITS)) if (r.fit && Object.hasOwn(FITS[part], r.fit[part])) look.fit[part] = r.fit[part];
  if (Array.isArray(r.acc)) look.acc = [...new Set(r.acc.filter(a => ACCESSORIES.includes(a)))];
  for (const part of Object.keys(look.colours)) if (r.colours && HEX.test(r.colours[part] || '')) look.colours[part] = r.colours[part].toLowerCase();
  if (Object.hasOwn(OUTFITS, r.outfit) && unlocked.includes(r.outfit)) look.outfit = r.outfit;
  if (r.visor === 'red' && unlocked.includes('visor')) look.visor = 'red';
  return look;
}

export const hoodUp = look => (look.hood === null ? DEFAULT_HOOD[look.head] : look.hood);

// The colours actually worn: an earned colourway wins over the chosen colours.
export function wornColours(look) {
  const o = look.outfit && OUTFITS[look.outfit];
  return o ? { ...o.colours, rib: o.rib } : { ...look.colours, rib: look.colours.hoodie };
}
