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

  for (const [tag, opts] of [['upright', UPRIGHT], ['sideways', SIDEWAYS]]) {
    if (!want('phone')) break;
    const { ctx, p } = await open(b, opts, tag);
    await sit(p);
    await p.evaluate(() => { const i = document.getElementById('cmd'); i.focus(); });
    for (const c of ['ferdowsi', 'nowruz']) { await p.keyboard.type(c); await p.keyboard.press('Enter'); await p.waitForTimeout(200); }
    const lines = await termLines(p);
    check(`${tag}: ferdowsi and nowruz from the phone's command box`, lines.includes('$ ferdowsi') && lines.includes('$ nowruz') && lines.some(l => l.startsWith('Nowruz 14')), lines.slice(-4).join(' | '));
    await p.screenshot({ path: `${OUT}/${tag}-terminal.png` });
    await ctx.close();
  }

  await b.close();
  console.log(errs.length ? 'page errors:\n  ' + errs.join('\n  ') : 'no page errors');
  const pass = results.filter(Boolean).length;
  console.log(`${pass}/${results.length} passed`);
  process.exit(pass === results.length && !errs.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
