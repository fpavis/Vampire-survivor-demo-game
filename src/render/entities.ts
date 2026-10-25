// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
import { ENEMY_TYPES, WORLD_CONFIG } from '../core/config';
import { ENEMY_ART } from './enemyArt';
import { threatBand } from '../core/world/difficulty';
import { buildHero, animateHero } from './heroArt';
import { softGlow } from './glow';
import { access } from '../app/access';
import { threatColor, threatMark } from '../core/access/palettes';


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

const glowCircle = (radius, color, alpha) => softGlow(radius, color, alpha);

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
    return { bar, bg, fg, width };
}

export class EntityManager {
    // hero level, kept up to date by the game; used to colour enemy level tags by threat
    static heroLevel = 1;

    // Project a ground-plane entity to the screen (in world-container space)
    static place(entity) {
        entity.position.set(entity.wx, entity.wy * TILT);
        entity.zIndex = entity.wy;
    }

    // ------------------------------------------------------------- player
    static createPlayer(heroId = 'aria') {
        const container = new PIXI.Container();
        container.wx = 0;
        container.wy = 0;
        container.radius = 11;

        const aura = new PIXI.Graphics();
        aura.lineStyle(2, 0xffffff, 0.55);
        aura.drawEllipse(0, 0, 26, 26 * TILT);
        aura.beginFill(0xffffff, 0.12);
        aura.drawEllipse(0, 0, 26, 26 * TILT);
        aura.endFill();
        aura.tint = 0x6aa8ff;

        const body = new PIXI.Container();
        container.addChild(makeShadow(15, 5.5, 0.4), aura, body);
        Object.assign(container, { body, aura, phase: 0, moving: false });
        EntityManager.setHeroLook(container, heroId);
        return container;
    }

    /** Swap the hero drawn by a player container (party switching). */
    static setHeroLook(p, heroId, color = null) {
        p.rig = buildHero(p.body, heroId);
        p.heroId = heroId;
        p.orbGlow = p.rig.orbGlow;
        if (color !== null) p.aura.tint = color;
    }

    static animatePlayer(p, t, moving, facing) {
        p.phase += moving ? 0.22 : 0.06;
        animateHero(p.rig, p.phase, moving, t);
        p.body.y = moving ? -Math.abs(Math.sin(p.phase)) * 1.5 : 0;
        p.body.scale.x = facing;
        p.aura.scale.set(1 + Math.sin(t * 0.06) * 0.06);
        if (p.orbGlow) p.orbGlow.alpha = 0.7 + Math.sin(t * 0.15) * 0.3;
    }

    // ------------------------------------------------------------ enemies
    static createEnemy(typeKey, x, y) {
        const type = ENEMY_TYPES[typeKey];
        const container = new PIXI.Container();
        const r = type.radius;
        const body = new PIXI.Container();
        const art = ENEMY_ART[type.art](body, type, r);
        const height = art.height;

        const shadow = makeShadow(r * 1.05, r * 0.42, 0.38);
        const marker = new PIXI.Graphics();
        const tele = new PIXI.Graphics();
        container.addChild(shadow, marker, tele, body);
        const hp = drawHealthBar(container, Math.max(26, r * 1.8), -height - 10);

        Object.assign(container, {
            type: typeKey,
            wx: x, wy: y, z: 0,
            radius: r,
            body, shadow, marker, tele,
            hpBar: hp,
            art,
            health: type.health,
            maxHealth: type.health,
            speed: type.speed,
            damage: type.damage,
            armor: type.armor || 0,
            experienceValue: type.experience,
            flying: type.flying,
            phasing: !!type.phase,
            isBoss: !!type.boss,
            kvx: 0, kvy: 0,
            slowUntil: 0, slowAmount: 0,
            hitFlash: 0,
            lastOrbit: 0,
            elite: false,
            dead: false,
            untargetable: false,
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
    }

    static animateEnemy(e) {
        e.phase += 0.12;
        e.art.anim(e);
        if (e.hitFlash > 0) {
            e.hitFlash--;
            e.body.alpha = e.hitFlash % 2 ? 0.55 : 1;
        } else if (!e.untargetable) {
            e.body.alpha = e.phasing ? 0.85 : 1;
        }
        const hp = e.hpBar;
        // Bars only once hurt; level tags only where they matter: elites, bosses and monsters above the hero.
        const hurt = e.health < e.maxHealth && !e.dead;
        const band = e.level ? threatBand(e.level, EntityManager.heroLevel) : 'even';
        const tagged = !e.dead && !!e.level && (e.isBoss || e.elite || band === 'high' || band === 'deadly');
        hp.bar.visible = hurt || tagged;
        hp.bg.visible = hp.fg.visible = hurt;
        if (hurt) {
            const frac = Math.max(0, e.health / e.maxHealth);
            hp.fg.scale.x = frac;
            hp.fg.tint = frac < 0.3 ? 0xff4747 : frac < 0.6 ? 0xffc233 : 0x4cd964;
        }
        if (tagged && !hp.label) {
            // created lazily so ordinary monsters stay cheap
            const label = new PIXI.Text(`Lv ${e.level}`, { fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', fill: 0xffffff, stroke: 0x000000, strokeThickness: 3 });
            label.anchor.set(0.5, 1);
            label.position.set(0, -2);
            hp.bar.addChild(label);
            hp.label = label;
        }
        if (hp.label) {
            hp.label.visible = tagged;
            const key = band + access.palette + (e.bossName || '');
            if (tagged && hp.band !== key) {
                hp.band = key;
                hp.label.style.fill = threatColor(access.palette, band);
                hp.label.text = `${threatMark(band)}Lv ${e.level}${e.isBoss && e.bossName ? ' ' + e.bossName : ''}`;
            }
        }
    }

    // Ground telegraphs for attacks (drawn on the enemy's own container, tilted like the ground)
    static teleLine(e, angle, length, width, intensity = 1) {
        const g = e.tele;
        g.clear();
        const ex = Math.cos(angle) * length, ey = Math.sin(angle) * length * TILT;
        g.lineStyle(width, 0xff3030, 0.18 + 0.28 * intensity);
        g.moveTo(0, 0); g.lineTo(ex, ey);
        g.lineStyle(Math.max(2, width * 0.3), 0xff8a6a, 0.35 + 0.5 * intensity);
        g.moveTo(0, 0); g.lineTo(ex, ey);
        g.lineStyle(0);
        g.beginFill(0xff3030, 0.3 + 0.4 * intensity); g.drawCircle(ex, ey, width * 0.5); g.endFill();
    }

    static teleCircle(e, radius, intensity = 1, color = 0xff3030) {
        const g = e.tele;
        g.clear();
        g.beginFill(color, 0.06 + 0.2 * intensity);
        g.drawEllipse(0, 0, radius * intensity, radius * intensity * TILT);
        g.endFill();
        g.lineStyle(3, color, 0.3 + 0.5 * intensity);
        g.drawEllipse(0, 0, radius, radius * TILT);
    }

    static clearTele(e) { e.tele.clear(); }

    // ------------------------------------------------------------ bullets
    static createBolt(x, y, angle, color = 0xffd84a) {
        const container = new PIXI.Container();
        const body = new PIXI.Container();
        const trail = new PIXI.Graphics();
        trail.beginFill(color, 0.35);
        trail.drawPolygon([2, -5, -30, -1.2, -34, 0, -30, 1.2, 2, 5]);
        trail.endFill();
        trail.beginFill(color, 0.6);
        trail.drawPolygon([2, -3.4, -20, -0.8, -22, 0, -20, 0.8, 2, 3.4]);
        trail.endFill();
        trail.beginFill(0xffffff, 0.7);
        trail.drawPolygon([2, -1.6, -12, 0, 2, 1.6]);
        trail.endFill();
        trail.rotation = angle;
        trail.blendMode = PIXI.BLEND_MODES.ADD;
        const glow = glowCircle(16, color, 0.55);
        const core = new PIXI.Graphics();
        core.beginFill(color);
        core.drawCircle(0, 0, 5.6);
        core.endFill();
        core.beginFill(0xffffff);
        core.drawCircle(0, 0, 3.4);
        core.endFill();
        body.addChild(trail, glow, core);
        body.y = -22;
        container.addChild(makeShadow(6, 2.4, 0.3), body);
        container.wx = x;
        container.wy = y;
        return container;
    }

    /** A drifting arcane wisp: a soft glow around a bright core with a little sparkle. */
    static createWisp(x, y, color = 0xd8a0ff) {
        const container = new PIXI.Container();
        const body = new PIXI.Container();
        const glow = glowCircle(18, color, 0.5);
        const core = new PIXI.Graphics();
        core.beginFill(color, 0.9); core.drawCircle(0, 0, 6); core.endFill();
        core.beginFill(0xffffff); core.drawCircle(-1.2, -1.2, 3.2); core.endFill();
        core.lineStyle(1.2, 0xffffff, 0.8);
        core.moveTo(-9, 0); core.lineTo(9, 0); core.moveTo(0, -9); core.lineTo(0, 9);
        core.lineStyle(0);
        body.addChild(glow, core);
        body.y = -26;
        container.addChild(makeShadow(6, 2.4, 0.25), body);
        container.wx = x;
        container.wy = y;
        return container;
    }

    static createBlade(color = 0x9ff2ff) {
        const container = new PIXI.Container();
        const body = new PIXI.Container();
        // a spectral longsword: glowing edge, steel core, gilded guard
        const glow = softGlow(18, color, 0.4);
        glow.y = -8;
        const blade = new PIXI.Graphics();
        blade.lineStyle(1.4, shade(color, 0.45), 0.9);
        blade.beginFill(0xeafcff);
        blade.drawPolygon([-3.6, 6, -3.6, -20, 0, -30, 3.6, -20, 3.6, 6]);
        blade.endFill();
        blade.lineStyle(0);
        blade.beginFill(color, 0.9);
        blade.drawPolygon([0, -30, 3.6, -20, 3.6, 6, 0, 6]);
        blade.endFill();
        blade.beginFill(0xffffff, 0.9);
        blade.drawRect(-0.6, -24, 1.2, 28);
        blade.endFill();
        blade.lineStyle(1.2, 0x5a3a10, 0.9);
        blade.beginFill(0xe8b040);
        blade.drawRoundedRect(-8, 5, 16, 3.6, 1.5);
        blade.endFill();
        blade.beginFill(0x5a3a20);
        blade.drawRect(-1.6, 8.6, 3.2, 7);
        blade.endFill();
        blade.beginFill(0xe8b040);
        blade.drawCircle(0, 17, 2.4);
        blade.endFill();
        blade.lineStyle(0);
        body.addChild(glow, blade);
        body.y = -22;
        container.addChild(makeShadow(7, 2.6, 0.25), body);
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
        } else if (kind === 'coin') {
            // a stack-edged gold coin with an embossed crown
            g.lineStyle(1.3, 0x6a4a0a, 0.95);
            g.beginFill(0xc8901a); g.drawEllipse(0, 1.5, 9, 8.5); g.endFill();
            g.beginFill(0xffd23f); g.drawEllipse(0, 0, 9, 8.5); g.endFill();
            g.lineStyle(1, 0xb8801a, 0.9);
            g.drawEllipse(0, 0, 6, 5.6);
            g.lineStyle(0);
            g.beginFill(0xb8801a); g.drawPolygon([-3.4, 2, -3.4, -1.6, -1.6, 0.2, 0, -2.6, 1.6, 0.2, 3.4, -1.6, 3.4, 2]); g.endFill();
            g.beginFill(0xfff6c0, 0.9); g.drawEllipse(-3.5, -4, 2.8, 1.6); g.endFill();
            body.addChild(glowCircle(14, 0xffd23f, 0.3));
            scale = 1.05;
        } else if (kind === 'wood' || kind === 'stone' || kind === 'iron') {
            const col = { wood: 0x9b6a3a, stone: 0x9aa3b4, iron: 0x7a8ea8 }[kind];
            g.lineStyle(1.3, shade(col, 0.35), 0.95);
            if (kind === 'wood') {
                // two bundled logs with rings
                g.beginFill(col); g.drawRoundedRect(-11, -3, 20, 7, 3); g.drawRoundedRect(-9, -9, 20, 7, 3); g.endFill();
                g.beginFill(0xe0b880); g.drawEllipse(9, 0.5, 3, 3.5); g.drawEllipse(11, -5.5, 3, 3.5); g.endFill();
                g.lineStyle(0.8, 0x8a5a2a); g.drawEllipse(9, 0.5, 1.4, 1.8); g.drawEllipse(11, -5.5, 1.4, 1.8);
                g.lineStyle(0); g.beginFill(0xc83a2a); g.drawRect(-3, -9, 2.5, 13); g.endFill();
            } else if (kind === 'stone') {
                g.beginFill(col); g.drawPolygon([-10, 4, -8, -5, 0, -9, 9, -5, 10, 4, 2, 7]); g.endFill();
                g.lineStyle(0);
                g.beginFill(0xffffff, 0.4); g.drawPolygon([-8, -5, 0, -9, 2, -3, -5, -1]); g.endFill();
                g.beginFill(0x000000, 0.18); g.drawPolygon([2, 7, 10, 4, 9, -5, 4, 0]); g.endFill();
            } else {
                // iron ingot
                g.beginFill(shade(col, 0.8)); g.drawPolygon([-11, 3, 11, 3, 8, -3, -8, -3]); g.endFill();
                g.beginFill(col); g.drawPolygon([-8, -3, 8, -3, 6, -8, -6, -8]); g.endFill();
                g.lineStyle(0);
                g.beginFill(0xffffff, 0.55); g.drawRect(-5, -7, 8, 1.6); g.endFill();
            }
            g.lineStyle(0);
            body.addChild(glowCircle(12, col, 0.22));
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
