// The codex: what the bestiary says about each monster, and which spells, runes and monsters the party has met.
import { ENEMY_TYPES } from '../config';

const BEHAVIOUR: Record<string, string> = {
  chase: 'Comes straight for you and keeps coming.',
  swarm: 'Arrives in swarms that weave around you; thin them before they surround you.',
  charger: 'Paws the ground, then charges in a straight line. Running into a wall stuns it.',
  pack: 'Hunts in packs: circles at a distance, lunges in, then backs off.',
  kiter: 'Keeps its distance and shoots. Close in, or step out of its line.',
  slammer: 'Raises its arms, then slams the ground around it: leave the red circle.',
  burrower: 'Burrows under the sand and bursts out beneath you.',
  diver: 'Circles overhead, then dives at you.',
  strafer: 'Sidesteps quickly and snaps at you from the side.',
  lobber: 'Hurls boulders that land where you stand: keep moving.',
  floater: 'Drifts slowly and releases a burst of energy around itself.',
  boss: 'A warlord: dashes, slams, volleys and summons, and grows enraged below half health.'
};

export interface BestiaryEntry { type: string; name: string; behaviour: string; health: number; damage: number; speed: string; flying: boolean; armor: number; boss: boolean }

export function bestiaryEntry(type: string): BestiaryEntry | null {
  const t = (ENEMY_TYPES as Record<string, any>)[type];
  if (!t) return null;
  const kind = t.ai?.kind ?? 'chase';
  return {
    type, name: t.name, behaviour: BEHAVIOUR[kind] ?? BEHAVIOUR.chase,
    health: t.health, damage: t.damage,
    speed: t.speed >= 2.3 ? 'fast' : t.speed >= 1.4 ? 'steady' : 'slow',
    flying: !!t.flying, armor: t.armor || 0, boss: kind === 'boss'
  };
}

/** Every monster type in the order the bestiary lists them: regular kinds first, warlords last. */
export const BESTIARY_ORDER = Object.keys(ENEMY_TYPES).sort((a, b) => {
  const ba = (ENEMY_TYPES as any)[a].ai?.kind === 'boss' ? 1 : 0, bb = (ENEMY_TYPES as any)[b].ai?.kind === 'boss' ? 1 : 0;
  return ba - bb;
});

export interface CodexSave { monsters: string[]; spells: string[]; runes: string[] }
export const emptyCodex = (): CodexSave => ({ monsters: [], spells: [], runes: [] });

/** Add an entry once; returns true when it is new. */
export function discover(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}
