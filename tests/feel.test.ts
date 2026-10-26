import { describe, expect, it } from 'vitest';
import { CAMERA_FOLLOW, CAMERA_LEAD, CRIT_STOP_COOLDOWN, FOLLOW_LAG, HIT_STOP, STACK_GAP, STACK_MAX_AGE, cameraLead, canStack, hitStopFrames } from '../src/core/sim/feel';

describe('hit-stop', () => {
  it('holds longer for bigger impacts', () => {
    expect(hitStopFrames('crit', 1, 100, -1e9)).toBe(HIT_STOP.crit);
    expect(hitStopFrames('bigKill', 1, 100, -1e9)).toBe(HIT_STOP.bigKill);
    expect(hitStopFrames('bossKill', 1, 100, -1e9)).toBe(HIT_STOP.bossKill);
    expect(HIT_STOP.bossKill).toBeGreaterThan(HIT_STOP.bigKill);
    expect(HIT_STOP.bigKill).toBeGreaterThan(HIT_STOP.crit);
  });
  it('follows the shake setting and is off at zero', () => {
    expect(hitStopFrames('bossKill', 0, 100, -1e9)).toBe(0);
    expect(hitStopFrames('bossKill', 0.5, 100, -1e9)).toBe(Math.round(HIT_STOP.bossKill / 2));
    expect(hitStopFrames('crit', 0.1, 100, -1e9)).toBe(1);
  });
  it('lets a crit freeze only once in a while', () => {
    expect(hitStopFrames('crit', 1, 100, 100 - CRIT_STOP_COOLDOWN + 1)).toBe(0);
    expect(hitStopFrames('crit', 1, 100, 100 - CRIT_STOP_COOLDOWN)).toBe(HIT_STOP.crit);
    expect(hitStopFrames('bigKill', 1, 100, 99)).toBe(HIT_STOP.bigKill);   // kills are not held back by a crit
  });
});

describe('camera lead', () => {
  it('looks ahead along the direction of travel, less vertically', () => {
    expect(cameraLead(1, 0, true)).toEqual({ x: CAMERA_LEAD, y: 0 });
    const down = cameraLead(0, 3, true);
    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeCloseTo(CAMERA_LEAD * 0.7);
    const diag = cameraLead(1, 1, true);
    expect(Math.hypot(diag.x, diag.y / 0.7)).toBeCloseTo(CAMERA_LEAD);
  });
  it('stays ahead at any walking speed, making up for the camera\'s follow lag', () => {
    // simulate the camera following a hero walking right at 4 units per frame
    let hero = 0, cam = 0, lead = 0;
    for (let i = 0; i < 600; i++) {
      hero += 4;
      lead += (cameraLead(1, 0, true, 4).x - lead) * 0.05;
      cam += (hero + lead - cam) * CAMERA_FOLLOW;
    }
    expect(cam - hero).toBeCloseTo(CAMERA_LEAD, 0);
    expect(FOLLOW_LAG).toBeGreaterThan(5);
  });
  it('centres on the hero when standing still', () => {
    expect(cameraLead(1, 0, false)).toEqual({ x: 0, y: 0 });
    expect(cameraLead(0, 0, true)).toEqual({ x: 0, y: 0 });
  });
});

describe('stacked damage numbers', () => {
  it('stacks quick hits on a young number only', () => {
    expect(canStack(0, 0)).toBe(true);
    expect(canStack(STACK_GAP, 30)).toBe(true);
    expect(canStack(STACK_GAP + 1, 30)).toBe(false);
    expect(canStack(2, STACK_MAX_AGE + 1)).toBe(false);
  });
});
