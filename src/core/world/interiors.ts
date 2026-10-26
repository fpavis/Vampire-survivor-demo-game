import { WORLD_CONFIG } from '../config';
import { makeRng } from './noise';
import { BIOME, INTERIOR_ROSTERS, GROUP } from './biomes';
import { addDecorItem } from './terrain';
import { floorSeed, type DungeonInfo } from './dungeons';
import { addVault, type Puzzle } from './puzzles';
import type { ChunkLike, InteriorTheme, Poi, TerrainSource, Vec2 } from '../types';

export interface InteriorSpawn { type: string; x: number; y: number; elite?: boolean }
export interface InteriorChest { tx: number; ty: number; x: number; y: number; big?: boolean }
export interface InteriorNpc { x: number; y: number; hue: number }
interface DecorSpec { type: string; variant: number; x: number; y: number; flip?: boolean }

const T = WORLD_CONFIG.tile;
const WALL_FOR: Record<string, number> = { cave: BIOME.CAVE_WALL, ruins: BIOME.RUIN_WALL };
const FLOOR_FOR: Record<string, number> = { cave: BIOME.CAVE_FLOOR, ruins: BIOME.RUIN_FLOOR, city: BIOME.CITY_FLOOR };

// colour themes by place type (+ the region the entrance was in)
function themeFor(type: string, group: string): InteriorTheme {
    if (type === 'cave') {
        const frost = group === GROUP.MOUNTAIN;
        const sand = group === GROUP.DESERT || group === GROUP.SHORE;
        return { top: frost ? 0x6a7a8c : sand ? 0x7a6444 : 0x4e4438, front: frost ? 0x3a4656 : sand ? 0x4a3a24 : 0x2c261e, ambient: 0.55 };
    }
    if (type === 'ruins') {
        const sand = group === GROUP.DESERT;
        return { top: sand ? 0xb09868 : 0x8a8478, front: sand ? 0x7a6840 : 0x5e594f, ambient: 0.32 };
    }
    const palettes: Record<string, { roofs: number[]; wall: number; floor: number }> = {
        [GROUP.DESERT]: { roofs: [0xb8742e, 0xc8943e, 0x9a5a2a], wall: 0xe0c48a, floor: 0xd2b27a },
        [GROUP.SHORE]: { roofs: [0x3f6fa8, 0x3f8fb8, 0x4a9a8a], wall: 0xeee8da, floor: 0xcfc4a4 },
        [GROUP.FOREST]: { roofs: [0x3f7a4a, 0x6a4a2a, 0x4a6a3a], wall: 0xcbb68a, floor: 0x8a8068 },
        [GROUP.MOUNTAIN]: { roofs: [0x5a6272, 0x6a7282, 0x4a5262], wall: 0xb8b8bc, floor: 0x8a8a92 }
    };
    const p = palettes[group] || { roofs: [0xb5473b, 0x3f6fa8, 0xc88a3a, 0x3f8f7a], wall: 0xe2cfa6, floor: 0x9a8f7c };
    return { top: 0xb5473b, front: p.wall, roofs: p.roofs, floor: p.floor, ambient: 0 };
}

export class InteriorSource implements TerrainSource {
    kind: string;
    group: string;
    bounded = true;
    w: number;
    h: number;
    seed: number;
    tiles: Uint8Array;
    decor: DecorSpec[] = [];
    spawns: InteriorSpawn[] = [];
    chests: InteriorChest[] = [];
    npcs: InteriorNpc[] = [];
    theme: InteriorTheme;
    ambient: number;
    start: Vec2 = { x: 0, y: 0 };
    exit: Vec2 = { x: 0, y: 0 };
    fountain: Vec2 | null = null;
    altar: Vec2 | null = null;
    // dungeon floors
    floor = 0;
    floors = 1;
    dungeon: DungeonInfo | null = null;
    stairsDown: Vec2 | null = null;
    stairsUp: Vec2 | null = null;
    boss: Vec2 | null = null;
    /** a vault behind a gate and the puzzle that opens it (some dungeon floors) */
    puzzle: Puzzle | null = null;
    /** The elite guardians of a floor: the stairs down stay sealed until every one of them has fallen. */
    get guardians(): number { return this.spawns.filter((s) => s.elite).length; }

    constructor(type: string, group: string, w: number, h: number, seed: number) {
        this.kind = type;
        this.group = group;
        this.w = w;
        this.h = h;
        this.seed = seed;
        this.tiles = new Uint8Array(w * h);
        this.theme = themeFor(type, group);
        this.ambient = this.theme.ambient;
    }

    inBounds(tx: number, ty: number): boolean { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }

    biomeAt(tx: number, ty: number): number {
        return this.inBounds(tx, ty) ? this.tiles[ty * this.w + tx] : BIOME.VOID;
    }

    isFloor(tx: number, ty: number): boolean {
        const b = this.biomeAt(tx, ty);
        return b === BIOME.CAVE_FLOOR || b === BIOME.RUIN_FLOOR || b === BIOME.CITY_FLOOR;
    }

    addDecor(type: string, tx: number, ty: number, variant = 0, extra: { flip?: boolean } = {}): void {
        this.decor.push({ type, variant, x: (tx + 0.5) * T, y: (ty + 0.5) * T, ...extra });
    }

    decorForChunk(chunk: ChunkLike): void {
        for (const d of this.decor) {
            if (d.x < chunk.x0 || d.x >= chunk.x0 + chunk.size || d.y < chunk.y0 || d.y >= chunk.y0 + chunk.size) continue;
            addDecorItem(chunk, d.type, d.x, d.y, d.variant, { flip: !!d.flip });
        }
    }

    // BFS distance (in tiles) from a tile across floor tiles; `blocked` tiles (indices) count as wall
    distanceMap(sx: number, sy: number, blocked?: Set<number>): Int16Array {
        const dist = new Int16Array(this.w * this.h).fill(-1);
        const q = [sx + sy * this.w];
        dist[q[0]] = 0;
        for (let i = 0; i < q.length; i++) {
            const cur = q[i];
            const cx = cur % this.w, cy = (cur / this.w) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (!this.inBounds(nx, ny) || !this.isFloor(nx, ny)) continue;
                const ni = nx + ny * this.w;
                if (blocked && blocked.has(ni)) continue;
                if (dist[ni] >= 0) continue;
                dist[ni] = dist[cur] + 1;
                q.push(ni);
            }
        }
        return dist;
    }
}

// --------------------------------------------------------------------- cave
/** Open a round clearing of floor around a tile (used for stair landings and the boss arena). */
function clearing(src: InteriorSource, tx: number, ty: number, radius: number, floorTile: number): void {
    for (let y = Math.floor(ty - radius); y <= Math.ceil(ty + radius); y++) for (let x = Math.floor(tx - radius); x <= Math.ceil(tx + radius); x++) {
        if (Math.hypot(x - tx, y - ty) <= radius + 0.2 && x > 1 && y > 1 && x < src.w - 2 && y < src.h - 2) src.tiles[y * src.w + x] = floorTile;
    }
}

/** Stairs and the boss spot for a dungeon floor, chosen from the cells farthest from the way in. */
function addDungeonFeatures(src: InteriorSource, info: DungeonInfo, floor: number, cells: { x: number; y: number; d: number }[], floorTile: number, avoid: { x: number; y: number }[], startTx: number, startTy: number): void {
    src.dungeon = info;
    src.floor = floor;
    src.floors = info.floors;
    const last = floor >= info.floors - 1;
    const far = cells.slice().sort((a, b) => b.d - a.d);
    const spot = far.find((c) => c.d > 8 && avoid.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > 7)) ?? far[0];
    if (last) {
        clearing(src, spot.x, spot.y, 4.5, floorTile);
        src.boss = { x: (spot.x + 0.5) * T, y: (spot.y + 0.5) * T };
    } else {
        clearing(src, spot.x, spot.y, 2.6, floorTile);
        src.stairsDown = { x: (spot.x + 0.5) * T, y: (spot.y + 0.5) * T };
    }
    // monsters never wait on top of a stair or in the boss's clearing
    const keep = (x: number, y: number) => {
        const a = src.stairsDown ?? src.boss;
        return !a || Math.hypot(a.x - x, a.y - y) > (last ? 6 : 3.4) * T;
    };
    src.spawns = src.spawns.filter((sp) => keep(sp.x, sp.y));
    // every floor keeps at least two guardians: they are what unseals the stairs
    if (src.guardians < 2) {
        const plain = src.spawns.filter((sp) => !sp.elite).sort((a, b) => Math.hypot(b.x - src.start.x, b.y - src.start.y) - Math.hypot(a.x - src.start.x, a.y - src.start.y));
        for (const sp of plain.slice(0, 2 - src.guardians)) sp.elite = true;
    }
    if (floor > 0) src.stairsUp = { x: (startTx + 0.5) * T, y: (startTy + 0.5) * T };
}
/** A vault and its puzzle, when the floor rolls one (its own random stream, so the rest of the floor is unchanged). */
function withVault(src: InteriorSource, seed: number, floorTile: number): void {
    const pz = addVault(src, seed, floorTile);
    if (!pz) return;
    src.puzzle = pz;
    const roster = INTERIOR_ROSTERS[src.kind] ?? INTERIOR_ROSTERS.cave;
    (pz.guards ?? []).forEach((g, i) => src.spawns.push({ type: roster[i % roster.length], x: g.x, y: g.y }));
}

function generateCave(poi: Poi, floor = 0): InteriorSource {
    const rng = makeRng(floorSeed(poi.seed, floor));
    const w = 64, h = 64;
    const src = new InteriorSource('cave', poi.group, w, h, floorSeed(poi.seed, floor));
    const WALL = WALL_FOR.cave, FLOOR = FLOOR_FOR.cave;

    let grid = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        grid[y * w + x] = (x < 2 || y < 2 || x >= w - 2 || y >= h - 2 || rng() < 0.46) ? 1 : 0;
    }
    for (let it = 0; it < 5; it++) {
        const next = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            let walls = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                walls += (nx < 0 || ny < 0 || nx >= w || ny >= h || grid[ny * w + nx]) ? 1 : 0;
            }
            next[y * w + x] = walls >= 5 ? 1 : 0;
        }
        grid = next;
    }

    // keep only the largest open region
    const region = new Int16Array(w * h).fill(-1);
    let best = -1, bestSize = 0, id = 0;
    for (let i = 0; i < w * h; i++) {
        if (grid[i] || region[i] >= 0) continue;
        const q = [i];
        region[i] = id;
        for (let k = 0; k < q.length; k++) {
            const c = q[k], cx = c % w, cy = (c / w) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const ni = ny * w + nx;
                if (grid[ni] || region[ni] >= 0) continue;
                region[ni] = id;
                q.push(ni);
            }
        }
        if (q.length > bestSize) { bestSize = q.length; best = id; }
        id++;
    }
    for (let i = 0; i < w * h; i++) src.tiles[i] = (!grid[i] && region[i] === best) ? FLOOR : WALL;

    // entrance near the bottom-left
    let sx = 0, sy = 0, sd = Infinity;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (src.tiles[y * w + x] !== FLOOR) continue;
        const d = Math.hypot(x - 8, y - (h - 8));
        if (d < sd) { sd = d; sx = x; sy = y; }
    }
    // carve a clear landing area
    for (let y = sy - 3; y <= sy + 3; y++) for (let x = sx - 3; x <= sx + 3; x++) {
        if (Math.hypot(x - sx, y - sy) <= 3.2 && x > 1 && y > 1 && x < w - 2 && y < h - 2) src.tiles[y * w + x] = FLOOR;
    }
    src.start = { x: (sx + 0.5) * T, y: (sy + 1.3) * T };
    src.exit = { x: (sx + 0.5) * T, y: (sy + 0.5) * T };
    if (!(poi.dungeon && floor > 0)) src.addDecor('portal', sx, sy, 0);   // deeper floors show a stair instead (drawn by the game)

    const dist = src.distanceMap(sx, sy);
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dist[y * w + x] >= 0) cells.push({ x, y, d: dist[y * w + x] });

    // chests at the farthest, well separated spots
    const far = cells.slice().sort((a, b) => b.d - a.d);
    for (const c of far) {
        if (src.chests.length >= 3) break;
        if (src.chests.every((o) => Math.hypot(o.tx - c.x, o.ty - c.y) > 16)) {
            src.chests.push({ tx: c.x, ty: c.y, x: (c.x + 0.5) * T, y: (c.y + 0.5) * T });
        }
    }

    const roster = INTERIOR_ROSTERS.cave;
    const taken: { x: number; y: number }[] = [];
    let tries = 0;
    while (src.spawns.length < 22 && tries++ < 400) {
        const c = cells[Math.floor(rng() * cells.length)];
        if (c.d < 16) continue;
        if (taken.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 5)) continue;
        taken.push(c);
        src.spawns.push({ type: roster[Math.floor(rng() * roster.length)], x: (c.x + 0.5) * T, y: (c.y + 0.5) * T });
    }
    // guardians stand on open floor next to each chest
    src.chests.forEach((c) => {
        const near = cells
            .filter((cell) => {
                const d = Math.hypot(cell.x - c.tx, cell.y - c.ty);
                return d >= 1.5 && d <= 4;
            })
            .sort(() => rng() - 0.5);
        for (let i = 0; i < 2 && i < near.length; i++) {
            src.spawns.push({ type: roster[Math.floor(rng() * roster.length)], elite: true, x: (near[i].x + 0.5) * T, y: (near[i].y + 0.5) * T });
        }
    });

    if (poi.dungeon) addDungeonFeatures(src, poi.dungeon, floor, cells, FLOOR, src.chests.map((c) => ({ x: c.tx, y: c.ty })), sx, sy);
    if (poi.dungeon) withVault(src, floorSeed(poi.seed, floor), FLOOR);

    // decoration
    const feature = src.stairsDown ?? src.boss;
    for (const c of cells) {
        if (Math.hypot(c.x - sx, c.y - sy) < 5) continue;
        if (feature && Math.hypot((c.x + 0.5) * T - feature.x, (c.y + 0.5) * T - feature.y) < 5.5 * T) continue;
        const r = rng();
        const northWall = src.tiles[(c.y - 1) * w + c.x] === WALL;
        if (northWall && r < 0.07) src.addDecor('torch', c.x, c.y - 0.2, 0);
        else if (r < 0.1) src.addDecor('crystal', c.x, c.y, Math.floor(rng() * 3), { flip: rng() < 0.5 });
        else if (r < 0.14) src.addDecor('stalagmite', c.x, c.y, 0, { flip: rng() < 0.5 });
        else if (r < 0.155) src.addDecor('bones', c.x, c.y, 0);
        else if (r < 0.17) src.addDecor('rock', c.x, c.y, 0);
    }
    return src;
}

// -------------------------------------------------------------------- ruins
function generateRuins(poi: Poi, floor = 0): InteriorSource {
    const rng = makeRng(floorSeed(poi.seed, floor));
    const w = 64, h = 64;
    const src = new InteriorSource('ruins', poi.group, w, h, floorSeed(poi.seed, floor));
    const WALL = WALL_FOR.ruins, FLOOR = FLOOR_FOR.ruins;
    src.tiles.fill(WALL);

    interface Room { x: number; y: number; w: number; h: number; cx: number; cy: number }
    const rooms: Room[] = [];
    for (let tries = 0; tries < 160 && rooms.length < 9; tries++) {
        const rw = 7 + Math.floor(rng() * 6), rh = 6 + Math.floor(rng() * 5);
        const rx = 3 + Math.floor(rng() * (w - rw - 6)), ry = 3 + Math.floor(rng() * (h - rh - 6));
        if (rooms.some((o) => rx < o.x + o.w + 3 && rx + rw + 3 > o.x && ry < o.y + o.h + 3 && ry + rh + 3 > o.y)) continue;
        rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
    }
    rooms.sort((a, b) => a.cx - b.cx);
    const carve = (x0: number, y0: number, x1: number, y1: number) => {
        for (let y = Math.max(2, y0); y <= Math.min(h - 3, y1); y++) for (let x = Math.max(2, x0); x <= Math.min(w - 3, x1); x++) src.tiles[y * w + x] = FLOOR;
    };
    rooms.forEach((r) => carve(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1));
    for (let i = 1; i < rooms.length; i++) {
        const a = rooms[i - 1], b = rooms[i];
        carve(Math.min(a.cx, b.cx) - 1, a.cy - 1, Math.max(a.cx, b.cx) + 1, a.cy + 1);
        carve(b.cx - 1, Math.min(a.cy, b.cy) - 1, b.cx + 1, Math.max(a.cy, b.cy) + 1);
    }

    const startRoom = rooms[0];
    src.start = { x: (startRoom.cx + 0.5) * T, y: (startRoom.cy + 1.6) * T };
    src.exit = { x: (startRoom.cx + 0.5) * T, y: (startRoom.cy + 0.5) * T };
    if (!(poi.dungeon && floor > 0)) src.addDecor('portal', startRoom.cx, startRoom.cy, 0);

    const dist = src.distanceMap(startRoom.cx, startRoom.cy);
    let guardian = rooms[rooms.length - 1], gd = -1;
    rooms.forEach((r) => { const d = dist[r.cy * w + r.cx]; if (d > gd) { gd = d; guardian = r; } });

    const roster = INTERIOR_ROSTERS.ruins;
    rooms.forEach((r, i) => {
        if (r === startRoom) return;
        const isGuardian = r === guardian;
        const count = isGuardian ? 4 : 3 + Math.floor(rng() * 3);
        for (let k = 0; k < count; k++) {
            const x = r.x + 1 + Math.floor(rng() * (r.w - 2)), y = r.y + 1 + Math.floor(rng() * (r.h - 2));
            src.spawns.push({ type: roster[Math.floor(rng() * roster.length)], elite: isGuardian && k < 2, x: (x + 0.5) * T, y: (y + 0.5) * T });
        }
        if (isGuardian) {
            // in a dungeon the middle of the guardian room belongs to the stairs or the boss
            const ctx = poi.dungeon ? r.x + 1 : r.cx, cty = poi.dungeon ? r.y + r.h - 2 : r.cy;
            src.chests.push({ tx: ctx, ty: cty, x: (ctx + 0.5) * T, y: (cty + 0.5) * T, big: true });
        } else if (rng() < 0.45) {
            const cx = r.x + r.w - 2, cy = r.y + r.h - 2;
            src.chests.push({ tx: cx, ty: cy, x: (cx + 0.5) * T, y: (cy + 0.5) * T });
        }
    });

    if (poi.dungeon) {
        const cells: { x: number; y: number; d: number }[] = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = dist[y * w + x]; if (d >= 0 && x >= guardian.x && x < guardian.x + guardian.w && y >= guardian.y && y < guardian.y + guardian.h && Math.hypot(x - guardian.cx, y - guardian.cy) < 1.5) cells.push({ x, y, d: d + 20 }); }
        addDungeonFeatures(src, poi.dungeon, floor, cells.length ? cells : [{ x: guardian.cx, y: guardian.cy, d: 99 }], FLOOR, src.chests.map((c) => ({ x: c.tx, y: c.ty })), startRoom.cx, startRoom.cy);
        withVault(src, floorSeed(poi.seed, floor), FLOOR);
    }

    // dressing
    rooms.forEach((r) => {
        for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (rng() < 0.28) src.addDecor('torch', x, r.y - 0.15, 0);
        if (r !== startRoom && r.w >= 8 && r.h >= 7) {
            for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) for (const y of [r.y + 2, r.y + r.h - 3]) {
                if (Math.abs(x - r.cx) + Math.abs(y - r.cy) > 1) src.addDecor('pillar', x, y, Math.floor(rng() * 2));
            }
        }
        if (rng() < 0.6) src.addDecor(rng() < 0.5 ? 'crate' : 'barrel', r.x + 1, r.y + r.h - 2, 0);
        if (rng() < 0.4) src.addDecor('banner', r.x + r.w - 2, r.y + 0.5, Math.floor(rng() * 2));
        if (rng() < 0.5) src.addDecor('bones', r.x + 2 + Math.floor(rng() * (r.w - 4)), r.y + 2 + Math.floor(rng() * (r.h - 4)), 0);
    });
    return src;
}

// --------------------------------------------------------------------- city
function generateCity(poi: Poi): InteriorSource {
    const rng = makeRng(poi.seed);
    const w = 60, h = 48;
    const src = new InteriorSource('city', poi.group, w, h, poi.seed);
    src.tiles.fill(BIOME.CITY_FLOOR);

    // perimeter wall
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) src.tiles[y * w + x] = BIOME.CITY_STONE;
    }

    const building = (x0: number, y0: number, bw: number, bh: number) => {
        for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) src.tiles[y * w + x] = BIOME.CITY_WALL;
    };
    // side districts: two columns of houses with streets between
    const rowsY = [4, 17, 30];
    rowsY.forEach((ry) => {
        building(4 + Math.floor(rng() * 2), ry, 6 + Math.floor(rng() * 3), 7 + Math.floor(rng() * 3));
        building(13 + Math.floor(rng() * 2), ry + 1, 4 + Math.floor(rng() * 2), 6 + Math.floor(rng() * 2));
        building(w - 12 - Math.floor(rng() * 2), ry, 6 + Math.floor(rng() * 3), 7 + Math.floor(rng() * 3));
        building(w - 19 - Math.floor(rng() * 2), ry + 1, 4 + Math.floor(rng() * 2), 6 + Math.floor(rng() * 2));
    });
    // temple / town hall at the top centre
    building(22, 3, 16, 8);

    // clear the plaza and the road to the gate
    for (let y = 12; y <= h - 3; y++) for (let x = 22; x < 38; x++) {
        if (y <= 30 || (x >= 27 && x <= 32)) src.tiles[y * w + x] = BIOME.CITY_FLOOR;
    }

    const cxT = 30;
    src.fountain = { x: (cxT + 0.5) * T, y: (22 + 0.5) * T };
    src.decor.push({ type: 'fountain', variant: 0, x: src.fountain.x, y: src.fountain.y });
    src.altar = { x: (cxT + 0.5) * T, y: 14.2 * T };
    src.decor.push({ type: 'altar', variant: 0, x: src.altar.x, y: src.altar.y });

    // gate = exit (south, in the perimeter wall)
    const gx = cxT, gy = h - 3;
    for (let y = h - 2; y < h; y++) for (let x = gx - 2; x <= gx + 2; x++) src.tiles[y * w + x] = BIOME.CITY_FLOOR;
    src.decor.push({ type: 'gate', variant: poi.group === GROUP.DESERT ? 1 : (poi.group === GROUP.SHORE ? 2 : 0), x: (gx + 0.5) * T, y: (h - 1.1) * T });
    src.exit = { x: (gx + 0.5) * T, y: (gy - 1.4) * T };
    src.start = { x: (gx + 0.5) * T, y: (gy - 3) * T };

    // street furniture
    for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        src.addDecor('stall', cxT + side * (5 + (i >> 1) * 0), 17 + (i >> 1) * 4.5, Math.floor(rng() * 3));
    }
    [[24.5, 31], [35.5, 31], [24.5, 14], [35.5, 14], [24.5, 22], [35.5, 22]].forEach(([x, y], i) => {
        src.addDecor(i % 2 ? 'lamp' : 'planter', x - 0.5, y, 0);
    });
    src.addDecor('well', 20, 33, 0);
    for (let i = 0; i < 10; i++) {
        const x = 3 + Math.floor(rng() * (w - 6)), y = 3 + Math.floor(rng() * (h - 6));
        if (src.biomeAt(x, y) === BIOME.CITY_FLOOR && (x < 22 || x >= 38 || y > 31) && Math.abs(x - cxT) > 2) {
            src.addDecor(rng() < 0.5 ? 'barrel' : 'crate', x, y, 0);
        }
    }
    for (let x = 6; x < w - 6; x += 7) src.addDecor('lamp', x, h - 4.6, 0);
    src.addDecor('banner', 24, 11.5, 0); src.addDecor('banner', 36, 11.5, 1);

    // villagers
    for (let i = 0; i < 9; i++) {
        let x, y, n = 0;
        do { x = 24 + rng() * 12; y = 13 + rng() * 17; n++; } while (src.biomeAt(Math.floor(x), Math.floor(y)) !== BIOME.CITY_FLOOR && n < 20);
        src.npcs.push({ x: x * T, y: y * T, hue: Math.floor(rng() * 6) });
    }
    return src;
}

export function createInterior(poi: Poi, floor = 0): InteriorSource {
    switch (poi.type) {
        case 'cave': return generateCave(poi, floor);
        case 'ruins': return generateRuins(poi, floor);
        default: return generateCity(poi);
    }
}
