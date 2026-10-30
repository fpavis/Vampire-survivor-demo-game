// Colour palettes for colour-blind players. Colours that carry meaning (how dangerous a monster is, how rare an
// item is, good versus bad) come from here; shapes and letters repeat the meaning so colour is never the only cue.

export type PaletteId = 'default' | 'redgreen' | 'blueyellow';
export type Threat = 'low' | 'even' | 'high' | 'deadly';

export const PALETTES: { id: PaletteId; label: string }[] = [
  { id: 'default', label: 'Standard' },
  { id: 'redgreen', label: 'Red-green safe' },
  { id: 'blueyellow', label: 'Blue-yellow safe' }
];

// based on the Okabe-Ito set, which stays distinct for the common forms of colour blindness, lightened where a colour
// would not reach 4.5:1 as text on the dark panels (tests/contrast.test.ts)
const THREAT: Record<PaletteId, Record<Threat, number>> = {
  default: { low: 0x9aa4b2, even: 0x8ae08a, high: 0xffc233, deadly: 0xff5252 },
  redgreen: { low: 0xa8a8a8, even: 0x56b4e9, high: 0xf0e442, deadly: 0xea7020 },
  blueyellow: { low: 0xa8a8a8, even: 0xf2f2f2, high: 0xff9a9a, deadly: 0xff5a5a }
};

// common, uncommon, rare, epic, legendary
const RARITY: Record<PaletteId, number[]> = {
  default: [0x9aa4b2, 0x4aa8ff, 0xbd70ff, 0xffc233, 0xff7a5a],
  redgreen: [0xb0b0b0, 0x56b4e9, 0xcc79a7, 0xf0e442, 0xe69f00],
  blueyellow: [0xb0b0b0, 0x00b588, 0xcc79a7, 0xea7020, 0xff4a8a]
};

const GOOD_BAD: Record<PaletteId, { good: number; bad: number }> = {
  default: { good: 0x7be07b, bad: 0xff6a6a },
  redgreen: { good: 0x56b4e9, bad: 0xe69f00 },
  blueyellow: { good: 0x00b588, bad: 0xff5a5a }
};

export const threatColor = (p: PaletteId, t: Threat): number => (THREAT[p] ?? THREAT.default)[t];
export const rarityColor = (p: PaletteId, tier: number): number => {
  const list = RARITY[p] ?? RARITY.default;
  return list[Math.max(0, Math.min(list.length - 1, tier))];
};
export const goodBad = (p: PaletteId) => GOOD_BAD[p] ?? GOOD_BAD.default;

/** Shape cue in front of a level tag: nothing for ordinary monsters, a triangle for strong, a skull for deadly. */
export const threatMark = (t: Threat): string => (t === 'deadly' ? '▲▲ ' : t === 'high' ? '▲ ' : '');

/** Letter cue for a rarity tier. */
export const rarityLetter = (tier: number): string => 'CURELL'[Math.max(0, Math.min(4, tier))];

export const hexCss = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
