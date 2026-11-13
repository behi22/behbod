// The whole loft: it loads with no errors or missing screens, every thing you can use is reachable and answers E,
// the secret bookcase opens into the range, sitting works, and a screenshot from each zone goes to the out folder.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.LOFT_URL || 'http://127.0.0.1:8810') + '/?auto&stats';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const VIEWS = { spawn: [2.55, 1.2, 0, 0.15], lounge: [10.6, 11.6, 0, -2.0], studio: [15.6, 4.4, 0.45, -2.2], desk: [19.0, 2.6, 0.45, -2.3], piano: [16.0, 8.9, 0, 0.6], teabar: [14.6, 9.4, 0, 0.1],
  mezz: [9.5, 2.0, 3.0, 2.0], balcony: [11.6, 16.2, 0, Math.PI], range: [11.7, -3.2, 0, Math.PI], entry: [2.2, 3.6, 0, 2.6], stairs: [2.0, 9.2, 0, 2.4], videos: [19.2, 9.6, 0, -1.4], library: [9.0, 3.6, 0, -2.4] };

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = [], warns = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200) + ' @ ' + (m.location()?.url || '').slice(0, 100)); if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) warns.push(m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  // The range's rooms are fetched after the house; everything below that goes in there waits for them once, here.
  // (Without them in the world file the range can never be ready: said at once, not after a minute's wait.)
  const rangeBuilt = await p.evaluate(() => __loft.range.built);
  if (!rangeBuilt) console.log('the range is in this world file: FAIL');
  const rangeFrom = Date.now();
  await p.waitForFunction(() => __loft.range.ready, null, { timeout: 60000 });
  console.log('the range arrives after the house:', Date.now() - rangeFrom + 1500, 'ms after the first frame', 'PASS');
  const fits = await p.evaluate(() => ({ built: __loft.range.built, patched: __loft.range.patched }));
  console.log('the range is in this world file and its shader patches fit this three:', JSON.stringify(fits), fits.built && fits.patched ? 'PASS' : 'FAIL');
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
    const left = await p.evaluate(() => ({ mode: __loft.mode, overlay: !!document.querySelector('.g-overlay, .video, .rg, .ts-veil, .pm, .pn') }));
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
  console.log('terminal hood command', hoodBefore, '->', hoodAfter, hoodBefore !== hoodAfter ? 'PASS' : 'FAIL');

  // The desktop laid over the monitor: on the screen's corners, its apps open from the dock, its buttons work, a
  // window drags, the notes take typing, and keys typed elsewhere go back to the terminal.
  const fit = await p.evaluate(() => {
    const el = document.querySelector('.dt.on'); if (!el) return null;
    const s = __loft.meta.screens.main, half = s.w / 2 / s.r;
    const chord = s.r * Math.sin(half), sag = s.r * (1 - Math.cos(half)), c = __loft.screenCentre();
    const pts = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([z, y]) => { const v = c.clone(); v.x -= sag; v.y += y * s.h / 2; v.z += z * chord; v.project(__loft.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
    // Each corner of the desktop, through its own transform, against the same corner of the screen (so a flipped or
    // mirrored layer fails, not just a wrong size).
    const m = new DOMMatrix(getComputedStyle(el).transform), w = el.offsetWidth, h = el.offsetHeight;
    const mine = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => { const q = m.transformPoint(new DOMPoint(x, y)); return [q.x / q.w, q.y / q.w]; });
    return Math.max(...mine.map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])));
  });
  console.log('desktop sits on the screen: off by', fit == null ? 'not shown' : fit.toFixed(1) + ' px', fit != null && fit < 3 ? 'PASS' : 'FAIL');
  await p.click('.dt-icon[aria-label="Open Settings"]'); await p.waitForTimeout(250);
  const setOpen = await p.evaluate(() => !!document.querySelector('.dt-win.focus[data-app="settings"]'));
  const wantDown = await p.evaluate(() => __loft.me.hoodUp);
  await p.click(`.dt-win[data-app="settings"] .dt-pill:text-is("${wantDown ? 'down' : 'up'}")`); await p.waitForTimeout(250);
  const hoodPill = await p.evaluate(() => __loft.me.hoodUp);
  console.log('settings opens from the dock and its hood button works:', setOpen, wantDown, '->', hoodPill, setOpen && hoodPill !== wantDown ? 'PASS' : 'FAIL');
  // Picture quality has one control, here in Settings; the corner of the page has none.
  await p.click('.dt-win[data-app="settings"] .dt-pill:text-is("medium")'); await p.waitForTimeout(400);
  const qMedium = await p.evaluate(() => [__loft.tier, !!document.getElementById('q'), [...document.querySelectorAll('.corner .chip')].some(c => /quality/i.test(c.textContent))]);
  await p.click('.dt-win[data-app="settings"] .dt-pill:text-is("auto")'); await p.waitForTimeout(400);
  const qAuto = await p.evaluate(() => [...document.querySelectorAll('.dt-win[data-app="settings"] .dt-pill.on')].map(b => b.textContent));
  console.log('quality is set in Settings only:', qMedium[0], '-> back to', qAuto[0], '| corner button', qMedium[1] || qMedium[2], qMedium[0] === 'medium' && qAuto.includes('auto') && !qAuto.includes('medium') && !qMedium[1] && !qMedium[2] ? 'PASS' : 'FAIL');
  // The first time the quality lowers itself, a note says so and where its control is, on a line of its own that the
  // toast cannot replace; the second time, nothing. (If this run's own frame rate already lowered it, the visitor has
  // been told and only the second half applies; on the lowest level there is nothing lower to step to.)
  const told = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), order = ['low', 'medium', 'high', 'ultra'], note = document.getElementById('notice'), toast = document.getElementById('toast');
    const was = __loft.tier, lower = order[Math.max(0, order.indexOf(was) - 1)];
    const before = localStorage.getItem('home.qnote') === '1';
    note.classList.remove('on'); note.textContent = '';
    __loft.autoTierTo(lower);
    const first = [note.classList.contains('on'), note.textContent, localStorage.getItem('home.qnote')];
    // Another message straight after must not take the note away.
    toast.textContent = 'something else'; toast.classList.add('on');
    await wait(50);
    const kept = note.classList.contains('on') && /quality/i.test(note.textContent);
    toast.classList.remove('on'); toast.textContent = '';
    note.classList.remove('on'); note.textContent = '';
    // Back up and down again: a second step down, on any machine with a level below its own.
    __loft.autoTierTo(was); __loft.autoTierTo(lower);
    await wait(50);
    const again = note.classList.contains('on');
    __loft.autoTierTo(was);
    return { was, lower, before, first, kept, again, steps: lower !== was };
  });
  const toldOk = !told.steps || (told.before ? !told.first[0] && !told.again : told.first[0] && /Settings/.test(told.first[1]) && told.first[2] === '1' && told.kept && !told.again);
  console.log('a note the first time the quality lowers itself:', told.was, '->', told.lower, told.before ? '(already told earlier in this run)' : JSON.stringify(told.first[1]), '| stays under another message', told.kept, '| told again', told.again, toldOk ? 'PASS' : 'FAIL');
  const t0 = await p.evaluate(() => __loft.screens.desktop.st.wins.find(w => w.app === 'terminal').x);
  const tb = await p.locator('.dt-win[data-app="terminal"] .dt-title span').boundingBox();
  await p.mouse.move(tb.x + tb.width + 60, tb.y + tb.height / 2); await p.mouse.down();
  await p.mouse.move(tb.x + tb.width + 160, tb.y + tb.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  const t1 = await p.evaluate(() => __loft.screens.desktop.st.wins.find(w => w.app === 'terminal').x);
  console.log('the terminal drags by its title bar:', Math.round(t1 - t0), 'desktop px', t1 - t0 > 40 ? 'PASS' : 'FAIL');
  await p.click('.dt-icon[aria-label="Open Notes"]'); await p.waitForTimeout(250);
  await p.click('.dt-notes'); await p.keyboard.press('End'); await p.keyboard.type(' remember the milk'); await p.waitForTimeout(150);
  const noted = await p.evaluate(() => __loft.screens.desktop.notes.endsWith(' remember the milk'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  const stillDesk = await p.evaluate(() => __loft.mode);
  await p.keyboard.type('whoami'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  const ran = await p.evaluate(() => [__loft.screens.desktop.st.focus, __loft.screens.desktop.term.lines.includes('$ whoami')]);
  console.log('notes take typing, Escape only leaves the notes, typing goes back to the terminal:', noted, stillDesk, ran.join(' '), noted && stillDesk === 'desk' && ran[0] === 'terminal' && ran[1] ? 'PASS' : 'FAIL');
  // The calculator: its keys click, the keyboard types into it while it is in front, and its sums are right.
  await p.click('.dt-icon[aria-label="Open Calculator"]'); await p.waitForTimeout(250);
  for (const k of ['7', 'Times', '6', 'Equals']) { await p.click(`.dt-win[data-app="calc"] .dt-key[aria-label="${k}"]`); await p.waitForTimeout(120); }
  const dtCalc1 = await p.evaluate(() => document.querySelector('.dt-calc-main')?.textContent);
  await p.keyboard.type('+8/4', { delay: 60 }); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  // Letters and spaces typed at the calculator stay out of the terminal.
  await p.keyboard.type(' hello ', { delay: 40 }); await p.waitForTimeout(150);
  const dtCalc2 = await p.evaluate(() => [document.querySelector('.dt-calc-main')?.textContent, document.querySelector('.dt-calc-top')?.textContent, __loft.mode, __loft.screens.desktop.st.focus, JSON.stringify(__loft.screens.desktop.term.input)]);
  console.log('the calculator: 7 x 6 on its keys, then + 8 / 4 on the keyboard:', dtCalc1, dtCalc2.join(' | '), dtCalc1 === '42' && dtCalc2[0] === '44' && dtCalc2[2] === 'desk' && dtCalc2[3] === 'calc' && dtCalc2[4] === '""' ? 'PASS' : 'FAIL');
  await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
  const gone = await p.evaluate(() => !document.querySelector('.dt.on') && getComputedStyle(document.querySelector('.dt')).display === 'none');
  console.log('the desktop goes when I stand up:', gone ? 'PASS' : 'FAIL');

  // The range: stepping up to the line brings the stage card; the warm-up is played the way a visitor plays it (the
  // view turned onto each plate as it stands up, the trigger pulled); plates fall and the score counts; the run ends
  // with a result that is kept; Esc pauses a run and leaves from a card.
  const spot = async it => { const q = await p.evaluate(id => __loft.meta.interact.find(i => i.id === id).at, it); await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...q)); await p.waitForTimeout(400); };
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1500);
  await spot('range');
  await p.evaluate(() => __loft.act('range')); await p.waitForTimeout(1200);
  const rgCard = await p.evaluate(() => ({ mode: __loft.mode, state: __loft.range.state, stages: document.querySelectorAll('.rg-card .rg-list button').length, open: document.querySelectorAll('.rg-card .rg-list button:not([disabled])').length }));
  console.log('at the line: the stage card, the first stage open', JSON.stringify(rgCard), rgCard.mode === 'range' && rgCard.state === 'menu' && rgCard.stages === 5 && rgCard.open === 1 ? 'PASS' : 'FAIL');
  await p.click('.rg-card .rg-acts button.go');
  await p.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
  const rgT = Date.now();
  let rgPulls = 0;
  while (Date.now() - rgT < 11000) {
    const d = await p.evaluate(() => { const g = __loft.range.debug; return { n: g.targets.length, id: g.targets[0]?.id, phase: g.weapon.phase }; });
    if (d.n && d.phase === 'ready') {
      await p.evaluate(id => __loft.range.aimAtTarget(id), d.id);
      await p.waitForTimeout(110);
      const before = await p.evaluate(id => { const n = __loft.range.debug.run.shots; __loft.range.aimAtTarget(id); __loft.range.press('fire', true); return n; }, d.id);
      await p.waitForFunction(n => __loft.range.debug.run.shots > n || __loft.range.debug.weapon.phase !== 'ready', before, { timeout: 3000 });
      await p.evaluate(() => __loft.range.press('fire', false));
      rgPulls++;
    }
    await p.waitForTimeout(120);
  }
  await p.screenshot({ path: `${OUT}/w-range-game.png` });
  const rgMid = await p.evaluate(() => { const g = __loft.range.debug; return { score: g.run.score, kills: g.run.kills, shots: g.run.shots, hits: g.run.hits, ammo: g.weapon.ammo, cases: g.fx.casings }; });
  console.log('warm-up:', rgPulls, 'pulls', JSON.stringify(rgMid), rgMid.kills >= 3 && rgMid.score >= 300 && rgMid.shots <= rgPulls && rgMid.shots >= rgPulls - 2 && rgMid.hits >= rgMid.kills && rgMid.cases > 0 ? 'PASS' : 'FAIL');
  // Esc in the middle of a run is the pause, not the way out; Resume goes on.
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const rgPaused = await p.evaluate(() => ({ mode: __loft.mode, state: __loft.range.state, card: document.querySelector('.rg-card h2')?.textContent }));
  await p.click('.rg-card .rg-acts button.go'); await p.waitForTimeout(300);
  const rgResumed = await p.evaluate(() => __loft.range.state);
  console.log('Esc pauses a run, Resume goes on:', JSON.stringify(rgPaused), rgResumed, rgPaused.mode === 'range' && rgPaused.state === 'paused' && rgPaused.card === 'PAUSED' && rgResumed === 'play' ? 'PASS' : 'FAIL');
  // The rest of the minute goes by quickly (time handed out in steps), the result card comes and the result is kept.
  await p.evaluate(() => __loft.range.film(true));
  for (let i = 0; i < 400 && await p.evaluate(() => __loft.range.state) === 'play'; i++) await p.evaluate(() => new Promise(r => { __loft.range.advance(0.5); requestAnimationFrame(() => requestAnimationFrame(r)); }));
  await p.evaluate(() => __loft.range.film(false));
  const rgOver = await p.evaluate(() => ({ state: __loft.range.state, card: document.querySelector('.rg-card .rg-num')?.textContent, kept: __loft.progress.rangeScore('warmup', 'normal'), stars: (__loft.progress.rangeBest().warmup || {}).normal }));
  console.log('the run ends with a result that is kept:', JSON.stringify(rgOver), rgOver.state === 'over' && +rgOver.card >= rgMid.score && rgOver.kept === +rgOver.card && Number.isInteger(rgOver.stars) ? 'PASS' : 'FAIL');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  const afterRange = await p.evaluate(() => ({ mode: __loft.mode, hud: !!document.querySelector('.rg'), fov: __loft.camera.fov, shown: __loft.headVisible }));
  console.log('Esc from the card leaves the range:', JSON.stringify(afterRange), afterRange.mode === 'walk' && !afterRange.hud && afterRange.shown ? 'PASS' : 'FAIL');
  // Leaving sets me down clear of the bench and the crates: I can walk straight off.
  await p.waitForTimeout(400);
  const rgExitAt = await p.evaluate(() => [__loft.pos.x, -__loft.pos.z]);
  await p.keyboard.down('KeyS'); await p.waitForTimeout(700); await p.keyboard.up('KeyS');
  const rgWalked = await p.evaluate(a => Math.hypot(__loft.pos.x - a[0], -__loft.pos.z - a[1]), rgExitAt);
  console.log('out of the range I stand clear and can walk off:', rgExitAt.map(v => v.toFixed(2)).join(', '), 'then', rgWalked.toFixed(2), 'm', rgWalked > 0.5 ? 'PASS' : 'FAIL');

  // A second visit, with the real mouse and keys. Time is handed out in steps so nothing moves between the aim and
  // the shot: the right button raises the sights, a click fires, and a shot into a walker's chest counts as its body
  // (it is seen side on, with an arm always in front; the arm must not take the hit). R reloads; Ctrl+R is left to
  // the browser; a key held when the run is paused is not still held when it goes on.
  await spot('range');
  await p.evaluate(() => __loft.act('range')); await p.waitForTimeout(900);
  await p.evaluate(() => __loft.range.start('walkers', 'normal', 7));
  await p.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 20000 });
  await p.evaluate(() => __loft.range.film(true));
  const rgStepBy = (dt, n = 1) => p.evaluate(async ([d, k]) => { for (let i = 0; i < k; i++) { __loft.range.advance(d); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } }, [dt, n]);
  // On to the first walker, then three seconds more so it is out from behind the fins.
  for (let i = 0; i < 300 && !(await p.evaluate(() => __loft.range.debug.targets.some(t => t.kind === 'walker'))); i++) await rgStepBy(0.1);
  await rgStepBy(0.1, 30);
  await p.mouse.move(700, 410);
  await p.mouse.down({ button: 'right' });
  await rgStepBy(0.05, 8);
  const rgWid = await p.evaluate(() => (__loft.range.debug.targets.find(t => t.kind === 'walker') || {}).id);
  const rgHp0 = await p.evaluate(id => __loft.range.debug.run.live.get(id)?.hp, rgWid);
  await p.evaluate(id => __loft.range.aimAtTarget(id, 'body'), rgWid);
  await p.mouse.down();
  await rgStepBy(0.01, 4);
  await p.mouse.up();
  await p.mouse.up({ button: 'right' });
  const rgShot1 = await p.evaluate(id => ({ hp: __loft.range.debug.run.live.get(id)?.hp, shots: __loft.range.debug.run.shots, aim: __loft.range.debug.aim }), rgWid);
  console.log('a real click fires down the sights; a walker\'s chest is its body:', rgHp0, '->', rgShot1.hp, 'shots', rgShot1.shots, 'aimed', rgShot1.aim.toFixed(2), rgShot1.shots === 1 && rgShot1.aim > 0.9 && rgHp0 - rgShot1.hp === 34 ? 'PASS' : 'FAIL');
  await p.keyboard.down('KeyR'); await rgStepBy(0.02, 2); await p.keyboard.up('KeyR');
  const rgReloading = await p.evaluate(() => __loft.range.debug.weapon.phase);
  const rgBrowsers = await p.evaluate(() => __loft.range.key({ code: 'KeyR', ctrlKey: true }, true));
  console.log('R reloads, Ctrl+R is left to the browser:', rgReloading, rgBrowsers, rgReloading === 'reload' && rgBrowsers === false ? 'PASS' : 'FAIL');
  await p.evaluate(() => __loft.range.film(false));
  await p.evaluate(() => __loft.range.press('right', true));
  await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.click('.rg-card .rg-acts button.go'); await p.waitForTimeout(250);
  const rgAlong0 = await p.evaluate(() => __loft.range.debug.along);
  await p.waitForTimeout(500);
  const rgAlong1 = await p.evaluate(() => __loft.range.debug.along);
  console.log('a key held into the pause is let go:', rgAlong0.toFixed(2), rgAlong1.toFixed(2), Math.abs(rgAlong1 - rgAlong0) < 0.02 && Math.abs(rgAlong0) > 0.1 ? 'PASS' : 'FAIL');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  const rgGone = await p.evaluate(() => ({ mode: __loft.mode, hud: !!document.querySelector('.rg') }));
  console.log('Esc twice from a run: the pause, then out:', JSON.stringify(rgGone), rgGone.mode === 'walk' && !rgGone.hud ? 'PASS' : 'FAIL');

  // Nothing shows through round the front door: looking straight at each edge of it from inside, with the house
  // drawn alone on a marker colour, no marker shows (there used to be a slit down each side and one over the top).
  const slits = await p.evaluate(async () => {
    const THREE = await import('three');
    const L = __loft, r = L.renderer, gl = r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha(), vis = L.me.root.visible;
    const c = L.camera.clone(); c.fov = 14; c.near = 0.05; c.updateProjectionMatrix();
    const px = new Uint8Array(w * h * 4), out = [];
    r.setClearColor(0xff00ff, 1); L.me.root.visible = false;
    // Room coordinates (x east, y north, z up): the west edge, the east edge and the top of the opening.
    for (const [x, z] of [[2.01, 1.2], [3.09, 1.2], [2.55, 2.18], [2.03, 0.4], [3.07, 1.9]]) {
      c.position.set(x, z, -1.0); c.lookAt(x, z, 1.0);
      r.render(L.scene, c);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] > 250 && px[i + 1] < 5 && px[i + 2] > 250) n++;
      out.push(n);
    }
    r.setClearColor(clear, alpha); L.me.root.visible = vis;
    return out;
  });
  console.log('nothing shows through round the front door (marker pixels at 5 edges):', slits.join(' '), slits.every(n => n === 0) ? 'PASS' : 'FAIL');

  // The telescope: aim at the Death Star, zoom in, hold it, and it is spotted.
  await spot('telescope');
  await p.evaluate(() => __loft.act('telescope')); await p.waitForTimeout(600);
  // Nothing of the balcony shows through the eyepiece: with the house drawn alone on a marker colour, the view is
  // all marker when level and low, to either side and looking up (the telescope's own tube used to fill it). The
  // last view looks up on the side away from the Death Star, which is drawn in the house's scene too.
  const own = [];
  const away = await p.evaluate(() => (__loft.out3d && __loft.out3d.deathStar && __loft.out3d.deathStar.x > 0 ? -1 : 1));
  for (const [dx, dy] of [[0, -1], [0.35, 0], [-0.7, 0], [0.35 + away * 0.6, 0.35]]) {
    await p.evaluate(([x, y]) => __loft.scope.nudge(x, y), [dx, dy]); await p.waitForTimeout(250);
    own.push(await p.evaluate(async () => {
      const THREE = await import('three');
      const L = __loft, r = L.renderer, gl = r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha();
      r.setClearColor(0xff00ff, 1); r.render(L.scene, L.camera);
      const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      r.setClearColor(clear, alpha);
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 250 || px[i + 1] > 5 || px[i + 2] < 250) n++;
      return +(n / (w * h) * 100).toFixed(2);
    }));
  }
  const nearBack = await p.evaluate(() => __loft.camera.near);
  // Back to where the eyepiece starts (level, pitch 0.15), which the aiming below counts from.
  await p.evaluate(a => __loft.scope.nudge(-a * 0.6, -0.15), away);
  console.log('telescope sees none of the balcony (% of the view):', own.join(' '), '| near plane', nearBack, own.every(v => v < 0.2) && nearBack >= 2 ? 'PASS' : 'FAIL');
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
  const fovBack = await p.evaluate(() => [__loft.mode, __loft.camera.fov, __loft.camera.near]);
  console.log('telescope aimed at', JSON.stringify(aimed), 'spotted', spotted, '| back to', fovBack.slice(0, 2).join(' fov '), 'near', fovBack[2], spotted && fovBack[0] === 'walk' && fovBack[1] > 40 && fovBack[2] < 0.1 ? 'PASS' : 'FAIL');

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

  // On a phone the monitor does not fit the view, so the desktop fills the view instead and stays inside it.
  const pp = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  pp.on('pageerror', e => errs.push('phone: ' + e.message));
  await pp.goto(URL);
  await pp.waitForFunction(() => !!window.__loft, null, { timeout: 120000 });
  await pp.evaluate(() => __loft.useDesk()); await pp.waitForTimeout(3000);
  const ph = await pp.evaluate(() => { const el = document.querySelector('.dt.on.narrow'); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight, document.querySelectorAll('.dt-win').length]; });
  await pp.close();
  console.log('phone desktop fills the view:', ph ? ph.map(n => Math.round(n)).join(' ') : 'not shown', ph && ph[0] >= 0 && ph[2] <= ph[4] && ph[1] >= 0 && ph[3] <= ph[5] && ph[6] === 1 ? 'PASS' : 'FAIL');

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
