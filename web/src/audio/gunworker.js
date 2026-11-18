import { gunSound } from './pure/gunsound.js';

// Makes one take of a gun's sound off the page's thread and hands its samples over without copying them.
self.onmessage = ({ data }) => {
  const out = gunSound(data.name, data.gun, data.take);
  if (!out) { self.postMessage({ key: data.key }); return; }
  self.postMessage({ key: data.key, L: out[0], R: out[1] }, [out[0].buffer, out[1].buffer]);
};
