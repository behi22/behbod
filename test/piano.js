// The piano's own things, on a computer and a phone, lamps on and off:
//   the note names on the keys;
//   the metronome on the lid;
//   the lamp that warms while it plays;
//   the sheet music that turns its pages with the song.
//   LOFT_URL=http://127.0.0.1:8822 node test/piano.js [names|metronome|lamp|sheet|phone|all]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const ONLY = process.argv[2] || 'all';
const want = k => ONLY === 'all' || ONLY === k;
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]|GL_|WebGL/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// `sound`: come in through the door, which starts the sound; otherwise the page opens straight in, silent.
async function open(b, opts, { sound = false, extra = '' } = {}) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?q=low${sound ? '' : '&auto'}${extra}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  if (sound) { await p.waitForSelector('#enter.ready', { timeout: 120000 }); await p.click('#enter'); }
  await p.waitForTimeout(800);
  return { ctx, p, errs };
}
async function sit(p) {
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(16.0, 8.9, 0));
  await p.waitForTimeout(300);
  await p.evaluate(() => __loft.act('piano'));
  await p.waitForFunction(() => __loft.mode === 'sit' && document.querySelector('.pm-keys'), null, { timeout: 10000 });
  await p.waitForTimeout(1300);
}
const button = (p, text) => p.locator('.pm button', { hasText: text }).first();
const hide = (p, hidden) => p.evaluate(h => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
// A fixed camera's picture (no character), and the pixels inside a box of it.
const picture = (p, eye, at, fov = 30) => p.evaluate(async ([e, a, fv]) => {
  const L = __loft, c = L.camera.clone(), r = L.renderer, THREE = await import('three');
  c.position.set(e.x, e.y, e.z); c.lookAt(a.x, a.y, a.z); c.fov = fv; c.aspect = 1.5; c.updateProjectionMatrix();
  const pr = r.getPixelRatio(), size = r.getSize(new THREE.Vector2()), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
  r.setPixelRatio(1); r.setSize(300, 200, false); r.setClearColor(0x000000, 1);
  const vis = L.me.root.visible; L.me.root.visible = false;
  r.render(L.scene, c);
  const url = r.domElement.toDataURL('image/png');
  L.me.root.visible = vis; r.setPixelRatio(pr); r.setSize(size.x, size.y, false); r.setClearColor(cc, ca);
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = url; });
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  return Array.from(g.getImageData(0, 0, 300, 200).data);
}, [b2t(...eye), b2t(...at), fov]);
const region = (px, x0, y0, x1, y1) => {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 300 + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
  return { r: r / n, g: g / n, b: b / n, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / n };
};
// The lamp's bulb and the sheet music, from just off the piano.
const LAMP_VIEW = [[18.9, 10.25, 1.45], [18.59, 10.66, 1.51]];
const SHEET_VIEW = [[18.35, 9.95, 1.62], [18.35, 10.62, 1.26]];

(async () => {
  const M = await import('../web/src/pure/metronome.js'), SH = await import('../web/src/pure/sheet.js');
  const { noteName } = await import('../web/src/pianomode.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- the note names ----------
    if (want('names')) {
      const { ctx, p, errs } = await open(b, DESK);
      await sit(p);
      const off = await p.evaluate(() => ({ names: document.querySelector('.pm-keys').classList.contains('names'), shown: [...document.querySelectorAll('.pm-n')].filter(n => getComputedStyle(n).display !== 'none').length,
        pressed: [...document.querySelectorAll('.pm button')].find(b => b.textContent === 'Note names')?.getAttribute('aria-pressed'), letters: [...document.querySelectorAll('.pm-w span')].map(s => s.textContent).join('') }));
      check('the note names are hidden at first, the keyboard letters still on their keys', !off.names && off.shown === 0 && off.pressed === 'false' && off.letters === 'ASDFGHJKL;', JSON.stringify(off));
      await p.keyboard.press('KeyN');
      await p.waitForTimeout(150);
      const on = await p.evaluate(() => [...document.querySelectorAll('.pm-keys [data-m]')].map(k => {
        const n = k.querySelector('.pm-n'), r = document.createRange(); r.selectNodeContents(n);
        const box = r.getBoundingClientRect(), key = k.getBoundingClientRect();
        return { m: +k.dataset.m, text: n.textContent, shown: getComputedStyle(n).display !== 'none', px: parseFloat(getComputedStyle(n).fontSize), fits: box.left >= key.left - 0.5 && box.right <= key.right + 0.5 && box.bottom <= key.bottom };
      }));
      const right = on.every(k => k.text === noteName(k.m));
      check('N shows the names, C3 to C6 with the octave on each C, sharps on the black keys', right && on.every(k => k.shown) && on.length === 37, on.slice(0, 13).map(k => k.text).join(' '));
      check('every name fits inside its key at a readable size', on.every(k => k.fits && k.px >= 9), JSON.stringify(on.filter(k => !k.fits || k.px < 9).slice(0, 3)));
      check('the button says the names are on', (await button(p, 'Note names').getAttribute('aria-pressed')) === 'true');
      // With Ctrl held, - and = are the browser's zoom: the piano leaves them alone.
      const zoom = await p.evaluate(() => { const e = new KeyboardEvent('keydown', { code: 'Equal', key: '=', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(e); return [e.defaultPrevented, __piano.metronome.bpm]; });
      check('Ctrl and = is left to the browser', zoom[0] === false && zoom[1] === M.START_BPM, JSON.stringify(zoom));
      // Kept for the next visit, and through standing up and sitting down again.
      await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
      await p.reload();
      await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
      await sit(p);
      const kept = await p.evaluate(() => document.querySelector('.pm-keys').classList.contains('names'));
      await button(p, 'Note names').click();
      await p.waitForTimeout(150);
      const after = await p.evaluate(() => [document.querySelector('.pm-keys').classList.contains('names'), localStorage.getItem('loft.notenames')]);
      check('the choice is remembered on the next visit, and a click turns them off again', kept && after[0] === false && after[1] === '0', JSON.stringify({ kept, after }));
      check('names: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    // ---------- the metronome ----------
    if (want('metronome')) {
      const { ctx, p, errs } = await open(b, DESK, { sound: true });
      await sit(p);
      const rest = await p.evaluate(() => ({ on: __piano.metronome.on, running: __loft.audio.metronome.running, angle: __piano.metronome.angle, ticks: __loft.audio.metronome.scheduled.length }));
      check('it is off until asked: still, silent, nothing scheduled', !rest.on && !rest.running && rest.angle === 0 && rest.ticks === 0, JSON.stringify(rest));
      await p.keyboard.press('KeyM');
      await p.waitForTimeout(700);
      const run = await p.evaluate(() => {
        const m = __piano.metronome;
        return { on: m.on, clock: m.beat.clock, t0: m.beat.t0, bpm: m.beat.bpm, ticks: __loft.audio.metronome.scheduled, pressed: [...document.querySelectorAll('.pm button')].find(b => b.textContent === 'Metronome').getAttribute('aria-pressed') };
      });
      const spaced = run.ticks.every((t, i) => !i || Math.abs(t - run.ticks[i - 1] - 60 / run.bpm) < 1e-6);
      const atEnds = run.ticks.every(t => Math.abs(Math.abs(M.armAngle(t, run.t0, run.bpm)) - M.SWING) < 1e-6);
      const first = run.ticks.length && (run.ticks[0] - run.t0) / (60 / run.bpm);
      check('M starts it on the sound\'s own clock, ticking once a beat', run.on && run.clock === 'audio' && run.ticks.length >= 1 && spaced && run.pressed === 'true', JSON.stringify({ clock: run.clock, ticks: run.ticks.length, bpm: run.bpm }));
      check('every tick lands as the arm reaches the end of its swing', atEnds && (first % 1 > 0.49 && first % 1 < 0.51), JSON.stringify(run.ticks.slice(0, 3).map(t => +(t - run.t0).toFixed(3))));
      // Each frame the arm is drawn where the sound's clock says, the same clock the ticks are scheduled on.
      const frames = await p.evaluate(async () => {
        const out = [], until = performance.now() + 1600;
        while (performance.now() < until) {
          await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
          const m = __piano.metronome, b = m.beat;
          out.push({ angle: m.angle, at: b.at, t0: b.t0, bpm: b.bpm, ticks: __loft.audio.metronome.scheduled });
        }
        return out;
      });
      const drawnRight = frames.every(f => Math.abs(f.angle - M.armAngle(f.at, f.t0, f.bpm)) < 1e-9 && (!f.ticks.length || Math.min(...f.ticks.map(t => Math.abs(t - f.at))) < 60 / f.bpm + 0.35));
      check('the arm is drawn from the sound\'s own clock, the one the ticks are scheduled on', drawnRight, JSON.stringify(frames.slice(0, 2)));
      const swing = frames.map(f => f.angle);
      const span = [Math.min(...swing), Math.max(...swing)];
      check('the arm swings both ways, never past the end of its swing', span[0] < -M.SWING * 0.6 && span[1] > M.SWING * 0.6 && span.every(a => Math.abs(a) <= M.SWING + 1e-9), span.map(a => a.toFixed(3)).join(' to '));
      // Faster and slower, along the marks; the weight slides and the arm carries on from where it was.
      const before = await p.evaluate(() => [__piano.metronome.weight.position.y, __piano.metronome.angle]);
      await p.keyboard.press('Equal'); await p.keyboard.press('Equal');
      const up = await p.evaluate(() => ({ bpm: __piano.metronome.bpm, text: document.querySelector('.pm-tempo').textContent, y: __piano.metronome.weight.position.y }));
      // Every tick handed to the sound card over two seconds (it schedules a fraction of a second ahead).
      const up2 = await p.evaluate(async () => {
        const seen = new Set(), until = performance.now() + 2000;
        while (performance.now() < until) { for (const t of __loft.audio.metronome.scheduled) seen.add(t); await new Promise(r => setTimeout(r, 40)); }
        return [...seen].sort((a, b) => a - b);
      });
      const gaps = up2.slice(1).map((t, i) => t - up2[i]);
      check('= twice: two marks faster, the readout says so, the weight slides down', up.bpm === M.step(M.step(M.START_BPM, 1), 1) && up.text === `${up.bpm} bpm` && up.y < before[0], JSON.stringify({ bpm: up.bpm, text: up.text, y: [before[0].toFixed(3), up.y.toFixed(3)] }));
      check('the ticks change pace with it', gaps.length >= 2 && gaps.every(g => Math.abs(g - 60 / up.bpm) < 1e-6), JSON.stringify(gaps.map(g => g.toFixed(4))));
      await p.keyboard.press('Minus');
      await button(p, '+').click(); await button(p, '\u2212').click(); await button(p, '\u2212').click();
      const down = await p.evaluate(() => [__piano.metronome.bpm, localStorage.getItem('loft.metronome')]);
      check('- and the buttons step it back, and the tempo is kept for the next visit', down[0] === M.START_BPM && down[1] === String(down[0]), JSON.stringify(down));
      // Stopping takes back the ticks not yet heard and lets the arm settle in the middle.
      await p.keyboard.press('KeyM');
      const stopped = await p.evaluate(() => ({ on: __piano.metronome.on, running: __loft.audio.metronome.running, ticks: __loft.audio.metronome.scheduled.length }));
      await p.waitForTimeout(900);
      const still = await p.evaluate(() => __piano.metronome.angle);
      check('M again stops it: nothing more scheduled, the arm back in the middle', !stopped.on && !stopped.running && stopped.ticks === 0 && still === 0, JSON.stringify({ ...stopped, still }));
      // Started again while the arm is still settling back, it carries on from where it is, without a jump to the middle.
      const resumed = await p.evaluate(async () => {
        const m = __piano.metronome, frame = () => new Promise(r => requestAnimationFrame(r));
        m.start();
        for (let i = 0; i < 300 && Math.abs(m.angle) < 0.3; i++) await frame();
        m.stop(); await frame(); await frame();
        const before = m.angle;
        m.start(); m.tick(0);
        const after = m.angle, swing = [];
        for (let i = 0; i < 40; i++) { await frame(); swing.push(m.angle); }
        m.stop();
        return { before, after, most: Math.max(...swing.map(Math.abs)), crossed: swing.some(a => Math.sign(a) === -Math.sign(before)) };
      });
      check('started again while the arm settles, it swings on from where it is', Math.abs(resumed.before) > 0.1 && Math.abs(resumed.after - resumed.before) < 0.01 && resumed.crossed && resumed.most <= M.SWING + 1e-9, JSON.stringify(resumed));
      // A hidden tab stops it, and it stays off when the tab comes back.
      await p.keyboard.press('KeyM'); await p.waitForTimeout(300);
      await hide(p, true); await p.waitForTimeout(100);
      const hid = await p.evaluate(() => [__piano.metronome.on, __loft.audio.metronome.running, [...document.querySelectorAll('.pm button')].find(b => b.textContent === 'Metronome').getAttribute('aria-pressed')]);
      await hide(p, false); await p.waitForTimeout(400);
      const back = await p.evaluate(() => [__piano.metronome.on, __loft.audio.metronome.running]);
      check('a hidden tab stops it, and it stays off when the tab is back', hid.join() === 'false,false,false' && back.join() === 'false,false', JSON.stringify({ hid, back }));
      // Standing up stops it.
      await p.keyboard.press('KeyM'); await p.waitForTimeout(300);
      await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
      const up3 = await p.evaluate(() => [__piano.metronome.on, __loft.audio.metronome.running, __loft.mode, __piano.metronome.angle]);
      check('standing up stops it', up3[0] === false && up3[1] === false && up3[2] === 'walk' && up3[3] === 0, JSON.stringify(up3));
      // The weight is drawn with the shader the light switch's plate already uses: nothing new to build.
      const shared = await p.evaluate(() => { const P = m => __loft.renderer.properties.get(m).currentProgram; const w = P(__piano.metronome.weight.material), plate = P(__lights.group.children[0].material); return [!!w, w === plate]; });
      check('the weight needs no shader of its own', shared[0] && shared[1], JSON.stringify(shared));
      // How loud a tick is, rendered offline next to a piano note at the piano's usual touch, heard through an analyser
      // every 20 ms (the test page sends anything that reaches the speakers to silence).
      const loud = await p.evaluate(async () => {
        const core = await import('/src/audio/core.js'), met = await import('/src/audio/metronome.js'), syn = await import('/src/audio/synths.js');
        const bytes = await (await fetch('/assets/piano/C4.mp3')).arrayBuffer();
        const level = async fn => {
          const sr = 48000, ctx = new OfflineAudioContext(1, sr, sr), an = ctx.createAnalyser(), buf = new Float32Array(2048);
          an.fftSize = 2048; an.connect(ctx.destination);
          const e = core.makeEngine(ctx, an);
          await fn(e, ctx);
          let peak = 0;
          for (let k = 1; k < 45; k++) ctx.suspend(k * 0.02).then(() => { an.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); ctx.resume(); });
          await ctx.startRendering();
          return 20 * Math.log10(Math.max(peak, 1e-9));
        };
        return { tick: await level(e => met.tickAt(e, e.sfxIn, 0.05, null)), note: await level(async (e, ctx) => { const buf = await ctx.decodeAudioData(bytes); syn.sampleVoice(e, e.pianoIn, 0.05, 60, 0.75, new Map([[60, buf]])).release(0.8); }) };
      });
      check('a tick is soft: well under a piano note', loud.tick < loud.note - 12 && loud.tick < -24, `tick ${loud.tick.toFixed(1)} dB, note ${loud.note.toFixed(1)} dB`);
      check('metronome: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // With the sound not started yet, it swings silently on the page's clock; once the sound comes on it ticks.
      const s2 = await open(b, DESK);
      await sit(s2.p);
      await s2.p.keyboard.press('KeyM'); await s2.p.waitForTimeout(500);
      const silent = await s2.p.evaluate(() => ({ clock: __piano.metronome.beat.clock, running: __loft.audio.metronome.running, angle: __piano.metronome.angle }));
      await s2.p.click('#snd'); await s2.p.waitForTimeout(700);
      // The ticks it hands the sound card over a second and a half (it schedules only a fraction of a second ahead).
      const loudNow = await s2.p.evaluate(async () => {
        const seen = new Set(), until = performance.now() + 1500;
        while (performance.now() < until) { for (const t of __loft.audio.metronome.scheduled) seen.add(t); await new Promise(r => setTimeout(r, 40)); }
        return { clock: __piano.metronome.beat.clock, running: __loft.audio.metronome.running, ticks: seen.size };
      });
      check('with no sound yet it swings without ticking, and starts ticking when the sound comes on', silent.clock === 'perf' && !silent.running && silent.angle !== 0 && loudNow.clock === 'audio' && loudNow.running && loudNow.ticks >= 1, JSON.stringify({ silent, loudNow }));
      check('metronome, no sound: no page errors', s2.errs.length === 0, s2.errs.slice(0, 3).join(' | '));
      await s2.ctx.close();
    }

    // ---------- the lamp ----------
    if (want('lamp')) {
      const { ctx, p, errs } = await open(b, DESK, { extra: '&time=22:00' });
      const bulbs = () => p.evaluate(() => { const out = []; __loft.scene.traverse(o => { if (o.isMesh && o.material?.userData?.lamp === 'bulb' && o.name !== 'pianolamp_glow_warm') out.push(o.name + ':' + o.material.color.toArray().map(v => +v.toFixed(4)).join()); }); return out.join('|'); });
      const rest = await p.evaluate(() => ({ k: __piano.lamp.k, shown: __piano.lamp.glow.visible, switched: __piano.lamp.glow.material.customProgramCacheKey?.() === 'lamp', built: !!__loft.renderer.properties.get(__piano.lamp.glow.material).currentProgram }));
      check('at rest the warm glow is not drawn at all; it is on the light switch, its shader built with the rest of the house', rest.k === 0 && !rest.shown && rest.switched && rest.built, JSON.stringify(rest));
      const bulbs0 = await bulbs();
      const cold = region(await picture(p, ...LAMP_VIEW), 120, 75, 180, 125);
      await sit(p);
      for (let i = 0; i < 8; i++) { await p.keyboard.press(['KeyA', 'KeyD', 'KeyG', 'KeyJ'][i % 4]); await p.waitForTimeout(180); }
      const warm = await p.evaluate(() => ({ k: __piano.lamp.k, shown: __piano.lamp.glow.visible, colour: __piano.lamp.glow.material.color.toArray() }));
      const hot = region(await picture(p, ...LAMP_VIEW), 120, 75, 180, 125);
      check('playing warms it: an amber glow swells under the shade', warm.k > 0.8 && warm.shown && warm.colour[0] > warm.colour[1] && warm.colour[1] > warm.colour[2], JSON.stringify(warm));
      check('the lamp shows brighter and warmer in the room', hot.lum > cold.lum + 8 && hot.r - hot.b > cold.r - cold.b + 8, `lum ${cold.lum.toFixed(0)} to ${hot.lum.toFixed(0)}, red over blue ${(cold.r - cold.b).toFixed(0)} to ${(hot.r - hot.b).toFixed(0)}`);
      check('no other lamp changes', (await bulbs()) === bulbs0);
      await p.waitForTimeout(3500);
      const cooling = await p.evaluate(() => __piano.lamp.k);
      check('it eases back once the playing stops', cooling < 0.75 && cooling > 0, cooling.toFixed(3));
      // With the lamps off it stays dark, playing or not.
      await p.evaluate(() => __lights.set(false));
      // Played until it is warm again, then looked at straight away.
      for (let i = 0; i < 40 && (await p.evaluate(() => __piano.lamp.k)) < 0.9; i++) { await p.keyboard.press(['KeyA', 'KeyD', 'KeyG', 'KeyJ'][i % 4]); await p.waitForTimeout(120); }
      await p.waitForTimeout(400);
      const k = await p.evaluate(() => [__piano.lamp.k, __lights.k]);
      const dark = region(await picture(p, ...LAMP_VIEW), 120, 75, 180, 125);
      check('with the lamps off the warm lamp stays dark', k[0] > 0.8 && k[1] === 0 && dark.lum < hot.lum * 0.35 && dark.lum < cold.lum, `lum ${hot.lum.toFixed(0)} lit, ${dark.lum.toFixed(0)} off; ${JSON.stringify(k)}`);
      await p.evaluate(() => __lights.set(true));
      // It settles back to exactly nothing: not drawn again.
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => __piano.lamp.k === 0, null, { timeout: 20000 }).catch(() => {});
      const after = await p.evaluate(() => [__piano.lamp.k, __piano.lamp.glow.visible]);
      check('once cool it is not drawn at all again', after[0] === 0 && after[1] === false, JSON.stringify(after));
      check('lamp: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // A song played for you warms it too.
      const s = await open(b, DESK, { sound: true });
      await sit(s.p);
      await button(s.p, 'Play for me').click();
      await s.p.waitForTimeout(2500);
      const song = await s.p.evaluate(() => [__loft.audio.piano.playing, __piano.lamp.k]);
      check('a song played for you warms it too', song[0] && song[1] > 0.8, JSON.stringify(song));
      await s.p.evaluate(() => __loft.audio.piano.stopSong());
      await s.ctx.close();
    }

    // ---------- the sheet music ----------
    if (want('sheet')) {
      const { ctx, p, errs } = await open(b, DESK, { sound: true });
      const st0 = await p.evaluate(() => ({ ...__piano.sheet.state, w: __loft.screens.textures.sheet.image.width, h: __loft.screens.textures.sheet.image.height, leaf: __piano.sheet.leaf.visible }));
      check('the desk opens at the first song\'s first two pages, nothing turning', st0.song === 'gymnopedie' && st0.spread === 0 && st0.left === 0 && st0.right === 1 && !st0.turn && !st0.leaf && st0.w === 840 && st0.h === 560, JSON.stringify(st0));
      await sit(p);
      await p.locator('.pm-song', { hasText: 'Fur Elise' }).locator('button', { hasText: 'Play for me' }).click();
      await p.waitForTimeout(200);
      const st1 = await p.evaluate(() => __piano.sheet.state);
      check('a new song opens the sheet at its first page', st1.song === 'fur-elise' && st1.spread === 0 && st1.left === 0 && st1.right === 1, JSON.stringify(st1));
      const sc = SH.score('fur-elise');
      const log = await p.evaluate(async until => {
        const out = [];
        while (true) {
          await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
          const s = __loft.audio.piano.song, st = __piano.sheet.state, leaf = __piano.sheet.leaf;
          if (!s) break;
          const pos = leaf.children[0].geometry.attributes.position;
          let xs = [Infinity, -Infinity], zMin = Infinity;
          for (let i = 0; i < pos.count; i++) { xs = [Math.min(xs[0], pos.getX(i)), Math.max(xs[1], pos.getX(i))]; zMin = Math.min(zMin, pos.getZ(i)); }
          out.push({ at: s.at, spread: st.spread, p: st.turn ? st.turn.p : null, leaf: leaf.visible, left: st.left, right: st.right, xs, zMin });
          if (s.at > until) break;
        }
        return out;
      }, sc.turns[1] + 2);
      const turning = log.filter(r => r.p !== null);
      const startAt = turning[0]?.at, endAt = log.find(r => r.spread === 1)?.at;
      check('the first page turn starts just before bar 10, when the theme comes back', Math.abs(startAt - sc.turns[1]) < 0.08, `starts at ${startAt?.toFixed(2)} s, due ${sc.turns[1].toFixed(2)} s`);
      check('and lands as bar 10 begins', Math.abs(endAt - 9 * sc.barDur) < 0.08, `lands at ${endAt?.toFixed(2)} s, bar 10 at ${(9 * sc.barDur).toFixed(2)} s`);
      check('it moves with the song\'s clock', turning.every(r => Math.abs(r.p - (r.at - sc.turns[1]) / SH.TURN) < 0.08 || r.p === 1), JSON.stringify(turning.slice(0, 4).map(r => [+r.at.toFixed(2), +r.p.toFixed(2)])));
      const W = 0.21;
      check('the page lifts off the desk and lands on the left, staying within the open book', turning.every(r => r.leaf && r.xs[0] >= -W - 1e-3 && r.xs[1] <= W + 1e-3 && r.zMin >= 0.001) && turning.some(r => r.xs[0] < -W * 0.5),
        JSON.stringify(turning.filter((_, i) => i % 6 === 0).map(r => [+r.xs[0].toFixed(3), +r.xs[1].toFixed(3)])));
      check('while it turns, the next right page is already under it; after, both new pages show', turning.every(r => r.left === 0 && r.right === 3) && log.at(-1).left === 2 && log.at(-1).right === 3 && !log.at(-1).leaf, JSON.stringify(log.at(-1)));
      // The leaf is drawn with the desk sheet's own shader: nothing new to build when a page first turns.
      const shared = await p.evaluate(() => { const P = m => __loft.renderer.properties.get(m).currentProgram; const leaf = P(__piano.sheet.leaf.children[0].material), desk = P(__loft.world.pianoParts.sheet.material); return [!!leaf, leaf === desk]; });
      check('the turning page needs no shader of its own', shared[0] && shared[1], JSON.stringify(shared));
      // Stopped, it stays where it is; a new start of the same song goes back to page one.
      await button(p, 'Stop').click();
      const halt = await p.evaluate(() => __piano.sheet.state);
      await p.waitForTimeout(1500);
      const halt2 = await p.evaluate(() => [__piano.sheet.state, __piano.sheet.leaf.visible]);
      check('stopped, the sheet stays still where it is', JSON.stringify(halt) === JSON.stringify(halt2[0]) && halt.spread === 1 && !halt2[1], JSON.stringify(halt2));
      await p.locator('.pm-song', { hasText: 'Fur Elise' }).locator('button', { hasText: 'Play for me' }).click();
      await p.waitForTimeout(200);
      const again = await p.evaluate(() => __piano.sheet.state);
      check('starting the song again puts it back on page one', again.song === 'fur-elise' && again.spread === 0 && again.left === 0, JSON.stringify(again));
      await button(p, 'Stop').click();
      // Learning: the page turns when you reach the first note on the next pages.
      await p.locator('.pm-song', { hasText: 'Ode to Joy' }).locator('button', { hasText: 'Learn' }).click();
      await p.waitForTimeout(200);
      const ode = SH.score('ode-to-joy');
      const learn0 = await p.evaluate(() => __piano.sheet.state);
      let turnedAt = null, steps = 0;
      for (; steps < 60; steps++) {
        const s = await p.evaluate(() => [__loft.pianoMode.lesson, __piano.sheet.state]);
        if (!s[0]) break;
        if (s[1].turn && turnedAt === null) turnedAt = SH.barAt(ode, s[0].at);
        if (s[1].spread === 1) break;
        const box = await p.locator('.pm .next').first().boundingBox();
        if (!box) break;
        await p.mouse.move(box.x + box.width / 2, box.y + box.height - 10); await p.mouse.down(); await p.waitForTimeout(40); await p.mouse.up();
        await p.waitForTimeout(60);
      }
      await p.waitForTimeout(1200);
      const learn1 = await p.evaluate(() => [__piano.sheet.state, __loft.pianoMode.lesson]);
      check('learning Ode to Joy opens its first page; the page turns as you reach bar 9, the first note on the next pages', learn0.song === 'ode-to-joy' && learn0.spread === 0 && turnedAt === 8 && learn1[0].spread === 1 && !learn1[0].turn, JSON.stringify({ turnedAt, steps, st: learn1[0] }));
      // The turns, step by step, straight to the sheet: back from a hidden tab pages on, it goes straight there.
      await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
      const direct = await p.evaluate(turns => {
        const s = __piano.sheet, out = [];
        const src = at => ({ id: 'fur-elise', run: 'test', at, live: true });
        s.tick(0.016, src(0)); out.push(s.state.spread);
        s.tick(0.016, src(turns[1] + 0.3)); out.push(s.state.turn ? +s.state.turn.p.toFixed(2) : null);
        s.tick(0.016, src(turns[1] + 0.95)); out.push(s.state.spread);
        s.tick(0.016, src(30)); out.push([s.state.spread, !!s.state.turn]);
        s.tick(0.016, src(39)); out.push([s.state.spread, !!s.state.turn]);
        s.tick(0.016, null); out.push(s.state.spread);
        return out;
      }, sc.turns);
      check('a turn follows the song\'s time; a jump of pages goes straight there, no turn', direct[0] === 0 && Math.abs(direct[1] - 0.33) < 0.02 && direct[2] === 1 && direct[3].join() === '2,false' && direct[4].join() === '3,false' && direct[5] === 3, JSON.stringify(direct));
      check('sheet: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // From over the bench, at night with the lamps on and off: the page turning is there to see and dims with the room.
      const n = await open(b, DESK, { extra: '&time=22:00' });
      await n.p.evaluate(() => { const s = __piano.sheet; window.__run = 'n' + Math.random(); s.tick(0.016, { id: 'fur-elise', run: __run, at: 0, live: true }); });
      await n.p.evaluate(t => { __piano.sheet.tick(0.016, { id: 'fur-elise', run: __run, at: t, live: true }); }, sc.turns[1] + SH.TURN * 0.5);
      const flat = await picture(n.p, ...SHEET_VIEW);
      await n.p.evaluate(t => { __piano.sheet.tick(0.016, { id: 'fur-elise', run: __run, at: t, live: true }); }, sc.turns[1] + SH.TURN * 0.5);
      const lifted = await picture(n.p, ...SHEET_VIEW);
      await n.p.evaluate(() => __lights.set(false)); await n.p.waitForTimeout(800);
      await n.p.evaluate(t => { __piano.sheet.tick(0.016, { id: 'fur-elise', run: __run, at: t, live: true }); }, sc.turns[1] + SH.TURN * 0.5);
      const liftedDark = await picture(n.p, ...SHEET_VIEW);
      let changed = 0;
      for (let i = 0; i < flat.length; i += 4) if (Math.abs(flat[i] - lifted[i]) + Math.abs(flat[i + 1] - lifted[i + 1]) + Math.abs(flat[i + 2] - lifted[i + 2]) > 30) changed++;
      check('mid-turn the lifted page is plain to see from the bench', changed > 300, `${changed} pixels changed`);
      check('with the lamps off the sheet and its turning page go dark with the room', region(liftedDark, 60, 30, 240, 170).lum < region(lifted, 60, 30, 240, 170).lum * 0.4, `${region(lifted, 60, 30, 240, 170).lum.toFixed(0)} to ${region(liftedDark, 60, 30, 240, 170).lum.toFixed(0)}`);
      check('sheet at night: no page errors', n.errs.length === 0, n.errs.slice(0, 3).join(' | '));
      await n.ctx.close();
    }

    // ---------- on a phone ----------
    if (want('phone')) {
      const { ctx, p, errs } = await open(b, PHONE);
      await sit(p);
      await p.locator('.pm button', { hasText: 'Note names' }).tap();
      await p.waitForTimeout(150);
      const ph = await p.evaluate(() => {
        const keys = [...document.querySelectorAll('.pm-keys [data-m]')];
        const white = keys.filter(k => k.classList.contains('pm-w')).map(k => { const n = k.querySelector('.pm-n'), r = document.createRange(); r.selectNodeContents(n); const box = r.getBoundingClientRect(), key = k.getBoundingClientRect(); return { px: parseFloat(getComputedStyle(n).fontSize), shown: getComputedStyle(n).display !== 'none', fits: box.left >= key.left - 0.5 && box.right <= key.right + 0.5 }; });
        const black = keys.filter(k => k.classList.contains('pm-b')).map(k => getComputedStyle(k.querySelector('.pm-n')).display);
        const pm = document.querySelector('.pm').getBoundingClientRect(), tools = [...document.querySelectorAll('.pm-row')][2].getBoundingClientRect();
        return { white, black, inside: pm.left >= 0 && pm.right <= innerWidth && pm.top >= 0, toolsOneLine: tools.height < 40, scroll: document.documentElement.scrollWidth <= innerWidth };
      });
      check('phone: the white keys\' names show, readable and inside their keys; the narrow black keys leave theirs off', ph.white.every(k => k.shown && k.px >= 10 && k.fits) && ph.black.every(d => d === 'none'), JSON.stringify(ph.white.slice(0, 3)));
      check('phone: the panel fits the screen, its new row on one line, no sideways scroll', ph.inside && ph.toolsOneLine && ph.scroll, JSON.stringify(ph));
      await p.locator('.pm button', { hasText: 'Metronome' }).tap(); await p.waitForTimeout(300);
      await p.locator('.pm button', { hasText: '+' }).tap();
      const tap = await p.evaluate(() => [__piano.metronome.on, __piano.metronome.bpm]);
      check('phone: a tap starts the metronome and + speeds it up', tap[0] && tap[1] === M.step(M.START_BPM, 1), JSON.stringify(tap));
      await p.locator('.pm button', { hasText: 'Stand up' }).tap(); await p.waitForTimeout(1200);
      check('phone: standing up stops it', !(await p.evaluate(() => __piano.metronome.on)));
      check('phone: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
