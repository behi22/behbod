// The whole loft: it loads with no errors or missing screens, every thing you can use is reachable and answers E,
// the secret bookcase opens into the range, sitting works, and a screenshot from each zone goes to the out folder.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const OUT = process.argv[2] || '.';
const URL = 'http://127.0.0.1:8810/?auto&stats';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const VIEWS = { spawn: [2.5, 1.3, 0, 0.0], lounge: [6.2, 8.6, 0, -2.2], studio: [12.4, 3.2, 0.45, -2.3], piano: [12.0, 5.6, 0, 0.0], teabar: [11.5, 6.2, 0, 0.2],
  mezz: [8.4, 1.2, 2.9, 1.9], balcony: [8.5, 12.8, 0, Math.PI], range: [7.1, -0.9, 0, -1.6], entry: [3.4, 2.4, 0, 0.9], stairs: [7.4, 8.2, 0, 0.3] };

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = [], warns = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text().slice(0, 200) + ' @ ' + (m.location()?.url || '').slice(0, 100)); if (m.type() === 'warning' && /\[loft\]/.test(m.text())) warns.push(m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({ zones: __loft.meta.zones.length, things: __loft.meta.interact.length, physics: __loft.physics, calls: __loft.renderer.info.render.calls, tris: __loft.renderer.info.render.triangles }));
  console.log('loaded', JSON.stringify(info));

  for (const [name, [x, y, z, yaw]] of Object.entries(VIEWS)) {
    await p.evaluate(([q, yw]) => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = yw; }, [b2t(x, y, z), yaw]);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/w-${name}.png` });
  }

  // Every thing you can use: stand on its spot, check it is the one offered, press E, check nothing breaks.
  const items = await p.evaluate(() => __loft.meta.interact.map(i => ({ id: i.id, at: i.at })));
  const missed = [];
  for (const it of items) {
    await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(...it.at));
    await p.waitForTimeout(350);
    const n = await p.evaluate(() => __loft.near);
    if (n !== it.id) { missed.push(`${it.id} (offered ${n})`); continue; }
    if (it.id === 'desk' || it.id === 'secret') continue;
    await p.keyboard.press('KeyE');
    await p.waitForTimeout(250);
    const mode = await p.evaluate(() => __loft.mode);
    if (mode === 'sit') { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); }
    await p.evaluate(() => document.querySelector('.video')?.remove());
  }
  console.log('things you can use', items.length, missed.length ? 'NOT REACHABLE: ' + missed.join(', ') : 'all reachable PASS');

  // Videos: each frame opens its own in YouTube's player; the TV flips through all of them in order.
  const src = async id => { await p.evaluate(i => __loft.act(i), id); await p.waitForTimeout(300); const u = await p.evaluate(() => document.querySelector('.video iframe')?.src || ''); await p.evaluate(() => document.querySelector('.video')?.remove()); return u.match(/embed\/([\w-]{11})/)?.[1] || null; };
  const vids = await p.evaluate(() => fetch('media.json').then(r => r.json()).then(m => m.videos.map(v => v.id)));
  const frames = [await src('video0'), await src('video1'), await src('video2')];
  const tv = [await src('tv'), await src('tv'), await src('tv')];
  const i0 = vids.indexOf(tv[0]);
  const vidOk = frames.join() === vids.slice(0, 3).join() && i0 >= 0 && tv.every((id, k) => id === vids[(i0 + k) % vids.length]);
  console.log('videos: frames', frames.join(' '), '| tv', tv.join(' '), vidOk ? 'PASS' : 'FAIL');
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = -Math.PI / 2; }, b2t(14.3, 5.4, 0));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/w-videos.png` });

  // The secret bookcase: closed it blocks the way, open it lets you walk into the range.
  const tryWalk = async () => {
    await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = Math.PI; }, b2t(7.1, 0.9, 0));
    await p.waitForTimeout(300);
    await p.keyboard.down('KeyW'); await p.waitForTimeout(1600); await p.keyboard.up('KeyW');
    return p.evaluate(() => -__loft.pos.z);
  };
  const closedY = await tryWalk();
  // Regression: only the bookcase swings with it; the range's lock (whose old name also began with 'secret_') used
  // to be pulled into the door, making it span the whole range.
  const doorSize = await p.evaluate(() => __loft.world.doorSize('secret'));
  await p.evaluate(() => __loft.act('secret'));
  await p.waitForTimeout(1200);
  const openY = await tryWalk();
  console.log(`secret door closed stops at y ${closedY.toFixed(2)}, open reaches y ${openY.toFixed(2)}`, closedY > 0.3 && openY < -0.4 ? 'PASS' : 'FAIL');
  console.log('bookcase door size', doorSize.map(v => v.toFixed(2)).join(' x '), 'm', Math.max(...doorSize) < 2.3 ? 'PASS' : 'FAIL');

  // Sitting on the window seat and standing back up.
  await p.evaluate(() => __loft.act('window_seat'));
  await p.waitForTimeout(1200);
  const sat = await p.evaluate(() => __loft.mode);
  await p.screenshot({ path: `${OUT}/w-sit.png` });
  await p.keyboard.press('KeyW');
  await p.waitForTimeout(600);
  const stood = await p.evaluate(() => __loft.mode);
  console.log('sit', sat, 'then', stood, sat === 'sit' && stood === 'walk' ? 'PASS' : 'FAIL');

  // Walk from the front door into the loft.
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = 0; }, b2t(3.5, 1.3, 0));
  await p.waitForTimeout(300);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2000); await p.keyboard.up('KeyW');
  const walked = await p.evaluate(() => -__loft.pos.z);
  console.log('walk in from the door to y', walked.toFixed(2), walked > 3 ? 'PASS' : 'FAIL');

  console.log('missing screens', warns.length ? warns.join(' | ') : 'none');
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
