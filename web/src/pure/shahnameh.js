// The Shahnameh in the house: Ferdowsi's book of kings, finished about 1010. Every retelling and translation here is
// our own, kept short and plain. Blender axes where there are places: the desk chair looks along +x, z is up.

// The couplet on the second sticky note on the monitor, and what the terminal's `ferdowsi` prints.
export const COUPLET = {
  fa: ['توانا بود هر که دانا بود', 'ز دانش دل پیر برنا بود'],
  latin: ['tavana bovad har ke dana bovad', 'ze danesh del-e pir borna bovad'],
  en: 'Whoever knows is strong; with knowledge an old heart grows young.',
};
export const NOTE_SAY = `Ferdowsi, about 1010: "${COUPLET.en}"`;
// The meaning goes over two lines, at its semicolon, so each fits the terminal.
export const ferdowsiLines = () => {
  const [a, b] = COUPLET.en.split('; ');
  return ['Ferdowsi, Shahnameh, about 1010:', ...COUPLET.fa.map(l => '  ' + l), ...COUPLET.latin.map(l => '  ' + l), `  "${a};`, `   ${b}"`];
};

// The reader app's stories, a paragraph to a line.
export const STORIES = [
  { id: 'zal', tab: 'Zal', title: 'Zal and the Simorgh', fa: 'زال و سیمرغ', pic: 'A painting: the Simorgh over Zal in her nest on Mount Alborz.', text: [
    "Zal was born to the champion Sam with hair as white as an old man's. Sam was ashamed, afraid of what people would say, and had the baby left on the slopes of Mount Alborz.",
    'The Simorgh, the great wise bird who nested on the peak, found him crying among the rocks. She carried him up to her nest and raised him with her own young, and he grew tall and strong.',
    'Years later Sam dreamed of his son and went to the mountain in sorrow, asking to be forgiven. The Simorgh brought Zal down to his father and gave him one of her feathers: if you are ever in trouble, burn it, and I will come.',
    "Zal kept the feather all his life. When his son Rostam was born, it was that feather, and the Simorgh's help, that saved the mother and the child.",
  ] },
  { id: 'labours', tab: 'Seven Labours', title: 'The Seven Labours of Rostam', fa: 'هفت‌خوان رستم', pic: "A painting: Rostam on Rakhsh before the White Div's cave.", text: [
    'King Kay Kavus marched into Mazandaran, the land of the divs. With his sorcery the White Div struck the king and his army blind and held them captive.',
    'Rostam rode out alone on Rakhsh by the short and dangerous road, and faced seven trials on the way.',
    'A lion came for him while he slept, and Rakhsh fought it alone and killed it. In a burning desert, close to dying of thirst, he followed a ram to a spring. A dragon came in the night and twice hid in the dark before Rostam saw it; he and Rakhsh killed it together. A sorceress came to him as a lovely young woman, and he saw through her. He caught Olad with his lasso and made him show the way. He beat the div Arzhang and scattered his army.',
    "Last, in a dark cave behind seven mountains, he fought the White Div and won, and the div's blood gave the king and his men their sight back.",
  ] },
  { id: 'siavash', tab: 'Siavash', title: 'Siavash and the Fire', fa: 'گذر سیاوش از آتش', pic: 'A painting: Siavash riding his black horse through the fire.', text: [
    'Siavash, son of King Kay Kavus, was raised by Rostam and grew up gentle, brave and honest.',
    'His stepmother, Queen Sudabeh, fell in love with him. When he turned her away, she told the king that Siavash had wronged her, and the king did not know whom to believe.',
    'So two great hills of wood were piled on the plain with a narrow road between them, and set alight. Siavash, dressed in white, rode his black horse into the fire while the whole city watched.',
    'The flames closed over him. Then he rode out on the other side, he and his horse unharmed. Everyone knew he had told the truth, and Siavash even asked the king to spare the queen.',
  ] },
  { id: 'sohrab', tab: 'Sohrab', title: 'Rostam and Sohrab', fa: 'رستم و سهراب', pic: 'A painting: Rostam and Sohrab face to face between their camps.', text: [
    'Out hunting near the border, Rostam lost Rakhsh and followed the tracks to the city of Samangan. There he met the princess Tahmineh, and they married. Before he left, he gave her a token for their child.',
    'Their son Sohrab grew up strong and fearless. While still very young, he rode to war against Iran, hoping to find the father he had never met.',
    'Rostam was sent to face the young champion. Neither knew the other: Rostam hid his name, and no one would tell Sohrab which man was his father. They fought for three days, and on the last, Rostam struck him down.',
    "As he lay dying, Sohrab said his father Rostam would avenge him. Rostam saw his own token on the young man's arm and knew him at last. He begged the king for a healing potion, but the king held it back, and Sohrab died.",
  ] },
];
const STORY_BY = Object.fromEntries(STORIES.map(s => [s.id, s]));
export const storyById = id => (Object.hasOwn(STORY_BY, id) ? STORY_BY[id] : null);

// BH-22's stories by the fire, a few lines each, told one line at a time.
export const FIRESIDE = [
  ['A baby with white hair was left alone on a mountain.', 'The Simorgh, a great wise bird, raised him in her nest. His name was Zal.', 'When he went home she gave him a feather: burn it, and I will come.'],
  ['Rostam needed a horse strong enough to carry him.', 'He pressed his hand on horse after horse, and each one sank under it.', 'One did not: a fiery colt called Rakhsh. His price, said the herdsman, was to keep Iran safe.'],
  ['Prince Siavash was blamed for a wrong he never did.', 'To prove it, he rode his black horse into a great fire.', 'He came out the other side without a single burn.'],
  ['Rostam and Sohrab met in battle, father and son, and neither knew it.', 'Rostam won, and only then saw the token he had left for his son.', 'It is the saddest story in the Shahnameh.'],
  ['A king of India sent Khosrow a chessboard with no rules, as a riddle.', 'The wise vizier Bozorgmehr worked the game out in a day and a night.', 'Then he invented nard, backgammon, and sent it back. India never solved it.'],
  ["Rostam's last labour: the White Div, in a dark cave behind seven mountains.", 'He waited until the sun was high, when divs sleep, and went in.', "He won, and the div's blood gave a blinded king his sight back."],
];
// The story for this visit: each visit starts one further along, and asking again in the same visit goes on from there.
export const firesideAt = (visit, told) => FIRESIDE[(((visit + told) % FIRESIDE.length) + FIRESIDE.length) % FIRESIDE.length];

// The plaques by the holochess table and the backgammon table.
export const PLAQUES = {
  plaque_chess: { title: 'The riddle of chess', fa: 'شطرنج', text: "In the Shahnameh, a king of India sends Khosrow Anushirvan a chessboard and its pieces, with no rules, as a riddle: work out how it is played, or pay tribute. The king's wise vizier, Bozorgmehr, studies it for a day and a night and plays it through." },
  plaque_nard: { title: "Bozorgmehr's answer", fa: 'نرد', text: 'Then Bozorgmehr invents a game of his own, nard, played with two dice, and it goes to India as a riddle in return. Its sages cannot work it out, and India pays the tribute. Nard is the backgammon on this table.' },
};

// Where the plaques are: on the sunken lounge's north step face behind the holochess table (blender/zones/lounge.py),
// and as a small angled plate on the backgammon table's near edge (blender/zones/balcony.py). Corners top left, top
// right, bottom left, bottom right as seen by someone reading it; `spot` is where E reads it, beside the game's own.
export const PLAQUE_AT = {
  plaque_chess: { corners: [[7.86, 13.595, -0.06], [8.34, 13.595, -0.06], [7.86, 13.595, -0.36], [8.34, 13.595, -0.36]], size: [1024, 640], spot: [8.8, 12.05, -0.45] },
  plaque_nard: { corners: [[14.89, 16.316, 0.8235], [15.11, 16.316, 0.8235], [14.89, 16.27, 0.758], [15.11, 16.27, 0.758]], size: [1024, 372], spot: [15.6, 15.75, 0], short: true },
};

// The second sticky note: beside the tattoo post-it (blender/zones/studio.py) on the right-hand end of the curved
// monitor's bottom bezel, a little further in and leaning the other way. Corners top left, top right, bottom left,
// bottom right, as seen from the chair.
export const NOTE = { size: 0.095, inset: 0.215, lean: 7, tilt: 3 };
const rad = d => d * Math.PI / 180;
const turn = (v, k, t) => {
  const c = Math.cos(t), s = Math.sin(t), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return v.map((q, i) => q * c + x[i] * s + k[i] * d * (1 - c));
};
export function noteCorners({ center: [cx, cy, cz], w, h, r }) {
  const a = -Math.asin((w / 2 - NOTE.inset) / r), S = NOTE.size;
  const top = [cx - r * (1 - Math.cos(a)), cy + r * Math.sin(a), cz - h / 2 - 0.005];
  const toward = [-Math.cos(a), -Math.sin(a), 0], along = [-Math.sin(a), Math.cos(a), 0];
  return [[S / 2, 0], [-S / 2, 0], [S / 2, -S], [-S / 2, -S]].map(([y, z]) => {
    const v = turn(turn(turn([0, y, z], [0, 0, 1], a), toward, rad(NOTE.tilt)), along, rad(NOTE.lean));
    return v.map((q, i) => top[i] + toward[i] * 0.004 + q);
  });
}

// By the fire: the lounge's sitting group in front of the fireplace on its west wall (blender/zones/lounge.py), on the
// ground floor. x and north in Blender metres, h the height.
export const FIRE = { x0: 0.4, x1: 7.2, y0: 8.0, y1: 13.2 };
export const byFire = (x, north, h) => x > FIRE.x0 && x < FIRE.x1 && north > FIRE.y0 && north < FIRE.y1 && h < 1.5;
