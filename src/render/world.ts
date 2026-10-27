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

        return { cx, cy, base, surfGlow, ground, sheen, sheen2, objects, animated, lights, phase: hash(cx, cy, seed) * 6.28 };
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
                this.drawRockTop(g, tx, ty, px, topY, peak ? 0xe8eef6 : 0x8e929d, seed, peak ? 0.12 : 0.34, peak ? null : 0x6a7a52);
                if (showFront) this.drawRockFront(g, tx, px, fy, h, peak ? 0x8a9ab0 : 0x5e626e, seed, peak);
                break;
            }
            case BIOME.CAVE_WALL: {
                this.drawRockTop(g, tx, ty, px, topY, theme.top, seed, 0.4, null, 0.7);
                if (showFront) {
                    this.drawRockFront(g, tx, px, fy, h, theme.front, seed, false, true);
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
    drawRockTop(g, tx, ty, px, topY, base, seed, variance, moss = null, dim = 1) {
        const py = ty * T;
        const S = T / 4;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
            const wx = px + i * S + S / 2, wy = py + j * S + S / 2;
            const n1 = valueNoise(wx / 110, wy / 110, seed + 510), n2 = valueNoise(wx / 34, wy / 34, seed + 511);
            const c = shade(base, (0.8 + n1 * variance + (n2 - 0.5) * 0.07) * dim);
            g.beginFill(c);
            g.drawRect(px + i * S, topY + j * S * TILT, S + 0.6, S * TILT + 0.6);
            g.endFill();
        }
        const W = T + 1, TH = T * TILT + 1;
        const n = !isWallBiome(this.biomeAt(tx, ty - 1)), w = !isWallBiome(this.biomeAt(tx - 1, ty)), e = !isWallBiome(this.biomeAt(tx + 1, ty));
        if (n) {
            // sunlit rim along the northern edge, a little ragged
            g.beginFill(shade(base, 1.32 * dim), 0.9);
            for (let k = 0; k < 4; k++) g.drawRect(px + k * 12, topY, 12.5, 2 + hash(tx * 4 + k, ty, seed + 512) * 3);
            g.endFill();
        }
        if (w) { g.beginFill(0x000000, 0.18); g.drawRect(px, topY, 3, TH); g.endFill(); }
        if (e) { g.beginFill(0x000000, 0.24); g.drawRect(px + W - 3, topY, 3, TH); g.endFill(); }
        // moss and lichen in soft patches, pebbles, cracks
        if (moss && valueNoise(px / 80, py / 80, seed + 514) > 0.6) {
            for (let k = 0; k < 3; k++) {
                const hx = hash(tx * 3 + k, ty, seed + 515), hy = hash(tx, ty * 3 + k, seed + 516);
                g.beginFill(shade(moss, 0.85 + hx * 0.3), 0.75);
                g.drawEllipse(px + 8 + hx * 32, topY + (6 + hy * 30) * TILT, 6 + hy * 6, (4 + hx * 3) * TILT);
                g.endFill();
            }
        }
        for (let k = 0; k < 2; k++) {
            const hx = hash(tx * 2 + k, ty, seed + 517), hy = hash(tx, ty * 2 + k, seed + 518);
            if (hx < 0.55) continue;
            g.beginFill(shade(base, 0.62 * dim)); g.drawEllipse(px + 6 + hy * 36, topY + (8 + hx * 30) * TILT + 1, 3.5, 2); g.endFill();
            g.beginFill(shade(base, 1.15 * dim)); g.drawEllipse(px + 6 + hy * 36, topY + (8 + hx * 30) * TILT, 3, 1.6); g.endFill();
        }
        const h1 = hash(tx, ty, seed + 513);
        if (h1 > 0.6) {
            g.lineStyle(1, shade(base, 0.55 * dim), 0.6);
            const sx = px + 8 + h1 * 26, sy = topY + 6;
            g.moveTo(sx, sy); g.lineTo(sx + 6, sy + 8); g.lineTo(sx + 2, sy + 15); g.lineTo(sx + 9, sy + 22);
            g.lineStyle(0);
        }
        if (h1 < 0.3) { g.beginFill(shade(base, 1.18 * dim)); g.drawEllipse(px + 10 + h1 * 80, topY + 14, 4, 2.5); g.endFill(); }
    }

    // Rock cliff face: vertical light falloff, strata, cracks, ragged foot and contact shadow
    drawRockFront(g, tx, px, fy, h, base, seed, snowy = false, drips = false) {
        const W = T + 1;
        const bands = 6;
        for (let r = 0; r < bands; r++) {
            const n = valueNoise((px + 24) / 70, r * 0.7 + fy / 120, seed + 530);
            g.beginFill(shade(base, 1.08 - r * 0.075 + (n - 0.5) * 0.1));
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
