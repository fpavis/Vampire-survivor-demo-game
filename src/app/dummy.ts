// @ts-nocheck -- game glue in the style of the other app systems
// The training ground in every town: three dummies that spells can hit, and a meter of the damage per second of
// the last few seconds, for all of them together and for each skill on its own (its hits, burns, zones, echoes,
// the runes it sets off), so loadouts, runes and spells that hit several targets can be compared. A dummy is not a
// monster: it never moves, attacks, wakes, counts as a threat, drops anything or dies, and it raises no kill events.
import { EntityManager } from '../render/entities';
import { SkillMeter } from '../core/spells/skillMeter';
import { TEMPLATES } from '../core/spells/spells';
import { ui as uiBridge } from '../ui/bridge';
import { WORLD_CONFIG } from '../core/config';

export const DUMMY_TYPE = { name: 'Training dummy', art: 'dummy', color: 0xc8a070, radius: 16, speed: 0, health: 5000, damage: 0, experience: 0, flying: false };
/** The meter shows while the player is this close to a dummy (world units). */
const NEAR = 620;
/** How each kind of damage reads on the meter. */
export const KIND_LABEL = {
    hit: '', dot: 'zone', burn: 'burn', echo: 'echo', 'rune:spark': 'spark', 'rune:burst': 'burst', 'rune:shard': 'shards',
    linked: 'linked', assist: 'assist', tower: 'tower', other: 'ground'
};

export class TrainingDummy {
    constructor(game) {
        this.game = game;
        this.list = [];
        this.meter = new SkillMeter(5);
    }

    /** The first dummy (one is enough for most checks). */
    get e() { return this.list[0] || null; }

    /** The training ground's dummies, and one marker on the map for the ground. */
    spawnAll(spots) {
        const out = spots.map((s) => this.spawn(s.x, s.y, false));
        const mid = out[Math.floor(out.length / 2)];
        if (mid) this.game.map.markers.push({ tx: mid.wx / WORLD_CONFIG.tile, ty: mid.wy / WORLD_CONFIG.tile, icon: 'dummy' });
        return out;
    }

    spawn(x, y, marker = true) {
        const g = this.game;
        const f = g.world.findFree(x, y, DUMMY_TYPE.radius);
        const e = EntityManager.createEnemy('DUMMY', f.x, f.y, DUMMY_TYPE);
        e.uid = ++g.uidCounter;
        e.dummy = true;
        e.level = 0;                                  // no level tag
        e.experienceValue = 0;
        e.surfSpeed = 1;
        g.objectLayer.addChild(e);
        EntityManager.place(e);
        g.occlusion.float(e, e.hpBar.bar);
        g.state.enemies.push(e);
        if (marker) g.map.markers.push({ tx: f.x / WORLD_CONFIG.tile, ty: f.y / WORLD_CONFIG.tile, icon: 'dummy' });
        if (!this.list.length) this.meter.reset();
        this.list.push(e);
        return e;
    }

    /** Called from Game.damageEnemy instead of hurting it. */
    hit(e, amount, source) {
        this.meter.add(this.game.frame / 60, amount, source);
        e.lastHitAt = this.game.frame;
    }

    reset() {
        this.meter.reset();
        uiBridge.dummy.value = null;
    }

    update() {
        const g = this.game;
        if (!this.list.length) return;
        if (this.list.some((e) => e.destroyed || !g.state.enemies.includes(e))) { this.clear(); return; }
        for (const e of this.list) { e.health = e.maxHealth; e.kvx = e.kvy = 0; e.slowUntil = 0; }
        if ((g.frame | 0) % 10) return;
        const p = g.state.player, now = g.frame / 60;
        const near = p && this.list.some((e) => Math.hypot(e.wx - p.wx, e.wy - p.wy) < NEAR);
        if (!near && this.meter.idle(now, 3)) this.meter.reset();
        const show = near && !this.meter.idle(now);
        if (!show) { if (uiBridge.dummy.value) uiBridge.dummy.value = null; return; }
        const hit = this.list.filter((e) => g.frame - (e.lastHitAt ?? -1e9) < 300).length;
        const rows = this.meter.breakdown(now).slice(0, 8).map((r) => {
            const t = r.tpl && TEMPLATES[r.tpl];
            return { key: r.key, name: t ? t.name : 'Other', icon: t ? t.icon : 'target', kind: KIND_LABEL[r.kind] ?? r.kind, dps: Math.round(r.dps), share: r.share };
        });
        const next = { dps: Math.round(this.meter.dps(now)), total: Math.round(this.meter.total), peak: Math.round(this.meter.peak), hit, of: this.list.length, rows };
        const cur = uiBridge.dummy.value;
        if (!cur || cur.dps !== next.dps || cur.total !== next.total || cur.hit !== next.hit || cur.rows.length !== next.rows.length) uiBridge.dummy.value = next;
    }

    clear() {
        this.list = [];
        this.meter.reset();
        if (uiBridge.dummy.value) uiBridge.dummy.value = null;
    }
}
