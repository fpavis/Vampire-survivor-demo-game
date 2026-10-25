// @ts-nocheck -- Pixi-bound runtime over the typed dungeon rules (core/world/dungeons, core/world/interiors)
// Multi-floor play: stairs, sealed floors, the boss and its chest; plateau and sea entrances hosted by the world.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { ENEMY_TYPES } from '../core/config';
import { CACHE_CELL, bossChestTier, bossLevel, floorLevel, isSeaDungeonCell, plateauPoi, seaDungeonPoi } from '../core/world/dungeons';
import { findPlace } from '../core/quest/places';
import { bossTitle } from '../core/story/story';

const T = WORLD_CONFIG.tile;
const TILT = WORLD_CONFIG.tilt;
const CT = WORLD_CONFIG.chunkTiles;

export class DungeonSystem {
    constructor(game) {
        this.game = game;
        this.sea = new Map();           // cache-grid cell -> Poi | null
        this.plateaus = new Map();      // tower id -> Poi
        this.lairs = new Map();         // region group -> id of the nearest land dungeon (the lord's lair)
        this.gfx = null;
        this.t = 0;
    }

    reset() {
        this.sea.clear(); this.plateaus.clear(); this.lairs.clear();
        this.clearFeatures();
    }

    // -------------------------------------------------- places the world hosts
    plateauOf(rec) {
        if (!this.plateaus.has(rec.id)) this.plateaus.set(rec.id, plateauPoi(rec, this.game.overworld.seed));
        return this.plateaus.get(rec.id);
    }

    seaCell(cx, cy) {
        const key = `${cx},${cy}`;
        if (!this.sea.has(key)) {
            const o = this.game.overworld;
            this.sea.set(key, seaDungeonPoi(o.seed, cx, cy, (x, y) => o.biomeAt(x, y)));
        }
        return this.sea.get(key);
    }

    /** dungeon entrances on plateaus and islands whose landmark may touch this chunk */
    poisForChunk(cx, cy) {
        const g = this.game;
        if (!g.overworld) return [];
        const x0 = cx * CT - 4, x1 = (cx + 1) * CT + 4, y0 = cy * CT - 4, y1 = (cy + 1) * CT + 4;
        const inside = (p) => p && p.tx >= x0 && p.tx < x1 && p.ty >= y0 && p.ty < y1;
        const out = [];
        for (const rec of g.towers ? g.towers.recs : []) {
            if (rec.kind !== 'climb' || !rec.built) continue;
            const p = this.plateauOf(rec);
            if (inside(p)) out.push(p);
        }
        for (let sy = Math.floor(y0 / CACHE_CELL); sy <= Math.floor(y1 / CACHE_CELL); sy++) {
            for (let sx = Math.floor(x0 / CACHE_CELL); sx <= Math.floor(x1 / CACHE_CELL); sx++) {
                if (!isSeaDungeonCell(g.overworld.seed, sx, sy)) continue;
                const p = this.seaCell(sx, sy);
                if (inside(p)) out.push(p);
            }
        }
        return out;
    }

    /** every plateau and island dungeon within `r` tiles of a tile (for quests that look for one) */
    extraNear(tx, ty, r) {
        const g = this.game, out = [];
        for (const rec of g.towers.recs) {
            if (rec.kind !== 'climb' || !rec.built) continue;
            const p = this.plateauOf(rec);
            if (p && Math.hypot(p.tx - tx, p.ty - ty) <= r) out.push(p);
        }
        for (let sy = Math.floor((ty - r) / CACHE_CELL); sy <= Math.floor((ty + r) / CACHE_CELL); sy++) {
            for (let sx = Math.floor((tx - r) / CACHE_CELL); sx <= Math.floor((tx + r) / CACHE_CELL); sx++) {
                if (!isSeaDungeonCell(g.overworld.seed, sx, sy)) continue;
                const p = this.seaCell(sx, sy);
                if (p && Math.hypot(p.tx - tx, p.ty - ty) <= r) out.push(p);
            }
        }
        return out;
    }

    /** the nearest land dungeon of a region is where its demon lord sits */
    isLordLair(poi) {
        if (!poi.dungeon || poi.dungeon.realm !== 'land') return false;
        if (!this.lairs.has(poi.group)) {
            const p = findPlace(this.game.overworld, { kind: 'dungeon', group: poi.group, nth: 0 });
            this.lairs.set(poi.group, p ? p.id : null);
        }
        return this.lairs.get(poi.group) === poi.id;
    }

    // -------------------------------------------------------------- levels
    baseLevel(poi) { return Math.max(1, this.game.overworld.levelAt(poi.tx, poi.ty)); }
    levelOf(poi, floor) { return poi.dungeon ? floorLevel(this.baseLevel(poi), floor) : this.baseLevel(poi); }

    // ----------------------------------------------------------- the boss
    /** Place the dungeon boss on the last floor unless it is already dead. */
    spawnBoss(src, poi, place) {
        const g = this.game, info = poi.dungeon;
        if (!info || !src.boss || place.bossDead) return null;
        const type = ENEMY_TYPES[info.boss];
        let { x, y } = src.boss;
        if (g.world.blocked(x, y, type.radius)) { const f = g.world.findFree(x, y, type.radius); x = f.x; y = f.y; }
        const e = g.makeEnemy(info.boss, x, y, { dormant: true, aggro: 520, level: bossLevel(this.baseLevel(poi), info.floors) });
        e.dungeonBoss = poi.id;
        const title = bossTitle(poi.group, info.realm, this.isLordLair(poi), g.quests ? g.quests.state : { flags: {} });
        if (title) e.bossName = title.toUpperCase();
        g.interiorHostiles++;
        return e;
    }

    chestSprite(x, y, scale, opened) {
        const g = this.game;
        const set = g.world.decorTextures.chest;
        const sprite = new PIXI.Sprite(set[opened ? 1 : 0].texture);
        sprite.anchor.set(0.5, set[0].anchorY);
        sprite.position.set(x, y * TILT);
        sprite.zIndex = y;
        sprite.scale.set(scale);
        g.objectLayer.addChild(sprite);
        return sprite;
    }

    /** the guaranteed chest the boss leaves behind (also after a reload, until it is opened) */
    spawnBossChest(x, y) {
        const g = this.game;
        const sprite = this.chestSprite(x, y, 1.6, false);
        g.interactables.push({ kind: 'chest', x, y, idx: 'boss', big: true, opened: false, sprite });
        g.map.markers.push({ tx: x / T, ty: y / T, icon: '🎁' });
        g.map.dirty = true;
    }

    bossDown(e) {
        const g = this.game;
        const poi = g.interiorPoi;
        if (!poi || e.dungeonBoss !== poi.id) return;
        const place = g.visited[poi.id];
        place.bossDead = true;
        g.map.markers = g.map.markers.filter((m) => m.icon !== '💀');
        g.ui.banner('DUNGEON CLEARED!', 0xffd84a);
        this.spawnBossChest(e.wx, e.wy + 40);
        g.events.emit('DungeonCleared', { id: poi.id, name: poi.name, type: poi.type, group: poi.group, realm: poi.dungeon.realm });
        g.requestSave('dungeon', true);
    }

    openBossChest(it) {
        const g = this.game, poi = g.interiorPoi;
        g.visited[poi.id].bossChestOpened = true;
        g.grantLoot(bossChestTier(poi.dungeon.floors));
        const lvl = this.levelOf(poi, poi.dungeon.floors - 1);
        for (let i = 0; i < 10; i++) g.dropGem(it.x + (Math.random() - 0.5) * 120, it.y + 20 + Math.random() * 40, Math.round(20 + lvl * 5), 'coin');
        g.requestSave('dungeon', true);
    }

    // ------------------------------------------------------------- the seal
    guardiansLeft() {
        return this.game.state.enemies.reduce((n, e) => n + (!e.dead && e.guardian ? 1 : 0), 0);
    }

    guardianDown() {
        const g = this.game;
        if (!g.interior || !g.interior.stairsDown) return;
        if (this.guardiansLeft() > 0) { g.ui.toast(`${this.guardiansLeft()} guardian${this.guardiansLeft() > 1 ? 's' : ''} left before the stairs open`); return; }
        const s = g.interior.stairsDown;
        g.interiorState.unsealed = true;
        g.ui.banner('THE SEAL BREAKS', 0x7ad8ff);
        g.fx.shockwave(s.x, s.y, 240, 0x7ad8ff, 36, 8);
        g.fx.pillar(s.x, s.y, 0x7ad8ff, 90, 90, 320);
        g.audio.play('seal');
    }

    // ------------------------------------------------------------ features
    clearFeatures() {
        if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    }

    showFeatures() {
        this.clearFeatures();
        const g = this.game;
        if (!g.interior || !g.interior.dungeon) return;
        this.gfx = new PIXI.Graphics();
        g.groundLayer.addChild(this.gfx);
    }

    update(delta) {
        const g = this.game;
        if (!this.gfx || g.mode !== 'interior' || !g.interior) return;
        this.t += delta;
        const src = g.interior, gr = this.gfx, t = this.t;
        gr.clear();
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.07);
        if (src.stairsDown) {
            const { x, y } = src.stairsDown, sealed = this.guardiansLeft() > 0;
            const col = sealed ? 0xff5a4a : 0x6ad8ff;
            gr.beginFill(0x07090f, 0.95); gr.drawEllipse(x, y, 40, 30); gr.endFill();
            for (let i = 0; i < 5; i++) { gr.lineStyle(2, 0x6a6a78, 0.9 - i * 0.14); gr.drawEllipse(x, y + i * 2.5, 38 - i * 6.5, 27 - i * 5); }
            gr.lineStyle(3, col, 0.55 + 0.35 * pulse); gr.drawEllipse(x, y, 44, 33);
            gr.lineStyle(0);
            if (sealed) {                                           // chains across the opening
                gr.lineStyle(4, 0x2a2a34, 0.95); gr.moveTo(x - 38, y - 16); gr.lineTo(x + 38, y + 16); gr.moveTo(x - 38, y + 16); gr.lineTo(x + 38, y - 16);
                gr.lineStyle(2, 0xb0a890, 0.9); gr.moveTo(x - 38, y - 16); gr.lineTo(x + 38, y + 16); gr.moveTo(x - 38, y + 16); gr.lineTo(x + 38, y - 16);
                gr.lineStyle(0);
            } else {
                gr.beginFill(col, 0.1 + 0.12 * pulse); gr.drawEllipse(x, y, 36, 26); gr.endFill();
                for (let k = 0; k < 3; k++) { const a = ((t * 0.02 + k / 3) % 1); gr.beginFill(0xbfeaff, 0.5 * (1 - a)); gr.drawCircle(x, y - 6 - a * 34, 3 * (1 - a) + 1); gr.endFill(); }
            }
        }
        if (src.floor > 0) {
            const x = src.exit.x, y = src.exit.y;
            gr.lineStyle(3, 0xd8f0ff, 0.45 + 0.3 * pulse); gr.drawEllipse(x, y, 40, 30); gr.lineStyle(0);
            gr.beginFill(0xd8f0ff, 0.12 + 0.1 * pulse); gr.drawEllipse(x, y, 34, 25); gr.endFill();
            for (let k = 0; k < 2; k++) { const dy = -10 - k * 9 - ((t * 0.3) % 9); gr.lineStyle(2.5, 0xeaf6ff, 0.8 - k * 0.3); gr.moveTo(x - 10, y + dy + 6); gr.lineTo(x, y + dy); gr.lineTo(x + 10, y + dy + 6); }
            gr.lineStyle(0);
        }
        if (src.boss && !g.visited[g.interiorPoi.id].bossDead) {
            const { x, y } = src.boss, a = t * 0.012;
            gr.lineStyle(3, 0xc04aff, 0.5 + 0.3 * pulse); gr.drawCircle(x, y, 150);
            gr.lineStyle(2, 0xff4a7a, 0.45); gr.drawCircle(x, y, 118);
            for (let k = 0; k < 10; k++) {
                const aa = a + (k / 10) * Math.PI * 2;
                gr.lineStyle(2, 0xff7ab0, 0.5);
                gr.moveTo(x + Math.cos(aa) * 118, y + Math.sin(aa) * 118); gr.lineTo(x + Math.cos(aa + 0.3) * 150, y + Math.sin(aa + 0.3) * 150);
            }
            gr.lineStyle(0);
            gr.beginFill(0xc04aff, 0.06 + 0.05 * pulse); gr.drawCircle(x, y, 148); gr.endFill();
        }
    }

    emitLights(L) {
        const g = this.game;
        if (!g.interior || !g.interior.dungeon) return;
        const src = g.interior;
        if (src.stairsDown) L.add({ x: src.stairsDown.x, y: src.stairsDown.y, z: 16, r: 190, color: this.guardiansLeft() > 0 ? 0xff6a4a : 0x6ad8ff, i: 0.8 });
        if (src.floor > 0) L.add({ x: src.exit.x, y: src.exit.y, z: 16, r: 170, color: 0xd8f0ff, i: 0.7 });
        if (src.boss && !g.visited[g.interiorPoi.id].bossDead) L.add({ x: src.boss.x, y: src.boss.y, z: 12, r: 300, color: 0xb04aff, i: 0.55 });
    }
}
