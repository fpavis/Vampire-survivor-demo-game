// @ts-nocheck -- Pixi-bound runtime for boats, island caches and sea monsters
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { engage } from '../core/ai/ai';
import { BIOME, isWaterBiome } from '../core/world/biomes';
import { BOAT_SPEED, CACHE_CELL, boatBlocked, boatSpot, cacheForCell } from '../core/world/towers';
import { isSeaDungeonCell } from '../core/world/dungeons';
import { createBoat } from '../render/boatArt';
import { EntityManager } from '../render/entities';
import { ui as uiBridge } from '../ui/bridge';

const T = WORLD_CONFIG.tile;
const TILT = WORLD_CONFIG.tilt;
const SHOW = T * WORLD_CONFIG.chunkTiles * 3;

/** Docks give each shore a boat. Boats cross deep water; islands hide treasure; the sea has its own monsters. */
export class SeaSystem {
    constructor(game) {
        this.game = game;
        this.boats = new Map();          // dock id -> { id, back, front, wake, x, y }
        this.caches = new Map();         // cache id -> { cache, sprite }
        this.cacheCells = new Map();
        this.known = new Map();          // caches the hero has come near (shown on the map)
        this.timer = 0;
        this.spawnTimer = 0;
    }

    reset() {
        for (const b of this.boats.values()) this.destroyBoat(b);
        for (const c of this.caches.values()) c.sprite.destroy();
        this.boats.clear(); this.caches.clear(); this.cacheCells.clear(); this.known.clear();
        this.timer = this.spawnTimer = 0;
    }

    destroyBoat(b) { b.back.destroy({ children: true }); b.front.destroy({ children: true }); b.wake.destroy(); }

    // ---------------------------------------------------------------- boats
    posOf(rec) {
        const m = this.game.session.boats[rec.id];
        return m || boatSpot(rec);
    }

    /** make sure every built dock near the hero has a boat sprite */
    refresh() {
        const g = this.game;
        const p = g.state.player;
        if (!p || g.mode !== 'overworld') return;
        for (const rec of g.towers.builtOf('dock')) {
            const pos = this.posOf(rec);
            const near = Math.hypot(pos.x - p.wx, pos.y - p.wy) < SHOW;
            let b = this.boats.get(rec.id);
            if (near && !b) {
                const parts = createBoat();
                b = { id: rec.id, ...parts, x: pos.x, y: pos.y, phase: Math.random() * 6 };
                g.groundLayer.addChild(b.wake);
                g.objectLayer.addChild(b.back, b.front);
                this.boats.set(rec.id, b);
            } else if (!near && b && !(g.boat && g.boat.dockId === rec.id)) { this.destroyBoat(b); this.boats.delete(rec.id); }
        }
    }

    /** nearest moored boat within reach, or null */
    boatNear(x, y, range = 96) {
        let best = null, bd = range * range;
        for (const b of this.boats.values()) {
            if (this.game.boat && this.game.boat.dockId === b.id) continue;
            const d = (b.x - x) ** 2 + (b.y - y) ** 2;
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    }

    board(id) {
        const g = this.game;
        const b = this.boats.get(id);
        if (!b || g.boat) return false;
        const p = g.state.player;
        g.boat = { dockId: id };
        p.wx = b.x; p.wy = b.y;
        g.spells.dashing = null;
        uiBridge.sailing.value = true;
        g.fx.burst(b.x, b.y, 14, 0xdff4ff, 14, 2.4, { size: 0.8, life: 22, glow: true });
        g.fx.shockwave(b.x, b.y, 60, 0xdff4ff, 18, 4);
        g.audio.play('switch');
        g.ui.toast('All aboard! Steer with WASD. Press E near a shore to step off');
        return true;
    }

    /** nearest tile of dry land within reach for stepping ashore */
    landNear(x, y, range = 120) {
        const g = this.game;
        let best = null, bd = range * range;
        const tx0 = Math.floor(x / T), ty0 = Math.floor(y / T), R = Math.ceil(range / T);
        for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
            const b = g.world.biomeAt(tx0 + i, ty0 + j);
            if (isWaterBiome(b) || b === BIOME.MOUNTAIN || b === BIOME.PEAK || b === BIOME.VOID) continue;
            const cx = (tx0 + i + 0.5) * T, cy = (ty0 + j + 0.5) * T;
            const d = (cx - x) ** 2 + (cy - y) ** 2;
            if (d < bd && !g.world.blocked(cx, cy, g.state.player.radius)) { bd = d; best = { x: cx, y: cy }; }
        }
        return best;
    }

    disembark() {
        const g = this.game;
        const p = g.state.player;
        const land = this.landNear(p.wx, p.wy);
        if (!land || !g.boat) return false;
        const b = this.boats.get(g.boat.dockId);
        if (b) { b.x = p.wx; b.y = p.wy; g.session.boats[b.id] = { x: p.wx, y: p.wy }; }
        p.wx = land.x; p.wy = land.y;
        g.boat = null;
        uiBridge.sailing.value = false;
        g.fx.burst(p.wx, p.wy, 10, 0xdff4ff, 12, 2, { size: 0.7, life: 20, glow: true });
        g.audio.play('pickup');
        g.flow.centerTx = NaN;
        return true;
    }

    /** the party is gone / the game restarts: leave the boat where it floats */
    abandon() {
        const g = this.game;
        if (g.boat) {
            const p = g.state.player;
            const b = this.boats.get(g.boat.dockId);
            if (b) { b.x = p.wx; b.y = p.wy; g.session.boats[b.id] = { x: p.wx, y: p.wy }; }
        }
        g.boat = null;
        uiBridge.sailing.value = false;
    }

    // ----------------------------------------------------------- caches
    cachesNear(tx, ty, r) {
        const g = this.game;
        const out = [];
        const c0x = Math.floor((tx - r) / CACHE_CELL), c1x = Math.floor((tx + r) / CACHE_CELL);
        const c0y = Math.floor((ty - r) / CACHE_CELL), c1y = Math.floor((ty + r) / CACHE_CELL);
        for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
            const key = `${cx},${cy}`;
            if (!this.cacheCells.has(key)) this.cacheCells.set(key, cacheForCell(g.overworld.seed, cx, cy, (x, y) => g.overworld.biomeAt(x, y)));
            const c = this.cacheCells.get(key);
            if (c && !isSeaDungeonCell(g.overworld.seed, cx, cy)) out.push(c);       // a drowned shrine stands where the treasure would be
        }
        return out;
    }

    isOpened(id) { return this.game.session.caches.includes(id); }

    /** nearest unopened cache within reach, or null */
    cacheTarget(x, y, range = 70) {
        let best = null, bd = range * range;
        for (const d of this.caches.values()) {
            const cx = (d.cache.tx + 0.5) * T, cy = (d.cache.ty + 0.5) * T;
            const dd = (cx - x) ** 2 + (cy - y) ** 2;
            if (dd < bd) { bd = dd; best = d.cache; }
        }
        return best;
    }

    open(cache) {
        const g = this.game;
        g.session.caches.push(cache.id);
        this.known.delete(cache.id);
        const d = this.caches.get(cache.id);
        const x = (cache.tx + 0.5) * T, y = (cache.ty + 0.5) * T;
        if (d) { d.sprite.destroy(); this.caches.delete(cache.id); }
        g.fx.burst(x, y, 24, 0xffd84a, 30, 3.4, { size: 1, life: 40, up: 4, glow: true });
        g.fx.pillar(x, y, 0xffd84a, 70, 70, 240);
        g.ui.banner('BURIED TREASURE', 0xffd84a);
        g.audio.play('loot');
        g.grantLoot(2);
        for (let i = 0; i < 8; i++) g.dropGem(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 70, Math.round(20 + cache.level * 6), 'coin');
        for (let i = 0; i < 3; i++) g.dropGem(x + (Math.random() - 0.5) * 80, y + 20, 1, ['wood', 'stone', 'iron'][i % 3]);
        g.map.dirty = true;
        g.requestSave('cache', true);
    }

    // ------------------------------------------------------------- update
    update(delta) {
        const g = this.game;
        const p = g.state.player;
        if (!p || g.mode !== 'overworld') return;
        const t = g.frame;
        this.timer -= delta;
        if (this.timer <= 0) {
            this.timer = 30;
            this.refresh();
            const ptx = Math.floor(p.wx / T), pty = Math.floor(p.wy / T);
            for (const c of this.cachesNear(ptx, pty, 30)) {
                if (this.isOpened(c.id) || this.caches.has(c.id)) continue;
                const x = (c.tx + 0.5) * T, y = (c.ty + 0.5) * T;
                if (Math.hypot(x - p.wx, y - p.wy) > SHOW) continue;
                const set = g.world.decorTextures.chest;
                const s = new PIXI.Sprite(set[0].texture);
                s.anchor.set(0.5, set[0].anchorY);
                s.position.set(x, y * TILT);
                s.zIndex = y;
                g.objectLayer.addChild(s);
                this.caches.set(c.id, { cache: c, sprite: s });
                this.known.set(c.id, c);
            }
            for (const [id, d] of this.caches) {
                const x = (d.cache.tx + 0.5) * T, y = (d.cache.ty + 0.5) * T;
                if (Math.hypot(x - p.wx, y - p.wy) > SHOW * 1.4) { d.sprite.destroy(); this.caches.delete(id); }
            }
        }
        // boats bob; the one under the hero follows them
        for (const b of this.boats.values()) {
            const sailing = g.boat && g.boat.dockId === b.id;
            if (sailing) { b.x = p.wx; b.y = p.wy; }
            b.phase += 0.05 * delta;
            const bob = Math.sin(b.phase) * 1.8;
            const sx = b.x, sy = b.y * TILT;
            b.back.position.set(sx, sy + bob); b.front.position.set(sx, sy + bob);
            b.back.zIndex = b.y - 2; b.front.zIndex = b.y + 2;
            b.back.rotation = b.front.rotation = Math.sin(b.phase * 0.7) * 0.035;
            b.wake.clear();
            const a = 0.28 + 0.1 * Math.sin(b.phase * 1.3);
            b.wake.lineStyle(2.5, 0xffffff, a); b.wake.drawEllipse(b.x, b.y + 4, 50, 18);
            b.wake.lineStyle(1.5, 0xffffff, a * 0.6); b.wake.drawEllipse(b.x, b.y + 4, 62 + Math.sin(b.phase) * 3, 23);
            if (sailing) {
                p.body.y = -6;
                p.zIndex = b.y;
                if (p.moving && (t | 0) % 4 === 0) g.fx.burst(b.x - (g.lastMove.x || 0) * 30, b.y - (g.lastMove.y || 0) * 20, 4, 0xffffff, 1, 0.8, { size: 0.6, life: 20, gravity: 0, up: 0.1, glow: true });
                g.session.boats[b.id] = { x: b.x, y: b.y };
            }
        }
        if (g.boat) this.spawnSeaMonsters(delta);
    }

    spawnSeaMonsters(delta) {
        const g = this.game;
        const p = g.state.player;
        this.spawnTimer -= delta;
        // keep the sea lively but not crowded; stray monsters are recycled when far behind
        const mine = g.state.enemies.filter((e) => e.seaSpawn && !e.dead);
        for (const e of mine) if (Math.hypot(e.wx - p.wx, e.wy - p.wy) > 1300) { e.dead = true; e.silent = true; }
        if (this.spawnTimer > 0 || mine.length >= 5) return;
        // look for open water at a few random bearings; a narrow channel may have none in some directions
        let x = 0, y = 0, found = false;
        for (let attempt = 0; attempt < 10 && !found; attempt++) {
            const a = Math.random() * Math.PI * 2, r = 480 + Math.random() * 200;
            x = p.wx + Math.cos(a) * r; y = p.wy + Math.sin(a) * r;
            found = isWaterBiome(g.world.biomeAtPos(x, y));
        }
        this.spawnTimer = found ? 150 + Math.random() * 120 : 40;
        if (!found) return;
        const level = Math.max(1, g.overworld.levelAt(Math.floor(x / T), Math.floor(y / T)));
        const type = Math.random() < 0.55 ? 'GULL' : 'JELLY';
        const e = g.makeEnemy(type, x, y, { level, elite: Math.random() < 0.08 });
        e.seaSpawn = true;
        engage(g, e, false);
    }
}

export { boatBlocked, BOAT_SPEED };
