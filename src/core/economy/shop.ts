// Town merchants and inns (pure). Stock is seeded by town and rotates over play time.
import { RUNES, TEMPLATES } from '../spells/spells';
import { makeRng } from '../world/noise';

export const STOCK_EPOCH_SECONDS = 900;      // stock rotates every 15 minutes of play
export const SPELL_SLOTS = 3;
export const RUNE_SLOTS = 6;

export type ShopItem = { kind: 'spell'; tpl: string; price: number } | { kind: 'rune'; id: string; price: number };

const townFactor = (level: number) => 1 + Math.min(3, level / 30);

export const runePrice = (id: string, level = 1) => Math.round(50 * Math.pow(2.3, RUNES[id].rarity) * townFactor(level));
export const spellPrice = (tpl: string, level = 1) => {
  const t = TEMPLATES[tpl];
  return Math.round((130 + 55 * t.sockets + (t.mode === 'active' ? 40 : 0)) * townFactor(level));
};

export const epochOf = (playSeconds: number) => Math.floor(playSeconds / STOCK_EPOCH_SECONDS);

/** Deterministic stock for a town at a given epoch. Rarer runes appear less often in shops than in drops. */
export function stockFor(townSeed: number, epoch: number, level = 1): ShopItem[] {
  const rand = makeRng((townSeed ^ Math.imul(epoch + 1, 2654435761)) | 0);
  const items: ShopItem[] = [];
  const spells = Object.keys(TEMPLATES);
  const seenS = new Set<string>();
  for (let i = 0; i < SPELL_SLOTS; i++) {
    let tpl = spells[Math.floor(rand() * spells.length)];
    for (let k = 0; k < 6 && seenS.has(tpl); k++) tpl = spells[Math.floor(rand() * spells.length)];
    seenS.add(tpl);
    items.push({ kind: 'spell', tpl, price: spellPrice(tpl, level) });
  }
  const runeIds = Object.keys(RUNES);
  const weights = runeIds.map((id) => Math.pow(0.55, RUNES[id].rarity));
  const total = weights.reduce((a, b) => a + b, 0);
  const seenR = new Set<string>();
  for (let i = 0; i < RUNE_SLOTS; i++) {
    let id = runeIds[0];
    for (let tries = 0; tries < 8; tries++) {
      let roll = rand() * total;
      for (let j = 0; j < runeIds.length; j++) { roll -= weights[j]; if (roll <= 0) { id = runeIds[j]; break; } }
      if (!seenR.has(id)) break;
    }
    seenR.add(id);
    items.push({ kind: 'rune', id, price: runePrice(id, level) });
  }
  return items;
}

/** Inn: a night's rest heals and revives the whole party. */
export const innCost = (avgLevel: number) => Math.round(25 + 8 * avgLevel);

// ------------------------------------------------------------------ townsfolk talk
export const RUMORS = [
  'They say demons gather beyond the far mountains. The farther you roam, the stronger they are.',
  'A warlord holds court in a lair to the {dir}. No one who went looking came back.',
  'The healer works miracles, but not for free. Keep some gold in your purse.',
  'Springs bubble up in the wilds. Sit in one and your wounds close, slowly.',
  'I saw a glowing plate in the ground out past the old road. Stepping on it woke something nasty.',
  'Planted a banner on the hill yesterday. Held it for a whole minute before the first wave arrived!',
  'Lava pools hide in the high foothills. Mind your feet, and mind the golems — fire does not bother them.',
  'Three heroes, three styles. I hear the bench is not just for resting.',
  'Merchants change their wares through the day. If nothing suits you, come back later.',
  'Sand swallows the careless. Scorpions swim in it like fish.',
  'My cousin chops wood for the tower builders. They say one tower needs a mountain of timber.',
  'The deeper wilds change. Trees turn grey, the sky darkens... something is poisoning the land.',
  'Keep your runes tidy. A fitting rune turns a plain spell into a weapon.',
  'The innkeeper keeps the best beds in town. A good rest brings everyone back from the brink.',
  'If you hear a horn at night, do not step outside.',
  'Dungeons hold the best spells, if you can survive them.'
];

export function rumorFor(npcSeed: number, dirWord = 'north'): string {
  const rand = makeRng(npcSeed | 0);
  const t = RUMORS[Math.floor(rand() * RUMORS.length)];
  return t.replace('{dir}', dirWord);
}
