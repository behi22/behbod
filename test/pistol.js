// The pistol in the hand, desktop and phone, its sounds made in a worker or without one: LOFT_URL=http://127.0.0.1:8814 node test/pistol.js [outdir]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/pistol';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

function watch(p, errs, files) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', async r => {
    if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`);
    if (/p22\.glb/.test(r.url())) files.push((await r.body().catch(() => Buffer.alloc(0))).length);
    if (/hand\.glb/.test(r.url())) files.hand = (files.hand || 0) + 1;
  });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if ((m.type() === 'error' || (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text()))) && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200)); });
}
// The page's own sound, counted: the gun's moves as they are cued, and the sound card's buffers as they are played.
function countSound() {
  window.__heard = { cues: [], shots: 0, buffers: 0, made: 0, played: 0 };
  const C = window.BaseAudioContext || window.AudioContext, make = C.prototype.createBuffer;
  C.prototype.createBuffer = function (ch, n, sr) { if (ch === 2 && sr === 48000) window.__heard.buffers++; return make.call(this, ch, n, sr); };
  const AB = window.AudioBuffer;
  // The gun's sounds are made this way (audio/range.js); the house's reverb and room loops by createBuffer.
  window.AudioBuffer = function (o) { if (o?.numberOfChannels === 2 && o.sampleRate === 48000) { window.__heard.buffers++; window.__heard.made++; } return new AB(o); };
  window.AudioBuffer.prototype = AB.prototype;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.sampleRate === 48000 && this.buffer.numberOfChannels === 2) window.__heard.played++; return start.apply(this, a); };
}
async function open(b, opts, init) {
  const p = await b.newPage(opts), errs = [], files = [];
  watch(p, errs, files);
  await p.addInitScript(countSound);
  if (init) await p.addInitScript(init);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'ultra'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  // Sound on, as a visitor's first click would have it, so the gun's sounds really play (into the test's silence).
  await p.evaluate(() => document.getElementById('snd').click());
  const t0 = Date.now();
  await p.evaluate(() => __loft.range.load());
  const ready = Date.now() - t0;
  await p.evaluate(() => {
    const sfx = __loft.audio.sfx, cue = sfx.gunCue, shot = sfx.gunShot;
    sfx.gunCue = (n, id) => { __heard.cues.push(n); return cue(n, id); };
    sfx.gunShot = (l, id) => { __heard.shots++; return shot(l, id); };
  });
  return { p, errs, files, ready };
}
async function toLine(p) {
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1500);
  const at = await p.evaluate(() => __loft.meta.interact.find(i => i.id === 'range').at);
  await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...at));
  await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('range'));
  await p.waitForTimeout(1200);
}
const heard = p => p.evaluate(() => ({ ...__heard, cues: __heard.cues.slice() }));
const since = (a, b) => b.cues.slice(a.cues.length);

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- desktop ----------
    const { p, errs, files, ready } = await open(b, { viewport: { width: 1280, height: 800 } });
    check('the squeezed gun file comes down, much smaller than the 2.3 MB it was', files.length === 1 && files[0] > 100000 && files[0] < 800000, `${files} bytes, the range ready in ${ready} ms`);
    check('the realistic hand file comes down with the range, once', files.hand === 1, `${files.hand || 0} times`);
    await toLine(p);
    await p.click('.rg-card .rg-acts button.go');
    await p.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
    await p.waitForTimeout(400);

    const built = await p.evaluate(async () => {
      const { GUN_HOLDS } = await import('/src/pure/handling.js');
      const { padLocal } = await import('/src/pure/realhand.js');
      const g = __loft.range.gun, V = () => __loft.camera.position.clone().set(0, 0, 0);
      g.scene.updateMatrixWorld(true);
      const H = GUN_HOLDS.pistol, model = g.model;
      // Where the trigger finger's pad is, against where the trigger's face is, in the gun's own space.
      const tipBone = g.hands.right.bones.find(o => o.name === 'right_index3');
      const tip = model.worldToLocal(tipBone.localToWorld(V().set(...padLocal('index'))));
      const pad = V().set(...H.trigger.pad), part = model.getObjectByName('P22_trigger');
      // The grip as the hands feel it, against the gun's own surface: points of the frame's grip panels.
      const frame = model.getObjectByName('P22_frame'), off = [], v = V();
      frame.traverse(o => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); model.worldToLocal(v);
          if (v.y < -0.035 && v.y > -0.1 && Math.abs(v.z) > 0.012) off.push(Math.abs(H.shape([v.x, v.y, v.z])));
        }
      });
      off.sort((a, c) => a - c);
      return {
        hands: ['right', 'left'].map(s => g.hands[s].root.visible && g.hands[s].mesh.isSkinnedMesh && g.hands[s].mesh.name === s + '_realhand').every(Boolean),
        baked: ['P22_hand_r', 'P22_hand_l', 'P22_hand_l_mag'].some(n => model.getObjectByName(n)),
        trigger: tip.distanceTo(pad), pivot: part.position.toArray().map(x => +x.toFixed(4)),
        fit: { n: off.length, median: off[off.length >> 1], p95: off[Math.floor(off.length * 0.95)] },
      };
    });
    check('both hands are built in the page, skinned, and the gun file has none of its own', built.hands && !built.baked, JSON.stringify({ hands: built.hands, baked: built.baked }));
    check('the trigger finger\'s pad is on the trigger', built.trigger < 0.006, `${(built.trigger * 1000).toFixed(1)} mm`);
    check('the trigger still turns about its own pin in the squeezed file', Math.hypot(built.pivot[0] - 0.051, built.pivot[1] + 0.0155, built.pivot[2]) < 1e-4, JSON.stringify(built.pivot));
    check('the grip the hands close on is the gun\'s own grip (its panels: half within 2.5 mm, nearly all within 6)', built.fit.n > 50 && built.fit.median < 0.0025 && built.fit.p95 < 0.006, JSON.stringify(built.fit));

    // A shot with the real mouse.
    let h0 = await heard(p);
    const shots0 = await p.evaluate(() => __loft.range.debug.run.shots);
    await p.mouse.move(640, 400); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up();
    await p.waitForTimeout(400);
    let h1 = await heard(p);
    check('a click fires: the shot is heard as a made sample', (await p.evaluate(() => __loft.range.debug.run.shots)) === shots0 + 1 && h1.shots === h0.shots + 1 && h1.played > h0.played && h1.buffers >= 1, JSON.stringify({ shots: h1.shots - h0.shots, played: h1.played - h0.played, buffers: h1.buffers }));
    const bank = await p.evaluate(() => __loft.audio.sfx.gunSoundStats());
    check('the gun\'s sounds were made off the page\'s thread, each held once, no suppressed shot without a suppressor', bank.where === 'worker' && bank.sounds === 16 && bank.queued === 0 && bank.bytes < 4.5e6 && h1.made === bank.sounds, JSON.stringify({ ...bank, made: h1.made, buffers: h1.buffers }));

    // A reload on R: the magazine's moves are heard in order, the gun is full again.
    h0 = await heard(p);
    // Keys and pads are held as long as a person holds them (a press shorter than a frame is not seen).
    await p.keyboard.press('KeyR', { delay: 90 });
    await p.waitForTimeout(1900);
    h1 = await heard(p);
    const rel = await p.evaluate(() => ({ phase: __loft.range.debug.weapon.phase, ammo: __loft.range.debug.weapon.ammo }));
    check('R reloads: release, out, drop, in, in that order, and the gun is full', JSON.stringify(since(h0, h1)) === JSON.stringify(['cloth', 'magRelease', 'magOut', 'magDrop', 'magIn']) && rel.phase === 'ready' && rel.ammo === 16, `${JSON.stringify(since(h0, h1))} ${JSON.stringify(rel)}`);
    await p.screenshot({ path: `${OUT}/desktop-after-reload.png` });

    // From empty: the slide stays back, and the thumb lets it go at the end of the reload.
    await p.evaluate(() => { __loft.range.debug.weapon.ammo = 1; });
    await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(300);
    const locked = await p.evaluate(() => ({ slide: __loft.range.gun.part.slide.position.x, stop: __loft.range.gun.part.stop.rotation.z }));
    h0 = await heard(p);
    await p.keyboard.press('KeyR', { delay: 120 });
    await p.waitForTimeout(1250);
    const mid = await p.evaluate(() => __loft.range.gun.part.stop.rotation.z);
    await p.waitForTimeout(1100);
    h1 = await heard(p);
    const after = await p.evaluate(() => ({ slide: __loft.range.gun.part.slide.position.x, stop: __loft.range.gun.part.stop.rotation.z, ammo: __loft.range.debug.weapon.ammo }));
    check('empty, the slide locks back on its stop', locked.stop < -0.1 && locked.slide < after.slide - 0.03, JSON.stringify(locked));
    check('a reload from empty ends with the slide let go: heard, the stop down, the slide home', since(h0, h1).at(-1) === 'slideRelease' && mid < -0.1 && after.stop === 0 && after.ammo === 15, `${JSON.stringify(since(h0, h1))} ${JSON.stringify(after)}`);

    // The look over, on F: it plays through, its slide check heard, and it gives the gun back.
    h0 = await heard(p);
    await p.keyboard.press('KeyF');
    await p.waitForTimeout(300);
    const looking = await p.evaluate(() => __loft.range.gun.inspecting);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/desktop-inspect.png` });
    await p.waitForTimeout(2400);
    h1 = await heard(p);
    const done = await p.evaluate(() => __loft.range.gun.inspecting);
    check('F looks the gun over, eases the slide back and gives it back', looking && !done && since(h0, h1).includes('slidePull') && since(h0, h1).includes('slideHome'), JSON.stringify(since(h0, h1)));
    // Aiming while the hand holds the slide back: the slide still goes home with its sound.
    h0 = await heard(p);
    await p.keyboard.press('KeyF');
    await p.evaluate(() => new Promise(r => { const n = __heard.cues.length, f = () => { if (__heard.cues.slice(n).includes('slidePull')) { __loft.range.press('aim', true); r(); } else requestAnimationFrame(f); }; f(); }));
    await p.waitForTimeout(300);
    await p.evaluate(() => __loft.range.press('aim', false));
    await p.waitForTimeout(400);
    h1 = await heard(p);
    const cutShort = await p.evaluate(() => __loft.range.gun.inspecting);
    check('aiming during the look into the chamber lets the slide go home, heard', !cutShort && since(h0, h1).at(-1) === 'slideHome', JSON.stringify(since(h0, h1)));
    // A shot ends a look over at once; aiming keeps one from starting.
    await p.keyboard.press('KeyF'); await p.waitForTimeout(500);
    const s0 = await p.evaluate(() => __loft.range.debug.run.shots);
    await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(120);
    const cut = await p.evaluate(s => ({ shot: __loft.range.debug.run.shots === s + 1, looking: __loft.range.gun.inspecting }), s0);
    check('a shot ends a look over at once', cut.shot && !cut.looking, JSON.stringify(cut));
    await p.mouse.down({ button: 'right' }); await p.waitForTimeout(400);
    await p.keyboard.press('KeyF'); await p.waitForTimeout(150);
    const aimed = await p.evaluate(() => __loft.range.gun.inspecting);
    await p.mouse.up({ button: 'right' });
    check('no look over while aiming down the sights', !aimed);
    // The hint line names the key.
    const hint = await p.evaluate(() => document.querySelector('.rg-hint')?.textContent || '');
    check('the hint line names F for inspect', /F inspect/.test(hint), JSON.stringify(hint));

    // Speed with the processor slowed four times: frames through a reload and a look over at the line.
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.keyboard.press('KeyR', { delay: 120 });
    const slow = await p.evaluate(() => new Promise(r => {
      const t = []; let last = performance.now();
      const f = now => { t.push(now - last); last = now; if (t.length === 150) __loft.range.gun.inspect(__loft.range.debug.weapon, __loft.range.debug.stats); if (t.length < 300) requestAnimationFrame(f); else r(t.slice(2)); };
      requestAnimationFrame(f);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    slow.sort((a, c) => a - c);
    const avg = slow.reduce((a, c) => a + c, 0) / slow.length;
    check('slowed four times, the hands keep the frame rate (a reload and a look over)', avg < 34, `average ${avg.toFixed(1)} ms, worst ${slow.at(-1).toFixed(0)} ms, 95th ${slow[Math.floor(slow.length * 0.95)].toFixed(0)} ms`);
    check('desktop: no errors or warnings', errs.length === 0, JSON.stringify(errs.slice(0, 5)));
    await p.close();

    // ---------- phone ----------
    const ph = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const q = ph.p;
    await toLine(q);
    await q.tap('.rg-card .rg-acts button.go');
    await q.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
    await q.waitForTimeout(600);
    const pads = await q.evaluate(() => {
      const r = [...document.querySelectorAll('.rg-pad')].map(e => { const b = e.getBoundingClientRect(); return { c: e.className, l: b.left, t: b.top, r: b.right, bt: b.bottom }; });
      const over = (a, c) => a.l < c.r && c.l < a.r && a.t < c.bt && c.t < a.bt;
      let clash = 0;
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (over(r[i], r[j])) clash++;
      return { n: r.length, clash, inside: r.every(b => b.l >= 0 && b.t >= 0 && b.r <= innerWidth && b.bt <= innerHeight), insp: !!document.querySelector('.rg-insp'), wide: document.documentElement.scrollWidth <= innerWidth };
    });
    check('phone: five thumb pads, the new INSPECT one among them, all on screen, none over another', pads.n === 5 && pads.insp && pads.clash === 0 && pads.inside && pads.wide, JSON.stringify(pads));
    await q.tap('.rg-insp');
    await q.waitForTimeout(400);
    const pl = await q.evaluate(() => __loft.range.gun.inspecting);
    check('phone: the INSPECT pad looks the gun over', pl);
    await q.screenshot({ path: `${OUT}/phone-inspect.png` });
    await q.waitForTimeout(3600);
    await q.evaluate(() => { __loft.range.debug.weapon.ammo = 3; });
    const hq0 = await heard(q);
    const lb = await q.locator('.rg-load').boundingBox();
    await q.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await q.mouse.down(); await q.waitForTimeout(100); await q.mouse.up();
    await q.waitForTimeout(1900);
    const hq1 = await heard(q);
    check('phone: the LOAD pad reloads, heard move by move', since(hq0, hq1).includes('magIn') && (await q.evaluate(() => __loft.range.debug.weapon.ammo)) === 16, JSON.stringify(since(hq0, hq1)));
    check('phone: no errors or warnings', ph.errs.length === 0, JSON.stringify(ph.errs.slice(0, 5)));
    await q.close();

    // ---------- a browser with no workers: the page makes the sounds itself, and none goes missing ----------
    const nw = await open(b, { viewport: { width: 1280, height: 800 } }, () => { delete window.Worker; });
    const r = nw.p;
    await toLine(r);
    await r.click('.rg-card .rg-acts button.go');
    await r.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
    const n0 = await heard(r);
    await r.mouse.move(640, 400); await r.mouse.down(); await r.waitForTimeout(80); await r.mouse.up();
    await r.waitForTimeout(400);
    const n1 = await heard(r), nb = await r.evaluate(() => __loft.audio.sfx.gunSoundStats());
    check('no worker: the draw and the shot are still heard, made on the page', nb.where === 'page' && n0.played >= 1 && n1.shots === n0.shots + 1 && n1.played > n0.played, JSON.stringify({ ...nb, before: n0.played, after: n1.played }));
    check('no worker: no errors or warnings', nw.errs.length === 0, JSON.stringify(nw.errs.slice(0, 5)));
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'all PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
