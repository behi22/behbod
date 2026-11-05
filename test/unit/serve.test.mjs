import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, utimesSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

const SERVER = new URL('../../serve.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const wait = ms => new Promise(r => setTimeout(r, ms));

// Listens to the server's reload stream and counts reloads.
function listen(port) {
  return new Promise((resolve, reject) => {
    const s = { reloads: 0 };
    const req = http.get({ host: '127.0.0.1', port, path: '/__live' }, res => {
      res.setEncoding('utf8');
      res.on('data', d => { s.reloads += (d.match(/event: reload/g) || []).length; });
      s.close = () => req.destroy();
      resolve(s);
    });
    req.on('error', reject);
  });
}

// Regression: on Windows a file that is only read gets a new last-access time, the watcher reported it, and the page
// reloaded (pressing E on a game loads its file and threw you back to the start screen).
test('the live server reloads when a file changes, never when it is only read', async t => {
  const root = mkdtempSync(join(tmpdir(), 'serve-test-'));
  const f = join(root, 'game.js');
  writeFileSync(f, 'export const a = 1;\n');
  // Whole-second times, so moving only the access time later leaves the modified time exactly as it was.
  const t0 = new Date(Math.floor(Date.now() / 1000) * 1000 - 60000);
  utimesSync(f, t0, t0);
  const port = 8900 + Math.floor(Math.random() * 90);
  const child = spawn(process.execPath, [SERVER, String(port)], { env: { ...process.env, LOFT_ROOT: root }, stdio: 'pipe' });
  t.after(() => { child.kill(); rmSync(root, { recursive: true, force: true }); });
  await new Promise((res, rej) => { child.stdout.on('data', res); child.on('error', rej); });
  await wait(300);
  const s = await listen(port);
  t.after(() => s.close());

  utimesSync(f, new Date(t0.getTime() + 30000), t0);
  assert.equal(statSync(f).mtimeMs, t0.getTime(), 'the modified time must not move');
  await wait(800);
  assert.equal(s.reloads, 0, 'a read (only the access time moved) must not reload the page');

  writeFileSync(f, 'export const a = 2;\n');
  await wait(800);
  assert.equal(s.reloads, 1, 'a real change reloads once');
});
