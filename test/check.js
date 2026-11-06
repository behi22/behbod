// Character and desk check in the loft: loads, walks, the lounge edge, the desk close-up, typing, moves, heads, phone.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const OUT = process.argv[2] || 'test-output';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.LOFT_URL || 'http://127.0.0.1:8810') + '/?auto&stats';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
  p.on('pageerror', e => errs.push('page: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  p.on('requestfailed', r => errs.push('failed: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText || '') + ' at ' + new Date().toISOString().slice(11, 19)));
  p.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url().slice(0, 120)); });
  await p.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__loft, null, { timeout: 120000 });
  const gpu = await p.evaluate(() => { const gl = window.__loft.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  console.log('gpu', gpu);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/s1-start.png' });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1400); await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD');
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/s2-walk.png' });
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyS'); await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + '/s3-run.png' });
  await p.keyboard.up('KeyS'); await p.keyboard.up('ShiftLeft');
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + '/s4-jump.png' });
  await p.waitForTimeout(900);
  // Regression: W moves away from the camera and D to its right (they were inverted in v1).
  const moveBy = async key => {
    const before = await p.evaluate(() => { const L = window.__loft, f = new (L.camera.position.constructor)(); L.camera.getWorldDirection(f); return { x: L.pos.x, z: L.pos.z, fx: f.x, fz: f.z }; });
    await p.keyboard.down(key); await p.waitForTimeout(700); await p.keyboard.up(key); await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({ x: window.__loft.pos.x, z: window.__loft.pos.z }));
    const n = Math.hypot(before.fx, before.fz), fx = before.fx / n, fz = before.fz / n, dx = after.x - before.x, dz = after.z - before.z;
    return { forward: dx * fx + dz * fz, right: dx * -fz + dz * fx };
  };
  await p.evaluate(() => { window.__loft.pos.set(11.0, 0.05, -9.5); window.__loft.yaw = -Math.PI / 2; });
  await p.waitForTimeout(500);
  const w = await moveBy('KeyW'), d = await moveBy('KeyD');
  console.log('W forward', w.forward.toFixed(2), 'D right', d.right.toFixed(2), w.forward > 0.4 && d.right > 0.4 ? 'PASS' : 'FAIL');
  // Regression: walking from the sunken lounge into its edge must stop at the edge, never drop under the floor.
  await p.evaluate(() => { window.__loft.pos.set(3.0, -0.4, -13.0); window.__loft.yaw = 0; });
  await p.waitForTimeout(500);
  await p.keyboard.down('KeyW');
  let minY = 0, maxZ = -9;
  for (let i = 0; i < 15; i++) { await p.waitForTimeout(100); const q = await p.evaluate(() => [window.__loft.pos.y, window.__loft.pos.z]); minY = Math.min(minY, q[0]); maxZ = Math.max(maxZ, q[1]); }
  await p.keyboard.up('KeyW');
  const endZ = await p.evaluate(() => window.__loft.pos.z);
  console.log('edge walk lowest y', minY.toFixed(2), 'stopped at z', endZ.toFixed(2), minY > -0.5 && endZ > -13.6 ? 'PASS' : 'FAIL');
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  console.log('fps desktop', fps.toFixed(1), 'tier', await p.evaluate(() => window.__loft.tier));
  await p.evaluate(() => { const l = window.__loft, d = l.meta.points.desk_use; l.pos.set(d[0], d[2] + 0.05, -d[1]); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/s5-desk-prompt.png' });
  const prompt = await p.evaluate(() => document.getElementById('prompt').classList.contains('on'));
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(1600);
  await p.keyboard.type('help');
  await p.keyboard.press('Enter');
  await p.keyboard.type('postit');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/s6-closeup.png' });
  const mode = await p.evaluate(() => window.__loft.mode);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1400);
  const mode2 = await p.evaluate(() => window.__loft.mode);
  await p.screenshot({ path: OUT + '/s7-back.png' });
  console.log('prompt shown', prompt, 'mode at desk', mode, 'after esc', mode2);
  // v3: physics engine, the blend layer, the head cycle, crouch, roll and the mosaic achievement.
  console.log('physics', await p.evaluate(() => window.__loft.physics));
  await p.keyboard.down('KeyW'); await p.waitForTimeout(500);
  console.log('walking weights', JSON.stringify(await p.evaluate(() => window.__loft.weights)));
  await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(700);
  console.log('running weights', JSON.stringify(await p.evaluate(() => window.__loft.weights)));
  await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyC'); await p.waitForTimeout(600);
  console.log('crouch weights', JSON.stringify(await p.evaluate(() => window.__loft.weights)));
  await p.keyboard.up('KeyC'); await p.waitForTimeout(150);
  await p.keyboard.press('KeyC'); await p.waitForTimeout(60); await p.keyboard.press('KeyC'); await p.waitForTimeout(300);
  console.log('roll weights', JSON.stringify(await p.evaluate(() => window.__loft.weights)));
  await p.waitForTimeout(900);
  const heads = [];
  // Regression: every head must actually draw after switching (its parts used to stay hidden, leaving an empty hood).
  const shown = [];
  shown.push('hood:' + await p.evaluate(() => window.__loft.headMeshesShown));
  for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyH'); await p.waitForTimeout(150); heads.push(await p.evaluate(() => window.__loft.head)); shown.push(heads[i] + ':' + await p.evaluate(() => window.__loft.headMeshesShown)); }
  console.log('head cycle', heads.join(' > '), '| meshes drawn', shown.join(' '), shown.every(s => +s.split(':')[1] > 0) ? 'PASS' : 'FAIL');
  await p.evaluate(() => { const l = window.__loft, d = l.meta.points.desk_use; l.pos.set(d[0], d[2] + 0.05, -d[1]); });
  await p.waitForTimeout(500);
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '/s6b-glide-mid.png' });
  console.log('mid glide visible', await p.evaluate(() => window.__loft.headVisible));
  await p.waitForTimeout(1400);
  await p.keyboard.type('whoami'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1800);
  let cyc = '';
  for (let i = 0; i < 6 && cyc !== 'mosaic'; i++) { await p.keyboard.press('KeyH'); await p.waitForTimeout(150); cyc = await p.evaluate(() => window.__loft.head); }
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/s7b-mosaic.png' });
  console.log('after whoami the head cycle reaches', cyc, '| mode', await p.evaluate(() => window.__loft.mode));
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  ph.on('pageerror', e => errs.push('phone page: ' + e.message));
  ph.on('requestfailed', r => errs.push('phone failed: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText || '')));
  ph.on('response', r => { if (r.status() >= 400) errs.push('phone http ' + r.status() + ' ' + r.url().slice(0, 120)); });
  await ph.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await ph.waitForFunction(() => window.__loft, null, { timeout: 120000 });
  await ph.waitForTimeout(2000);
  await ph.screenshot({ path: OUT + '/s8-phone.png' });
  await ph.tap('[data-go="desk"]');
  await ph.waitForTimeout(3500);
  await ph.fill('#cmd', 'whoami');
  await ph.press('#cmd', 'Enter');
  await ph.waitForTimeout(500);
  await ph.screenshot({ path: OUT + '/s9-phone-desk.png' });
  await ph.mouse.move(300, 400); await ph.mouse.down(); await ph.mouse.move(80, 400, { steps: 8 }); await ph.mouse.up();
  await ph.waitForTimeout(600);
  await ph.screenshot({ path: OUT + '/s9b-phone-pan.png' });
  const over = await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('phone mode', await ph.evaluate(() => window.__loft.mode), 'sideways scroll', over, 'tier', await ph.evaluate(() => window.__loft.tier));
  // A known non-error: Playwright reports the streamed model downloads as aborted even though they finish (the page
  // only becomes ready after every model parses).
  // Also: the live video's YouTube player cancels its own background requests (captions, stats) when it pauses.
  const real = errs.filter(e => !/assets\/(zones\/\w+|behbod_v3)\.glb net::ERR_ABORTED/.test(e) && !/(youtube-nocookie\.com|googlevideo\.com|ytimg\.com)\S* net::ERR_ABORTED/.test(e));
  console.log('errors', real.length ? '\n  ' + real.join('\n  ') : 'none', `(ignored ${errs.length - real.length} known non-errors)`);
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
