import { describe, expect, it } from 'vitest';
import {
  RUNES, TEMPLATES, addSpellXp, canSocket, describeSpell, makeSpell, previewRune, resolveSpell, rollSkillDrop, spellXpFor, starterLoadout
} from '../src/core/spells/spells';
import { CARDS, computeStats, offerCards, regenMana, spendMana } from '../src/core/hero/stats';

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('spell templates', () => {
  it('level 1 numbers match the original weapons', () => {
    const bolt = resolveSpell(makeSpell('bolt')).p;
    expect([bolt.damage, bolt.cooldown, bolt.count, bolt.pierce]).toEqual([22, 700, 1, 0]);
    const nova = resolveSpell(makeSpell('nova')).p;
    expect([nova.damage, nova.cooldown, nova.radius]).toEqual([22, 3200, 130]);
    const orbit = resolveSpell(makeSpell('orbit', 8)).p;
    expect([orbit.damage, orbit.count]).toEqual([40, 6]);
  });

  it('level always improves a spell', () => {
    for (const t of Object.values(TEMPLATES)) {
      const a = resolveSpell(makeSpell(t.id, 1)).p, b = resolveSpell(makeSpell(t.id, t.max)).p;
      const better = b.damage > a.damage || b.cooldown < a.cooldown || b.count > a.count || b.range > a.range || b.duration > a.duration;
      expect(better, t.id).toBe(true);
    }
  });
});

describe('runes and sockets', () => {
  it('rejects incompatible runes with a reason', () => {
    const nova = makeSpell('nova');
    expect(canSocket(nova, 'piercing', 0)).toEqual({ ok: false, reason: 'Does not work with Frost Nova' });
    expect(canSocket(nova, 'ignite', 0).ok).toBe(false); // frost core clashes with ignite
    expect(canSocket(nova, 'wide', 0).ok).toBe(true);
    const bolt = makeSpell('bolt');
    expect(canSocket(bolt, 'efficient', 0).ok).toBe(false); // active only
    expect(canSocket(makeSpell('dash'), 'efficient', 0).ok).toBe(true);
    expect(canSocket(bolt, 'swift', 5).ok).toBe(false);
  });

  it('refuses duplicate runes on one spell', () => {
    const bolt = makeSpell('bolt');
    bolt.runes[0] = 'swift';
    expect(canSocket(bolt, 'swift', 1).ok).toBe(false);
    expect(canSocket(bolt, 'swift', 0).ok).toBe(true); // replacing in place is fine
  });

  it('applies modifiers independent of socket order', () => {
    const a = makeSpell('bolt'), b = makeSpell('bolt');
    a.runes = ['multishot', 'heavy'];
    b.runes = ['heavy', 'multishot'];
    expect(resolveSpell(a).p).toEqual(resolveSpell(b).p);
    const p = resolveSpell(a).p;
    expect(p.count).toBe(2);
    expect(p.damage).toBeCloseTo(22 * 0.88 * 1.35);
  });

  it('ignores runes that became invalid (e.g. hand-edited saves)', () => {
    const nova = makeSpell('nova');
    nova.runes = ['piercing', null];
    expect(resolveSpell(nova).p.pierce).toBe(0);
  });

  it('collects triggers', () => {
    const bolt = makeSpell('bolt');
    bolt.runes = ['spark', 'echo'];
    expect(resolveSpell(bolt).triggers.map((t) => t.payload).sort()).toEqual(['burst', 'spark']);
  });

  it('fuzz: random loadouts always resolve to sane numbers', () => {
    const rand = seeded(7);
    const runeIds = Object.keys(RUNES);
    for (let n = 0; n < 2000; n++) {
      const tpls = Object.keys(TEMPLATES);
      const item = makeSpell(tpls[Math.floor(rand() * tpls.length)], 1 + Math.floor(rand() * 8));
      item.level = Math.min(item.level, TEMPLATES[item.tpl].max);
      for (let s = 0; s < item.runes.length; s++) {
        const id = runeIds[Math.floor(rand() * runeIds.length)];
        if (canSocket(item, id, s).ok) item.runes[s] = id;
      }
      const r = resolveSpell(item);
      for (const v of Object.values(r.p)) expect(Number.isFinite(v)).toBe(true);
      expect(r.p.count).toBeGreaterThanOrEqual(1);
      expect(r.p.cooldown).toBeGreaterThanOrEqual(120);
      expect(r.p.slow).toBeLessThanOrEqual(0.8);
    }
  });
});

describe('spell progression', () => {
  it('levels from kills and caps at max', () => {
    const s = makeSpell('bolt');
    expect(addSpellXp(s, spellXpFor(1) - 1)).toBe(false);
    expect(addSpellXp(s, 1)).toBe(true);
    expect(s.level).toBe(2);
    addSpellXp(s, 1e9);
    expect(s.level).toBe(TEMPLATES.bolt.max);
    expect(s.xp).toBe(0);
  });
});

describe('skill drops', () => {
  it('only produces valid items and favours common runes', () => {
    const rand = seeded(3);
    let runes = 0, common = 0, epic = 0;
    for (let i = 0; i < 4000; i++) {
      const d = rollSkillDrop(rand, 0);
      if (d.kind === 'spell') expect(TEMPLATES[d.tpl]).toBeTruthy();
      else { runes++; expect(RUNES[d.id]).toBeTruthy(); if (RUNES[d.id].rarity <= 1) common++; if (RUNES[d.id].rarity >= 3) epic++; }
    }
    expect(common).toBeGreaterThan(epic);
    expect(runes).toBeGreaterThan(2500);
  });

  it('stronger enemies roll better loot', () => {
    const count = (power: number) => {
      const rand = seeded(11); let n = 0;
      for (let i = 0; i < 4000; i++) { const d = rollSkillDrop(rand, power); if (d.kind === 'rune' && RUNES[d.id].rarity >= 3) n++; }
      return n;
    };
    expect(count(3)).toBeGreaterThan(count(0));
  });

  it('starter loadout has an auto spell and a dash', () => {
    const l = starterLoadout();
    expect(l.auto).toHaveLength(1);
    expect(l.spells.find((s) => s.uid === l.active[0])?.tpl).toBe('dash');
  });
});

describe('hero stats', () => {
  it('base stats and card scaling', () => {
    const base = computeStats({});
    expect(base.maxHealth).toBe(100);
    expect(base.maxMana).toBeGreaterThan(0);
    const s = computeStats({ might: 2, reservoir: 3, thrift: 4 });
    expect(s.might).toBeCloseTo(1.16);
    expect(s.maxMana).toBe(base.maxMana + 30);
    expect(s.manaCost).toBeCloseTo(0.88);
    expect([base.area, base.duration, base.luck, base.gold]).toEqual([1, 1, 1, 1]);
    const t = computeStats({ reach: 10, persistence: 10, fortune: 10, greed: 10, 'mastery-greed': 5 });
    expect(t.area).toBeCloseTo(1.5);
    expect(t.duration).toBeCloseTo(1.6);
    expect(t.luck).toBeCloseTo(1.6);
    expect(t.gold).toBeCloseTo(1.95);
  });

  it('offers three distinct cards that can still be levelled', () => {
    const rand = seeded(5);
    for (let i = 0; i < 200; i++) {
      const picks = { might: 5, haste: 5, crit: 2 };
      const cards = offerCards(picks, rand, 3);
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map((c) => c.id)).size).toBe(3);
      for (const c of cards) expect((picks as any)[c.id] ?? 0).toBeLessThan(CARDS[c.id].max);
    }
  });

  it('specialisation: investing in a path makes it show up more', () => {
    const rand = seeded(9);
    const tally = (picks: Record<string, number>) => {
      let n = 0;
      for (let i = 0; i < 1500; i++) for (const c of offerCards(picks, rand, 3)) if (CARDS[c.id].path === 'mana') n++;
      return n;
    };
    expect(tally({ reservoir: 2, wellspring: 1 })).toBeGreaterThan(tally({}));
  });

  it('mana is spent by active skills and regenerates up to the max', () => {
    const stats = computeStats({});
    const m = { value: stats.maxMana };
    expect(spendMana(m, 40)).toBe(true);
    expect(spendMana(m, 40)).toBe(false);
    regenMana(m, stats, 60 * 100);
    expect(m.value).toBe(stats.maxMana);
    const blocked = { value: 0 };
    regenMana(blocked, stats, 600, true);
    expect(blocked.value).toBe(0);
  });
});

describe('rune preview', () => {
  it('shows concrete before/after numbers', async () => {
    const { previewRune } = await import('../src/core/spells/spells');
    const bolt = makeSpell('bolt');
    expect(previewRune(bolt, 'multishot', 0)).toEqual(['Damage: 22 → 19', 'Count: 1 → 2']);
    expect(previewRune(bolt, 'swift', 0)).toEqual(['Cooldown: 0.70s → 0.56s']);
    expect(previewRune(makeSpell('nova'), 'piercing', 0)).toEqual([]);
    expect(previewRune(bolt, 'echo', 0)).toContain('On kill: explosion');
  });
});

describe('phase 8 archetypes and runes', () => {
  it('adds six new spells with sensible numbers', () => {
    for (const id of ['trail', 'wisp', 'glaive', 'cloud', 'slam', 'heal']) {
      const t = TEMPLATES[id];
      expect(t, id).toBeDefined();
      const p = resolveSpell(makeSpell(id)).p;
      if (t.mode === 'active') expect(p.mana, id).toBeGreaterThan(0);
      else expect(p.damage, id).toBeGreaterThan(0);
    }
    expect(resolveSpell(makeSpell('wisp')).p.homing).toBeGreaterThan(0);
    expect(resolveSpell(makeSpell('heal', 5)).p.heal).toBeGreaterThan(resolveSpell(makeSpell('heal')).p.heal);
  });

  it('checks where the new runes fit', () => {
    expect(canSocket(makeSpell('cloud'), 'keen', 0).ok).toBe(true);
    expect(canSocket(makeSpell('nova'), 'seeking', 0).ok).toBe(false);
    expect(canSocket(makeSpell('glaive'), 'seeking', 0).ok).toBe(true);
    expect(canSocket(makeSpell('bolt'), 'ricochet', 0).ok).toBe(true);
    expect(canSocket(makeSpell('meteor'), 'ricochet', 0).ok).toBe(false);
    expect(canSocket(makeSpell('slam'), 'overcharge', 0).ok).toBe(true);
    expect(canSocket(makeSpell('bolt'), 'overcharge', 0).ok).toBe(false);
    expect(canSocket(makeSpell('slam'), 'aftershock', 0).ok).toBe(true);
    expect(canSocket(makeSpell('trail'), 'lingering', 0).ok).toBe(true);
    expect(canSocket(makeSpell('heal'), 'heavy', 0).ok).toBe(false);
  });

  it('applies the new parameters', () => {
    const keen = makeSpell('bolt'); keen.runes = ['keen', 'seeking'];
    const p = resolveSpell(keen).p;
    expect(p.crit).toBeCloseTo(0.12);
    expect(p.homing).toBe(1);
    const big = makeSpell('nova'); big.runes = ['colossal', 'aftershock'];
    const q = resolveSpell(big).p;
    expect(q.radius).toBeCloseTo(130 * 1.3);
    expect(q.echo).toBe(1);
    const slam = makeSpell('slam'); slam.runes = ['overcharge'];
    expect(resolveSpell(slam).p.damage).toBeCloseTo(40 * 1.6);
    expect(resolveSpell(slam).p.mana).toBe(Math.round(30 * 1.3));
    const sip = makeSpell('cloud'); sip.runes = ['siphon', null];
    expect(resolveSpell(sip).p.manaLeech).toBe(2);
    const spl = makeSpell('glaive'); spl.runes = ['splinter', null];
    expect(resolveSpell(spl).triggers).toEqual([{ on: 'kill', payload: 'shards', chance: 1, power: 0.4 }]);
  });

  it('previews the new numbers when comparing runes', () => {
    const lines = previewRune(makeSpell('bolt'), 'keen', 0);
    expect(lines.some((l) => l.startsWith('Crit chance'))).toBe(true);
    expect(previewRune(makeSpell('bolt'), 'splinter', 0)).toContain('On kill: 3 shards');
    expect(describeSpell(resolveSpell(makeSpell('glaive')))).toContain('Pierces everything');
  });
});
