// Something kept in one version per quality (the world outside), changed from one to another without a freeze: the
// new one is built in the background, in steps or in a worker, while the old one stays in use, then swapped in whole.
// Asking for another while one is building stops that build at its next step and throws away all it made; builds
// run one at a time, so nothing is built twice and nothing is left behind.
export const STALE = { stale: true };
export function makeRebuilder({ current, build, swap, discard, onError = e => console.warn(e) }) {
  let target = current, job = 0, queue = Promise.resolve();
  const run = (my, q) => async () => {
    if (my !== job || q === current) return;
    const made = [];
    try {
      const built = await build(q, { made, stale: () => my !== job });
      if (my !== job) { discard(made); return; }
      swap(built, q);
      current = q;
    } catch (e) {
      discard(made);
      if (e !== STALE) onError(e);
    }
  };
  return {
    want(q) {
      if (q === target) return;
      target = q;
      const my = ++job;
      queue = queue.then(run(my, q));
    },
    // Stops any build (the world going away); resolves once it has let go of what it made.
    stop() { job++; target = current; return queue; },
    get current() { return current; },
    get target() { return target; },
  };
}
