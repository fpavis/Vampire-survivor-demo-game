// Keeping up with the device: a first-run pick of the quality preset from how fast the title scene draws, and
// dynamic resolution, which lowers the render scale a step while frames keep running long and raises it again
// when there is room. Pure: the game feeds frame times in and applies what comes out.
import type { Quality } from './settings';

export const DYNRES = {
  min: 0.6,          // never below this share of the chosen render scale
  step: 0.1,
  downAfter: 2000,   // ms of long frames before a step down
  upAfter: 5000,     // ms of short frames before a step up
  overMul: 1.2,      // a frame is long past budget × this
  underMul: 0.75,    // and short under budget × this
  hitch: 250         // a frame this long is a hitch (loading, a tab coming back), not the steady rate
};

export interface DynResState { factor: number; over: number; under: number }
export const initDynRes = (): DynResState => ({ factor: 1, over: 0, under: 0 });

const round = (v: number) => Math.round(v * 100) / 100;

/** One frame of `frameMs` against a budget of `budgetMs`: the factor moves one step at most. */
export function stepDynRes(st: DynResState, frameMs: number, budgetMs: number, c = DYNRES): DynResState {
  if (!(frameMs > 0) || frameMs >= c.hitch) return st;
  let { factor, over, under } = st;
  if (frameMs > budgetMs * c.overMul) { over += frameMs; under = 0; }
  else if (frameMs < budgetMs * c.underMul) { under += frameMs; over = Math.max(0, over - frameMs); }
  else { over = Math.max(0, over - frameMs * 0.5); under = 0; }
  if (over >= c.downAfter && factor > c.min) return { factor: Math.max(c.min, round(factor - c.step)), over: 0, under: 0 };
  if (under >= c.upAfter && factor < 1) return { factor: Math.min(1, round(factor + c.step)), over: 0, under: 0 };
  return { factor, over, under };
}

/** The frame budget for a frame-rate cap (0: the display's own rate, taken as 60). */
export const frameBudget = (fpsCap: number) => 1000 / (fpsCap || 60);

/**
 * The quality preset for a device, from the title scene's frame times (ms): the median, so a hitch or two do not
 * count. Under 20 ms (the display's 60 or better) is high; under 30 medium; slower is low.
 */
export function pickQuality(frames: number[]): Quality {
  const v = frames.filter((f) => f > 0 && f < DYNRES.hitch).sort((a, b) => a - b);
  if (v.length < 10) return 'high';
  const median = v[Math.floor(v.length / 2)];
  return median < 20 ? 'high' : median < 30 ? 'medium' : 'low';
}
