// Fast travel: every visited town has a teleporter, and the party can build waypoints of its own. Pure: what a
// trip costs and where it can go. A trip between two waypoints the party built is free; any trip that starts or
// ends at a town's teleporter costs gold by distance.
import { fareBetween } from './towers';

export type TravelKind = 'town' | 'waypoint';
export interface TravelNode { id: string; kind: TravelKind; name: string; tx: number; ty: number }

/** What a trip from `a` to `b` costs in gold. */
export function travelFare(a: TravelNode, b: TravelNode): number {
  if (a.kind === 'waypoint' && b.kind === 'waypoint') return 0;
  return fareBetween(a, b);
}

/** Where one can go from `from`: every other node, nearest first, with its fare. */
export function destinations(from: TravelNode, nodes: TravelNode[]): { node: TravelNode; fare: number; tiles: number }[] {
  return nodes
    .filter((n) => n.id !== from.id)
    .map((node) => ({ node, fare: travelFare(from, node), tiles: Math.round(Math.hypot(node.tx - from.tx, node.ty - from.ty)) }))
    .sort((a, b) => a.tiles - b.tiles);
}

/** Id of a town's teleporter node (towers keep their own ids, "t<tx>,<ty>"). */
export const townNodeId = (poiId: string) => `town:${poiId}`;
