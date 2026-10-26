// @ts-nocheck -- game glue in the style of the other app systems
// The training dummy in every town: spells can hit it and it shows the damage per second of the last few seconds,
// so loadouts and runes can be compared. It is not a monster: it never moves, attacks, wakes, counts as a threat,
// drops anything or dies, and it raises no kill events.
import { EntityManager } from '../render/entities';
import { DpsMeter } from '../core/spells/meter';
import { ui as uiBridge } from '../ui/bridge';
import { WORLD_CONFIG } from '../core/config';

export const DUMMY_TYPE = { name: 'Training dummy', art: 'dummy', color: 0xc8a070, radius: 16, speed: 0, health: 5000, damage: 0, experience: 0, flying: false };
/** The meter shows while the player is this close (world units). */
const NEAR = 560;

export class TrainingDummy {
    constructor(game) {
        this.game = game;
        this.e = null;
        this.meter = new DpsMeter(5);
    }

    spawn(x, y) {
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
        g.map.markers.push({ tx: f.x / WORLD_CONFIG.tile, ty: f.y / WORLD_CONFIG.tile, icon: 'dummy' });
        this.e = e;
        this.meter.reset();
        return e;
    }

    /** Called from Game.damageEnemy instead of hurting it. */
    hit(amount) {
        this.meter.add(this.game.frame / 60, amount);
    }

    update() {
        const g = this.game, e = this.e;
        if (!e) return;
        if (e.destroyed || !g.state.enemies.includes(e)) { this.clear(); return; }
        e.health = e.maxHealth;
        e.kvx = e.kvy = 0;
        e.slowUntil = 0;
        if ((g.frame | 0) % 10) return;
        const p = g.state.player, now = g.frame / 60;
        const near = p && Math.hypot(e.wx - p.wx, e.wy - p.wy) < NEAR;
        if (!near && this.meter.idle(now, 3)) this.meter.reset();
        const show = near && !this.meter.idle(now);
        const next = show ? { dps: Math.round(this.meter.dps(now)), total: Math.round(this.meter.total), peak: Math.round(this.meter.peak) } : null;
        const cur = uiBridge.dummy.value;
        if (!cur !== !next || (cur && next && (cur.dps !== next.dps || cur.total !== next.total))) uiBridge.dummy.value = next;
    }

    clear() {
        this.e = null;
        this.meter.reset();
        if (uiBridge.dummy.value) uiBridge.dummy.value = null;
    }
}
