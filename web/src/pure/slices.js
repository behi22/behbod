// A breath: long enough for a frame or two to be drawn.
export const breathe = () => new Promise(done => setTimeout(done, 30));
// A breath taken in the page's spare time, or after `wait` ms at the latest: for building nobody is waiting on.
export const whenIdle = (wait = 300) => new Promise(done => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => done(), { timeout: wait }) : setTimeout(done, 30)));

// Runs `work` on each item in turn, and after every `budget` ms of it waits on `rest()` (the next frame or so), so a
// long job is spread over many frames instead of freezing one. The work may be asynchronous; it is waited for.
export async function inSlices(items, work, { rest, budget = 8, now = () => performance.now() }) {
  let start = now();
  for (const item of items) {
    await work(item);
    if (now() - start >= budget) { await rest(); start = now(); }
  }
}

// Runs a long job written as steps (a generator that yields between its pieces), waiting on `rest()` after every
// `budget` ms of it; returns what the job returns.
export async function stepsInSlices(steps, { rest, budget = 8, now = () => performance.now() }) {
  let start = now();
  for (;;) {
    const { done, value } = steps.next();
    if (done) return value;
    if (now() - start >= budget) { await rest(); start = now(); }
  }
}
