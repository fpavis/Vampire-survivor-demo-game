// @ts-nocheck -- Pixi-bound renderer helper
// Hero sprites. Each hero is rigged from parts (legs, cape, torso, head, gear, weapon) so it can walk,
// breathe and sway. Drawn facing right with the feet at the origin; the body is mirrored for facing left.
import * as PIXI from 'pixi.js';
import { softGlow } from './glow';

const INK = 0x1a1424;          // outline colour shared by all heroes

const shade = (c: number, f: number) => {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
    const b = Math.min(255, Math.round((c & 255) * f));
    return (r << 16) | (g << 8) | b;
};

// outlined primitives
const O = (g, w = 1.6) => g.lineStyle(w, INK, 0.9);
const N = (g) => g.lineStyle(0);
const poly = (g, pts, c, outline = true) => { if (outline) O(g); else N(g); g.beginFill(c); g.drawPolygon(pts); g.endFill(); N(g); };
const ell = (g, x, y, rx, ry, c, outline = true, a = 1) => { if (outline) O(g); else N(g); g.beginFill(c, a); g.drawEllipse(x, y, rx, ry); g.endFill(); N(g); };
const rrect = (g, x, y, w, h, r, c, outline = true) => { if (outline) O(g); else N(g); g.beginFill(c); g.drawRoundedRect(x, y, w, h, r); g.endFill(); N(g); };

const glow = (radius: number, color: number, alpha: number) => softGlow(radius, color, alpha);

function leg(boot: number, pants: number, len = 13) {
    const g = new PIXI.Graphics();
    rrect(g, -3, 0, 6, len - 3, 2, pants);
    poly(g, [-3.5, len - 5, 3.5, len - 5, 6.5, len - 1, 6.5, len + 1, -3.5, len + 1], boot);
    return g;
}

function face(g, skin: number, eye = 0x1a1424) {
    ell(g, 0, -40, 8.2, 8.6, skin);
    ell(g, 3.5, -38, 3.6, 5, shade(skin, 0.9), false);           // cheek shade toward the light side
    N(g); g.beginFill(eye); g.drawEllipse(3.2, -41, 1.3, 1.7); g.drawEllipse(6.8, -41, 1.1, 1.6); g.endFill();
    g.beginFill(0xffffff, 0.8); g.drawCircle(3.6, -41.6, 0.5); g.endFill();
    g.beginFill(0xd8826a, 0.55); g.drawEllipse(6.2, -37.2, 1.8, 1); g.endFill();
}

// ------------------------------------------------------------------- Aria
function aria(rig) {
    const robe = 0x2f5fc8, robeDk = 0x1d3a86, trim = 0xf1c24a, skin = 0xffdcc0, hair = 0xd8d0ff;
    rig.backLeg = leg(0x3a2a4a, robeDk, 12);
    rig.frontLeg = leg(0x3a2a4a, robeDk, 12);
    const cape = new PIXI.Graphics();
    poly(cape, [-6, -32, -13, -4, -16, 2, -3, -2, 2, -30], 0x5a2a8a);
    rig.cape = cape;
    const torso = new PIXI.Graphics();
    poly(torso, [-11, 0, 12, 0, 8, -29, -7, -29], robe);
    poly(torso, [-11, 0, -3, 0, -2, -29, -7, -29], shade(robe, 0.78), false);   // the back of the robe in shadow
    poly(torso, [1, 0, 12, 0, 8, -29, 2, -29], shade(robe, 1.25), false);       // lit front panel
    torso.lineStyle(1, robeDk, 0.8); torso.moveTo(-4, -12); torso.lineTo(-6, -1); torso.moveTo(5, -11); torso.lineTo(6.5, -1); N(torso);
    N(torso); torso.beginFill(trim); torso.drawRect(-9, -15, 19, 2.6); torso.drawPolygon([-11, 0, 12, 0, 11.4, -2.4, -10.5, -2.4]); torso.endFill();
    torso.beginFill(shade(trim, 0.7)); for (let x = -8; x <= 9; x += 4) torso.drawPolygon([x, -1.2, x + 1.2, -2.4, x + 2.4, -1.2, x + 1.2, 0]); torso.endFill();
    torso.beginFill(0x9a4ad8); torso.drawCircle(1, -14, 2); torso.endFill();        // belt gem
    torso.beginFill(0xffffff, 0.7); torso.drawCircle(0.4, -14.6, 0.7); torso.endFill();
    poly(torso, [-6, -29, 7, -29, 4, -25, 0.5, -27, -3, -25], trim);                // collar
    rig.torso = torso;
    const head = new PIXI.Graphics();
    // long hair behind
    poly(head, [-8, -44, -11, -22, -4, -26, -2, -40], hair);
    face(head, skin);
    poly(head, [-8.5, -44, 8, -44, 9, -40, 2, -46, -9, -40], hair);
    rig.head = head;
    const hat = new PIXI.Graphics();
    poly(hat, [-14, -45, 15, -45, 9, -48.5, -9, -48.5], robeDk);
    poly(hat, [-8, -48, 8, -48, 4, -62, -1, -71, -5, -66, -3, -60], robe);
    poly(hat, [0, -48, 8, -48, 4, -62, -1, -71], shade(robe, 1.25), false);
    N(hat); hat.beginFill(trim); hat.drawRect(-8, -51, 16, 3); hat.endFill();
    hat.beginFill(0xfff2a8); hat.drawPolygon([-1, -59, 0, -62, 1, -59, 4, -58.5, 1, -57.5, 0, -54.5, -1, -57.5, -4, -58.5]); hat.endFill();
    rig.gear = hat;
    const arm = new PIXI.Container();
    const staff = new PIXI.Graphics();
    O(staff, 1.2); staff.beginFill(0x6b4526); staff.drawRoundedRect(-1.6, -50, 3.2, 54, 1.5); staff.endFill(); N(staff);
    poly(staff, [-4, -50, 0, -56, 4, -50, 0, -47], trim);
    const orb = new PIXI.Graphics();
    ell(orb, 0, -59, 5.2, 5.2, 0x7fe9ff);
    N(orb); orb.beginFill(0xffffff, 0.85); orb.drawCircle(-1.5, -60.5, 1.8); orb.endFill();
    const og = glow(13, 0x66ddff, 0.45); og.y = -59;
    const sleeve = new PIXI.Graphics();
    poly(sleeve, [-10, -28, -5, -28, 2, -22, 1, -16, -4, -16, -9, -22], robe);
    poly(sleeve, [-5, -28, 2, -22, 1, -17, -3, -20], shade(robe, 1.25), false);
    N(sleeve); sleeve.beginFill(trim); sleeve.drawPolygon([-4, -16.4, 1, -16.4, 1.6, -18.2, -3.6, -18.2]); sleeve.endFill();
    const hand = new PIXI.Graphics(); ell(hand, 0, -20, 3, 3, skin);
    arm.addChild(staff, og, orb, sleeve, hand);
    arm.x = 15;
    rig.weapon = arm; rig.orbGlow = og;
    rig.height = 70;
}

// ------------------------------------------------------------------ Brann
function brann(rig) {
    const steel = 0xb8c0cc, steelDk = 0x6a7280, tabard = 0xc8342a, gold = 0xe8b040, skin = 0xf0c8a0;
    rig.backLeg = leg(0x3a2a20, steelDk, 13);
    rig.frontLeg = leg(0x3a2a20, steel, 13);
    const cape = new PIXI.Graphics();
    poly(cape, [-5, -31, -14, -2, -10, 3, -1, -1, 3, -29], 0x7a1a1a);
    poly(cape, [-5, -31, -11, -10, -8, -9, -1, -29], 0x9a2a22, false);
    rig.cape = cape;
    const torso = new PIXI.Graphics();
    rrect(torso, -10, -30, 20, 18, 5, steel);                          // breastplate
    N(torso); torso.beginFill(shade(steel, 0.72)); torso.drawRoundedRect(-9.2, -18.5, 18.4, 5.6, 3); torso.drawPolygon([-9.2, -29, -4, -29, -5, -14, -9.2, -14]); torso.endFill();
    torso.beginFill(0xffffff, 0.38); torso.drawRoundedRect(1, -28, 6, 11, 3); torso.endFill();
    torso.lineStyle(1, steelDk, 0.9); torso.moveTo(0, -29); torso.lineTo(0, -14); N(torso);
    torso.beginFill(0xe8eef6); [[-7, -26], [7, -26], [-7, -17], [7, -17]].forEach(([x, y]) => torso.drawCircle(x, y, 0.8)); torso.endFill();
    poly(torso, [-9, -14, 10, -14, 11, 0, -10, 0], tabard);           // tabard skirt
    poly(torso, [1, -14, 10, -14, 11, 0, 1, 0], shade(tabard, 1.2), false);
    N(torso); torso.beginFill(gold); torso.drawRect(-10, -15.5, 21, 3); torso.endFill();
    torso.beginFill(0xffd070); torso.drawCircle(1, -14, 2); torso.endFill();
    // flame emblem
    torso.beginFill(0xffb040); torso.drawPolygon([1, -3, -2, -8, 0, -7, 1, -11, 3, -7, 4, -8]); torso.endFill();
    ell(torso, -10, -27, 6, 5, steel);                                  // pauldrons
    ell(torso, 10, -27, 6, 5, shade(steel, 1.12));
    rig.torso = torso;
    const head = new PIXI.Graphics();
    face(head, skin);
    // beard
    poly(head, [-5, -37, 8, -37, 6, -31, 1, -29, -3, -32], 0x8a4a22);
    rig.head = head;
    const helm = new PIXI.Graphics();
    poly(helm, [-9, -40, 9, -40, 10, -45, 6, -51, -1, -53, -8, -50, -10, -45], steel);
    poly(helm, [1, -53, 6, -51, 10, -45, 9, -40, 2, -40], shade(steel, 1.15), false);
    N(helm); helm.beginFill(steelDk); helm.drawRect(-9, -41.5, 19, 2.5); helm.endFill();
    // plume
    poly(helm, [-2, -52, -12, -58, -16, -52, -10, -50, -5, -50], 0xe8442a);
    poly(helm, [-2, -52, -9, -56, -12, -53, -6, -51], 0xff8a4a, false);
    rig.gear = helm;
    const arm = new PIXI.Container();
    const sword = new PIXI.Graphics();
    poly(sword, [-1.8, -18, 1.8, -18, 1.8, -50, 0, -55, -1.8, -50], 0xe8eef6);
    N(sword); sword.beginFill(0xffffff, 0.7); sword.drawRect(-0.4, -50, 0.9, 31); sword.endFill();
    rrect(sword, -6, -19, 12, 3, 1, gold);
    rrect(sword, -1.5, -16, 3, 7, 1, 0x5a3a20);
    const og = glow(8, 0xff8a3a, 0.28); og.y = -46;
    const gauntlet = new PIXI.Graphics();
    poly(gauntlet, [-9, -27, -4, -28, 2, -17, -2, -13, -7, -20], steel);
    poly(gauntlet, [-4, -28, 2, -17, 0, -15, -4, -22], shade(steel, 1.2), false);
    N(gauntlet); gauntlet.beginFill(gold); gauntlet.drawPolygon([-2.8, -15.6, 1.6, -18.6, 2.2, -17, -1.8, -13.8]); gauntlet.endFill();
    const hand = new PIXI.Graphics(); ell(hand, 0, -14, 3.2, 3.2, steelDk);
    arm.addChild(og, sword, gauntlet, hand);
    arm.x = 14; arm.rotation = 0.18;
    // round shield on the far arm
    const shield = new PIXI.Graphics();
    ell(shield, 0, 0, 8.4, 9.4, gold);
    ell(shield, 0, 0, 6.6, 7.6, 0x8a3a22, false);
    ell(shield, 0.8, -0.8, 4.8, 5.6, 0xc8542a, false);
    N(shield); shield.beginFill(0xffd070); shield.drawCircle(0, 0, 2.3); shield.endFill();
    shield.beginFill(0xffffff, 0.8); shield.drawCircle(-0.6, -0.7, 0.8); shield.endFill();
    shield.beginFill(shade(gold, 0.7)); [[0, -8.4], [7.4, 0], [0, 8.4], [-7.4, 0]].forEach(([x, y]) => shield.drawCircle(x, y, 0.9)); shield.endFill();
    shield.position.set(-11, -18);
    rig.offhand = shield;
    rig.weapon = arm; rig.orbGlow = og;
    rig.height = 62;
}

// ------------------------------------------------------------------- Cyra
function cyra(rig) {
    const cloak = 0x2f7a4a, cloakDk = 0x1d5232, leather = 0x8a5a32, skin = 0xf6d2b0, hair = 0xb8542a;
    rig.backLeg = leg(0x4a3020, 0x5a4030, 13);
    rig.frontLeg = leg(0x4a3020, 0x6a4a36, 13);
    const cape = new PIXI.Graphics();
    poly(cape, [-6, -40, -15, -6, -12, 2, -1, -2, 4, -36], cloakDk);
    poly(cape, [-6, -40, -12, -14, -9, -12, -1, -36], cloak, false);
    rig.cape = cape;
    const torso = new PIXI.Graphics();
    poly(torso, [-8, -29, 9, -29, 10, -6, 12, 1, -9, 1, -9, -6], leather);
    poly(torso, [-8, -29, -3, -29, -3, 1, -9, 1, -9, -6], shade(leather, 0.78), false);
    poly(torso, [2, -29, 9, -29, 10, -6, 12, 1, 2, 1], shade(leather, 1.18), false);
    torso.lineStyle(0.9, 0x3a2414, 0.9);
    for (let y = -27; y < -15; y += 3) { torso.moveTo(0.5, y); torso.lineTo(3.5, y + 1.5); torso.moveTo(3.5, y); torso.lineTo(0.5, y + 1.5); }
    N(torso);
    N(torso); torso.beginFill(0x5a3a20); torso.drawRect(-9, -13, 20, 3); torso.endFill();
    torso.beginFill(0xd8b060); torso.drawRect(0, -13, 3, 3); torso.endFill();
    // leaf sash
    torso.beginFill(0x6ac85a); torso.drawPolygon([-8, -27, -5, -29, 9, -12, 6, -10]); torso.endFill();
    ell(torso, -7, -8, 3.5, 4, 0x6a4a2a);                              // pouch
    rig.torso = torso;
    const head = new PIXI.Graphics();
    poly(head, [-7, -44, -10, -26, -6, -24, -3, -36], hair);          // braid behind
    face(head, skin);
    poly(head, [-8, -45, 7, -46, 8, -41, 3, -44, -2, -42, -8, -40], hair);
    rig.head = head;
    const hood = new PIXI.Graphics();
    poly(hood, [-11, -38, -9, -48, -2, -53, 6, -52, 10, -46, 10, -43, 4, -48, -3, -47, -8, -41, -8, -32], cloak);
    poly(hood, [6, -52, 10, -46, 10, -43, 5, -47], shade(cloak, 1.25), false);
    poly(hood, [-2, -53, -8, -58, -6, -51], cloak);                    // hood tip
    hood.lineStyle(1.2, cloakDk, 0.95); hood.moveTo(-8, -41); hood.lineTo(-3, -47); hood.lineTo(4, -48); hood.lineTo(10, -43); N(hood);
    N(hood); hood.beginFill(0x6ac85a); hood.drawPolygon([-9, -36, -7, -38, -5, -36, -7, -34]); hood.endFill();     // leaf clasp
    rig.gear = hood;
    const arm = new PIXI.Container();
    const staff = new PIXI.Graphics();
    O(staff, 1.2); staff.beginFill(0x7a5a32); staff.drawRoundedRect(-1.6, -46, 3.2, 50, 1.5); staff.endFill(); N(staff);
    // living branch head with leaves around a seed-light
    staff.lineStyle(2.4, 0x7a5a32); staff.moveTo(0, -46); staff.quadraticCurveTo(-6, -52, -3, -58); staff.moveTo(0, -46); staff.quadraticCurveTo(6, -52, 3, -58); N(staff);
    poly(staff, [-3, -58, -9, -60, -6, -55], 0x6ac85a);
    poly(staff, [3, -58, 9, -61, 6, -55], 0x4aa84a);
    poly(staff, [0, -47, -6, -45, -3, -50], 0x6ac85a);
    const orb = new PIXI.Graphics(); ell(orb, 0, -55, 3.6, 3.6, 0xc8ffa8);
    const og = glow(11, 0x7bff9a, 0.45); og.y = -55;
    const bracer = new PIXI.Graphics();
    poly(bracer, [-9, -27, -4, -28, 2, -20, -1, -15, -6, -20], leather);
    poly(bracer, [-3.2, -19.6, 1.4, -21.4, 2.2, -18, -1.6, -15.6], 0x5a3a20);
    N(bracer); bracer.beginFill(0xd8b060); bracer.drawCircle(0, -18.4, 0.8); bracer.endFill();
    const hand = new PIXI.Graphics(); ell(hand, 0, -18, 3, 3, skin);
    arm.addChild(staff, og, orb, bracer, hand);
    arm.x = 14;
    rig.weapon = arm; rig.orbGlow = og;
    rig.height = 64;
}

const BUILDERS = { aria, brann, cyra };

/** Builds the rig into `body` (cleared first). Returns parts used by the animator. */
export function buildHero(body: PIXI.Container, id: string) {
    body.removeChildren().forEach((c) => c.destroy({ children: true }));
    const rig: any = {};
    (BUILDERS[id] || aria)(rig);
    rig.backLeg.position.set(-4, -13);
    rig.frontLeg.position.set(4, -13);
    // draw order: back leg, cape, offhand, front leg, torso, head, gear, weapon
    const order = [rig.backLeg, rig.cape, rig.offhand, rig.frontLeg, rig.torso, rig.head, rig.gear, rig.weapon].filter(Boolean);
    order.forEach((p) => body.addChild(p));
    if (rig.cape) rig.cape.pivot.set(-2, -30), rig.cape.position.set(-2, -30);
    if (rig.weapon) rig.weaponX = rig.weapon.x, rig.weaponRot = rig.weapon.rotation;
    return rig;
}

/** Walk cycle, idle breathing, cape sway and weapon bob. */
export function animateHero(rig, phase: number, moving: boolean, t: number) {
    const s = Math.sin(phase);
    if (moving) {
        rig.backLeg.rotation = s * 0.55;
        rig.frontLeg.rotation = -s * 0.55;
        const up = Math.abs(Math.cos(phase)) * -1.6;
        rig.torso.y = rig.head.y = rig.gear.y = up;
        if (rig.cape) rig.cape.rotation = 0.12 + Math.sin(phase * 2) * 0.08;
        if (rig.weapon) { rig.weapon.y = up + Math.cos(phase) * 1.4; rig.weapon.rotation = rig.weaponRot + s * 0.06; }
        if (rig.offhand) rig.offhand.y = -18 + up - s * 1.2;
    } else {
        rig.backLeg.rotation *= 0.8;
        rig.frontLeg.rotation *= 0.8;
        const br = Math.sin(t * 0.05) * 0.7;
        rig.torso.y = 0; rig.head.y = rig.gear.y = br * 0.6;
        if (rig.cape) rig.cape.rotation = Math.sin(t * 0.04) * 0.04;
        if (rig.weapon) { rig.weapon.y = br; rig.weapon.rotation = rig.weaponRot + Math.sin(t * 0.03) * 0.03; }
        if (rig.offhand) rig.offhand.y = -18 + br * 0.5;
    }
}
