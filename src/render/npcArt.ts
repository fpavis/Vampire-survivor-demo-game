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
    innkeeper: { name: 'Innkeeper', color: 0xffc8a0 },
    elder: { name: 'Elder', color: 0xc8d8ff }
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
    } else if (role === 'elder') {
        poly(g, [-13, 0, 13, 0, 9, -30, -9, -30], 0x2a3f8a);                 // deep blue robe
        poly(g, [1, 0, 13, 0, 9, -30, 1, -30], 0x3a56b0);
        g.beginFill(0xe8c050); g.drawRect(-11, -18, 22, 3); g.drawRect(-1.6, -30, 3.2, 30); g.endFill();   // gold sash and trim
        head(g, 0xf0d0b0, 0);
        poly(g, [-7.5, -36, 7.5, -36, 9.5, -21, 0, -14, -9.5, -21], 0xf4f4f4);   // long white beard
        poly(g, [-9.5, -41, 9.5, -41, 8, -49, 0, -54, -8, -49], 0x2a3f8a);       // hood
        g.beginFill(0x7ad0ff); g.drawCircle(0, -45, 2); g.endFill();
        const staff = new PIXI.Graphics();
        O(staff, 1.2); staff.beginFill(0x7a5a2a); staff.drawRoundedRect(-1.5, -52, 3, 52, 1.5); staff.endFill(); staff.lineStyle(0);
        staff.beginFill(0x7ad0ff); staff.drawCircle(0, -55, 5); staff.endFill();
        staff.beginFill(0xffffff, 0.7); staff.drawCircle(-1.5, -56.5, 1.6); staff.endFill();
        staff.position.set(-17, 0);
        accent = softGlow(16, 0x7ad0ff, 0.4); accent.position.set(-17, -55);
        body.addChild(g, staff);
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
    c.label = label;
    c.body = body;
    c.accent = accent;
    c.animate = (t) => {
        body.y = Math.sin(t * 0.06) * 0.8;
        body.scale.y = 1 + Math.sin(t * 0.06) * 0.012;
        accent.alpha = 0.7 + 0.3 * Math.sin(t * 0.09);
    };
    return c;
}

/** The bounty board: posts, a plank board with pinned notices, a roof and a lantern. */
export function createBoard() {
    const c = new PIXI.Container();
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.35); shadow.drawEllipse(0, 0, 30, 8); shadow.endFill();
    const g = new PIXI.Graphics();
    rrect(g, -30, -64, 6, 64, 2, 0x6a4422); rrect(g, 24, -64, 6, 64, 2, 0x6a4422);      // posts
    rrect(g, -32, -62, 64, 42, 3, 0x9a6a38);                                              // board
    g.lineStyle(1, 0x5a3a1a, 0.7); for (let y = -50; y < -22; y += 10) { g.moveTo(-30, y); g.lineTo(30, y); } g.lineStyle(0);
    poly(g, [-38, -62, 38, -62, 30, -74, -30, -74], 0x7a3a2a);                            // little roof
    // notices
    const note = (x, y, w, h, c0, rot) => { const n = new PIXI.Graphics(); O(n, 1); n.beginFill(c0); n.drawRect(-w / 2, -h / 2, w, h); n.endFill(); n.lineStyle(0); n.beginFill(0x7a2a2a); n.drawCircle(0, -h / 2 + 2, 1.5); n.endFill(); n.lineStyle(1, 0x6a5a40, 0.7); for (let i = 1; i < 4; i++) { n.moveTo(-w / 2 + 3, -h / 2 + 3 + i * 4); n.lineTo(w / 2 - 3, -h / 2 + 3 + i * 4); } n.position.set(x, y); n.rotation = rot; return n; };
    const notes = [note(-18, -44, 16, 20, 0xf2e8c8, -0.08), note(2, -40, 14, 18, 0xe8dcb8, 0.06), note(20, -45, 15, 21, 0xf0c8c0, 0.1), note(-4, -53, 10, 10, 0xd8e8f2, -0.04)];
    // lantern
    const lamp = new PIXI.Graphics();
    O(lamp, 1.2); lamp.beginFill(0x2a2a30); lamp.drawRect(-3, -6, 6, 10); lamp.endFill(); lamp.lineStyle(0);
    lamp.beginFill(0xffd070); lamp.drawRect(-2, -4, 4, 6); lamp.endFill();
    lamp.position.set(38, -52);
    const accent = softGlow(22, 0xffc060, 0.38); accent.position.set(38, -50);
    const label = new PIXI.Text('Bounties', { fontFamily: 'Trebuchet MS, Arial', fontSize: 13, fontWeight: 'bold', fill: 0xffe9a8, stroke: 0x000000, strokeThickness: 3 });
    label.anchor.set(0.5, 1);
    label.position.set(0, -80);
    c.addChild(shadow, accent, g, ...notes, lamp, label);
    c.label = label;
    c.accent = accent;
    c.animate = (t) => { accent.alpha = 0.65 + 0.3 * Math.sin(t * 0.11) * Math.sin(t * 0.07); };
    return c;
}
