import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/sim/events';
import { RngStreams } from '../src/core/sim/rng';

describe('EventBus', () => {
  it('delivers events to subscribers and supports unsubscribe', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on('CampCleared', fn);
    bus.emit('CampCleared', { id: 'a' });
    off();
    bus.emit('CampCleared', { id: 'b' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ id: 'a' });
  });
});

describe('RngStreams', () => {
  it('streams are independent and reproducible', () => {
    const a = new RngStreams(7), b = new RngStreams(7);
    const sa = [a.loot(), a.loot()], sb = [b.loot(), b.loot()];
    expect(sa).toEqual(sb);
    a.cosmetic(); a.cosmetic(); // consuming cosmetic must not alter loot
    expect(a.loot()).toBe(b.loot());
  });
});
