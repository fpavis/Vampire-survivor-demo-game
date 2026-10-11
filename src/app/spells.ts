// @ts-nocheck -- Pixi-bound runtime; the rules live in typed, tested core/spells + core/hero.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { EntityManager } from '../render/entities';
import { addSpellXp, resolveSpell, makeSpell, starterLoadout, TEMPLATES, RUNES } from '../core/spells/spells';
import { spendMana, regenMana } from '../core/hero/stats';

const TILT = WORLD_CONFIG.tilt;
const msToFrames = (ms) => ms * 0.06;
const MAX_AUTO = 5;
const MAX_ACTIVE = 3;
// hard caps so a heavily modified loadout cannot flood the scene
const CAP = { bullets: 120, rings: 24, meteors: 30, bolts: 16, decals: 40 };

export class SpellSystem {
    constructor(game) {
        this.game = game;
        this.fresh();
    }

    fresh() {
        this.spells = [];
        this.auto = [];
        this.active = [null, null, null];
        this.runes = [];
        this.mana = { value: 60 };
        this.timers = {};
        this.orbits = {};
        this.bullets = []; this.rings = []; this.meteors = []; this.bolts = []; this.decals = [];
        this.cache = new Map();
        this.depth = 0;
        this.dashing = null;
        this.barrierUntil = 0;
        this.barrierG = null;
        this.burning = new Set();
        this.version = 0;      // bumps whenever the loadout changes (UI refresh)
    }

    // ------------------------------------------------------------ lifecycle
    reset() {
        this.clearProjectiles();
        for (const o of Object.values(this.orbits)) o.blades.forEach((b) => EntityManager.cleanup(b));
        if (this.barrierG) { this.barrierG.destroy(); this.barrierG = null; }
        this.fresh();
    }

    clearProjectiles() {
        this.bullets.forEach((b) => EntityManager.cleanup(b.sprite));
        this.rings.forEach((r) => r.g.destroy());
        this.meteors.forEach((m) => { m.tele.destroy(); EntityManager.cleanup(m.rock); });
        this.bolts.forEach((b) => b.g.destroy());
        this.decals.forEach((d) => d.g.destroy());
        for (const o of Object.values(this.orbits)) o.blades.forEach((b) => EntityManager.cleanup(b));
        this.orbits = {};
        this.bullets = []; this.rings = []; this.meteors = []; this.bolts = []; this.decals = [];
        this.dashing = null;
    }

    setInventory(spells, runes) {
        this.spells = spells.map((x) => ({ ...x, runes: [...x.runes] }));
        this.runes = [...runes];
        this.touch();
    }

    setLoadout(auto, active) {
        this.auto = auto.filter((u) => this.item(u));
        this.active = [0, 1, 2].map((i) => (active[i] && this.item(active[i]) ? active[i] : null));
        this.touch();
    }

    /** Name of another hero who has this spell equipped (a spell can only be used by one hero at a time). */
    heldBy(uid) {
        const party = this.game.party;
        if (!party) return null;
        party.commit();
        for (let i = 0; i < party.heroes.length; i++) {
            if (i === party.active) continue;
            const h = party.heroes[i];
            if (h.auto.includes(uid) || h.active.includes(uid)) return party.def(i).name;
        }
        return null;
    }

    serialize() {
        return {
            spells: this.spells.map((s) => ({ uid: s.uid, tpl: s.tpl, level: s.level, xp: s.xp, runes: [...s.runes], locked: !!s.locked })),
            runes: [...this.runes]
        };
    }

    touch() { this.version++; this.cache.clear(); }
    item(uid) { return this.spells.find((s) => s.uid === uid); }
    level(tplId) { const s = this.spells.find((x) => x.tpl === tplId); return s ? s.level : 0; }
    resolved(item) {
        const key = item.level + '|' + item.runes.join(',');
        let c = this.cache.get(item.uid);
        if (!c || c.key !== key) { c = { key, r: resolveSpell(item) }; this.cache.set(item.uid, c); }
        return c.r;
    }

    // ---------------------------------------------------------- inventory
    // New finds go to the shared bag; the player decides which hero equips them.
    addSpell(tplId, level = 1) {
        const s = makeSpell(tplId, level);
        this.spells.push(s);
        this.touch();
        return s;
    }
    addRune(id) { this.runes.push(id); this.touch(); }
    equipped(uid) { return this.auto.includes(uid) || this.active.includes(uid); }

    equip(uid, slot = -1) {
        const it = this.item(uid);
        if (!it || this.heldBy(uid)) return false;
        const mode = TEMPLATES[it.tpl].mode;
        if (mode === 'auto') {
            if (this.auto.includes(uid)) return true;
            if (this.auto.length >= MAX_AUTO) return false;
            this.auto.push(uid);
        } else {
            const cur = this.active.indexOf(uid);
            if (cur >= 0) this.active[cur] = null;
            const i = slot >= 0 ? slot : this.active.indexOf(null);
            if (i < 0) return false;
            this.active[i] = uid;
        }
        this.touch();
        return true;
    }
    unequip(uid) {
        this.auto = this.auto.filter((u) => u !== uid);
        this.active = this.active.map((u) => (u === uid ? null : u));
        this.touch();
    }
    socket(uid, runeId, slot) {
        const it = this.item(uid);
        const i = this.runes.indexOf(runeId);
        if (!it || i < 0) return false;
        const prev = it.runes[slot];
        it.runes[slot] = runeId;
        this.runes.splice(i, 1);
        if (prev) this.runes.push(prev);
        this.touch();
        return true;
    }
    unsocket(uid, slot) {
        const it = this.item(uid);
        if (!it || !it.runes[slot]) return;
        this.runes.push(it.runes[slot]);
        it.runes[slot] = null;
        this.touch();
    }

    // -------------------------------------------------------------- update
    update(delta) {
        const g = this.game;
        regenMana(this.mana, g.stats, delta);
        const wanted = new Set();
        for (const uid of this.auto) {
            const it = this.item(uid);
            if (!it) continue;
            const r = this.resolved(it);
            if (r.tpl.expr === 'orbit') { wanted.add(uid); this.updateOrbit(r, delta); continue; }
            this.timers[uid] = (this.timers[uid] ?? 20) - delta;
            if (this.timers[uid] > 0) continue;
            let fired = false;
            switch (r.tpl.expr) {
                case 'bolt': fired = this.fireBolt(r); break;
                case 'chain': fired = this.fireLightning(r); break;
                case 'nova': fired = this.fireNova(r); break;
                case 'meteor': fired = this.fireMeteor(r); break;
            }
            // stay "ready" until a target shows up
            this.timers[uid] = fired ? msToFrames(r.p.cooldown) * g.stats.cooldown : 0;
        }
        for (const [uid, o] of Object.entries(this.orbits)) {
            if (!wanted.has(uid)) { o.blades.forEach((b) => EntityManager.cleanup(b)); delete this.orbits[uid]; }
        }
        this.updateDash(delta);
        this.updateBarrier();
        this.updateBurning(delta);
        this.updateBullets(delta);
        this.updateRings(delta);
        this.updateMeteors(delta);
        this.updateBolts(delta);
        this.updateDecals(delta);
    }

    // ------------------------------------------------------- damage + hooks
    dmg(r) { return r.p.damage * this.game.stats.might; }

    hit(e, amount, r, opts = {}) {
        const g = this.game;
        if (e.dead) return;
        const p = r.p;
        const knock = opts.knock ? { ...opts.knock, force: opts.knock.force * p.knock } : undefined;
        g.damageEnemy(e, amount, { color: opts.color, knock, spell: r.item });
        if (e.dead) return;
        if (p.slow > 0) { e.slowUntil = Math.max(e.slowUntil || 0, g.frame + 150); e.slowAmount = Math.max(e.slowAmount || 0, p.slow); }
        if (p.burn > 0) { e.burnUntil = g.frame + 180; e.burnDps = p.burn * g.stats.might; e.burnSrc = r.item; this.burning.add(e); }
        if (this.depth === 0) {
            for (const t of r.triggers) {
                if (t.on !== 'hit' || Math.random() > t.chance) continue;
                this.depth++;
                try { this.spark(e, amount * t.power, r); } finally { this.depth--; }
            }
        }
    }

    spark(from, amount, r) {
        const g = this.game;
        let best = null, bd = 260 * 260;
        for (const e of g.state.enemies) {
            if (e === from || e.dead || e.untargetable) continue;
            const d = (e.wx - from.wx) ** 2 + (e.wy - from.wy) ** 2;
            if (d < bd) { bd = d; best = e; }
        }
        if (!best) return;
        this.hit(best, amount, r, { color: 0xfff3a0 });
        this.arc(from.wx, from.wy, best.wx, best.wy, 0xfff3a0);
    }

    arc(x1, y1, x2, y2, color) {
        if (this.bolts.length >= CAP.bolts) return;
        const g = new PIXI.Graphics();
        g.zIndex = 1e8;
        g.blendMode = PIXI.BLEND_MODES.ADD;
        g.lineStyle(3, color, 0.9);
        g.moveTo(x1, y1 * TILT - 14);
        g.lineTo(x2, y2 * TILT - 14);
        this.game.objectLayer.addChild(g);
        this.bolts.push({ g, life: 8, max: 8 });
    }

    updateBurning(delta) {
        const g = this.game;
        for (const e of this.burning) {
            if (e.dead || g.frame > e.burnUntil) { this.burning.delete(e); continue; }
            e.burnAcc = (e.burnAcc || 0) + delta;
            if (e.burnAcc >= 30) {
                e.burnAcc = 0;
                g.damageEnemy(e, e.burnDps * 0.5, { color: 0xff9a3a, noCrit: true, spell: e.burnSrc, noEngage: true });
            }
        }
    }

    // called from Game.killEnemy
    onKill(e, item) {
        const g = this.game;
        if (!item) return;
        const r = this.resolved(item);
        if (addSpellXp(item, 1)) {
            g.ui.toast(`${r.tpl.icon} ${r.tpl.name} reached level ${item.level}`);
            this.touch();
        }
        if (r.p.leech) g.state.health = Math.min(g.state.maxHealth, g.state.health + r.p.leech);
        if (this.depth > 0) return;
        for (const t of r.triggers) {
            if (t.on !== 'kill' || Math.random() > t.chance) continue;
            this.depth++;
            try { this.burst(e.wx, e.wy, 90, this.dmg(r) * t.power, r); } finally { this.depth--; }
        }
    }

    burst(x, y, radius, amount, r) {
        const g = this.game;
        for (const e of g.state.enemies) {
            if (e.dead || e.untargetable) continue;
            const dx = e.wx - x, dy = e.wy - y, rr = radius + e.radius;
            if (dx * dx + dy * dy <= rr * rr) this.hit(e, amount, r, { color: r.color, knock: { x: dx, y: dy, force: 3 } });
        }
        g.fx.burst(x, y, 12, r.color, 20, 3.5, { size: 0.8, life: 22 });
    }

    nearestEnemies(x, y, range, limit = 1) {
        const out = [];
        const r2 = range * range;
        for (const e of this.game.state.enemies) {
            if (e.dead || e.untargetable) continue;
            const dx = e.wx - x, dy = e.wy - y;
            const d = dx * dx + dy * dy;
            if (d <= r2) out.push({ e, d });
        }
        out.sort((a, b) => a.d - b.d);
        return out.slice(0, limit).map((o) => o.e);
    }

    // ------------------------------------------------------------ arcane bolt
    fireBolt(r) {
        const s = r.p;
        const p = this.game.state.player;
        const targets = this.nearestEnemies(p.wx, p.wy, 680, s.count);
        if (!targets.length) return false;
        for (let i = 0; i < s.count && this.bullets.length < CAP.bullets; i++) {
            const t = targets[i] || targets[0];
            let angle = Math.atan2(t.wy - p.wy, t.wx - p.wx);
            if (i >= targets.length) angle += (i % 2 ? 1 : -1) * 0.16 * Math.ceil((i - targets.length + 1) / 2);
            const sprite = EntityManager.createBolt(p.wx, p.wy, angle, r.color);
            const vx = Math.cos(angle) * s.speed, vy = Math.sin(angle) * s.speed;
            sprite.getChildAt(1).getChildAt(0).rotation = Math.atan2(vy * TILT, vx);
            this.game.objectLayer.addChild(sprite);
            EntityManager.place(sprite);
            this.bullets.push({ sprite, vx, vy, life: 80, damage: this.dmg(r), pierce: s.pierce, hits: new Set(), r });
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
                    if (e.dead || e.untargetable || b.hits.has(e)) continue;
                    const dx = e.wx - sp.wx, dy = e.wy - sp.wy;
                    const rr = e.radius + 8;
                    if (dx * dx + dy * dy < rr * rr) {
                        b.hits.add(e);
                        this.hit(e, b.damage, b.r, { knock: { x: b.vx, y: b.vy, force: 2.2 } });
                        if (b.pierce <= 0) { remove = true; break; }
                        b.pierce--;
                    }
                }
            }
            if (remove) {
                this.game.fx.hit(sp.wx, sp.wy, b.r.color);
                EntityManager.cleanup(sp);
                this.bullets.splice(i, 1);
            }
        }
    }

    // ---------------------------------------------------------- spirit blades
    updateOrbit(r, delta) {
        const s = r.p;
        const game = this.game;
        const p = game.state.player;
        const o = this.orbits[r.item.uid] || (this.orbits[r.item.uid] = { blades: [], angle: 0 });
        while (o.blades.length < s.count) {
            const b = EntityManager.createBlade(r.color);
            game.objectLayer.addChild(b);
            o.blades.push(b);
        }
        while (o.blades.length > s.count) EntityManager.cleanup(o.blades.pop());
        o.angle += s.speed * delta;
        const dmg = this.dmg(r);
        o.blades.forEach((b, i) => {
            const a = o.angle + (i / o.blades.length) * Math.PI * 2;
            b.wx = p.wx + Math.cos(a) * s.radius;
            b.wy = p.wy + Math.sin(a) * s.radius;
            EntityManager.place(b);
            b.blade.rotation = Math.atan2(Math.cos(a) * TILT, -Math.sin(a)) + Math.PI / 2;
            for (const e of game.state.enemies) {
                if (e.dead || e.untargetable || game.frame - e.lastOrbit < 24) continue;
                const dx = e.wx - b.wx, dy = e.wy - b.wy;
                const rr = e.radius + 14;
                if (dx * dx + dy * dy < rr * rr) {
                    e.lastOrbit = game.frame;
                    this.hit(e, dmg, r, { knock: { x: e.wx - p.wx, y: e.wy - p.wy, force: 3 } });
                }
            }
        });
    }

    // -------------------------------------------------------- chain lightning
    fireLightning(r) {
        const p = this.game.state.player;
        const candidates = this.nearestEnemies(p.wx, p.wy, 560, 40);
        if (!candidates.length || this.bolts.length >= CAP.bolts) return false;
        for (let i = 0; i < r.p.count; i++) {
            this.chainStrike(candidates[Math.floor(Math.random() * candidates.length)], r);
        }
        return true;
    }

    chainStrike(start, r) {
        const game = this.game;
        const hit = new Set([start]);
        const points = [{ x: start.wx, y: start.wy, z: 6 + start.baseHeight * 0.5 }];
        let cur = start;
        let dmg = this.dmg(r);
        this.hit(start, dmg, r, { color: 0xd6c8ff });
        for (let j = 0; j < r.p.jumps; j++) {
            let best = null, bd = 240 * 240;
            for (const e of game.state.enemies) {
                if (e.dead || e.untargetable || hit.has(e)) continue;
                const dx = e.wx - cur.wx, dy = e.wy - cur.wy;
                const d = dx * dx + dy * dy;
                if (d < bd) { bd = d; best = e; }
            }
            if (!best) break;
            hit.add(best);
            dmg *= 0.85;
            this.hit(best, dmg, r, { color: 0xd6c8ff });
            points.push({ x: best.wx, y: best.wy, z: 6 + best.baseHeight * 0.5 });
            cur = best;
        }
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
                jag.push({ x: a.sx + (b.sx - a.sx) * t + (Math.random() - 0.5) * 22, y: a.sy + (b.sy - a.sy) * t + (Math.random() - 0.5) * 22 });
            }
        }
        const last = path[path.length - 1];
        jag.push({ x: last.sx, y: last.sy });
        this.polyline(g, jag, 8, r.color, 0.35);
        this.polyline(g, jag, 3, 0xffffff, 0.95);
        game.objectLayer.addChild(g);
        this.bolts.push({ g, life: 12, max: 12, pts: points });
        points.forEach((pt) => game.fx.burst(pt.x, pt.y, 18, 0xd6c8ff, 5, 2.6, { size: 0.6, life: 18 }));
        game.fx.addShake(2);
    }

    polyline(g, pts, width, color, alpha) {
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
    fireNova(r) {
        const game = this.game;
        const p = game.state.player;
        const s = r.p;
        if (!this.nearestEnemies(p.wx, p.wy, s.radius * 1.35, 1).length || this.rings.length >= CAP.rings) return false;
        const g = new PIXI.Graphics();
        game.groundLayer.addChild(g);
        this.rings.push({ g, x: p.wx, y: p.wy, r: 12, maxR: s.radius, hit: new Set(), damage: this.dmg(r), rs: r, fade: 0 });
        game.fx.addShake(3);
        return true;
    }

    updateRings(delta) {
        const game = this.game;
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const ring = this.rings[i];
            if (ring.r < ring.maxR) {
                ring.r = Math.min(ring.maxR, ring.r + (6 + (ring.maxR - ring.r) * 0.06) * delta);
                for (const e of game.state.enemies) {
                    if (e.dead || e.untargetable || ring.hit.has(e)) continue;
                    const dx = e.wx - ring.x, dy = e.wy - ring.y;
                    const rr = ring.r + e.radius;
                    if (dx * dx + dy * dy <= rr * rr) {
                        ring.hit.add(e);
                        this.hit(e, ring.damage, ring.rs, { color: 0xbdefff, knock: { x: dx, y: dy, force: 7 } });
                        game.fx.burst(e.wx, e.wy, 16, 0xbdefff, 4, 2, { size: 0.6, life: 20 });
                    }
                }
            } else ring.fade += delta;
            const alpha = Math.max(0, 1 - ring.fade / 14);
            const c = ring.rs.color;
            ring.g.clear();
            ring.g.beginFill(c, 0.14 * alpha);
            ring.g.drawCircle(ring.x, ring.y, ring.r);
            ring.g.endFill();
            ring.g.lineStyle(5, 0xd8f6ff, 0.85 * alpha);
            ring.g.drawCircle(ring.x, ring.y, ring.r);
            ring.g.lineStyle(2, 0x6ad0ff, 0.6 * alpha);
            ring.g.drawCircle(ring.x, ring.y, Math.max(2, ring.r - 10));
            if (ring.fade >= 14) { ring.g.destroy(); this.rings.splice(i, 1); }
        }
    }

    // ------------------------------------------------------------------ meteor
    fireMeteor(r) {
        const game = this.game;
        const p = game.state.player;
        const candidates = this.nearestEnemies(p.wx, p.wy, 620, 30);
        if (!candidates.length) return false;
        for (let i = 0; i < r.p.count && this.meteors.length < CAP.meteors; i++) {
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
                t: -i * 10, delay: 62, radius: r.p.radius, damage: this.dmg(r), tele, rock, r
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
            m.rock.position.set(m.x + (1 - ease) * 150, m.y * TILT - 520 * (1 - ease));
            m.rock.zIndex = m.y + 30;
            if (m.t >= m.delay) {
                for (const e of game.state.enemies) {
                    if (e.dead || e.untargetable) continue;
                    const dx = e.wx - m.x, dy = e.wy - m.y;
                    const rr = m.radius + e.radius;
                    if (dx * dx + dy * dy <= rr * rr) this.hit(e, m.damage, m.r, { color: 0xffb060, knock: { x: dx, y: dy, force: 9 } });
                }
                game.fx.burst(m.x, m.y, 6, 0xff8a3a, 34, 5.5, { size: 1.2, life: 36, up: 4 });
                game.fx.burst(m.x, m.y, 6, 0xffe08a, 16, 3, { size: 0.8, life: 24, up: 3 });
                game.fx.burst(m.x, m.y, 6, 0x333333, 12, 2.5, { size: 1.4, life: 44, up: 2, gravity: 0.05 });
                game.fx.addShake(8);
                game.fx.flash(m.x, m.y, m.radius * 4, 0xffa040, 26);
                if (this.decals.length < CAP.decals) {
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
                }
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

    // light emitted by spells for the light map (caves, ruins, dark regions)
    emitLights(L) {
        for (const b of this.bullets) L.add({ x: b.sprite.wx, y: b.sprite.wy, z: 18, r: 90, color: b.r.color, i: 0.9 });
        for (const o of Object.values(this.orbits)) for (const b of o.blades) L.add({ x: b.wx, y: b.wy, z: 16, r: 60, color: 0x9ff2ff, i: 0.6 });
        for (const ring of this.rings) L.add({ x: ring.x, y: ring.y, z: 0, r: ring.r * 1.4 + 30, color: ring.rs.color, i: Math.max(0, 1 - ring.fade / 14) * 0.8 });
        for (const m of this.meteors) if (m.t >= 0) L.add({ x: m.x, y: m.y, z: 0, r: m.radius * (0.8 + m.t / m.delay), color: 0xff7a2a, i: 0.4 + 0.6 * (m.t / m.delay) });
        for (const b of this.bolts) if (b.pts) for (const p of b.pts) L.add({ x: p.x, y: p.y, z: 20, r: 150, color: 0xc8b8ff, i: b.life / b.max });
        if (this.barrierActive) { const p = this.game.state.player; L.add({ x: p.wx, y: p.wy, z: 20, r: this.barrierRadius * 3, color: this.barrierColor, i: 0.7 }); }
    }

    // ================================================================ ACTIVE
    /** Slot readiness for the HUD: 0..1 cooldown progress, and whether mana suffices. */
    slotInfo(i) {
        const uid = this.active[i];
        const it = uid && this.item(uid);
        if (!it) return null;
        const r = this.resolved(it);
        const cost = Math.round(r.p.mana * this.game.stats.manaCost);
        const left = Math.max(0, (this.timers[uid] ?? 0));
        const total = msToFrames(r.p.cooldown) * this.game.stats.cooldown;
        return { item: it, r, cost, cdFrac: total ? Math.min(1, left / total) : 0, affordable: this.mana.value >= cost };
    }

    cast(slot) {
        const g = this.game;
        const s = g.state;
        if (!s.player || s.gameOver || s.paused || g.busy) return false;
        const info = this.slotInfo(slot);
        if (!info) return false;
        const { item, r, cost } = info;
        if ((this.timers[item.uid] ?? 0) > 0) return false;
        if (!spendMana(this.mana, cost)) { g.ui.toast('Not enough mana'); g.audio?.play('deny'); return false; }
        this.timers[item.uid] = msToFrames(r.p.cooldown) * g.stats.cooldown;
        switch (r.tpl.expr) {
            case 'dash': this.startDash(r); break;
            case 'blink': this.blink(r); break;
            case 'barrier': this.startBarrier(r); break;
        }
        g.audio?.play(r.tpl.expr);
        return true;
    }

    aimDir() {
        const g = this.game;
        const p = g.state.player;
        const ptr = g.state.pointerPosition;
        if (g.state.pointerDown && ptr) {
            const tx = ptr.x - g.worldContainer.x, ty = (ptr.y - g.worldContainer.y) / TILT;
            const d = Math.hypot(tx - p.wx, ty - p.wy);
            if (d > 8) return { x: (tx - p.wx) / d, y: (ty - p.wy) / d };
        }
        if (g.lastMove && (g.lastMove.x || g.lastMove.y)) return g.lastMove;
        return { x: p.facing || 1, y: 0 };
    }

    startDash(r) {
        const d = this.aimDir();
        const frames = Math.max(6, r.p.duration * 60 * 0.6);
        this.dashing = { dx: d.x, dy: d.y, left: frames, speed: r.p.range / frames };
        this.game.invulnUntil = Math.max(this.game.invulnUntil || 0, this.game.frame + r.p.duration * 60 + 6);
        this.game.fx.burst(this.game.state.player.wx, this.game.state.player.wy, 10, r.color, 14, 3, { size: 0.7, life: 16 });
    }

    updateDash(delta) {
        const d = this.dashing;
        if (!d) return;
        const g = this.game;
        const p = g.state.player;
        const step = Math.min(delta, d.left);
        g.world.tryMove(p, d.dx * d.speed * step, d.dy * d.speed * step * 1.2, p.radius);
        d.left -= delta;
        if (((g.frame | 0) & 1) === 0) g.fx.burst(p.wx, p.wy, 2, 0xcfe8ff, 6, 1.2, { size: 0.5, life: 14 });
        if (d.left <= 0) this.dashing = null;
    }

    blink(r) {
        const g = this.game;
        const p = g.state.player;
        const d = this.aimDir();
        g.fx.burst(p.wx, p.wy, 14, r.color, 22, 3, { size: 0.8, life: 18 });
        let dist = 0;
        for (let t = 16; t <= r.p.range; t += 16) {
            if (g.world.blocked(p.wx + d.x * t, p.wy + d.y * t, p.radius)) break;
            dist = t;
        }
        p.wx += d.x * dist;
        p.wy += d.y * dist;
        g.invulnUntil = Math.max(g.invulnUntil || 0, g.frame + 14);
        g.fx.burst(p.wx, p.wy, 14, r.color, 22, 3, { size: 0.8, life: 18 });
        g.cam.x += d.x * dist * 0.5; g.cam.y += d.y * dist * 0.5;
    }

    startBarrier(r) {
        const g = this.game;
        this.barrierUntil = g.frame + r.p.duration * 60;
        this.barrierRadius = r.p.radius;
        this.barrierColor = r.color;
        g.fx.addShake(2);
    }

    get barrierActive() { return this.game.frame < this.barrierUntil; }

    updateBarrier() {
        const g = this.game;
        if (!this.barrierActive) {
            if (this.barrierG) { this.barrierG.destroy(); this.barrierG = null; }
            return;
        }
        if (!this.barrierG) {
            this.barrierG = new PIXI.Graphics();
            this.barrierG.blendMode = PIXI.BLEND_MODES.ADD;
            g.objectLayer.addChild(this.barrierG);
        }
        const p = g.state.player;
        const left = (this.barrierUntil - g.frame) / 60;
        const a = left < 0.6 ? 0.4 + 0.4 * Math.sin(g.frame * 0.6) : 0.85;
        const b = this.barrierG;
        b.clear();
        b.lineStyle(3, this.barrierColor, a);
        b.beginFill(this.barrierColor, 0.12 * a);
        b.drawEllipse(0, 0, this.barrierRadius, this.barrierRadius * TILT * 1.3);
        b.endFill();
        b.position.set(p.wx, p.wy * TILT - 18);
        b.zIndex = p.wy + 40;
    }
}

export { MAX_AUTO, MAX_ACTIVE, TEMPLATES, RUNES };
