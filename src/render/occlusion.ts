// @ts-nocheck -- Pixi display objects carry ad-hoc fields (occ, wallRow) set by the world renderer
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { isWallBiome } from '../core/world/biomes';
import { WALL_HEIGHT } from './world';

const TILT = WORLD_CONFIG.tilt;
const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;

const FADED = 0.38;           // alpha of decor standing in front of the hero
const HERO_W = 15, HERO_H = 58;
// rgb -> one flat colour, alpha kept: turns the hero render into a silhouette
const SILHOUETTE = [0, 0, 0, 0, 0.62, 0, 0, 0, 0, 0.84, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];

/**
 * Keeps the hero readable in a world drawn back to front:
 * - tall decor (trees, rocks, buildings) standing in front of the hero fades out while it covers them;
 * - when a wall or cliff in front hides the hero, a silhouette of the hero is drawn over it;
 * - names, health bars and damage numbers float on a layer above the world and its light map.
 */
export class Occlusion {
    constructor(game) {
        this.game = game;
        this.faded = new Set();
        this.floats = [];
        this.layer = new PIXI.Container();
        this.layer.zIndex = 8.6;             // above the light map (8) and ambience (8.5), below the HUD
        this.layer.eventMode = 'none';
        game.app.stage.addChild(this.layer);

        this.rt = PIXI.RenderTexture.create({ width: 96, height: 112 });
        this.ghost = new PIXI.Sprite(this.rt);
        this.ghost.anchor.set(0.5, 100 / 112);
        this.ghost.zIndex = 1e8;
        this.ghost.eventMode = 'none';
        this.ghost.alpha = 0;
        const cm = new PIXI.ColorMatrixFilter();
        cm.matrix = SILHOUETTE;
        this.ghost.filters = [cm];
        this.matrix = new PIXI.Matrix();
        this.ghostOn = false;
    }

    /** Move `node` (a child of `target`, e.g. its name or health bar) onto the overlay, following `target`. */
    float(target, node) {
        const dx = node.x, dy = node.y;
        if (node.parent) node.parent.removeChild(node);
        this.layer.addChild(node);
        this.floats.push({ target, node, dx, dy });
        node.position.set(target.x + dx, target.y + dy);
    }

    /** Called once per rendered frame, after the camera moved. */
    update(delta = 1) {
        const g = this.game;
        this.layer.position.copyFrom(g.worldContainer.position);
        this.layer.visible = g.worldContainer.visible;
        this.syncFloats();
        const p = g.state.player;
        if (!p || p.destroyed || !p.parent) { this.restoreAll(); this.setGhost(false); return; }
        this.fadeOccluders(p, delta);
    }

    syncFloats() {
        for (let i = this.floats.length - 1; i >= 0; i--) {
            const f = this.floats[i];
            if (f.target.destroyed || !f.target.parent) {
                if (!f.node.destroyed) f.node.destroy({ children: true });
                this.floats.splice(i, 1);
                continue;
            }
            f.node.position.set(f.target.x + f.dx, f.target.y + f.dy);
            f.node.renderable = f.target.visible && !f.target.dead;
        }
    }

    fadeOccluders(p, delta) {
        const g = this.game;
        const hx = p.x, hy = p.y;
        const l = hx - HERO_W, r = hx + HERO_W, t = hy - HERO_H, b = hy - 4;
        const pcx = Math.floor(p.wx / (T * CT)), pcy = Math.floor(p.wy / (T * CT));
        const htx = Math.floor(p.wx / T), hty = Math.floor(p.wy / T);
        const hit = this.hit || (this.hit = new Set());
        hit.clear();
        let wall = false;
        for (const v of g.world.views.values()) {
            if (Math.abs(v.cx - pcx) > 1 || v.cy < pcy || v.cy > pcy + 1) continue;
            for (const o of v.objects) {
                if (o.destroyed || o.zIndex <= p.wy) continue;
                if (o.wallRow !== undefined) {
                    if (!wall && o.wallRow > hty && o.wallRow <= hty + 3) wall = this.wallCovers(o.wallRow, htx, hx, hy);
                    continue;
                }
                if (!o.occ || !o.visible) continue;
                const w = Math.abs(o.width) * 0.8, h = o.height;
                const ol = o.x - w / 2, ot = o.y - h * o.anchor.y;
                if (ol > r || ol + w < l || ot > b || o.y < t) continue;
                hit.add(o);
            }
        }
        const k = Math.min(1, 0.18 * delta);
        for (const o of hit) this.faded.add(o);
        for (const o of this.faded) {
            if (o.destroyed) { this.faded.delete(o); continue; }
            const goal = hit.has(o) ? FADED : 1;
            o.alpha += (goal - o.alpha) * k;
            if (goal === 1 && o.alpha > 0.985) { o.alpha = 1; this.faded.delete(o); }
        }
        this.setGhost(wall, p, delta);
    }

    /** Does a wall in tile row `ty`, near the hero's column, rise high enough to hide the hero? */
    wallCovers(ty, htx, hx, hy) {
        const world = this.game.world;
        for (let tx = htx - 1; tx <= htx + 1; tx++) {
            const biome = world.biomeAt(tx, ty);
            if (!isWallBiome(biome)) continue;
            if (tx * T > hx + HERO_W || (tx + 1) * T < hx - HERO_W) continue;
            const top = ty * T * TILT - (WALL_HEIGHT[biome] ?? 46);
            if (top < hy - 10) return true;
        }
        return false;
    }

    setGhost(on, p = null, delta = 1) {
        const ghost = this.ghost;
        const g = this.game;
        if (on && p) {
            if (ghost.parent !== g.objectLayer) g.objectLayer.addChild(ghost);
            this.matrix.set(1, 0, 0, 1, 48, 100);
            g.app.renderer.render(p.body, { renderTexture: this.rt, clear: true, transform: this.matrix });
            ghost.position.set(p.x, p.y);
            ghost.alpha = Math.min(0.55, ghost.alpha + 0.08 * delta);
            ghost.visible = true;
        } else if (ghost.visible) {
            ghost.alpha = Math.max(0, ghost.alpha - 0.1 * delta);
            if (ghost.alpha <= 0) ghost.visible = false;
            else if (p) ghost.position.set(p.x, p.y);
        }
        this.ghostOn = on;
    }

    restoreAll() {
        for (const o of this.faded) if (!o.destroyed) o.alpha = 1;
        this.faded.clear();
    }
}
