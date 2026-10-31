import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, QUALITY, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, roundZoom, sanitizeSettings, showDamageNumber, showHealthBar, stepZoom } from '../src/core/settings/settings';

describe('settings', () => {
  it('fills defaults and drops bad values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ quality: 'ultra', renderScale: 7, fpsCap: 45, cameraZoom: 9, shake: -1, hudScale: 0.1, minimap: 'large', tracker: 'yes', extra: 1 });
    expect(s.quality).toBe('high');
    expect(s.renderScale).toBe(1);
    expect(s.fpsCap).toBe(0);
    expect(s.cameraZoom).toBe(ZOOM_MAX);
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

  it('the camera zoom is a number in steps of a tenth, between the far and the close limits', () => {
    expect(DEFAULT_SETTINGS.cameraZoom).toBe(1);
    expect([ZOOM_MIN, ZOOM_MAX, ZOOM_STEP]).toEqual([0.8, 1.6, 0.1]);
    expect(sanitizeSettings({ cameraZoom: 0.1 }).cameraZoom).toBe(ZOOM_MIN);
    expect(sanitizeSettings({ cameraZoom: 1.27 }).cameraZoom).toBe(1.3);
    expect(sanitizeSettings({ cameraZoom: 'close' }).cameraZoom).toBe(1);
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -2)).toBe(0.8);
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);          // at the end it stays
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
    // ten steps from the far end reach the close end, with no drift from adding tenths
    let z = ZOOM_MIN;
    for (let i = 0; i < 8; i++) z = stepZoom(z, 1);
    expect(z).toBe(ZOOM_MAX);
    expect(roundZoom(1.04)).toBe(1);
  });

  it('a camera setting saved by an older game (Far, Normal, Close as 0, 1, 2) becomes its zoom', () => {
    expect(sanitizeSettings({ zoom: 0 }).cameraZoom).toBe(0.8);
    expect(sanitizeSettings({ zoom: 1 }).cameraZoom).toBe(1);
    expect(sanitizeSettings({ zoom: 2 }).cameraZoom).toBe(1.2);
    expect(sanitizeSettings({ zoom: 7 }).cameraZoom).toBe(1);
    expect(sanitizeSettings({ zoom: 2, cameraZoom: 1.5 }).cameraZoom).toBe(1.5);   // the new key wins
    expect((sanitizeSettings({ zoom: 2 }) as unknown as Record<string, unknown>).zoom).toBeUndefined();
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
