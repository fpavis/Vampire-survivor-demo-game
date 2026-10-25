// Roads between towns. Every town links to its two nearest neighbours (within reach) and the start links to the
// nearest town; each link is routed with A* over the terrain (cheap on grass, dear in forest and hills, never
// through water, mountains or other landmarks) and widened to about two tiles. Pure and deterministic: roads
// are re-derived from the seed, cached per link and per chunk, and never saved.
import { WORLD_CONFIG } from '../config';
import { BIOME, isSolidBiome, isWaterBiome } from './biomes';
import { valueNoise } from './noise';
import type { Poi } from '../types';

const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;

export const ROAD = {
  reach: 100,        // tiles: towns further apart than this are not linked directly
  startReach: 240,   // tiles: how far the start looks for its first town
  links: 2,          // nearest neighbours per town
  margin: 24,        // tiles of detour room around a link
  cell: 16           // POI cell size (matches terrain.POI_CELL)
} as const;

export interface RoadSource {
  seed: number;
  biomeAt(tx: number, ty: number): number;
  poiForCell(cx: number, cy: number): Poi | null;
}

export interface RoadNode { id: string; tx: number; ty: number; name: string }

const COST: Record<number, number> = {
  [BIOME.GRASS]: 1, [BIOME.DRY]: 1.2, [BIOME.SAND]: 1.35, [BIOME.FOREST]: 1.7, [BIOME.HILL]: 2.5, [BIOME.PLATEAU]: 2.5
};

export const START_NODE: RoadNode = { id: 'start', tx: 0, ty: 2, name: 'the start' };

export class RoadNet {
  private nearCache = new Map<string, RoadNode[]>();
  private pathCache = new Map<string, number[] | null>();
  private chunkCache = new Map<string, Set<number>>();
  private nodeCache = new Map<string, RoadNode | null>();

  constructor(private src: RoadSource) {}

  /** The road node of a town POI cell: just outside the town gate. */
  nodeOfCell(cx: number, cy: number): RoadNode | null {
    const key = `${cx},${cy}`;
    if (this.nodeCache.has(key)) return this.nodeCache.get(key)!;
    const p = this.src.poiForCell(cx, cy);
    const n = p && p.type === 'city' ? { id: p.id, tx: Math.floor(p.ex / T), ty: Math.floor(p.ey / T) + 1, name: p.name } : null;
    this.nodeCache.set(key, n);
    return n;
  }

  /** Towns whose POI cells overlap a tile rectangle. */
  townsIn(x0: number, y0: number, x1: number, y1: number): RoadNode[] {
    const out: RoadNode[] = [];
    const C = ROAD.cell;
    for (let cy = Math.floor(y0 / C); cy <= Math.floor(y1 / C); cy++) {
      for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) {
        const n = this.nodeOfCell(cx, cy);
        if (n) out.push(n);
      }
    }
    return out;
  }

  /** The nodes a node links to: the nearest towns (the start links only to its nearest town). */
  near(n: RoadNode): RoadNode[] {
    const hit = this.nearCache.get(n.id);
    if (hit) return hit;
    const reach = n.id === 'start' ? ROAD.startReach : ROAD.reach;
    const cands = this.townsIn(n.tx - reach, n.ty - reach, n.tx + reach, n.ty + reach)
      .filter((m) => m.id !== n.id)
      .map((m) => ({ m, d: Math.hypot(m.tx - n.tx, m.ty - n.ty) }))
      .filter((o) => o.d <= reach)
      .sort((a, b) => a.d - b.d || (a.m.id < b.m.id ? -1 : 1));
    const out = cands.slice(0, n.id === 'start' ? 1 : ROAD.links).map((o) => o.m);
    this.nearCache.set(n.id, out);
    return out;
  }

  /** Every link touching a tile rectangle, as [a, b] pairs (deduplicated, stable order). */
  linksNear(x0: number, y0: number, x1: number, y1: number): [RoadNode, RoadNode][] {
    const seen = new Set<string>();
    const out: [RoadNode, RoadNode][] = [];
    const add = (a: RoadNode, b: RoadNode) => {
      const [p, q] = a.id < b.id ? [a, b] : [b, a];
      const id = `${p.id}|${q.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      const m = ROAD.margin;
      if (Math.max(p.tx, q.tx) + m < x0 || Math.min(p.tx, q.tx) - m > x1 || Math.max(p.ty, q.ty) + m < y0 || Math.min(p.ty, q.ty) - m > y1) return;
      out.push([p, q]);
    };
    const R = ROAD.reach;
    for (const n of this.townsIn(x0 - R, y0 - R, x1 + R, y1 + R)) for (const m of this.near(n)) add(n, m);
    for (const m of this.near(START_NODE)) add(START_NODE, m);
    return out;
  }

  /** Tiles of the routed link a-b (flat [tx, ty, ...]), or null when no land route exists. */
  route(a: RoadNode, b: RoadNode): number[] | null {
    const id = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (this.pathCache.has(id)) return this.pathCache.get(id)!;
    const path = this.astar(a, b);
    this.pathCache.set(id, path);
    return path;
  }

  private astar(a: RoadNode, b: RoadNode): number[] | null {
    const m = ROAD.margin;
    const x0 = Math.min(a.tx, b.tx) - m, y0 = Math.min(a.ty, b.ty) - m;
    const w = Math.abs(a.tx - b.tx) + m * 2 + 1, h = Math.abs(a.ty - b.ty) + m * 2 + 1;
    const n = w * h;
    const cost = new Float32Array(n);
    const seed = this.src.seed;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x0 + i, ty = y0 + j;
      const bm = this.src.biomeAt(tx, ty);
      const c = isSolidBiome(bm) || isWaterBiome(bm) ? 0 : (COST[bm] ?? 1.5);
      // gentle noise so roads wander a little instead of running ruler-straight
      cost[j * w + i] = c ? c * (1 + 0.45 * valueNoise(tx * 0.13, ty * 0.13, seed + 8300)) : 0;
    }
    // keep clear of other landmarks (caves, ruins, towns that are not the ends of this link)
    const C = ROAD.cell;
    for (let cy = Math.floor(y0 / C); cy <= Math.floor((y0 + h) / C); cy++) for (let cx = Math.floor(x0 / C); cx <= Math.floor((x0 + w) / C); cx++) {
      const p = this.src.poiForCell(cx, cy);
      if (!p || p.id === a.id || p.id === b.id) continue;
      for (let dy = -5; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
        const i = p.tx + dx - x0, j = p.ty + dy - y0;
        if (i >= 0 && j >= 0 && i < w && j < h) cost[j * w + i] = 0;
      }
    }
    const start = (a.ty - y0) * w + (a.tx - x0), goal = (b.ty - y0) * w + (b.tx - x0);
    cost[start] = cost[start] || 1; cost[goal] = cost[goal] || 1;
    const g = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap: number[] = [], hf: number[] = [];
    const push = (i: number, f: number) => {
      heap.push(i); hf.push(f);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0];
      const li = heap.pop()!, lf = hf.pop()!;
      if (heap.length) {
        heap[0] = li; hf[0] = lf;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1, r = l + 1;
          let s = k;
          if (l < heap.length && hf[l] < hf[s]) s = l;
          if (r < heap.length && hf[r] < hf[s]) s = r;
          if (s === k) break;
          [heap[s], heap[k]] = [heap[k], heap[s]]; [hf[s], hf[k]] = [hf[k], hf[s]]; k = s;
        }
      }
      return top;
    };
    const gx = b.tx - x0, gy = b.ty - y0;
    const H = (i: number) => { const x = i % w, y = (i / w) | 0; const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    g[start] = 0;
    push(start, H(start));
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const cur = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const x = cur % w, y = (cur / w) | 0;
      for (const [dx, dy, k] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!cost[ni] || closed[ni]) continue;
        if (dx && dy && (!cost[y * w + nx] || !cost[ny * w + x])) continue;      // no corner cutting
        const ng = g[cur] + cost[ni] * k;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; push(ni, ng + H(ni)); }
      }
    }
    if (from[goal] < 0) return null;
    const cells: number[] = [];
    for (let i = goal; i >= 0; i = from[i]) { cells.push(i); if (i === start) break; }
    const out: number[] = [];
    for (let k = cells.length - 1; k >= 0; k--) out.push(x0 + (cells[k] % w), y0 + ((cells[k] / w) | 0));
    return out;
  }

  /** Road tiles inside chunk (cx, cy), as tile indices j * CT + i. */
  chunkTiles(cx: number, cy: number): Set<number> {
    const key = `${cx},${cy}`;
    const hit = this.chunkCache.get(key);
    if (hit) return hit;
    const x0 = cx * CT, y0 = cy * CT, x1 = x0 + CT - 1, y1 = y0 + CT - 1;
    const set = new Set<number>();
    const put = (tx: number, ty: number) => {
      if (tx < x0 || ty < y0 || tx > x1 || ty > y1) return;
      const bm = this.src.biomeAt(tx, ty);
      if (isSolidBiome(bm) || isWaterBiome(bm)) return;
      set.add((ty - y0) * CT + (tx - x0));
    };
    for (const [a, b] of this.linksNear(x0, y0, x1, y1)) {
      const path = this.route(a, b);
      if (!path) continue;
      for (let k = 0; k < path.length; k += 2) {
        const tx = path[k], ty = path[k + 1];
        if (tx < x0 - 1 || ty < y0 - 1 || tx > x1 + 1 || ty > y1 + 1) continue;
        const px = path[k - 2] ?? tx, py = path[k - 1] ?? ty;
        put(tx, ty);
        // widen across the direction of travel
        if (Math.abs(tx - px) >= Math.abs(ty - py)) put(tx, ty + 1);
        if (Math.abs(ty - py) >= Math.abs(tx - px)) put(tx + 1, ty);
      }
    }
    if (this.chunkCache.size > 600) this.chunkCache.clear();
    this.chunkCache.set(key, set);
    return set;
  }

  isRoad(tx: number, ty: number): boolean {
    const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
    return this.chunkTiles(cx, cy).has((ty - cy * CT) * CT + (tx - cx * CT));
  }

  /** Where the roads from a town lead (for signposts): the names of linked towns. */
  destinations(n: RoadNode): string[] {
    const out = new Set<string>();
    for (const m of this.near(n)) out.add(m.name);
    // towns that chose this one as a neighbour count too
    const R = ROAD.reach;
    for (const m of this.townsIn(n.tx - R, n.ty - R, n.tx + R, n.ty + R)) if (m.id !== n.id && this.near(m).some((k) => k.id === n.id)) out.add(m.name);
    return [...out].sort();
  }
}
