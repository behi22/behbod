// The browser on the computer shows a short list of sites and nothing else. Its safety does not rest on this file
// alone: the page's own security rule (frame-src, in index.html) names the same addresses, so even a link clicked
// inside a shown page cannot take the frame anywhere else; the frame is sandboxed (no pop-ups, no steering the
// house's own page, no forms, no downloads, no dialogs); it is handed no camera, microphone, location or the like;
// it is https only; and where the browser supports it the frame gets none of the visitor's cookies.
// Two things the rule cannot do: a frame that a listed site puts inside its own page answers to that site's rules
// (it does keep the sandbox), and a house served from one of the listed origins would let a link reach itself; so
// the house is served from its own address, with a frame-ancestors header when it goes live.
import { TITLE, STYLE, textWidth, fit } from './desktop.js';

// `voice`: a site you talk to, which needs the microphone the frame is never given.
export const SITES = [
  { id: 'wikipedia', title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Vancouver' },
  { id: 'meet-bex', title: 'Meet Bex', url: 'https://behi22.github.io/meet-bex/', voice: true },
  { id: 'profile-art', title: 'Profile art', url: 'https://behi22.github.io/profile-art/' },
  { id: 'voice-microsite', title: 'Voice microsite', url: 'https://aic-voice-microsite.vercel.app/', voice: true },
];
const BY = Object.fromEntries(SITES.map(s => [s.id, s]));
// Every origin a frame on the page may show: the browser's sites, and the player the videos use.
export const SITE_ORIGINS = [...new Set(SITES.map(s => new URL(s.url).origin))];
export const VIDEO_ORIGIN = 'https://www.youtube-nocookie.com';
export const CSP = `frame-src ${[...SITE_ORIGINS, VIDEO_ORIGIN].join(' ')}`;
// What the frame's page may do: run its own scripts and be itself (keep its own storage). Nothing else is granted:
// no allow-popups, allow-top-navigation, allow-forms, allow-downloads, allow-modals, allow-pointer-lock.
export const SANDBOX = 'allow-scripts allow-same-origin';
// Features that are refused outright, whatever the shown page asks for.
export const REFUSED = ['accelerometer', 'autoplay', 'bluetooth', 'camera', 'clipboard-read', 'clipboard-write', 'display-capture', 'encrypted-media', 'fullscreen',
  'geolocation', 'gyroscope', 'hid', 'magnetometer', 'microphone', 'midi', 'payment', 'picture-in-picture', 'publickey-credentials-get', 'screen-wake-lock', 'serial', 'usb', 'xr-spatial-tracking'];
export const ALLOW = REFUSED.map(f => `${f} 'none'`).join('; ');

// The address as it will be loaded if it is one the browser may show, or null. `own` is the house's own origin,
// which is never shown inside itself (a sandbox means nothing to a page from the same origin as its frame's owner).
export function allowed(url, own = '') {
  if (typeof url !== 'string' || url.length > 2000 || /[\s\\]/.test(url)) return null;
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (!SITE_ORIGINS.includes(u.origin) || u.origin === own) return null;
  return u.href;
}

export const siteById = id => (Object.hasOwn(BY, id) ? BY[id] : null);
export function newBrowser() { return { site: SITES[0].id }; }
// Chooses a site from the list; anything else is ignored.
export function go(b, id) {
  if (!siteById(id)) return false;
  b.site = id;
  return true;
}

const PILL_H = 30, PILL_PAD = 12, FOOT = 44;
const pillW = label => textWidth(label, STYLE.small) + 2 * PILL_PAD;
export const NOTE = 'page blank or blocked?', VOICE = 'to talk to it, use a new tab', NEW_TAB = 'Open in a new tab', ONLY = 'approved sites only';
// Where things go in the browser's window: a row of site buttons under the title (wrapping if the window is narrow),
// the page, and under it the address, the note for a page that will not show here, and the button that opens it in
// a tab of its own. The button and the note always have room; the address takes what is left.
export function browserLayout(w, current = SITES[0].id) {
  const texts = [], pills = [], top = w.y + TITLE, left = w.x + 12, right = w.x + w.w - 12;
  let x = left, y = top + 8;
  for (const s of SITES) {
    const pw = pillW(s.title);
    if (x > left && x + pw > right) { x = left; y += PILL_H + 8; }
    pills.push({ label: s.title, act: 'site:' + s.id, on: s.id === current, x, y, w: pw, h: PILL_H });
    x += pw + 8;
  }
  if (right - x >= textWidth(ONLY, STYLE.small) + 8) texts.push({ s: ONLY, x: right - textWidth(ONLY, STYLE.small), y: y + PILL_H / 2 + 5, px: STYLE.small, c: 'faint', b: 400 });
  const pageY = y + PILL_H + 8, page = { x: w.x + 10, y: pageY, w: w.w - 20, h: Math.max(40, w.y + w.h - FOOT - pageY) };
  const fy = page.y + page.h + (FOOT - PILL_H) / 2, base = fy + PILL_H / 2 + 5;
  const tab = { label: NEW_TAB, act: 'newtab', on: false, w: pillW(NEW_TAB), h: PILL_H, y: fy };
  tab.x = right - tab.w;
  pills.push(tab);
  const site = siteById(current) || SITES[0], addr = site.url.replace(/^https:\/\//, '').replace(/\/$/, ''), note = site.voice ? VOICE : NOTE;
  let end = tab.x - 12;
  if (end - left >= textWidth(note, STYLE.small)) { end -= textWidth(note, STYLE.small); texts.push({ s: note, x: end, y: base, px: STYLE.small, c: 'dim', b: 400 }); end -= 20; }
  const lock = { x: left, y: fy + (PILL_H - 18) / 2, size: 18 }, ax = left + 26;
  // The address only when enough of it fits to be worth reading.
  const shown = end - ax >= textWidth('xxxxxxxxxx', STYLE.small) ? fit(addr, STYLE.small, end - ax) : '';
  if (shown) texts.push({ s: shown, x: ax, y: base, px: STYLE.small, c: 'ink', b: 400 });
  return { texts, pills, page, lock: shown ? lock : null };
}
// The padlock beside the address, a 24 by 24 stroke path like the dock's icons.
export const LOCK = 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6 11h12v9H6zM12 14.5v2';
