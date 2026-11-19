// BEHI FC's kits for the TV match and Striker 22; the first is the one the games always had.
export const KITS = [
  { id: 'home', name: 'White and purple', shirt: '#f3f4f8', shade: '#c9cbd6', trim: '#7d4fe0', shorts: '#e3e4ec', socks: '#f3f4f8', keeper: '#7d4fe0', keeperTrim: '#f3f4f8', ink: '#2b2140', badge: '#7d4fe0' },
  { id: 'black', name: 'Black and gold', shirt: '#131318', shade: '#0a0a0e', trim: '#d9b45a', shorts: '#0e0e12', socks: '#131318', keeper: '#d9b45a', keeperTrim: '#131318', ink: '#d9b45a', badge: '#d9b45a' },
  { id: 'purple', name: 'Purple', shirt: '#6b45d8', shade: '#5234ab', trim: '#f3f4f8', shorts: '#4f33a8', socks: '#6b45d8', keeper: '#3ee6c4', keeperTrim: '#0f2a26', ink: '#f3f4f8', badge: '#6b45d8' },
  { id: 'teal', name: 'Teal', shirt: '#2fc9ac', shade: '#23a088', trim: '#0f1f2a', shorts: '#0f1f2a', socks: '#2fc9ac', keeper: '#f3f4f8', keeperTrim: '#2fc9ac', ink: '#0f1f2a', badge: '#2fc9ac' },
  { id: 'sky', name: 'Sky blue', shirt: '#7cc4ff', shade: '#5fa4dc', trim: '#0d2a4a', shorts: '#f3f4f8', socks: '#7cc4ff', keeper: '#ff5fa2', keeperTrim: '#0d2a4a', ink: '#0d2a4a', badge: '#7cc4ff' },
  { id: 'red', name: 'Red', shirt: '#d7263d', shade: '#ad1c30', trim: '#f3f4f8', shorts: '#f3f4f8', socks: '#d7263d', keeper: '#f3f4f8', keeperTrim: '#d7263d', ink: '#f3f4f8', badge: '#d7263d' },
];
export const BOTS = {
  dark: { shirt: '#1f2533', shade: '#141923', trim: '#ff8a3d', shorts: '#161b26', socks: '#ff8a3d', keeper: '#ff8a3d', keeperShade: '#d96c25', keeperTrim: '#1b1f29', ink: '#ffd7bd', badge: '#ff8a3d' },
  light: { shirt: '#e9ecf2', shade: '#c3c8d2', trim: '#ff8a3d', shorts: '#c9ced8', socks: '#ff8a3d', keeper: '#ff8a3d', keeperShade: '#d96c25', keeperTrim: '#1b1f29', ink: '#c2571a', badge: '#ff8a3d' },
};
// The TV match's grass and Striker 22's two stripes.
export const PITCHES = ['#2b7a39', '#124331', '#0f3a2b'];

export const kitById = id => KITS.find(k => k.id === id) || KITS[0];

// CIE76 distance, as the eye sees it: about 25 and up reads as clearly different, under 10 as the same colour.
export function lab(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const lin = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(lin);
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function deltaE(a, b) {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// The bots wear whichever of their kits stands furthest from yours, shirts and keepers alike.
export function teams(id) {
  const you = kitById(id);
  const gap = bots => Math.min(...[you.shirt, you.keeper].flatMap(a => [bots.shirt, bots.keeper].map(b => deltaE(a, b))));
  return { you, bots: gap(BOTS.light) > gap(BOTS.dark) ? BOTS.light : BOTS.dark };
}

// Made once per kit, since the room's TV asks on every repaint.
const sides = new Map();
export function matchKits(id) {
  const key = kitById(id).id;
  if (sides.has(key)) return sides.get(key);
  const { you, bots } = teams(key);
  const side = (k, name, short) => ({ name, short, shirt: k.shirt, trim: k.trim, shorts: k.shorts, keeper: k.keeper, keeperTrim: k.keeperTrim, ink: k.ink, badge: k.badge });
  sides.set(key, [side(you, 'BEHI FC', 'BEHI'), side(bots, 'BOTS', 'BOTS')]);
  return sides.get(key);
}

// You (kicking, and in goal), the bots' kicker and their keeper.
export function strikerKits(id) {
  const { you, bots } = teams(id);
  return {
    you: { shirt: you.shirt, shade: you.shade, trim: you.trim, shorts: you.shirt, socks: you.socks, band: you.trim, gloves: you.keeper, name: 'BEHI', num: '22' },
    them: { shirt: bots.shirt, shade: bots.shade, trim: bots.trim, shorts: bots.shirt, socks: bots.socks, band: bots.shirt, gloves: bots.trim, name: 'BOT', num: '9' },
    themKeeper: { shirt: bots.keeper, shade: bots.keeperShade, trim: bots.keeperTrim, shorts: bots.keeperTrim, socks: bots.keeper, band: bots.keeperTrim, gloves: '#f3f4f8', name: 'BOT', num: '1' },
  };
}
