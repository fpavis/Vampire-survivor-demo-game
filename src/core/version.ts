// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.15.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'Installable, steadier and faster',
  notes: [
    'The game can be installed, and plays offline once it has loaded; Video settings have a Fullscreen switch',
    'If something goes wrong, a crash screen offers an error report and keeps your last good save',
    'A warning when the browser will not let the game save, with a way to export your progress',
    'Dynamic resolution keeps the frame rate up, and a first start picks the graphics quality for your device',
    'Fights run a little lighter: spent bolts and sparks are reused, and monsters far off screen rest',
    'From 0.14: controller setup, vibration strength and pins on the world map'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesised in the browser with the Web Audio API'] }
];
