// Runs `work` on each item in turn, and after every `budget` ms of it waits on `rest()` (the next frame or so), so a
// long job is spread over many frames instead of freezing one. The work may be asynchronous; it is waited for.
export async function inSlices(items, work, { rest, budget = 8, now = () => performance.now() }) {
  let start = now();
  for (const item of items) {
    await work(item);
    if (now() - start >= budget) { await rest(); start = now(); }
  }
}
