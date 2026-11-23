// Sun through the glass wall on clear mornings, and the room white and gold on Real Madrid's game days, in a real Chrome.
//   LOFT_URL=http://127.0.0.1:8850 node test/sun.js [outdir] [only: beams,night,weather,lateweather,winter,flag,restore,low,lamps,scenes,phone,matchday,live,source,none,down,slow,malformed,wrongteam,error,hidden,fresh,pick,phonematch,smooth]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/sun';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
// smooth times frames, so it runs only when named, under the lock's timing mode.
const want = part => (ONLY === 'all' && part !== 'smooth') || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const ESPN = /^https:\/\/site\.web\.api\.espn\.com\//;
// A clear midsummer morning, when the real sun comes in low from the north-east.
const MORNING = '&date=2027-06-21&time=06:45&weather=clear';
const H = 3600e3, D = 24 * H;

function watch(p, errs, net) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url()) && !ESPN.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!OUTSIDE.test(r.url()) && !ESPN.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('request', r => { if (ESPN.test(r.url())) net.push(r.url()); });
  p.on('console', m => {
    const at = m.location()?.url || '';
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(at)) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// seed: what the browser kept from an earlier visit; espn: answers to ESPN's two lists (or a way to fail them).
async function open(b, opts, query = '', { seed = null, espn = null, hidden = false, q = opts.isMobile ? 'medium' : 'high' } = {}) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], net = [];
  watch(p, errs, net);
  if (seed) await ctx.addInitScript(s => { try { localStorage.setItem('loft.matchday', s); } catch (e) { /* none */ } }, JSON.stringify(seed));
  if (hidden) await ctx.addInitScript(() => { window.__hide = true; Object.defineProperty(document, 'hidden', { get: () => window.__hide }); Object.defineProperty(document, 'visibilityState', { get: () => (window.__hide ? 'hidden' : 'visible') }); });
  if (espn) await ctx.route(ESPN, espn);
  await p.goto(`${BASE}/?auto&q=${q}${query}`);
  await p.waitForFunction(() => window.__loft && window.__sunbeams && window.__matchday && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { ctx, p, errs, net };
}
const beams = p => p.evaluate(() => ({ on: __sunbeams.on, k: __sunbeams.k, want: __sunbeams.want, built: __sunbeams.built, sun: __sunbeams.sun }));
const settled = p => p.waitForFunction(() => __sunbeams.built && Math.abs(__sunbeams.k - __sunbeams.want) < 0.003 && __sunbeams.k > 0.05, null, { timeout: 30000 }).catch(() => {});
// The loft drawn from a fixed eye with and without the beams, the brightness of a few points in each.
const shots = (p, eye, at, points) => p.evaluate(async ([e, a, pts]) => {
  const L = __loft, r = L.renderer, THREE = await import('three'), group = L.scene.getObjectByName('sunbeams');
  const c = L.camera.clone();
  c.position.set(...e); c.lookAt(...a); c.fov = 60; c.aspect = 1.6; c.updateProjectionMatrix(); c.updateMatrixWorld();
  const pr = r.getPixelRatio(), size = r.getSize(new THREE.Vector2()), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(), vis = L.me.root.visible, was = group?.visible;
  r.setPixelRatio(1); r.setSize(320, 200, false); r.setClearColor(0x000000, 1); L.me.root.visible = false;
  const read = async on => {
    if (group) group.visible = on;
    r.render(L.scene, c);
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = r.domElement.toDataURL('image/png'); });
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, 320, 200).data;
    return pts.map(pt => {
      const v = new THREE.Vector3(...pt).project(c), x = Math.round((v.x + 1) * 160), y = Math.round((1 - v.y) * 100);
      let s = 0, n = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const o = ((y + j) * 320 + (x + i)) * 4; if (x + i >= 0 && x + i < 320 && y + j >= 0 && y + j < 200) { s += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; n++; } }
      return { x, y, lum: n === 25 && v.z < 1 ? s / n : -1 };
    });
  };
  const lit = await read(true), dark = await read(false);
  if (group) group.visible = was;
  L.me.root.visible = vis; r.setPixelRatio(pr); r.setSize(size.x, size.y, false); r.setClearColor(cc, ca);
  return pts.map((_, i) => ({ ...lit[i], gain: lit[i].lum - dark[i].lum }));
}, [eye, at, points]);
// One floor spot from a few steps south-west of it, or two from straight south of the middle between them.
const one = (p, q) => shots(p, [q[0] - 2.5, q[1] + 1.7, q[2] + 3.5], q, [q]).then(r => r[0]);
const two = (p, a, b) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; return shots(p, [m[0], m[1] + 1.9, m[2] + 3.2], m, [a, b]); };
const seen = pt => pt.lum >= 0;
async function standAt(p, x, y, z, yaw) {
  await p.evaluate(([v, yw]) => { __loft.pos.set(v[0], v[1] + 0.05, v[2]); __loft.yaw = yw; }, [[x, z, -y], yaw]);
  await p.waitForTimeout(900);
}
const sceneNow = p => p.evaluate(() => ({ name: __loft.world.sceneName, on: __matchday.on, reads: __matchday.reads, rgb: __loft.world.lights.find(([, l]) => l.role === 'rgb')?.[0].color.toArray(), kept: __matchday.kept, lights: __lights.on }));
const gold = c => !!c && Math.abs(c[0] - 1) < 0.01 && Math.abs(c[1] - 0.72) < 0.01 && Math.abs(c[2] - 0.18) < 0.01;
const noise = errs => errs.filter(e => !/Failed to load resource|net::ERR/.test(e));

// ESPN's two lists as it sends them, trimmed: one match at each of these times (ms).
const match = (id, at) => ({ id, date: new Date(at).toISOString().replace(/:\d\d\.\d{3}Z$/, 'Z'), timeValid: true,
  competitions: [{ id, timeValid: true, competitors: [{ id: '86', homeAway: 'home' }, { id: '85', homeAway: 'away' }], status: { type: { name: 'STATUS_SCHEDULED' } } }] });
const list = (times, from = 900) => JSON.stringify({ status: 'success', team: { id: '86', abbreviation: 'RMA' }, events: times.map((t, i) => match(String(from + i), t)) });
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
const answer = (ahead, played) => route => route.fulfill({ status: 200, headers: CORS, body: route.request().url().includes('fixture=true') ? list(ahead, 900) : list(played, 800) });
const gameToday = () => answer([Date.now() + 3 * D], [Date.now() - H]);
// Played yesterday by Vancouver's calendar (30 hours ago is never today), and kept: the list keeps two days back.
const noGame = () => answer([Date.now() + 3 * D], [Date.now() - 30 * H]);
const keptToday = (ago = 7 * H) => ({ v: 1, at: Date.now() - ago, tried: Date.now() - ago, games: [['1', Date.now() - H]] });

(async () => {
  const S = await import('../web/src/pure/sunbeams.js');
  const W = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/assets/world.json'), 'utf8'));
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  // What stands in the way of the light from a floor spot back to the glass, by the house's colliders (three's axes).
  const solids = W.colliders.filter(c => c.kind === 'solid' && c.max[1] < 15);
  const blockers = (s, p) => {
    const g = S.throughGlass(s, p), hits = [];
    for (const c of solids) {
      let a = 0, z = 1;
      const lo = [c.min[0], Math.max(c.min[2], 0), -c.max[1]], hi = [c.max[0], c.max[2], -c.min[1]], o = p, v = [g[0] - p[0], g[1] - p[1], S.GLASS.z - p[2]];
      for (let i = 0; i < 3 && a <= z; i++) {
        if (Math.abs(v[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) z = -1; continue; }
        const u = (lo[i] - o[i]) / v[i], w = (hi[i] - o[i]) / v[i];
        a = Math.max(a, Math.min(u, w)); z = Math.min(z, Math.max(u, w));
      }
      if (a <= z) hits.push(c.name);
    }
    return { hits, g };
  };
  // The floor where light through the glass 1 m up and 16 m along lands, a floor spot the sun cannot reach, and the
  // floor in the credenza's shadow, with the nearest spot west of it that the light reaches untouched.
  const points = s => {
    const lit = S.landing(s, 16, 1, 0), cred = W.colliders.find(c => c.name === 'credenza');
    const mid = [(cred.min[0] + cred.max[0]) / 2, cred.max[2] / 2, -(cred.min[1] + cred.max[1]) / 2];
    const t = mid[1] / s[1], shade = [mid[0] - s[0] * t, 0, mid[2] - s[2] * t];
    let open = null;
    for (let dx = 0.6; dx < 3 && !open; dx += 0.1) {
      const q = [shade[0] - dx, 0, shade[2]], b = blockers(s, q);
      if (!b.hits.length && b.g[0] > 0.5 && b.g[0] < 21.5 && blockers(s, [q[0] - 0.3, 0, q[2]]).hits.length === 0) open = [q[0] - 0.15, 0, q[2]];
    }
    return { lit, out: [12, 0, -9], shade, open, shaded: blockers(s, shade).hits };
  };
  try {
    if (want('beams')) {
      const { ctx, p, errs } = await open(b, DESK, MORNING);
      await settled(p);
      const s = await beams(p);
      check('a clear midsummer morning: the sun comes in, built when first needed', s.built && s.on && s.k > 0.6, JSON.stringify({ ...s, sun: s.sun.map(v => v.toFixed(3)) }));
      const elev = Math.asin(s.sun[1]) * 180 / Math.PI, az = Math.atan2(s.sun[0], -s.sun[2]) * 180 / Math.PI;
      check('the light comes from the real sun, low in the north-east', elev > 10 && elev < 16 && az > 60 && az < 75, `elevation ${elev.toFixed(1)}, azimuth ${az.toFixed(1)}`);
      const P = points(s.sun);
      const lit = await one(p, P.lit), out = await one(p, P.out);
      check('the floor where the sun would land is lit', seen(lit) && lit.gain > 18, JSON.stringify(lit));
      check('the floor the sun cannot reach is left as it was', seen(out) && Math.abs(out.gain) < 1.5, JSON.stringify(out));
      const [sh, op] = await two(p, P.shade, P.open);
      check('the credenza shades the floor behind it, and the floor beside its shadow is lit', P.shaded.includes('credenza') && !!P.open && seen(sh) && seen(op) && sh.gain < op.gain * 0.35 && op.gain > 12, `${P.shaded} ${JSON.stringify(sh)} ${JSON.stringify(op)}`);
      const mats = await p.evaluate(async () => {
        const THREE = await import('three'), g = __loft.scene.getObjectByName('sunbeams'), out = new Set();
        g.traverse(o => o.material && out.add(o.material));
        __lights.adopt();
        return [...out].map(m => ({ tag: m.userData.lamp, plain: m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile, lights: m.lights, transparent: m.transparent, depthWrite: m.depthWrite }));
      });
      check('the beams are sunlight to the light switch: tagged as their own glow and never dimmed', mats.length === 2 && mats.every(m => m.tag === 'glow' && m.plain && !m.lights && m.transparent && !m.depthWrite), JSON.stringify(mats));
      const lit3 = await p.evaluate(() => { let n = 0, mine = 0; __loft.scene.traverse(o => { if (o.isLight) n++; }); __loft.scene.getObjectByName('sunbeams').traverse(o => { if (o.isLight) mine++; }); return { n, mine, world: __loft.world.lights.length }; });
      check('no new light in the scene', lit3.mine === 0, JSON.stringify(lit3));
      await standAt(p, 11, 9, 0, 0.35);
      await p.screenshot({ path: path.join(OUT, 'beams-desk-lounge.png') });
      await standAt(p, 19, 12.5, 0, 1.45);
      await p.screenshot({ path: path.join(OUT, 'beams-desk-piano.png') });
      check('beams: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    for (const [part, query, why] of [['night', '&date=2027-06-21&time=23:00&weather=clear', 'at night'], ['weather', '&date=2027-06-21&time=06:45&weather=rain', 'in the rain'],
      ['weather', '&date=2027-06-21&time=06:45&weather=cloudy', 'under cloud'], ['winter', '&date=2026-11-21&time=09:30&weather=clear', 'on a clear November morning, the sun behind the house'],
      ['winter', '&date=2027-06-21&time=19:30&weather=clear', 'on a summer evening, the sun in the north-west']]) {
      if (!want(part)) continue;
      const { ctx, p, errs } = await open(b, DESK, query);
      await p.waitForTimeout(2500);
      const s = await beams(p);
      check(`no sunbeams ${why}, and nothing built for them`, !s.on && !s.built && s.want === 0, JSON.stringify({ on: s.on, built: s.built, want: s.want }));
      check(`${why}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('lateweather')) {
      // The real weather takes a moment to arrive; until it does, a summer morning must not be taken for a clear one.
      const ctx = await b.newContext(DESK), p = await ctx.newPage(), errs = [], net = [];
      watch(p, errs, net);
      let arrived = 0;
      // Answered just inside the house's own four-second wait, so the house is open and drawing before it lands.
      await ctx.route(/api\.open-meteo\.com/, async r => { await new Promise(res => setTimeout(res, 3700)); arrived = Date.now(); await r.fulfill({ status: 200, headers: CORS, body: '{"current":{"weather_code":61}}' }).catch(() => {}); });
      await p.goto(`${BASE}/?auto&q=high&date=2027-06-21&time=06:45`);
      await p.waitForFunction(() => window.__loft && window.__sunbeams && __loft.renderer.info.render.calls > 0, null, { polling: 50, timeout: 120000 });
      const opened = Date.now();
      await p.waitForTimeout(6000);
      const s = await beams(p);
      check('the house was open and drawing before the weather came', arrived > opened, `${arrived - opened} ms`);
      check('a rainy summer morning whose weather arrives late: no sun comes in, not even for a moment, and nothing is built', !s.built && !s.on && s.want === 0, JSON.stringify({ built: s.built, on: s.on, want: s.want }));
      check('late weather: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('flag')) {
      const { ctx, p, errs } = await open(b, DESK, '&sunbeams&date=2026-11-21&time=23:00');
      await settled(p);
      const s = await beams(p);
      check('?sunbeams shows them at any hour, with a midsummer morning sun', s.on && s.k > 0.6 && Math.asin(s.sun[1]) * 180 / Math.PI > 10, JSON.stringify({ on: s.on, k: s.k }));
      const P = points(s.sun);
      const lit = await one(p, P.lit);
      check('and they land where that sun would put them', seen(lit) && lit.gain > 12, JSON.stringify(lit));
      await standAt(p, 11, 9, 0, 0.35);
      await p.screenshot({ path: path.join(OUT, 'flag-night.png') });
      check('flag: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('restore')) {
      // The flag's sun never moves, so only the restore itself can redraw the map of how far the light gets.
      const { ctx, p, errs } = await open(b, DESK, '&sunbeams&date=2026-11-21&time=23:00');
      await settled(p);
      const P = points((await beams(p)).sun), before = await one(p, P.lit);
      await p.evaluate(() => new Promise(res => {
        const gl = __loft.renderer.getContext(), x = gl.getExtension('WEBGL_lose_context');
        __loft.renderer.domElement.addEventListener('webglcontextlost', () => setTimeout(() => x.restoreContext(), 300), { once: true });
        __loft.renderer.domElement.addEventListener('webglcontextrestored', () => setTimeout(res, 1500), { once: true });
        x.loseContext();
      }));
      const after = await one(p, P.lit);
      check('after the graphics context is lost and restored, the sun lands where it did', seen(before) && seen(after) && after.gain > 12 && Math.abs(after.gain - before.gain) < 6, `${JSON.stringify(before)} ${JSON.stringify(after)}`);
      check('restore: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('low')) {
      const { ctx, p, errs } = await open(b, DESK, '&sunbeams' + MORNING, { q: 'low' });
      await p.waitForTimeout(2500);
      const s = await beams(p);
      check('the low setting skips them, nothing built', !s.on && !s.built, JSON.stringify(s));
      check('low: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('lamps')) {
      const { ctx, p, errs } = await open(b, DESK, MORNING);
      await settled(p);
      const P = points((await beams(p)).sun);
      const on = await one(p, P.lit);
      // Every frame of the switch's fade, not only its end: the sun takes out the lamp level of the frame it is drawn in.
      const fadeGap = await p.evaluate(() => new Promise(res => {
        const u = __loft.scene.getObjectByName('sunbeams').children.find(o => o.material.uniforms.uLamp).material.uniforms.uLamp.value, room = __lights.uniforms.room.value;
        let worst = 0, frames = 0;
        const f = () => {
          frames++;
          worst = Math.max(worst, Math.abs(u.x * room.x - 1), Math.abs(u.y * room.y - 1), Math.abs(u.z * room.z - 1));
          if (__lights.k === 0 || frames > 600) res({ worst, frames }); else requestAnimationFrame(f);
        };
        __lights.set(false);
        requestAnimationFrame(f);
      }));
      check('while the lamps fade out, the sun keeps its strength in every frame', fadeGap.frames >= 2 && fadeGap.worst < 1e-3, JSON.stringify(fadeGap));
      await p.waitForFunction(() => __lights.k === 0, null, { timeout: 10000 });
      await p.waitForTimeout(600);
      const off = await one(p, P.lit);
      const u = await p.evaluate(() => ({ lamp: __loft.scene.getObjectByName('sunbeams').children.find(o => o.material.uniforms.uLamp).material.uniforms.uLamp.value.toArray(), room: __lights.uniforms.room.value.toArray(), on: __sunbeams.on }));
      check('with the lamps off the sun keeps its own strength: the switch\'s dimming is taken back out of it', u.on && u.lamp.every((v, i) => Math.abs(v * u.room[i] - 1) < 1e-3), JSON.stringify(u));
      check('so the sunlit floor stands out more with the lamps off, not less', seen(on) && seen(off) && off.lum - off.gain > 0 && off.gain / (off.lum - off.gain) > on.gain / (on.lum - on.gain) * 1.15, `${JSON.stringify(on)} ${JSON.stringify(off)}`);
      await standAt(p, 11, 9, 0, 0.35);
      await p.screenshot({ path: path.join(OUT, 'beams-lamps-off.png') });
      await p.evaluate(() => __lights.set(true));
      check('lamps: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('scenes')) {
      const { ctx, p, errs } = await open(b, DESK, MORNING);
      await settled(p);
      const u0 = await p.evaluate(() => __loft.scene.getObjectByName('sunbeams').children[0].material.uniforms.uSun.value.toArray());
      const got = [];
      for (const sc of ['off', 'party', 'matchday', 'focus']) {
        await p.evaluate(n => __loft.world.scene(n), sc);
        await p.waitForTimeout(500);
        got.push(await p.evaluate(() => [__sunbeams.on, __loft.scene.getObjectByName('sunbeams').children[0].material.uniforms.uSun.value.toArray()]));
      }
      check('the light scenes leave the sun alone', got.every(([on, u]) => on && u.every((v, i) => Math.abs(v - u0[i]) <= 0.01 * u0[i])), JSON.stringify(got.map(x => x[1].map(v => +v.toFixed(4)))));
      // Movie dims and warms the lamps; the sun is daylight, so it keeps its own strength and colour, as the daylight does.
      await p.evaluate(() => __loft.world.scene('movie'));
      await p.waitForFunction(() => __lights.movie === 1, null, { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => { const u = __loft.scene.getObjectByName('sunbeams').children[0].material.uniforms; return { on: __sunbeams.on, movie: __lights.movie, sun: u.uSun.value.toArray(), lamp: u.uLamp.value.toArray(), room: __lights.uniforms.room.value.toArray() }; });
      check('Movie dims the lamps but not the sun', m.on && m.movie === 1 && m.room.some(v => v < 0.9) && m.sun.every((v, i) => Math.abs(v - u0[i]) <= 0.01 * u0[i]) && m.lamp.every((v, i) => Math.abs(v * m.room[i] - 1) < 1e-3), JSON.stringify(m));
      check('scenes: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('phone')) {
      const { ctx, p, errs } = await open(b, PHONE, MORNING);
      await settled(p);
      const s = await beams(p);
      check('phone: the sun comes in on the medium setting', s.on && s.k > 0.6, JSON.stringify({ on: s.on, k: s.k }));
      const P = points(s.sun);
      const lit = await one(p, P.lit), out = await one(p, P.out);
      check('phone: it lands where the sun would put it, and nowhere else', seen(lit) && seen(out) && lit.gain > 18 && Math.abs(out.gain) < 1.5, `${JSON.stringify(lit)} ${JSON.stringify(out)}`);
      await standAt(p, 11, 9, 0, 0.35);
      await p.screenshot({ path: path.join(OUT, 'beams-phone.png') });
      check('phone: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    // ---------- the room on game days ----------
    for (const [part, query, on] of [['matchday', '&matchday', true], ['matchday', '&matchday=off', false]]) {
      if (!want(part)) continue;
      const { ctx, p, errs, net } = await open(b, DESK, query, { espn: gameToday() });
      await p.waitForTimeout(6500);
      const s = await sceneNow(p);
      check(`${query} ${on ? 'turns the room white and gold' : 'keeps the room as it is'}, and reads nothing`, s.on === on && (on ? s.name === 'matchday' && gold(s.rgb) : s.name !== 'matchday') && s.reads === 0 && net.length === 0, JSON.stringify({ ...s, kept: undefined, net: net.length }));
      if (on) {
        await standAt(p, 17.5, 3.4, 0.45, Math.PI + 0.35);
        await p.screenshot({ path: path.join(OUT, 'matchday-studio.png') });
        await p.evaluate(() => __lights.set(false));
        await p.waitForTimeout(1500);
        const t = await sceneNow(p);
        check('the light switch keeps the last word: off stays off on a game day', !t.lights && t.name === 'matchday', JSON.stringify({ lights: t.lights, name: t.name }));
        await p.screenshot({ path: path.join(OUT, 'matchday-studio-lamps-off.png') });
      }
      check(`${query}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('live')) {
      const { ctx, p, errs, net } = await open(b, DESK, '', { espn: gameToday() });
      const early = await sceneNow(p);
      check('nothing is read while the house opens', early.reads === 0 && net.length === 0 && !early.on);
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.on, null, { timeout: 15000 }).catch(() => {});
      const mid = await sceneNow(p);
      await p.waitForTimeout(2500);
      const s = await sceneNow(p);
      check('a few seconds later both lists are read, and a match today turns the room white and gold', s.on && s.name === 'matchday' && gold(s.rgb) && s.reads === 1 && net.length === 2, JSON.stringify({ ...s, kept: undefined, net }));
      check('as a fade over a couple of seconds, not a jump', mid.on && !gold(mid.rgb), JSON.stringify(mid.rgb));
      check('the list is kept in the browser with when it was read', s.kept?.at > Date.now() - 60e3 && s.kept.tried === s.kept.at && s.kept.games.length === 2, JSON.stringify(s.kept));
      const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('loft.matchday')));
      check('and stored for the next visit', JSON.stringify(stored) === JSON.stringify(s.kept));
      await p.waitForTimeout(3000);
      check('and not read again soon after', (await sceneNow(p)).reads === 1 && net.length === 2);
      check('live: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('source')) {
      // The real thing, nothing stood in: ESPN's lists read from this page, across origins, in the worker.
      const { ctx, p, errs, net } = await open(b, DESK, '');
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.kept?.tried > 0, null, { timeout: 30000 }).catch(() => {});
      const s = await sceneNow(p);
      const soon = s.kept?.games.filter(([, at]) => at > Date.now()).length || 0;
      check('the live source answers this page and is understood: matches to come are kept (needs ESPN up)', s.kept?.at > 0 && s.kept.at === s.kept.tried && soon > 0 && net.length === 2, JSON.stringify({ at: s.kept?.at, games: s.kept?.games.length, soon, on: s.on, net: net.length }));
      check('source: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('none')) {
      const { ctx, p, errs } = await open(b, DESK, '', { espn: noGame() });
      await p.waitForFunction(() => __matchday.reads === 1, null, { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(300);
      const s = await sceneNow(p);
      check('no match today: the room stays as it is', !s.on && s.name !== 'matchday' && s.reads === 1 && s.kept.games.length === 2, JSON.stringify({ ...s, kept: undefined }));
      check('none: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    const failing = {
      down: route => route.abort('failed'),
      slow: async route => { await new Promise(r => setTimeout(r, 15000)); await route.fulfill({ status: 200, headers: CORS, body: list([Date.now()]) }).catch(() => {}); },
      malformed: route => route.fulfill({ status: 200, headers: CORS, body: '<html>Service Unavailable</html>' }),
      wrongteam: route => route.fulfill({ status: 200, headers: CORS, body: list([Date.now()]).replace('"id":"86","abbreviation"', '"id":"83","abbreviation"') }),
      error: route => route.fulfill({ status: 500, headers: CORS, body: '{}' }),
    };
    for (const [part, espn] of Object.entries(failing)) {
      if (!want(part)) continue;
      for (const seeded of [false, true]) {
        const seed = seeded ? keptToday() : null;
        const { ctx, p, errs } = await open(b, DESK, '', { espn, seed });
        await p.waitForFunction(() => __matchday.reads === 1 && __matchday.kept?.tried > Date.now() - 60e3, null, { timeout: 30000 }).catch(() => {});
        await p.waitForTimeout(300);
        const s = await sceneNow(p);
        const why = { down: 'down', slow: 'too slow', malformed: 'answering nonsense', wrongteam: 'answering for another team', error: 'answering 500' }[part];
        if (seeded) check(`the source ${why}: the last good list is kept, and today is still a game day`, s.on && s.name === 'matchday' && s.kept.at === seed.at && s.kept.games.length === 1 && s.kept.tried > seed.tried, JSON.stringify({ ...s, kept: { ...s.kept, games: s.kept?.games.length } }));
        else check(`the source ${why}, nothing kept: the room simply stays as it is`, !s.on && s.name !== 'matchday' && s.kept.at === 0 && s.kept.games.length === 0, JSON.stringify({ ...s, kept: { ...s.kept, games: s.kept?.games.length } }));
        check(`${part}${seeded ? ' (kept)' : ''}: nothing on screen, no error but the browser's own network line`, noise(errs).length === 0 && !(await p.evaluate(() => document.getElementById('toast').textContent)).match(/madrid|match|espn/i), noise(errs).slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
    if (want('hidden')) {
      const { ctx, p, net } = await open(b, DESK, '', { espn: gameToday(), hidden: true });
      await p.waitForTimeout(7500);
      check('in a hidden tab nothing is read', (await sceneNow(p)).reads === 0 && net.length === 0);
      await p.evaluate(() => { window.__hide = false; document.dispatchEvent(new Event('visibilitychange')); });
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.on, null, { timeout: 15000 }).catch(() => {});
      const s = await sceneNow(p);
      check('and it is read when the tab comes back', s.reads === 1 && s.on && net.length === 2, JSON.stringify({ reads: s.reads, on: s.on, net: net.length }));
      await ctx.close();
    }
    if (want('fresh')) {
      const { ctx, p, errs, net } = await open(b, DESK, '', { espn: noGame(), seed: keptToday(H) });
      const first = await sceneNow(p);
      check('a list kept from an hour ago counts at once', first.on && first.name === 'matchday');
      await p.waitForTimeout(7000);
      check('and is not read again for hours', (await sceneNow(p)).reads === 0 && net.length === 0);
      check('fresh: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('pick')) {
      const { ctx, p, errs } = await open(b, DESK, '', { espn: gameToday() });
      await p.waitForFunction(() => __matchday.on, null, { timeout: 15000 }).catch(() => {});
      await p.evaluate(() => __loft.world.scene('chill'));
      await p.evaluate(() => { __loft.world.matchday(true); __loft.world.matchday(false); __loft.world.matchday(true); });
      await p.waitForTimeout(2500);
      const s = await sceneNow(p);
      check('a scene picked by hand wins for the rest of the visit, at once and for good', s.name === 'chill' && !gold(s.rgb) && Math.abs(s.rgb[0] - 0.55) < 0.01 && Math.abs(s.rgb[2] - 1) < 0.01, JSON.stringify({ name: s.name, rgb: s.rgb }));
      check('pick: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('phonematch')) {
      const { ctx, p, errs } = await open(b, PHONE, '', { espn: gameToday() });
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.on, null, { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const s = await sceneNow(p);
      check('phone: a match today turns the room white and gold', s.on && s.name === 'matchday' && gold(s.rgb), JSON.stringify({ on: s.on, name: s.name }));
      await standAt(p, 17.5, 3.4, 0.45, Math.PI + 0.35);
      await p.screenshot({ path: path.join(OUT, 'matchday-phone.png') });
      check('phonematch: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- no long frames when the beams are built or the room turns: desktop judged, a phone slowed 4x printed ----------
    for (const [tag, opts, slow] of [['desktop', DESK, 1], ['phone slowed 4x', PHONE, 4]]) {
      if (!want('smooth')) break;
      for (const [what, query, espn] of [['the beams built and faded in', MORNING, null], ['a game day read and the room turned', '&weather=rain', gameToday()]]) {
        const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], net = [];
        watch(p, errs, net);
        await ctx.addInitScript(() => { window.__f = []; let l = performance.now(); const f = n => { window.__f.push([n, n - l]); l = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });
        if (espn) await ctx.route(ESPN, espn);
        await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
        if (slow > 1) await (await ctx.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: slow });
        await p.waitForFunction(() => window.__loft && window.__sunbeams && window.__matchday && __loft.renderer.info.render.calls > 0, null, { timeout: 180000 });
        const ready = await p.evaluate(() => performance.now());
        await p.waitForFunction(() => (__sunbeams.built && __sunbeams.k > 0.9 * __sunbeams.want && __sunbeams.want > 0) || __matchday.on, null, { timeout: 60000 }).catch(() => {});
        await p.waitForTimeout(1500);
        const r = await p.evaluate(at => ({ f: window.__f.filter(([n]) => n > at + 300).map(([, d]) => d), built: __sunbeams.built, on: __matchday.on }), ready);
        const s = r.f.slice().sort((x, y) => x - y), worst = s.at(-1), p50 = s[Math.floor(s.length / 2)];
        const line = `${s.length} frames, median ${p50?.toFixed(1)} ms, worst ${worst?.toFixed(1)} ms`;
        if (slow > 1) console.log(`${tag}, ${what}: ${line} (printed, not judged)`);
        else check(`${tag}, ${what}: no long frame`, (espn ? r.on : r.built) && worst < 50, line);
        check(`${tag}, ${what}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
