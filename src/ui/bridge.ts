import { signal } from '@preact/signals';
import type { OfferedCard } from '../core/hero/stats';
import type { PadKind } from '../core/input/gamepad';

export type InputDevice = 'key' | 'mouse' | 'pad' | 'touch';

export interface HeroView {
  id: string; name: string; icon: string; color: number; level: number; dead: boolean; pending: number;
  hp: number; maxHp: number; mana: number; maxMana: number;
}
export interface ObjView { text: string; progress: string; done: boolean }
export interface QuestView {
  id: string; title: string; summary: string; kind: string; giver: string; level: number;
  ready: boolean; payable: boolean; tracked: boolean; reward: string; objectives: ObjView[];
}
export interface QuestsView {
  begun: boolean;
  chapter: { title: string; blurb: string } | null;
  next: { title: string; summary: string; status: string; level: number } | null;
  main: QuestView | null;
  bounties: QuestView[];
  done: number;
  lords: { name: string; title: string; group: string; dead: boolean }[];
  sovereign: { name: string; title: string; dead: boolean };
}
export interface BoardView {
  town: string; nextIn: number;
  offers: { slot: number; title: string; summary: string; level: number; reward: string; lines: string[]; taken: boolean }[];
  mine: QuestView[];
}
export interface HealQuoteView { id: string; dead: boolean; missing: number; cost: number }

export interface ActiveSlotView {
  uid: string; icon: string; name: string; key: string;
  cost: number; cdFrac: number; affordable: boolean; color: number;
}

/** Everything the DOM UI reads. The game pushes into these signals a few times per second. */
export const ui = {
  visible: signal(false),
  mana: signal(0),
  maxMana: signal(1),
  active: signal<(ActiveSlotView | null)[]>([null, null, null]),
  pending: signal(0),
  cards: signal<OfferedCard[]>([]),
  cardsOpen: signal(false),
  picks: signal<Record<string, number>>({}),
  autoPick: signal(false),
  loadoutOpen: signal(false),
  version: signal(0),
  safe: signal(true),
  party: signal<{ active: number; cd: number; heroes: HeroView[] }>({ active: 0, cd: 0, heroes: [] }),
  healerOpen: signal(false),
  buildMenuOpen: signal(false),
  build: signal<{ kind: string; name: string; icon: string; valid: boolean; reason: string; cost: { gold: number; wood: number; stone: number; iron: number } } | null>(null),
  towerPanel: signal<string | null>(null),
  waypointOpen: signal<string | null>(null),
  sailing: signal(false),
  shopOpen: signal(false),
  innOpen: signal(false),
  shop: signal<{ town: string; nextIn: number; items: ({ kind: 'spell'; tpl: string; price: number; sold: boolean } | { kind: 'rune'; id: string; price: number; sold: boolean })[] } | null>(null),
  dialog: signal<{ speaker: string; icon: string; text: string; choices?: { text: string; index: number }[]; last?: boolean; script?: boolean } | null>(null),
  quests: signal<QuestsView | null>(null),
  tracker: signal<QuestView | null>(null),
  journalOpen: signal(false),
  board: signal<BoardView | null>(null),
  boardOpen: signal(false),
  innCost: signal(0),
  hold: signal<{ progress: number; label: string; wave: number; waves: number; seconds: number } | null>(null),
  surface: signal<{ name: string; desc: string; color: number; bad: boolean } | null>(null),
  muted: signal(false),
  wallet: signal({ gold: 0, wood: 0, stone: 0, iron: 0 }),
  filter: signal<'off' | 'basic' | 'advanced'>('off'),
  device: signal<InputDevice>('mouse'),
  padKind: signal<PadKind>('xbox'),
  padName: signal(''),
  pauseOpen: signal(false),
  vibration: signal(true),
  deadzone: signal(0.2),
  textScale: signal(1),
  palette: signal<'default' | 'redgreen' | 'blueyellow'>('default'),
  reducedMotion: signal(false),
  bindVersion: signal(0),          // bumps when keys or buttons are rebound, so hints re-render
  rebindOpen: signal(false),
  tip: signal<{ id: string; icon: string; text: string } | null>(null),
  tipsOn: signal(true),
  game: null as any
};

/** Panels that take the screen: on small screens the HUD steps aside while one is open, and tips wait. */
export const panelOpen = () =>
  ui.loadoutOpen.value || ui.healerOpen.value || ui.shopOpen.value || ui.innOpen.value || ui.boardOpen.value ||
  ui.journalOpen.value || ui.buildMenuOpen.value || !!ui.towerPanel.value || !!ui.waypointOpen.value ||
  ui.pauseOpen.value || ui.rebindOpen.value || !!ui.dialog.value;

export const PICK_KEYS = ['1', '2', '3'];
