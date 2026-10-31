import { describe, expect, it } from 'vitest';
import {
  HERO_DEFS, PARTY_SIZE, applyHealer, auraOf, benchTick, benchXp, healerQuote, levelHero, newHero, nextAlive, partyStats, partyWiped, reviveAfterWipe, reviveCost
} from '../src/core/party/party';
import { computeStats } from '../src/core/hero/stats';

const party = () => HERO_DEFS.map((d) => newHero(d, [], []));

describe('party', () => {
  it('is three heroes with distinct identities and starters', () => {
    expect(HERO_DEFS).toHaveLength(PARTY_SIZE);
    expect(new Set(HERO_DEFS.map((d) => d.id)).size).toBe(3);
    const starters = HERO_DEFS.flatMap((d) => [...d.starter.auto, ...d.starter.active]);
    expect(new Set(starters).size).toBe(starters.length);
  });

  it('bench auras scale with the benched hero\'s own cards', () => {
    const h = party();
    const none = partyStats(h, 0);
    h[1].picks = { might: 4, swift: 2 };
    const withAura = partyStats(h, 0);
    expect(withAura.might).toBeGreaterThan(none.might);
    expect(withAura.speed).toBeGreaterThan(none.speed);
    expect(withAura.maxHealth).toBe(none.maxHealth);        // never from auras
    expect(auraOf(computeStats({ might: 4 })).might).toBeCloseTo(0.08);     // a quarter of +32%
    expect(auraOf(computeStats({ reach: 4, greed: 5 }))).toMatchObject({ area: expect.closeTo(0.05), gold: expect.closeTo(0.1) });
  });

  it('dead heroes give no aura and the active hero\'s own cards still count', () => {
    const h = party();
    h[1].picks = { might: 5 };
    h[0].picks = { might: 1 };
    const live = partyStats(h, 0).might;
    h[1].dead = true;
    expect(partyStats(h, 0).might).toBeLessThan(live);
    expect(partyStats(h, 0).might).toBeCloseTo(1.08);
  });

  it('picks the next living hero and detects a wipe', () => {
    const h = party();
    h[1].dead = true;
    expect(nextAlive(h, 0)).toBe(2);
    expect(nextAlive(h, 2)).toBe(0);
    h[2].dead = true;
    expect(partyWiped(h)).toBe(false);
    h[0].dead = true;
    expect(partyWiped(h)).toBe(true);
    expect(nextAlive(h, 0)).toBe(-1);
  });

  it('bench heroes regenerate slowly and gain half xp', () => {
    const h = party()[1];
    h.health = 10;
    benchTick(h, 600);
    expect(h.health).toBeGreaterThan(10);
    expect(h.health).toBeLessThan(100);
    expect(benchXp(h, 100)).toBeCloseTo(50);
    // weighed by the resting hero's level against the source's, like the active hero's
    expect(benchXp(h, 100, 1)).toBeCloseTo(50);
    expect(benchXp(h, 100, 11)).toBeCloseTo(70);          // below the land: catching up
    h.level = 20;
    expect(benchXp(h, 100, 5)).toBeLessThan(1);           // far above it: next to nothing
    h.level = 1;
    h.dead = true; const before = h.health; benchTick(h, 600);
    expect(h.health).toBe(before);
  });

  it('levels a bench hero from stored xp', () => {
    const h = party()[2];
    h.experience = 100000;
    const n = levelHero(h);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(h.pending).toBe(n);
    expect(h.level).toBe(1 + n);
    expect(h.experience).toBeLessThan(h.nextLevel);
  });
});

describe('healer', () => {
  it('heals for gold, revives dead heroes for more, refuses without gold', () => {
    const h = party()[0];
    expect(healerQuote(h).cost).toBe(0);
    h.health = 40;
    const q = healerQuote(h);
    expect(q.missing).toBe(60);
    expect(q.cost).toBeGreaterThan(0);
    expect(applyHealer(h, q.cost - 1)).toBe(-1);
    expect(h.health).toBe(40);
    expect(applyHealer(h, q.cost)).toBe(q.cost);
    expect(h.health).toBe(100);
    h.dead = true; h.health = 0;
    const rq = healerQuote(h);
    expect(rq.dead).toBe(true);
    expect(rq.cost).toBe(reviveCost(1));
    expect(applyHealer(h, 5)).toBe(-1);
    expect(h.dead).toBe(true);
    expect(applyHealer(h, 999)).toBe(rq.cost);
    expect(h.dead).toBe(false);
    expect(h.health).toBe(100);
  });

  it('a party wipe revives everyone at reduced health', () => {
    const h = party();
    h.forEach((x) => { x.dead = true; x.health = 0; });
    reviveAfterWipe(h);
    expect(h.every((x) => !x.dead && x.health === 40)).toBe(true);
  });

  it('revive costs grow with level', () => {
    expect(reviveCost(30)).toBeGreaterThan(reviveCost(3));
  });
});
