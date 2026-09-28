import { ENEMY_TYPES, WORLD_CONFIG } from './config.js';

const TILT = WORLD_CONFIG.tilt;

// All entities are PIXI containers sitting on the ground plane:
//   wx, wy  -> position on the ground plane (logical coordinates)
//   z       -> height above the ground (screen px)
// `EntityManager.place` projects them to the screen; the container origin is the "feet".

const shade = (color, f) => {
    const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
    const b = Math.min(255, Math.round((color & 255) * f));
    return (r << 16) | (g << 8) | b;
};

function makeShadow(rx, ry, alpha = 0.35) {
    const s = new PIXI.Graphics();
    s.beginFill(0x000000, alpha);
    s.drawEllipse(0, 0, rx, ry);
    s.endFill();
    return s;
}

function glowCircle(radius, color, alpha) {
    const g = new PIXI.Graphics();
    g.beginFill(color, alpha);
    g.drawCircle(0, 0, radius);
    g.endFill();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    return g;
}

function drawHealthBar(container, width, y) {
    const bar = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.drawRoundedRect(-width / 2 - 1, -1, width + 2, 6, 3);
    bg.endFill();
    const fg = new PIXI.Graphics();
    fg.beginFill(0xffffff);
    fg.drawRoundedRect(-width / 2, 0, width, 4, 2);
    fg.endFill();
    bar.addChild(bg, fg);
    bar.y = y;
    bar.visible = false;
    container.addChild(bar);
    return { bar, fg, width };
}

export class EntityManager {
    // Project a ground-plane entity to the screen (in world-container space)
    static place(entity) {
        entity.position.set(entity.wx, entity.wy * TILT);
        entity.zIndex = entity.wy;
    }

    // ------------------------------------------------------------- player
    static createPlayer() {
        const container = new PIXI.Container();
        container.wx = 0;
        container.wy = 0;
        container.radius = 11;

        const aura = new PIXI.Graphics();
        aura.lineStyle(2, 0x6aa8ff, 0.5);
        aura.drawEllipse(0, 0, 26, 26 * TILT);
        aura.beginFill(0x6aa8ff, 0.12);
        aura.drawEllipse(0, 0, 26, 26 * TILT);
        aura.endFill();

        const body = new PIXI.Container();

        // robe
        const robe = new PIXI.Graphics();
        robe.beginFill(0x2d55b8);
        robe.drawPolygon([-13, -1, 13, -1, 8, -26, -8, -26]);
        robe.endFill();
        robe.beginFill(0x5a8cff, 0.85);
        robe.drawPolygon([-13, -1, 0, -1, 0, -26, -8, -26]);
        robe.endFill();
        robe.beginFill(0xf1c24a);
        robe.drawRect(-9, -15, 18, 3);
        robe.endFill();
        robe.beginFill(0x1a2f6b);
        robe.drawEllipse(0, -1, 13, 3);
        robe.endFill();

        // head
        const head = new PIXI.Graphics();
        head.beginFill(0xffd7b0);
        head.drawCircle(0, -32, 8);
        head.endFill();
        head.beginFill(0xe9b98c);
        head.drawEllipse(3, -30, 4, 6);
        head.endFill();
        head.beginFill(0x222222);
        head.drawCircle(2, -33, 1.4);
        head.drawCircle(6, -33, 1.4);
        head.endFill();
        // beard
        head.beginFill(0xeeeeee);
        head.drawPolygon([-6, -30, 8, -30, 2, -19]);
        head.endFill();

        // hat
        const hat = new PIXI.Graphics();
        hat.beginFill(0x1f3d8f);
        hat.drawPolygon([-9, -37, 9, -37, 3, -60, -2, -58]);
        hat.endFill();
        hat.beginFill(0x3e6ad0, 0.9);
        hat.drawPolygon([-9, -37, 0, -37, 0, -59, -2, -58]);
        hat.endFill();
        hat.beginFill(0x1f3d8f);
        hat.drawEllipse(0, -37, 14, 4);
        hat.endFill();
        hat.beginFill(0xf1c24a);
        hat.drawRect(-9, -41, 18, 3);
        hat.endFill();

        // staff
        const staff = new PIXI.Container();
        const rod = new PIXI.Graphics();
        rod.lineStyle(3, 0x6b4526);
        rod.moveTo(0, 0);
        rod.lineTo(0, -44);
        const orb = new PIXI.Graphics();
        orb.beginFill(0x7fe9ff);
        orb.drawCircle(0, -48, 5);
        orb.endFill();
        orb.beginFill(0xffffff, 0.8);
        orb.drawCircle(-1.5, -49.5, 1.8);
        orb.endFill();
        const orbGlow = glowCircle(12, 0x66ddff, 0.5);
        orbGlow.y = -48;
        staff.addChild(rod, orb, orbGlow);
        staff.x = 17;

        body.addChild(staff, robe, head, hat);
        container.addChild(makeShadow(15, 5.5, 0.4), aura, body);

        Object.assign(container, { body, aura, orbGlow, phase: 0, moving: false });
        return container;
    }

    static animatePlayer(p, t, moving, facing) {
        p.phase += moving ? 0.28 : 0.06;
        const bob = moving ? Math.abs(Math.sin(p.phase)) * -3.5 : Math.sin(p.phase) * -0.8;
        p.body.y = bob;
        p.body.rotation = moving ? Math.sin(p.phase) * 0.06 : 0;
        p.body.scale.x = facing;
        p.body.scale.y = 1 + (moving ? Math.sin(p.phase * 2) * 0.02 : Math.sin(p.phase) * 0.012);
        p.aura.scale.set(1 + Math.sin(t * 0.06) * 0.06);
        p.orbGlow.alpha = 0.7 + Math.sin(t * 0.15) * 0.3;
    }

    // ------------------------------------------------------------ enemies
    static createEnemy(typeKey, x, y) {
        const type = ENEMY_TYPES[typeKey];
        const container = new PIXI.Container();
        const r = type.radius;
        const body = new PIXI.Container();
        let height;

        switch (typeKey) {
            case 'FAST': height = 30; EntityManager.drawBat(body, type); break;
            case 'TANK': height = r * 2.6; EntityManager.drawGolem(body, type, false); break;
            case 'BOSS': height = r * 2.9; EntityManager.drawGolem(body, type, true); break;
            default: height = r * 2; EntityManager.drawSlime(body, type); break;
        }

        const shadow = makeShadow(r * 1.05, r * 0.42, 0.38);
        const marker = new PIXI.Graphics();
        container.addChild(shadow, marker, body);
        const hp = drawHealthBar(container, Math.max(26, r * 1.8), -height - (typeKey === 'FAST' ? 26 : 10));

        Object.assign(container, {
            type: typeKey,
            wx: x, wy: y, z: 0,
            radius: r,
            body, shadow, marker,
            hpBar: hp,
            health: type.health,
            maxHealth: type.health,
            speed: type.speed,
            damage: type.damage,
            experienceValue: type.experience,
            flying: type.flying,
            kvx: 0, kvy: 0,
            slowUntil: 0, slowAmount: 0,
            hitFlash: 0,
            lastOrbit: 0,
            elite: false,
            dead: false,
            phase: Math.random() * 10,
            facing: 1,
            baseHeight: height
        });
        return container;
    }

    static markElite(enemy) {
        enemy.elite = true;
        enemy.marker.clear();
        enemy.marker.lineStyle(3, 0xffd84a, 0.9);
        enemy.marker.drawEllipse(0, 0, enemy.radius * 1.35, enemy.radius * 1.35 * TILT);
        const halo = glowCircle(enemy.radius * 1.1, 0xffd84a, 0.16);
        halo.y = -enemy.baseHeight * 0.5;
        enemy.body.addChildAt(halo, 0);
        enemy.body.scale.set(1.12);
    }

    static drawSlime(body, type) {
        const r = type.radius;
        const c = type.color;
        const g = new PIXI.Graphics();
        g.beginFill(shade(c, 0.6));
        g.drawEllipse(0, -r * 0.62, r * 1.05, r * 0.78);
        g.endFill();
        g.beginFill(c);
        g.drawEllipse(-1, -r * 0.72, r * 0.98, r * 0.7);
        g.endFill();
        g.beginFill(shade(c, 1.45), 0.85);
        g.drawEllipse(-r * 0.38, -r * 1.1, r * 0.34, r * 0.2);
        g.endFill();
        // eyes
        g.beginFill(0xffffff);
        g.drawCircle(-r * 0.32, -r * 0.7, r * 0.22);
        g.drawCircle(r * 0.32, -r * 0.7, r * 0.22);
        g.endFill();
        g.beginFill(0x162016);
        g.drawCircle(-r * 0.27, -r * 0.68, r * 0.11);
        g.drawCircle(r * 0.37, -r * 0.68, r * 0.11);
        g.endFill();
        g.lineStyle(2, 0x162016);
        g.moveTo(-r * 0.2, -r * 0.34);
        g.quadraticCurveTo(0, -r * 0.2, r * 0.2, -r * 0.34);
        body.addChild(g);
        body.pivot.set(0, 0);
    }

    static drawBat(body, type) {
        const c = type.color;
        const hover = new PIXI.Container();
        hover.y = -26;
        const wingL = new PIXI.Graphics();
        const wingR = new PIXI.Graphics();
        [wingL, wingR].forEach((w, i) => {
            const s = i === 0 ? -1 : 1;
            w.beginFill(shade(c, 0.55));
            w.drawPolygon([0, 0, s * 26, -14, s * 20, -2, s * 30, 4, s * 14, 8, 0, 6]);
            w.endFill();
            w.beginFill(shade(c, 0.85), 0.8);
            w.drawPolygon([0, 0, s * 20, -10, s * 14, 0, s * 8, 4]);
            w.endFill();
        });
        const torso = new PIXI.Graphics();
        torso.beginFill(shade(c, 0.7));
        torso.drawEllipse(0, 2, 9, 11);
        torso.endFill();
        torso.beginFill(c);
        torso.drawCircle(0, -6, 8);
        torso.endFill();
        torso.beginFill(shade(c, 0.6));
        torso.drawPolygon([-7, -10, -5, -20, -1, -12]);
        torso.drawPolygon([7, -10, 5, -20, 1, -12]);
        torso.endFill();
        torso.beginFill(0xff4040);
        torso.drawCircle(-3, -7, 2);
        torso.drawCircle(3, -7, 2);
        torso.endFill();
        hover.addChild(wingL, wingR, torso);
        body.addChild(hover);
        body.hover = hover;
        body.wingL = wingL;
        body.wingR = wingR;
    }

    static drawGolem(body, type, boss) {
        const r = type.radius;
        const c = type.color;
        const g = new PIXI.Graphics();
        const s = r / 26;
        // legs
        g.beginFill(shade(c, 0.55));
        g.drawRect(-16 * s, -14 * s, 12 * s, 14 * s);
        g.drawRect(4 * s, -14 * s, 12 * s, 14 * s);
        g.endFill();
        // arms
        g.beginFill(shade(c, 0.7));
        g.drawRoundedRect(-33 * s, -52 * s, 12 * s, 34 * s, 5);
        g.drawRoundedRect(21 * s, -52 * s, 12 * s, 34 * s, 5);
        g.endFill();
        // torso
        g.beginFill(shade(c, 0.75));
        g.drawRoundedRect(-24 * s, -58 * s, 48 * s, 48 * s, 8);
        g.endFill();
        g.beginFill(c);
        g.drawRoundedRect(-24 * s, -58 * s, 34 * s, 46 * s, 8);
        g.endFill();
        g.beginFill(shade(c, 1.3), 0.7);
        g.drawRoundedRect(-20 * s, -55 * s, 20 * s, 8 * s, 4);
        g.endFill();
        // cracks
        g.lineStyle(2, shade(c, 0.4));
        g.moveTo(-6 * s, -50 * s); g.lineTo(2 * s, -38 * s); g.lineTo(-3 * s, -28 * s);
        g.lineStyle(0);
        // head
        g.beginFill(shade(c, 0.85));
        g.drawRoundedRect(-13 * s, -76 * s, 26 * s, 20 * s, 5);
        g.endFill();
        const eye = boss ? 0xff3a3a : 0xffa030;
        g.beginFill(eye);
        g.drawRect(-9 * s, -70 * s, 6 * s, 5 * s);
        g.drawRect(3 * s, -70 * s, 6 * s, 5 * s);
        g.endFill();
        if (boss) {
            g.beginFill(0xf1e3c2);
            g.drawPolygon([-13 * s, -74 * s, -22 * s, -96 * s, -6 * s, -78 * s]);
            g.drawPolygon([13 * s, -74 * s, 22 * s, -96 * s, 6 * s, -78 * s]);
            g.endFill();
            g.beginFill(0xffc233);
            g.drawPolygon([-11 * s, -76 * s, -8 * s, -88 * s, -3 * s, -78 * s, 0, -90 * s, 3 * s, -78 * s, 8 * s, -88 * s, 11 * s, -76 * s]);
            g.endFill();
        }
        body.addChild(g);
        const glow = glowCircle(r * 0.5, eye, 0.18);
        glow.y = -67 * s;
        body.addChild(glow);
    }

    static animateEnemy(e, t) {
        e.phase += 0.12;
        const b = e.body;
        const base = e.elite ? 1.12 : 1;
        switch (e.type) {
            case 'FAST': {
                const flap = Math.sin(e.phase * 2.6);
                b.wingL.scale.y = 0.55 + Math.abs(flap) * 0.6;
                b.wingR.scale.y = b.wingL.scale.y;
                b.wingL.rotation = flap * 0.35;
                b.wingR.rotation = -flap * 0.35;
                b.hover.y = -26 + Math.sin(e.phase) * 3;
                e.shadow.scale.set(1 - Math.sin(e.phase) * 0.05);
                break;
            }
            case 'TANK':
            case 'BOSS':
                b.rotation = Math.sin(e.phase * 0.7) * 0.04;
                b.y = Math.abs(Math.sin(e.phase * 0.7)) * -2;
                break;
            default: {
                const sq = Math.sin(e.phase * 1.3);
                b.scale.set(base * (1 + sq * 0.07), base * (1 - sq * 0.09));
                break;
            }
        }
        if (e.type !== 'BASIC') b.scale.x = e.facing * base * (e.type === 'FAST' ? 1 : 1);
        if (e.hitFlash > 0) {
            e.hitFlash--;
            b.alpha = e.hitFlash % 2 ? 0.55 : 1;
        } else {
            b.alpha = 1;
        }
        // health bar
        const hp = e.hpBar;
        if (e.health < e.maxHealth && !e.dead) {
            hp.bar.visible = true;
            const frac = Math.max(0, e.health / e.maxHealth);
            hp.fg.scale.x = frac;
            hp.fg.position.x = -hp.width / 2 * (1 - frac) * 0;
            hp.fg.tint = frac < 0.3 ? 0xff4747 : frac < 0.6 ? 0xffc233 : 0x4cd964;
        }
    }

    // ------------------------------------------------------------ bullets
    static createBolt(x, y, angle, color = 0xffd84a) {
        const container = new PIXI.Container();
        const body = new PIXI.Container();
        const trail = new PIXI.Graphics();
        trail.beginFill(color, 0.5);
        trail.drawEllipse(-11, 0, 13, 3.2);
        trail.endFill();
        trail.beginFill(0xffffff, 0.5);
        trail.drawEllipse(-7, 0, 8, 1.6);
        trail.endFill();
        trail.rotation = angle;
        trail.blendMode = PIXI.BLEND_MODES.ADD;
        const glow = glowCircle(13, color, 0.45);
        const core = new PIXI.Graphics();
        core.beginFill(0xffffff);
        core.drawCircle(0, 0, 4.2);
        core.endFill();
        core.beginFill(color, 0.9);
        core.drawCircle(0, 0, 2.6);
        core.endFill();
        body.addChild(trail, glow, core);
        body.y = -22;
        container.addChild(makeShadow(6, 2.4, 0.3), body);
        container.wx = x;
        container.wy = y;
        return container;
    }

    static createBlade(color = 0x9ff2ff) {
        const container = new PIXI.Container();
        const body = new PIXI.Container();
        const blade = new PIXI.Graphics();
        blade.beginFill(color, 0.35);
        blade.drawCircle(0, 0, 16);
        blade.endFill();
        blade.beginFill(0xe8fbff);
        blade.drawPolygon([-4, 4, 0, -20, 4, 4, 0, 8]);
        blade.endFill();
        blade.beginFill(color);
        blade.drawPolygon([0, -20, 4, 4, 0, 8]);
        blade.endFill();
        blade.beginFill(0x7a5230);
        blade.drawRect(-1.5, 8, 3, 6);
        blade.endFill();
        blade.blendMode = PIXI.BLEND_MODES.NORMAL;
        body.addChild(blade);
        body.y = -20;
        container.addChild(makeShadow(6, 2.4, 0.25), body);
        container.blade = blade;
        container.wx = 0;
        container.wy = 0;
        return container;
    }

    // --------------------------------------------------------------- gems
    static gemTier(value) {
        if (value >= 60) return { color: 0xffd23f, scale: 1.55, name: 'gold' };
        if (value >= 20) return { color: 0xd05bff, scale: 1.3, name: 'purple' };
        if (value >= 9) return { color: 0x40b4ff, scale: 1.12, name: 'blue' };
        return { color: 0x3dff9a, scale: 1, name: 'green' };
    }

    static createGem(x, y, value, kind = 'gem') {
        const container = new PIXI.Container();
        const body = new PIXI.Container();
        const g = new PIXI.Graphics();
        let scale = 1;
        if (kind === 'heart') {
            g.beginFill(0xff4a6a);
            g.drawCircle(-4.5, -8, 5.5);
            g.drawCircle(4.5, -8, 5.5);
            g.drawPolygon([-9.6, -5, 9.6, -5, 0, 6]);
            g.endFill();
            g.beginFill(0xffffff, 0.7);
            g.drawCircle(-5.5, -9.5, 1.8);
            g.endFill();
            body.addChild(glowCircle(14, 0xff4a6a, 0.25));
        } else {
            const tier = EntityManager.gemTier(value);
            scale = tier.scale;
            g.beginFill(tier.color);
            g.drawPolygon([0, -13, 8, 0, 0, 13, -8, 0]);
            g.endFill();
            g.beginFill(0xffffff, 0.55);
            g.drawPolygon([0, -13, 0, 13, -8, 0]);
            g.endFill();
            g.beginFill(shade(tier.color, 0.6), 0.6);
            g.drawPolygon([0, -13, 8, 0, 0, 13, 0, 0]);
            g.endFill();
            g.beginFill(0xffffff, 0.9);
            g.drawCircle(-2, -5, 1.6);
            g.endFill();
            body.addChild(glowCircle(14, tier.color, 0.28));
        }
        body.addChild(g);
        body.scale.set(scale);
        container.addChild(makeShadow(7 * scale, 2.6 * scale, 0.3), body);
        Object.assign(container, {
            wx: x, wy: y, body, value, kind,
            phase: Math.random() * 6.28,
            baseY: -14 * scale,
            magnetized: false
        });
        return container;
    }

    static animateGem(gem, t) {
        gem.phase += 0.08;
        gem.body.y = gem.baseY + Math.sin(gem.phase) * 3;
    }

    static cleanup(entity) {
        if (!entity) return;
        if (entity.parent) entity.parent.removeChild(entity);
        entity.destroy({ children: true });
    }
}
