// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.9.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'A new look and more options',
  notes: [
    'Icons drawn for the game everywhere, and new typefaces',
    'Three save slots with backups, plus export and import',
    'Settings in tabs: quality, render scale, frame limit, camera zoom, HUD size and more',
    'A message log and a statistics page in the journal',
    'Load, Options and Credits on the title screen'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesized in the browser with the Web Audio API'] }
];
