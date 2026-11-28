// Local server for the loft. Saving any file under web/ reloads open pages (pass --no-live to turn that off).
const http = require('http'), fs = require('fs'), path = require('path');
// LOFT_ROOT lets the tests serve a scratch folder instead of web/.
const root = process.env.LOFT_ROOT ? path.resolve(process.env.LOFT_ROOT) : path.join(__dirname, 'web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4' };
const args = process.argv.slice(2);
const port = +args.find(a => /^\d+$/.test(a)) || 8810;
const live = !args.includes('--no-live');
const clients = new Set();
// Connect once the page has loaded, so the open connection never counts as the page still loading.
const LIVE = '<script>addEventListener("load", () => new EventSource("/__live").addEventListener("reload", () => location.reload()));</script>';

if (live) {
  // Windows reports a file as changed when it is only read (its last-access time moves), which reloaded the page the
  // first time a lazily loaded file was fetched. So a file counts as changed only when its time and size say so.
  const seen = new Map();
  const stamp = f => { try { const s = fs.statSync(f); return s.isDirectory() ? null : `${s.mtimeMs}:${s.size}`; } catch (e) { return 'gone'; } };
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else seen.set(f, stamp(f)); } };
  walk(root);
  let timer = null;
  fs.watch(root, { recursive: true }, (type, name) => {
    if (name) {
      const f = path.join(root, name), now = stamp(f);
      if (now === null || seen.get(f) === now) return;
      seen.set(f, now);
    }
    clearTimeout(timer);
    // Blender writes models in several chunks, so wait for the writes to settle before reloading.
    timer = setTimeout(() => { for (const c of clients) c.write('event: reload\ndata: 1\n\n'); }, 250);
  });
}

http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/__live') {
    r.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    r.write(': connected\n\n');
    clients.add(r);
    q.on('close', () => clients.delete(r));
    return;
  }
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const type = types[path.extname(f)] || 'application/octet-stream';
  if (live && f.endsWith('.html')) { r.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); return r.end(fs.readFileSync(f, 'utf8').replace('</body>', LIVE + '</body>')); }
  // Files are also served in pieces: Safari will not play a video without it, and seeking in one needs it.
  const size = fs.statSync(f).size, m = /^bytes=(\d*)-(\d*)$/.exec(q.headers.range || '');
  if (m && (m[1] || m[2])) {
    const a = m[1] ? +m[1] : Math.max(0, size - +m[2]), b = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (a > b || a >= size) { r.writeHead(416, { 'content-range': `bytes */${size}` }); return r.end(); }
    r.writeHead(206, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(r);
  }
  r.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes' });
  fs.createReadStream(f).pipe(r);
}).listen(port, '127.0.0.1', () => console.log(`loft on http://127.0.0.1:${port}${live ? ' (live reload on)' : ''}`));
