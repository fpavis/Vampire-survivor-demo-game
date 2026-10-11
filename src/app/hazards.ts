// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { EntityManager } from '../render/entities';

const TILT = WORLD_CONFIG.tilt;

// Things enemies throw at the player: projectiles, lobbed boulders and ground slams.
export class Hazards {
    constructor(game) {
        this.game = game;
        this.shots = [];
        this.lobs = [];
        this.slams = [];
    }

    reset() {
        this.shots.forEach((s) => EntityManager.cleanup(s.sprite));
        this.lobs.forEach((l) => { l.tele.destroy(); EntityManager.cleanup(l.rock); });
        this.slams.forEach((s) => s.g.destroy());
        this.shots = [];
        this.lobs = [];
        this.slams = [];
    }

    shot(x, y, angle, speed, damage, opts = {}) {
        const { color = 0xff6a4a, effect = null, life = 170, radius = 7 } = opts;
        const sprite = EntityManager.createBolt(x, y, angle, color);
        const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
        sprite.getChildAt(1).getChildAt(0).rotation = Math.atan2(vy * TILT, vx);
        this.game.objectLayer.addChild(sprite);
        EntityManager.place(sprite);
        this.shots.push({ sprite, vx, vy, damage, effect, life, radius, color, phase: !!opts.phase });
    }

    // lobbed boulder: lands on (tx, ty) after `flight` frames and damages everything in `radius`
    lob(x, y, tx, ty, flight, radius, damage, opts = {}) {
        const game = this.game;
        const tele = new PIXI.Graphics();
        game.groundLayer.addChild(tele);
        const rock = new PIXI.Container();
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.3); shadow.drawEllipse(0, 0, 12, 5); shadow.endFill();
        const body = new PIXI.Graphics();
        body.beginFill(0x4a4e58); body.drawCircle(0, 0, 14); body.endFill();
        body.beginFill(0x8a8e9a); body.drawCircle(-4, -4, 8); body.endFill();
        rock.addChild(shadow, body);
        rock.body = body;
        rock.shadowG = shadow;
        game.objectLayer.addChild(rock);
        this.lobs.push({ x0: x, y0: y, tx, ty, t: 0, flight, radius, damage, tele, rock, color: opts.color || 0xff8a3a });
    }

    slam(x, y, radius, delay, damage, opts = {}) {
        const g = new PIXI.Graphics();
        this.game.groundLayer.addChild(g);
        this.slams.push({ x, y, radius, delay, t: 0, damage, g, color: opts.color || 0xff3030 });
    }

    hitPlayerIfInside(x, y, radius, damage) {
        const p = this.game.state.player;
        const rr = radius + p.radius;
        if ((p.wx - x) ** 2 + (p.wy - y) ** 2 <= rr * rr) {
            this.game.hurtPlayer(damage, true);
            return true;
        }
        return false;
    }

    explode(x, y, radius, damage, color) {
        const game = this.game;
        game.fx.burst(x, y, 6, color, 26, 4.5, { size: 1.1, life: 32, up: 3.5 });
        game.fx.burst(x, y, 6, 0x444444, 8, 2, { size: 1.2, life: 40, up: 2, gravity: 0.05 });
        game.fx.addShake(5);
        const flash = new PIXI.Graphics();
        flash.beginFill(color, 0.45); flash.drawCircle(x, y, radius); flash.endFill();
        flash.blendMode = PIXI.BLEND_MODES.ADD;
        game.groundLayer.addChild(flash);
        game.spells.decals.push({ g: flash, life: 12, max: 12 });
        this.hitPlayerIfInside(x, y, radius, damage);
    }

    update(delta) {
        const game = this.game;
        const p = game.state.player;

        for (let i = this.shots.length - 1; i >= 0; i--) {
            const s = this.shots[i];
            const sp = s.sprite;
            sp.wx += s.vx * delta;
            sp.wy += s.vy * delta;
            s.life -= delta;
            EntityManager.place(sp);
            let remove = s.life <= 0;
            if (!remove && !s.phase && game.world.tileBlocked(Math.floor(sp.wx / WORLD_CONFIG.tile), Math.floor(sp.wy / WORLD_CONFIG.tile))) remove = true;
            if (!remove) {
                const rr = s.radius + p.radius;
                if ((p.wx - sp.wx) ** 2 + (p.wy - sp.wy) ** 2 < rr * rr) {
                    game.hurtPlayer(s.damage, true);
                    if (s.effect === 'web') game.slowPlayer(100, 0.5);
                    game.fx.burst(sp.wx, sp.wy, 20, s.color, 6, 2, { size: 0.6, life: 16 });
                    remove = true;
                }
            }
            if (remove) { EntityManager.cleanup(sp); this.shots.splice(i, 1); }
        }

        for (let i = this.lobs.length - 1; i >= 0; i--) {
            const l = this.lobs[i];
            l.t += delta;
            const k = Math.min(1, l.t / l.flight);
            const wx = l.x0 + (l.tx - l.x0) * k, wy = l.y0 + (l.ty - l.y0) * k;
            const z = Math.sin(Math.PI * k) * 150;
            l.rock.position.set(wx, wy * TILT - z - 6);
            l.rock.zIndex = wy;
            l.rock.body.rotation += 0.2 * delta;
            l.rock.shadowG.position.y = z + 6;
            l.tele.clear();
            l.tele.beginFill(0xff4a1a, 0.06 + 0.2 * k); l.tele.drawCircle(l.tx, l.ty, l.radius * (0.35 + 0.65 * k)); l.tele.endFill();
            l.tele.lineStyle(3, 0xff8a3a, 0.45 + 0.4 * Math.sin(l.t * 0.5)); l.tele.drawCircle(l.tx, l.ty, l.radius);
            if (l.t >= l.flight) {
                this.explode(l.tx, l.ty, l.radius, l.damage, l.color);
                l.tele.destroy();
                EntityManager.cleanup(l.rock);
                this.lobs.splice(i, 1);
            }
        }

        for (let i = this.slams.length - 1; i >= 0; i--) {
            const s = this.slams[i];
            s.t += delta;
            const k = Math.min(1, s.t / s.delay);
            s.g.clear();
            s.g.beginFill(s.color, 0.06 + 0.2 * k); s.g.drawCircle(s.x, s.y, s.radius * (0.3 + 0.7 * k)); s.g.endFill();
            s.g.lineStyle(3, s.color, 0.3 + 0.5 * k); s.g.drawCircle(s.x, s.y, s.radius);
            if (s.t >= s.delay) {
                this.explode(s.x, s.y, s.radius, s.damage, s.color);
                s.g.destroy();
                this.slams.splice(i, 1);
            }
        }
    }
}
