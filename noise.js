// Deterministic hash + value noise helpers shared by terrain and interior generation.

export function hash(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export const smooth = (t) => t * t * (3 - 2 * t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function valueNoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
    const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

export function fbm(x, y, seed, octaves = 4) {
    let sum = 0, amp = 1, norm = 0, freq = 1;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 101) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
}

// small seeded PRNG (mulberry32) for interior generators
export function makeRng(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
