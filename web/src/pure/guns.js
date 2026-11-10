// The holo range's six creature guns: who they are, how they shoot, and the ammo and reload rules they share.
// `shot` says what a trigger pull does: one straight shot, several spread out, a splash that forgives aim, a chain that
// jumps to a second target, or a long instant line.
export const GUNS = [
  { id: 'snorkel', name: 'Snorkel', kind: 'axolotl', ammo: 12, cool: 0.16, reload: 1.1, shot: 'single', spread: 0, colour: '#ff8fc1',
    lines: ['Bubbles! Lots of bubbles!', 'I breathe through my frills, you know.', 'Pop pop pop!'] },
  { id: 'grumble', name: 'Grumble', kind: 'hermit crab', ammo: 6, cool: 0.55, reload: 1.6, shot: 'splash', spread: 0, radius: 0.4, colour: '#f0a35b',
    lines: ['Hmph. Fine. One more.', 'Do not touch the shell.', 'Big rock. Big feelings.'] },
  { id: 'vix', name: 'Vix', kind: 'chameleon', ammo: 8, cool: 0.32, reload: 1.3, shot: 'line', spread: 0, colour: '#6fe07a',
    lines: ['I saw that one coming. Both eyes.', 'Tongue first, questions later.', 'Blending in. Mostly.'] },
  { id: 'mochi', name: 'Mochi', kind: 'slime bun', ammo: 10, cool: 0.38, reload: 1.2, shot: 'spread', pellets: 3, spread: 0.05, colour: '#5fe0d0',
    lines: ['Squish!', 'I am mostly jelly and love.', 'Sticky business!'] },
  { id: 'zap', name: 'Zap', kind: 'eel', ammo: 5, cool: 0.6, reload: 1.8, shot: 'chain', spread: 0, chain: 1.6, colour: '#ffe45a',
    lines: ['BZZT. Sorry. Excited.', 'Charging... charged!', 'Shocking aim. In a good way.'] },
  { id: 'dusty', name: 'Dusty', kind: 'moth', ammo: 15, cool: 0.22, reload: 1.0, shot: 'spread', pellets: 5, spread: 0.09, colour: '#e8dcc0',
    lines: ['Is that a lamp? No. Focus.', 'Dust to dust!', 'Flutter, flutter, fire.'] },
];

export const newArsenal = () => ({ gun: 0, ammo: GUNS.map(g => g.ammo), cool: 0, reloading: 0 });

export function select(st, i) {
  const n = GUNS.length, next = ((i % n) + n) % n;
  if (next === st.gun) return false;
  // Switching cancels a reload in progress; each gun keeps what it had left. A switch takes a moment, and never cuts
  // short the wait after a slow gun's shot.
  st.gun = next; st.reloading = 0; st.cool = Math.max(st.cool, 0.25);
  return true;
}

export function startReload(st) {
  const g = GUNS[st.gun];
  if (st.reloading || st.ammo[st.gun] === g.ammo) return false;
  st.reloading = g.reload;
  return true;
}

// A trigger pull: fires when loaded and cool, reloading by itself when that was the last shot. Returns the shots fired:
// aim offsets (screen units) for each pellet, or null when nothing fired.
export function pull(st, rand) {
  const g = GUNS[st.gun];
  if (st.reloading || st.cool > 0) return null;
  if (!st.ammo[st.gun]) { startReload(st); return null; }
  st.ammo[st.gun]--;
  st.cool = g.cool;
  const n = g.shot === 'spread' ? g.pellets : 1;
  const out = [];
  for (let i = 0; i < n; i++) out.push(n === 1 ? [0, 0] : [(rand() - 0.5) * 2 * g.spread, (rand() - 0.5) * 2 * g.spread]);
  if (!st.ammo[st.gun]) startReload(st);
  return out;
}

// Time passing; returns true on the step a reload finishes.
export function tickArsenal(st, dt) {
  st.cool = Math.max(0, st.cool - dt);
  if (!st.reloading) return false;
  st.reloading = Math.max(0, st.reloading - dt);
  if (st.reloading) return false;
  st.ammo[st.gun] = GUNS[st.gun].ammo;
  return true;
}

// Points for a hit: one, three for a gold target; spread pellets on the same target only count once (the caller passes
// each target once).
export const hitPoints = gold => (gold ? 3 : 1);
