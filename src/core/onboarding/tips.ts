// Onboarding tips as data. A tip fires once, either on a game event (optionally matching payload fields) or when a
// condition the runtime polls becomes true. Texts name actions as {placeholders} that the UI fills with the key or
// button of whatever the player is using.
import type { GameEvents } from '../sim/events';

/** Conditions the tip runtime checks a few times per second. */
export type TipCondition =
  | 'start'      // a game is running
  | 'xp'         // the hero has picked up experience
  | 'pending'    // a level-up card is waiting
  | 'hurt'       // the hero took damage
  | 'skill'      // a while into the game, with an active skill equipped
  | 'loot'       // a spell or rune was found
  | 'door'       // standing at the door of a place
  | 'road'       // walking on a road
  | 'materials'  // carrying wood, stone or iron
  | 'quest'      // a quest is tracked
  | 'explore'    // a second region, or a few minutes of play
  | 'party'      // a while into the game
  | 'boss';      // a boss is close

type Match = Record<string, string | number | boolean | (string | number | boolean)[]>;
export type TipTrigger = { event: keyof GameEvents; match?: Match } | { cond: TipCondition };

export interface Tip {
  id: string;
  icon: string;
  text: string;
  /** Higher first when several tips are waiting. */
  priority: number;
  trigger: TipTrigger;
}

export const TIPS: Tip[] = [
  { id: 'welcome', icon: '👋', priority: 100, trigger: { cond: 'start' },
    text: 'Move with {move}. Your spells cast themselves at whatever comes close.' },
  { id: 'gems', icon: '💎', priority: 60, trigger: { cond: 'xp' },
    text: 'Gems are experience: walk over them to collect them.' },
  { id: 'upgrade', icon: '⬆', priority: 90, trigger: { cond: 'pending' },
    text: 'Level up! Press {upgrades} to pick an upgrade card. The game keeps running while you choose.' },
  { id: 'hurt', icon: '❤', priority: 80, trigger: { cond: 'hurt' },
    text: 'Monsters hurt on contact. Keep moving; hearts they drop heal you.' },
  { id: 'skill', icon: '💨', priority: 50, trigger: { cond: 'skill' },
    text: '{skill1} dashes out of trouble. Active skills cost mana, which refills over time.' },
  { id: 'loot', icon: '🎒', priority: 85, trigger: { cond: 'loot' },
    text: 'You found a spell or a rune. Press {spells} to equip spells and socket runes.' },
  { id: 'door', icon: '🚪', priority: 70, trigger: { cond: 'door' },
    text: 'Press {interact} to go in. Caves, ruins and towns are marked on the map once you have seen them.' },
  { id: 'town', icon: '🏘', priority: 75, trigger: { event: 'PlaceEntered', match: { kind: 'city' } },
    text: 'A town: the healer revives the party, the merchant sells spells and runes, and the elder has work for you.' },
  { id: 'road', icon: '🛤', priority: 40, trigger: { cond: 'road' },
    text: 'Roads link the towns and you travel faster on them. Signposts say where they lead.' },
  { id: 'dark', icon: '🔦', priority: 65, trigger: { event: 'PlaceEntered', match: { kind: ['cave', 'ruins'] } },
    text: 'It is dark in here. Torches and your spells light the way; the stairs lead deeper.' },
  { id: 'build', icon: '🔨', priority: 45, trigger: { cond: 'materials' },
    text: 'Wood, stone and iron build towers that fight for you. Press {build} to place one.' },
  { id: 'journal', icon: '📖', priority: 55, trigger: { cond: 'quest' },
    text: 'Your quest is tracked on the left. Press {journal} to open the journal.' },
  { id: 'map', icon: '🗺', priority: 35, trigger: { cond: 'explore' },
    text: 'Press {map} for the world map: regions, towns and the roads between them.' },
  { id: 'party', icon: '🧙', priority: 30, trigger: { cond: 'party' },
    text: 'Three heroes travel together. {nextHero} switches who fights; the others lend their aura.' },
  { id: 'boss', icon: '💀', priority: 95, trigger: { cond: 'boss' },
    text: 'A boss! Red marks on the ground show where it is about to strike: step out of them.' }
];

export const TIP_BY_ID: Record<string, Tip> = Object.fromEntries(TIPS.map((t) => [t.id, t]));

const matches = (match: Match | undefined, payload: Record<string, unknown>) =>
  !match || Object.entries(match).every(([k, v]) => (Array.isArray(v) ? v.includes(payload[k] as never) : payload[k] === v));

/** Ids of the tips a game event triggers. */
export function tipsForEvent(type: keyof GameEvents, payload: object): string[] {
  return TIPS.filter((t) => 'event' in t.trigger && t.trigger.event === type && matches(t.trigger.match, payload as Record<string, unknown>)).map((t) => t.id);
}

/** Ids of the tips a condition triggers. */
export function tipsForCondition(cond: TipCondition): string[] {
  return TIPS.filter((t) => 'cond' in t.trigger && t.trigger.cond === cond).map((t) => t.id);
}

/** The conditions still worth checking: those with a tip not seen yet. */
export function openConditions(seen: ReadonlySet<string>): TipCondition[] {
  const out = new Set<TipCondition>();
  for (const t of TIPS) if ('cond' in t.trigger && !seen.has(t.id)) out.add(t.trigger.cond);
  return [...out];
}

/** The tip to show next: the highest priority among those triggered and not seen yet. */
export function nextTip(seen: ReadonlySet<string>, fired: ReadonlySet<string>): Tip | null {
  let best: Tip | null = null;
  for (const id of fired) {
    const t = TIP_BY_ID[id];
    if (!t || seen.has(id)) continue;
    if (!best || t.priority > best.priority) best = t;
  }
  return best;
}

/** Fills the {placeholders} of a tip text. */
export function fillTip(text: string, glyph: (name: string) => string): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => glyph(name));
}
