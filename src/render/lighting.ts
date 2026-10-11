// @ts-nocheck -- Pixi-bound renderer helper
// Screen-space light map: an ambient colour plus additive light blobs, multiplied over the world.
// Used for caves and ruins (dark), and to give spells, torches and crystals a glow.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';

const TILT = WORLD_CONFIG.tilt;
const SCALE = 0.5;              // light map resolution relative to the screen
const MAX_LIGHTS = 140;

export interface Light { x: number; y: number; z?: number; r: number; color: number; i?: number }

// light emitted by decor types: radius (world px), colour, height above ground
export const DECOR_LIGHTS: Record<string, { r: number; color: number | number[]; z: number; i?: number }> = {
    torch: { r: 230, color: 0xffa24a, z: 46, i: 1 },
    lamp: { r: 210, color: 0xffd38a, z: 66, i: 0.9 },
    crystal: { r: 150, color: [0x5ad0ff, 0xc07aff, 0xff7ab0], z: 20, i: 0.85 },
    glowshroom: { r: 95, color: 0x5affc8, z: 10, i: 0.7 },
    portal: { r: 260, color: 0x7ad8ff, z: 40, i: 1 },
    altar: { r: 170, color: 0xc8a0ff, z: 30, i: 0.8 },
    fountain: { r: 150, color: 0x9adfff, z: 20, i: 0.6 },
    tower_spire: { r: 230, color: 0x7ab4ff, z: 160, i: 0.8 },
    tower_ward: { r: 240, color: 0xffe27a, z: 160, i: 0.8 },
    tower_beacon: { r: 400, color: 0xffa24a, z: 120, i: 1 },
    tower_waypoint: { r: 240, color: 0xb06af0, z: 60, i: 0.9 },
    tower_dock: { r: 200, color: 0xffd38a, z: 76, i: 0.8 }
};

function glowTexture(): PIXI.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return PIXI.Texture.from(c);
}

export class Lighting {
    constructor(app, stage) {
        this.app = app;
        this.ambient = 0xffffff;
        this.target = 0xffffff;
        this.cur = [255, 255, 255];
        this.enabled = false;
        this.lights = [];
        this.tex = glowTexture();
        this.scene = new PIXI.Container();
        this.bg = new PIXI.Sprite(PIXI.Texture.WHITE);
        this.scene.addChild(this.bg);
        this.pool = [];
        this.rt = PIXI.RenderTexture.create({ width: 16, height: 16 });
        this.sprite = new PIXI.Sprite(this.rt);
        this.sprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        this.sprite.eventMode = 'none';
        this.sprite.zIndex = 8;
        this.sprite.visible = false;
        stage.addChild(this.sprite);
        this.resize();
    }

    resize() {
        const { width, height } = this.app.screen;
        this.rt.resize(Math.max(16, Math.ceil(width * SCALE)), Math.max(16, Math.ceil(height * SCALE)));
        this.sprite.scale.set(1 / SCALE);
        this.bg.width = this.rt.width;
        this.bg.height = this.rt.height;
    }

    /** ambient: 0xffffff means fully lit (light map off). `instant` skips the fade (scene changes). */
    setAmbient(color: number, instant = true) {
        this.target = color;
        if (instant) this.cur = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
        this.apply();
    }

    apply() {
        const [r, g, b] = this.cur;
        this.ambient = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
        this.enabled = r < 253 || g < 253 || b < 253;
        this.sprite.visible = this.enabled;
    }

    /** ease the ambient colour toward its target (regions blend into each other) */
    fade(delta: number) {
        const t = this.target ?? 0xffffff;
        const goal = [(t >> 16) & 255, (t >> 8) & 255, t & 255];
        const k = 1 - Math.pow(0.97, delta);
        let moved = false;
        for (let i = 0; i < 3; i++) {
            const d = goal[i] - this.cur[i];
            if (Math.abs(d) > 0.3) { this.cur[i] += d * k; moved = true; } else this.cur[i] = goal[i];
        }
        if (moved) this.apply();
    }

    add(l: Light) { if (this.enabled && this.lights.length < MAX_LIGHTS) this.lights.push(l); }

    render(worldContainer) {
        if (!this.enabled) { this.lights.length = 0; return; }
        this.bg.tint = this.ambient;
        const ox = worldContainer.x, oy = worldContainer.y;
        const w = this.rt.width / SCALE, h = this.rt.height / SCALE;
        let n = 0;
        for (const l of this.lights) {
            const sx = l.x + ox, sy = l.y * TILT - (l.z || 0) + oy;
            if (sx < -l.r || sy < -l.r || sx > w + l.r || sy > h + l.r) continue;
            let s = this.pool[n];
            if (!s) {
                s = new PIXI.Sprite(this.tex);
                s.anchor.set(0.5);
                s.blendMode = PIXI.BLEND_MODES.ADD;
                this.pool.push(s);
                this.scene.addChild(s);
            }
            s.visible = true;
            s.position.set(sx * SCALE, sy * SCALE);
            s.width = l.r * 2 * SCALE;
            s.height = l.r * 2 * SCALE * 0.82;
            s.tint = l.color;
            s.alpha = Math.min(1, l.i ?? 1);
            n++;
        }
        for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
        this.app.renderer.render(this.scene, { renderTexture: this.rt, clear: true });
        this.lights.length = 0;
    }
}
