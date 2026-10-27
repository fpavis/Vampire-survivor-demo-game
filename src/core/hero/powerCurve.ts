// A rough model of how strong the party's passive cards make it, for the balancing tests and docs/BALANCE.md. It
// follows a hero through a run (levels from simulateLevel), spends every rank on a focused damage build and the
// resting heroes' ranks evenly, then measures the damage the cards add. Spells, runes and towers are left out:
// this pins the part of the curve that the Phase 11 playtest found running away.
import { CARDS, CARD_IDS, MASTERY_IDS, computeStats, type HeroStats, type Picks } from './stats';
import { partyStats, type HeroState } from '../party/party';
import { simulateLevel } from './progression';

/** How much the cards multiply damage output: might, crits (double damage) and faster cooldowns. */
export const cardDamageFactor = (s: HeroStats): number => (s.might * (1 + s.crit)) / s.cooldown;

/** Spend ranks over these cards, one rank each in turn, until they are complete. Returns the ranks left over. */
function spendOn(picks: Picks, ranks: number, order: string[]): number {
  let left = ranks;
  while (left > 0) {
    const open = order.filter((id) => (picks[id] || 0) < CARDS[id].max);
    if (!open.length) break;
    for (const id of open) { if (left <= 0) break; picks[id] = (picks[id] || 0) + 1; left--; }
  }
  return left;
}

/** Spend `ranks` on each group of cards in turn, then on mastery (as the game offers it once the cards are done). */
function build(ranks: number, groups: string[][]): Picks {
  const picks: Picks = {};
  let left = ranks;
  for (const g of groups) left = spendOn(picks, left, g);
  for (let i = 0; left > 0; i++, left--) { const id = MASTERY_IDS[i % MASTERY_IDS.length]; picks[id] = (picks[id] || 0) + 1; }
  return picks;
}

const DAMAGE = ['might', 'haste', 'crit'];
/** The strongest damage build: might, cast speed and precision first, then everything else. */
export const focusedPicks = (ranks: number): Picks => build(ranks, [DAMAGE, CARD_IDS.filter((id) => !DAMAGE.includes(id))]);

/** A resting hero nobody plans for: ranks spread over every card. */
export const balancedPicks = (ranks: number): Picks => build(ranks, [CARD_IDS]);

const hero = (id: string, level: number, picks: Picks): HeroState =>
  ({ id, level, experience: 0, nextLevel: 1, health: 1, mana: 1, pending: 0, picks, auto: [], active: [], dead: false });

export interface PowerPoint { level: number; bench: number; factor: number }

/** The party after `kills` kills in lands rising to `zone` (or the given ramp), under the current rules or the old. */
export function partyPowerAt(zone: number | ((k: number) => number), kills: number, relative = true, growth = 1.3): PowerPoint {
  const level = simulateLevel({ kills, zone, growth, relative });
  const bench = simulateLevel({ kills, zone, share: 0.5, relative });
  const party = [hero('a', level, focusedPicks(level - 1)), hero('b', bench, balancedPicks(bench - 1)), hero('c', bench, balancedPicks(bench - 1))];
  return { level, bench, factor: cardDamageFactor(partyStats(party, 0)) };
}

/** The same hero's own cards alone (no auras), at a given level. */
export const soloFactor = (level: number): number => cardDamageFactor(computeStats(focusedPicks(level - 1)));
