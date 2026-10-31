import { makeRng } from '../world/noise';

// Separate seeded streams so cosmetic randomness never changes gameplay, and loot / combat can be
// replayed independently of world generation.
export class RngStreams {
  readonly loot: () => number;
  readonly combat: () => number;
  readonly cosmetic: () => number;
  readonly spawn: () => number;

  constructor(seed: number) {
    this.loot = makeRng(seed ^ 0x1a2b3c);
    this.combat = makeRng(seed ^ 0x5d6e7f);
    this.cosmetic = makeRng(seed ^ 0x9a8b7c);
    this.spawn = makeRng(seed ^ 0x31415926);
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** A world seed from what the player typed: a whole number is used as it is, any other text is hashed. */
export function seedFromText(text: string): number {
  const t = text.trim();
  if (/^\d{1,9}$/.test(t)) return Number(t);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1_000_000_000;
}
