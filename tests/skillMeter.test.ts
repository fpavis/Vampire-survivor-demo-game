import { describe, expect, it } from 'vitest';
import { SkillMeter, sourceKey } from '../src/core/spells/skillMeter';

describe('per-skill damage meter', () => {
  it('splits damage by spell and kind, and the rows add up to the whole', () => {
    const m = new SkillMeter(5);
    const bolt = { uid: 'a', tpl: 'bolt', kind: 'hit' };
    const novaBurn = { uid: 'b', tpl: 'nova', kind: 'burn' };
    for (let t = 0; t < 4; t += 0.5) { m.add(t, 30, bolt); m.add(t, 10, novaBurn); }
    m.add(3.9, 5, null);                                   // ground damage, no spell
    const rows = m.breakdown(4);
    expect(rows.map((r) => r.key)).toEqual(['a:hit', 'b:burn', 'other']);
    expect(rows[0]).toMatchObject({ uid: 'a', tpl: 'bolt', kind: 'hit', total: 240 });
    expect(rows[1].kind).toBe('burn');
    expect(rows[2].kind).toBe('other');
    expect(rows.reduce((s, r) => s + r.total, 0)).toBeCloseTo(m.total);
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
    expect(rows.reduce((s, r) => s + r.dps, 0)).toBeCloseTo(m.dps(4));
  });

  it('keeps a spell\'s own hits apart from its burn, zone and echoes', () => {
    expect(sourceKey({ uid: 'x', kind: 'hit' })).not.toBe(sourceKey({ uid: 'x', kind: 'burn' }));
    expect(sourceKey({ uid: 'x' })).toBe('x:hit');
    expect(sourceKey({ tpl: 'meteor', kind: 'echo' })).toBe('meteor:echo');
    expect(sourceKey(undefined)).toBe('other');
  });

  it('sorts by damage per second now, then by total', () => {
    const m = new SkillMeter(5);
    m.add(0, 500, { uid: 'old', kind: 'hit' });            // a big hit long ago
    m.add(9, 40, { uid: 'new', kind: 'hit' });
    const rows = m.breakdown(10);
    expect(rows[0].uid).toBe('new');
    expect(rows[1].uid).toBe('old');
    expect(rows[1].dps).toBe(0);
    expect(rows[1].share).toBeGreaterThan(0.9);
  });

  it('ignores nothing-hits, goes idle, and resets', () => {
    const m = new SkillMeter(5);
    m.add(1, 0, { uid: 'a' });
    m.add(1, -3, { uid: 'a' });
    expect(m.breakdown(1)).toEqual([]);
    m.add(2, 12, { uid: 'a' });
    expect(m.idle(5)).toBe(false);
    expect(m.idle(9)).toBe(true);
    m.reset();
    expect(m.total).toBe(0);
    expect(m.breakdown(10)).toEqual([]);
  });
});
