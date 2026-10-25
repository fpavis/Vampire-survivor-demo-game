import { describe, expect, it } from 'vitest';
import { PALETTES, rarityColor, rarityLetter, threatColor, threatMark, type Threat } from '../src/core/access/palettes';

describe('colour palettes', () => {
  const bands: Threat[] = ['low', 'even', 'high', 'deadly'];
  it('keep every threat band and rarity tier distinct in every palette', () => {
    for (const { id } of PALETTES) {
      expect(new Set(bands.map((b) => threatColor(id, b))).size).toBe(4);
      expect(new Set([0, 1, 2, 3, 4].map((t) => rarityColor(id, t))).size).toBe(5);
    }
  });

  it('repeat the meaning with shapes and letters', () => {
    expect(threatMark('even')).toBe('');
    expect(threatMark('high')).toContain('▲');
    expect(threatMark('deadly')).toContain('☠');
    expect([0, 1, 2, 3, 4].map(rarityLetter)).toEqual(['C', 'U', 'R', 'E', 'L']);
    expect(rarityColor('default', 99)).toBe(rarityColor('default', 4));
  });
});
