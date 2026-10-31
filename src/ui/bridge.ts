import { signal } from '@preact/signals';
import type { OfferedCard } from '../core/hero/stats';
import type { PadKind } from '../core/input/gamepad';
import { DEFAULT_SETTINGS, type Settings } from '../core/settings/settings';

export type InputDevice = 'key' | 'mouse' | 'pad' | 'touch';

export interface HeroView {
  id: string; name: string; icon: string; color: number; level: number; dead: boolean; pending: number;
  hp: number; maxHp: number; mana: number; maxMana: number;
}
export interface ObjView { text: string; progress: string; done: boolean }
export interface QuestView {
  id: string; title: string; summary: string; kind: string; giver: string; level: number;
  ready: boolean; payable: boolean; tracked: boolean; reward: string; objectives: ObjView[];
  back?: string;                         // where it is handed in
}
/** Which way and how far a quest's next place lies: the arrow turns by `angle` (screen, 0 = right, clockwise). */
export interface AimView { name: string; tiles: number; angle: number; dir: string; why: 'objective' | 'hand-in' }
/** What a town thinks of the party. */
export interface StandingView {
  town: string; tier: string; n: number; next: { name: string; at: number } | null; bonus: number; discount: number; freeInn: boolean;
}
export interface QuestsView {
  begun: boolean;
  chapter: { title: string; blurb: string } | null;
  next: { title: string; summary: string; status: string; level: number } | null;
  main: QuestView | null;
  bounties: QuestView[];
  done: number;
  standing?: StandingView[];
  lords: { name: string; title: string; group: string; dead: boolean }[];
  sovereign: { name: string; title: string; dead: boolean };
}
export interface BoardView {
  town: string; nextIn: number;
  offers: { slot: number; title: string; summary: string; level: number; reward: string; lines: string[]; taken: boolean }[];
  mine: QuestView[];
  standing?: StandingView;
}
export interface HealQuoteView { id: string; dead: boolean; missing: number; cost: number }

export interface ActiveSlotView {
  uid: string; icon: string; name: string; key: string;
  cost: number; cdFrac: number; affordable: boolean; color: number;
}

export interface LogEntry { t: number; text: string; icon: string; big: boolean }

/** The pages of the game menu (Esc / Start), in the order of its page list. */
export type MenuPage = 'party' | 'spells' | 'upgrades' | 'journal' | 'build' | 'save' | 'settings';
export const MENU_PAGES: MenuPage[] = ['party', 'spells', 'upgrades', 'journal', 'build', 'save', 'settings'];

/** Everything the DOM UI reads. The game pushes into these signals a few times per second. */
export const ui = {
  visible: signal(false),
  mana: signal(0),
  maxMana: signal(1),
  active: signal<(ActiveSlotView | null)[]>([null, null, null]),
  pending: signal(0),
  cards: signal<OfferedCard[]>([]),
  picks: signal<Record<string, number>>({}),
  autoPick: signal(false),
  version: signal(0),
  safe: signal(true),
  party: signal<{ active: number; cd: number; heroes: HeroView[] }>({ active: 0, cd: 0, heroes: [] }),
  healerOpen: signal(false),
  build: signal<{ kind: string; name: string; icon: string; valid: boolean; reason: string; cost: { gold: number; wood: number; stone: number; iron: number }; claimed?: boolean } | null>(null),
  towerPanel: signal<string | null>(null),
  worldMap: signal<{ mode: 'view' | 'travel'; from?: string | null } | null>(null),   // the full-screen world map
  sailing: signal(false),
  shopOpen: signal(false),
  innOpen: signal(false),
  shop: signal<{ town: string; nextIn: number; discount?: number; items: ({ kind: 'spell'; tpl: string; price: number; sold: boolean } | { kind: 'rune'; id: string; price: number; sold: boolean })[] } | null>(null),
  dialog: signal<{ speaker: string; icon: string; text: string; choices?: { text: string; index: number }[]; last?: boolean; script?: boolean; job?: boolean } | null>(null),
  quests: signal<QuestsView | null>(null),
  tracker: signal<QuestView | null>(null),
  aims: signal<Record<string, AimView>>({}),            // by quest id: where each active quest wants the party to go
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
  pauseOpen: signal(false),                   // the game menu is open (the game is paused under it)
  menuPage: signal<MenuPage>('party'),        // its page, kept between openings
  menuSeq: signal(0),                         // bumps on every opening or page jump, so the page can take focus
  vibration: signal(true),
  vibrationStrength: signal(0.7),
  deadzone: signal(0.2),
  textScale: signal(1),
  palette: signal<'default' | 'redgreen' | 'blueyellow'>('default'),
  reducedMotion: signal(false),
  bindVersion: signal(0),          // bumps when keys or buttons are rebound, so hints re-render
  rebindOpen: signal(false),
  tip: signal<{ id: string; icon: string; text: string } | null>(null),
  tipsOn: signal(true),
  settings: signal<Settings>({ ...DEFAULT_SETTINGS }),
  title: signal(false),                       // the title screen is up (its DOM parts show)
  slotsOpen: signal<'load' | 'save' | null>(null),
  optionsOpen: signal(false),                 // the settings panel opened from the title
  creditsOpen: signal(false),
  newGameSeed: signal(''),                    // seed for the next new game ('' = random)
  log: signal<LogEntry[]>([]),
  // the training ground's meter: everything together, and a row per skill (its icon, name, kind of damage, share)
  dummy: signal<{ dps: number; total: number; peak: number; hit: number; of: number; rows: { key: string; name: string; icon: string; kind: string; dps: number; share: number }[] } | null>(null),
  // story moments: a boss or victory card over the action, the ending and its closing roll, the death screen
  // a story scene: letterbox bars, who speaks (a portrait or an icon) and the line typed out to `shown` characters
  scene: signal<{ id: number; index: number; count: number; speaker: string; title: string; text: string; shown: number; portrait: string; icon: string } | null>(null),
  // the guided controller setup in progress, and whether the pad in hand has a saved setup
  padSetup: signal<{ name: string; step: number; total: number; prompt: string } | null>(null),
  padProfile: signal(false),
  crash: signal<{ message: string; report: string; fatal: boolean } | null>(null),      // the crash screen
  storageWarn: signal<'memory' | 'failed' | null>(null),     // saving is not possible right now
  card: signal<{ id: number; kind: 'boss' | 'victory' | 'wake'; name: string; title: string; text: string } | null>(null),
  ending: signal<{ epilogue: string[]; roll: [string, string][]; credits: { section: string; lines: string[] }[] } | null>(null),
  death: signal<{ place: string; rows: [string, string, string][] } | null>(null),                // recent toasts and banners, newest last
  mapCtl: null as any,                        // the open world map's controls (zoom, recentre, pan) for the pad and tests
  game: null as any
};

/** Panels that take the screen: on small screens the HUD steps aside while one is open, and tips wait. */
export const panelOpen = () =>
  ui.healerOpen.value || ui.shopOpen.value || ui.innOpen.value || ui.boardOpen.value || !!ui.towerPanel.value ||
  ui.pauseOpen.value || ui.rebindOpen.value || !!ui.dialog.value || !!ui.slotsOpen.value || ui.optionsOpen.value || ui.creditsOpen.value ||
  !!ui.death.value || !!ui.ending.value || !!ui.worldMap.value;

export const PICK_KEYS = ['1', '2', '3'];

/** The game menu is open on this page. */
export const menuOn = (page: MenuPage) => ui.pauseOpen.value && ui.menuPage.value === page;
