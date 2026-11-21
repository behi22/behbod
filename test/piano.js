// The piano's own things, on a computer and a phone, lamps on and off:
//   the note names on the keys;
//   LOFT_URL=http://127.0.0.1:8822 node test/piano.js [names|phone|all]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const ONLY = process.argv[2] || 'all';
const want = k => ONLY === 'all' || ONLY === k;
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]|GL_|WebGL/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// `sound`: come in through the door, which starts the sound; otherwise the page opens straight in, silent.
async function open(b, opts, { sound = false, extra = '' } = {}) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?q=low${sound ? '' : '&auto'}${extra}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  if (sound) { await p.waitForSelector('#enter.ready', { timeout: 120000 }); await p.click('#enter'); }
  await p.waitForTimeout(800);
  return { ctx, p, errs };
}
async function sit(p) {
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(16.0, 8.9, 0));
  await p.waitForTimeout(300);
  await p.evaluate(() => __loft.act('piano'));
  await p.waitForFunction(() => __loft.mode === 'sit' && document.querySelector('.pm-keys'), null, { timeout: 10000 });
  await p.waitForTimeout(1300);
}
const button = (p, text) => p.locator('.pm button', { hasText: text }).first();

(async () => {
  const { noteName } = await import('../web/src/pianomode.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- the note names ----------
    if (want('names')) {
      const { ctx, p, errs } = await open(b, DESK);
      await sit(p);
      const off = await p.evaluate(() => ({ names: document.querySelector('.pm-keys').classList.contains('names'), shown: [...document.querySelectorAll('.pm-n')].filter(n => getComputedStyle(n).display !== 'none').length,
        pressed: [...document.querySelectorAll('.pm button')].find(b => b.textContent === 'Note names')?.getAttribute('aria-pressed'), letters: [...document.querySelectorAll('.pm-w span')].map(s => s.textContent).join('') }));
      check('the note names are hidden at first, the keyboard letters still on their keys', !off.names && off.shown === 0 && off.pressed === 'false' && off.letters === 'ASDFGHJKL;', JSON.stringify(off));
      await p.keyboard.press('KeyN');
      await p.waitForTimeout(150);
      const on = await p.evaluate(() => [...document.querySelectorAll('.pm-keys [data-m]')].map(k => {
        const n = k.querySelector('.pm-n'), r = document.createRange(); r.selectNodeContents(n);
        const box = r.getBoundingClientRect(), key = k.getBoundingClientRect();
        return { m: +k.dataset.m, text: n.textContent, shown: getComputedStyle(n).display !== 'none', px: parseFloat(getComputedStyle(n).fontSize), fits: box.left >= key.left - 0.5 && box.right <= key.right + 0.5 && box.bottom <= key.bottom };
      }));
      const right = on.every(k => k.text === noteName(k.m));
      check('N shows the names, C3 to C6 with the octave on each C, sharps on the black keys', right && on.every(k => k.shown) && on.length === 37, on.slice(0, 13).map(k => k.text).join(' '));
      check('every name fits inside its key at a readable size', on.every(k => k.fits && k.px >= 9), JSON.stringify(on.filter(k => !k.fits || k.px < 9).slice(0, 3)));
      check('the button says the names are on', (await button(p, 'Note names').getAttribute('aria-pressed')) === 'true');
      // With Ctrl held the key is the browser's: the piano leaves it alone.
      const zoom = await p.evaluate(() => { const e = new KeyboardEvent('keydown', { code: 'KeyN', key: 'n', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(e); return [e.defaultPrevented, document.querySelector('.pm-keys').classList.contains('names')]; });
      check('Ctrl and N is left to the browser', zoom[0] === false && zoom[1] === true, JSON.stringify(zoom));
      // Kept for the next visit, and through standing up and sitting down again.
      await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
      await p.reload();
      await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
      await sit(p);
      const kept = await p.evaluate(() => document.querySelector('.pm-keys').classList.contains('names'));
      await button(p, 'Note names').click();
      await p.waitForTimeout(150);
      const after = await p.evaluate(() => [document.querySelector('.pm-keys').classList.contains('names'), localStorage.getItem('loft.notenames')]);
      check('the choice is remembered on the next visit, and a click turns them off again', kept && after[0] === false && after[1] === '0', JSON.stringify({ kept, after }));
      check('names: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    // ---------- on a phone ----------
    if (want('phone')) {
      const { ctx, p, errs } = await open(b, PHONE);
      await sit(p);
      await p.locator('.pm button', { hasText: 'Note names' }).tap();
      await p.waitForTimeout(150);
      const ph = await p.evaluate(() => {
        const keys = [...document.querySelectorAll('.pm-keys [data-m]')];
        const white = keys.filter(k => k.classList.contains('pm-w')).map(k => { const n = k.querySelector('.pm-n'), r = document.createRange(); r.selectNodeContents(n); const box = r.getBoundingClientRect(), key = k.getBoundingClientRect(); return { px: parseFloat(getComputedStyle(n).fontSize), shown: getComputedStyle(n).display !== 'none', fits: box.left >= key.left - 0.5 && box.right <= key.right + 0.5 }; });
        const black = keys.filter(k => k.classList.contains('pm-b')).map(k => getComputedStyle(k.querySelector('.pm-n')).display);
        const pm = document.querySelector('.pm').getBoundingClientRect(), tools = [...document.querySelectorAll('.pm-row')][2].getBoundingClientRect();
        return { white, black, inside: pm.left >= 0 && pm.right <= innerWidth && pm.top >= 0, toolsOneLine: tools.height < 40, scroll: document.documentElement.scrollWidth <= innerWidth };
      });
      check('phone: the white keys\' names show, readable and inside their keys; the narrow black keys leave theirs off', ph.white.every(k => k.shown && k.px >= 10 && k.fits) && ph.black.every(d => d === 'none'), JSON.stringify(ph.white.slice(0, 3)));
      check('phone: the panel fits the screen, its new row on one line, no sideways scroll', ph.inside && ph.toolsOneLine && ph.scroll, JSON.stringify(ph));
      check('phone: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
