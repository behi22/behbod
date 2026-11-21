// Team colours for the football games, the studio's LEDs with the music, the goal reactions and the horn, in a real Chrome.
//   LOFT_URL=http://127.0.0.1:8815 node test/studio.js [outdir] [only: kits,phone,stored,music,goals,flash,horn,motes]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/studio';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const b2t = (x, y, z) => ({ x, y: z, z: -y });

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts, { ctx = null, query = '', init = null } = {}) {
  ctx ||= await b.newContext(opts);
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { ctx, p, errs };
}
const standAt = async (p, at, yaw) => { await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (yw !== undefined) __loft.yaw = yw; }, [b2t(...at), yaw]); await p.waitForTimeout(500); };
// Which swatch each kit row shows as picked, and what its line says.
const rows = p => p.evaluate(() => [...document.querySelectorAll('.g-kit')].map(r => ({ name: r.querySelector('.g-kit-name').textContent, on: [...r.querySelectorAll('[aria-pressed="true"]')].map(s => s.dataset.kit) })));
// How many pixels of a canvas (or of the room's TV, 'tv') sit within a few steps of a colour.
const near = (p, sel, hex) => p.evaluate(([s, h]) => {
  const c = s === 'tv' ? __loft.screens.textures.tv.image : document.querySelector(s);
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, n = parseInt(h.slice(1), 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
  let k = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - R) < 7 && Math.abs(d[i + 1] - G) < 7 && Math.abs(d[i + 2] - B) < 7) k++;
  return k;
}, [sel, hex]);
// The studio's purple strips: the one material the merged strip is drawn with, found by its colour at the start.
// (The PC's purple parts are merged in that colour too, so the strips are the biggest such mesh.)
const findStrip = p => p.evaluate(() => {
  let found = null;
  __loft.scene.traverse(o => {
    if (o.isMesh && /^merged_/.test(o.name) && o.material.color && Math.abs(o.material.color.r - 0.55 * 3.2) < 1e-6 && Math.abs(o.material.color.b - 3.2) < 1e-6
      && (!found || o.geometry.attributes.position.count > found.geometry.attributes.position.count)) found = o;
  });
  window.__strip = found?.material || null;
  return found ? { name: found.name, colour: found.material.color.toArray() } : null;
});
const strip = p => p.evaluate(() => ({ colour: __strip.color.toArray(), leds: __loft.world.leds, key: __strip.customProgramCacheKey() }));
const CHILL = [0.55 * 3.2, 0.15 * 3.2, 1.0 * 3.2];
const exact = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

(async () => {
  const K = await import('../web/src/games/pure/kits.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- the kits, at a computer: mouse and keyboard ----------
    if (want('kits')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      let r = await rows(p);
      check('the TV menu shows the kit row on both match cards, the first kit picked', r.length === 2 && r.every(x => x.on.join() === 'home' && x.name === 'Your kit: White and purple'), JSON.stringify(r));
      const cards = await p.evaluate(() => [...document.querySelectorAll('.g-card')].map(c => [c.querySelector('h2').textContent, !!c.querySelector('.g-kit'), c.querySelectorAll('.g-kit-sw').length]));
      check('only the two match cards carry it, six kits each', JSON.stringify(cards) === JSON.stringify([['Join as striker', true, 6], ['Join as keeper', true, 6], ['Watch my videos', false, 0], ['Watch my film', false, 0]]), JSON.stringify(cards));
      const focus0 = await p.evaluate(() => document.activeElement.textContent);
      check('the menu still opens with Play in focus', focus0 === 'Play', focus0);
      await p.screenshot({ path: path.join(OUT, 'tv-menu.png') });
      // The mouse.
      await p.click('.g-card:has-text("Join as keeper") [data-kit="sky"]');
      r = await rows(p);
      check('a click picks it, and both rows show it', r.every(x => x.on.join() === 'sky' && x.name === 'Your kit: Sky blue'), JSON.stringify(r));
      check('the pick is remembered in this browser', (await p.evaluate(() => localStorage.getItem('loft.kit'))) === 'sky');
      // The keyboard: from the first Play, back one to the last swatch of that card, and Space or Enter picks it.
      await p.evaluate(() => document.querySelector('.g-card .g-main').focus());
      await p.keyboard.press('Shift+Tab');
      const onRed = await p.evaluate(() => document.activeElement.dataset.kit);
      await p.keyboard.press('Space');
      await p.waitForTimeout(100);
      r = await rows(p);
      check('Shift+Tab reaches the swatches and Space picks one', onRed === 'red' && r.every(x => x.on.join() === 'red'), `${onRed} ${JSON.stringify(r)}`);
      await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Enter');
      await p.waitForTimeout(100);
      r = await rows(p);
      check('Enter picks too', r.every(x => x.on.join() === 'sky'), JSON.stringify(r));
      check('the menu is still open and the room did not move', await p.evaluate(() => !!document.querySelector('.g-menu') && __loft.mode === 'walk'));
      // The match, in the kit.
      await p.click('.g-card:has-text("Join as striker") .g-main');
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1500);
      const sky = await near(p, '.g-stage canvas', '#7cc4ff');
      await p.screenshot({ path: path.join(OUT, 'match-sky.png') });
      check('the match is played in the picked kit', sky > 200, `${sky} sky blue pixels`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      // Striker 22 from the arcade, in another kit; the console goes straight in, in the last pick.
      await p.evaluate(() => __loft.act('arcade'));
      await p.waitForSelector('.g-kit');
      r = await rows(p);
      const arcade = await p.evaluate(() => [...document.querySelectorAll('.g-card')].map(c => [c.querySelector('h2').textContent, c.querySelectorAll('.g-kit-sw').length]));
      check('the arcade shows the kit row on Striker 22 only, with the pick', r.length === 1 && r[0].on.join() === 'sky' && JSON.stringify(arcade) === JSON.stringify([['Skills Shooter', 0], ['Striker 22', 6]]), JSON.stringify([r, arcade]));
      await p.click('.g-card:has-text("Striker 22") [data-kit="red"]');
      await p.click('.g-card:has-text("Striker 22") .g-main');
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1200);
      const red = await near(p, '.g-stage canvas', '#d7263d');
      await p.screenshot({ path: path.join(OUT, 'striker-red.png') });
      check('Striker 22 is played in the picked kit', red > 300, `${red} red pixels`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      await p.evaluate(() => __loft.act('console'));
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1200);
      const red2 = await near(p, '.g-stage canvas', '#d7263d');
      check('the console\'s Striker 22 wears the last pick', red2 > 300, `${red2} red pixels`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      // Black: the bots change into their light kit.
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      await p.click('.g-card:has-text("Join as striker") [data-kit="black"]');
      await p.click('.g-card:has-text("Join as striker") .g-main');
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1500);
      const light = await near(p, '.g-stage canvas', K.BOTS.light.shirt), dark = await near(p, '.g-stage canvas', K.BOTS.dark.shirt);
      await p.screenshot({ path: path.join(OUT, 'match-black.png') });
      check('against a black kit the bots play in their light kit', light > 1000 && dark < light / 20, `${light} light, ${dark} dark`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      // The room's own TV shows the match in the pick.
      await p.evaluate(async () => (await import('/src/games/kit.js')).setKit('sky'));
      await standAt(p, [4.2, 10.6, 0], Math.PI / 2);
      await p.waitForTimeout(2500);
      const tv = await near(p, 'tv', '#7cc4ff');
      check('the TV in the room shows BEHI FC in the pick', tv > 20, `${tv} sky blue pixels on the TV`);
      check('kits: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- a phone: taps ----------
    if (want('phone')) {
      const { ctx, p, errs } = await open(b, UPRIGHT);
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      await p.waitForTimeout(500);
      const size = await p.evaluate(() => { const r = document.querySelector('.g-kit-sw').getBoundingClientRect(); return [r.width, r.height]; });
      check('on a phone the swatches are big enough for a thumb', size[0] >= 38 && size[1] >= 38, size.join('x'));
      const sw = p.locator('.g-card:has-text("Join as striker") [data-kit="teal"]');
      await sw.scrollIntoViewIfNeeded();
      await sw.tap();
      const r = await rows(p);
      check('a tap picks a kit', r.every(x => x.on.join() === 'teal'), JSON.stringify(r));
      const fit = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cards: [...document.querySelectorAll('.g-card')].every(c => { const q = c.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth; }) }));
      check('the menu fits the phone across', fit.over <= 0 && fit.cards, JSON.stringify(fit));
      await p.screenshot({ path: path.join(OUT, 'phone-tv-menu.png') });
      const play = p.locator('.g-card:has-text("Join as striker") .g-main');
      await play.scrollIntoViewIfNeeded();
      await play.tap();
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1500);
      const teal = await near(p, '.g-stage canvas', '#2fc9ac');
      check('the match on a phone is in the picked kit', teal > 50, `${teal} teal pixels`);
      await p.screenshot({ path: path.join(OUT, 'phone-match-teal.png') });
      check('phone: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the pick kept, and a browser that keeps nothing ----------
    if (want('stored')) {
      const ctx = await b.newContext(DESK);
      let { p, errs } = await open(b, DESK, { ctx });
      await p.evaluate(() => __loft.act('arcade'));
      await p.waitForSelector('.g-kit');
      await p.click('[data-kit="purple"]');
      await p.reload();
      await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      const r = await rows(p);
      check('after a reload the pick is still there', r.every(x => x.on.join() === 'purple'), JSON.stringify(r));
      check('stored: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // Storage that throws (blocked site data): the games open, the first kit shows, a pick holds for the visit.
      // (Only the house's own page: YouTube's frame on the wall has its own storage and its own errors.)
      const blocked = () => { if (window.top !== window) return; const no = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = no; Storage.prototype.setItem = no; };
      ({ p, errs } = await open(b, DESK, { init: blocked }));
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      const r0 = await rows(p);
      await p.click('.g-card:has-text("Join as striker") [data-kit="black"]');
      const r1 = await rows(p);
      check('with storage blocked the first kit shows and a pick still works', r0.every(x => x.on.join() === 'home') && r1.every(x => x.on.join() === 'black'), JSON.stringify([r0, r1]));
      check('blocked storage: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.context().close();
    }
    // ---------- the LEDs and the music ----------
    if (want('music')) {
      const { ctx, p, errs } = await open(b, DESK);
      const s0 = await findStrip(p);
      check('the purple strip is found in its chill colour', !!s0 && exact(s0.colour, CHILL), JSON.stringify(s0));
      await standAt(p, [15.6, 4.4, 0.45], -2.2);
      // Sound off: a record cannot start, and nothing moves.
      await p.evaluate(() => __loft.act('records'));
      await p.waitForTimeout(1500);
      let s = await strip(p);
      check('with the sound off the strips stay exactly as they were', exact(s.colour, CHILL) && s.leds.music === 0 && s.key !== 'stripviz', JSON.stringify(s));
      await p.click('#snd'); await p.waitForTimeout(300);
      await p.evaluate(() => __loft.audio.music.play('night-shift'));
      await p.waitForFunction(() => __loft.world.leds.music === 1, null, { timeout: 8000 }).catch(() => {});
      const seen = [];
      for (let i = 0; i < 24; i++) { seen.push((await strip(p)).colour[2]); await p.waitForTimeout(90); }
      const lo = Math.min(...seen), hi = Math.max(...seen);
      check('with a record on, the strips pulse with it', (await strip(p)).leds.music === 1 && hi - lo > 0.6 && lo < 3.2 * 0.95, `blue channel ${lo.toFixed(2)} to ${hi.toFixed(2)} (steady is 3.2)`);
      await p.screenshot({ path: path.join(OUT, 'studio-pulse.png') });
      // The piano fades the records out, and with them the pulse.
      await p.evaluate(() => __loft.audio.duckMusic(0, 0.3));
      await p.waitForFunction(() => __loft.world.leds.music === 0, null, { timeout: 8000 }).catch(() => {});
      s = await strip(p);
      check('faded for the piano, the strips settle back exactly', s.leds.music === 0 && exact(s.colour, CHILL), JSON.stringify(s));
      await p.evaluate(() => __loft.audio.duckMusic(1, 0.3));
      await p.waitForFunction(() => __loft.world.leds.music === 1, null, { timeout: 8000 }).catch(() => {});
      // The visualizer.
      await p.evaluate(() => __loft.world.scene('visualizer'));
      await p.waitForTimeout(1500);
      const bands = [];
      for (let i = 0; i < 12; i++) { bands.push((await strip(p)).leds.bands); await p.waitForTimeout(120); }
      s = await strip(p);
      const moving = bands.some((x, i) => i && x.some((v, j) => Math.abs(v - bands[i - 1][j]) > 0.05));
      check('the visualizer lays the spectrum along the strips, and it moves', s.key === 'stripviz' && s.leds.viz > 0.9 && moving && exact(s.colour, CHILL), JSON.stringify({ key: s.key, viz: s.leds.viz, moving }));
      await p.screenshot({ path: path.join(OUT, 'studio-visualizer.png') });
      // Off: the record stopped, the strips are exactly the chill scene again and the visualizer is idle.
      await p.evaluate(() => __loft.audio.music.stop());
      await p.waitForFunction(() => __loft.world.leds.music === 0, null, { timeout: 8000 }).catch(() => {});
      s = await strip(p);
      check('with the record stopped, the visualizer goes still and the colours are exactly the scene', s.leds.music === 0 && s.leds.viz === 0 && exact(s.colour, CHILL), JSON.stringify(s));
      // The sound switched off mid-record does the same.
      await p.evaluate(() => { __loft.world.scene('chill'); __loft.audio.music.play('lions-gate'); });
      await p.waitForFunction(() => __loft.world.leds.music === 1, null, { timeout: 8000 }).catch(() => {});
      await p.click('#snd');
      await p.waitForFunction(() => __loft.world.leds.music === 0, null, { timeout: 8000 }).catch(() => {});
      s = await strip(p);
      check('the sound switched off mid-record puts the strips back exactly', s.leds.music === 0 && exact(s.colour, CHILL), JSON.stringify(s));
      await p.click('#snd');
      await p.evaluate(() => __loft.audio.music.stop());
      // Party keeps turning with no record on.
      await p.evaluate(() => __loft.world.scene('party'));
      const a1 = (await strip(p)).colour; await p.waitForTimeout(700); const a2 = (await strip(p)).colour;
      check('party still turns through the colours with no record', !exact(a1, a2), JSON.stringify([a1, a2]));
      await p.evaluate(() => __loft.world.scene('chill'));
      // The terminal and Settings offer it like the other scenes.
      await p.evaluate(() => __loft.useDesk());
      await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 });
      await p.waitForTimeout(700);
      await p.keyboard.type('scene'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      await p.keyboard.type('scene visualizer'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      const lines = await p.evaluate(() => __loft.screens.desktop.term.lines.slice(-5));
      check('the terminal lists it and picks it, with a hint while nothing plays', lines.join('|') === ['$ scene', 'scenes: chill  focus  matchday  off  party  visualizer', '$ scene visualizer', 'lights: visualizer', 'play a record and it moves with the music.'].join('|'), lines.join(' | '));
      check('the Settings lights row has every scene', await p.evaluate(async () => { const { rows } = await import('/src/pure/desktop.js'); return rows('settings', { scenes: __loft.world.scenes, scene: 'visualizer' }).find(r => r.text[0][0] === 'lights').pills.map(x => x.label).join() === 'chill,focus,matchday,off,party,visualizer'; }));
      await p.evaluate(() => __loft.leaveDesk());
      await p.waitForTimeout(1500);
      check('music: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- goals: the mini goal and Striker 22 ----------
    if (want('goals')) {
      const { ctx, p, errs } = await open(b, DESK);
      await findStrip(p);
      await p.click('#snd'); await p.waitForTimeout(300);
      await p.evaluate(() => { const s = __loft.audio.sfx, f = s.goalHorn; window.__horns = []; s.goalHorn = (...a) => { __horns.push(a[0] ? 'at the goal' : 'everywhere'); return f(...a); }; });
      await p.evaluate(() => __loft.act('penalties'));
      await p.waitForFunction(() => /Kick 1 of 5/.test(document.querySelector('.pen-hud')?.textContent || ''), null, { timeout: 30000 });
      await p.waitForTimeout(1500);
      const conf0 = await p.evaluate(() => __loft.scene.getObjectByName('goal_confetti').visible);
      // BH-22 is sent the other way and the kick goes into the right of the goal.
      const at = await p.evaluate(() => {
        const L = __loft, P = L.meta.points.pen_line, v = L.camera.position.clone().set(P[0], 0.3, -P[1] - 0.3).project(L.camera);
        return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
      });
      await p.evaluate(() => { window.__rand = Math.random; Math.random = () => 0.2; });
      await p.mouse.move(at.x, at.y); await p.mouse.down(); await p.mouse.up();
      await p.evaluate(() => { Math.random = window.__rand; });
      await p.waitForFunction(() => /GOAL|SAVED|MISSED/.test(document.querySelector('.pen-hud')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
      const g = await p.evaluate(() => ({ hud: document.querySelector('.pen-hud')?.textContent, toast: document.getElementById('toast').textContent, leds: __loft.world.leds, confetti: __loft.scene.getObjectByName('goal_confetti').visible, horns: __horns.slice() }));
      await p.screenshot({ path: path.join(OUT, 'mini-goal-burst.png') });
      check('the mini goal: a goal', /GOAL/.test(g.hud) && g.toast === 'GOAL!', `${g.hud} ${g.toast}`);
      check('the mini goal: the horn from the goal, a burst of confetti, the strips flash', g.horns.join() === 'at the goal' && g.confetti && !conf0 && g.leds.goal, JSON.stringify(g));
      const mid = (await strip(p)).colour;
      check('the flash is white and gold', exact(mid, [3.2, 3.2, 3.2]) || exact(mid, [3.2, 0.72 * 3.2, 0.18 * 3.2]), JSON.stringify(mid));
      await p.waitForTimeout(2300);
      const after = await p.evaluate(() => ({ leds: __loft.world.leds, confetti: __loft.scene.getObjectByName('goal_confetti').visible }));
      const back = (await strip(p)).colour;
      check('then the confetti is gone and the strips are exactly as before', !after.confetti && !after.leds.goal && exact(back, CHILL), JSON.stringify({ after, back }));
      await p.keyboard.press('Escape'); await p.waitForTimeout(500);
      // Striker 22: aim left (its keeper is sent right), shoot.
      await p.evaluate(() => __loft.act('arcade'));
      await p.waitForSelector('.g-card:has-text("Striker 22") .g-main');
      await p.click('.g-card:has-text("Striker 22") .g-main');
      await p.waitForFunction(() => document.querySelector('.g-stage')?.dataset.phase === 'aim', null, { timeout: 10000 });
      await p.waitForTimeout(400);
      await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(1300); await p.keyboard.up('ArrowLeft');
      await p.keyboard.down('ArrowDown'); await p.waitForTimeout(300); await p.keyboard.up('ArrowDown');
      await p.keyboard.press('Space');
      await p.waitForTimeout(500);
      await p.evaluate(() => { window.__rand = Math.random; Math.random = () => 0.99; });
      await p.keyboard.press('Space');
      await p.waitForFunction(() => document.querySelector('.g-stage')?.dataset.phase === 'after', null, { timeout: 5000 }).catch(() => {});
      await p.evaluate(() => { Math.random = window.__rand; });
      const sg = await p.evaluate(() => ({ score: document.querySelector('.g-score')?.textContent, leds: __loft.world.leds, horns: __horns.slice() }));
      await p.screenshot({ path: path.join(OUT, 'striker-goal.png') });
      check('Striker 22: a goal sounds the horn and flashes the strips', sg.score.replace(/\s/g, '') === 'You1:0Bot' && sg.horns.join() === 'at the goal,everywhere' && sg.leds.goal, JSON.stringify(sg));
      await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
      // The TV match: up the left from kickoff and a shot across the keeper; the bots never tackle while the dice are fixed.
      let tv = null;
      for (let go = 0; go < 3 && !(tv && /^1 scored/.test(tv.tally)); go++) {
        await p.evaluate(() => __loft.act('tv'));
        await p.waitForSelector('.g-card:has-text("Join as striker") .g-main');
        await p.click('.g-card:has-text("Join as striker") .g-main');
        await p.waitForSelector('.g-stage canvas'); await p.waitForTimeout(300);
        await p.evaluate(() => { window.__rand = Math.random; Math.random = () => 0.999; });
        await p.keyboard.down('ArrowRight'); await p.keyboard.down('ArrowUp'); await p.waitForTimeout(700); await p.keyboard.up('ArrowUp');
        await p.waitForTimeout(2000); await p.keyboard.up('ArrowRight');
        await p.keyboard.down('ArrowDown'); await p.keyboard.down('Space'); await p.waitForTimeout(120); await p.keyboard.up('Space'); await p.keyboard.up('ArrowDown');
        await p.waitForTimeout(800);
        await p.evaluate(() => { Math.random = window.__rand; });
        tv = await p.evaluate(() => ({ tally: document.querySelector('.g-mt-tally')?.textContent, leds: __loft.world.leds, horns: __horns.slice() }));
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      }
      check('the TV match: a goal sounds the horn and flashes the strips', /^1 scored/.test(tv.tally) && tv.horns.join() === 'at the goal,everywhere,everywhere' && tv.leds.goal, JSON.stringify(tv));
      check('goals: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the goal flash's pace, frame by frame, also with a second goal while it runs, and with a late frame ----------
    if (want('flash')) {
      // Every change of the purple strip's colour from a goal on (the change at the goal itself included), in ms by each
      // frame's own time. `stall`: the frame due just after the third beat is held up that long, as a busy moment would.
      const changes = (p, again, stall = 0) => p.evaluate(([again, stall]) => new Promise(done => {
        const t0 = performance.now(), at = [], frames = [];
        let prev = __strip.color.toArray().join(), second = again == null, held = !stall;
        __loft.world.goal(t0 / 1000);
        const rec = ts => {
          const now = performance.now(), c = __strip.color.toArray().join();
          frames.push(ts);
          if (c !== prev) { at.push(ts - t0); prev = c; }
          if (!second && now - t0 >= again * 1000) { second = true; __loft.world.goal(now / 1000); }
          if (!held && now > t0 + 500 - 30) { held = true; while (performance.now() < t0 + 500 + stall) { /* a long task */ } }
          if (now - t0 < 4600) requestAnimationFrame(rec); else done({ at, back: c, goal: __loft.world.leds.goal, frame: frames.slice(1).map((f, i) => f - frames[i]).sort((a, b) => a - b)[frames.length >> 1] });
        };
        requestAnimationFrame(rec);
      }), [again, stall]);
      const pace = at => {
        let most = 0, gap = Infinity;
        for (let i = 0; i < at.length; i++) { let n = 0; for (let j = i; j < at.length && at[j] - at[i] <= 1000; j++) n++; most = Math.max(most, n); if (i) gap = Math.min(gap, at[i] - at[i - 1]); }
        return { most, gap: Math.round(gap) };
      };
      const chill = CHILL.join();
      for (const motion of ['full', 'reduce']) {
        const { ctx, p, errs } = await open(b, { ...DESK, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' });
        await findStrip(p);
        for (const [again, stall] of [[null, 0], [1.0, 0], [1.85, 0], [1.95, 0], [null, 105]]) {
          const r = await changes(p, again, stall), f = pace(r.at);
          // One frame of slack: the change is timed by its frame, the 200 ms by the moment the house drew it.
          const ok = motion === 'reduce' ? r.at.length === 2 : f.most <= 5 && f.gap >= 200 - r.frame;
          check(`the goal flash (${motion} motion${again ? `, a second goal at ${again} s` : ''}${stall ? `, a frame ${stall} ms late` : ''}): under three flashes in any second, never two changes under 200 ms apart, then exactly the scene`,
            ok && r.back === chill && !r.goal, `${r.at.length} changes, at most ${f.most} in a second, closest ${f.gap} ms apart (a frame is ${r.frame.toFixed(1)} ms): ${r.at.map(Math.round).join(' ')}`);
          await p.waitForTimeout(300);
        }
        check(`flash (${motion}): no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
    // ---------- the horn itself, rendered offline ----------
    if (want('horn')) {
      const { ctx, p, errs } = await open(b, DESK);
      // Rendered offline and heard through an analyser every 50 ms (the test page sends anything that reaches the speakers to silence).
      const h = await p.evaluate(async () => {
        const { makeEngine } = await import('/src/audio/core.js'), { makeSfx } = await import('/src/audio/sfx.js');
        const sr = 48000, dur = 2.6, ctx = new OfflineAudioContext(1, sr * dur, sr), an = ctx.createAnalyser(), buf = new Float32Array(2048), env = {};
        an.fftSize = 2048; an.connect(ctx.destination);
        const e = makeEngine(ctx, an);
        makeSfx({ ready: () => e, eng: () => e, sound: { on: true } }).goalHorn();
        for (let k = 2; k <= 50; k++) {
          const t = k * 0.05;
          ctx.suspend(t).then(() => { an.getFloatTimeDomainData(buf); let s = 0, pk = 0; for (const v of buf) { s += v * v; pk = Math.max(pk, Math.abs(v)); } env[t.toFixed(2)] = [Math.sqrt(s / buf.length), pk]; ctx.resume(); });
        }
        await ctx.startRendering();
        const at = t => env[t.toFixed(2)][0];
        return { peak: Math.max(...Object.values(env).map(v => v[1])), first: at(0.25), gap: at(0.4), second: Math.min(at(0.8), at(1.2), at(1.6)), tail: at(2.5) };
      });
      check('the horn: two blasts, a breath between, loud but never clipping, then quiet', h.peak < 0.95 && h.first > 0.03 && h.second > 0.03 && h.gap < h.first * 0.6 && h.tail < 0.005, JSON.stringify(h));
      check('horn: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the dust motes are gone; the light switch still works ----------
    if (want('motes')) {
      const { ctx, p, errs } = await open(b, DESK);
      const pts = await p.evaluate(() => { const out = []; __loft.scene.traverse(o => { if (o.isPoints) out.push(o.geometry.attributes.position.count); }); return out; });
      check('no dust motes in the air', !pts.includes(420), JSON.stringify(pts));
      await p.evaluate(() => __lights.set(false)); await p.waitForTimeout(900);
      const off = await p.evaluate(() => ({ k: __lights.k, room: __lights.uniforms.room.value.toArray() }));
      await p.evaluate(() => __lights.set(true)); await p.waitForTimeout(900);
      const on = await p.evaluate(() => ({ k: __lights.k, room: __lights.uniforms.room.value.toArray() }));
      check('the light switch still turns the room down and back exactly', off.k === 0 && off.room.every(v => v < 1) && on.k === 1 && on.room.every(v => v === 1), JSON.stringify({ off, on }));
      check('motes: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
