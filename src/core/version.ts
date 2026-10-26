// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.9.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'A new look, new monsters and an ending',
  notes: [
    'Icons drawn for the game, new typefaces, and towns redrawn in ink',
    'Three save slots with backups, export and import; settings in tabs',
    'Edit any hero\'s spells, keep loadout sets, let a resting hero assist',
    'A codex, a training dummy in every town, a log and statistics',
    'Ten new monsters for the far regions, and lairs marked by totems',
    'Warlord cards, an ending with credits, and a new death screen',
    'Hit-stop, a camera that looks ahead, and sounds for every region'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesized in the browser with the Web Audio API'] }
];
