// Jobs the townsfolk offer, and the innkeeper's rumours: small side quests generated from the town and the
// bounty rotation, deterministically, so a town always has the same person asking the same thing until the
// boards turn over. One job per town per rotation: recover something from a cave or ruins nearby, walk a
// traveller to the next town, or thin the monsters round the walls. Pure.
import { hash } from '../world/noise';
import { GROUP_NAMES } from './text';
import type { BoardInfo } from './bounties';
import type { QuestDef } from './quests';

export const jobId = (town: string, epoch: number) => `j:${town}:${epoch}`;
export const rumourId = (town: string, epoch: number) => `r:${town}:${epoch}`;

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const pick = <A,>(arr: readonly A[], h: number): A => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];

const FETCH = [
  { item: 'a silver locket', icon: 'gem', title: 'The Lost Locket', ask: 'My mother\'s locket. Bandits took it and fled to {place}. Bring it home, please.' },
  { item: 'the miller\'s ledger', icon: 'journal', title: 'The Miller\'s Ledger', ask: 'The miller dropped his ledger running from {place}. Without it, half the town owes him nothing.' },
  { item: 'an old shrine icon', icon: 'star', title: 'The Shrine Icon', ask: 'Our shrine\'s icon was carried off to {place}. The town has not slept well since.' },
  { item: 'a courier\'s satchel', icon: 'backpack', title: 'Undelivered', ask: 'A courier never came back from {place}. His satchel holds letters for half the street.' }
];
const ESCORT = [
  { npc: 'Ada the courier', title: 'Safe Passage', ask: 'I carry letters to {place}, and the roads are no place for one alone. Walk with me?' },
  { npc: 'Brother Tam', title: 'The Pilgrim', ask: 'I am bound for the shrine at {place}. Monsters do not respect a robe. Will you see me there?' },
  { npc: 'Merra the trader', title: 'Goods on the Road', ask: 'My cart went ahead to {place}, but I did not. See me there and I will pay you well.' },
  { npc: 'Old Wren', title: 'One Last Trip', ask: 'My grandson lives in {place}. My legs are fine; my courage is not. Will you come?' }
];

/** The icon a fetched item is drawn with where it lies. */
export const relicIcon = (item: string): string => FETCH.find((f) => f.item === item)?.icon ?? 'scroll';

/** What the townsperson says when the job is handed in. */
export function jobThanks(def: QuestDef): string {
  const o = def.objectives[0];
  if (o?.type === 'fetch') return `You found ${o.item}! I had given up hope. Take this, with the whole street's thanks.`;
  if (o?.type === 'kill') return 'Listen: nothing howling. First quiet night in weeks. This is for you.';
  return 'Thank you. Truly.';
}

/** Which of the town's villagers asks (an index into its villagers). */
export const jobSlot = (seed: number, town: BoardInfo, epoch: number, villagers: number) =>
  villagers > 0 ? Math.floor(hash(town.tx * 7 + 3, town.ty * 5 + epoch, seed + 9200) * villagers) : -1;

/** The job a town offers in a rotation. `{place}` in its summary is filled in by whoever shows it. */
export function townJob(seed: number, town: BoardInfo, epoch: number): QuestDef {
  const h = (n: number) => hash(town.tx * 13 + n, town.ty * 11 + epoch * 3, seed + 9300);
  const lvl = Math.max(1, town.level);
  const near = { tx: town.tx, ty: town.ty };
  const base = { id: jobId(town.id, epoch), kind: 'job' as const, giver: 'townsfolk', town: town.id, level: lvl };
  const r = h(1);
  if (r < 0.4) {
    const f = pick(FETCH, h(2));
    return {
      ...base, title: f.title, summary: f.ask,
      objectives: [{ type: 'fetch', item: f.item, target: { kind: h(3) < 0.5 ? 'cave' : 'ruins', nth: 0, near } }],
      rewards: { gold: round5(60 + lvl * 8), xp: 25 + lvl * 4 }
    };
  }
  if (r < 0.8) {
    const e = pick(ESCORT, h(4));
    return {
      ...base, title: e.title, summary: e.ask,
      objectives: [{ type: 'escort', npc: e.npc, target: { kind: 'town', nth: 1, near } }],
      rewards: { gold: round5(80 + lvl * 9), xp: 30 + lvl * 5 }
    };
  }
  const count = 15 + Math.floor(h(5) * 10);
  return {
    ...base, title: 'Quiet Nights', summary: `Things howl outside the walls every night. Thin out the monsters of the ${GROUP_NAMES[town.group] ?? 'land'}, and we might sleep.`,
    objectives: [{ type: 'kill', count, group: town.group }],
    rewards: { gold: round5(count * (3 + lvl * 0.5)), xp: Math.round(count * (1 + lvl * 0.2)) }
  };
}

/** The innkeeper's rumour as a quest: clear the place they named (it is found by the caller). */
export function innRumour(town: BoardInfo, epoch: number, place: { id: string; name: string; kind: 'dungeon' | 'cave' | 'ruins' }): QuestDef {
  const lvl = Math.max(1, town.level);
  return {
    id: rumourId(town.id, epoch), kind: 'job', giver: 'inn', town: town.id, level: lvl,
    title: `Rumour: ${place.name}`, summary: `The innkeeper swears something stirs in ${place.name}. Clear it, and the drinks are on the house.`,
    objectives: [{ type: 'clear', target: { kind: place.kind, nth: 0, near: { tx: town.tx, ty: town.ty } }, text: `Clear ${place.name}` }],
    rewards: { gold: round5((place.kind === 'dungeon' ? 220 : 90) + lvl * 12), xp: (place.kind === 'dungeon' ? 110 : 45) + lvl * 6, ...(place.kind === 'dungeon' ? { loot: 1 } : {}) }
  };
}

/** What marking a rumoured place on the map costs. */
export const rumourFee = (level: number) => round5(10 + level * 2);
