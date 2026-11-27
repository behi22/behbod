// A key the keyboard's input method is using to put a word together (Persian, Chinese or Japanese keyboards): the Enter
// that picks the word, or an arrow through the choices. Safari sends the Enter after the word is done, marked only by 229.
export const forIme = e => !!e.isComposing || e.keyCode === 229;
