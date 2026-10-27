// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.11.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'A game menu, fairer levels and a training ground',
  notes: [
    'One game menu (Esc or Start): party, spells, upgrades, journal, building, the map, saves and settings',
    'The Party page shows every hero\'s stats, what the others lend, and every passive taken',
    'Experience is weighed against your level: far weaker monsters give little, so the lands keep pace',
    'Passives come in ten small ranks, with four new ones (Reach, Persistence, Fortune, Greed) and mastery after',
    'Your old passives were refunded: spend them again on the Upgrades page',
    'Resting heroes lend a quarter of their strength and stay near the land\'s level',
    'Every town has a training ground with three dummies, and the meter shows each skill\'s damage',
    'The upgrades reminder no longer covers your party'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesized in the browser with the Web Audio API'] }
];
