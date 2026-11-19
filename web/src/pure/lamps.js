// The light switch by the front door. `day`: daylight outside, 0 to 1; `lamps`: the switch eased, 0 off to 1 on.

// Stair-tread night lights and the balcony's string lights are not on it, so the dark house stays walkable.
const ON_SWITCH = /^(ceiling_light|downlight|\w*_bulb|pianolamp_glow|video_lamp\d*_glow|lightbar_glow|shelf_led|island_led|tea_cabinet_glow|kilim_light_glow|trophy_led)/;
export const WARM = ['E_warm', 'E_warm_soft'];
export const onSwitch = (name, material) => WARM.includes(material) && ON_SWITCH.test(name);

// What the window still gives with the lamps off, in linear light: a dim moonlit room by night, most of it by day.
export const OFF = { night: [0.09, 0.105, 0.16], day: [0.5, 0.53, 0.6] };
export const BULB_OFF = { night: 0.05, day: 0.16 };
export const FILL_OFF = { night: 0.3, day: 0.75 };

const mix = (a, b, t) => a + (b - a) * t;
// At lamps = 1 every level is exactly 1, whatever the day, so the house with the lamps on looks as it always has.
const level = (off, lamps) => 1 - (1 - off) * (1 - lamps);
const clamp = v => Math.min(1, Math.max(0, v));

export function roomLight(day, lamps) {
  const d = clamp(day), l = clamp(lamps);
  return OFF.night.map((n, i) => level(mix(n, OFF.day[i], d), l));
}
export const bulbLight = (day, lamps) => level(mix(BULB_OFF.night, BULB_OFF.day, clamp(day)), clamp(lamps));
export const fillLight = (day, lamps) => level(mix(FILL_OFF.night, FILL_OFF.day, clamp(day)), clamp(lamps));

// Settles exactly on 0 or 1, so a finished flip back on leaves every level at exactly 1.
export function settle(k, on, dt) {
  const to = on ? 1 : 0, rate = on ? 14 : 20, next = k + (to - k) * Math.min(1, dt * rate);
  return Math.abs(next - to) < 0.004 ? to : next;
}

// The balcony, past the window wall, keeps its own lights.
export const GLASS_Y = 15.12;
export const indoors = y => y < GLASS_Y;

// The fire's glow is the one warm light kept low (under 1 m), so it is told apart from the lamps by height.
export function lightRole(l) {
  if (l.kind === 'hemi' || l.kind === 'sun') return 'fill';
  if (l.kind !== 'point' || l.role === 'rgb') return null;
  const [, y, z] = l.at;
  if (y < 0 || !indoors(y) || z < 1) return null;
  const c = parseInt(String(l.color).replace('#', ''), 16), r = c >> 16, b = c & 255;
  return r > b ? 'lamp' : null;
}

// The spot sits a little north of the switch so the character does not stand in front of it.
export const SWITCH = { wall: 4.925, y: 0.32, z: 1.2, w: 0.085, h: 0.13 };
export const SPOT = { id: 'light_switch', at: [4.42, 0.62, 0], r: 0.45 };
export const label = on => (on ? 'Turn the lights off' : 'Turn the lights on');
export const said = on => (on ? 'Lights on.' : 'Lights off.');
export function lightsCommand(arg, on) {
  const a = String(arg || '').trim().toLowerCase();
  if (a === 'on' || a === 'off') return { set: a === 'on', lines: [a === 'on' ? 'lights on.' : 'lights off. the switch by the front door turns them back on.'] };
  if (a) return { set: null, lines: ['lights on  or  lights off'] };
  return { set: null, lines: [`the lights are ${on ? 'on' : 'off'}. lights on  or  lights off`] };
}
