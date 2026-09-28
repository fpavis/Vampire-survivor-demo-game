import { WORLD_CONFIG, LIMITS } from './config.js';
import { EntityManager } from './entities.js';

const TILT = WORLD_CONFIG.tilt;
const msToFrames = (ms) => ms * 0.06;

// ---------------------------------------------------------------------------
// Weapon definitions. `stats(level)` returns the numbers used at that level;
// upgrade cards are generated automatically from the diff between two levels.
// ---------------------------------------------------------------------------
const secs = (v) => `${(v / 1000).toFixed(2)}s`;
const num = (v) => `${Math.round(v)}`;

export const WEAPONS = {
    bolt: {
        name: 'Arcane Bolt', icon: '✨', color: 0xffd84a, max: 8,
        desc: 'Fires magic bolts at the nearest enemies.',
        stats: (l) => ({
            damage: 22 + 6 * (l - 1),
            cooldown: Math.round(700 * Math.pow(0.92, l - 1)),
            count: 1 + Math.floor((l - 1) / 2),
            pierce: Math.floor((l - 1) / 3)
        }),
        labels: { damage: ['Damage', num], cooldown: ['Cooldown', secs], count: ['Projectiles', num], pierce: ['Pierce', num] }
    },
    orbit: {
        name: 'Spirit Blades', icon: '🗡️', color: 0x9ff2ff, max: 8,
        desc: 'Blades circle around you and shred anything close.',
        stats: (l) => ({
            damage: 12 + 4 * (l - 1),
            count: 2 + Math.floor(l / 2),
            radius: 78 + 6 * (l - 1),
            speed: 0.034 + 0.004 * (l - 1)
        }),
        labels: { damage: ['Damage', num], count: ['Blades', num], radius: ['Radius', num], speed: ['Spin', (v) => `${(v * 60 / 6.283).toFixed(2)}/s`] }
    },
    lightning: {
        name: 'Chain Lightning', icon: '⚡', color: 0xb9a5ff, max: 8,
        desc: 'Calls down lightning that jumps between enemies.',
        stats: (l) => ({
            damage: 26 + 8 * (l - 1),
            cooldown: Math.round(1500 * Math.pow(0.93, l - 1)),
            strikes: 1 + Math.floor((l - 1) / 3),
            jumps: 2 + Math.floor(l / 2)
        }),
        labels: { damage: ['Damage', num], cooldown: ['Cooldown', secs], strikes: ['Strikes', num], jumps: ['Chains', num] }
    },
    nova: {
        name: 'Frost Nova', icon: '❄️', color: 0x9be7ff, max: 8,
        desc: 'Releases a freezing shockwave that damages, slows and pushes back.',
        stats: (l) => ({
            damage: 22 + 7 * (l - 1),
            cooldown: Math.round(3200 * Math.pow(0.92, l - 1)),
            radius: 130 + 16 * (l - 1),
            slow: Math.min(0.75, 0.35 + 0.05 * (l - 1))
        }),
        labels: { damage: ['Damage', num], cooldown: ['Cooldown', secs], radius: ['Radius', num], slow: ['Slow', (v) => `${Math.round(v * 100)}%`] }
    },
    meteor: {
        name: 'Meteor', icon: '☄️', color: 0xff8a3a, max: 8,
        desc: 'Summons meteors that crash down on enemies.',
        stats: (l) => ({
            damage: 46 + 15 * (l - 1),
            cooldown: Math.round(2800 * Math.pow(0.92, l - 1)),
            count: 1 + Math.floor(l / 3),
            radius: 64 + 7 * (l - 1)
        }),
        labels: { damage: ['Damage', num], cooldown: ['Cooldown', secs], count: ['Meteors', num], radius: ['Blast', num] }
    }
};

// ---------------------------------------------------------------------------
// Passive definitions
// ---------------------------------------------------------------------------
const pct = (v) => `${Math.round(v * 100)}%`;
export const PASSIVES = {
    might: { name: 'Might', icon: '💪', max: 5, label: 'Damage', desc: 'All damage is increased.', value: (l) => 0.15 * l, fmt: (v) => `+${pct(v)}` },
    haste: { name: 'Haste', icon: '⏱️', max: 5, label: 'Cooldowns', desc: 'Weapons recharge faster.', value: (l) => 1 - Math.pow(0.92, l), fmt: (v) => `-${pct(v)}` },
    swift: { name: 'Swiftness', icon: '👟', max: 5, label: 'Move speed', desc: 'Run faster.', value: (l) => 0.08 * l, fmt: (v) => `+${pct(v)}` },
    vitality: { name: 'Vitality', icon: '❤️', max: 5, label: 'Max health', desc: 'More health, and heals when taken.', value: (l) => 25 * l, fmt: (v) => `+${v}` },
    recovery: { name: 'Recovery', icon: '💖', max: 5, label: 'Regeneration', desc: 'Slowly heal over time.', value: (l) => 0.6 * l, fmt: (v) => `+${v.toFixed(1)}/s` },
    magnet: { name: 'Magnet', icon: '🧲', max: 5, label: 'Pickup range', desc: 'Gems fly to you from further away.', value: (l) => 0.35 * l, fmt: (v) => `+${pct(v)}` },
    armor: { name: 'Armor', icon: '🛡️', max: 5, label: 'Damage taken', desc: 'Reduces all incoming damage.', value: (l) => 0.06 * l, fmt: (v) => `-${pct(v)}` },
    growth: { name: 'Wisdom', icon: '📘', max: 5, label: 'XP gain', desc: 'Gain experience faster.', value: (l) => 0.12 * l, fmt: (v) => `+${pct(v)}` },
    crit: { name: 'Precision', icon: '🎯', max: 5, label: 'Crit chance', desc: 'Hits can deal double damage.', value: (l) => 0.06 * l, fmt: (v) => `+${pct(v)}` }
};

export function computeStats(passives) {
    const lv = (id) => passives[id] || 0;
    return {
        might: 1 + PASSIVES.might.value(lv('might')),
        cooldown: 1 - PASSIVES.haste.value(lv('haste')),
        speed: 1 + PASSIVES.swift.value(lv('swift')),
        maxHealth: 100 + PASSIVES.vitality.value(lv('vitality')),
        regen: PASSIVES.recovery.value(lv('recovery')),
        magnet: 1 + PASSIVES.magnet.value(lv('magnet')),
        armor: Math.min(0.6, PASSIVES.armor.value(lv('armor'))),
        growth: 1 + PASSIVES.growth.value(lv('growth')),
        crit: 0.05 + PASSIVES.crit.value(lv('crit'))
    };
}

// ---------------------------------------------------------------------------
// Level-up choices
// ---------------------------------------------------------------------------
const WEAPON_RARITY = [0, 0, 1, 1, 2, 2, 3, 3];
const PASSIVE_RARITY = [0, 0, 1, 2, 3];

function weaponLines(id, from, to) {
    const def = WEAPONS[id];
    if (from === 0) return [def.desc];
    const a = def.stats(from), b = def.stats(to);
    const lines = [];
    for (const key of Object.keys(def.labels)) {
        if (a[key] !== b[key]) {
            const [label, fmt] = def.labels[key];
            lines.push(`${label}: ${fmt(a[key])} → ${fmt(b[key])}`);
        }
    }
    return lines;
}

export function generateChoices(game, count = 3) {
    const owned = game.weapons.list;
    const passives = game.state.passives;
    const pool = [];

    for (const id of Object.keys(WEAPONS)) {
        const cur = game.weapons.level(id);
        const def = WEAPONS[id];
        if (cur >= def.max) continue;
        if (cur === 0 && owned.length >= LIMITS.weaponSlots) continue;
        pool.push({
            weight: cur === 0 ? 1.0 : 1.5,
            card: {
                kind: 'weapon', id, toLevel: cur + 1, isNew: cur === 0,
                name: def.name, icon: def.icon, color: def.color,
                rarity: WEAPON_RARITY[cur], max: cur + 1 === def.max,
                lines: weaponLines(id, cur, cur + 1)
            }
        });
    }

    const passiveCount = Object.keys(passives).length;
    for (const id of Object.keys(PASSIVES)) {
        const cur = passives[id] || 0;
        const def = PASSIVES[id];
        if (cur >= def.max) continue;
        if (cur === 0 && passiveCount >= LIMITS.passiveSlots) continue;
        pool.push({
            weight: cur === 0 ? 0.9 : 1.3,
            card: {
                kind: 'passive', id, toLevel: cur + 1, isNew: cur === 0,
                name: def.name, icon: def.icon, color: 0x7be07b,
                rarity: PASSIVE_RARITY[cur], max: cur + 1 === def.max,
                lines: cur === 0
                    ? [def.desc, `${def.label}: ${def.fmt(def.value(1))}`]
                    : [`${def.label}: ${def.fmt(def.value(cur))} → ${def.fmt(def.value(cur + 1))}`]
            }
        });
    }

    const picks = [];
    while (picks.length < count && pool.length) {
        const total = pool.reduce((s, p) => s + p.weight, 0);
        let roll = Math.random() * total;
        let idx = 0;
        for (; idx < pool.length; idx++) {
            roll -= pool[idx].weight;
            if (roll <= 0) break;
        }
        idx = Math.min(idx, pool.length - 1);
        picks.push(pool.splice(idx, 1)[0].card);
    }

    while (picks.length < count) {
        picks.push({
            kind: 'heal', id: 'heal', toLevel: 0, isNew: false,
            name: 'Feast', icon: '🍖', color: 0xff8a8a, rarity: 0,
            lines: ['Restore 50% of your health.']
        });
    }
    return picks;
}

// ---------------------------------------------------------------------------
// Runtime: firing, projectiles, visuals
// ---------------------------------------------------------------------------
export class WeaponSystem {
    constructor(game) {
        this.game = game;
        this.list = [];
        this.bullets = [];
        this.blades = [];
        this.rings = [];
        this.meteors = [];
        this.bolts = [];
        this.decals = [];
        this.orbitAngle = 0;
    }

    reset() {
        this.bullets.forEach((b) => EntityManager.cleanup(b.sprite));
        this.blades.forEach((b) => EntityManager.cleanup(b));
        this.rings.forEach((r) => r.g.destroy());
        this.meteors.forEach((m) => { m.tele.destroy(); EntityManager.cleanup(m.rock); });
        this.bolts.forEach((b) => b.g.destroy());
        this.decals.forEach((d) => d.g.destroy());
        this.list = [];
        this.bullets = [];
        this.blades = [];
        this.rings = [];
        this.meteors = [];
        this.bolts = [];
        this.decals = [];
        this.orbitAngle = 0;
    }

    level(id) {
        const w = this.list.find((x) => x.id === id);
        return w ? w.level : 0;
    }

    acquire(id) {
        const w = this.list.find((x) => x.id === id);
        if (w) w.level = Math.min(WEAPONS[id].max, w.level + 1);
        else this.list.push({ id, level: 1, timer: 20 });
    }

    // ---------------------------------------------------------------- update
    update(delta) {
        const g = this.game;
        for (const w of this.list) {
            const s = WEAPONS[w.id].stats(w.level);
            if (w.id === 'orbit') { this.updateOrbit(s, delta); continue; }
            w.timer -= delta;
            if (w.timer > 0) continue;
            let fired = false;
            switch (w.id) {
                case 'bolt': fired = this.fireBolt(s); break;
                case 'lightning': fired = this.fireLightning(s); break;
                case 'nova': fired = this.fireNova(s); break;
                case 'meteor': fired = this.fireMeteor(s); break;
            }
            // Keep the weapon "ready" until a target shows up
            w.timer = fired ? msToFrames(s.cooldown) * g.stats.cooldown : 0;
        }
        this.updateBullets(delta);
        this.updateRings(delta);
        this.updateMeteors(delta);
        this.updateBolts(delta);
        this.updateDecals(delta);
    }

    nearestEnemies(x, y, range, limit = 1) {
        const out = [];
        const r2 = range * range;
        for (const e of this.game.state.enemies) {
            if (e.dead) continue;
            const dx = e.wx - x, dy = e.wy - y;
            const d = dx * dx + dy * dy;
            if (d <= r2) out.push({ e, d });
        }
        out.sort((a, b) => a.d - b.d);
        return out.slice(0, limit).map((o) => o.e);
    }

    // ------------------------------------------------------------ arcane bolt
    fireBolt(s) {
        const p = this.game.state.player;
        const targets = this.nearestEnemies(p.wx, p.wy, 680, s.count);
        if (!targets.length) return false;
        for (let i = 0; i < s.count; i++) {
            const t = targets[i] || targets[0];
            let angle = Math.atan2(t.wy - p.wy, t.wx - p.wx);
            if (i >= targets.length) angle += (i % 2 ? 1 : -1) * 0.16 * Math.ceil((i - targets.length + 1) / 2);
            const sprite = EntityManager.createBolt(p.wx, p.wy, angle * 1, WEAPONS.bolt.color);
            // The trail is drawn in screen space, so compensate for the tilt
            const vx = Math.cos(angle) * 9, vy = Math.sin(angle) * 9;
            sprite.getChildAt(1).getChildAt(0).rotation = Math.atan2(vy * TILT, vx);
            this.game.objectLayer.addChild(sprite);
            EntityManager.place(sprite);
            this.bullets.push({
                sprite, vx, vy, life: 80,
                damage: s.damage * this.game.stats.might,
                pierce: s.pierce, hits: new Set()
            });
        }
        return true;
    }

    updateBullets(delta) {
        const enemies = this.game.state.enemies;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            const sp = b.sprite;
            sp.wx += b.vx * delta;
            sp.wy += b.vy * delta;
            b.life -= delta;
            EntityManager.place(sp);
            let remove = b.life <= 0;

            if (!remove) {
                for (let j = 0; j < enemies.length; j++) {
                    const e = enemies[j];
                    if (e.dead || b.hits.has(e)) continue;
                    const dx = e.wx - sp.wx, dy = e.wy - sp.wy;
                    const rr = e.radius + 8;
                    if (dx * dx + dy * dy < rr * rr) {
                        b.hits.add(e);
                        this.game.damageEnemy(e, b.damage, { knock: { x: b.vx, y: b.vy, force: 2.2 } });
                        if (b.pierce <= 0) { remove = true; break; }
                        b.pierce--;
                    }
                }
            }
            if (remove) {
                this.game.fx.hit(sp.wx, sp.wy);
                EntityManager.cleanup(sp);
                this.bullets.splice(i, 1);
            }
        }
    }

    // ---------------------------------------------------------- spirit blades
    updateOrbit(s, delta) {
        const game = this.game;
        const p = game.state.player;
        while (this.blades.length < s.count) {
            const b = EntityManager.createBlade(WEAPONS.orbit.color);
            game.objectLayer.addChild(b);
            this.blades.push(b);
        }
        while (this.blades.length > s.count) EntityManager.cleanup(this.blades.pop());

        this.orbitAngle += s.speed * delta;
        const dmg = s.damage * game.stats.might;
        this.blades.forEach((b, i) => {
            const a = this.orbitAngle + (i / this.blades.length) * Math.PI * 2;
            b.wx = p.wx + Math.cos(a) * s.radius;
            b.wy = p.wy + Math.sin(a) * s.radius;
            EntityManager.place(b);
            // blade points along its direction of travel (screen space)
            b.blade.rotation = Math.atan2(Math.cos(a) * TILT, -Math.sin(a)) + Math.PI / 2 * 0 + Math.PI / 2;
            for (const e of game.state.enemies) {
                if (e.dead || game.frame - e.lastOrbit < 24) continue;
                const dx = e.wx - b.wx, dy = e.wy - b.wy;
                const rr = e.radius + 14;
                if (dx * dx + dy * dy < rr * rr) {
                    e.lastOrbit = game.frame;
                    game.damageEnemy(e, dmg, { knock: { x: e.wx - p.wx, y: e.wy - p.wy, force: 3 } });
                }
            }
        });
    }

    // -------------------------------------------------------- chain lightning
    fireLightning(s) {
        const p = this.game.state.player;
        const candidates = this.nearestEnemies(p.wx, p.wy, 560, 40);
        if (!candidates.length) return false;
        for (let i = 0; i < s.strikes; i++) {
            const start = candidates[Math.floor(Math.random() * candidates.length)];
            this.chainStrike(start, s);
        }
        return true;
    }

    chainStrike(start, s) {
        const game = this.game;
        const hit = new Set([start]);
        const points = [{ x: start.wx, y: start.wy, z: 6 + start.baseHeight * 0.5 }];
        let cur = start;
        let dmg = s.damage * game.stats.might;
        game.damageEnemy(start, dmg, { color: 0xd6c8ff });
        for (let j = 0; j < s.jumps; j++) {
            let best = null, bd = 240 * 240;
            for (const e of game.state.enemies) {
                if (e.dead || hit.has(e)) continue;
                const dx = e.wx - cur.wx, dy = e.wy - cur.wy;
                const d = dx * dx + dy * dy;
                if (d < bd) { bd = d; best = e; }
            }
            if (!best) break;
            hit.add(best);
            dmg *= 0.85;
            game.damageEnemy(best, dmg, { color: 0xd6c8ff });
            points.push({ x: best.wx, y: best.wy, z: 6 + best.baseHeight * 0.5 });
            cur = best;
        }

        // sky -> first target, then hop between targets
        const first = points[0];
        const path = [{ sx: first.x + (Math.random() - 0.5) * 60, sy: first.y * TILT - 520 }];
        points.forEach((pt) => path.push({ sx: pt.x, sy: pt.y * TILT - pt.z }));

        const g = new PIXI.Graphics();
        g.zIndex = 1e8;
        g.blendMode = PIXI.BLEND_MODES.ADD;
        const jag = [];
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            const steps = Math.max(4, Math.floor(Math.hypot(b.sx - a.sx, b.sy - a.sy) / 26));
            jag.push({ x: a.sx, y: a.sy });
            for (let k = 1; k < steps; k++) {
                const t = k / steps;
                jag.push({
                    x: a.sx + (b.sx - a.sx) * t + (Math.random() - 0.5) * 22,
                    y: a.sy + (b.sy - a.sy) * t + (Math.random() - 0.5) * 22
                });
            }
        }
        const last = path[path.length - 1];
        jag.push({ x: last.sx, y: last.sy });
        this.drawPolyline(g, jag, 8, WEAPONS.lightning.color, 0.35);
        this.drawPolyline(g, jag, 3, 0xffffff, 0.95);
        game.objectLayer.addChild(g);
        this.bolts.push({ g, life: 12, max: 12 });
        points.forEach((pt) => game.fx.burst(pt.x, pt.y, 18, 0xd6c8ff, 5, 2.6, { size: 0.6, life: 18 }));
        game.fx.addShake(2);
    }

    drawPolyline(g, pts, width, color, alpha) {
        g.lineStyle(width, color, alpha, 0.5);
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    }

    updateBolts(delta) {
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const b = this.bolts[i];
            b.life -= delta;
            b.g.alpha = Math.max(0, b.life / b.max);
            if (b.life <= 0) { b.g.destroy(); this.bolts.splice(i, 1); }
        }
    }

    // -------------------------------------------------------------- frost nova
    fireNova(s) {
        const game = this.game;
        const p = game.state.player;
        if (!this.nearestEnemies(p.wx, p.wy, s.radius * 1.35, 1).length) return false;
        const g = new PIXI.Graphics();
        game.groundLayer.addChild(g);
        this.rings.push({
            g, x: p.wx, y: p.wy, r: 12, maxR: s.radius, hit: new Set(),
            damage: s.damage * game.stats.might, slow: s.slow, fade: 0
        });
        game.fx.addShake(3);
        return true;
    }

    updateRings(delta) {
        const game = this.game;
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            if (r.r < r.maxR) {
                r.r = Math.min(r.maxR, r.r + (6 + (r.maxR - r.r) * 0.06) * delta);
                for (const e of game.state.enemies) {
                    if (e.dead || r.hit.has(e)) continue;
                    const dx = e.wx - r.x, dy = e.wy - r.y;
                    const rr = r.r + e.radius;
                    if (dx * dx + dy * dy <= rr * rr) {
                        r.hit.add(e);
                        e.slowUntil = game.frame + 150;
                        e.slowAmount = r.slow;
                        game.damageEnemy(e, r.damage, { color: 0xbdefff, knock: { x: dx, y: dy, force: 7 } });
                        game.fx.burst(e.wx, e.wy, 16, 0xbdefff, 4, 2, { size: 0.6, life: 20 });
                    }
                }
            } else {
                r.fade += delta;
            }
            const alpha = Math.max(0, 1 - r.fade / 14);
            r.g.clear();
            r.g.beginFill(0x9be7ff, 0.14 * alpha);
            r.g.drawCircle(r.x, r.y, r.r);
            r.g.endFill();
            r.g.lineStyle(5, 0xd8f6ff, 0.85 * alpha);
            r.g.drawCircle(r.x, r.y, r.r);
            r.g.lineStyle(2, 0x6ad0ff, 0.6 * alpha);
            r.g.drawCircle(r.x, r.y, Math.max(2, r.r - 10));
            if (r.fade >= 14) { r.g.destroy(); this.rings.splice(i, 1); }
        }
    }

    // ------------------------------------------------------------------ meteor
    fireMeteor(s) {
        const game = this.game;
        const p = game.state.player;
        const candidates = this.nearestEnemies(p.wx, p.wy, 620, 30);
        if (!candidates.length) return false;
        for (let i = 0; i < s.count; i++) {
            const t = candidates[Math.floor(Math.random() * candidates.length)];
            const tele = new PIXI.Graphics();
            game.groundLayer.addChild(tele);

            const rock = new PIXI.Container();
            const trail = new PIXI.Graphics();
            trail.beginFill(0xff7a20, 0.5);
            trail.drawPolygon([-14, 0, 14, 0, 60, -160, 20, -170]);
            trail.endFill();
            trail.blendMode = PIXI.BLEND_MODES.ADD;
            const glow = new PIXI.Graphics();
            glow.beginFill(0xff9a3a, 0.5);
            glow.drawCircle(0, 0, 30);
            glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            const core = new PIXI.Graphics();
            core.beginFill(0x4a2a1a); core.drawCircle(0, 0, 17); core.endFill();
            core.beginFill(0xff6a1a); core.drawCircle(-3, -3, 12); core.endFill();
            core.beginFill(0xffe08a); core.drawCircle(-5, -5, 6); core.endFill();
            rock.addChild(trail, glow, core);
            rock.visible = false;
            game.objectLayer.addChild(rock);

            this.meteors.push({
                x: t.wx + (Math.random() - 0.5) * 30, y: t.wy + (Math.random() - 0.5) * 30,
                t: -i * 10, delay: 62, radius: s.radius,
                damage: s.damage * game.stats.might, tele, rock
            });
        }
        return true;
    }

    updateMeteors(delta) {
        const game = this.game;
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.t += delta;
            if (m.t < 0) continue;
            const p = Math.min(1, m.t / m.delay);

            m.tele.clear();
            m.tele.beginFill(0xff4a1a, 0.08 + 0.2 * p);
            m.tele.drawCircle(m.x, m.y, m.radius * (0.3 + 0.7 * p));
            m.tele.endFill();
            m.tele.lineStyle(3, 0xff8a3a, 0.5 + 0.4 * Math.sin(m.t * 0.5));
            m.tele.drawCircle(m.x, m.y, m.radius);

            m.rock.visible = true;
            const ease = p * p;
            const z = 520 * (1 - ease);
            m.rock.position.set(m.x + (1 - ease) * 150, m.y * TILT - z);
            m.rock.zIndex = m.y + 30;

            if (m.t >= m.delay) {
                for (const e of game.state.enemies) {
                    if (e.dead) continue;
                    const dx = e.wx - m.x, dy = e.wy - m.y;
                    const rr = m.radius + e.radius;
                    if (dx * dx + dy * dy <= rr * rr) {
                        game.damageEnemy(e, m.damage, { color: 0xffb060, knock: { x: dx, y: dy, force: 9 } });
                    }
                }
                game.fx.burst(m.x, m.y, 6, 0xff8a3a, 34, 5.5, { size: 1.2, life: 36, up: 4 });
                game.fx.burst(m.x, m.y, 6, 0xffe08a, 16, 3, { size: 0.8, life: 24, up: 3 });
                game.fx.burst(m.x, m.y, 6, 0x333333, 12, 2.5, { size: 1.4, life: 44, up: 2, gravity: 0.05 });
                game.fx.addShake(8);
                const scorch = new PIXI.Graphics();
                scorch.beginFill(0x1a0f08, 0.55);
                scorch.drawCircle(m.x, m.y, m.radius * 0.7);
                scorch.endFill();
                game.groundLayer.addChild(scorch);
                this.decals.push({ g: scorch, life: 240, max: 240 });
                const flash = new PIXI.Graphics();
                flash.beginFill(0xffc070, 0.7);
                flash.drawCircle(m.x, m.y, m.radius);
                flash.endFill();
                flash.blendMode = PIXI.BLEND_MODES.ADD;
                game.groundLayer.addChild(flash);
                this.decals.push({ g: flash, life: 14, max: 14 });

                m.tele.destroy();
                EntityManager.cleanup(m.rock);
                this.meteors.splice(i, 1);
            }
        }
    }

    updateDecals(delta) {
        for (let i = this.decals.length - 1; i >= 0; i--) {
            const d = this.decals[i];
            d.life -= delta;
            d.g.alpha = Math.max(0, d.life / d.max);
            if (d.life <= 0) { d.g.destroy(); this.decals.splice(i, 1); }
        }
    }
}
