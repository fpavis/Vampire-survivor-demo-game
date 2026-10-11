// Procedural decoration art. Every sprite is drawn once with PIXI.Graphics and baked into a texture.
// Sprites are drawn with their "feet" at (0, 0) so they can be depth-sorted by y.

export const shade = (color, f) => {
    const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * f)));
    const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * f)));
    const b = Math.min(255, Math.max(0, Math.round((color & 255) * f)));
    return (r << 16) | (g << 8) | b;
};

function shadow(g, rx, ry, alpha = 0.32) {
    g.beginFill(0x000000, alpha);
    g.drawEllipse(0, 0, rx, ry);
    g.endFill();
}

// shaded sphere-ish blob: dark base, lit top-left
function blob(g, x, y, r, color) {
    g.beginFill(shade(color, 0.7)); g.drawCircle(x + r * 0.1, y + r * 0.15, r); g.endFill();
    g.beginFill(color); g.drawCircle(x, y, r * 0.92); g.endFill();
    g.beginFill(shade(color, 1.3), 0.7); g.drawCircle(x - r * 0.3, y - r * 0.32, r * 0.45); g.endFill();
}

function glow(g, x, y, r, color, a = 0.35) {
    g.beginFill(color, a); g.drawCircle(x, y, r); g.endFill();
}

// ------------------------------------------------------------------ FIELD
function drawTree(g, leaf, opts = {}) {
    shadow(g, 24, 8);
    g.beginFill(opts.trunk || 0x5b3a1e); g.drawRect(-4, -30, 8, 30); g.endFill();
    g.beginFill(shade(opts.trunk || 0x5b3a1e, 0.7)); g.drawRect(1, -30, 3, 30); g.endFill();
    [[0, -62, 27], [-15, -46, 20], [15, -46, 20], [0, -42, 22]].forEach(([x, y, r]) => blob(g, x, y, r * 0.95, leaf));
    if (opts.apples) {
        g.beginFill(0xd93a2a);
        [[-12, -52], [10, -58], [4, -42], [-4, -66], [16, -46]].forEach(([x, y]) => g.drawCircle(x, y, 3));
        g.endFill();
    }
}

function drawBirch(g, leaf) {
    shadow(g, 20, 7);
    g.beginFill(0xe8e4d8); g.drawRect(-3.5, -48, 7, 48); g.endFill();
    g.beginFill(0x2a2a2a);
    [-40, -30, -20, -10].forEach((y) => g.drawRect(-3.5, y, 4, 2));
    g.endFill();
    blob(g, 0, -62, 20, leaf); blob(g, -12, -52, 14, shade(leaf, 0.95)); blob(g, 12, -54, 15, shade(leaf, 1.05));
}

function drawFlowerbed(g, colors) {
    g.beginFill(0x3a7a2a, 0.9); g.drawEllipse(0, -2, 16, 6); g.endFill();
    colors.forEach((c, i) => {
        const x = -12 + i * 6, y = -4 - (i % 2) * 5;
        g.lineStyle(1.5, 0x2a6a22); g.moveTo(x, -1); g.lineTo(x, y);
        g.lineStyle(0);
        g.beginFill(c); g.drawCircle(x, y - 1, 3.2); g.endFill();
        g.beginFill(0xfff2a0); g.drawCircle(x, y - 1, 1.2); g.endFill();
    });
}

function drawHaystack(g) {
    shadow(g, 18, 6);
    g.beginFill(0xb8902c); g.drawPolygon([-17, 0, -14, -20, -6, -30, 6, -30, 14, -20, 17, 0]); g.endFill();
    g.beginFill(0xe2b94a); g.drawPolygon([-17, 0, -14, -20, -6, -30, 0, -30, 0, 0]); g.endFill();
    g.beginFill(0x8a6a1e, 0.8); g.drawRect(-16, -12, 32, 2.5); g.drawRect(-13, -22, 26, 2); g.endFill();
}

function drawTallGrass(g, color) {
    for (let i = -3; i <= 3; i++) {
        g.beginFill(shade(color, 0.8 + (i + 3) * 0.06));
        g.drawPolygon([i * 3 - 1.5, 0, i * 3 + 1.5, 0, i * 3 + i * 1.2, -12 - Math.abs(i % 3) * 3]);
        g.endFill();
    }
}

function drawScarecrow(g) {
    shadow(g, 14, 5);
    g.lineStyle(3, 0x6b4526); g.moveTo(0, 0); g.lineTo(0, -44); g.moveTo(-17, -32); g.lineTo(17, -32);
    g.lineStyle(0);
    g.beginFill(0xc9a24a); g.drawCircle(0, -42, 7); g.endFill();
    g.beginFill(0x7a4a2a); g.drawPolygon([-11, -45, 11, -45, 4, -58, -4, -58]); g.drawEllipse(0, -45, 12, 3); g.endFill();
    g.beginFill(0x222222); g.drawCircle(-2.5, -42, 1); g.drawCircle(2.5, -42, 1); g.endFill();
    g.beginFill(0x3a6fa0); g.drawPolygon([-8, -34, 8, -34, 6, -16, -6, -16]); g.endFill();
    g.beginFill(0xe2b94a); g.drawPolygon([-17, -32, -22, -26, -14, -28]); g.drawPolygon([17, -32, 22, -26, 14, -28]); g.endFill();
}

function drawWheat(g) {
    for (let i = -3; i <= 3; i++) {
        const x = i * 3.4;
        g.lineStyle(1.5, 0xb89a3a); g.moveTo(x, 0); g.lineTo(x + i * 0.8, -20);
        g.lineStyle(0);
        g.beginFill(0xe6c654); g.drawEllipse(x + i * 0.8, -22, 2, 5); g.endFill();
    }
}

// ----------------------------------------------------------------- FOREST
function drawPine(g, leaf, snow = false) {
    shadow(g, 20, 7);
    g.beginFill(0x4b321b); g.drawRect(-3, -14, 6, 14); g.endFill();
    for (let i = 0; i < 4; i++) {
        const y = -14 - i * 19, w = 26 - i * 5;
        g.beginFill(shade(leaf, 0.7 + i * 0.08)); g.drawPolygon([-w, y, w, y, 0, y - 32]); g.endFill();
        g.beginFill(shade(leaf, 1.25), 0.55); g.drawPolygon([-w, y, 0, y, 0, y - 32]); g.endFill();
        if (snow) {
            g.beginFill(0xffffff, 0.92);
            g.drawPolygon([-w * 0.62, y - 12, w * 0.62, y - 12, 0, y - 32]);
            g.drawPolygon([-w, y, -w * 0.3, y - 2, -w * 0.5, y - 7, -w * 0.8, y - 5]);
            g.endFill();
        }
    }
}

function drawMushroom(g, cap, dots) {
    shadow(g, 14, 5);
    g.beginFill(0xe8dfc8); g.drawRoundedRect(-5, -18, 10, 18, 4); g.endFill();
    g.beginFill(0xbfb396); g.drawRect(1, -18, 4, 18); g.endFill();
    g.beginFill(shade(cap, 0.7)); g.drawEllipse(0, -20, 18, 11); g.endFill();
    g.beginFill(cap); g.drawEllipse(-1, -22, 17, 10); g.endFill();
    g.beginFill(shade(cap, 1.3), 0.6); g.drawEllipse(-6, -26, 6, 3); g.endFill();
    if (dots) {
        g.beginFill(0xffffff, 0.95);
        [[-8, -22, 2.6], [5, -26, 2.2], [9, -20, 2], [-1, -17, 1.8]].forEach(([x, y, r]) => g.drawCircle(x, y, r));
        g.endFill();
    }
}

function drawLog(g) {
    shadow(g, 26, 7);
    g.beginFill(0x4e3320); g.drawRoundedRect(-24, -17, 48, 17, 6); g.endFill();
    g.beginFill(0x6e4a2c); g.drawRoundedRect(-24, -17, 48, 8, 5); g.endFill();
    g.beginFill(0xc89a62); g.drawEllipse(-24, -8.5, 5, 8.5); g.endFill();
    g.lineStyle(1, 0x8a6236); g.drawEllipse(-24, -8.5, 3, 5.5); g.lineStyle(0);
    g.beginFill(0x4a8a3a, 0.8); g.drawEllipse(8, -17, 10, 3); g.endFill();
}

function drawStump(g) {
    shadow(g, 14, 5);
    g.beginFill(0x4e3320); g.drawRoundedRect(-9, -14, 18, 14, 4); g.endFill();
    g.beginFill(0xc89a62); g.drawEllipse(0, -14, 9, 4); g.endFill();
    g.lineStyle(1, 0x8a6236); g.drawEllipse(0, -14, 5, 2); g.lineStyle(0);
}

function drawFern(g) {
    for (let i = -2; i <= 2; i++) {
        g.beginFill(shade(0x2e8a3c, 0.85 + Math.abs(i) * 0.08));
        g.drawPolygon([0, 0, i * 7 - 2, -10 - (2 - Math.abs(i)) * 4, i * 9, -6, i * 4, 0]);
        g.endFill();
    }
}

function drawGlowShroom(g) {
    glow(g, 0, -7, 15, 0x44ffd0, 0.2);
    [[-6, 0, 5], [4, 0, 6], [10, 0, 3.5]].forEach(([x, y, r]) => {
        g.beginFill(0xcffff0); g.drawRect(x - 1, y - r - 1, 2, r + 1); g.endFill();
        g.beginFill(0x35e0b8); g.drawEllipse(x, y - r - 2, r, r * 0.6); g.endFill();
        g.beginFill(0xffffff, 0.8); g.drawCircle(x - r * 0.3, y - r - 3, 1); g.endFill();
    });
}

function drawRock(g, base, mossy = false) {
    shadow(g, 20, 7);
    g.beginFill(shade(base, 0.62)); g.drawPolygon([-18, 0, -20, -12, -8, -24, 10, -22, 20, -10, 18, 0]); g.endFill();
    g.beginFill(base); g.drawPolygon([-20, -12, -8, -24, 10, -22, 2, -12]); g.endFill();
    g.beginFill(shade(base, 1.25), 0.8); g.drawPolygon([-8, -24, 10, -22, 4, -17, -9, -18]); g.endFill();
    if (mossy) { g.beginFill(0x4a8a3a, 0.85); g.drawEllipse(-4, -22, 9, 3); g.drawEllipse(12, -10, 4, 2); g.endFill(); }
}

function drawBush(g, leaf, berries = 0) {
    shadow(g, 16, 6, 0.25);
    blob(g, -9, -8, 9, leaf); blob(g, 9, -8, 9, leaf); blob(g, 0, -14, 11, leaf);
    if (berries) {
        g.beginFill(berries);
        [[-9, -9], [6, -12], [2, -6], [12, -8]].forEach(([x, y]) => g.drawCircle(x, y, 2));
        g.endFill();
    }
}

// ----------------------------------------------------------------- DESERT
function drawCactus(g, body = 0x3e8f4b) {
    shadow(g, 14, 5);
    g.beginFill(shade(body, 0.7)); g.drawRoundedRect(-6, -46, 12, 46, 6); g.endFill();
    g.beginFill(body); g.drawRoundedRect(-6, -46, 8, 46, 4); g.endFill();
    g.beginFill(shade(body, 0.8)); g.drawRoundedRect(-17, -32, 6, 18, 3); g.drawRect(-17, -18, 12, 5); g.endFill();
    g.beginFill(shade(body, 0.8)); g.drawRoundedRect(11, -38, 6, 20, 3); g.drawRect(5, -22, 12, 5); g.endFill();
    g.beginFill(0xff7ab8); g.drawCircle(0, -47, 2.5); g.endFill();
}

function drawBarrelCactus(g) {
    shadow(g, 13, 5);
    g.beginFill(0x2e7a3e); g.drawEllipse(0, -11, 11, 12); g.endFill();
    g.beginFill(0x4aa557); g.drawEllipse(-2, -12, 8, 11); g.endFill();
    g.lineStyle(1, 0x1f5a2c); [-5, 0, 5].forEach((x) => { g.moveTo(x, -2); g.lineTo(x * 0.6, -22); }); g.lineStyle(0);
    g.beginFill(0xffd84a); g.drawCircle(0, -23, 3); g.endFill();
}

function drawDeadTree(g, wood = 0x4a3826) {
    shadow(g, 16, 6, 0.28);
    g.lineStyle(5, wood); g.moveTo(0, 0); g.lineTo(0, -42);
    g.lineStyle(3, wood);
    g.moveTo(0, -24); g.lineTo(-14, -38); g.moveTo(0, -32); g.lineTo(13, -46); g.moveTo(-9, -32); g.lineTo(-12, -46);
    g.lineStyle(0);
}

function drawBones(g) {
    g.beginFill(0xeee6d0); g.drawEllipse(-6, -4, 6, 5); g.endFill();
    g.beginFill(0x2a2a2a); g.drawCircle(-8, -5, 1.4); g.drawCircle(-4, -5, 1.4); g.endFill();
    g.lineStyle(3, 0xeee6d0); g.moveTo(4, -2); g.lineTo(18, -6); g.moveTo(5, -7); g.lineTo(16, -1);
    g.lineStyle(2, 0xeee6d0); g.moveTo(8, -9); g.lineTo(8, -1); g.lineStyle(0);
}

function drawSandRock(g) {
    shadow(g, 22, 8);
    g.beginFill(0x9a6a3a); g.drawPolygon([-20, 0, -22, -16, -10, -28, 10, -26, 22, -12, 20, 0]); g.endFill();
    g.beginFill(0xc89a5a); g.drawPolygon([-22, -16, -10, -28, 10, -26, 0, -14]); g.endFill();
    g.beginFill(0x7a4e28, 0.7); g.drawRect(-16, -14, 30, 2); g.drawRect(-12, -8, 24, 2); g.endFill();
}

function drawSpire(g) {
    shadow(g, 22, 8);
    g.beginFill(0x8f5f33); g.drawPolygon([-16, 0, -12, -30, -8, -60, 6, -64, 12, -34, 16, 0]); g.endFill();
    g.beginFill(0xc8975a); g.drawPolygon([-12, -30, -8, -60, 6, -64, 0, -30, -2, 0, -16, 0]); g.endFill();
    g.beginFill(0x6a4020, 0.7); g.drawRect(-13, -22, 28, 3); g.drawRect(-11, -40, 22, 3); g.drawRect(-8, -52, 15, 2); g.endFill();
}

function drawDuneBush(g) {
    shadow(g, 12, 4, 0.2);
    g.lineStyle(2, 0x8a6a2a);
    [[-8, -12], [-3, -16], [3, -15], [8, -11], [0, -9]].forEach(([x, y]) => { g.moveTo(0, 0); g.lineTo(x, y); });
    g.lineStyle(0);
    g.beginFill(0x9a8a3a); [[-8, -12], [-3, -16], [3, -15], [8, -11]].forEach(([x, y]) => g.drawCircle(x, y, 2.5)); g.endFill();
}

// ------------------------------------------------------------------ SHORE
function drawPalm(g) {
    shadow(g, 18, 6);
    g.lineStyle(6, 0x8a6a3a); g.moveTo(0, 0); g.quadraticCurveTo(10, -30, 4, -58);
    g.lineStyle(2, 0x5a4220);
    [-14, -28, -42].forEach((y, i) => { g.moveTo(-3 + i, y); g.lineTo(5 + i, y); });
    g.lineStyle(0);
    const cx = 4, cy = -58;
    [[-26, 6], [-18, -8], [0, -14], [20, -8], [28, 6], [-10, 12], [14, 12]].forEach(([dx, dy]) => {
        g.beginFill(0x2e9a4a); g.drawPolygon([cx, cy, cx + dx * 0.55, cy + dy * 0.4 - 10, cx + dx, cy + dy, cx + dx * 0.5, cy + dy * 0.2 - 2]); g.endFill();
        g.beginFill(0x57c46a, 0.7); g.drawPolygon([cx, cy, cx + dx * 0.5, cy + dy * 0.3 - 8, cx + dx * 0.7, cy + dy * 0.7]); g.endFill();
    });
    g.beginFill(0x6a4020); g.drawCircle(cx - 2, cy + 3, 3); g.drawCircle(cx + 3, cy + 4, 3); g.endFill();
}

function drawShell(g) {
    g.beginFill(0xf4d8e0); g.drawPolygon([-7, 0, -6, -8, 0, -11, 6, -8, 7, 0]); g.endFill();
    g.lineStyle(1, 0xd8a8b8); [-4, 0, 4].forEach((x) => { g.moveTo(0, 0); g.lineTo(x * 1.2, -10); }); g.lineStyle(0);
    g.beginFill(0xffffff, 0.6); g.drawCircle(-12, -2, 3); g.endFill();
    g.beginFill(0xe8c6a6); g.drawEllipse(12, -2, 4, 3); g.endFill();
}

function drawDriftwood(g) {
    shadow(g, 20, 5, 0.25);
    g.lineStyle(5, 0xb8a888); g.moveTo(-18, -3); g.lineTo(16, -5);
    g.lineStyle(3, 0xa89878); g.moveTo(-4, -4); g.lineTo(2, -14); g.moveTo(8, -5); g.lineTo(16, -12);
    g.lineStyle(0);
}

function drawSeagrass(g) {
    for (let i = -3; i <= 3; i++) {
        g.beginFill(shade(0x8ab45a, 0.8 + (i + 3) * 0.05));
        g.drawPolygon([i * 3 - 1, 0, i * 3 + 1, 0, i * 3 + i * 1.5, -14 - (i % 2) * 4]);
        g.endFill();
    }
}

function drawSeaStack(g) {
    shadow(g, 26, 9, 0.28);
    g.beginFill(0x4a4a58); g.drawPolygon([-22, 0, -16, -26, -4, -44, 10, -38, 20, -16, 24, 0]); g.endFill();
    g.beginFill(0x7a7a8a); g.drawPolygon([-16, -26, -4, -44, 10, -38, 2, -20, -6, 0, -22, 0]); g.endFill();
    g.beginFill(0xffffff, 0.55); g.drawEllipse(0, -1, 26, 4); g.endFill();
}

// --------------------------------------------------------------- MOUNTAIN
function drawBoulder(g) {
    shadow(g, 30, 10);
    g.beginFill(0x4f535e); g.drawPolygon([-28, 0, -30, -18, -14, -40, 12, -42, 30, -20, 28, 0]); g.endFill();
    g.beginFill(0x8b909c); g.drawPolygon([-30, -18, -14, -40, 12, -42, 2, -22]); g.endFill();
    g.beginFill(0xb4bac6, 0.8); g.drawPolygon([-14, -40, 12, -42, 4, -33, -12, -34]); g.endFill();
}

function drawCrystal(g, color) {
    shadow(g, 16, 5);
    glow(g, 0, -14, 22, color, 0.18);
    [[-9, 0, 9, 22], [4, 0, 10, 32], [13, 0, 6, 16]].forEach(([x, y, w, h]) => {
        g.beginFill(shade(color, 0.6)); g.drawPolygon([x - w / 2, y, x - w / 2 + 1, y - h + 6, x + 1, y - h, x + w / 2, y - h + 6, x + w / 2, y]); g.endFill();
        g.beginFill(shade(color, 1.35), 0.9); g.drawPolygon([x - w / 2 + 1, y - h + 6, x + 1, y - h, x, y]); g.endFill();
    });
}

function drawIceRock(g) {
    shadow(g, 20, 7);
    g.beginFill(0x7aa0c0); g.drawPolygon([-18, 0, -20, -12, -8, -24, 10, -22, 20, -10, 18, 0]); g.endFill();
    g.beginFill(0xcfeaff); g.drawPolygon([-20, -12, -8, -24, 10, -22, 2, -12]); g.endFill();
    g.beginFill(0xffffff, 0.8); g.drawPolygon([-8, -24, 10, -22, 4, -17, -9, -18]); g.endFill();
}

function drawOre(g) {
    drawRock(g, 0x6a6a76);
    g.beginFill(0xffd84a);
    [[-6, -14, 2.4], [6, -10, 2], [0, -19, 2], [10, -16, 1.6]].forEach(([x, y, r]) => g.drawCircle(x, y, r));
    g.endFill();
}

// --------------------------------------------------------- POI LANDMARKS
function drawCaveMouth(g, rock) {
    shadow(g, 70, 16, 0.35);
    g.beginFill(shade(rock, 0.6)); g.drawPolygon([-68, 0, -72, -36, -54, -76, -20, -98, 22, -100, 56, -78, 72, -40, 68, 0]); g.endFill();
    g.beginFill(rock); g.drawPolygon([-72, -36, -54, -76, -20, -98, 22, -100, 0, -60, -40, -34]); g.endFill();
    g.beginFill(shade(rock, 1.25), 0.7); g.drawPolygon([-54, -76, -20, -98, 22, -100, 10, -88, -30, -82]); g.endFill();
    // dark mouth
    g.beginFill(0x07060a); g.drawPolygon([-30, 0, -32, -28, -18, -54, 0, -62, 18, -54, 32, -28, 30, 0]); g.endFill();
    g.beginFill(0x1a1410); g.drawPolygon([-24, 0, -25, -24, -12, -46, 0, -52, 12, -46, 25, -24, 24, 0]); g.endFill();
    g.beginFill(0xffb04a, 0.18); g.drawEllipse(0, -22, 18, 22); g.endFill();
    // jagged teeth
    g.beginFill(shade(rock, 0.8));
    g.drawPolygon([-18, -54, -14, -44, -10, -56]); g.drawPolygon([6, -60, 10, -48, 14, -58]); g.endFill();
}

function drawRuinArch(g) {
    shadow(g, 64, 14, 0.35);
    const stone = 0x8a8478, dark = 0x5e594f;
    // stairs down
    g.beginFill(0x15120e); g.drawRect(-26, -34, 52, 34); g.endFill();
    for (let i = 0; i < 4; i++) { g.beginFill(shade(stone, 0.6 - i * 0.1)); g.drawRect(-24 + i * 3, -4 - i * 7, 48 - i * 6, 5); g.endFill(); }
    // pillars
    [[-44, 70], [44, 54]].forEach(([x, h]) => {
        g.beginFill(dark); g.drawRect(x - 12, -h, 24, h); g.endFill();
        g.beginFill(stone); g.drawRect(x - 12, -h, 15, h); g.endFill();
        g.beginFill(shade(stone, 1.2)); g.drawRect(x - 15, -h - 5, 30, 7); g.drawRect(x - 15, -4, 30, 5); g.endFill();
        g.beginFill(0x4a8a3a, 0.8); g.drawEllipse(x + 4, -h * 0.5, 5, 10); g.endFill();
    });
    // broken lintel
    g.beginFill(dark); g.drawPolygon([-56, -72, -8, -80, -2, -64, -56, -62]); g.endFill();
    g.beginFill(stone); g.drawPolygon([-56, -72, -8, -80, -10, -74, -56, -68]); g.endFill();
    g.beginFill(0x4cc8ff, 0.5); g.drawCircle(0, -44, 5); g.endFill();
    glow(g, 0, -40, 20, 0x4cc8ff, 0.12);
}

function house(g, wall, roof, trim = 0x4a3826) {
    shadow(g, 52, 10, 0.3);
    g.beginFill(shade(wall, 0.75)); g.drawRect(-38, -58, 76, 58); g.endFill();
    g.beginFill(wall); g.drawRect(-38, -58, 50, 58); g.endFill();
    g.beginFill(shade(roof, 0.7)); g.drawPolygon([-46, -56, -30, -92, 30, -92, 46, -56]); g.endFill();
    g.beginFill(roof); g.drawPolygon([-46, -56, -30, -92, 0, -92, 0, -56]); g.endFill();
    g.beginFill(shade(roof, 1.25), 0.6); g.drawRect(-30, -90, 60, 3); g.endFill();
    g.beginFill(trim); g.drawRoundedRect(-9, -34, 18, 34, 4); g.endFill();
    g.beginFill(0xffd070); g.drawCircle(5, -17, 1.4); g.endFill();
    [[-27, -42], [20, -42]].forEach(([x, y]) => {
        g.beginFill(trim); g.drawRect(x - 1, y - 1, 14, 16); g.endFill();
        g.beginFill(0x9ad4ff); g.drawRect(x + 1, y + 1, 10, 12); g.endFill();
        g.beginFill(0xffffff, 0.4); g.drawRect(x + 1, y + 1, 4, 12); g.endFill();
    });
}

function drawTower(g, wall, roof) {
    shadow(g, 30, 8, 0.3);
    g.beginFill(shade(wall, 0.72)); g.drawRect(-20, -86, 40, 86); g.endFill();
    g.beginFill(wall); g.drawRect(-20, -86, 26, 86); g.endFill();
    g.beginFill(shade(roof, 0.7)); g.drawPolygon([-26, -84, 0, -128, 26, -84]); g.endFill();
    g.beginFill(roof); g.drawPolygon([-26, -84, 0, -128, 0, -84]); g.endFill();
    g.beginFill(0x15120e); g.drawRoundedRect(-5, -52, 10, 18, 5); g.endFill();
    g.beginFill(0x15120e); g.drawRect(-3, -76, 6, 12); g.endFill();
}

function drawGate(g, wall, roof) {
    shadow(g, 80, 12, 0.35);
    [-52, 52].forEach((x) => {
        g.beginFill(shade(wall, 0.72)); g.drawRect(x - 20, -96, 40, 96); g.endFill();
        g.beginFill(wall); g.drawRect(x - 20, -96, 26, 96); g.endFill();
        g.beginFill(shade(roof, 0.7)); g.drawPolygon([x - 26, -94, x, -132, x + 26, -94]); g.endFill();
        g.beginFill(roof); g.drawPolygon([x - 26, -94, x, -132, x, -94]); g.endFill();
    });
    g.beginFill(shade(wall, 0.85)); g.drawRect(-32, -86, 64, 22); g.endFill();
    g.beginFill(0x15120e); g.drawPolygon([-32, 0, -32, -44, -20, -60, 20, -60, 32, -44, 32, 0]); g.endFill();
    g.beginFill(0xffd070, 0.25); g.drawEllipse(0, -26, 22, 28); g.endFill();
    g.beginFill(0xc83a3a); g.drawPolygon([-6, -86, 6, -86, 6, -70, 0, -76, -6, -70]); g.endFill();
}

// ---------------------------------------------------------- INTERIOR PROPS
function drawTorch(g) {
    g.beginFill(0x4a3220); g.drawRect(-2, -26, 4, 26); g.endFill();
    g.beginFill(0x6a6a72); g.drawRect(-5, -30, 10, 6); g.endFill();
    glow(g, 0, -38, 26, 0xff9a3a, 0.14);
    glow(g, 0, -36, 13, 0xffb040, 0.3);
    g.beginFill(0xff6a1a); g.drawPolygon([-5, -30, 0, -48, 5, -30]); g.endFill();
    g.beginFill(0xffe08a); g.drawPolygon([-2.5, -30, 0, -41, 2.5, -30]); g.endFill();
}

function drawPillar(g, stone) {
    shadow(g, 20, 6, 0.3);
    g.beginFill(shade(stone, 0.7)); g.drawRect(-11, -62, 22, 62); g.endFill();
    g.beginFill(stone); g.drawRect(-11, -62, 14, 62); g.endFill();
    g.beginFill(shade(stone, 1.2)); g.drawRect(-14, -68, 28, 8); g.drawRect(-14, -5, 28, 5); g.endFill();
    g.beginFill(0x000000, 0.2); g.drawRect(-6, -56, 2, 48); g.drawRect(2, -50, 2, 40); g.endFill();
}

function drawCrate(g) {
    shadow(g, 18, 6, 0.3);
    g.beginFill(0x6a4a2a); g.drawRect(-14, -24, 28, 24); g.endFill();
    g.beginFill(0x9a6e3c); g.drawRect(-14, -24, 28, 11); g.endFill();
    g.lineStyle(2, 0x4a3220); g.drawRect(-13, -23, 26, 22); g.moveTo(-13, -23); g.lineTo(13, -1); g.moveTo(13, -23); g.lineTo(-13, -1);
    g.lineStyle(0);
}

function drawBarrel(g) {
    shadow(g, 14, 5, 0.3);
    g.beginFill(0x6a4020); g.drawRoundedRect(-11, -26, 22, 26, 7); g.endFill();
    g.beginFill(0x9a6636); g.drawRoundedRect(-11, -26, 13, 26, 6); g.endFill();
    g.beginFill(0x4a4a52); g.drawRect(-11, -20, 22, 3); g.drawRect(-11, -8, 22, 3); g.endFill();
}

function drawStalagmite(g) {
    shadow(g, 14, 5, 0.3);
    g.beginFill(0x3a342c); g.drawPolygon([-12, 0, -4, -34, 0, -44, 6, -30, 12, 0]); g.endFill();
    g.beginFill(0x6a5e4c); g.drawPolygon([-12, 0, -4, -34, 0, -44, 0, 0]); g.endFill();
}

function drawChest(g, open) {
    shadow(g, 22, 7, 0.35);
    g.beginFill(0x5a3418); g.drawRoundedRect(-18, -20, 36, 20, 3); g.endFill();
    g.beginFill(0x8a5428); g.drawRect(-18, -20, 36, 9); g.endFill();
    g.beginFill(0xe8b83a); g.drawRect(-18, -12, 36, 3); g.drawRect(-3, -14, 6, 8); g.endFill();
    if (open) {
        g.beginFill(0x3a200e); g.drawPolygon([-18, -20, -14, -36, 14, -36, 18, -20]); g.endFill();
        g.beginFill(0xffe08a, 0.9); g.drawEllipse(0, -22, 14, 4); g.endFill();
        glow(g, 0, -26, 24, 0xffd84a, 0.28);
    } else {
        g.beginFill(0x7a4a22); g.drawPolygon([-18, -20, -15, -30, 15, -30, 18, -20]); g.endFill();
        g.beginFill(0xe8b83a); g.drawRect(-18, -22, 36, 3); g.endFill();
        g.beginFill(0xffe08a); g.drawRect(-2.5, -24, 5, 7); g.endFill();
        glow(g, 0, -20, 26, 0xffd84a, 0.12);
    }
}

function drawFountain(g) {
    shadow(g, 44, 13, 0.3);
    g.beginFill(0x7a7a84); g.drawEllipse(0, -8, 42, 15); g.endFill();
    g.beginFill(0xa8a8b4); g.drawEllipse(0, -14, 42, 14); g.endFill();
    g.beginFill(0x3a8fc8); g.drawEllipse(0, -15, 35, 10); g.endFill();
    g.beginFill(0x8ad0ff, 0.6); g.drawEllipse(-6, -17, 18, 4); g.endFill();
    g.beginFill(0x8a8a96); g.drawRect(-5, -44, 10, 32); g.endFill();
    g.beginFill(0xa8a8b4); g.drawEllipse(0, -44, 14, 5); g.endFill();
    g.beginFill(0x9adfff, 0.9); g.drawEllipse(0, -50, 5, 8); g.endFill();
    g.lineStyle(2, 0x9adfff, 0.8); g.moveTo(0, -52); g.quadraticCurveTo(-18, -54, -22, -30); g.moveTo(0, -52); g.quadraticCurveTo(18, -54, 22, -30); g.lineStyle(0);
}

function drawAltar(g) {
    shadow(g, 32, 9, 0.3);
    g.beginFill(0x5a5a66); g.drawRect(-28, -14, 56, 14); g.endFill();
    g.beginFill(0x7a7a88); g.drawRect(-24, -34, 48, 22); g.endFill();
    g.beginFill(0x9a9aaa); g.drawRect(-28, -38, 56, 6); g.endFill();
    glow(g, 0, -52, 22, 0xb8a0ff, 0.25);
    g.beginFill(0xe0d0ff); g.drawPolygon([0, -68, 8, -52, 0, -38, -8, -52]); g.endFill();
    g.beginFill(0xffffff, 0.7); g.drawPolygon([0, -68, 0, -38, -8, -52]); g.endFill();
}

function drawStall(g, awning) {
    shadow(g, 40, 9, 0.3);
    g.beginFill(0x6a4a2a); g.drawRect(-30, -22, 60, 22); g.endFill();
    g.beginFill(0x9a6e3c); g.drawRect(-30, -22, 60, 8); g.endFill();
    g.beginFill(0x5a3a1e); g.drawRect(-30, -62, 4, 42); g.drawRect(26, -62, 4, 42); g.endFill();
    for (let i = 0; i < 6; i++) {
        g.beginFill(i % 2 ? awning : 0xf4f0e0); g.drawPolygon([-36 + i * 12, -56, -24 + i * 12, -56, -22 + i * 12, -46, -38 + i * 12, -46]); g.endFill();
    }
    g.beginFill(0xd8503a); g.drawCircle(-14, -26, 4); g.drawCircle(-6, -26, 4); g.endFill();
    g.beginFill(0xe8c63a); g.drawCircle(6, -26, 4); g.drawCircle(14, -26, 4); g.endFill();
}

function drawLamp(g) {
    g.beginFill(0x2a2a32); g.drawRect(-2, -54, 4, 54); g.endFill();
    g.beginFill(0x2a2a32); g.drawRect(-6, -2, 12, 3); g.endFill();
    glow(g, 0, -58, 30, 0xffd070, 0.14);
    g.beginFill(0xffe08a); g.drawRoundedRect(-6, -66, 12, 14, 3); g.endFill();
    g.beginFill(0x2a2a32); g.drawPolygon([-8, -66, 8, -66, 0, -72]); g.endFill();
}

function drawBanner(g, color) {
    g.beginFill(0x5a3a1e); g.drawRect(-2, -64, 4, 64); g.endFill();
    g.beginFill(0x5a3a1e); g.drawRect(-14, -64, 28, 3); g.endFill();
    g.beginFill(color); g.drawPolygon([-12, -61, 12, -61, 12, -26, 0, -34, -12, -26]); g.endFill();
    g.beginFill(0xf1c24a); g.drawCircle(0, -48, 4); g.endFill();
}

function drawPlanter(g) {
    shadow(g, 16, 5, 0.25);
    g.beginFill(0x7a4a2a); g.drawPolygon([-12, -14, 12, -14, 9, 0, -9, 0]); g.endFill();
    blob(g, -5, -20, 7, 0x4aa04a); blob(g, 5, -22, 8, 0x5ab04a);
    g.beginFill(0xff7ab8); g.drawCircle(-6, -24, 2); g.endFill();
    g.beginFill(0xffe14d); g.drawCircle(6, -27, 2); g.endFill();
}

function drawWell(g) {
    shadow(g, 24, 7, 0.3);
    g.beginFill(0x6a6a74); g.drawEllipse(0, -10, 20, 8); g.endFill();
    g.beginFill(0x8a8a96); g.drawRect(-20, -18, 40, 10); g.drawEllipse(0, -18, 20, 7); g.endFill();
    g.beginFill(0x0a1a2a); g.drawEllipse(0, -18, 15, 5); g.endFill();
    g.beginFill(0x5a3a1e); g.drawRect(-20, -48, 4, 30); g.drawRect(16, -48, 4, 30); g.drawRect(-22, -50, 44, 4); g.endFill();
}

function drawPortal(g) {
    shadow(g, 34, 9, 0.3);
    g.beginFill(0x4a4a56); g.drawRect(-30, -70, 12, 70); g.drawRect(18, -70, 12, 70); g.drawRect(-30, -78, 60, 12); g.endFill();
    g.beginFill(0x7a7a8a); g.drawRect(-30, -70, 7, 70); g.drawRect(18, -70, 7, 70); g.endFill();
    g.beginFill(0x4cc8ff, 0.35); g.drawRect(-18, -66, 36, 66); g.endFill();
    g.beginFill(0xb8ecff, 0.35); g.drawEllipse(0, -34, 12, 28); g.endFill();
    glow(g, 0, -34, 36, 0x4cc8ff, 0.12);
}

// ---------------------------------------------------------------- REGISTRY
const D = (w, h, pad, r, solid, variants) => ({ w, h, pad, r, solid, variants });
const flowerSets = [[0xff5a7a, 0xffe14d, 0xffffff, 0xff9ad0, 0xb48aff], [0xffffff, 0xffe14d, 0xffffff, 0xffe14d, 0xff9ad0], [0xb48aff, 0x7ab4ff, 0xffffff, 0xb48aff, 0x7ab4ff]];

export const DECOR_DEFS = {
    // field
    appletree: D(84, 100, 14, 13, true, [(g) => drawTree(g, 0x58b04a, { apples: true }), (g) => drawTree(g, 0x4a9a3e, { apples: true })]),
    birch: D(64, 96, 12, 8, true, [(g) => drawBirch(g, 0x9acb55), (g) => drawBirch(g, 0xc8d65a)]),
    flowerbed: D(44, 24, 8, 0, false, flowerSets.map((c) => (g) => drawFlowerbed(g, c))),
    haystack: D(48, 40, 10, 12, true, [drawHaystack]),
    tallgrass: D(40, 26, 6, 0, false, [(g) => drawTallGrass(g, 0x6ab84a), (g) => drawTallGrass(g, 0x8ac84a)]),
    scarecrow: D(60, 70, 10, 7, true, [drawScarecrow]),
    wheat: D(44, 34, 6, 0, false, [drawWheat]),
    // forest
    oak: D(84, 100, 14, 13, true, [(g) => drawTree(g, 0x2e7a3a, { trunk: 0x4a3018 }), (g) => drawTree(g, 0x1f6a34, { trunk: 0x4a3018 }), (g) => drawTree(g, 0x3a8a3a, { trunk: 0x4a3018 })]),
    pine: D(64, 106, 12, 11, true, [(g) => drawPine(g, 0x2a6d47), (g) => drawPine(g, 0x36805a)]),
    bigmushroom: D(48, 44, 10, 9, true, [(g) => drawMushroom(g, 0xd23a3a, true), (g) => drawMushroom(g, 0x9a5a2a, false), (g) => drawMushroom(g, 0x8a4ac8, true)]),
    log: D(64, 30, 10, 14, true, [drawLog]),
    stump: D(36, 26, 8, 8, true, [drawStump]),
    fern: D(40, 26, 6, 0, false, [drawFern]),
    glowshroom: D(44, 34, 8, 0, false, [drawGlowShroom]),
    mossrock: D(52, 34, 12, 15, true, [(g) => drawRock(g, 0x7a8a7a, true), (g) => drawRock(g, 0x6a7a6a, true)]),
    // shared
    rock: D(52, 34, 12, 15, true, [(g) => drawRock(g, 0x8b8f99), (g) => drawRock(g, 0x9a8f80), (g) => drawRock(g, 0x7a8592)]),
    bush: D(44, 34, 10, 0, false, [(g) => drawBush(g, 0x4aa04a), (g) => drawBush(g, 0x6a9a3a), (g) => drawBush(g, 0x3a8a44, 0xd23a5a)]),
    // desert
    cactus: D(48, 60, 10, 9, true, [drawCactus, (g) => drawCactus(g, 0x4a9a3e)]),
    barrelcactus: D(36, 36, 8, 8, true, [drawBarrelCactus]),
    dead: D(48, 60, 10, 8, true, [drawDeadTree, (g) => drawDeadTree(g, 0x6a5a48)]),
    bones: D(44, 22, 6, 0, false, [drawBones]),
    sandrock: D(56, 40, 12, 17, true, [drawSandRock]),
    spire: D(48, 76, 12, 13, true, [drawSpire]),
    dunebush: D(36, 24, 6, 0, false, [drawDuneBush]),
    // shore
    palm: D(80, 90, 12, 7, true, [drawPalm]),
    shell: D(40, 18, 6, 0, false, [drawShell]),
    driftwood: D(48, 24, 6, 0, false, [drawDriftwood]),
    seagrass: D(40, 26, 6, 0, false, [drawSeagrass]),
    beachrock: D(52, 34, 12, 15, true, [(g) => drawRock(g, 0xa8a0a0), (g) => drawRock(g, 0x8a8a98)]),
    seastack: D(64, 62, 12, 20, true, [drawSeaStack]),
    // mountain
    snowpine: D(64, 106, 12, 11, true, [(g) => drawPine(g, 0x2a5a4a, true), (g) => drawPine(g, 0x3a6a58, true)]),
    boulder: D(72, 56, 12, 25, true, [drawBoulder]),
    crystal: D(48, 46, 10, 11, true, [(g) => drawCrystal(g, 0x5ad0ff), (g) => drawCrystal(g, 0xc07aff), (g) => drawCrystal(g, 0xff7ab0)]),
    icerock: D(52, 34, 12, 15, true, [drawIceRock]),
    ore: D(52, 34, 12, 15, true, [drawOre]),
    // landmarks
    cavemouth: D(160, 112, 18, 40, true, [(g) => drawCaveMouth(g, 0x6a6a76), (g) => drawCaveMouth(g, 0x9a7a4a), (g) => drawCaveMouth(g, 0x8a98a8)]),
    ruinarch: D(140, 96, 16, 46, true, [drawRuinArch]),
    house: D(116, 104, 14, 40, true, [
        (g) => house(g, 0xe2cfa6, 0xb5473b), (g) => house(g, 0xd8d0c0, 0x3f6fa8), (g) => house(g, 0xe8c88a, 0x9a5a2a),
        (g) => house(g, 0xdfd6bc, 0x3f8f7a), (g) => house(g, 0xd9b890, 0xc88a3a)]),
    tower: D(70, 140, 12, 22, true, [(g) => drawTower(g, 0xb8b0a0, 0x8a3a3a), (g) => drawTower(g, 0xc8a878, 0x4a6a9a)]),
    gate: D(190, 150, 16, 26, true, [(g) => drawGate(g, 0xb8b0a0, 0x8a3a3a), (g) => drawGate(g, 0xd8b888, 0x4a6a9a), (g) => drawGate(g, 0xe8e4d8, 0x3f6fa8)]),
    // interior props
    torch: D(30, 58, 8, 0, false, [drawTorch]),
    pillar: D(36, 76, 8, 11, true, [(g) => drawPillar(g, 0x8a8478), (g) => drawPillar(g, 0x9a9aa4)]),
    crate: D(40, 30, 8, 14, true, [drawCrate]),
    barrel: D(32, 32, 8, 11, true, [drawBarrel]),
    stalagmite: D(32, 50, 8, 10, true, [drawStalagmite]),
    chest: D(52, 46, 10, 0, false, [(g) => drawChest(g, false), (g) => drawChest(g, true)]),
    fountain: D(100, 70, 16, 38, true, [drawFountain]),
    altar: D(70, 80, 12, 28, true, [drawAltar]),
    stall: D(88, 70, 12, 32, true, [(g) => drawStall(g, 0xc83a3a), (g) => drawStall(g, 0x3a6fc8), (g) => drawStall(g, 0x3aa86a)]),
    lamp: D(30, 78, 8, 0, false, [drawLamp]),
    banner: D(36, 70, 8, 0, false, [(g) => drawBanner(g, 0xc83a3a), (g) => drawBanner(g, 0x3a6fc8)]),
    planter: D(36, 40, 8, 10, true, [drawPlanter]),
    well: D(56, 60, 10, 22, true, [drawWell]),
    portal: D(72, 90, 12, 0, false, [drawPortal])
};

export function bakeDecorTextures(app) {
    const out = {};
    for (const [type, def] of Object.entries(DECOR_DEFS)) {
        out[type] = def.variants.map((draw) => {
            const g = new PIXI.Graphics();
            draw(g);
            const holder = new PIXI.Container();
            holder.addChild(g);
            const region = new PIXI.Rectangle(-def.w / 2, -def.h, def.w, def.h + def.pad);
            const texture = app.renderer.generateTexture(holder, {
                region, resolution: 2, multisample: PIXI.MSAA_QUALITY.HIGH
            });
            holder.destroy({ children: true });
            return { texture, anchorY: def.h / (def.h + def.pad) };
        });
    }
    return out;
}
