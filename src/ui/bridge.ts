import { signal } from '@preact/signals';
import type { OfferedCard } from '../core/hero/stats';

export interface HeroView {
  id: string; name: string; icon: string; color: number; level: number; dead: boolean; pending: number;
  hp: number; maxHp: number; mana: number; maxMana: number;
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
  shopOpen: signal(false),
  innOpen: signal(false),
  shop: signal<{ town: string; nextIn: number; items: ({ kind: 'spell'; tpl: string; price: number; sold: boolean } | { kind: 'rune'; id: string; price: number; sold: boolean })[] } | null>(null),
  dialog: signal<{ speaker: string; icon: string; text: string } | null>(null),
  innCost: signal(0),
  hold: signal<{ progress: number; label: string; wave: number; waves: number; seconds: number } | null>(null),
  surface: signal<{ name: string; desc: string; color: number; bad: boolean } | null>(null),
  muted: signal(false),
  wallet: signal({ gold: 0, wood: 0, stone: 0, iron: 0 }),
  filter: signal<'off' | 'basic' | 'advanced'>('off'),
  game: null as any
};

export const PICK_KEYS = ['1', '2', '3'];
