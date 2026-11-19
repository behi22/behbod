// The hello world (the cross-stitch hoop and the terminal) in a real Chrome, at a computer and on phones.
//   LOFT_URL=http://127.0.0.1:8814 node test/hello.js [outdir] [only: hoop,terminal,phone]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/hello';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!OUTSIDE.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts, query = '') {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
  await p.waitForFunction(() => window.__loft && window.__hello && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.evaluate(() => { window.__finds = []; addEventListener('loft:hello', e => __finds.push(e.detail)); });
  await p.waitForTimeout(800);
  return { ctx, p, errs };
}
async function standAt(p, at, yaw) {
  await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (yw !== undefined) __loft.yaw = yw; }, [b2t(...at), yaw]);
  await p.waitForTimeout(500);
}
const toast = p => p.evaluate(() => document.getElementById('toast').textContent);
const termLines = p => p.evaluate(() => __loft.screens.desktop.term.lines.slice());
const sit = async p => { await p.evaluate(() => __loft.useDesk()); await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 }); await p.waitForTimeout(700); };
const type = async (p, text) => { await p.keyboard.type(text); await p.keyboard.press('Enter'); await p.waitForTimeout(150); };
// Where the hoop's middle lands on the screen, and what the page has on top there.
const hoopOnScreen = p => p.evaluate(() => {
  const c = __hello.group.getWorldPosition(__loft.camera.position.clone()).project(__loft.camera);
  const x = (c.x + 1) / 2 * innerWidth, y = (1 - c.y) / 2 * innerHeight, top = document.elementFromPoint(x, y);
  return { x, y, z: c.z, top: top ? top.tagName : null };
});
// The studio, a few steps back from the hoop, looking at it.
const BACK = [16.4, 3.4, 0.45];

(async () => {
  const H = await import('../web/src/pure/hello.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    if (want('hoop')) {
      const { ctx, p, errs } = await open(b, DESK);
      const cost = await p.evaluate(() => {
        let meshes = 0, tris = 0;
        __hello.group.traverse(o => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
        return { meshes, tris: Math.round(tris) };
      });
      check('the hoop is in the house, cheaply', cost.meshes === 2 && cost.tris < 6000, JSON.stringify(cost));
      await standAt(p, H.SPOT.at, Math.PI);
      const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').textContent]);
      check('standing at its spot, E is offered', near[0] === H.SPOT.id && near[1].includes(H.SPOT.label), near.join(' | '));
      const said = [];
      for (let k = 0; k < 3; k++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(200); said.push(await toast(p)); }
      check('E reads its two lines in turn', said[0] === H.SAYS[0] && said[1] === H.SAYS[1] && said[2] === H.SAYS[0], said.map(s => s.slice(0, 30)).join(' | '));
      const finds = await p.evaluate(() => [__finds.slice(), __hello.found]);
      check('reading it counts as finding it, once', JSON.stringify(finds[0]) === '[{"where":"hoop","found":["hoop"]}]' && finds[1].join() === 'hoop', JSON.stringify(finds));
      // From a few steps back, a click on the hoop walks over and reads it.
      await standAt(p, BACK, Math.PI + 0.16);
      await p.waitForTimeout(600);
      const at = await hoopOnScreen(p);
      check('from across the studio the hoop is on screen, nothing of the page over it', at.z < 1 && at.x > 0 && at.x < 1280 && at.y > 0 && at.y < 800 && at.top === 'CANVAS', JSON.stringify(at));
      await p.screenshot({ path: path.join(OUT, 'hoop-studio.png') });
      await p.mouse.click(at.x, at.y);
      await p.waitForFunction(() => __loft.route === 0 && __loft.near === 'hello_hoop', null, { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(400);
      const walked = await p.evaluate(() => ({ near: __loft.near, toast: document.getElementById('toast').textContent, mode: __loft.mode }));
      check('a click on it walks me there and reads it', walked.near === H.SPOT.id && H.SAYS.includes(walked.toast) && walked.mode === 'walk', JSON.stringify(walked).slice(0, 120));
      await p.screenshot({ path: path.join(OUT, 'hoop-spot.png') });
      check('the hoop: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('terminal')) {
      const { ctx, p, errs } = await open(b, DESK);
      await sit(p);
      await type(p, 'hello world');
      let lines = await termLines(p);
      check('hello world at the terminal answers hello, world', lines.slice(-4).join('|') === ['$ hello world', 'hello, world', 'every programmer\'s first program.', 'try it in your favourite language too.'].join('|'), lines.slice(-4).join(' | '));
      check('and counts as finding it', (await p.evaluate(() => __hello.found)).join() === 'terminal');
      for (const [s, out] of [['print("hello world")', ['hello world', 'that was python. everyone starts here.']], ['console.log("Hello, World!");', ['Hello, World!', 'that was javascript. everyone starts here.']],
        [String.raw`main() { printf("hello, world\n"); }`, ['hello, world', 'that was c, as kernighan and ritchie printed it in 1978.']], ['echo hello world', ['hello world', 'that was shell. everyone starts here.']]]) {
        await type(p, s);
        lines = await termLines(p);
        check(`${s} runs`, lines.slice(-3).join('|') === ['$ ' + s, ...out].join('|'), lines.slice(-3).join(' | '));
      }
      const finds = await p.evaluate(() => __finds.map(f => f.where));
      check('the terminal is found once however often it is typed', finds.join() === 'terminal', finds.join());
      // What was there before is untouched.
      await type(p, 'hello friend');
      await type(p, 'print vase');
      await type(p, 'scene focus');
      lines = await termLines(p);
      const i = lines.lastIndexOf('$ hello friend');
      check('hello friend, the printer and the scenes answer as before', lines[i + 1] === 'hello, friend.' && lines[i + 2] === '$ print vase' && lines[i + 3] && !/hello world|command not found/.test(lines[i + 3]) && lines.at(-1) === 'lights: focus', lines.slice(i).join(' | '));
      await type(p, 'hello');
      lines = await termLines(p);
      check('a near miss is still not found', lines.at(-1) === "command not found: hello. try 'help'", lines.at(-1));
      await type(p, 'help');
      lines = await termLines(p);
      const help = lines.slice(lines.lastIndexOf('$ help') + 1);
      check('help is as it was (the hello world stays a secret) and fits', !help.join(' ').includes('hello') && help.every(l => l.length <= 66), help.join(' / '));
      await type(p, 'hello, world');
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(OUT, 'terminal.png') });
      check('the terminal: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    for (const [tag, opts] of [['upright', UPRIGHT], ['sideways', SIDEWAYS]]) {
      if (!want('phone')) break;
      const { ctx, p, errs } = await open(b, opts);
      await standAt(p, BACK, Math.PI + 0.16);
      await p.waitForTimeout(700);
      const at = await hoopOnScreen(p);
      if (at.top === 'CANVAS') {
        await p.touchscreen.tap(at.x, at.y);
        await p.waitForFunction(() => __loft.route === 0 && __loft.near === 'hello_hoop', null, { timeout: 15000 }).catch(() => {});
        await p.waitForTimeout(500);
      }
      const t = await toast(p), box = await p.evaluate(() => { const r = document.getElementById('toast').getBoundingClientRect(); return [r.left, r.right, r.bottom, innerWidth, innerHeight]; });
      check(`${tag}: a tap on the hoop walks there and reads it, and the card fits the screen`, at.top === 'CANVAS' && H.SAYS.includes(t) && box[0] >= 0 && box[1] <= box[3] && box[2] <= box[4], `${JSON.stringify(at)} ${t.slice(0, 30)}`);
      await p.screenshot({ path: path.join(OUT, `${tag}-hoop.png`) });
      // The Use button reads it too.
      const use = await p.evaluate(() => { const r = document.getElementById('use').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; });
      await p.touchscreen.tap(use.x, use.y); await p.waitForTimeout(250);
      check(`${tag}: Use reads it`, H.SAYS.includes(await toast(p)) && use.w > 0);
      await sit(p);
      await p.evaluate(() => document.getElementById('cmd').focus());
      await p.keyboard.type('print("hello world")'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
      const lines = await termLines(p);
      check(`${tag}: the phone's command box runs it too`, lines.slice(-2).join('|') === 'hello world|that was python. everyone starts here.', lines.slice(-3).join(' | '));
      const finds = await p.evaluate(() => __hello.found);
      check(`${tag}: both found`, finds.join() === 'hoop,terminal', finds.join());
      check(`${tag}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
