// A soft radial glow sprite (additive). Replaces flat translucent discs so halos fade out smoothly.
// The texture is premultiplied white with zero alpha: drawn with the normal blend it adds its colour (tinted), so
// glows batch with the sprites around them instead of switching to the additive blend mode.
import * as PIXI from 'pixi.js';

const STOPS = [[0, 1], [0.3, 0.7], [0.65, 0.22], [1, 0]];
let tex: PIXI.Texture | null = null;
function glowTex() {
    if (tex) return tex;
    const N = 64, data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = Math.min(1, Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2));
        let k = 1;
        while (k < STOPS.length - 1 && STOPS[k][0] < d) k++;
        const [d0, a0] = STOPS[k - 1], [d1, a1] = STOPS[k];
        const v = Math.round(255 * (a0 + (a1 - a0) * (d - d0) / (d1 - d0)));
        const i = (y * N + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;              // alpha stays 0
    }
    tex = PIXI.Texture.fromBuffer(data, N, N, { alphaMode: PIXI.ALPHA_MODES.PMA });
    return tex;
}

/** radius: visible radius in px; alpha multiplies the core brightness */
export function softGlow(radius: number, color: number, alpha = 0.5): PIXI.Sprite {
    const s = new PIXI.Sprite(glowTex());
    s.anchor.set(0.5);
    s.width = s.height = radius * 2.4;
    s.tint = color;
    s.alpha = Math.min(1, alpha * 1.6);
    return s;
}
