// The desk terminal's autofill and its link commands, in a real Chrome, at a keyboard and on a phone.
//   LOFT_URL=http://127.0.0.1:8876 node test/terminal.js [outdir] [only: keys,links,phone]
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
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
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
    // ---------- ghost text, Tab, Shift+Tab and Right Arrow at the desk's keyboard; Up and Down still walk the history ----------
    if (want('keys')) {
      const { ctx, p, errs } = await seated(b, DESK);
      const line = () => p.evaluate(() => {
        const g = document.querySelector('.dt-term .in .ghost'), c = document.querySelector('.dt-term .in .caret');
        return { input: __loft.screens.desktop.term.input, model: __loft.screens.desktop.ghost, shown: g ? g.textContent : '', caretOver: !!c?.classList.contains('over'), row: document.querySelector('.dt-term .in')?.textContent ?? '',
          active: document.activeElement === document.body, mode: __loft.mode, front: __loft.screens.desktop.st.focus };
      });
      const press = async k => { await p.keyboard.press(k); await p.waitForTimeout(90); return line(); };
      const typeIn = async t => { await p.evaluate(() => { __loft.screens.desktop.term.input = ''; __loft.screens.desktop.changed(); }); await p.keyboard.type(t, { delay: 30 }); await p.waitForTimeout(120); return line(); };
      // The monitor's own picture: pixels of the faint colour on the terminal's input row.
      const faintOnMonitor = () => p.evaluate(() => {
        const c = __loft.screens.textures.main.image, g = c.getContext('2d'), w = __loft.screens.desktop.st.wins.find(x => x.app === 'terminal');
        const d = g.getImageData(w.x, w.y + 34, w.w, w.h - 34).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0x7f) < 8 && Math.abs(d[i + 1] - 0x8a) < 8 && Math.abs(d[i + 2] - 0xa0) < 8) n++;
        return n;
      });
      const faint0 = await faintOnMonitor();
      let s = await typeIn('vis');
      await p.waitForTimeout(700);
      const faint1 = await faintOnMonitor();
      check('the monitor draws the faint rest too', s.model === 'itor-classifier' && faint1 > faint0 + 100, `faint pixels ${faint0} -> ${faint1}`);
      s = await typeIn('who');
      check('typing part of a command shows the rest faintly after the cursor, in the seated view and the model', s.input === 'who' && s.shown === 'ami' && s.model === 'ami' && s.caretOver && s.row === '$ whoami', JSON.stringify(s));
      await p.screenshot({ path: path.join(OUT, 'ghost-desk.png') });
      s = await press('Tab');
      check('Tab fills it, the ghost goes, and the keyboard stays with the terminal', s.input === 'whoami' && s.shown === '' && s.active && s.mode === 'desk' && s.front === 'terminal', JSON.stringify(s));
      await typeIn('p');
      const turn = [];
      for (const k of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) turn.push((await press(k)).input);
      check('Tab again goes round the other matches, most used first, and back to the first; Shift+Tab goes back', turn.join('|') === 'projects|print|postit|profile-art|postit|print|projects', turn.join(' | '));
      s = await press('Shift+Tab');
      check('Shift+Tab from the first goes round to the last', s.input === 'profile-art' && s.active, JSON.stringify(s));
      s = await typeIn('lin');
      const before = s.shown;
      s = await press('ArrowRight');
      check('Right Arrow at the end of the line takes the suggestion', before === 'kedin' && s.input === 'linkedin' && s.shown === '', `${before} -> ${JSON.stringify(s)}`);
      s = await typeIn('zzz');
      const none = s.shown === '' && s.model === '' && !s.caretOver;
      s = await press('Tab');
      check('no match shows nothing, and Tab then changes nothing and keeps the keyboard', none && s.input === 'zzz' && s.active && s.mode === 'desk', JSON.stringify(s));
      const hidden = [];
      for (const t of ['su', 'cd', 'cat', 'hello', 'hello,']) { s = await typeIn(t); if (s.shown || s.model) hidden.push(`${t}->${s.shown || s.model}`); }
      const offered = await p.evaluate(() => __loft.screens.commands());
      const secret = ['sudo', 'cd secrets', 'cat notes.txt', 'hello friend', 'hello, friend'].filter(n => offered.includes(n));
      check('nothing hidden is offered: sudo, cd, cat and the hellos stay secret', !hidden.length && !secret.length, JSON.stringify({ hidden, secret }));
      // Up and Down still walk the commands entered, a filled line included.
      for (const c of ['who', 'l']) { await typeIn(c); await press('Tab'); await press('Enter'); await p.waitForTimeout(150); }
      await typeIn('p'); await press('Tab');
      const walk = [];
      for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown']) walk.push((await press(k)).input);
      check('Up and Down still walk the history, and give back the line being filled', walk.join('|') === 'ls|whoami|ls|projects', walk.join(' | '));
      s = await press('Enter');
      const ranLines = await p.evaluate(() => __loft.screens.desktop.term.lines.slice(-6));
      check('a filled command runs with Enter, and projects says how to open one', ranLines[0] === '$ projects' && ranLines.at(-1) === 'type a name to open it in a new tab.' && ranLines.includes('visitor-classifier'), ranLines.join(' / '));
      // With another window in front, Tab still brings the terminal forward and fills; the calculator keeps its own (test/world.js).
      await p.click('.dt-icon[aria-label="Open About me"]'); await p.waitForTimeout(250);
      await p.evaluate(() => { __loft.screens.desktop.term.input = 'dep'; __loft.screens.desktop.changed(); });
      s = await press('Tab');
      check('with another window in front, Tab brings the terminal forward and fills', s.input === 'deploy' && s.front === 'terminal' && s.active, JSON.stringify(s));
      await p.evaluate(() => __loft.leaveDesk()); await p.waitForTimeout(400);
      s = await line();
      check('standing up, the faint rest goes', s.model === '' && s.mode !== 'desk', JSON.stringify(s));
      check('keys: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

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
      await p.keyboard.type('gi', { delay: 20 }); await p.keyboard.press('Tab');
      const filled = await popupFrom(p, () => p.keyboard.press('Enter')).catch(e => ({ error: e.message.slice(0, 80) }));
      check('a link command filled by Tab opens with Enter too', filled.url === LINES.GitHub, JSON.stringify(filled));
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

    // ---------- the phone's command box: a chip over it shows the command whole, and a tap fills it ----------
    if (want('phone')) {
      const { ctx, p, errs } = await seated(b, PHONE);
      const chip = () => p.evaluate(() => {
        const c = document.querySelector('.fill-chip'), box = document.getElementById('cmd'), dt = document.querySelector('.dt'), r = c.getBoundingClientRect(), br = box.getBoundingClientRect(), dr = dt.getBoundingClientRect();
        return { shown: getComputedStyle(c).display !== 'none', text: c.textContent, value: box.value, focused: document.activeElement === box,
          above: r.bottom <= br.top && r.top >= dr.bottom - 0.5, inside: r.left >= 0 && r.right <= innerWidth };
      });
      await p.tap('#cmd');
      await p.keyboard.type('who', { delay: 40 }); await p.waitForTimeout(150);
      let c = await chip();
      check('phone: typing part of a command shows it whole on a chip just over the box, clear of the desktop', c.shown && c.text === 'whoami' && c.above && c.inside, JSON.stringify(c));
      await p.screenshot({ path: path.join(OUT, 'chip-phone.png') });
      await p.tap('.fill-chip'); await p.waitForTimeout(150);
      c = await chip();
      check('phone: a tap on the chip fills the box, keeps the keyboard there, and the chip goes', c.value === 'whoami' && c.focused && !c.shown, JSON.stringify(c));
      await p.fill('#cmd', 'zzz'); await p.waitForTimeout(100);
      c = await chip();
      check('phone: no match, no chip', !c.shown, JSON.stringify(c));
      await p.fill('#cmd', 'pro'); await p.press('#cmd', 'Tab'); await p.waitForTimeout(100);
      c = await chip();
      check('phone: a keyboard\'s Tab in the box fills it and stays in the box', c.value === 'projects' && c.focused, JSON.stringify(c));
      await p.fill('#cmd', 'meet'); await p.waitForTimeout(100);
      await p.tap('.fill-chip'); await p.waitForTimeout(100);
      const seen = await popupFrom(p, () => p.press('#cmd', 'Enter')).catch(e => ({ error: e.message.slice(0, 80) }));
      c = await chip();
      check('phone: a link command filled from the chip opens in a new tab with Enter, the box empties and the chip stays away',
        seen.url === LINES['Meet Bex'] && seen.opener === true && c.value === '' && !c.shown && (await lastLine(p)) === 'Opening Meet Bex in a new tab.', JSON.stringify({ seen, c }));
      await p.fill('#cmd', 'github');
      const seen2 = await popupFrom(p, () => p.press('#cmd', 'Enter')).catch(e => ({ error: e.message.slice(0, 80) }));
      check('phone: Enter on a link command typed out opens it too', seen2.url === LINES.GitHub, JSON.stringify(seen2));
      const tapped = await popupFrom(p, () => p.tap('.dt-term a >> nth=-1')).catch(e => ({ error: e.message.slice(0, 80) }));
      check('phone: a tap on the line it printed opens the page again', tapped.url === LINES.GitHub && tapped.opener === true, JSON.stringify(tapped));
      for (const cmd of ['whoami', 'ls']) { await p.fill('#cmd', cmd); await p.press('#cmd', 'Enter'); await p.waitForTimeout(120); }
      await p.fill('#cmd', 'he');
      const walk = [];
      for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown']) { await p.press('#cmd', k); walk.push(await p.inputValue('#cmd')); }
      c = await chip();
      check('phone: Up and Down still walk the history, and the chip follows the line shown', walk.join('|') === 'ls|whoami|ls|he' && c.shown && c.text === 'help', `${walk.join(' | ')} ${JSON.stringify(c)}`);
      await p.evaluate(() => __loft.leaveDesk()); await p.waitForTimeout(300);
      c = await chip();
      check('phone: standing up hides the chip with the box', !c.shown, JSON.stringify(c));
      check('phone: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
