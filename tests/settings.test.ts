import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, QUALITY, sanitizeSettings, showDamageNumber, showHealthBar } from '../src/core/settings/settings';

describe('settings', () => {
  it('fills defaults and drops bad values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ quality: 'ultra', renderScale: 7, fpsCap: 45, zoom: 9, shake: -1, hudScale: 0.1, minimap: 'large', tracker: 'yes', extra: 1 });
    expect(s.quality).toBe('high');
    expect(s.renderScale).toBe(1);
    expect(s.fpsCap).toBe(0);
    expect(s.zoom).toBe(2);
    expect(s.shake).toBe(0);
    expect(s.hudScale).toBe(0.8);
    expect(s.minimap).toBe('large');
    expect(s.tracker).toBe(true);
    expect((s as any).extra).toBeUndefined();
  });

  it('quality levels scale the effects down', () => {
    expect(QUALITY.low.particles).toBeLessThan(QUALITY.medium.particles);
    expect(QUALITY.medium.particles).toBeLessThan(QUALITY.high.particles);
    expect(QUALITY.low.ambience).toBe(false);
  });

  it('damage numbers and health bars follow their modes', () => {
    expect(showDamageNumber('all', false)).toBe(true);
    expect(showDamageNumber('crits', false)).toBe(false);
    expect(showDamageNumber('crits', true)).toBe(true);
    expect(showDamageNumber('off', true)).toBe(false);
    expect(showHealthBar('hurt', false)).toBe(false);
    expect(showHealthBar('hurt', true)).toBe(true);
    expect(showHealthBar('always', false)).toBe(true);
    expect(showHealthBar('off', true)).toBe(false);
  });

  it('dynamic resolution is on by default and takes only a yes or a no', () => {
    expect(DEFAULT_SETTINGS.dynRes).toBe(true);
    expect(sanitizeSettings({}).dynRes).toBe(true);
    expect(sanitizeSettings({ dynRes: false }).dynRes).toBe(false);
    expect(sanitizeSettings({ dynRes: 'no' }).dynRes).toBe(true);
    // a save from before it existed (no field) reads as on
    const old = { ...DEFAULT_SETTINGS } as Partial<typeof DEFAULT_SETTINGS>;
    delete old.dynRes;
    expect(sanitizeSettings(old).dynRes).toBe(true);
  });
});

import { seedFromText } from '../src/core/sim/rng';

describe('world seed from text', () => {
  it('uses whole numbers as they are and hashes other text the same way every time', () => {
    expect(seedFromText('12345')).toBe(12345);
    expect(seedFromText(' 42 ')).toBe(42);
    expect(seedFromText('dragon')).toBe(seedFromText('dragon'));
    expect(seedFromText('dragon')).not.toBe(seedFromText('Dragon'));
    expect(seedFromText('x')).toBeGreaterThanOrEqual(0);
  });
});
