// The desk terminal's link commands, in a real Chrome.
//   LOFT_URL=http://127.0.0.1:8876 node test/terminal.js [outdir] [only: links]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/terminal';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const GRAPH = /^https:\/\/behi22\.github\.io\/profile-art\/data\/contrib\.json/;
const CHROME = { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] };
const LINES = { GitHub: 'https://github.com/behi22', LinkedIn: 'https://www.linkedin.com/in/behbod-babai/', 'Meet Bex': 'https://behi22.github.io/meet-bex/',
  'Profile art': 'https://behi22.github.io/profile-art/', 'Voice microsite': 'https://aic-voice-microsite.vercel.app/', 'Visitor classifier': 'https://www.loom.com/share/84359f4e50ee41fc97b21f921d9aa4a0' };
const LINKS = { github: 'GitHub', linkedin: 'LinkedIn', 'meet-bex': 'Meet Bex', 'profile-art': 'Profile art', 'aic-voice-microsite': 'Voice microsite', 'visitor-classifier': 'Visitor classifier' };
const TARGETS = new Set(Object.values(LINES));

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url()) && !GRAPH.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '') && !GRAPH.test(m.location()?.url || '') && !/contrib\.json/.test(m.text())) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]|GL_INVALID/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// A page of the house, seated at the desk. The pages the link commands open are answered here, never fetched.
async function seated(b, opts) {
  const ctx = await b.newContext(opts);
  await ctx.route(GRAPH, r => r.abort('failed'));
  await ctx.route(u => TARGETS.has(u.href), r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>opened</title><p>opened</p>' }));
  const p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => __loft.useDesk());
  await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 });
  await p.waitForTimeout(500);
  return { ctx, p, errs };
}
const lastLine = p => p.evaluate(() => __loft.screens.desktop.term.lines.at(-1));
// The link drawn for the newest line in the seated view, if it is one.
const lastLink = p => p.evaluate(() => { const a = [...document.querySelectorAll('.dt-term div')].filter(d => !d.classList.contains('in')).at(-1)?.querySelector('a'); return a ? { href: a.href, target: a.target, rel: a.rel, text: a.textContent } : null; });
// Opens the page a key press or click should open, and reads where it went and what it was given.
async function popupFrom(p, act) {
  const [pop] = await Promise.all([p.waitForEvent('popup', { timeout: 5000 }), act()]);
  // A tab opened without its opener starts blank, then goes to the page.
  await pop.waitForURL(/^https:/, { waitUntil: 'domcontentloaded', timeout: 5000 });
  const seen = { url: pop.url(), opener: await pop.evaluate(() => window.opener === null), referrer: await pop.evaluate(() => document.referrer) };
  await pop.close();
  return seen;
}

(async () => {
  const b = await launch(pw.chromium, CHROME);
  try {
    // ---------- Enter on a link command opens its page in a new tab; a blocked tab leaves the link to click ----------
    if (want('links')) {
      const { ctx, p, errs } = await seated(b, DESK);
      let pops = 0;
      p.on('popup', () => pops++);
      for (const [name, title] of Object.entries(LINKS)) {
        await p.keyboard.type(name, { delay: 20 });
        const seen = await popupFrom(p, () => p.keyboard.press('Enter')).catch(e => ({ error: e.message.slice(0, 80) }));
        const said = await lastLine(p), link = await lastLink(p);
        check(`${name}: Enter opens ${LINES[title]} in a new tab, with no opener and no referrer, and one short line says so`,
          seen.url === LINES[title] && seen.opener === true && seen.referrer === '' && said === `Opening ${title} in a new tab.` && link?.href === LINES[title] && link.target === '_blank' && link.rel === 'noopener noreferrer',
          JSON.stringify({ seen, said, link }));
      }
      const mode = await p.evaluate(() => __loft.mode);
      check('the visitor is still seated at the desk after the tabs open', mode === 'desk', mode);
      // Run with no key press behind it (the press long gone), the browser would block the tab: none is tried, and the
      // line is the link to click.
      const n0 = pops;
      await p.evaluate(() => new Promise(r => setTimeout(() => { __loft.screens.run('linkedin', () => {}); r(); }, 6500)));
      await p.waitForTimeout(1200);
      const said = await lastLine(p), link = await lastLink(p);
      check('with no key press to open it, no tab is tried and the line shows the link to click', pops === n0 && said === 'The new tab was blocked. Click here to open LinkedIn.' && link?.href === LINES.LinkedIn && link.rel === 'noopener noreferrer',
        JSON.stringify({ tried: pops - n0, said, link }));
      await p.screenshot({ path: path.join(OUT, 'links-desk.png') });
      const clicked = await popupFrom(p, () => p.click('.dt-term a >> nth=-1')).catch(e => ({ error: e.message.slice(0, 80) }));
      check('clicking that line opens the page in a new tab', clicked.url === LINES.LinkedIn && clicked.opener === true, JSON.stringify(clicked));
      await p.keyboard.type('clear', { delay: 20 }); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      const cleared = await p.evaluate(() => ({ lines: __loft.screens.desktop.term.lines.length, links: __loft.screens.desktop.term.links.size, a: document.querySelectorAll('.dt-term a').length }));
      check('clear takes the link lines with it', cleared.lines === 0 && cleared.links === 0 && cleared.a === 0, JSON.stringify(cleared));
      const help = await p.evaluate(() => { __loft.screens.run('help', () => {}); return __loft.screens.desktop.term.lines.slice(-4); });
      check('help lists github and linkedin, every line fitting', help.join(' ').includes('github') && help.join(' ').includes('linkedin') && help.every(l => l.length <= 66), help.join(' / '));
      check('links: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
