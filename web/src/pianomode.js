// Sitting at the piano: the keyboard plays it (A W S E D F T G Y H U J K O L P ;, Z and X shift the octave), the
// keys on screen light up and can be tapped, and the songs play with BH-22 joining in on the duet.
const CSS = `
.pm { position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 30; width: min(760px, calc(100vw - 32px));
  box-sizing: border-box; padding: 12px; border-radius: 14px; background: rgba(10, 12, 18, .86); border: 1px solid rgba(255,255,255,.14);
  font: 500 12px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #d8dee9; }
.pm-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.pm-row .grow { flex: 1 1 auto; color: #8a93a6; }
.pm button { font: inherit; color: #e8edf5; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: 5px 10px; cursor: pointer; }
.pm button[aria-pressed="true"] { border-color: #3ee6c4; color: #3ee6c4; }
.pm-keys { position: relative; height: 92px; touch-action: none; user-select: none; }
.pm-w { position: absolute; top: 0; height: 92px; box-sizing: border-box; background: #eeeae2; border: 1px solid #23262d; border-radius: 0 0 4px 4px; }
.pm-b { position: absolute; top: 0; height: 56px; background: #15171c; border-radius: 0 0 3px 3px; z-index: 1; }
.pm-w.on { background: #3ee6c4; } .pm-b.on { background: #1fa58c; }
.pm-w.duet { background: #b993ff; } .pm-b.duet { background: #7a52d0; }
.pm-w span { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; color: #6a6f78; font-size: 10px; }
`;
const LO = 48, HI = 84, BLACK = new Set([1, 3, 6, 8, 10]);
const LABELS = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', 'P', ';'];

export function makePianoMode(piano, { onExit, onPlay }) {
  if (!document.getElementById('pm-css')) { const s = document.createElement('style'); s.id = 'pm-css'; s.textContent = CSS; document.head.append(s); }
  let el = null, keys = {}, duet = true, active = false;
  const light = (m, on, who) => { const k = keys[m]; if (!k) return; k.classList.toggle('on', on && who !== 'bh22'); k.classList.toggle('duet', on && who === 'bh22'); };
  function labels() {
    for (const k of Object.values(keys)) k.querySelector('span')?.remove();
    const base = 60 + 12 * piano.octave;
    LABELS.forEach((l, i) => { const k = keys[base + i]; if (k && !BLACK.has((base + i) % 12)) { const s = document.createElement('span'); s.textContent = l; k.append(s); } });
  }
  function build() {
    el = document.createElement('div'); el.className = 'pm'; el.setAttribute('role', 'dialog'); el.ariaLabel = 'Piano';
    const row = document.createElement('div'); row.className = 'pm-row';
    const hint = document.createElement('span'); hint.className = 'grow'; hint.textContent = 'Play with the keys shown, Z and X for the octave';
    row.append(hint);
    for (const s of piano.songs) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = s.title.replace(/ No\. 1$/, '');
      b.addEventListener('click', () => { piano.playSong(s.id, { duet, onNote: n => light(n.midi, n.on, n.who) }); onPlay(); });
      row.append(b);
    }
    const d = document.createElement('button'); d.type = 'button'; d.textContent = 'BH-22 duet'; d.setAttribute('aria-pressed', String(duet));
    d.addEventListener('click', () => { duet = !duet; d.setAttribute('aria-pressed', String(duet)); });
    const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Stop';
    stop.addEventListener('click', () => { piano.stopSong(); for (const m of Object.keys(keys)) light(+m, false); });
    const up = document.createElement('button'); up.type = 'button'; up.textContent = 'Stand up';
    up.addEventListener('click', () => onExit());
    row.append(d, stop, up);
    const board = document.createElement('div'); board.className = 'pm-keys';
    const whites = []; for (let m = LO; m <= HI; m++) if (!BLACK.has(m % 12)) whites.push(m);
    const w = 100 / whites.length;
    keys = {};
    whites.forEach((m, i) => { const k = document.createElement('div'); k.className = 'pm-w'; k.style.left = i * w + '%'; k.style.width = w + '%'; k.dataset.m = m; board.append(k); keys[m] = k; });
    for (let m = LO; m <= HI; m++) {
      if (!BLACK.has(m % 12)) continue;
      const i = whites.indexOf(m - 1);
      const k = document.createElement('div'); k.className = 'pm-b'; k.style.left = (i + 0.68) * w + '%'; k.style.width = w * 0.64 + '%'; k.dataset.m = m; board.append(k); keys[m] = k;
    }
    // Tapping the keys on screen plays them too, so it works on a phone.
    const held = new Map();
    board.addEventListener('pointerdown', e => {
      const m = +e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      board.setPointerCapture(e.pointerId);
      held.set(e.pointerId, m); piano.noteOn(m, 0.75); light(m, true); onPlay();
    });
    const release = e => { const m = held.get(e.pointerId); if (m) { piano.noteOff(m); light(m, false); held.delete(e.pointerId); } };
    board.addEventListener('pointerup', release);
    board.addEventListener('pointercancel', release);
    el.append(row, board);
    document.body.append(el);
    labels();
  }
  return {
    get active() { return active; },
    enter() { if (active) return; active = true; build(); },
    exit() { if (!active) return; active = false; piano.stopSong(); el?.remove(); el = null; },
    // Returns true when the key belonged to the piano.
    key(e) {
      if (e.code === 'KeyZ' || e.code === 'KeyX') { piano.keyToMidi(e); labels(); return true; }
      const m = piano.keyToMidi(e);
      if (m === null) return false;
      if (!e.repeat) { piano.noteOn(m, 0.75); light(m, true); onPlay(); }
      return true;
    },
    keyup(e) { const m = piano.keyToMidi(e); if (m !== null) { piano.noteOff(m); light(m, false); } },
  };
}
