// A reading panel over the room: the story book, the about board, and the guestbook and mailbox, which keep what you
// write on this device only until their server is set up. Everything typed is shown with textContent, never as HTML.
const CSS = `
.pn { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgba(5, 7, 11, .55); padding: 16px; }
.pn-box { width: min(520px, 100%); max-height: calc(100dvh - 32px); overflow: auto; box-sizing: border-box; padding: 18px 20px; border-radius: 14px;
  background: rgba(12, 15, 22, .95); border: 1px solid rgba(255,255,255,.14); color: #dfe5ee; font: 400 14px/1.55 system-ui, sans-serif; }
.pn-box h2 { margin: 0 0 10px; font: 600 12px/1.3 ui-monospace, Menlo, Consolas, monospace; letter-spacing: .14em; color: #3ee6c4; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.pn-box p { margin: 8px 0; }
.pn-box .dim { color: #8a93a6; font-size: 12px; }
.pn-box a { color: #3ee6c4; }
.pn-box button { font: 500 12px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #e8edf5; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: 6px 12px; cursor: pointer; }
.pn-box input, .pn-box textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 16px; color: #e8edf5; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.16); border-radius: 8px; padding: 8px 10px; margin: 4px 0; }
.pn-box textarea { min-height: 90px; resize: vertical; }
.pn-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; flex-wrap: wrap; }
.pn-list { list-style: none; padding: 0; margin: 10px 0 0; }
.pn-list li { padding: 8px 0; border-top: 1px solid rgba(255,255,255,.08); overflow-wrap: anywhere; }
.pn-list b { color: #fff; font-weight: 600; }
`;
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };

export function makePanels(store) {
  if (!document.getElementById('pn-css')) { const s = document.createElement('style'); s.id = 'pn-css'; s.textContent = CSS; document.head.append(s); }
  let open = null;
  function show(title, build) {
    close();
    const box = el('div', { className: 'pn-box' });
    const shut = el('button', { type: 'button', textContent: 'Close' });
    shut.addEventListener('click', close);
    const root = el('div', { className: 'pn' }, box);
    root.setAttribute('role', 'dialog'); root.ariaLabel = title;
    root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
    const render = () => { box.replaceChildren(el('h2', {}, title, shut), ...build(render)); };
    render();
    // Keys typed into the panel stay in it; Esc closes it.
    const onKey = e => { e.stopPropagation(); if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey, true);
    document.body.append(root);
    open = { root, onKey };
  }
  function close() {
    if (!open) return;
    removeEventListener('keydown', open.onKey, true);
    open.root.remove();
    open = null;
  }
  const load = key => { try { const v = JSON.parse(store.get(key) || '[]'); return Array.isArray(v) ? v.filter(x => x && typeof x.text === 'string').slice(-30) : []; } catch (e) { return []; } };
  const save = (key, list) => store.set(key, JSON.stringify(list.slice(-30)));

  const STORY = [
    ['The loft', 'A loft that only exists here: a desk that faces the water, a piano, tea always on, and a cat who thinks the keyboard is hers.'],
    ['The residents', 'BH-22 patrols, docks under the stairs and chases the mouse droid it has never caught. Pishi keeps watch from the window or the perch over the fire. Jessi naps by the glass and will fetch for anyone.'],
    ['Look around', 'Most things here do something. Try the bookcase in the library, the telescope on the balcony, and the terminal at the desk. A good score at the holo range opens the last door.'],
  ];
  return {
    get open() { return !!open; },
    close,
    book() {
      let page = 0;
      show('THE STORY', render => {
        const [h, text] = STORY[page];
        const prev = el('button', { type: 'button', textContent: 'Back', disabled: page === 0 });
        const next = el('button', { type: 'button', textContent: page === STORY.length - 1 ? 'The end' : 'Next', disabled: page === STORY.length - 1 });
        prev.addEventListener('click', () => { page--; render(); });
        next.addEventListener('click', () => { page++; render(); });
        return [el('p', {}, el('b', { textContent: h })), el('p', { textContent: text }), el('p', { className: 'dim', textContent: `Page ${page + 1} of ${STORY.length}` }), el('div', { className: 'pn-row' }, prev, next)];
      });
    },
    about() {
      show('ABOUT', () => [
        el('p', {}, el('b', { textContent: 'Behbod Babai' })),
        el('p', { textContent: 'Engineer in Vancouver. I make computers talk back.' }),
        el('p', {}, 'More of my work is on ', el('a', { href: 'https://github.com/behi22', target: '_blank', rel: 'noopener noreferrer', textContent: 'GitHub' }), '.'),
      ]);
    },
    // The guestbook keeps signatures on this device; the shared one comes with its server.
    guestbook() {
      const KEY = 'loft.guestbook';
      show('GUESTBOOK', render => {
        const list = load(KEY);
        const name = el('input', { maxLength: 40, placeholder: 'Your name (optional)', ariaLabel: 'Your name' });
        const text = el('textarea', { maxLength: 200, placeholder: 'Say hello', ariaLabel: 'Your message' });
        const sign = el('button', { type: 'button', textContent: 'Sign' });
        sign.addEventListener('click', () => {
          const t = text.value.trim();
          if (!t) return;
          save(KEY, [...list, { name: name.value.trim().slice(0, 40), text: t.slice(0, 200), at: Date.now() }]);
          render();
        });
        return [
          el('p', { className: 'dim', textContent: 'Saved on this device only, until the shared guestbook is set up.' }),
          name, text, el('div', { className: 'pn-row' }, sign),
          el('ul', { className: 'pn-list' }, ...list.slice().reverse().map(g => el('li', {}, el('b', { textContent: g.name || 'Someone' }), ' ', g.text))),
        ];
      });
    },
    // The mailbox cannot send yet, and says so; a note written here waits on this device.
    mailbox() {
      const KEY = 'loft.mail';
      show('MAILBOX', render => {
        const kept = load(KEY);
        const text = el('textarea', { maxLength: 600, placeholder: 'Write me a note', ariaLabel: 'Your note' });
        const keep = el('button', { type: 'button', textContent: 'Keep it for later' });
        keep.addEventListener('click', () => { const t = text.value.trim(); if (!t) return; save(KEY, [...kept, { text: t.slice(0, 600), at: Date.now() }]); render(); });
        return [
          el('p', { className: 'dim', textContent: 'Sending is not switched on yet. Notes you keep here stay on this device and are not sent anywhere.' }),
          text, el('div', { className: 'pn-row' }, keep),
          el('ul', { className: 'pn-list' }, ...kept.slice().reverse().map(m => el('li', { textContent: m.text }))),
        ];
      });
    },
  };
}
