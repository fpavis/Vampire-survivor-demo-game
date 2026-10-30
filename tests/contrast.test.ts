import { describe, expect, it } from 'vitest';
import { CSS } from '../src/ui/style';
import { PALETTES, goodBad, rarityColor, threatColor } from '../src/core/access/palettes';

// WCAG 2.x contrast of the colours the interface is built from. The browser audit (tests/e2e/phase9i.mjs) measures
// the text that is really on screen, in the default palette; this checks the tokens and every palette, so a colour
// that is only used in one of them cannot slip through.

const lum = (n: number) => [n >> 16 & 255, n >> 8 & 255, n & 255]
  .map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
  .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: number, b: number) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** The colour tokens (`--c-name:#rrggbb`) of the interface. */
const tokens: Record<string, number> = {};
for (const m of CSS.matchAll(/--c-([a-z0-9-]+):#([0-9a-f]{6})\b/gi)) tokens[m[1]] = parseInt(m[2], 16);

const PANELS = ['panel', 'panel-2'];                       // what text sits on
const TEXT = ['text', 'soft', 'muted', 'dim', 'gold', 'gold-deep', 'good', 'bad', 'mana', 'focus'];

describe('colour contrast', () => {
  it('finds the tokens', () => {
    for (const name of [...PANELS, ...TEXT]) expect(tokens[name], name).toBeGreaterThan(0);
  });

  for (const fg of TEXT) {
    it(`the ${fg} text colour reads on the panels (4.5:1)`, () => {
      for (const bg of PANELS) expect(ratio(tokens[fg], tokens[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const { id } of PALETTES) {
    it(`the ${id} palette reads on the panels (rarity, threat, good and bad)`, () => {
      const colours: [string, number][] = [
        ...[0, 1, 2, 3, 4].map((t): [string, number] => [`rarity ${t}`, rarityColor(id, t)]),
        ...(['low', 'even', 'high', 'deadly'] as const).map((t): [string, number] => [`threat ${t}`, threatColor(id, t)]),
        ['good', goodBad(id).good], ['bad', goodBad(id).bad]
      ];
      const low = colours.flatMap(([what, colour]) => PANELS.map((bg) => [`${what} on ${bg}`, ratio(colour, tokens[bg])] as const).filter(([, r]) => r < 4.5)
        .map(([w, r]) => `${w}: ${r.toFixed(2)}`));
      expect(low).toEqual([]);
    });
  }
});
