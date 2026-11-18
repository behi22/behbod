// The intro film over the room: offered at the door, replayed from the TV and the computer.
// A screen taller than it is wide gets the tall cut. open() resolves once it ends or is closed.
const CUTS = { wide: 'assets/film/home-film-wide.mp4', tall: 'assets/film/home-film-tall.mp4' };

export function makeFilm() {
  let current = null;
  function open({ closeLabel = 'Close', muted = false } = {}) {
    if (current) return current.done;
    const tall = innerHeight > innerWidth;
    const box = document.createElement('div');
    box.className = 'video film' + (tall ? ' tall' : '');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'The film');
    const v = document.createElement('video');
    v.src = tall ? CUTS.tall : CUTS.wide;
    v.controls = true; v.playsInline = true; v.preload = 'auto'; v.muted = muted;
    v.setAttribute('playsinline', '');
    const close = document.createElement('button');
    close.className = 'chip'; close.textContent = closeLabel;
    box.append(v, close);
    document.body.append(box);
    let finish, alive = true;
    const me = current = { done: new Promise(r => { finish = r; }) };
    // While it plays, keys stay with the player (no walking about behind it); Esc closes it, and Space pauses it
    // unless a button has the focus, where Space presses that button.
    const onKey = e => {
      e.stopPropagation();
      if (e.key === 'Escape') shut();
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (!e.repeat) { if (v.paused) v.play()?.catch(() => {}); else v.pause(); } }
    };
    function shut() {
      if (!alive) return;
      alive = false;
      v.pause(); v.removeAttribute('src'); v.load();
      removeEventListener('keydown', onKey, true);
      box.remove();
      if (current === me) current = null;
      finish();
    }
    addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    v.addEventListener('ended', shut);
    v.addEventListener('error', () => {
      if (!alive || box.querySelector('.film-note')) return;
      const note = document.createElement('p');
      note.className = 'film-note'; note.textContent = 'The film could not be played here.';
      box.insertBefore(note, close);
    });
    // Started from a click, so it may play with its sound; if the browser still says no, the controls are there.
    v.play()?.catch(() => {});
    box.tabIndex = -1;
    box.focus({ preventScroll: true });
    return me.done;
  }
  return { open, get playing() { return !!current; } };
}
