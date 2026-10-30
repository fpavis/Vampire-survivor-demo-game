// @ts-nocheck -- game glue in the style of the other app systems
// The traveller on an escort job: walks after the hero on the overworld, waits when left far behind, takes half the
// harm a monster touching it would deal the hero (and mends when none has for a while), and pays on reaching the
// town it is bound for. If it falls, the job is lost. It is not saved: an unfinished escort starts again beside
// the hero, whole, whenever the party is out in the world (after loading, or stepping out of a place).
import * as PIXI from 'pixi.js';
import { EntityManager } from '../render/entities';
import { makeLabel } from '../render/labels';
import { abandonQuest } from '../core/quest/quests';
import { enemyDamageScale } from '../core/world/difficulty';

/** Health at the job's level 1; it grows with monster damage. */
const BASE_HP = 160;
/** Monsters in contact hurt the traveller at this share of what they would do to the hero. */
const HARM = 0.5;

export class EscortSystem {
    constructor(game) {
        this.game = game;
        this.c = null;          // the traveller (a villager critter)
        this.hp = 0;
        this.max = 0;
        this.hurtAt = -999;
        this.bar = null;
    }

    /** The escort job under way, if any. */
    job() {
        const st = this.game.quests.state;
        for (const [id, q] of Object.entries(st.active)) {
            const def = q.def;
            if (!def) continue;
            const i = def.objectives.findIndex((o) => o.type === 'escort');
            if (i >= 0 && q.progress[i] < 1) return { id, def, o: def.objectives[i], target: q.targets[i] };
        }
        return null;
    }

    active() { return !!this.job(); }

    update(delta) {
        const g = this.game, j = this.job();
        if (this.c && (!j || this.c.destroyed || !g.critters.list.includes(this.c))) this.drop();
        if (!j || g.busy) return;
        // arriving: the traveller walks into town with the party and pays
        if (g.mode === 'interior' && g.interiorPoi && g.interiorPoi.id === j.target) { this.arrive(j); return; }
        if (g.mode !== 'overworld') return;
        if (!this.c) this.spawn(j);
        const c = this.c, p = g.state.player;
        if (g.boat) { c.visible = false; c.wx = p.wx; c.wy = p.wy; return; }
        c.visible = true;
        let harm = 0;
        for (const e of g.state.enemies) {
            if (e.dead || e.dummy) continue;
            const r = (e.radius || 14) + c.radius + 4;
            const dx = e.wx - c.wx, dy = e.wy - c.wy;
            if (dx * dx + dy * dy < r * r) harm += e.damage * HARM * (delta / 60);
        }
        if (harm > 0 && !g.godMode) {
            this.hp -= harm;
            if (g.frame - this.hurtAt > 30) g.fx.popup(c.wx, c.wy, 'Help!', 0xff8a8a, 14, 60);
            this.hurtAt = g.frame;
        } else if (g.frame - this.hurtAt > 180) this.hp = Math.min(this.max, this.hp + this.max * 0.02 * (delta / 60));
        this.drawBar();
        if (this.hp <= 0) this.fall(j);
    }

    spawn(j) {
        const g = this.game, p = g.state.player;
        const at = g.world.findFree(p.wx - 40, p.wy + 30, 9);
        const hue = j.o.npc.length * 7 + j.o.npc.charCodeAt(0);
        const c = g.critters.create('villager', at.x, at.y, { hue, tame: true, flee: 0 });
        c.follow = true;
        const name = makeLabel(j.o.npc, 0xffffff);
        name.y = -60;
        this.bar = new PIXI.Graphics();
        this.bar.y = -56;
        c.addChild(this.bar);
        g.occlusion.float(c, name);
        this.c = c;
        this.max = Math.round(BASE_HP * enemyDamageScale(j.def.level || 1));
        this.hp = this.max;
        this.hurtAt = -999;
    }

    drawBar() {
        const b = this.bar;
        if (!b) return;
        const f = Math.max(0, this.hp / this.max);
        b.clear();
        b.beginFill(0x101018, 0.8); b.drawRect(-17, 0, 34, 5); b.endFill();
        b.beginFill(f > 0.5 ? 0x6ad86a : f > 0.25 ? 0xffc84a : 0xff5a5a); b.drawRect(-16, 1, 32 * f, 3); b.endFill();
    }

    drop() {
        if (this.c && !this.c.destroyed) {
            const g = this.game;
            g.critters.list = g.critters.list.filter((x) => x !== this.c);
            EntityManager.cleanup(this.c);
        }
        this.c = null;
        this.bar = null;
    }

    fall(j) {
        const g = this.game, c = this.c;
        g.fx.burst(c.wx, c.wy, 20, 0xff8a8a, 24, 2.6, { size: 0.8, life: 40, up: 2.4 });
        this.drop();
        abandonQuest(g.quests.state, j.id);
        g.ui.banner(`${j.o.npc.toUpperCase()} HAS FALLEN`, 0xff6a6a);
        g.ui.toast(`${j.def.title}: the job is lost`, 'skull');
        g.audio.play('deny');
        g.quests.publish();
        g.requestSave('quest', true);
    }

    arrive(j) {
        const g = this.game, poi = g.interiorPoi;
        this.drop();
        g.quests.fire({ type: 'arrive', npc: j.o.npc, poi: { id: poi.id, type: poi.type, group: poi.group } });
        g.quests.turnInQuest(j.id);
        g.ui.toast(`${j.o.npc}: “${poi.name}, at last. I would never have made it alone.”`, 'person');
    }
}
