// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.13.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'Fixes from your second playtest',
  notes: [
    'Switching heroes no longer passes on the last hero\'s wounds or drains the next one\'s mana',
    'Switching works again after loading a save, and says how long it has left when it must wait',
    'Mountains and cave walls have rounded, natural edges instead of square steps',
    'Spells look for monsters on screen, not across it, and bolts stop at walls and mountains',
    'The climbing tower is now the Expedition Mine, as it bores into the mountain',
    'Bridges can be walked onto from their gatehouse, and building never traps you',
    'From a town\'s teleporter the travel map scrolls over everything you have explored'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesized in the browser with the Web Audio API'] }
];
