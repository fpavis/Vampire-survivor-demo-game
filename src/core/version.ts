// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.16.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'Words and access',
  notes: [
    'All the text read through and corrected: bounties name monsters properly, spelling is British throughout',
    'Every screen checked for accessibility: named dialogs, Tab stays inside an open panel, better contrast',
    'Text size 140% now fits on a phone held sideways, with bars and badges that grow with the text',
    'Colour-blind palettes lightened where a colour was hard to read on the dark panels',
    'Key names in hints and messages follow your own key bindings',
    'From 0.15: installable and offline, a crash screen that keeps your save, dynamic resolution'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesised in the browser with the Web Audio API'] }
];
