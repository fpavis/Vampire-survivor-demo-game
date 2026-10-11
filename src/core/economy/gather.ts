// Resource nodes: trees, rocks and ore on the map can be harvested once; what is gone stays gone.
import type { ResourceId } from '../loot/loot';

export interface NodeDef { resource: ResourceId; hits: number; min: number; max: number; verb: string; extra?: { resource: ResourceId; min: number; max: number } }

export const NODES: Record<string, NodeDef> = {
  appletree: { resource: 'wood', hits: 3, min: 2, max: 4, verb: 'Chop' },
  birch: { resource: 'wood', hits: 3, min: 2, max: 3, verb: 'Chop' },
  oak: { resource: 'wood', hits: 4, min: 3, max: 5, verb: 'Chop' },
  pine: { resource: 'wood', hits: 3, min: 2, max: 4, verb: 'Chop' },
  snowpine: { resource: 'wood', hits: 3, min: 2, max: 4, verb: 'Chop' },
  palm: { resource: 'wood', hits: 3, min: 2, max: 3, verb: 'Chop' },
  dead: { resource: 'wood', hits: 2, min: 1, max: 2, verb: 'Chop' },
  log: { resource: 'wood', hits: 2, min: 2, max: 3, verb: 'Split' },
  rock: { resource: 'stone', hits: 3, min: 2, max: 3, verb: 'Mine' },
  mossrock: { resource: 'stone', hits: 3, min: 2, max: 3, verb: 'Mine' },
  sandrock: { resource: 'stone', hits: 3, min: 2, max: 4, verb: 'Mine' },
  beachrock: { resource: 'stone', hits: 3, min: 2, max: 3, verb: 'Mine' },
  icerock: { resource: 'stone', hits: 3, min: 2, max: 3, verb: 'Mine' },
  boulder: { resource: 'stone', hits: 5, min: 4, max: 6, verb: 'Mine' },
  ore: { resource: 'iron', hits: 5, min: 1, max: 3, verb: 'Mine', extra: { resource: 'stone', min: 1, max: 2 } }
};

export const isNode = (type: string) => type in NODES;
/** stable id of a placed decor item (it is regenerated identically from the seed) */
export const nodeId = (type: string, x: number, y: number) => `${type}:${Math.round(x)},${Math.round(y)}`;

export interface Yield { resource: ResourceId; amount: number }
export function rollYield(type: string, rand: () => number, bonus = 0): Yield[] {
  const n = NODES[type];
  if (!n) return [];
  const roll = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const out: Yield[] = [{ resource: n.resource, amount: roll(n.min, n.max) + bonus }];
  if (n.extra) out.push({ resource: n.extra.resource, amount: roll(n.extra.min, n.extra.max) });
  return out;
}
