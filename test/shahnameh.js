// The Shahnameh pieces on the computer and around the house, in a real Chrome at a desk and on phones: Ferdowsi's
// note on the monitor, the terminal's ferdowsi and nowruz, the plaques by the holochess and backgammon tables, the
// reader app, the wallpapers, Haft Khan in the Games app, and BH-22's stories by the fire.
//   LOFT_URL=http://127.0.0.1:8814 node test/shahnameh.js [outdir] [only]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/shahnameh';
const ONLY = process.argv[3] || 'all';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const URL = BASE + '/?auto&q=low';
const results = [], errs = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${name}: ${detail} ${ok ? 'PASS' : 'FAIL'}`); };
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;

function watch(p, tag) {
  p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(`${tag}: ${m.text().slice(0, 160)}`); });
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`${tag}: http ${r.status()} ${r.url().slice(0, 120)}`); });
}
async function open(b, ctxOpts, tag) {
  const ctx = await b.newContext(ctxOpts), p = await ctx.newPage();
  watch(p, tag);
  await p.goto(URL);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.evaluate(() => { const g = document.getElementById('gate'); if (g) g.style.display = 'none'; });
  await p.waitForTimeout(800);
  return { ctx, p };
}
const sit = async p => { await p.evaluate(() => __loft.useDesk()); await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 }); await p.waitForTimeout(700); };
const toast = p => p.evaluate(() => document.getElementById('toast').textContent);
// Where a named mesh's middle lands on the screen, and what the page has on top there.
const onScreen = (p, name) => p.evaluate(n => {
  let o = __loft.scene.getObjectByName(n);
  if (o && !o.geometry) o.traverse(c => { if (!o.geometry && c.geometry) o = c; });
  if (!o) return null;
  o.updateWorldMatrix(true, false);
  o.geometry.computeBoundingBox();
  const c = o.geometry.boundingBox.getCenter(o.position.clone()).applyMatrix4(o.matrixWorld).project(__loft.camera);
  const x = (c.x + 1) / 2 * innerWidth, y = (1 - c.y) / 2 * innerHeight, top = document.elementFromPoint(x, y);
  return { x, y, z: c.z, top: top ? top.tagName + (top.className ? '.' + String(top.className).split(' ')[0] : '') : null };
}, name);
const type = async (p, text) => { await p.keyboard.type(text); await p.keyboard.press('Enter'); await p.waitForTimeout(150); };
const termLines = p => p.evaluate(() => __loft.screens.desktop.term.lines.slice());

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const NOTE_SAY = 'Ferdowsi, about 1010: "Whoever knows is strong; with knowledge an old heart grows young."';

  if (want('note') || want('terminal')) {
    const { ctx, p } = await open(b, DESK, 'desk');
    await sit(p);
    if (want('note')) {
      const at = await onScreen(p, 'ferdowsi_note'), tattoo = await onScreen(p, 'postit');
      check('the Ferdowsi note is on the monitor, in view and not under the desktop', at && at.z < 1 && at.x > 0 && at.x < 1280 && at.y > 0 && at.y < 800 && at.top === 'CANVAS', JSON.stringify(at));
      check('it sits beside the tattoo post-it, nearer the middle', at && tattoo && at.x < tattoo.x && tattoo.x - at.x < 200 && Math.abs(at.y - tattoo.y) < 40, `note x ${at?.x.toFixed(0)}, tattoo x ${tattoo?.x.toFixed(0)}`);
      await p.screenshot({ path: `${OUT}/note-desk.png` });
      await p.mouse.click(at.x, at.y); await p.waitForTimeout(250);
      check('a click on it gives the line in English', (await toast(p)) === NOTE_SAY, await toast(p));
    }
    if (want('terminal')) {
      await type(p, 'ferdowsi');
      let lines = await termLines(p);
      check('ferdowsi prints the couplet, its sound and its meaning', lines.includes('  توانا بود هر که دانا بود') && lines.includes('  ze danesh del-e pir borna bovad') && lines.at(-1) === '   with knowledge an old heart grows young."', lines.slice(-7).join(' | '));
      await type(p, 'nowruz');
      lines = await termLines(p);
      const nz = lines.slice(-3);
      check('nowruz counts down to the spring equinox', /^Nowruz 14\d\d begins at the spring equinox:$/.test(nz[0]) && / in Vancouver, \d\d:\d\d in Tehran\.$/.test(nz[1]) && /to go\.$/.test(nz[2]), nz.join(' | '));
      await type(p, 'help');
      lines = await termLines(p);
      const help = lines.slice(lines.lastIndexOf('$ help') + 1);
      check('help lists them, every line fitting the terminal', help.join(' ').includes('ferdowsi') && help.join(' ').includes('nowruz') && help.join(' ').includes('film') && help.every(l => l.length <= 66), help.map(l => l.length).join(' '));
      // The seated view's own lines are drawn by the page: none runs past the window's right edge.
      const over = await p.evaluate(() => { const w = document.querySelector('.dt-win[data-app="terminal"]').getBoundingClientRect(); return [...document.querySelectorAll('.dt-term div')].filter(d => { const r = document.createRange(); r.selectNodeContents(d); const q = r.getBoundingClientRect(); return q.right > w.right + 1; }).map(d => d.textContent); });
      check('no terminal line runs past its window', over.length === 0, over.join(' | ') || 'none');
      await p.screenshot({ path: `${OUT}/terminal.png` });
    }
    await ctx.close();
  }

  if (want('plaques')) {
    const { ctx, p } = await open(b, DESK, 'plaques');
    for (const [id, spot, title, game] of [['plaque_chess', [8.8, 12.05, -0.45], 'The riddle of chess', 'Play holochess'], ['plaque_nard', [15.6, 15.75, 0], "Bozorgmehr's answer", 'Play backgammon']]) {
      await p.evaluate(([x, y, z]) => { __loft.pos.set(x, z + 0.05, -y); }, spot);
      await p.waitForTimeout(1500);
      const label = await p.evaluate(() => [document.getElementById('prompt').classList.contains('on'), document.getElementById('prompt').lastChild.nodeValue]);
      check(`${id}: E reads the plaque here`, label[0] && label[1] === 'Read the plaque', label.join(' '));
      await p.keyboard.press('KeyE'); await p.waitForTimeout(250);
      const said = await toast(p);
      check(`${id}: it tells the story`, said.startsWith(title + '. ') && said.length > 150, said.slice(0, 80));
      const at = await onScreen(p, id);
      check(`${id}: the plaque is in view from there`, at && at.z < 1 && at.x > 0 && at.x < 1280 && at.y > 0 && at.y < 800, JSON.stringify(at));
      await p.screenshot({ path: `${OUT}/${id}.png` });
      // A step to the game's own spot, and the game is still the one offered there.
      const g = await p.evaluate(gl => { const it = __loft.meta.interact.find(i => i.label === gl); __loft.pos.set(it.at[0], it.at[2] + 0.05, -it.at[1]); return it.id; }, game);
      await p.waitForTimeout(900);
      const there = await p.evaluate(() => document.getElementById('prompt').lastChild.nodeValue);
      check(`${id}: the ${g} spot still offers the game`, there === game, there);
    }
    await ctx.close();
  }

  if (want('reader') || want('wallpaper')) {
    const { ctx, p } = await open(b, DESK, 'desk-apps');
    await p.evaluate(() => { try { localStorage.removeItem('home.wallpaper'); } catch (e) { /* none */ } });
    await sit(p);
    const lit = sel => p.evaluate(s => { const c = document.querySelector(s); if (!c) return 0; const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++; return n; }, sel);
    if (want('reader')) {
      await p.click('.dt-icon[aria-label="Open Shahnameh"]'); await p.waitForTimeout(400);
      const r = await p.evaluate(() => { const w = document.querySelector('.dt-win[data-app="shahnameh"]'); return w && { focus: w.classList.contains('focus'), tabs: [...w.querySelectorAll('.dt-pill')].map(b => b.textContent), title: [...w.querySelectorAll('.dt-t')].map(t => t.textContent)[0], pic: w.querySelector('canvas.dt-pic')?.getAttribute('aria-label') }; });
      check('the Shahnameh opens from the dock with its four stories', r && r.focus && r.tabs.join() === 'Zal,Seven Labours,Siavash,Sohrab' && r.title === 'Zal and the Simorgh' && /Simorgh/.test(r.pic), JSON.stringify(r));
      check('its picture is painted', (await lit('.dt-win[data-app="shahnameh"] canvas.dt-pic')) > 5000, `${await lit('.dt-win[data-app="shahnameh"] canvas.dt-pic')} lit pixels`);
      await p.screenshot({ path: `${OUT}/reader-zal.png` });
      const seen = [];
      for (const tab of ['Seven Labours', 'Siavash', 'Sohrab']) {
        await p.click(`.dt-win[data-app="shahnameh"] .dt-pill:text-is("${tab}")`); await p.waitForTimeout(300);
        seen.push(await p.evaluate(() => [...document.querySelectorAll('.dt-win[data-app="shahnameh"] .dt-t')].map(t => t.textContent)));
        await p.screenshot({ path: `${OUT}/reader-${tab.split(' ').at(-1).toLowerCase()}.png` });
      }
      check('each tab shows its story, whole on one page', seen.map(s => s[0]).join(' | ') === 'The Seven Labours of Rostam | Siavash and the Fire | Rostam and Sohrab' && seen.every(s => !s.some(t => /^page /.test(t))) && seen[2].at(-1).endsWith('and Sohrab died.'), seen.map(s => `${s[0]} (${s.length - 1} lines)`).join(', '));
      // The monitor shows the same window when I stand.
      const painted = await p.evaluate(() => __loft.screens.desktop.st.focus);
      check('the monitor has it in front', painted === 'shahnameh', painted);
    }
    if (want('wallpaper')) {
      await p.click('.dt-icon[aria-label="Open Settings"]'); await p.waitForTimeout(300);
      const before = await p.evaluate(() => getComputedStyle(document.querySelector('.dt')).backgroundImage.slice(0, 30));
      // A pixel of the monitor's own picture left of the terminal, clear of every window and the dock.
      const monitorPixel = () => [...__loft.screens.textures.main.image.getContext('2d').getImageData(20, 500, 1, 1).data.slice(0, 3)];
      const plainPx = await p.evaluate(monitorPixel);
      const pills = await p.evaluate(() => [...document.querySelectorAll('.dt-win[data-app="settings"] .dt-pill')].map(b => b.textContent).slice(-4));
      check('Settings offers the wallpapers', pills.join() === 'plain,persepolis,simorgh,isfahan', pills.join(' '));
      for (const id of ['persepolis', 'simorgh', 'isfahan']) {
        await p.click(`.dt-win[data-app="settings"] .dt-pill:text-is("${id}")`); await p.waitForTimeout(500);
        const s = await p.evaluate(() => [__loft.screens.desktop.wallpaper, getComputedStyle(document.querySelector('.dt')).backgroundImage.slice(0, 26), localStorage.getItem('home.wallpaper'), [...document.querySelectorAll('.dt-win[data-app="settings"] .dt-pill.on')].map(b => b.textContent).join()]);
        await p.waitForTimeout(700);
        const px = await p.evaluate(monitorPixel);
        check(`${id}: behind the windows, kept, lit in Settings, and on the monitor`, s[0] === id && s[1].startsWith('url("data:image/jpeg') && s[2] === id && s[3].split(',').includes(id) && px.join() !== plainPx.join(), `${s.slice(0, 3).join(' | ')} | lit ${s[3]} | monitor ${px.join(',')}`);
        await p.screenshot({ path: `${OUT}/wall-${id}.png` });
      }
      await p.click('.dt-win[data-app="settings"] .dt-pill:text-is("plain")'); await p.waitForTimeout(1200);
      const plain = await p.evaluate(() => [localStorage.getItem('home.wallpaper'), __loft.screens.desktop.wallpaperURL(), getComputedStyle(document.querySelector('.dt')).backgroundImage.slice(0, 30)]);
      const back = await p.evaluate(monitorPixel);
      check('plain goes back to the old background, on the monitor too', plain[0] === 'plain' && plain[1] === null && before.startsWith('radial-gradient') && plain[2] === before && back.every((v, i) => Math.abs(v - plainPx[i]) <= 3), `${before} | ${plain.join(' ')} | monitor ${back.join(',')} was ${plainPx.join(',')}`);
    }
    await ctx.close();
  }

  if (want('haftkhan')) {
    const { ctx, p } = await open(b, DESK, 'haftkhan');
    await p.evaluate(() => { try { localStorage.removeItem('home.games'); } catch (e) { /* none */ } });
    await sit(p);
    await p.click('.dt-icon[aria-label="Open Games"]'); await p.waitForTimeout(400);
    const L = await p.evaluate(() => { const w = document.querySelector('.dt-win[data-app="games"]'), q = w.getBoundingClientRect(); return { cards: w.querySelectorAll('.dt-card').length, pics: w.querySelectorAll('canvas.dt-pic').length, buttons: [...w.querySelectorAll('.dt-pill')].map(b => b.textContent).join(), fit: [...w.querySelectorAll('.dt-pill, .dt-card')].every(e => { const r = e.getBoundingClientRect(); return r.left >= q.left - 1 && r.right <= q.right + 1 && r.bottom <= q.bottom + 1; }), titles: [...w.querySelectorAll('.dt-t')].map(t => t.textContent).filter(t => /Haft|Paddle|Orbit|Bug/.test(t)).join() }; });
    check('the Games app: four cards side by side, Haft Khan the fourth', L.cards === 4 && L.pics === 4 && L.buttons === 'Easy,Normal,Hard,Play,Play,Play' && L.fit && L.titles === 'Paddle Duel,Orbit,Bug Hunt,Haft Khan', JSON.stringify(L));
    await p.screenshot({ path: `${OUT}/games-launcher.png` });
    await p.click('.dt-win[data-app="games"] .dt-pill:text-is("Play") >> nth=2'); await p.waitForSelector('canvas.dt-game'); await p.waitForTimeout(300);
    const G = fn => p.evaluate(fn);
    check('Haft Khan starts on the first labour, its words shown', await G(() => { const g = __loft.screens.desktop.games.playing; return g.id === 'haftkhan' && g.st.phase === 'intro' && g.st.labour === 0; }), await G(() => __loft.screens.desktop.games.status()));
    await p.screenshot({ path: `${OUT}/khan-intro.png` });
    // Space skips the words; then the lion, held in the ring, is struck by Space, by a click on the picture, and by Enter.
    await p.waitForTimeout(500); await p.keyboard.press('Space'); await p.waitForTimeout(150);
    const ring = () => G(() => { const r = __loft.screens.desktop.games.playing.st.r; Object.assign(r, { x: 280, wait: 0, cool: 0, speed: 0 }); });
    await ring(); await p.keyboard.press('Space'); await p.waitForTimeout(120);
    await ring();
    const box = await p.evaluate(() => { const r = document.querySelector('canvas.dt-game').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.9]; });
    await p.mouse.click(box[0], box[1]); await p.waitForTimeout(120);
    await ring(); await p.screenshot({ path: `${OUT}/khan-lion.png` }); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    const lion = await G(() => { const g = __loft.screens.desktop.games.playing; return [g.st.phase, g.st.labour, g.st.score, __loft.screens.desktop.term.input, __loft.mode]; });
    check('Space, a click and Enter each strike the lion once; the third drives it off; nothing leaks to the terminal', lion[0] === 'won' && lion[2] >= 100 && lion[3] === '' && lion[4] === 'desk', lion.join(' | '));
    // On into the desert: the mouse walks Rostam after the ram.
    await p.waitForFunction(() => __loft.screens.desktop.games.playing.st.labour === 1, null, { timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(600); await p.keyboard.press('Space');
    await p.waitForFunction(() => __loft.screens.desktop.games.playing.st.phase === 'play', null, { timeout: 3000 }).catch(() => {});
    const x0 = await G(() => __loft.screens.desktop.games.playing.st.r.rx);
    const area = await p.evaluate(() => { const r = document.querySelector('canvas.dt-game').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const k = Math.min(area[2] / 720, area[3] / 420), ox = area[0] + (area[2] - 720 * k) / 2, oy = area[1] + (area[3] - 420 * k) / 2;
    await p.mouse.move(ox + 620 * k, oy + 380 * k); await p.waitForTimeout(1500);
    const x1 = await G(() => __loft.screens.desktop.games.playing.st.r.rx);
    check('the desert: Rostam walks to the mouse', x1 - x0 > 150 && Math.abs(x1 - 620) < 40, `${x0.toFixed(0)} -> ${x1.toFixed(0)}`);
    await p.screenshot({ path: `${OUT}/khan-desert.png` });
    // Every labour's picture, one after another, and the end: lives run out, the score is kept as the best.
    for (let i = 2; i < 7; i++) {
      await p.evaluate(n => { const st = __loft.screens.desktop.games.playing.st; st.labour = n - 1; st.phase = 'won'; st.t = 9; }, i);
      await p.waitForTimeout(650); await p.keyboard.press('Space'); await p.waitForTimeout(500);
      const now = await G(() => [__loft.screens.desktop.games.playing.st.labour, __loft.screens.desktop.games.playing.st.phase]);
      if (now[0] !== i || now[1] !== 'play') check(`labour ${i + 1} opens`, false, now.join(' '));
      await p.screenshot({ path: `${OUT}/khan-${i + 1}.png` });
    }
    await G(() => { const st = __loft.screens.desktop.games.playing.st; st.lives = 1; st.score = 333; st.r.rock = { x: st.r.rx, t: 0.84 }; st.r.open = 0; });
    await p.waitForFunction(() => __loft.screens.desktop.games.playing.done, null, { timeout: 3000 }).catch(() => {});
    const end = await G(() => [__loft.screens.desktop.games.playing.note, __loft.screens.desktop.games.playing.record, localStorage.getItem('home.games')]);
    check('out of lives: Rostam rests, a new best kept in the browser', end[0] === 'Rostam rests' && end[1] === true && JSON.parse(end[2] || '{}').haftkhan === 333, end.join(' | '));
    await p.screenshot({ path: `${OUT}/khan-end.png` });
    await p.click('.dt-win[data-app="games"] .dt-pill:text-is("← Games")'); await p.waitForTimeout(300);
    const best = await G(() => [...document.querySelectorAll('.dt-win[data-app="games"] .dt-t')].map(t => t.textContent).filter(s => /^best score|^no best/.test(s)).join());
    check('its card shows the best', best.split(',').includes('best score 333'), best);
    await ctx.close();
  }

  for (const [tag, opts] of [['upright', UPRIGHT], ['sideways', SIDEWAYS]]) {
    if (!want('phone')) break;
    const { ctx, p } = await open(b, opts, tag);
    await sit(p);
    await p.evaluate(() => { const i = document.getElementById('cmd'); i.focus(); });
    for (const c of ['ferdowsi', 'nowruz']) { await p.keyboard.type(c); await p.keyboard.press('Enter'); await p.waitForTimeout(200); }
    const lines = await termLines(p);
    check(`${tag}: ferdowsi and nowruz from the phone's command box`, lines.includes('$ ferdowsi') && lines.includes('$ nowruz') && lines.some(l => l.startsWith('Nowruz 14')), lines.slice(-4).join(' | '));
    await p.screenshot({ path: `${OUT}/${tag}-terminal.png` });
    // The reader on a phone: the window in front fills the space, the story runs on under its picture and scrolls,
    // and a new story starts at the top.
    await p.evaluate(() => document.activeElement?.blur());
    await p.tap('.dt-icon[aria-label="Open Shahnameh"]'); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const w = document.querySelector('.dt-win[data-app="shahnameh"]'), q = w.getBoundingClientRect(), pic = w.querySelector('canvas.dt-pic').getBoundingClientRect();
      const inView = [...w.querySelectorAll('.dt-pill')].every(b => { const x = b.getBoundingClientRect(); return x.left >= q.left - 1 && x.right <= q.right + 1; });
      return { left: q.left, right: q.right, vw: innerWidth, scrolls: w.scrollHeight > w.clientHeight, pic: pic.width > 100 && pic.height > 50, inView, last: [...w.querySelectorAll('.dt-t')].at(-1).textContent };
    });
    check(`${tag}: the reader fills the screen, its picture on top, the whole story below`, r.left >= 0 && r.right <= r.vw && r.pic && r.inView && r.last.endsWith('the mother and the child.'), JSON.stringify(r));
    await p.tap('.dt-win[data-app="shahnameh"] .dt-pill:text-is("Sohrab")'); await p.waitForTimeout(300);
    // Read down to the end, then the next story from a tab (pressed where it is, without scrolling back up first).
    await p.evaluate(() => { const w = document.querySelector('.dt-win[data-app="shahnameh"]'); w.scrollTop = w.scrollHeight; }); await p.waitForTimeout(150);
    const down = await p.evaluate(() => document.querySelector('.dt-win[data-app="shahnameh"]').scrollTop);
    await p.evaluate(() => [...document.querySelectorAll('.dt-win[data-app="shahnameh"] .dt-pill')].find(b => b.textContent === 'Siavash').click()); await p.waitForTimeout(300);
    const s2 = await p.evaluate(() => [__loft.screens.desktop.reader.story, document.querySelector('.dt-win[data-app="shahnameh"] .dt-t').textContent, document.querySelector('.dt-win[data-app="shahnameh"]').scrollTop]);
    check(`${tag}: its tabs switch the story, and a new one starts at the top`, down > 20 && s2[0] === 'siavash' && s2[1] === 'Siavash and the Fire' && s2[2] === 0, `scrolled ${down}, then ${s2.join(' | ')}`);
    await p.screenshot({ path: `${OUT}/${tag}-reader.png` });
    await ctx.close();
  }

  await b.close();
  console.log(errs.length ? 'page errors:\n  ' + errs.join('\n  ') : 'no page errors');
  const pass = results.filter(Boolean).length;
  console.log(`${pass}/${results.length} passed`);
  process.exit(pass === results.length && !errs.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
