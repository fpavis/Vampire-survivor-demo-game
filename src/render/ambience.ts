// @ts-nocheck -- Pixi-bound renderer helper
// Ambient particles that give each region a mood: falling leaves, pollen, blowing dust, snow, cave motes, ash.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';

const TILT = WORLD_CONFIG.tilt;
const MAX = 70;

interface Style {
    count: number; colors: number[]; size: [number, number]; vx: [number, number]; vy: [number, number];
    fall: number; spin: number; glow: boolean; shape: 'leaf' | 'dot' | 'streak'; alpha: number; sway: number;
}

const STYLES: Record<string, Style> = {
    forest: { count: 26, colors: [0x6aa84a, 0x8ab84a, 0xc8a040, 0xb86a2a], size: [3, 5], vx: [-0.25, 0.35], vy: [-0.1, 0.15], fall: 0.45, spin: 0.06, glow: false, shape: 'leaf', alpha: 0.9, sway: 0.6 },
    field: { count: 22, colors: [0xfff8e0, 0xf0f8c0], size: [1.5, 2.5], vx: [0.1, 0.45], vy: [-0.1, 0.1], fall: 0.05, spin: 0, glow: true, shape: 'dot', alpha: 0.7, sway: 0.5 },
    desert: { count: 34, colors: [0xe8c890, 0xd8b070], size: [2, 3], vx: [1.6, 3.2], vy: [-0.05, 0.1], fall: 0.02, spin: 0, glow: false, shape: 'streak', alpha: 0.45, sway: 0.1 },
    shore: { count: 16, colors: [0xffffff, 0xe0f4ff], size: [1.5, 2.5], vx: [0.4, 0.9], vy: [-0.05, 0.05], fall: 0.0, spin: 0, glow: true, shape: 'dot', alpha: 0.45, sway: 0.4 },
    mountain: { count: 44, colors: [0xffffff, 0xeef4ff], size: [1.8, 3.2], vx: [0.2, 0.6], vy: [0, 0.1], fall: 0.7, spin: 0, glow: false, shape: 'dot', alpha: 0.9, sway: 0.5 },
    cave: { count: 30, colors: [0xbfe8ff, 0xd8c8ff, 0xfff0c0], size: [1.2, 2.2], vx: [-0.12, 0.12], vy: [-0.1, 0.1], fall: -0.05, spin: 0, glow: true, shape: 'dot', alpha: 0.75, sway: 0.4 },
    ruins: { count: 22, colors: [0xffb060, 0xff8a3a], size: [1.2, 2], vx: [-0.1, 0.15], vy: [-0.1, 0.05], fall: -0.25, spin: 0, glow: true, shape: 'dot', alpha: 0.8, sway: 0.7 },
    city: { count: 0, colors: [0xffffff], size: [1, 1], vx: [0, 0], vy: [0, 0], fall: 0, spin: 0, glow: false, shape: 'dot', alpha: 0, sway: 0 },
    ash: { count: 40, colors: [0x5a5058, 0x8a8088, 0xff7a3a], size: [1.5, 3], vx: [0.1, 0.5], vy: [0, 0.1], fall: 0.35, spin: 0.04, glow: false, shape: 'leaf', alpha: 0.75, sway: 0.4 }
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambience {
    constructor(app, stage) {
        this.app = app;
        this.layer = new PIXI.Container();
        this.layer.zIndex = 8.5;   // above the light map so motes and snow stay visible in the dark
        this.layer.eventMode = 'none';
        stage.addChild(this.layer);
        this.parts = [];
        this.style = null;
        this.key = '';
        const mk = (draw) => { const g = new PIXI.Graphics(); draw(g); const t = app.renderer.generateTexture(g, { resolution: 2 }); g.destroy(); return t; };
        this.tex = {
            dot: mk((g) => { g.beginFill(0xffffff); g.drawCircle(4, 4, 4); g.endFill(); }),
            leaf: mk((g) => { g.beginFill(0xffffff); g.drawEllipse(5, 3, 5, 2.6); g.endFill(); }),
            streak: mk((g) => { g.beginFill(0xffffff); g.drawRoundedRect(0, 0, 18, 3, 1.5); g.endFill(); })
        };
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const ctx = c.getContext('2d');
        const gr = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, 16, 16);
        this.tex.glow = PIXI.Texture.from(c);
    }

    /** region: overworld group or interior type; ash: dangerous far regions add falling ash */
    setRegion(region: string, ash = false) {
        const key = ash ? 'ash' : region;
        if (key === this.key) return;
        this.key = key;
        this.style = STYLES[key] || null;
    }

    clear() {
        this.parts.forEach((p) => p.s.destroy());
        this.parts = [];
    }

    spawn(cam, w, h, anywhere) {
        const st = this.style;
        const s = new PIXI.Sprite(st.glow ? this.tex.glow : this.tex[st.shape]);
        s.anchor.set(0.5);
        if (st.glow) s.blendMode = PIXI.BLEND_MODES.ADD;
        s.tint = st.colors[(Math.random() * st.colors.length) | 0];
        const size = rnd(st.size[0], st.size[1]);
        s.scale.set(st.glow ? size / 4 : size / 4);
        const vw = w, vh = h / TILT;
        const p = {
            s, x: cam.x + rnd(-vw * 0.6, vw * 0.6), y: cam.y + rnd(-vh * 0.6, vh * 0.6), z: rnd(20, 220),
            vx: rnd(st.vx[0], st.vx[1]), vy: rnd(st.vy[0], st.vy[1]), vz: -st.fall * rnd(0.6, 1.3),
            rot: Math.random() * 6.28, spin: rnd(-st.spin, st.spin), phase: Math.random() * 6.28,
            life: rnd(240, 600), age: 0, alpha: st.alpha * rnd(0.6, 1)
        };
        if (!anywhere) {
            // enter from the upwind edge for drifting styles
            if (st.vx[0] > 1) p.x = cam.x - vw * 0.6;
        }
        this.layer.addChild(s);
        this.parts.push(p);
    }

    update(delta, cam, world) {
        this.layer.visible = this.enabled !== false;
        if (this.enabled === false) return;
        const { width: w, height: h } = this.app.screen;
        const st = this.style;
        this.layer.position.set(world.x, world.y);
        this.layer.scale.set(world.scale.x, world.scale.y);     // follow the camera zoom too
        const want = st ? Math.min(MAX, st.count) : 0;
        while (this.parts.length < want) this.spawn(cam, w, h, this.parts.length < want * 0.6);
        const vw = w * 0.65, vh = (h / TILT) * 0.65;
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.age += delta;
            const sway = st ? st.sway : 0;
            p.x += (p.vx + Math.sin(p.age * 0.03 + p.phase) * sway * 0.3) * delta;
            p.y += p.vy * delta;
            p.z += p.vz * delta;
            p.rot += p.spin * delta;
            const fadeIn = Math.min(1, p.age / 30), fadeOut = Math.min(1, (p.life - p.age) / 40);
            p.s.alpha = p.alpha * Math.max(0, Math.min(fadeIn, fadeOut));
            p.s.rotation = p.rot;
            if (st && st.shape === 'leaf') p.s.scale.y = Math.abs(Math.sin(p.age * 0.05 + p.phase)) * 0.6 + 0.2;
            p.s.position.set(p.x, p.y * TILT - p.z);
            const off = Math.abs(p.x - cam.x) > vw || Math.abs(p.y - cam.y) > vh;
            if (p.age >= p.life || p.z < -10 || p.z > 400 || off || this.parts.length > want) {
                p.s.destroy();
                this.parts.splice(i, 1);
            }
        }
    }
}
