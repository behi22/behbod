// Achievements, best scores and what a score at the holo range unlocks. Saved on this device only (storage is
// injected so the tests can run without a browser); anything read back is checked before it is used.
export const ACHIEVEMENTS = {
  welcome: 'Welcome home', whoami: 'The real you', secret: 'Found the secret door', balcony: 'Out on the balcony',
  piano: 'Played the piano', record: 'Put on a record', book: 'Read the story', telescope: 'Looked through the telescope',
  deploy: 'Hit DEPLOY', tea: 'Had a glass of tea', seat: 'Took a seat', pishi: 'Petted Pishi', jessi: 'Played fetch with Jessi',
  bh22: 'Said hi to BH-22', chess: 'Beat the holochess bot', backgammon: 'Won at backgammon', striker: 'Won a shootout',
  goal: 'Scored at the mini goal', range: 'Cleared a round at the holo range', heads: 'Tried every head', vault: 'Opened the secret room',
};
// Holo range scores that unlock things: the keeper kit, the gold colourway, then the red visor and the secret room.
export const UNLOCKS = [['kit', 20], ['gold', 35], ['visor', 50], ['vault', 50]];

const KEY = 'loft.progress';

export function makeProgress(storage) {
  let raw = {};
  try { raw = JSON.parse(storage.get(KEY) || '{}'); } catch (e) { raw = {}; }
  const state = {
    earned: Array.isArray(raw.earned) ? raw.earned.filter(id => Object.hasOwn(ACHIEVEMENTS, id)) : [],
    best: {},
    heads: Array.isArray(raw.heads) ? raw.heads.filter(h => typeof h === 'string').slice(0, 10) : [],
  };
  if (raw.best && typeof raw.best === 'object') for (const [k, v] of Object.entries(raw.best)) if (/^[a-z]{2,20}$/.test(k) && Number.isFinite(v) && v >= 0) state.best[k] = Math.floor(v);
  const save = () => { try { storage.set(KEY, JSON.stringify(state)); } catch (e) { /* storage may be blocked; progress then lasts the visit */ } };
  return {
    has: id => state.earned.includes(id),
    // Returns the achievement's title the first time it is earned, null after that.
    earn(id) {
      if (!Object.hasOwn(ACHIEVEMENTS, id) || state.earned.includes(id)) return null;
      state.earned.push(id); save();
      return ACHIEVEMENTS[id];
    },
    list: () => state.earned.map(id => ({ id, title: ACHIEVEMENTS[id] })),
    best: game => state.best[game] || 0,
    // Records a score; returns the unlocks it newly earned.
    score(game, value) {
      const before = this.unlocked();
      if (Number.isFinite(value) && value > (state.best[game] || 0)) { state.best[game] = Math.floor(value); save(); }
      return this.unlocked().filter(u => !before.includes(u));
    },
    unlocked: () => UNLOCKS.filter(([, need]) => (state.best.range || 0) >= need).map(([id]) => id),
    sawHead(h) { if (!state.heads.includes(h)) { state.heads.push(h); save(); } return state.heads.length; },
  };
}
