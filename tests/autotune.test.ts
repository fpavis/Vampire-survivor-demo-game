import { describe, expect, it } from 'vitest';
import { DYNRES, frameBudget, initDynRes, pickQuality, stepDynRes, type DynResState } from '../src/core/settings/autotune';

const feed = (st: DynResState, ms: number, n: number, budget = 16.7) => { for (let i = 0; i < n; i++) st = stepDynRes(st, ms, budget); return st; };

describe('dynamic resolution', () => {
  it('steps down after about two seconds of long frames, one step at a time', () => {
    let st = feed(initDynRes(), 30, 60);              // 1.8 s
    expect(st.factor).toBe(1);
    st = feed(st, 30, 10);                            // past 2 s
    expect(st.factor).toBe(0.9);
    st = feed(st, 30, 10);
    expect(st.factor).toBe(0.9);                      // the clock starts again after a step
  });

  it('never goes below the floor', () => {
    const st = feed(initDynRes(), 40, 2000);
    expect(st.factor).toBe(DYNRES.min);
  });

  it('comes back up after about five seconds with room, to full at most', () => {
    let st = feed(initDynRes(), 40, 200);
    expect(st.factor).toBeLessThan(1);
    const low = st.factor;
    st = feed(st, 10, 400);                           // 4 s
    expect(st.factor).toBe(low);
    st = feed(st, 10, 120);                           // past 5 s
    expect(st.factor).toBe(Math.round((low + DYNRES.step) * 100) / 100);
    st = feed(st, 10, 5000);
    expect(st.factor).toBe(1);
  });

  it('frames near the budget hold steady, and hitches count for nothing', () => {
    let st = feed(initDynRes(), 17, 1000);
    expect(st.factor).toBe(1);
    st = feed(st, 900, 50);
    expect(st).toEqual({ factor: 1, over: 0, under: 0 });
  });

  it('a frame-rate cap sets the budget', () => {
    expect(frameBudget(0)).toBeCloseTo(16.67, 1);
    expect(frameBudget(30)).toBeCloseTo(33.3, 1);
    // at a 30 fps cap, 30 ms frames are on time
    expect(feed(initDynRes(), 30, 500, frameBudget(30)).factor).toBe(1);
  });
});

describe('first-run quality', () => {
  const frames = (ms: number, n = 90) => Array.from({ length: n }, (_, i) => ms + (i % 3) - 1);
  it('picks by the median frame time', () => {
    expect(pickQuality(frames(16.7))).toBe('high');
    expect(pickQuality(frames(25))).toBe('medium');
    expect(pickQuality(frames(45))).toBe('low');
  });
  it('a few hitches do not decide it, and too few frames leave it high', () => {
    expect(pickQuality([...frames(16.7), 400, 600, 900, 120, 110])).toBe('high');
    expect(pickQuality([50, 60])).toBe('high');
  });
});
