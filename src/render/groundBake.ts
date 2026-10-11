// @ts-nocheck -- Pixi-bound renderer helper
// Bakes one chunk of ground into a texture: organic biome borders (noise-jittered tile lookups), soft macro
// lighting, per-biome micro texture, grass rims, earthen banks above water, shore foam and water depth.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { valueNoise } from '../core/world/noise';
import { BIOME, BIOME_COLOR } from '../core/world/biomes';
import { SURFACES, SURFACE_IDS } from '../core/world/surfaces';

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
[BIOME.CITY_FLOOR, BIOME.RUIN_FLOOR, BIOME.CITY_STONE, BIOME.CITY_WALL, BIOME.RUIN_WALL, BIOME.VOID].forEach((b) => { GEO[b] = 1; });
const WAT = new Uint8Array(32);
WAT[BIOME.DEEP] = 1; WAT[BIOME.SHALLOW] = 1;
// draw order for rims: higher layers get a darker edge where they meet lower ones
const LAYER = new Uint8Array(32);
[[BIOME.DEEP, 0], [BIOME.SHALLOW, 0], [BIOME.SAND, 1], [BIOME.DRY, 1], [BIOME.CAVE_FLOOR, 1], [BIOME.HILL, 2],
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
                if (sf === 1) {          // lava: dark crust with glowing cracks
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
    return PIXI.Texture.fromBuffer(data, N, N, { scaleMode: PIXI.SCALE_MODES.LINEAR });
}

export { BIOME_COLOR };
