import { describe, expect, it } from 'vitest';
import { DROP_RATES, filteredOut, resourceFor, rollKillLoot, runeValue, spellValue } from '../src/core/loot/loot';
import { makeSpell } from '../src/core/spells/spells';

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('kill loot rates', () => {
  it('over 100,000 level-1 kills the rates match the decided table', () => {
    const rand = seeded(42);
    let gold = 0, res = 0, skill = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const l = rollKillLoot(rand, { level: 1, group: 'field' });
      expect(l.xp).toBe(true);
      if (l.gold) gold++;
      if (l.resource) res++;
      if (l.skill) skill++;
    }
    expect(gold / N).toBeGreaterThan(DROP_RATES.gold * 0.95);
    expect(gold / N).toBeLessThan(DROP_RATES.gold * 1.1);
    expect(res / N).toBeGreaterThan(DROP_RATES.resource * 0.85);
    expect(res / N).toBeLessThan(DROP_RATES.resource * 1.2);
    expect(skill / N).toBeGreaterThan(DROP_RATES.skill * 0.6);
    expect(skill / N).toBeLessThan(DROP_RATES.skill * 1.5);
  });

  it('stronger monsters roll better, bosses always pay out', () => {
    const rate = (k: any) => { const r = seeded(7); let n = 0; for (let i = 0; i < 50_000; i++) if (rollKillLoot(r, k).skill) n++; return n; };
    expect(rate({ level: 60 })).toBeGreaterThan(rate({ level: 1 }));
    expect(rate({ level: 10, elite: true })).toBeGreaterThan(rate({ level: 10 }) * 4);
    const b = rollKillLoot(seeded(1), { level: 20, boss: true });
    expect(b.gold).toBeGreaterThan(0);
    expect(b.resource).not.toBeNull();
    expect(b.skill).toBe(true);
  });

  it('gold scales with level', () => {
    const r = seeded(3);
    const avg = (lvl: number) => { let t = 0, n = 0; for (let i = 0; i < 20000; i++) { const g = rollKillLoot(r, { level: lvl, boss: true }).gold; t += g; n++; } return t / n; };
    expect(avg(50)).toBeGreaterThan(avg(5) * 4);
  });

  it('regions yield fitting resources', () => {
    const r = seeded(9);
    const tally = (g: string) => { const t: any = { wood: 0, stone: 0, iron: 0 }; for (let i = 0; i < 3000; i++) t[resourceFor(g, 20, r)]++; return t; };
    expect(tally('forest').wood).toBeGreaterThan(tally('forest').stone);
    expect(tally('mountain').iron).toBeGreaterThan(300);
    expect(tally('field').iron).toBe(0);
  });
});

describe('salvage and filter', () => {
  it('rarer runes are worth more; levelled spells too', () => {
    expect(runeValue('spark')).toBeGreaterThan(runeValue('swift'));
    expect(spellValue(makeSpell('bolt', 5))).toBeGreaterThan(spellValue(makeSpell('bolt', 1)));
  });
  it('loot filter converts only low rarity runes', () => {
    expect(filteredOut('swift', 'basic')).toBe(true);
    expect(filteredOut('ignite', 'basic')).toBe(false);
    expect(filteredOut('ignite', 'advanced')).toBe(true);
    expect(filteredOut('spark', 'advanced')).toBe(false);
    expect(filteredOut('spark', 'off')).toBe(false);
  });
});
