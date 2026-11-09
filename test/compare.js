// Before and after: the same fixed cameras and standing spots in two versions of the house, side by side, with how much
// of each picture changed. Run it before every commit that touches the room; a change nobody asked for is a regression.
//   node test/compare.js [ref] [outdir]    ref: the git version to compare the working copy with (default HEAD)
// It serves one version at a time from a temporary copy, with one muted browser, and writes the pairs to outdir
// (default test-output/compare) with a summary of every view, most changed first.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { execFileSync, spawn } = require('child_process');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');

const ROOT = path.join(__dirname, '..');
const REF = process.argv[2] || 'HEAD';
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'test-output', 'compare'));
const PORT = Number(process.env.COMPARE_PORT || 8899);
const T = (x, y, z) => [x, z, -y];
const b2t = (x, y, z) => ({ x, y: z, z: -y });

// Fixed cameras, eye and target in the room's own coordinates (x east, y north, z up), drawn without the character.
const CAMERAS = {
  overview: [[1.0, 1.0, 5.5], [12, 9, 0]],
  lounge_wide: [[10.5, 13.5, 1.9], [6.0, 10.2, -0.2]],
  lounge_couches: [[9.2, 10.2, 1.2], [5.5, 10.2, -0.1]],
  lounge_west: [[2.0, 10.2, 1.4], [7.0, 10.2, -0.1]],
  couch_north: [[6.4, 9.4, 0.9], [6.4, 11.8, -0.1]],
  couch_south: [[6.4, 11.0, 0.9], [6.4, 8.6, -0.1]],
  couch_east: [[5.0, 10.2, 0.9], [7.8, 10.2, -0.1]],
  studio_wide: [[16.5, 4.5, 2.2], [20.5, 1.5, 0.8]],
  studio_rug: [[18.4, 4.2, 2.8], [20.4, 2.0, 0.45]],
  desk: [[18.9, 3.0, 2.0], [21.3, 1.5, 1.0]],
  piano: [[13.5, 11.5, 1.7], [16.0, 8.9, 0.6]],
  teabar: [[11.5, 5.2, 1.7], [14.75, 8.5, 0.9]],
  entry: [[4.5, 5.5, 1.7], [1.5, 2.5, 1.0]],
  library: [[11.5, 6.5, 1.7], [9.0, 2.0, 1.2]],
  videos: [[16.0, 9.6, 1.7], [21.5, 9.6, 1.6]],
  mezz: [[9.5, 3.5, 4.6], [4.0, 2.0, 3.2]],
  stairs: [[4.5, 8.0, 1.7], [1.5, 10.0, 1.5]],
  balcony: [[11.0, 14.0, 1.7], [11.0, 17.0, 0.6]],
  skylight: [[16.2, 8.6, 1.7], [18.3, 11.0, 6.5]],
};
// Standing spots (x, y, floor height, facing): the real picture a visitor sees, page layers and effects included.
const SPOTS = { spawn: [2.55, 1.2, 0, 0.15], lounge: [10.6, 11.6, 0, -2.0], studio: [15.6, 4.4, 0.45, -2.2], piano: [16.0, 8.9, 0, 0.6],
  teabar: [14.6, 9.4, 0, 0.1], mezz: [9.5, 2.0, 3.0, 2.0], stairs: [2.0, 9.2, 0, 2.4], videos: [19.2, 9.6, 0, -1.4], library: [9.0, 3.6, 0, -2.4] };

const up = () => new Promise(res => {
  const req = http.get(`http://127.0.0.1:${PORT}/`, r => { r.resume(); res(r.statusCode === 200); });
  req.on('error', () => res(false));
});

async function serve(dir) {
  if (await up()) throw new Error(`port ${PORT} is already in use; stop that server or set COMPARE_PORT`);
  const child = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT), '--no-live'], { env: { ...process.env, LOFT_ROOT: dir }, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  if (!(await up())) { child.kill(); throw new Error(`the server did not start for ${dir}`); }
  return child;
}

// Every picture of one version, as PNG buffers by name.
async function shoot(dir) {
  const server = await serve(dir);
  const shots = {}, errs = [];
  let b;
  try {
    b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://127.0.0.1:${PORT}/?auto&q=ultra`);
    await p.waitForFunction(() => window.__loft, null, { timeout: 120000 });
    await p.waitForTimeout(3000);
    for (const [name, [e, a]] of Object.entries(CAMERAS)) {
      const eye = T(...e), at = T(...a);
      // Stand near the view first, so anything that only wakes up close by is awake in both versions.
      await p.evaluate(([x, y, z]) => { __loft.pos.set(x, y, z); }, [eye[0], Math.max(0, eye[1] - 1.5), eye[2]]);
      await p.waitForTimeout(900);
      const url = await p.evaluate(async ([e, a]) => {
        const THREE = await import('three');
        const L = __loft, c = L.camera.clone(), r = L.renderer;
        c.position.set(...e); c.lookAt(...a); c.fov = 60; c.near = 0.05; c.aspect = 1280 / 720; c.updateProjectionMatrix();
        const pr = r.getPixelRatio(), clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha();
        // An opaque background, so a version that draws its sky behind the canvas does not read as a change.
        r.setPixelRatio(1); r.setSize(1280, 720, false); r.setClearColor(0x101318, 1);
        const vis = L.me.root.visible; L.me.root.visible = false;
        r.render(L.scene, c);
        const out = r.domElement.toDataURL('image/png');
        L.me.root.visible = vis; r.setClearColor(clear, alpha); r.setPixelRatio(pr);
        return out;
      }, [eye, at]);
      shots[`camera-${name}`] = Buffer.from(url.split(',')[1], 'base64');
    }
    await p.close();
    // In game at 2x, like a sharp laptop screen.
    const g = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    g.on('pageerror', e => errs.push(e.message));
    await g.goto(`http://127.0.0.1:${PORT}/?auto&q=ultra`);
    await g.waitForFunction(() => window.__loft, null, { timeout: 120000 });
    await g.waitForTimeout(3000);
    for (const [name, [x, y, z, yaw]] of Object.entries(SPOTS)) {
      await g.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); __loft.yaw = yw; }, [b2t(x, y, z), yaw]);
      await g.waitForTimeout(1500);
      shots[`spot-${name}`] = await g.screenshot();
    }
    shots.tier = await g.evaluate(() => `${__loft.tier} at ${__loft.renderer.getPixelRatio()}x`);
  } finally {
    await b?.close();
    server.kill();
  }
  return { shots, errs };
}

// Puts each pair side by side at 640 x 360 and measures the share of pixels that changed clearly.
async function pairUp(before, after, labels) {
  const b = await launch(pw.chromium, { channel: 'chrome' });
  const rows = [];
  try {
    const p = await b.newPage();
    for (const name of Object.keys(before).filter(k => k !== 'tier' && after[k])) {
      const r = await p.evaluate(async ([a, c, title]) => {
        const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const [A, C] = await Promise.all([img(a), img(c)]);
        const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 380;
        const g = cv.getContext('2d');
        g.fillStyle = '#14161a'; g.fillRect(0, 0, 1280, 380);
        g.drawImage(A, 0, 20, 640, 360); g.drawImage(C, 640, 20, 640, 360);
        const pa = g.getImageData(0, 20, 640, 360).data, pc = g.getImageData(640, 20, 640, 360).data;
        let changed = 0;
        for (let i = 0; i < pa.length; i += 4) if ((Math.abs(pa[i] - pc[i]) + Math.abs(pa[i + 1] - pc[i + 1]) + Math.abs(pa[i + 2] - pc[i + 2])) / 3 > 40) changed++;
        const pct = (changed / (640 * 360)) * 100;
        g.fillStyle = '#fff'; g.font = '13px monospace';
        g.fillText(`${title}   ${pct.toFixed(1)}% changed`, 8, 14);
        return { pct, url: cv.toDataURL('image/png') };
      }, [`data:image/png;base64,${before[name].toString('base64')}`, `data:image/png;base64,${after[name].toString('base64')}`, `${name}   ${labels[0]}  |  ${labels[1]}`]);
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
      rows.push([r.pct, name]);
    }
  } finally {
    await b.close();
  }
  return rows.sort((a, b) => b[0] - a[0]);
}

(async () => {
  const sha = execFileSync('git', ['rev-parse', '--short', REF], { cwd: ROOT }).toString().trim();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `house-${sha}-`));
  try {
    // That version's web folder, file by file (no tar: which one is on the path differs between shells).
    const files = execFileSync('git', ['ls-tree', '-r', '--name-only', REF, 'web'], { cwd: ROOT }).toString().split(/\r?\n/).filter(Boolean);
    for (const f of files) {
      fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true });
      fs.writeFileSync(path.join(tmp, f), execFileSync('git', ['show', `${REF}:${f}`], { cwd: ROOT, maxBuffer: 1 << 28 }));
    }
    fs.mkdirSync(OUT, { recursive: true });
    // Only this script's own pictures from a last run are cleared.
    for (const f of fs.readdirSync(OUT)) if (/^(camera|spot)-[a-z_0-9]+\.png$/.test(f) || f === 'summary.txt') fs.rmSync(path.join(OUT, f));
    const before = await shoot(path.join(tmp, 'web'));
    const after = await shoot(path.join(ROOT, 'web'));
    const rows = await pairUp(before.shots, after.shots, [sha, 'now']);
    const lines = [
      `${sha} (${before.shots.tier}) against the working copy (${after.shots.tier}), ${rows.length} pictures`,
      ...rows.map(([pct, name]) => `${pct.toFixed(1).padStart(5)}%  ${name}`),
      `page errors: ${sha} ${before.errs.length ? before.errs.join(' | ') : 'none'}, now ${after.errs.length ? after.errs.join(' | ') : 'none'}`,
    ];
    fs.writeFileSync(path.join(OUT, 'summary.txt'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
    console.log(`pairs in ${OUT}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(e => { console.error(e.message); process.exit(1); });
