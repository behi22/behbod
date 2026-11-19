// The character's fixes from his Room Lab notes: the cargo pockets low towards the knee, the TV straight on its neck,
// the emoji's round head, the toy head's light beard, wide curls and face, and the mosaic: a soft blur that fades at
// its edge, over the head and over its image in the mirror. Desktop, a phone and the low setting.
//   LOFT_URL=http://127.0.0.1:8814 node test/chars.js
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const SPOT = [7.4, 2.2, 3], MIRROR = [8.25, 1.15, 3];

async function open(b, opts, q) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200)); });
  await p.goto(`${BASE}/?auto&mosaic&q=${q}`);
  await p.waitForFunction(() => window.__loft && __loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  // The mosaic's settings are handed to the character each frame; keep a hold of them to read.
  await p.evaluate(() => { const m = __loft.me, tick = m.tickMosaic; m.tickMosaic = (now, cam, u) => { window.__veil = u; tick(now, cam, u); }; });
  await p.waitForTimeout(1500);
  return { ctx, p, errs };
}
const veil = p => p.evaluate(() => { const u = window.__veil; return { c: u.centre.value.toArray(), r: u.radius.value, c2: u.centre2?.value.toArray() ?? null, r2: u.radius2?.value ?? null }; });
// Stand on a spot facing north (or south, at the mirror), the camera at a set turn from my face and a set distance.
async function stand(p, at, { south = false, turn = 0, dist = 3.3 } = {}) {
  await p.evaluate(([q, yw]) => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = yw; }, [b2t(at[0], at[1] + (south ? 0.8 : -0.8), at[2]), south ? Math.PI : 0]);
  await p.waitForTimeout(300);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(350); await p.keyboard.up('KeyW');
  await p.waitForTimeout(400);
  await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(...at));
  const facing = await p.evaluate(() => __loft.facing);
  await p.evaluate(yw => { __loft.yaw = yw; }, facing + turn);
  await p.mouse.move(400, 300);
  for (let i = 0; i < 16; i++) await p.mouse.wheel(0, -100);
  for (let x = 1.8; x * 1.08 <= dist + 0.01; x *= 1.08) await p.mouse.wheel(0, 100);
  await p.waitForTimeout(1500);
}
// The pose held still (and the head looking straight ahead), so two pictures differ only by the mosaic.
const freeze = (p, on) => p.evaluate(on => {
  const m = __loft.me;
  if (on) { m.__thaw = { animate: m.animate, lookAround: m.lookAround }; const a = m.animate; m.animate = () => a(0, 0, false); m.lookAround = () => {}; }
  else if (m.__thaw) { Object.assign(m, m.__thaw); delete m.__thaw; }
}, on);
const mosaicOff = (p, off) => p.evaluate(off => {
  const m = __loft.me;
  if (off) { m.__tick = m.tickMosaic; m.tickMosaic = (n, c, u) => { m.__tick(n, c, u); u.radius.value = 0; if (u.radius2) u.radius2.value = 0; }; } else if (m.__tick) { m.tickMosaic = m.__tick; delete m.__tick; }
}, off);
// Mean brightness change between two pictures in rings round a point (radii in pixels), and the fine detail in the middle.
async function rings(p, a, b, cx, cy, R) {
  return p.evaluate(async ([a, b, cx, cy, R]) => {
    const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const da = px(A), db = px(B), W = A.width, H = A.height, L = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const bands = [[0, 0.45], [0.9, 1.1], [1.35, 1.7]].map(() => [0, 0]);
    let fineA = 0, fineB = 0;
    for (let y = Math.max(1, Math.floor(cy - 1.8 * R)); y < Math.min(H - 1, cy + 1.8 * R); y++) for (let x = Math.max(1, Math.floor(cx - 1.8 * R)); x < Math.min(W - 1, cx + 1.8 * R); x++) {
      const i = (y * W + x) * 4, d = Math.hypot((x - cx) / 0.85, y - cy) / R;
      [[0, 0.45], [0.9, 1.1], [1.35, 1.7]].forEach(([lo, hi], k) => { if (d >= lo && d < hi) { bands[k][0] += Math.abs(L(da, i) - L(db, i)); bands[k][1]++; } });
      if (d < 0.45) { fineA += Math.abs(L(da, i) - L(da, i + 4)) + Math.abs(L(da, i) - L(da, i + 4 * W)); fineB += Math.abs(L(db, i) - L(db, i + 4)) + Math.abs(L(db, i) - L(db, i + 4 * W)); }
    }
    return { core: bands[0][0] / bands[0][1], edge: bands[1][0] / bands[1][1], outside: bands[2][0] / bands[2][1], fineVeiled: fineA, fineBare: fineB };
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`, cx, cy, R]);
}
const drawn = (p, names) => p.evaluate(ns => ns.map(n => { const o = __loft.scene.getObjectByName(n); if (!o) return null; let v = false; o.traverse(c => { if (!c.isMesh) return; let ok = true; for (let x = c; x; x = x.parent) ok = ok && x.visible; v = v || ok; }); return v; }), names);

async function desktop(b) {
  const { ctx, p, errs } = await open(b, { viewport: { width: 1280, height: 720 } }, 'medium');

  // Every head, hood up and down: the ringed socket shows under every head but the TV (its own neck) and the bare hood head.
  const rows = [];
  let necksOk = true;
  for (const head of ['hood', 'tv', 'visor', 'emoji', 'mosaic']) for (const hood of [true, false]) {
    await p.evaluate(([h, u]) => __loft.me.setLook({ head: h, hood: u }), [head, hood]);
    await p.waitForTimeout(80);
    const [socket, tvNeck] = await drawn(p, ['V3_socket', 'V3_head_tv_neck']);
    const meshes = await p.evaluate(() => __loft.me.headMeshesShown);
    const want = [head !== 'tv' && !(head === 'hood' && !hood), head === 'tv'];
    if (socket !== want[0] || tvNeck !== want[1] || !(meshes > 0)) necksOk = false;
    rows.push(`${head}/${hood ? 'up' : 'down'}:${socket ? 'ring' : '-'}${tvNeck ? '+tvneck' : ''}:${meshes}`);
  }
  check('every head draws, and the TV sits on its own neck with no ring', necksOk, rows.join(' '));

  // The model's own shapes, measured in the page.
  const shape = await p.evaluate(async () => {
    const THREE = await import('three');
    const box = (name, mat) => { const o = __loft.scene.getObjectByName(name), bx = new THREE.Box3(); if (!o) return bx; o.traverse(c => { if (c.isMesh && (!mat || c.material.name === mat)) { c.geometry.computeBoundingBox(); bx.union(c.geometry.boundingBox); } }); return bx; };
    const emoji = box('V3_head_emoji'), tv = box('V3_head_tv'), neck = box('V3_head_tv_neck'), egg = box('V3_head_toy', 'M_Toy');
    // The hair's width above the eyes (the old beard below them shared its colour).
    const top = (egg.min.y + egg.max.y) / 2 + 0.04, hair = new THREE.Box3(), v = new THREE.Vector3();
    __loft.scene.getObjectByName('V3_head_toy').traverse(c => { if (!c.isMesh || c.material.name !== 'M_Hair') return; const a = c.geometry.attributes.position; for (let i = 0; i < a.count; i++) if (v.fromBufferAttribute(a, i).y > top) hair.expandByPoint(v); });
    const mats = {}; __loft.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) mats[m.name] = m; });
    const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return { emojiWide: emoji.max.x - emoji.min.x, emojiDeep: emoji.max.z - emoji.min.z, tvBottom: tv.min.y, neckTop: neck.max.y, neckBottom: neck.min.y,
      eggWide: egg.max.x - egg.min.x, hairWide: hair.max.x - hair.min.x, beard: mats.M_Beard ? lum(mats.M_Beard.color) : null, hairLum: lum(mats.M_Hair.color), face: !!mats.M_Toy_Face };
  });
  check('the emoji head is round behind its screen: deep as a head, not a flat disc', shape.emojiDeep > 0.2 && shape.emojiDeep / shape.emojiWide > 0.65, `${shape.emojiDeep.toFixed(3)} deep x ${shape.emojiWide.toFixed(3)} wide`);
  check('the TV neck runs from inside the hoodie up into the TV', shape.neckTop > shape.tvBottom + 0.005 && shape.neckBottom < shape.tvBottom - 0.15, `neck ${shape.neckBottom.toFixed(3)} to ${shape.neckTop.toFixed(3)}, TV from ${shape.tvBottom.toFixed(3)}`);
  check('the toy head\'s curls reach almost to the ears (over 75% of its width, above the eyes)', shape.hairWide / shape.eggWide > 0.75, `${(100 * shape.hairWide / shape.eggWide).toFixed(0)}%`);
  check('the beard is lighter than the hair, and the toy head has a face', shape.beard !== null && shape.beard > 2 * shape.hairLum && shape.face, `beard ${shape.beard?.toFixed(3)} hair ${shape.hairLum.toFixed(3)}`);

  // The cargo pockets sit low on the thigh, towards the knee, in both fits, while standing.
  for (const fit of ['tapered', 'straight']) {
    await p.evaluate(f => __loft.me.setLook({ head: 'hood', hood: null, fit: { pants: f } }), fit);
    await p.waitForTimeout(150);
    const k = await p.evaluate(async sfx => {
      const THREE = await import('three');
      const L = __loft.me, at = n => L.bones[n].getWorldPosition(new THREE.Vector3()).y;
      const o = __loft.scene.getObjectByName('V3_cargo_l' + sfx), bx = new THREE.Box3().setFromObject(o, true);
      return ((bx.min.y + bx.max.y) / 2 - at('calf_l')) / (at('thigh_l') - at('calf_l'));
    }, fit === 'tapered' ? '_tapered' : '');
    check(`${fit} cargos: the pocket's middle is in the lower part of the thigh, towards the knee`, k > 0.1 && k < 0.4, `${(100 * k).toFixed(0)}% of the way from knee to hip`);
  }

  // The mosaic: a heavy blur over the face that fades out at its edge, nothing beyond it.
  await p.evaluate(() => __loft.me.setLook({ head: 'mosaic', hood: false }));
  await stand(p, SPOT, { turn: 0, dist: 1.8 });
  await freeze(p, true);
  await p.waitForTimeout(400);
  const v = await veil(p);
  const veiled = await p.screenshot();
  await mosaicOff(p, true); await p.waitForTimeout(300);
  const bare = await p.screenshot();
  await mosaicOff(p, false); await freeze(p, false);
  const R = v.r * 720, cx = v.c[0] * 1280, cy = (1 - v.c[1]) * 720;
  check('the mosaic sits over my head', v.r > 0.03 && v.c.every(x => x > 0.2 && x < 0.8) && v.r2 === 0, JSON.stringify(v));
  const ring = await rings(p, veiled, bare, cx, cy, R);
  check('the face under it is blurred: under a third of its fine detail is left', ring.fineVeiled < ring.fineBare / 3, `${Math.round(ring.fineVeiled)} of ${Math.round(ring.fineBare)}`);
  check('it fades out at its edge and changes nothing beyond it', ring.core > 4 && ring.edge < ring.core && ring.outside < 0.5, `change in the middle ${ring.core.toFixed(1)}, at the edge ${ring.edge.toFixed(1)}, outside ${ring.outside.toFixed(2)}`);

  // In the mirror: a second mosaic over my head's image, only while the mirror shows it.
  await p.evaluate(() => __loft.me.setLook({ head: 'mosaic', hood: null }));
  await stand(p, MIRROR, { south: true, turn: Math.PI - 0.6, dist: 2.2 });
  const m1 = await veil(p);
  check('facing the mirror, the mosaic also covers my head in it', m1.r2 > 0.02 && !!m1.c2?.every(x => x > 0 && x < 1), JSON.stringify(m1));
  await p.evaluate(() => __loft.me.setLook({ head: 'tv' })); await p.waitForTimeout(200);
  const m2 = await veil(p);
  check('with another head on, no mosaic anywhere', m2.r === 0 && m2.r2 === 0, JSON.stringify(m2));
  await p.evaluate(() => __loft.me.setLook({ head: 'mosaic', hood: null }));
  await stand(p, [2.55, 1.6, 0], { turn: Math.PI, dist: 3.3 });
  const m3 = await veil(p);
  check('away from the mirror, only the one over my head', m3.r > 0 && m3.r2 === 0, JSON.stringify(m3));
  check('desktop: no page errors, console errors or failed requests', errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}

async function phone(b, q) {
  const { ctx, p, errs } = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, q);
  await p.evaluate(() => __loft.me.setLook({ head: 'mosaic', hood: null }));
  await stand(p, SPOT, { turn: 0.3, dist: 4.3 });
  const v = await veil(p);
  const tier = await p.evaluate(() => __loft.tier);
  // The low setting draws no post effects at all, so the mosaic is not drawn there (as before these fixes).
  if (q !== 'low') check(`phone, ${q} setting: the mosaic sits over my head`, v.r > 0.01 && v.c.every(x => x > 0 && x < 1), `${tier} ${JSON.stringify(v)}`);
  for (const head of ['tv', 'emoji', 'visor', 'hood']) { await p.evaluate(h => __loft.me.setLook({ head: h, hood: null }), head); await p.waitForTimeout(150); }
  check(`phone, ${q} setting: no page errors, console errors or failed requests`, errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}

// The mosaic's shader is only built where post effects run, so Firefox and WebKit check it on the medium setting.
async function otherBrowser(type, name) {
  const b = await launch(type);
  try {
    const { ctx, p, errs } = await open(b, { viewport: { width: 1280, height: 720 } }, 'medium');
    await p.evaluate(() => __loft.me.setLook({ head: 'mosaic', hood: false }));
    await stand(p, SPOT, { turn: 0, dist: 1.8 });
    await freeze(p, true); await p.waitForTimeout(400);
    const v = await veil(p);
    const veiled = await p.screenshot();
    await mosaicOff(p, true); await p.waitForTimeout(300);
    const bare = await p.screenshot();
    const ring = await rings(p, veiled, bare, v.c[0] * 1280, (1 - v.c[1]) * 720, v.r * 720);
    check(`${name}, medium setting: the mosaic blurs the face and nothing beyond it`, ring.fineVeiled < ring.fineBare / 3 && ring.outside < 0.5, `${Math.round(ring.fineVeiled)} of ${Math.round(ring.fineBare)}, outside ${ring.outside.toFixed(2)}`);
    check(`${name}: no page errors, console errors or failed requests`, errs.length === 0, errs.slice(0, 6).join(' | '));
    await ctx.close();
  } finally { await b.close(); }
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    await desktop(b);
    await phone(b, 'medium');
    await phone(b, 'low');
  } finally { await b.close(); }
  await otherBrowser(pw.firefox, 'firefox');
  await otherBrowser(pw.webkit, 'webkit');
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
