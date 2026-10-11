import { WORLD_CONFIG } from './config.js';
import { hash, fbm } from './noise.js';
import {
    BIOME, BIOME_COLOR, isSolidBiome, isWaterBiome, isWallBiome, groupOf
} from './biomes.js';
import { bakeDecorTextures, shade } from './art.js';

const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;
const TILT = WORLD_CONFIG.tilt;
export const CHUNK_SIZE = T * CT;

const WALL_HEIGHT = {
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
        this.hard = new Uint8Array(CT * CT);   // tiles that block navigation (walls, water, big landmarks)
        this.decor = [];
        this.solids = [];
        this.pois = [];
    }
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
        this.focusChunk = { x: 0, y: 0 };
        this.onChunk = null; // callback(chunkData) when a chunk is first drawn (used by the map)
    }

    setSource(source) {
        this.views.forEach((v) => this.destroyView(v));
        this.views.clear();
        this.data.clear();
        this.source = source;
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
        src.decorForChunk(chunk);

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

    isWaterAt(x, y) { return isWaterBiome(this.biomeAtPos(x, y)); }

    // hard tile obstacle (cheap, used by navigation and line of sight)
    tileBlocked(tx, ty) {
        const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
        return this.getChunk(cx, cy).hard[(ty - cy * CT) * CT + (tx - cx * CT)] === 1;
    }

    blocked(x, y, r) {
        const minTx = Math.floor((x - r) / T), maxTx = Math.floor((x + r) / T);
        const minTy = Math.floor((y - r) / T), maxTy = Math.floor((y + r) / T);
        for (let ty = minTy; ty <= maxTy; ty++) {
            for (let tx = minTx; tx <= maxTx; tx++) {
                if (!isSolidBiome(this.biomeAt(tx, ty))) continue;
                const nx = Math.max(tx * T, Math.min(x, (tx + 1) * T));
                const ny = Math.max(ty * T, Math.min(y, (ty + 1) * T));
                const dx = x - nx, dy = y - ny;
                if (dx * dx + dy * dy < r * r) return true;
            }
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
    tryMove(ent, dx, dy, r) {
        if (dx !== 0 && !this.blocked(ent.wx + dx, ent.wy, r)) ent.wx += dx;
        if (dy !== 0 && !this.blocked(ent.wx, ent.wy + dy, r)) ent.wy += dy;
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
        const budget = immediate ? wanted.length : 2;
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
        view.ground.destroy();
        view.sheen.destroy();
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
        const objects = [];
        const rows = [];
        const animated = [];

        for (let j = 0; j < CT; j++) {
            let row = null;
            const getRow = () => {
                if (!row) {
                    row = new PIXI.Graphics();
                    row.zIndex = (cy * CT + j + 1) * T - 0.5;
                    rows.push(row);
                }
                return row;
            };

            for (let i = 0; i < CT; i++) {
                const tx = cx * CT + i, ty = cy * CT + j;
                const biome = chunk.biomes[j * CT + i];
                if (biome === BIOME.VOID) continue;
                const px = tx * T, py = ty * T;

                const macro = fbm(tx * 0.11, ty * 0.11, seed + 900, 2);
                let light = 0.9 + 0.16 * hash(tx, ty, seed + 5) + (macro - 0.5) * 0.3;
                if (src.bounded) light = 1 + (light - 1) * 0.45;
                let color = BIOME_COLOR[biome];
                if (biome === BIOME.CITY_FLOOR && theme && theme.floor) color = theme.floor;
                const base = shade(color, light);
                ground.beginFill(base);
                ground.drawRect(px, py, T + 1, T + 1);
                ground.endFill();

                this.drawTileDetail(ground, sheen, biome, tx, ty, px, py, base, seed);

                if (isWallBiome(biome)) {
                    this.drawWall(getRow(), biome, tx, ty, px, py, seed, theme);
                } else if (!src.bounded && !isWaterBiome(biome)) {
                    const south = this.biomeAt(tx, ty + 1);
                    if (isWaterBiome(south)) {
                        const g = getRow();
                        const by = (ty + 1) * T * TILT;
                        g.beginFill(shade(0x6b4a2b, light)); g.drawRect(px, by - 1, T + 1, 12); g.endFill();
                        g.beginFill(0x000000, 0.25); g.drawRect(px, by + 6, T + 1, 6); g.endFill();
                    }
                }
            }
        }

        chunk.decor.forEach((d) => {
            const set = this.decorTextures[d.type][d.variant];
            const s = new PIXI.Sprite(set.texture);
            s.anchor.set(0.5, set.anchorY);
            s.position.set(d.x, d.y * TILT);
            s.zIndex = d.y;
            if (d.flip) s.scale.x = -1;
            if (d.type === 'portal' || d.type === 'torch') animated.push({ s, kind: d.type, phase: d.x * 0.01 });
            objects.push(s);
        });

        this.groundLayer.addChildAt(ground, 0);
        sheen.blendMode = PIXI.BLEND_MODES.ADD;
        this.groundLayer.addChild(sheen);
        rows.forEach((r) => objects.push(r));
        objects.forEach((o) => this.objectLayer.addChild(o));

        return { cx, cy, ground, sheen, objects, animated, phase: hash(cx, cy, seed) * 6.28 };
    }

    drawTileDetail(ground, sheen, biome, tx, ty, px, py, base, seed) {
        const h1 = hash(tx, ty, seed + 201), h2 = hash(tx, ty, seed + 202), h3 = hash(tx, ty, seed + 203);
        switch (biome) {
            case BIOME.GRASS:
            case BIOME.FOREST: {
                const dark = shade(base, 0.8), lite = shade(base, 1.22);
                ground.beginFill(dark);
                ground.drawRect(px + h1 * 38, py + h2 * 36, 2, 7);
                ground.drawRect(px + h2 * 36 + 3, py + h3 * 34 + 2, 2, 6);
                ground.endFill();
                ground.beginFill(lite);
                ground.drawRect(px + h3 * 40, py + h1 * 38, 2, 5);
                ground.endFill();
                if (biome === BIOME.FOREST && h2 > 0.8) {
                    ground.beginFill(0x1a4a26, 0.5);
                    ground.drawCircle(px + 12 + h1 * 22, py + 12 + h3 * 22, 8 + h2 * 6);
                    ground.endFill();
                }
                break;
            }
            case BIOME.SAND:
                ground.beginFill(shade(base, 0.85));
                ground.drawRect(px + h1 * 40, py + h2 * 40, 3, 2);
                ground.drawRect(px + h3 * 40, py + h1 * 40, 2, 2);
                ground.endFill();
                break;
            case BIOME.DRY:
                // wind-blown dune ripples
                ground.beginFill(shade(base, 0.86), 0.8);
                ground.drawRect(px + h1 * 12, py + 10 + h2 * 8, 26 + h3 * 8, 2);
                ground.drawRect(px + 6 + h2 * 12, py + 28 + h1 * 8, 22 + h1 * 10, 2);
                ground.endFill();
                ground.beginFill(shade(base, 1.14), 0.7);
                ground.drawRect(px + h3 * 14, py + 14 + h1 * 6, 18, 2);
                ground.endFill();
                break;
            case BIOME.HILL:
                ground.beginFill(shade(base, 0.72));
                ground.drawCircle(px + h1 * 40 + 4, py + h2 * 40 + 4, 3);
                ground.endFill();
                ground.beginFill(shade(base, 1.2));
                ground.drawCircle(px + h3 * 40 + 4, py + h1 * 40 + 4, 2);
                ground.endFill();
                if (h2 > 0.85) {
                    ground.beginFill(0xffffff, 0.55);
                    ground.drawEllipse(px + 24, py + 24, 14, 8);
                    ground.endFill();
                }
                break;
            case BIOME.CAVE_FLOOR:
                ground.beginFill(shade(base, 0.7));
                ground.drawCircle(px + h1 * 40 + 4, py + h2 * 40 + 4, 2.5);
                ground.drawCircle(px + h3 * 40 + 4, py + h1 * 40 + 4, 1.8);
                ground.endFill();
                break;
            case BIOME.RUIN_FLOOR:
                ground.beginFill(0x000000, 0.14);
                ground.drawRect(px, py, T + 1, 1);
                ground.drawRect(px, py, 1, T + 1);
                ground.endFill();
                if ((tx + ty) % 2 === 0) { ground.beginFill(0xffffff, 0.04); ground.drawRect(px, py, T, T); ground.endFill(); }
                if (h1 > 0.82) {
                    ground.lineStyle(1, 0x1a1814, 0.55);
                    ground.moveTo(px + h2 * 30, py + 4); ground.lineTo(px + 14 + h3 * 20, py + 22); ground.lineTo(px + 8 + h1 * 30, py + 42);
                    ground.lineStyle(0);
                }
                break;
            case BIOME.CITY_FLOOR:
                ground.beginFill(0x000000, 0.12);
                ground.drawRect(px, py + T / 2, T + 1, 1);
                ground.drawRect(px + (ty % 2 ? T / 2 : T / 4), py, 1, T / 2);
                ground.drawRect(px + (ty % 2 ? T / 4 : T / 2), py + T / 2, 1, T / 2);
                ground.endFill();
                break;
            case BIOME.SHALLOW:
            case BIOME.DEEP: {
                const foam = biome === BIOME.SHALLOW;
                if (foam) {
                    ground.beginFill(0xffffff, 0.35);
                    if (!isWaterBiome(this.biomeAt(tx, ty - 1))) ground.drawRect(px, py, T + 1, 3);
                    if (!isWaterBiome(this.biomeAt(tx - 1, ty))) ground.drawRect(px, py, 3, T + 1);
                    if (!isWaterBiome(this.biomeAt(tx + 1, ty))) ground.drawRect(px + T - 2, py, 3, T + 1);
                    if (!isWaterBiome(this.biomeAt(tx, ty + 1))) ground.drawRect(px, py + T - 2, T + 1, 3);
                    ground.endFill();
                }
                if (h1 > 0.55) {
                    sheen.beginFill(0xbfe6ff, foam ? 0.35 : 0.22);
                    sheen.drawRect(px + h2 * 30, py + h3 * 40, 10 + h1 * 8, 2);
                    sheen.endFill();
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
                const top = peak ? shade(0xeef3f8, 0.92 + hh * 0.1) : shade(0x8e929d, 0.85 + hh * 0.25);
                g.beginFill(top); g.drawRect(px, topY, W, TH); g.endFill();
                g.beginFill(peak ? 0xffffff : shade(top, 1.18), 0.7); g.drawRect(px + 4 + hh * 20, topY + 3, 14, 5); g.endFill();
                if (showFront) {
                    g.beginFill(peak ? 0x9fb0c4 : 0x565a66); g.drawRect(px, fy, W, h + 1); g.endFill();
                    g.beginFill(0x000000, 0.18);
                    g.drawRect(px, fy, W, 6); g.drawRect(px + 8 + hh * 14, fy + 6, 4, h - 6); g.drawRect(px + 30 + hh * 8, fy + 12, 3, h - 12);
                    g.endFill();
                    g.beginFill(0x000000, 0.28); g.drawRect(px, fy + h - 8, W, 9); g.endFill();
                    if (peak) {
                        g.beginFill(0xffffff, 0.85);
                        g.drawPolygon([px, fy, px + W, fy, px + T * 0.75, fy + 12, px + T * 0.5, fy + 6, px + T * 0.25, fy + 13]);
                        g.endFill();
                    }
                }
                break;
            }
            case BIOME.CAVE_WALL: {
                const top = shade(theme.top, 0.55 + hh * 0.3);
                g.beginFill(top); g.drawRect(px, topY, W, TH); g.endFill();
                g.beginFill(shade(top, 1.6), 0.5); g.drawRect(px, topY, W, 2); g.endFill();
                g.beginFill(shade(top, 1.2), 0.5); g.drawRect(px + hh * 24, topY + 4, 12, 4); g.endFill();
                if (showFront) {
                    g.beginFill(theme.front); g.drawRect(px, fy, W, h + 1); g.endFill();
                    g.beginFill(0x000000, 0.25);
                    g.drawRect(px + 6 + hh * 12, fy, 5, h); g.drawRect(px + 28 + hh * 10, fy + 8, 4, h - 8);
                    g.endFill();
                    g.beginFill(shade(theme.front, 0.6));
                    for (let k = 0; k < 3; k++) {
                        const sx = px + 4 + k * 15 + hh * 6;
                        g.drawPolygon([sx, fy + h - 14, sx + 9, fy + h - 14, sx + 4.5, fy + h - 2 + (k % 2) * 3]);
                    }
                    g.endFill();
                    g.beginFill(0x000000, 0.35); g.drawRect(px, fy + h - 10, W, 11); g.endFill();
                    g.beginFill(0x000000, 0.3); g.drawRect(px, fy + h, W, 9); g.endFill();
                }
                break;
            }
            case BIOME.RUIN_WALL: {
                const top = shade(theme.top, 0.62 + hh * 0.2);
                g.beginFill(top); g.drawRect(px, topY, W, TH); g.endFill();
                g.beginFill(0x000000, 0.14); g.drawRect(px, topY, W, 1); g.drawRect(px, topY, 1, TH); g.endFill();
                if (showFront) {
                    g.beginFill(theme.front); g.drawRect(px, fy, W, h + 1); g.endFill();
                    g.beginFill(0x000000, 0.22);
                    for (let r = 0; r < 5; r++) {
                        const ry = fy + r * (h / 5);
                        g.drawRect(px, ry, W, 1.5);
                        g.drawRect(px + ((r + tx) % 2 ? 12 : 30), ry, 1.5, h / 5);
                    }
                    g.endFill();
                    if (hh > 0.7) { g.beginFill(0x4a8a3a, 0.8); g.drawEllipse(px + 12 + hh * 20, fy + h - 8, 11, 6); g.endFill(); }
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
                // one roof colour per building: seeded from the building's origin so rows match
                const roof = roofs[Math.floor(hash(Math.floor(tx / 6), Math.floor(ty / 5), seed + 320) * roofs.length)];
                g.beginFill(shade(roof, 0.9 + hh * 0.12)); g.drawRect(px, topY, W, TH); g.endFill();
                g.beginFill(0x000000, 0.18); g.drawRect(px, topY + TH * 0.5, W, 1.5); g.drawRect(px, topY, W, 1); g.endFill();
                g.beginFill(shade(roof, 1.25), 0.6); g.drawRect(px, topY + 2, W, 3); g.endFill();
                if (showFront) {
                    const wall = theme.front;
                    g.beginFill(wall); g.drawRect(px, fy, W, h + 1); g.endFill();
                    g.beginFill(shade(roof, 0.75)); g.drawRect(px, fy, W, 7); g.endFill();
                    g.beginFill(0x000000, 0.13); g.drawRect(px + T - 2, fy + 7, 3, h - 7); g.endFill();
                    const door = hash(tx, ty, seed + 330) < 0.16;
                    if (door) {
                        g.beginFill(0x5a3a1e); g.drawRoundedRect(px + 11, fy + h - 34, 24, 34, 5); g.endFill();
                        g.beginFill(0xffd070); g.drawCircle(px + 30, fy + h - 17, 1.8); g.endFill();
                    } else if (hh < 0.75) {
                        g.beginFill(0x4a3826); g.drawRect(px + 11, fy + 17, 24, 22); g.endFill();
                        g.beginFill(0x9ad4ff); g.drawRect(px + 13, fy + 19, 20, 18); g.endFill();
                        g.beginFill(0xffffff, 0.35); g.drawRect(px + 13, fy + 19, 7, 18); g.endFill();
                        g.beginFill(0x4a3826); g.drawRect(px + 22, fy + 19, 2, 18); g.endFill();
                    }
                    g.beginFill(0x000000, 0.22); g.drawRect(px, fy + h - 6, W, 7); g.endFill();
                    g.beginFill(0x000000, 0.25); g.drawRect(px, fy + h, W, 9); g.endFill();
                }
                break;
            }
        }
    }

    animate(dt) {
        this.time += dt;
        this.views.forEach((v) => {
            v.sheen.alpha = 0.55 + 0.45 * Math.sin(this.time * 0.035 + v.phase);
            for (const a of v.animated) {
                if (a.kind === 'portal') a.s.alpha = 0.78 + 0.22 * Math.sin(this.time * 0.08 + a.phase);
                else a.s.scale.y = 1 + 0.03 * Math.sin(this.time * 0.2 + a.phase);
            }
        });
    }
}

export { BIOME };
