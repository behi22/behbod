import * as THREE from 'three';
import { drawWorldMat, drawTimer, drawNeon, Outside, holidayAt } from './room2.js';
import { makePanels } from './panels.js';

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

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function makeCanvases(meta, opts = {}) {
  const S = {};
  const T = {};

  // Main ultrawide: a terminal you can type into.
  S.main = surface(1536, 646);
  const term = { lines: [], input: '', focus: false, blink: 0 };
  const say = (...ls) => { term.lines.push(...ls); while (term.lines.length > 15) term.lines.shift(); drawTerm(); };
  const CMDS = {
    help: () => say('commands: whoami  projects  postit  ls  contact  clear  exit'),
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
    clear: () => { term.lines = []; drawTerm(); },
  };
  function drawTerm() {
    const { g, c, t } = S.main;
    g.fillStyle = '#070b11'; g.fillRect(0, 0, c.width, c.height);
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, 'rgba(62,230,196,.06)'); grd.addColorStop(1, 'rgba(120,80,255,.05)');
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#0d1520'; g.fillRect(0, 0, c.width, 46);
    for (const [i, col] of ['#ff5f57', '#febc2e', '#28c840'].entries()) { g.fillStyle = col; g.beginPath(); g.arc(30 + i * 26, 23, 8, 0, 7); g.fill(); }
    g.fillStyle = '#7f8aa0'; g.font = `22px ${MONO}`; g.fillText('behbod@loft: ~', 120, 31);
    g.font = `30px ${MONO}`;
    let y = 96;
    for (const l of term.lines) { g.fillStyle = l.startsWith('$') ? '#3ee6c4' : '#d8e0ee'; g.fillText(l, 36, y); y += 36; }
    g.fillStyle = '#3ee6c4'; g.fillText('$ ' + term.input + (term.focus && term.blink % 2 ? '█' : ''), 36, y);
    if (!term.focus) { g.fillStyle = '#5b6478'; g.font = `24px ${MONO}`; g.fillText('press E at the desk to type', 36, c.height - 30); }
    t.needsUpdate = true;
  }
  say('Welcome to the loft.', "type 'help' to look around.");

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

  // Little screens: contributions, training loss, Pishi cam.
  S.contrib = surface(320, 190);
  (() => {
    const { g, c, t } = S.contrib, r = seeded(22);
    g.fillStyle = '#0a0f15'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#7f8aa0'; g.font = `14px ${MONO}`; g.fillText('contributions', 12, 22);
    const pal = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
    for (let x = 0; x < 52; x++) for (let y = 0; y < 7; y++) { const v = r(); g.fillStyle = pal[v < 0.25 ? 0 : v < 0.5 ? 1 : v < 0.72 ? 2 : v < 0.9 ? 3 : 4]; g.fillRect(12 + x * 5.6, 40 + y * 18, 4.6, 15); }
    t.needsUpdate = true;
  })();
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
  S.pishi = surface(320, 190);
  function drawPishi(now) {
    const { g, c, t } = S.pishi;
    g.fillStyle = '#121418'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#23262d'; g.beginPath(); g.ellipse(160, 150, 110, 30, 0, 0, 7); g.fill();
    const br = 1 + Math.sin(now / 900) * 0.03;
    g.fillStyle = '#7b7f87'; g.beginPath(); g.ellipse(160, 128, 64 * br, 30 * br, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(108, 116, 28, 22, -0.3, 0, 7); g.fill();
    g.beginPath(); g.moveTo(92, 100); g.lineTo(98, 82); g.lineTo(108, 97); g.fill();
    g.beginPath(); g.moveTo(112, 96); g.lineTo(124, 82); g.lineTo(126, 100); g.fill();
    g.strokeStyle = '#7b7f87'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(222, 130); g.quadraticCurveTo(250, 150, 210, 160); g.stroke();
    g.strokeStyle = '#3c3f46'; g.lineWidth = 2; g.beginPath(); g.moveTo(98, 114); g.lineTo(108, 116); g.moveTo(112, 116); g.lineTo(120, 113); g.stroke();
    g.fillStyle = '#d2d6de'; g.font = `13px ${MONO}`; g.fillText('CAM 02 · PISHI', 12, 22);
    if (Math.floor(now / 700) % 2) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(300, 17, 6, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.04)';
    for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
    t.needsUpdate = true;
  }

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
  document.fonts.ready.then(() => { drawPostit(); drawTerm(); });

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
  let acc = 0, slow = 0, sec = -1;
  return {
    textures: T,
    outside,
    holiday,
    tick(now, dt, focused) {
      acc += dt; slow += dt;
      if (Math.floor(now / 1000) !== sec) { sec = Math.floor(now / 1000); drawTimer(S.timer, now); }
      outside.tick(now);
      panels.tick(Date.now());
      if (acc > 0.12) { acc = 0; codeScroll += 0.45; drawCode(); drawPishi(now); if (lossHead < 120) { lossHead += 0.6; drawLoss(); } else if (slow > 6) { lossHead = 20; slow = 0; } }
      if (focused) { const b = Math.floor(now / 500); if (b !== term.blink) { term.blink = b; drawTerm(); } }
    },
    focusTerminal(on) { term.focus = on; drawTerm(); },
    run(text, exit) {
      const cmd = text.trim().toLowerCase();
      say('$ ' + text.slice(0, 60));
      term.input = '';
      if (cmd === 'exit') { exit(); return; }
      if (cmd) (CMDS[cmd] || (() => say(`command not found: ${cmd}. try 'help'`)))();
      if (cmd) dispatchEvent(new CustomEvent('loft:cmd', { detail: { cmd, say } }));
      drawTerm();
    },
    terminalKey(e, exit) {
      if (e.key === 'Escape') { exit(); return; }
      if (e.key === 'Enter') { this.run(term.input, exit); }
      else if (e.key === 'Backspace') { term.input = term.input.slice(0, -1); drawTerm(); }
      else if (e.key.length === 1 && term.input.length < 60) { term.input += e.key; drawTerm(); }
      e.preventDefault();
    },
  };
}
