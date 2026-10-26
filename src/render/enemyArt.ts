// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
// Procedural sprites for every enemy. Each builder draws into `body` (feet at the origin, facing right)
// and returns { height, anim(e, t) } where `height` is used to place health bars and damage numbers.
import { INK, canopy, fpoly, opoly, ostroke, shade } from './decorArt';
import { softGlow } from './glow';

const glowCircle = (radius, color, alpha) => softGlow(radius, color, alpha);

// Solid shapes of a readable size get a dark outline in their own hue: a consistent, punchy cartoon style.
const outline = (g, c, size, a) => {
    if (a >= 1 && size >= 3.5) g.lineStyle(Math.min(2, 0.9 + size * 0.04), shade(c, 0.36), 0.9);
    else g.lineStyle(0);
};
const polySize = (pts) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    return Math.min(x1 - x0, y1 - y0) / 2;
};
const ell = (g, x, y, rx, ry, c, a = 1) => { outline(g, c, Math.min(rx, ry), a); g.beginFill(c, a); g.drawEllipse(x, y, rx, ry); g.endFill(); g.lineStyle(0); };
const circ = (g, x, y, r, c, a = 1) => { outline(g, c, r, a); g.beginFill(c, a); g.drawCircle(x, y, r); g.endFill(); g.lineStyle(0); };
const poly = (g, pts, c, a = 1) => { outline(g, c, polySize(pts), a); g.beginFill(c, a); g.drawPolygon(pts); g.endFill(); g.lineStyle(0); };
const rect = (g, x, y, w, h, c, a = 1) => { outline(g, c, Math.min(w, h) / 2, a); g.beginFill(c, a); g.drawRect(x, y, w, h); g.endFill(); g.lineStyle(0); };

// ink-outlined primitives for the redrawn monsters (same ink as the trees and rocks)
const io = (g, w = 1.5, a = 0.92) => g.lineStyle(w, INK, a);
const iell = (g, x, y, rx, ry, c, w = 1.5) => { io(g, w); g.beginFill(c); g.drawEllipse(x, y, rx, ry); g.endFill(); g.lineStyle(0); };
const icirc = (g, x, y, r, c, w = 1.5) => { io(g, w); g.beginFill(c); g.drawCircle(x, y, r); g.endFill(); g.lineStyle(0); };
/** an outline-only ellipse, to clean up the edge after stripes or patterns were painted inside */
const ring = (g, x, y, rx, ry, w = 1.5) => { io(g, w); g.beginFill(0, 0); g.drawEllipse(x, y, rx, ry); g.endFill(); g.lineStyle(0); };

const windupShake = (e, body) => {
    if (e.ai && (e.ai.state === 'windup' || e.ai.state === 'surface')) body.x = (Math.random() - 0.5) * 3;
    else body.x = 0;
};

// -------------------------------------------------------------------- field
function slime(body, t, r) {
    const c = t.color, g = new PIXI.Graphics();
    ell(g, 0, -r * 0.62, r * 1.05, r * 0.78, shade(c, 0.6));
    ell(g, -1, -r * 0.72, r * 0.98, r * 0.7, c);
    ell(g, -r * 0.38, -r * 1.1, r * 0.34, r * 0.2, shade(c, 1.45), 0.85);
    circ(g, -r * 0.32, -r * 0.7, r * 0.22, 0xffffff); circ(g, r * 0.32, -r * 0.7, r * 0.22, 0xffffff);
    circ(g, -r * 0.27, -r * 0.68, r * 0.11, 0x162016); circ(g, r * 0.37, -r * 0.68, r * 0.11, 0x162016);
    g.lineStyle(2, 0x162016); g.moveTo(-r * 0.2, -r * 0.34); g.quadraticCurveTo(0, -r * 0.2, r * 0.2, -r * 0.34);
    body.addChild(g);
    return {
        height: r * 2,
        anim: (e) => {
            const sq = Math.sin(e.phase * 1.3);
            const base = e.elite ? 1.12 : 1;
            body.scale.set(base * (1 + sq * 0.07), base * (1 - sq * 0.09));
        }
    };
}

function bee(body, t, r) {
    const hover = new PIXI.Container();
    hover.y = -20;
    const wl = new PIXI.Graphics(), wr = new PIXI.Graphics();
    [[wl, -1], [wr, 1]].forEach(([w, s]) => {
        io(w, 1.1, 0.7); w.beginFill(0xe8f8ff, 0.62); w.drawEllipse(s * 3, -6, 6, 9); w.endFill(); w.lineStyle(0);
        w.lineStyle(0.8, 0x9ab8d0, 0.8); w.moveTo(s * 1, 1); w.lineTo(s * 4, -10); w.moveTo(s * 2, -2); w.lineTo(s * 7, -8); w.lineStyle(0);
        w.position.set(3, -4); w.rotation = s * -0.35;
    });
    const g = new PIXI.Graphics();
    // legs
    g.lineStyle(1.3, INK, 0.9); [[0, 5], [4, 5.5], [8, 5]].forEach(([x, y]) => { g.moveTo(x, 2); g.lineTo(x - 2, y + 2); }); g.lineStyle(0);
    // striped abdomen with a stinger
    opoly(g, [-12, 1.5, -18, 2.5, -12, 4], 0x2a2018, 1.1);
    g.beginFill(0xffc933); g.drawEllipse(-4, 0.5, 9.5, 7); g.endFill();
    g.beginFill(0xffe680); g.drawEllipse(-6, -2.5, 5, 2.4); g.endFill();
    g.beginFill(0x2a2018); g.drawEllipse(-5.5, 0.5, 1.9, 6.8); g.drawEllipse(-0.5, 0.5, 1.9, 6.9); g.drawEllipse(-10.5, 0.8, 1.4, 4.6); g.endFill();
    ring(g, -4, 0.5, 9.5, 7);
    // fuzzy thorax and head
    icirc(g, 6, -1, 5.2, 0x7a5228);
    g.beginFill(0xb88a48); [[4.5, -3.5], [7, -4], [5, -1], [8, -1.5]].forEach(([x, y]) => g.drawCircle(x, y, 1)); g.endFill();
    icirc(g, 11, 0, 4.2, 0x2a2018);
    g.beginFill(0xffffff); g.drawEllipse(12.4, -1.2, 1.5, 1.9); g.endFill();
    g.beginFill(0x2a2018); g.drawCircle(12.8, -1, 0.8); g.endFill();
    g.lineStyle(1.1, INK); g.moveTo(11, -3.5); g.quadraticCurveTo(12, -9, 15, -9); g.moveTo(12.5, -3.5); g.quadraticCurveTo(15, -7, 17.5, -6.5); g.lineStyle(0);
    hover.addChild(wl, g, wr);
    body.addChild(hover);
    return {
        height: 28,
        anim: (e) => {
            const f = Math.sin(e.phase * 6);
            wl.scale.y = wr.scale.y = 0.35 + Math.abs(f) * 0.75;
            hover.y = -20 + Math.sin(e.phase * 1.4) * 2.5;
            body.scale.x = e.facing;
        }
    };
}

function boar(body, t, r, opts = {}) {
    const c = t.color, dark = shade(c, 0.6), k = r / 20;
    const K = (pts) => pts.map((v) => v * k);
    const legs = [];
    const legG = (x, col) => {
        const g = new PIXI.Graphics();
        opoly(g, K([-2.6, 0, 2.6, 0, 2.2, 9, -2.2, 9]), col, 1.3);
        opoly(g, K([-2.6, 8, 2.8, 8, 3.2, 11, -2.8, 11]), 0x2a1a12, 1.1);
        g.position.set(x * k, -11 * k); legs.push(g); return g;
    };
    const back = [legG(-13, dark), legG(9, dark)];
    const g = new PIXI.Graphics();
    // hunched body: high shoulders, darker belly, a bristly mane along the spine
    opoly(g, K([-25, -13, -23, -24, -13, -31, 3, -34, 14, -31, 20, -22, 19, -11, 9, -7, -17, -7]), c, 1.8);
    fpoly(g, K([-24, -13, -17, -8, 9, -8, 19, -11, 19, -15, 6, -12, -16, -12]), shade(c, 0.72));
    fpoly(g, K([-20, -24, -12, -29, 2, -31, 0, -27, -12, -25]), shade(c, 1.28), 0.85);
    opoly(g, K([-21, -25, -18, -31, -15, -28, -12, -35, -8, -30, -4, -37, 0, -32, 4, -38, 7, -32, 11, -36, 13, -30, 8, -29, -14, -27]), shade(c, 0.42), 1.4);
    g.lineStyle(1, shade(c, 0.5), 0.8); g.moveTo(-14, -18 * k); g.lineTo(-9 * k, -21 * k); g.moveTo(-4 * k, -16 * k); g.lineTo(1 * k, -19 * k); g.lineStyle(0);
    // tail
    g.lineStyle(1.6 * k, INK); g.moveTo(-24 * k, -20 * k); g.quadraticCurveTo(-30 * k, -24 * k, -27 * k, -27 * k); g.lineStyle(0);
    // head: wedge, ear, snout disc, tusk and eye
    opoly(g, K([13, -29, 23, -27, 31, -19, 35, -12, 33, -6, 24, -6, 15, -11]), shade(c, 1.08), 1.7);
    fpoly(g, K([16, -12, 24, -7, 33, -6.5, 34, -9, 25, -11]), shade(c, 0.78));
    opoly(g, K([15, -27, 17, -36, 22, -27]), dark, 1.3);
    fpoly(g, K([16.5, -28, 17.5, -33, 20, -28]), 0xd88a8a);
    iell(g, 34 * k, -12 * k, 3.2 * k, 4.6 * k, 0xe8a898, 1.4);
    g.beginFill(0x3a1a12); g.drawEllipse(34.6 * k, -13.4 * k, 0.8 * k, 1.2 * k); g.drawEllipse(34.6 * k, -10.2 * k, 0.8 * k, 1.2 * k); g.endFill();
    opoly(g, K([28, -8, 30, -15, 32, -17, 31.5, -13, 30.5, -8]), opts.tusk || 0xf4f0e0, 1.2);
    icirc(g, 24 * k, -20 * k, 2.1 * k, opts.eye || 0x2a1810, 1.1);
    g.beginFill(0xffffff, 0.9); g.drawCircle(23.4 * k, -20.8 * k, 0.7 * k); g.endFill();
    if (opts.crown) {
        opoly(g, K([15, -26, 17, -37, 20, -29, 23, -39, 26, -29, 29, -37, 30, -25]), 0xffc233, 1.4);
        icirc(g, 23 * k, -31 * k, 2 * k, 0xff4a4a, 1);
        // armour plates
        opoly(g, K([-15, -30, 6, -33, 8, -18, -13, -15]), 0x6a6a7a, 1.5);
        fpoly(g, K([-15, -30, -4, -32, -3, -17, -13, -15]), 0x9a9aaa, 0.85);
        g.beginFill(0xd8d8e0); [[-10, -27], [2, -29], [-9, -18], [4, -20]].forEach(([x, y]) => g.drawCircle(x * k, y * k, 1.1 * k)); g.endFill();
    }
    const front = [legG(-7, c), legG(14, c)];
    back.forEach((l) => body.addChild(l));
    body.addChild(g);
    front.forEach((l) => body.addChild(l));
    return {
        height: 40 * k,
        anim: (e) => {
            const a = e.ai && e.ai.state;
            const trot = Math.sin(e.phase * 3);
            legs.forEach((l, i) => { l.rotation = (i % 2 ? 1 : -1) * trot * (a === 'dash' ? 0.6 : 0.3); });
            if (a === 'dash') { body.rotation = 0.08; body.y = 0; }
            else if (a === 'windup') { body.rotation = -0.04; windupShake(e, body); }
            else { body.rotation = Math.sin(e.phase * 1.5) * 0.03; body.y = Math.abs(Math.sin(e.phase * 1.5)) * -1.5; }
            if (a !== 'windup') body.x = 0;
            body.scale.x = e.facing * (e.elite ? 1.12 : 1);
        }
    };
}

// ------------------------------------------------------------------- forest
function wolf(body, t, r) {
    const c = t.color, dark = shade(c, 0.55), light = shade(c, 1.3);
    // separate legs so it can gallop
    const legG = (x, col) => { const g = new PIXI.Graphics(); rect(g, -2.2, 0, 4.4, 10, col); ell(g, 0.8, 10, 3.4, 1.8, shade(col, 0.7)); g.position.set(x, -11); return g; };
    const legs = [legG(-12, dark), legG(7, dark), legG(-6, shade(c, 0.75)), legG(13, shade(c, 0.75))];
    const tail = new PIXI.Graphics();
    poly(tail, [0, 0, -10, -6, -20, -4, -26, 4, -18, 2, -10, 4], shade(c, 0.85));
    poly(tail, [-18, -2, -26, 4, -21, 3], light);
    tail.position.set(-16, -18);
    const g = new PIXI.Graphics();
    ell(g, 0, -17, 19, 9.5, shade(c, 0.8));
    ell(g, -1, -19, 18, 8, c);
    poly(g, [-14, -24, -4, -27, 8, -26, 2, -22, -10, -21], dark);              // darker saddle along the back
    ell(g, 2, -12.5, 11, 3.5, light, 0.8);                                        // pale belly
    // shaggy mane
    poly(g, [8, -27, 13, -31, 15, -26, 18, -29, 19, -23, 14, -12, 6, -14], shade(c, 0.9));
    // head
    ell(g, 20, -22, 8.5, 7.5, shade(c, 1.05));
    poly(g, [24, -25, 37, -20, 37, -17, 26, -15], shade(c, 1.15));              // muzzle
    poly(g, [26, -17, 36, -17, 33, -14, 27, -14], light);
    circ(g, 37, -19, 2, 0x1a1a1a);
    poly(g, [14, -27, 15, -36, 20, -28], dark); poly(g, [19, -28, 23, -36, 25, -27], shade(c, 0.7));
    poly(g, [16, -29, 17, -33, 19, -29], 0xd88a8a);
    circ(g, 23, -24, 2.3, 0xffd84a); circ(g, 23.6, -24, 1.1, 0x1a1a1a); circ(g, 22.8, -24.8, 0.6, 0xffffff);
    const jaw = new PIXI.Graphics();
    poly(jaw, [0, 0, 9, 1, 7, 4, 0, 3], shade(c, 0.9));
    poly(jaw, [2, 0, 3, -2.5, 4, 0], 0xffffff); poly(jaw, [6, 0.5, 7, -2, 8, 1], 0xffffff);
    jaw.position.set(26, -15);
    legs.slice(0, 2).forEach((l) => body.addChild(l));
    body.addChild(tail, g, jaw);
    legs.slice(2).forEach((l) => body.addChild(l));
    return {
        height: 38,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            const run = Math.sin(e.phase * 2.2);
            legs[0].rotation = run * 0.6; legs[1].rotation = -run * 0.6; legs[2].rotation = -run * 0.5; legs[3].rotation = run * 0.5;
            tail.rotation = Math.sin(e.phase * 1.6) * 0.25;
            jaw.rotation = s === 'lunge' || s === 'windup' ? 0.45 : 0.05;
            if (s === 'lunge') { body.rotation = 0.12; body.scale.y = 0.92; }
            else if (s === 'windup') { body.rotation = -0.05; body.scale.y = 0.86; windupShake(e, body); }
            else { body.rotation = 0; body.scale.y = 1; body.y = Math.abs(run) * -2; }
        }
    };
}

function spider(body, t, r) {
    const c = t.color, hover = new PIXI.Container();
    hover.y = -12;
    // eight jointed legs, each its own graphic so they can skitter; ink-edged so they read against any ground
    const legs = [];
    for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
        const g = new PIXI.Graphics();
        const spread = 17 + i * 2.5, knee = -13 - i;
        ostroke(g, 2.2, shade(c, 0.75), () => { g.moveTo(0, 0); g.lineTo(side * spread * 0.62, knee); g.lineTo(side * spread, 12); });
        g.position.set(3 + (i - 1.5) * 2.6, -1 + i * 1.4);
        legs.push({ g, i, side });
    }
    const g = new PIXI.Graphics();
    // abdomen with a red hourglass, sheen and hairs
    iell(g, -10, -1, 12.5, 10.5, shade(c, 0.78), 1.7);
    g.beginFill(c); g.drawEllipse(-11, -3, 10.5, 8); g.endFill();
    g.beginFill(shade(c, 1.45), 0.7); g.drawEllipse(-14, -7, 4.5, 2.2); g.endFill();
    io(g, 1); g.beginFill(0xe0405a); g.drawPolygon([-14, -5, -10, -8, -6, -5, -9.5, -2, -6, 1.5, -10, 4.5, -14, 1.5, -10.5, -2]); g.endFill(); g.lineStyle(0);
    g.lineStyle(1, shade(c, 0.45)); for (let k = 0; k < 6; k++) { g.moveTo(-20 + k * 3.4, -9 + (k % 2) * 1.5); g.lineTo(-21 + k * 3.4, -12.5 + (k % 2) * 1.5); } g.lineStyle(0);
    // head with fangs and a cluster of glowing eyes
    iell(g, 6, -1.5, 7.5, 6.2, shade(c, 1.12), 1.6);
    opoly(g, [10, 2, 13.5, 8, 11, 4.5], 0xf0e8d8, 1); opoly(g, [7, 3, 8.5, 9, 6.5, 4.5], 0xf0e8d8, 1);
    g.beginFill(0xff3a3a); [[10, -4.5, 1.5], [12.7, -3, 1.3], [8.8, -2, 1.1], [11.6, -0.6, 1.1], [7.8, -5.4, 1], [13.2, -5.2, 1]].forEach(([x, y, rr]) => g.drawCircle(x, y, rr)); g.endFill();
    g.beginFill(0xffd0d0); g.drawCircle(9.6, -4.9, 0.5); g.drawCircle(12.4, -3.4, 0.45); g.endFill();
    const eyes = glowCircle(7, 0xff3a3a, 0.25); eyes.position.set(11, -2.5);
    legs.forEach((l) => hover.addChild(l.g));
    hover.addChild(g, eyes);
    body.addChild(hover);
    return {
        height: 28,
        anim: (e) => {
            body.scale.x = e.facing;
            for (const l of legs) l.g.rotation = Math.sin(e.phase * 4 + l.i * 1.6 + (l.side > 0 ? Math.PI : 0)) * 0.12;
            hover.y = -12 + Math.abs(Math.sin(e.phase * 4)) * -1.5;
            windupShake(e, body);
        }
    };
}

function treant(body, t, r, opts = {}) {
    const c = t.color, k = r / 28, g = new PIXI.Graphics();
    const K = (pts) => pts.map((v) => v * k);
    const leaf = opts.leaf || 0x3a8a3a;
    // branch arms ending in leafy tufts
    const arm = (s) => ostroke(g, 6 * k, shade(c, 0.8), () => { g.moveTo(s * 12 * k, -42 * k); g.quadraticCurveTo(s * 32 * k, -40 * k, s * 34 * k, -18 * k); });
    arm(-1); arm(1);
    ostroke(g, 2.4 * k, shade(c, 0.8), () => { g.moveTo(-30 * k, -30 * k); g.lineTo(-40 * k, -34 * k); g.moveTo(31 * k, -26 * k); g.lineTo(40 * k, -30 * k); });
    // roots and trunk body
    opoly(g, K([-22, 0, -14, -9, -13, -50, 13, -50, 14, -9, 22, 0, 8, -2, 3, -6, -3, -6, -9, -2]), c, 2);
    fpoly(g, K([2, -50, 13, -50, 14, -9, 22, 0, 8, -2, 3, -6]), shade(c, 0.66));
    fpoly(g, K([-11, -48, -7, -48, -8, -12, -12, -12]), shade(c, 1.3), 0.6);
    g.lineStyle(1.4 * k, shade(c, 0.45), 0.9);
    g.moveTo(-4 * k, -14 * k); g.lineTo(-6 * k, -24 * k); g.moveTo(7 * k, -12 * k); g.lineTo(6 * k, -22 * k); g.moveTo(-8 * k, -44 * k); g.lineTo(-6 * k, -48 * k);
    g.lineStyle(0);
    // a hollow face: dark sockets with glowing eyes and a gnarled mouth
    const eye = opts.eye || 0xffb030;
    iell(g, -6 * k, -38 * k, 4.6 * k, 3.6 * k, 0x1a1008, 1.2); iell(g, 6 * k, -38 * k, 4.6 * k, 3.6 * k, 0x1a1008, 1.2);
    g.beginFill(eye); g.drawCircle(-5.5 * k, -38 * k, 2.2 * k); g.drawCircle(6.5 * k, -38 * k, 2.2 * k); g.endFill();
    io(g, 1.2); g.beginFill(0x1a1008); g.drawPolygon(K([-7, -28, -3, -26, 0, -28, 3, -26, 7, -28, 4, -23, -4, -23])); g.endFill(); g.lineStyle(0);
    // leafy crown and tufts at the hands, drawn like the forest's trees
    canopy(g, [[0, -66, 22], [-19, -58, 16], [19, -58, 16], [-8, -52, 15], [9, -52, 15]].map(([x, y, rr]) => [x * k, y * k, rr * k]), leaf, 21, { ink: 2 });
    canopy(g, [[-36 * k, -16 * k, 6 * k], [-40 * k, -34 * k, 5 * k]], leaf, 22, { ink: 1.4 });
    canopy(g, [[36 * k, -16 * k, 6 * k], [40 * k, -30 * k, 5 * k]], leaf, 23, { ink: 1.4 });
    if (opts.mushrooms) {
        [[-24, -46, 0xd23a3a], [22, -44, 0x8a4ac8], [-6, -12, 0xd8a03a]].forEach(([x, y, col]) => {
            opoly(g, K([x - 2, y + 8, x - 1.6, y, x + 1.6, y, x + 2, y + 8]), 0xe8dfc8, 1.1);
            iell(g, x * k, y * k, 7 * k, 4.4 * k, col, 1.3);
            g.beginFill(0xffffff, 0.9); g.drawCircle((x - 2) * k, (y - 1.5) * k, 1.2 * k); g.drawCircle((x + 3) * k, (y - 0.5) * k, 1 * k); g.endFill();
        });
    }
    body.addChild(g);
    const glow = glowCircle(10 * k, eye, 0.2); glow.y = -38 * k; body.addChild(glow);
    return {
        height: 88 * k,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.rotation = s === 'windup' ? -0.1 : Math.sin(e.phase * 0.6) * 0.035;
            body.y = s === 'windup' ? -3 : 0;
            if (s === 'slam' || s === 'recover') body.scale.y = 0.94; else body.scale.y = 1;
            windupShake(e, body);
        }
    };
}

// ------------------------------------------------------------------- desert
function scorpion(body, t, r) {
    const c = t.color, g = new PIXI.Graphics();
    // legs
    for (let i = 0; i < 4; i++) { const x = -9 + i * 6; ostroke(g, 1.4, shade(c, 0.7), () => { g.moveTo(x, -7); g.lineTo(x - 5, -1); g.moveTo(x, -7); g.lineTo(x + 3, 1); }); }
    // segmented body plates
    iell(g, -1, -9, 15, 8, shade(c, 0.72), 1.7);
    g.beginFill(c); g.drawEllipse(-2, -10.5, 13.5, 6); g.endFill();
    g.lineStyle(1, shade(c, 0.45), 0.9); [-8, -3, 2].forEach((x) => { g.moveTo(x, -16); g.quadraticCurveTo(x + 1.5, -10, x, -4); }); g.lineStyle(0);
    g.beginFill(shade(c, 1.35), 0.7); g.drawEllipse(-5, -14, 6, 1.8); g.endFill();
    iell(g, 12, -10, 6.5, 5.2, shade(c, 1.12), 1.5);
    g.beginFill(0x1a1a1a); g.drawCircle(15, -12.4, 1.3); g.drawCircle(15.4, -8.8, 1.1); g.endFill();
    // claws: arm plus an open pincer
    [-1, 1].forEach((s) => {
        ostroke(g, 2.4, shade(c, 0.85), () => { g.moveTo(14, -10 + s * 4); g.lineTo(22, -10 + s * 9); });
        opoly(g, [21, -10 + s * 9 - 4.5, 34, -10 + s * 9 - 1.5, 27, -10 + s * 9, 34, -10 + s * 9 + 2, 21, -10 + s * 9 + 4.5], shade(c, 1.1), 1.4);
    });
    // a tail of shrinking outlined segments ending in a stinger
    const tail = new PIXI.Container();
    const tg = new PIXI.Graphics();
    const segs = [[0, 0, 5], [-6, -6, 4.6], [-8, -14, 4.2], [-6, -22, 3.8], [-1, -28, 3.4], [5, -30, 3]];
    for (const [x, y, rr] of segs) { iell(tg, x, y, rr, rr * 0.9, shade(c, 0.9), 1.3); tg.beginFill(shade(c, 1.3), 0.7); tg.drawEllipse(x - rr * 0.3, y - rr * 0.35, rr * 0.45, rr * 0.3); tg.endFill(); }
    opoly(tg, [7, -32, 15, -29, 9, -26.5], 0xff5a3a, 1.2);
    tail.addChild(tg); tail.position.set(-12, -11);
    const dust = new PIXI.Graphics(); ell(dust, 0, -2, 20, 8, 0xc8a060, 0.85); dust.visible = false;
    body.addChild(dust, g, tail);
    return {
        height: 36,
        anim: (e) => {
            body.scale.x = e.facing;
            tail.rotation = Math.sin(e.phase * 1.6) * 0.18 + (e.ai && e.ai.state === 'fight' ? Math.sin(e.phase * 5) * 0.12 : 0);
            const hidden = e.untargetable;
            dust.visible = hidden; g.alpha = hidden ? 0.15 : 1; tail.alpha = g.alpha;
            e.shadow.alpha = hidden ? 0.1 : 1;
            windupShake(e, body);
        }
    };
}

function vulture(body, t, r) {
    const c = t.color, hover = new PIXI.Container();
    hover.y = -32;
    const wl = new PIXI.Graphics(), wr = new PIXI.Graphics();
    [wl, wr].forEach((w, i) => {
        const s = i ? 1 : -1;
        poly(w, [0, 0, s * 18, -12, s * 34, -4, s * 30, 4, s * 20, 2, s * 12, 8, 0, 6], shade(c, 0.8));
        poly(w, [0, 0, s * 18, -10, s * 24, -3, s * 10, 4], shade(c, 1.3), 0.7);
        for (let k = 0; k < 4; k++) rect(w, s * (14 + k * 5) - 1, -6 + k, 2, 8, 0x1a1618);
    });
    const g = new PIXI.Graphics();
    ell(g, 0, 4, 8, 11, shade(c, 0.9)); circ(g, 0, -8, 6, 0xd8a090);
    poly(g, [4, -9, 12, -7, 4, -5], 0xe8c860);
    circ(g, 2, -10, 1.2, 0x1a1a1a);
    ell(g, 0, -1, 7, 3, 0xe8e0d0);
    hover.addChild(wl, wr, g);
    body.addChild(hover);
    return {
        height: 44,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            const f = s === 'dive' ? 0.15 : Math.sin(e.phase * 2.2);
            wl.scale.y = wr.scale.y = s === 'dive' ? 0.5 : 0.7 + Math.abs(f) * 0.5;
            wl.rotation = f * 0.3; wr.rotation = -f * 0.3;
            hover.y = -32 + Math.sin(e.phase) * 2;
            hover.rotation = s === 'dive' ? 0.5 : 0;
            body.scale.x = e.facing;
            windupShake(e, body);
        }
    };
}

function mummy(body, t, r) {
    const c = t.color, k = r / 22, g = new PIXI.Graphics();
    const K = (pts) => pts.map((v) => v * k);
    const dk = shade(c, 0.62);
    // legs and the wrapped body
    opoly(g, K([-10, 0, -10, -17, -2, -17, -2, 0]), shade(c, 0.72), 1.5);
    opoly(g, K([2, 0, 2, -17, 10, -17, 10, 0]), shade(c, 0.82), 1.5);
    opoly(g, K([-14, -15, -11, -50, 11, -50, 14, -15]), shade(c, 0.78), 1.8);
    fpoly(g, K([-14, -15, -11, -50, 1, -50, 1, -15]), c);
    // bandage wraps: alternating light and dark bands at a slant, with frayed edges
    for (let i = 0; i < 7; i++) {
        const y = (-18 - i * 4.8) * k;
        g.lineStyle(1.3 * k, dk, 0.85); g.moveTo(-13 * k, y + (i % 2 ? 1 : -1) * k); g.lineTo(13 * k, y - 3.5 * k); g.lineStyle(0);
        g.beginFill(shade(c, 1.15), 0.7); g.drawPolygon([-12 * k, y - 1.6 * k, 12 * k, y - 5 * k, 12 * k, y - 4 * k, -12 * k, y - 0.6 * k]); g.endFill();
    }
    [[-2, -6], [5, -11]].forEach(([x, y]) => { g.lineStyle(1 * k, dk); g.moveTo(x * k, y * k); g.lineTo((x + 2) * k, (y - 5) * k); g.lineStyle(0); });
    // arms reaching forward
    opoly(g, K([6, -45, 27, -44, 27, -38, 6, -38]), shade(c, 0.92), 1.5);
    opoly(g, K([6, -35, 26, -33, 26, -27, 6, -28]), shade(c, 0.72), 1.5);
    g.lineStyle(1 * k, dk, 0.8); [12, 18, 23].forEach((x) => { g.moveTo(x * k, -45 * k); g.lineTo((x - 2) * k, -38 * k); g.moveTo(x * k, -34 * k); g.lineTo((x - 2) * k, -27 * k); }); g.lineStyle(0);
    // a loose bandage end that flutters
    const flap = new PIXI.Graphics();
    opoly(flap, K([0, 0, 12, 3, 16, 9, 10, 7, 2, 4]), shade(c, 0.9), 1.2);
    flap.position.set(-12 * k, -40 * k);
    // wrapped head with a glowing eye slit
    icirc(g, 0, -57 * k, 10.5 * k, shade(c, 0.9), 1.8);
    g.beginFill(c); g.drawCircle(-1.5 * k, -58.5 * k, 8.4 * k); g.endFill();
    g.lineStyle(1.2 * k, dk, 0.85); g.moveTo(-9 * k, -52 * k); g.lineTo(9 * k, -55 * k); g.moveTo(-8 * k, -64 * k); g.lineTo(8 * k, -62 * k); g.lineStyle(0);
    io(g, 1.2); g.beginFill(0x1a1008); g.drawPolygon(K([-9, -61, 9, -62, 9, -57, -9, -56])); g.endFill(); g.lineStyle(0);
    g.beginFill(0x6aff9a); g.drawEllipse(-2.5 * k, -59 * k, 2 * k, 1.5 * k); g.drawEllipse(4.5 * k, -59.4 * k, 2 * k, 1.5 * k); g.endFill();
    body.addChild(flap, g);
    const glow = glowCircle(8 * k, 0x6aff9a, 0.25); glow.y = -59 * k; body.addChild(glow);
    return {
        height: 70 * k,
        anim: (e) => {
            body.scale.x = e.facing;
            body.rotation = Math.sin(e.phase * 0.8) * 0.05;
            body.y = Math.abs(Math.sin(e.phase * 0.8)) * -2;
            flap.rotation = Math.sin(e.phase * 2.2) * 0.25;
        }
    };
}

function scarab(body, t, r) {
    const c = t.color, g = new PIXI.Graphics();
    const legs = new PIXI.Graphics();
    ostroke(legs, 1.1, 0x2a3a38, () => { [-5, 0, 5].forEach((x) => { legs.moveTo(x, -4); legs.lineTo(x - 4, 1.5); legs.moveTo(x, -4); legs.lineTo(x + 4, 1.5); }); });
    // split wing case with an iridescent sheen
    iell(g, 0, -6.5, 10.5, 7.5, shade(c, 0.6), 1.5);
    g.beginFill(c); g.drawEllipse(-0.5, -7.5, 9.6, 6.4); g.endFill();
    g.beginFill(shade(c, 1.6), 0.6); g.drawEllipse(-4, -10.5, 4.4, 2); g.endFill();
    g.beginFill(0xd0a0ff, 0.35); g.drawEllipse(3, -5.5, 3.4, 1.5); g.endFill();
    g.lineStyle(1.2, INK, 0.8); g.moveTo(-0.5, -14); g.lineTo(-0.5, -1); g.lineStyle(0);
    // head with a horn and a golden eye
    iell(g, 9.5, -6.5, 4.2, 3.6, shade(c, 0.45), 1.3);
    opoly(g, [11, -8.5, 16.5, -14, 14, -7.5], shade(c, 0.5), 1.1);
    g.beginFill(0xffd84a); g.drawCircle(11, -7.4, 1); g.endFill();
    body.addChild(legs, g);
    return {
        height: 18,
        anim: (e) => {
            body.scale.x = e.facing;
            body.y = Math.abs(Math.sin(e.phase * 4)) * -1.2;
            legs.scale.x = 1 + Math.sin(e.phase * 6) * 0.15;
        }
    };
}

function pharaoh(body, t, r) {
    const k = r / 44, g = new PIXI.Graphics();
    const gold = 0xe8c040, blue = 0x2a5ac8;
    poly(g, [-26 * k, 0, -18 * k, -60 * k, 18 * k, -60 * k, 26 * k, 0], shade(0x3a2a6a, 0.9));
    poly(g, [-26 * k, 0, -18 * k, -60 * k, 0, -60 * k, 0, 0], 0x4a3a8a);
    for (let i = 0; i < 4; i++) rect(g, -24 * k + i * 2, (-12 - i * 12) * k, (48 - i * 4) * k, 3 * k, gold, 0.8);
    // headdress
    poly(g, [-18 * k, -64 * k, -24 * k, -40 * k, -12 * k, -42 * k, -10 * k, -66 * k], blue);
    poly(g, [18 * k, -64 * k, 24 * k, -40 * k, 12 * k, -42 * k, 10 * k, -66 * k], shade(blue, 0.8));
    for (let i = 0; i < 4; i++) { rect(g, -22 * k + i * 1.5, (-62 + i * 6) * k, 8 * k, 2 * k, gold); rect(g, 14 * k, (-62 + i * 6) * k, 8 * k, 2 * k, gold); }
    circ(g, 0, -68 * k, 13 * k, gold); circ(g, 0, -68 * k, 11 * k, 0xf4d878);
    rect(g, -7 * k, -71 * k, 5 * k, 2.5 * k, 0x1a1008); rect(g, 2 * k, -71 * k, 5 * k, 2.5 * k, 0x1a1008);
    poly(g, [-2 * k, -66 * k, 2 * k, -66 * k, 0, -61 * k], shade(gold, 0.7));
    poly(g, [-4 * k, -80 * k, 4 * k, -80 * k, 0, -92 * k], 0x3aa86a);
    // staff
    g.lineStyle(4, 0x8a6a2a); g.moveTo(34 * k, 0); g.lineTo(34 * k, -78 * k); g.lineStyle(0);
    circ(g, 34 * k, -84 * k, 7 * k, 0x6aff9a);
    body.addChild(g);
    const glow = glowCircle(16 * k, 0x6aff9a, 0.3); glow.position.set(34 * k, -84 * k); body.addChild(glow);
    return {
        height: 98 * k,
        anim: (e) => {
            body.y = Math.sin(e.phase * 0.7) * -3 - 3;
            glow.alpha = 0.6 + Math.sin(e.phase * 2) * 0.4;
            body.rotation = Math.sin(e.phase * 0.5) * 0.02;
            windupShake(e, body);
        }
    };
}

// -------------------------------------------------------------------- shore
function crab(body, t, r, opts = {}) {
    const c = t.color, k = r / 16, g = new PIXI.Graphics();
    g.lineStyle(2.5 * k, shade(c, 0.7));
    [-1, 1].forEach((s) => [0, 1, 2].forEach((i) => { g.moveTo(s * 8 * k, (-6 + i * 2) * k); g.lineTo(s * (15 + i * 2) * k, (-10 + i * 5) * k); g.lineTo(s * (18 + i * 2) * k, (2) * k); }));
    g.lineStyle(0);
    ell(g, 0, -10 * k, 18 * k, 11 * k, shade(c, 0.7)); ell(g, 0, -12 * k, 17 * k, 10 * k, c);
    ell(g, -4 * k, -16 * k, 8 * k, 3.5 * k, shade(c, 1.4), 0.7);
    [[-7, -10], [6, -14], [9, -8]].forEach(([x, y]) => circ(g, x * k, y * k, 2 * k, shade(c, 1.25), 0.8));
    // eyes on stalks
    [-6, 6].forEach((x) => { g.lineStyle(2 * k, shade(c, 0.8)); g.moveTo(x * k, -20 * k); g.lineTo(x * k, -27 * k); g.lineStyle(0); circ(g, x * k, -28 * k, 3 * k, 0xffffff); circ(g, x * k, -28 * k, 1.4 * k, 0x1a1a1a); });
    body.addChild(g);
    const claws = [];
    [-1, 1].forEach((s) => {
        const cl = new PIXI.Container();
        const cg = new PIXI.Graphics();
        cg.lineStyle(4 * k, shade(c, 0.85)); cg.moveTo(0, 0); cg.lineTo(s * 8 * k, -8 * k); cg.lineStyle(0);
        poly(cg, [s * 6 * k, -8 * k, s * 18 * k, -14 * k, s * 15 * k, -4 * k], shade(c, 1.1));
        poly(cg, [s * 6 * k, -8 * k, s * 18 * k, -2 * k, s * 12 * k, -3 * k], shade(c, 0.9));
        if (opts.crown) circ(cg, s * 14 * k, -9 * k, 1.5 * k, 0xffd84a);
        cl.addChild(cg); cl.position.set(s * 15 * k, -10 * k);
        body.addChild(cl); claws.push(cl);
    });
    if (opts.crown) {
        const cg = new PIXI.Graphics();
        poly(cg, [-12 * k, -20 * k, -10 * k, -30 * k, -5 * k, -23 * k, 0, -33 * k, 5 * k, -23 * k, 10 * k, -30 * k, 12 * k, -20 * k], 0xffc233);
        circ(cg, 0, -27 * k, 2 * k, 0xff4a4a);
        body.addChild(cg);
    }
    return {
        height: 36 * k,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            const snap = s === 'windup' || s === 'dash' ? 1.4 : 0.15;
            claws.forEach((cl, i) => { cl.rotation = Math.sin(e.phase * 3 + i * 2) * snap * 0.4 * (i ? -1 : 1); });
            body.y = Math.abs(Math.sin(e.phase * 2.4)) * -1.5;
            windupShake(e, body);
        }
    };
}

function gull(body, t, r) {
    const hover = new PIXI.Container();
    hover.y = -28;
    const wl = new PIXI.Graphics(), wr = new PIXI.Graphics();
    [wl, wr].forEach((w, i) => {
        const s = i ? 1 : -1;
        opoly(w, [0, 0, s * 13, -11, s * 30, -9, s * 25, -2, s * 12, 2], 0xd8dce4, 1.4);
        fpoly(w, [0, -1, s * 13, -10, s * 22, -9, s * 12, -3], 0xf6f8fa);
        fpoly(w, [s * 21, -9.4, s * 30, -9, s * 25, -2, s * 18, -4], 0x2e2e36);
        w.beginFill(0xffffff); w.drawCircle(s * 27, -7.5, 0.9); w.endFill();
    });
    const g = new PIXI.Graphics();
    opoly(g, [-8, 3, -16, 1, -14, 5, -8, 6], 0xc8ccd4, 1.2);
    iell(g, 0, 2, 9.5, 6.2, 0xffffff, 1.5);
    g.beginFill(0xe4e8ee); g.drawEllipse(1, 4.5, 7, 2.6); g.endFill();
    icirc(g, 8.5, -2.5, 4.8, 0xffffff, 1.4);
    opoly(g, [11.5, -3, 18.5, -1.2, 11.5, 0.6], 0xf0b030, 1);
    g.beginFill(0xe04030); g.drawCircle(15.5, -0.6, 0.8); g.endFill();
    g.beginFill(0x1a1a1a); g.drawCircle(9.6, -3.6, 1.1); g.endFill();
    g.beginFill(0xffffff); g.drawCircle(9.3, -4, 0.4); g.endFill();
    hover.addChild(wl, g, wr);
    body.addChild(hover);
    return {
        height: 38,
        anim: (e) => {
            const f = Math.sin(e.phase * 3);
            wl.scale.y = wr.scale.y = 0.6 + Math.abs(f) * 0.6;
            wl.rotation = f * 0.25; wr.rotation = -f * 0.25;
            hover.y = -28 + Math.sin(e.phase) * 2;
            body.scale.x = e.facing;
            windupShake(e, body);
        }
    };
}

function jelly(body, t, r) {
    const c = t.color, hover = new PIXI.Container();
    hover.y = -36;
    const tentacles = new PIXI.Container();
    const tg = new PIXI.Graphics();
    tg.lineStyle(3, shade(c, 1.1), 0.8);
    [-10, -5, 0, 5, 10].forEach((x, i) => { tg.moveTo(x, 4); tg.quadraticCurveTo(x + (i % 2 ? 6 : -6), 14, x, 24 + (i % 2) * 6); });
    tentacles.addChild(tg);
    const dome = new PIXI.Graphics();
    dome.beginFill(shade(c, 0.8), 0.75); dome.drawEllipse(0, 0, 16, 13); dome.endFill();
    dome.beginFill(c, 0.85); dome.drawEllipse(-1, -2, 14, 11); dome.endFill();
    ell(dome, -5, -7, 6, 3, 0xffffff, 0.6);
    circ(dome, -4, -1, 1.8, 0x2a1038); circ(dome, 5, -1, 1.8, 0x2a1038);
    const glow = glowCircle(26, c, 0.2);
    hover.addChild(glow, tentacles, dome);
    body.addChild(hover);
    return {
        height: 56,
        anim: (e) => {
            const s = Math.sin(e.phase * 1.2);
            dome.scale.set(1 + s * 0.06, 1 - s * 0.08);
            tentacles.scale.y = 1 + s * 0.15;
            hover.y = -36 + Math.sin(e.phase * 0.8) * 3;
            const w = e.ai && e.ai.state === 'windup';
            glow.alpha = w ? 0.8 + Math.sin(e.phase * 6) * 0.2 : 0.4;
            glow.scale.set(w ? 1.5 : 1);
        }
    };
}

// ----------------------------------------------------------------- mountain
function bat(body, t) {
    const c = t.color, hover = new PIXI.Container();
    hover.y = -26;
    const wl = new PIXI.Graphics(), wr = new PIXI.Graphics();
    [wl, wr].forEach((w, i) => {
        const s = i === 0 ? -1 : 1;
        poly(w, [0, 0, s * 26, -14, s * 20, -2, s * 30, 4, s * 14, 8, 0, 6], shade(c, 0.55));
        poly(w, [0, 0, s * 20, -10, s * 14, 0, s * 8, 4], shade(c, 0.85), 0.8);
    });
    const torso = new PIXI.Graphics();
    ell(torso, 0, 2, 9, 11, shade(c, 0.7)); circ(torso, 0, -6, 8, c);
    poly(torso, [-7, -10, -5, -20, -1, -12], shade(c, 0.6)); poly(torso, [7, -10, 5, -20, 1, -12], shade(c, 0.6));
    circ(torso, -3, -7, 2, 0xff4040); circ(torso, 3, -7, 2, 0xff4040);
    hover.addChild(wl, wr, torso);
    body.addChild(hover);
    return {
        height: 30,
        anim: (e) => {
            const flap = Math.sin(e.phase * 2.6);
            wl.scale.y = wr.scale.y = 0.55 + Math.abs(flap) * 0.6;
            wl.rotation = flap * 0.35; wr.rotation = -flap * 0.35;
            hover.y = -26 + Math.sin(e.phase) * 3;
            e.shadow.scale.set(1 - Math.sin(e.phase) * 0.05);
        }
    };
}

function golem(body, t, r, opts = {}) {
    const c = t.color, s = r / 26, g = new PIXI.Graphics();
    const eye = opts.eye || 0xffa030;
    const stone = (x, y, w, h, col) => {
        g.lineStyle(1.6, shade(col, 0.35), 0.9);
        g.beginFill(col); g.drawRoundedRect(x * s, y * s, w * s, h * s, 4 * s); g.endFill();
        g.lineStyle(0);
        g.beginFill(shade(col, 1.25), 0.6); g.drawRoundedRect((x + 2) * s, (y + 2) * s, (w - 4) * s, 4 * s, 2 * s); g.endFill();
    };
    // legs
    stone(-17, -16, 13, 16, shade(c, 0.6)); stone(4, -16, 13, 16, shade(c, 0.66));
    // arms of stacked boulders
    const armL = new PIXI.Graphics(), armR = new PIXI.Graphics();
    const boulderArm = (a, col) => {
        a.lineStyle(1.6, shade(col, 0.35), 0.9);
        a.beginFill(col); a.drawCircle(0, 0, 8 * s); a.drawCircle(0, 13 * s, 7 * s); a.endFill();
        a.beginFill(shade(col, 0.85)); a.drawRoundedRect(-8 * s, 20 * s, 16 * s, 12 * s, 5 * s); a.endFill();
        a.lineStyle(0);
    };
    boulderArm(armL, shade(c, 0.7)); boulderArm(armR, shade(c, 0.8));
    armL.position.set(-29 * s, -50 * s); armR.position.set(29 * s, -50 * s);
    // torso: big block with mortar lines, moss and a glowing rune crack
    stone(-25, -60, 50, 48, shade(c, 0.85));
    g.beginFill(c); g.drawRoundedRect(-24 * s, -59 * s, 34 * s, 46 * s, 6 * s); g.endFill();
    g.lineStyle(1.4, shade(c, 0.45), 0.8);
    g.moveTo(-24 * s, -42 * s); g.lineTo(24 * s, -42 * s); g.moveTo(-24 * s, -26 * s); g.lineTo(24 * s, -26 * s);
    g.moveTo(-6 * s, -59 * s); g.lineTo(-6 * s, -42 * s); g.moveTo(8 * s, -42 * s); g.lineTo(8 * s, -26 * s); g.moveTo(-12 * s, -26 * s); g.lineTo(-12 * s, -13 * s);
    g.lineStyle(0);
    g.beginFill(0x5a8a3a, 0.85); g.drawEllipse(-15 * s, -58 * s, 9 * s, 3.5 * s); g.drawEllipse(14 * s, -14 * s, 7 * s, 3 * s); g.endFill();
    g.lineStyle(2.4 * s, eye, 0.95); g.moveTo(2 * s, -54 * s); g.lineTo(-4 * s, -44 * s); g.lineTo(3 * s, -34 * s); g.lineTo(-2 * s, -24 * s); g.lineStyle(0);
    // head
    stone(-13, -78, 26, 20, shade(c, 0.9));
    g.beginFill(0x1a1410); g.drawRect(-10 * s, -71 * s, 8 * s, 5 * s); g.drawRect(2 * s, -71 * s, 8 * s, 5 * s); g.endFill();
    g.beginFill(eye); g.drawRect(-9 * s, -70 * s, 6 * s, 3.5 * s); g.drawRect(3 * s, -70 * s, 6 * s, 3.5 * s); g.endFill();
    if (opts.crystals) {
        [[-26, -58, 0x5ad0ff], [24, -60, 0xc07aff], [0, -80, 0x5ad0ff], [-10, -62, 0xc07aff]].forEach(([x, y, col], i) => {
            const hgt = i === 2 ? 24 : 18;
            poly(g, [x * s - 6 * s, y * s, x * s, (y - hgt) * s, x * s + 6 * s, y * s], shade(col, 0.75));
            poly(g, [x * s - 6 * s, y * s, x * s, (y - hgt) * s, x * s, y * s], shade(col, 1.3));
        });
    }
    body.addChild(armL, g, armR);
    const glow = glowCircle(r * 0.55, eye, 0.3); glow.y = -68 * s; body.addChild(glow);
    const rune = glowCircle(r * 0.5, eye, 0.18); rune.y = -40 * s; body.addChild(rune);
    return {
        height: 80 * s,
        anim: (e) => {
            const st = e.ai && e.ai.state;
            body.rotation = st === 'windup' ? -0.06 : Math.sin(e.phase * 0.7) * 0.04;
            body.y = st === 'windup' ? -4 : Math.abs(Math.sin(e.phase * 0.7)) * -2;
            body.scale.y = st === 'slam' || st === 'recover' ? 0.93 : 1;
            const swing = st === 'windup' ? -0.9 : st === 'slam' ? 0.4 : Math.sin(e.phase * 0.7) * 0.15;
            armL.rotation = swing; armR.rotation = -swing;
            rune.alpha = glow.alpha = 0.35 + Math.abs(Math.sin(e.phase * 0.5)) * 0.4;
            windupShake(e, body);
        }
    };
}

function troll(body, t, r) {
    const c = t.color, k = r / 24, g = new PIXI.Graphics();
    rect(g, -12 * k, -14 * k, 9 * k, 14 * k, shade(c, 0.55)); rect(g, 3 * k, -14 * k, 9 * k, 14 * k, shade(c, 0.6));
    ell(g, 0, -32 * k, 22 * k, 20 * k, shade(c, 0.7));
    ell(g, -2 * k, -34 * k, 20 * k, 18 * k, c);
    ell(g, -5 * k, -26 * k, 10 * k, 9 * k, shade(c, 1.2), 0.6);
    // head
    circ(g, 8 * k, -58 * k, 10 * k, shade(c, 1.05));
    poly(g, [12 * k, -54 * k, 16 * k, -46 * k, 10 * k, -50 * k], 0xf4f0e0);
    circ(g, 11 * k, -60 * k, 1.6 * k, 0xffd84a); circ(g, 5 * k, -60 * k, 1.6 * k, 0xffd84a);
    // arms
    g.lineStyle(8 * k, shade(c, 0.8)); g.moveTo(-14 * k, -44 * k); g.quadraticCurveTo(-30 * k, -36 * k, -26 * k, -18 * k);
    g.moveTo(14 * k, -44 * k); g.quadraticCurveTo(30 * k, -40 * k, 30 * k, -58 * k); g.lineStyle(0);
    // boulder in raised hand
    const boulder = new PIXI.Graphics();
    circ(boulder, 0, 0, 11 * k, 0x6a6e78); circ(boulder, -3 * k, -3 * k, 6 * k, 0x9a9eaa, 0.8);
    boulder.position.set(30 * k, -70 * k);
    // club
    g.lineStyle(6 * k, 0x6a4a2a); g.moveTo(-26 * k, -18 * k); g.lineTo(-34 * k, -44 * k); g.lineStyle(0);
    circ(g, -35 * k, -48 * k, 8 * k, 0x7a5a3a);
    body.addChild(g, boulder);
    return {
        height: 78 * k,
        anim: (e) => {
            const st = e.ai && e.ai.state;
            body.scale.x = e.facing;
            boulder.visible = st !== 'recover';
            boulder.y = (-70 + (st === 'windup' ? -12 * Math.sin(e.phase * 3) : 0)) * k;
            body.rotation = Math.sin(e.phase * 0.9) * 0.04;
            body.y = Math.abs(Math.sin(e.phase * 0.9)) * -2;
            windupShake(e, body);
        }
    };
}

// -------------------------------------------------------------------- ruins
function skeleton(body, t) {
    const c = t.color, bone = c, dark = shade(c, 0.7);
    const legL = new PIXI.Graphics(), legR = new PIXI.Graphics();
    [legL, legR].forEach((l, i) => { rect(l, -1.6, 0, 3.2, 16, i ? dark : bone); ell(l, 2, 16.5, 4, 1.8, shade(c, 0.6)); });
    legL.position.set(-4, -18); legR.position.set(4, -18);
    const g = new PIXI.Graphics();
    ell(g, 0, -19, 7, 3.2, bone);                                           // pelvis
    rect(g, -1.6, -40, 3.2, 22, dark);                                      // spine
    // ribcage
    for (let i = 0; i < 4; i++) { g.lineStyle(2.2, i % 2 ? dark : bone); g.arc(0, -34 + i * 3.6, 8 - i, Math.PI * 1.05, Math.PI * 1.95); g.arc(0, -34 + i * 3.6, 8 - i, Math.PI * 0.05, Math.PI * 0.95, false); }
    g.lineStyle(0);
    // tattered cloth
    poly(g, [-7, -24, 7, -24, 8, -14, 4, -17, 1, -12, -3, -16, -7, -12], 0x4a3a5a);
    // skull
    circ(g, 0, -47, 8, bone);
    rect(g, -4.5, -43, 9, 4.5, shade(c, 0.85));
    g.beginFill(0x1a1008); g.drawEllipse(-3, -47.5, 2.4, 2.8); g.drawEllipse(3.2, -47.5, 2.4, 2.8); g.drawPolygon([0, -45, -1, -43, 1, -43]); g.endFill();
    g.lineStyle(1, 0x1a1008); for (let k = -3; k <= 3; k += 2) { g.moveTo(k, -42.5); g.lineTo(k, -39); } g.lineStyle(0);
    ell(g, -2.5, -51, 3, 1.6, 0xffffff, 0.6);
    const eyes = new PIXI.Container();
    const eL = glowCircle(3.6, 0xff6a3a, 0.6), eR = glowCircle(3.6, 0xff6a3a, 0.6);
    eL.position.set(-3, -47.5); eR.position.set(3.2, -47.5); eyes.addChild(eL, eR);
    // arms + bow
    const arm = new PIXI.Graphics();
    arm.lineStyle(2.6, bone); arm.moveTo(-8, -36); arm.lineTo(-11, -24); arm.moveTo(8, -36); arm.lineTo(14, -30); arm.lineStyle(0);
    arm.lineStyle(2.6, 0x6a4422); arm.moveTo(16, -50); arm.quadraticCurveTo(27, -34, 16, -18);
    arm.lineStyle(1, 0xdddddd); arm.moveTo(16, -50); arm.lineTo(13, -34); arm.lineTo(16, -18); arm.lineStyle(0);
    body.addChild(legL, legR, g, arm, eyes);
    return {
        height: 58,
        anim: (e) => {
            body.scale.x = e.facing;
            const w = Math.sin(e.phase * 1.4);
            legL.rotation = w * 0.35; legR.rotation = -w * 0.35;
            g.rotation = arm.rotation = w * 0.03;
            body.y = Math.abs(w) * -1.5;
            eyes.alpha = 0.6 + Math.abs(Math.sin(e.phase * 0.8)) * 0.4;
            windupShake(e, body);
        }
    };
}

function ghost(body, t) {
    const c = t.color, hover = new PIXI.Container();
    hover.y = -26;
    const tail = new PIXI.Graphics();
    tail.beginFill(c, 0.45); tail.drawPolygon([-12, 0, 12, 0, 8, 14, 3, 9, 0, 20, -4, 10, -9, 16]); tail.endFill();
    tail.y = 2;
    const g = new PIXI.Graphics();
    g.beginFill(c, 0.82);
    g.drawPolygon([-13, 6, -14, -10, -8, -22, 0, -26, 8, -22, 14, -10, 13, 6, 8, 10, 4, 5, 0, 11, -4, 5, -8, 10]);
    g.endFill();
    g.beginFill(0xffffff, 0.35); g.drawEllipse(-4, -15, 6, 8); g.endFill();
    // reaching arms
    g.beginFill(c, 0.7); g.drawPolygon([12, -6, 22, -10, 24, -6, 13, -1]); g.drawPolygon([-12, -6, -20, -2, -19, 2, -12, 0]); g.endFill();
    g.beginFill(0x10182a); g.drawEllipse(-5, -12, 3, 4.5); g.drawEllipse(5, -12, 3, 4.5); g.drawEllipse(0, -3, 3.2, 4.5); g.endFill();
    const eyes = new PIXI.Container();
    const eL = glowCircle(4, 0x9ad0ff, 0.6), eR = glowCircle(4, 0x9ad0ff, 0.6);
    eL.position.set(-5, -12); eR.position.set(5, -12); eyes.addChild(eL, eR);
    const aura = glowCircle(28, 0x9ad0ff, 0.22);
    hover.addChild(aura, tail, g, eyes);
    body.addChild(hover);
    return {
        height: 50,
        anim: (e) => {
            hover.y = -26 + Math.sin(e.phase * 0.9) * 4;
            g.alpha = e.ai && e.ai.state === 'windup' ? 1 : 0.85 + Math.sin(e.phase) * 0.1;
            g.scale.x = 1 + Math.sin(e.phase * 1.3) * 0.05;
            tail.scale.x = 1 + Math.sin(e.phase * 2.2) * 0.18;
            tail.skew.x = Math.sin(e.phase * 1.5) * 0.25;
            e.shadow.alpha = 0.4;
            windupShake(e, body);
        }
    };
}

// -------------------------------------------------------------------- town
/** The training dummy: a straw-stuffed sack on a post with a painted target. It sways when hit. */
function dummy(body, t, r) {
    const g = new PIXI.Graphics();
    iell(g, 0, 0, 12, 4.5, 0x6a4a2a);                              // dirt mound
    io(g); g.beginFill(0x8a5a32); g.drawRect(-3, -62, 6, 62); g.endFill();
    io(g); g.beginFill(0x7a4c2a); g.drawRect(-24, -46, 48, 6); g.endFill();
    // straw tufts at the ends of the arms
    for (const sx of [-1, 1]) {
        io(g, 1.2); g.beginFill(0xe8c860);
        g.drawPolygon([sx * 22, -47, sx * 31, -50, sx * 28, -43, sx * 32, -38, sx * 22, -39]); g.endFill();
    }
    iell(g, 0, -33, 13, 16, 0xc8a070);                            // sack body
    g.lineStyle(1, shade(0xc8a070, 0.55), 0.8);
    g.moveTo(-9, -24); g.lineTo(9, -24);                           // rope belt
    g.moveTo(-6, -47); g.lineTo(-4, -44); g.moveTo(6, -47); g.lineTo(4, -44);
    g.lineStyle(0);
    icirc(g, 0, -34, 7.5, 0xd04030, 1.2);                          // painted target
    circ(g, 0, -34, 4.6, 0xf2e6c8);
    circ(g, 0, -34, 2, 0xd04030);
    icirc(g, 0, -56, 8.5, 0xd4b080);                               // sack head
    g.lineStyle(1.4, INK, 0.85);
    g.moveTo(-4, -58); g.lineTo(-2, -56); g.moveTo(-2, -58); g.lineTo(-4, -56);
    g.moveTo(2, -58); g.lineTo(4, -56); g.moveTo(4, -58); g.lineTo(2, -56);
    g.lineStyle(0);
    io(g, 1.2); g.beginFill(0xe8c860); g.drawPolygon([-5, -63, -2, -68, 0, -64, 3, -69, 5, -63]); g.endFill();
    body.addChild(g);
    return {
        height: 68,
        anim(e) { body.rotation = e.hitFlash > 0 ? Math.sin(e.phase * 4) * 0.09 : body.rotation * 0.85; }
    };
}

// -------------------------------------------------------------------- tier 2 and 3 species (found from level 25 and 37)
/** four legs for a walker, each its own part so it can gallop */
const legSet = (xs, y, len, col, w = 4.4) => xs.map(([x, c]) => {
    const g = new PIXI.Graphics();
    rect(g, -w / 2, 0, w, len, c ?? col); ell(g, 0.8, len, w * 0.78, 1.8, shade(c ?? col, 0.7));
    g.position.set(x, y);
    return g;
});

/** Field, tier 2: a ram whose back has grown a hedge of thorns. Charges. */
function thornback(body, t, r) {
    const c = t.color, dark = shade(c, 0.55), light = shade(c, 1.3);
    const legs = legSet([[-14, dark], [8, dark], [-8], [14]], -12, 12, shade(c, 0.75), 5);
    const g = new PIXI.Graphics();
    ell(g, 0, -20, 22, 12, shade(c, 0.8));
    ell(g, -2, -22, 20, 10, c);
    ell(g, 0, -14, 13, 4, light, 0.7);
    // thorns along the back
    for (let i = 0; i < 6; i++) { const x = -16 + i * 6; poly(g, [x - 3, -29 + Math.abs(i - 2.5), x, -40 + Math.abs(i - 2.5) * 1.5, x + 3, -29 + Math.abs(i - 2.5)], i % 2 ? 0x4a6a2a : 0x3a5a22); }
    // head with curled horns
    const head = new PIXI.Graphics();
    ell(head, 0, 0, 9, 8, shade(c, 1.05));
    poly(head, [4, -3, 15, 1, 14, 5, 5, 5], shade(c, 1.15));
    circ(head, 4, -2, 2.1, 0xff6a3a); circ(head, 4.5, -2, 1, 0x1a1a1a);
    io(head, 1.6); head.beginFill(0xd8c8a0); head.arc(-3, -2, 8, Math.PI * 0.9, Math.PI * 2.1); head.endFill(); head.lineStyle(0);
    head.beginFill(0xb8a880); head.drawCircle(-3, -2, 3.2); head.endFill();
    head.position.set(21, -22);
    legs.slice(0, 2).forEach((l) => body.addChild(l));
    body.addChild(g, head);
    legs.slice(2).forEach((l) => body.addChild(l));
    return {
        height: 44,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            const run = Math.sin(e.phase * (s === 'dash' ? 3.4 : 1.8));
            legs[0].rotation = run * 0.55; legs[1].rotation = -run * 0.55; legs[2].rotation = -run * 0.45; legs[3].rotation = run * 0.45;
            head.rotation = s === 'windup' ? 0.35 : s === 'dash' ? 0.25 : 0;
            body.rotation = s === 'dash' ? 0.08 : 0;
            body.y = s === 'dash' ? 0 : Math.abs(run) * -1.6;
            windupShake(e, body);
        }
    };
}

/** Field, tier 3: a scarecrow that walked off its pole, carrying a lantern of witch-fire. Keeps away and throws fire. */
function wight(body, t, r) {
    const c = t.color;
    const legs = legSet([[-5, 0x4a3a2a], [5, 0x3a2a1a]], -16, 16, 0x4a3a2a, 3.6);
    const g = new PIXI.Graphics();
    poly(g, [-12, -18, -14, -40, -6, -46, 6, -46, 14, -40, 12, -18, 8, -14, 3, -19, -2, -14, -7, -19], 0x5a4a6a);   // tattered coat
    poly(g, [-6, -46, 0, -36, 6, -46], 0x3a2e48);
    rect(g, -3, -30, 6, 3, 0x8a6a3a);
    for (const [x, y] of [[-12, -18], [12, -18], [0, -15]]) poly(g, [x - 3, y, x, y + 7, x + 3, y], 0xe8c860);   // straw poking out
    const head = new PIXI.Graphics();
    ell(head, 0, 0, 10, 9, c);
    poly(head, [-13, -5, 13, -5, 6, -16, -6, -16], 0x3a2e28);                   // a battered hat
    poly(head, [-16, -4, 16, -4, 13, -7, -13, -7], 0x2a201c);
    circ(head, -3.5, 0, 2.4, 0x1a0a00); circ(head, 3.5, 0, 2.4, 0x1a0a00);
    circ(head, -3.5, 0, 1.1, 0xffa040); circ(head, 3.5, 0, 1.1, 0xffa040);
    io(head, 1); head.moveTo(-5, 5); head.lineTo(-2, 3.5); head.lineTo(1, 5.5); head.lineTo(4, 3.5); head.lineStyle(0);
    head.position.set(0, -54);
    // the arm is a container so the lantern's glow (a sprite) rides along without being baked into the arm
    const armG = new PIXI.Graphics();
    ostrokeA(armG, 3, 0x5a4a6a, () => { armG.moveTo(0, 0); armG.lineTo(10, 8); });
    rect(armG, 8, 8, 2, 6, 0x2a2a30);
    icirc(armG, 9, 17, 3.6, 0xffc060, 1.2);
    const flame = glowCircle(9, 0xffa040, 0.3); flame.position.set(9, 18);
    const arm = new PIXI.Container();
    arm.addChild(flame, armG);
    arm.position.set(10, -42);
    body.addChild(legs[0], g, head, arm, legs[1]);
    return {
        height: 66,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            const step = Math.sin(e.phase * 1.6);
            legs[0].rotation = step * 0.4; legs[1].rotation = -step * 0.4;
            head.rotation = Math.sin(e.phase * 0.7) * 0.12;
            arm.rotation = s === 'windup' ? -1.4 : Math.sin(e.phase * 1.2) * 0.15;
            flame.alpha = 0.6 + Math.sin(e.phase * 4) * 0.3;
            body.y = Math.abs(step) * -2;
            windupShake(e, body);
        }
    };
}
/** an inked stroke for a limb (local copy of the decor helper, kept here to stay self-contained) */
function ostrokeA(g, w, color, path) {
    g.lineStyle({ width: w + 2.4, color: INK, alpha: 0.92, cap: 'round', join: 'round' }); path();
    g.lineStyle({ width: w, color, alpha: 1, cap: 'round', join: 'round' }); path();
    g.lineStyle(0);
}

/** Forest, tier 2: a mantis as tall as a man. Circles, then strikes from the side. */
function mantis(body, t, r) {
    const c = t.color, dark = shade(c, 0.6), light = shade(c, 1.3);
    const legs = [[-10, -10], [-2, -10], [6, -10]].map(([x, y], i) => { const g = new PIXI.Graphics(); ostrokeA(g, 2, i % 2 ? dark : c, () => { g.moveTo(0, 0); g.lineTo(-4, 6); g.lineTo(-2, 11); }); g.position.set(x, y); return g; });
    const g = new PIXI.Graphics();
    ell(g, -10, -14, 14, 5.5, dark);                                          // abdomen
    poly(g, [-22, -16, -2, -20, 0, -12, -20, -10], shade(c, 1.1), 0.75);       // folded wings
    poly(g, [0, -16, 6, -36, 11, -35, 6, -14], c);                             // thorax
    const head = new PIXI.Graphics();
    poly(head, [-7, -2, 7, -2, 0, 9], light);
    circ(head, -5, -1, 3.2, 0xffe060); circ(head, 5, -1, 3.2, 0xffe060);
    circ(head, -5, -1, 1.2, 0x1a1a1a); circ(head, 5, -1, 1.2, 0x1a1a1a);
    io(head, 1); head.moveTo(-3, -3); head.lineTo(-6, -10); head.moveTo(3, -3); head.lineTo(6, -10); head.lineStyle(0);
    head.position.set(9, -40);
    const blade = new PIXI.Graphics();
    ostrokeA(blade, 3, c, () => { blade.moveTo(0, 0); blade.lineTo(8, 6); });
    poly(blade, [7, 4, 18, -6, 20, -4, 10, 8], light);
    for (let k = 0; k < 3; k++) poly(blade, [10 + k * 3, 3 - k * 3, 12 + k * 3, 4 - k * 3, 11 + k * 3, 6 - k * 3], 0xf0f0d0);
    blade.position.set(8, -30);
    legs.forEach((l) => body.addChild(l));
    body.addChild(g, head, blade);
    return {
        height: 52,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            const step = Math.sin(e.phase * 2.4);
            legs.forEach((l, i) => { l.rotation = (i % 2 ? step : -step) * 0.35; });
            blade.rotation = s === 'lunge' ? 0.9 : s === 'windup' ? -0.8 : Math.sin(e.phase * 0.8) * 0.1;
            head.rotation = Math.sin(e.phase * 0.5) * 0.15;
            windupShake(e, body);
        }
    };
}

/** Forest, tier 3: a witch in a cloak of leaves who drifts above the moss and looses rings of thorns. */
function thornwitch(body, t, r) {
    const c = t.color, dark = shade(c, 0.55), light = shade(c, 1.35);
    const g = new PIXI.Graphics();
    poly(g, [-14, -12, -10, -40, 0, -50, 10, -40, 14, -12, 8, -16, 4, -8, 0, -14, -4, -8, -8, -16], c);         // leaf cloak
    poly(g, [-10, -40, 0, -50, 10, -40, 0, -32], dark);
    for (const [x, y] of [[-8, -24], [6, -28], [-2, -18], [9, -18]]) ell(g, x, y, 3, 1.6, light, 0.9);
    ell(g, 0, -40, 6, 6.5, 0xd8e8c0);                                         // face
    circ(g, -2.2, -40, 1.2, 0x2a4a1a); circ(g, 2.2, -40, 1.2, 0x2a4a1a);
    poly(g, [-10, -44, 0, -64, 10, -44], dark);                               // pointed hood
    poly(g, [-2, -60, 4, -66, 6, -58], 0x8a3a5a);                             // a flower on the hood
    const orbG = new PIXI.Graphics();
    const halo = glowCircle(14, 0x8aff6a, 0.3);
    icirc(orbG, 0, 0, 5, 0x9aff7a, 1.2); circ(orbG, -1.5, -1.5, 1.6, 0xeaffd8);
    const orb = new PIXI.Container();
    orb.addChild(halo, orbG);
    orb.position.set(16, -34);
    body.addChild(g, orb);
    return {
        height: 66,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            body.y = -8 + Math.sin(e.phase * 0.9) * 3;
            const k = s === 'windup' ? 1.5 + Math.sin(e.phase * 6) * 0.15 : 1;
            orb.scale.set(k);
            halo.alpha = s === 'windup' ? 0.9 : 0.5 + Math.sin(e.phase * 2) * 0.2;
        }
    };
}

/** Desert, tier 2: a great segmented worm that swims under the sand and bursts out to bite. */
function sandworm(body, t, r) {
    const c = t.color, dark = shade(c, 0.55);
    const g = new PIXI.Graphics();
    for (let i = 0; i < 4; i++) {
        const y = -6 - i * 10, rr = 14 - i * 1.4;
        ell(g, -i * 2, y, rr, rr * 0.75, i % 2 ? c : shade(c, 0.85));
        g.lineStyle(1.2, dark, 0.8); g.moveTo(-i * 2 - rr * 0.8, y + 2); g.lineTo(-i * 2 + rr * 0.8, y + 2); g.lineStyle(0);
    }
    const mouth = new PIXI.Graphics();
    ell(mouth, 0, 0, 13, 9, shade(c, 1.1));
    ell(mouth, 0, 1, 9, 6, 0x3a0a0a);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; poly(mouth, [Math.cos(a) * 9, 1 + Math.sin(a) * 6, Math.cos(a + 0.2) * 5, 1 + Math.sin(a + 0.2) * 3.4, Math.cos(a + 0.4) * 9, 1 + Math.sin(a + 0.4) * 6], 0xf0e8d0); }
    mouth.position.set(-6, -48);
    const dust = new PIXI.Graphics(); ell(dust, 0, -2, 24, 9, 0xc8a060, 0.85); dust.visible = false;
    body.addChild(dust, g, mouth);
    return {
        height: 58,
        anim: (e) => {
            body.scale.x = e.facing;
            const hidden = e.untargetable;
            dust.visible = hidden; g.alpha = mouth.alpha = hidden ? 0.12 : 1;
            e.shadow.alpha = hidden ? 0.1 : 1;
            g.rotation = Math.sin(e.phase * 1.2) * 0.06;
            mouth.scale.set(e.ai && e.ai.state === 'fight' ? 1 + Math.abs(Math.sin(e.phase * 3)) * 0.15 : 1);
            windupShake(e, body);
        }
    };
}

/** Desert, tier 3: a djinn of blue smoke and gold. Floats, keeps its distance and throws bolts of wind. */
function djinn(body, t, r) {
    const c = t.color, dark = shade(c, 0.6), light = shade(c, 1.35);
    const g = new PIXI.Graphics();
    poly(g, [-10, -26, 10, -26, 6, -14, 0, -2, -4, -8, -2, -14], dark);       // a tail of smoke
    ell(g, 0, -34, 11, 10, c);                                                 // torso
    rect(g, -11, -30, 22, 3, 0xe8b83a);                                        // gold sash
    ell(g, 0, -50, 7, 7, light);                                               // head
    circ(g, -2.4, -50, 1.3, 0xfff6b0); circ(g, 2.4, -50, 1.3, 0xfff6b0);
    poly(g, [-9, -53, 9, -53, 6, -60, 0, -63, -6, -60], 0xf4f0e0);             // turban
    circ(g, 0, -56, 1.8, 0xd8503a);
    const armL = new PIXI.Graphics(); ostrokeA(armL, 3.2, c, () => { armL.moveTo(0, 0); armL.lineTo(-10, 6); }); icirc(armL, -10, 6, 2.6, 0xe8b83a, 1); armL.position.set(-9, -38);
    const armR = new PIXI.Graphics(); ostrokeA(armR, 3.2, c, () => { armR.moveTo(0, 0); armR.lineTo(10, 6); }); icirc(armR, 10, 6, 2.6, 0xe8b83a, 1); armR.position.set(9, -38);
    const aura = glowCircle(20, 0x7ae8ff, 0.18); aura.position.set(0, -36);
    body.addChild(aura, g, armL, armR);
    return {
        height: 68,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            body.y = -10 + Math.sin(e.phase * 0.8) * 3;
            armR.rotation = s === 'windup' ? -1.2 : Math.sin(e.phase * 1.1) * 0.2;
            armL.rotation = -Math.sin(e.phase * 1.1) * 0.2;
            aura.alpha = s === 'windup' ? 0.9 : 0.5;
        }
    };
}

/** Shore, tier 2: a siren on the rocks. Her song slows you; she keeps her distance. */
function siren(body, t, r) {
    const c = t.color, dark = shade(c, 0.6), light = shade(c, 1.3);
    const tail = new PIXI.Graphics();
    poly(tail, [-8, -18, 8, -18, 10, -8, 18, 0, 10, 2, 4, -4, -2, 0, -10, -2], c);
    for (let k = 0; k < 3; k++) ell(tail, -2 + k * 4, -12 + k * 3, 2.4, 1.4, light, 0.8);
    poly(tail, [14, -2, 24, -8, 22, 2, 24, 8], dark);
    const g = new PIXI.Graphics();
    ell(g, 0, -26, 8, 10, 0xf0d0b8);                                         // torso
    ell(g, -3, -28, 3, 2.2, 0xd8a0c8); ell(g, 3, -28, 3, 2.2, 0xd8a0c8);     // shells
    ell(g, 0, -42, 7, 7.5, 0xf6dcc8);                                         // face
    poly(g, [-9, -44, -6, -52, 6, -52, 9, -44, 10, -26, 6, -36, -6, -36, -10, -26], 0x2a8a7a);   // long sea-green hair
    circ(g, -2.4, -42, 1.2, 0x1a5a6a); circ(g, 2.4, -42, 1.2, 0x1a5a6a);
    const mouth = new PIXI.Graphics(); ell(mouth, 0, 0, 1.6, 1, 0xb84a5a); mouth.position.set(0, -38);
    const song = new PIXI.Graphics(); song.lineStyle(1.6, 0xa0fff0, 0.8); song.arc(10, -40, 6, -0.7, 0.7); song.arc(10, -40, 11, -0.7, 0.7); song.lineStyle(0); song.visible = false;
    body.addChild(tail, g, mouth, song);
    return {
        height: 56,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            tail.rotation = Math.sin(e.phase * 1.4) * 0.08;
            song.visible = s === 'windup';
            mouth.scale.set(s === 'windup' ? 2 : 1);
            body.y = Math.sin(e.phase * 0.9) * 1.2;
        }
    };
}

/** Shore, tier 3: a hunched thing from the deep with a lure that glows. Slams the ground. */
function lurker(body, t, r) {
    const c = t.color, dark = shade(c, 0.55), light = shade(c, 1.35);
    const legs = legSet([[-14, dark], [12, dark]], -14, 14, dark, 7);
    const g = new PIXI.Graphics();
    ell(g, 0, -32, 26, 20, shade(c, 0.85));
    ell(g, -3, -35, 23, 17, c);
    for (let k = 0; k < 5; k++) ell(g, -14 + k * 7, -22, 3, 1.6, light, 0.6);
    poly(g, [-10, -50, -4, -60, 2, -50], dark); poly(g, [2, -50, 8, -58, 12, -48], dark);   // fins
    // wide mouth and eyes
    poly(g, [8, -30, 26, -32, 24, -22, 10, -22], 0x1a0a14);
    for (let k = 0; k < 4; k++) poly(g, [11 + k * 3.6, -30, 12.8 + k * 3.6, -26, 14.6 + k * 3.6, -30], 0xf0f0e0);
    circ(g, 14, -40, 3.2, 0xfff0a0); circ(g, 14.4, -40, 1.4, 0x1a1a1a);
    const lureG = new PIXI.Graphics();
    io(lureG, 1.4); lureG.moveTo(0, 0); lureG.quadraticCurveTo(14, -18, 24, -8); lureG.lineStyle(0);
    icirc(lureG, 24, -6, 3.4, 0xd8fff0, 1.2);
    const bulb = glowCircle(12, 0x9affd8, 0.35); bulb.position.set(24, -6);
    const lure = new PIXI.Container();
    lure.addChild(bulb, lureG);
    lure.position.set(4, -52);
    const claw = new PIXI.Graphics();
    ostrokeA(claw, 6, c, () => { claw.moveTo(0, 0); claw.lineTo(12, 14); });
    poly(claw, [8, 10, 22, 12, 18, 20, 10, 18], light);
    claw.position.set(16, -30);
    body.addChild(legs[0], g, lure, claw, legs[1]);
    return {
        height: 64,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            const step = Math.sin(e.phase * 1.1);
            legs[0].rotation = step * 0.3; legs[1].rotation = -step * 0.3;
            lure.rotation = Math.sin(e.phase * 0.9) * 0.15;
            bulb.alpha = 0.6 + Math.sin(e.phase * 2.5) * 0.3;
            claw.rotation = s === 'windup' ? -1.3 : s === 'slam' ? 0.5 : 0;
            body.scale.y = s === 'windup' ? 1.06 : s === 'slam' ? 0.9 : 1;
            windupShake(e, body);
        }
    };
}

/** Mountain, tier 2: a harpy on brown wings. Circles high, then dives with her talons. */
function harpy(body, t, r) {
    const c = t.color, dark = shade(c, 0.6), light = shade(c, 1.3);
    const wingL = new PIXI.Graphics(), wingR = new PIXI.Graphics();
    for (const [w, sx] of [[wingL, -1], [wingR, 1]]) {
        poly(w, [0, 0, sx * 26, -10, sx * 30, 2, sx * 22, 4, sx * 26, 10, sx * 14, 8], sx < 0 ? dark : c);
        for (let k = 0; k < 3; k++) poly(w, [sx * (12 + k * 6), 6, sx * (16 + k * 6), 12, sx * (18 + k * 6), 6], light);
    }
    wingL.position.set(-4, -30); wingR.position.set(4, -30);
    const g = new PIXI.Graphics();
    ell(g, 0, -26, 8, 11, c);
    ell(g, 0, -42, 6.5, 7, 0xf0c8a8);                                          // face
    poly(g, [-8, -44, -4, -52, 4, -52, 8, -44, 9, -34, 4, -40, -4, -40, -9, -34], 0x5a3a2a);   // wild hair
    circ(g, -2.2, -42, 1.3, 0xffd040); circ(g, 2.2, -42, 1.3, 0xffd040);
    poly(g, [-2, -38, 2, -38, 0, -35], 0xc8783a);
    const talons = new PIXI.Graphics();
    ostrokeA(talons, 2.2, 0xd8b040, () => { talons.moveTo(-3, 0); talons.lineTo(-4, 8); talons.moveTo(3, 0); talons.lineTo(4, 8); });
    talons.position.set(0, -16);
    body.addChild(wingL, g, talons, wingR);
    return {
        height: 56,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            const flap = Math.sin(e.phase * (s === 'dive' ? 1 : 3.2));
            wingL.rotation = flap * 0.5; wingR.rotation = -flap * 0.5;
            if (s === 'dive') { wingL.rotation = -0.6; wingR.rotation = 0.6; body.rotation = 0.35; }
            else body.rotation = 0;
            body.y = -14 + Math.sin(e.phase * 1.2) * 3;
            talons.rotation = s === 'dive' ? -0.4 : 0;
            windupShake(e, body);
        }
    };
}

/** Mountain, tier 3: a yeti. Keeps its distance and hurls blocks of packed snow. */
function yeti(body, t, r) {
    const c = t.color, dark = shade(c, 0.72), face = 0x6a8ab8;
    const legs = legSet([[-10, dark], [10, dark]], -16, 16, dark, 9);
    const g = new PIXI.Graphics();
    ell(g, 0, -40, 24, 24, dark);
    ell(g, -3, -42, 21, 21, c);
    for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + k * 0.12); poly(g, [Math.cos(a) * 22 - 3, -42 + Math.sin(a) * 22, Math.cos(a + 0.06) * 27 - 3, -42 + Math.sin(a + 0.06) * 27, Math.cos(a + 0.12) * 22 - 3, -42 + Math.sin(a + 0.12) * 22], c); }
    ell(g, 6, -48, 9, 8, face);                                                // blue face
    circ(g, 3, -50, 1.8, 0x0a1a2a); circ(g, 9.5, -50, 1.8, 0x0a1a2a);
    poly(g, [2, -44, 11, -44, 9, -41, 4, -41], 0x1a2a3a);
    poly(g, [3, -44, 4, -42, 5, -44], 0xffffff); poly(g, [8, -44, 9, -42, 10, -44], 0xffffff);
    const armL = new PIXI.Graphics(); ostrokeA(armL, 8, c, () => { armL.moveTo(0, 0); armL.lineTo(-6, -16); }); armL.position.set(-16, -50);
    const armR = new PIXI.Graphics(); ostrokeA(armR, 8, c, () => { armR.moveTo(0, 0); armR.lineTo(6, -16); }); armR.position.set(14, -50);
    const snow = new PIXI.Graphics();
    icirc(snow, 0, 0, 10, 0xf4f8ff, 1.6); ell(snow, -3, -3, 4, 2.6, 0xffffff, 0.9); ell(snow, 3, 4, 4, 2, 0xc8d8f0, 0.8);
    snow.position.set(0, -74);
    body.addChild(legs[0], g, armL, armR, snow, legs[1]);
    return {
        height: 86,
        anim: (e) => {
            const st = e.ai && e.ai.state;
            body.scale.x = e.facing;
            const step = Math.sin(e.phase * 1.1);
            legs[0].rotation = step * 0.3; legs[1].rotation = -step * 0.3;
            snow.visible = st !== 'recover';
            snow.y = -74 + (st === 'windup' ? -8 * Math.abs(Math.sin(e.phase * 3)) : 0);
            body.y = Math.abs(step) * -2;
            windupShake(e, body);
        }
    };
}

export const ENEMY_ART = {
    thornback, wight, mantis, thornwitch, sandworm, djinn, siren, lurker, harpy, yeti,
    dummy,
    slime, bee, boar,
    boarking: (b, t, r) => boar(b, t, r, { crown: true, tusk: 0xffe8a0, eye: 0xff3a3a }),
    wolf, spider, treant,
    ancienttreant: (b, t, r) => treant(b, t, r, { eye: 0xff4a3a, mushrooms: true, leaf: 0x4a7a2a }),
    scorpion, vulture, mummy, scarab, pharaoh,
    crab, crabking: (b, t, r) => crab(b, t, r, { crown: true }),
    gull, jelly, bat,
    golem: (b, t, r) => golem(b, t, r),
    titan: (b, t, r) => golem(b, t, r, { eye: 0xff3a3a, crystals: true }),
    troll, skeleton, ghost
};
