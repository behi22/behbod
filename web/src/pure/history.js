// The terminal's earlier commands for Up and Down, as in bash: `at` is the line shown, list.length the one being typed.
export const HISTORY_MAX = 50, LINE_MAX = 60;

export const newHistory = () => ({ list: [], at: 0, edits: new Map() });

// Kept unless empty or the same as the one before; a line changed while browsing keeps the change only until Enter.
export function remember(h, line) {
  const s = String(line ?? '').trim().slice(0, LINE_MAX);
  if (s && h.list.at(-1) !== s) {
    h.list.push(s);
    if (h.list.length > HISTORY_MAX) h.list.shift();
  }
  h.at = h.list.length;
  h.edits.clear();
}

// Up (-1) or Down (+1) from the line now shown: the line to show instead, or null when there is none.
export function browse(h, dir, current) {
  const to = h.at + Math.sign(dir);
  if (!dir || to < 0 || to > h.list.length) return null;
  h.edits.set(h.at, String(current ?? ''));
  h.at = to;
  return h.edits.get(to) ?? h.list[to];
}
