// @ts-nocheck -- game glue in the style of the other app systems
// Fast travel over the network of teleporters: every town the party has entered has one (it is attuned on the
// first visit), and every waypoint the party built is a node too. Using either opens the world map in travel mode;
// picking a destination there pays the fare (free only between two waypoints) and moves the party.
import { ui as uiBridge } from '../ui/bridge';
import { WORLD_CONFIG } from '../core/config';
import { destinations, townNodeId, travelFare } from '../core/world/travel';

const T = WORLD_CONFIG.tile;

export class TravelSystem {
    constructor(game) {
        this.game = game;
    }

    /** Every node the party can travel between: attuned town teleporters and built waypoints. */
    nodes() {
        const g = this.game, out = [];
        for (const c of g.session.cities) out.push({ id: townNodeId(c.id), kind: 'town', name: c.name, tx: Math.floor(c.ex / T), ty: Math.floor(c.ey / T), poiId: c.id });
        for (const r of g.towers.waypoints()) out.push({ id: r.id, kind: 'waypoint', name: this.waypointName(r), tx: r.tx, ty: r.ty });
        return out;
    }

    node(id) { return this.nodes().find((n) => n.id === id) || null; }

    /** A waypoint is named after the region it stands in ("Waypoint, the Amber Reach"). */
    waypointName(r) {
        const ow = this.game.overworld;
        const reg = ow && ow.region ? ow.region(ow.regionId(r.tx, r.ty)) : null;
        return reg ? `Waypoint, ${reg.name}` : `Waypoint at ${r.tx}, ${r.ty}`;
    }

    /** Where one can go from a node, nearest first, each with its fare. */
    from(id) {
        const here = this.node(id);
        return here ? destinations(here, this.nodes()) : [];
    }

    /** Open the world map to pick a destination, standing at node `id`. */
    open(id) {
        const g = this.game;
        if (!this.node(id) || g.busy) return;
        g.audio.play('equip');
        g.ui.toggleMap(g, 'travel', id);
    }

    /** Pay and go. Returns false (with a reason on screen) when the trip cannot be made. */
    go(fromId, toId) {
        const g = this.game;
        const a = this.node(fromId), b = this.node(toId);
        if (!a || !b || a.id === b.id || g.busy || g.boat) return false;
        const fare = travelFare(a, b);
        if (g.state.wallet.gold < fare) { g.ui.toast(`The fare is ${fare} gold`, 'res-gold'); g.audio.play('deny'); return false; }
        g.state.wallet.gold -= fare;
        uiBridge.wallet.value = { ...g.state.wallet };
        if (uiBridge.worldMap.value) g.ui.toggleMap(g);
        g.busy = true;
        g.state.pointerDown = false;
        g.state.keys = {};
        g.audio.play('warp');
        g.ui.fade(1, 0.1, () => {
            if (g.mode === 'interior') g.leavePlaceNow();
            if (b.kind === 'town') {
                const poi = g.quests.poiById(b.poiId);
                g.arriveAt(poi, 'teleporter');
            } else {
                const rec = g.towers.byId(b.id);
                g.towers.arriveAt(rec);
            }
            const p = g.state.player;
            g.fx.pillar(p.wx, p.wy, b.kind === 'town' ? 0xffd070 : 0xb06af0, 60, 60, 220);
            g.ui.toast(fare ? `Travelled to ${b.name} for ${fare} gold` : `Travelled to ${b.name}`, b.kind === 'town' ? 'teleporter' : 'tower-waypoint');
            g.requestSave('travel', true);
            g.ui.fade(0, 0.07, () => { g.busy = false; });
        });
        return true;
    }
}
