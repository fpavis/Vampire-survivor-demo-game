import { describe, expect, it } from 'vitest';
import { destinations, townNodeId, travelFare, type TravelNode } from '../src/core/world/travel';

const town = (id: string, tx: number, ty: number): TravelNode => ({ id: townNodeId(id), kind: 'town', name: id, tx, ty });
const way = (tx: number, ty: number): TravelNode => ({ id: `t${tx},${ty}`, kind: 'waypoint', name: 'Waypoint', tx, ty });

describe('fast travel fares', () => {
  it('are free between two waypoints the party built', () => {
    expect(travelFare(way(0, 0), way(400, 300))).toBe(0);
  });

  it('cost gold by distance whenever a town teleporter is at either end', () => {
    const a = town('a', 0, 0), b = town('b', 100, 0), c = town('c', 400, 0);
    expect(travelFare(a, b)).toBe(57);                       // 12 + 100 x 0.45
    expect(travelFare(a, c)).toBeGreaterThan(travelFare(a, b));
    expect(travelFare(a, way(100, 0))).toBe(57);
    expect(travelFare(way(100, 0), a)).toBe(57);
    expect(travelFare(a, b)).toBe(travelFare(b, a));
  });

  it('list every other node nearest first', () => {
    const here = town('here', 0, 0);
    const list = destinations(here, [here, town('far', 500, 0), way(20, 0), town('mid', 100, 0)]);
    expect(list.map((d) => d.node.name)).toEqual(['Waypoint', 'mid', 'far']);
    expect(list[0].fare).toBe(21);
  });
});
