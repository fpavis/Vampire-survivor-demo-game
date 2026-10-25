// The story framework, as data: chapters, demon lords, the main quest chain and the elder's dialogue.
// Locations are never written here; objectives name a region and "the nearest dungeon" and the seeded world supplies it.
// The writing is a placeholder skeleton: replace the text, keep the structure.
import { canStart, isActive, isDone, isReady, prerequisitesMet, type QuestDef, type QuestState } from '../quest/quests';
import type { Cond, DialogueScript, Effect } from './dialogue';

export interface DemonLord { id: string; name: string; title: string; group: string; blurb: string }
export interface Chapter { id: string; title: string; blurb: string; lord?: string; quest: string }

export const DEMON_LORDS: DemonLord[] = [
  { id: 'field', name: 'Morwen', title: 'the Hollow Queen', group: 'field', blurb: 'She hollows the harvest and the hearts of those who farm it.' },
  { id: 'forest', name: 'Thornax', title: 'the Rootbound', group: 'forest', blurb: 'A blight-god of the deep woods, wearing a forest as armour.' },
  { id: 'desert', name: 'Khazreth', title: 'the Sand Tyrant', group: 'desert', blurb: 'He buries kingdoms and calls the silence tribute.' },
  { id: 'shore', name: 'Nerezza', title: 'the Tide Witch', group: 'shore', blurb: 'She drowns ships to keep the sea quiet.' },
  { id: 'mountain', name: 'Gorvak', title: 'the Stone Warlord', group: 'mountain', blurb: 'The mountain is his fist; the avalanche is his word.' }
];
export const SOVEREIGN = { id: 'sovereign', name: 'Azrathul', title: 'the Demon Sovereign' };

export const lordOf = (group: string): DemonLord | undefined => DEMON_LORDS.find((l) => l.group === group);

// -------------------------------------------------------------------- quests
const t = (kind: 'dungeon', group?: string, realm?: 'plateau') => ({ kind, group, realm, nth: 0 });

export const MAIN_QUESTS: QuestDef[] = [
  {
    id: 'm0_omen', kind: 'main', giver: 'elder', chapter: 'ch0', level: 1, title: 'An Omen in the Sky',
    summary: 'Beasts have grown bold on the roads. Thin their numbers and show the Elder what you can do.',
    prerequisites: { flags: ['begun'] },
    objectives: [{ type: 'kill', count: 12 }],
    rewards: { gold: 60, xp: 40 },
    dialogue: { offer: 'elder.offer', turnIn: 'm0.turnin', hint: 'elder.hint' }
  },
  {
    id: 'm1_hollow', kind: 'main', giver: 'elder', chapter: 'ch1', level: 4, title: 'The Hollow Throne',
    summary: 'Morwen, the Hollow Queen, sits in the nearest dungeon of the Verdant Fields. Find it, then end her reign.',
    prerequisites: { quests: ['m0_omen'] },
    objectives: [{ type: 'discover', target: t('dungeon', 'field') }, { type: 'clear', target: t('dungeon', 'field') }],
    rewards: { gold: 160, xp: 120, loot: 1, flags: ['lord.field'] },
    dialogue: { offer: 'm1.offer', turnIn: 'm1.turnin', hint: 'elder.hint' }
  },
  {
    id: 'm2_roots', kind: 'main', giver: 'elder', chapter: 'ch2', level: 8, title: 'Roots of Ruin',
    summary: 'Light a beacon so the woods can be watched, then cut Thornax out of the nearest dungeon of the Whispering Woods.',
    prerequisites: { quests: ['m1_hollow'] },
    objectives: [{ type: 'build', kind: 'beacon' }, { type: 'discover', target: t('dungeon', 'forest') }, { type: 'clear', target: t('dungeon', 'forest') }],
    rewards: { gold: 260, xp: 220, loot: 1, flags: ['lord.forest'] },
    dialogue: { offer: 'm2.offer', turnIn: 'm2.turnin', hint: 'elder.hint' }
  },
  {
    id: 'm3_dust', kind: 'main', giver: 'elder', chapter: 'ch3', level: 14, title: 'The Tyrant of Dust',
    summary: 'Bring timber and stone for the wards, then bury Khazreth in his own sands.',
    prerequisites: { quests: ['m2_roots'] },
    objectives: [{ type: 'deliver', resource: 'wood', count: 25 }, { type: 'deliver', resource: 'stone', count: 15 }, { type: 'discover', target: t('dungeon', 'desert') }, { type: 'clear', target: t('dungeon', 'desert') }],
    rewards: { gold: 380, xp: 360, loot: 1, flags: ['lord.desert'] },
    dialogue: { offer: 'm3.offer', turnIn: 'm3.turnin', hint: 'elder.hint' }
  },
  {
    id: 'm4_tide', kind: 'main', giver: 'elder', chapter: 'ch4', level: 20, title: 'The Tide Witch',
    summary: 'Build a dock to take to the water, then end Nerezza in the nearest dungeon of the Salt Shore.',
    prerequisites: { quests: ['m3_dust'] },
    objectives: [{ type: 'build', kind: 'dock' }, { type: 'discover', target: t('dungeon', 'shore') }, { type: 'clear', target: t('dungeon', 'shore') }],
    rewards: { gold: 520, xp: 520, loot: 1, flags: ['lord.shore'] },
    dialogue: { offer: 'm4.offer', turnIn: 'm4.turnin', hint: 'elder.hint' }
  },
  {
    id: 'm5_stone', kind: 'main', giver: 'elder', chapter: 'ch5', level: 28, title: 'The Stone Warlord',
    summary: 'Raise a climbing tower into the peaks, then break Gorvak in the nearest dungeon of the Stonecrest Mountains.',
    prerequisites: { quests: ['m4_tide'] },
    objectives: [{ type: 'build', kind: 'climb' }, { type: 'discover', target: t('dungeon', 'mountain') }, { type: 'clear', target: t('dungeon', 'mountain') }],
    rewards: { gold: 700, xp: 760, loot: 2, flags: ['lord.mountain', 'lords.all'] },
    dialogue: { offer: 'm5.offer', turnIn: 'm5.turnin', hint: 'elder.hint' }
  },
  {
    id: 'm6_sovereign', kind: 'main', giver: 'elder', chapter: 'ch6', level: 35, title: 'The Demon Sovereign',
    summary: 'Azrathul waits in a Skyvault on the plateau a climbing tower opens. Go up, and end this.',
    prerequisites: { quests: ['m5_stone'], flags: ['lords.all'] },
    objectives: [{ type: 'clear', target: t('dungeon', undefined, 'plateau'), text: 'Clear a Skyvault on a plateau' }],
    rewards: { gold: 1500, xp: 1500, loot: 3, flags: ['finale'] },
    dialogue: { offer: 'm6.offer', turnIn: 'm6.turnin', hint: 'elder.hint' }
  }
];

export const MAIN_BY_ID: Record<string, QuestDef> = Object.fromEntries(MAIN_QUESTS.map((q) => [q.id, q]));
export const lookupMain = (id: string): QuestDef | undefined => MAIN_BY_ID[id];

export const CHAPTERS: Chapter[] = [
  { id: 'ch0', title: 'Prologue: An Omen', blurb: 'The sky has been wrong since spring.', quest: 'm0_omen' },
  { id: 'ch1', title: 'I. The Hollow Throne', blurb: 'The first lord holds the fields.', lord: 'field', quest: 'm1_hollow' },
  { id: 'ch2', title: 'II. Roots of Ruin', blurb: 'The woods have a new, living king.', lord: 'forest', quest: 'm2_roots' },
  { id: 'ch3', title: 'III. The Tyrant of Dust', blurb: 'The desert keeps what it buries.', lord: 'desert', quest: 'm3_dust' },
  { id: 'ch4', title: 'IV. The Tide Witch', blurb: 'The coast is quiet, which is the problem.', lord: 'shore', quest: 'm4_tide' },
  { id: 'ch5', title: 'V. The Stone Warlord', blurb: 'The last lord holds the peaks.', lord: 'mountain', quest: 'm5_stone' },
  { id: 'ch6', title: 'Finale: The Demon Sovereign', blurb: 'Above the world, the end of the song.', quest: 'm6_sovereign' }
];

export const chapterOfQuest = (questId: string): Chapter | undefined => CHAPTERS.find((c) => c.quest === questId);

/** The main quest the party is on: the one in progress, else the next one that could be started. */
export function currentMainQuest(state: QuestState, level: number): { def: QuestDef; status: 'active' | 'ready' | 'offer' | 'locked' } | null {
  for (const def of MAIN_QUESTS) {
    if (isDone(state, def.id)) continue;
    if (isActive(state, def.id)) return { def, status: isReady(state, def) ? 'ready' : 'active' };
    return { def, status: canStart(state, def, { level }) ? 'offer' : prerequisitesMet(state, def, { level }) ? 'locked' : 'locked' };
  }
  return null;
}

/** Which of the elder's scripts to play for what the party has done so far. */
export function elderScript(state: QuestState, level: number, canPay: (def: QuestDef) => boolean = () => true): string {
  if (!state.flags.begun) return 'elder.intro';
  const cur = currentMainQuest(state, level);
  if (!cur) return 'elder.epilogue';
  const d = cur.def.dialogue ?? {};
  switch (cur.status) {
    case 'ready': return canPay(cur.def) ? (d.turnIn ?? 'elder.turnin') : (d.hint ?? 'elder.hint');
    case 'active': return d.hint ?? 'elder.hint';
    case 'offer': return d.offer ?? 'elder.offer';
    default: return 'elder.idle';
  }
}

/** What a boss in a dungeon is called: the lord of a region in the nearest dungeon, the sovereign in a Skyvault. */
export function bossTitle(group: string, realm: string, isLordLair: boolean, state: QuestState): string | null {
  if (realm === 'plateau' && state.flags['lords.all']) return `${SOVEREIGN.name}, ${SOVEREIGN.title}`;
  const lord = lordOf(group);
  if (isLordLair && lord && realm === 'land') return `${lord.name}, ${lord.title}`;
  return null;
}

// ------------------------------------------------------------------ dialogue
type Line = string;
const E = 'Elder';

/** A linear conversation that ends in a yes / no question (offers) or a thank-you effect (turn-ins). */
function talk(id: string, lines: Line[], end: { choices?: { text: string; next?: string; effects?: Effect[]; if?: Cond[] }[]; effects?: Effect[] }): DialogueScript {
  const nodes: DialogueScript['nodes'] = {};
  lines.forEach((text, i) => {
    const last = i === lines.length - 1;
    nodes[`n${i}`] = { speaker: E, icon: 'elder', text, ...(last ? { choices: end.choices, effects: end.effects } : { next: `n${i + 1}` }) };
  });
  return { id, start: 'n0', nodes };
}

const accept = (quest: string): DialogueScript['nodes'][string]['choices'] => [
  { text: 'We will do it.', effects: [{ start: quest }, { say: 'Quest accepted' }] },
  { text: 'Not yet.' }
];

const offer = (id: string, quest: string, lines: Line[]) => talk(id, lines, { choices: accept(quest) });
const turnIn = (id: string, quest: string, lines: Line[]) => talk(id, lines, { effects: [{ turnIn: quest }] });

export const DIALOGUES: Record<string, DialogueScript> = {
  'elder.intro': {
    id: 'elder.intro', start: 'n0',
    nodes: {
      n0: { speaker: E, icon: 'elder', text: 'Travellers, at last. Do you feel it? The sky has been wrong since the spring. Things have crawled up out of the deep places and made thrones of them.', next: 'ask' },
      ask: {
        speaker: E, icon: 'elder', text: 'Five demon lords hold the five lands, and above them waits Azrathul, the Demon Sovereign, who would end every light there is. The old songs say heroes will rise. I had hoped they would be taller. Will you stand against them?',
        choices: [
          { text: 'We will fight them.', next: 'yes', effects: [{ flag: 'begun' }, { start: 'm0_omen' }] },
          { text: 'Tell me about the lords.', next: 'lore' },
          { text: 'Not today.', next: 'bye' }
        ]
      },
      lore: {
        speaker: E, icon: 'elder',
        text: 'Morwen the Hollow Queen holds the fields. Thornax the Rootbound, the woods. Khazreth the Sand Tyrant buries the dunes, Nerezza the Tide Witch drowns the shore, and Gorvak the Stone Warlord has the peaks. Each sits in a dungeon, and each answers to Azrathul.',
        next: 'ask'
      },
      yes: { speaker: E, icon: 'elder', text: 'Then begin small. The beasts on our roads grow bolder every night. Thin them — a dozen should do — and come back to me.' },
      bye: { speaker: E, icon: 'elder', text: 'The offer stands, whenever you are ready. No one will force you. The world is wide.' }
    }
  },
  'elder.idle': { id: 'elder.idle', start: 'n0', nodes: { n0: { speaker: E, icon: 'elder', text: 'Walk freely. The world is wide, and not all of it is a war. Come back when you are stronger, and I will have more to ask of you.' } } },
  'elder.epilogue': { id: 'elder.epilogue', start: 'n0', nodes: { n0: { speaker: E, icon: 'elder', text: 'The song is sung, and you are in it. Go where you like. The light will keep.' } } },
  'elder.offer': offer('elder.offer', 'current', ['{quest.title}. {quest.summary}']),
  'elder.hint': { id: 'elder.hint', start: 'n0', nodes: { n0: { speaker: E, icon: 'elder', text: '{quest.title}: {quest.hint}' } } },
  'elder.turnin': turnIn('elder.turnin', 'current', ['You have done it. Well done.']),

  'm0.turnin': turnIn('m0.turnin', 'm0_omen', [
    'A dozen already? You are quicker than you look. The beasts are the demons\' doing, but they are only the first wave.',
    'Take this. And listen: the lords sit in dungeons. The nearest one in the fields is the place to begin.'
  ]),
  'm1.offer': offer('m1.offer', 'm1_hollow', [
    'Morwen, the Hollow Queen, has made a throne of the nearest dungeon in the Verdant Fields. Find it, see it with your own eyes, and end her reign.',
    'Dungeons run deep. Each floor has guardians, and the way down stays sealed until they fall. At the bottom waits a lord, and a chest worth the trouble.'
  ]),
  'm1.turnin': turnIn('m1.turnin', 'm1_hollow', ['Morwen is dead? Then the fields can breathe. Her fall was felt in every throne room — Thornax will be waiting for you.']),
  'm2.offer': offer('m2.offer', 'm2_roots', [
    'Thornax the Rootbound holds the Whispering Woods, and the woods are hard to watch. Raise a beacon first: a fire that shows the land. Then find his dungeon and cut him out of it.'
  ]),
  'm2.turnin': turnIn('m2.turnin', 'm2_roots', ['The trees stand easier. You have earned this. The Sand Tyrant is next, and the desert is not forgiving.']),
  'm3.offer': offer('m3.offer', 'm3_dust', [
    'Khazreth buries what he hates. The wards that keep the dust from our gates need timber and stone — twenty-five of wood, fifteen of stone — bring them to me. Then find his dungeon in the dunes.'
  ]),
  'm3.turnin': turnIn('m3.turnin', 'm3_dust', ['The sands are still. The wards will hold. Nerezza has been singing to the sea, and it has started to answer.']),
  'm4.offer': offer('m4.offer', 'm4_tide', [
    'Nerezza keeps the shore quiet by drowning anyone who would break it. You will need a boat: build a dock. Then find her dungeon and end her song.'
  ]),
  'm4.turnin': turnIn('m4.turnin', 'm4_tide', ['The waves sound like waves again. One lord remains, and he is the hardest to reach.']),
  'm5.offer': offer('m5.offer', 'm5_stone', [
    'Gorvak holds the peaks, and the peaks hold the way to the sovereign. Raise a climbing tower: a stair into the mountain, and a plateau at its heart. Then find his dungeon and break him.'
  ]),
  'm5.turnin': turnIn('m5.turnin', 'm5_stone', ['All five thrones are empty. The plateau your tower opened hides a vault in the sky, and Azrathul is the one thing left that cares to be found.']),
  'm6.offer': offer('m6.offer', 'm6_sovereign', [
    'Azrathul waits in a Skyvault, on the plateau a climbing tower opens. Go up. Bring everything you have learned. End this.'
  ]),
  'm6.turnin': turnIn('m6.turnin', 'm6_sovereign', ['It is over. The sky is only the sky again. Whatever you do now, you do as the ones who saved the world — and the world is still wide.'])
};
