import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Fetches everything the world needs with one shared progress bar.
export function makeLoader(onProgress) {
  const loader = new GLTFLoader();
  const progress = {};
  const report = () => { const v = Object.values(progress); onProgress(v.reduce((a, b) => a + b, 0) / v.length); };
  async function bytes(url, key) {
    progress[key] = 0;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
    const total = +res.headers.get('content-length') || 0, chunks = [];
    let got = 0;
    for (const reader = res.body.getReader(); ;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (total) { progress[key] = got / total; report(); }
    }
    progress[key] = 1; report();
    const out = new Uint8Array(got);
    for (let o = 0, i = 0; i < chunks.length; o += chunks[i].length, i++) out.set(chunks[i], o);
    return out;
  }
  return {
    async glb(url, key = url) { const b = await bytes(url, key); return new Promise((ok, fail) => loader.parse(b.buffer, '', ok, fail)); },
    // The metadata is tiny and arrives before the models start, so it stays off the progress bar.
    async json(url) { const res = await fetch(url); if (!res.ok) throw new Error(`could not load ${url} (${res.status})`); return res.json(); },
  };
}
