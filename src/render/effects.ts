// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
import { access } from '../app/access';
import { WORLD_CONFIG } from '../core/config';

const TILT = WORLD_CONFIG.tilt;
const MAX_PARTICLES = 450;

// Particles, floating damage numbers and camera shake.
// Everything is updated from the game loop so it respects pause / level-up.
export class Effects {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.popups = [];
        this.popupPool = [];
        this.shake = 0;

        const g = new PIXI.Graphics();
        g.beginFill(0xffffff);
        g.drawCircle(4, 4, 4);
        g.endFill();
        this.dot = game.app.renderer.generateTexture(g, { resolution: 2 });
        g.destroy();
        // soft additive spark for magical particles
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const ctx = c.getContext('2d');
        const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.35, 'rgba(255,255,255,0.8)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, 32, 32);
        this.spark = PIXI.Texture.from(c);
        this.flashes = [];
        this.waves = [];      // expanding ground rings
        this.pillars = [];    // vertical beams of light
        this.streaks = [];    // fading lines (blink trails)
        // vertical beam texture
        const bc = document.createElement('canvas');
        bc.width = 32; bc.height = 128;
        const bctx = bc.getContext('2d');
        const vg = bctx.createLinearGradient(0, 0, 0, 128);
        vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(0.6, 'rgba(255,255,255,0.55)'); vg.addColorStop(1, 'rgba(255,255,255,0.95)');
        bctx.fillStyle = vg; bctx.fillRect(0, 0, 32, 128);
        const hg = bctx.createLinearGradient(0, 0, 32, 0);
        hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
        bctx.globalCompositeOperation = 'destination-out'; bctx.fillStyle = hg; bctx.fillRect(0, 0, 32, 128);
        this.beam = PIXI.Texture.from(bc);
    }

    /** an expanding ring on the ground (impacts, novas, blinks) */
    shockwave(x, y, radius, color = 0xffffff, life = 22, width = 5) {
        if (this.waves.length > 30) return;
        const g = new PIXI.Graphics();
        g.blendMode = PIXI.BLEND_MODES.ADD;
        this.game.groundLayer.addChild(g);
        this.waves.push({ g, x, y, radius, color, life, max: life, width });
    }

    /** a column of light rising from the ground (level up, revive, arrival) */
    pillar(x, y, color = 0xffe27a, life = 50, width = 60, height = 220) {
        if (this.pillars.length > 10) return;
        const s = new PIXI.Sprite(this.beam);
        s.anchor.set(0.5, 1);
        s.tint = color;
        s.blendMode = PIXI.BLEND_MODES.ADD;
        s.width = width; s.height = height;
        s.position.set(x, y * TILT);
        s.zIndex = y + 2;
        this.game.objectLayer.addChild(s);
        this.pillars.push({ s, life, max: life, width });
        this.flash(x, y, width * 3, color, life * 0.6, 40);
    }

    /** a fading line between two ground points (z = height above ground) */
    streak(x1, y1, x2, y2, color, z = 24, life = 16, width = 10) {
        if (this.streaks.length > 20) return;
        const g = new PIXI.Graphics();
        g.blendMode = PIXI.BLEND_MODES.ADD;
        g.zIndex = Math.max(y1, y2) + 1;
        this.game.objectLayer.addChild(g);
        this.streaks.push({ g, x1, y1, x2, y2, z, color, life, max: life, width });
    }

    /** a short burst of light (only visible where the light map is active) */
    flash(x, y, r, color, life = 14, z = 20) {
        if (this.flashes.length < 40) this.flashes.push({ x, y, z, r, color, life, max: life });
    }

    emitLights(L) {
        for (const f of this.flashes) L.add({ x: f.x, y: f.y, z: f.z, r: f.r * (0.6 + 0.4 * f.life / f.max), color: f.color, i: f.life / f.max });
    }

    burst(x, y, z, color, count, speed, opts = {}) {
        if (access.reducedMotion) count = Math.ceil(count * 0.5);
        const { size = 1, life = 30, gravity = 0.22, up = 2.5, glow = false } = opts;
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= MAX_PARTICLES) return;
            const s = new PIXI.Sprite(glow ? this.spark : this.dot);
            if (glow) s.blendMode = PIXI.BLEND_MODES.ADD;
            s.anchor.set(0.5);
            s.tint = color;
            const a = Math.random() * Math.PI * 2;
            const v = speed * (0.4 + Math.random() * 0.6);
            const p = {
                s, wx: x, wy: y, z,
                vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, vz: up * (0.5 + Math.random()),
                life, max: life * (0.7 + Math.random() * 0.6), gravity,
                scale: size * (0.5 + Math.random() * 0.8) * (glow ? 0.75 : 1)
            };
            p.life = p.max;
            s.scale.set(p.scale);
            this.game.objectLayer.addChild(s);
            this.particles.push(p);
        }
    }

    hit(x, y, color = 0xffee88) {
        this.burst(x, y, 20, color, 6, 2.4, { size: 0.7, life: 18, gravity: 0.15, up: 1.2, glow: true });
        this.flash(x, y, 70, color, 8);
    }

    death(x, y, color = 0xff5a5a, big = false) {
        this.burst(x, y, 12, color, big ? 40 : 14, big ? 5 : 3.2, { size: big ? 1.1 : 0.85, life: 34, up: 3 });
        this.burst(x, y, 12, 0xffffff, big ? 14 : 5, 2.2, { size: 0.7, life: 20, up: 2, glow: true });
        // a dark puff of smoke and a scorch of light
        this.burst(x, y, 8, 0x2a2430, big ? 10 : 4, 1, { size: big ? 1.6 : 1.1, life: 40, up: 1.4, gravity: -0.02 });
        this.flash(x, y, big ? 240 : 110, color, big ? 30 : 14);
    }

    popup(x, y, text, color = 0xffffff, size = 16, z = 34) {
        if (this.popups.length > 60) return;
        let t = this.popupPool.pop();
        if (!t) {
            t = new PIXI.Text('', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: 16,
                fill: 0xffffff,
                stroke: 0x000000,
                strokeThickness: 4,
                lineJoin: 'round'
            });
            t.anchor.set(0.5);
        }
        t.text = text;
        t.style.fill = color;
        t.style.fontSize = size;
        t.alpha = 1;
        t.scale.set(0.6);
        t.visible = true;
        this.game.occlusion.layer.addChild(t);     // above the world, the trees and the light map
        this.popups.push({ t, wx: x + (Math.random() - 0.5) * 16, wy: y, z, vz: 1.6, life: 40, target: 1 });
    }

    addShake(amount) {
        if (access.reducedMotion) return;
        this.shake = Math.min(14, Math.max(this.shake, amount));
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.wx += p.vx * delta;
            p.wy += p.vy * delta;
            p.z += p.vz * delta;
            p.vz -= p.gravity * delta;
            if (p.z < 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.7; p.vy *= 0.7; }
            p.life -= delta;
            if (p.life <= 0) {
                p.s.destroy();
                this.particles.splice(i, 1);
                continue;
            }
            p.s.position.set(p.wx, p.wy * TILT - p.z);
            p.s.zIndex = p.wy + 1;
            p.s.alpha = Math.min(1, p.life / (p.max * 0.5));
        }

        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.life -= delta;
            p.z += p.vz * delta;
            p.vz *= 0.94;
            p.t.position.set(p.wx, p.wy * TILT - p.z);
            p.t.scale.set(Math.min(1, p.t.scale.x + 0.15 * delta));
            if (p.life < 14) p.t.alpha = Math.max(0, p.life / 14);
            if (p.life <= 0) {
                p.t.visible = false;
                p.t.parent?.removeChild(p.t);
                this.popupPool.push(p.t);
                this.popups.splice(i, 1);
            }
        }

        for (let i = this.waves.length - 1; i >= 0; i--) {
            const w = this.waves[i];
            w.life -= delta;
            const k = 1 - w.life / w.max, a = Math.max(0, w.life / w.max);
            const r = w.radius * (0.15 + 0.85 * (1 - Math.pow(1 - k, 3)));
            w.g.clear();
            w.g.lineStyle(w.width * a + 1, w.color, 0.85 * a);
            w.g.drawCircle(w.x, w.y, r);
            w.g.lineStyle(w.width * 2.4 * a, w.color, 0.18 * a);
            w.g.drawCircle(w.x, w.y, r * 0.94);
            if (w.life <= 0) { w.g.destroy(); this.waves.splice(i, 1); }
        }
        for (let i = this.pillars.length - 1; i >= 0; i--) {
            const pl = this.pillars[i];
            pl.life -= delta;
            const a = Math.max(0, pl.life / pl.max);
            pl.s.alpha = Math.min(1, a * 1.6);
            pl.s.width = pl.width * (0.5 + 0.5 * a);
            if (pl.life <= 0) { pl.s.destroy(); this.pillars.splice(i, 1); }
        }
        for (let i = this.streaks.length - 1; i >= 0; i--) {
            const st = this.streaks[i];
            st.life -= delta;
            const a = Math.max(0, st.life / st.max);
            const ax = st.x1, ay = st.y1 * TILT - st.z, bx = st.x2, by = st.y2 * TILT - st.z;
            st.g.clear();
            st.g.lineStyle(st.width * a + 1, st.color, 0.35 * a); st.g.moveTo(ax, ay); st.g.lineTo(bx, by);
            st.g.lineStyle(st.width * 0.35 * a + 0.5, 0xffffff, 0.8 * a); st.g.moveTo(ax, ay); st.g.lineTo(bx, by);
            if (st.life <= 0) { st.g.destroy(); this.streaks.splice(i, 1); }
        }
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.life -= delta;
            if (f.life <= 0) this.flashes.splice(i, 1);
        }

        this.shake *= Math.pow(0.86, delta);
        if (this.shake < 0.2) this.shake = 0;
    }

    clear() {
        this.particles.forEach((p) => p.s.destroy());
        this.particles.length = 0;
        this.popups.forEach((p) => {
            p.t.visible = false;
            if (p.t.parent) p.t.parent.removeChild(p.t);
            this.popupPool.push(p.t);
        });
        this.popups.length = 0;
        this.flashes.length = 0;
        this.waves.forEach((w) => w.g.destroy()); this.waves.length = 0;
        this.pillars.forEach((p) => p.s.destroy()); this.pillars.length = 0;
        this.streaks.forEach((st) => st.g.destroy()); this.streaks.length = 0;
        this.shake = 0;
    }
}
