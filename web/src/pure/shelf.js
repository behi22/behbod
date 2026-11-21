// The game shelf on the console unit beside the TV: his twenty games, in the order he listed them. Each case gets its
// title, the game's own colours, and cover art drawn in code by covers.js: an original scene in the game's mood, never
// its real cover (no logos, characters, key art or layouts). Places are in Blender axes, metres.

// bg, ink and accent: the case's ground, its lettering and one strong colour. `art` names the cover's scene.
export const GAMES = [
  { id: 'warzone', title: 'Warzone', bg: '#2a3020', ink: '#ece6d2', accent: '#ff7a1a', art: 'ring', mark: 'ring', pic: 'a map of an island seen from the sky, contour lines, and an orange ring closing in' },
  { id: 'tarkov', title: 'Escape from Tarkov', bg: '#26261f', ink: '#e4dccb', accent: '#c9b458', art: 'rain', mark: 'hex', pic: 'a factory town under rain at dusk, one green exit light' },
  { id: 'battlefield', title: 'Battlefield', bg: '#0f1b2b', ink: '#f2f4f7', accent: '#ff6a13', art: 'storm', mark: 'chevron', pic: 'smoke rising over a burning orange horizon, two jets crossing the sky' },
  { id: 'cod', title: 'Call of Duty', bg: '#121412', ink: '#eef0e8', accent: '#8fd14f', art: 'nvg', mark: 'cross', pic: 'a dark corridor through night vision, a red laser line' },
  { id: 'cs16', title: 'Counter-Strike 1.6', bg: '#c4a46a', ink: '#2b1d10', accent: '#3a5a8a', art: 'dust', mark: 'square', pic: 'a sunlit sandstone arch with wooden crates stacked under a blue sky' },
  { id: 'csgo', title: 'CS:GO', bg: '#1b2a3a', ink: '#f1f3f6', accent: '#f2a93b', art: 'tactic', mark: 'diamond', pic: 'a tactical plan of two sites, A and B, with routes drawn in orange' },
  { id: 'hunt', title: 'Hunt: Showdown', bg: '#1d241b', ink: '#e8dcc2', accent: '#9e2216', art: 'bayou', mark: 'drop', pic: 'a swamp at dusk, cypress trees hung with moss, a shack on stilts and one lantern' },
  { id: 'fifa', title: 'FIFA', bg: '#0f5a2e', ink: '#ffffff', accent: '#d8ff3a', art: 'pitch', mark: 'ball', pic: 'a floodlit pitch at night seen from above, the ball on the centre spot' },
  { id: 'gta', title: 'Grand Theft Auto', bg: '#2a1640', ink: '#fff3e6', accent: '#ff5f8a', art: 'sunset', mark: 'sun', pic: 'palm trees and a city skyline against a striped sunset, light trails on the highway' },
  { id: 'detroit', title: 'Detroit: Become Human', bg: '#0d1f33', ink: '#eef6fb', accent: '#2fd2ff', art: 'snow', mark: 'tri', pic: 'snow falling over a cold blue city, a cyan line of light' },
  { id: 'elden', title: 'Elden Ring', bg: '#100e0b', ink: '#efe2c0', accent: '#d4a64a', art: 'gold', mark: 'star', pic: 'broken arches in the mist, a golden glow on the horizon and falling gold leaves' },
  { id: 'spiderman', title: 'Spider-Man', bg: '#14183a', ink: '#ffffff', accent: '#d7192f', art: 'rooftops', mark: 'bars', pic: 'a red dusk over skyscrapers, a rooftop water tower in front' },
  { id: 'darksouls', title: 'Dark Souls', bg: '#1d1c1a', ink: '#ddd5c6', accent: '#e8692a', art: 'ember', mark: 'flame', pic: 'a small fire in the dark under a ruined arch, embers rising through falling ash' },
  { id: 'mafia', title: 'Mafia', bg: '#2a1d15', ink: '#efe2c4', accent: '#a11a1a', art: 'noir', mark: 'diamond', pic: 'a rainy street of the 1930s at night, an old car under a street lamp' },
  { id: 'ac', title: "Assassin's Creed", bg: '#e9e5dc', ink: '#1f1f1f', accent: '#a4161a', art: 'tower', mark: 'chevron', pic: 'old rooftops at dawn under a tall bell tower with a red banner, birds wheeling' },
  { id: 'maxpayne', title: 'Max Payne', bg: '#0c1826', ink: '#f2f5f8', accent: '#c4202a', art: 'blizzard', mark: 'flake', pic: 'heavy snow on an empty city street at night, a red neon glow on the wet road' },
  { id: 'r6', title: 'Rainbow Six Siege', bg: '#1d232b', ink: '#e9edf1', accent: '#f26b1d', art: 'breach', mark: 'hex', pic: 'the floor plan of a house with breach marks on its walls and a drone path' },
  { id: 'watchdogs', title: 'Watch Dogs', bg: '#0a0b0c', ink: '#f4f6f6', accent: '#00d1c1', art: 'glitch', mark: 'square', pic: 'a wireframe city over a grid of data, broken by glitch bars' },
  { id: 'fallout', title: 'Fallout', bg: '#1c2112', ink: '#efe7c6', accent: '#9fd14f', art: 'waste', mark: 'disc', pic: 'a long road through a dusty wasteland under a sickly green sky, a ruined billboard' },
  { id: 'batman', title: 'Batman', bg: '#0e0f13', ink: '#f2f2f2', accent: '#f5c518', art: 'gotham', mark: 'spire', pic: 'gothic towers in the rain at night, yellow searchlights crossing the clouds' },
];

// Real game cases are 12 to 15 mm thick; each here takes a thickness from its name, so the row looks bought over years.
export function thickness(id) {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return 0.0128 + (h % 6) * 0.0003;
}

// The top of the console unit (lounge.py: CS 12.75, top board at z 1.07) holds the row against its south side, where
// the old blank cases stood, so the new row covers them; a steel bookend at each end.
export const SHELF = { x: 0.6015, y0: 12.336, z: 1.07, depth: 0.176, height: 0.213, end: 0.003 };

// Where each case stands: its middle along the shelf and its thickness, packed with no gaps from the south end.
export function shelfSlots(games = GAMES, shelf = SHELF) {
  let y = shelf.y0 + shelf.end;
  return games.map(g => { const t = thickness(g.id); const slot = { id: g.id, y: y + t / 2, t }; y += t; return slot; });
}

// Splits a title into at most two lines for a spine or a cover, at the space nearest the middle, or after a colon.
export function titleLines(title, max = 14) {
  const t = title.toUpperCase();
  if (t.length <= max) return [t];
  const colon = t.indexOf(': ');
  if (colon > 0) return [t.slice(0, colon + 1), t.slice(colon + 2)];
  const spaces = [...t].map((c, i) => (c === ' ' ? i : -1)).filter(i => i > 0);
  if (!spaces.length) return [t];
  const cut = spaces.reduce((a, b) => (Math.abs(b - t.length / 2) < Math.abs(a - t.length / 2) ? b : a));
  return [t.slice(0, cut), t.slice(cut + 1)];
}
