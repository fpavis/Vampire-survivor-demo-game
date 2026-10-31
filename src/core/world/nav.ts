import { WORLD_CONFIG } from '../config';
import type { SolidQuery, Vec2 } from '../types';

const T = WORLD_CONFIG.tile;
const UNREACHABLE = 65535;
/** Tiles at or above this walking cost are worth a detour (lava, quicksand, poison swamp; not mud). */
export const HAZARD_COST = 5;
const MAX_COST = 15;

export const RAY_CLEAR = 0, RAY_HAZARD = 1, RAY_BLOCKED = 2;

// Cheap grid raycast (Amanatides & Woo). RAY_BLOCKED when something hard (wall, water, big landmark)
// lies between the two points, RAY_HAZARD when the line only crosses costly ground (lava, swamp ...),
// otherwise RAY_CLEAR. Costs one tile lookup per tile crossed.
export function rayCast(world: SolidQuery, x0: number, y0: number, x1: number, y1: number, maxSteps = 40): number {
    let tx = Math.floor(x0 / T), ty = Math.floor(y0 / T);
    const ex = Math.floor(x1 / T), ey = Math.floor(y1 / T);
    if (tx === ex && ty === ey) return RAY_CLEAR;
    const dx = x1 - x0, dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? T / Math.abs(dx) : Infinity;
    const tDeltaY = dy !== 0 ? T / Math.abs(dy) : Infinity;
    let tMaxX = dx > 0 ? ((tx + 1) * T - x0) / dx : dx < 0 ? (x0 - tx * T) / -dx : Infinity;
    let tMaxY = dy > 0 ? ((ty + 1) * T - y0) / dy : dy < 0 ? (y0 - ty * T) / -dy : Infinity;
    let res = RAY_CLEAR;
    for (let i = 0; i < maxSteps; i++) {
        if (tMaxX < tMaxY) { tx += stepX; tMaxX += tDeltaX; } else { ty += stepY; tMaxY += tDeltaY; }
        if (tx === ex && ty === ey) return res;
        if (world.navCost) {
            const c = world.navCost(tx, ty);
            if (c === 0) return RAY_BLOCKED;
            if (c >= HAZARD_COST) res = RAY_HAZARD;
        } else if (world.tileBlocked(tx, ty)) return RAY_BLOCKED;
    }
    return res;
}

/** Nothing hard between the two points (costly ground does not block sight). */
export const lineOfSight = (world: SolidQuery, x0: number, y0: number, x1: number, y1: number, maxSteps = 40): boolean =>
    rayCast(world, x0, y0, x1, y1, maxSteps) !== RAY_BLOCKED;

// A small "flow field" around the player: walking distance from every tile to the player's tile.
// Ground enemies that have lost a clear line read the gradient to walk around lakes, mountains and walls
// instead of pushing into them, and around lava and swamp when the detour is cheaper than wading through.
// Tiles cost what world.navCost says (1 for plain ground), so the search is Dial's algorithm: Dijkstra with
// one bucket per distance, which is a plain breadth-first search when every tile costs 1.
export class FlowField {
    world: SolidQuery;
    R: number;
    N: number;
    dist: Uint16Array;
    blockedGrid: Uint8Array;
    costGrid: Uint8Array;
    // bucket queue: a ring of MAX_COST + 1 singly linked stacks sharing one node pool
    head: Int32Array;
    poolCell: Int32Array;
    poolNext: Int32Array;
    queue: Int32Array;
    tx0 = 0;
    ty0 = 0;
    centerTx = NaN;
    centerTy = NaN;

    constructor(world: SolidQuery, radius = 32) {
        this.world = world;
        this.R = radius;
        this.N = radius * 2 + 1;
        const n = this.N * this.N;
        this.dist = new Uint16Array(n);
        this.blockedGrid = new Uint8Array(n);
        this.costGrid = new Uint8Array(n);
        this.head = new Int32Array(MAX_COST + 1);
        // a cell is pushed at most once per neighbour that lowers it, plus the start
        this.poolCell = new Int32Array(n * 8 + 1);
        this.poolNext = new Int32Array(n * 8 + 1);
        this.queue = new Int32Array(n);
    }

    // Rebuild only when the target moved to a different tile
    update(px: number, py: number, force = false): void {
        const ctx = Math.floor(px / T), cty = Math.floor(py / T);
        if (!force && ctx === this.centerTx && cty === this.centerTy) return;
        this.centerTx = ctx;
        this.centerTy = cty;
        this.rebuild();
    }

    rebuild(): void {
        const { N, R, dist, blockedGrid, costGrid, world } = this;
        this.tx0 = this.centerTx - R;
        this.ty0 = this.centerTy - R;
        let weighted = false;
        if (world.navCost) {
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    const c = world.navCost(this.tx0 + x, this.ty0 + y);
                    const i = y * N + x;
                    blockedGrid[i] = c === 0 ? 1 : 0;
                    costGrid[i] = c === 0 ? 1 : c > MAX_COST ? MAX_COST : c;
                    if (c > 1) weighted = true;
                }
            }
        } else {
            costGrid.fill(1);
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    blockedGrid[y * N + x] = world.tileBlocked(this.tx0 + x, this.ty0 + y) ? 1 : 0;
                }
            }
        }
        dist.fill(UNREACHABLE);
        const start = R * N + R;
        blockedGrid[start] = 0;
        dist[start] = 0;
        if (weighted) this.dial(start); else this.bfs(start);
    }

    // every tile costs 1: a plain breadth-first search
    private bfs(start: number): void {
        const { N, dist, blockedGrid, queue } = this;
        let head = 0, tail = 0;
        queue[tail++] = start;
        while (head < tail) {
            const cur = queue[head++];
            const cx = cur % N, cy = (cur / N) | 0;
            const nd = dist[cur] + 1;
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    if (!ox && !oy) continue;
                    const nx = cx + ox, ny = cy + oy;
                    if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
                    const ni = ny * N + nx;
                    if (blockedGrid[ni] || dist[ni] <= nd) continue;
                    // no cutting corners through diagonal wall gaps
                    if (ox && oy && (blockedGrid[cy * N + nx] || blockedGrid[ny * N + cx])) continue;
                    dist[ni] = nd;
                    queue[tail++] = ni;
                }
            }
        }
    }

    // Dial's algorithm. A step onto `cur` costs cur's cost, the price of walking into it; a diagonal step
    // costs the dearest of the three tiles it brushes, so routes keep off the corners of a lava pool.
    private dial(start: number): void {
        const { N, dist, blockedGrid, costGrid, head, poolCell, poolNext } = this;
        const B = MAX_COST + 1;
        head.fill(-1);
        let used = 0, pending = 0;
        poolCell[used] = start; poolNext[used] = head[0]; head[0] = used++; pending++;
        for (let d = 0; pending > 0; d++) {
            const slot = d % B;
            while (head[slot] !== -1) {
                const node = head[slot];
                head[slot] = poolNext[node];
                pending--;
                const cur = poolCell[node];
                if (dist[cur] !== d) continue;           // a stale entry: already settled lower
                const cx = cur % N, cy = (cur / N) | 0;
                const c0 = costGrid[cur];
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (!ox && !oy) continue;
                        const nx = cx + ox, ny = cy + oy;
                        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
                        const ni = ny * N + nx;
                        if (blockedGrid[ni] || dist[ni] <= d + c0) continue;
                        let nd = d + c0;
                        if (ox && oy) {
                            const a = cy * N + nx, b = ny * N + cx;
                            if (blockedGrid[a] || blockedGrid[b]) continue;
                            nd = d + Math.max(c0, costGrid[a], costGrid[b]);
                            if (dist[ni] <= nd) continue;
                        }
                        dist[ni] = nd;
                        const s = nd % B;
                        poolCell[used] = ni; poolNext[used] = head[s]; head[s] = used++; pending++;
                    }
                }
            }
        }
    }

    // Writes a unit direction into out; returns false if the position has no route
    direction(x: number, y: number, out: Vec2): boolean {
        const { N, dist, blockedGrid, costGrid } = this;
        const lx = Math.floor(x / T) - this.tx0, ly = Math.floor(y / T) - this.ty0;
        if (lx < 1 || ly < 1 || lx >= N - 1 || ly >= N - 1) return false;
        const idx = ly * N + lx;
        const d = dist[idx];
        if (d === 0) return false;
        // the best step is onto the neighbour whose distance plus the step's cost is lowest (the same costs
        // the search used); among equals, the one pointing most nearly at the target. A monster can stand on
        // a tile marked hard (a landmark's tile footprint is coarser than its collider): then the best open,
        // reachable neighbour is its way back onto the field.
        const gx = this.centerTx - this.tx0 - lx, gy = this.centerTy - this.ty0 - ly;
        let best = d === UNREACHABLE ? UNREACHABLE * 2 : d, bestDot = -Infinity, bx = 0, by = 0;
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                if (!ox && !oy) continue;
                const ni = (ly + oy) * N + lx + ox;
                if (blockedGrid[ni] || dist[ni] === UNREACHABLE) continue;
                let step = costGrid[ni];
                if (ox && oy) {
                    const a = ly * N + lx + ox, b = (ly + oy) * N + lx;
                    if (blockedGrid[a] || blockedGrid[b]) continue;
                    step = Math.max(step, costGrid[a], costGrid[b]);
                }
                const v = dist[ni] + step;
                if (v > best) continue;
                const dot = (ox * gx + oy * gy) / (ox && oy ? Math.SQRT2 : 1);
                if (v < best || dot > bestDot) { best = v; bestDot = dot; bx = ox; by = oy; }
            }
        }
        if (!bx && !by) return false;
        // aim at the centre of the chosen tile
        const tx = (this.tx0 + lx + bx + 0.5) * T, ty = (this.ty0 + ly + by + 0.5) * T;
        const dx = tx - x, dy = ty - y;
        const len = Math.hypot(dx, dy) || 1;
        out.x = dx / len;
        out.y = dy / len;
        return true;
    }
}
