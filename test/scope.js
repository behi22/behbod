// The telescope, end to end in a real browser: the stops and the swing to each, the short way round, the smooth zoom
// (wheel, keys, buttons, two fingers), the drag that follows the finger, the planets and the close-up city that only
// it draws, the Death Star still found, and everything put back on leaving. A computer at 1280 x 800 and a phone.
//   LOFT_URL=http://127.0.0.1:8815 node test/scope.js
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
// A clear night with the moon and Saturn up, so every kind of stop is there.
const NIGHT = '&time=22:00&date=2026-11-17&weather=clear';
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  // YouTube's player in the room logs its own errors; ours (and any shader warning from three) count.
  p.on('console', m => { if ((m.type() === 'error' || /WebGLProgram|THREE\./.test(m.text())) && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200)); });
}
async function open(b, opts, query) {
  const p = await b.newPage(opts), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'ultra'}${query}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  return { p, errs };
}
async function enter(p) {
  await p.evaluate(() => { const L = __loft, it = L.meta.interact.find(i => i.id === 'telescope'); L.pos.set(it.at[0], 0.05, -it.at[1]); });
  await p.waitForTimeout(500);
  await p.evaluate(() => __loft.act('telescope'));
  await p.waitForFunction(() => __loft.scope.kitReady && __loft.scope.stops.length, null, { timeout: 20000 });
}
const aim = p => p.evaluate(() => __loft.scope.aim);
const stop = (p, id) => p.evaluate(i => { const s = __loft.scope.stops.find(x => x.id === i); return s && { yaw: s.yaw, pitch: s.pitch, fov: s.fov, name: s.name }; }, id);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- a computer ----------
    const { p, errs } = await open(b, { viewport: { width: 1280, height: 800 } }, NIGHT);
    const fov0 = await p.evaluate(() => [__loft.camera.fov, __loft.camera.near]);
    await enter(p);
    check('the telescope opens', await p.evaluate(() => __loft.mode === 'scope' && !!document.querySelector('.ts-veil') && !!document.querySelector('.ts-stops')));
    const ids = await p.evaluate(() => __loft.scope.stops.map(s => s.id));
    for (const id of ['moon', 'saturn', 'bridge', 'lions', 'grouse', 'lonsdale', 'seymour']) check(`stop: ${id}`, ids.includes(id), ids.join(' '));
    check('one button for each stop', await p.evaluate(() => document.querySelectorAll('.ts-stops button').length === __loft.scope.stops.length));
    // Every stop it offers is one it can see: none behind a tower, nothing in the sky behind the slopes either.
    const blocked = () => p.evaluate(async () => {
      const S = await import('./src/pure/scope.js'), eye = __loft.camera.position.toArray(), T = __loft.out3d.towers;
      const seen = s => (s.point ? S.clearLine(eye, s.point.toArray(), T) && (s.kind !== 'water' || S.clearGround(eye, s.point.toArray())) : S.clearSky(eye, s.dir.toArray(), T));
      return __loft.scope.stops.filter(s => !seen(s)).map(s => s.id);
    });
    const hidden = await blocked();
    check('nothing offered behind the towers', !hidden.length, hidden.join(' '));

    // Nothing of the balcony shows through the eyepiece (the old fix for the telescope seeing itself): with the house
    // drawn alone on a marker colour, the round view is all marker, level, low, to either side and looking up. (The
    // corners outside the eyepiece are black on screen, so they are not counted.)
    const own = [];
    for (const [dx, dy] of [[0, 0], [0, -1], [0.35, 0], [-0.7, 0], [1.6, 0.3], [-3, 0.6]]) {
      await p.evaluate(([x, y]) => __loft.scope.nudge(x, y), [dx, dy]);
      await p.waitForTimeout(200);
      own.push(await p.evaluate(async () => {
        const THREE = await import('three');
        const L = __loft, r = L.renderer, gl = r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha(), star = [];
        // The Death Star is in the house's scene on purpose; it is not the balcony.
        L.scene.traverse(o => { if (o.isMesh && o.visible && o.parent?.parent === L.scene && o.geometry?.type === 'SphereGeometry' && o.geometry.parameters.radius === 7) { star.push(o.parent); } });
        star.forEach(g => { g.visible = false; });
        r.setClearColor(0xff00ff, 1); r.render(L.scene, L.camera);
        const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        r.setClearColor(clear, alpha); star.forEach(g => { g.visible = true; });
        const rad = parseFloat(getComputedStyle(document.querySelector('.ts-hud')).getPropertyValue('--r')) * h / innerHeight;
        let n = 0, all = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (Math.hypot(x - w / 2, y - h / 2) > rad) continue;
          const i = (y * w + x) * 4;
          all++;
          if (px[i] < 250 || px[i + 1] > 5 || px[i + 2] < 250) n++;
        }
        return +(n / all * 100).toFixed(2);
      }));
    }
    check('the eyepiece never shows the balcony', own.every(v => v < 0.2) && (await p.evaluate(() => __loft.camera.near)) >= 2, own.join(' '));

    // The swing: lands on the stop at its field, and a swing across the view stays on the short arc.
    await p.evaluate(() => __loft.scope.goTo('bridge'));
    await p.waitForTimeout(2600);
    let a = await aim(p), s = await stop(p, 'bridge');
    check('lands on the bridge', Math.abs(wrap(a.yaw - s.yaw)) < 0.002 && Math.abs(a.pitch - s.pitch) < 0.002 && Math.abs(a.fov - s.fov) < 0.05, JSON.stringify(a));
    check('the caption names it', (await p.textContent('.ts-cap b')) === 'Lions Gate Bridge' && await p.evaluate(() => document.querySelector('.ts-cap').classList.contains('on')));
    check('its button is lit', await p.evaluate(() => document.querySelector('.ts-stops button.on')?.dataset.id === 'bridge'));
    const path = await p.evaluate(async () => {
      const out = [];
      __loft.scope.goTo('seymour');
      const end = __loft.scope.stops.find(s => s.id === 'seymour');
      for (let i = 0; i < 400; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const a = __loft.scope.aim;
        out.push(a);
        if (Math.abs(a.yaw - end.yaw) < 1e-4 && Math.abs(a.fov - end.fov) < 1e-3) break;
      }
      return out;
    });
    const sy = await stop(p, 'seymour');
    const yaws = path.map(x => x.yaw);
    check('the swing goes the short way, never back, and arrives', yaws.every((y, i) => i === 0 || y >= yaws[i - 1] - 1e-6) && Math.min(...yaws) >= s.yaw - 0.01 && Math.max(...yaws) <= sy.yaw + 0.01 && Math.abs(yaws[yaws.length - 1] - sy.yaw) < 1e-3, `${yaws[0].toFixed(3)} to ${yaws[yaws.length - 1].toFixed(3)} in ${yaws.length} frames`);
    check('it pulls back a little mid-swing', Math.max(...path.map(x => x.fov)) > Math.max(s.fov, sy.fov));
    await p.waitForTimeout(2000);

    // The zoom: a wheel notch eases in over several frames, never jumping.
    const zoomed = await p.evaluate(async () => {
      const c = document.getElementById('view'), out = [__loft.scope.fov];
      c.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, bubbles: true }));
      for (let i = 0; i < 30; i++) { await new Promise(r => requestAnimationFrame(r)); out.push(__loft.scope.fov); }
      return out;
    });
    const steps = zoomed.slice(1).map((f, i) => f / zoomed[i]);
    check('a wheel zooms in smoothly', zoomed[zoomed.length - 1] < zoomed[0] * 0.75 && steps.every(k => k <= 1 + 1e-9 && k > 0.8), steps.map(k => k.toFixed(3)).slice(0, 6).join(' '));
    await p.keyboard.press('Equal');
    await p.waitForTimeout(600);
    const f1 = (await aim(p)).fov;
    check('+ zooms in', f1 < zoomed[zoomed.length - 1]);
    for (let i = 0; i < 30; i++) await p.keyboard.press('Equal');
    await p.waitForTimeout(900);
    check('land stops at its limit', Math.abs((await aim(p)).fov - 1.5) < 0.01, String((await aim(p)).fov));
    await p.click('.ts-zoom button[aria-label="Zoom out"]');
    await p.waitForTimeout(700);
    check('the minus button zooms out', (await aim(p)).fov > 1.6);

    // A drag moves the view with the pointer, one to one.
    const before = await aim(p);
    const r = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.ts-hud')).getPropertyValue('--r')));
    await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(540, 400, { steps: 5 }); await p.mouse.up();
    await p.waitForTimeout(200);
    const after = await aim(p), want = 100 * (before.fov * Math.PI / 180) / (2 * r);
    check('a drag follows the pointer', Math.abs(wrap(after.yaw - before.yaw) - want) < want * 0.15, `${wrap(after.yaw - before.yaw).toFixed(4)} vs ${want.toFixed(4)}`);
    check('a drag lets go of the stop', await p.evaluate(() => __loft.scope.target === null && !document.querySelector('.ts-stops button.on')));

    // Keys step through the stops.
    await p.keyboard.press('Digit1');
    await p.waitForTimeout(2400);
    const first = await p.evaluate(() => __loft.scope.stops[0].id);
    check('1 goes to the first stop', (await p.evaluate(() => __loft.scope.target)) === first, first);
    await p.keyboard.press('BracketRight');
    await p.waitForTimeout(100);
    check('] goes to the next', (await p.evaluate(() => __loft.scope.target)) === (await p.evaluate(() => __loft.scope.stops[1].id)));
    await p.waitForTimeout(2400);

    // The sky: Saturn drawn only through the telescope, the deep eyepiece for it, the moon close up.
    await p.evaluate(() => __loft.scope.goTo('saturn'));
    await p.waitForTimeout(2600);
    const sat = await p.evaluate(() => {
      let m = null; __loft.out3d.extras.traverse(o => { if (o.material?.uniforms?.uKind?.value === 4) m = o; });
      return { vis: m?.visible, fov: __loft.scope.fov, scope: __loft.out3d.U.uScope.value };
    });
    check('Saturn is drawn', sat.vis === true && sat.scope === 1, JSON.stringify(sat));
    for (let i = 0; i < 30; i++) await p.keyboard.press('Equal');
    await p.waitForTimeout(900);
    check('the planets take the high power', Math.abs((await aim(p)).fov - 0.15) < 0.01, String((await aim(p)).fov));
    await p.evaluate(() => __loft.scope.goTo('moon'));
    await p.waitForTimeout(2600);
    for (let i = 0; i < 30; i++) await p.keyboard.press('Equal');
    await p.waitForTimeout(900);
    check('the moon stops when it fills the eyepiece', Math.abs((await aim(p)).fov - 0.6) < 0.01, String((await aim(p)).fov));
    check('the plain moon steps aside for the close one', await p.evaluate(() => __loft.out3d.parts.sky.moon.material.uniforms.uBright.value === 0));
    const city = await p.evaluate(async () => {
      for (let i = 0; i < 100 && !window.__loft.scope.kit?.city; i++) await new Promise(r => setTimeout(r, 100));
      const c = __loft.scope.kit?.city;
      return c && { houses: c.houses, slabs: c.slabs };
    });
    check('the close-up city is built', city && city.houses > 1500 && city.slabs > 1000, JSON.stringify(city));

    // The Death Star is still there to be found, as before: from a fresh look, aimed by hand and four steps in.
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    await p.evaluate(() => __loft.act('telescope'));
    await p.waitForTimeout(400);
    const spotted = await p.evaluate(async () => {
      const L = __loft, S = await import('./src/pure/scope.js'), d = L.out3d.deathStar;
      const want = S.aimOf(d.x, d.y, d.z), now = L.scope.aim;
      L.scope.nudge(want.yaw - now.yaw, want.pitch - now.pitch);
      for (let i = 0; i < 4; i++) L.scope.zoom(-1);
      for (let i = 0; i < 150; i++) { await new Promise(r => requestAnimationFrame(r)); if (L.progress.has('telescope')) return true; }
      return false;
    });
    check('the Death Star is still spotted', spotted && /no moon/.test(await p.textContent('#toast')));

    // Leaving puts everything back.
    await p.click('.ts-row > button');
    await p.waitForTimeout(400);
    const back = await p.evaluate(() => {
      let shown = 0; __loft.out3d.extras.traverse(o => { if (o.isMesh && o.visible && o.parent?.visible !== false && o.material?.uniforms) shown++; });
      return { mode: __loft.mode, cam: [__loft.camera.fov, __loft.camera.near], ui: !!document.querySelector('.ts-veil, .ts-hud, .ts-bar'), scope: __loft.out3d.U.uScope.value,
        moon: __loft.out3d.parts.sky.moon.material.uniforms.uBright.value, shown };
    });
    check('leave: back to walking', back.mode === 'walk' && !back.ui, JSON.stringify(back));
    check('leave: the camera as it was', Math.abs(back.cam[0] - fov0[0]) < 1e-6 && back.cam[1] === fov0[1]);
    check('leave: nothing of the telescope left drawn', back.scope === 0 && back.moon === 1 && back.shown === 0, JSON.stringify(back));
    check('no page errors (computer)', !errs.length, errs.join(' | '));
    await p.close();

    // 2 am on 19 November: the moon and Jupiter low behind towers, Mars far round to the east.
    const late = await open(b, { viewport: { width: 1280, height: 800 } }, '&time=02:00&date=2026-11-19&weather=clear');
    await enter(late.p);
    const lateIds = await late.p.evaluate(() => __loft.scope.stops.map(s => s.id));
    check('a moon or planet behind a tower is not offered', !lateIds.includes('moon') && !lateIds.includes('jupiter') && lateIds.includes('mars') && lateIds.includes('saturn'), lateIds.join(' '));
    // From the far left of the mount to Mars is more than half a turn: the swing still goes round by the north.
    const edge = await late.p.evaluate(async () => {
      const L = __loft.scope, S = await import('./src/pure/scope.js'), out = [];
      L.nudge(-5, 0);
      L.goTo('mars');
      for (let i = 0; i < 300 && L.target === 'mars'; i++) { await new Promise(r => requestAnimationFrame(r)); out.push(L.aim.yaw); if (Math.abs(S.wrap(L.aim.yaw - L.stops.find(s => s.id === 'mars').yaw)) < 1e-4 && i > 10) break; }
      return { widest: Math.max(...out.map(Math.abs)), limit: S.LIMIT.yaw, last: out[out.length - 1], mars: L.stops.find(s => s.id === 'mars').yaw };
    });
    check('a swing from one end of the mount to the other never turns through the house', edge.widest <= edge.limit + 1e-6 && Math.abs(edge.last - edge.mars) < 1e-3, JSON.stringify(edge));
    check('no page errors (2 am)', !late.errs.length, late.errs.join(' | '));
    await late.p.close();

    // Twenty past the hour the cruise ship is just west of the bridge, behind Stanley Park's trees.
    const park = await open(b, { viewport: { width: 1280, height: 800 } }, '&time=22:20&date=2026-11-17&weather=clear');
    await enter(park.p);
    const ship = await park.p.evaluate(() => ({ on: __loft.out3d.vessels[0].on, dx: Math.round(__loft.out3d.vessels[0].dx), ids: __loft.scope.stops.map(s => s.id) }));
    check('a ship behind the park is not offered', ship.on && ship.dx < -2300 && !ship.ids.includes('craft0'), JSON.stringify(ship));
    check('no page errors (the park)', !park.errs.length, park.errs.join(' | '));
    await park.p.close();

    // ---------- a phone ----------
    const ph = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, NIGHT);
    await enter(ph.p);
    const lay = await ph.p.evaluate(() => {
      const box = s => document.querySelector(s)?.getBoundingClientRect();
      const row = box('.ts-row'), zoom = box('.ts-zoom'), list = document.querySelector('.ts-stops');
      const r = parseFloat(getComputedStyle(document.querySelector('.ts-hud')).getPropertyValue('--r'));
      return { row: row && [row.left, row.right, row.top, row.bottom], zoom: zoom && [zoom.left, zoom.right, zoom.top, zoom.bottom], r, scrolls: list.scrollWidth > list.clientWidth,
        touchRow: getComputedStyle(document.querySelector('.touch')).display, w: innerWidth, h: innerHeight };
    });
    check('phone: the eyepiece fits', lay.r * 2 <= lay.w && lay.r > 120, JSON.stringify(lay));
    check('phone: the walking chips step aside', lay.touchRow === 'none');
    check('phone: the stops and the zoom buttons do not overlap', lay.zoom[3] <= lay.row[2] && lay.row[1] <= lay.w + 0.5 && lay.row[0] >= -0.5);
    check('phone: the stops scroll sideways', lay.scrolls);
    await ph.p.tap('.ts-stops button[data-id="grouse"]').catch(async () => { await ph.p.evaluate(() => document.querySelector('.ts-stops button[data-id="grouse"]').scrollIntoView()); await ph.p.tap('.ts-stops button[data-id="grouse"]'); });
    await ph.p.waitForTimeout(2600);
    check('phone: a tap on a stop goes there', (await ph.p.evaluate(() => __loft.scope.target)) === 'grouse');
    // Two fingers spreading apart zoom in.
    const cdp = await ph.p.context().newCDPSession(ph.p);
    const f0 = (await aim(ph.p)).fov;
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
    await touch('touchStart', [[195, 420], [205, 440]]);
    for (let k = 1; k <= 8; k++) await touch('touchMove', [[195 - k * 12, 420 - k * 12], [205 + k * 12, 440 + k * 12]]);
    await touch('touchEnd', []);
    await ph.p.waitForTimeout(900);
    const f2 = (await aim(ph.p)).fov;
    check('phone: a pinch zooms in', f2 < f0 * 0.6, `${f0.toFixed(2)} to ${f2.toFixed(2)}`);
    check('phone: no page errors', !ph.errs.length, ph.errs.join(' | '));
    await ph.p.close();

    // ---------- the low tier: what looking through costs ----------
    const lo = await b.newPage({ viewport: { width: 1366, height: 768 } }), loErr = [];
    watch(lo, loErr);
    await lo.goto(`${BASE}/?auto&q=low${NIGHT}`);
    await lo.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
    await lo.waitForTimeout(1500);
    const cdpLo = await lo.context().newCDPSession(lo);
    const frames = () => lo.evaluate(async () => {
      const t = []; let last = performance.now();
      for (let i = 0; i < 120; i++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); t.push(n - last); last = n; }
      t.sort((x, y) => x - y);
      return { median: t[60], p90: t[108], calls: __loft.renderer.info.render.calls, tris: __loft.renderer.info.render.triangles };
    });
    await lo.evaluate(() => { const L = __loft, it = L.meta.interact.find(i => i.id === 'telescope'); L.pos.set(it.at[0], 0.05, -it.at[1]); L.yaw = Math.PI; });
    await lo.waitForTimeout(800);
    await cdpLo.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const walk = await frames();
    await cdpLo.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await enter(lo);
    await lo.waitForFunction(() => __loft.scope.kit?.city, null, { timeout: 20000 });
    await lo.evaluate(() => __loft.scope.goTo('lonsdale'));
    await lo.waitForTimeout(2600);
    await cdpLo.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const look = await frames();
    await cdpLo.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`low tier, CPU slowed 4x: on the balcony ${walk.median.toFixed(1)} ms median, ${walk.p90.toFixed(1)} ms p90, ${walk.calls} calls; through the telescope ${look.median.toFixed(1)} ms median, ${look.p90.toFixed(1)} ms p90, ${look.calls} calls, ${(look.tris / 1000).toFixed(0)}k triangles`);
    check('low tier: looking through costs no more than a frame budget', look.p90 <= Math.max(walk.p90 * 1.5, 34), `${look.p90.toFixed(1)} ms`);
    check('low tier: no page errors', !loErr.length, loErr.join(' | '));
    await lo.close();
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})();
