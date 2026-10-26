// The story's big moments as data: what a boss card says, the line spoken when a demon lord falls, the epilogue and
// the closing roll of the run. Pure; the runtime (app/story.ts) shows them.
import { DEMON_LORDS, SOVEREIGN, lordOf } from './story';
import { GROUP_INFO } from '../world/biomes';

/** The line that closes each lord's chapter when they fall. */
export const LORD_FALL: Record<string, string> = {
  field: 'The fields breathe again. This year the harvest will come in.',
  forest: 'The roots let go. The old woods stand quiet and their own.',
  desert: 'The sand gives back what it buried, one ruin at a time.',
  shore: 'The tide turns, and the ships begin to come home.',
  mountain: 'The mountain is only a mountain again.',
  sovereign: 'The sky clears for the first time since spring.'
};

export const EPILOGUE: string[] = [
  'Azrathul is gone, and the sky has forgotten him already.',
  'The five lords are names in the Elder\'s book now, and nothing more.',
  'In the towns the bounty boards fill with ordinary work: wolves, wagons, a lost goat.',
  'The roads you walked are busier than they have been in years.',
  'The world is still wide, and much of it is still unmapped.',
  'Rest, if you like. Or keep walking.'
];

export interface BossCard { kind: 'boss' | 'victory'; name: string; title: string; text: string; lord: string | null }

/** Who a boss is, for its intro card: a demon lord, the Sovereign, or a regional warlord. */
export function bossIntroCard(lord: string | null, typeName: string, group: string | null): BossCard {
  if (lord === SOVEREIGN.id) return { kind: 'boss', name: SOVEREIGN.name, title: SOVEREIGN.title, text: 'Everything you have fought was only his shadow.', lord };
  const l = lord ? DEMON_LORDS.find((x) => x.id === lord) : undefined;
  if (l) return { kind: 'boss', name: l.name, title: l.title, text: l.blurb, lord: l.id };
  const region = group ? (GROUP_INFO as Record<string, { name: string }>)[group]?.name : null;
  return { kind: 'boss', name: typeName, title: region ? `Warlord of the ${region}` : 'A warlord', text: 'It has ruled here a long time, and means to go on.', lord: null };
}

/** The sea's own boss has its own cards: it is no one's warlord. */
export function krakenCard(kind: 'boss' | 'victory'): BossCard {
  return kind === 'boss'
    ? { kind, name: 'The Kraken', title: 'Terror of the Deep', text: 'The water heaves under the hull, and something vast looks up.', lord: null }
    : { kind, name: 'The Kraken', title: 'sinks', text: 'The sea goes flat and quiet. Sailors will tell this one for years.', lord: null };
}

/** The card shown when a boss falls. */
export function victoryCard(lord: string | null, typeName: string, group: string | null): BossCard {
  if (lord === SOVEREIGN.id) return { kind: 'victory', name: SOVEREIGN.name, title: 'is no more', text: LORD_FALL.sovereign, lord };
  const l = lord ? DEMON_LORDS.find((x) => x.id === lord) : undefined;
  if (l) return { kind: 'victory', name: l.name, title: 'falls', text: LORD_FALL[l.group] ?? '', lord: l.id };
  const region = group ? (GROUP_INFO as Record<string, { name: string }>)[group]?.name : null;
  return { kind: 'victory', name: typeName, title: 'is defeated', text: region ? `The ${region} are a little safer tonight.` : 'The land is a little safer tonight.', lord: null };
}

/** The lord whose lair this is, by region, or the Sovereign on a plateau once every lord has fallen. */
export function lordFor(group: string, realm: string, isLordLair: boolean, lordsAll: boolean): string | null {
  if (realm === 'plateau' && lordsAll) return SOVEREIGN.id;
  const l = lordOf(group);
  return isLordLair && l && realm === 'land' ? l.id : null;
}

export interface RunStats { time: number; level: number; kills: number; bosses: number; distance: number; gold: number; places: number; regions: number; deaths: number }

/** The lines of the closing roll: what this run amounted to. */
export function runSummary(s: RunStats): [string, string][] {
  const hours = Math.floor(s.time / 3600), mins = Math.floor((s.time % 3600) / 60);
  return [
    ['Time on the road', hours ? `${hours} h ${mins} min` : `${mins} min`],
    ['Highest level', String(s.level)],
    ['Monsters defeated', String(s.kills)],
    ['Warlords and lords felled', String(s.bosses)],
    ['Distance walked', `${(s.distance / 48 / 1000).toFixed(1)} km`],
    ['Gold earned', String(Math.round(s.gold))],
    ['Places discovered', String(s.places)],
    ['Regions discovered', String(s.regions)],
    ['Times the party fell', String(s.deaths)]
  ];
}
