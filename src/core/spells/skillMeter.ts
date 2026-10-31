// Damage per second per skill, for the training ground: one meter for everything, and one per source, where a
// source is a spell and the way its damage came (its own hits, its burn, a lingering zone, an aftershock, a rune
// it set off, a resting hero's assist, a tower). Times are in seconds.
import { DpsMeter } from './meter';

/** Where a hit came from: the spell item (uid and template) and the kind of damage. */
export interface SkillSource { uid?: string; tpl?: string; kind?: string }

export type SkillKind = 'hit' | 'dot' | 'burn' | 'echo' | 'rune:spark' | 'rune:burst' | 'rune:shard' | 'linked' | 'assist' | 'tower' | 'other';

export interface SkillRow {
  key: string;
  uid: string | null;
  tpl: string | null;
  kind: string;
  dps: number;          // over the meter's window
  total: number;        // since the last reset
  share: number;        // of all the damage since the last reset (0..1)
}

/** The key one source's damage is counted under. */
export const sourceKey = (s?: SkillSource | null): string => (s && (s.uid || s.tpl) ? `${s.uid || s.tpl}:${s.kind || 'hit'}` : 'other');

export class SkillMeter {
  readonly all: DpsMeter;
  private by = new Map<string, { uid: string | null; tpl: string | null; kind: string; meter: DpsMeter }>();

  constructor(readonly window = 5) { this.all = new DpsMeter(window); }

  /** Everything that hit, as one number (the old single meter). */
  get total() { return this.all.total; }
  get peak() { return this.all.peak; }

  add(t: number, v: number, src?: SkillSource | null) {
    if (!(v > 0)) return;
    this.all.add(t, v);
    const key = sourceKey(src);
    let row = this.by.get(key);
    if (!row) {
      row = { uid: src?.uid ?? null, tpl: src?.tpl ?? null, kind: key === 'other' ? 'other' : src?.kind || 'hit', meter: new DpsMeter(this.window) };
      this.by.set(key, row);
    }
    row.meter.add(t, v);
  }

  dps(now: number) { return this.all.dps(now); }
  idle(now: number, idle = 6) { return this.all.idle(now, idle); }

  /** One row per source, the strongest first (by damage per second now, then by total). Every row's rate is taken
   *  over the same span as the whole, so the rows add up to it. */
  breakdown(now: number): SkillRow[] {
    const total = this.all.total || 1;
    const { first } = this.all.windowSum(now);
    const span = this.all.span(now, first);
    const rows: SkillRow[] = [];
    for (const [key, r] of this.by) rows.push({ key, uid: r.uid, tpl: r.tpl, kind: r.kind, dps: r.meter.windowSum(now).sum / span, total: r.meter.total, share: r.meter.total / total });
    return rows.sort((a, b) => b.dps - a.dps || b.total - a.total || (a.key < b.key ? -1 : 1));
  }

  reset() { this.all.reset(); this.by.clear(); }
}
