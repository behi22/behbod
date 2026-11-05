// The loft's other screens and prints, each a canvas: the boards, frames, labels and little displays around the
// world. Anything that needs a server (Spotify, the guestbook, the range scores) says so until that part is built.
import { drawGirih, drawPoster, drawProject, vanTime } from './room2.js';
import { holidayAt } from './src/pure/calendar.js';

const MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace";
const NASTALIQ = "'Noto Nastaliq Urdu', serif";
const TATTOO = ['بنگر و بشنو،', 'بگذر و به شو'];
const PROJECTS = {
  'meet-bex': ['a voice AI host you just talk to', 'voice'],
  'profile-art': ['my GitHub profile, redrawn every hour', 'grid'],
  'aic-voice-microsite': ['a voice agent for restaurants, shown off', 'voice'],
  'visitor-classifier': ['reads a site, sorts its visitors by interest', 'grid'],
  behbod: ['this home, built from scratch', 'grid'],
};
const DAYS = 864e5;

function text(g, s, x, y, px, col, weight = 400, font = MONO, align = 'left') {
  g.font = `${weight} ${px}px ${font}`; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y);
}
// The next holiday after today, worked out once a day (it walks the calendar forward day by day).
const nextCache = { day: '', val: null };
function nextHoliday(now) {
  const v = vanTime(now), day = `${v.y}-${v.m}-${v.d}`;
  if (nextCache.day === day) return nextCache.val;
  let best = null;
  for (let d = 1; d < 120 && !best; d++) { const h = holidayAt(new Date(now.getTime() + d * DAYS)); if (h) best = { ...h, days: d }; }
  nextCache.day = day; nextCache.val = best;
  return best;
}

export function makePanels(surface, ctx) {
  const S = {}, live = [], draws = {};
  const add = (key, w, h, draw, every = 0) => {
    S[key] = surface(w, h);
    const f = draws[key] = now => { draw(S[key].g, S[key].c, now); S[key].t.needsUpdate = true; };
    f(Date.now());
    if (every) live.push({ f, every, last: 0 });
  };

  // The 27 inch over the ultrawide: Vancouver time, the weather and the next holiday.
  add('top', 640, 360, (g, c) => {
    const v = vanTime(new Date()), w = ctx.weather();
    g.fillStyle = '#07090d'; g.fillRect(0, 0, c.width, c.height);
    text(g, 'VANCOUVER', 32, 52, 20, '#7f8aa0', 700);
    text(g, `${String(v.h).padStart(2, '0')}:${String(v.min).padStart(2, '0')}`, 32, 150, 96, '#e8edf5', 700);
    text(g, w, 34, 200, 26, '#3ee6c4');
    const n = nextHoliday(new Date());
    text(g, n ? `next: ${n.text}, in ${n.days} day${n.days > 1 ? 's' : ''}` : '', 34, 300, 22, '#a3acbd');
    for (let i = 0; i < 24; i++) { const hgt = 30 + 40 * Math.abs(Math.sin(i * 0.7 + Date.now() / 4000)); g.fillStyle = i % 3 ? '#1b2533' : '#3ee6c4'; g.fillRect(400 + i * 9, 230 - hgt, 6, hgt); }
  }, 1000);

  // The laptop on its dock: this world's own code, in an editor.
  add('laptop', 560, 360, (g, c) => {
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#161b22'; g.fillRect(0, 0, c.width, 30); g.fillRect(0, 30, 120, c.height);
    text(g, 'world.js · behbod', 140, 20, 14, '#8b949e');
    ['src/', '  engine.js', '  world.js', '  me.js', '  desk.js', 'blender/', '  zones/', '  lib/'].forEach((l, i) => text(g, l, 10, 54 + i * 22, 13, i === 2 ? '#e6edf3' : '#8b949e'));
    const code = ['// The zones\' baked geometry plus', '// everything lit or moved at runtime.', 'export function makeWorld(scene, zones) {', '  for (const z of zones) {', '    scene.add(z);', '    z.traverse(o => {', '      if (o.name.endsWith(\'_baked\'))', '        o.material = baked(o);', '    });', '  }', '}'];
    code.forEach((l, i) => text(g, l, 140, 58 + i * 24, 15, l.startsWith('//') ? '#6a7690' : /export|const|for|if/.test(l) ? '#c792ea' : '#cfd8e8'));
  });

  add('phone', 132, 270, (g, c) => {
    const v = vanTime(new Date());
    const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#1a1340'); gr.addColorStop(1, '#0a2a3a');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    text(g, `${String(v.h).padStart(2, '0')}:${String(v.min).padStart(2, '0')}`, 66, 80, 34, '#fff', 300, MONO, 'center');
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(12, 150, 108, 40);
    text(g, 'build passed', 66, 175, 12, '#d8e0ee', 400, MONO, 'center');
  }, 1000);

  // The arcade cabinet's attract screen.
  add('arcade', 500, 400, (g, c, now) => {
    g.fillStyle = '#05030f'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,80,255,${0.2 + (i % 5) * 0.1})`; g.fillRect((i * 97 + now / 20) % 500, (i * 53) % 400, 3, 3); }
    text(g, 'STRIKER 22', 250, 140, 48, '#3ee6c4', 700, MONO, 'center');
    text(g, 'a penalty shootout', 250, 185, 20, '#b197fc', 400, MONO, 'center');
    if (Math.floor(now / 600) % 2) text(g, 'INSERT COIN', 250, 300, 28, '#ffd34d', 700, MONO, 'center');
  }, 600);

  // The glass board: what I am planning, in marker.
  add('board', 1300, 600, (g, c) => {
    g.fillStyle = '#e9eef0'; g.fillRect(0, 0, c.width, c.height);
    text(g, 'home', 60, 90, 56, '#1c3d8f', 700);
    [['the whole world', true], ['the character, refined', false], ['piano, records, Spotify', false], ['holo range game', false], ['guestbook + mailbox', false], ['launch: behbod.dev', false]]
      .forEach(([l, done], i) => { text(g, (done ? '✓ ' : '□ ') + l, 70, 170 + i * 66, 40, done ? '#1f8a4c' : '#2b2b2b', 600); });
    g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.beginPath(); g.moveTo(760, 140); g.bezierCurveTo(900, 120, 1000, 260, 1100, 220); g.stroke();
    text(g, 'stay curious', 860, 470, 54, '#c0392b', 700, "'Pacifico', cursive");
  });

  add('poster', 560, 800, () => drawPoster(S.poster));
  add('girih', 640, 640, () => drawGirih(S.girih));

  // YouTube's thumbnails (served with open CORS, so the canvas stays usable as a texture), redrawn when they arrive.
  const thumbs = {};
  const thumb = (id, redraw) => {
    if (!thumbs[id]) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { thumbs[id].ok = true; thumbs[id].waiting.forEach(f => f()); };
      img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      thumbs[id] = { img, ok: false, waiting: [] };
    }
    if (!thumbs[id].ok) thumbs[id].waiting.push(redraw);
    return thumbs[id].ok ? thumbs[id].img : null;
  };
  // hqdefault is 4:3 with black bars; draw its 16:9 middle.
  const drawThumb = (g, img, x, y, w, h) => g.drawImage(img, 0, img.height * 0.125, img.width, img.height * 0.75, x, y, w, h);
  const play = (g, cx, cy, s) => { g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(cx, cy, s, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - s * 0.35, cy - s * 0.5); g.lineTo(cx - s * 0.35, cy + s * 0.5); g.lineTo(cx + s * 0.55, cy); g.fill(); };

  // The lounge TV: a channel of the videos, flipped one at a time with E.
  add('tv', 1280, 720, (g, c) => {
    g.fillStyle = '#05070b'; g.fillRect(0, 0, c.width, c.height);
    text(g, 'the channel', 60, 100, 60, '#e8edf5', 700);
    const vids = ctx.videos();
    for (let i = 0; i < 3; i++) {
      const v = vids[i], x = 60 + i * 400, img = v && thumb(v.id, () => draws.tv(Date.now()));
      g.fillStyle = '#121826'; g.fillRect(x, 180, 360, 203);
      if (img) drawThumb(g, img, x, 180, 360, 203);
      play(g, x + 180, 281, 34);
      text(g, v ? v.title : 'coming soon', x, 430, 22, '#d8e0ee');
      if (v?.by) text(g, 'by ' + v.by, x, 462, 18, '#7f8aa0');
    }
    text(g, vids.length > 3 ? `and ${vids.length - 3} more · press E to watch` : 'press E to watch', 60, 640, 28, '#3ee6c4');
  });

  // The BEHI 22 keeper jersey in its frame (the black kit).
  add('jersey', 720, 920, g => {
    g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 720, 920);
    g.fillStyle = '#121214'; g.beginPath();
    g.moveTo(230, 120); g.lineTo(300, 90); g.quadraticCurveTo(360, 140, 420, 90); g.lineTo(490, 120); g.lineTo(640, 260); g.lineTo(570, 340); g.lineTo(520, 300);
    g.lineTo(520, 800); g.lineTo(200, 800); g.lineTo(200, 300); g.lineTo(150, 340); g.lineTo(80, 260); g.closePath(); g.fill();
    g.strokeStyle = '#7b2ff7'; g.lineWidth = 10; g.stroke();
    text(g, 'BEHI', 360, 360, 80, '#e8e3d8', 700, MONO, 'center');
    text(g, '22', 360, 600, 220, '#e8e3d8', 700, MONO, 'center');
  });

  // The welcome mat: a line from Mr. Robot.
  add('doormat', 960, 540, g => {
    g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, 960, 540);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + (i % 7) * 0.02})`; g.fillRect((i * 37) % 960, (i * 53) % 540, 2, 2); }
    text(g, 'are you a 1 or a 0?', 480, 300, 72, '#d9c7a3', 700, MONO, 'center');
  });

  // The QR code by the door points at my GitHub until behbod.dev is live.
  add('qr', 220, 220, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 220, 220); text(g, 'github.com/behi22', 110, 115, 14, '#111', 700, MONO, 'center'); });
  import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm').then(m => {
    const qr = (m.default || m)(0, 'M'); qr.addData('https://github.com/behi22'); qr.make();
    const { g } = S.qr, n = qr.getModuleCount(), cell = Math.floor(200 / n), off = (220 - cell * n) / 2;
    g.fillStyle = '#fff'; g.fillRect(0, 0, 220, 220); g.fillStyle = '#111';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell);
    S.qr.t.needsUpdate = true;
  }).catch(() => {});

  // The holiday corner: today's holiday from the README's calendar, or the next one.
  add('holiday', 1020, 620, g => {
    const h = ctx.holiday, n = h ? null : nextHoliday(new Date());
    g.fillStyle = h ? h.c.hot : '#14161c'; g.fillRect(0, 0, 1020, 620);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 1020, 620);
    text(g, h ? h.text : 'no holiday today', 510, 290, 70, '#fff', 700, MONO, 'center');
    text(g, h ? 'from the calendar on my GitHub profile' : n ? `next: ${n.text}, in ${n.days} days` : '', 510, 380, 32, '#e8edf5', 400, MONO, 'center');
  });

  // The about board, made like an airport departure board.
  add('about', 1020, 580, g => {
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 1020, 580);
    const rows = [['NAME', 'BEHBOD BABAI'], ['BASED', 'VANCOUVER'], ['BUILDS', 'VOICE AI AGENTS'], ['LOVES', 'REAL MADRID'], ['STATUS', 'ON TIME']];
    text(g, 'ABOUT', 40, 70, 34, '#ffcc33', 700);
    rows.forEach(([k, v], i) => {
      text(g, k, 40, 160 + i * 84, 30, '#8a8a8a', 700);
      for (let j = 0; j < v.length; j++) { g.fillStyle = '#1d1d1d'; g.fillRect(300 + j * 38, 124 + i * 84, 34, 50); text(g, v[j], 317 + j * 38, 162 + i * 84, 34, '#ffcc33', 700, MONO, 'center'); }
    });
  });

  add('resume', 200, 270, g => {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 200, 270);
    text(g, 'RESUME', 100, 36, 22, '#222', 700, MONO, 'center');
    for (let i = 0; i < 9; i++) { g.fillStyle = '#c9c4b8'; g.fillRect(24, 60 + i * 20, i % 3 === 0 ? 100 : 152, 6); }
    text(g, 'coming soon', 100, 250, 14, '#888', 400, MONO, 'center');
  });

  add('guestbook', 760, 520, g => {
    g.fillStyle = '#efe7d6'; g.fillRect(0, 0, 760, 520);
    g.fillStyle = '#d8ccb4'; g.fillRect(376, 0, 8, 520);
    text(g, 'guestbook', 190, 80, 40, '#3a2a1c', 700, "'Pacifico', cursive", 'center');
    for (let i = 0; i < 7; i++) { g.fillStyle = '#cfc2a8'; g.fillRect(420, 90 + i * 56, 300, 3); }
    text(g, 'opens when its', 190, 260, 26, '#5a4a3a', 400, MONO, 'center');
    text(g, 'server is built', 190, 300, 26, '#5a4a3a', 400, MONO, 'center');
  });

  add('book', 760, 520, g => {
    g.fillStyle = '#f1ead8'; g.fillRect(0, 0, 760, 520);
    g.fillStyle = '#d9ceb4'; g.fillRect(376, 0, 8, 520);
    text(g, 'home', 190, 90, 44, '#3a1e12', 700, "'Pacifico', cursive", 'center');
    text(g, 'chapter one', 190, 150, 26, '#5a3a2a', 400, MONO, 'center');
    for (let i = 0; i < 12; i++) { g.fillStyle = '#c8bca2'; g.fillRect(410, 60 + i * 34, i % 4 === 3 ? 180 : 300, 4); }
  });

  // The nastaliq in light along the mezzanine's back wall: my tattoo.
  add('nastaliq', 2200, 450, g => {
    g.clearRect(0, 0, 2200, 450); g.fillStyle = '#000'; g.fillRect(0, 0, 2200, 450);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ffb060'; g.shadowBlur = 40; g.fillStyle = '#ffd9a0';
    g.font = `500 170px ${NASTALIQ}`; g.fillText(TATTOO.join(' '), 1100, 230);
    g.shadowBlur = 0; g.direction = 'ltr';
  });
  document.fonts?.load(`500 130px 'Noto Nastaliq Urdu'`, TATTOO.join(' ')).then(() => redraw('nastaliq')).catch(() => {});

  add('sheet', 420, 280, g => {
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 420, 280);
    for (let s = 0; s < 3; s++) for (let l = 0; l < 5; l++) { g.fillStyle = '#333'; g.fillRect(20, 40 + s * 80 + l * 8, 380, 1.5); }
    for (let i = 0; i < 24; i++) { g.fillStyle = '#111'; g.beginPath(); g.ellipse(40 + (i % 8) * 46, 48 + Math.floor(i / 8) * 80 + ((i * 3) % 5) * 4, 6, 4.5, -0.4, 0, 7); g.fill(); }
  });

  // Spotify: placeholders until the small server that keeps my login is built.
  add('nowplaying', 256, 256, g => {
    g.fillStyle = '#1db954'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(128, 128, 10, 0, 7); g.fill();
    text(g, 'NOW PLAYING', 128, 90, 18, '#111', 700, MONO, 'center');
    text(g, 'soon', 128, 180, 22, '#111', 700, MONO, 'center');
  });
  add('recent', 480, 320, g => {
    g.fillStyle = '#0d0f12'; g.fillRect(0, 0, 480, 320);
    text(g, 'recently played', 24, 44, 24, '#1db954', 700);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#1b1f26'; g.fillRect(24, 70 + i * 56, 44, 44); g.fillStyle = '#2a303a'; g.fillRect(84, 80 + i * 56, 220, 10); g.fillRect(84, 100 + i * 56, 140, 8); }
    text(g, 'Spotify, coming soon', 24, 300, 16, '#7f8aa0');
  });
  add('albums', 1140, 744, g => {
    g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, 1140, 744);
    const hues = [280, 170, 20, 330, 200, 45];
    for (let i = 0; i < 6; i++) {
      const x = (i % 3) * 396, y = Math.floor(i / 3) * 396, gr = g.createLinearGradient(x, y, x + 336, y + 336);
      gr.addColorStop(0, `hsl(${hues[i]},70%,45%)`); gr.addColorStop(1, `hsl(${hues[i] + 40},60%,18%)`);
      g.fillStyle = gr; g.fillRect(x, y, 336, 336);
      text(g, `top track ${i + 1}`, x + 20, y + 310, 24, 'rgba(255,255,255,.85)', 700);
    }
  });

  // The wall screen: the weather now and this month's calendar with today and the holidays marked.
  add('wall', 1360, 760, g => {
    const now = new Date(), v = vanTime(now);
    g.fillStyle = '#07090d'; g.fillRect(0, 0, 1360, 760);
    text(g, ctx.weather(), 60, 140, 80, '#e8edf5', 700);
    text(g, 'Vancouver', 60, 200, 30, '#7f8aa0');
    const first = new Date(Date.UTC(v.y, v.m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(v.y, v.m, 0)).getUTCDate();
    text(g, new Date(Date.UTC(v.y, v.m - 1, 15)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }), 640, 90, 40, '#3ee6c4', 700);
    'SMTWTFS'.split('').forEach((d, i) => text(g, d, 660 + i * 92, 150, 26, '#7f8aa0', 700, MONO, 'center'));
    for (let d = 1; d <= days; d++) {
      const cell = first + d - 1, x = 660 + (cell % 7) * 92, y = 210 + Math.floor(cell / 7) * 90;
      const hol = holidayAt(new Date(Date.UTC(v.y, v.m - 1, d, 19)));
      if (d === v.d) { g.fillStyle = '#3ee6c4'; g.beginPath(); g.arc(x, y - 10, 34, 0, 7); g.fill(); }
      else if (hol) { g.strokeStyle = hol.c.hot; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 10, 34, 0, 7); g.stroke(); }
      text(g, String(d), x, y, 30, d === v.d ? '#05070b' : '#e8edf5', 700, MONO, 'center');
    }
  }, 60000);

  // The holo range: the console and the scoreboard.
  add('console', 260, 440, g => {
    g.fillStyle = '#031018'; g.fillRect(0, 0, 260, 440);
    text(g, 'HOLO', 130, 120, 44, '#5fd0ff', 700, MONO, 'center');
    text(g, 'RANGE', 130, 170, 44, '#5fd0ff', 700, MONO, 'center');
    text(g, 'soon', 130, 320, 26, '#9be3ff', 400, MONO, 'center');
  });
  add('range', 1500, 500, g => {
    g.fillStyle = '#020a10'; g.fillRect(0, 0, 1500, 500);
    text(g, 'HIGH SCORE', 750, 180, 80, '#5fd0ff', 700, MONO, 'center');
    text(g, '000000', 750, 340, 140, '#ffffff', 700, MONO, 'center');
  });
  for (const [k, label] of [['unlock_kit', 'keeper kit'], ['unlock_gold', 'gold'], ['unlock_visor', 'red visor']]) {
    add(k, 260, 80, g => { g.fillStyle = '#05080c'; g.fillRect(0, 0, 260, 80); text(g, 'LOCKED', 130, 34, 22, '#5fd0ff', 700, MONO, 'center'); text(g, label, 130, 64, 18, '#9be3ff', 400, MONO, 'center'); });
  }
  add('backgammon', 460, 320, g => {
    g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 460, 320);
    for (let i = 0; i < 12; i++) {
      const x = 14 + i * 36 + (i >= 6 ? 12 : 0);
      for (const top of [true, false]) { g.fillStyle = (i + (top ? 0 : 1)) % 2 ? '#e8dcc0' : '#8b1e1e'; g.beginPath(); g.moveTo(x, top ? 8 : 312); g.lineTo(x + 32, top ? 8 : 312); g.lineTo(x + 16, top ? 140 : 180); g.fill(); }
    }
    g.fillStyle = '#3a2412'; g.fillRect(224, 0, 12, 320);
  });

  // The project frames up the stairs.
  (ctx.projects || []).forEach((name, i) => { const [line, kind] = PROJECTS[name] || ['', 'grid']; add(`proj${i}`, 600, 450, () => drawProject(S[`proj${i}`], name, line, kind)); });
  // The screening wall: a thumbnail per video slot.
  for (let i = 0; i < 3; i++) {
    add(`video${i}`, 800, 450, g => {
      const v = ctx.videos()[i], img = v && thumb(v.id, () => draws[`video${i}`](Date.now()));
      g.fillStyle = '#0b0e14'; g.fillRect(0, 0, 800, 450);
      if (img) drawThumb(g, img, 0, 0, 800, 450);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 360, 800, 90);
      play(g, 400, 190, 56);
      text(g, v ? v.title : 'video coming soon', 24, 400, 26, '#ffffff', 700);
      if (v?.by) text(g, 'by ' + v.by + ' on YouTube', 24, 432, 18, '#c8d0dc');
    });
  }

  function redraw(key) { draws[key]?.(Date.now()); }
  return {
    S,
    tick(now) { for (const l of live) if (now - l.last > l.every) { l.last = now; l.f(now); } },
    // Once the web fonts arrive, draw everything again so the text uses them.
    redrawAll() { for (const f of Object.values(draws)) f(Date.now()); },
  };
}
