// The story's big moments as data: what a boss card says, the line spoken when a demon lord falls, the epilogue and
// the closing roll of the run. Pure; the runtime (app/story.ts) shows them.
import { CHAPTERS, DEMON_LORDS, SOVEREIGN, lordOf } from './story';
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

/** What each lord says on first seeing the party: the lines of its scene, in order. */
export const LORD_INTRO: Record<string, string[]> = {
  field: ['So the Elder found some heroes. How small you are.', 'Every field you crossed is hollow underneath. Come down and see what grows here.'],
  forest: ['You smell of smoke and axes.', 'These woods were mine before your towns had names. They will be mine after.'],
  desert: ['Kneel, and the sand will be gentle with you.', 'No? Then you will be buried standing, like all the others.'],
  shore: ['Hush. Listen to the water.', 'It has carried every ship that defied me to the bottom. It is patient. So am I.'],
  mountain: ['You climbed all this way to die somewhere high.', 'Good. The mountain likes a view.'],
  sovereign: ['Five thrones, emptied by a handful of travellers.', 'I never needed lords. I need only the sky, and the sky is mine.']
};

/** A lord's last words, before the line that closes its chapter (LORD_FALL). */
export const LORD_LAST: Record<string, string> = {
  field: 'The harvest... was never going to be mine...',
  forest: 'Cut me down, and I grow back. Slower, this time...',
  desert: 'The sand remembers. It will remember you.',
  shore: 'The tide... turns...',
  mountain: 'A mountain does not fall. It only... settles.',
  sovereign: 'Then hold the sky, little ones. See how long it lets you.'
};

/** The Elder's word on the first visit to a town after a chapter closes (the last one leads into the ending). */
export const INTERLUDES: Record<string, string> = {
  ch0: 'Word travels fast between the towns. They say travellers cleared the roads. They are saying your names, or trying to.',
  ch1: 'The fields were sown again this week. Old Hesk wept into his seed bag. Do not tell him I told you.',
  ch2: 'The woodcutters went into the Whispering Woods today and came out again, every one of them. That has not happened in a year.',
  ch3: 'A caravan crossed the dunes without losing a single camel. The merchants call it a miracle. I call it you.',
  ch4: 'The fishing boats are out. Some of them even caught fish.',
  ch5: 'Look up tonight. The peaks are clear for the first time since spring, and above them something is waiting.',
  ch6: 'It is over. Sit with me a while, and I will tell you how the song ends.'
};

/** One line of a scene: who speaks it (no speaker: the narrator), and what they say. */
export interface SceneLine { speaker: string; title: string; text: string; lord: string | null }

/** A lord or the Sovereign by id: name, title and the key of its lines. */
function speakerOf(lord: string): { name: string; title: string; key: string } | null {
  if (lord === SOVEREIGN.id) return { name: SOVEREIGN.name, title: SOVEREIGN.title, key: 'sovereign' };
  const l = DEMON_LORDS.find((x) => x.id === lord);
  return l ? { name: l.name, title: l.title, key: l.group } : null;
}

/** A lord noticing the party, in its own words. */
export function lordIntroScene(lord: string): SceneLine[] {
  const who = speakerOf(lord);
  return who ? (LORD_INTRO[who.key] ?? []).map((text) => ({ speaker: who.name, title: who.title, text, lord })) : [];
}

/** A lord falling: its last words, then the narrator closes the chapter. */
export function lordFallScene(lord: string): SceneLine[] {
  const who = speakerOf(lord);
  if (!who) return [];
  return [{ speaker: who.name, title: who.title, text: LORD_LAST[who.key], lord }, { speaker: '', title: '', text: LORD_FALL[who.key], lord: null }];
}

/** The chapter whose interlude the Elder should tell now: the latest one closed and not yet told (null if none). */
export function interludeDue(done: (quest: string) => boolean, told: (chapter: string) => boolean): string | null {
  let due: string | null = null;
  for (const ch of CHAPTERS) if (ch.id !== 'ch6' && done(ch.quest) && !told(ch.id)) due = ch.id;
  return due;
}

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
