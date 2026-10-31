import { describe, expect, it } from 'vitest';
import { TIPS, TIP_BY_ID, fillTip, nextTip, openConditions, tipsForCondition, tipsForEvent } from '../src/core/onboarding/tips';

describe('onboarding tips', () => {
  it('has unique ids and a trigger for every tip', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    for (const t of TIPS) expect('event' in t.trigger || 'cond' in t.trigger).toBe(true);
  });

  it('matches events by payload fields', () => {
    expect(tipsForEvent('PlaceEntered', { id: 'a', name: 'Oakhaven', kind: 'city' })).toEqual(['town']);
    expect(tipsForEvent('PlaceEntered', { id: 'b', name: 'Hollow', kind: 'cave' })).toEqual(['dark']);
    expect(tipsForEvent('PlaceEntered', { id: 'c', name: 'Old Keep', kind: 'ruins' })).toEqual(['dark']);
    expect(tipsForEvent('PlaceEntered', { id: 'd', name: 'Farm', kind: 'camp' })).toEqual([]);
    expect(tipsForEvent('HeroDied', { respawnAt: 'x' })).toEqual([]);
  });

  it('maps conditions to tips and stops checking conditions whose tips were seen', () => {
    expect(tipsForCondition('start')).toEqual(['welcome']);
    expect(openConditions(new Set())).toContain('boss');
    const all = new Set(TIPS.map((t) => t.id));
    expect(openConditions(all)).toEqual([]);
    expect(openConditions(new Set(['welcome']))).not.toContain('start');
  });

  it('picks the most urgent tip that was triggered and not seen', () => {
    expect(nextTip(new Set(), new Set())).toBeNull();
    expect(nextTip(new Set(), new Set(['gems', 'welcome', 'road']))!.id).toBe('welcome');
    expect(nextTip(new Set(['welcome']), new Set(['gems', 'welcome', 'road']))!.id).toBe('gems');
    expect(nextTip(new Set(['welcome']), new Set(['welcome']))).toBeNull();
    expect(nextTip(new Set(), new Set(['boss', 'upgrade']))!.id).toBe('boss');
  });

  it('fills action placeholders with the player\'s keys or buttons', () => {
    const keys: Record<string, string> = { upgrades: 'U', spells: 'I', move: 'WASD' };
    expect(fillTip(TIP_BY_ID.upgrade.text, (n) => keys[n] ?? '?')).toContain('Press U to pick');
    expect(fillTip('Move with {move}, open {spells}.', (n) => keys[n])).toBe('Move with WASD, open I.');
    for (const t of TIPS) expect(fillTip(t.text, () => 'X')).not.toMatch(/[{}]/);
  });
});
