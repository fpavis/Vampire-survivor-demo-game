// @ts-nocheck -- Pixi-bound runtime over render/filters and the pure rules in core/render/look, core/world/surfaceFx
// How the scene looks: the art style (pixel or smooth), the screen filter and colour grade the player picked, and
// what the ground under the hero does to the picture (lava glows red and shimmers, ice frosts the edges, quicksand
// drains the colour). Two filters at most: one on the world layer, one over the scene; each comes off entirely
// when it has nothing to do, so the plain smooth look renders exactly as before.
import * as PIXI from 'pixi.js';
import { GRADES, PostFilter, WorldGradeFilter, crtWarp, hexToVec } from '../render/filters';
import { NO_LOOK, blendLook, surfaceLook } from '../core/world/surfaceFx';
import { pixelCell } from '../core/render/look';
import { settings } from './settings';
import { access } from './access';

const POST_MODE = { none: 0, pixelate: 1, crt: 2, grain: 3 };
const EASE = 0.07;           // per frame toward the new look: about 0.4 s to settle

export class LookSystem {
    constructor(game) {
        this.game = game;
        this.worldFx = new WorldGradeFilter();
        this.post = new PostFilter();
        // 0: the filters render at the screen's own resolution (sharp on high-density displays)
        this.worldFx.resolution = 0;
        this.post.resolution = 0;
        this.look = { ...NO_LOOK };
        this.blight = 0;            // how far into corrupted land the party stands, eased (0..1)
        this.cell = 0;
        this.t = 0;
        this.held = false;
        this.edge = null;
    }

    /** Hook the filters to the scene (the world layer and the root under the names and the HUD). */
    attach() {
        const g = this.game;
        g.worldContainer.filterArea = g.app.screen;
        g.sceneRoot.filterArea = g.app.screen;
        // frost and heat creep in from the screen edges: a white rim, tinted per surface
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        // clear in the middle, strong along the edges (the middle of each side is 64 from the centre)
        const grad = ctx.createRadialGradient(64, 64, 38, 64, 64, 78);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        this.edge = new PIXI.Sprite(PIXI.Texture.from(c));
        this.edge.eventMode = 'none';
        this.edge.zIndex = 9;
        this.edge.alpha = 0;
        this.edge.visible = false;
        g.sceneRoot.addChild(this.edge);
        this.layout();
    }

    layout() {
        if (!this.edge) return;
        const { width, height } = this.game.app.screen;
        this.edge.width = width;
        this.edge.height = height;
    }

    /** One art pixel in CSS pixels (0 in the smooth style): the camera snaps to it. */
    cellSize() {
        const g = this.game;
        return settings.artStyle === 'pixel' ? pixelCell(settings.pixelSize, g.zoom || 1, g.app.renderer.resolution) : 0;
    }

    update(delta) {
        const g = this.game;
        this.t += delta / 60;
        // the ground under the hero (on the overworld; places have no surfaces), eased in and out
        const id = g.mode === 'overworld' && g.surfaces && g.surfaces.current ? g.surfaces.current.id : null;
        const target = g.state.player ? surfaceLook(id, settings.flash, access.reducedMotion) : NO_LOOK;
        this.look = blendLook(this.look, target, Math.min(1, EASE * delta));
        this.cell = this.cellSize();

        const u = this.worldFx.uniforms, L = this.look;
        u.uCell = this.cell;
        u.uTime = this.t;
        hexToVec(L.tint, u.uTint);
        u.uTintA = L.tintAlpha;
        u.uShimmer = L.shimmer;
        // corrupted lands: the whole picture drained and leaning violet, more so toward the heart of the blight
        const blight = g.mode === 'overworld' && g.state.player ? (g.zoneCorrupt || 0) : 0;
        this.blight += (blight - this.blight) * Math.min(1, 0.03 * delta);
        if (this.blight < 0.002) this.blight = 0;
        hexToVec(0x6a3a9a, u.uTint2);
        u.uTint2A = 0.13 * this.blight;
        u.uDesat = Math.max(L.desat, 0.22 * this.blight);

        const p = this.post.uniforms, grade = GRADES[settings.colorGrade] || GRADES.none;
        p.uMode = POST_MODE[settings.postFx] || 0;
        p.uPix = 4;
        p.uFlicker = access.reducedMotion ? 0 : 1;
        p.uTime = this.t;
        p.uScreen[0] = g.app.screen.width; p.uScreen[1] = g.app.screen.height;
        p.uGrade.set(grade.m);
        p.uContrast = grade.contrast;

        if (this.edge) {
            const a = L.edge !== null && L.edge !== undefined ? L.edgeAlpha : 0;
            this.edge.visible = a > 0.01;
            this.edge.alpha = a;
            if (L.edge !== null && L.edge !== undefined) this.edge.tint = L.edge;
        }
        this.apply();
    }

    /** Put each filter on only while it changes something. */
    apply() {
        const g = this.game;
        const w = !this.held && !this.worldFx.idle, s = !this.held && !this.post.idle;
        if (w !== !!(g.worldContainer.filters && g.worldContainer.filters.length)) g.worldContainer.filters = w ? [this.worldFx] : null;
        if (s !== !!(g.sceneRoot.filters && g.sceneRoot.filters.length)) g.sceneRoot.filters = s ? [this.post] : null;
    }

    /** Run `fn` with the filters off (the save thumbnail renders the scene scaled down, where they do not fit). */
    without(fn) {
        this.held = true;
        this.apply();
        try { return fn(); } finally { this.held = false; this.apply(); }
    }

    /** Where a click lands in the flat scene: the CRT glass bends the picture, so clicks bend the same way. */
    unwarp(x, y) {
        if (settings.postFx !== 'crt') return { x, y };
        const { width, height } = this.game.app.screen;
        return crtWarp(x, y, width, height, this.post.uniforms.uCurve);
    }
}
