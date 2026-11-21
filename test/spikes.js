// Long frames from what the house repaints, at his laptop's size (1440x900 at 2x) on ultra, standing where a visit
// starts with the TV's live match in sight: a repaint of a canvas on a model must not hold the graphics card, and
// what the card holds must be the same picture as before, byte for byte. Then the screening wall, whose live video
// must start without building a shader.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(`${BASE}/?auto&q=ultra`);
    await p.waitForFunction(() => window.__loft, null, { timeout: 120000 });
    await p.waitForFunction(() => __loft.range.ready && !__loft.range.building, null, { timeout: 120000, polling: 250 });
    const at = b2t(2.55, 1.2, 0);
    await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); __loft.yaw = 0.15; }, at);
    await p.waitForTimeout(2500);
    // Each frame: how long since the last, whether the TV's picture went to the card, and the card's time on the frame
    // (from its first draw to the end of its callbacks, read back a few frames later).
    const timed = await p.evaluate(() => new Promise(done => {
      const r = __loft.renderer, gl = r.getContext(), x = gl.getExtension('EXT_disjoint_timer_query_webgl2'), tv = __loft.screens.textures.tv;
      if (!x) { done(null); return; }
      const frames = [], pending = [], render = r.render, sub = gl.texSubImage2D, img = gl.texImage2D;
      let ups = 0, q = null, open = false, last = performance.now(), n = 0, stop = false, late = 0;
      gl.texSubImage2D = function (...a) { if (a.at(-1) === tv.image) ups++; return sub.apply(this, a); };
      gl.texImage2D = function (...a) { if (a.at(-1) === tv.image) ups++; return img.apply(this, a); };
      r.render = function (...a) { if (!open) { q = gl.createQuery(); gl.beginQuery(x.TIME_ELAPSED_EXT, q); open = true; } return render.apply(this, a); };
      const loop = () => {
        const t = performance.now();
        if (open) { gl.endQuery(x.TIME_ELAPSED_EXT); pending.push([n, q]); open = false; }
        while (pending.length && gl.getQueryParameter(pending[0][1], gl.QUERY_RESULT_AVAILABLE)) {
          const [k, qq] = pending.shift();
          frames[k].gpu = gl.getParameter(x.GPU_DISJOINT_EXT) ? null : gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6;
          gl.deleteQuery(qq);
        }
        frames.push({ t, dt: t - last, up: ups, gpu: null }); ups = 0; last = t; n++;
        if (stop && (!pending.length || ++late > 120)) { r.render = render; gl.texSubImage2D = sub; gl.texImage2D = img; done(frames.slice(5)); return; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      setTimeout(() => { stop = true; }, 12000);
    }));
    if (!timed) check('the graphics card times frames (EXT_disjoint_timer_query_webgl2)', false);
    else {
      const med = xs => { const s = xs.filter(v => v != null).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
      const secs = (timed.at(-1).t - timed[0].t) / 1000, sent = timed.filter(f => f.up).length;
      check('standing at the start, the TV\'s match is repainted while in sight (repaints a second)', sent / secs > 5, (sent / secs).toFixed(1));
      const withUp = med(timed.filter(f => f.up).map(f => f.gpu)), without = med(timed.filter(f => !f.up).map(f => f.gpu));
      check('a repaint costs the graphics card no more than 3 ms over a frame without one (median ms, with and without)', withUp - without < 3, `${withUp.toFixed(1)} and ${without.toFixed(1)}`);
      // The three frames after each repaint, against the rest.
      const after = new Set();
      timed.forEach((f, k) => { if (f.up) for (let j = k; j <= k + 3 && j < timed.length; j++) after.add(j); });
      const p90 = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * 0.9)]; };
      const near = p90(timed.filter((f, k) => after.has(k)).map(f => f.dt)), rest = p90(timed.filter((f, k) => !after.has(k)).map(f => f.dt));
      check('the frames right after a repaint are no slower than the rest (90th percentile ms, after and rest)', near < rest + 8, `${near.toFixed(1)} and ${rest.toFixed(1)}`);
    }
    // A screen's picture on the card against the same canvas sent the way it was before (an sRGB texture), at full
    // size and one step smaller: the same bytes, so what shows is unchanged. `send` false: the page's own copy as it is.
    const compare = (names, send) => p.evaluate(async ([names, send]) => {
      const THREE = await import('three');
      const r = __loft.renderer, gl = r.getContext(), out = [];
      for (const name of names) {
        const live = __loft.screens.textures[name], c = live.image;
        const ref = new THREE.CanvasTexture(c);
        Object.assign(ref, { colorSpace: THREE.SRGBColorSpace, flipY: live.flipY, anisotropy: live.anisotropy });
        if (send) live.needsUpdate = true;
        r.initTexture(live); r.initTexture(ref);
        const read = (tex, level) => {
          const w = Math.max(1, c.width >> level), h = Math.max(1, c.height >> level), px = new Uint8Array(w * h * 4), fb = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.properties.get(tex).__webglTexture || null, level);
          const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
          if (ok) gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          gl.deleteFramebuffer(fb);
          return ok ? px : null;
        };
        const diff = [0, 1].map(level => { const a = read(live, level), z = read(ref, level); if (!a || !z) return 'none'; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== z[i]) n++; return n; });
        r.resetState();
        ref.dispose();
        out.push(`${name} ${diff.join('/')}`);
      }
      return out;
    }, [names, send]);
    const same = await compare(['tv', 'code'], true);
    check('the TV and a desk screen hold the same bytes as when sent the old way (bytes that differ, full size/half size)', same.every(s => / 0\/0$/.test(s)), same.join(', '));
    // Facing the screening wall from close by, its live video plays and the screen becomes a see-through hole: that
    // look's shader is built while the house loads, so no frame waits for it here.
    const shaders = await p.evaluate(() => __loft.renderer.info.programs.length);
    await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); __loft.yaw = -Math.PI / 2; }, b2t(19.0, 7.65, 0));
    const live = await p.waitForFunction(() => __loft.liveVideo.live, null, { timeout: 15000 }).then(() => true, () => false);
    await p.waitForTimeout(2500);
    const wall = await p.evaluate(async () => {
      const THREE = await import('three');
      const cam = __loft.camera, screen = __loft.scene.getObjectByName('screen_video0');
      const view = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      return { hole: screen.material.opacity === 0 && view.intersectsObject(screen), built: __loft.renderer.info.programs.length };
    });
    const built = wall.built - shaders;
    check('facing the screening wall, its live video plays through the hole and no shader is built for it (shaders built)', live && wall.hole && built === 0, !live ? 'the video did not start' : !wall.hole ? 'the hole was not in sight' : `${built}`);
    check('no error', errs.length === 0, errs.slice(0, 3).join(' | '));
    const before = errs.length;
    // A lost graphics context comes back with every screen on it, the ones painted only once too.
    const back = await p.evaluate(() => new Promise(done => {
      const r = __loft.renderer, ext = r.getContext().getExtension('WEBGL_lose_context'), el = r.domElement;
      if (!ext) { done(false); return; }
      el.addEventListener('webglcontextlost', () => setTimeout(() => ext.restoreContext(), 300), { once: true });
      el.addEventListener('webglcontextrestored', () => requestAnimationFrame(() => requestAnimationFrame(() => done(true))), { once: true });
      ext.loseContext();
    }));
    const restored = back ? await compare(['poster', 'tv'], false) : ['the context could not be lost'];
    check('after a lost graphics context comes back, a poster painted once and the TV hold their bytes again (bytes that differ)', restored.every(s => / 0\/0$/.test(s)), restored.join(', ') + (errs.length > before ? ` | page errors after it: ${errs.slice(before, before + 2).join(' | ')}` : ''));
    await p.close();
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
