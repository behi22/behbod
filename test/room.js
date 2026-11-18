// The hall's looks, the loadout room and the run's music, computer and phone: LOFT_URL=http://127.0.0.1:8815 node test/room.js [outdir]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/room';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const WORLD = require('../web/assets/world.json');
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url()) && !/run\.mp3/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// Opens the house with its sound on, makes the range ready, opens the bookcase and stands in the loadout room.
async function open(b, opts, q) {
  const p = await b.newPage(opts), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${q}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.click('#snd'); await p.waitForTimeout(300);
  await p.evaluate(() => __loft.range.load());
  await p.waitForFunction(() => __loft.range.ready, null, { timeout: 60000 });
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1200);
  return { p, errs };
}
async function toLine(p) {
  const at = WORLD.interact.find(i => i.id === 'range').at;
  await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...at));
  await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('range'));
  await p.waitForFunction(() => __loft.range.state === 'menu', null, { timeout: 8000 });
}
const settled = (p, id) => p.waitForFunction(i => __loft.range.hall.shown === i && !__loft.range.hall.changing, id, { timeout: 8000 }).then(() => true, () => false);
// The look the hall is in: its tint and haze, its glows' colours, which set hangs in it.
const look = p => p.evaluate(() => {
  const r = __loft.range, room = r.room, U = r.U, glow = {};
  for (const [k, g] of Object.entries(room.glow)) glow[k] = { now: g.material.color.toArray(), base: g.base.toArray() };
  const sets = room.scene.children.filter(o => /^hall_set_/.test(o.name)).map(o => o.name);
  return { tint: U.hallTint.value.toArray(), haze: U.haze.value.toArray(), hazeK: U.hazeK.value, pulse: room.pulse.uPulse.value, glow, sets, shown: r.hall.shown };
});
const same = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);
const card = (p, text) => p.evaluate(t => { const b = [...document.querySelectorAll('.rg-card button')].find(x => x.textContent === t); if (!b) return false; b.click(); return true; }, text);
const music = p => p.evaluate(() => { const m = __loft.range.music; return { on: m.on, paused: m.paused, time: +m.time.toFixed(2), level: +m.level.toFixed(3), records: +__loft.audio.musicLevel().toFixed(3), house: __loft.houseGain }; });

async function desktop(b) {
  const { p, errs } = await open(b, { viewport: { width: 1280, height: 800 } }, 'ultra');
  // The loadout room's spots are among the things to press E at, each found standing in front of it.
  const spots = await p.evaluate(() => __loft.range.spots.map(s => ({ id: s.id, at: s.at, r: s.r })));
  const found = [];
  for (const s of spots) {
    await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...s.at));
    await p.waitForTimeout(350);
    found.push([s.id, await p.evaluate(() => __loft.near)]);
  }
  check('six new spots in the loadout room, each the nearest thing when standing at it', spots.length === 6 && found.every(([a, n]) => a === n), JSON.stringify(found));
  const places = await p.evaluate(() => __loft.range.loadout.places);
  const inRoom = ([x, y, z]) => x > 5.2 && x < 18.2 && y > -6.7 && y < -0.2 && z > 0 && z < 3.2;
  check('the places kept for the gunsmith, the attachments, the camos and the charms are in the loadout room', JSON.stringify(places.bench) === JSON.stringify(WORLD.points.range_workbench) && places.attachments.length === 4 && places.camos.length === 6 && places.charms.length === 4 && Object.values(places).flat().every(v => Array.isArray(v) ? inRoom(v) : true) && inRoom(places.bench), JSON.stringify(places));
  const said = await p.evaluate(() => { __loft.act('rg_bench'); return document.getElementById('toast')?.textContent || ''; });
  check('pressing E at the bench says what it is for', /gunsmith bench/.test(said), said);
  const wave0 = await p.evaluate(() => __loft.range.loadout.rivet.part.armL.quaternion.toArray());
  await p.evaluate(() => __loft.act('rg_bot'));
  await p.waitForTimeout(600);
  const wave1 = await p.evaluate(() => __loft.range.loadout.rivet.part.armL.quaternion.toArray());
  check('Rivet waves when greeted', !same(wave0, wave1, 1e-3), JSON.stringify({ wave0: wave0.map(v => +v.toFixed(2)), wave1: wave1.map(v => +v.toFixed(2)) }));
  const loops = async () => p.evaluate(async () => (await import('/src/audio/core.js')).stats.loops);
  const l0 = await loops();
  await p.evaluate(() => __loft.act('rg_drone'));
  await p.waitForTimeout(500);
  const woke = await p.evaluate(() => ({ awake: __loft.range.loadout.awake, y: __loft.range.loadout.drone.g.position.y }));
  const l1 = await loops();
  await p.screenshot({ path: `${OUT}/drone-awake.png` });
  await p.waitForTimeout(3200);
  const slept = await p.evaluate(() => ({ awake: __loft.range.loadout.awake }));
  const l2 = await loops();
  check('the drone wakes with its rotors heard, then goes back to sleep and falls quiet', woke.awake && l1 === l0 + 1 && !slept.awake && l2 === l0, JSON.stringify({ woke, slept, loops: [l0, l1, l2] }));
  const before = await p.evaluate(() => __loft.range.hall.wanted);
  const sw = await p.evaluate(() => { __loft.act('rg_lights'); return { wanted: __loft.range.hall.wanted, toast: document.getElementById('toast')?.textContent }; });
  check('the switch by the line changes the hall to the next stage', before === 'warmup' && sw.wanted === 'walkers' && /Walkers/.test(sw.toast), JSON.stringify(sw));
  check('the hall settles on it', await settled(p, 'walkers'));
  await p.screenshot({ path: `${OUT}/loadout-walkers.png` });

  // At the line: the card's stage list dresses the hall.
  await toLine(p);
  check('back at the card, the hall goes back to the stage picked there', await settled(p, 'warmup'));
  const warm = await look(p);
  const glowsBuilt = Object.values(warm.glow).every(g => same(g.now, g.base, 1e-5));
  check('the warm-up is the hall as it was: no tint, the old haze, every glow its own colour, no pulse', same(warm.tint, [1, 1, 1]) && same(warm.haze, [0.012, 0.016, 0.024]) && Math.abs(warm.hazeK - 0.011) < 1e-9 && glowsBuilt && warm.pulse === 0, JSON.stringify({ tint: warm.tint, haze: warm.haze, glowsBuilt }));
  check('the training set hangs in the hall, and only it', warm.sets.length === 1 && warm.sets[0] === 'hall_set_training', warm.sets.join());
  await p.evaluate(s => { for (const st of s) __loft.progress.rangeResult(st, 'normal', 1, 10); }, ['warmup', 'walkers', 'swarm', 'dark']);
  await card(p, 'Leave'); await p.waitForTimeout(300); await toLine(p);
  const seen = {};
  for (const [i, id] of ['warmup', 'walkers', 'swarm', 'dark', 'long'].entries()) {
    await p.click(`.rg-card .rg-list button:nth-child(${i + 1})`);
    const dipped = await p.evaluate(() => __loft.range.hall.changing);
    const ok = await settled(p, id);
    const l = await look(p);
    seen[id] = { dipped: dipped || id === 'warmup', ok, sets: l.sets, tint: l.tint.map(v => +v.toFixed(2)), hall: l.glow['E_range_white@hall'].now.map(v => +v.toFixed(2)), load: same(l.glow.E_range_panel.now, l.glow.E_range_panel.base, 1e-5) && same(l.glow.E_warm.now, l.glow.E_warm.base, 1e-5) };
    await p.screenshot({ path: `${OUT}/mood-${id}.png` });
  }
  const sets = Object.values(seen).map(s => s.sets.join());
  check('each stage dresses the hall with its own set, one at a time, after a flicker of the lights', Object.values(seen).every(s => s.ok && s.dipped && s.sets.length === 1) && new Set(sets).size === 5, JSON.stringify(sets));
  check('each stage tints the hall its own way; the loadout room keeps its light', new Set(Object.values(seen).map(s => s.tint.join())).size === 5 && Object.values(seen).every(s => s.load), JSON.stringify(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.tint]))));

  // The run's music: starts with the run, the records fade under it, it stops with the run and carries on next time.
  await p.click('.rg-card .rg-list button:nth-child(1)'); await settled(p, 'warmup');
  const m0 = await music(p);
  await card(p, 'Start');
  await p.waitForTimeout(2500);
  const m1 = await music(p);
  check('the music starts the moment a run starts and the records fade out under it', !m0.on && m0.paused && m1.on && !m1.paused && m1.time > 1 && Math.abs(m1.level - 0.9) < 0.01 && m1.records < 0.1, JSON.stringify({ m0, m1 }));
  await p.click('#snd'); await p.waitForTimeout(400);
  const off = await music(p);
  await p.click('#snd'); await p.waitForTimeout(400);
  const back = await music(p);
  check('the house\'s Sound off silences it like everything else, and Sound on brings it back', off.house < 0.02 && off.on && back.house > 0.8, JSON.stringify({ off, back }));
  await p.evaluate(() => __loft.range.escape());
  await p.waitForTimeout(900);
  const m2 = await music(p);
  await p.waitForTimeout(3500);
  const m2b = await music(p);
  check('paused, it fades and stops where it is; the records come back after it', !m2.on && m2.paused && Math.abs(m2b.time - m2.time) < 0.05 && m2b.records > 0.8, JSON.stringify({ m2, m2b }));
  await card(p, 'Resume');
  await p.waitForTimeout(1200);
  const m3 = await music(p);
  check('resumed, it carries on from there', m3.on && !m3.paused && m3.time > m2.time && m3.time < m2.time + 2, JSON.stringify(m3));
  // The run played to its end in a moment.
  await p.evaluate(() => __loft.range.film(true));
  for (let i = 0; i < 80 && await p.evaluate(() => __loft.range.state !== 'over'); i++) await p.evaluate(async () => { __loft.range.advance(1); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  await p.evaluate(() => __loft.range.film(false));
  await p.waitForTimeout(1800);
  const m4 = await music(p);
  check('when the run ends the music stops', !m4.on && m4.paused, JSON.stringify(m4));
  await card(p, 'Again');
  await p.waitForTimeout(1500);
  const m5 = await music(p);
  check('the next run picks the music up where the last one left it', m5.on && !m5.paused && m5.time >= m4.time && m5.time < m4.time + 3, JSON.stringify({ m4, m5 }));
  await p.evaluate(() => __loft.range.exit());
  await p.waitForTimeout(1600);
  const m6 = await music(p);
  await p.waitForTimeout(2500);
  check('leaving the range stops it, and the records come back', !m6.on && m6.paused && (await music(p)).records > 0.8, JSON.stringify(m6));
  check('nothing went wrong on the computer (console and network)', errs.length === 0, errs.slice(0, 6).join(' | '));
  await p.close();
}

// The lowest quality: the hall's sets still change, the costly pieces stay out.
async function low(b) {
  const { p, errs } = await open(b, { viewport: { width: 1280, height: 800 } }, 'low');
  await toLine(p);
  await p.evaluate(s => { for (const st of s) __loft.progress.rangeResult(st, 'normal', 1, 10); }, ['warmup', 'walkers', 'swarm', 'dark']);
  const hidden = {};
  for (const id of ['walkers', 'swarm', 'long']) {
    await p.evaluate(i => __loft.range.hall.want(i), id);
    await settled(p, id);
    hidden[id] = await p.evaluate(() => { const out = []; __loft.range.room.scene.traverse(o => { if (/^hall_(beacon_beams|stars|lasers)$/.test(o.name)) out.push(o.visible); }); return out; });
  }
  check('on the lowest quality the beams of light, the lasers and the stars are left out', Object.values(hidden).every(v => v.length > 0 && v.every(x => !x)), JSON.stringify(hidden));
  check('nothing went wrong on the lowest quality', errs.length === 0, errs.slice(0, 6).join(' | '));
  await p.close();
}

// A phone, by touch: the stage list and Start are tapped, the hall changes and the music starts.
async function phone(b) {
  const { p, errs } = await open(b, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 'auto');
  await toLine(p);
  await p.evaluate(s => { for (const st of s) __loft.progress.rangeResult(st, 'normal', 1, 10); }, ['warmup', 'walkers']);
  await card(p, 'Leave'); await p.waitForTimeout(300); await toLine(p);
  await p.tap('.rg-card .rg-list button:nth-child(3)');
  check('a tap on a stage dresses the hall for it on a phone', await settled(p, 'swarm'));
  await p.screenshot({ path: `${OUT}/phone-swarm.png` });
  const startBtn = await p.evaluateHandle(() => [...document.querySelectorAll('.rg-card button')].find(x => x.textContent === 'Start'));
  await startBtn.asElement().tap();
  await p.waitForTimeout(2200);
  const m = await music(p);
  check('a tap on Start starts the music on a phone', m.on && !m.paused && m.time > 0.5, JSON.stringify(m));
  await p.evaluate(() => __loft.range.exit()); await p.waitForTimeout(1600);
  check('and leaving stops it', (await music(p)).paused);
  check('nothing went wrong on the phone', errs.length === 0, errs.slice(0, 6).join(' | '));
  await p.close();
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'] });
  try {
    await desktop(b);
    await low(b);
    await phone(b);
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'all pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
