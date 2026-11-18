// The range's robots and its last two stages, in a real browser on a computer and on a phone: the walker and the
// drone as built, how they react to a hit and how they come apart, lights out with the flashlight, the long shot down
// the tunnel, and on Hard the drones' warned bolts (struck, dodged, shot down) and the three shields.
//   LOFT_URL=http://127.0.0.1:8815 node test/foes.js [outdir]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/foes';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// Opens the house, makes the range ready and steps up to the line. `stars` opens stages on this visitor's record first.
async function open(b, opts, q, stars = [], sound = false) {
  const p = await b.newPage(opts), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${q}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  // Sound on, so every sound the robots make really runs (the test browser sends it nowhere).
  if (sound) { await p.click('#snd'); await p.waitForTimeout(300); }
  await p.evaluate(s => { for (const st of s) __loft.progress.rangeResult(st, 'normal', 1, 10); }, stars);
  await p.evaluate(() => __loft.range.load());
  await p.waitForFunction(() => __loft.range.ready, null, { timeout: 60000 });
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1200);
  const at = require('../web/assets/world.json').interact.find(i => i.id === 'range').at;
  await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...at));
  await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('range'));
  await p.waitForFunction(() => __loft.range.state === 'menu', null, { timeout: 8000 });
  return { p, errs };
}
// Time moves only by what is handed out, a frame drawn for each step.
const stepper = p => (dt, n = 1) => p.evaluate(async ([d, k]) => { for (let i = 0; i < k; i++) { __loft.range.advance(d); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } }, [dt, n]);
async function begin(p, stage, difficulty, seed) {
  await p.evaluate(([s, d, sd]) => { __loft.range.start(s, d, sd); __loft.range.film(true); }, [stage, difficulty, seed]);
  await stepper(p)(0.25, 9);
}
async function until(p, fn, arg, max = 400, dt = 0.05) {
  for (let i = 0; i < max; i++) { if (await p.evaluate(fn, arg)) return true; await stepper(p)(dt); }
  return false;
}
// The mean brightness (0..1) of parts of a screenshot: [x0, y0, x1, y1] as shares of the picture.
async function brightness(p, buf, rects) {
  return p.evaluate(async ([url, rs]) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return rs.map(([a, b, cc, d]) => {
      const x = Math.floor(a * img.width), y = Math.floor(b * img.height), w = Math.max(1, Math.floor((cc - a) * img.width)), h = Math.max(1, Math.floor((d - b) * img.height));
      const px = g.getImageData(x, y, w, h).data;
      let s = 0;
      for (let i = 0; i < px.length; i += 4) s += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      return s / (px.length / 4) / 255;
    });
  }, [`data:image/png;base64,${buf.toString('base64')}`, rects]);
}
const fire = async p => { const st = stepper(p); await p.evaluate(() => __loft.range.press('fire', true)); await st(0.012, 2); await p.evaluate(() => __loft.range.press('fire', false)); await st(0.012, 2); };

async function desktop(b) {
  const { p, errs } = await open(b, { viewport: { width: 1280, height: 800 } }, 'ultra', ['warmup', 'walkers', 'swarm', 'dark'], true);
  const st = stepper(p);
  const audio = () => p.evaluate(async () => { const { stats } = await import('/src/audio/core.js'); return { loops: stats.loops, shots: stats.shots, on: !!__loft.audio.sfx && document.getElementById('snd').textContent }; });
  const quiet = await audio();
  const card = await p.evaluate(() => ({ open: document.querySelectorAll('.rg-card .rg-list button:not([disabled])').length, text: document.querySelector('.rg-card').textContent }));
  await begin(p, 'warmup', 'normal', 3);
  check('a run on Normal makes none of the warning pieces', await p.evaluate(() => !document.querySelector('.rg-danger, .rg-warn, .rg-alert')));
  await p.evaluate(() => { __loft.range.film(false); __loft.range.escape(); });
  await p.evaluate(() => [...document.querySelectorAll('.rg-card button')].find(x => x.textContent === 'Stages').click());
  await p.waitForTimeout(300);
  check('every stage can be picked once the one before has a star', card.open === 5, `${card.open} open`);
  check('the stage card no longer says stages are still being built, and says Hard shoots back', !/stages are still|Opens with the next/.test(card.text) && /On Hard the drones shoot back/.test(card.text));
  await p.click('.rg-card .rg-list button:nth-child(4)'); await p.waitForTimeout(150);
  check('the lights-out stage reads as such on the card', /The hall goes dark/.test(await p.evaluate(() => document.querySelector('.rg-card').textContent)));

  // The walker: what it is made of, how it takes a hit, how it comes apart.
  await begin(p, 'walkers', 'normal', 7);
  await until(p, () => __loft.range.debug.targets.some(t => t.kind === 'walker'));
  await st(0.1, 25);
  const model = await p.evaluate(() => {
    const o = __loft.range.targets.live().find(x => x.kind === 'walker');
    let meshes = 0, tris = 0;
    o.g.traverse(m => { if (m.isMesh) { meshes++; tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } });
    return { id: o.id, parts: o.homes.length, meshes, tris: Math.round(tris), eyes: o.part.eyes.material.type, core: o.part.core.material.type };
  });
  check('the walker is a jointed model: pelvis, torso, head, two arms, two legs', model.parts === 7, JSON.stringify(model));
  check('the walker draws in a handful of pieces', model.meshes <= 20 && model.tris < 16000, `${model.meshes} meshes, ${model.tris} triangles`);
  await p.evaluate(id => __loft.range.aimAtTarget(id, 'body'), model.id);
  await st(0.02, 2);
  const hp0 = await p.evaluate(id => __loft.range.debug.run.live.get(id).hp, model.id);
  await fire(p);
  const hurt = await p.evaluate(id => { const o = __loft.range.targets.live().find(x => x.id === id), g = __loft.range.debug.run.live.get(id); return { hp: g?.hp, flash: o?.flash, glow: o?.mat.vinyl.emissive.r, hurt: o?.hurt }; }, model.id);
  check('a body shot hurts the walker and it flashes and flinches', hurt.hp < hp0 && hurt.flash > 0 && hurt.glow > 0 && hurt.hurt > 0, JSON.stringify({ hp0, ...hurt }));
  await p.screenshot({ path: `${OUT}/walker-hit.png` });
  await st(0.1, 3);
  await p.evaluate(id => __loft.range.aimAtTarget(id), model.id); await st(0.02, 2);
  const bodies0 = await p.evaluate(() => __loft.range.debug.fx.bodies);
  for (let i = 0; i < 4 && await p.evaluate(id => __loft.range.debug.run.live.has(id), model.id); i++) { await p.evaluate(id => __loft.range.aimAtTarget(id), model.id); await st(0.02, 2); await fire(p); await st(0.1, 4); }
  const down = await p.evaluate(([id, n]) => ({ alive: __loft.range.debug.run.live.has(id), bodies: __loft.range.debug.fx.bodies - n, kills: __loft.range.debug.run.kills }), [model.id, bodies0]);
  check('core shots bring the walker down and it comes apart in pieces', !down.alive && down.kills >= 1 && down.bodies >= 7, JSON.stringify(down));
  await p.evaluate(() => __loft.range.film(false));

  // The drone: one shot in its eye, it tumbles out of the air and breaks up on the floor.
  await begin(p, 'swarm', 'normal', 3);
  await until(p, () => __loft.range.debug.targets.some(t => t.kind === 'drone'));
  await st(0.1, 12);
  const hums = await p.evaluate(async () => { const { stats } = await import('/src/audio/core.js'); const d = __loft.range.targets.live().filter(x => x.kind === 'drone'); return { drones: d.length, humming: d.filter(x => x.hum).length, loops: stats.loops }; });
  check('each drone in the air hums, its rotors heard from where it is', hums.drones > 0 && hums.humming === hums.drones && hums.loops >= quiet.loops + hums.drones, JSON.stringify({ quiet, hums }));
  const did = await p.evaluate(() => __loft.range.debug.targets.find(t => t.kind === 'drone').id);
  await p.evaluate(() => __loft.range.press('aim', true)); await st(0.05, 6);
  await p.evaluate(id => __loft.range.aimAtTarget(id), did); await st(0.02, 2);
  const drone = await p.evaluate(id => { const o = __loft.range.targets.live().find(x => x.id === id); let meshes = 0, tris = 0; o.g.traverse(m => { if (m.isMesh) { meshes++; tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } }); return { meshes, tris: Math.round(tris) }; }, did);
  check('the drone draws in a handful of pieces', drone.meshes <= 16 && drone.tris < 8000, JSON.stringify(drone));
  await fire(p);
  const drop = await p.evaluate(id => __loft.range.targets.live().some(x => x.id === id), did);
  await p.evaluate(() => __loft.range.press('aim', false));
  await st(0.05, 6);
  const after = await p.evaluate(() => ({ kills: __loft.range.debug.run.kills, weak: __loft.range.debug.run.weak }));
  check('an eye shot takes the drone down (its weak spot)', !drop && after.kills >= 1 && after.weak >= 1, JSON.stringify(after));
  await p.screenshot({ path: `${OUT}/drone-down.png` });
  await p.evaluate(() => __loft.range.film(false));

  // Lights out: the hall goes dark, the flashlight comes on and lights what is in front of the gun.
  await begin(p, 'warmup', 'normal', 3);
  await p.evaluate(() => __loft.range.lookAt(11.7, -16, 0.9)); await st(0.05, 4);
  const lit = await brightness(p, await p.screenshot(), [[0, 0, 1, 1], [0.3, 0.5, 0.5, 0.68], [0, 0.55, 0.12, 0.8]]);
  await begin(p, 'dark', 'normal', 3);
  await st(0.1, 10);
  const state = await p.evaluate(() => ({ lights: __loft.range.lights, on: __loft.range.flashlight.on, level: __loft.range.flashlight.level }));
  await p.evaluate(() => __loft.range.lookAt(11.7, -16, 0.9)); await st(0.05, 4);
  const darkShot = await p.screenshot({ path: `${OUT}/dark.png` });
  const dk = await brightness(p, darkShot, [[0, 0, 1, 1], [0.3, 0.5, 0.5, 0.68], [0, 0.55, 0.12, 0.8]]);
  check('lights out: the hall goes dark and the flashlight is on', state.lights < 0.05 && state.on && state.level === 1, JSON.stringify(state));
  check('the dark hall is far darker than the lit one', dk[0] < lit[0] * 0.5, `whole picture ${lit[0].toFixed(3)} lit, ${dk[0].toFixed(3)} dark`);
  check('the flashlight lights the floor ahead and not the edge of the room', dk[1] > dk[2] * 2.5 && dk[1] > 0.06, `ahead ${dk[1].toFixed(3)}, edge ${dk[2].toFixed(3)}`);
  // Down the sights at each plate as it stands up (one may stand behind a barrier) until one falls.
  const k0 = await p.evaluate(() => __loft.range.debug.run.kills);
  await p.evaluate(() => __loft.range.press('aim', true));
  for (let i = 0; i < 4 && await p.evaluate(k => __loft.range.debug.run.kills === k, k0); i++) {
    await until(p, () => __loft.range.debug.targets.some(t => t.kind === 'plate'));
    await st(0.1, 6);
    const pid = await p.evaluate(() => __loft.range.debug.targets.find(t => t.kind === 'plate')?.id);
    if (pid) { await p.evaluate(id => __loft.range.aimAtTarget(id), pid); await st(0.02, 2); await fire(p); }
    await st(0.1, 8);
  }
  await p.evaluate(() => __loft.range.press('aim', false));
  check('a plate found with the flashlight can be shot in the dark', await p.evaluate(k => __loft.range.debug.run.kills > k, k0));
  await p.evaluate(() => { __loft.range.film(false); __loft.range.escape(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('.rg-card button')].find(x => x.textContent === 'Stages').click());
  await p.waitForTimeout(800);
  const back = await p.evaluate(() => ({ lights: __loft.range.lights, level: __loft.range.flashlight.level, state: __loft.range.state }));
  check('leaving the dark stage for the card brings the lights back and puts the flashlight out', back.state === 'menu' && back.lights > 0.8 && back.level === 0, JSON.stringify(back));

  // The long shot: a plate far down the tunnel, its rim lit, taken down the sights.
  await begin(p, 'long', 'normal', 3);
  await until(p, () => __loft.range.debug.targets.some(t => t.kind === 'plate'));
  await st(0.1, 6);
  const far = await p.evaluate(() => { const o = __loft.range.targets.live().find(x => x.kind === 'plate'); return { id: o.id, d: o.s.d, rim: o.rim.visible }; });
  check('a long-shot plate stands far down the tunnel with its rim lit', far.d > 40 && far.rim, JSON.stringify(far));
  await p.evaluate(() => __loft.range.press('aim', true)); await st(0.05, 8);
  await p.evaluate(id => __loft.range.aimAtTarget(id), far.id); await st(0.02, 2);
  await p.screenshot({ path: `${OUT}/long.png` });
  const k1 = await p.evaluate(() => __loft.range.debug.run.kills);
  await fire(p);
  const longHit = await p.evaluate(k => ({ kills: __loft.range.debug.run.kills - k, pop: document.querySelector('.rg-pop')?.textContent }), k1);
  check('down the sights the pistol takes it, and says how far', longHit.kills === 1 && / \d+ M$/.test(longHit.pop || ''), JSON.stringify(longHit));
  await p.evaluate(() => { __loft.range.press('aim', false); __loft.range.film(false); });

  // Hard: a drone warns, then fires; standing still the bolt takes a shield; stepping aside it misses; shot, it is gone.
  await begin(p, 'swarm', 'hard', 2);
  check('on Hard three shields show', (await p.evaluate(() => document.querySelectorAll('.rg-shields i:not(.off)').length)) === 3);
  await until(p, () => [...__loft.range.debug.run.bolts.values()].some(b => b.phase === 'charge'), null, 400);
  await st(0.05, 12);
  const warning = await p.evaluate(() => { const b = [...__loft.range.debug.run.bolts.values()].find(x => x.phase === 'charge'), o = __loft.range.targets.live().find(x => x.id === b.from); return { g: o.mat.eye.color.g, b: o.mat.eye.color.b, glow: o.charge.visible }; });
  check('a drone about to fire warns: its eye runs hot and a glow gathers', warning.glow && warning.g < 1.0 && warning.b > 0.3, JSON.stringify(warning));
  await until(p, () => __loft.range.bolts.count > 0, null, 60);
  await st(0.05, 6);
  await p.screenshot({ path: `${OUT}/bolt.png` });
  let danger = 0;
  for (let i = 0; i < 80 && !(await p.evaluate(() => __loft.range.debug.run.taken + __loft.range.debug.run.dodged > 0)); i++) {
    danger = Math.max(danger, await p.evaluate(() => +(document.querySelector('.rg-danger')?.style.opacity || 0)));
    await st(0.03);
  }
  const hitMe = await p.evaluate(() => ({ taken: __loft.range.debug.run.taken, shields: __loft.range.debug.run.shields, bars: document.querySelectorAll('.rg-shields i.off').length, dim: +document.querySelector('.rg-dim').style.opacity, alert: document.querySelector('.rg-alert')?.textContent }));
  check('standing still, the bolt takes a shield; the glass flashes and says so', hitMe.taken === 1 && hitMe.shields === 2 && hitMe.bars === 1 && hitMe.dim > 0.5 && hitMe.alert === 'SHIELD LOST', JSON.stringify(hitMe));
  check('the edge of the glass went red while it was coming', danger > 0.4, `edge ${danger.toFixed(2)}`);
  await p.screenshot({ path: `${OUT}/struck.png` });
  // The next one: step along the line in the last half second before it arrives, and keep going until it has gone by.
  const soon = () => { const r = __loft.range.debug.run; return [...r.bolts.values()].some(b => b.phase === 'fly' && b.t0 + (-0.55 - b.d) / b.vd - r.t < 0.5); };
  await until(p, soon, null, 300, 0.03);
  await p.evaluate(() => __loft.range.press('right', true));
  await until(p, () => __loft.range.debug.run.dodged > 0 || __loft.range.debug.run.taken > 1, null, 60, 0.03);
  await p.evaluate(() => __loft.range.press('right', false));
  check('stepping along the line as it comes, the bolt goes by', await p.evaluate(() => __loft.range.debug.run.dodged >= 1 && __loft.range.debug.run.taken === 1));
  // And one shot out of the air.
  await until(p, () => [...__loft.range.debug.run.bolts.values()].some(b => b.phase === 'fly' && __loft.range.debug.run.t - b.t0 > 0.4), null, 200, 0.03);
  const aimed = await p.evaluate(() => { const b = [...__loft.range.debug.run.bolts.values()].find(x => x.phase === 'fly'), at = __loft.range.bolts.at(b.id); if (!at) return false; __loft.range.lookAt(at.x, -at.z, at.y); return true; });
  if (aimed) await fire(p);
  const parried = await p.evaluate(() => ({ parried: __loft.range.debug.run.parried, pop: document.querySelector('.rg-pop')?.textContent }));
  check('a bolt in the air can be shot down', parried.parried === 1 && parried.pop === 'BOLT DOWN', JSON.stringify(parried));
  // Turned away from the hall, a drone that starts to glow is shown by an arrow at the edge of the glass.
  await begin(p, 'swarm', 'hard', 2);
  await p.evaluate(() => __loft.range.lookAt(11.7, 0, 1.5));
  await until(p, () => [...__loft.range.debug.run.bolts.values()].some(b => b.phase === 'charge'), null, 300);
  await p.evaluate(() => __loft.range.lookAt(11.7, 0, 1.5)); await st(0.02, 2);
  const arrows = await p.evaluate(() => [...document.querySelectorAll('.rg-warn')].filter(n => n.style.display === 'block').length);
  check('turned away, an arrow at the edge points to a drone about to fire', arrows >= 1, `${arrows} arrows`);
  await p.screenshot({ path: `${OUT}/arrow.png` });
  await p.evaluate(() => __loft.range.film(false));

  // Out of the range: everything back as it was.
  await p.evaluate(() => __loft.range.exit());
  await p.waitForTimeout(600);
  const out = await p.evaluate(() => ({ mode: __loft.mode, lights: __loft.range.lights, level: __loft.range.flashlight.level, bolts: __loft.range.bolts.count, hud: !!document.querySelector('.rg'), calls: __loft.renderer.info.render.calls }));
  check('leaving puts the lights on, the flashlight out and every bolt away', out.mode === 'walk' && out.lights === 1 && out.level === 0 && out.bolts === 0 && !out.hud && out.calls > 0, JSON.stringify(out));
  await p.waitForTimeout(2500);
  const after2 = await audio();
  check('out of the range no rotor keeps humming and every sound has ended', after2.loops === quiet.loops && after2.shots <= quiet.shots + 1, JSON.stringify({ quiet, after: after2 }));
  check('computer: no page errors, console errors, range warnings or failed requests', !errs.length, errs.slice(0, 5).join(' | '));
  await p.close();
}

async function phone(b) {
  const { p, errs } = await open(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }, 'low', ['warmup', 'walkers', 'swarm', 'dark']);
  const st = stepper(p);
  check('phone: every stage can be picked', (await p.evaluate(() => document.querySelectorAll('.rg-card .rg-list button:not([disabled])').length)) === 5);
  await begin(p, 'walkers', 'hard', 7);
  await until(p, () => __loft.range.debug.targets.some(t => t.kind === 'walker'));
  const tris = await p.evaluate(() => { const o = __loft.range.targets.live().find(x => x.kind === 'walker'); let n = 0; o.g.traverse(m => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return Math.round(n); });
  check('phone: the robots are built plainer', tris < 6000, `${tris} triangles in a walker`);
  const layout = await p.evaluate(() => {
    const r = s => document.querySelector(s)?.getBoundingClientRect();
    const sh = r('.rg-shields'), quit = r('.rg-quit'), ammo = r('.rg-ammo'), over = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return { shields: !!sh && sh.width > 40, clear: !over(sh, quit) && !over(sh, ammo), inside: sh && sh.left >= 0 && sh.right <= innerWidth };
  });
  check('phone: the shields show on Hard, clear of the Leave button and the rounds', layout.shields && layout.clear && layout.inside, JSON.stringify(layout));
  await p.evaluate(() => __loft.range.film(false));
  await begin(p, 'dark', 'normal', 3);
  await st(0.1, 10);
  const dark = await p.evaluate(() => ({ lights: __loft.range.lights, level: __loft.range.flashlight.level }));
  check('phone: lights out and the flashlight on', dark.lights < 0.05 && dark.level === 1, JSON.stringify(dark));
  await until(p, () => __loft.range.debug.targets.some(t => t.kind === 'plate'));
  await st(0.1, 6);
  const pid = await p.evaluate(() => __loft.range.debug.targets.find(t => t.kind === 'plate').id);
  await p.evaluate(id => __loft.range.aimAtTarget(id), pid); await st(0.02, 2);
  const shots0 = await p.evaluate(() => __loft.range.debug.run.shots);
  const pad = await p.evaluate(() => { const r = document.querySelector('.rg-fire').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  // A thumb on the pad, held for a few frames.
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pad] });
  await st(0.012, 3);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await st(0.012, 2);
  check('phone: the FIRE pad fires in the dark', (await p.evaluate(() => __loft.range.debug.run.shots)) > shots0);
  await p.screenshot({ path: `${OUT}/phone-dark.png` });
  await p.evaluate(() => { __loft.range.film(false); __loft.range.exit(); });
  await p.waitForTimeout(500);
  check('phone: out of the range the lights are back', (await p.evaluate(() => __loft.range.lights)) === 1);
  check('phone: no page errors, console errors, range warnings or failed requests', !errs.length, errs.slice(0, 5).join(' | '));
  await p.close();
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try { await desktop(b); await phone(b); } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'all PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
