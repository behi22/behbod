// House-wide checks, computer and phones: a hidden tab goes quiet and pauses a run.
//   LOFT_URL=http://127.0.0.1:8815 node test/house.js [hidden|all]
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

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg|doubleclick|google\.com/.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !/youtube|google/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
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

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    if (ONLY === 'all' || ONLY === 'hidden') {
      await hiddenSound(b);
      await hiddenRun(b, DESK, 'desktop');
      await hiddenRun(b, UPRIGHT, 'phone upright');
      await hiddenRun(b, SIDEWAYS, 'phone sideways');
    }
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
