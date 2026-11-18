// The Games app on the computer: its games, and where everything in its window goes, in desktop pixels, so the
// monitor and the seated view draw it alike. Each game's rules are in its own file; src/deskgames.js plays them.
import { TITLE, STYLE, textWidth, fit, wrap } from './desktop.js';
import { COURT, LEVELS } from './paddle.js';
import { SKY } from './orbit.js';
import { FIELD } from './bughunt.js';
import { FIELD as KHAN } from './haftkhan.js';

export const GAMES = [
  { id: 'paddle', title: 'Paddle Duel', line: 'Your paddle against the computer. First to five wins.', size: [COURT.w, COURT.h], unit: 'best rally',
    hint: 'move the mouse or hold ← →   P pauses', touch: 'drag your paddle with a finger',
    icon: 'M4 5h8M12 19h8M10.4 12a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0' },
  { id: 'orbit', title: 'Orbit', line: 'Hold to climb, let go to sink. Miss the rocks, catch the sparks.', size: [SKY.size, SKY.size], unit: 'best score',
    hint: 'hold the mouse or Space to climb   P pauses', touch: 'hold a finger down to climb',
    icon: 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0M3 12a9 4.5 0 1 0 18 0 9 4.5 0 1 0-18 0M18.5 7.6h.01' },
  { id: 'bughunt', title: 'Bug Hunt', line: 'Squash the bugs before they dig in. Spare the ladybird.', size: [FIELD.w, FIELD.h], unit: 'best score',
    hint: 'click the bugs   P pauses', touch: 'tap the bugs',
    icon: 'M9 7.5a3 3 0 0 1 6 0M8 10h8v4a4 4 0 0 1-8 0zM12 10v8M4 12h4M16 12h4M5 18l3-2M19 18l-3-2M5.5 6.5L8 8.5M18.5 6.5L16 8.5' },
  { id: 'haftkhan', title: 'Haft Khan', line: "Rostam's seven labours from the Shahnameh, one quick round each.", size: [KHAN.w, KHAN.h], unit: 'best score',
    hint: 'click, or Space; move with the mouse or ← →   P pauses', touch: 'tap to strike, drag to move',
    icon: 'M3 20l5.5-9 3.5 5 3-4 6 8zM16 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0' },
];
const BY = Object.fromEntries(GAMES.map(g => [g.id, g]));
export const gameById = id => (Object.hasOwn(BY, id) ? BY[id] : null);

const PILL_H = 30, PILL_PAD = 12, LH = 22, ICON = 44, INNER = 16, GAP = 14;
const pillW = label => textWidth(label, STYLE.small) + 2 * PILL_PAD;
const text = (s, x, y, px, c, b = 400) => ({ s, x, y, px, c, b });

// The launcher: a card for each game with its icon, a still picture of it (when there is room), what it is, the best
// score kept on this computer, and its buttons. All side by side in a wide window, one above another in a narrow one.
export function launcherLayout(w, best = {}) {
  const texts = [], pills = [], cards = [], x0 = w.x + 18, y0 = w.y + TITLE + 14, avail = w.w - 36;
  const n = GAMES.length, across = avail >= n * 230 + (n - 1) * GAP, cw = across ? (avail - (n - 1) * GAP) / n : avail;
  const cols = Math.max(8, Math.floor((cw - 2 * INNER) / (STYLE.small * 0.6)));
  const lines = GAMES.map(g => wrap(g.line, cols));
  const descH = Math.max(...lines.map(l => l.length)) * LH;
  const fixed = INNER + ICON + 12 + descH + 8 + LH + 12 + PILL_H + INNER;
  // Side by side, the cards fill the window's height and the spare height goes to the picture.
  const pic = across ? Math.max(0, Math.min(200, w.y + w.h - 18 - y0 - fixed - 12)) : 0;
  let y = y0;
  GAMES.forEach((g, i) => {
    const cx = across ? x0 + i * (cw + GAP) : x0, cy = across ? y0 : y;
    const own = across ? descH : lines[i].length * LH;
    const h = INNER + ICON + 12 + (pic ? pic + 12 : 0) + own + 8 + LH + 12 + PILL_H + INNER;
    const card = { id: g.id, x: cx, y: cy, w: cw, h, icon: { x: cx + INNER, y: cy + INNER, size: ICON }, pic: pic ? { x: cx + INNER, y: cy + INNER + ICON + 12, w: cw - 2 * INNER, h: pic } : null };
    cards.push(card);
    texts.push(text(fit(g.title, STYLE.text, cw - 2 * INNER - ICON - 14), cx + INNER + ICON + 14, cy + INNER + ICON / 2 + 7, STYLE.text, 'accent', 700));
    let ty = cy + INNER + ICON + 12 + (pic ? pic + 12 : 0) + 15;
    for (const l of lines[i]) { texts.push(text(l, cx + INNER, ty, STYLE.small, 'dim')); ty += LH; }
    ty = cy + INNER + ICON + 12 + (pic ? pic + 12 : 0) + own + 8 + 15;
    const b = best[g.id] || 0;
    texts.push(text(b ? `${g.unit} ${b}` : 'no best yet', cx + INNER, ty, STYLE.small, b ? 'ink' : 'faint'));
    const py = cy + h - INNER - PILL_H;
    let px = cx + INNER;
    const list = g.id === 'paddle' ? Object.keys(LEVELS).map(l => [LEVELS[l].name, `game:start:paddle:${l}`]) : [['Play', `game:start:${g.id}`]];
    for (const [label, act] of list) { const pw = pillW(label); pills.push({ label, act, on: false, x: px, y: py, w: pw, h: PILL_H }); px += pw + 8; }
    y += h + GAP;
  });
  return { texts, pills, cards, bottom: across ? y0 + cards[0].h : y - GAP };
}

// A game being played: a row with the way back, the score and pause, the game's picture, and a line on how to play.
// `state` is 'play', 'paused' or 'done'; `status` is the score line; `sideways`: a phone on its side, where the
// picture comes out small, so the line asks for it upright instead.
export const UPRIGHT = 'turn your phone upright for a bigger game';
export function playLayout(w, id, { state = 'play', status = '', touch = false, sideways = false } = {}) {
  const g = gameById(id), texts = [], pills = [], top = w.y + TITLE + 8, mid = top + PILL_H / 2;
  const back = { label: '← Games', act: 'game:back', on: false, x: w.x + 12, y: top, w: pillW('← Games'), h: PILL_H };
  const label = state === 'done' ? 'Again' : state === 'paused' ? 'Go on' : 'Pause';
  const right = { label, act: state === 'done' ? 'game:again' : 'game:pause', on: state !== 'play', w: pillW(label), h: PILL_H, y: top };
  right.x = w.x + w.w - 12 - right.w;
  pills.push(back, right);
  const sx = back.x + back.w + 16, room = right.x - 16 - sx;
  const score = { x: sx, y: mid + 5, px: STYLE.small, w: room };
  if (status) texts.push(text(fit(status, STYLE.small, room), sx, mid + 5, STYLE.small, 'ink'));
  const hint = g ? (sideways ? UPRIGHT : touch ? g.touch : g.hint) : '', hy = w.y + w.h - 12;
  const area = { x: w.x + 10, y: top + PILL_H + 8, w: w.w - 20, h: Math.max(60, hy - 18 - (top + PILL_H + 8)) };
  if (hint) { const s = fit(hint, STYLE.small, w.w - 24); texts.push(text(s, w.x + (w.w - textWidth(s, STYLE.small)) / 2, hy, STYLE.small, 'dim')); }
  return { texts, pills, area, score };
}

// Where a game's picture sits inside a box: as big as fits, centred, the same shape as the game.
export function fitGame(id, w, h) {
  const [gw, gh] = gameById(id)?.size || [1, 1], k = Math.min(w / gw, h / gh);
  return { k, x: (w - gw * k) / 2, y: (h - gh * k) / 2, w: gw * k, h: gh * k };
}
// A point on that box (0..w, 0..h) in the game's own units.
export function toGame(id, x, y, w, h) {
  const f = fitGame(id, w, h);
  return [(x - f.x) / f.k, (y - f.y) / f.k];
}

// Best scores as kept in the browser: anything that is not a whole, non-negative number for a known game is dropped.
export function readBest(raw) {
  let o;
  try { o = JSON.parse(raw || '{}'); } catch (e) { return {}; }
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const g of GAMES) if (Number.isFinite(o[g.id]) && o[g.id] > 0) out[g.id] = Math.min(1e6, Math.floor(o[g.id]));
  return out;
}
