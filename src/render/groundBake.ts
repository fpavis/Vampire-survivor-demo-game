// @ts-nocheck -- Pixi-bound renderer helper
// Bakes one chunk of ground into a texture: organic biome borders (noise-jittered tile lookups), soft macro
// lighting, per-biome micro texture, grass rims, earthen banks above water, shore foam and water depth.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { hash, valueNoise } from '../core/world/noise';
import { BIOME, BIOME_COLOR } from '../core/world/biomes';
import { SURFACES, SURFACE_IDS, SURFACE_NUM } from '../core/world/surfaces';

const ROAD = SURFACE_NUM.road;

const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;
export const GROUND_RES = 2;                 // world pixels per texel (the sprite is scaled up with smoothing)
const N = (CT * T) / GROUND_RES;             // texels per chunk side
const STEP = 6;                              // coarse noise grid step in texels
const PAD = 16;                              // texels of neighbouring ground computed so seams match
const M = N + PAD * 2;
const G = Math.ceil(M / STEP) + 2;
const LT = CT + 2;                           // local tile grid incl. a one-tile border

// Hard-edged man-made floors never get wobbly borders
const GEO = new Uint8Array(32);
[BIOME.CITY_FLOOR, BIOME.RUIN_FLOOR, BIOME.CITY_STONE, BIOME.CITY_WALL, BIOME.RUIN_WALL, BIOME.VOID, BIOME.BRIDGE].forEach((b) => { GEO[b] = 1; });
const WAT = new Uint8Array(32);
WAT[BIOME.DEEP] = 1; WAT[BIOME.SHALLOW] = 1;
// draw order for rims: higher layers get a darker edge where they meet lower ones
const LAYER = new Uint8Array(32);
[[BIOME.DEEP, 0], [BIOME.SHALLOW, 0], [BIOME.PLATEAU, 2], [BIOME.SAND, 1], [BIOME.DRY, 1], [BIOME.CAVE_FLOOR, 1], [BIOME.HILL, 2],
    [BIOME.GRASS, 3], [BIOME.FOREST, 4], [BIOME.MOUNTAIN, 5], [BIOME.PEAK, 5], [BIOME.CAVE_WALL, 5]].forEach(([b, l]) => { LAYER[b] = l; });

const BANK = [0x7a5634, 0x6b4a2b, 0x5a3c22, 0x4a3019, 0x3a2412];

export interface GroundColorFn { (biome: number, tx: number, ty: number): number }

/**
 * Bakes the ground of chunk (cx, cy) into an RGBA texture of N x N texels (one texel = GROUND_RES world px).
 * Everything is computed in world space so neighbouring chunks meet seamlessly.
 */
// surface palette: [base, light, dark] per numeric id
const SURF_RGB = SURFACE_IDS.map((id) => {
    const c = SURFACES[id].color;
    const p = (v: number) => [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    const glow = SURFACES[id].glow ?? c;
    return { base: p(c), hot: p(glow), dark: p(((c >> 16 & 255) * 0.55 << 16) | ((c >> 8 & 255) * 0.55 << 8) | (c & 255) * 0.55) };
});

export function bakeGround(cx: number, cy: number, biomeAt: (tx: number, ty: number) => number, colorOf: GroundColorFn, seed: number, bounded: boolean, surfOf: ((tx: number, ty: number, biome: number) => number) | null = null): PIXI.Texture {
    const tx0 = cx * CT - 1, ty0 = cy * CT - 1;
    const tb = new Uint8Array(LT * LT);
    const tc = new Int32Array(LT * LT);
    const ts = new Uint8Array(LT * LT);
    for (let j = 0; j < LT; j++) for (let i = 0; i < LT; i++) {
        const b = biomeAt(tx0 + i, ty0 + j);
        tb[j * LT + i] = b;
        tc[j * LT + i] = colorOf(b, tx0 + i, ty0 + j);
        if (surfOf) ts[j * LT + i] = surfOf(tx0 + i, ty0 + j, b);
    }

    // coarse noise channels in world space: jitter x/y, macro light, detail
    const wx0 = cx * CT * T, wy0 = cy * CT * T;
    const jx = new Float32Array(G * G), jy = new Float32Array(G * G), mac = new Float32Array(G * G), det = new Float32Array(G * G);
    const lightAmp = bounded ? 0.5 : 1;
    for (let gj = 0; gj < G; gj++) for (let gi = 0; gi < G; gi++) {
        const wx = wx0 + (gi * STEP - PAD) * GROUND_RES, wy = wy0 + (gj * STEP - PAD) * GROUND_RES;
        const k = gj * G + gi;
        jx[k] = (valueNoise(wx / 34, wy / 34, seed + 71) - 0.5) * 2 + (valueNoise(wx / 13, wy / 13, seed + 72) - 0.5) * 0.7;
        jy[k] = (valueNoise(wx / 34, wy / 34, seed + 73) - 0.5) * 2 + (valueNoise(wx / 13, wy / 13, seed + 74) - 0.5) * 0.7;
        mac[k] = ((valueNoise(wx / 260, wy / 260, seed + 900) - 0.5) * 0.24 + (valueNoise(wx / 70, wy / 70, seed + 901) - 0.5) * 0.12) * lightAmp;
        det[k] = valueNoise(wx / 22, wy / 22, seed + 902);
    }

    // pass 1: which local tile each texel shows (padded so neighbour lookups never leave the array)
    const amp = bounded ? 9 : 12;
    const idx = new Uint16Array(M * M);
    const bio = new Uint8Array(M * M);
    const sfc = new Uint8Array(M * M);
    const invT = 1 / T, invS = 1 / STEP;
    for (let vv = 0; vv < M; vv++) {
        const py = (vv - PAD + 0.5) * GROUND_RES;
        const cj = Math.floor(py * invT) + 1;
        const fv = vv * invS, gj = fv | 0, b = fv - gj, b1 = 1 - b;
        const r0 = gj * G, r1 = r0 + G;
        const ob = vv * M;
        for (let uu = 0; uu < M; uu++) {
            const px = (uu - PAD + 0.5) * GROUND_RES;
            let k = cj * LT + Math.floor(px * invT) + 1;
            if (!GEO[tb[k]]) {
                const fu = uu * invS, gi = fu | 0, a = fu - gi, a1 = 1 - a;
                const k0 = r0 + gi, k1 = r1 + gi;
                const dx = (jx[k0] * a1 + jx[k0 + 1] * a) * b1 + (jx[k1] * a1 + jx[k1 + 1] * a) * b;
                const dy = (jy[k0] * a1 + jy[k0 + 1] * a) * b1 + (jy[k1] * a1 + jy[k1 + 1] * a) * b;
                const si = Math.floor((px + dx * amp) * invT) + 1, sj = Math.floor((py + dy * amp) * invT) + 1;
                if (si >= 0 && sj >= 0 && si < LT && sj < LT) {
                    const k2 = sj * LT + si;
                    if (!GEO[tb[k2]]) k = k2;
                }
            }
            idx[ob + uu] = k;
            bio[ob + uu] = tb[k];
            sfc[ob + uu] = ts[k];
        }
    }

    // pass 2: colour (offsets never exceed PAD, so no bounds checks are needed)
    const data = new Uint8Array(N * N * 4);
    const gx0 = (wx0 / GROUND_RES) | 0, gy0 = (wy0 / GROUND_RES) | 0;
    const M2 = M * 2, M3 = M * 3, M4 = M * 4;
    for (let v = 0; v < N; v++) {
        const vv = v + PAD;
        const fv = vv * invS, gj = fv | 0, b = fv - gj, b1 = 1 - b;
        const r0 = gj * G, r1 = r0 + G;
        const rowO = vv * M + PAD;
        const wyRow = (gy0 + v) * GROUND_RES;
        for (let u = 0; u < N; u++) {
            const o = rowO + u;
            const bm = bio[o];
            const p = (v * N + u) << 2;
            if (bm === BIOME.VOID) { data[p + 3] = 0; continue; }
            const col = tc[idx[o]];
            let r = (col >> 16) & 255, g = (col >> 8) & 255, bl = col & 255;
            // per-texel grain (integer hash)
            let h = Math.imul(gx0 + u, 374761393) ^ Math.imul(gy0 + v, 668265263);
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            const gr = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
            const fu = (u + PAD) * invS, gi = fu | 0, a = fu - gi, a1 = 1 - a;
            const k0 = r0 + gi, k1 = r1 + gi;
            let light = 1 + (mac[k0] * a1 + mac[k0 + 1] * a) * b1 + (mac[k1] * a1 + mac[k1 + 1] * a) * b;
            const dt = (det[k0] * a1 + det[k0 + 1] * a) * b1 + (det[k1] * a1 + det[k1 + 1] * a) * b;
            let mixC = -1, mixK = 0;

            switch (bm) {
                case BIOME.GRASS: light += (dt - 0.5) * 0.16 + (gr - 0.5) * 0.07; if (dt > 0.72) { mixC = 0x8acb5a; mixK = (dt - 0.72) * 0.9; } break;
                case BIOME.FOREST: light += (dt - 0.5) * 0.22 + (gr - 0.5) * 0.08; if (dt < 0.3) { mixC = 0x1a3a20; mixK = (0.3 - dt) * 1.2; } break;
                case BIOME.SAND: light += (gr - 0.5) * 0.1 + (dt - 0.5) * 0.06; break;
                case BIOME.DRY: light += Math.sin((wyRow + dt * 40) * 0.19) * 0.045 + (gr - 0.5) * 0.08; break;
                case BIOME.HILL: light += (dt - 0.5) * 0.2 + (gr - 0.5) * 0.12; break;
                case BIOME.CAVE_FLOOR: light += (dt - 0.5) * 0.24 + (gr - 0.5) * 0.14; break;
                case BIOME.CITY_FLOOR: case BIOME.RUIN_FLOOR: light += (gr - 0.5) * 0.08 + (dt - 0.5) * 0.08; break;
                case BIOME.MOUNTAIN: case BIOME.PEAK: case BIOME.CAVE_WALL: light *= 0.8; break;
                case BIOME.PLATEAU: {
                    // dressed stone slabs with a little moss
                    const sx = (gx0 + u) % 24, sy = (gy0 + v) % 24;
                    light += (dt - 0.5) * 0.16 + (gr - 0.5) * 0.08;
                    if (sx < 1 || sy < 1) light *= 0.82; else if (sx < 2 || sy < 2) light *= 1.08;
                    if (dt > 0.7) { mixC = 0x6a8a4a; mixK = (dt - 0.7) * 1.3; }
                    break;
                }
                case BIOME.BRIDGE: {
                    // planks across the direction of travel, dark rails where the bridge meets water
                    const ew = bio[o + 12] === BIOME.BRIDGE || bio[o - 12] === BIOME.BRIDGE;
                    const coord = ew ? gx0 + u : gy0 + v;
                    const plank = Math.floor(coord / 5);
                    const edge = ew ? coord % 5 : coord % 5;
                    light += ((plank * 2654435761 >>> 24) / 255 - 0.5) * 0.22 + (gr - 0.5) * 0.06;
                    if (edge === 0) light *= 0.7;
                    const rail = ew ? (WAT[bio[o + M * 4]] || WAT[bio[o - M * 4]]) : (WAT[bio[o + 4]] || WAT[bio[o - 4]]);
                    if (rail) { r = 74; g = 48; bl = 24; light = 0.9 + (gr - 0.5) * 0.15; }
                    break;
                }
            }

            if (WAT[bm]) {
                // shore foam, shallow brightening, deeper further out
                let landNear = 0;
                if (!WAT[bio[o + 1]] || !WAT[bio[o - 1]] || !WAT[bio[o + M]] || !WAT[bio[o - M]]) landNear = 1;
                else if (!WAT[bio[o + 2]] || !WAT[bio[o - 2]] || !WAT[bio[o + M2]] || !WAT[bio[o - M2]]) landNear = 2;
                else if (!WAT[bio[o + 3]] || !WAT[bio[o - 3]] || !WAT[bio[o + M3]] || !WAT[bio[o - M3]]) landNear = 3;
                let depth = 0;
                if (!landNear) for (let k = 5; k <= 14; k += 3) {
                    const km = k * M;
                    if (WAT[bio[o + k]] && WAT[bio[o - k]] && WAT[bio[o + km]] && WAT[bio[o - km]]) depth++;
                }
                light += (dt - 0.5) * 0.12 - depth * 0.05;
                if (landNear) { mixC = 0xe8f6ff; mixK = landNear === 1 ? 0.75 : landNear === 2 ? 0.45 : 0.18; }
                else if (bm === BIOME.SHALLOW && depth < 2) { mixC = 0x6ad0e8; mixK = 0.12; }
            } else if (!GEO[bm]) {
                // earthen bank where land drops into water to the south (the camera looks north)
                let bank = 0;
                for (let k = 1; k <= 5; k++) if (WAT[bio[o + k * M]]) { bank = k; break; }
                if (bank && LAYER[bm] >= 1) {
                    const c = BANK[5 - bank];
                    r = (c >> 16) & 255; g = (c >> 8) & 255; bl = c & 255;
                    light = 1 + (gr - 0.5) * 0.12;
                } else {
                    // rim where a higher layer meets a lower one (grass over sand, forest over grass...)
                    const L = LAYER[bm];
                    const n3 = LAYER[bio[o + M2]];
                    if (LAYER[bio[o + 2]] < L || LAYER[bio[o - 2]] < L || n3 < L || LAYER[bio[o - M2]] < L) light *= 0.84;
                    else if (n3 > L || LAYER[bio[o + M4]] > L) light *= 0.9;   // soft contact shadow under taller ground
                    if ((bm === BIOME.SAND || bm === BIOME.DRY) && (WAT[bio[o - M3]] || WAT[bio[o + 3]] || WAT[bio[o - 3]])) { mixC = 0x9a8a5a; mixK = 0.35; }
                }
            }

            if (mixC >= 0) {
                const k = mixK > 1 ? 1 : mixK;
                r += (((mixC >> 16) & 255) - r) * k; g += (((mixC >> 8) & 255) - g) * k; bl += ((mixC & 255) - bl) * k;
            }
            const sf = sfc[o];
            if (sf) {
                // surface patch: its own colour, animated-looking detail from noise, a dark crust where it meets plain ground
                const pal = SURF_RGB[sf - 1];
                const edge = !sfc[o + 2] || !sfc[o - 2] || !sfc[o + M2] || !sfc[o - M2];
                const edge2 = !sfc[o + 5] || !sfc[o - 5] || !sfc[o + M * 5] || !sfc[o - M * 5];
                const hot = Math.max(0, Math.min(1, (dt - 0.38) * 3.2 + (gr - 0.5) * 0.3));
                let sr = pal.base[0], sg = pal.base[1], sb = pal.base[2];
                if (sf === ROAD) {
                    // packed dirt with worn cobbles in staggered rows; grassy, darker verges at the edge
                    const px = gx0 + u, py = gy0 + v;
                    const col = Math.floor(px / 7), off = (col & 1) * 3, row = Math.floor((py + off) / 5);
                    const lx = px - col * 7, ly = py + off - row * 5;
                    let ch = Math.imul(col, 374761393) ^ Math.imul(row, 668265263);
                    ch = Math.imul(ch ^ (ch >>> 13), 1274126177);
                    const cr = ((ch ^ (ch >>> 16)) >>> 0) / 4294967296;
                    sr = 168; sg = 138; sb = 92;
                    if (!edge && cr < 0.62 && lx > 0 && ly > 0) {
                        const tone = 0.86 + cr * 0.32;
                        sr = 178 * tone; sg = 168 * tone; sb = 146 * tone;
                        if (lx === 1 || ly === 1) { sr *= 1.08; sg *= 1.08; sb *= 1.08; }
                    } else if (lx === 0 || ly === 0) { sr *= 0.84; sg *= 0.84; sb *= 0.84; }
                    sr += (gr - 0.5) * 14; sg += (gr - 0.5) * 12; sb += (gr - 0.5) * 10;
                    if (edge2) { sr = sr * 0.75 + 70 * 0.25; sg = sg * 0.75 + 110 * 0.25; sb = sb * 0.75 + 50 * 0.25; }
                    if (edge) { sr *= 0.82; sg *= 0.86; sb *= 0.8; }
                } else if (sf === 1) {          // lava: dark crust with glowing cracks
                    const k = edge ? 0 : hot;
                    sr = pal.dark[0] + (pal.hot[0] - pal.dark[0]) * k; sg = pal.dark[1] + (pal.hot[1] - pal.dark[1]) * k; sb = pal.dark[2] + (pal.hot[2] - pal.dark[2]) * k;
                } else {
                    const k = hot * 0.5;
                    sr += (pal.hot[0] - sr) * k; sg += (pal.hot[1] - sg) * k; sb += (pal.hot[2] - sb) * k;
                    if (edge2) { sr *= 0.78; sg *= 0.78; sb *= 0.78; }
                    if (edge) { sr *= 0.8; sg *= 0.8; sb *= 0.8; }
                }
                r = sr; g = sg; bl = sb;
                light = 0.96 + (dt - 0.5) * 0.12;
            }
            const R = r * light, Gc = g * light, B = bl * light;
            data[p] = R > 255 ? 255 : R < 0 ? 0 : R;
            data[p + 1] = Gc > 255 ? 255 : Gc < 0 ? 0 : Gc;
            data[p + 2] = B > 255 ? 255 : B < 0 ? 0 : B;
            data[p + 3] = 255;
        }
    }
    paintDetails(data, cx, cy, tb, tc, seed);
    return PIXI.Texture.fromBuffer(data, N, N, { scaleMode: PIXI.SCALE_MODES.LINEAR });
}

const shadeRGB = (c: number, f: number): [number, number, number] =>
    [Math.min(255, ((c >> 16) & 255) * f), Math.min(255, ((c >> 8) & 255) * f), Math.min(255, (c & 255) * f)];

/**
 * Small per-tile marks painted straight into the texels: grass blades, pebbles, dune ripples, floor joints.
 * (They used to be vector graphics drawn every frame; as texels they cost nothing to render.)
 */
function paintDetails(data: Uint8Array, cx: number, cy: number, tb: Uint8Array, tc: Int32Array, seed: number) {
    const ox = cx * CT * T, oy = cy * CT * T;
    const put = (u: number, v: number, rgb: [number, number, number], a: number) => {
        if (u < 0 || v < 0 || u >= N || v >= N) return;
        const p = (v * N + u) * 4;
        data[p] += (rgb[0] - data[p]) * a; data[p + 1] += (rgb[1] - data[p + 1]) * a; data[p + 2] += (rgb[2] - data[p + 2]) * a;
    };
    const rect = (x: number, y: number, w: number, h: number, rgb: [number, number, number], a = 1) => {
        const u0 = Math.round((x - ox) / GROUND_RES), v0 = Math.round((y - oy) / GROUND_RES);
        const u1 = Math.max(u0 + 1, Math.round((x + w - ox) / GROUND_RES)), v1 = Math.max(v0 + 1, Math.round((y + h - oy) / GROUND_RES));
        for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) put(u, v, rgb, a);
    };
    const ellipse = (x: number, y: number, rx: number, ry: number, rgb: [number, number, number], a = 1) => {
        const u0 = Math.floor((x - rx - ox) / GROUND_RES), u1 = Math.ceil((x + rx - ox) / GROUND_RES);
        const v0 = Math.floor((y - ry - oy) / GROUND_RES), v1 = Math.ceil((y + ry - oy) / GROUND_RES);
        for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) {
            const dx = (ox + (u + 0.5) * GROUND_RES - x) / rx, dy = (oy + (v + 0.5) * GROUND_RES - y) / ry;
            if (dx * dx + dy * dy <= 1) put(u, v, rgb, a);
        }
    };
    for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) {
        const tx = cx * CT + i, ty = cy * CT + j;
        const k = (j + 1) * LT + (i + 1);
        const biome = tb[k];
        const base = tc[k];
        const px = tx * T, py = ty * T;
        const h1 = hash(tx, ty, seed + 201), h2 = hash(tx, ty, seed + 202), h3 = hash(tx, ty, seed + 203);
        const tone = 0.95 + 0.1 * hash(tx, ty, seed + 5);
        const sh = (f: number) => shadeRGB(base, tone * f);
        switch (biome) {
            case BIOME.GRASS:
            case BIOME.FOREST:
                rect(px + h1 * 38, py + h2 * 36, 2, 7, sh(0.8));
                rect(px + h2 * 36 + 3, py + h3 * 34 + 2, 2, 6, sh(0.8));
                rect(px + h3 * 40, py + h1 * 38, 2, 5, sh(1.22));
                if (biome === BIOME.FOREST && h2 > 0.8) ellipse(px + 12 + h1 * 22, py + 12 + h3 * 22, 8 + h2 * 6, 8 + h2 * 6, [26, 74, 38], 0.5);
                break;
            case BIOME.SAND:
                rect(px + h1 * 40, py + h2 * 40, 3, 2, sh(0.85));
                rect(px + h3 * 40, py + h1 * 40, 2, 2, sh(0.85));
                break;
            case BIOME.DRY:
                rect(px + h1 * 12, py + 10 + h2 * 8, 26 + h3 * 8, 2, sh(0.86), 0.8);
                rect(px + 6 + h2 * 12, py + 28 + h1 * 8, 22 + h1 * 10, 2, sh(0.86), 0.8);
                rect(px + h3 * 14, py + 14 + h1 * 6, 18, 2, sh(1.14), 0.7);
                break;
            case BIOME.HILL:
                ellipse(px + h1 * 40 + 4, py + h2 * 40 + 4, 3, 3, sh(0.72));
                ellipse(px + h3 * 40 + 4, py + h1 * 40 + 4, 2, 2, sh(1.2));
                if (h2 > 0.8) {
                    ellipse(px + 10 + h3 * 24, py + 22, 5, 3.5, sh(0.6));
                    ellipse(px + 18 + h3 * 24, py + 26, 3.5, 2.5, sh(0.6));
                    ellipse(px + 9 + h3 * 24, py + 20.5, 3.5, 2, sh(1.3));
                }
                break;
            case BIOME.CAVE_FLOOR:
                ellipse(px + h1 * 40 + 4, py + h2 * 40 + 4, 2.5, 2.5, sh(0.7));
                ellipse(px + h3 * 40 + 4, py + h1 * 40 + 4, 1.8, 1.8, sh(0.7));
                break;
            case BIOME.RUIN_FLOOR:
                rect(px, py, T + 1, 1, [0, 0, 0], 0.14);
                rect(px, py, 1, T + 1, [0, 0, 0], 0.14);
                if ((tx + ty) % 2 === 0) rect(px, py, T, T, [255, 255, 255], 0.04);
                if (h1 > 0.82) {
                    // a hairline crack
                    const pts = [[px + h2 * 30, py + 4], [px + 14 + h3 * 20, py + 22], [px + 8 + h1 * 30, py + 42]];
                    for (let s = 0; s < 2; s++) {
                        const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
                        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / GROUND_RES);
                        for (let q = 0; q <= n; q++) rect(x0 + (x1 - x0) * q / n, y0 + (y1 - y0) * q / n, 1, 1, [26, 24, 20], 0.55);
                    }
                }
                break;
            case BIOME.CITY_FLOOR:
                rect(px, py + T / 2, T + 1, 1, [0, 0, 0], 0.12);
                rect(px + (ty % 2 ? T / 2 : T / 4), py, 1, T / 2, [0, 0, 0], 0.12);
                rect(px + (ty % 2 ? T / 4 : T / 2), py + T / 2, 1, T / 2, [0, 0, 0], 0.12);
                break;
        }
    }
}

export { BIOME_COLOR };
