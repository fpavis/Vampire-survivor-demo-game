// @ts-nocheck -- Pixi-bound runtime over the typed tower rules (core/world/towers)
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { BIOME } from '../core/world/biomes';
import {
    CLAIMED_DISCOUNT, DIRS, TOWER_DEFS, UPGRADABLE, boatSpot, canUpgrade, checkPlacement, deposit, editMap, isFunded, levelOf, newTower,
    plateauDecor, progressOf, remaining, stageOf, totalOf, towerCost, towerEdits, towerPower, upgrade, upgradeCost
} from '../core/world/towers';
import { TEMPLATES } from '../core/spells/spells';
import { ui as uiBridge } from '../ui/bridge';

const T = WORLD_CONFIG.tile;
const TILT = WORLD_CONFIG.tilt;
const NEAR = 1700;                    // towers farther than this from the hero are not simulated

const centreOf = (rec) => ({ x: (rec.tx + 0.5) * T, y: (rec.ty + 0.5) * T });
const costText = (c) => ['gold', 'wood', 'stone', 'iron'].filter((k) => c[k] > 0).map((k) => `${c[k]} ${k}`).join(', ');

/** Construction sites, finished towers, build mode, waypoints and the terrain edits towers make. */
export class TowerSystem {
    constructor(game) {
        this.game = game;
        this.recs = [];
        this.build = null;             // active placement: { kind, tx, ty, valid, reason, plan, ghost, sprite }
        this.shown = new Map();        // tower id -> ground graphics (ward dome ...)
        this.ceremony = null;
        this.timers = {};
    }

    // ------------------------------------------------------------- persistence
    serialize() {
        return this.recs.map((r) => ({
            id: r.id, kind: r.kind, tx: r.tx, ty: r.ty, dir: r.dir, len: r.len, delivered: { ...r.delivered }, built: r.built, spell: r.spell,
            ...(levelOf(r) > 1 ? { level: levelOf(r) } : {}), ...(r.claimed ? { claimed: true } : {})
        }));
    }

    load(saved) {
        this.cancelBuild();
        this.clearDisplays();
        this.recs = (saved || []).map((r) => ({ ...r, delivered: { gold: 0, wood: 0, stone: 0, iron: 0, ...r.delivered }, siege: null }));
        this.rebuildWorld(false);
    }

    clearDisplays() {
        for (const g of this.shown.values()) g.destroy();
        this.shown.clear();
    }

    byId(id) { return this.recs.find((r) => r.id === id); }
    builtOf(kind) { return this.recs.filter((r) => r.built && (!kind || r.kind === kind)); }
    holderOf(uid) { return this.recs.some((r) => r.spell === uid); }

    // ------------------------------------------------------------ world edits
    /** hand the edits and the tower sprites to the world renderer */
    rebuildWorld(invalidate = true, around = null) {
        const w = this.game.world;
        const decor = new Map();
        for (const r of this.recs) {
            const c = centreOf(r);
            const items = [];
            const base = this.baseOf(r.kind, r.tx, r.ty, r.dir);
            if (r.built) {
                items.push({ type: `tower_${r.kind}`, x: base.x, y: base.y, variant: 0 });
                if (r.kind === 'climb') items.push(...plateauDecor(r, this.game.overworld.seed));
            } else items.push({ type: 'scaffold', x: base.x, y: base.y, variant: stageOf(r) });
            decor.set(r.id, items);
        }
        w.setTowerWorld(editMap(this.recs), decor);
        if (!invalidate) return;
        const rec = around;
        if (rec) {
            let x0 = rec.tx - 3, x1 = rec.tx + 3, y0 = rec.ty - 3, y1 = rec.ty + 3;
            for (const [x, y] of towerEdits(rec)) { x0 = Math.min(x0, x - 2); x1 = Math.max(x1, x + 2); y0 = Math.min(y0, y - 2); y1 = Math.max(y1, y + 2); }
            w.invalidateTiles(x0, y0, x1, y1);
        } else w.invalidateTiles(-1e5, -1e5, 1e5, 1e5);
        const g = this.game;
        w.update(g.cam.x, g.cam.y, g.viewW, g.viewH, true);
        g.flow.centerTx = NaN;
        g.unstickPlayer();          // a site, a stage or a finished tower never traps the hero
    }

    /** where the sprite stands; spans and piers pull it back so the first plank is never under the gatehouse */
    baseOf(kind, tx, ty, dir) {
        const x = (tx + 0.5) * T, y = (ty + 0.5) * T + T * 0.38;
        if (kind !== 'bridge' && kind !== 'dock') return { x, y };
        const [dx, dy] = DIRS[dir];
        return { x: x - dx * T * 0.3, y: y - dy * T * 0.3 };
    }

    // --------------------------------------------------------------- placement
    env() {
        const g = this.game;
        const src = g.overworld;
        return {
            baseBiomeAt: (x, y) => src.biomeAt(x, y),
            biomeAt: (x, y) => g.world.biomeAt(x, y),
            towers: this.recs,
            pois: []
        };
    }

    check(kind, tx, ty) {
        const e = this.env();
        e.pois = this.game.overworld.poisNear(tx, ty, 20).map((p) => ({ tx: p.tx, ty: p.ty, type: p.type }));
        return checkPlacement(kind, tx, ty, e);
    }

    startBuild(kind) {
        const g = this.game;
        if (g.mode !== 'overworld') { g.ui.toast('Towers can only be built out in the world'); return; }
        if (g.boat) { g.ui.toast('Step ashore to build'); return; }
        this.cancelBuild();
        const ghost = new PIXI.Graphics();
        g.groundLayer.addChild(ghost);
        const sprite = new PIXI.Sprite();
        sprite.alpha = 0.6;
        sprite.zIndex = 1e7;
        g.objectLayer.addChild(sprite);
        this.build = { kind, tx: 0, ty: 0, valid: false, reason: '', plan: null, ghost, sprite, last: '' };
        g.ui.closeMenu();          // placing happens in the world: the menu steps aside
        this.updateBuild();
        g.audio.play('equip');
    }

    cancelBuild() {
        const b = this.build;
        if (!b) return false;
        b.ghost.destroy(); b.sprite.destroy();
        this.build = null;
        uiBridge.build.value = null;
        return true;
    }

    /** where the ghost sits: under the mouse, or a few tiles ahead of the hero for keyboard and touch play */
    ghostTile() {
        const g = this.game;
        const p = g.state.player;
        if (g.pointerKind === 'mouse' && g.state.pointerPosition) {
            const ptr = g.state.pointerPosition;
            const w = g.screenToWorld(ptr.x, ptr.y);
            return { tx: Math.floor(w.x / T), ty: Math.floor(w.y / T) };
        }
        const d = g.lastMove && (g.lastMove.x || g.lastMove.y) ? g.lastMove : { x: p.facing || 1, y: 0 };
        return { tx: Math.floor((p.wx + d.x * T * 3.4) / T), ty: Math.floor((p.wy + d.y * T * 3.4) / T) };
    }

    updateBuild() {
        const b = this.build;
        if (!b) return;
        const g = this.game;
        const { tx, ty } = this.ghostTile();
        const p = g.state.player;
        const far = Math.hypot((tx + 0.5) * T - p.wx, (ty + 0.5) * T - p.wy) > T * 9;
        const key = `${tx},${ty},${this.recs.length}`;
        if (key !== b.last) {
            b.last = key;
            b.tx = tx; b.ty = ty;
            const r = far ? { ok: false, reason: 'Too far away: move closer' } : this.check(b.kind, tx, ty);
            b.valid = r.ok; b.reason = r.reason || ''; b.plan = r.plan || null;
            const def = TOWER_DEFS[b.kind];
            const gr = b.ghost;
            gr.clear();
            const col = b.valid ? 0x5aff8a : 0xff5a4a;
            const foot = b.kind === 'dock' || b.kind === 'bridge' ? 0 : 1;
            for (let j = -foot; j <= foot; j++) for (let i = -foot; i <= foot; i++) {
                gr.beginFill(col, 0.28); gr.lineStyle(2, col, 0.9);
                gr.drawRect((tx + i) * T + 2, (ty + j) * T + 2, T - 4, T - 4);
                gr.endFill();
            }
            if (b.valid && b.plan) {
                const prev = { ...newTower(b.kind, tx, ty, b.plan), built: true };
                gr.lineStyle(0);
                for (const [x, y] of towerEdits(prev)) { gr.beginFill(0xffe27a, 0.28); gr.drawRect(x * T + 4, y * T + 4, T - 8, T - 8); gr.endFill(); }
            }
            const tex = g.world.decorTextures[`tower_${b.kind}`][0];
            b.sprite.texture = tex.texture;
            b.sprite.anchor.set(0.5, tex.anchorY);
            const base = this.baseOf(b.kind, tx, ty, b.plan ? b.plan.dir : 0);
            b.sprite.position.set(base.x, base.y * TILT);
            b.sprite.tint = col;
            const claimed = this.claimedAt(tx, ty);
            uiBridge.build.value = { kind: b.kind, name: def.name, icon: def.icon, valid: b.valid, reason: b.reason, cost: towerCost({ kind: b.kind, claimed }), claimed };
        }
    }

    confirmBuild() {
        const b = this.build;
        if (!b) return false;
        if (!b.valid) { this.game.ui.toast(b.reason || 'Cannot build here'); this.game.audio.play('deny'); return false; }
        const rec = newTower(b.kind, b.tx, b.ty, b.plan || undefined);
        if (this.claimedAt(b.tx, b.ty)) rec.claimed = true;
        rec.siege = null;
        this.recs.push(rec);
        this.cancelBuild();
        this.rebuildWorld(true, rec);
        const g = this.game;
        g.audio.play('place');
        g.fx.burst((rec.tx + 0.5) * T, (rec.ty + 0.5) * T, 20, 0xffe27a, 18, 3, { size: 0.9, life: 28, glow: true });
        g.ui.toast(`Construction site laid: ${TOWER_DEFS[rec.kind].name}${rec.claimed ? ' on claimed ground' : ''}. Bring ${costText(towerCost(rec))} and press E`);
        g.map.dirty = true;
        g.requestSave('build', true);
        return true;
    }

    // ------------------------------------------------------------- interaction
    nearest(x, y, range) {
        let best = null, bd = range * range;
        for (const r of this.recs) {
            const c = centreOf(r);
            const d = (c.x - x) ** 2 + (c.y - y) ** 2;
            if (d < bd) { bd = d; best = r; }
        }
        return best;
    }

    /** interaction target for the prompt system, or null */
    targetFor(p) {
        const r = this.nearest(p.wx, p.wy, 118);
        if (!r) return null;
        const def = TOWER_DEFS[r.kind];
        if (!r.built) {
            const need = remaining(towerCost(r), r.delivered);
            return { kind: 'site', rec: r, text: `[E]  Deliver materials · ${Math.round(progressOf(r) * 100)}%  ·  needs ${costText(need)}` };
        }
        if (r.kind === 'dock') return this.game.sea.canRecall(r) ? { kind: 'tower', act: 'recall', rec: r, text: '[E]  Recall your boat' } : null;
        if (UPGRADABLE.includes(r.kind)) return { kind: 'tower', rec: r, text: r.siege ? `[E]  ${def.name} · silenced by the siege` : `[E]  Tend the ${def.name} · Lv ${levelOf(r)}` };
        // a mine and a bridge have nothing to use: no prompt
        return r.kind === 'waypoint' ? { kind: 'tower', rec: r, text: '[E]  Use the Waypoint' } : null;
    }

    interact(t) {
        const g = this.game;
        if (t.kind === 'site') return this.deliver(t.rec);
        const r = t.rec;
        if (t.act === 'recall') { g.sea.recall(r); return; }
        if (UPGRADABLE.includes(r.kind)) { uiBridge.towerPanel.value = r.id; g.audio.play('equip'); }
        else if (r.kind === 'waypoint') g.travel.open(r.id);
    }

    deliver(rec) {
        const g = this.game;
        const w = g.state.wallet;
        const before = stageOf(rec);
        const given = deposit(rec, w);
        const sum = totalOf(given);
        if (!sum) {
            g.ui.toast(`You carry none of what it needs: ${costText(remaining(towerCost(rec), rec.delivered))}`);
            g.audio.play('deny');
            return;
        }
        uiBridge.wallet.value = { ...w };
        g.audio.play('build');
        const c = centreOf(rec);
        g.fx.popup(c.x, c.y, Object.entries(given).filter(([, n]) => n > 0).map(([k, n]) => `-${n} ${k}`).join('  '), 0xffe9a8, 16, 90);
        g.fx.burst(c.x, c.y, 24, 0xd8c088, 10, 2, { size: 0.8, life: 24, up: 2 });
        if (isFunded(rec)) { this.complete(rec); return; }
        if (stageOf(rec) !== before) this.rebuildWorld(true, rec);
        g.requestSave('deliver');
    }

    complete(rec) {
        const g = this.game;
        const def = TOWER_DEFS[rec.kind];
        rec.built = true;
        this.rebuildWorld(true, rec);
        const c = centreOf(rec);
        g.fx.pillar(c.x, c.y, def.color, 110, 110, 380);
        g.fx.shockwave(c.x, c.y, 260, def.color, 40, 9);
        g.fx.flash(c.x, c.y, 420, def.color, 50);
        g.fx.addShake(7);
        this.ceremony = { rec, t: 110 };
        g.ui.banner(`${def.name.toUpperCase()} COMPLETE`, def.color);
        g.audio.play('fanfare');
        g.events.emit('TowerBuilt', { kind: rec.kind, id: rec.id });
        if (rec.kind === 'beacon') g.fog.revealCircle(rec.tx, rec.ty, towerPower(levelOf(rec)).reveal);
        if (rec.kind === 'climb') { const pc = { tx: rec.tx + DIRS[rec.dir][0] * rec.len, ty: rec.ty + DIRS[rec.dir][1] * rec.len }; g.fog.revealCircle(pc.tx, pc.ty, 14); }
        if (rec.kind === 'waypoint' || rec.kind === 'dock') g.fog.revealCircle(rec.tx, rec.ty, 12);
        if (rec.kind === 'dock') { g.session.boats[rec.id] = boatSpot(rec); g.sea.refresh(); }
        g.syncMap();
        g.map.dirty = true;
        g.requestSave('tower', true);
    }

    /** Is this tile on ground the party has claimed (the calm round a claimed flag)? Towers there cost less. */
    claimedAt(tx, ty) {
        const s = this.game.sites;
        return !!(s && s.safeAt((tx + 0.5) * T, (ty + 0.5) * T));
    }

    // ---------------------------------------------------------------- levels
    /** Raise a spire, ward or beacon one level, paid from the wallet at once. */
    upgrade(recId) {
        const g = this.game, rec = this.byId(recId);
        if (!rec || !canUpgrade(rec)) return false;
        const res = upgrade(rec, g.state.wallet);
        if (!res) return false;
        if ('missing' in res) { g.ui.toast(`Raising it needs ${costText(res.missing)} more`, 'hammer'); g.audio.play('deny'); return false; }
        uiBridge.wallet.value = { ...g.state.wallet };
        const def = TOWER_DEFS[rec.kind], c = centreOf(rec);
        g.fx.pillar(c.x, c.y, def.color, 80, 90, 300);
        g.fx.shockwave(c.x, c.y, 200, def.color, 30, 7);
        g.audio.play('fanfare');
        g.ui.banner(`${def.name.toUpperCase()} RAISED TO LEVEL ${res.level}`, def.color, def.icon);
        if (rec.kind === 'beacon') { g.fog.revealCircle(rec.tx, rec.ty, towerPower(res.level).reveal); g.syncMap(); g.map.dirty = true; }
        g.events.emit('TowerUpgraded', { kind: rec.kind, id: rec.id, level: res.level });
        uiBridge.version.value++;
        g.requestSave('tower', true);
        return true;
    }

    // ----------------------------------------------------------------- spire
    candidates() {
        const g = this.game;
        return g.spells.spells.filter((s) => {
            const t = TEMPLATES[s.tpl];
            return t.mode === 'auto' && t.expr !== 'orbit' && !g.spells.heldBy(s.uid) && !g.spells.equipped(s.uid) && !this.holderOf(s.uid);
        });
    }

    arm(recId, uid) {
        const rec = this.byId(recId);
        const g = this.game;
        if (!rec || rec.kind !== 'spire') return false;
        if (uid && !this.candidates().some((s) => s.uid === uid)) { g.ui.toast('That spell is in use elsewhere'); return false; }
        rec.spell = uid || null;
        g.spells.touch();
        uiBridge.version.value = g.spells.version;
        g.audio.play('equip');
        g.requestSave('arm');
        return true;
    }

    // -------------------------------------------------------------- waypoints
    waypoints() { return this.builtOf('waypoint'); }

    /** Travel from one node of the network (waypoint or town teleporter) to another: see app/travel. */
    travel(fromId, toId) { return this.game.travel.go(fromId, toId); }

    /** Put the party beside waypoint `rec`, on the overworld (the screen is already dark). */
    arriveAt(rec) {
        const g = this.game, p = g.state.player;
        const c = centreOf(rec);
        const spot = g.world.findFree(c.x, c.y + T * 1.6, p.radius + 2);
        p.wx = spot.x; p.wy = spot.y;
        g.cam.x = p.wx; g.cam.y = p.wy;
        g.clearWorldEntities();
        g.popRuntime.clearActive();
        g.sites.clearDisplays();
        g.lastFogTx = null;
        g.world.update(g.cam.x, g.cam.y, g.viewW, g.viewH, true);
        g.flow.centerTx = NaN;
    }

    // ------------------------------------------------------------------ update
    update(delta) {
        const g = this.game;
        const p = g.state.player;
        if (!p || g.mode !== 'overworld') { if (this.build) this.cancelBuild(); return; }
        this.updateBuild();
        const t = g.frame;

        if (this.ceremony) {
            const cer = this.ceremony;
            cer.t -= delta;
            const c = centreOf(cer.rec);
            if (((t | 0) % 3) === 0) g.fx.burst(c.x + (Math.random() - 0.5) * 80, c.y + 20, 20 + Math.random() * 140, TOWER_DEFS[cer.rec.kind].color, 2, 1.4, { size: 0.8, life: 30, up: 1.6, gravity: -0.03, glow: true });
            if (cer.t <= 0) this.ceremony = null;
        }

        for (const r of this.recs) {
            const c = centreOf(r);
            const d2 = (c.x - p.wx) ** 2 + (c.y - p.wy) ** 2;
            if (d2 > NEAR * NEAR) { const gr = this.shown.get(r.id); if (gr) { gr.destroy(); this.shown.delete(r.id); } continue; }
            if (!r.built) continue;
            if (r.siege) { this.drawSiege(r, c, t); continue; }      // silenced until the besiegers are beaten
            if (r.kind === 'ward') this.updateWard(r, c, delta, t, d2);
            else if (r.kind === 'spire') this.updateSpire(r, c, delta);
            else if (r.kind === 'waypoint') this.drawRing(r, c, t, 0xb06af0, 54);
            else if (r.kind === 'beacon') this.drawRing(r, c, t, 0xffa24a, 46);
        }
    }

    ground(rec) {
        let gr = this.shown.get(rec.id);
        if (!gr) { gr = new PIXI.Graphics(); this.game.groundLayer.addChild(gr); this.shown.set(rec.id, gr); }
        return gr;
    }

    drawRing(rec, c, t, color, R) {
        const gr = this.ground(rec);
        gr.clear();
        const a = 0.35 + 0.15 * Math.sin(t * 0.05);
        gr.lineStyle(3, color, a); gr.drawCircle(c.x, c.y + T * 0.3, R);
        gr.lineStyle(1.5, color, a * 0.8); gr.drawCircle(c.x, c.y + T * 0.3, R - 8);
    }

    /** A besieged tower: a broken red ring flickers round it, and it does nothing. */
    drawSiege(rec, c, t) {
        const gr = this.ground(rec);
        gr.clear();
        const a = 0.35 + 0.3 * Math.abs(Math.sin(t * 0.13));
        for (let k = 0; k < 10; k++) {
            const a0 = (k / 10) * Math.PI * 2 + t * 0.004;
            gr.lineStyle(3, 0xff4a3a, a);
            gr.arc(c.x, c.y + T * 0.3, 58, a0, a0 + 0.38);
        }
        gr.lineStyle(0);
    }

    updateWard(rec, c, delta, t, d2) {
        const g = this.game;
        const pw = towerPower(levelOf(rec));
        const R = pw.radius;
        const gr = this.ground(rec);
        gr.clear();
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.04);
        gr.beginFill(0xffe27a, 0.07 + 0.03 * pulse); gr.drawCircle(c.x, c.y, R); gr.endFill();
        gr.lineStyle(3, 0xffe27a, 0.55 + 0.25 * pulse); gr.drawCircle(c.x, c.y, R);
        gr.lineStyle(1.5, 0xffffff, 0.3); gr.drawCircle(c.x, c.y, R - 8);
        gr.lineStyle(0);
        for (let k = 0; k < 8; k++) {
            const a = t * 0.006 + (k / 8) * Math.PI * 2;
            gr.beginFill(0xffe27a, 0.6); gr.drawPolygon([c.x + Math.cos(a) * R, c.y + Math.sin(a) * R - 4, c.x + Math.cos(a) * R + 3, c.y + Math.sin(a) * R, c.x + Math.cos(a) * R, c.y + Math.sin(a) * R + 4, c.x + Math.cos(a) * R - 3, c.y + Math.sin(a) * R]); gr.endFill();
        }
        // monsters are pushed back out of the dome; bosses resist
        for (const e of g.state.enemies) {
            if (e.dead) continue;
            const dx = e.wx - c.x, dy = e.wy - c.y, d = Math.hypot(dx, dy) || 1;
            if (d > R) continue;
            const k = (e.isBoss ? 0.25 : 1) * (0.5 + 1.2 * (1 - d / R)) * 0.55;
            e.kvx += (dx / d) * k * delta; e.kvy += (dy / d) * k * delta;
            if (d > R - 24 && ((t | 0) % 6) === 0) g.fx.burst(e.wx, e.wy, 14, 0xffe27a, 2, 1.2, { size: 0.6, life: 14, glow: true });
        }
        const s = g.state;
        if (d2 < R * R && s.health < s.maxHealth) s.health = Math.min(s.maxHealth, s.health + pw.heal * delta / 60);
    }

    updateSpire(rec, c, delta) {
        if (!rec.spell) return;
        const g = this.game;
        const item = g.spells.item(rec.spell);
        if (!item) { rec.spell = null; return; }
        g.spells.towerFire(rec, item, { wx: c.x, wy: c.y + T * 0.3 }, delta);
    }
}
