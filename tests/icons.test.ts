import { describe, expect, it } from 'vitest';
import { isIcon, iconDef } from '../src/core/icons/icons';
import { ICON_DATA } from '../src/core/icons/data';
import { TEMPLATES, RUNES, CORE_INFO } from '../src/core/spells/spells';
import { CARDS, PATHS } from '../src/core/hero/stats';
import { HERO_DEFS } from '../src/core/party/party';
import { TOWER_DEFS } from '../src/core/world/towers';
import { GROUP_INFO, POI_INFO } from '../src/core/world/biomes';
import { TIPS } from '../src/core/onboarding/tips';
import { DIALOGUES } from '../src/core/story/story';

describe('icons', () => {
  it('every icon has a viewBox and path data', () => {
    for (const name of Object.keys(ICON_DATA)) {
      const d = iconDef(name as any);
      expect(d.w).toBeGreaterThan(0);
      expect(d.d).toMatch(/^[Mm]/);
    }
  });

  it('every icon named in game data exists in the set', () => {
    const named: [string, string][] = [
      ...Object.values(TEMPLATES).map((t) => [`spell ${t.id}`, t.icon] as [string, string]),
      ...Object.values(RUNES).map((r) => [`rune ${r.id}`, r.icon] as [string, string]),
      ...Object.entries(CORE_INFO).map(([k, c]) => [`school ${k}`, c.icon] as [string, string]),
      ...Object.values(CARDS).map((c) => [`card ${c.id}`, c.icon] as [string, string]),
      ...Object.entries(PATHS).map(([k, p]) => [`path ${k}`, p.icon] as [string, string]),
      ...HERO_DEFS.map((h) => [`hero ${h.id}`, h.icon] as [string, string]),
      ...Object.values(TOWER_DEFS).map((t) => [`tower ${t.kind}`, t.icon] as [string, string]),
      ...Object.entries(GROUP_INFO).map(([k, g]) => [`group ${k}`, g.icon] as [string, string]),
      ...Object.entries(POI_INFO).map(([k, p]) => [`place ${k}`, p.icon] as [string, string]),
      ...TIPS.map((t) => [`tip ${t.id}`, t.icon] as [string, string]),
      ...Object.values(DIALOGUES).flatMap((d) => Object.values(d.nodes).filter((n) => n.icon).map((n) => [`dialogue ${d.id}`, n.icon!] as [string, string]))
    ];
    expect(named.length).toBeGreaterThan(90);
    expect(named.filter(([, icon]) => !isIcon(icon))).toEqual([]);
  });
});
