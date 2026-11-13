// The computer's desktop: its apps, where their windows sit, and what each window shows. The 3D monitor paints it on
// a canvas and the seated view lays the same thing out in HTML, both from this one model, so the two match.
import { KEYS, LABEL as KEY_LABEL } from './calc.js';

export const W = 1536, H = 646, BAR = 34, DOCK = 70, TITLE = 34, ROW = 46, PAD = 18;

export const STYLE = {
  font: "'JetBrains Mono', ui-monospace, Consolas, monospace",
  ink: '#d8e0ee', dim: '#7f8aa0', faint: '#4a5468', accent: '#3ee6c4', warm: '#ffb35c',
  window: '#0b111a', title: '#121a26', edge: '#243042', focusEdge: '#3ee6c4', bar: '#070b11',
  text: 19, small: 15, term: 20, termLine: 26,
};

// Icons are 24 by 24 stroke paths, so the canvas (Path2D) and the HTML (an svg path) draw the same lines.
export const APPS = [
  { id: 'terminal', title: 'Terminal', icon: 'M4 6l5 5-5 5M11 17h9', rect: [34, 52, 830, 492] },
  { id: 'projects', title: 'Projects', icon: 'M3 7h7l2 2h9v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', rect: [892, 52, 610, 384] },
  { id: 'about', title: 'About me', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6', rect: [920, 96, 560, 332] },
  { id: 'music', title: 'Music', icon: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', rect: [900, 120, 590, 356] },
  { id: 'notes', title: 'Notes', icon: 'M6 3h9l4 4v14H6zM9 11h7M9 15h7M9 7h3', rect: [1010, 330, 470, 214] },
  { id: 'settings', title: 'Settings', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM8 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z', rect: [860, 70, 600, 290] },
  { id: 'calc', title: 'Calculator', icon: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01', rect: [1160, 56, 320, 470] },
];
const BY = Object.fromEntries(APPS.map(a => [a.id, a]));
export const appById = id => BY[id];

// One-liners and links for the projects on the shelf; `site` is the live page when there is one.
export const PROJECTS = {
  'meet-bex': { line: 'a voice AI host you just talk to', site: 'https://behi22.github.io/meet-bex/' },
  'profile-art': { line: 'my GitHub profile, redrawn every hour', site: 'https://behi22.github.io/profile-art/' },
  'aic-voice-microsite': { line: 'a voice agent for restaurants, shown off', site: 'https://aic-voice-microsite.vercel.app' },
  'visitor-classifier': { line: 'reads a site, sorts its visitors by interest', site: 'https://www.loom.com/share/84359f4e50ee41fc97b21f921d9aa4a0', siteLabel: 'Watch' },
  behbod: { line: 'this home, built from scratch' },
};
export const GITHUB = 'https://github.com/behi22';

// The desktop starts with the terminal in front and the projects beside it.
export function newDesktop() {
  return { wins: [win('projects'), win('terminal')], focus: 'terminal', opened: 2 };
}
function win(app, k = 0) {
  const [x, y, w, h] = BY[app].rect;
  return { app, x: x + k * 26, y: y + k * 22, w, h };
}
// A window just opened sits wholly on the screen; one being dragged only has to keep its title bar in reach.
const fitWin = w => {
  w.x = Math.max(0, Math.min(W - w.w, w.x));
  w.y = Math.max(BAR, Math.min(H - DOCK - w.h, w.y));
  return w;
};
const clampWin = w => {
  w.x = Math.max(-w.w + 120, Math.min(W - 120, w.x));
  w.y = Math.max(BAR, Math.min(H - DOCK - TITLE, w.y));
  return w;
};
export const find = (st, app) => st.wins.find(w => w.app === app) || null;

// Opening an open app brings it to the front; a new window steps down a little from the last one opened.
export function open(st, app) {
  if (!BY[app]) return false;
  let w = find(st, app);
  if (w) st.wins = st.wins.filter(x => x !== w).concat(w);
  else { w = fitWin(win(app, st.opened++ % 4)); st.wins.push(w); }
  st.focus = app;
  return true;
}
// Opening without taking the front: a closed app comes back behind the others, an open one stays where it is.
export function keepOpen(st, app) {
  if (!BY[app] || find(st, app)) return false;
  st.wins.unshift(fitWin(win(app, st.opened++ % 4)));
  if (!st.focus) st.focus = app;
  return true;
}
export function close(st, app) {
  const before = st.wins.length;
  st.wins = st.wins.filter(w => w.app !== app);
  if (st.focus === app) st.focus = st.wins.at(-1)?.app || null;
  return st.wins.length !== before;
}
export const focus = (st, app) => (find(st, app) ? open(st, app) : false);
export function move(st, app, dx, dy) {
  const w = find(st, app);
  if (!w) return false;
  w.x += dx; w.y += dy;
  clampWin(w);
  return true;
}
// The topmost window under a point, for clicks on the painted screen.
export function hit(st, x, y) {
  for (let i = st.wins.length - 1; i >= 0; i--) { const w = st.wins[i]; if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return w.app; }
  return null;
}
// The dock's icons, centred along the bottom; on a narrow screen they shrink so the whole row still fits.
export function dock(width = W, height = H) {
  const n = APPS.length, gap = width < 700 ? 8 : 14, size = Math.max(24, Math.min(50, Math.floor((width - 40 - (n - 1) * gap) / n)));
  const w = n * size + (n - 1) * gap, x0 = (width - w) / 2, y = height - DOCK + (DOCK - size) / 2;
  return APPS.map((a, i) => ({ app: a.id, x: x0 + i * (size + gap), y, size }));
}

// The calculator's face inside its window: the display over five rows of four keys, or, in a window much wider than
// it is tall (a phone on its side), the display beside them, so the keys keep a height a finger can find.
// `mainLen` is how many characters the big line holds: a long answer is written smaller rather than running off.
// The sizes of the three kinds of lettering come back too, so the monitor and the seated view write them alike.
export function calcLayout(w, mainLen = 1) {
  const pad = 14, gap = 8, x = w.x + pad, y = w.y + TITLE + 12, width = w.w - 2 * pad, height = w.y + w.h - pad - y;
  const wide = w.w > w.h * 1.5;
  const display = wide ? { x, y, w: Math.round(width * 0.4), h: height } : { x, y, w: width, h: Math.min(104, Math.max(64, (w.h - TITLE) * 0.24)) };
  const kx = wide ? display.x + display.w + 12 : x, ky = wide ? y : y + display.h + 12, area = { w: x + width - kx, h: y + height - ky };
  const kh = (area.h - gap * 4) / 5, kw = (area.w - gap * 3) / 4, keys = [];
  KEYS.forEach((row, r) => row.forEach((key, c) => keys.push({ key, label: KEY_LABEL[key] || key, kind: key === '=' ? 'go' : /^[0-9.]$/.test(key) ? 'num' : 'op',
    x: kx + c * (kw + gap), y: ky + r * (kh + gap), w: kw, h: kh })));
  const topPx = display.h < 84 ? 12 : STYLE.small;
  const mainPx = Math.max(12, Math.min(44, display.h - topPx - 26, Math.floor((display.w - 28) / (Math.max(1, mainLen) * 0.6))));
  return { display, keys, mainPx, topPx, keyPx: Math.max(10, Math.min(22, Math.floor(kh * 0.6))) };
}
// The end of a line that is too long for its place: the newest part is the part that matters.
export function tail(s, px, maxW) {
  const n = Math.floor(maxW / (px * 0.6));
  return s.length <= n ? s : n > 1 ? '…' + s.slice(-(n - 1)) : '';
}

// What an app's window shows, as rows: text pieces and buttons ("pills"). `ctx` is the loft's live state.
export function rows(app, ctx = {}) {
  const pill = (label, act, on = false) => ({ label, act, on });
  if (app === 'projects') {
    return (ctx.projects || Object.keys(PROJECTS)).filter(p => PROJECTS[p]).map(p => {
      const info = PROJECTS[p], pills = [];
      if (info.site) pills.push(pill(info.siteLabel || 'Open', 'link:' + info.site));
      pills.push(pill('Code', `link:${GITHUB}/${p}`));
      return { stack: true, text: [[p, 'accent', 700], [info.line, 'dim']], pills };
    });
  }
  if (app === 'about') {
    return [
      { text: [['Behbod Babai', 'ink', 700]] },
      { text: [['based', 'dim'], ['Vancouver', 'ink']] },
      { text: [['builds', 'dim'], ['voice AI agents', 'ink']] },
      { text: [['plays', 'dim'], ['goalkeeper, number 22', 'ink']] },
      { text: [['loves', 'dim'], ['Real Madrid', 'ink']] },
      { inline: true, text: [['find me', 'dim']], pills: [pill('GitHub', 'link:' + GITHUB)] },
    ];
  }
  if (app === 'music') {
    const recs = ctx.records || [];
    if (!recs.length) return [{ text: [['no records on the shelf yet', 'dim']] }];
    const out = recs.map(r => ({ stack: true, text: [[r.title, r.id === ctx.playing ? 'accent' : 'ink', 700], [r.mood || '', 'dim']], pills: [pill(r.id === ctx.playing ? 'Playing' : 'Play', 'music:' + r.id, r.id === ctx.playing)] }));
    out.push({ inline: true, text: [[ctx.sound ? (ctx.playing ? 'playing on the speakers' : 'pick a record') : 'sound is off', 'dim']], pills: [pill(ctx.sound ? 'Sound on' : 'Sound off', 'sound', !!ctx.sound), ...(ctx.playing ? [pill('Stop', 'music:off')] : [])] });
    return out;
  }
  if (app === 'settings') {
    const opts = (label, list, cur, kind) => ({ inline: true, text: [[label, 'dim']], pills: list.map(v => pill(v, `${kind}:${v}`, v === cur)) });
    const out = [
      opts('quality', ['auto', 'low', 'medium', 'high', 'ultra'], ctx.quality, 'quality'),
      { inline: true, text: [['sound', 'dim']], pills: [pill(ctx.sound ? 'on' : 'off', 'sound', !!ctx.sound)] },
      { inline: true, text: [['hood', 'dim']], pills: [pill('up', 'hood:up', ctx.hood === true), pill('down', 'hood:down', ctx.hood === false)] },
    ];
    if (ctx.scenes?.length) out.push(opts('lights', ctx.scenes.slice(0, 5), ctx.scene, 'scene'));
    out.push(opts('coolant', ['teal', 'purple', 'red', 'gold', 'white'], ctx.coolant, 'coolant'));
    return out;
  }
  return [];
}

// Where everything inside a window goes, in desktop pixels, so both renderers place it identically. The font is
// monospaced, so a string's width is its length times 0.6 of the font size, here and in the browser alike.
export const textWidth = (s, px) => s.length * px * 0.6;
export function fit(s, px, maxW) {
  const n = Math.floor(maxW / (px * 0.6));
  return s.length <= n ? s : n > 1 ? s.slice(0, n - 1) + '…' : '';
}
const STACK = 66, LABEL = 150, PILL_H = 30, PILL_PAD = 12, PILL_GAP = 8, WRAP = 38;
export function layout(w, list) {
  const texts = [], pills = [], x0 = w.x + PAD, right = w.x + w.w - PAD;
  let y = w.y + TITLE + 10;
  for (const r of list) {
    const h = r.stack ? STACK : ROW, mid = y + h / 2;
    const ps = (r.pills || []).map(p => ({ ...p, w: textWidth(p.label, STYLE.small) + 2 * PILL_PAD, h: PILL_H }));
    let px, extra = 0;
    if (r.inline) px = x0 + (r.text.length > 1 || r.text[0][0].length > 12 ? textWidth(r.text.map(t => t[0]).join('  '), STYLE.text) + 24 : LABEL);
    else px = right - ps.reduce((a, p) => a + p.w + PILL_GAP, -PILL_GAP);
    // Buttons after a label run on to a second line when the window is too narrow for them all.
    const start = px;
    for (const p of ps) {
      if (r.inline && px > start && px + p.w > right) { px = start; extra += WRAP; }
      p.x = px; p.y = mid - PILL_H / 2 + extra; px += p.w + PILL_GAP; pills.push(p);
    }
    const textRight = r.inline ? right : (ps.length ? ps[0].x - 16 : right);
    if (r.stack) {
      const [a, b] = r.text;
      texts.push({ s: fit(a[0], STYLE.text, textRight - x0), x: x0, y: y + 25, px: STYLE.text, c: a[1], b: a[2] || 400 });
      if (b) texts.push({ s: fit(b[0], STYLE.small, textRight - x0), x: x0, y: y + 50, px: STYLE.small, c: b[1], b: b[2] || 400 });
    } else {
      let tx = x0;
      r.text.forEach(([s, c, b], i) => {
        const cx = i === 1 && !r.inline ? x0 + LABEL : tx, room = (i === 0 && r.text.length > 1 && !r.inline ? LABEL - 12 : textRight - cx);
        const f = fit(s, STYLE.text, room);
        texts.push({ s: f, x: cx, y: mid + 7, px: STYLE.text, c, b: b || 400 });
        tx = cx + textWidth(f, STYLE.text) + 14;
      });
    }
    y += h + extra;
  }
  return { texts, pills, bottom: y };
}

// A button's action string, split into what to do and its argument ("link:https://x" keeps the colon in the URL).
export function parseAct(act) {
  const i = act.indexOf(':');
  return i < 0 ? { kind: act, arg: '' } : { kind: act.slice(0, i), arg: act.slice(i + 1) };
}

// The terminal's last lines that fit its window, leaving the bottom line for what is being typed; `top` is the first
// line's baseline below the window's top edge.
export function termShown(lines, h) {
  const top = TITLE + 30, n = Math.max(1, Math.floor((h - top) / STYLE.termLine));
  return { lines: lines.slice(-(n - 1) || lines.length), top };
}

// Text wrapped at spaces to `cols` characters a line; a word longer than a line is split.
export function wrap(text, cols) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (let word of para.split(' ')) {
      while (word.length > cols) { if (line) { out.push(line); line = ''; } out.push(word.slice(0, cols)); word = word.slice(cols); }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= cols) line += ' ' + word;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

// The top bar's clock, on Vancouver time whatever the visitor's own zone.
const CLOCK = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function clockText(date) {
  const p = Object.fromEntries(CLOCK.formatToParts(date).map(x => [x.type, x.value]));
  return `${p.weekday} ${p.hour}:${p.minute}`;
}
