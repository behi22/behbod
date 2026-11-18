// The gunsmith on desktop and phone. LOFT_URL=http://127.0.0.1:8814 node test/smith.js [outdir]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/smith';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const NAMES = { pistol: 'P-22', smg: 'Vesper', rifle: 'Keeper', sniper: 'Longview', lmg: 'Gatekeeper' };

function watch(p, errs, files) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { const m = /assets\/range\/(\w+)\.glb/.exec(r.url()); if (m) files.push(m[1]); if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  // The run's music streams, and a stream cut off by leaving or reloading the page is no fault (as test/room.js has it).
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url()) && !/run\.mp3/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if ((m.type() === 'error' || (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text()))) && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200)); });
}
async function open(b, opts, query = '?auto&allguns&gunsmith') {
  const p = await b.newPage(opts), errs = [], files = [];
  watch(p, errs, files);
  await p.addInitScript(() => { window.__heard = { shots: [], cues: [] }; });
  await p.goto(`${BASE}/${query}&q=${opts.isMobile ? 'medium' : 'ultra'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('snd').click());
  await p.evaluate(() => __loft.range.load());
  await p.evaluate(() => {
    const sfx = __loft.audio.sfx, shot = sfx.gunShot, cue = sfx.gunCue;
    sfx.gunShot = (l, id) => { __heard.shots.push([id, l]); return shot(l, id); };
    sfx.gunCue = (n, id) => { __heard.cues.push(`${id}:${n}`); return cue(n, id); };
  });
  return { p, errs, files };
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
const cardButton = (p, label) => p.evaluate(l => { const b = [...document.querySelectorAll('.rg-acts button')].find(x => x.textContent === l); if (b) b.click(); return !!b; }, label);
const toGun = async (p, id) => {
  await p.evaluate(n => [...document.querySelectorAll('.gs-guns button')].find(x => x.textContent === n)?.click(), NAMES[id]);
  await p.waitForFunction(id => __loft.range.bench.gun?.id === id, id, { timeout: 40000 });
};
const run = (p, sec) => p.evaluate(async n => { for (let i = 0; i < n; i++) { __loft.range.advance(1 / 60); await new Promise(r => requestAnimationFrame(r)); } }, Math.round(sec * 60));
const tap = (p, name) => p.evaluate(async n => { __loft.range.press(n, true); __loft.range.advance(1 / 60); await new Promise(r => requestAnimationFrame(r)); __loft.range.press(n, false); }, name);
// What is on the gun in the hand, read from the gun itself.
const onGun = p => p.evaluate(() => {
  const g = __loft.range.gun, seen = n => { const o = g.model.getObjectByName(n); if (!o) return false; for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
  const pre = g.spec.prefix;
  return {
    id: g.id, light: !!g.lens, optic: g.optic, muzzle: g.anchor.muzzle.name, charm: g.charm,
    pieces: [g.spec.kit?.light || 'KIT_light', `KIT_sup_${g.id}`, 'KIT_holo', g.spec.kit?.scope || 'KIT_scope', 'KIT_riser'].filter(seen).concat(['light', 'suppressor', 'holo', 'scope'].filter(a => seen(`${pre}_att_${a}`))),
    rear: g.model.getObjectByName(`${pre}_rear`)?.visible,
    painted: Object.values(g.mats).flatMap(s => [...s]).filter(m => m.map && m.map.image?.width > 1).length,
    inHand: g.model.parent?.parent?.parent === g.camera,
  };
});

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- desktop ----------
    const { p, errs, files } = await open(b, { viewport: { width: 1280, height: 800 } });
    await p.evaluate(() => localStorage.removeItem('loft.range.kit'));
    check('only the pistol is fetched with the range, no attachment kit yet', JSON.stringify(files) === '["p22"]', JSON.stringify(files));
    await toLine(p);
    const btns = await p.evaluate(() => [...document.querySelectorAll('.rg-acts button')].map(x => x.textContent));
    check('with ?gunsmith the stage card offers the bench', btns.join() === 'Start,Gunsmith,Leave', btns.join());
    await cardButton(p, 'Gunsmith');
    await p.waitForTimeout(1200);
    const opened = await p.evaluate(() => ({ open: __loft.range.bench?.open, state: __loft.range.state, mask: __loft.camera.layers.mask, card: !!document.querySelector('.rg-card'), gs: !!document.querySelector('.gs') }));
    check('the bench opens on the gun in the hand, the stage card gone', opened.open && opened.state === 'smith' && !opened.card && opened.gs, JSON.stringify(opened));
    check('the house is not drawn behind the bench', opened.mask === 0);
    await p.waitForFunction(() => performance.getEntriesByType('resource').some(r => /kit\.glb/.test(r.name)), null, { timeout: 30000 });
    check('the attachment kit is fetched when the bench opens', true);
    await p.screenshot({ path: `${OUT}/bench-pistol.png` });
    const slots = await p.evaluate(() => [...document.querySelectorAll('.gs-slot small')].map(x => x.textContent));
    check('six slots: muzzle, optic, rail, magazine, camo, charm', slots.join() === 'Muzzle,Optic,Rail,Magazine,Camo,Charm', slots.join());
    const keyed = await p.evaluate(() => Object.fromEntries([['Ctrl+R', { code: 'KeyR', key: 'r', ctrlKey: true }], ['F5', { code: 'F5', key: 'F5' }], ['Tab', { code: 'Tab', key: 'Tab' }], ['2', { code: 'Digit2', key: '2' }]].map(([n, o]) => {
      const e = new KeyboardEvent('keydown', { ...o, bubbles: true, cancelable: true }); dispatchEvent(e); dispatchEvent(new KeyboardEvent('keyup', { ...o, bubbles: true })); return [n, e.defaultPrevented];
    })));
    await p.evaluate(() => __loft.range.bench.pick('all'));
    check('the bench takes its own keys and leaves the browser\'s alone', keyed['2'] && !keyed['Ctrl+R'] && !keyed.F5 && !keyed.Tab, JSON.stringify(keyed));

    // Turned by a drag, closer with the wheel.
    const stage = await p.evaluate(() => { const r = document.querySelector('.gs-stage').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
    check('the gun has the middle of the screen to itself', stage.w > 500 && stage.h > 400, `${Math.round(stage.w)}x${Math.round(stage.h)}`);
    const v0 = await p.evaluate(() => __loft.range.bench.view);
    await p.mouse.move(stage.x, stage.y); await p.mouse.down(); await p.mouse.move(stage.x + 160, stage.y + 40, { steps: 8 }); await p.mouse.up();
    await p.mouse.wheel(0, -500);
    await p.waitForTimeout(900);
    const v1 = await p.evaluate(() => __loft.range.bench.view);
    check('a drag turns the gun', Math.abs(v1.yaw - v0.yaw) > 0.8, `${v0.yaw.toFixed(2)} to ${v1.yaw.toFixed(2)}`);
    check('the wheel brings it closer', v1.zoom > v0.zoom * 1.4, `${v0.zoom.toFixed(2)} to ${v1.zoom.toFixed(2)}`);
    // A drag held still before letting go is no flick: the gun stays where it was left.
    await p.mouse.move(stage.x, stage.y); await p.mouse.down(); await p.mouse.move(stage.x + 120, stage.y, { steps: 6 });
    await p.waitForTimeout(700);
    const heldAt = await p.evaluate(() => __loft.range.bench.view.yaw);
    await p.mouse.up(); await p.waitForTimeout(1200);
    const leftAt = await p.evaluate(() => __loft.range.bench.view.yaw);
    check('a drag held still, then let go, does not keep turning', Math.abs(leftAt - heldAt) < 0.05, `${heldAt.toFixed(2)} to ${leftAt.toFixed(2)}`);

    // Each gun, everything on, then looked at; the numbers move the way they should.
    const KIT = [['muzzle', 'suppressor'], ['optic', 'holo'], ['rail', 'light'], ['mag', 'mag'], ['camo', 'tidepool'], ['charm', 'rivet']];
    for (const id of ['pistol', 'smg', 'rifle', 'sniper', 'lmg']) {
      if (id !== 'pistol') await toGun(p, id);
      await p.evaluate(() => __loft.range.bench.pick('muzzle'));
      await p.evaluate(() => __loft.range.bench.put('muzzle', 'suppressor'));
      const rows = await p.evaluate(() => [...document.querySelectorAll('.gs-row')].filter(r => r.classList.contains('up') || r.classList.contains('down')).map(r => r.firstChild.textContent + (r.classList.contains('up') ? '+' : '-')));
      check(`${id}: the suppressor's change shown before and after`, rows.join() === 'Damage-,Aim speed-,Recoil control+,Stealth+', rows.join());
      for (const [s, k] of KIT.slice(1)) await p.evaluate(([s, k]) => __loft.range.bench.put(s, k), [s, k]);
      await p.waitForTimeout(1500);
      const g = await onGun(p);
      const want = id === 'pistol' ? ['KIT_light_pistol', 'KIT_sup_pistol', 'holo'] : ['KIT_light', `KIT_sup_${id}`, 'KIT_holo', ...(id === 'lmg' ? ['KIT_riser'] : [])];
      check(`${id}: suppressor, holo sight, light and long magazine on, live`, want.every(n => g.pieces.includes(n)) && g.light && g.optic === 'holo' && /sup/.test(g.muzzle), JSON.stringify(g));
      check(`${id}: the camo paints it and the charm hangs`, g.painted > 0 && g.charm === 'rivet', `${g.painted} painted, ${g.charm}`);
      if (id !== 'pistol' && id !== 'lmg') check(`${id}: the rear sight folds away under the optic`, g.rear === false);
      await p.screenshot({ path: `${OUT}/bench-${id}.png` });
      await p.evaluate(() => { __loft.range.bench.put('optic', 'scope'); __loft.range.bench.pick('optic'); });
      await p.waitForTimeout(1200);
      check(`${id}: the scope swaps in for the holo sight`, (await onGun(p)).optic === 'scope');
      await p.screenshot({ path: `${OUT}/bench-${id}-scope.png` });
      await p.evaluate(() => __loft.range.bench.pick('charm'));
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${OUT}/bench-${id}-charm.png` });
    }
    // Taking a gun again must not dress it in the kit the range read before the bench opened.
    await toGun(p, 'smg'); await p.waitForTimeout(1500);
    const again = await onGun(p);
    check('a gun picked again on the bench wears what was chosen for it', again.optic === 'scope' && again.light && /sup/.test(again.muzzle) && again.charm === 'rivet', JSON.stringify(again));
    await toGun(p, 'lmg'); await p.waitForTimeout(1200);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('loft.range.kit') || '{}'));
    check('every gun\'s kit is kept in the browser', Object.keys(saved).length === 5 && saved.sniper.att.includes('scope') && saved.lmg.charm === 'rivet', JSON.stringify(saved.sniper));
    const gold = await p.evaluate(() => { __loft.range.bench.pick('camo'); return [...document.querySelectorAll('.gs-opt')].find(x => x.textContent.startsWith('Gold'))?.disabled; });
    check('a finish earned with stars is shut until they are earned', gold === true);

    // Back to the line with the Gatekeeper: the bench hands the gun back with its kit, its charm hanging, not whirling.
    const whirl = await p.evaluate(async () => {
      const c = __loft.range.gun.hook.children[0], V = c.position.constructor, Q = c.quaternion.constructor, down = () => new V(0, -1, 0).applyQuaternion(c.getWorldQuaternion(new Q()));
      let last = down(), most = 0;
      document.querySelector('.gs-done').click();
      for (let i = 0; i < 20; i++) { await new Promise(r => requestAnimationFrame(r)); const now = down(); most = Math.max(most, now.angleTo(last)); last = now; }
      return Math.round(most * 180 / Math.PI);
    });
    check('the charm comes back to the hand hanging, without a whirl', whirl < 60, `${whirl} degrees in one frame`);
    await p.waitForTimeout(800);
    const back = await p.evaluate(() => ({ state: __loft.range.state, mask: __loft.camera.layers.mask, held: __loft.range.held, mag: __loft.range.debug.stats.mag, sup: __loft.range.debug.stats.suppressed, card: !!document.querySelector('.rg-card') }));
    check('Done hands the gun back: the stage card again, the house drawn again', back.state === 'menu' && back.mask === 1 && back.card, JSON.stringify(back));
    check('the gun in the hand carries the kit: the bigger box, the suppressor', back.held === 'lmg' && back.mag === 150 && back.sup === true, JSON.stringify(back));
    check('the gun is back in the hand', (await onGun(p)).inHand);

    // A run with the Gatekeeper: quiet shots from the suppressor's end, the light on L, the scope's picture.
    await p.evaluate(() => { __loft.range.film(true); __loft.range.start('warmup', 'easy', 7); });
    await run(p, 3);
    await tap(p, 'fire'); await run(p, 0.2);
    const shots = await p.evaluate(() => __heard.shots.slice());
    check('a suppressed shot is the quiet one', shots.length > 0 && shots.every(([, l]) => l < 0.5), JSON.stringify(shots.slice(0, 3)));
    await p.keyboard.down('KeyL'); await p.keyboard.up('KeyL'); await run(p, 0.2);
    const lamp = await p.evaluate(() => { const f = __loft.range.flashlight, l = f.lamps[0]; return { on: f.on, from: l.position.distanceTo(__loft.camera.position) }; });
    check('L switches the rail light on, shining from the gun', lamp.on && lamp.from > 0.1 && lamp.from < 1.3, JSON.stringify(lamp));
    await p.evaluate(() => __loft.range.press('aim', true)); await run(p, 1.2);
    const scoped = await p.evaluate(() => ({ k: __loft.range.gun.scoped, shown: getComputedStyle(document.querySelector('.rg-scope')).opacity, rig: __loft.range.gun.camera.children[0].visible, fov: __loft.camera.fov }));
    check('aimed through the scope: its round picture, the gun out of the way, the view magnified', scoped.k > 0.98 && +scoped.shown > 0.9 && !scoped.rig && scoped.fov < 20, JSON.stringify(scoped));
    await p.screenshot({ path: `${OUT}/run-lmg-scoped.png` });
    await p.evaluate(() => __loft.range.press('aim', false)); await run(p, 0.8);
    check('the scope\'s picture goes when the aim comes down', +(await p.evaluate(() => getComputedStyle(document.querySelector('.rg-scope')).opacity)) < 0.05);
    // The bigger box empties and reloads in step.
    await p.evaluate(() => __loft.range.press('fire', true)); await run(p, 14); await p.evaluate(() => __loft.range.press('fire', false));
    await run(p, 6);
    const after = await p.evaluate(() => ({ ammo: __loft.range.debug.weapon.ammo, cues: __heard.cues.filter(c => c.startsWith('lmg:')).map(c => c.slice(4)) }));
    check('the 150-round box fires out and reloads full, every move heard', after.ammo === 150 && ['coverOpen', 'magOut', 'magIn', 'beltIn', 'coverClose'].every(c => after.cues.includes(c)), JSON.stringify(after));
    await p.screenshot({ path: `${OUT}/run-lmg.png` });
    // Lights out: the light stays on whatever L says.
    await p.evaluate(() => __loft.range.start('dark', 'easy', 7)); await run(p, 4);
    await p.keyboard.down('KeyL'); await p.keyboard.up('KeyL'); await run(p, 0.3);
    const dark = await p.evaluate(() => ({ state: __loft.range.state, on: __loft.range.flashlight.on }));
    check('in the dark stage L leaves the rail light on', dark.state === 'play' && dark.on, JSON.stringify(dark));
    await p.evaluate(() => __loft.range.film(false));
    check('no errors on the desktop', errs.length === 0, errs.join(' | '));
    // The page loaded again keeps every gun's kit, and the range reads it back.
    await p.reload();
    await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
    await p.evaluate(() => __loft.range.load());
    const kept = await p.evaluate(() => __loft.range.kit('smg'));
    check('the kit is still there after a reload', kept.camo === 'tidepool' && kept.att.length === 4 && kept.charm === 'rivet', JSON.stringify(kept));
    check('no errors after the reload', errs.length === 0, errs.join(' | '));
    await p.close();

    // ---------- the bench in the loadout room ----------
    const L = await open(b, { viewport: { width: 1280, height: 800 } }, '?auto&allguns');
    await L.p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
    await L.p.waitForTimeout(1500);
    const spot = await L.p.evaluate(() => __loft.range.spots.find(s => s.id === 'rg_bench').at);
    await L.p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...spot));
    await L.p.waitForTimeout(400);
    check('standing at the gunsmith bench, it is the thing to press E at', await L.p.evaluate(() => __loft.near === 'rg_bench'));
    await L.p.waitForFunction(() => __loft.range.display?.group.visible && __loft.range.display.bench?.visible, null, { timeout: 30000 });
    const shown = await L.p.evaluate(() => ({ pieces: __loft.range.display.group.children.length, gun: __loft.range.display.bench.visible }));
    check('the board, rack and pegs dressed, the gun in the hand on the bench', shown.pieces === 15 && shown.gun, JSON.stringify(shown));
    const said = await L.p.evaluate(() => { __loft.act('rg_attach'); return document.getElementById('toast')?.textContent || ''; });
    check('the board no longer promises things to come', /gunsmith bench/.test(said) && !/once|soon|go up here/i.test(said), said);
    await L.p.evaluate(() => { __loft.yaw = Math.PI / 2; }); await L.p.waitForTimeout(800);
    const lookOf = () => L.p.evaluate(() => __loft.camera.getWorldDirection(__loft.camera.position.clone()).toArray());
    const looked = await lookOf();
    await L.p.evaluate(() => __loft.act('rg_bench'));
    await L.p.waitForTimeout(1200);
    const inBench = await L.p.evaluate(() => ({ open: __loft.range.bench?.open, state: __loft.range.state, mask: __loft.camera.layers.mask, card: !!document.querySelector('.rg-card') }));
    check('E at the bench opens the gunsmith straight away', inBench.open && inBench.state === 'smith' && inBench.mask === 0 && !inBench.card, JSON.stringify(inBench));
    await L.p.evaluate(() => { __loft.range.bench.put('optic', 'holo'); __loft.range.bench.put('camo', 'candy'); __loft.range.bench.put('charm', 'cat'); });
    await L.p.waitForTimeout(1200);
    await L.p.evaluate(() => document.querySelector('.gs-done').click());
    await L.p.waitForTimeout(1500);
    const backHome = await L.p.evaluate(v => ({ active: __loft.range.active, mask: __loft.camera.layers.mask, off: Math.hypot(__loft.pos.x - v.x, __loft.pos.z - v.z), near: __loft.near }), b2t(...spot));
    check('Done brings you back to the bench, walking', !backHome.active && backHome.mask === 1 && backHome.off < 0.3, JSON.stringify(backHome));
    const lookedAfter = await lookOf(), turned = Math.acos(Math.min(1, looked.reduce((s, v, i) => s + v * lookedAfter[i], 0)));
    check('and facing the way you were', turned < 0.1, `${turned.toFixed(2)} rad`);
    await L.p.waitForTimeout(1500);
    check('the gun on the bench now wears what was chosen', await L.p.evaluate(() => { let holo = false; __loft.range.display.bench.traverse(o => { if (o.name === 'P22_att_holo' && o.visible) holo = true; }); return holo; }));
    // A look at the room from the firing line.
    await L.p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...(await L.p.evaluate(() => __loft.meta.interact.find(i => i.id === 'range').at))));
    await L.p.waitForTimeout(400);
    await L.p.evaluate(() => __loft.act('range'));
    await L.p.waitForTimeout(1500);
    const places = await L.p.evaluate(() => __loft.range.loadout.places);
    for (const [name, at] of [['board', places.attachments[1]], ['rack', places.camos[1]], ['bench', places.bench]]) {
      await L.p.evaluate(a => __loft.range.lookAt(a[0], a[1], a[2]), at);
      await L.p.waitForTimeout(700);
      await L.p.screenshot({ path: `${OUT}/loadout-${name}.png` });
    }
    check('no errors in the loadout room', L.errs.length === 0, L.errs.join(' | '));
    await L.p.close();

    // ---------- phones, upright and sideways ----------
    for (const [w, h] of [[390, 844], [844, 390]]) {
      const m = await open(b, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await toLine(m.p);
      await cardButton(m.p, 'Gunsmith');
      await m.p.waitForTimeout(1500);
      await m.p.evaluate(() => { __loft.range.bench.pick('rail'); __loft.range.bench.put('rail', 'light'); });
      await m.p.waitForTimeout(800);
      const lay = await m.p.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect(), all = ['.gs-head', '.gs-stage', '.gs-slots', '.gs-opts', '.gs-stats'].map(s => [s, r(s)]);
        return { off: all.filter(([, b]) => b.left < -1 || b.right > innerWidth + 1 || b.top < -1 || b.bottom > innerHeight + 1).map(([s]) => s), stage: [r('.gs-stage').width, r('.gs-stage').height], scroll: document.documentElement.scrollWidth > innerWidth };
      });
      check(`${w}x${h}: the bench fits the screen, the gun has room`, !lay.off.length && !lay.scroll && lay.stage[0] > 150 && lay.stage[1] > 150, JSON.stringify(lay));
      await m.p.screenshot({ path: `${OUT}/phone-${w}x${h}.png` });
      // A one-finger drag turns it.
      const s0 = await m.p.evaluate(() => __loft.range.bench.view.yaw);
      const c = await m.p.evaluate(() => { const r = document.querySelector('.gs-stage').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const cdp = await m.p.context().newCDPSession(m.p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1] }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c[0] + i * 15, y: c[1] }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await m.p.waitForTimeout(700);
      check(`${w}x${h}: a finger turns the gun`, Math.abs((await m.p.evaluate(() => __loft.range.bench.view.yaw)) - s0) > 0.4);
      await m.p.evaluate(() => document.querySelector('.gs-done').click());
      await m.p.waitForTimeout(800);
      await m.p.evaluate(() => [...document.querySelectorAll('.rg-acts button')].find(x => x.textContent === 'Start').click());
      await m.p.waitForTimeout(400);
      check(`${w}x${h}: with the light fitted, a LIGHT pad`, await m.p.evaluate(() => !!document.querySelector('.rg-lite')));
      await m.p.screenshot({ path: `${OUT}/phone-run-${w}x${h}.png` });
      // The pad lit only while the light is on: switched on, then a new run (which starts with it off).
      const padNow = () => m.p.evaluate(() => ({ pad: document.querySelector('.rg-lite')?.classList.contains('on'), on: __loft.range.flashlight.on }));
      await m.p.evaluate(() => document.querySelector('.rg-lite').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
      await m.p.waitForTimeout(200);
      const lit = await padNow();
      await m.p.evaluate(() => __loft.range.escape()); await m.p.waitForTimeout(200);
      await m.p.evaluate(() => [...document.querySelectorAll('.rg-acts button')].find(x => x.textContent === 'Stages').click()); await m.p.waitForTimeout(200);
      await m.p.evaluate(() => [...document.querySelectorAll('.rg-acts button')].find(x => x.textContent === 'Start').click()); await m.p.waitForTimeout(400);
      const fresh = await padNow();
      check(`${w}x${h}: the LIGHT pad shows the light as it is`, lit.pad && lit.on && fresh.pad === fresh.on, JSON.stringify([lit, fresh]));
      check(`${w}x${h}: no errors`, m.errs.length === 0, m.errs.join(' | '));
      await m.p.close();
    }
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'all pass');
  process.exitCode = fails ? 1 : 0;
})();
