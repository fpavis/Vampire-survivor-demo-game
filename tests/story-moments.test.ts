import { describe, expect, it } from 'vitest';
import {
  EPILOGUE, INTERLUDES, LORD_FALL, LORD_INTRO, LORD_LAST, bossIntroCard, interludeDue, lordFallScene, lordFor, lordIntroScene, runSummary, victoryCard
} from '../src/core/story/ending';
import { CHAPTERS, DEMON_LORDS, SOVEREIGN } from '../src/core/story/story';

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

describe('the writing pass: scenes', () => {
  const all = [...DEMON_LORDS.map((l) => l.group), 'sovereign'];
  const lines = [...Object.values(LORD_INTRO).flat(), ...Object.values(LORD_LAST), ...Object.values(INTERLUDES), ...Object.values(LORD_FALL), ...EPILOGUE];
  it('every lord and the Sovereign have an introduction, last words and a closing line', () => {
    for (const k of all) {
      expect(LORD_INTRO[k]?.length, k).toBeGreaterThanOrEqual(1);
      expect(LORD_LAST[k], k).toBeTruthy();
      expect(LORD_FALL[k], k).toBeTruthy();
    }
  });
  it('every chapter has an Elder interlude', () => {
    for (const ch of CHAPTERS) expect(INTERLUDES[ch.id], ch.id).toBeTruthy();
  });
  it('lines fit on screen and use no emoji', () => {
    for (const l of lines) {
      expect(l.length, l).toBeLessThanOrEqual(150);
      expect(/\p{Extended_Pictographic}/u.test(l), l).toBe(false);
    }
  });
  it('a lord\'s scenes: its own words with its name, then the narrator', () => {
    for (const l of DEMON_LORDS) {
      const intro = lordIntroScene(l.id);
      expect(intro.map((x) => x.text)).toEqual(LORD_INTRO[l.group]);
      expect(intro.every((x) => x.speaker === l.name && x.title === l.title)).toBe(true);
      const fall = lordFallScene(l.id);
      expect(fall).toHaveLength(2);
      expect(fall[0]).toMatchObject({ speaker: l.name, text: LORD_LAST[l.group] });
      expect(fall[1]).toMatchObject({ speaker: '', text: LORD_FALL[l.group] });
    }
    expect(lordIntroScene(SOVEREIGN.id)[0].speaker).toBe(SOVEREIGN.name);
    expect(lordFallScene(SOVEREIGN.id)[1].text).toBe(LORD_FALL.sovereign);
    expect(lordIntroScene('nobody')).toEqual([]);
  });
  it('the Elder tells the latest closed chapter\'s interlude once, never the finale\'s', () => {
    const done = new Set<string>(), told = new Set<string>();
    const due = () => interludeDue((q) => done.has(q), (c) => told.has(c));
    expect(due()).toBeNull();
    done.add('m0_omen');
    expect(due()).toBe('ch0');
    done.add('m1_hollow'); done.add('m2_roots');
    expect(due()).toBe('ch2');                        // the latest one, not every one missed
    told.add('ch0'); told.add('ch1'); told.add('ch2');
    expect(due()).toBeNull();
    for (const c of CHAPTERS) done.add(c.quest);
    told.add('ch3'); told.add('ch4'); told.add('ch5');
    expect(due()).toBeNull();                         // the finale leads into the ending instead
  });
});
