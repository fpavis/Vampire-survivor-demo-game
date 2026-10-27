// @ts-nocheck -- Pixi-bound renderer helper
// Art for the towers the player builds. Same conventions as decorArt: feet at (0, 0), baked once into textures.
import { DECOR_DEFS, shade } from './decorArt';

const INK = 0x1a1520;
const O = (g, w = 1.8) => g.lineStyle(w, INK, 0.9);
const N = (g) => g.lineStyle(0);
const poly = (g, pts, c) => { O(g); g.beginFill(c); g.drawPolygon(pts); g.endFill(); N(g); };
const rect = (g, x, y, w, h, c) => { O(g); g.beginFill(c); g.drawRect(x, y, w, h); g.endFill(); N(g); };
const rrect = (g, x, y, w, h, r, c) => { O(g); g.beginFill(c); g.drawRoundedRect(x, y, w, h, r); g.endFill(); N(g); };
const ell = (g, x, y, rx, ry, c, a = 1) => { O(g, 1.4); g.beginFill(c, a); g.drawEllipse(x, y, rx, ry); g.endFill(); N(g); };
const circ = (g, x, y, r, c, a = 1) => { g.beginFill(c, a); g.drawCircle(x, y, r); g.endFill(); };
const glow = (g, x, y, r, c, a) => { g.beginFill(c, a * 0.4); g.drawCircle(x, y, r); g.endFill(); g.beginFill(c, a); g.drawCircle(x, y, r * 0.55); g.endFill(); };
const shadow = (g, rx, ry) => { g.beginFill(0x000000, 0.34); g.drawEllipse(0, 2, rx, ry); g.endFill(); };

const STONE = 0xa8a49c;

// courses of stone block lines on a tapering shaft: x half-width at height h given base/top widths
function shaft(g, base, top, height, color, courses = 8) {
    const hw = (h) => base + (top - base) * (h / height);
    poly(g, [-base, 0, base, 0, top, -height, -top, -height], color);
    poly(g, [0, 0, base, 0, top, -height, 0, -height], shade(color, 1.16));        // lit right half
    g.beginFill(0x000000, 0.18); g.drawPolygon([-base, 0, -base * 0.45, 0, -top * 0.45, -height, -top, -height]); g.endFill();   // shaded left edge
    g.lineStyle(1, shade(color, 0.55), 0.7);
    for (let i = 1; i < courses; i++) { const h = (i / courses) * height, w = hw(h); g.moveTo(-w, -h); g.lineTo(w, -h); }
    for (let i = 1; i < courses; i += 1) {
        const h0 = ((i - 1) / courses) * height, h1 = (i / courses) * height;
        const off = (i % 2) * 7;
        for (let x = -hw(h1) + 8 + off; x < hw(h1) - 4; x += 14) { g.moveTo(x, -h0); g.lineTo(x, -h1); }
    }
    N(g);
}

function door(g, w, h, c = 0x3a2412) {
    O(g, 1.5); g.beginFill(c);
    g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + w / 2); g.arc(0, -h + w / 2, w / 2, Math.PI, 0); g.lineTo(w / 2, 0); g.closePath(); g.endFill(); N(g);
    g.beginFill(0xe8b040); g.drawCircle(w * 0.25, -h * 0.4, 1.8); g.endFill();
}
function slit(g, x, y, w = 5, h = 14, lit = 0xffd070) { rect(g, x - w / 2, y - h, w, h, 0x241c14); g.beginFill(lit, 0.85); g.drawRect(x - w / 2 + 1, y - h + 2, w - 2, h - 4); g.endFill(); }

// ---------------------------------------------------------------- Arcane spire
function spire(g) {
    shadow(g, 52, 14);
    shaft(g, 34, 20, 128, STONE, 9);
    rrect(g, -42, -14, 84, 16, 3, shade(STONE, 0.85));             // plinth
    door(g, 18, 30);
    slit(g, 0, -70); slit(g, -9, -100, 4, 11); slit(g, 9, -100, 4, 11);
    // balcony
    poly(g, [-30, -128, 30, -128, 26, -118, -26, -118], shade(STONE, 0.9));
    g.beginFill(0x000000, 0.2); g.drawRect(-28, -121, 56, 3); g.endFill();
    // crystal housing
    poly(g, [-14, -128, 14, -128, 9, -146, -9, -146], shade(STONE, 1.05));
    poly(g, [-12, -146, 12, -146, 0, -176], 0x5a9aff);
    poly(g, [0, -146, 12, -146, 0, -176], 0x9ad0ff);
    poly(g, [-12, -146, 0, -146, 0, -176], 0x3a6ad0);
    g.beginFill(0xffffff, 0.8); g.drawPolygon([-4, -152, -1, -152, -2, -168]); g.endFill();
    glow(g, 0, -158, 28, 0x7ab4ff, 0.35);
    // rune bands
    g.beginFill(0x7ab4ff, 0.8); g.drawRect(-24, -44, 48, 2.4); g.drawRect(-21, -86, 42, 2.4); g.endFill();
}

// ---------------------------------------------------------------- Warding obelisk
function ward(g) {
    shadow(g, 40, 11);
    rrect(g, -36, -14, 72, 16, 3, 0x4a4650);
    rrect(g, -28, -26, 56, 14, 3, 0x5a5662);
    poly(g, [-18, -26, 18, -26, 12, -142, -12, -142], 0x2a2832);
    poly(g, [0, -26, 18, -26, 12, -142, 0, -142], 0x3c3a48);
    poly(g, [-12, -142, 12, -142, 0, -170], 0x3c3a48);
    poly(g, [0, -142, 12, -142, 0, -170], 0x52506a);
    // gold bands and runes
    const gold = 0xf3c75a;
    g.beginFill(gold); g.drawRect(-17, -60, 34, 5); g.drawRect(-14, -104, 28, 5); g.endFill();
    g.lineStyle(2, gold, 0.95);
    for (let i = 0; i < 4; i++) { const y = -78 - i * 15; g.moveTo(-4, y); g.lineTo(0, y - 8); g.lineTo(4, y); }
    N(g);
    // crown
    poly(g, [-9, -170, 9, -170, 7, -178, 0, -190, -7, -178], gold);
    glow(g, 0, -182, 26, 0xffe27a, 0.4);
    // light motes
    for (const [x, y] of [[-26, -90], [26, -120], [-22, -150], [24, -60]]) glow(g, x, y, 5, 0xffe27a, 0.55);
}

// ---------------------------------------------------------------- Beacon
function beacon(g) {
    shadow(g, 46, 12);
    shaft(g, 30, 17, 104, 0xb4aca0, 7);
    rrect(g, -36, -12, 72, 14, 3, 0x8a8478);
    door(g, 16, 26);
    // red/white lighthouse bands
    g.beginFill(0xc8402a, 0.9); g.drawPolygon([-24.5, -48, 24.5, -48, 23, -60, -23, -60]); g.endFill();
    g.beginFill(0xc8402a, 0.9); g.drawPolygon([-20, -80, 20, -80, 19, -92, -19, -92]); g.endFill();
    // lantern room
    poly(g, [-24, -104, 24, -104, 20, -112, -20, -112], 0x3a342c);
    rect(g, -16, -134, 32, 22, 0xffe9a8);
    g.beginFill(0xffffff, 0.6); g.drawRect(-13, -131, 8, 16); g.endFill();
    g.lineStyle(2, INK, 0.9); g.moveTo(-5, -134); g.lineTo(-5, -112); g.moveTo(5, -134); g.lineTo(5, -112); N(g);
    poly(g, [-20, -134, 20, -134, 0, -156], 0x8a3a2a);
    circ(g, 0, -158, 3, 0xe8b040);
    // flame
    poly(g, [-7, -112, 7, -112, 4, -126, 0, -134, -4, -126], 0xff8a2a);
    poly(g, [-3.5, -112, 3.5, -112, 0, -128], 0xffe27a);
    glow(g, 0, -122, 34, 0xffb04a, 0.5);
}

// ---------------------------------------------------------------- Waypoint gate
function waypoint(g) {
    shadow(g, 52, 13);
    rrect(g, -50, -12, 100, 14, 3, 0x6a6672);
    // two pillars and a lintel
    poly(g, [-44, -12, -22, -12, -24, -112, -42, -112], 0x8a8694);
    poly(g, [-33, -12, -22, -12, -24, -112, -33, -112], 0xa8a4b4);
    poly(g, [22, -12, 44, -12, 42, -112, 24, -112], 0x8a8694);
    poly(g, [33, -12, 44, -12, 42, -112, 33, -112], 0xa8a4b4);
    poly(g, [-52, -112, 52, -112, 46, -128, -46, -128], 0x7a7684);
    g.beginFill(0xf3c75a); g.drawRect(-34, -124, 68, 3); g.endFill();
    // portal
    g.beginFill(0x2a1050, 0.9); g.drawRect(-22, -108, 44, 96); g.endFill();
    g.beginFill(0x7a3ad0, 0.7); g.drawEllipse(0, -60, 18, 44); g.endFill();
    g.beginFill(0xd8a0ff, 0.6); g.drawEllipse(0, -60, 10, 30); g.endFill();
    g.beginFill(0xffffff, 0.55); g.drawEllipse(0, -60, 4, 16); g.endFill();
    glow(g, 0, -60, 54, 0xb06af0, 0.28);
    for (const [x, y] of [[-38, -96], [38, -96]]) glow(g, x, y, 5, 0xd8a0ff, 0.7);
}

// ---------------------------------------------------------------- Expedition mine
function climb(g) {
    shadow(g, 52, 13);
    rrect(g, -40, -14, 80, 16, 3, 0x7a746a);
    // timber frame tower
    poly(g, [-28, -14, 28, -14, 20, -132, -20, -132], 0x8a6a42);
    poly(g, [0, -14, 28, -14, 20, -132, 0, -132], 0xa8845a);
    g.lineStyle(3, 0x4a3018, 0.95);
    g.moveTo(-28, -14); g.lineTo(20, -132); g.moveTo(28, -14); g.lineTo(-20, -132);
    for (const h of [-52, -92]) { g.moveTo(-28 + (h + 14) * -0.07, h); g.lineTo(28 + (h + 14) * 0.07, h); }
    N(g);
    // winch platform
    poly(g, [-34, -132, 34, -132, 30, -142, -30, -142], 0x5a4228);
    rect(g, -22, -164, 3, 22, 0x4a3018); rect(g, 19, -164, 3, 22, 0x4a3018);
    poly(g, [-26, -164, 26, -164, 0, -184], 0x9a4a32);
    // winch and rope down the mountain side
    circ(g, 0, -150, 7, 0xb8a888);
    g.lineStyle(2.6, 0xd8c8a0); g.moveTo(0, -150); g.lineTo(34, -64); g.lineTo(36, -14); N(g);
    for (let i = 0; i < 8; i++) { const t = i / 7; rect(g, 32 + t * 2, -64 + 50 * t - 2, 8, 3, 0x7a5a32); }
    // pickaxe emblem + flag
    g.lineStyle(3, 0xe8d8a0); g.moveTo(-10, -100); g.lineTo(10, -70); g.moveTo(-10, -70); g.lineTo(10, -100); N(g);
    rect(g, 0, -204, 2.5, 22, 0x4a3018);
    poly(g, [2, -204, 24, -198, 2, -190], 0xf3c75a);
    door(g, 16, 26);
}

// ---------------------------------------------------------------- Bridge tower (gatehouse beside the span)
function bridgeTower(g) {
    shadow(g, 54, 12);
    rrect(g, -46, -12, 92, 14, 3, 0x8a8478);
    poly(g, [-40, -12, -14, -12, -16, -92, -38, -92], 0xb0a898);
    poly(g, [-27, -12, -14, -12, -16, -92, -27, -92], 0xcac2b0);
    poly(g, [14, -12, 40, -12, 38, -92, 16, -92], 0xb0a898);
    poly(g, [27, -12, 40, -12, 38, -92, 27, -92], 0xcac2b0);
    // crenellations
    for (const x0 of [-42, 14]) for (let i = 0; i < 3; i++) rect(g, x0 + i * 9.5, -102, 6, 10, 0xb0a898);
    // arch + rope lanterns
    poly(g, [-18, -92, 18, -92, 18, -80, -18, -80], 0x8a8478);
    slit(g, -27, -52, 5, 16); slit(g, 27, -52, 5, 16);
    g.lineStyle(2, 0x6a4a28, 0.95); g.moveTo(-16, -80); g.quadraticCurveTo(0, -62, 16, -80); N(g);
    rect(g, -2.5, -70, 5, 9, 0xffd070);
    poly(g, [-40, -92, -26, -92, -33, -120], 0x3a6ab8);
    poly(g, [26, -92, 40, -92, 33, -120], 0x3a6ab8);
}

// ---------------------------------------------------------------- Dock post
function dock(g) {
    shadow(g, 44, 10);
    // shed
    poly(g, [-34, -4, 24, -4, 24, -42, -34, -42], 0x9a7a4a);
    poly(g, [-4, -4, 24, -4, 24, -42, -4, -42], 0xb8945c);
    g.lineStyle(1.2, 0x4a3018, 0.8); for (let x = -28; x < 22; x += 8) { g.moveTo(x, -4); g.lineTo(x, -42); } N(g);
    poly(g, [-40, -42, 30, -42, 12, -64, -22, -64], 0x4a6a8a);
    poly(g, [-4, -42, 30, -42, 12, -64, -4, -64], 0x5a7a9a);
    door(g, 14, 24, 0x3a2412);
    // lantern post
    rect(g, 33, -66, 4, 62, 0x5a3a20);
    O(g, 1.4); g.beginFill(0xffe9a8); g.drawRoundedRect(28, -82, 14, 16, 3); g.endFill(); N(g);
    glow(g, 35, -74, 26, 0xffc070, 0.45);
    // barrels, rope coil and a small anchor
    rrect(g, -52, -22, 14, 20, 4, 0x8a5a32); rrect(g, -48, -34, 12, 14, 4, 0x9a6a3a);
    ell(g, 40, -4, 10, 4, 0xc8b078);
    g.lineStyle(3, 0x3a3a44); g.moveTo(-22, -52); g.lineTo(-22, -34); g.moveTo(-28, -40); g.lineTo(-16, -40); g.arc(-22, -30, 6, Math.PI, 0, true); N(g);
}

// ---------------------------------------------------------------- Construction scaffolding (stages 0..3)
function scaffold(stage) {
    return (g) => {
        shadow(g, 50, 12);
        // a stone foundation always; timber frame and rising walls with progress
        rrect(g, -42, -10, 84, 12, 3, 0x8a8478);
        const h = [26, 62, 100, 138][stage];
        const wood = 0x9a7a4a, dark = 0x5a3a20;
        for (const x of [-34, 34]) rect(g, x - 2.5, -h, 5, h - 4, wood);
        if (stage >= 1) { rect(g, -36, -34, 72, 4, dark); }
        if (stage >= 2) {
            poly(g, [-30, -8, 30, -8, 24, -66, -24, -66], shade(STONE, 0.9));
            g.lineStyle(1, 0x5a5650, 0.7); for (let y = -22; y > -66; y -= 12) { g.moveTo(-28, y); g.lineTo(28, y); } N(g);
            rect(g, -36, -70, 72, 4, dark);
        }
        if (stage >= 3) {
            poly(g, [-26, -66, 26, -66, 20, -118, -20, -118], shade(STONE, 1.0));
            g.lineStyle(1, 0x5a5650, 0.7); for (let y = -80; y > -118; y -= 12) { g.moveTo(-24, y); g.lineTo(24, y); } N(g);
            rect(g, -36, -104, 72, 4, dark);
        }
        // crossbraces and a crane arm
        g.lineStyle(2.4, dark, 0.95);
        g.moveTo(-34, -8); g.lineTo(34, -Math.min(h, 60)); g.moveTo(34, -8); g.lineTo(-34, -Math.min(h, 60)); N(g);
        if (stage >= 1) { rect(g, -3, -h - 22, 4, 22, dark); g.lineStyle(2.2, 0x6a4a28); g.moveTo(-1, -h - 20); g.lineTo(34, -h - 2); N(g); rect(g, 30, -h + 2, 8, 6, 0x8a8478); }
        // planks, bricks and sacks piled around
        for (let i = 0; i < 3; i++) rect(g, -50, -4 - i * 5, 22, 4, 0xb8945c);
        rrect(g, 30, -14, 16, 12, 4, 0xc8b078); rrect(g, 38, -20, 14, 11, 4, 0xd8c088);
        // little pennant
        rect(g, -34, -h - 14, 2, 14, dark); poly(g, [-33, -h - 14, -16, -h - 9, -33, -h - 4], 0xe8b040);
    };
}

export const TOWER_DECOR = {
    tower_spire: { w: 120, h: 196, pad: 16, r: 30, solid: true, variants: [spire] },
    tower_ward: { w: 96, h: 196, pad: 14, r: 24, solid: true, variants: [ward] },
    tower_beacon: { w: 100, h: 168, pad: 14, r: 26, solid: true, variants: [beacon] },
    tower_waypoint: { w: 120, h: 134, pad: 14, r: 28, solid: true, variants: [waypoint] },
    tower_climb: { w: 120, h: 210, pad: 16, r: 30, solid: true, variants: [climb] },
    // the gatehouse spans the planks: its arch is walked through, so it holds nothing back
    tower_bridge: { w: 120, h: 130, pad: 14, r: 30, solid: false, variants: [bridgeTower] },
    tower_dock: { w: 120, h: 92, pad: 12, r: 26, solid: true, variants: [dock] },
    scaffold: { w: 120, h: 170, pad: 14, r: 30, solid: true, variants: [scaffold(0), scaffold(1), scaffold(2), scaffold(3)] }
};
Object.assign(DECOR_DEFS, TOWER_DECOR);

/** decor type used to draw a tower kind once built */
export const towerDecorType = (kind) => `tower_${kind}`;
