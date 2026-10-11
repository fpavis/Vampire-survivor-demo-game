import { WORLD_CONFIG } from '../config';
import { hash, fbm, smooth, lerp, clamp01 } from './noise';
import { BIOME, isSolidBiome, isWaterBiome, groupOf, GROUP } from './biomes';
import { DECOR_DEFS } from '../../render/decorArt';
import { GROUP_LEVEL_OFFSET, tierOf, zoneLevel } from './difficulty';
import { SURFACE_NUM, surfaceAt } from './surfaces';
import type { ChunkLike, DecorItem, Poi, PoiType, TerrainSource } from '../types';

const T = WORLD_CONFIG.tile;
export const POI_CELL = 16; // tiles per point-of-interest cell

// cumulative probability tables: [maxRoll, decorType]
const DECOR_TABLES: Record<number, [number, string][]> = {
    [BIOME.GRASS]: [[0.02, 'appletree'], [0.04, 'birch'], [0.075, 'flowerbed'], [0.095, 'bush'], [0.12, 'tallgrass'],
        [0.128, 'haystack'], [0.131, 'scarecrow'], [0.145, 'wheat'], [0.153, 'rock']],
    [BIOME.FOREST]: [[0.12, 'oak'], [0.2, 'pine'], [0.235, 'bigmushroom'], [0.26, 'log'], [0.28, 'stump'],
        [0.34, 'fern'], [0.37, 'glowshroom'], [0.40, 'bush'], [0.415, 'mossrock']],
    [BIOME.DRY]: [[0.012, 'dead'], [0.035, 'cactus'], [0.055, 'barrelcactus'], [0.065, 'sandrock'], [0.073, 'spire'],
        [0.09, 'bones'], [0.13, 'dunebush'], [0.134, 'palm']],
    [BIOME.SAND]: [[0.02, 'palm'], [0.05, 'shell'], [0.065, 'driftwood'], [0.09, 'seagrass'], [0.10, 'beachrock']],
    [BIOME.SHALLOW]: [[0.014, 'seastack'], [0.03, 'seagrass']],
    [BIOME.HILL]: [[0.03, 'boulder'], [0.07, 'rock'], [0.11, 'snowpine'], [0.125, 'crystal'], [0.14, 'icerock'], [0.155, 'ore']]
};

const NAME_A: Record<PoiType, string[]> = {
    cave: ['Gloom', 'Echo', 'Hollow', 'Deep', 'Ember', 'Frost', 'Whisper', 'Black'],
    ruins: ['Fallen', 'Sunken', 'Ashen', 'Forgotten', 'Weeping', 'Shattered', 'Old', 'Hollow'],
    city: ['Port', 'Fort', 'Oak', 'Stone', 'Willow', 'High', 'Sun', 'River']
};
const NAME_B: Record<PoiType, string[]> = {
    cave: ['Cavern', 'Grotto', 'Den', 'Burrow', 'Depths', 'Hollow'],
    ruins: ['Crypt', 'Temple', 'Citadel', 'Sanctum', 'Vault', 'Halls'],
    city: ['haven', 'mere', 'watch', 'ford', 'stead', 'gate']
};

const TYPE_WEIGHTS: Record<string, Record<PoiType, number>> = {
    [GROUP.FIELD]: { cave: 0.3, ruins: 0.3, city: 0.4 },
    [GROUP.FOREST]: { cave: 0.4, ruins: 0.5, city: 0.1 },
    [GROUP.DESERT]: { cave: 0.25, ruins: 0.5, city: 0.25 },
    [GROUP.SHORE]: { cave: 0.35, ruins: 0.2, city: 0.45 },
    [GROUP.MOUNTAIN]: { cave: 0.7, ruins: 0.25, city: 0.05 }
};

export function addDecorItem(chunk: ChunkLike, type: string, x: number, y: number, variant: number, extra: Partial<DecorItem> = {}): DecorItem {
    const def = DECOR_DEFS[type];
    const item: DecorItem = {
        type, variant: variant % def.variants.length, x, y, r: def.r, solid: def.solid,
        flip: extra.flip !== undefined ? extra.flip : false, ...extra
    };
    chunk.decor.push(item);
    if (def.solid) chunk.solids.push(item);
    return item;
}

const TREE_TYPES = new Set(['appletree', 'birch', 'oak', 'pine', 'snowpine', 'palm']);

const ENTRANCE_OFFSET: Record<PoiType, number> = { cave: 64, ruins: 48, city: 58 };

export class OverworldSource implements TerrainSource {
    seed: number;
    bounded = false;
    theme = null;
    poiCache = new Map<string, Poi | null>();

    constructor(seed: number) {
        this.seed = seed;
    }

    // ---------------------------------------------------------------- terrain
    biomeAt(tx: number, ty: number): number {
        const seed = this.seed;
        let e = fbm(tx * 0.03, ty * 0.03, seed, 5);
        let m = fbm(tx * 0.036 + 137, ty * 0.036 - 71, seed + 17, 4);
        e = clamp01((e - 0.5) * 1.55 + 0.5);
        m = clamp01((m - 0.5) * 1.5 + 0.5);
        // friendly clearing at the origin
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
        if (m < 0.38) return BIOME.DRY;
        if (m > 0.6) return BIOME.FOREST;
        return BIOME.GRASS;
    }

    /** Integer enemy level of the zone at a tile (distance based, see difficulty.ts). */
    levelAt(tx: number, ty: number): number {
      return zoneLevel(this.seed, tx, ty, GROUP_LEVEL_OFFSET[groupOf(this.biomeAt(tx, ty))] ?? 0);
    }

    tierAt(tx: number, ty: number): number { return tierOf(this.levelAt(tx, ty)); }

    /** numeric surface id (0 = none) at a tile whose biome is already known */
    surfaceNumAt(tx: number, ty: number, biome: number): number {
        const level = zoneLevel(this.seed, tx, ty, GROUP_LEVEL_OFFSET[groupOf(biome)] ?? 0);
        const s = surfaceAt(this.seed, tx, ty, biome, level);
        return s ? SURFACE_NUM[s] : 0;
    }

    // ------------------------------------------------------------ places
    poiForCell(cx: number, cy: number): Poi | null {
        const key = `${cx},${cy}`;
        const cached = this.poiCache.get(key);
        if (cached !== undefined) return cached;
        const poi = this.makePoi(cx, cy);
        this.poiCache.set(key, poi);
        return poi;
    }

    freeArea(tx: number, ty: number, rx: number, ry: number): boolean {
        for (let y = ty - ry; y <= ty + ry; y++) {
            for (let x = tx - rx; x <= tx + rx; x++) {
                const b = this.biomeAt(x, y);
                if (isSolidBiome(b) || isWaterBiome(b)) return false;
            }
        }
        return true;
    }

    makePoi(cx: number, cy: number): Poi | null {
        const seed = this.seed;
        const near = Math.hypot((cx + 0.5) * POI_CELL, (cy + 0.5) * POI_CELL) < 34;
        if (hash(cx, cy, seed + 500) > (near ? 0.62 : 0.36)) return null;
        if (Math.hypot((cx + 0.5) * POI_CELL, (cy + 0.5) * POI_CELL) < 16) return null;

        for (let attempt = 0; attempt < 6; attempt++) {
            const tx = cx * POI_CELL + 4 + Math.floor(hash(cx, cy, seed + 510 + attempt) * 8);
            const ty = cy * POI_CELL + 5 + Math.floor(hash(cx, cy, seed + 530 + attempt) * 7);
            if (Math.hypot(tx, ty) < 15) continue;
            const biome = this.biomeAt(tx, ty);
            if (isSolidBiome(biome) || isWaterBiome(biome)) continue;
            if (!this.freeArea(tx, ty, 2, 2)) continue;
            const group = groupOf(biome);
            const weights = TYPE_WEIGHTS[group];
            if (!weights) continue;
            let roll = hash(cx, cy, seed + 550) * (weights.cave + weights.ruins + weights.city);
            let type: PoiType = 'cave';
            if ((roll -= weights.cave) > 0) type = (roll -= weights.ruins) > 0 ? 'city' : 'ruins';
            if (type === 'city' && !this.freeArea(tx, ty - 2, 5, 3)) type = hash(cx, cy, seed + 560) < 0.5 ? 'ruins' : 'cave';
            const a = NAME_A[type], b = NAME_B[type];
            const first = a[Math.floor(hash(cx, cy, seed + 570) * a.length)];
            const second = b[Math.floor(hash(cx, cy, seed + 580) * b.length)];
            const name = type === 'city' ? first + second : `${first} ${second}`;
            return {
                id: `${cx},${cy}`, type, group, tx, ty,
                x: (tx + 0.5) * T, y: (ty + 0.5) * T,
                ex: (tx + 0.5) * T, ey: (ty + 0.5) * T + ENTRANCE_OFFSET[type],
                seed: Math.floor(hash(cx, cy, seed + 590) * 1e9), name
            };
        }
        return null;
    }

    // POIs close to a tile (used to keep clutter away from landmarks)
    poisNear(tx: number, ty: number, tiles: number): Poi[] {
        const out = [];
        const c0x = Math.floor((tx - tiles) / POI_CELL), c1x = Math.floor((tx + tiles) / POI_CELL);
        const c0y = Math.floor((ty - tiles) / POI_CELL), c1y = Math.floor((ty + tiles) / POI_CELL);
        for (let cy = c0y; cy <= c1y; cy++) {
            for (let cx = c0x; cx <= c1x; cx++) {
                const p = this.poiForCell(cx, cy);
                if (p) out.push(p);
            }
        }
        return out;
    }

    // ------------------------------------------------------------ decoration
    addDecor(chunk: ChunkLike, type: string, x: number, y: number, variant: number, extra: Partial<DecorItem> = {}): DecorItem {
        return addDecorItem(chunk, type, x, y, variant, extra);
    }

    landmarkVariant(poi: Poi): number {
        switch (poi.group) {
            case GROUP.DESERT: case GROUP.SHORE: return 1;
            case GROUP.MOUNTAIN: return 2;
            default: return 0;
        }
    }

    placePoiLandmark(chunk: ChunkLike, poi: Poi): void {
        const h = (n: number) => hash(poi.tx, poi.ty, this.seed + 600 + n);
        const lv = this.landmarkVariant(poi);
        const add = (type: string, ox: number, oy: number, variant = 0, extra?: Partial<DecorItem>) => {
            const x = poi.x + ox, y = poi.y + oy;
            if (x < chunk.x0 || x >= chunk.x0 + chunk.size || y < chunk.y0 || y >= chunk.y0 + chunk.size) return;
            this.addDecor(chunk, type, x, y, variant, extra);
        };
        if (poi.type === 'cave') {
            add('cavemouth', 0, 0, lv);
            add('boulder', -105, 18, 0); add('boulder', 112, 8, 0);
            add('crystal', -78, 34, Math.floor(h(1) * 3)); add('crystal', 84, 40, Math.floor(h(2) * 3));
            add('rock', 60, 64, 1); add('rock', -52, 62, 0);
        } else if (poi.type === 'ruins') {
            add('ruinarch', 0, 0, 0);
            [[-110, 30], [118, 24], [-70, 84], [84, 80], [-150, -30], [150, -40]].forEach(([ox, oy], i) => {
                add(h(i) < 0.6 ? 'pillar' : 'rock', ox, oy, Math.floor(h(10 + i) * 2));
            });
            add('bones', 40, 70, 0); add('bush', -30, 90, 0);
        } else {
            add('gate', 0, 0, lv === 1 ? 1 : (poi.group === GROUP.SHORE ? 2 : 0));
            [[-150, -70], [150, -80], [-70, -150], [80, -160], [-215, -10], [220, -20]].forEach(([ox, oy], i) => {
                add('house', ox, oy, Math.floor(h(20 + i) * 5));
            });
            add('tower', 0, -190, Math.floor(h(30) * 2));
            add('lamp', -70, 40, 0); add('lamp', 70, 40, 0);
            add('planter', -105, 44, 0); add('planter', 105, 44, 0);
        }
    }

    decorForChunk(chunk: ChunkLike): void {
        const { cx, cy } = chunk;
        const CT = WORLD_CONFIG.chunkTiles;
        const pois = this.poisNear(cx * CT + CT / 2, cy * CT + CT / 2, CT + 12);
        const chunkTier = this.tierAt(cx * CT + CT / 2, cy * CT + CT / 2);
        const seed = this.seed;

        for (let j = 0; j < CT; j++) {
            for (let i = 0; i < CT; i++) {
                const tx = cx * CT + i, ty = cy * CT + j;
                const biome = chunk.biomes[j * CT + i];
                const table = DECOR_TABLES[biome];
                if (!table) continue;
                if (Math.hypot(tx, ty) < 4) continue;
                let blocked = false;
                for (const p of pois) {
                    const reach = p.type === 'city' ? 7 : 5;
                    if (Math.abs(tx - p.tx) < reach + 1 && Math.abs(ty - p.ty) < reach && Math.hypot(tx - p.tx, (ty - p.ty) * 0.8) < reach + 1) { blocked = true; break; }
                }
                if (blocked) continue;
                const r = hash(tx, ty, seed + 31);
                let type: string | null = null;
                for (const [max, t] of table) if (r < max) { type = t; break; }
                if (!type) continue;
                if (chunkTier > 0 && TREE_TYPES.has(type) && hash(tx, ty, seed + 63) < Math.min(0.8, chunkTier * 0.25)) type = 'dead';
                const variant = Math.floor(hash(tx, ty, seed + 57) * 8);
                const x = (tx + 0.15 + 0.7 * hash(tx, ty, seed + 71)) * T;
                const y = (ty + 0.15 + 0.7 * hash(tx, ty, seed + 83)) * T;
                this.addDecor(chunk, type, x, y, variant, { flip: hash(tx, ty, seed + 97) < 0.5 });
            }
        }

        for (const p of pois) {
            this.placePoiLandmark(chunk, p);
            if (p.ex >= chunk.x0 && p.ex < chunk.x0 + chunk.size && p.ey >= chunk.y0 && p.ey < chunk.y0 + chunk.size) {
                chunk.pois.push(p);
            }
        }
    }
}

