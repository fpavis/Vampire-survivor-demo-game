// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
// Procedural sprites for every enemy. Each builder draws into `body` (feet at the origin, facing right)
// and returns { height, anim(e, t) } where `height` is used to place health bars and damage numbers.
import { shade } from './decorArt';

const glowCircle = (radius, color, alpha) => {
    const g = new PIXI.Graphics();
    g.beginFill(color, alpha);
    g.drawCircle(0, 0, radius);
    g.endFill();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    return g;
};

const ell = (g, x, y, rx, ry, c, a = 1) => { g.beginFill(c, a); g.drawEllipse(x, y, rx, ry); g.endFill(); };
const circ = (g, x, y, r, c, a = 1) => { g.beginFill(c, a); g.drawCircle(x, y, r); g.endFill(); };
const poly = (g, pts, c, a = 1) => { g.beginFill(c, a); g.drawPolygon(pts); g.endFill(); };
const rect = (g, x, y, w, h, c, a = 1) => { g.beginFill(c, a); g.drawRect(x, y, w, h); g.endFill(); };

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
    ell(wl, -5, -5, 7, 4, 0xdff4ff, 0.7); ell(wr, 5, -5, 7, 4, 0xdff4ff, 0.7);
    const g = new PIXI.Graphics();
    ell(g, 0, 0, 8, 6.5, 0xffc933);
    rect(g, -2, -6, 3, 12, 0x2a2018); rect(g, 3, -5, 2.5, 10, 0x2a2018);
    ell(g, -7, -1, 3.5, 3.5, 0x3a2a18);
    circ(g, -8, -2, 1, 0xffffff);
    poly(g, [8, 0, 13, 1, 8, 3], 0x3a2a18);
    hover.addChild(wl, wr, g);
    body.addChild(hover);
    return {
        height: 26,
        anim: (e) => {
            const f = Math.sin(e.phase * 6);
            wl.scale.y = wr.scale.y = 0.4 + Math.abs(f) * 0.9;
            hover.y = -20 + Math.sin(e.phase * 1.4) * 2.5;
        }
    };
}

function boar(body, t, r, opts = {}) {
    const c = t.color, g = new PIXI.Graphics();
    const k = r / 20;
    // legs
    [[-12, 0], [-4, 2], [8, 0], [15, 2]].forEach(([x, y]) => rect(g, x * k - 2, -9 * k + y, 4 * k, 10 * k, shade(c, 0.5)));
    ell(g, 0, -17 * k, 24 * k, 13 * k, shade(c, 0.7));
    ell(g, -2 * k, -19 * k, 22 * k, 12 * k, c);
    // bristles
    for (let i = -3; i <= 3; i++) poly(g, [i * 5 * k - 2, -29 * k, i * 5 * k, -35 * k, i * 5 * k + 3, -29 * k], shade(c, 0.45));
    // head
    ell(g, 21 * k, -15 * k, 11 * k, 9 * k, shade(c, 1.1));
    ell(g, 29 * k, -12 * k, 6 * k, 5 * k, 0xe0a890);
    circ(g, 31 * k, -12 * k, 1.2 * k, 0x2a1810); circ(g, 28 * k, -12 * k, 1.2 * k, 0x2a1810);
    poly(g, [24 * k, -9 * k, 33 * k, -4 * k, 27 * k, -5 * k], opts.tusk || 0xf4f0e0);
    circ(g, 21 * k, -19 * k, 1.8 * k, opts.eye || 0x2a1810);
    poly(g, [15 * k, -22 * k, 18 * k, -29 * k, 21 * k, -23 * k], shade(c, 0.6));
    if (opts.crown) {
        poly(g, [14 * k, -23 * k, 16 * k, -33 * k, 19 * k, -26 * k, 22 * k, -35 * k, 25 * k, -26 * k, 28 * k, -33 * k, 29 * k, -23 * k], 0xffc233);
        circ(g, 22 * k, -29 * k, 2 * k, 0xff4a4a);
        // armour plates
        poly(g, [-14 * k, -29 * k, 6 * k, -31 * k, 8 * k, -17 * k, -12 * k, -15 * k], 0x6a6a7a);
        poly(g, [-14 * k, -29 * k, -3 * k, -30 * k, -2 * k, -16 * k, -12 * k, -15 * k], 0x9a9aaa, 0.8);
    }
    body.addChild(g);
    return {
        height: 40 * k,
        anim: (e) => {
            const a = e.ai && e.ai.state;
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
    const c = t.color, g = new PIXI.Graphics();
    const legs = [[-12, 0], [-5, 1], [8, 0], [14, 1]];
    legs.forEach(([x, y]) => rect(g, x - 2, -10 + y, 4, 11, shade(c, 0.55)));
    // tail
    g.lineStyle(5, shade(c, 0.8)); g.moveTo(-18, -17); g.quadraticCurveTo(-30, -20, -28, -8); g.lineStyle(0);
    ell(g, 0, -16, 20, 10, shade(c, 0.75));
    ell(g, -1, -18, 19, 9, c);
    ell(g, 3, -12, 12, 4, shade(c, 1.35), 0.7);
    // head
    ell(g, 19, -20, 9, 8, shade(c, 1.05));
    poly(g, [24, -22, 37, -17, 25, -13], shade(c, 1.2));
    circ(g, 36, -17, 2, 0x1a1a1a);
    circ(g, 21, -23, 1.8, 0xffd84a);
    poly(g, [14, -25, 16, -34, 21, -26], shade(c, 0.6)); poly(g, [20, -26, 24, -34, 27, -25], shade(c, 0.7));
    poly(g, [25, -13, 28, -8, 29, -14], 0xffffff);
    body.addChild(g);
    return {
        height: 36,
        anim: (e) => {
            const s = e.ai && e.ai.state;
            body.scale.x = e.facing;
            if (s === 'lunge') { body.rotation = 0.12; body.scale.y = 0.92; }
            else if (s === 'windup') { body.rotation = -0.05; body.scale.y = 0.85; windupShake(e, body); }
            else { body.rotation = 0; body.scale.y = 1; body.y = Math.abs(Math.sin(e.phase * 2.2)) * -2.5; }
        }
    };
}

function spider(body, t, r) {
    const c = t.color, hover = new PIXI.Container();
    hover.y = -12;
    const legs = new PIXI.Graphics();
    legs.lineStyle(2.4, shade(c, 0.7));
    for (let i = 0; i < 4; i++) {
        const y = -6 + i * 4, spread = 14 + i * 2;
        legs.moveTo(0, y); legs.lineTo(-spread, y - 10 - i); legs.lineTo(-spread - 5, y + 10);
        legs.moveTo(0, y); legs.lineTo(spread, y - 10 - i); legs.lineTo(spread + 5, y + 10);
    }
    const g = new PIXI.Graphics();
    ell(g, -5, 2, 10, 8, shade(c, 0.8)); ell(g, -6, 0, 9, 7, c);
    poly(g, [-10, -3, -5, -6, -2, -1, -6, 3], 0xe0405a);
    ell(g, 8, -2, 6, 5, shade(c, 1.1));
    [[11, -4], [13, -2], [10, -1], [12, 1]].forEach(([x, y]) => circ(g, x, y, 1.1, 0xff4a4a));
    hover.addChild(legs, g);
    body.addChild(hover);
    return {
        height: 26,
        anim: (e) => {
            body.scale.x = e.facing;
            legs.scale.x = 1 + Math.sin(e.phase * 3) * 0.1;
            legs.rotation = Math.sin(e.phase * 3) * 0.05;
            hover.y = -12 + Math.abs(Math.sin(e.phase * 3)) * -2;
            windupShake(e, body);
        }
    };
}

function treant(body, t, r, opts = {}) {
    const c = t.color, k = r / 28, g = new PIXI.Graphics();
    // roots
    poly(g, [-18 * k, 0, -10 * k, -10 * k, 10 * k, -10 * k, 18 * k, 0, 8 * k, -4 * k, -8 * k, -4 * k], shade(c, 0.55));
    // trunk
    poly(g, [-16 * k, -6 * k, -12 * k, -50 * k, 12 * k, -50 * k, 16 * k, -6 * k], shade(c, 0.7));
    poly(g, [-16 * k, -6 * k, -12 * k, -50 * k, 0, -50 * k, 0, -6 * k], c);
    g.lineStyle(2, shade(c, 0.4)); g.moveTo(-4 * k, -14 * k); g.lineTo(-6 * k, -34 * k); g.moveTo(6 * k, -10 * k); g.lineTo(5 * k, -30 * k); g.lineStyle(0);
    // arms
    g.lineStyle(7 * k, shade(c, 0.75)); g.moveTo(-14 * k, -40 * k); g.quadraticCurveTo(-34 * k, -34 * k, -34 * k, -14 * k);
    g.moveTo(14 * k, -40 * k); g.quadraticCurveTo(34 * k, -34 * k, 34 * k, -14 * k); g.lineStyle(0);
    // face
    const eye = opts.eye || 0xffb030;
    circ(g, -6 * k, -38 * k, 3.2 * k, eye); circ(g, 6 * k, -38 * k, 3.2 * k, eye);
    g.lineStyle(2, 0x2a1808); g.moveTo(-6 * k, -28 * k); g.quadraticCurveTo(0, -24 * k, 6 * k, -28 * k); g.lineStyle(0);
    // canopy
    const leaf = opts.leaf || 0x3a8a3a;
    [[0, -64, 22], [-18, -56, 16], [18, -56, 16], [0, -52, 16]].forEach(([x, y, rr]) => {
        circ(g, x * k + 2, y * k + 3, rr * k, shade(leaf, 0.65)); circ(g, x * k, y * k, rr * k * 0.92, leaf);
    });
    circ(g, -8 * k, -72 * k, 8 * k, shade(leaf, 1.3), 0.7);
    if (opts.mushrooms) {
        [[-26, -50, 0xd23a3a], [24, -46, 0x8a4ac8]].forEach(([x, y, col]) => {
            rect(g, x * k - 2, y * k, 4 * k, 8 * k, 0xe8dfc8); ell(g, x * k, y * k, 8 * k, 5 * k, col);
        });
    }
    body.addChild(g);
    const glow = glowCircle(10 * k, eye, 0.2); glow.y = -38 * k; body.addChild(glow);
    return {
        height: 80 * k,
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
    g.lineStyle(2, shade(c, 0.6));
    for (let i = 0; i < 4; i++) { const x = -8 + i * 6; g.moveTo(x, -7); g.lineTo(x - 5, 0); g.moveTo(x, -7); g.lineTo(x + 3, 1); }
    g.lineStyle(0);
    ell(g, 0, -9, 15, 8, shade(c, 0.7)); ell(g, -1, -10, 14, 7, c);
    ell(g, 12, -10, 6, 5, shade(c, 1.15));
    circ(g, 15, -12, 1.2, 0x1a1a1a); circ(g, 15, -9, 1.2, 0x1a1a1a);
    // claws
    [-1, 1].forEach((s) => {
        g.lineStyle(3, shade(c, 0.8)); g.moveTo(14, -10 + s * 4); g.lineTo(24, -10 + s * 9); g.lineStyle(0);
        poly(g, [22, -10 + s * 9 - 4, 33, -10 + s * 9, 22, -10 + s * 9 + 4], shade(c, 1.1));
    });
    const tail = new PIXI.Container();
    const tg = new PIXI.Graphics();
    tg.lineStyle(5, shade(c, 0.85)); tg.moveTo(0, 0); tg.quadraticCurveTo(-14, -14, -8, -30); tg.quadraticCurveTo(-2, -38, 8, -32);
    tg.lineStyle(0); poly(tg, [8, -32, 15, -29, 9, -26], 0xff5a3a);
    tail.addChild(tg); tail.position.set(-10, -10);
    const dust = new PIXI.Graphics(); ell(dust, 0, -2, 20, 8, 0xc8a060, 0.85); dust.visible = false;
    body.addChild(dust, g, tail);
    return {
        height: 34,
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
    rect(g, -10 * k, -16 * k, 8 * k, 16 * k, shade(c, 0.7)); rect(g, 2 * k, -16 * k, 8 * k, 16 * k, shade(c, 0.8));
    poly(g, [-14 * k, -14 * k, -11 * k, -50 * k, 11 * k, -50 * k, 14 * k, -14 * k], shade(c, 0.75));
    poly(g, [-14 * k, -14 * k, -11 * k, -50 * k, 0, -50 * k, 0, -14 * k], c);
    g.lineStyle(2, shade(c, 0.5), 0.8);
    for (let i = 0; i < 6; i++) { g.moveTo(-13 * k, (-18 - i * 5.5) * k); g.lineTo(13 * k, (-22 - i * 5.5) * k); }
    g.lineStyle(0);
    // arms forward
    rect(g, 8 * k, -44 * k, 18 * k, 7 * k, shade(c, 0.9)); rect(g, 8 * k, -34 * k, 18 * k, 7 * k, shade(c, 0.7));
    circ(g, 0, -57 * k, 10 * k, shade(c, 0.9));
    rect(g, -10 * k, -61 * k, 20 * k, 5 * k, 0x1a1008);
    circ(g, -3 * k, -59 * k, 2 * k, 0x6aff9a); circ(g, 5 * k, -59 * k, 2 * k, 0x6aff9a);
    g.lineStyle(2, shade(c, 0.5)); g.moveTo(-9 * k, -54 * k); g.lineTo(9 * k, -56 * k); g.lineStyle(0);
    poly(g, [8 * k, -52 * k, 20 * k, -48 * k, 12 * k, -45 * k], shade(c, 0.9)); // loose bandage
    body.addChild(g);
    const glow = glowCircle(8 * k, 0x6aff9a, 0.25); glow.y = -59 * k; body.addChild(glow);
    return {
        height: 70 * k,
        anim: (e) => { body.scale.x = e.facing; body.rotation = Math.sin(e.phase * 0.8) * 0.05; body.y = Math.abs(Math.sin(e.phase * 0.8)) * -2; }
    };
}

function scarab(body, t, r) {
    const c = t.color, g = new PIXI.Graphics();
    g.lineStyle(1.5, 0x1a2a2a); [-3, 0, 3].forEach((x) => { g.moveTo(x, -4); g.lineTo(x - 4, 0); g.moveTo(x, -4); g.lineTo(x + 4, 0); }); g.lineStyle(0);
    ell(g, 0, -5, 8, 6, shade(c, 0.7)); ell(g, 0, -6, 7, 5, c);
    g.lineStyle(1, shade(c, 0.5)); g.moveTo(0, -11); g.lineTo(0, -1); g.lineStyle(0);
    circ(g, 7, -5, 3, shade(c, 0.6));
    ell(g, -2, -8, 3, 1.4, 0xffffff, 0.5);
    body.addChild(g);
    return { height: 16, anim: (e) => { body.scale.x = e.facing; body.y = Math.abs(Math.sin(e.phase * 4)) * -1.2; } };
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
        poly(w, [0, 0, s * 14, -12, s * 30, -8, s * 24, -2, s * 12, 2], 0xf4f4f4);
        poly(w, [s * 20, -10, s * 30, -8, s * 24, -2, s * 17, -4], 0x4a4a52);
    });
    const g = new PIXI.Graphics();
    ell(g, 0, 2, 9, 6, 0xffffff); circ(g, 8, -2, 4.5, 0xffffff);
    poly(g, [11, -2, 17, 0, 11, 1], 0xf0b030);
    circ(g, 9, -3, 1, 0x1a1a1a);
    poly(g, [-8, 3, -15, 2, -8, 6], 0xdcdcdc);
    hover.addChild(wl, wr, g);
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
    rect(g, -16 * s, -14 * s, 12 * s, 14 * s, shade(c, 0.55)); rect(g, 4 * s, -14 * s, 12 * s, 14 * s, shade(c, 0.55));
    g.beginFill(shade(c, 0.7)); g.drawRoundedRect(-33 * s, -52 * s, 12 * s, 34 * s, 5); g.drawRoundedRect(21 * s, -52 * s, 12 * s, 34 * s, 5); g.endFill();
    g.beginFill(shade(c, 0.75)); g.drawRoundedRect(-24 * s, -58 * s, 48 * s, 48 * s, 8); g.endFill();
    g.beginFill(c); g.drawRoundedRect(-24 * s, -58 * s, 34 * s, 46 * s, 8); g.endFill();
    g.beginFill(shade(c, 1.3), 0.7); g.drawRoundedRect(-20 * s, -55 * s, 20 * s, 8 * s, 4); g.endFill();
    g.lineStyle(2, shade(c, 0.4)); g.moveTo(-6 * s, -50 * s); g.lineTo(2 * s, -38 * s); g.lineTo(-3 * s, -28 * s); g.lineStyle(0);
    g.beginFill(shade(c, 0.85)); g.drawRoundedRect(-13 * s, -76 * s, 26 * s, 20 * s, 5); g.endFill();
    const eye = opts.eye || 0xffa030;
    rect(g, -9 * s, -70 * s, 6 * s, 5 * s, eye); rect(g, 3 * s, -70 * s, 6 * s, 5 * s, eye);
    if (opts.crystals) {
        [[-28, -58, 0x5ad0ff], [26, -60, 0xc07aff], [0, -80, 0x5ad0ff]].forEach(([x, y, col]) => {
            poly(g, [x * s - 6 * s, y * s, x * s, (y - 22) * s, x * s + 6 * s, y * s], shade(col, 0.8));
            poly(g, [x * s - 6 * s, y * s, x * s, (y - 22) * s, x * s, y * s], shade(col, 1.3));
        });
    }
    body.addChild(g);
    const glow = glowCircle(r * 0.5, eye, 0.18); glow.y = -67 * s; body.addChild(glow);
    return {
        height: 78 * s,
        anim: (e) => {
            const st = e.ai && e.ai.state;
            body.rotation = st === 'windup' ? -0.06 : Math.sin(e.phase * 0.7) * 0.04;
            body.y = st === 'windup' ? -4 : Math.abs(Math.sin(e.phase * 0.7)) * -2;
            body.scale.y = st === 'slam' || st === 'recover' ? 0.93 : 1;
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
    const c = t.color, g = new PIXI.Graphics();
    rect(g, -6, -18, 3.5, 18, c); rect(g, 2.5, -18, 3.5, 18, shade(c, 0.85));
    rect(g, -9, -2, 7, 3, shade(c, 0.8)); rect(g, 2, -2, 7, 3, shade(c, 0.8));
    rect(g, -2, -38, 4, 22, shade(c, 0.85));
    for (let i = 0; i < 4; i++) ell(g, 0, -34 + i * 4.5, 10 - i, 2.4, c);
    circ(g, 0, -46, 8, c);
    rect(g, -4, -42, 8, 4, shade(c, 0.8));
    circ(g, -3, -47, 2.2, 0x1a1008); circ(g, 3, -47, 2.2, 0x1a1008);
    circ(g, -3, -47, 0.9, 0xff6a3a); circ(g, 3, -47, 0.9, 0xff6a3a);
    g.lineStyle(3, shade(c, 0.9)); g.moveTo(-9, -34); g.lineTo(-13, -22); g.moveTo(9, -34); g.lineTo(15, -28); g.lineStyle(0);
    // bow
    g.lineStyle(2.5, 0x8a5a2a); g.moveTo(16, -48); g.quadraticCurveTo(26, -34, 16, -20);
    g.lineStyle(1, 0xdddddd); g.moveTo(16, -48); g.lineTo(16, -20); g.lineStyle(0);
    body.addChild(g);
    return {
        height: 58,
        anim: (e) => {
            body.scale.x = e.facing;
            body.rotation = Math.sin(e.phase * 1.4) * 0.05;
            body.y = Math.abs(Math.sin(e.phase * 1.4)) * -2;
            windupShake(e, body);
        }
    };
}

function ghost(body, t) {
    const c = t.color, hover = new PIXI.Container();
    hover.y = -26;
    const g = new PIXI.Graphics();
    g.beginFill(c, 0.75);
    g.drawPolygon([-13, 6, -14, -10, -8, -22, 0, -26, 8, -22, 14, -10, 13, 6, 8, 12, 4, 6, 0, 13, -4, 6, -8, 12]);
    g.endFill();
    ell(g, -3, -14, 6, 8, 0xffffff, 0.35);
    ell(g, -5, -12, 2.6, 4, 0x1a2438); ell(g, 5, -12, 2.6, 4, 0x1a2438);
    ell(g, 0, -4, 3, 4, 0x1a2438, 0.8);
    const glow = glowCircle(26, 0x9ad0ff, 0.2);
    hover.addChild(glow, g);
    body.addChild(hover);
    return {
        height: 50,
        anim: (e) => {
            hover.y = -26 + Math.sin(e.phase * 0.9) * 4;
            g.alpha = e.ai && e.ai.state === 'windup' ? 1 : 0.8 + Math.sin(e.phase) * 0.12;
            g.scale.x = 1 + Math.sin(e.phase * 1.3) * 0.05;
            e.shadow.alpha = 0.4;
            windupShake(e, body);
        }
    };
}

export const ENEMY_ART = {
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
