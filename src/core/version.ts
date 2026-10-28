// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.14.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'Controllers, vibration and the world map',
  notes: [
    'A controller the browser does not recognise can be set up button by button in Settings, Controls',
    'Vibration has its own strength, a test, and more moments to feel: crits, big kills, chests, boss entrances',
    'On the world map the D-pad (or Q and E) goes from place to place, with a card naming each',
    'Drop your own pins on the world map with Y, P or a right-click; they show on the minimap and are saved',
    'From 0.13: mountains with natural edges, spells that stop at walls, the Expedition Mine'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesized in the browser with the Web Audio API'] }
];
