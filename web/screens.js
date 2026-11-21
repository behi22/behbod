import * as THREE from 'three';
import { drawWorldMat, drawTimer, drawNeon, Outside, holidayAt } from './room2.js';
import { makePanels } from './panels.js';
import { W as DW, H as DH, BAR, DOCK, TITLE, PAD, STYLE, appById, newDesktop, dock as dockIcons, rows as appRows, layout, wrap, termShown, open as openApp, keepOpen, clockText, calcLayout, tail } from './src/pure/desktop.js';
import { newCalc, press as calcPress, show as calcShow, fromKeyboard as calcKey } from './src/pure/calc.js';
import { siteById, newBrowser, go as browserGo, browserLayout, LOCK } from './src/pure/browser.js';
import { launcherLayout, playLayout, gameById } from './src/pure/arcade.js';
import { makeDeskGames } from './src/deskgames.js';
import { ferdowsiLines } from './src/pure/shahnameh.js';
import { nowruzLines } from './src/pure/nowruz.js';
import { WALLPAPERS } from './src/pure/desktop.js';
import { newReader, readerGo, readerLayout } from './src/pure/reader.js';
import { paintStory, paintWallpaper } from './src/shah/scenes.js';
import { helloWorld } from './src/pure/hello.js';
import { newHistory, remember, browse } from './src/pure/history.js';
import { makeContrib } from './src/contrib.js';

const MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace";
const TATTOO = ['بنگر و بشنو،', 'بگذر و به شو'];

function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // glTF UVs run top-down, so canvases on exported meshes must not be flipped.
  t.flipY = false;
  return { c, g: c.getContext('2d'), t };
}

const NOTES_KEY = 'home.notes', NOTES = 'fix the telescope.\nwater the succulent.\nship.';
function loadNotes() {
  try { return localStorage.getItem(NOTES_KEY) ?? NOTES; } catch { return NOTES; }
}
function saveNotes(v) {
  try { localStorage.setItem(NOTES_KEY, v); } catch { /* private window: the note lasts this visit only */ }
}
const WALL_KEY = 'home.wallpaper';
function loadWallpaper() {
  try { const v = localStorage.getItem(WALL_KEY); return WALLPAPERS.includes(v) ? v : 'plain'; } catch { return 'plain'; }
}
function saveWallpaper(v) {
  try { localStorage.setItem(WALL_KEY, v); } catch { /* private window: this visit only */ }
}

// Rounded rectangles: the canvas call where the browser has it (Safari before 16 does not), arcs where it does not.
function rrect(g, x, y, w, h, r) {
  if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function makeCanvases(meta, opts = {}) {
  const S = {};
  const T = {};

  // Main ultrawide: the computer's desktop, with a terminal you can type into. The seated view (src/desktop.js) lays
  // the same desktop out in HTML over this screen, from the same model.
  S.main = surface(DW, DH);
  const term = { lines: [], input: '', focus: false, blink: 0 };
  const hist = newHistory();
  const desk = { st: newDesktop(), ctx: { wallpaper: loadWallpaper() }, notes: loadNotes(), calc: newCalc(), browser: newBrowser(), reader: newReader(), sfx: null, dirty: true, drawn: -1, listeners: [] };
  const changed = () => { desk.dirty = true; for (const f of desk.listeners) f(); };
  // Painted once and kept: each is many shapes, and the monitor repaints every second.
  let wall = null, pic = null;
  const wallpaper = () => {
    const id = desk.ctx.wallpaper;
    if (!WALLPAPERS.includes(id)) return null;
    if (wall?.id !== id) { const c = document.createElement('canvas'); c.width = DW; c.height = DH; paintWallpaper(c.getContext('2d'), id, DW, DH); wall = { id, c, url: null }; }
    return wall;
  };
  const storyPic = (id, w, h) => {
    const key = `${id} ${w} ${h}`;
    if (pic?.key !== key) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); paintStory(c.getContext('2d'), id, c.width, c.height); pic = { key, c }; }
    return pic.c;
  };
  document.fonts?.load("500 40px 'Noto Nastaliq Urdu'", 'زال و سیمرغ').then(() => { pic = null; changed(); }).catch(() => {});
  // The games keep their best scores in the visitor's own browser; the sounds arrive once the house's audio exists.
  const local = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* this visit only */ } } };
  const gameSfx = Object.fromEntries(['click', 'blip', 'miss', 'hit'].map(n => [n, () => desk.sfx?.[n]?.()]));
  desk.games = makeDeskGames({ store: local, sfx: gameSfx, onEvent: name => { if (name === 'over') changed(); } });
  const say = (...ls) => { term.lines.push(...ls); while (term.lines.length > 15) term.lines.shift(); changed(); };
  const EXTRA = {};
  const CMDS = {
    // The names in rows that fit the terminal's window, the first row headed.
    help: () => {
      const rows = [];
      for (const n of ['whoami', 'projects', 'postit', 'ferdowsi', 'nowruz', 'ls', 'contact', 'clear', 'exit', ...Object.keys(EXTRA)]) {
        if (rows.length && rows.at(-1).length + 2 + n.length <= 54) rows[rows.length - 1] += '  ' + n; else rows.push(n);
      }
      say(...rows.map((r, i) => (i ? '          ' : 'commands: ') + r), 'picture quality sets itself; to change it, open Settings');
    },
    whoami: () => say('Behbod Babai. Engineer in Vancouver.', 'I make computers talk back.'),
    projects: () => say('meet-bex      a voice receptionist you can talk to', 'profile-art   my GitHub profile, redrawn every hour', 'aic-voice-microsite'),
    postit: () => say('the note on this monitor is my tattoo:', 'Bengar o beshno, bogzar o beh sho'),
    ls: () => say('notes.txt  projects/  piano/  secrets/'),
    'cat notes.txt': () => say('fix the telescope. water the succulent. ship.'),
    'cd secrets': () => say('permission denied (nice try)'),
    contact: () => say('github.com/behi22'),
    'hello friend': () => say('hello, friend.'),
    'hello, friend': () => say('hello, friend.'),
    sudo: () => say('behbod is not in the sudoers file. This incident will be reported.'),
    clear: () => { term.lines = []; changed(); },
    ferdowsi: () => say(...ferdowsiLines()),
    nowruz: () => say(...nowruzLines(new Date())),
  };
  const col = k => STYLE[k] || k;
  const icon = {};
  function drawIcon(g, a, x, y, size, on) {
    g.save();
    g.fillStyle = on ? '#16302f' : '#121a26'; g.beginPath(); rrect(g, x, y, size, size, 12); g.fill();
    g.strokeStyle = on ? STYLE.accent : 'rgba(127,138,160,.35)'; g.lineWidth = 1; g.stroke();
    const k = size * 0.56 / 24;
    g.translate(x + (size - 24 * k) / 2, y + (size - 24 * k) / 2); g.scale(k, k);
    g.strokeStyle = on ? STYLE.accent : STYLE.ink; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(icon[a.id] ||= new Path2D(a.icon));
    g.restore();
  }
  // A 24 by 24 stroke path drawn `size` across, without the icon's box.
  function strokePath(g, d, x, y, size, color) {
    g.save(); g.translate(x, y); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(icon[d] ||= new Path2D(d));
    g.restore();
  }
  // A window's laid-out text pieces and buttons.
  function drawBits(g, L) {
    for (const t of L.texts) { g.font = `${t.b} ${t.px}px ${STYLE.font}`; g.fillStyle = col(t.c); g.fillText(t.s, t.x, t.y); }
    for (const p of L.pills) {
      g.fillStyle = p.on ? 'rgba(62,230,196,.16)' : 'rgba(255,255,255,.04)'; g.beginPath(); rrect(g, p.x, p.y, p.w, p.h, p.h / 2); g.fill();
      g.strokeStyle = p.on ? STYLE.accent : 'rgba(127,138,160,.4)'; g.lineWidth = 1; g.stroke();
      g.font = `400 ${STYLE.small}px ${STYLE.font}`; g.fillStyle = p.on ? STYLE.accent : STYLE.ink; g.fillText(p.label, p.x + 12, p.y + p.h / 2 + 5);
    }
  }
  function drawWindow(g, w, focused) {
    const a = appById(w.app);
    g.save();
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 26; g.shadowOffsetY = 8;
    g.fillStyle = STYLE.window; g.beginPath(); rrect(g, w.x, w.y, w.w, w.h, 10); g.fill();
    g.restore();
    g.save();
    g.beginPath(); rrect(g, w.x, w.y, w.w, w.h, 10); g.clip();
    g.fillStyle = STYLE.title; g.fillRect(w.x, w.y, w.w, TITLE);
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) { g.fillStyle = c; g.beginPath(); g.arc(w.x + 20 + i * 22, w.y + TITLE / 2, 6.5, 0, 7); g.fill(); }
    g.font = `400 ${STYLE.small}px ${STYLE.font}`; g.fillStyle = focused ? STYLE.ink : STYLE.dim; g.textAlign = 'left';
    g.fillText(a.id === 'terminal' ? 'behbod@home: ~' : a.title, w.x + 92, w.y + TITLE / 2 + 5);
    if (w.app === 'terminal') {
      const { lines, top } = termShown(term.lines, w.h);
      g.font = `400 ${STYLE.term}px ${STYLE.font}`;
      lines.forEach((l, i) => { g.fillStyle = l.startsWith('$') ? STYLE.accent : STYLE.ink; g.fillText(l, w.x + PAD, w.y + top + i * STYLE.termLine); });
      g.fillStyle = STYLE.accent;
      g.fillText('$ ' + term.input + (term.focus && term.blink % 2 ? '█' : ''), w.x + PAD, w.y + top + lines.length * STYLE.termLine);
    } else if (w.app === 'notes') {
      g.font = `400 ${STYLE.text}px ${STYLE.font}`; g.fillStyle = '#e9dfb8';
      const cols = Math.floor((w.w - 2 * PAD) / (STYLE.text * 0.6));
      wrap(desk.notes, cols).slice(0, Math.floor((w.h - TITLE - 20) / 28)).forEach((l, i) => g.fillText(l, w.x + PAD, w.y + TITLE + 32 + i * 28));
    } else if (w.app === 'calc') {
      const d = calcShow(desk.calc), L = calcLayout(w, d.main.length), D = L.display;
      g.fillStyle = '#05080d'; g.beginPath(); rrect(g, D.x, D.y, D.w, D.h, 10); g.fill();
      g.textAlign = 'right';
      g.font = `400 ${L.topPx}px ${STYLE.font}`; g.fillStyle = STYLE.dim; g.fillText(tail(d.top, L.topPx, D.w - 28), D.x + D.w - 14, D.y + 10 + L.topPx);
      g.font = `700 ${L.mainPx}px ${STYLE.font}`; g.fillStyle = desk.calc.error ? STYLE.warm : STYLE.ink; g.fillText(d.main, D.x + D.w - 14, D.y + D.h - 18);
      g.textAlign = 'center';
      for (const k of L.keys) {
        g.fillStyle = k.kind === 'go' ? STYLE.accent : k.kind === 'op' ? 'rgba(62,230,196,.12)' : 'rgba(255,255,255,.05)'; g.beginPath(); rrect(g, k.x, k.y, k.w, k.h, 10); g.fill();
        g.font = `${k.kind === 'num' ? 400 : 700} ${L.keyPx}px ${STYLE.font}`; g.fillStyle = k.kind === 'go' ? '#05110f' : k.kind === 'op' ? STYLE.accent : STYLE.ink; g.fillText(k.label, k.x + k.w / 2, k.y + k.h / 2 + L.keyPx * 0.36);
      }
      g.textAlign = 'left';
    } else if (w.app === 'browser') {
      // The page itself is only shown in the seated view; the monitor says which site is up.
      const L = browserLayout(w, desk.browser.site), P = L.page, site = siteById(desk.browser.site);
      g.fillStyle = '#05080d'; g.beginPath(); rrect(g, P.x, P.y, P.w, P.h, 8); g.fill();
      g.textAlign = 'center';
      g.font = `700 ${STYLE.text + 5}px ${STYLE.font}`; g.fillStyle = STYLE.accent; g.fillText(site.title, P.x + P.w / 2, P.y + P.h / 2 - 4);
      g.font = `400 ${STYLE.small}px ${STYLE.font}`; g.fillStyle = STYLE.dim; g.fillText('sit at the desk to browse', P.x + P.w / 2, P.y + P.h / 2 + 24);
      g.textAlign = 'left';
      if (L.lock) strokePath(g, LOCK, L.lock.x, L.lock.y, L.lock.size, STYLE.dim);
      drawBits(g, L);
    } else if (w.app === 'games') {
      const G = desk.games, p = G.playing;
      if (p) {
        const L = playLayout(w, p.id, { state: p.done ? 'done' : p.paused ? 'paused' : 'play', status: G.status() }), A = L.area;
        drawBits(g, L);
        g.save(); g.beginPath(); g.rect(A.x, A.y, A.w, A.h); g.clip(); g.translate(A.x, A.y); G.draw(g, A.w, A.h); g.restore();
      } else {
        const L = launcherLayout(w, G.bests);
        for (const c of L.cards) {
          g.fillStyle = 'rgba(255,255,255,.03)'; g.beginPath(); rrect(g, c.x, c.y, c.w, c.h, 10); g.fill();
          g.strokeStyle = STYLE.edge; g.lineWidth = 1; g.stroke();
          drawIcon(g, { id: 'game-' + c.id, icon: gameById(c.id).icon }, c.icon.x, c.icon.y, c.icon.size, false);
          if (c.pic) { g.save(); g.beginPath(); rrect(g, c.pic.x, c.pic.y, c.pic.w, c.pic.h, 8); g.clip(); g.translate(c.pic.x, c.pic.y); g.fillStyle = '#05080d'; g.fillRect(0, 0, c.pic.w, c.pic.h); G.preview(g, c.id, c.pic.w, c.pic.h); g.restore(); }
        }
        drawBits(g, L);
      }
    } else if (w.app === 'shahnameh') {
      const L = readerLayout(w, desk.reader), P = L.pic;
      g.drawImage(storyPic(L.story, P.w, P.h), P.x, P.y, P.w, P.h);
      drawBits(g, L);
    } else drawBits(g, layout(w, appRows(w.app, desk.ctx)));
    g.restore();
    g.strokeStyle = focused ? 'rgba(62,230,196,.55)' : STYLE.edge; g.lineWidth = focused ? 1.5 : 1;
    g.beginPath(); rrect(g, w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1, 10); g.stroke();
  }
  function drawDesktop() {
    const { g, c, t } = S.main;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const wp = wallpaper();
    if (wp) g.drawImage(wp.c, 0, 0, c.width, c.height);
    else {
      g.fillStyle = '#070b11'; g.fillRect(0, 0, c.width, c.height);
      const grd = g.createLinearGradient(0, 0, c.width, c.height);
      grd.addColorStop(0, 'rgba(62,230,196,.09)'); grd.addColorStop(0.55, 'rgba(40,60,120,.05)'); grd.addColorStop(1, 'rgba(120,80,255,.10)');
      g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(255,255,255,.035)';
      for (let x = 24; x < c.width; x += 48) for (let y = BAR + 24; y < c.height - DOCK; y += 48) g.fillRect(x, y, 2, 2);
    }
    g.fillStyle = STYLE.bar; g.fillRect(0, 0, c.width, BAR);
    g.font = `700 ${STYLE.small}px ${STYLE.font}`; g.fillStyle = STYLE.ink; g.fillText('home', 18, 22);
    g.font = `400 ${STYLE.small}px ${STYLE.font}`; g.fillStyle = STYLE.dim;
    g.fillText(desk.st.focus ? appById(desk.st.focus).title : '', 84, 22);
    if (!term.focus) { g.textAlign = 'center'; g.fillStyle = STYLE.faint; g.fillText('sit at the desk to use this computer', c.width / 2, 22); }
    g.textAlign = 'right'; g.fillStyle = STYLE.ink; g.fillText(desk.ctx.clock || '', c.width - 18, 22);
    g.textAlign = 'left';
    const top = desk.st.wins.at(-1)?.app;
    for (const w of desk.st.wins) drawWindow(g, w, w.app === top && w.app === desk.st.focus);
    const icons = dockIcons();
    const first = icons[0], last = icons.at(-1);
    g.fillStyle = 'rgba(12,18,28,.82)'; g.beginPath(); rrect(g, first.x - 14, first.y - 7, last.x + last.size - first.x + 28, first.size + 14, 18); g.fill();
    g.strokeStyle = 'rgba(127,138,160,.18)'; g.lineWidth = 1; g.stroke();
    for (const d of icons) {
      const isOpen = desk.st.wins.some(w => w.app === d.app);
      drawIcon(g, appById(d.app), d.x, d.y, d.size, d.app === desk.st.focus);
      if (isOpen) { g.fillStyle = d.app === desk.st.focus ? STYLE.accent : STYLE.dim; g.beginPath(); g.arc(d.x + d.size / 2, d.y + d.size + 4, 2.2, 0, 7); g.fill(); }
    }
    t.needsUpdate = true;
    desk.dirty = false;
  }
  say('Welcome home.', "type 'help' to look around.");

  // Vertical screen: code scrolling by.
  S.code = surface(340, 600);
  // Real code from his profile README (profile-art/src/live.js), scrolling by.
  const CODE = ["// profile-art/src/live.js", "// Moon phase from a known new moon: 0 new, 0.5 full.", "R.moonPhase = function (date) {", "  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);", "  const p = (((date.getTime() - ref) / DAY) % syn + syn) % syn / syn;", "  return { phase: p, illum: (1 - Math.cos(2 * Math.PI * p)) / 2, waxing: p < 0.5 };", "};", "R.season = function (date) {", "  const v = R.vanTime(date), md = v.m * 100 + v.d;", "  if (md >= 1221 || md < 320) return 'winter';", "  if (md < 621) return 'spring';", "  if (md < 923) return 'summer';", "  return 'autumn';", "};", "", "// ---------- The 21 date themes he kept. Lower priority number wins when two overlap.", "function nowruz(y) {", "  const Y = (y - 2000) / 1000;", "  const jde = 2451623.80984 + 365242.37404 * Y + 0.05169 * Y * Y - 0.00411 * Y ** 3 - 0.00057 * Y ** 4;", "  const t = new Date((jde - 2440587.5) * DAY + 3.5 * 3600000);", "  const day = D(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());", "  return t.getUTCHours() >= 12 ? day + DAY : day;", "}", "const nthWeekday = (y, m, dow, nth) => { let t = D(y, m, 1); while (new Date(t).getUTCDay() !== dow) t += DAY; return t + (nth - 1) * 7 * DAY; };", ""];
  let codeScroll = 0;
  function drawCode() {
    const { g, c, t } = S.code;
    g.fillStyle = '#080c12'; g.fillRect(0, 0, c.width, c.height);
    g.font = `15px ${MONO}`;
    for (let i = 0; i < 34; i++) {
      const n = (Math.floor(codeScroll) + i) % CODE.length, l = CODE[n];
      const y = 24 + i * 18 - (codeScroll % 1) * 18;
      g.fillStyle = '#3a4456'; g.fillText(String(n + 1).padStart(2, ' '), 8, y);
      g.fillStyle = /^\s*\/\//.test(l) ? '#6a7690' : /export|const|async|await|for|while|function|return/.test(l) ? '#c792ea' : '#cfd8e8';
      g.fillText(l, 38, y);
    }
    t.needsUpdate = true;
  }

  // Little screens: his live contributions, training loss, Pishi cam.
  S.contrib = surface(320, 190);
  const contrib = makeContrib(S.contrib, { store: local, font: MONO });
  S.loss = surface(320, 190);
  const lossPts = [];
  const lr = seeded(5);
  for (let i = 0; i < 120; i++) lossPts.push(2.4 * Math.exp(-i / 28) + 0.05 + lr() * 0.12 * Math.exp(-i / 60));
  let lossHead = 30;
  function drawLoss() {
    const { g, c, t } = S.loss;
    g.fillStyle = '#0a0f15'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#1c2533'; g.lineWidth = 1;
    for (let y = 50; y < 180; y += 32) { g.beginPath(); g.moveTo(12, y); g.lineTo(308, y); g.stroke(); }
    g.strokeStyle = '#ff9f5a'; g.lineWidth = 2.5; g.beginPath();
    const n = Math.floor(lossHead);
    for (let i = 0; i < n; i++) { const x = 12 + i / 119 * 296, y = 176 - (1 - Math.min(1, lossPts[i] / 2.6)) * 0 - lossPts[i] / 2.6 * 130; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = '#7f8aa0'; g.font = `14px ${MONO}`; g.fillText('train/loss', 12, 22);
    g.fillStyle = '#ff9f5a'; g.fillText(lossPts[Math.max(0, n - 1)].toFixed(4), 220, 22);
    t.needsUpdate = true;
  }
  // The Pishi cam's screen; src/pishicam.js draws it.
  S.pishi = surface(320, 190);

  // Outside the window: Vancouver by the real sun and weather, North Shore mountains, Grouse runs, Lions Gate lights.
  S.backdrop = surface(2048, 750);
  const outside = new Outside(S.backdrop);
  outside.draw(new Date());

  // The world map desk mat, the pomodoro cube and the neon sign over the about board.
  S.mat = surface(2048, 822);
  S.timer = surface(220, 150);
  S.neon = surface(1300, 320);
  const holiday = holidayAt(new Date());
  const neon = () => drawNeon(S.neon, holiday ? holiday.text : 'hello, friend.', holiday ? holiday.c.hot : '#ff6a5c');
  drawWorldMat(S.mat);
  drawTimer(S.timer, performance.now());
  neon();
  document.fonts.load("190px 'Pacifico'").then(neon).catch(() => {});
  document.fonts.ready.then(() => { drawWorldMat(S.mat); neon(); panels?.redrawAll(); });

  // The post-it: his tattoo in Nastaliq, bottom right of the main screen.
  S.postit = surface(512, 512);
  function drawPostit() {
    const { g, c, t } = S.postit;
    const p = g.createLinearGradient(0, 0, 0, c.height);
    p.addColorStop(0, '#fff1a6'); p.addColorStop(0.85, '#f8dc6a'); p.addColorStop(1, '#e9c552');
    g.fillStyle = p; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, c.width, 70);
    g.fillStyle = '#211b15';
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    // Size each line to the note's width, like it was written to fit.
    for (const [i, line] of TATTOO.entries()) {
      // Nastaliq strokes reach past the advance width, so fit and centre on the inked extent.
      let px = 110;
      g.font = `500 ${px}px 'Noto Nastaliq Urdu', serif`;
      let m = g.measureText(line), ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (ink > 400) { px = Math.floor(px * 400 / ink); g.font = `500 ${px}px 'Noto Nastaliq Urdu', serif`; m = g.measureText(line); }
      const x = c.width / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
      g.fillText(line, x, i ? 340 : 180);
    }
    t.needsUpdate = true;
  }
  drawPostit();
  document.fonts.load(`500 130px 'Noto Nastaliq Urdu'`, TATTOO.join(' ')).then(drawPostit).catch(() => {});
  document.fonts.ready.then(() => { drawPostit(); drawDesktop(); });

  S.onair = surface(256, 70);
  (() => {
    const { g, c, t } = S.onair;
    g.fillStyle = '#1a0405'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ff2a20'; g.font = `700 40px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ON AIR', c.width / 2, c.height / 2 + 2);
    t.needsUpdate = true;
  })();

  const panels = makePanels(surface, { weather: () => outside.weather || 'clear', holiday, videos: opts.videos || (() => []), projects: meta.projects || [] });
  Object.assign(S, panels.S);
  for (const [k, v] of Object.entries(S)) T[k] = v.t;
  let acc = 0, slow = 0, sec = -1, backdrop = true;
  return {
    textures: T,
    outside,
    holiday,
    // The 3D outside replaces the painted backdrop, so its half-minute repaint (a big upload, a stall) stops.
    stopBackdrop() { backdrop = false; },
    showUnlocks: ids => panels.showUnlocks(ids),
    // `near`: the desk's screens are in sight; out of sight they are not repainted (each repaint is an upload).
    tick(now, dt, focused, near = true) {
      acc += dt; slow += dt;
      if (near && Math.floor(now / 1000) !== sec) { sec = Math.floor(now / 1000); drawTimer(S.timer, now); }
      if (backdrop) outside.tick(now);
      panels.tick(Date.now());
      if (near && acc > 0.12) { acc = 0; codeScroll += 0.45; drawCode(); if (lossHead < 120) { lossHead += 0.6; drawLoss(); } else if (slow > 6) { lossHead = 20; slow = 0; } }
      // The caret blinks on the monitor only while it shows; under the seated view the page draws its own.
      if (focused && !desk.covered) { const b = Math.floor(now / 500); if (b !== term.blink) { term.blink = b; desk.dirty = true; } }
      if (Math.floor(now / 1000) !== desk.clockSec) {
        desk.clockSec = Math.floor(now / 1000);
        const clock = clockText(new Date());
        if (clock !== desk.ctx.clock) { desk.ctx.clock = clock; changed(); }
      }
      // A repaint is an upload, so it waits until the screen is in sight, and runs at most a few times a second; while
      // the seated view covers the screen, once every half second is plenty.
      if (near && desk.dirty && now - desk.drawn > (desk.covered ? 500 : 70)) { desk.drawn = now; drawDesktop(); }
    },
    focusTerminal(on) { term.focus = on; changed(); },
    // The desktop's model, shared with the seated view.
    desktop: {
      get st() { return desk.st; },
      get term() { return term; },
      get notes() { return desk.notes; },
      set notes(v) { desk.notes = v; saveNotes(v); changed(); },
      get calc() { return desk.calc; },
      calcPress(key) { calcPress(desk.calc, key); changed(); },
      get browser() { return desk.browser; },
      browserGo(id) { const ok = browserGo(desk.browser, id); if (ok) changed(); return ok; },
      get games() { return desk.games; },
      set sfx(v) { desk.sfx = v; },
      setCtx(patch) { Object.assign(desk.ctx, patch); changed(); },
      get ctx() { return desk.ctx; },
      set covered(on) { desk.covered = on; if (!on) desk.dirty = true; },
      changed,
      listen(fn) { desk.listeners.push(fn); },
      get wallpaper() { return desk.ctx.wallpaper; },
      setWallpaper(id) {
        if (id !== 'plain' && !WALLPAPERS.includes(id)) return false;
        if (desk.ctx.wallpaper !== id) { desk.ctx.wallpaper = id; saveWallpaper(id); changed(); }
        return true;
      },
      // The wallpaper as a picture the seated view can put behind its windows (made once per wallpaper), or null.
      wallpaperURL() { const wp = wallpaper(); if (!wp) return null; wp.url ||= wp.c.toDataURL('image/jpeg', 0.9); return wp.url; },
      get reader() { return desk.reader; },
      readerGo(act) { const ok = readerGo(desk.reader, act); if (ok) changed(); return ok; },
    },
    // Letters typed by something other than me (Pishi on the keyboard), on their own line so mine stay intact.
    type(text) { keepOpen(desk.st, 'terminal'); say('$ ' + text.slice(0, 40), `command not found: ${text.slice(0, 40)}  (that was Pishi)`); },
    // Lines from the house into the terminal as it stands (the DEPLOY button's, while the terminal is open).
    print: (...lines) => say(...lines),
    // Commands the rest of the loft adds: fn(say, argument).
    command(name, fn) { EXTRA[name] = fn; },
    // Up (-1) or Down (+1) through the commands entered, from the line now typed: the line to show, or null.
    recall: (dir, current) => browse(hist, dir, current),
    contrib,
    run(text, exit) {
      const cmd = text.trim().toLowerCase().replace(/\s+/g, ' ');
      openApp(desk.st, 'terminal');
      say('$ ' + text.slice(0, 60));
      term.input = '';
      remember(hist, text);
      if (cmd === 'exit') { exit(); return; }
      const [word, ...rest] = cmd.split(' ');
      let hello = null;
      // The commands that were here first keep every line they took, print "hello world" included.
      if (CMDS[cmd]) CMDS[cmd]();
      else if (Object.hasOwn(EXTRA, word)) EXTRA[word](say, rest.join(' '));
      else if ((hello = helloWorld(text))) say(...hello.lines);
      else if (cmd) say(`command not found: ${cmd}. try 'help'`);
      if (cmd) dispatchEvent(new CustomEvent('loft:cmd', { detail: { cmd, say, hello: !!hello } }));
      changed();
    },
    terminalKey(e, exit) {
      if (e.key === 'Escape') { exit(); return; }
      // With the calculator in front the keyboard is the calculator's: the keys it knows work it, and any other
      // letter, the space bar or Tab does nothing (none of them may spill into the terminal or bring it forward).
      if (desk.st.focus === 'calc') {
        // With Ctrl, Cmd or Alt held the key is the browser's own (a shortcut), not the calculator's and not the terminal's.
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = calcKey(e.key);
        if (k) { calcPress(desk.calc, k); changed(); }
        if (k || e.key.length === 1 || e.key === 'Tab') { e.preventDefault(); return; }
      }
      // Typing at the desk goes to the terminal, bringing it to the front first if something else is.
      if (desk.st.focus !== 'terminal') {
        if (e.key.length !== 1 && e.key !== 'Enter' && e.key !== 'Tab') return;
        openApp(desk.st, 'terminal'); changed();
      }
      if (e.key === 'Tab') {
        const names = [...Object.keys(CMDS), ...Object.keys(EXTRA), 'exit'].filter(n => term.input && n.startsWith(term.input.toLowerCase()));
        if (names.length === 1) { term.input = names[0]; changed(); } else if (names.length > 1) say(names.join('  '));
      } else if (e.key === 'Enter') { this.run(term.input, exit); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const line = browse(hist, e.key === 'ArrowUp' ? -1 : 1, term.input); if (line !== null) { term.input = line; changed(); } }
      else if (e.key === 'Backspace') { term.input = term.input.slice(0, -1); changed(); }
      else if (e.key.length === 1 && term.input.length < 60) { term.input += e.key; changed(); }
      e.preventDefault();
    },
  };
}
