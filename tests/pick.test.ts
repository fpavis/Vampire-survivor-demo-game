import { describe, expect, it } from 'vitest';
import { pickClicked } from '../src/core/input/pick';

describe('click to interact', () => {
  const chest = { t: 'chest', x: 100, y: 100, w: 60, h: 70 };
  const tree = { t: 'tree', x: 200, y: 100, w: 80, h: 220 };
  it('hits a thing on its base or anywhere up its height', () => {
    expect(pickClicked([chest, tree], 100, 98)).toBe('chest');
    expect(pickClicked([chest, tree], 205, -90)).toBe('tree');      // the crown of the tree, far above its trunk
  });
  it('misses empty ground', () => {
    expect(pickClicked([chest, tree], 150, 100)).toBeNull();
    expect(pickClicked([chest, tree], 100, 160)).toBeNull();        // well below the chest
    expect(pickClicked([], 0, 0)).toBeNull();
  });
  it('picks the nearest middle when boxes overlap', () => {
    const a = { t: 'a', x: 0, y: 0, w: 100, h: 100 }, b = { t: 'b', x: 30, y: 0, w: 100, h: 100 };
    expect(pickClicked([a, b], 25, -30)).toBe('b');
    expect(pickClicked([a, b], 2, -30)).toBe('a');
  });
});
