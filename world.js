import { WORLD_CONFIG } from './config.js';

const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;
const TILT = WORLD_CONFIG.tilt;
export const CHUNK_SIZE = T * CT;

// ---------------------------------------------------------------------------
// Deterministic noise
// ---------------------------------------------------------------------------
function hash(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function valueNoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
    const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

function fbm(x, y, seed, octaves = 4) {
    let sum = 0, amp = 1, norm = 0, freq = 1;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 101) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
}

// ---------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------
export const BIOME = {
    DEEP: 0, SHALLOW: 1, SAND: 2, DRY: 3, GRASS: 4, FOREST: 5, HILL: 6, MOUNTAIN: 7, PEAK: 8
};

const BIOME_COLOR = [
    0x15406a, // DEEP
    0x2b82ad, // SHALLOW
    0xdac98d, // SAND
    0xb39a55, // DRY
    0x519c40, // GRASS
    0x2f7a3b, // FOREST
    0x7c7566, // HILL
    0x4d515c, // MOUNTAIN (ground beneath the block)
    0x4d515c  // PEAK
];

const MOUNTAIN_H = 46; // height (screen px) of mountain blocks

const isSolidBiome = (b) => b === BIOME.DEEP || b === BIOME.MOUNTAIN || b === BIOME.PEAK;
const isWaterBiome = (b) => b === BIOME.DEEP || b === BIOME.SHALLOW;

function shade(color, f) {
    const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * f)));
    const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * f)));
    const b = Math.min(255, Math.max(0, Math.round((color & 255) * f)));
    return (r << 16) | (g << 8) | b;
}

// ---------------------------------------------------------------------------
// Decoration art (baked once into textures)
// ---------------------------------------------------------------------------
function bake(app, w, h, pad, draw) {
    const g = new PIXI.Graphics();
    draw(g);
    const holder = new PIXI.Container();
    holder.addChild(g);
    const region = new PIXI.Rectangle(-w / 2, -h, w, h + pad);
    const texture = app.renderer.generateTexture(holder, {
        region,
        resolution: 2,
        multisample: PIXI.MSAA_QUALITY.HIGH
    });
    holder.destroy({ children: true });
    return { texture, anchorY: h / (h + pad) };
}

function shadow(g, rx, ry, alpha = 0.32) {
    g.beginFill(0x000000, alpha);
    g.drawEllipse(0, 0, rx, ry);
    g.endFill();
}

function drawTree(g, leaf) {
    shadow(g, 24, 8);
    g.beginFill(0x5b3a1e); g.drawRect(-4, -30, 8, 30); g.endFill();
    g.beginFill(0x3f2914); g.drawRect(1, -30, 3, 30); g.endFill();
    const blobs = [[0, -62, 27], [-15, -46, 20], [15, -46, 20], [0, -42, 22]];
    blobs.forEach(([x, y, r]) => { g.beginFill(shade(leaf, 0.72)); g.drawCircle(x + 2, y + 3, r); g.endFill(); });
    blobs.forEach(([x, y, r]) => { g.beginFill(leaf); g.drawCircle(x, y, r * 0.9); g.endFill(); });
    g.beginFill(shade(leaf, 1.28), 0.85); g.drawCircle(-8, -70, 12); g.endFill();
    g.beginFill(shade(leaf, 1.4), 0.6); g.drawCircle(-11, -74, 6); g.endFill();
}

function drawPine(g, leaf) {
    shadow(g, 20, 7);
    g.beginFill(0x4b321b); g.drawRect(-3, -14, 6, 14); g.endFill();
    for (let i = 0; i < 4; i++) {
        const y = -14 - i * 19;
        const w = 26 - i * 5;
        g.beginFill(shade(leaf, 0.7 + i * 0.08));
        g.drawPolygon([-w, y, w, y, 0, y - 32]);
        g.endFill();
        g.beginFill(shade(leaf, 1.25), 0.55);
        g.drawPolygon([-w, y, 0, y, 0, y - 32]);
        g.endFill();
    }
}

function drawRock(g, base) {
    shadow(g, 20, 7);
    g.beginFill(shade(base, 0.62));
    g.drawPolygon([-18, 0, -20, -12, -8, -24, 10, -22, 20, -10, 18, 0]);
    g.endFill();
    g.beginFill(shade(base, 1.0));
    g.drawPolygon([-20, -12, -8, -24, 10, -22, 2, -12]);
    g.endFill();
    g.beginFill(shade(base, 1.25), 0.8);
    g.drawPolygon([-8, -24, 10, -22, 4, -17, -9, -18]);
    g.endFill();
}

function drawBush(g, leaf) {
    shadow(g, 16, 6, 0.25);
    [[-9, -8, 9], [9, -8, 9], [0, -13, 11]].forEach(([x, y, r]) => {
        g.beginFill(shade(leaf, 0.75)); g.drawCircle(x, y + 2, r); g.endFill();
    });
    [[-9, -9, 8], [9, -9, 8], [0, -15, 10]].forEach(([x, y, r]) => {
        g.beginFill(leaf); g.drawCircle(x, y, r); g.endFill();
    });
    g.beginFill(shade(leaf, 1.35), 0.7); g.drawCircle(-3, -19, 4); g.endFill();
}

function drawCactus(g) {
    shadow(g, 14, 5);
    const body = 0x3e8f4b;
    g.beginFill(shade(body, 0.7)); g.drawRoundedRect(-6, -46, 12, 46, 6); g.endFill();
    g.beginFill(body); g.drawRoundedRect(-6, -46, 8, 46, 4); g.endFill();
    g.beginFill(shade(body, 0.8)); g.drawRoundedRect(-17, -32, 6, 18, 3); g.drawRect(-17, -18, 12, 5); g.endFill();
    g.beginFill(shade(body, 0.8)); g.drawRoundedRect(11, -38, 6, 20, 3); g.drawRect(5, -22, 12, 5); g.endFill();
}

function drawDeadTree(g) {
    shadow(g, 16, 6, 0.28);
    g.lineStyle(5, 0x4a3826); g.moveTo(0, 0); g.lineTo(0, -42);
    g.lineStyle(3, 0x4a3826);
    g.moveTo(0, -24); g.lineTo(-14, -38); g.moveTo(0, -32); g.lineTo(13, -46); g.moveTo(-9, -32); g.lineTo(-12, -46);
    g.lineStyle(0);
}

const DECOR_DEFS = {
    tree: { variants: 3, w: 84, h: 100, pad: 14, r: 13, solid: true },
    pine: { variants: 2, w: 64, h: 106, pad: 12, r: 11, solid: true },
    rock: { variants: 3, w: 52, h: 34, pad: 12, r: 15, solid: true },
    bush: { variants: 2, w: 44, h: 32, pad: 10, r: 0, solid: false },
    cactus: { variants: 1, w: 48, h: 60, pad: 10, r: 9, solid: true },
    dead: { variants: 1, w: 48, h: 60, pad: 10, r: 8, solid: true }
};

function buildDecorTextures(app) {
    const out = {};
    const leaves = [0x3f9a3d, 0x2a7d3a, 0xc9822b];
    const pines = [0x2a6d47, 0x36805a];
    const rocks = [0x8b8f99, 0x9a8f80, 0x7a8592];
    const bushes = [0x4aa04a, 0x6a9a3a];
    out.tree = leaves.map((c) => bake(app, 84, 100, 14, (g) => drawTree(g, c)));
    out.pine = pines.map((c) => bake(app, 64, 106, 12, (g) => drawPine(g, c)));
    out.rock = rocks.map((c) => bake(app, 52, 34, 12, (g) => drawRock(g, c)));
    out.bush = bushes.map((c) => bake(app, 44, 32, 10, (g) => drawBush(g, c)));
    out.cactus = [bake(app, 48, 60, 10, drawCactus)];
    out.dead = [bake(app, 48, 60, 10, drawDeadTree)];
    return out;
}

// ---------------------------------------------------------------------------
// Chunk data (pure, deterministic, cheap)
// ---------------------------------------------------------------------------
class ChunkData {
    constructor(cx, cy) {
        this.cx = cx;
        this.cy = cy;
        this.biomes = new Uint8Array(CT * CT);
        this.decor = [];
        this.solids = [];
    }
}

const chunkKey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);

export class World {
    constructor(app, groundLayer, objectLayer) {
        this.app = app;
        this.groundLayer = groundLayer;
        this.objectLayer = objectLayer;
        this.decorTextures = buildDecorTextures(app);
        this.data = new Map();
        this.views = new Map();
        this.queue = [];
        this.time = 0;
        this.seed = 1;
        this.focusChunk = { x: 0, y: 0 };
    }

    reset(seed = Math.floor(Math.random() * 1e9)) {
        this.seed = seed;
        this.views.forEach((v) => this.destroyView(v));
        this.views.clear();
        this.data.clear();
        this.queue.length = 0;
    }

    // ------------------------------------------------------------ generation
    sampleBiome(tx, ty) {
        const seed = this.seed;
        let e = fbm(tx * 0.03, ty * 0.03, seed, 5);
        let m = fbm(tx * 0.045 + 137, ty * 0.045 - 71, seed + 17, 4);
        // Contrast so all biomes actually occur
        e = clamp01((e - 0.5) * 1.55 + 0.5);
        m = clamp01((m - 0.5) * 1.5 + 0.5);
        // Guaranteed friendly clearing at the origin
        const d = Math.hypot(tx, ty);
        const clear = smooth(clamp01((WORLD_CONFIG.spawnClearing + 9 - d) / 9));
        e = lerp(e, 0.55, clear);
        m = lerp(m, 0.5, clear);

        if (e < 0.27) return BIOME.DEEP;
        if (e < 0.33) return BIOME.SHALLOW;
        if (e < 0.37) return BIOME.SAND;
        if (e > 0.85) return BIOME.PEAK;
        if (e > 0.76) return BIOME.MOUNTAIN;
        if (e > 0.68) return BIOME.HILL;
        if (m < 0.36) return BIOME.DRY;
        if (m > 0.6) return BIOME.FOREST;
        return BIOME.GRASS;
    }

    getChunk(cx, cy) {
        const key = chunkKey(cx, cy);
        let chunk = this.data.get(key);
        if (chunk) return chunk;

        chunk = new ChunkData(cx, cy);
        const seed = this.seed;
        for (let j = 0; j < CT; j++) {
            for (let i = 0; i < CT; i++) {
                const tx = cx * CT + i, ty = cy * CT + j;
                const biome = this.sampleBiome(tx, ty);
                chunk.biomes[j * CT + i] = biome;
                this.generateDecor(chunk, tx, ty, biome, seed);
            }
        }
        this.data.set(key, chunk);
        if (this.data.size > WORLD_CONFIG.maxCachedChunks) this.pruneCache();
        return chunk;
    }

    generateDecor(chunk, tx, ty, biome, seed) {
        if (isSolidBiome(biome) || biome === BIOME.SHALLOW) return;
        if (Math.hypot(tx, ty) < 4) return;
        const r = hash(tx, ty, seed + 31);
        let type = null;
        switch (biome) {
            case BIOME.GRASS:
                if (r < 0.03) type = 'tree'; else if (r < 0.048) type = 'bush'; else if (r < 0.056) type = 'rock';
                break;
            case BIOME.FOREST:
                if (r < 0.14) type = 'tree'; else if (r < 0.22) type = 'pine'; else if (r < 0.28) type = 'bush'; else if (r < 0.3) type = 'rock';
                break;
            case BIOME.DRY:
                if (r < 0.018) type = 'dead'; else if (r < 0.04) type = 'rock'; else if (r < 0.065) type = 'cactus';
                break;
            case BIOME.SAND:
                if (r < 0.012) type = 'rock';
                break;
            case BIOME.HILL:
                if (r < 0.06) type = 'rock'; else if (r < 0.1) type = 'pine';
                break;
        }
        if (!type) return;
        const def = DECOR_DEFS[type];
        const variant = Math.floor(hash(tx, ty, seed + 57) * def.variants);
        const x = (tx + 0.15 + 0.7 * hash(tx, ty, seed + 71)) * T;
        const y = (ty + 0.15 + 0.7 * hash(tx, ty, seed + 83)) * T;
        const item = { type, variant, x, y, r: def.r, flip: hash(tx, ty, seed + 97) < 0.5 };
        chunk.decor.push(item);
        if (def.solid) chunk.solids.push(item);
    }

    pruneCache() {
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

    biomeAtPos(x, y) {
        return this.biomeAt(Math.floor(x / T), Math.floor(y / T));
    }

    isWaterAt(x, y) {
        return isWaterBiome(this.biomeAtPos(x, y));
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
        const pad = r + 20;
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

    // ------------------------------------------------------------- rendering
    update(camX, camY, viewW, viewH, immediate = false) {
        const pcx = Math.floor(camX / CHUNK_SIZE), pcy = Math.floor(camY / CHUNK_SIZE);
        this.focusChunk = { x: pcx, y: pcy };
        const radX = Math.ceil((viewW / 2 + 120) / CHUNK_SIZE);
        const radY = Math.ceil((viewH / 2 / TILT + 120) / CHUNK_SIZE);

        const wanted = [];
        for (let cy = pcy - radY; cy <= pcy + radY; cy++) {
            for (let cx = pcx - radX; cx <= pcx + radX; cx++) {
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

        // Unload chunks that are far away
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
        const seed = this.seed;
        const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE;

        const ground = new PIXI.Graphics();
        const sheen = new PIXI.Graphics();
        const objects = [];
        const rows = [];

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
                const px = tx * T, py = ty * T;

                const macro = fbm(tx * 0.11, ty * 0.11, seed + 900, 2);
                const light = 0.9 + 0.16 * hash(tx, ty, seed + 5) + (macro - 0.5) * 0.3;
                const base = shade(BIOME_COLOR[biome], light);
                ground.beginFill(base);
                ground.drawRect(px, py, T + 1, T + 1);
                ground.endFill();

                this.drawTileDetail(ground, sheen, biome, tx, ty, px, py, base, seed);

                // Vertical faces: cliffs and mountains (drawn in projected space)
                if (biome === BIOME.MOUNTAIN || biome === BIOME.PEAK) {
                    this.drawMountain(getRow(), biome, tx, ty, px, py, seed);
                } else if (!isWaterBiome(biome)) {
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

        // Decoration sprites
        chunk.decor.forEach((d) => {
            const set = this.decorTextures[d.type][d.variant];
            const s = new PIXI.Sprite(set.texture);
            s.anchor.set(0.5, set.anchorY);
            s.position.set(d.x, d.y * TILT);
            s.zIndex = d.y;
            if (d.flip) s.scale.x = -1;
            objects.push(s);
        });

        ground.position.set(0, 0);
        this.groundLayer.addChildAt(ground, 0);
        sheen.blendMode = PIXI.BLEND_MODES.ADD;
        this.groundLayer.addChild(sheen);
        rows.forEach((r) => objects.push(r));
        objects.forEach((o) => this.objectLayer.addChild(o));

        return { cx, cy, ground, sheen, objects, phase: hash(cx, cy, seed) * 6.28 };
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
                if (biome === BIOME.GRASS && h1 > 0.93) {
                    const colors = [0xffe14d, 0xff7ab8, 0xffffff, 0x8fd1ff];
                    ground.beginFill(colors[Math.floor(h2 * colors.length)]);
                    ground.drawCircle(px + 8 + h2 * 30, py + 8 + h3 * 30, 2.2);
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
                ground.beginFill(shade(base, 0.78));
                ground.drawRect(px + h1 * 30, py + h2 * 40, 10, 2);
                ground.drawRect(px + h3 * 30 + 4, py + h1 * 36, 2, 8);
                ground.endFill();
                break;
            case BIOME.HILL:
                ground.beginFill(shade(base, 0.72));
                ground.drawCircle(px + h1 * 40 + 4, py + h2 * 40 + 4, 3);
                ground.endFill();
                ground.beginFill(shade(base, 1.2));
                ground.drawCircle(px + h3 * 40 + 4, py + h1 * 40 + 4, 2);
                ground.endFill();
                break;
            case BIOME.SHALLOW:
            case BIOME.DEEP: {
                // foam along the shoreline and sparkling ripples
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

    drawMountain(g, biome, tx, ty, px, py, seed) {
        const h = MOUNTAIN_H;
        const topY = py * TILT - h;
        const hh = hash(tx, ty, seed + 300);
        const peak = biome === BIOME.PEAK;
        const top = peak ? shade(0xeef3f8, 0.92 + hh * 0.1) : shade(0x8e929d, 0.85 + hh * 0.25);
        const front = peak ? 0x9fb0c4 : 0x565a66;

        // extend a little so tiles merge into a solid massif
        g.beginFill(top);
        g.drawRect(px, topY, T + 1, T * TILT + 1);
        g.endFill();
        // top-face highlights / snow patches
        g.beginFill(peak ? 0xffffff : shade(top, 1.18), 0.7);
        g.drawRect(px + 4 + hh * 20, topY + 3, 14, 5);
        g.endFill();

        if (!(this.biomeAt(tx, ty + 1) === BIOME.MOUNTAIN || this.biomeAt(tx, ty + 1) === BIOME.PEAK)) {
            const fy = (ty + 1) * T * TILT - h;
            g.beginFill(front);
            g.drawRect(px, fy, T + 1, h + 1);
            g.endFill();
            // strata + shading
            g.beginFill(0x000000, 0.18);
            g.drawRect(px, fy, T + 1, 6);
            g.drawRect(px + 8 + hh * 14, fy + 6, 4, h - 6);
            g.drawRect(px + 30 + hh * 8, fy + 12, 3, h - 12);
            g.endFill();
            g.beginFill(0x000000, 0.28);
            g.drawRect(px, fy + h - 8, T + 1, 9);
            g.endFill();
            if (peak) {
                g.beginFill(0xffffff, 0.85);
                g.drawPolygon([px, fy, px + T + 1, fy, px + T * 0.75, fy + 12, px + T * 0.5, fy + 6, px + T * 0.25, fy + 13]);
                g.endFill();
            }
        }
    }

    animate(dt) {
        this.time += dt;
        this.views.forEach((v) => {
            v.sheen.alpha = 0.55 + 0.45 * Math.sin(this.time * 0.035 + v.phase);
        });
    }
}

export { BIOME_COLOR, isSolidBiome, isWaterBiome };
