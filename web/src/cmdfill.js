import { suggest, newFill, step } from './pure/autofill.js';

const CSS = `
.fill-chip { display: none; position: absolute; right: calc(16px + env(safe-area-inset-right, 0px)); bottom: calc(116px + env(safe-area-inset-bottom, 0px)); pointer-events: auto; }
@media (pointer: coarse) { .at-desk .fill-chip.on { display: block; } }
`;

// The phone's command box: a chip just over it shows the command being typed, whole, and a tap fills it in. A keyboard
// on the box gets the desk terminal's keys: Tab and Shift+Tab, and Right Arrow at the end of the line.
export function makeCmdFill(box, names) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const chip = document.createElement('button');
  chip.type = 'button'; chip.className = 'chip fill-chip'; chip.tabIndex = -1;
  box.after(chip);
  let fill = newFill(), best = '';
  const update = () => {
    const s = suggest(box.value, names())[0] || '';
    if (s === best) return;
    best = s;
    chip.textContent = s;
    if (s) chip.setAttribute('aria-label', `Fill in ${s}`);
    chip.classList.toggle('on', !!s);
    // Just over the box, whatever its height.
    if (s && box.offsetHeight) chip.style.bottom = `calc(${76 + box.offsetHeight}px + env(safe-area-inset-bottom, 0px))`;
  };
  const put = line => { box.value = line; box.setSelectionRange(line.length, line.length); update(); };
  box.addEventListener('keydown', e => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    const atEnd = box.selectionStart === box.value.length && box.selectionEnd === box.value.length;
    if (e.key === 'Tab') {
      const line = step(fill, box.value, names(), e.shiftKey ? -1 : 1);
      // While there is a line, Tab stays in the box; an empty box lets it move on as usual.
      if (line !== null) put(line);
      if (line !== null || box.value.trim()) e.preventDefault();
    } else if (e.key === 'ArrowRight' && atEnd && best) { e.preventDefault(); put(best); }
  });
  box.addEventListener('input', () => { fill = newFill(); update(); });
  // Enter and Up or Down change the line without an input event.
  box.addEventListener('keyup', update);
  // A press on the chip leaves the box its focus, so a phone's keyboard stays up.
  chip.addEventListener('pointerdown', e => e.preventDefault());
  chip.addEventListener('click', () => {
    if (!best) return;
    fill = newFill();
    put(best);
    if (document.activeElement !== box) box.focus();
  });
}
