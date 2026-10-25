// @ts-nocheck -- Pixi-bound runtime; the rules live in typed, tested core/spells + core/hero.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { EntityManager } from '../render/entities';
import { addSpellXp, resolveSpell, makeSpell, starterLoadout, TEMPLATES, RUNES } from '../core/spells/spells';
import { spendMana, regenMana } from '../core/hero/stats';
import { buildHero } from '../render/heroArt';

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
        this.ghosts = [];      // dash afterimages
    }

    // ------------------------------------------------------------ lifecycle
    reset() {
        this.clearProjectiles();
        for (const o of Object.values(this.orbits)) { o.blades.forEach((b) => EntityManager.cleanup(b)); if (o.trail) o.trail.destroy(); }
        if (this.barrierG) { this.barrierG.destroy(); this.barrierG = null; }
        this.fresh();
    }

    clearProjectiles() {
        this.bullets.forEach((b) => EntityManager.cleanup(b.sprite));
        this.rings.forEach((r) => r.g.destroy());
        this.meteors.forEach((m) => { m.tele.destroy(); EntityManager.cleanup(m.rock); });
        this.bolts.forEach((b) => b.g.destroy());
        this.decals.forEach((d) => d.g.destroy());
        for (const o of Object.values(this.orbits)) { o.blades.forEach((b) => EntityManager.cleanup(b)); if (o.trail) o.trail.destroy(); }
        this.orbits = {};
        this.bullets = []; this.rings = []; this.meteors = []; this.bolts = []; this.decals = [];
        this.dashing = null;
        (this.ghosts || []).forEach((gh) => gh.c.destroy({ children: true }));
        this.ghosts = [];
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
        if (this.game.towers && this.game.towers.holderOf(uid)) return 'A tower';
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
        const sfx = g.surfaces ? g.surfaces.fx : null;
        regenMana(this.mana, g.stats, delta * (sfx ? sfx.manaRegen : 1));
        this.tickActiveCooldowns(delta * (sfx ? sfx.haste : 1));
        const wanted = new Set();
        for (const uid of this.auto) {
            const it = this.item(uid);
            if (!it) continue;
            const r = this.resolved(it);
            if (r.tpl.expr === 'orbit') { wanted.add(uid); this.updateOrbit(r, delta); continue; }
            this.timers[uid] = (this.timers[uid] ?? 20) - delta * (sfx ? sfx.haste : 1);
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
            if (!wanted.has(uid)) { o.blades.forEach((b) => EntityManager.cleanup(b)); if (o.trail) o.trail.destroy(); delete this.orbits[uid]; }
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

    /** Active skills (dash, blink, aegis) count their cooldown down here; auto-cast spells do it as they fire. */
    tickActiveCooldowns(step) {
        for (const uid in this.timers) {
            if (this.timers[uid] <= 0) continue;
            const it = this.item(uid);
            if (it && TEMPLATES[it.tpl].mode === 'active') this.timers[uid] = Math.max(0, this.timers[uid] - step);
        }
    }

    // ------------------------------------------------------- damage + hooks
    dmg(r) { return r.p.damage * (this.srcMult ?? this.game.stats.might); }

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
    fireBolt(r, src) {
        const s = r.p;
        const p = src || this.game.state.player;
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
        this.game.audio.play('bolt', { x: p.wx, y: p.wy });
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
            if (Math.random() < 0.35) this.game.fx.burst(sp.wx, sp.wy, 22, b.r.color, 1, 0.25, { size: 0.55, life: 14, gravity: 0, up: 0.1, glow: true });
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
        let o = this.orbits[r.item.uid];
        if (!o) {
            const trail = new PIXI.Graphics();
            trail.blendMode = PIXI.BLEND_MODES.ADD;
            game.objectLayer.addChild(trail);
            o = this.orbits[r.item.uid] = { blades: [], angle: 0, trail };
        }
        while (o.blades.length < s.count) {
            const b = EntityManager.createBlade(r.color);
            game.objectLayer.addChild(b);
            o.blades.push(b);
        }
        while (o.blades.length > s.count) EntityManager.cleanup(o.blades.pop());
        o.angle += s.speed * delta;
        const dmg = this.dmg(r);
        // ghostly arc trailing behind each blade
        const tr = o.trail;
        tr.clear();
        tr.zIndex = p.wy + 1;
        o.blades.forEach((b, i) => {
            const a0 = o.angle + (i / o.blades.length) * Math.PI * 2;
            for (let k = 0; k < 7; k++) {
                const a1 = a0 - k * 0.075, a2 = a0 - (k + 1) * 0.075;
                tr.lineStyle(7 - k * 0.8, r.color, 0.42 * (1 - k / 7));
                tr.moveTo(p.wx + Math.cos(a1) * s.radius, (p.wy + Math.sin(a1) * s.radius) * TILT - 18);
                tr.lineTo(p.wx + Math.cos(a2) * s.radius, (p.wy + Math.sin(a2) * s.radius) * TILT - 18);
            }
        });
        tr.lineStyle(0);
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
                    game.audio.play('blade', { x: e.wx, y: e.wy });
                    this.hit(e, dmg, r, { knock: { x: e.wx - p.wx, y: e.wy - p.wy, force: 3 } });
                }
            }
        });
    }

    // -------------------------------------------------------- chain lightning
    fireLightning(r, src) {
        const p = src || this.game.state.player;
        const candidates = this.nearestEnemies(p.wx, p.wy, 560, 40);
        if (!candidates.length || this.bolts.length >= CAP.bolts) return false;
        for (let i = 0; i < r.p.count; i++) {
            this.chainStrike(candidates[Math.floor(Math.random() * candidates.length)], r);
        }
        this.game.audio.play('zap', { x: candidates[0].wx, y: candidates[0].wy });
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
        this.polyline(g, jag, 14, r.color, 0.18);
        this.polyline(g, jag, 7, r.color, 0.45);
        this.polyline(g, jag, 2.6, 0xffffff, 1);
        // little forks that crackle off the main bolt
        for (let k = 2; k < jag.length - 1; k += 3) {
            if (Math.random() < 0.5) continue;
            const a = jag[k], ang = Math.random() * Math.PI * 2, len = 14 + Math.random() * 20;
            const mid = { x: a.x + Math.cos(ang) * len * 0.5 + (Math.random() - 0.5) * 8, y: a.y + Math.sin(ang) * len * 0.5 };
            const end = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
            this.polyline(g, [a, mid, end], 3, r.color, 0.5);
            this.polyline(g, [a, mid, end], 1.2, 0xffffff, 0.85);
        }
        game.objectLayer.addChild(g);
        this.bolts.push({ g, life: 16, max: 16, pts: points });
        points.forEach((pt) => { game.fx.burst(pt.x, pt.y, 18, 0xe6dcff, 6, 2.8, { size: 0.8, life: 18, glow: true }); game.fx.shockwave(pt.x, pt.y, 34, r.color, 12, 3); });
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
    fireNova(r, src) {
        const game = this.game;
        const p = src || game.state.player;
        const s = r.p;
        if (!this.nearestEnemies(p.wx, p.wy, s.radius * 1.35, 1).length || this.rings.length >= CAP.rings) return false;
        const g = new PIXI.Graphics();
        game.groundLayer.addChild(g);
        this.rings.push({ g, x: p.wx, y: p.wy, r: 12, maxR: s.radius, hit: new Set(), damage: this.dmg(r), rs: r, fade: 0, spin: Math.random() * 6 });
        game.fx.addShake(3);
        game.fx.shockwave(p.wx, p.wy, s.radius * 1.15, 0xe8fbff, 26, 6);
        game.fx.burst(p.wx, p.wy, 10, 0xe8fbff, 18, 4, { size: 0.8, life: 28, gravity: 0.05, up: 1.5, glow: true });
        game.audio.play('nova', { x: p.wx, y: p.wy });
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
            const alpha = Math.max(0, 1 - ring.fade / 22);
            const c = ring.rs.color;
            const R = ring.r;
            ring.g.clear();
            ring.g.beginFill(c, 0.16 * alpha);
            ring.g.drawCircle(ring.x, ring.y, R);
            ring.g.endFill();
            ring.g.beginFill(0xffffff, 0.08 * alpha);
            ring.g.drawCircle(ring.x, ring.y, R * 0.6);
            ring.g.endFill();
            // jagged ice crystals standing along the front of the wave
            const n = 22;
            ring.g.lineStyle(1.2, 0x6ad0ff, 0.8 * alpha);
            ring.g.beginFill(0xe8fbff, 0.85 * alpha);
            for (let k = 0; k < n; k++) {
                const a = ring.spin + (k / n) * Math.PI * 2, len = 12 + ((k * 7) % 5) * 4, w = 0.09;
                const bx = ring.x + Math.cos(a) * R, by = ring.y + Math.sin(a) * R;
                ring.g.drawPolygon([
                    ring.x + Math.cos(a - w) * (R - 6), ring.y + Math.sin(a - w) * (R - 6),
                    bx + Math.cos(a) * len, by + Math.sin(a) * len,
                    ring.x + Math.cos(a + w) * (R - 6), ring.y + Math.sin(a + w) * (R - 6)
                ]);
            }
            ring.g.endFill();
            ring.g.lineStyle(4, 0xd8f6ff, 0.9 * alpha);
            ring.g.drawCircle(ring.x, ring.y, R);
            ring.g.lineStyle(2, 0x6ad0ff, 0.6 * alpha);
            ring.g.drawCircle(ring.x, ring.y, Math.max(2, R - 12));
            ring.g.lineStyle(0);
            if (ring.r < ring.maxR && Math.random() < 0.5) {
                const a = Math.random() * Math.PI * 2;
                game.fx.burst(ring.x + Math.cos(a) * R, ring.y + Math.sin(a) * R, 8, 0xe8fbff, 1, 0.6, { size: 0.6, life: 22, gravity: 0.02, up: 1.2, glow: true });
            }
            if (ring.fade >= 22) { ring.g.destroy(); this.rings.splice(i, 1); }
        }
    }

    // ------------------------------------------------------------------ meteor
    fireMeteor(r, src) {
        const game = this.game;
        const p = src || game.state.player;
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
        game.audio.play('meteorFall', { x: candidates[0].wx, y: candidates[0].wy });
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
            if (Math.random() < 0.6) game.fx.burst(m.x + (1 - ease) * 150, m.y, 520 * (1 - ease) + 4, Math.random() < 0.5 ? 0xff8a3a : 0xffd070, 1, 0.6, { size: 0.9, life: 18, gravity: -0.02, up: 0.4, glow: true });
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
                game.audio.play('boom', { x: m.x, y: m.y });
                game.fx.flash(m.x, m.y, m.radius * 4, 0xffa040, 26);
                game.fx.shockwave(m.x, m.y, m.radius * 1.6, 0xffa040, 24, 7);
                game.fx.burst(m.x, m.y, 8, 0xffd070, 16, 4.5, { size: 1, life: 26, up: 3, glow: true });
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

    /** a tower casts a spell from its own position, on its own cooldown, with no hero bonuses */
    towerFire(rec, item, origin, delta) {
        const key = 'tw' + rec.id;
        this.timers[key] = (this.timers[key] ?? 30) - delta;
        if (this.timers[key] > 0) return;
        const r = this.resolved(item);
        this.srcMult = 1;
        let fired = false;
        switch (r.tpl.expr) {
            case 'bolt': fired = this.fireBolt(r, origin); break;
            case 'chain': fired = this.fireLightning(r, origin); break;
            case 'nova': fired = this.fireNova(r, origin); break;
            case 'meteor': fired = this.fireMeteor(r, origin); break;
        }
        this.srcMult = null;
        this.timers[key] = fired ? msToFrames(r.p.cooldown) : 0;
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
        const stick = g.input && g.input.aim();
        if (stick) return stick;                      // right stick aims dashes and blinks
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
        const g = this.game, p = g.state.player;
        const frames = Math.max(6, r.p.duration * 60 * 0.6);
        this.dashing = { dx: d.x, dy: d.y, left: frames, speed: r.p.range / frames, color: r.color, n: 0 };
        g.invulnUntil = Math.max(g.invulnUntil || 0, g.frame + r.p.duration * 60 + 6);
        g.fx.burst(p.wx, p.wy, 10, 0xe8f4ff, 14, 3, { size: 0.8, life: 16, glow: true });
        g.fx.shockwave(p.wx, p.wy, 46, 0xe8f4ff, 14, 4);
    }

    // translucent copy of the hero left behind while dashing
    afterimage(color) {
        const g = this.game, p = g.state.player;
        if (this.ghosts.length > 10) return;
        const c = new PIXI.Container();
        const body = new PIXI.Container();
        buildHero(body, p.heroId || 'aria');
        body.scale.x = p.facing || 1;
        c.addChild(body);
        c.position.set(p.wx, p.wy * TILT);
        c.zIndex = p.wy - 1;
        c.alpha = 0.7;
        const tint = new PIXI.Graphics();
        tint.beginFill(color, 0.55); tint.drawEllipse(0, -30, 15, 33); tint.endFill();
        tint.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(tint);
        g.objectLayer.addChild(c);
        this.ghosts.push({ c, life: 16, max: 16 });
    }

    updateDash(delta) {
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            const gh = this.ghosts[i];
            gh.life -= delta;
            gh.c.alpha = 0.7 * Math.max(0, gh.life / gh.max);
            if (gh.life <= 0) { gh.c.destroy({ children: true }); this.ghosts.splice(i, 1); }
        }
        const d = this.dashing;
        if (!d) return;
        const g = this.game;
        const p = g.state.player;
        const step = Math.min(delta, d.left);
        if ((d.n++ % 3) === 0) this.afterimage(d.color);
        g.world.tryMove(p, d.dx * d.speed * step, d.dy * d.speed * step * 1.2, p.radius, !!g.boat);
        d.left -= delta;
        // wind streaks
        g.fx.burst(p.wx - d.dx * 10, p.wy - d.dy * 10, 14 + Math.random() * 30, 0xe8f4ff, 1, 0.5, { size: 0.6, life: 12, gravity: 0, up: 0, glow: true });
        if (d.left <= 0) this.dashing = null;
    }

    blink(r) {
        const g = this.game;
        const p = g.state.player;
        const d = this.aimDir();
        const x0 = p.wx, y0 = p.wy;
        g.fx.burst(p.wx, p.wy, 20, r.color, 22, 3, { size: 0.9, life: 20, glow: true });
        g.fx.shockwave(p.wx, p.wy, 60, r.color, 16, 5);
        let dist = 0;
        for (let t = 16; t <= r.p.range; t += 16) {
            if (g.world.blocked(p.wx + d.x * t, p.wy + d.y * t, p.radius, !!g.boat)) break;
            dist = t;
        }
        p.wx += d.x * dist;
        p.wy += d.y * dist;
        g.invulnUntil = Math.max(g.invulnUntil || 0, g.frame + 14);
        g.fx.streak(x0, y0, p.wx, p.wy, r.color, 26, 18, 12);
        g.fx.burst(p.wx, p.wy, 20, r.color, 26, 3.4, { size: 0.9, life: 22, glow: true });
        g.fx.shockwave(p.wx, p.wy, 80, r.color, 20, 5);
        g.fx.pillar(p.wx, p.wy, r.color, 26, 46, 150);
        g.cam.x += d.x * dist * 0.5; g.cam.y += d.y * dist * 0.5;
    }

    startBarrier(r) {
        const g = this.game;
        this.barrierUntil = g.frame + r.p.duration * 60;
        this.barrierRadius = r.p.radius;
        this.barrierColor = r.color;
        g.fx.addShake(2);
        const p = g.state.player;
        g.fx.shockwave(p.wx, p.wy, r.p.radius * 1.6, r.color, 18, 5);
        g.fx.burst(p.wx, p.wy, 24, r.color, 16, 2.4, { size: 0.8, life: 24, glow: true });
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
        const a = left < 0.6 ? 0.45 + 0.4 * Math.sin(g.frame * 0.6) : 0.9;
        const b = this.barrierG;
        const R = this.barrierRadius, RY = R * TILT * 1.35, col = this.barrierColor, t = g.frame;
        b.clear();
        // bubble: soft fill, bright rim, a lit crescent and a turning hex lattice
        b.beginFill(col, 0.1 * a); b.drawEllipse(0, 0, R, RY); b.endFill();
        b.beginFill(0xffffff, 0.08 * a); b.drawEllipse(-R * 0.25, -RY * 0.35, R * 0.45, RY * 0.3); b.endFill();
        b.lineStyle(2.5, col, 0.9 * a); b.drawEllipse(0, 0, R, RY);
        b.lineStyle(6, col, 0.2 * a); b.drawEllipse(0, 0, R - 3, RY - 3);
        b.lineStyle(1.2, 0xffffff, 0.35 * a);
        for (let k = 0; k < 6; k++) {
            const a0 = t * 0.01 + (k / 6) * Math.PI * 2, a1 = a0 + Math.PI / 3;
            b.moveTo(Math.cos(a0) * R * 0.62, Math.sin(a0) * RY * 0.62);
            b.lineTo(Math.cos(a1) * R * 0.62, Math.sin(a1) * RY * 0.62);
            b.moveTo(Math.cos(a0) * R * 0.62, Math.sin(a0) * RY * 0.62);
            b.lineTo(Math.cos(a0) * R * 0.98, Math.sin(a0) * RY * 0.98);
        }
        b.lineStyle(0);
        // orbiting runes
        b.beginFill(0xffffff, 0.9 * a);
        for (let k = 0; k < 4; k++) {
            const ang = -t * 0.04 + (k / 4) * Math.PI * 2, rx = Math.cos(ang) * R, ry = Math.sin(ang) * RY;
            b.drawPolygon([rx, ry - 4, rx + 3, ry, rx, ry + 4, rx - 3, ry]);
        }
        b.endFill();
        b.position.set(p.wx, p.wy * TILT - 22);
        b.zIndex = p.wy + 40;
    }
}

export { MAX_AUTO, MAX_ACTIVE, TEMPLATES, RUNES };
