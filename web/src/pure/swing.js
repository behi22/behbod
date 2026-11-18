// A charm on its chain, stepped the Verlet way so it lags when the gun is swung and settles back under the hook.
const G = 9.8, STEP = 1 / 120;

export function newSwing(hook, len) {
  const b = [hook[0], hook[1] - len, hook[2]];
  return { b, prev: [...b], len, hook: [...hook] };
}

// A long stall (a hidden tab) or a broken number leaves it hanging still rather than flinging it off.
export function swing(st, hook, dt, { damp = 2.2, gravity = G } = {}) {
  if (!(dt > 0)) return dir(st, hook);
  if (dt > 0.25 || !st.b.every(Number.isFinite) || !hook.every(Number.isFinite)) { Object.assign(st, newSwing(hook, st.len)); return [0, -1, 0]; }
  // The hook is moved across the frame in the small steps too, so a fast frame is no sudden jerk.
  const n = Math.ceil(dt / STEP), h = dt / n, keep = Math.exp(-damp * h), from = st.hook || hook;
  for (let i = 1; i <= n; i++) {
    const b = st.b, p = st.prev, at = from.map((v, j) => v + (hook[j] - v) * i / n);
    const next = [b[0] + (b[0] - p[0]) * keep, b[1] + (b[1] - p[1]) * keep - gravity * h * h, b[2] + (b[2] - p[2]) * keep];
    st.prev = b;
    st.b = onChain(next, at, st.len);
  }
  st.hook = [...hook];
  return dir(st, hook);
}

// The point at `len` from the hook in the direction of p (straight down if p is on the hook).
function onChain(p, hook, len) {
  const d = [p[0] - hook[0], p[1] - hook[1], p[2] - hook[2]], l = Math.hypot(...d);
  if (l < 1e-9) return [hook[0], hook[1] - len, hook[2]];
  return [hook[0] + d[0] * len / l, hook[1] + d[1] * len / l, hook[2] + d[2] * len / l];
}
function dir(st, hook) {
  const d = [st.b[0] - hook[0], st.b[1] - hook[1], st.b[2] - hook[2]], l = Math.hypot(...d) || 1;
  return d.map(v => v / l);
}
