// Extracts the icons the game uses into src/core/icons/data.ts, so the bundle carries only those paths.
// Sources: game-icons.net (CC BY 3.0, https://game-icons.net) for game content and Material Design Icons
// (Apache 2.0, https://pictogrammers.com) for interface glyphs, both through the Iconify JSON packages.
// Usage: node scripts/build-icons.mjs  (rerun after changing the manifest below)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const SETS = { gi: require('@iconify-json/game-icons/icons.json'), mdi: require('@iconify-json/mdi/icons.json') };

// name -> [source, colour]; a null colour means "use the text colour" (interface glyphs)
const MANIFEST = {
  // interface
  close: ['mdi:close', null], check: ['mdi:check-bold', null], 'box-checked': ['mdi:checkbox-marked-outline', null],
  box: ['mdi:checkbox-blank-outline', null], 'radio-on': ['mdi:radiobox-marked', null], 'radio-off': ['mdi:radiobox-blank', null],
  play: ['mdi:play', null], pause: ['mdi:pause', null], 'sound-on': ['mdi:volume-high', null], 'sound-off': ['mdi:volume-off', null],
  vibrate: ['mdi:vibrate', null], 'vibrate-off': ['mdi:vibrate-off', null], palette: ['mdi:palette', null],
  'motion-off': ['mdi:motion-pause-outline', null], motion: ['mdi:run-fast', null], keyboard: ['mdi:keyboard-outline', null],
  gauge: ['mdi:speedometer', null], bulb: ['mdi:lightbulb-on-outline', null], reset: ['mdi:restore', null],
  'chevron-down': ['mdi:chevron-down', null], 'chevron-right': ['mdi:chevron-right', null], save: ['mdi:content-save', null],
  settings: ['mdi:cog', null], lock: ['mdi:lock', null], unlock: ['mdi:lock-open-variant', null], recycle: ['mdi:recycle', null],
  'arrow-right': ['mdi:arrow-right', null], 'arrow-up': ['mdi:arrow-up-bold', null], 'stairs-up': ['mdi:stairs-up', null],
  'stairs-down': ['mdi:stairs-down', null], alert: ['mdi:alert', null], 'quest-marker': ['mdi:exclamation-thick', null],
  timer: ['mdi:timer-outline', null], star: ['mdi:star', null], gamepad: ['mdi:gamepad-variant', null], flask: ['mdi:flask-outline', null],
  'x-mark': ['mdi:close-thick', null], 'star-outline': ['mdi:star-outline', null], eye: ['mdi:eye-outline', null],
  swap: ['mdi:account-switch', null], 'hand-heart': ['mdi:hand-heart', null],
  fullscreen: ['mdi:fullscreen', null], 'fullscreen-exit': ['mdi:fullscreen-exit', null], 'rotate-device': ['mdi:phone-rotate-landscape', null],
  copy: ['mdi:content-copy', null],

  // schools of magic
  'school-arcane': ['gi:star-swirl', 0xffd84a], 'school-frost': ['gi:snowflake-2', 0x9be7ff], 'school-fire': ['gi:flame', 0xff8a3a],
  'school-storm': ['gi:lightning-trio', 0xb9a5ff], 'school-force': ['gi:fist', 0xc9d4e0], 'school-life': ['gi:vine-leaf', 0x7be07b],

  // spells
  'spell-bolt': ['gi:bolt-spell-cast', 0xffd84a], 'spell-orbit': ['gi:spinning-sword', 0xc9d4e0], 'spell-chain': ['gi:chain-lightning', 0xb9a5ff],
  'spell-nova': ['gi:ice-spell-cast', 0x9be7ff], 'spell-meteor': ['gi:meteor-impact', 0xff8a3a], 'spell-dash': ['gi:sprint', 0xc9d4e0],
  'spell-blink': ['gi:teleport', 0xd59bff], 'spell-barrier': ['gi:magic-shield', 0x7be07b], 'spell-trail': ['gi:fire-dash', 0xff8a3a],
  'spell-wisp': ['gi:orb-direction', 0xd59bff], 'spell-glaive': ['gi:boomerang', 0xc9d4e0], 'spell-cloud': ['gi:poison-cloud', 0x9be07b],
  'spell-slam': ['gi:earth-crack', 0xc8a070], 'spell-heal': ['gi:healing', 0x7be07b],

  // runes
  'rune-multishot': ['gi:arrow-cluster', 0xffd84a], 'rune-piercing': ['gi:arrowhead', 0xe0e6f0], 'rune-swift': ['mdi:fast-forward', 0x7be0d0],
  'rune-heavy': ['gi:hammer-drop', 0xc9a070], 'rune-wide': ['mdi:arrow-expand-all', 0x9be7ff], 'rune-chaining': ['gi:linked-rings', 0xb9a5ff],
  'rune-frostbite': ['gi:ice-cube', 0x9be7ff], 'rune-ignite': ['gi:burning-embers', 0xff8a3a], 'rune-shove': ['gi:punch', 0xe0c0a0],
  'rune-spark': ['gi:spark-spirit', 0xb9a5ff], 'rune-echo': ['gi:mine-explosion', 0xff9a4a], 'rune-vampiric': ['gi:bleeding-heart', 0xff4a5a],
  'rune-efficient': ['gi:water-drop', 0x6ab8ff], 'rune-reach': ['mdi:arrow-top-right', 0x7be0d0], 'rune-lingering': ['gi:hourglass', 0xe8c87a],
  'rune-keen': ['gi:on-target', 0xff6a6a], 'rune-colossal': ['gi:giant', 0xc8b090], 'rune-ricochet': ['gi:ricochet', 0xffd84a],
  'rune-seeking': ['gi:magnet', 0xff6a6a], 'rune-siphon': ['gi:extraction-orb', 0x6ab8ff], 'rune-splinter': ['gi:crystal-cluster', 0x9be7ff],
  'rune-overcharge': ['gi:battery-pack', 0xffd84a], 'rune-aftershock': ['gi:earth-spit', 0xc8a070],
  'rune-resonance': ['gi:resonance', 0xb9a5ff],

  // stat paths and cards
  'path-arcane': ['gi:crystal-ball', 0xc08bff], 'path-vigor': ['gi:hearts', 0xff7a7a], 'path-wayfarer': ['gi:boots', 0x7be0d0],
  'path-spirit': ['gi:potion-ball', 0x6ab8ff],
  'card-might': ['gi:biceps', 0xff9a6a], 'card-haste': ['gi:stopwatch', 0xffd84a], 'card-crit': ['gi:targeting', 0xff6a6a],
  'card-vitality': ['gi:heart-plus', 0xff5a6a], 'card-recovery': ['gi:regeneration', 0x7be07b], 'card-armor': ['gi:shield', 0xc9d4e0],
  'card-swift': ['gi:running-shoe', 0x7be0d0], 'card-magnet': ['gi:magnet', 0xff6a6a], 'card-growth': ['gi:open-book', 0x9be7ff],
  'card-reservoir': ['gi:concentration-orb', 0x6ab8ff], 'card-wellspring': ['gi:fountain', 0x6ab8ff], 'card-thrift': ['gi:two-coins', 0xffd84a],
  'card-reach': ['gi:expanded-rays', 0xc08bff], 'card-persistence': ['gi:hourglass', 0x6ab8ff], 'card-fortune': ['gi:clover', 0x7be07b],
  'card-greed': ['gi:coins-pile', 0xffd84a],

  // heroes, people and foes
  'hero-aria': ['gi:wizard-staff', 0x6aa8ff], 'hero-brann': ['gi:visored-helm', 0xff8a5a], 'hero-cyra': ['gi:oak-leaf', 0x7be07b],
  skull: ['gi:death-skull', 0xe8e4d8], lair: ['gi:horned-skull', 0xff6a5a], lord: ['gi:devil-mask', 0xff5a5a], crown: ['gi:crown', 0xffd84a],
  elder: ['gi:hooded-figure', 0xe8d8b0], healer: ['gi:caduceus', 0x9bffb0], merchant: ['gi:shop', 0xffd84a], innkeeper: ['gi:bed', 0xc8a0ff],
  board: ['gi:wooden-sign', 0xc8915a], person: ['gi:person', 0xd8c0a0], party: ['gi:wizard-face', 0xb9a5ff],

  // things and places
  heart: ['mdi:heart', 0xff4a5a], gem: ['gi:cut-diamond', 0x7be0ff], upgrade: ['gi:upgrade', 0xffd84a], hand: ['gi:hand', 0xf0d0a0],
  backpack: ['gi:knapsack', 0xd8a868], door: ['gi:door', 0xc8915a], road: ['gi:horizon-road', 0xc8a070], torch: ['gi:torch', 0xffaa4a],
  hammer: ['gi:hammer-nails', 0xd0b080], journal: ['gi:open-book', 0x9be7ff], codex: ['gi:spell-book', 0xc8a0ff],
  'vault-key': ['gi:skeleton-key', 0xffd84a], lever: ['gi:lever', 0xc8b090], 'vault-gate': ['gi:gate', 0xb8b0a0],
  plate: ['gi:vortex', 0x7ad8ff], kraken: ['gi:giant-squid', 0x6a4ab8],
  plus: ['mdi:plus', null], minus: ['mdi:minus', null], target: ['mdi:crosshairs-gps', null],
  dummy: ['gi:scarecrow', 0xd8b070], map: ['gi:treasure-map', 0xe8d090], scroll: ['gi:scroll-unfurled', 0xe8d090],
  chest: ['gi:open-treasure-chest', 0xffc84a], swords: ['gi:crossed-swords', 0xe0e6f0], fleur: ['gi:fleur-de-lys', 0xf3d08a],
  warning: ['gi:hazard-sign', 0xff5a5a], sail: ['gi:sailboat', 0x9bd0ff], flag: ['gi:flying-flag', 0xff6a5a], key: ['gi:key', 0xffd84a],
  'biome-field': ['gi:wheat', 0xe8c860], 'biome-forest': ['gi:pine-tree', 0x5ac46a], 'biome-desert': ['gi:cactus', 0x9ad06a],
  'biome-shore': ['gi:palm-tree', 0x6ad0c0], 'biome-mountain': ['gi:mountains', 0xb4bcc8],
  'place-cave': ['gi:cave-entrance', 0xb09070], 'place-ruins': ['gi:greek-temple', 0xd8d0c0], 'place-town': ['gi:village', 0xe8c87a],
  dungeon: ['gi:dungeon-gate', 0xb9a5ff],
  'tower-spire': ['gi:stone-tower', 0x7ab4ff], 'tower-ward': ['gi:obelisk', 0xf3c75a], 'tower-beacon': ['gi:fire-bowl', 0xff9a4a],
  teleporter: ['gi:teleport', 0xffd070], 'tower-waypoint': ['gi:portal', 0xb06af0], 'tower-climb': ['gi:mountain-climbing', 0xa8a090], 'tower-bridge': ['gi:stone-bridge', 0xc8a060],
  'tower-dock': ['gi:anchor', 0x6ab8d8], site: ['gi:crane', 0xffd070],
  'res-gold': ['gi:two-coins', 0xffd84a], 'res-wood': ['gi:wood-pile', 0xc8915a], 'res-stone': ['gi:stone-block', 0xb4bcc8], 'res-iron': ['gi:metal-bar', 0x9aa8b8]
};

const out = {};
for (const [name, [src, color]] of Object.entries(MANIFEST)) {
  const [set, id] = src.split(':');
  const json = SETS[set];
  const icon = json.icons[id];
  if (!icon) throw new Error(`missing icon ${src} for ${name}`);
  const w = icon.width ?? json.width ?? 24, h = icon.height ?? json.height ?? 24;
  const paths = [...icon.body.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  const other = icon.body.replace(/<path[^>]*\/>/g, '').replace(/<\/?g[^>]*>/g, '').trim();
  if (!paths.length || other) throw new Error(`${src} is not made of paths only: ${other.slice(0, 80)}`);
  out[name] = [w, h, color, paths.join(' ')];
}

const lines = Object.entries(out).map(([n, [w, h, c, d]]) => `  ${JSON.stringify(n)}: [${w}, ${h}, ${c === null ? 'null' : '0x' + c.toString(16).padStart(6, '0')}, ${JSON.stringify(d)}]`);
const ts = `// Generated by scripts/build-icons.mjs: do not edit by hand.
// Icons from game-icons.net (CC BY 3.0, by Lorc, Delapouite and contributors) and Material Design Icons (Apache 2.0).
// Each entry: [viewBox width, viewBox height, palette colour or null for the text colour, SVG path data]

export const ICON_DATA = {
${lines.join(',\n')}
} as const satisfies Record<string, readonly [number, number, number | null, string]>;
`;
writeFileSync('src/core/icons/data.ts', ts);
console.log(`${Object.keys(out).length} icons, ${(ts.length / 1024).toFixed(0)} KB`);
