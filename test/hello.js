// The hello world and the light switch in a real Chrome, at a computer and on phones.
//   LOFT_URL=http://127.0.0.1:8814 node test/hello.js [outdir] [only: hoop,terminal,phone,switch,day,low,phoneswitch]
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
// The entry, a few steps from the switch, looking at it.
const ENTRY = [3.6, 2.4, 0];
const onScreen = (p, name) => p.evaluate(n => {
  const c = __loft.scene.getObjectByName(n).getWorldPosition(__loft.camera.position.clone()).project(__loft.camera);
  const x = (c.x + 1) / 2 * innerWidth, y = (1 - c.y) / 2 * innerHeight, top = document.elementFromPoint(x, y);
  return { x, y, z: c.z, top: top ? top.tagName : null };
}, name);
// A fixed camera's picture of the loft (no character, no outside): its mean brightness, its bright end, and the pixels.
const picture = (p, eye, at) => p.evaluate(async ([e, a]) => {
  const L = __loft, c = L.camera.clone(), r = L.renderer, THREE = await import('three');
  c.position.set(e.x, e.y, e.z); c.lookAt(a.x, a.y, a.z); c.fov = 60; c.aspect = 1.6; c.updateProjectionMatrix();
  const pr = r.getPixelRatio(), size = r.getSize(new THREE.Vector2()), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
  r.setPixelRatio(1); r.setSize(320, 200, false); r.setClearColor(0x000000, 1);
  const vis = L.me.root.visible; L.me.root.visible = false;
  r.render(L.scene, c);
  const url = r.domElement.toDataURL('image/png');
  L.me.root.visible = vis; r.setPixelRatio(pr); r.setSize(size.x, size.y, false); r.setClearColor(cc, ca);
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = url; });
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, 320, 200).data, lum = [];
  for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
  const sorted = lum.slice().sort((x, y) => x - y);
  return { mean: lum.reduce((s, v) => s + v, 0) / lum.length, top: sorted[Math.floor(sorted.length * 0.997)], px: Array.from(d) };
}, [b2t(...eye), b2t(...at)]);
const diff = (A, B) => { let s = 0; for (let i = 0; i < A.px.length; i += 4) s += (Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2])) / 3; return s / (A.px.length / 4); };
const LOUNGE = [[10.5, 13.5, 1.9], [6.0, 10.2, -0.2]], BALCONY = [[11.0, 15.6, 1.6], [11.0, 17.5, 0.6]];
// The switch's state as the page has it, and the lights on the people against world.json's.
const lightsNow = p => p.evaluate(() => ({ on: __lights.on, k: __lights.k, room: __lights.uniforms.room.value.toArray(), bulb: __lights.uniforms.bulb.value.toArray(),
  exact: __loft.world.lights.every(([l, m]) => l.intensity === m.power), fill: __loft.world.lights.filter(([, m]) => m.kind === 'hemi').map(([l, m]) => l.intensity / m.power)[0],
  day: __loft.out3d?.light.dayK ?? 0, rocker: __lights.group.children[1].rotation.x, led: __lights.group.children[2].material.color.r, label: document.getElementById('prompt').textContent }));
const ones = s => s.room.every(v => v === 1) && s.bulb.every(v => v === 1) && s.exact && s.k === 1 && s.on;

(async () => {
  const H = await import('../web/src/pure/hello.js'), L = await import('../web/src/pure/lamps.js');
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
      await type(p, String.raw`MAIN() { printf("hello, world\n"); }`);
      check('a line the terminal does not run is not counted as finding it', (await termLines(p)).at(-1).startsWith('command not found') && (await p.evaluate(() => __hello.found)).length === 0, (await termLines(p)).at(-1));
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
      for (const s of ['print "hello world"', 'print ("hello world")']) {
        await type(p, s);
        lines = await termLines(p);
        check(`${s} still goes to the printer`, /^(printing|reprinting) /.test(lines[lines.lastIndexOf('$ ' + s) + 1] || ''), lines.slice(-3).join(' | '));
      }
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

    // ---------- the light switch, at night ----------
    if (want('switch')) {
      const { ctx, p, errs } = await open(b, DESK, '&time=22:00');
      await p.evaluate(() => { const s = __loft.audio.sfx, f = s.lightSwitch; window.__clicks = []; s.lightSwitch = (on, pos) => { __clicks.push(on); return f.call(s, on, pos); }; });
      const made = await p.evaluate(() => {
        const bulbs = new Set();
        __loft.scene.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) if (m.userData.lamp === 'bulb') bulbs.add(o.name.replace(/^merged_/, '')); });
        return { count: __lights.count, bulbs: [...bulbs] };
      });
      check('the house\'s materials are on the switch, the lamps among them', made.count.room > 50 && made.count.bulb >= 1 && made.bulbs.length >= 1 && made.bulbs.every(n => L.onSwitch(n, 'E_warm') || L.onSwitch(n, 'E_warm_soft')), JSON.stringify(made));
      const s0 = await lightsNow(p);
      check('it starts on, and on is exactly the house as it was: every level 1, every light at world.json\'s power', ones(s0), JSON.stringify(s0));
      const A = await picture(p, ...LOUNGE), balA = await picture(p, ...BALCONY);
      await standAt(p, L.SPOT.at, -Math.PI / 2);
      const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').textContent]);
      check('at the switch, E is offered to turn the lights off', near[0] === L.SPOT.id && near[1].endsWith('Turn the lights off'), near.join(' | '));
      await p.screenshot({ path: path.join(OUT, 'switch-on.png') });
      await p.keyboard.press('KeyE');
      await p.waitForTimeout(150);
      const t1 = await toast(p);
      await p.waitForTimeout(600);
      const s1 = await lightsNow(p), want0 = L.roomLight(s1.day, 0);
      check('E: the lights go out with a click, and it says so', t1 === 'Lights off.' && !s1.on && s1.k === 0 && (await p.evaluate(() => __clicks.join())) === 'false', `${t1} ${JSON.stringify(s1)}`);
      check('the room is at its night level, the lamps out, the light on me down', s1.room.every((v, i) => Math.abs(v - want0[i]) < 1e-6) && Math.abs(s1.bulb[0] - L.bulbLight(s1.day, 0)) < 1e-6 && Math.abs(s1.fill - L.fillLight(s1.day, 0)) < 1e-6 && s1.day < 0.05, JSON.stringify(s1));
      check('the rocker tips the other way, the little light shows where it is, the prompt turns them back on', s1.rocker > 0.1 && s1.led > 1 && s1.label.endsWith('Turn the lights on'), `${s1.rocker.toFixed(2)} ${s1.led} ${s1.label}`);
      await p.screenshot({ path: path.join(OUT, 'switch-off.png') });
      const B = await picture(p, ...LOUNGE), balB = await picture(p, ...BALCONY);
      check('the lounge goes dark, its screens, LEDs and neon still glowing', B.mean < A.mean * 0.5 && B.top > A.top * 0.6, `mean ${A.mean.toFixed(1)} to ${B.mean.toFixed(1)}, bright end ${A.top.toFixed(0)} to ${B.top.toFixed(0)}`);
      check('outside the glass the balcony keeps its own lights', Math.abs(balB.mean - balA.mean) < balA.mean * 0.15 + 1, `${balA.mean.toFixed(1)} and ${balB.mean.toFixed(1)}`);
      // On the balcony the light on me is my own again.
      await standAt(p, [11, 16.6, 0], 0);
      await p.waitForTimeout(1500);
      const out = await lightsNow(p);
      check('stepping out onto the balcony, the light on me comes back up', !out.on && out.exact, JSON.stringify(out.fill));
      // The terminal turns them back on from the desk.
      await sit(p);
      await type(p, 'lights');
      await type(p, 'lights on');
      await p.waitForTimeout(700);
      let lines = await termLines(p);
      const s2 = await lightsNow(p);
      check('lights at the terminal: says how they are, and lights on turns them on, exactly as before', lines.slice(-4).join('|') === '$ lights|the lights are off. lights on  or  lights off|$ lights on|lights on.' && ones(s2), lines.slice(-4).join(' | '));
      await type(p, 'lights off');
      await p.waitForTimeout(600);
      lines = await termLines(p);
      check('lights off at the terminal says where the switch is', lines.at(-1) === 'lights off. the switch by the front door turns them back on.' && !(await lightsNow(p)).on, lines.at(-1));
      await type(p, 'help');
      lines = await termLines(p);
      const help = lines.slice(lines.lastIndexOf('$ help') + 1);
      check('help lists lights, and still fits', help.join(' ').includes('lights') && help.every(l => l.length <= 66), help.join(' / '));
      await p.evaluate(() => __loft.leaveDesk());
      await p.waitForTimeout(1500);
      // From a few steps away, a click on the switch walks over and flips it back.
      await standAt(p, ENTRY, Math.PI + 0.57);
      await p.waitForTimeout(600);
      const at = await onScreen(p, 'light_switch');
      check('from the entry the switch is on screen', at.z < 1 && at.x > 0 && at.x < 1280 && at.y > 0 && at.y < 800 && at.top === 'CANVAS', JSON.stringify(at));
      await p.mouse.click(at.x, at.y);
      await p.waitForFunction(() => __lights.on, null, { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(700);
      const s3 = await lightsNow(p);
      check('a click on it walks me there and turns them on, exactly as before', ones(s3) && (await p.evaluate(() => __loft.near)) === L.SPOT.id && (await toast(p)) === 'Lights on.', JSON.stringify(s3));
      const C = await picture(p, ...LOUNGE);
      check('the lounge looks as it did before the switch was touched', diff(A, C) < 1.5, `mean difference ${diff(A, C).toFixed(2)} of 255`);
      check('every flip clicked', (await p.evaluate(() => __clicks.join())) === 'false,true,false,true', await p.evaluate(() => __clicks.join()));
      // With the sound on, the click plays without a hitch.
      await p.click('#snd'); await p.waitForTimeout(300);
      await p.keyboard.press('KeyE'); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
      check('with the sound on, two more flips, back on', ones(await lightsNow(p)));
      check('the switch at night: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- by day, and on the low setting ----------
    for (const [part, query, opts] of [['day', '&time=13:00', DESK], ['low', '&time=22:00', DESK]]) {
      if (!want(part)) continue;
      const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
      watch(p, errs);
      await p.goto(`${BASE}/?auto&q=${part === 'low' ? 'low' : 'high'}${query}`);
      await p.waitForFunction(() => window.__loft && window.__lights && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
      await p.waitForTimeout(1500);
      const A = await picture(p, ...LOUNGE);
      const frames = async () => p.evaluate(async () => { const t = []; let l = performance.now(); for (let i = 0; i < 90; i++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); t.push(n - l); l = n; } t.sort((a, b) => a - b); return +t[45].toFixed(1); });
      await standAt(p, [10.6, 11.6, 0], -2.0);
      const fOn = await frames();
      await p.evaluate(() => __lights.set(false));
      await p.waitForTimeout(800);
      const s = await lightsNow(p), B = await picture(p, ...LOUNGE), fOff = await frames(), w = L.roomLight(s.day, 0);
      const drop = 1 - B.mean / A.mean;
      check(`${part}: off, the room at its level for the time of day (${s.day.toFixed(2)})`, s.room.every((v, i) => Math.abs(v - w[i]) < 1e-6) && (part === 'day' ? s.day > 0.5 : s.day < 0.05), JSON.stringify(s.room));
      check(`${part}: the room dims ${part === 'day' ? 'some, the daylight still filling it' : 'to dark'}`, part === 'day' ? drop > 0.1 && drop < 0.55 : drop > 0.5, `${(drop * 100).toFixed(0)}% darker`);
      console.log(`${part}: frame median ${fOn} ms on, ${fOff} ms off`);
      await p.screenshot({ path: path.join(OUT, `${part}-off.png`) });
      await p.evaluate(() => __lights.set(true));
      await p.waitForTimeout(800);
      check(`${part}: back on, exactly as before`, ones(await lightsNow(p)) && diff(A, await picture(p, ...LOUNGE)) < 1.5);
      check(`${part}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- phones: a tap on the switch, and the Use button ----------
    for (const [tag, opts] of [['upright', UPRIGHT], ['sideways', SIDEWAYS]]) {
      if (!want('phoneswitch')) break;
      const { ctx, p, errs } = await open(b, opts, '&time=22:00');
      await standAt(p, ENTRY, Math.PI + 0.57);
      await p.waitForTimeout(700);
      const at = await onScreen(p, 'light_switch');
      if (at.top === 'CANVAS') await p.touchscreen.tap(at.x, at.y);
      await p.waitForFunction(() => !__lights.on, null, { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(700);
      const s = await lightsNow(p), t = await toast(p);
      check(`${tag}: a tap on the switch walks there and turns the lights off`, at.top === 'CANVAS' && !s.on && s.k === 0 && t === 'Lights off.', `${JSON.stringify(at)} ${t}`);
      await p.screenshot({ path: path.join(OUT, `${tag}-switch-off.png`) });
      const use = await p.evaluate(() => { const r = document.getElementById('use').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await p.touchscreen.tap(use.x, use.y); await p.waitForTimeout(800);
      check(`${tag}: Use turns them back on, exactly as before`, ones(await lightsNow(p)) && (await toast(p)) === 'Lights on.');
      check(`${tag}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
