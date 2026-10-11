// @ts-nocheck -- Pixi-bound renderer helper
// Named town NPCs (healer, merchant, innkeeper): outlined figures with a nameplate and an idle animation.
import * as PIXI from 'pixi.js';
import { softGlow } from './glow';

const INK = 0x1e1822;
const shade = (c, f) => {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * f)), g = Math.min(255, Math.round(((c >> 8) & 255) * f)), b = Math.min(255, Math.round((c & 255) * f));
    return (r << 16) | (g << 8) | b;
};
const O = (g, w = 1.4) => g.lineStyle(w, INK, 0.9);
const poly = (g, pts, c) => { O(g); g.beginFill(c); g.drawPolygon(pts); g.endFill(); g.lineStyle(0); };
const ell = (g, x, y, rx, ry, c) => { O(g); g.beginFill(c); g.drawEllipse(x, y, rx, ry); g.endFill(); g.lineStyle(0); };
const rrect = (g, x, y, w, h, r, c) => { O(g); g.beginFill(c); g.drawRoundedRect(x, y, w, h, r); g.endFill(); g.lineStyle(0); };

export const ROLES = {
    healer: { name: 'Healer', color: 0xbfffd0 },
    merchant: { name: 'Merchant', color: 0xffe08a },
    innkeeper: { name: 'Innkeeper', color: 0xffc8a0 }
};

function head(g, skin, hair, y = -34) {
    ell(g, 0, y, 7.6, 8, skin);
    g.beginFill(INK); g.drawEllipse(2.6, y - 0.6, 1, 1.4); g.drawEllipse(5.6, y - 0.6, 0.9, 1.3); g.endFill();
    g.beginFill(0xd8826a, 0.5); g.drawEllipse(5, y + 2.6, 1.5, 0.9); g.endFill();
    return hair;
}

export function createNpc(role) {
    const c = new PIXI.Container();
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.35); shadow.drawEllipse(0, 0, 14, 5); shadow.endFill();
    const body = new PIXI.Container();
    const g = new PIXI.Graphics();
    let accent = null;
    if (role === 'healer') {
        poly(g, [-12, 0, 12, 0, 8, -28, -8, -28], 0xf2f2ea);
        poly(g, [1, 0, 12, 0, 8, -28, 1, -28], 0xffffff);
        g.beginFill(0x3fbf6a); g.drawRect(-10, -16, 20, 3); g.endFill();
        head(g, 0xffd7b0, 0);
        poly(g, [-9, -34, 9, -34, 7, -46, 0, -50, -7, -46], 0xf2f2ea);
        g.beginFill(0x3fbf6a); g.drawRect(-2, -45, 4, 9); g.drawRect(-4.5, -42.5, 9, 4); g.endFill();
        const staff = new PIXI.Graphics();
        O(staff, 1.2); staff.beginFill(0x8a6a3a); staff.drawRoundedRect(-1.5, -48, 3, 48, 1.5); staff.endFill(); staff.lineStyle(0);
        staff.beginFill(0x9bffb0); staff.drawCircle(0, -51, 5); staff.endFill();
        staff.position.set(16, 0);
        accent = softGlow(15, 0x7bff9a, 0.4); accent.position.set(16, -51);
        body.addChild(g, staff);
    } else if (role === 'merchant') {
        // backpack stacked with goods
        poly(g, [-18, -10, -8, -10, -7, -30, -17, -30], 0x8a5a2a);
        rrect(g, -21, -24, 9, 8, 2, 0xd8b050);
        poly(g, [-20, -30, -9, -30, -14, -38], 0xc8402a);
        poly(g, [-13, 0, 13, 0, 9, -28, -9, -28], 0x6a3a8a);
        poly(g, [1, 0, 13, 0, 9, -28, 1, -28], 0x8a56ac);
        g.beginFill(0xe8b040); g.drawRect(-12, -15, 24, 3); g.endFill();
        rrect(g, 7, -14, 7, 8, 2, 0xd8a020);          // coin purse
        g.beginFill(0xffe27a); g.drawCircle(10.5, -10, 1.6); g.endFill();
        head(g, 0xe0b088, 0);
        poly(g, [-6, -37, 8, -37, 6, -29, 0, -26, -5, -30], 0x5a3a20);          // beard
        // wide hat
        O(g); g.beginFill(0x3a2a4a); g.drawEllipse(0, -41, 13, 3.4); g.endFill(); g.beginFill(0x4a3a5a); g.drawRoundedRect(-7, -50, 14, 10, 4); g.endFill(); g.lineStyle(0);
        g.beginFill(0xe8b040); g.drawRect(-7, -43, 14, 2.4); g.endFill();
        accent = softGlow(18, 0xffd84a, 0.28); accent.position.set(0, -20);
        body.addChild(g);
    } else {
        poly(g, [-12, 0, 12, 0, 9, -28, -9, -28], 0xb8584a);
        poly(g, [-8, 0, 8, 0, 7, -24, -7, -24], 0xf2ead8);       // apron
        g.beginFill(0x8a6a3a); g.drawRect(-9, -15, 18, 2.4); g.endFill();
        head(g, 0xf0c8a0, 0);
        poly(g, [-8, -36, -6, -43, 0, -45, 7, -42, 8, -35, 2, -38, -4, -37], 0x7a4a22);  // hair
        poly(g, [-8, -42, 8, -42, 6, -48, -6, -48], 0xf2ead8);                           // cap
        // tankard held out front
        const mug = new PIXI.Graphics();
        rrect(mug, 0, 0, 9, 11, 2, 0xc8a050);
        g.lineStyle(0);
        mug.beginFill(0xfff3d0); mug.drawRoundedRect(0.5, -2.4, 8, 3.2, 1.6); mug.endFill();
        O(mug, 1.2); mug.moveTo(9, 3); mug.quadraticCurveTo(14, 5, 9, 9); mug.lineStyle(0);
        mug.position.set(10, -20);
        accent = softGlow(18, 0xffb060, 0.3); accent.position.set(0, -24);
        body.addChild(g, mug);
    }
    const label = new PIXI.Text(ROLES[role].name, { fontFamily: 'Trebuchet MS, Arial', fontSize: 13, fontWeight: 'bold', fill: ROLES[role].color, stroke: 0x000000, strokeThickness: 3 });
    label.anchor.set(0.5, 1);
    label.position.set(0, -62);
    c.addChild(shadow, accent, body, label);
    c.body = body;
    c.accent = accent;
    c.animate = (t) => {
        body.y = Math.sin(t * 0.06) * 0.8;
        body.scale.y = 1 + Math.sin(t * 0.06) * 0.012;
        accent.alpha = 0.7 + 0.3 * Math.sin(t * 0.09);
    };
    return c;
}
