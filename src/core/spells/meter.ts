// A damage meter for the training dummy: damage per second over a sliding window, the total and the best second
// rate seen. Times are in seconds.

export class DpsMeter {
  private hits: { t: number; v: number }[] = [];
  total = 0;
  peak = 0;
  last = -Infinity;

  constructor(readonly window = 5) {}

  add(t: number, v: number) {
    if (!(v > 0)) return;
    this.hits.push({ t, v });
    this.total += v;
    this.last = t;
  }

  /** Damage per second over the last `window` seconds; a fresh burst counts over at least one second. */
  dps(now: number): number {
    const from = now - this.window;
    let i = 0;
    while (i < this.hits.length && this.hits[i].t < from) i++;
    if (i) this.hits.splice(0, i);
    if (!this.hits.length) return 0;
    let sum = 0;
    for (const h of this.hits) sum += h.v;
    const rate = sum / Math.max(1, Math.min(this.window, now - this.hits[0].t));
    if (now - this.hits[0].t >= 1) this.peak = Math.max(this.peak, rate);
    return rate;
  }

  /** No hit for `idle` seconds. */
  idle(now: number, idle = 6) { return now - this.last > idle; }

  reset() { this.hits = []; this.total = 0; this.peak = 0; this.last = -Infinity; }
}
