// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { hash, valueNoise } from '../core/world/noise';
import {
    BIOME, BIOME_COLOR, isSolidBiome, isWaterBiome, isWallBiome, groupOf
} from '../core/world/biomes';
import { shade } from './decorArt';
import { bakeDecorTextures } from './decorBake';
import { bakeGround, GROUND_RES } from './groundBake';
import { nodeId } from '../core/economy/gather';
import { addDecorItem } from '../core/world/terrain';
import { boatBlocked } from '../core/world/towers';
import { DECOR_LIGHTS } from './lighting';
import { SURFACES, SURFACE_IDS, surfaceByNum, NAV_COST_BY_NUM } from '../core/world/surfaces';
import { blightColor } from '../core/world/corruption';
import { rayCast, RAY_BLOCKED } from '../core/world/nav';
import { lineYAt, rockShape, rockTouches } from '../core/render/rockShape';
import { bakeRockTops, NATURAL_ROCK, ROCK_N, ROCK_ROW } from './rockBake';

const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;
const TILT = WORLD_CONFIG.tilt;
export const CHUNK_SIZE = T * CT;

export const WALL_HEIGHT = {
    [BIOME.MOUNTAIN]: 46, [BIOME.PEAK]: 46, [BIOME.CAVE_WALL]: 58, [BIOME.RUIN_WALL]: 54,
    [BIOME.CITY_WALL]: 60, [BIOME.CITY_STONE]: 60
};

class ChunkData {
    constructor(cx, cy) {
        this.cx = cx;
        this.cy = cy;
        this.x0 = cx * CHUNK_SIZE;
        this.y0 = cy * CHUNK_SIZE;
        this.size = CHUNK_SIZE;
        this.biomes = new Uint8Array(CT * CT);
        this.surf = new Uint8Array(CT * CT);     // surface ids (lava, swamp ...), 0 = none
        this.corrupt = null;                     // how blighted each tile is (0..255), or null for a clean chunk
        this.hard = new Uint8Array(CT * CT);   // tiles that block navigation (walls, water, big landmarks)
        this.decor = [];
        this.solids = [];
        this.pois = [];
    }
}

// Higher-level regions change the land itself: blighted, ashen, abyssal ... (tier = floor((level - 1) / 12))
const TIER_TINT: [number, number][] = [
    [0, 0], [0x6a3a7a, 0.2], [0x5a5048, 0.34], [0x1a2a4a, 0.44], [0x5a1a1a, 0.46], [0x2a0a3a, 0.52]
];

function mixColor(a: number, b: number, k: number): number {
    const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
    const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
    const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
    return (r << 16) | (g << 8) | bl;
}

const chunkKey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);

export class World {
    constructor(app, groundLayer, objectLayer) {
        this.app = app;
        // what natural rock's outline treats as more rock: any wall, and the void round a place
        this.rockAt = (tx, ty) => { const b = this.biomeAt(tx, ty); return isWallBiome(b) || b === BIOME.VOID; };
        this.groundLayer = groundLayer;
        this.objectLayer = objectLayer;
        this.decorTextures = bakeDecorTextures(app);
        this.data = new Map();
        this.views = new Map();
        this.time = 0;
        this.source = null;
        this.dynTiles = new Set();     // see addBlocker
        this.dynCircles = [];
        this.focusChunk = { x: 0, y: 0 };
        this.onChunk = null; // callback(chunkData) when a chunk is first drawn (used by the map)
        this.removed = new Set(); // harvested resource nodes (ids from core/economy/gather)
        this.edits = new Map();   // tile edits made by built towers: 'tx,ty' -> biome
        this.towerDecor = new Map(); // tower id -> decor items it adds (the tower itself, plateau ore ...)
        this.extraPois = null;       // (cx, cy) => Poi[]: dungeon entrances the world hosts on plateaus and islands
    }

    setSource(source) {
        this.views.forEach((v) => this.destroyView(v));
        this.views.clear();
        this.data.clear();
        this.source = source;
        this.dynTiles.clear();
        this.dynCircles.length = 0;
    }

    // Things that block until they move away (vault gates): tiles for navigation, circles for collision.
    static dynKey(tx, ty) { return (tx + 32768) * 65536 + (ty + 32768); }
    addBlocker(tiles, circles) {
        for (const [tx, ty] of tiles) this.dynTiles.add(World.dynKey(tx, ty));
        for (const c of circles) this.dynCircles.push(c);
    }
    removeBlocker(tiles, circles) {
        for (const [tx, ty] of tiles) this.dynTiles.delete(World.dynKey(tx, ty));
        for (const c of circles) { const i = this.dynCircles.indexOf(c); if (i >= 0) this.dynCircles.splice(i, 1); }
    }

    get bounded() { return !!(this.source && this.source.bounded); }

    // ------------------------------------------------------------ generation
    getChunk(cx, cy) {
        const key = chunkKey(cx, cy);
        let chunk = this.data.get(key);
        if (chunk) return chunk;

        chunk = new ChunkData(cx, cy);
        const src = this.source;
        for (let j = 0; j < CT; j++) {
            for (let i = 0; i < CT; i++) {
                chunk.biomes[j * CT + i] = src.biomeAt(cx * CT + i, cy * CT + j);
            }
        }
        if (this.edits.size && !src.bounded) {
            for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) {
                const e = this.edits.get(`${cx * CT + i},${cy * CT + j}`);
                if (e !== undefined) chunk.biomes[j * CT + i] = e;
            }
        }
        src.decorForChunk(chunk);
        if (this.edits.size && !src.bounded) {
            // trees and rocks do not survive on tiles a tower rebuilt
            const edited = (d) => this.edits.has(`${Math.floor(d.x / T)},${Math.floor(d.y / T)}`);
            // a solid that reaches into a rebuilt tile would block the new bridge or stair, so it goes too
            const reaches = (d) => {
                const r = (d.r || 0) + 12;
                for (let ty = Math.floor((d.y - r) / T); ty <= Math.floor((d.y + r) / T); ty++) for (let tx = Math.floor((d.x - r) / T); tx <= Math.floor((d.x + r) / T); tx++) if (this.edits.has(`${tx},${ty}`)) return true;
                return false;
            };
            const dropped = new Set(chunk.solids.filter(reaches));
            chunk.decor = chunk.decor.filter((d) => !edited(d) && !dropped.has(d));
            chunk.solids = chunk.solids.filter((d) => !dropped.has(d) && !edited(d));
        }
        if (this.towerDecor.size && !src.bounded) {
            for (const items of this.towerDecor.values()) {
                for (const d of items) {
                    if (Math.floor(d.x / CHUNK_SIZE) !== cx || Math.floor(d.y / CHUNK_SIZE) !== cy) continue;
                    if (this.removed.has(nodeId(d.type, d.x, d.y))) continue;
                    addDecorItem(chunk, d.type, d.x, d.y, d.variant);
                }
            }
        }
        if (this.extraPois && !src.bounded) {
            // dungeon entrances on plateaus and islands: a gate, two pillars and a spot to stand at
            const here = (x, y) => Math.floor(x / CHUNK_SIZE) === cx && Math.floor(y / CHUNK_SIZE) === cy;
            for (const p of this.extraPois(cx, cy)) {
                if (here(p.x, p.y)) addDecorItem(chunk, 'ruinarch', p.x, p.y, 0);
                for (const [ox, oy] of [[-66, 24], [68, 22]]) if (here(p.x + ox, p.y + oy)) addDecorItem(chunk, 'pillar', p.x + ox, p.y + oy, 0);
                if (here(p.ex, p.ey)) chunk.pois.push(p);
            }
        }
        if (src.surfaceNumAt) {
            for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) chunk.surf[j * CT + i] = src.surfaceNumAt(cx * CT + i, cy * CT + j, chunk.biomes[j * CT + i]);
        }
        if (src.corruptionAt) {
            for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) {
                const c = src.corruptionAt(cx * CT + i, cy * CT + j);
                if (c > 0) (chunk.corrupt ||= new Uint8Array(CT * CT))[j * CT + i] = Math.round(c * 255);
            }
        }
        if (this.removed.size && !src.bounded) {
            const gone = (d) => this.removed.has(nodeId(d.type, d.x, d.y));
            chunk.decor = chunk.decor.filter((d) => !gone(d));
            chunk.solids = chunk.solids.filter((d) => !gone(d));
        }

        for (let i = 0; i < chunk.biomes.length; i++) if (isSolidBiome(chunk.biomes[i])) chunk.hard[i] = 1;
        // large landmarks (houses, gates, cave mouths) block navigation tiles too
        for (const d of chunk.solids) {
            if (d.r < 20) continue;
            const t0x = Math.floor((d.x - d.r) / T), t1x = Math.floor((d.x + d.r) / T);
            const t0y = Math.floor((d.y - d.r) / T), t1y = Math.floor((d.y + d.r) / T);
            for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
                const lx = tx - cx * CT, ly = ty - cy * CT;
                if (lx < 0 || ly < 0 || lx >= CT || ly >= CT) continue;
                const nx = Math.max(tx * T, Math.min(d.x, (tx + 1) * T)), ny = Math.max(ty * T, Math.min(d.y, (ty + 1) * T));
                if ((d.x - nx) ** 2 + (d.y - ny) ** 2 < d.r * d.r) chunk.hard[ly * CT + lx] = 1;
            }
        }

        this.data.set(key, chunk);
        if (this.data.size > WORLD_CONFIG.maxCachedChunks) this.pruneCache();
        return chunk;
    }

    pruneCache() {
        if (this.bounded) return;
        const { x, y } = this.focusChunk;
        for (const [key, chunk] of this.data) {
            if (Math.abs(chunk.cx - x) > 6 || Math.abs(chunk.cy - y) > 6) {
                if (!this.views.has(key)) this.data.delete(key);
            }
        }
    }

    // --------------------------------------------------------------- queries
    biomeAt(tx, ty) {
        const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
        const chunk = this.getChunk(cx, cy);
        return chunk.biomes[(ty - cy * CT) * CT + (tx - cx * CT)];
    }

    biomeAtPos(x, y) { return this.biomeAt(Math.floor(x / T), Math.floor(y / T)); }

    groupAtPos(x, y) { return groupOf(this.biomeAtPos(x, y)); }

    /** replace every tower-made change at once (load, build). Chunks regenerate lazily. */
    setTowerWorld(edits, towerDecor) {
        this.edits = edits;
        this.towerDecor = towerDecor;
    }

    /** throw away generated chunks (and their views) in a tile box so edits and new decor show up */
    invalidateTiles(tx0, ty0, tx1, ty1) {
        const c0x = Math.floor(tx0 / CT), c1x = Math.floor(tx1 / CT), c0y = Math.floor(ty0 / CT), c1y = Math.floor(ty1 / CT);
        for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
            const key = chunkKey(cx, cy);
            const v = this.views.get(key);
            if (v) { this.destroyView(v); this.views.delete(key); }
            this.data.delete(key);
        }
    }

    // surface under a world position: a SurfaceDef or null
    surfaceAtPos(x, y) {
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
        return surfaceByNum(this.getChunk(cx, cy).surf[(ty - cy * CT) * CT + (tx - cx * CT)]);
    }

    // harvest a decor node: it disappears from the world for good
    removeDecor(item) {
        const id = nodeId(item.type, item.x, item.y);
        this.removed.add(id);
        const cx = Math.floor(item.x / CHUNK_SIZE), cy = Math.floor(item.y / CHUNK_SIZE);
        const chunk = this.data.get(chunkKey(cx, cy));
        if (chunk) {
            chunk.decor = chunk.decor.filter((d) => d !== item);
            chunk.solids = chunk.solids.filter((d) => d !== item);
        }
        const view = this.views.get(chunkKey(cx, cy));
        if (view && item._sprite) {
            item._sprite.destroy();
            view.objects = view.objects.filter((o) => o !== item._sprite);
        }
        return id;
    }

    // every harvestable decor item within range (click to interact chooses among them)
    nodesNear(x, y, range, isNode) {
        const out = [];
        const c0x = Math.floor((x - range) / CHUNK_SIZE), c1x = Math.floor((x + range) / CHUNK_SIZE);
        const c0y = Math.floor((y - range) / CHUNK_SIZE), c1y = Math.floor((y + range) / CHUNK_SIZE);
        for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
            for (const d of this.getChunk(cx, cy).decor) if (isNode(d.type) && (d.x - x) ** 2 + (d.y - y) ** 2 < range * range) out.push(d);
        }
        return out;
    }

    // nearest harvestable decor item within range
    nearestNode(x, y, range, isNode) {
        let best = null, bd = range * range;
        const c0x = Math.floor((x - range) / CHUNK_SIZE), c1x = Math.floor((x + range) / CHUNK_SIZE);
        const c0y = Math.floor((y - range) / CHUNK_SIZE), c1y = Math.floor((y + range) / CHUNK_SIZE);
        for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
            for (const d of this.getChunk(cx, cy).decor) {
                if (!isNode(d.type)) continue;
                const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
                if (dd < bd) { bd = dd; best = d; }
            }
        }
        return best;
    }

    isWaterAt(x, y) { return isWaterBiome(this.biomeAtPos(x, y)); }

    // what stops a projectile: walls, mountains and peaks, the void, and gates (water, trees and rocks do not)
    shotTile(tx, ty) {
        if (this.dynTiles.size && this.dynTiles.has(World.dynKey(tx, ty))) return true;
        const b = this.biomeAt(tx, ty);
        return isWallBiome(b) || b === BIOME.VOID;
    }

    shotBlocked(x, y) { return this.shotTile(Math.floor(x / T), Math.floor(y / T)); }

    /** Nothing that stops a projectile lies between the two points. */
    clearShot(x0, y0, x1, y1) {
        return rayCast(this.shotQuery || (this.shotQuery = { tileBlocked: (tx, ty) => this.shotTile(tx, ty) }), x0, y0, x1, y1, 64) !== RAY_BLOCKED;
    }

    // hard tile obstacle (cheap, used by navigation and line of sight)
    tileBlocked(tx, ty) {
        if (this.dynTiles.size && this.dynTiles.has(World.dynKey(tx, ty))) return true;
        const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
        return this.getChunk(cx, cy).hard[(ty - cy * CT) * CT + (tx - cx * CT)] === 1;
    }

    // walking cost for the monsters' flow field: 0 = impassable, 1 = plain ground, more on lava, swamp ...
    navCost(tx, ty) {
        if (this.dynTiles.size && this.dynTiles.has(World.dynKey(tx, ty))) return 0;
        const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
        const chunk = this.getChunk(cx, cy), i = (ty - cy * CT) * CT + (tx - cx * CT);
        return chunk.hard[i] === 1 ? 0 : NAV_COST_BY_NUM[chunk.surf[i]];
    }

    // sea = true: the mover is a boat, so open water is free and everything else is closed
    blocked(x, y, r, sea = false) {
        const minTx = Math.floor((x - r) / T), maxTx = Math.floor((x + r) / T);
        const minTy = Math.floor((y - r) / T), maxTy = Math.floor((y + r) / T);
        for (let ty = minTy; ty <= maxTy; ty++) {
            for (let tx = minTx; tx <= maxTx; tx++) {
                const tb = this.biomeAt(tx, ty);
                if (sea ? !boatBlocked(tb) : !isSolidBiome(tb)) continue;
                if (!sea && NATURAL_ROCK.has(tb)) { if (rockTouches(tx, ty, this.rockAt, this.source.seed || 0, T, x, y, r)) return true; continue; }
                const nx = Math.max(tx * T, Math.min(x, (tx + 1) * T));
                const ny = Math.max(ty * T, Math.min(y, (ty + 1) * T));
                const dx = x - nx, dy = y - ny;
                if (dx * dx + dy * dy < r * r) return true;
            }
        }
        for (let i = 0; i < this.dynCircles.length; i++) {
            const c = this.dynCircles[i], dx = x - c.x, dy = y - c.y, rr = r + c.r;
            if (dx * dx + dy * dy < rr * rr) return true;
        }
        const pad = r + 50;
        const c0x = Math.floor((x - pad) / CHUNK_SIZE), c1x = Math.floor((x + pad) / CHUNK_SIZE);
        const c0y = Math.floor((y - pad) / CHUNK_SIZE), c1y = Math.floor((y + pad) / CHUNK_SIZE);
        for (let cy = c0y; cy <= c1y; cy++) {
            for (let cx = c0x; cx <= c1x; cx++) {
                const solids = this.getChunk(cx, cy).solids;
                for (let i = 0; i < solids.length; i++) {
                    const s = solids[i];
                    const dx = x - s.x, dy = y - s.y;
                    const rr = r + s.r;
                    if (dx * dx + dy * dy < rr * rr) return true;
                }
            }
        }
        return false;
    }

    // Move an entity (with wx / wy) sliding along obstacles
    tryMove(ent, dx, dy, r, sea = false) {
        if (dx !== 0 && !this.blocked(ent.wx + dx, ent.wy, r, sea)) ent.wx += dx;
        if (dy !== 0 && !this.blocked(ent.wx, ent.wy + dy, r, sea)) ent.wy += dy;
    }

    findFree(x, y, r) {
        if (!this.blocked(x, y, r)) return { x, y };
        for (let ring = 1; ring < 40; ring++) {
            const dist = ring * 24;
            const steps = 6 + ring * 3;
            for (let i = 0; i < steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                const px = x + Math.cos(a) * dist, py = y + Math.sin(a) * dist;
                if (!this.blocked(px, py, r)) return { x: px, y: py };
            }
        }
        return { x, y };
    }

    // Closest point of interest whose entrance is within `range`
    nearestPoi(x, y, range) {
        let best = null, bd = range * range;
        const c0x = Math.floor((x - range) / CHUNK_SIZE), c1x = Math.floor((x + range) / CHUNK_SIZE);
        const c0y = Math.floor((y - range) / CHUNK_SIZE), c1y = Math.floor((y + range) / CHUNK_SIZE);
        for (let cy = c0y; cy <= c1y; cy++) {
            for (let cx = c0x; cx <= c1x; cx++) {
                for (const p of this.getChunk(cx, cy).pois) {
                    const d = (p.ex - x) ** 2 + (p.ey - y) ** 2;
                    if (d < bd) { bd = d; best = p; }
                }
            }
        }
        return best;
    }

    // ------------------------------------------------------------- rendering
    update(camX, camY, viewW, viewH, immediate = false) {
        const pcx = Math.floor(camX / CHUNK_SIZE), pcy = Math.floor(camY / CHUNK_SIZE);
        this.focusChunk = { x: pcx, y: pcy };
        const radX = Math.ceil((viewW / 2 + 120) / CHUNK_SIZE);
        const radY = Math.ceil((viewH / 2 / TILT + 160) / CHUNK_SIZE);
        const src = this.source;
        const maxCx = src.bounded ? Math.floor((src.w - 1) / CT) : Infinity;
        const maxCy = src.bounded ? Math.floor((src.h - 1) / CT) : Infinity;
        const inRange = (cx, cy) => !src.bounded || (cx >= 0 && cy >= 0 && cx <= maxCx && cy <= maxCy);

        const wanted = [];
        for (let cy = pcy - radY; cy <= pcy + radY; cy++) {
            for (let cx = pcx - radX; cx <= pcx + radX; cx++) {
                if (!inRange(cx, cy)) continue;
                const key = chunkKey(cx, cy);
                if (!this.views.has(key)) wanted.push({ cx, cy, key, d: Math.hypot(cx - pcx, cy - pcy) });
            }
        }
        wanted.sort((a, b) => a.d - b.d);
        const budget = immediate ? wanted.length : 1;
        for (let i = 0; i < Math.min(budget, wanted.length); i++) {
            const w = wanted[i];
            this.views.set(w.key, this.buildView(w.cx, w.cy));
        }

        for (const [key, view] of this.views) {
            if (Math.abs(view.cx - pcx) > radX + 1 || Math.abs(view.cy - pcy) > radY + 1) {
                this.destroyView(view);
                this.views.delete(key);
            }
        }
    }

    destroyView(view) {
        if (view.base) { const tex = view.base.texture; view.base.destroy(); tex.destroy(true); }
        if (view.rockTex) view.rockTex.destroy(true);
        view.ground.destroy();
        view.sheen.destroy();
        view.sheen2.destroy();
        if (view.surfGlow) view.surfGlow.destroy();
        view.objects.forEach((o) => o.destroy());
    }

    buildView(cx, cy) {
        const chunk = this.getChunk(cx, cy);
        if (this.onChunk) this.onChunk(chunk);
        const src = this.source;
        const seed = src.seed;
        const theme = src.theme;

        const ground = new PIXI.Graphics();
        const sheen = new PIXI.Graphics();
        const sheen2 = new PIXI.Graphics();
        this._sheen2 = sheen2;
        const objects = [];
        const rows = [];
        const animated = [];
        const lights = [];
        this._lights = lights;

        for (let j = 0; j < CT; j++) {
            let row = null;
            const getRow = () => {
                if (!row) {
                    row = new PIXI.Graphics();
                    row.zIndex = (cy * CT + j + 1) * T - 0.5;
                    row.wallRow = cy * CT + j;
                    rows.push(row);
                }
                return row;
            };

            for (let i = 0; i < CT; i++) {
                const tx = cx * CT + i, ty = cy * CT + j;
                const biome = chunk.biomes[j * CT + i];
                if (biome === BIOME.VOID) continue;
                const px = tx * T, py = ty * T;

                const base = shade(this.groundColor(biome, tx, ty), 0.95 + 0.1 * hash(tx, ty, seed + 5));
                this.drawTileDetail(ground, sheen, biome, tx, ty, px, py, base, seed);

                if (isWallBiome(biome)) this.drawWall(getRow(), biome, tx, ty, px, py, seed, theme);
            }
        }

        // natural rock tops: one smooth baked texture per chunk, a sprite per tile row, under that row's cliff faces
        const rockSeed = src.seed || 0;
        const tops = bakeRockTops(cx, cy, { biomeAt: (x, y) => this.biomeAt(x, y), shapeOf: (x, y) => this.rockShapeAt(x, y), seed: rockSeed, caveTop: theme && theme.top !== undefined ? theme.top : 0x4a4038 });
        if (tops) {
            for (let j = 0; j < CT; j++) {
                if (!tops.rows[j]) continue;
                let hRow = WALL_HEIGHT[BIOME.MOUNTAIN];
                for (let i = 0; i < CT; i++) { const b = chunk.biomes[j * CT + i]; if (NATURAL_ROCK.has(b)) { hRow = WALL_HEIGHT[b]; break; } }
                const s = new PIXI.Sprite(new PIXI.Texture(tops.texture.baseTexture, new PIXI.Rectangle(0, j * ROCK_ROW, ROCK_N, ROCK_ROW)));
                s.position.set(cx * CHUNK_SIZE, (cy * CT + j) * T * TILT - hRow);
                s.scale.set(GROUND_RES, GROUND_RES * TILT);
                s.zIndex = (cy * CT + j + 1) * T - 0.75;
                s.cullable = true;
                objects.push(s);
            }
        }

        chunk.decor.forEach((d) => {
            const set = this.decorTextures[d.type][d.variant];
            const s = new PIXI.Sprite(set.texture);
            s.anchor.set(0.5, set.anchorY);
            s.position.set(d.x, d.y * TILT);
            s.zIndex = d.y;
            s.occ = set.texture.height * set.anchorY > 40;     // tall enough to hide the hero: fades when in front of them
            s.cullable = true;                                // skipped by the renderer while off screen
            d._sprite = s;
            if (d.flip) s.scale.x = -1;
            if (d.type === 'portal' || d.type === 'torch') animated.push({ s, kind: d.type, phase: d.x * 0.01 });
            const ld = DECOR_LIGHTS[d.type];
            if (ld) {
                const color = Array.isArray(ld.color) ? ld.color[d.variant % ld.color.length] : ld.color;
                lights.push({ x: d.x, y: d.y, z: ld.z, r: ld.r, color, i: ld.i ?? 1, flicker: d.type === 'torch' || d.type === 'lamp' || d.type === 'tower_beacon' || d.type === 'tower_dock', phase: hash(d.x | 0, d.y | 0, 7) * 6.28 });
            }
            objects.push(s);
        });

        const tex = bakeGround(cx, cy, (tx, ty) => this.biomeAt(tx, ty), (b, tx, ty) => this.groundColor(b, tx, ty), seed, !!src.bounded,
            src.surfaceNumAt ? (tx, ty, b) => src.surfaceNumAt(tx, ty, b) : null);
        // glowing overlay + lights for luminous surfaces (lava, swamp gas, springs, wells, glyphs)
        const surfGlow = new PIXI.Graphics();
        surfGlow.blendMode = PIXI.BLEND_MODES.ADD;
        for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) {
            const sd = surfaceByNum(chunk.surf[j * CT + i]);
            if (!sd || !sd.glow) continue;
            const tx = cx * CT + i, ty = cy * CT + j;
            const h = hash(tx, ty, seed + 8800);
            const px = tx * T + T / 2, py = ty * T + T / 2;
            if (h < 0.7) { surfGlow.beginFill(sd.glow, sd.id === 'lava' ? 0.3 : 0.2); surfGlow.drawEllipse(px + (h - 0.35) * 30, py + (hash(tx, ty, seed + 8801) - 0.5) * 30, 9 + h * 8, (6 + h * 5)); surfGlow.endFill(); }
            if (h > 0.82) lights.push({ x: px, y: py, z: 4, r: sd.id === 'lava' ? 150 : 100, color: sd.glow, i: sd.id === 'lava' ? 0.9 : 0.6, flicker: sd.id === 'lava', phase: h * 6 });
        }
        this.groundLayer.addChild(surfGlow);
        const base = new PIXI.Sprite(tex);
        base.position.set(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
        base.scale.set(GROUND_RES);
        this.groundLayer.addChildAt(base, 0);
        this.groundLayer.addChildAt(ground, 1);
        sheen.blendMode = PIXI.BLEND_MODES.ADD;
        sheen2.blendMode = PIXI.BLEND_MODES.ADD;
        this.groundLayer.addChild(sheen, sheen2);
        rows.forEach((r) => objects.push(r));
        objects.forEach((o) => this.objectLayer.addChild(o));

        if (this.shapeCache) this.shapeCache.clear();
        return { cx, cy, base, rockTex: tops ? tops.texture : null, surfGlow, ground, sheen, sheen2, objects, animated, lights, phase: hash(cx, cy, seed) * 6.28 };
    }

    // base colour of a tile before lighting: biome colour, interior theme, darker land in high-tier regions
    groundColor(biome, tx, ty) {
        const src = this.source;
        const theme = src.theme;
        let color = BIOME_COLOR[biome];
        if (biome === BIOME.CITY_FLOOR && theme && theme.floor) color = theme.floor;
        else if (biome === BIOME.CAVE_FLOOR && theme && theme.top) color = mixColor(color, theme.top, 0.3);
        else if (biome === BIOME.RUIN_FLOOR && theme && theme.top) color = mixColor(color, theme.top, 0.25);
        if (!src.bounded && !isWaterBiome(biome) && src.tierAt) {
            const tier = src.tierAt(tx, ty);
            if (tier > 0) { const [tc, tk] = TIER_TINT[Math.min(tier, TIER_TINT.length - 1)]; color = mixColor(color, tc, tk); }
            if (src.corruptionAt) color = blightColor(color, src.corruptionAt(tx, ty));
        }
        return color;
    }

    drawTileDetail(ground, sheen, biome, tx, ty, px, py, base, seed) {
        const h1 = hash(tx, ty, seed + 201), h2 = hash(tx, ty, seed + 202), h3 = hash(tx, ty, seed + 203);
        // land marks (grass blades, pebbles, ripples, floor joints) are painted into the ground texture (groundBake)
        switch (biome) {
            case BIOME.SHALLOW:
            case BIOME.DEEP: {
                const foam = biome === BIOME.SHALLOW;
                if (h1 > 0.55) {
                    sheen.beginFill(0xbfe6ff, foam ? 0.35 : 0.22);
                    sheen.drawRect(px + h2 * 30, py + h3 * 40, 10 + h1 * 8, 2);
                    sheen.endFill();
                }
                // a second set of glints that twinkles out of phase with the first
                const g2 = this._sheen2;
                if (g2 && h3 > 0.35) {
                    const h4 = hash(tx, ty, seed + 204);
                    g2.beginFill(0xdff4ff, foam ? 0.3 : 0.2);
                    g2.drawRect(px + h4 * 32, py + h1 * 40, 7 + h4 * 9, 2);
                    g2.drawRect(px + 4 + h4 * 32, py + h1 * 40 + 3, 4 + h2 * 4, 1.5);
                    g2.endFill();
                }
                break;
            }
        }
    }

    drawWall(g, biome, tx, ty, px, py, seed, theme) {
        const h = WALL_HEIGHT[biome];
        const topY = py * TILT - h;
        const hh = hash(tx, ty, seed + 300);
        const south = this.biomeAt(tx, ty + 1);
        const showFront = !isWallBiome(south);
        const fy = (ty + 1) * T * TILT - h;
        const W = T + 1, TH = T * TILT + 1;

        // walls buried deep inside solid rock are drawn as a dark mass; only the rim near open floor is detailed
        if ((biome === BIOME.CAVE_WALL || biome === BIOME.RUIN_WALL) && this.source.bounded) {
            let near = false;
            for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -2; ox <= 2; ox++) {
                if (!isWallBiome(this.biomeAt(tx + ox, ty + oy)) && this.biomeAt(tx + ox, ty + oy) !== BIOME.VOID) { near = true; break; }
            }
            if (!near) {
                g.beginFill(shade(theme.front, 0.55)); g.drawRect(px, topY, W, TH); g.endFill();
                return;
            }
        }

        switch (biome) {
            case BIOME.MOUNTAIN:
            case BIOME.PEAK: {
                const peak = biome === BIOME.PEAK;
                const shape = this.rockShapeAt(tx, ty);
                this.drawRockTop(g, tx, ty, peak ? 0xe8eef6 : 0x8e929d, 1, shape, h);
                if (showFront) this.drawRockFront(g, tx, px, fy, h, peak ? 0x8a9ab0 : 0x5e626e, seed, peak, false, shape);
                break;
            }
            case BIOME.CAVE_WALL: {
                const shape = this.rockShapeAt(tx, ty);
                this.drawRockTop(g, tx, ty, theme.top, 0.7, shape, h);
                if (showFront) {
                    this.drawRockFront(g, tx, px, fy, h, theme.front, seed, false, true, shape);
                    // the odd glowing crystal vein in the rock face
                    if (hash(tx, ty, seed + 341) > 0.9) {
                        const cols = [0x5ad0ff, 0xc07aff, 0x7affc0];
                        const col = cols[Math.floor(hash(tx, ty, seed + 342) * cols.length)];
                        const cx0 = px + 10 + hh * 26, cy0 = fy + h * 0.45;
                        g.beginFill(shade(col, 0.6)); g.drawPolygon([cx0 - 5, cy0 + 10, cx0, cy0 - 12, cx0 + 5, cy0 + 10]); g.endFill();
                        g.beginFill(col); g.drawPolygon([cx0 - 2, cy0 + 8, cx0 + 1, cy0 - 9, cx0 + 3, cy0 + 8]); g.endFill();
                        g.beginFill(shade(col, 0.7)); g.drawPolygon([cx0 + 4, cy0 + 10, cx0 + 9, cy0 - 4, cx0 + 11, cy0 + 10]); g.endFill();
                        if (this._lights) this._lights.push({ x: cx0, y: (ty + 1) * T + 4, z: h * 0.5, r: 120, color: col, i: 0.85, flicker: false, phase: 0 });
                    }
                }
                break;
            }
            case BIOME.RUIN_WALL: {
                // weathered flagstone tops, brick faces with moss
                const n = valueNoise(px / 60, py / 60, seed + 520);
                const top = shade(theme.top, 0.6 + n * 0.25);
                g.beginFill(top); g.drawRect(px, topY, W, TH); g.endFill();
                g.beginFill(0x000000, 0.16);
                g.drawRect(px, topY + TH * 0.5, W, 1); g.drawRect(px + ((ty % 2) ? T * 0.3 : T * 0.65), topY, 1, TH);
                g.endFill();
                if (!isWallBiome(this.biomeAt(tx, ty - 1))) { g.beginFill(shade(top, 1.3)); g.drawRect(px, topY, W, 2); g.endFill(); }
                if (!isWallBiome(this.biomeAt(tx - 1, ty))) { g.beginFill(0x000000, 0.2); g.drawRect(px, topY, 2, TH); g.endFill(); }
                if (showFront) {
                    const bands = 5;
                    for (let r = 0; r < bands; r++) {
                        g.beginFill(shade(theme.front, 1.06 - r * 0.09)); g.drawRect(px, fy + r * (h / bands), W, h / bands + 0.5); g.endFill();
                    }
                    g.beginFill(0x000000, 0.22);
                    for (let r = 0; r < 5; r++) {
                        const ry = fy + r * (h / 5);
                        g.drawRect(px, ry, W, 1.5);
                        g.drawRect(px + ((r + tx) % 2 ? 12 : 30), ry, 1.5, h / 5);
                    }
                    g.endFill();
                    g.beginFill(shade(top, 1.2)); g.drawRect(px, fy, W, 2); g.endFill();
                    if (hh > 0.62) {
                        g.beginFill(0x4a7a3a, 0.85); g.drawEllipse(px + 12 + hh * 20, fy + h - 8, 12, 6); g.endFill();
                        g.beginFill(0x5a9a46, 0.8); g.drawEllipse(px + 8 + hh * 20, fy + h - 11, 6, 4); g.endFill();
                    }
                    if (hh < 0.12) { g.beginFill(0x3a6a2e, 0.8); g.drawRect(px + 20, fy + 2, 2, h * 0.6); g.drawRect(px + 26, fy + 2, 2, h * 0.4); g.endFill(); }
                    g.beginFill(0x000000, 0.3); g.drawRect(px, fy + h - 8, W, 9); g.endFill();
                    g.beginFill(0x000000, 0.28); g.drawRect(px, fy + h, W, 9); g.endFill();
                }
                break;
            }
            case BIOME.CITY_STONE: {
                g.beginFill(0x7a7a84); g.drawRect(px, topY, W, TH); g.endFill();
                g.beginFill(0x9a9aa6); g.drawRect(px, topY, W, 4); g.endFill();
                if (showFront) {
                    g.beginFill(0x5a5a64); g.drawRect(px, fy, W, h + 1); g.endFill();
                    g.beginFill(0x000000, 0.2);
                    for (let r = 0; r < 5; r++) {
                        const ry = fy + r * (h / 5);
                        g.drawRect(px, ry, W, 1.5); g.drawRect(px + ((r + tx) % 2 ? 10 : 28), ry, 1.5, h / 5);
                    }
                    g.endFill();
                    g.beginFill(0x7a7a84);
                    for (let k = 0; k < 3; k++) g.drawRect(px + k * 16 + 2, fy - 6, 10, 7);
                    g.endFill();
                    g.beginFill(0x000000, 0.3); g.drawRect(px, fy + h - 8, W, 9); g.endFill();
                }
                break;
            }
            case BIOME.CITY_WALL: {
                const roofs = theme.roofs || [0xb5473b];
                // where this tile sits between the building's back and front decides the roof slope
                let up = 0, down = 0, left = 0;
                while (up < 12 && this.biomeAt(tx, ty - up - 1) === BIOME.CITY_WALL) up++;
                while (down < 12 && this.biomeAt(tx, ty + down + 1) === BIOME.CITY_WALL) down++;
                while (left < 16 && this.biomeAt(tx - left - 1, ty - up) === BIOME.CITY_WALL) left++;
                // one roof colour per building, keyed to its back-left corner so every tile agrees
                const bx0 = tx - left, by0 = ty - up;
                const roof = roofs[Math.floor(hash(bx0, by0, seed + 320) * roofs.length)];
                const rows = up + down + 1, ridge = rows / 2;      // ridge position in tiles from the back edge
                const sunlit = shade(roof, 1.08), shadowed = shade(roof, 0.78);
                for (let k = 0; k < 4; k++) {
                    const pos = up + (k + 0.5) / 4;                // tiles from back edge
                    // each slope darkens slightly toward its eave
                    const c = pos < ridge ? shade(sunlit, 1.06 - 0.12 * (1 - pos / ridge)) : shade(shadowed, 1.04 - 0.14 * ((pos - ridge) / (rows - ridge)));
                    g.beginFill(c); g.drawRect(px, topY + k * TH / 4, W, TH / 4 + 0.5); g.endFill();
                }
                // shingle courses with staggered joints
                g.beginFill(0x000000, 0.18);
                for (let k = 0; k < 6; k++) {
                    const ry = topY + (k + 1) * TH / 6;
                    g.drawRect(px, ry - 1, W, 1.2);
                    const off = ((ty * 6 + k) % 2) * 6;
                    for (let x = off; x < T; x += 12) g.drawRect(px + x, ry - TH / 6, 1, TH / 6);
                }
                g.endFill();
                // ridge cap
                if (ridge > up && ridge < up + 1) {
                    const ry = topY + (ridge - up) * TH;
                    g.beginFill(shade(roof, 0.55)); g.drawRect(px, ry - 2.5, W, 5); g.endFill();
                    g.beginFill(shade(roof, 1.35)); g.drawRect(px, ry - 2.5, W, 1.6); g.endFill();
                }
                if (!up) { g.beginFill(shade(roof, 1.4), 0.8); g.drawRect(px, topY, W, 2); g.endFill(); }
                if (!isWallBiome(this.biomeAt(tx - 1, ty))) { g.beginFill(0x000000, 0.25); g.drawRect(px, topY, 3, TH); g.endFill(); }
                if (!isWallBiome(this.biomeAt(tx + 1, ty))) { g.beginFill(0x000000, 0.3); g.drawRect(px + W - 3, topY, 3, TH); g.endFill(); }
                // brick chimney now and then on the sunlit slope
                if (up === 1 && tx - bx0 === 1 + Math.floor(hash(bx0, by0, seed + 336) * 3)) {
                    const cx0 = px + 14 + hh * 14, cy0 = topY + TH * 0.5;
                    g.lineStyle(1.2, 0x2a1810, 0.9);
                    g.beginFill(0x9a4a32); g.drawRect(cx0, cy0 - 18, 10, 18); g.endFill();
                    g.beginFill(0x5a5a62); g.drawRect(cx0 - 1.5, cy0 - 21, 13, 4); g.endFill();
                    g.lineStyle(0);
                    g.beginFill(0x000000, 0.2); g.drawRect(cx0 + 6, cy0 - 18, 4, 18); g.endFill();
                }
                if (showFront) {
                    const wall = theme.front;
                    g.beginFill(wall); g.drawRect(px, fy, W, h + 1); g.endFill();
                    g.beginFill(shade(wall, 1.08)); g.drawRect(px + 2, fy + 10, W - 4, h - 22); g.endFill();
                    // eaves: overhang shadow and rafter ends
                    g.beginFill(shade(roof, 0.6)); g.drawRect(px, fy, W, 6); g.endFill();
                    g.beginFill(0x000000, 0.22); g.drawRect(px, fy + 6, W, 5); g.endFill();
                    g.beginFill(0x4a2e18);
                    for (let x = 4; x < T; x += 11) g.drawRect(px + x, fy + 5, 3, 3);
                    g.endFill();
                    // timber frame
                    const beam = 0x5a3a20;
                    g.beginFill(beam);
                    g.drawRect(px, fy + 6, 3, h - 14);
                    g.drawRect(px, fy + 22, W, 3);
                    g.endFill();
                    // stone footing
                    g.beginFill(0x8a8478); g.drawRect(px, fy + h - 9, W, 9); g.endFill();
                    g.beginFill(0x000000, 0.2);
                    for (let x = (tx % 2) * 8; x < T; x += 16) g.drawRect(px + x, fy + h - 9, 1, 9);
                    g.drawRect(px, fy + h - 5, W, 1);
                    g.endFill();
                    const door = hash(tx, ty, seed + 330) < 0.16;
                    if (door) {
                        // arched plank door, step and a lantern
                        g.lineStyle(1.4, 0x2a1810, 0.9);
                        g.beginFill(0x6a4222); g.drawRoundedRect(px + 12, fy + h - 36, 24, 33, 10); g.endFill();
                        g.lineStyle(0);
                        g.beginFill(0x000000, 0.2); g.drawRect(px + 19, fy + h - 34, 1, 31); g.drawRect(px + 27, fy + h - 34, 1, 31); g.endFill();
                        g.beginFill(0x2a1810); g.drawRect(px + 13, fy + h - 26, 22, 2); g.drawRect(px + 13, fy + h - 13, 22, 2); g.endFill();
                        g.beginFill(0xd8b040); g.drawCircle(px + 31, fy + h - 18, 1.8); g.endFill();
                        g.beginFill(0x9a9488); g.drawRect(px + 9, fy + h - 3, 30, 4); g.endFill();
                        g.lineStyle(1, 0x2a1810); g.beginFill(0xffd070); g.drawRoundedRect(px + 39, fy + h - 34, 5, 7, 1.5); g.endFill(); g.lineStyle(0);
                        if (this._lights) this._lights.push({ x: px + 41, y: (ty + 1) * T + 2, z: 30, r: 120, color: 0xffc070, i: 0.8, flicker: true, phase: hh * 6 });
                    } else if (hh < 0.78) {
                        // window with frame, mullions, shutters and maybe a flower box
                        const shut = shade(roof, 0.85);
                        g.beginFill(shut); g.drawRect(px + 6, fy + 27, 6, 17); g.drawRect(px + 36, fy + 27, 6, 17); g.endFill();
                        g.lineStyle(1.4, 0x2a1810, 0.9);
                        g.beginFill(0x4a3826); g.drawRect(px + 12, fy + 26, 24, 19); g.endFill();
                        g.lineStyle(0);
                        g.beginFill(0x8ac4e8); g.drawRect(px + 14, fy + 28, 20, 15); g.endFill();
                        g.beginFill(0xffffff, 0.45); g.drawPolygon([px + 14, fy + 28, px + 22, fy + 28, px + 14, fy + 38]); g.endFill();
                        g.beginFill(0x4a3826); g.drawRect(px + 23, fy + 28, 2, 15); g.drawRect(px + 14, fy + 34.5, 20, 2); g.endFill();
                        if (hh < 0.4) {
                            g.beginFill(0x6a4222); g.drawRect(px + 11, fy + 45, 26, 4); g.endFill();
                            const fl = [0xff5a6a, 0xffd84a, 0xd88aff, 0xffffff][Math.floor(hh * 10) % 4];
                            g.beginFill(0x3a8a3a); g.drawEllipse(px + 24, fy + 44, 12, 3); g.endFill();
                            g.beginFill(fl); for (let k = 0; k < 5; k++) g.drawCircle(px + 15 + k * 4.5, fy + 43 - (k % 2), 1.6); g.endFill();
                        }
                    }
                    g.beginFill(0x000000, 0.25); g.drawRect(px, fy + h, W, 9); g.endFill();
                }
                break;
            }
        }
    }

    // Rock top surface: colour from world-space noise in 3x3 cells so neighbouring tiles blend (no tile grid)
    /** A rock tile's outline, computed once per chunk build (the bake and the walls both need it). */
    rockShapeAt(tx, ty) {
        const cache = this.shapeCache || (this.shapeCache = new Map());
        const key = (tx + 32768) * 65536 + (ty + 32768);
        let s = cache.get(key);
        if (!s) { s = rockShape(tx, ty, this.rockAt, this.source.seed || 0, T); cache.set(key, s); }
        return s;
    }

    /**
     * Natural rock's top is baked (rockBake) and drawn by the row's rock sprite; here only its edge where it meets
     * open floor: a soft dark line, and a sunlit rim along the north. Edges shared with more rock are left alone.
     */
    drawRockTop(g, tx, ty, base, dim, shape, h) {
        if (!shape || shape.whole) return;
        const x0 = tx * T, y0 = ty * T, x1 = x0 + T, y1 = y0 + T;
        const n = !this.rockAt(tx, ty - 1), so = !this.rockAt(tx, ty + 1), w = !this.rockAt(tx - 1, ty), e = !this.rockAt(tx + 1, ty);
        const shared = (ax, ay, bx, by) => (ax === x0 && bx === x0 && !w) || (ax === x1 && bx === x1 && !e) || (ay === y0 && by === y0 && !n) || (ay === y1 && by === y1 && !so);
        const top = shape.top;
        g.lineStyle(1.5, shade(base, 0.45 * dim), 0.3);
        for (let i = 0; i < top.length; i += 2) {
            const j = (i + 2) % top.length, ax = top[i], ay = top[i + 1], bx = top[j], by = top[j + 1];
            if (shared(ax, ay, bx, by)) continue;
            g.moveTo(ax, ay * TILT - h); g.lineTo(bx, by * TILT - h);
        }
        g.lineStyle(0);
        if (shape.north) {
            const rim = shape.north;
            g.lineStyle(2, shade(base, 1.28 * dim), 0.6);
            g.moveTo(rim[0], rim[1] * TILT - h + 1.2);
            for (let i = 2; i < rim.length; i += 2) g.lineTo(rim[i], rim[i + 1] * TILT - h + 1.2);
            g.lineStyle(0);
        }
    }

    // Rock cliff face: vertical light falloff, strata, cracks, ragged foot and contact shadow
    drawRockFront(g, tx, px, fy, h, base, seed, snowy = false, drips = false, shape = null) {
        if (shape && !shape.whole && shape.south) { this.drawRockFace(g, tx, px, h, base, seed, snowy, drips, shape.south); return; }
        const W = T + 1;
        const bands = 12, lit = 1.06 + (valueNoise(px / 140, 0, seed + 530) - 0.5) * 0.06;
        for (let r = 0; r < bands; r++) {
            g.beginFill(shade(base, lit - r * 0.038));
            g.drawRect(px, fy + r * (h / bands), W, h / bands + 0.6);
            g.endFill();
        }
        // strata
        g.beginFill(0x000000, 0.16);
        const off = valueNoise(px / 50, 0, seed + 531) * 6;
        g.drawRect(px, fy + h * 0.34 + off, W, 2);
        g.drawRect(px, fy + h * 0.66 - off, W, 1.5);
        g.endFill();
        // vertical cracks from world noise (continuous across tiles)
        g.beginFill(0x000000, 0.22);
        for (let k = 0; k < 3; k++) {
            const hx = hash(tx * 3 + k, 0, seed + 532);
            if (hx > 0.55) g.drawRect(px + 4 + k * 15 + hx * 6, fy + 4 + hx * 8, 2, h * (0.4 + hx * 0.4));
        }
        g.endFill();
        // highlight lip where top meets face
        g.beginFill(0xffffff, snowy ? 0.5 : 0.16); g.drawRect(px, fy, W, 2); g.endFill();
        if (snowy) {
            g.beginFill(0xf4f8ff, 0.95);
            g.drawPolygon([px, fy, px + W, fy, px + W, fy + 6, px + T * 0.78, fy + 13 + hash(tx, 1, seed) * 6, px + T * 0.55, fy + 7,
                px + T * 0.3, fy + 15 + hash(tx, 2, seed) * 6, px + T * 0.1, fy + 6, px, fy + 8]);
            g.endFill();
        }
        if (drips) {
            g.beginFill(shade(base, 0.62));
            for (let k = 0; k < 3; k++) {
                const sx = px + 4 + k * 15 + hash(tx, k, seed + 533) * 6;
                g.drawPolygon([sx, fy + h - 14, sx + 9, fy + h - 14, sx + 4.5, fy + h - 2 + (k % 2) * 3]);
            }
            g.endFill();
        }
        // ragged foot and ambient occlusion where the cliff meets the ground
        g.beginFill(shade(base, 0.45));
        for (let k = 0; k < 4; k++) {
            const sx = px + k * 12, hk = hash(tx * 4 + k, 3, seed + 534);
            g.drawPolygon([sx, fy + h, sx + 12.5, fy + h, sx + 12.5, fy + h - 4 - hk * 5, sx + 6, fy + h - 2 - hk * 9, sx, fy + h - 5 - hk * 4]);
        }
        g.endFill();
        g.beginFill(0x000000, 0.3); g.drawRect(px, fy + h, W, 5); g.endFill();
        g.beginFill(0x000000, 0.15); g.drawRect(px, fy + h + 5, W, 7); g.endFill();
    }

    /**
     * A cliff face hanging from a curved south edge (world x, y pairs, west to east): the same light falloff,
     * strata, cracks, snow, drips, ragged foot and contact shadow as a square face, following the curve.
     */
    drawRockFace(g, tx, px, h, base, seed, snowy, drips, line) {
        const top = (x) => lineYAt(line, x) * TILT - h;          // screen y where the face starts at x
        const xs = []; for (let i = 0; i < line.length; i += 2) xs.push(line[i]);
        const minX = xs[0], maxX = xs[xs.length - 1];
        const band = (f0, f1, color, alpha = 1) => {
            const pts = [];
            for (const x of xs) pts.push(x, top(x) + h * f0);
            for (let i = xs.length - 1; i >= 0; i--) pts.push(xs[i], top(xs[i]) + h * f1);
            g.beginFill(color, alpha); g.drawPolygon(pts); g.endFill();
        };
        // light falls off down the face in even, small steps (a gradient, not bands)
        const bands = 12, lit = 1.06 + (valueNoise(px / 140, 0, seed + 530) - 0.5) * 0.06;
        for (let r = 0; r < bands; r++) band(r / bands, (r + 1) / bands + 0.01, shade(base, lit - r * 0.038));
        // strata, following the edge
        const off = valueNoise(px / 50, 0, seed + 531) * 6 / h;
        band(0.34 + off, 0.34 + off + 2 / h, 0x000000, 0.08);
        band(0.66 - off, 0.66 - off + 1.5 / h, 0x000000, 0.08);
        // vertical cracks from world noise (continuous across tiles)
        g.beginFill(0x000000, 0.22);
        for (let k = 0; k < 3; k++) {
            const hx = hash(tx * 3 + k, 0, seed + 532), x = px + 4 + k * 15 + hx * 6;
            if (hx > 0.55 && x > minX + 3 && x < maxX - 3) g.drawRect(x, top(x) + 4 + hx * 8, 2, h * (0.4 + hx * 0.4));
        }
        g.endFill();
        // highlight lip where top meets face
        band(0, 2 / h, 0xffffff, snowy ? 0.4 : 0.08);
        if (snowy) {
            const pts = [];
            for (const x of xs) pts.push(x, top(x));
            for (let i = xs.length - 1; i >= 0; i--) {
                const x = xs[i], dip = 6 + ((i % 3) === 1 ? 7 + hash(tx, i, seed) * 6 : 0);
                pts.push(x, top(x) + dip);
            }
            g.beginFill(0xf4f8ff, 0.95); g.drawPolygon(pts); g.endFill();
        }
        if (drips) {
            g.beginFill(shade(base, 0.62));
            for (let k = 0; k < 3; k++) {
                const sx = px + 4 + k * 15 + hash(tx, k, seed + 533) * 6;
                if (sx < minX + 2 || sx + 9 > maxX - 2) continue;
                const b = top(sx + 4.5) + h;
                g.drawPolygon([sx, b - 14, sx + 9, b - 14, sx + 4.5, b - 2 + (k % 2) * 3]);
            }
            g.endFill();
        }
        // ragged foot and ambient occlusion where the cliff meets the ground
        g.beginFill(shade(base, 0.45));
        for (let i = 0; i < xs.length - 1; i++) {
            const a = xs[i], b = xs[i + 1], hk = hash(Math.round(a), 3, seed + 534);
            const ya = top(a) + h, yb = top(b) + h, ym = top((a + b) / 2) + h;
            g.drawPolygon([a, ya + 0.5, b, yb + 0.5, b, yb - 4 - hk * 5, (a + b) / 2, ym - 2 - hk * 9, a, ya - 5 - hk * 4]);
        }
        g.endFill();
        band(1, 1 + 5 / h, 0x000000, 0.3);
        band(1 + 5 / h, 1 + 12 / h, 0x000000, 0.15);
    }

    animate(dt) {
        this.time += dt;
        this.views.forEach((v) => {
            v.sheen.alpha = 0.55 + 0.45 * Math.sin(this.time * 0.035 + v.phase);
            v.sheen2.alpha = 0.5 - 0.45 * Math.sin(this.time * 0.035 + v.phase + 0.6);
            if (v.surfGlow) v.surfGlow.alpha = 0.55 + 0.45 * Math.sin(this.time * 0.05 + v.phase * 1.7);
            v.sheen2.y = Math.sin(this.time * 0.02 + v.phase) * 2;
            for (const a of v.animated) {
                if (a.kind === 'portal') a.s.alpha = 0.78 + 0.22 * Math.sin(this.time * 0.08 + a.phase);
                else a.s.scale.y = 1 + 0.03 * Math.sin(this.time * 0.2 + a.phase);
            }
        });
    }
}

export { BIOME };
