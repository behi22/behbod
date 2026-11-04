import { makeRng } from './rng.js';

// Loop textures are rendered once in plain JS, so a loop costs one buffer source at run time.

export function biquad(type, sr) {
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const f = {
    set(freq, q) {
      const w = 2 * Math.PI * Math.min(freq, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
      if (type === 'lp') { b0 = (1 - cs) / 2 / a0; b1 = (1 - cs) / a0; b2 = b0; }
      else if (type === 'hp') { b0 = (1 + cs) / 2 / a0; b1 = -(1 + cs) / a0; b2 = b0; }
      else { b0 = al / a0; b1 = 0; b2 = -al / a0; }
      a1 = -2 * cs / a0; a2 = (1 - al) / a0;
      return f;
    },
    run(x) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    },
  };
  return f;
}

// Render F extra samples and fold them over the head, so the last sample flows into the first.
export function seamLoop(src, L, F) {
  const out = new Float32Array(L);
  out.set(src.subarray(0, L));
  for (let i = 0; i < F; i++) {
    const w = i / F;
    out[i] = src[i] * Math.sqrt(w) + src[L + i] * Math.sqrt(1 - w);
  }
  return out;
}

export function normalize(a, peak) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m;
  return a;
}

const frame = (sr, secs, fade) => { const L = Math.round(sr * secs), F = Math.round(sr * fade); return { L, F, N: L + F }; };

function ring(s, i, sr, f, amp, dec, ph = 0) {
  const len = Math.min(s.length - i, Math.floor(dec * 5));
  for (let k = 0; k < len; k++) s[i + k] += amp * Math.exp(-k / dec) * Math.sin(ph + 2 * Math.PI * f * k / sr);
}

export function crackle(sr, seed = 'crackle') {
  const r = makeRng(seed), { L, F, N } = frame(sr, 5, 0.05), s = new Float32Array(N);
  const hp = biquad('hp', sr).set(1500, 0.7);
  for (let i = 0; i < N; i++) s[i] = hp.run(r.next() * 2 - 1) * 0.01;
  for (let i = 0; ;) {
    i += Math.floor(sr * (r.chance(0.2) ? r.range(0.002, 0.02) : r.range(0.03, 0.3)));
    if (i >= N) break;
    const big = r.chance(0.06), amp = big ? r.range(0.35, 0.7) : 0.03 + 0.25 * Math.pow(r.next(), 2);
    const len = Math.floor(sr * (big ? r.range(0.002, 0.004) : r.range(0.0003, 0.0012)));
    const sign = r.chance(0.5) ? 1 : -1;
    for (let k = 0; k < len && i + k < N; k++) s[i + k] += sign * amp * Math.exp(-k / (len * 0.3)) * (k % 2 ? -0.6 : 1);
  }
  return [seamLoop(s, L, F)];
}

export function rain(sr, seed = 'rain') {
  const { L, F, N } = frame(sr, 6, 0.1), chans = [];
  for (let c = 0; c < 2; c++) {
    const r = makeRng(seed + c), s = new Float32Array(N);
    const lp = biquad('lp', sr).set(5200, 0.6), hp = biquad('hp', sr).set(350, 0.6);
    for (let i = 0; i < N; i++) s[i] = hp.run(lp.run(r.next() * 2 - 1)) * 0.09;
    for (let i = 0; ;) {
      i += Math.floor(sr * r.range(0.002, 0.03));
      if (i >= N) break;
      const big = r.chance(0.04);
      ring(s, i, sr, big ? r.range(1800, 4200) : r.range(3000, 8000), big ? r.range(0.12, 0.25) : r.range(0.01, 0.06),
        sr * (big ? r.range(0.008, 0.02) : r.range(0.0008, 0.003)), r.next() * 6.28);
    }
    chans.push(normalize(seamLoop(s, L, F), 0.7));
  }
  return chans;
}

export function fire(sr, seed = 'fire') {
  const r = makeRng(seed), { L, F, N } = frame(sr, 6, 0.08), s = new Float32Array(N);
  const lp = biquad('lp', sr).set(180, 0.7), hp = biquad('hp', sr).set(3000, 0.7);
  let brown = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr, flick = 0.7 + 0.2 * Math.sin(t * 2.1) + 0.1 * Math.sin(t * 5.3 + 1);
    brown = (brown + 0.02 * (r.next() * 2 - 1)) / 1.02;
    s[i] = lp.run(brown * 3) * 0.5 * flick + hp.run(r.next() * 2 - 1) * 0.012 * flick;
  }
  for (let i = 0; ;) {
    i += Math.floor(sr * (r.chance(0.3) ? r.range(0.004, 0.03) : r.range(0.05, 0.25)));
    if (i >= N) break;
    const amp = 0.04 + 0.6 * Math.pow(r.next(), 4), len = Math.floor(sr * r.range(0.001, 0.006));
    for (let k = 0; k < len && i + k < N; k++) s[i + k] += amp * (r.next() * 2 - 1) * Math.exp(-k / (len * 0.25));
    if (amp > 0.25) ring(s, i, sr, r.range(900, 2600), amp * 0.3, sr * 0.003);
  }
  return [normalize(seamLoop(s, L, F), 0.8)];
}

export function city(sr, seed = 'city') {
  const r = makeRng(seed), secs = 8, { L, F, N } = frame(sr, secs, 0.2), s = new Float32Array(N);
  const lp = biquad('lp', sr).set(220, 0.7), bp = biquad('bp', sr).set(600, 0.7), hp = biquad('hp', sr).set(2000, 0.7);
  let brown = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr, w = 2 * Math.PI * t / secs;
    const swell = 0.5 + 0.3 * Math.sin(2 * w) + 0.2 * Math.sin(5 * w + 1.3);
    brown = (brown + 0.02 * (r.next() * 2 - 1)) / 1.02;
    s[i] = lp.run(brown * 3) * 0.6 + bp.run(r.next() * 2 - 1) * 0.25 * swell + hp.run(r.next() * 2 - 1) * 0.01;
  }
  return [normalize(seamLoop(s, L, F), 0.6)];
}

export function waves(sr, seed = 'waves') {
  const r = makeRng(seed), period = 7, { L, F, N } = frame(sr, period * 2, 0.2), s = new Float32Array(N);
  const lp = biquad('lp', sr), hp = biquad('hp', sr).set(60, 0.7), foam = biquad('hp', sr).set(2500, 0.7);
  const tail = Math.exp(-3.24);
  const env = ph => (ph < 0.46 ? 0.15 + 0.85 * Math.pow(ph / 0.46, 2.2) : 0.15 + 0.85 * (Math.exp(-(ph - 0.46) * 6) - tail) / (1 - tail));
  let e = 0;
  for (let i = 0; i < N; i++) {
    const t = (i % L) / sr, n = Math.floor(t / period);
    if (i % 64 === 0) { e = env((t % period) / period) * (n ? 0.8 : 1); lp.set(300 + 2600 * Math.pow(e, 1.5), 0.6); }
    const x = r.next() * 2 - 1;
    s[i] = hp.run(lp.run(x)) * e + foam.run(x) * Math.max(0, e - 0.6) * 0.5;
  }
  return [normalize(seamLoop(s, L, F), 0.7)];
}

export function wind(sr, seed = 'wind') {
  const r = makeRng(seed), secs = 10, { L, F, N } = frame(sr, secs, 0.2), s = new Float32Array(N);
  const bp = biquad('bp', sr), wh = biquad('bp', sr), lp = biquad('lp', sr).set(400, 0.7);
  let g = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr, w = 2 * Math.PI * t / secs;
    if (i % 64 === 0) {
      const c = 450 + 250 * Math.sin(2 * w) + 120 * Math.sin(5 * w + 1);
      bp.set(c, 3.5); wh.set(c * 2.1, 9);
      g = 0.55 + 0.3 * Math.sin(3 * w + 0.5) + 0.15 * Math.sin(7 * w);
    }
    const x = r.next() * 2 - 1;
    s[i] = (bp.run(x) * 0.8 + wh.run(x) * 0.25 * g + lp.run(x) * 0.3) * g;
  }
  return [normalize(seamLoop(s, L, F), 0.6)];
}

// A purr is a ~25 Hz train of soft noisy pulses, louder breathing out than in.
export function purr(sr, seed = 'purr') {
  const r = makeRng(seed), cycle = [[1.5, 26, 1], [0.12, 0, 0], [1.0, 23, 0.6], [0.08, 0, 0]];
  const one = cycle.reduce((a, c) => a + c[0], 0), { L, F, N } = frame(sr, one * 2, 0.05), s = new Float32Array(N);
  const lp = biquad('lp', sr).set(700, 0.7), hp = biquad('hp', sr).set(30, 0.7);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    let t = (i / sr) % one, k = 0;
    while (t >= cycle[k][0]) { t -= cycle[k][0]; k++; }
    const [len, rate, amp] = cycle[k];
    let x = 0;
    if (rate) {
      ph = (ph + rate / sr) % 1;
      const breath = Math.sqrt(Math.sin(Math.PI * t / len)), pulse = ph < 0.6 ? Math.sin(Math.PI * ph / 0.6) : 0;
      x = (0.4 + 0.6 * (r.next() * 2 - 1)) * pulse * breath * amp;
    }
    s[i] = hp.run(lp.run(x));
  }
  return [normalize(seamLoop(s, L, F), 0.8)];
}

export function printer(sr, seed = 'printer') {
  const r = makeRng(seed), { L, F, N } = frame(sr, 8, 0.1), s = new Float32Array(N);
  for (let i = 0; i < N;) {
    const len = Math.floor(sr * r.range(0.12, 0.9)), axes = r.chance(0.35) ? 2 : 1;
    for (let a = 0; a < axes; a++) {
      const f = r.range(180, 1100), amp = r.range(0.08, 0.14) / axes, ramp = sr * 0.02;
      for (let k = 0; k < len && i + k < N; k++) {
        const p = 2 * Math.PI * f * k / sr, e = Math.min(1, k / ramp, (len - k) / ramp);
        s[i + k] += amp * e * (Math.sin(p) + 0.5 * Math.sin(2 * p) + 0.3 * Math.sin(3 * p));
      }
    }
    i += len + Math.floor(sr * r.range(0, 0.08));
  }
  const lp = biquad('lp', sr).set(900, 0.7);
  for (let i = 0; i < N; i++) s[i] += lp.run(r.next() * 2 - 1) * 0.05 + 0.02 * Math.sin(2 * Math.PI * 140 * i / sr);
  return [normalize(seamLoop(s, L, F), 0.6)];
}

export function reverbIR(sr, secs = 2.2, seed = 'room') {
  const r = makeRng(seed), N = Math.round(sr * secs), pre = Math.round(sr * 0.012), chans = [];
  for (let c = 0; c < 2; c++) {
    const s = new Float32Array(N);
    let y = 0;
    for (let i = pre; i < N; i++) {
      const t = (i - pre) / sr, fc = 9000 - 6500 * Math.min(1, t / secs), a = 1 - Math.exp(-2 * Math.PI * fc / sr);
      y += a * ((r.next() * 2 - 1) - y);
      s[i] = y * Math.exp(-6.9 * t / (secs * 0.85));
    }
    for (let k = 0; k < 6; k++) { const i = pre + Math.floor(sr * r.range(0.008, 0.06)); if (i < N) s[i] += r.range(0.3, 0.6) * (r.chance(0.5) ? 1 : -1); }
    chans.push(s);
  }
  return chans;
}

export const TEXTURES = { crackle, rain, fire, city, waves, wind, purr, printer };
