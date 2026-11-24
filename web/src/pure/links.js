// The terminal commands that are links: typed and entered, each opens its page in a new tab. His own accounts and his
// projects only.
import { PROJECTS, GITHUB } from './desktop.js';

const TITLES = { 'meet-bex': 'Meet Bex', 'profile-art': 'Profile art', 'aic-voice-microsite': 'Voice microsite', 'visitor-classifier': 'Visitor classifier' };

export const LINKS = {
  github: { title: 'GitHub', url: GITHUB },
  ...Object.fromEntries(Object.keys(TITLES).map(id => [id, { title: TITLES[id], url: PROJECTS[id].site }])),
};

export const opening = title => `Opening ${title} in a new tab.`;
// The line to click when the browser would not open the tab itself.
export const blocked = title => `The new tab was blocked. Click here to open ${title}.`;
