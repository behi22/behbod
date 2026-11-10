// The whole loft: it loads with no errors or missing screens, every thing you can use is reachable and answers E,
// the secret bookcase opens into the range, sitting works, and a screenshot from each zone goes to the out folder.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.LOFT_URL || 'http://127.0.0.1:8810') + '/?auto&stats';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const VIEWS = { spawn: [2.55, 1.2, 0, 0.15], lounge: [10.6, 11.6, 0, -2.0], studio: [15.6, 4.4, 0.45, -2.2], desk: [19.0, 2.6, 0.45, -2.3], piano: [16.0, 8.9, 0, 0.6], teabar: [14.6, 9.4, 0, 0.1],
  mezz: [9.5, 2.0, 3.0, 2.0], balcony: [11.6, 16.2, 0, Math.PI], range: [8.1, -0.8, 0, -1.6], entry: [2.2, 3.6, 0, 2.6], stairs: [2.0, 9.2, 0, 2.4], videos: [19.2, 9.6, 0, -1.4], library: [9.0, 3.6, 0, -2.4] };

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = [], warns = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200) + ' @ ' + (m.location()?.url || '').slice(0, 100)); if (m.type() === 'warning' && /\[loft\]/.test(m.text())) warns.push(m.text()); });
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
    // Esc backs out of whatever it opened: a seat, the piano, a game, the range, the telescope, a video.
    await p.keyboard.press('Escape');
    // Sitting down and standing back up take a second each.
    await p.waitForFunction(() => __loft.mode !== 'sit' && __loft.mode !== 'rising', null, { timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(300);
    const left = await p.evaluate(() => ({ mode: __loft.mode, overlay: !!document.querySelector('.g-overlay, .video, .rg-hud, .ts-veil, .pm, .pn') }));
    if (left.mode !== 'walk' || left.overlay) missed.push(`${it.id} (Esc left mode ${left.mode}${left.overlay ? ' and an overlay' : ''})`);
  }
  console.log('things you can use', items.length, missed.length ? 'NOT REACHABLE: ' + missed.join(', ') : 'all reachable PASS');

  // Videos: the big frame and the TV open YouTube's player from the start; the TV flips through all of them in order.
  // The TV opens its match menu first; its last entry switches it over to the videos.
  const tvVideos = async () => { await p.waitForSelector('.g-menu'); await p.click('.g-menu button:text-is("Go")'); };
  const src = async id => { await p.evaluate(i => __loft.act(i), id); if (id === 'tv') await tvVideos(); await p.waitForTimeout(300); const u = await p.evaluate(() => document.querySelector('.video iframe')?.src || ''); await p.keyboard.press('Escape'); await p.waitForTimeout(200); return u.match(/embed\/([\w-]{11})/)?.[1] || null; };
  const vids = await p.evaluate(() => fetch('media.json').then(r => r.json()).then(m => m.videos.map(v => v.id)));
  const frame = await src('video0');
  const tv = [await src('tv'), await src('tv'), await src('tv')];
  const i0 = vids.indexOf(tv[0]);
  const vidOk = frame === vids[0] && i0 >= 0 && tv.every((id, k) => id === vids[(i0 + k) % vids.length]);
  console.log('videos: frame', frame, '| tv', tv.join(' '), vidOk ? 'PASS' : 'FAIL');
  // The big frame goes live (YouTube's player seen through the screen) when you walk up, and stops when you leave.
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = -Math.PI / 2; }, b2t(19.4, 7.65, 0));
  await p.waitForFunction(() => __loft.liveVideo.live, null, { timeout: 8000 }).catch(() => {});
  const liveNear = await p.evaluate(() => __loft.liveVideo.live);
  await p.waitForFunction(() => __loft.scene.getObjectByName('screen_video0').material.opacity === 0, null, { timeout: 20000 }).catch(() => {});
  const showing = await p.evaluate(() => __loft.scene.getObjectByName('screen_video0').material.opacity === 0);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/w-videos.png` });
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(2.55, 1.2, 0));
  await p.waitForTimeout(1500);
  const liveAway = await p.evaluate(() => __loft.liveVideo.live);
  console.log('live frame: near', liveNear, 'player showing', showing, '| far away', liveAway, liveNear && showing && !liveAway ? 'PASS' : 'FAIL');

  // The secret bookcase: closed it blocks the way, open it lets you walk into the range.
  const tryWalk = async () => {
    await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = Math.PI; }, b2t(8.1, 0.95, 0));
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
  await p.waitForTimeout(1500);
  const stood = await p.evaluate(() => __loft.mode);
  console.log('sit', sat, 'then', stood, sat === 'sit' && stood === 'walk' ? 'PASS' : 'FAIL');

  // Walk from the front door into the loft.
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = 0; }, b2t(2.0, 1.3, 0));
  await p.waitForTimeout(300);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2000); await p.keyboard.up('KeyW');
  const walked = await p.evaluate(() => -__loft.pos.z);
  console.log('walk in from the door to y', walked.toFixed(2), walked > 3 ? 'PASS' : 'FAIL');

  // Regression: the glass wall is solid everywhere, and the sliding door opens as you walk up and lets you out.
  const walkNorth = async (x, y, ms) => {
    await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = 0; }, b2t(x, y, 0));
    await p.waitForTimeout(400);
    await p.keyboard.down('KeyW'); await p.waitForTimeout(ms); await p.keyboard.up('KeyW');
    return p.evaluate(() => -__loft.pos.z);
  };
  const glassY = await walkNorth(15.5, 13.6, 2200);
  console.log('walking into the glass stops at y', glassY.toFixed(2), glassY < 15 ? 'PASS' : 'FAIL');
  const doorY = await walkNorth(11.7, 13.4, 3000);
  console.log('walking through the sliding door reaches y', doorY.toFixed(2), doorY > 15.3 ? 'PASS' : 'FAIL');
  const balconyEarned = await p.evaluate(() => __loft.progress.has('balcony'));
  console.log('stepping onto the balcony earns its achievement', balconyEarned ? 'PASS' : 'FAIL');

  // The hood: G flips it on any head, and the chip says which way it is.
  const hood0 = await p.evaluate(() => [__loft.me.hoodUp, document.getElementById('hood').textContent]);
  await p.keyboard.press('KeyG'); await p.waitForTimeout(200);
  const hood1 = await p.evaluate(() => [__loft.me.hoodUp, document.getElementById('hood').textContent]);
  // The hood head with its hood down is one black head on a black neck: the whole void head shows, the white socket
  // does not; with the hood up it is the other way round.
  const drawn = names => p.evaluate(ns => ns.map(n => { const o = __loft.scene.getObjectByName(n); if (!o) return null; let v = false; o.traverse(c => { if (!c.isMesh) return; let ok = true; for (let x = c; x; x = x.parent) ok = ok && x.visible; v = v || ok; }); return v; }), names);
  const neck = await drawn(['V3_socket', 'V3_head_void_full', 'V3_head_void']);
  const neckOk = hood1[0] ? neck.join() === 'true,false,true' : neck.join() === 'false,true,false';
  console.log('hood head, hood', hood1[0] ? 'up' : 'down', ': socket, full head, face', neck.join(' '), neckOk ? 'PASS' : 'FAIL');
  await p.keyboard.press('KeyH'); await p.waitForTimeout(200);
  await p.keyboard.press('KeyG'); await p.waitForTimeout(200);
  const hood2 = await p.evaluate(() => [__loft.me.head, __loft.me.hoodUp]);
  const hoodOk = hood0[0] !== hood1[0] && hood1[1] === (hood1[0] ? 'Hood up' : 'Hood down') && hood2[0] !== 'hood';
  console.log('hood toggle', hood0.join('/'), '->', hood1.join('/'), '| on head', hood2.join(' '), hoodOk ? 'PASS' : 'FAIL');

  // The wardrobe: O opens it, a colour pick changes the look and is saved, Escape closes it. (Using every thing above
  // opened it at the wardrobe, so start from shut.)
  await p.evaluate(() => __loft.wardrobe.hide());
  await p.keyboard.press('KeyO'); await p.waitForTimeout(200);
  const wdOpen = await p.evaluate(() => !!document.querySelector('.wd'));
  await p.evaluate(() => document.querySelectorAll('.wd .sw')[2]?.click());
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('loft.look') || '{}').colours?.hoodie);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const wdShut = await p.evaluate(() => !document.querySelector('.wd'));
  console.log('wardrobe opens', wdOpen, 'saves hoodie', saved, 'closes', wdShut, wdOpen && wdShut && /^#[0-9a-f]{6}$/i.test(saved || '') ? 'PASS' : 'FAIL');

  // Click-to-walk follows a found path: from the front door to the piano dais, and up the stairs to the mezzanine.
  const walkPath = async (x, y, z, ms) => {
    await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(...(await p.evaluate(() => __loft.meta.points.spawn))));
    await p.waitForTimeout(400);
    const ok = await p.evaluate(([a, b, c]) => __loft.walkTo(a, b, c), [x, y, z]);
    const t0 = Date.now();
    while (Date.now() - t0 < ms && await p.evaluate(() => __loft.route > 0)) await p.waitForTimeout(250);
    const at = await p.evaluate(() => [__loft.pos.x, -__loft.pos.z, __loft.pos.y]);
    return { ok, d: Math.hypot(at[0] - x, at[1] - y), z: at[2] };
  };
  const toPiano = await walkPath(19.1, 9.95, 0.3, 20000);
  console.log('walk the path to the piano', toPiano.ok, 'ends', toPiano.d.toFixed(2), 'm away', toPiano.ok && toPiano.d < 0.6 ? 'PASS' : 'FAIL');
  const toMezz = await walkPath(6.8, 2.75, 3.0, 25000);
  console.log('walk the path up to the mezzanine', toMezz.ok, 'ends', toMezz.d.toFixed(2), 'm away at height', toMezz.z.toFixed(2), toMezz.ok && toMezz.d < 0.6 && toMezz.z > 2.8 ? 'PASS' : 'FAIL');

  // The terminal takes the commands the loft adds, with an argument.
  await p.evaluate(() => __loft.useDesk()); await p.waitForTimeout(2500);
  const hoodBefore = await p.evaluate(() => __loft.me.hoodUp);
  await p.keyboard.type('hood'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const hoodAfter = await p.evaluate(() => __loft.me.hoodUp);
  await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
  console.log('terminal hood command', hoodBefore, '->', hoodAfter, hoodBefore !== hoodAfter ? 'PASS' : 'FAIL');

  // The holo range: start a round, click real targets on screen, and the round ends on time with the score kept.
  const spot = async it => { const q = await p.evaluate(id => __loft.meta.interact.find(i => i.id === id).at, it); await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...q)); await p.waitForTimeout(400); };
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1500);
  await spot('range');
  await p.evaluate(() => __loft.act('range')); await p.waitForTimeout(1200);
  await p.click('.rg-card button');
  const r0 = Date.now();
  let shots = 0;
  while (Date.now() - r0 < 12000) {
    const xy = await p.evaluate(() => { const v = __loft.range.live()[0]; if (!v) return null; v.project(__loft.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
    if (xy) { await p.mouse.click(xy[0], xy[1]); shots++; }
    await p.waitForTimeout(220);
  }
  const hitScore = await p.evaluate(() => __loft.range.score);
  await p.screenshot({ path: `${OUT}/w-range-game.png` });
  await p.waitForFunction(() => /ROUND OVER/.test(document.querySelector('.rg-card')?.textContent || ''), null, { timeout: 40000 });
  const best = await p.evaluate(() => __loft.progress.best('range'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const afterRange = await p.evaluate(() => __loft.mode);
  console.log('holo range', shots, 'shots scored', hitScore, '| best kept', best, '| back to', afterRange, hitScore > 0 && best >= hitScore && afterRange === 'walk' ? 'PASS' : 'FAIL');

  // The telescope: aim at the Death Star, zoom in, hold it, and it is spotted.
  await spot('telescope');
  await p.evaluate(() => __loft.act('telescope')); await p.waitForTimeout(600);
  const aimed = await p.evaluate(() => {
    const d = __loft.out3d ? __loft.out3d.deathStar : null;
    if (!d) return null;
    __loft.scope.nudge(Math.atan2(d.x, -d.z), Math.asin(d.y) - 0.15);
    for (let i = 0; i < 4; i++) __loft.scope.zoom(-1);
    return [Math.atan2(d.x, -d.z), Math.asin(d.y)].map(v => +v.toFixed(2));
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/w-telescope.png` });
  const spotted = await p.evaluate(() => __loft.progress.has('telescope'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const fovBack = await p.evaluate(() => [__loft.mode, __loft.camera.fov]);
  console.log('telescope aimed at', JSON.stringify(aimed), 'spotted', spotted, '| back to', fovBack.join(' fov '), spotted && fovBack[0] === 'walk' && fovBack[1] > 40 ? 'PASS' : 'FAIL');

  // The piano: sitting down opens the keys, A plays and lights one, Esc stands up.
  await spot('piano');
  await p.evaluate(() => __loft.act('piano')); await p.waitForTimeout(600);
  await p.keyboard.down('KeyA'); await p.waitForTimeout(150);
  const lit = await p.evaluate(() => document.querySelectorAll('.pm .on').length);
  await p.keyboard.up('KeyA'); await p.waitForTimeout(150);
  const played = await p.evaluate(() => __loft.progress.has('piano'));
  // Learn: the first song's next keys glow gold; hitting one moves the lesson on.
  await p.click('.pm-song button');
  await p.waitForTimeout(200);
  const step1 = await p.evaluate(() => [document.querySelector('.pm .grow').textContent, document.querySelectorAll('.pm .next').length]);
  const nk = await p.locator('.pm .next').first().boundingBox();
  if (nk) { await p.mouse.move(nk.x + nk.width / 2, nk.y + nk.height - 8); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); }
  await p.waitForTimeout(200);
  const step2 = await p.evaluate(() => document.querySelector('.pm .grow').textContent);
  console.log('piano learn:', step1[0], '| gold keys', step1[1], '| after hitting one:', step2, / 1 of /.test(step1[0]) && step1[1] > 0 && / 2 of /.test(step2) ? 'PASS' : 'FAIL');
  await p.keyboard.press('Escape'); await p.waitForTimeout(1600);
  const pianoOut = await p.evaluate(() => [__loft.mode, !!document.querySelector('.pm')]);
  console.log('piano: key lit', lit, 'played', played, '| after Esc', pianoOut.join(' overlay '), lit === 1 && played && pianoOut[0] === 'walk' && !pianoOut[1] ? 'PASS' : 'FAIL');

  // Records: with the sound on, the crate puts on the first record and the platter spins.
  const sndBefore = await p.evaluate(() => document.getElementById('snd').textContent);
  if (sndBefore !== 'Sound on') await p.click('#snd');
  await p.waitForTimeout(300);
  await spot('records');
  await p.evaluate(() => __loft.act('records')); await p.waitForTimeout(800);
  const rec = await p.evaluate(() => [__loft.audio.music.current, __loft.progress.has('record'), document.getElementById('snd').textContent, document.getElementById('toast').textContent]);
  await p.evaluate(() => __loft.audio.music.stop());
  console.log('records: playing', rec[0], 'earned', rec[1], rec[0] === 'night-shift' && rec[1] ? 'PASS' : `FAIL (before: ${sndBefore}; now: ${rec[2]}; ${rec[3]})`);

  // The recorded grand loads once the sound is on, and the music fades out while the piano plays.
  await p.waitForFunction(() => __loft.audio.piano.sampled, null, { timeout: 20000 }).catch(() => {});
  const sampled = await p.evaluate(() => __loft.audio.piano.sampled);
  await p.evaluate(() => __loft.audio.music.play('night-shift'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => __loft.audio.piano.playSong('ode-to-joy'));
  await p.waitForTimeout(2500);
  const ducked = await p.evaluate(() => __loft.audio.musicLevel());
  await p.evaluate(() => { __loft.audio.piano.stopSong(); __loft.audio.music.stop(); });
  console.log('piano: recordings loaded', sampled, '| music level while it plays', ducked.toFixed(2), sampled && ducked < 0.1 ? 'PASS' : 'FAIL');

  // Regression: a held E repeats, and the repeats used to stand me up and sit me down again.
  await spot('couch_north');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
  await p.evaluate(() => { for (let i = 0; i < 3; i++) dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', repeat: true })); });
  await p.waitForTimeout(300);
  const held = await p.evaluate(() => __loft.mode);
  await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
  console.log('holding E keeps me seated:', held, held === 'sit' ? 'PASS' : 'FAIL');

  // Regression: walking to the desk along a path used to leave me sitting in mid-air with the prompt still up.
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(16.0, 8.9, 0));
  await p.waitForTimeout(400);
  await p.evaluate(() => __loft.goTo('desk'));
  await p.waitForFunction(() => __loft.mode === 'desk', null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const seated = await p.evaluate(() => [__loft.mode, __loft.me.root.position.distanceTo(__loft.chair), document.getElementById('prompt').classList.contains('on')]);
  await p.evaluate(() => __loft.leaveDesk()); await p.waitForTimeout(2500);
  console.log('walk to the desk: mode', seated[0], 'off the chair by', seated[1].toFixed(2), 'm, prompt shown', seated[2], seated[0] === 'desk' && seated[1] < 0.05 && !seated[2] ? 'PASS' : 'FAIL');

  // The 3D printer: type a word, it prints a layer at a time with the head moving, then keeps the print for next time.
  await spot('printer');
  await p.evaluate(() => __loft.act('printer'));
  await p.waitForTimeout(300);
  const headRest = await p.evaluate(() => __loft.world.printParts.head.position.toArray());
  await p.keyboard.type('a teal star'); await p.keyboard.press('Enter');
  await p.waitForTimeout(2500);
  const mid = await p.evaluate(() => ({ name: __loft.printer.print.name, colour: __loft.printer.print.colour, k: __loft.printer.progress, head: __loft.world.printParts.head.position.toArray(), said: document.querySelector('.pn-said')?.textContent }));
  const headMoved = Math.hypot(...mid.head.map((v, i) => v - headRest[i]));
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => __loft.printer.progress === 1, null, { timeout: 20000 }).catch(() => {});
  const kept = await p.evaluate(() => [__loft.printer.progress, JSON.parse(localStorage.getItem('home.print') || 'null')?.name, !!document.querySelector('.pn')]);
  const printOk = mid.name === 'star' && mid.colour === 'teal' && mid.k > 0.05 && mid.k < 0.5 && headMoved > 0.02 && /teal star/.test(mid.said || '') && kept[0] === 1 && kept[1] === 'star' && !kept[2];
  console.log('3D printer:', mid.said, '| part way', mid.k.toFixed(2), '| head moved', headMoved.toFixed(3), 'm | done', kept[0], 'kept', kept[1], printOk ? 'PASS' : 'FAIL');

  // The Rubik's cube on the desk turns its layers while you are near it.
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(19.6, 1.4, 0.45));
  // It may be resting solved for a few seconds first; wait for a layer to start turning, then watch it turn.
  const started = await p.waitForFunction(() => __loft.rubik.group.children[1].visible, null, { timeout: 15000 }).then(() => true, () => false);
  const turns = [];
  for (let i = 0; i < 8; i++) { turns.push(await p.evaluate(() => { const l = __loft.rubik.group.children[1]; return [l.quaternion.w.toFixed(3), __loft.rubik.phase].join(' '); })); await p.waitForTimeout(70); }
  const cubeOk = started && new Set(turns).size > 2;
  console.log("Rubik's cube:", new Set(turns).size, 'different moments,', turns[turns.length - 1], cubeOk ? 'PASS' : 'FAIL');

  // Regression: a second video used to open on top of the first, both playing.
  await p.evaluate(() => { __loft.act('video0'); __loft.act('tv'); });
  await tvVideos();
  await p.waitForTimeout(300);
  const players = await p.evaluate(() => document.querySelectorAll('.video').length);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const playersAfter = await p.evaluate(() => document.querySelectorAll('.video').length);
  console.log('one video at a time:', players, 'then', playersAfter, 'after Esc', players === 1 && playersAfter === 0 ? 'PASS' : 'FAIL');

  // Regression: an unknown quality in the address used to stop the page loading.
  const p2 = await b.newPage({ viewport: { width: 800, height: 600 } });
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto(URL.replace('?auto', '?auto&q=max'));
  const up = await p2.waitForFunction(() => !!window.__loft, null, { timeout: 120000 }).then(() => true, () => false);
  const tier2 = up ? await p2.evaluate(() => __loft.tier) : null;
  await p2.close();
  console.log('?q=max (unknown) still loads:', up, 'tier', tier2, up && !errs2.length ? 'PASS' : 'FAIL ' + errs2.join(' | '));

  // A capable computer starts at the screen's full sharpness (on a 2x screen, 2x pixels), with every effect on.
  const p3 = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
  await p3.goto(URL);
  await p3.waitForFunction(() => !!window.__loft, null, { timeout: 120000 });
  const sharp = await p3.evaluate(() => [__loft.tier, __loft.renderer.getPixelRatio()]);
  await p3.close();
  console.log('full sharpness at the start:', sharp.join(' at '), 'x', sharp[0] === 'ultra' && sharp[1] === 2 ? 'PASS' : 'FAIL');

  console.log('missing screens', warns.length ? warns.join(' | ') : 'none');
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
