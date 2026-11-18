// House-wide checks, computer and phones: a hidden tab goes quiet and pauses a run; the wardrobe closes when something
// else takes the screen; the calculator's keys are big enough for a finger on a phone held sideways.
//   LOFT_URL=http://127.0.0.1:8815 node test/house.js [hidden|wardrobe|calc|all]
// Headless browsers never hide a page, so the test says it is hidden itself (document.hidden and a visibilitychange).
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const ONLY = process.argv[2] || 'all';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const WORLD = require('../web/assets/world.json');
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

// Other people's services the house reaches (YouTube's player and its pictures, the weather), whose own hiccups are not the house's.
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!OUTSIDE.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// Every sound context the page makes, and when it is told to stop.
function track() {
  const C = window.AudioContext;
  if (!C || window.__ctxs) return;
  window.__ctxs = []; window.__suspends = [];
  window.AudioContext = class extends C { constructor(...a) { super(...a); window.__ctxs.push(this); } };
  const suspend = C.prototype.suspend;
  C.prototype.suspend = function () { window.__suspends.push(performance.now()); return suspend.call(this); };
}
async function open(b, opts, q = 'low') {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  await ctx.addInitScript(track);
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${q}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  return { ctx, p, errs };
}
const hide = (p, hidden) => p.evaluate(h => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  window.__hideAt = performance.now();
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
const sound = p => p.evaluate(() => ({ ctx: window.__ctxs?.[0]?.state || 'none', house: +(__loft.houseGain ?? -1).toFixed(3), records: +__loft.audio.musicLevel().toFixed(3),
  playing: __loft.audio.music.current || null, button: document.getElementById('snd').textContent, suspends: window.__suspends.length,
  waited: window.__suspends.length ? Math.round(window.__suspends.at(-1) - window.__hideAt) : null }));
const card = (p, text) => p.evaluate(t => { const b = [...document.querySelectorAll('.rg-card button')].find(x => x.textContent === t); if (!b) return false; b.click(); return true; }, text);
// The range made ready, the bookcase open, and me at the line with the stage card up.
async function toLine(p) {
  await p.evaluate(() => __loft.range.load());
  await p.waitForFunction(() => __loft.range.ready, null, { timeout: 60000 });
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1200);
  const at = WORLD.interact.find(i => i.id === 'range').at;
  await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...at));
  await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('range'));
  await p.waitForFunction(() => __loft.range.state === 'menu', null, { timeout: 8000 });
}

// ---------- a hidden tab ----------
async function hiddenSound(b) {
  const { ctx, p, errs } = await open(b, DESK);
  await p.click('#snd'); await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('records'));
  await p.waitForTimeout(600);
  const s0 = await sound(p);
  await hide(p, true); await p.waitForTimeout(800);
  const s1 = await sound(p);
  check('hidden: the house\'s sound stops, after a short fade (not cut dead), and its Sound switch and record are left as they were',
    s0.ctx === 'running' && s0.playing && s1.ctx === 'suspended' && s1.waited >= 100 && s1.house === s0.house && s1.playing === s0.playing && s1.button === 'Sound on', JSON.stringify({ s0, s1 }));
  await hide(p, false); await p.waitForTimeout(600);
  const s2 = await sound(p);
  check('shown again: the sound comes back as it was, the record still on', s2.ctx === 'running' && s2.house === s0.house && s2.playing === s0.playing && s2.records === s0.records, JSON.stringify(s2));
  // Away and back in a moment: the fade is turned round and nothing stops.
  await hide(p, true); await p.waitForTimeout(30); await hide(p, false); await p.waitForTimeout(700);
  const s3 = await sound(p);
  check('hidden and shown again within a moment: the sound never stops', s3.ctx === 'running' && s3.suspends === s2.suspends, JSON.stringify(s3));
  // Sound off stays off.
  await p.click('#snd'); await p.waitForTimeout(400);
  await hide(p, true); await p.waitForTimeout(800); await hide(p, false); await p.waitForTimeout(600);
  const s4 = await sound(p);
  check('with the sound switched off, coming back leaves it off', s4.ctx === 'running' && s4.house < 0.01 && s4.button === 'Sound off', JSON.stringify(s4));
  await p.click('#snd'); await p.waitForTimeout(600);
  // Faded for the piano: still faded after.
  await p.evaluate(() => __loft.audio.duckMusic(0, 0.3)); await p.waitForTimeout(800);
  const d0 = await sound(p);
  await hide(p, true); await p.waitForTimeout(800); await hide(p, false); await p.waitForTimeout(600);
  const d1 = await sound(p);
  check('the records faded for the piano stay faded when the page comes back', d0.records < 0.02 && d1.records < 0.02 && d1.ctx === 'running' && Math.abs(d1.house - 0.9) < 0.01, JSON.stringify({ d0, d1 }));
  await p.evaluate(() => __loft.audio.duckMusic(1, 0.3)); await p.waitForTimeout(600);
  // The film hushes the house; hidden and back while it plays, the house stays hushed until it ends.
  await p.evaluate(() => { __loft.playFilm(); }); await p.waitForTimeout(500);
  const f0 = await sound(p);
  await hide(p, true); await p.waitForTimeout(800); await hide(p, false); await p.waitForTimeout(600);
  const f1 = await sound(p), playingF = await p.evaluate(() => __loft.filmPlaying);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1600);
  const f2 = await sound(p);
  check('during the film the house stays hushed through a hidden spell, and comes back when the film ends', f0.house < 0.01 && f1.house < 0.01 && playingF && f2.house > 0.85 && f2.ctx === 'running', JSON.stringify({ f0, f1, f2 }));
  check('desktop: no page errors, console errors or failed requests', errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}
async function hiddenRun(b, opts, label) {
  const { ctx, p, errs } = await open(b, opts);
  await p.click('#snd'); await p.waitForTimeout(400);
  await toLine(p);
  await card(p, 'Start');
  await p.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
  await p.waitForTimeout(500);
  const r0 = await p.evaluate(() => ({ state: __loft.range.state, music: __loft.range.music.on }));
  await hide(p, true); await p.waitForTimeout(800);
  const r1 = await p.evaluate(() => ({ state: __loft.range.state, music: __loft.range.music.on, ctx: window.__ctxs[0].state }));
  await hide(p, false); await p.waitForTimeout(800);
  const r2 = await p.evaluate(() => ({ state: __loft.range.state, music: __loft.range.music.on, ctx: window.__ctxs[0].state, card: [...document.querySelectorAll('.rg-card button')].map(x => x.textContent) }));
  check(`${label}: a run is paused while the page is hidden, its music stopped, and is still paused when the page comes back`,
    r0.state === 'play' && r0.music && r1.state === 'paused' && !r1.music && r1.ctx === 'suspended' && r2.state === 'paused' && r2.ctx === 'running' && r2.card.includes('Resume'), JSON.stringify({ r0, r1, r2 }));
  await card(p, 'Resume');
  await p.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 }).catch(() => {});
  const r3 = await p.evaluate(() => ({ state: __loft.range.state, music: __loft.range.music.on }));
  check(`${label}: Resume carries on with the run and its music`, r3.state === 'play' && r3.music, JSON.stringify(r3));
  // Hidden at the stage card, nothing to pause: the card stays.
  await p.evaluate(() => __loft.range.escape()); await p.waitForTimeout(300);
  await card(p, 'Stages'); await p.waitForTimeout(300);
  await hide(p, true); await p.waitForTimeout(300); await hide(p, false); await p.waitForTimeout(300);
  const r4 = await p.evaluate(() => __loft.range.state);
  check(`${label}: hidden at the stage card, the card stays`, r4 === 'menu', r4);
  check(`${label}: no page errors, console errors or failed requests`, errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}

// ---------- the wardrobe ----------
const wd = p => p.evaluate(() => !!document.querySelector('.wd'));
const toWalk = p => p.waitForFunction(() => __loft.mode === 'walk' && !__loft.filmPlaying && !document.querySelector('.g-overlay, .video'), null, { timeout: 10000 }).then(() => true, () => false);
async function wardrobe(b) {
  const { ctx, p, errs } = await open(b, DESK);
  const esc = () => p.keyboard.press('Escape');
  const cases = [
    ['the saber', () => p.evaluate(() => __loft.act('vader')), esc],
    ['the telescope', () => p.evaluate(() => __loft.act('telescope')), esc],
    ['the penalties', () => p.evaluate(() => __loft.act('penalties')), esc],
    ['the TV menu', () => p.evaluate(() => __loft.act('tv')), esc],
    ['a game', () => p.evaluate(() => __loft.act('arcade')), esc],
    ['the film', () => p.evaluate(() => { __loft.playFilm(); }), esc],
    ['a video', () => p.evaluate(() => __loft.act('video0')), esc],
    ['the desk', () => p.evaluate(() => __loft.useDesk()), () => p.evaluate(() => __loft.leaveDesk())],
    ['the range', async () => { await toLine(p); }, () => p.evaluate(() => __loft.range.exit())],
  ];
  for (const [name, enter, leave] of cases) {
    await p.evaluate(() => __loft.wardrobe.show());
    const before = await wd(p);
    await enter(); await p.waitForTimeout(900);
    const during = await wd(p), mode = await p.evaluate(() => __loft.mode);
    await leave(); const back = await toWalk(p); await p.waitForTimeout(300);
    const after = await wd(p);
    check(`the wardrobe closes when ${name} takes the screen, and stays closed after`, before && !during && !after && back, JSON.stringify({ before, during, after, mode, back }));
  }
  // It still opens and closes as before while walking.
  await p.evaluate(() => __loft.wardrobe.hide());
  await p.keyboard.press('KeyO'); await p.waitForTimeout(200);
  const o1 = await wd(p);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const o2 = await wd(p);
  check('O opens it and Esc closes it while walking', o1 && !o2, JSON.stringify({ o1, o2 }));
  check('wardrobe, desktop: no page errors, console errors or failed requests', errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}
async function wardrobePhone(b, opts, label) {
  const { ctx, p, errs } = await open(b, opts);
  for (const [name, id] of [['the telescope', 'telescope'], ['the penalties', 'penalties']]) {
    await p.evaluate(() => __loft.wardrobe.hide());
    await p.tap('#closet'); await p.waitForTimeout(300);
    const before = await wd(p);
    await p.evaluate(i => __loft.act(i), id); await p.waitForTimeout(900);
    const during = await wd(p);
    await p.keyboard.press('Escape'); const back = await toWalk(p);
    const after = await wd(p);
    check(`${label}: the wardrobe opened from its chip closes when ${name} takes the screen`, before && !during && !after && back, JSON.stringify({ before, during, after, back }));
  }
  check(`${label}: no page errors, console errors or failed requests`, errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}

// ---------- the calculator ----------
// The keys as laid out (desktop pixels, from their style) and as seen (CSS pixels on the screen).
const keys = p => p.evaluate(() => [...document.querySelectorAll('.dt-win[data-app="calc"] .dt-key')].map(k => {
  const r = k.getBoundingClientRect();
  return { label: k.getAttribute('aria-label'), style: [k.style.left, k.style.top, k.style.width, k.style.height].join(' '), x: r.left, y: r.top, w: r.width, h: r.height };
}));
const sig = ks => { let h = 2166136261; for (const c of ks.map(k => k.style).join(';')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h.toString(16); };
async function atCalc(b, opts) {
  const { ctx, p, errs } = await open(b, opts);
  await p.evaluate(() => __loft.useDesk());
  await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  const icon = '.dt-icon[aria-label="Open Calculator"]';
  if (opts.hasTouch) await p.tap(icon); else await p.click(icon);
  await p.waitForSelector('.dt-win[data-app="calc"] .dt-key', { timeout: 5000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs };
}
// Pinned before the change: the computer's and the upright phone's calculator are laid out exactly as they were.
const BEFORE = { desk: process.env.CALC_DESK || '83ba8f9d', upright: process.env.CALC_UPRIGHT || '8975349f' };
async function calc(b) {
  for (const [label, opts, pin] of [['desktop', DESK, BEFORE.desk], ['phone upright', UPRIGHT, BEFORE.upright]]) {
    const { ctx, p, errs } = await atCalc(b, opts);
    const ks = await keys(p), s = sig(ks);
    console.log(`  ${label}: keys ${Math.round(Math.min(...ks.map(k => k.w)))} by ${Math.round(Math.min(...ks.map(k => k.h)))} at the smallest, layout ${s}`);
    check(`${label}: the calculator is laid out as it was`, ks.length === 20 && s === pin, s);
    check(`${label}: no page errors, console errors or failed requests`, errs.length === 0, errs.slice(0, 6).join(' | '));
    await ctx.close();
  }
  const { ctx, p, errs } = await atCalc(b, SIDEWAYS);
  const ks = await keys(p);
  const minW = Math.min(...ks.map(k => k.w)), minH = Math.min(...ks.map(k => k.h));
  const onScreen = ks.every(k => k.x >= 0 && k.y >= 0 && k.x + k.w <= 844 && k.y + k.h <= 390);
  const apart = ks.every(a => ks.every(c => a === c || a.x + a.w <= c.x + 0.5 || c.x + c.w <= a.x + 0.5 || a.y + a.h <= c.y + 0.5 || c.y + c.h <= a.y + 0.5));
  check('phone sideways: every key is at least 44 by 44 on the screen, all on the screen, none touching', ks.length === 20 && minW >= 44 && minH >= 44 && onScreen && apart, JSON.stringify({ minW: +minW.toFixed(1), minH: +minH.toFixed(1), onScreen, apart }));
  for (const k of ['Clear', '7', 'Times', '6', 'Equals']) { await p.tap(`.dt-win[data-app="calc"] .dt-key[aria-label="${k}"]`); await p.waitForTimeout(150); }
  const shown = await p.evaluate(() => [document.querySelector('.dt-calc-main')?.textContent, document.querySelector('.dt-calc-top')?.textContent]);
  check('phone sideways: 7 x 6 tapped on its keys reads 42', shown[0] === '42', JSON.stringify(shown));
  const disp = await p.evaluate(() => { const r = document.querySelector('.dt-calc').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('phone sideways: the display beside the keys stays readable', disp.w >= 150 && disp.h >= 80, JSON.stringify(disp));
  check('phone sideways: no page errors, console errors or failed requests', errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    if (ONLY === 'all' || ONLY === 'hidden') {
      await hiddenSound(b);
      await hiddenRun(b, DESK, 'desktop');
      await hiddenRun(b, UPRIGHT, 'phone upright');
      await hiddenRun(b, SIDEWAYS, 'phone sideways');
    }
    if (ONLY === 'all' || ONLY === 'wardrobe') {
      await wardrobe(b);
      await wardrobePhone(b, UPRIGHT, 'phone upright');
      await wardrobePhone(b, SIDEWAYS, 'phone sideways');
    }
    if (ONLY === 'all' || ONLY === 'calc') await calc(b);
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
