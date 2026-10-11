import { WORLD_CONFIG } from '../config';
import type { SolidQuery, Vec2 } from '../types';

const T = WORLD_CONFIG.tile;
const UNREACHABLE = 65535;

// Cheap grid raycast (Amanatides & Woo). Returns true when nothing hard (wall, water, big landmark)
// lies between the two points. Costs one tile lookup per tile crossed.
export function lineOfSight(world: SolidQuery, x0: number, y0: number, x1: number, y1: number, maxSteps = 40): boolean {
    let tx = Math.floor(x0 / T), ty = Math.floor(y0 / T);
    const ex = Math.floor(x1 / T), ey = Math.floor(y1 / T);
    if (tx === ex && ty === ey) return true;
    const dx = x1 - x0, dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? T / Math.abs(dx) : Infinity;
    const tDeltaY = dy !== 0 ? T / Math.abs(dy) : Infinity;
    let tMaxX = dx > 0 ? ((tx + 1) * T - x0) / dx : dx < 0 ? (x0 - tx * T) / -dx : Infinity;
    let tMaxY = dy > 0 ? ((ty + 1) * T - y0) / dy : dy < 0 ? (y0 - ty * T) / -dy : Infinity;
    for (let i = 0; i < maxSteps; i++) {
        if (tMaxX < tMaxY) { tx += stepX; tMaxX += tDeltaX; } else { ty += stepY; tMaxY += tDeltaY; }
        if (tx === ex && ty === ey) return true;
        if (world.tileBlocked(tx, ty)) return false;
    }
    return true;
}

// A small breadth-first "flow field" around the player. Ground enemies that have lost line of
// sight read the gradient to walk around lakes, mountains and walls instead of pushing into them.
export class FlowField {
    world: SolidQuery;
    R: number;
    N: number;
    dist: Uint16Array;
    blockedGrid: Uint8Array;
    queue: Int32Array;
    tx0 = 0;
    ty0 = 0;
    centerTx = NaN;
    centerTy = NaN;

    constructor(world: SolidQuery, radius = 32) {
        this.world = world;
        this.R = radius;
        this.N = radius * 2 + 1;
        this.dist = new Uint16Array(this.N * this.N);
        this.blockedGrid = new Uint8Array(this.N * this.N);
        this.queue = new Int32Array(this.N * this.N);
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
        const { N, R, dist, blockedGrid, queue, world } = this;
        this.tx0 = this.centerTx - R;
        this.ty0 = this.centerTy - R;
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                blockedGrid[y * N + x] = world.tileBlocked(this.tx0 + x, this.ty0 + y) ? 1 : 0;
            }
        }
        dist.fill(UNREACHABLE);
        const start = R * N + R;
        blockedGrid[start] = 0;
        dist[start] = 0;
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

    // Writes a unit direction into out; returns false if the position has no route
    direction(x: number, y: number, out: Vec2): boolean {
        const { N, dist, blockedGrid } = this;
        const lx = Math.floor(x / T) - this.tx0, ly = Math.floor(y / T) - this.ty0;
        if (lx < 1 || ly < 1 || lx >= N - 1 || ly >= N - 1) return false;
        const idx = ly * N + lx;
        const d = dist[idx];
        if (d === UNREACHABLE || d === 0) return false;
        let best = d, bx = 0, by = 0;
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                if (!ox && !oy) continue;
                const ni = (ly + oy) * N + lx + ox;
                if (blockedGrid[ni]) continue;
                if (ox && oy && (blockedGrid[ly * N + lx + ox] || blockedGrid[(ly + oy) * N + lx])) continue;
                if (dist[ni] < best) { best = dist[ni]; bx = ox; by = oy; }
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
