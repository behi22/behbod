// The gun wall's outlines into web/assets/range/silhouettes.png and web/src/range/silhouettes.js; run again when a gun
// file changes (test/unit/gunwall.test.mjs says when). Needs the site served: LOFT_URL=http://127.0.0.1:8815 node blender/silhouettes.js
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('../test/quiet');
const ROOT = path.join(__dirname, '..'), BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const PNG = 'assets/range/silhouettes.png', TABLE = path.join(ROOT, 'web/src/range/silhouettes.js');
// Pixels a metre, and the gap around each outline.
const PPM = 512, PAD = 8;
const glbJson = file => { const b = fs.readFileSync(file); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };

(async () => {
  const { RIGS } = await import('../web/src/pure/rigs.js');
  const { outline, HIDDEN } = await import('../web/src/pure/gunwall.js');
  const ids = Object.keys(RIGS).filter(id => id !== 'pistol');
  const guns = {};
  let y = PAD;
  for (const id of ids) {
    const box = outline(glbJson(path.join(ROOT, 'web', RIGS[id].file)));
    const w = Math.ceil((box[2] - box[0]) * PPM), h = Math.ceil((box[3] - box[1]) * PPM);
    guns[id] = { box, px: [PAD, y, w, h] };
    y += h + PAD;
  }
  const W = 1024, H = Math.ceil(y / 4) * 4;
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    const p = await b.newPage();
    const page = `${BASE}/__silhouettes`, three = '0.170.0';
    await p.route(page, r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@${three}/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@${three}/examples/jsm/" } }</script>` }));
    await p.goto(page);
    const url = await p.evaluate(async ({ guns, files, W, H, PPM, hidden }) => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
      const atlas = document.createElement('canvas'); atlas.width = W; atlas.height = H;
      const g = atlas.getContext('2d');
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setClearColor(0x000000, 0);
      const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      for (const [id, { box, px }] of Object.entries(guns)) {
        const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(files[id]);
        const scene = new THREE.Scene();
        scene.add(gltf.scene);
        gltf.scene.traverse(o => { if (new RegExp(hidden).test(o.name)) o.visible = false; if (o.isMesh) o.material = white; });
        // From the gun's left, the side the wall shows.
        const [, , w, h] = px, cx = box[0] + w / PPM / 2, cy = box[1] + h / PPM / 2;
        const cam = new THREE.OrthographicCamera(-w / PPM / 2, w / PPM / 2, h / PPM / 2, -h / PPM / 2, 0.01, 10);
        cam.position.set(cx, cy, -5); cam.up.set(0, 1, 0); cam.lookAt(cx, cy, 0);
        r.setSize(w, h, false);
        r.render(scene, cam);
        g.drawImage(r.domElement, px[0], px[1]);
      }
      return atlas.toDataURL('image/png');
    }, { guns, files: Object.fromEntries(ids.map(id => [id, `/${RIGS[id].file}`])), W, H, PPM, hidden: HIDDEN.source });
    fs.writeFileSync(path.join(ROOT, 'web', PNG), Buffer.from(url.split(',')[1], 'base64'));
  } finally { await b.close(); }
  // `covers` is a whole number of pixels, a little more than `box`.
  const table = {};
  for (const [id, { box, px: [x, y0, w, h] }] of Object.entries(guns)) {
    table[id] = { box, covers: [box[0], box[1], +(box[0] + w / PPM).toFixed(4), +(box[1] + h / PPM).toFixed(4)],
      uv: [+(x / W).toFixed(5), +(1 - (y0 + h) / H).toFixed(5), +((x + w) / W).toFixed(5), +(1 - y0 / H).toFixed(5)] };
  }
  fs.writeFileSync(TABLE, `// Made by blender/silhouettes.js from the gun files: do not edit by hand.\nexport const SILHOUETTES = ${JSON.stringify({ file: PNG, size: [W, H], guns: table })};\n`);
  console.log('wrote', PNG, fs.statSync(path.join(ROOT, 'web', PNG)).size, 'bytes, and', path.relative(ROOT, TABLE));
})().catch(e => { console.error(e); process.exit(1); });
