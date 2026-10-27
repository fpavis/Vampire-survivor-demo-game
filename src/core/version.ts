// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.12.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'Towers that grow, townsfolk with work, and lords who speak',
  notes: [
    'Spires, obelisks and beacons rise to level 3: tend them with E',
    'Monsters may besiege a tower and silence it until you drive them off',
    'Towers on claimed ground cost a quarter less',
    'Townsfolk ask for help: lost things to recover, travellers to walk to the next town, monsters to thin',
    'Innkeepers trade rumours of places worth clearing, and pay when you have',
    'Towns remember what you do for them: better pay, better prices, and a free bed for their hero',
    'The demon lords speak for themselves, and the Elder has a word between chapters (Settings: Story scenes)'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesized in the browser with the Web Audio API'] }
];
