import { describe, expect, it } from 'vitest';
import { pixelCell, snapToCell } from '../src/core/render/look';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/core/settings/settings';

describe('pixel art grain', () => {
  it('is whole device pixels, never under two', () => {
    for (const res of [0.5, 0.75, 1, 1.25, 1.5, 2, 3]) for (const zoom of [0.8, 1, 1.2]) for (const grain of [2, 3, 4]) {
      const c = pixelCell(grain, zoom, res);
      expect(Number.isInteger(Math.round(c * res * 1e6) / 1e6)).toBe(true);
      expect(c * res).toBeGreaterThanOrEqual(2);
    }
  });

  it('matches the terrain texel at normal zoom (two world pixels a texel)', () => {
    expect(pixelCell(2, 1, 1)).toBe(2);
    expect(pixelCell(2, 1, 2)).toBe(2);
    expect(pixelCell(3, 1.2, 1)).toBe(4);
  });

  it('snaps positions onto the grid', () => {
    expect(snapToCell(13.2, 4)).toBe(12);
    expect(snapToCell(14.1, 4)).toBe(16);
    expect(snapToCell(7.4, 0)).toBe(7);
  });

  it('defaults to the pixel style with no screen filter, and rejects unknown values', () => {
    expect(DEFAULT_SETTINGS.artStyle).toBe('pixel');
    expect(DEFAULT_SETTINGS.postFx).toBe('none');
    const s = sanitizeSettings({ artStyle: 'blurry', pixelSize: 7, postFx: 'crt', colorGrade: 'noir' });
    expect(s.artStyle).toBe('pixel');
    expect(s.pixelSize).toBe(2);
    expect(s.postFx).toBe('crt');
    expect(s.colorGrade).toBe('noir');
  });
});
