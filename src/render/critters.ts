// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
// Harmless ambient wildlife (and town villagers). Purely cosmetic: they wander, graze and flee from the player.
import { WORLD_CONFIG } from '../core/config';
import { EntityManager } from './entities';
import { isSolidBiome, isWaterBiome, GROUP } from '../core/world/biomes';
import { shade } from './decorArt';

const rnd = (a, b) => a + Math.random() * (b - a);
const ell = (g, x, y, rx, ry, c, a = 1) => { g.beginFill(c, a); g.drawEllipse(x, y, rx, ry); g.endFill(); };
const circ = (g, x, y, r, c, a = 1) => { g.beginFill(c, a); g.drawCircle(x, y, r); g.endFill(); };
const poly = (g, pts, c, a = 1) => { g.beginFill(c, a); g.drawPolygon(pts); g.endFill(); };

function shadowOf(rx, ry) {
    const s = new PIXI.Graphics();
    s.beginFill(0x000000, 0.28); s.drawEllipse(0, 0, rx, ry); s.endFill();
    return s;
}

const ART = {
    rabbit(body) {
        const g = new PIXI.Graphics();
        ell(g, 0, -7, 8, 6, 0xd8cbb8); ell(g, -1, -8, 7, 5, 0xeee4d4);
        circ(g, 7, -10, 4.5, 0xeee4d4);
        poly(g, [5, -13, 6, -24, 9, -13], 0xeee4d4); poly(g, [8, -13, 11, -22, 11, -12], 0xd8cbb8);
        poly(g, [6, -14, 7, -21, 8.5, -14], 0xffb0b8, 0.8);
        circ(g, 9, -11, 1, 0x1a1a1a); circ(g, -9, -8, 3, 0xffffff);
        body.addChild(g);
        return { hop: true };
    },
    butterfly(body) {
        const hover = new PIXI.Container(); hover.y = -26;
        const wl = new PIXI.Graphics(), wr = new PIXI.Graphics();
        const col = [0xff8ad0, 0xffd84a, 0x8ad0ff, 0xb48aff][Math.floor(Math.random() * 4)];
        ell(wl, -5, 0, 6, 8, col); ell(wr, 5, 0, 6, 8, col);
        circ(wl, -6, 2, 2, 0xffffff, 0.7); circ(wr, 6, 2, 2, 0xffffff, 0.7);
        const g = new PIXI.Graphics(); ell(g, 0, 0, 1.5, 6, 0x3a2a2a);
        hover.addChild(wl, wr, g); body.addChild(hover);
        return { flying: true, update: (c) => { const f = Math.abs(Math.sin(c.phase * 6)); wl.scale.x = wr.scale.x = 0.2 + f * 0.9; hover.y = -26 + Math.sin(c.phase * 1.5) * 4; } };
    },
    deer(body) {
        const g = new PIXI.Graphics();
        [[-9, 0], [-4, 1], [7, 0], [12, 1]].forEach(([x, y]) => { g.beginFill(0x7a5230); g.drawRect(x - 1.5, -16 + y, 3, 17); g.endFill(); });
        ell(g, 0, -20, 17, 8, 0x8a5a34); ell(g, -1, -22, 16, 6.5, 0xa87240);
        poly(g, [10, -24, 16, -38, 21, -36, 15, -22], 0xa87240);
        ell(g, 20, -38, 6, 4.5, 0xb88250); circ(g, 22, -39, 1, 0x1a1a1a);
        g.lineStyle(1.8, 0x6a4a2a); g.moveTo(18, -42); g.lineTo(17, -52); g.lineTo(13, -57); g.moveTo(17, -49); g.lineTo(21, -55); g.lineStyle(0);
        poly(g, [-16, -24, -22, -26, -17, -19], 0xffffff);
        body.addChild(g);
        return { walk: true };
    },
    fox(body) {
        const g = new PIXI.Graphics();
        [[-7, 0], [5, 0]].forEach(([x]) => { g.beginFill(0x3a2a20); g.drawRect(x - 1.5, -9, 3, 10); g.endFill(); });
        g.lineStyle(7, 0xd8642a); g.moveTo(-10, -11); g.quadraticCurveTo(-24, -14, -22, -3); g.lineStyle(0);
        circ(g, -22, -4, 3.5, 0xffffff);
        ell(g, 0, -12, 12, 6.5, 0xd8642a); ell(g, 2, -9, 8, 3, 0xffe8d0);
        circ(g, 12, -15, 5, 0xe8742e);
        poly(g, [14, -17, 24, -13, 15, -11], 0xe8742e); circ(g, 23, -13, 1.5, 0x1a1a1a);
        poly(g, [9, -19, 10, -26, 14, -19], 0x3a2a20); poly(g, [13, -19, 16, -25, 17, -18], 0x3a2a20);
        body.addChild(g);
        return { walk: true };
    },
    lizard(body) {
        const g = new PIXI.Graphics();
        g.lineStyle(2.5, 0x5a8a3a); [[-6, -2], [4, -2]].forEach(([x]) => { g.moveTo(x, -3); g.lineTo(x - 4, 1); g.moveTo(x, -3); g.lineTo(x + 4, 1); });
        g.lineStyle(4, 0x6a9a44); g.moveTo(-8, -4); g.quadraticCurveTo(-20, -2, -26, -8); g.lineStyle(0);
        ell(g, 0, -4, 10, 4, 0x6a9a44); ell(g, 10, -5, 5, 3.5, 0x7aaa50);
        circ(g, 12, -7, 1, 0x1a1a1a); circ(g, -1, -6, 2, 0xc8d070, 0.7);
        body.addChild(g);
        return { walk: true };
    },
    snake(body) {
        const g = new PIXI.Graphics();
        g.lineStyle(5, 0xa88a4a); g.moveTo(-18, -3); g.quadraticCurveTo(-10, -12, -2, -4); g.quadraticCurveTo(6, 4, 14, -6);
        g.lineStyle(2, 0x6a4a1a); g.moveTo(-14, -6); g.lineTo(-12, -2); g.moveTo(-6, -8); g.lineTo(-4, -3); g.moveTo(4, -2); g.lineTo(6, -6); g.lineStyle(0);
        circ(g, 15, -7, 4, 0xb89a54); circ(g, 17, -8, 1, 0x1a1a1a);
        g.lineStyle(1, 0xff4a4a); g.moveTo(19, -7); g.lineTo(24, -7); g.lineStyle(0);
        body.addChild(g);
        return { walk: true };
    },
    sandpiper(body) {
        const g = new PIXI.Graphics();
        g.lineStyle(1.5, 0xc89a5a); g.moveTo(-1, -9); g.lineTo(-2, 0); g.moveTo(2, -9); g.lineTo(3, 0); g.lineStyle(0);
        ell(g, 0, -13, 8, 5.5, 0x9a8a78); ell(g, 1, -11, 6, 3, 0xf0e8d8);
        circ(g, 7, -17, 3.5, 0x9a8a78); poly(g, [9, -17, 17, -16, 9, -15], 0x3a2a20);
        circ(g, 8, -18, 0.9, 0x1a1a1a); poly(g, [-8, -14, -14, -12, -8, -11], 0x7a6a58);
        body.addChild(g);
        return { walk: true };
    },
    goat(body) {
        const g = new PIXI.Graphics();
        [[-7, 0], [-3, 1], [6, 0], [10, 1]].forEach(([x, y]) => { g.beginFill(0x6a5a4a); g.drawRect(x - 1.5, -12 + y, 3, 13); g.endFill(); });
        ell(g, 0, -16, 13, 7, 0xd8d0c0); ell(g, -1, -18, 12, 5.5, 0xf0eadc);
        poly(g, [8, -19, 12, -30, 17, -28, 14, -18], 0xe8e0d0);
        ell(g, 16, -29, 5, 4, 0xf0eadc); circ(g, 18, -30, 1, 0x1a1a1a);
        g.lineStyle(2.2, 0x8a7a5a); g.moveTo(13, -33); g.quadraticCurveTo(10, -42, 17, -40); g.moveTo(16, -34); g.quadraticCurveTo(16, -42, 22, -39); g.lineStyle(0);
        poly(g, [18, -26, 20, -21, 16, -25], 0xf0eadc);
        body.addChild(g);
        return { walk: true };
    },
    villager(body, hue) {
        const robes = [0xc84a4a, 0x4a7ac8, 0x4aa86a, 0xc89a3a, 0x9a4ac8, 0x4ab8c8];
        const g = new PIXI.Graphics();
        const robe = robes[hue % robes.length];
        g.beginFill(shade(robe, 0.75)); g.drawPolygon([-8, -1, 8, -1, 6, -22, -6, -22]); g.endFill();
        g.beginFill(robe); g.drawPolygon([-8, -1, 0, -1, 0, -22, -6, -22]); g.endFill();
        circ(g, 0, -28, 6.5, 0xf0c8a0);
        ell(g, 0, -32, 7, 4, [0x4a3220, 0xd8b050, 0x2a2a2a, 0xa8481a][hue % 4]);
        circ(g, 2, -29, 1, 0x1a1a1a); circ(g, 5, -29, 1, 0x1a1a1a);
        body.addChild(g);
        return { walk: true };
    }
};

// species per region: [name, weight, speed, flee radius]
const BY_GROUP = {
    [GROUP.FIELD]: [['rabbit', 4, 1.0, 190], ['butterfly', 3, 0.9, 120]],
    [GROUP.FOREST]: [['deer', 3, 1.0, 230], ['fox', 3, 1.1, 210], ['butterfly', 1, 0.8, 120]],
    [GROUP.DESERT]: [['lizard', 4, 1.3, 170], ['snake', 3, 0.7, 150]],
    [GROUP.SHORE]: [['sandpiper', 5, 1.1, 160]],
    [GROUP.MOUNTAIN]: [['goat', 4, 0.9, 200]]
};
const SPEEDS = { rabbit: 1.0, butterfly: 0.9, deer: 1.0, fox: 1.1, lizard: 1.3, snake: 0.7, sandpiper: 1.1, goat: 0.9, villager: 0.5 };

export class Critters {
    constructor(game) {
        this.game = game;
        this.list = [];
        this.timer = 0;
    }

    reset() {
        this.list.forEach((c) => EntityManager.cleanup(c));
        this.list = [];
    }

    create(kind, x, y, extra) {
        const c = new PIXI.Container();
        const body = new PIXI.Container();
        const info = ART[kind](body, extra && extra.hue !== undefined ? extra.hue : 0) || {};
        const shadow = shadowOf(info.flying ? 6 : 11, info.flying ? 2.5 : 4);
        c.addChild(shadow, body);
        Object.assign(c, {
            kind, wx: x, wy: y, body, info, radius: 7, phase: Math.random() * 10,
            tx: x, ty: y, wait: rnd(0, 80), facing: 1, speed: SPEEDS[kind] || 1,
            flee: extra && extra.flee !== undefined ? extra.flee : 180, tame: !!(extra && extra.tame),
            home: extra && extra.home ? extra.home : null, moving: false
        });
        this.game.objectLayer.addChild(c);
        EntityManager.place(c);
        this.list.push(c);
        return c;
    }

    spawnVillager(x, y, hue) {
        return this.create('villager', x, y, { hue, tame: true, flee: 0, home: { x, y, r: 160 } });
    }

    update(delta) {
        const game = this.game;
        const p = game.state.player;
        const world = game.world;

        if (!world.bounded) {
            this.timer -= delta;
            if (this.timer <= 0) {
                this.timer = 26;
                if (this.list.length < 16) this.trySpawn();
            }
        }

        for (let i = this.list.length - 1; i >= 0; i--) {
            const c = this.list[i];
            const dx = p.wx - c.wx, dy = p.wy - c.wy;
            const d = Math.hypot(dx, dy) || 1;
            if (!c.home && d > 1400) { EntityManager.cleanup(c); this.list.splice(i, 1); continue; }

            c.phase += 0.12 * delta;
            let vx = 0, vy = 0, spd = 0;
            if (!c.tame && d < c.flee) {
                vx = -dx / d; vy = -dy / d; spd = c.speed * 2.6;
                c.wait = 0;
            } else {
                c.wait -= delta;
                const td = Math.hypot(c.tx - c.wx, c.ty - c.wy);
                if (c.wait <= 0 && td < 8) {
                    // pick a new nearby spot (or stay and graze)
                    c.wait = rnd(60, 220);
                    if (Math.random() < 0.7) {
                        const a = Math.random() * Math.PI * 2, r = rnd(40, 130);
                        const bx = c.home ? c.home.x : c.wx, by = c.home ? c.home.y : c.wy;
                        c.tx = bx + Math.cos(a) * r; c.ty = by + Math.sin(a) * r;
                        if (c.home && Math.hypot(c.tx - c.home.x, c.ty - c.home.y) > c.home.r) { c.tx = c.home.x; c.ty = c.home.y; }
                    }
                } else if (td >= 8 && c.wait <= 0 || td >= 8 && c.info.flying) {
                    vx = (c.tx - c.wx) / td; vy = (c.ty - c.wy) / td; spd = c.speed * 0.7;
                }
                if (c.info.flying && Math.random() < 0.05) { c.tx = c.wx + rnd(-90, 90); c.ty = c.wy + rnd(-90, 90); c.wait = 0; }
            }

            c.moving = spd > 0;
            if (c.moving) {
                const sx = vx * spd * delta, sy = vy * spd * delta;
                if (c.info.flying) { c.wx += sx; c.wy += sy; }
                else {
                    const ox = c.wx, oy = c.wy;
                    world.tryMove(c, sx, sy, c.radius);
                    if (isWaterBiome(world.biomeAtPos(c.wx, c.wy))) { c.wx = ox; c.wy = oy; c.wait = 0; c.tx = c.wx; c.ty = c.wy; }
                }
                if (Math.abs(vx) > 0.1) c.facing = vx > 0 ? 1 : -1;
            }
            EntityManager.place(c);
            c.body.scale.x = c.facing;
            if (c.info.hop) c.body.y = c.moving ? -Math.abs(Math.sin(c.phase * (spd > c.speed ? 2.4 : 1.6))) * 8 : 0;
            else if (c.info.walk) c.body.y = c.moving ? -Math.abs(Math.sin(c.phase * 2)) * 2 : 0;
            if (c.info.update) c.info.update(c);
        }
    }

    trySpawn() {
        const game = this.game;
        const p = game.state.player;
        for (let tries = 0; tries < 6; tries++) {
            const a = Math.random() * Math.PI * 2, r = rnd(420, 900);
            const x = p.wx + Math.cos(a) * r, y = p.wy + Math.sin(a) * r;
            const b = game.world.biomeAtPos(x, y);
            if (isSolidBiome(b) || isWaterBiome(b)) continue;
            const table = BY_GROUP[game.world.groupAtPos(x, y)];
            if (!table) continue;
            const total = table.reduce((s, t) => s + t[1], 0);
            let roll = Math.random() * total, pick = table[0];
            for (const t of table) { roll -= t[1]; if (roll <= 0) { pick = t; break; } }
            if (game.world.blocked(x, y, 9)) continue;
            const herd = pick[0] === 'butterfly' ? 3 : Math.random() < 0.3 ? 2 : 1;
            for (let k = 0; k < herd; k++) this.create(pick[0], x + rnd(-40, 40), y + rnd(-40, 40), { flee: pick[3] });
            return;
        }
    }
}
