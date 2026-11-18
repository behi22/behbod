// The Shahnameh pieces: the Simorgh over the stairs, the library shelf, the painting on the mezzanine; on a computer and
// on phones both ways up.
//   LOFT_URL=http://127.0.0.1:8815 node test/persia.js [outdir]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/persia';
fs.mkdirSync(OUT, { recursive: true });
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;

function watch(p, errs, got) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (/\/src\/persia\//.test(r.url())) got.push(r.url().split('/src/persia/')[1]); if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!OUTSIDE.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts, query = '') {
  const p = await b.newPage(opts), errs = [], got = [];
  watch(p, errs, got);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
  await p.waitForFunction(() => window.__loft && window.__persia && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { p, errs, got };
}
// Stand on a spot (Blender axes) and let the page notice.
async function standAt(p, at) {
  await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...at));
  await p.waitForTimeout(450);
}
const toast = p => p.evaluate(() => document.getElementById('toast').textContent);
const shot = async (p, name, eye, at, w = 960, h = 600) => {
  const url = await p.evaluate(async ([e, a, w, h]) => {
    const L = __loft, c = L.camera.clone(), r = L.renderer, THREE = await import('three');
    c.position.set(e.x, e.y, e.z); c.lookAt(a.x, a.y, a.z); c.fov = 55; c.aspect = w / h; c.near = 0.02; c.updateProjectionMatrix();
    const pr = r.getPixelRatio(), size = r.getSize(new THREE.Vector2());
    r.setPixelRatio(1); r.setSize(w, h, false);
    const vis = L.me.root.visible; L.me.root.visible = false;
    r.render(L.scene, c);
    const out = r.domElement.toDataURL('image/png');
    L.me.root.visible = vis; r.setPixelRatio(pr); r.setSize(size.x, size.y, false);
    return out;
  }, [b2t(...eye), b2t(...at), w, h]);
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
};

(async () => {
  const P = await import('../web/src/pure/persia.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- a computer, today ----------
    {
      const { p, errs, got } = await open(b, DESK);
      const cost = await p.evaluate(async () => {
        await new Promise(r => setTimeout(r, 2600));
        const g = __persia.group, out = { meshes: 0, tris: 0, textures: [] };
        g.traverse(o => { if (o.isMesh) { out.meshes++; const pos = o.geometry.attributes.position; out.tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3; if (o.material.map) out.textures.push(`${o.material.map.image.width}x${o.material.map.image.height}`); } });
        out.painted = __persia.mini.painted;
        out.picture = __persia.mini.picture.material.map.image.width;
        out.colliders = __loft.meta.colliders.filter(c => c.name === 'persia_shelf').length;
        return out;
      });
      console.log(`cost: ${cost.meshes} meshes, ${Math.round(cost.tris)} triangles, textures ${cost.textures.join(' ')}; files ${got.join(' ')}`);
      check('the pieces are in the house, cheaply', cost.meshes <= 10 && cost.tris < 30000, `${cost.meshes} meshes, ${Math.round(cost.tris)} triangles`);
      check('the painting is painted soon after the house is up, at 768 px across', cost.painted && cost.picture === 768, `${cost.picture}`);
      check('the shelf stands in the walls and the walk grid', cost.colliders === 1);
      // Each spot: the prompt names it, E answers with its card.
      for (const s of P.SPOTS) {
        await standAt(p, s.at);
        const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').textContent]);
        check(`${s.id}: standing there, E is offered`, near[0] === s.id && near[1].includes(s.label), near.join(' | '));
        const lines = P.SAYS[s.id];
        for (let k = 0; k < lines.length; k++) {
          await p.keyboard.press('KeyE');
          await p.waitForTimeout(200);
          const t = await toast(p);
          check(`${s.id}: E says line ${k + 1}`, t === lines[k], t.slice(0, 60));
        }
      }
      // The shelf: walking straight at it stops in front of it, and a click on its corner leads only up to it.
      await standAt(p, [10.75, 1.4, 0]);
      await p.evaluate(() => { __loft.yaw = Math.PI; __loft.keys.add('KeyW'); });
      await p.waitForTimeout(2500);
      const walked = await p.evaluate(() => { __loft.keys.delete('KeyW'); return -__loft.pos.z; });
      await standAt(p, [10.75, 1.4, 0]);
      await p.evaluate(() => __loft.walkTo(10.75, 0.12, 0));
      await p.waitForTimeout(3500);
      const led = await p.evaluate(() => -__loft.pos.z);
      check('nobody walks into the shelf', walked > P.PLACES.shelf.max[1] + 0.1 && walked < 0.9 && led > P.PLACES.shelf.max[1] + 0.1, `walking stopped at y ${walked.toFixed(2)}, a click at ${led.toFixed(2)}`);
      await shot(p, 'simorgh-lounge', [7.5, 7.4, 2.2], [0.4, 6.6, 4.9]);
      await shot(p, 'simorgh-mezz', [3.6, 6.4, 5.0], [0.1, 6.0, 5.1]);
      await shot(p, 'shelf', [10.1, 1.6, 1.45], [10.75, 0.15, 1.05]);
      await shot(p, 'painting', [5.1, 1.5, 4.55], [5.1, 0.0, 4.5]);
      // Frame cost in the lounge, the pieces shown and hidden.
      await standAt(p, [3.0, 6.6, 0]);
      const frames = await p.evaluate(async () => {
        const L = __loft, g = __persia.group, ms = async () => { const t = []; let l = performance.now(); for (let i = 0; i < 90; i++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); t.push(n - l); l = n; } t.sort((a, b) => a - b); return +t[45].toFixed(2); };
        g.visible = false; await ms(); const off = await ms(), offCalls = L.renderer.info.render.calls;
        g.visible = true; await ms(); const on = await ms(), onCalls = L.renderer.info.render.calls;
        return { off, on, offCalls, onCalls };
      });
      console.log(`frame (median, looking at the stairs): ${frames.off} ms without, ${frames.on} ms with; draw calls ${frames.offCalls} without, ${frames.onCalls} with`);
      check('no error on a computer', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // ---------- phones, both ways up: the Use button reads the cards ----------
    for (const [name, opts] of [['upright', UPRIGHT], ['sideways', SIDEWAYS]]) {
      const { p, errs } = await open(b, opts);
      for (const s of P.SPOTS) {
        const id = s.id;
        await standAt(p, s.at);
        const use = await p.evaluate(() => { const r = document.getElementById('use').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        await p.touchscreen.tap(use.x, use.y);
        await p.waitForTimeout(250);
        const t = await toast(p), box = await p.evaluate(() => { const r = document.getElementById('toast').getBoundingClientRect(); return [r.left, r.right, innerWidth]; });
        check(`${name}: Use at ${id} reads its card, and it fits the screen`, t === P.SAYS[id][0] && box[0] >= 0 && box[1] <= box[2], `${t.slice(0, 40)} ${box.map(Math.round).join(',')}`);
        await p.screenshot({ path: path.join(OUT, `phone-${name}-${id}.png`) });
      }
      check(`${name}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
