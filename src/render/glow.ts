// @ts-nocheck -- Pixi-bound renderer helper
// A soft radial glow sprite (additive). Replaces flat translucent discs so halos fade out smoothly.
import * as PIXI from 'pixi.js';

let tex: PIXI.Texture | null = null;
function glowTex() {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex = PIXI.Texture.from(c);
    return tex;
}

/** radius: visible radius in px; alpha multiplies the core brightness */
export function softGlow(radius: number, color: number, alpha = 0.5): PIXI.Sprite {
    const s = new PIXI.Sprite(glowTex());
    s.anchor.set(0.5);
    s.width = s.height = radius * 2.4;
    s.tint = color;
    s.alpha = Math.min(1, alpha * 1.6);
    s.blendMode = PIXI.BLEND_MODES.ADD;
    return s;
}
