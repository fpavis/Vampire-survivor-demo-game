// The game's version and the notes shown once after an update ("What's new" on the title screen).
export const GAME_VERSION = '0.10.0';

export const WHATS_NEW: { version: string; title: string; notes: string[] } = {
  version: GAME_VERSION,
  title: 'Pixel art, teleporters and corrupted lands',
  notes: [
    'Everything drawn at the ground\'s pixel grain (or smooth), with CRT, pixelate, film grain and colour grades',
    'The ground is felt: lava glows and shimmers, ice frosts the edges, quicksand drains the colour',
    'A world map to pan and zoom, with Visited and Cleared badges; dungeon floors remember what you explored',
    'Dungeons are cleared when everything is done, and a portal leads out from the boss',
    'Towns of every size and shape, each with a teleporter: travel between towns and your own waypoints',
    'Corrupted lands: barren, violet and full of monsters',
    'Warbands, swarms and hunters come looking for you out in the world',
    'Fairer ambushes, boat recall at docks, and an experimental click to use'
  ]
};

export const CREDITS: { section: string; lines: string[] }[] = [
  { section: 'Made with', lines: ['PixiJS (rendering)', 'Preact (interface)', 'fflate (save compression)'] },
  { section: 'Icons', lines: ['game-icons.net by Lorc, Delapouite and contributors, CC BY 3.0', 'Material Design Icons by Pictogrammers, Apache 2.0'] },
  { section: 'Typefaces', lines: ['Cinzel by Natanael Gama, SIL Open Font License', 'Nunito by Vernon Adams, Cyreal and Jacques Le Bailly, SIL Open Font License'] },
  { section: 'Sound and music', lines: ['Synthesized in the browser with the Web Audio API'] }
];
