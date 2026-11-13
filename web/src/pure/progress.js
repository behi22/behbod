// Achievements, best scores, the stars earned at the range and what they unlock. Saved on this device only (storage
// is injected so the tests can run without a browser); anything read back is checked before it is used.
import { STAGE, DIFFICULTIES, totalStars, legend } from './stages.js';
import { GUN, gunsFor } from './arsenal.js';

export const ACHIEVEMENTS = {
  welcome: 'Welcome home', whoami: 'The real you', secret: 'Found the secret door', balcony: 'Out on the balcony',
  piano: 'Played the piano', record: 'Put on a record', book: 'Read the story', telescope: 'Looked through the telescope',
  deploy: 'Hit DEPLOY', tea: 'Had a glass of tea', seat: 'Took a seat', pishi: 'Petted Pishi', jessi: 'Played fetch with Jessi',
  bh22: 'Said hi to BH-22', chess: 'Beat the holochess bot', backgammon: 'Won at backgammon', striker: 'Won a shootout',
  goal: 'Scored at the mini goal', range: 'Earned a star at the range', heads: 'Tried every head', vault: 'Opened the secret room',
};
// What the range unlocks besides its guns: the keeper kit for a star on the walkers' stage, the gold colourway for
// three stars on any stage, the red visor and the secret room for three stars on every stage on Hard.
const starsOn = (best, stage) => { const b = best[stage]; return b ? Math.max(b.easy | 0, b.normal | 0, b.hard | 0) : 0; };
export const UNLOCK_RULES = {
  kit: best => starsOn(best, 'walkers') >= 1,
  gold: best => Object.keys(best).some(stage => starsOn(best, stage) >= 3),
  visor: best => legend(best),
  vault: best => legend(best),
};
// The scores of the first range (a holo round) that unlocked the same things: anyone who earned them then keeps them.
export const UNLOCKS = [['kit', 20], ['gold', 35], ['visor', 50], ['vault', 50]];

const KEY = 'loft.progress';

export function makeProgress(storage) {
  let raw = {};
  try { raw = JSON.parse(storage.get(KEY) || '{}'); } catch (e) { raw = {}; }
  const state = {
    earned: Array.isArray(raw.earned) ? raw.earned.filter(id => Object.hasOwn(ACHIEVEMENTS, id)) : [],
    best: {},
    heads: Array.isArray(raw.heads) ? raw.heads.filter(h => typeof h === 'string').slice(0, 10) : [],
    // The range: for each stage and difficulty, the most stars and the best score.
    range: {},
  };
  if (raw.range && typeof raw.range === 'object') {
    for (const [stage, by] of Object.entries(raw.range)) {
      if (!Object.hasOwn(STAGE, stage) || !by || typeof by !== 'object') continue;
      for (const [d, v] of Object.entries(by)) {
        if (!Object.hasOwn(DIFFICULTIES, d) || !v || typeof v !== 'object') continue;
        const stars = Number.isInteger(v.stars) ? Math.min(3, Math.max(0, v.stars)) : 0, score = Number.isFinite(v.score) && v.score >= 0 ? Math.floor(v.score) : 0;
        (state.range[stage] ||= {})[d] = { stars, score };
      }
    }
  }
  const rangeBest = () => Object.fromEntries(Object.entries(state.range).map(([stage, by]) => [stage, Object.fromEntries(Object.entries(by).map(([d, v]) => [d, v.stars]))]));
  const unlocked = () => { const best = rangeBest(); return UNLOCKS.filter(([id, need]) => (state.best.range || 0) >= need || UNLOCK_RULES[id](best)).map(([id]) => id); };
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
    unlocked,
    // Stars by stage and difficulty, { warmup: { normal: 2 } }, as the stage rules read them.
    rangeBest,
    rangeScore: (stage, difficulty) => state.range[stage]?.[difficulty]?.score || 0,
    // Records a finished run. Returns { best: a new best score, guns: names of guns it unlocked, unlocks: the other unlocks' ids }.
    rangeResult(stage, difficulty, stars, score) {
      if (!Object.hasOwn(STAGE, stage) || !Object.hasOwn(DIFFICULTIES, difficulty)) return { best: false, guns: [], unlocks: [] };
      const before = unlocked(), had = gunsFor(totalStars(rangeBest()));
      const slot = (state.range[stage] ||= {})[difficulty] ||= { stars: 0, score: 0 };
      const n = Number.isInteger(stars) ? Math.min(3, Math.max(0, stars)) : 0, pts = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
      const best = pts > slot.score;
      if (n > slot.stars) slot.stars = n;
      if (best) slot.score = pts;
      save();
      return { best, guns: gunsFor(totalStars(rangeBest())).filter(id => !had.includes(id)).map(id => GUN[id].name), unlocks: unlocked().filter(u => !before.includes(u)) };
    },
    sawHead(h) { if (!state.heads.includes(h)) { state.heads.push(h); save(); } return state.heads.length; },
  };
}
