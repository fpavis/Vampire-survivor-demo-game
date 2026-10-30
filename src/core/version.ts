// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.17.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'Towns, names and a tracker',
  notes: [
    'The quest tracker points the way: an arrow, the place’s name and how far (“83 tiles northeast”), and an arrow on the minimap’s edge',
    'Camera zoom moved to the mouse wheel, the + and - keys and the controller (R3 in, L3 out); Options keeps a slider',
    'Names above townsfolk and monsters are sharp and the same size at every zoom',
    'The teleporter says when you are short of gold and how much; a town you have entered is always on the map',
    'Escape closes the menu, and a blink of the window no longer opens it again',
    'From 0.16: all text proofread, every screen checked for accessibility'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesised in the browser with the Web Audio API'] }
];
