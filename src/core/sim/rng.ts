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
