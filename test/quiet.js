// Test browsers stay silent and leave the mouse alone. The house plays music, the piano and the room's sound, and Firefox and WebKit under
// Playwright play it out loud on the machine running the tests. Chrome is muted by a switch, Firefox by its volume
// setting, and every page (WebKit's too) gets a script that sends all sound into a silent node and mutes media.
// WebKit has no switch or setting, and YouTube's player inside the page (the video on the screening wall) plays at
// full volume in it whatever the page asks: measured at the speakers. So a WebKit test page never reaches YouTube.
const VIDEO_HOSTS = /^https?:\/\/([^/]+\.)?(youtube(-nocookie)?\.com|googlevideo\.com)\//;
function silence() {
  if (window.__quiet) return;
  window.__quiet = true;
  // Nor does a test browser ever take the mouse. The range asks to hold the pointer the way a shooter does, and a
  // hidden test window that was given it pinned the real cursor to the edge of the screen. Here the request does
  // nothing; the range still aims with the mouse's own movement.
  if (typeof Element !== 'undefined') Element.prototype.requestPointerLock = function () { return Promise.resolve(); };
  if (typeof AudioNode !== 'undefined') {
    const connect = AudioNode.prototype.connect, hush = new WeakMap();
    AudioNode.prototype.connect = function (to, ...rest) {
      if (typeof AudioDestinationNode !== 'undefined' && to instanceof AudioDestinationNode) {
        let g = hush.get(to);
        if (!g) { g = to.context.createGain(); g.gain.value = 0; connect.call(g, to); hush.set(to, g); }
        connect.call(this, g, ...rest);
        return to;
      }
      return connect.call(this, to, ...rest);
    };
  }
  if (typeof HTMLMediaElement !== 'undefined') {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.muted = true; return play.call(this); };
  }
}

// Launches a browser of this type with its sound off; pages and contexts opened from it run the silencing script.
async function launch(type, opts = {}) {
  const name = type.name();
  const quiet = name === 'chromium' ? { args: [...(opts.args || []), '--mute-audio'] }
    : name === 'firefox' ? { firefoxUserPrefs: { ...(opts.firefoxUserPrefs || {}), 'media.volume_scale': '0.0' } } : {};
  const b = await type.launch({ ...opts, ...quiet });
  const newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
  const hush = async t => { await t.addInitScript(silence); if (name === 'webkit') await t.route(VIDEO_HOSTS, r => r.abort()); return t; };
  b.newContext = async (...a) => hush(await newContext(...a));
  b.newPage = async (...a) => hush(await newPage(...a));
  return b;
}

module.exports = { launch, silence };
