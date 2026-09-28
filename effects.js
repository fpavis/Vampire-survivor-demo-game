import { WORLD_CONFIG } from './config.js';

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
    }

    burst(x, y, z, color, count, speed, opts = {}) {
        const { size = 1, life = 30, gravity = 0.22, up = 2.5 } = opts;
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= MAX_PARTICLES) return;
            const s = new PIXI.Sprite(this.dot);
            s.anchor.set(0.5);
            s.tint = color;
            const a = Math.random() * Math.PI * 2;
            const v = speed * (0.4 + Math.random() * 0.6);
            const p = {
                s, wx: x, wy: y, z,
                vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, vz: up * (0.5 + Math.random()),
                life, max: life * (0.7 + Math.random() * 0.6), gravity,
                scale: size * (0.5 + Math.random() * 0.8)
            };
            p.life = p.max;
            s.scale.set(p.scale);
            this.game.objectLayer.addChild(s);
            this.particles.push(p);
        }
    }

    hit(x, y) {
        this.burst(x, y, 20, 0xffee88, 6, 2.4, { size: 0.55, life: 18, gravity: 0.15, up: 1.2 });
    }

    death(x, y, color = 0xff5a5a, big = false) {
        this.burst(x, y, 12, color, big ? 40 : 14, big ? 5 : 3.2, { size: big ? 1.1 : 0.85, life: 34, up: 3 });
        this.burst(x, y, 12, 0xffffff, big ? 12 : 4, 2, { size: 0.5, life: 20, up: 2 });
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
        t.zIndex = 1e9;
        this.game.objectLayer.addChild(t);
        this.popups.push({ t, wx: x + (Math.random() - 0.5) * 16, wy: y, z, vz: 1.6, life: 40, target: 1 });
    }

    addShake(amount) {
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
                this.game.objectLayer.removeChild(p.t);
                this.popupPool.push(p.t);
                this.popups.splice(i, 1);
            }
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
        this.shake = 0;
    }
}
