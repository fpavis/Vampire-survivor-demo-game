import { describe, expect, it } from 'vitest';
import { EPILOGUE, LORD_FALL, bossIntroCard, lordFor, runSummary, victoryCard } from '../src/core/story/ending';
import { DEMON_LORDS, SOVEREIGN } from '../src/core/story/story';

describe('boss and victory cards', () => {
  it('name a demon lord with their title and blurb', () => {
    const c = bossIntroCard('field', 'Boar King', 'field');
    expect(c).toMatchObject({ kind: 'boss', name: 'Morwen', title: 'the Hollow Queen', lord: 'field' });
    expect(c.text).toBe(DEMON_LORDS[0].blurb);
  });
  it('name a regional warlord by its region', () => {
    const c = bossIntroCard(null, 'Crab King', 'shore');
    expect(c).toMatchObject({ name: 'Crab King', title: 'Warlord of the Salt Shore', lord: null });
  });
  it('close every lord\'s chapter with its own line', () => {
    for (const l of DEMON_LORDS) {
      const v = victoryCard(l.id, 'x', l.group);
      expect(v).toMatchObject({ kind: 'victory', name: l.name, title: 'falls' });
      expect(v.text).toBe(LORD_FALL[l.group]);
      expect(v.text.length).toBeGreaterThan(10);
    }
    expect(victoryCard(SOVEREIGN.id, 'x', null)).toMatchObject({ name: SOVEREIGN.name, text: LORD_FALL.sovereign });
    expect(victoryCard(null, 'Stone Titan', 'mountain').text).toMatch(/Stonecrest Mountains/);
  });
});

describe('who sits in a lair', () => {
  it('is the region\'s lord in its first land dungeon, and the Sovereign on the plateau at the end', () => {
    expect(lordFor('desert', 'land', true, false)).toBe('desert');
    expect(lordFor('desert', 'land', false, false)).toBeNull();
    expect(lordFor('desert', 'plateau', false, false)).toBeNull();
    expect(lordFor('mountain', 'plateau', false, true)).toBe(SOVEREIGN.id);
    expect(lordFor('shore', 'sea', true, false)).toBeNull();
  });
});

describe('the ending', () => {
  it('has an epilogue and sums up the run', () => {
    expect(EPILOGUE.length).toBeGreaterThanOrEqual(4);
    const roll = runSummary({ time: 3 * 3600 + 25 * 60, level: 31, kills: 4120, bosses: 9, distance: 480000, gold: 12345.6, places: 40, regions: 12, deaths: 3 });
    const m = Object.fromEntries(roll);
    expect(m['Time on the road']).toBe('3 h 25 min');
    expect(m['Distance walked']).toBe('10.0 km');
    expect(m['Gold earned']).toBe('12346');
    expect(roll).toHaveLength(9);
    expect(Object.fromEntries(runSummary({ time: 600, level: 1, kills: 0, bosses: 0, distance: 0, gold: 0, places: 0, regions: 0, deaths: 0 }))['Time on the road']).toBe('10 min');
  });
});
