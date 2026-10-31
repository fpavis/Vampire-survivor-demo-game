// @ts-nocheck -- game glue in the style of the other app systems
// Random overworld events over the typed rules in core/world/worldEvents: every few minutes out in the world (three
// times as often in the corrupted lands) a warband, a swarm or a pack of hunters comes for the party, or, near one
// of the party's spires, obelisks or beacons, a siege gathers round it and silences it. A banner and a roar say
// where, a marker on the map follows the group, beating it pays a chest roll and gold, and running far enough away
// loses them (besiegers give up and leave the tower be).
import { WORLD_CONFIG } from '../core/config';
import { EVENT_DEFS, SIEGE_REACH, eventAllowed, eventSpawns, nextEventDelay, pickEvent, siegeSpawns } from '../core/world/worldEvents';
import { TOWER_DEFS, UPGRADABLE } from '../core/world/towers';
import { pickRosterEntry } from '../core/world/population';
import { engage } from '../core/ai/ai';
import { ui as uiBridge } from '../ui/bridge';

const T = WORLD_CONFIG.tile;
const SPAWN_RING = [650, 900];     // at least this far (world px), and always beyond the corners of the screen
const LOSE_AT = 1600;              // run this far from them and they lose the trail
const SECOND_WAVE = 240;           // frames before a swarm's second group arrives
const COMPASS = ['EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST', 'NORTH', 'NORTH-EAST'];

export class WorldEventSystem {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset() {
        this.active = null;
        this.timer = null;
        this.outSeconds = 0;
        this.seq = 0;
        if (this.game.map) this.game.map.markers = this.game.map.markers.filter((m) => !m.event);
    }

    update(delta) {
        const g = this.game, p = g.state.player;
        if (!p || g.mode !== 'overworld' || g.busy || g.state.gameOver) return;
        this.outSeconds += delta / 60;
        if (this.active) { this.tick(delta); return; }
        const blighted = !!g.inBlight;
        if (this.timer === null) this.timer = nextEventDelay(Math.random, blighted);
        // stepping into the blight brings the next one closer
        if (blighted && this.timer > 90) this.timer = nextEventDelay(Math.random, true);
        this.timer -= delta / 60;
        if (this.timer > 0) return;
        if (!eventAllowed(this.context())) { this.timer = 20; return; }    // not now: look again in a while
        const tower = this.siegeable();
        const kind = pickEvent(Math.random, !!tower);
        this.start(kind, kind === 'siege' ? tower : null);
    }

    /** The nearest of the party's spires, obelisks and beacons within reach of a siege, or null. */
    siegeable() {
        const g = this.game, p = g.state.player;
        let best = null, bd = SIEGE_REACH;
        for (const r of g.towers.recs) {
            if (!r.built || r.siege || !UPGRADABLE.includes(r.kind)) continue;
            const d = Math.hypot((r.tx + 0.5) * T - p.wx, (r.ty + 0.5) * T - p.wy);
            if (d < bd) { bd = d; best = r; }
        }
        return best;
    }

    /** What holds an event back: sailing, the start, a town nearby, a fight already on, a boss, a safe zone. */
    context() {
        const g = this.game, p = g.state.player;
        const tx = Math.floor(p.wx / T), ty = Math.floor(p.wy / T);
        let town = Infinity;
        for (const q of g.overworld.poisNear(tx, ty, 40)) if (q.type === 'city') town = Math.min(town, Math.hypot(q.tx - tx, q.ty - ty));
        return {
            overworldSeconds: this.outSeconds,
            sailing: !!g.boat,
            tilesFromStart: Math.hypot(tx, ty),
            tilesFromTown: town,
            engaged: g.engagedNear || 0,
            bossNear: g.state.enemies.some((e) => e.isBoss && !e.dead && Math.hypot(e.wx - p.wx, e.wy - p.wy) < 1100),
            safe: !!(g.sites && (g.sites.safeAt(p.wx, p.wy) || g.sites.waves.length))
        };
    }

    /** Start an event now (the dev tools call this directly). A siege needs a tower (the nearest one by default). */
    start(kind, rec = null) {
        const g = this.game, p = g.state.player;
        const def = EVENT_DEFS[kind];
        if (!def || !p || this.active) return null;
        if (kind === 'siege') return this.startSiege(rec || this.siegeable());
        // just past the corners of the view, so they never pop in on screen (a wide window needs a wider ring)
        const edge = Math.hypot(g.viewW, g.viewH) / 2 + 60;
        const spawns = eventSpawns(kind, Math.random, Math.max(SPAWN_RING[0], edge), Math.max(SPAWN_RING[1], edge + 250));
        const level = g.zoneLevelNow || 1, group = g.zoneGroup || 'field';
        // a warband is one kind with a leader, a swarm the weakest of the region, hunters its strongest
        const main = pickRosterEntry(group, level, Math.random()).type;
        const weak = pickRosterEntry(group, 1, Math.random()).type;
        const strong = pickRosterEntry(group, level, 0.999).type;
        const typeFor = (s) => (kind === 'swarm' ? weak : kind === 'hunters' ? strong : s.elite ? strong : main);
        const id = `ev${++this.seq}`;
        const a = { id, kind, def, members: [], pending: [], t: 0, bearing: 0 };
        let sx = 0, sy = 0;
        for (const s of spawns) { sx += s.dx; sy += s.dy; }
        a.bearing = Math.atan2(sy, sx);
        for (const s of spawns) {
            if (s.wave > 0) a.pending.push(s);
            else this.spawn(a, s, typeFor(s), level);
        }
        a.typeFor = typeFor;
        a.level = level;
        this.active = a;
        const dir = COMPASS[(Math.round(a.bearing / (Math.PI / 4)) + 8) % 8];
        g.ui.banner(`${def.banner} FROM THE ${dir}`, 0xff9a4a, 'warning');
        g.audio.play('roar');
        g.ui.logMessage(`${def.name} is coming from the ${dir.toLowerCase()}`, 'warning', false);
        this.marker();
        return a;
    }

    /** Besiegers gather all round a tower and hold there (they engage the party when it comes near). */
    startSiege(rec) {
        const g = this.game, p = g.state.player;
        if (!rec || this.active) return null;
        const def = EVENT_DEFS.siege, tower = TOWER_DEFS[rec.kind];
        const c = { x: (rec.tx + 0.5) * T, y: (rec.ty + 0.5) * T };
        const level = g.zoneLevelNow || 1, group = g.zoneGroup || 'field';
        const main = pickRosterEntry(group, level, Math.random()).type;
        const strong = pickRosterEntry(group, level, 0.999).type;
        const a = { id: `ev${++this.seq}`, kind: 'siege', def, members: [], pending: [], t: 0, bearing: Math.atan2(c.y - p.wy, c.x - p.wx), rec, level, typeFor: () => main };
        for (const s of siegeSpawns(Math.random, T)) {
            const e = this.spawn(a, { dx: c.x + s.dx - p.wx, dy: c.y + s.dy - p.wy, elite: s.elite }, s.elite ? strong : main, level, false);
            e.home = { x: c.x, y: c.y + T * 0.3, r: 4 * T };
            e.leash = 1100;
            e.shell = 'idle';
        }
        rec.siege = a.id;
        this.active = a;
        const dir = COMPASS[(Math.round(a.bearing / (Math.PI / 4)) + 8) % 8];
        g.ui.banner(`THE ${tower.name.toUpperCase()} IS UNDER SIEGE`, 0xff6a4a, 'warning');
        g.audio.play('roar');
        g.ui.logMessage(`Monsters besiege your ${tower.name} to the ${dir.toLowerCase()}: it is silenced until they are beaten`, 'warning', false);
        this.marker();
        uiBridge.version.value++;
        return a;
    }

    spawn(a, s, type, level, engageNow = true) {
        const g = this.game, p = g.state.player, def = g.enemyTypes[type];
        let x = p.wx + s.dx, y = p.wy + s.dy;
        if (!def.flying && g.world.blocked(x, y, def.radius)) { const f = g.world.findFree(x, y, def.radius); x = f.x; y = f.y; }
        const e = g.makeEnemy(type, x, y, { level, elite: s.elite });
        e.eventId = a.id;
        if (engageNow) engage(g, e, false);
        g.fx.burst(x, y, 10, 0xff7a3a, 10, 2, { size: 0.7, life: 20, glow: true });
        a.members.push(e);
        return e;
    }

    /** A marker on the map where the group is (it moves with them). */
    marker() {
        const g = this.game, a = this.active;
        g.map.markers = g.map.markers.filter((m) => !m.event);
        if (!a) { g.map.dirty = true; return; }
        const alive = a.members.filter((e) => !e.dead);
        if (!alive.length) return;
        // a siege is marked on its tower; a roaming group where it is
        const cx = a.rec ? (a.rec.tx + 0.5) * T : alive.reduce((s, e) => s + e.wx, 0) / alive.length;
        const cy = a.rec ? (a.rec.ty + 0.5) * T : alive.reduce((s, e) => s + e.wy, 0) / alive.length;
        g.map.markers.push({ tx: cx / T, ty: cy / T, icon: 'warning', event: true });
        g.map.dirty = true;
        return { x: cx, y: cy };
    }

    tick(delta) {
        const g = this.game, a = this.active, p = g.state.player;
        a.t += delta;
        if (a.pending.length && a.t >= SECOND_WAVE) {
            for (const s of a.pending) this.spawn(a, s, a.typeFor(s), a.level);
            a.pending = [];
            g.audio.play('warn');
        }
        const alive = a.members.filter((e) => !e.dead);
        if (!alive.length && !a.pending.length) { this.win(); return; }
        if ((g.frame | 0) % 30 === 0) {
            const at = this.marker();
            // far enough away, they lose the trail and give up
            if (at && Math.hypot(at.x - p.wx, at.y - p.wy) > LOSE_AT && !alive.some((e) => Math.hypot(e.wx - p.wx, e.wy - p.wy) < LOSE_AT * 0.8)) this.lose();
        }
    }

    win() {
        const g = this.game, a = this.active, p = g.state.player;
        this.end();
        if (a.rec) { a.rec.siege = null; uiBridge.version.value++; }
        g.ui.banner(a.rec ? 'THE SIEGE IS BROKEN' : `${a.def.name.toUpperCase()} IS BEATEN`, 0xffd84a, 'swords');
        g.audio.play('fanfare');
        g.grantLoot(a.kind === 'hunters' ? 1 : 0);
        const gold = Math.round(30 + a.level * 6 + a.members.length * 3);
        for (let i = 0; i < 8; i++) g.dropGem(p.wx + (Math.random() - 0.5) * 120, p.wy + 30 + Math.random() * 40, Math.round(gold / 8), 'coin');
        g.events.emit('WorldEventEnded', { kind: a.kind, won: true });
        g.requestSave('event');
    }

    lose() {
        const g = this.game, a = this.active;
        for (const e of a.members) if (!e.dead) { e.dead = true; e.silent = true; }
        g.reap();
        this.end();
        if (a.rec) { a.rec.siege = null; uiBridge.version.value++; }
        g.ui.toast(a.rec ? `The besiegers gave up on your ${TOWER_DEFS[a.rec.kind].name}` : `${a.def.name} lost your trail`, 'road');
        g.events.emit('WorldEventEnded', { kind: a.kind, won: false });
    }

    end() {
        this.active = null;
        this.timer = nextEventDelay(Math.random, !!this.game.inBlight);
        this.marker();
    }

    /** Leaving the overworld (a place, a respawn, a load) calls an event off. */
    cancel() {
        const a = this.active;
        if (!a) return;
        for (const e of a.members) if (!e.dead) { e.dead = true; e.silent = true; }
        if (a.rec) a.rec.siege = null;
        this.active = null;
        this.timer = null;
    }
}
