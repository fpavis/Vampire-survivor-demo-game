// @ts-nocheck -- Pixi-bound runtime over the typed puzzle rules (core/world/puzzles)
// Vaults on dungeon floors: a gate that blocks a side room until its puzzle is solved (a key, levers, or pressure
// plates lit together before their time runs out), and the treasure inside. State lives on the floor's record, so it
// is saved with the place and survives leaving and coming back.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';

const T = WORLD_CONFIG.tile;
const TILT = WORLD_CONFIG.tilt;
const PLATE_R = 30;

export class VaultSystem {
    constructor(game) {
        this.game = game;
        this.pz = null;
        this.st = null;
        this.sprites = { gate: null, key: null, levers: [] };
        this.gfx = null;
        this.lit = [];
        this.blocker = null;
        this.t = 0;
    }

    clear() {
        const s = this.sprites;
        for (const sp of [s.gate, s.key, ...s.levers]) if (sp && !sp.destroyed) sp.destroy();
        this.sprites = { gate: null, key: null, levers: [] };
        if (this.gfx && !this.gfx.destroyed) this.gfx.destroy();
        this.gfx = null;
        this.pz = null; this.st = null; this.blocker = null; this.lit = [];
    }

    sprite(type, variant, x, y, z = 0) {
        const g = this.game, set = g.world.decorTextures[type];
        const s = new PIXI.Sprite(set[variant].texture);
        s.anchor.set(0.5, set[variant].anchorY);
        s.position.set(x, y * TILT);
        s.zIndex = y + z;
        g.objectLayer.addChild(s);
        return s;
    }
    setVariant(s, type, variant) { const set = this.game.world.decorTextures[type]; s.texture = set[variant].texture; }

    /** Set up the vault of the floor just entered (after the floor's monsters and chests). */
    setup(src, state) {
        this.clear();
        const pz = src.puzzle, g = this.game;
        if (!pz) return;
        this.pz = pz;
        const st = (state.vault ||= { open: false, key: false, levers: [] });
        this.st = st;
        const front = pz.gate.horizontal;
        this.gateBase = front ? 0 : 2;
        this.sprites.gate = this.sprite('vaultgate', this.gateBase + (st.open ? 1 : 0), pz.gate.x, pz.gate.y + (front ? T * 0.45 : T * 0.9), 2);
        if (!st.open) this.block(true);
        if (pz.kind === 'key') this.sprites.key = this.sprite('keystand', st.key ? 1 : 0, pz.key.x, pz.key.y);
        if (pz.kind === 'levers') this.sprites.levers = pz.levers.map((l, i) => this.sprite('lever', st.levers.includes(i) ? 1 : 0, l.x, l.y));
        if (pz.kind === 'plates') this.lit = pz.plates.map(() => 0);
        this.gfx = new PIXI.Graphics();
        g.groundLayer.addChild(this.gfx);
        // the vault's treasure
        const opened = state.opened.includes('vault');
        const sprite = g.dungeons.chestSprite(pz.chest.x, pz.chest.y, 1.35, opened);
        g.interactables.push({ kind: 'chest', x: pz.chest.x, y: pz.chest.y, idx: 'vault', big: true, opened, sprite });
        // map markers
        g.map.markers.push({ tx: pz.gate.x / T, ty: pz.gate.y / T, icon: st.open ? 'vault-gate' : 'lock' });
        if (pz.kind === 'key' && !st.key) g.map.markers.push({ tx: pz.key.x / T, ty: pz.key.y / T, icon: 'vault-key' });
        if (pz.kind === 'levers') pz.levers.forEach((l, i) => { if (!st.levers.includes(i)) g.map.markers.push({ tx: l.x / T, ty: l.y / T, icon: 'lever' }); });
        if (pz.kind === 'plates') pz.plates.forEach((p) => g.map.markers.push({ tx: p.x / T, ty: p.y / T, icon: 'plate' }));
        g.map.dirty = true;
    }

    /** The closed gate blocks walking and the monsters' paths. */
    block(on) {
        const g = this.game, w = g.interior.w;
        if (on && !this.blocker) {
            const tiles = this.pz.gate.tiles.map((i) => [i % w, Math.floor(i / w)]);
            const circles = tiles.map(([tx, ty]) => ({ x: (tx + 0.5) * T, y: (ty + 0.5) * T, r: 30 }));
            this.blocker = { tiles, circles };
            g.world.addBlocker(tiles, circles);
        } else if (!on && this.blocker) {
            g.world.removeBlocker(this.blocker.tiles, this.blocker.circles);
            this.blocker = null;
        }
        g.flow.centerTx = NaN;           // the monsters re-plan their way around
    }

    status() {
        const pz = this.pz, st = this.st;
        if (!pz) return null;
        return { kind: pz.kind, open: st.open, key: st.key, levers: st.levers.length, of: pz.levers ? pz.levers.length : 0, lit: this.lit.filter((n) => n > 0).length, window: pz.window || 0 };
    }

    considerTargets(consider) {
        const pz = this.pz, st = this.st;
        if (!pz) return;
        if (!st.open) {
            const text = pz.kind === 'key' ? (st.key ? '[E]  Unlock the vault' : 'The vault is locked · its key lies somewhere on this floor')
                : pz.kind === 'levers' ? `The vault is shut · levers pulled: ${st.levers.length} of ${pz.levers.length}`
                    : `The vault is shut · light all three plates within ${pz.window} seconds`;
            consider({ kind: 'vault', act: 'gate', text }, pz.gate.x, pz.gate.y, 96);
        }
        if (pz.kind === 'key' && !st.key) consider({ kind: 'vault', act: 'key', text: '[E]  Take the key' }, pz.key.x, pz.key.y, 64);
        if (pz.kind === 'levers') pz.levers.forEach((l, i) => { if (!st.levers.includes(i)) consider({ kind: 'vault', act: 'lever', i, text: '[E]  Pull the lever' }, l.x, l.y, 64); });
    }

    interact(t) {
        const g = this.game, pz = this.pz, st = this.st;
        if (!pz) return;
        if (t.act === 'key' && !st.key) {
            st.key = true;
            this.setVariant(this.sprites.key, 'keystand', 1);
            g.map.markers = g.map.markers.filter((m) => m.icon !== 'vault-key');
            g.map.dirty = true;
            g.audio.play('loot');
            g.ui.toast('You took the vault key', 'vault-key');
            g.events.emit('VaultKey', { id: g.interiorPoi.id, floor: g.floor });
        } else if (t.act === 'gate') {
            if (pz.kind === 'key' && st.key) this.open();
            else { g.audio.play('deny'); g.ui.toast(pz.kind === 'key' ? 'Locked. Find the key on this floor' : pz.kind === 'levers' ? 'Pull every lever on this floor' : 'Stand on each glowing plate; light all three before they fade', pz.kind === 'key' ? 'vault-key' : pz.kind === 'levers' ? 'lever' : 'plate'); }
        } else if (t.act === 'lever' && !st.levers.includes(t.i)) {
            st.levers.push(t.i);
            this.setVariant(this.sprites.levers[t.i], 'lever', 1);
            g.map.markers = g.map.markers.filter((m) => !(m.icon === 'lever' && Math.abs(m.tx - pz.levers[t.i].x / T) < 0.01 && Math.abs(m.ty - pz.levers[t.i].y / T) < 0.01));
            g.map.dirty = true;
            g.audio.play('switch');
            const left = pz.levers.length - st.levers.length;
            if (left > 0) g.ui.toast(`Somewhere a mechanism shifts · ${left} lever${left > 1 ? 's' : ''} to go`, 'lever');
            else this.open();
        }
    }

    open() {
        const g = this.game, pz = this.pz, st = this.st;
        if (!pz || st.open) return;
        st.open = true;
        this.block(false);
        this.setVariant(this.sprites.gate, 'vaultgate', this.gateBase + 1);
        g.map.markers = g.map.markers.filter((m) => m.icon !== 'lock' && m.icon !== 'plate');
        g.map.markers.push({ tx: pz.gate.x / T, ty: pz.gate.y / T, icon: 'vault-gate' });
        g.map.dirty = true;
        g.ui.banner('THE VAULT OPENS', 0xffd84a, 'vault-gate');
        g.audio.play('seal');
        g.audio.stinger('stingDiscover');
        g.fx.shockwave(pz.gate.x, pz.gate.y, 160, 0xffd84a, 26, 6);
        g.fx.pillar(pz.chest.x, pz.chest.y, 0xffd84a, 60, 70, 220);
        g.events.emit('VaultOpened', { id: g.interiorPoi.id, floor: g.floor, kind: pz.kind });
        g.requestSave('vault', true);
    }

    /** The vault's chest pays like a deep chest of this dungeon, plus a pile of gold. */
    openChest(it) {
        const g = this.game, o = g.chestLootOpts();
        g.grantLoot(2, { affinity: o.affinity, bonus: (o.bonus || 0) + 0.5 });
        const lvl = g.dungeons.levelOf(g.interiorPoi, g.floor);
        for (let i = 0; i < 6; i++) g.dropGem(it.x + (Math.random() - 0.5) * 90, it.y + 24 + Math.random() * 30, Math.round(12 + lvl * 3), 'coin');
        g.fx.pillar(it.x, it.y, 0xffd84a, 70, 70, 240);
    }

    update(delta) {
        const g = this.game, pz = this.pz;
        if (!pz || !this.gfx || g.mode !== 'interior') return;
        this.t += delta;
        const gr = this.gfx, st = this.st, p = g.state.player;
        gr.clear();
        if (pz.kind === 'plates') {
            if (!st.open) {
                pz.plates.forEach((pl, i) => {
                    if (Math.hypot(p.wx - pl.x, p.wy - pl.y) < PLATE_R) {
                        if (this.lit[i] <= 0) { g.audio.play('switch'); g.fx.burst(pl.x, pl.y, 4, 0x7ad8ff, 10, 1.6, { size: 0.6, life: 22, up: 2, glow: true }); }
                        this.lit[i] = pz.window * 60;
                    } else if (this.lit[i] > 0) {
                        this.lit[i] -= delta;
                        if (this.lit[i] <= 0) g.audio.play('deny');
                    }
                });
                if (this.lit.every((n) => n > 0)) this.open();
            }
            pz.plates.forEach((pl, i) => {
                const on = st.open || this.lit[i] > 0;
                gr.lineStyle(2.4, 0x1d1712, 0.9); gr.beginFill(on ? 0x3a6a8a : 0x5a5a66); gr.drawCircle(pl.x, pl.y, PLATE_R); gr.endFill();
                gr.lineStyle(0); gr.beginFill(on ? 0x7ad8ff : 0x7a7a88, on ? 0.75 : 0.9); gr.drawCircle(pl.x, pl.y, PLATE_R * 0.62); gr.endFill();
                if (!st.open && this.lit[i] > 0) {
                    const f = this.lit[i] / (pz.window * 60);
                    gr.lineStyle(4, 0xbfeaff, 0.9); gr.arc(pl.x, pl.y, PLATE_R + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); gr.lineStyle(0);
                }
            });
        }
        if (!st.open) {
            // a faint seal on the closed gate, pulsing
            const a = 0.25 + 0.15 * Math.sin(this.t * 0.08);
            gr.lineStyle(3, 0xffb04a, a); gr.drawEllipse(pz.gate.x, pz.gate.y, 56, 40); gr.lineStyle(0);
        }
    }

    emitLights(L) {
        const pz = this.pz, st = this.st;
        if (!pz) return;
        L.add({ x: pz.gate.x, y: pz.gate.y, z: 30, r: 160, color: st.open ? 0x7ad8ff : 0xffb04a, i: 0.6 });
        if (pz.kind === 'key' && !st.key) L.add({ x: pz.key.x, y: pz.key.y, z: 20, r: 120, color: 0xffd84a, i: 0.7 });
        if (pz.kind === 'plates') pz.plates.forEach((pl, i) => L.add({ x: pl.x, y: pl.y, z: 6, r: 90, color: 0x7ad8ff, i: st.open || this.lit[i] > 0 ? 0.8 : 0.3 }));
        if (pz.kind === 'levers') pz.levers.forEach((l, i) => L.add({ x: l.x, y: l.y, z: 20, r: 90, color: st.levers.includes(i) ? 0x7ad8ff : 0xffb04a, i: 0.5 }));
    }
}
