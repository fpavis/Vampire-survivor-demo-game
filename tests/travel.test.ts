import { describe, expect, it } from 'vitest';
import { destinations, fareShortfall, fareWords, townNodeId, travelFare, type TravelNode } from '../src/core/world/travel';

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

describe('a fare the party cannot pay', () => {
  it('says how much gold is missing, and nothing when the purse is enough', () => {
    expect(fareShortfall(57, 30)).toBe(27);
    expect(fareShortfall(57, 57)).toBe(0);
    expect(fareShortfall(57, 400)).toBe(0);
    expect(fareShortfall(0, 0)).toBe(0);
    expect(fareShortfall(56.2, 30.9)).toBe(27);
  });

  it('is worded with both numbers', () => {
    expect(fareWords(57, 30)).toBe('Not enough gold: the fare is 57, you have 30');
    expect(fareWords(57, 30.7)).toBe('Not enough gold: the fare is 57, you have 30');
  });
});
