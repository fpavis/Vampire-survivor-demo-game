// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
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

// ink outlines and three-tone shading, lit from the top left, to match the heroes and monsters
export const INK = 0x1d1712;
const ink = (g, w = 1.6, a = 0.92) => g.lineStyle(w, INK, a);
const noLine = (g) => g.lineStyle(0);
/** filled polygon with an ink outline */
export function opoly(g, pts, color, w = 1.6) { ink(g, w); g.beginFill(color); g.drawPolygon(pts); g.endFill(); noLine(g); }
export function fpoly(g, pts, color, a = 1) { g.beginFill(color, a); g.drawPolygon(pts); g.endFill(); }
/** a stroke with an ink edge: drawn twice, wide ink under the colour */
export function ostroke(g, w, color, path) {
    g.lineStyle({ width: w + 2.6, color: INK, alpha: 0.92, cap: 'round', join: 'round' }); path();
    g.lineStyle({ width: w, color, alpha: 1, cap: 'round', join: 'round' }); path();
    noLine(g);
}
/** small deterministic random numbers, so baked variants never change between runs */
export function rng(seed) {
    let x = (seed * 2654435761) % 2147483647 || 1;
    return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

/**
 * Leafy canopy from overlapping clusters: one ink outline around the whole crown, then each cluster from the back
 * to the front in three tones with a dark lower rim, leaf flecks and a rim light on the top clusters.
 */
export function canopy(g, circles, leaf, seed = 1, opts = {}) {
    const R = rng(seed);
    const w = opts.ink ?? 1.8;
    g.beginFill(INK, 0.92); circles.forEach(([x, y, r]) => g.drawCircle(x, y, r + w)); g.endFill();
    const top = Math.min(...circles.map(([, y, r]) => y - r));
    const sorted = [...circles].sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of sorted) {
        g.beginFill(shade(leaf, 0.58)); g.drawCircle(x, y, r); g.endFill();
        g.beginFill(shade(leaf, 0.82)); g.drawCircle(x - r * 0.08, y - r * 0.1, r * 0.9); g.endFill();
        g.beginFill(leaf); g.drawCircle(x - r * 0.18, y - r * 0.22, r * 0.72); g.endFill();
        g.beginFill(shade(leaf, 1.2)); g.drawCircle(x - r * 0.32, y - r * 0.38, r * 0.4); g.endFill();
        g.lineStyle(1.2, shade(leaf, 0.42), 0.75); g.arc(x, y, r * 0.96, Math.PI * 0.12, Math.PI * 0.88); noLine(g);
        // leaf flecks: light ticks up-left, dark ticks down-right
        for (let i = 0; i < 4; i++) {
            const a = Math.PI * (1.05 + R() * 0.6), d = r * (0.35 + R() * 0.45);
            g.beginFill(shade(leaf, 1.38), 0.9); g.drawEllipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.8, 1.1); g.endFill();
            const b = Math.PI * (0.1 + R() * 0.6), e = r * (0.4 + R() * 0.45);
            g.beginFill(shade(leaf, 0.45), 0.8); g.drawEllipse(x + Math.cos(b) * e, y + Math.sin(b) * e, 1.6, 1); g.endFill();
        }
        if (y - r < top + 8) { g.lineStyle(1.4, shade(leaf, 1.55), 0.8); g.arc(x, y, r * 0.86, Math.PI * 1.12, Math.PI * 1.48); noLine(g); }
    }
}

/** tapered trunk with flared roots, a shaded side, bark marks and the first branches under the crown */
function trunk(g, h, w, color, branches = true) {
    if (branches) {
        ostroke(g, 2.6, shade(color, 0.9), () => { g.moveTo(0, -h + 6); g.lineTo(-w * 2.2, -h - 8); });
        ostroke(g, 2.4, shade(color, 0.9), () => { g.moveTo(w * 0.2, -h + 4); g.lineTo(w * 2.4, -h - 10); });
    }
    opoly(g, [-w * 1.9, 0, -w, -5, -w * 0.72, -h, w * 0.72, -h, w, -5, w * 1.9, 0, w * 0.5, -1.5, 0, 0.5, -w * 0.6, -1.5], color);
    fpoly(g, [w * 0.12, -h, w * 0.7, -h, w * 0.98, -5, w * 1.8, -0.4, w * 0.5, -1.6, w * 0.2, -5], shade(color, 0.68));
    fpoly(g, [-w * 0.6, -h, -w * 0.32, -h, -w * 0.45, -7, -w * 0.8, -6], shade(color, 1.3), 0.7);
    g.lineStyle(1, shade(color, 0.5), 0.8);
    g.moveTo(-w * 0.1, -h * 0.75); g.lineTo(-w * 0.2, -h * 0.55);
    g.moveTo(w * 0.35, -h * 0.45); g.lineTo(w * 0.3, -h * 0.25);
    g.moveTo(-w * 0.35, -h * 0.3); g.lineTo(-w * 0.3, -h * 0.15);
    noLine(g);
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
const OAK = [[0, -80, 17], [-16, -72, 15], [16, -72, 15], [-24, -58, 13], [24, -58, 13], [-9, -61, 17], [10, -60, 17], [0, -47, 15], [-17, -46, 11], [17, -46, 11]];
const APPLE = [[0, -78, 18], [-17, -68, 15], [17, -68, 15], [-22, -53, 13], [22, -53, 13], [-6, -58, 18], [9, -56, 17], [0, -45, 14]];

function drawTree(g, leaf, opts = {}) {
    shadow(g, 26, 8);
    const R = rng(opts.seed || 3);
    const base = opts.apples ? APPLE : OAK;
    const crown = base.map(([x, y, r]) => [x + (R() - 0.5) * 3, y + (R() - 0.5) * 3, r * (0.94 + R() * 0.1)]);
    trunk(g, 40, 5, opts.trunk || 0x6b4424);
    canopy(g, crown, leaf, opts.seed || 3);
    if (opts.apples) {
        [[-14, -60], [11, -66], [4, -48], [-3, -76], [18, -54], [-20, -50], [7, -84]].forEach(([x, y]) => {
            ink(g, 1); g.beginFill(0xd8322a); g.drawCircle(x, y, 3.1); g.endFill(); noLine(g);
            g.beginFill(0xff9a7a); g.drawCircle(x - 1, y - 1.1, 1.1); g.endFill();
        });
    }
}

function drawBirch(g, leaf, seed = 5) {
    shadow(g, 20, 7);
    opoly(g, [-4.6, 0, -3.6, -58, 3.6, -58, 4.6, 0], 0xf1ece0, 1.5);
    fpoly(g, [1.2, -58, 3.6, -58, 4.6, 0, 1.6, 0], 0xc9c2b0);
    g.beginFill(0x2a2622);
    [[-3.6, -50, 4, 1.8], [0.5, -43, 3, 1.4], [-3.6, -34, 3.4, 1.8], [1, -26, 3.6, 1.6], [-3.6, -17, 4.2, 1.8], [0.8, -9, 3.6, 1.4]].forEach(([x, y, w, h]) => g.drawRect(x, y, w, h));
    g.endFill();
    ostroke(g, 1.6, 0xe8e2d4, () => { g.moveTo(0, -50); g.lineTo(-9, -62); });
    canopy(g, [[0, -79, 12], [-11, -70, 11], [11, -71, 11], [-4, -60, 12], [9, -58, 10], [-14, -56, 8]], leaf, seed);
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
    shadow(g, 19, 6);
    opoly(g, [-17, 0, -14, -20, -6, -30, 6, -30, 14, -20, 17, 0], 0xb8902c, 1.6);
    fpoly(g, [-17, 0, -14, -20, -6, -30, 0, -30, 0, 0], 0xe2b94a);
    fpoly(g, [-12, -20, -6, -28, -3, -28, -8, -19], 0xf6d880, 0.9);
    g.lineStyle(1, 0x8a6a1e, 0.7);
    [[-12, -6, -10, -16], [-4, -4, -3, -18], [6, -5, 5, -17], [12, -6, 10, -15]].forEach(([a, b, c, d]) => { g.moveTo(a, b); g.lineTo(c, d); });
    noLine(g);
    ink(g, 1.1); g.beginFill(0x8a5a2a); g.drawRect(-16, -12, 32, 2.6); g.drawRect(-13, -22, 26, 2.2); g.endFill(); noLine(g);
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
    shadow(g, 22, 7);
    opoly(g, [-4, 0, -3.2, -18, 3.2, -18, 4, 0], 0x5a3a1e, 1.5);
    fpoly(g, [0.6, -18, 3.2, -18, 4, 0, 1, 0], 0x3e2814);
    for (let i = 0; i < 4; i++) {
        const y = -14 - i * 19, w = 28 - i * 5.4, h = 34 - i * 1.5;
        const apex = [0, y - h];
        const edge = [[-w, y + 1], [-w * 0.66, y - 2.5], [-w * 0.4, y + 2.5], [-w * 0.12, y - 1.5], [w * 0.16, y + 2.5], [w * 0.44, y - 2], [w * 0.7, y + 2], [w, y]];
        opoly(g, [apex[0], apex[1], ...edge.flat()], shade(leaf, 0.66), 1.7);
        // lit left half, then a highlight ridge along the left flank
        fpoly(g, [apex[0], apex[1], ...edge.slice(0, 4).flat(), 0, y - 1], leaf);
        fpoly(g, [0, y - h + 3, -w * 0.62, y - 2.5, -w * 0.48, y - 2, -1.5, y - h + 9], shade(leaf, 1.22), 0.8);
        g.lineStyle(1, shade(leaf, 0.42), 0.8);
        for (let k = 0; k < 3; k++) { const yy = y - h * (0.25 + k * 0.22); g.moveTo(w * (0.15 + k * 0.08), yy + 2); g.lineTo(w * (0.32 + k * 0.1), yy + 5); }
        noLine(g);
        if (snow) {
            // snow on the shoulders that the next tier leaves visible, and a cap on the top tier
            const hw = (yy) => w * (yy - (y - h)) / h;
            const a = i === 3 ? y - h - 0.5 : y - 22, b = i === 3 ? y - h + h * 0.4 : y - 12;
            const pts = i === 3 ? [0, a] : [-hw(a), a, hw(a), a];
            const lip = [[0.95, b], [0.6, b - 3], [0.3, b + 1], [0, b - 2.5], [-0.3, b + 1.5], [-0.62, b - 2.5], [-0.95, b]];
            opoly(g, [...pts, ...lip.flatMap(([k, yy]) => [hw(b) * k, yy])], 0xf4f8ff, 1.3);
            fpoly(g, [0, a + 1, hw(b) * 0.95, b, hw(b) * 0.6, b - 3, hw(b) * 0.3, b + 1, 0, b - 2.5], 0xc4d6ec);
        }
    }
}

function drawMushroom(g, cap, dots) {
    shadow(g, 15, 5);
    ink(g, 1.5); g.beginFill(0xeee6cf); g.drawRoundedRect(-5.5, -19, 11, 19, 4); g.endFill(); noLine(g);
    fpoly(g, [1.5, -18, 5, -18, 5, -1, 1.5, -1], 0xc4b796);
    ink(g, 1.7); g.beginFill(shade(cap, 0.62)); g.drawEllipse(0, -21, 19, 11.5); g.endFill(); noLine(g);
    g.beginFill(cap); g.drawEllipse(-1.5, -23, 16.5, 9.5); g.endFill();
    g.beginFill(shade(cap, 1.3)); g.drawEllipse(-6, -27, 7, 3.2); g.endFill();
    g.beginFill(0xd8ccb0); g.drawEllipse(0, -13.5, 13, 2.4); g.endFill();
    if (dots) {
        ink(g, 0.9, 0.6); g.beginFill(0xffffff, 0.96);
        [[-9, -22, 2.7], [5, -27, 2.3], [10, -20, 2], [-1, -18, 1.8], [-4, -28, 1.6]].forEach(([x, y, r]) => g.drawCircle(x, y, r));
        g.endFill(); noLine(g);
    }
}

function drawLog(g) {
    shadow(g, 27, 7);
    ink(g, 1.6); g.beginFill(0x5a3a22); g.drawRoundedRect(-24, -17, 48, 17, 7); g.endFill(); noLine(g);
    fpoly(g, [-20, -16, 22, -16, 22, -11, -20, -11], 0x7e5532);
    fpoly(g, [-20, -15, 18, -15, 18, -13.6, -20, -13.6], 0xa07042, 0.8);
    g.lineStyle(1, 0x3a2414, 0.8); g.moveTo(-8, -9); g.lineTo(6, -8); g.moveTo(2, -4); g.lineTo(16, -5); g.moveTo(-14, -4); g.lineTo(-6, -3); noLine(g);
    ink(g, 1.5); g.beginFill(0xd6a86c); g.drawEllipse(-24, -8.5, 5.5, 8.5); g.endFill(); noLine(g);
    g.lineStyle(1, 0x9a6a3a); g.drawEllipse(-24, -8.5, 3.4, 5.4); g.drawEllipse(-24, -8.5, 1.4, 2.4); noLine(g);
    ink(g, 1.2); g.beginFill(0x4f9a3a); g.drawEllipse(8, -17, 10, 3); g.endFill(); noLine(g);
    g.beginFill(0x7ac85a); g.drawEllipse(5, -18, 4, 1.2); g.endFill();
}

function drawStump(g) {
    shadow(g, 15, 5);
    opoly(g, [-13, 0, -9, -4, -9, -15, 9, -15, 9, -4, 13, 0, 4, -1, 0, 1, -5, -1], 0x5e3c22);
    fpoly(g, [3, -15, 9, -15, 9, -4, 13, 0, 4, -1, 3, -6], 0x41281a);
    ink(g, 1.4); g.beginFill(0xd6a86c); g.drawEllipse(0, -15, 9, 4); g.endFill(); noLine(g);
    g.lineStyle(1, 0x9a6a3a); g.drawEllipse(0, -15, 5.6, 2.4); g.drawEllipse(0, -15, 2.4, 1); noLine(g);
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

// a faceted stone: lit top, mid left face, dark right face, ink outline, inner edges, a crack and pebbles
const ROCKS = [
    { out: [-19, 0, -21, -11, -12, -23, 2, -26, 13, -21, 21, -9, 19, 0], top: [-12, -23, 2, -26, 13, -21, 6, -14, -5, -15], left: [-21, -11, -12, -23, -5, -15, -7, 0, -19, 0], right: [-5, -15, 6, -14, 13, -21, 21, -9, 19, 0, -7, 0] },
    { out: [-20, 0, -18, -14, -6, -24, 9, -22, 20, -12, 21, 0], top: [-18, -14, -6, -24, 9, -22, 4, -15, -9, -12], left: [-20, 0, -18, -14, -9, -12, -4, 0], right: [-9, -12, 4, -15, 9, -22, 20, -12, 21, 0, -4, 0] }
];
function facetRock(g, base, shape, scale = 1, opts = {}) {
    const sc = (pts) => pts.map((v) => v * scale);
    const S = ROCKS[shape % ROCKS.length];
    opoly(g, sc(S.out), shade(base, 0.6), 1.8);
    fpoly(g, sc(S.left), shade(base, 0.86));
    fpoly(g, sc(S.right), shade(base, 0.6));
    fpoly(g, sc(S.top), opts.top ?? shade(base, 1.14));
    // inner edges, crisp but softer than the outline
    g.lineStyle(1, shade(base, 0.38), 0.7);
    const t = sc(S.top);
    g.moveTo(t[t.length - 2], t[t.length - 1]); g.lineTo(t[t.length - 4], t[t.length - 3]);
    g.lineTo(t[4], t[5]);
    noLine(g);
    // rim light along the top-left edge
    g.lineStyle(1.4, opts.rim ?? shade(base, 1.45), 0.85); g.moveTo(t[0], t[1] + 1); g.lineTo(t[2], t[3] + 1); noLine(g);
    // a crack on the shadowed face
    g.lineStyle(1, INK, 0.55); g.moveTo(9 * scale, -15 * scale); g.lineTo(12 * scale, -9 * scale); g.lineTo(10 * scale, -4 * scale); noLine(g);
    // speckles
    const R = rng(shape + 11);
    for (let i = 0; i < 6; i++) { g.beginFill(shade(base, R() > 0.5 ? 1.3 : 0.5), 0.6); g.drawCircle((R() - 0.5) * 30 * scale, -(4 + R() * 14) * scale, 0.9); g.endFill(); }
}

function drawRock(g, base, mossy = false, shape = 0) {
    shadow(g, 21, 7);
    facetRock(g, base, shape);
    if (mossy) {
        const moss = [[-9, -20, 5, 2.4], [-3, -22.5, 6, 2.4], [3, -21, 4.4, 2], [-13, -15, 3, 2], [14, -12, 3, 1.6]];
        ink(g, 1.1); g.beginFill(0x4a8e36); moss.forEach(([x, y, a, b]) => g.drawEllipse(x, y, a, b)); g.endFill(); noLine(g);
        g.beginFill(0x4a8e36); moss.forEach(([x, y, a, b]) => g.drawEllipse(x, y, a, b)); g.endFill();
        g.beginFill(0x86d060); [[-10, -21, 2.4, 0.9], [-4, -23.6, 3, 0.9], [2, -22, 2, 0.8]].forEach(([x, y, a, b]) => g.drawEllipse(x, y, a, b)); g.endFill();
        g.beginFill(0x2e6a22); [[-11, -17], [-6, -19], [0, -19.5], [4, -18.5]].forEach(([x, y]) => g.drawEllipse(x, y, 0.9, 1.8)); g.endFill();
    }
}

function drawBush(g, leaf, berries = 0) {
    shadow(g, 17, 6, 0.25);
    canopy(g, [[-9, -9, 9], [9, -9, 9], [0, -15, 11], [-2, -7, 8]], leaf, 7, { ink: 1.5 });
    if (berries) {
        [[-9, -10], [6, -13], [2, -6], [12, -8], [-4, -15]].forEach(([x, y]) => {
            ink(g, 0.9); g.beginFill(berries); g.drawCircle(x, y, 2.2); g.endFill(); noLine(g);
            g.beginFill(0xffffff, 0.7); g.drawCircle(x - 0.7, y - 0.8, 0.7); g.endFill();
        });
    }
}

// ----------------------------------------------------------------- DESERT
function drawCactus(g, body = 0x3e8f4b) {
    shadow(g, 15, 5);
    const arm = (pts) => { opoly(g, pts, shade(body, 0.85), 1.5); };
    arm([-18, -33, -18, -18, -16, -14, -5, -14, -5, -19, -12, -19, -12, -33]);
    arm([18, -40, 18, -23, 16, -19, 5, -19, 5, -24, 12, -24, 12, -40]);
    ink(g, 1.7); g.beginFill(shade(body, 0.72)); g.drawRoundedRect(-6.5, -48, 13, 48, 6.5); g.endFill(); noLine(g);
    g.beginFill(body); g.drawRoundedRect(-6, -47, 8.5, 46, 4.5); g.endFill();
    g.beginFill(shade(body, 1.3)); g.drawRoundedRect(-4.5, -45, 2.4, 40, 1.2); g.endFill();
    g.lineStyle(1, shade(body, 0.5), 0.8); g.moveTo(2.5, -44); g.lineTo(2.5, -3); g.moveTo(-1.5, -44); g.lineTo(-1.5, -3); noLine(g);
    g.beginFill(0xf4f0d8, 0.9);
    for (let y = -42; y < -4; y += 6) { g.drawCircle(-6.5, y, 0.8); g.drawCircle(6.5, y + 3, 0.8); }
    g.endFill();
    ink(g, 1); g.beginFill(0xff7ab8); g.drawCircle(-1, -49, 2.6); g.drawCircle(2, -48.5, 2.2); g.endFill(); noLine(g);
    g.beginFill(0xffe14d); g.drawCircle(0.4, -48.8, 1); g.endFill();
}

function drawBarrelCactus(g) {
    shadow(g, 13, 5);
    ink(g, 1.6); g.beginFill(0x2e7a3e); g.drawEllipse(0, -11, 11, 12); g.endFill(); noLine(g);
    g.beginFill(0x4aa557); g.drawEllipse(-2, -12, 8, 10.5); g.endFill();
    g.beginFill(0x7ad07a, 0.8); g.drawEllipse(-5, -15, 2.4, 6); g.endFill();
    g.lineStyle(1, 0x1f5a2c, 0.9); [-6, -2, 2.5, 6.5].forEach((x) => { g.moveTo(x, -1.5); g.quadraticCurveTo(x * 1.25, -11, x * 0.55, -21.5); }); noLine(g);
    g.beginFill(0xf4f0d8); [[-8, -10], [-4, -16], [4, -14], [8, -8], [0, -6]].forEach(([x, y]) => g.drawCircle(x, y, 0.8)); g.endFill();
    ink(g, 1); g.beginFill(0xffd84a); g.drawCircle(0, -23, 3.2); g.endFill(); noLine(g);
    g.beginFill(0xff8a3a); g.drawCircle(0, -23, 1.2); g.endFill();
}

function drawDeadTree(g, wood = 0x4a3826) {
    shadow(g, 17, 6, 0.28);
    const lit = shade(wood, 1.35);
    ostroke(g, 3, wood, () => { g.moveTo(0, -24); g.lineTo(-15, -40); g.lineTo(-19, -44); });
    ostroke(g, 2.6, wood, () => { g.moveTo(0, -33); g.lineTo(14, -47); g.moveTo(8, -40); g.lineTo(16, -40); });
    ostroke(g, 2, wood, () => { g.moveTo(-9, -33); g.lineTo(-12, -49); });
    opoly(g, [-7, 0, -3.6, -6, -3, -44, 0, -50, 3, -42, 3.4, -6, 7, 0, 1, -1.2, -2, -1.2], wood, 1.6);
    fpoly(g, [0.8, -42, 3, -42, 3.4, -6, 7, 0, 1, -1.2, 1, -6], shade(wood, 0.66));
    g.lineStyle(1, lit, 0.7); g.moveTo(-2, -40); g.lineTo(-2.2, -8); noLine(g);
    g.lineStyle(1, shade(wood, 0.5), 0.9); g.moveTo(1, -30); g.lineTo(-1, -22); g.moveTo(1.6, -16); g.lineTo(0.6, -10); noLine(g);
}

function drawBones(g) {
    g.beginFill(0xeee6d0); g.drawEllipse(-6, -4, 6, 5); g.endFill();
    g.beginFill(0x2a2a2a); g.drawCircle(-8, -5, 1.4); g.drawCircle(-4, -5, 1.4); g.endFill();
    g.lineStyle(3, 0xeee6d0); g.moveTo(4, -2); g.lineTo(18, -6); g.moveTo(5, -7); g.lineTo(16, -1);
    g.lineStyle(2, 0xeee6d0); g.moveTo(8, -9); g.lineTo(8, -1); g.lineStyle(0);
}

function drawSandRock(g) {
    shadow(g, 23, 8);
    opoly(g, [-20, 0, -22, -16, -10, -28, 10, -26, 22, -12, 20, 0], 0x8a5a30, 1.8);
    fpoly(g, [-22, -16, -10, -28, 10, -26, 3, -16], 0xd8aa66);
    fpoly(g, [-22, -16, 3, -16, 0, 0, -20, 0], 0xb07a42);
    g.lineStyle(1, 0xe8c080, 0.8); g.moveTo(-10, -27); g.lineTo(9, -25.5); noLine(g);
    // strata
    fpoly(g, [-21, -11, 0, -11.5, 21, -8, 21, -6, 0, -9, -21, -9], 0x6e4424, 0.75);
    fpoly(g, [-20, -5, 0, -5.5, 20, -3, 20, -1.5, 0, -4, -20, -3.5], 0x6e4424, 0.6);
    g.lineStyle(1, INK, 0.45); g.moveTo(10, -20); g.lineTo(13, -14); noLine(g);
}

function drawSpire(g) {
    shadow(g, 22, 8);
    opoly(g, [-16, 0, -12, -30, -8, -60, 6, -66, 12, -34, 16, 0], 0x8f5f33, 1.8);
    fpoly(g, [-12, -30, -8, -60, 6, -66, 0, -30, -2, 0, -16, 0], 0xc8975a);
    fpoly(g, [-8, -60, 6, -66, 2, -58, -6, -55], 0xe8c080);
    [[-22, 3], [-40, 2.6], [-52, 2]].forEach(([y, h], i) => fpoly(g, [-14 + i * 2, y, 15 - i * 2, y + 1, 15 - i * 2, y + 1 + h, -14 + i * 2, y + h], 0x6a4020, 0.7));
    g.lineStyle(1, INK, 0.45); g.moveTo(6, -46); g.lineTo(9, -38); g.lineTo(7, -31); noLine(g);
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
    shadow(g, 19, 6);
    // ringed, curving trunk built from segments, base to crown
    const seg = 7;
    for (let i = seg - 1; i >= 0; i--) {
        const t0 = i / seg, t1 = (i + 1) / seg;
        const x0 = Math.sin(t0 * 1.6) * 9, y0 = -t0 * 60, x1 = Math.sin(t1 * 1.6) * 9, y1 = -t1 * 60;
        const w0 = 5.2 - t0 * 1.8, w1 = 5.2 - t1 * 1.8;
        opoly(g, [x0 - w0, y0, x1 - w1, y1 + 1, x1 + w1, y1 + 1, x0 + w0, y0], 0x9a7442, 1.4);
        fpoly(g, [x0 + w0 * 0.2, y0 - 0.5, x1 + w1 * 0.2, y1 + 1.5, x1 + w1 - 0.6, y1 + 1.5, x0 + w0 - 0.6, y0 - 0.5], 0x6e5230);
        g.lineStyle(1, 0xc8a06a, 0.7); g.moveTo(x1 - w1 + 1, y1 + 3); g.lineTo(x1 + w1 * 0.1, y1 + 3.6); noLine(g);
    }
    const cx = Math.sin(1.6) * 9, cy = -60;
    // feathered fronds: a drooping midrib with serrated leaflets, back fronds first
    const fronds = [[-4, -18, 0.8], [16, -14, 0.9], [-22, -10, 0.95], [29, 4, 1], [-29, 6, 1], [-13, 14, 0.85], [14, 15, 0.85]];
    for (const [dx, dy, k] of fronds) {
        const c1 = [cx + dx * 0.45, cy + dy * 0.45 - 12 * k], tip = [cx + dx, cy + dy];
        const at = (t) => {
            const u = 1 - t;
            return [u * u * cx + 2 * u * t * c1[0] + t * t * tip[0], u * u * cy + 2 * u * t * c1[1] + t * t * tip[1]];
        };
        const n = 9, left = [], right = [];
        for (let i = 0; i <= n; i++) {
            const t = i / n, [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 0.02));
            const len = Math.hypot(x2 - x, y2 - y) || 1, nx = -(y2 - y) / len, ny = (x2 - x) / len;
            const wdt = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 5.5 * (i % 2 ? 1 : 0.62);
            left.push(x + nx * wdt, y + ny * wdt); right.unshift(x - nx * wdt, y - ny * wdt);
        }
        opoly(g, [...left, ...right], 0x2a8040, 1.3);
        fpoly(g, [...left, ...right.slice(right.length - 2)], 0x56bc64);
        g.lineStyle(1, 0x1e5a2c, 0.9); g.moveTo(cx, cy); g.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]); noLine(g);
    }
    [[-3, 4], [3, 5], [0, 7.5]].forEach(([x, y]) => { ink(g, 1); g.beginFill(0x6a4020); g.drawCircle(cx + x, cy + y, 3); g.endFill(); noLine(g); g.beginFill(0x9a6a3a); g.drawCircle(cx + x - 1, cy + y - 1, 1); g.endFill(); });
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
    shadow(g, 27, 9, 0.28);
    opoly(g, [-22, 0, -16, -26, -4, -44, 10, -38, 20, -16, 24, 0], 0x464656, 1.8);
    fpoly(g, [-16, -26, -4, -44, 10, -38, 2, -20, -6, 0, -22, 0], 0x7a7a8c);
    fpoly(g, [-4, -44, 10, -38, 5, -33, -3, -36], 0xa8a8ba);
    g.lineStyle(1, INK, 0.5); g.moveTo(6, -28); g.lineTo(10, -20); g.lineTo(8, -12); noLine(g);
    fpoly(g, [-22, 0, -21, -5, 0, -6, 23, -4, 24, 0], 0x2e3a3e, 0.7);    // wet foot
    ink(g, 1.2, 0.5); g.beginFill(0xffffff, 0.85); g.drawEllipse(0, -1, 27, 4); g.endFill(); noLine(g);
    g.beginFill(0xffffff, 0.9); g.drawCircle(-18, -4, 1.4); g.drawCircle(15, -3, 1.2); g.drawCircle(22, -5, 1); g.endFill();
}

// --------------------------------------------------------------- MOUNTAIN
function drawBoulder(g) {
    shadow(g, 31, 10);
    facetRock(g, 0x80858f, 0, 1.45);
    ink(g, 1.1); g.beginFill(0x4f9a3a, 0.9); g.drawEllipse(-10, -33, 7, 2.4); g.endFill(); noLine(g);
}

function drawCrystal(g, color) {
    shadow(g, 16, 5);
    glow(g, 0, -14, 22, color, 0.16);
    [[-9, 0, 9, 22], [13, 0, 6, 16], [4, 0, 10, 32]].forEach(([x, y, w, h]) => {
        const pts = [x - w / 2, y, x - w / 2 + 1, y - h + 6, x + 1, y - h, x + w / 2, y - h + 6, x + w / 2, y];
        opoly(g, pts, shade(color, 0.55), 1.5);
        fpoly(g, [x - w / 2 + 1, y - h + 6, x + 1, y - h, x, y, x - w / 2, y], shade(color, 1.05));
        fpoly(g, [x - w / 2 + 2, y - h + 7, x + 0.5, y - h + 2, x - 1, y - 3, x - w / 2 + 1.5, y - 3], shade(color, 1.45), 0.85);
        g.beginFill(0xffffff, 0.9); g.drawCircle(x - w / 2 + 2.5, y - h + 9, 1); g.endFill();
    });
}

function drawIceRock(g) {
    shadow(g, 21, 7);
    facetRock(g, 0x7aa6cc, 1, 1, { top: 0xf2f8ff, rim: 0xffffff });
    g.beginFill(0xffffff, 0.95); g.drawPolygon([-15, -15, -13, -17, -11, -15, -13, -13]); g.drawPolygon([8, -19, 9.5, -21, 11, -19, 9.5, -17]); g.endFill();
}

function drawOre(g) {
    shadow(g, 21, 7);
    facetRock(g, 0x62606e, 0);
    [[-6, -15, 3], [6, -10, 2.4], [0, -21, 2.4], [12, -15, 1.8], [-13, -8, 2]].forEach(([x, y, r]) => {
        ink(g, 1); g.beginFill(0xe8a820); g.drawPolygon([x - r, y, x - r * 0.3, y - r, x + r, y - r * 0.4, x + r * 0.6, y + r * 0.8, x - r * 0.5, y + r * 0.7]); g.endFill(); noLine(g);
        g.beginFill(0xfff0a0); g.drawCircle(x - r * 0.3, y - r * 0.3, r * 0.35); g.endFill();
    });
    g.lineStyle(1, 0xffffff, 0.9); g.moveTo(-1, -26); g.lineTo(-1, -22); g.moveTo(-3, -24); g.lineTo(1, -24); noLine(g);
}

// --------------------------------------------------------- POI LANDMARKS
function drawCaveMouth(g, rock) {
    shadow(g, 70, 16, 0.35);
    // the hillside around the mouth: an inked outline, a lit left face and a shadowed right face
    opoly(g, [-68, 0, -72, -36, -54, -76, -20, -98, 22, -100, 56, -78, 72, -40, 68, 0], shade(rock, 0.62), 2);
    fpoly(g, [-70, -34, -54, -76, -20, -98, 22, -100, 2, -62, -40, -34], rock);
    fpoly(g, [-54, -76, -20, -98, 22, -100, 12, -88, -30, -82], shade(rock, 1.22));
    fpoly(g, [40, -82, 56, -78, 72, -40, 68, 0, 46, 0, 52, -40], shade(rock, 0.5));
    g.lineStyle(1.1, shade(rock, 0.38), 0.75);
    g.moveTo(-50, -60); g.lineTo(-38, -48); g.moveTo(30, -84); g.lineTo(40, -66); g.lineTo(36, -52); g.moveTo(-60, -20); g.lineTo(-48, -14);
    noLine(g);
    g.lineStyle(1.4, shade(rock, 1.5), 0.8); g.moveTo(-52, -78); g.lineTo(-22, -97); noLine(g);
    // moss and a few stones at the foot
    ink(g, 1.1); g.beginFill(0x4a8e36); g.drawEllipse(-34, -86, 9, 3); g.drawEllipse(10, -97, 7, 2.4); g.endFill(); noLine(g);
    // the dark mouth with a warm glow deep inside
    opoly(g, [-30, 0, -32, -28, -18, -54, 0, -62, 18, -54, 32, -28, 30, 0], 0x07060a, 1.8);
    fpoly(g, [-24, 0, -25, -24, -12, -46, 0, -52, 12, -46, 25, -24, 24, 0], 0x1a1410);
    // a warm light deep inside: a soft pool on the floor and a faint haze, no hard disc
    g.beginFill(0xffb04a, 0.1); g.drawEllipse(0, -6, 18, 6); g.endFill();
    g.beginFill(0xffc870, 0.14); g.drawEllipse(0, -5, 10, 3.4); g.endFill();
    g.beginFill(0xffb04a, 0.06); g.drawEllipse(0, -22, 12, 16); g.endFill();
    // jagged teeth of rock
    opoly(g, [-18, -54, -14, -42, -10, -56], shade(rock, 0.8), 1.2);
    opoly(g, [6, -60, 10, -47, 14, -58], shade(rock, 0.8), 1.2);
    opoly(g, [-34, 0, -30, -12, -22, 0], shade(rock, 0.7), 1.2);
    opoly(g, [24, 0, 30, -10, 36, 0], shade(rock, 0.7), 1.2);
}

function drawRuinArch(g) {
    shadow(g, 64, 14, 0.35);
    const stone = 0x8a8478, dark = 0x5e594f;
    // stairs going down into the dark
    opoly(g, [-26, 0, -26, -34, 26, -34, 26, 0], 0x15120e, 1.6);
    for (let i = 0; i < 4; i++) {
        const w = 48 - i * 6, x = -24 + i * 3, y = -4 - i * 7;
        fpoly(g, [x, y, x + w, y, x + w, y + 5, x, y + 5], shade(stone, 0.62 - i * 0.1));
        g.lineStyle(1, shade(stone, 0.95 - i * 0.1), 0.6); g.moveTo(x, y); g.lineTo(x + w, y); noLine(g);
    }
    // two weathered pillars, one broken short
    [[-44, 70], [44, 54]].forEach(([x, h]) => {
        opoly(g, [x - 12, 0, x - 12, -h, x + 12, -h, x + 12, 0], dark, 1.8);
        fpoly(g, [x - 12, 0, x - 12, -h, x + 3, -h, x + 3, 0], stone);
        g.lineStyle(1, shade(stone, 0.55), 0.7);
        for (let y = -14; y > -h; y -= 14) { g.moveTo(x - 12, y); g.lineTo(x + 12, y); }
        noLine(g);
        opoly(g, [x - 15, -h - 5, x - 15, -h + 2, x + 15, -h + 2, x + 15, -h - 5], shade(stone, 1.15), 1.4);
        opoly(g, [x - 15, -5, x - 15, 0, x + 15, 0, x + 15, -5], shade(stone, 1.05), 1.4);
        ink(g, 1); g.beginFill(0x4a8a3a, 0.9); g.drawEllipse(x + 4, -h * 0.5, 4.5, 9); g.endFill(); noLine(g);
    });
    // the broken lintel, with a rune that still glows
    opoly(g, [-56, -72, -8, -80, -2, -64, -56, -62], dark, 1.8);
    fpoly(g, [-56, -72, -8, -80, -10, -74, -56, -68], stone);
    opoly(g, [6, -66, 14, -70, 16, -64, 8, -62], dark, 1.2);           // a fallen chip
    glow(g, 0, -42, 20, 0x4cc8ff, 0.12);
    ink(g, 1.2); g.beginFill(0x4cc8ff, 0.8); g.drawCircle(0, -44, 4.5); g.endFill(); noLine(g);
    g.beginFill(0xd8f4ff, 0.9); g.drawCircle(-1, -45, 1.5); g.endFill();
}

function house(g, wall, roof, trim = 0x4a3826, seed = 1) {
    const R = rng(seed);
    shadow(g, 52, 10, 0.3);
    const beam = 0x5a3a20;
    // stone footing
    opoly(g, [-39, 0, -39, -10, 39, -10, 39, 0], 0x8f8a7e, 1.6);
    g.lineStyle(1, 0x5f5a50, 0.7);
    for (let x = -30; x < 39; x += 14) { g.moveTo(x, -10); g.lineTo(x, -5); g.moveTo(x + 7, -5); g.lineTo(x + 7, 0); }
    g.moveTo(-39, -5); g.lineTo(39, -5);
    noLine(g);
    // plastered walls, lit from the left
    opoly(g, [-38, -10, -38, -58, 38, -58, 38, -10], shade(wall, 0.84), 1.8);
    fpoly(g, [-38, -10, -38, -58, 8, -58, 8, -10], wall);
    // timber frame with braces
    g.lineStyle(3, beam, 1);
    for (const x of [-36, -13, 13, 36]) { g.moveTo(x, -10); g.lineTo(x, -57); }
    g.moveTo(-38, -36); g.lineTo(38, -36);
    g.moveTo(-36, -36); g.lineTo(-24, -57); g.moveTo(36, -36); g.lineTo(24, -57);
    noLine(g);
    // the eaves' shadow on the wall
    fpoly(g, [-38, -58, 38, -58, 38, -53, -38, -53], 0x000000, 0.22);
    // roof: lit and shaded halves, rows of tiles, a ridge cap
    opoly(g, [-46, -56, -32, -92, 32, -92, 46, -56], shade(roof, 0.72), 1.8);
    fpoly(g, [-46, -56, -32, -92, 0, -92, 0, -56], roof);
    g.lineStyle(1.1, shade(roof, 0.5), 0.75);
    for (let y = -64; y > -92; y -= 8) { const k = (y + 56) / -36; g.moveTo(-46 + k * 14, y); g.lineTo(46 - k * 14, y); }
    noLine(g);
    opoly(g, [-33, -94, -33, -89, 33, -89, 33, -94], shade(roof, 0.6), 1.4);
    g.lineStyle(1.4, shade(roof, 1.45), 0.8); g.moveTo(-44, -58); g.lineTo(-31, -90); noLine(g);
    // a brick chimney on some houses
    if (R() < 0.7) {
        opoly(g, [18, -78, 18, -102, 28, -102, 28, -82], 0x9a4a32, 1.4);
        opoly(g, [16, -105, 16, -101, 30, -101, 30, -105], 0x5a5a62, 1.2);
        g.lineStyle(0.8, 0x5a2a1a, 0.7); g.moveTo(18, -90); g.lineTo(28, -90); g.moveTo(23, -96); g.lineTo(23, -90); noLine(g);
    }
    // arched plank door with a step and a lantern
    opoly(g, [-9, 0, -9, -26, -6, -32, 0, -34, 6, -32, 9, -26, 9, 0], trim, 1.6);
    g.lineStyle(1, shade(trim, 0.55), 0.8); g.moveTo(-3, -32); g.lineTo(-3, 0); g.moveTo(3, -32); g.lineTo(3, 0); noLine(g);
    g.beginFill(0xffd070); g.drawCircle(5, -15, 1.4); g.endFill();
    opoly(g, [-12, 0, -12, 3, 12, 3, 12, 0], 0x9a9488, 1.2);
    glow(g, -16, -27, 9, 0xffc060, 0.22);
    opoly(g, [-18, -24, -18, -31, -14, -31, -14, -24], 0x2a2a32, 1.1);
    g.beginFill(0xffe08a); g.drawRect(-17, -30, 2, 5); g.endFill();
    // windows with mullions and shutters, a flower box under one
    [[-30, -50], [18, -50]].forEach(([x, y], i) => {
        opoly(g, [x - 4, y, x - 4, y + 15, x, y + 15, x, y], shade(roof, 0.85), 1);
        opoly(g, [x + 12, y, x + 12, y + 15, x + 16, y + 15, x + 16, y], shade(roof, 0.85), 1);
        opoly(g, [x, y, x, y + 15, x + 12, y + 15, x + 12, y], 0x9ad4ff, 1.4);
        fpoly(g, [x + 1, y + 1, x + 5, y + 1, x + 1, y + 9], 0xffffff, 0.5);
        g.lineStyle(1.2, trim, 1); g.moveTo(x + 6, y); g.lineTo(x + 6, y + 15); g.moveTo(x, y + 7.5); g.lineTo(x + 12, y + 7.5); noLine(g);
        if (i === (seed % 2)) {
            opoly(g, [x - 2, y + 15, x - 2, y + 19, x + 14, y + 19, x + 14, y + 15], 0x6a4222, 1);
            const fl = [0xff5a6a, 0xffd84a, 0xd88aff, 0xffffff][seed % 4];
            g.beginFill(0x3a8a3a); g.drawEllipse(x + 6, y + 14.5, 8, 2.4); g.endFill();
            g.beginFill(fl); for (let k = 0; k < 4; k++) g.drawCircle(x + k * 4, y + 13.5 - (k % 2), 1.5); g.endFill();
        }
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
    const stoneLines = (x0, x1, y0, y1) => {
        g.lineStyle(1, shade(wall, 0.55), 0.6);
        for (let y = y0 + 10, row = 0; y < y1; y += 10, row++) {
            g.moveTo(x0, y); g.lineTo(x1, y);
            for (let x = x0 + (row % 2 ? 6 : 12); x < x1; x += 12) { g.moveTo(x, y - 10); g.lineTo(x, y); }
        }
        noLine(g);
    };
    // the wall walk between the towers, crenellated
    opoly(g, [-34, -60, -34, -88, 34, -88, 34, -60], shade(wall, 0.86), 1.8);
    for (let x = -30; x < 30; x += 12) opoly(g, [x, -88, x, -95, x + 7, -95, x + 7, -88], shade(wall, 0.95), 1.2);
    // the two towers
    [-52, 52].forEach((x) => {
        opoly(g, [x - 20, 0, x - 20, -96, x + 20, -96, x + 20, 0], shade(wall, 0.72), 1.8);
        fpoly(g, [x - 20, 0, x - 20, -96, x + 6, -96, x + 6, 0], wall);
        stoneLines(x - 20, x + 20, -96, 0);
        opoly(g, [x - 4, -70, x - 4, -58, x + 4, -58, x + 4, -70], 0x15120e, 1.2);           // arrow slit
        opoly(g, [x - 26, -94, x, -134, x + 26, -94], shade(roof, 0.7), 1.8);
        fpoly(g, [x - 26, -94, x, -134, x, -94], roof);
        g.lineStyle(1.3, shade(roof, 1.4), 0.8); g.moveTo(x - 24, -96); g.lineTo(x - 1, -132); noLine(g);
        // a pennant on each spire
        g.lineStyle(1.4, INK, 0.9); g.moveTo(x, -134); g.lineTo(x, -146); noLine(g);
        opoly(g, [x, -146, x + 12, -143, x, -139], 0xc83a3a, 1);
    });
    // the gate arch, a raised portcullis and a warm glow beyond
    opoly(g, [-32, 0, -32, -44, -20, -60, 20, -60, 32, -44, 32, 0], 0x15120e, 2);
    // lamplight from the town beyond, spilling on the road through the arch
    g.beginFill(0xffd070, 0.2); g.drawEllipse(0, -6, 26, 7); g.endFill();
    g.beginFill(0xffe0a0, 0.18); g.drawEllipse(0, -4, 14, 3.6); g.endFill();
    g.beginFill(0xffd070, 0.07); g.drawEllipse(0, -22, 20, 18); g.endFill();
    g.lineStyle(1.6, 0x3a3a42, 0.95);
    for (let x = -24; x <= 24; x += 8) { g.moveTo(x, -56); g.lineTo(x, -40); }
    g.moveTo(-28, -48); g.lineTo(28, -48); g.moveTo(-30, -40); g.lineTo(30, -40);
    noLine(g);
    opoly(g, [-36, -60, -32, -66, 32, -66, 36, -60], shade(wall, 1.12), 1.4);              // keystone course
    // the town's banner over the arch
    opoly(g, [-7, -86, 7, -86, 7, -70, 0, -75, -7, -70], 0xc83a3a, 1.2);
    g.beginFill(0xf1c24a); g.drawCircle(0, -80, 2.6); g.endFill();
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
    // a little shrine: stepped plinth, carved runes, a crystal that floats and glows
    opoly(g, [-30, 0, -30, -8, 30, -8, 30, 0], 0x5a5a66, 1.6);
    opoly(g, [-26, -8, -26, -16, 26, -16, 26, -8], 0x6a6a78, 1.6);
    opoly(g, [-22, -16, -22, -36, 22, -36, 22, -16], 0x7a7a88, 1.8);
    fpoly(g, [-22, -16, -22, -36, 2, -36, 2, -16], 0x8e8e9c);
    opoly(g, [-26, -36, -26, -41, 26, -41, 26, -36], 0x9a9aaa, 1.6);
    g.lineStyle(1.2, 0xb8a0ff, 0.85);
    g.moveTo(-14, -30); g.lineTo(-10, -22); g.lineTo(-6, -30);
    g.moveTo(4, -22); g.lineTo(8, -30); g.lineTo(12, -22); g.moveTo(6, -26); g.lineTo(10, -26);
    noLine(g);
    glow(g, 0, -56, 20, 0xb8a0ff, 0.1);
    glow(g, 0, -56, 13, 0xc8b0ff, 0.12);
    glow(g, 0, -56, 7, 0xe0d0ff, 0.16);
    opoly(g, [0, -72, 8, -56, 0, -44, -8, -56], 0xd8c8ff, 1.4);
    fpoly(g, [0, -72, 0, -44, -8, -56], 0xffffff, 0.6);
}

function drawStall(g, awning) {
    shadow(g, 40, 9, 0.3);
    // posts, the counter and a crate beside it
    opoly(g, [-30, 0, -30, -62, -26, -62, -26, 0], 0x5a3a1e, 1.3);
    opoly(g, [26, 0, 26, -62, 30, -62, 30, 0], 0x5a3a1e, 1.3);
    opoly(g, [-32, 0, -32, -22, 32, -22, 32, 0], 0x6a4a2a, 1.6);
    fpoly(g, [-32, -22, 32, -22, 32, -15, -32, -15], 0x9a6e3c);
    g.lineStyle(1, 0x3a2410, 0.7); g.moveTo(-32, -8); g.lineTo(32, -8); g.moveTo(-10, -15); g.lineTo(-10, 0); g.moveTo(12, -15); g.lineTo(12, 0); noLine(g);
    opoly(g, [33, 0, 33, -14, 44, -14, 44, 0], 0x8a5a2a, 1.2);
    g.lineStyle(1, 0x4a2a10, 0.8); g.moveTo(33, 0); g.lineTo(44, -14); noLine(g);
    // goods: fruit, a jug, bread
    ink(g, 1); g.beginFill(0xd8503a); g.drawCircle(-20, -26, 3.6); g.drawCircle(-14, -26, 3.6); g.drawCircle(-17, -30, 3.4); g.endFill(); noLine(g);
    ink(g, 1); g.beginFill(0xe8c63a); g.drawCircle(-4, -26, 3.4); g.drawCircle(2, -26, 3.4); g.endFill(); noLine(g);
    opoly(g, [10, -22, 9, -30, 12, -34, 16, -34, 19, -30, 18, -22], 0x5a7ab8, 1.1);
    ink(g, 1); g.beginFill(0xc8904a); g.drawEllipse(25, -25, 5, 3); g.endFill(); noLine(g);
    // striped awning with a scalloped edge
    opoly(g, [-38, -56, -30, -66, 30, -66, 38, -56], awning, 1.6);
    for (let i = 0; i < 6; i++) {
        const x0 = -38 + i * 12.7;
        if (i % 2 === 0) fpoly(g, [x0, -56, x0 + 12.7, -56, x0 + 11.3, -66 + 0, x0 + 1.4, -66], 0xf4f0e0);
    }
    for (let i = 0; i < 6; i++) {
        const x = -38 + i * 12.7 + 6.35;
        ink(g, 1.2); g.beginFill(i % 2 ? awning : 0xf4f0e0); g.arc(x, -56, 6.35, 0, Math.PI); g.endFill(); noLine(g);
    }
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
    // stone ring with blocks, dark water, a little roof on two posts, a crank and a bucket
    opoly(g, [-20, -6, -20, -20, 20, -20, 20, -6], 0x8a8a96, 1.6);
    ink(g, 1.6); g.beginFill(0x8a8a96); g.drawEllipse(0, -6, 20, 6); g.endFill(); noLine(g);
    fpoly(g, [-20, -20, -20, -6, -2, -6, -2, -20], 0x9e9eaa);
    g.lineStyle(1, 0x5a5a66, 0.7);
    for (let x = -14; x < 20; x += 10) { g.moveTo(x, -20); g.lineTo(x, -13); g.moveTo(x + 5, -13); g.lineTo(x + 5, -6); }
    g.moveTo(-20, -13); g.lineTo(20, -13);
    noLine(g);
    ink(g, 1.6); g.beginFill(0xa8a8b4); g.drawEllipse(0, -20, 20, 6.5); g.endFill(); noLine(g);
    g.beginFill(0x0a1a2a); g.drawEllipse(0, -20, 15, 4.5); g.endFill();
    g.beginFill(0x3a6a9a, 0.6); g.drawEllipse(-3, -20.5, 6, 1.4); g.endFill();
    opoly(g, [-19, -20, -19, -50, -16, -50, -16, -20], 0x5a3a1e, 1.2);
    opoly(g, [16, -20, 16, -50, 19, -50, 19, -20], 0x5a3a1e, 1.2);
    opoly(g, [-24, -48, -12, -60, 12, -60, 24, -48], 0x8a3a2a, 1.6);
    fpoly(g, [-24, -48, -12, -60, 0, -60, 0, -48], 0xa84a34);
    g.lineStyle(1.6, 0x3a2a1a, 1); g.moveTo(-16, -42); g.lineTo(16, -42); g.moveTo(16, -42); g.lineTo(22, -38); noLine(g);
    g.lineStyle(1, 0xd8c8a0, 0.9); g.moveTo(0, -42); g.lineTo(0, -32); noLine(g);
    opoly(g, [-4, -32, -3, -26, 3, -26, 4, -32], 0x7a5a32, 1);
}

function drawPortal(g) {
    shadow(g, 34, 9, 0.3);
    g.beginFill(0x4a4a56); g.drawRect(-30, -70, 12, 70); g.drawRect(18, -70, 12, 70); g.drawRect(-30, -78, 60, 12); g.endFill();
    g.beginFill(0x7a7a8a); g.drawRect(-30, -70, 7, 70); g.drawRect(18, -70, 7, 70); g.endFill();
    g.beginFill(0x4cc8ff, 0.35); g.drawRect(-18, -66, 36, 66); g.endFill();
    g.beginFill(0xb8ecff, 0.35); g.drawEllipse(0, -34, 12, 28); g.endFill();
    glow(g, 0, -34, 36, 0x4cc8ff, 0.12);
}

/**
 * A vault gate. Facing the camera (`front`): two stone posts with an iron portcullis between them, raised when open.
 * Edge-on (the corridor runs left to right): a tall post with the bars seen from the side.
 */
function drawVaultGate(g, front, open) {
    const stone = 0x8a8478, iron = 0x3a3a44;
    if (front) {
        shadow(g, 52, 9, 0.3);
        if (!open) {
            g.lineStyle(3.2, INK, 0.95);
            for (let x = -36; x <= 36; x += 9) { g.moveTo(x, -4); g.lineTo(x, -70); }
            g.moveTo(-40, -24); g.lineTo(40, -24); g.moveTo(-40, -50); g.lineTo(40, -50);
            g.lineStyle(2, iron, 1);
            for (let x = -36; x <= 36; x += 9) { g.moveTo(x, -4); g.lineTo(x, -70); }
            g.moveTo(-40, -24); g.lineTo(40, -24); g.moveTo(-40, -50); g.lineTo(40, -50);
            noLine(g);
            for (let x = -36; x <= 36; x += 9) opoly(g, [x - 2.4, -4, x, 2, x + 2.4, -4], 0x5a5a66, 1);   // spikes at the foot
            ink(g, 1.2); g.beginFill(0xd8b040); g.drawCircle(0, -37, 5); g.endFill(); noLine(g);           // the lock plate
            g.beginFill(0x2a1a0a); g.drawCircle(0, -38, 1.6); g.drawRect(-0.8, -38, 1.6, 4); g.endFill();
        } else {
            g.lineStyle(2, iron, 0.9);
            for (let x = -36; x <= 36; x += 9) { g.moveTo(x, -76); g.lineTo(x, -88); }
            noLine(g);
        }
        for (const x of [-48, 48]) {
            opoly(g, [x - 9, 0, x - 9, -88, x + 9, -88, x + 9, 0], shade(stone, 0.8), 1.8);
            fpoly(g, [x - 9, 0, x - 9, -88, x + 2, -88, x + 2, 0], stone);
            g.lineStyle(1, shade(stone, 0.55), 0.6); for (let y = -14; y > -88; y -= 14) { g.moveTo(x - 9, y); g.lineTo(x + 9, y); } noLine(g);
        }
        opoly(g, [-58, -86, -58, -96, 58, -96, 58, -86], shade(stone, 1.1), 1.8);
        g.beginFill(open ? 0x7ad8ff : 0xffb04a, 0.9); g.drawCircle(0, -91, 3); g.endFill();
    } else {
        shadow(g, 18, 22, 0.3);
        opoly(g, [-8, 0, -8, -92, 8, -92, 8, 0], shade(stone, 0.85), 1.8);
        fpoly(g, [-8, 0, -8, -92, 1, -92, 1, 0], stone);
        if (!open) {
            g.lineStyle(3.2, INK, 0.95); for (let k = 0; k < 5; k++) { g.moveTo(-14, -8 - k * 16); g.lineTo(14, -2 - k * 16); } noLine(g);
            g.lineStyle(2, iron, 1); for (let k = 0; k < 5; k++) { g.moveTo(-14, -8 - k * 16); g.lineTo(14, -2 - k * 16); } noLine(g);
            ink(g, 1.2); g.beginFill(0xd8b040); g.drawCircle(0, -40, 4); g.endFill(); noLine(g);
        }
        g.beginFill(open ? 0x7ad8ff : 0xffb04a, 0.9); g.drawCircle(0, -86, 2.6); g.endFill();
    }
}

/** A lever on a stone base: up (waiting) or down (pulled, its rune lit). */
function drawLever(g, pulled) {
    shadow(g, 16, 5, 0.3);
    opoly(g, [-14, 0, -14, -12, 14, -12, 14, 0], 0x6a6a76, 1.6);
    fpoly(g, [-14, -12, -14, 0, 0, 0, 0, -12], 0x7e7e8a);
    g.beginFill(pulled ? 0x7ad8ff : 0x4a4a56); g.drawCircle(8, -6, 2.6); g.endFill();
    const tip = pulled ? [16, -18] : [-10, -38];
    ostroke(g, 3, 0x6a4a2a, () => { g.moveTo(0, -12); g.lineTo(tip[0], tip[1]); });
    ink(g, 1.2); g.beginFill(0xc83a3a); g.drawCircle(tip[0], tip[1], 4.2); g.endFill(); noLine(g);
    g.beginFill(0xffffff, 0.5); g.drawCircle(tip[0] - 1.2, tip[1] - 1.4, 1.3); g.endFill();
    if (pulled) glow(g, 8, -6, 9, 0x7ad8ff, 0.18);
}

/** A stone pedestal holding the vault key (or empty once it has been taken). */
function drawKeyStand(g, hasKey) {
    shadow(g, 16, 5, 0.3);
    opoly(g, [-12, 0, -9, -26, 9, -26, 12, 0], 0x8a8478, 1.6);
    fpoly(g, [-12, 0, -9, -26, 0, -26, 0, 0], 0x9e988c);
    opoly(g, [-14, -26, -14, -31, 14, -31, 14, -26], 0xa8a294, 1.4);
    if (hasKey) {
        glow(g, 0, -40, 14, 0xffd84a, 0.16);
        ostroke(g, 2.4, 0xe8c040, () => { g.moveTo(-6, -40); g.lineTo(8, -40); g.moveTo(4, -40); g.lineTo(4, -36); g.moveTo(8, -40); g.lineTo(8, -36); });
        ink(g, 1.3); g.beginFill(0x000000, 0); g.lineStyle(3.6, INK, 0.95); g.drawCircle(-9, -40, 4); g.lineStyle(2.2, 0xe8c040, 1); g.drawCircle(-9, -40, 4); g.endFill(); noLine(g);
    }
}

/** A warlord's lair marker: a crooked pole with a horned skull, a torn banner and bones at its foot. */
function drawLairTotem(g) {
    shadow(g, 20, 6, 0.32);
    ink(g, 1.1); g.beginFill(0xe8e0c8); g.drawEllipse(-10, -3, 6, 2.4); g.drawEllipse(9, -2, 5, 2); g.endFill(); noLine(g);
    ostroke(g, 4, 0x5a3a22, () => { g.moveTo(-1, 0); g.lineTo(1, -40); g.lineTo(-1, -70); });
    opoly(g, [1, -58, 18, -56, 15, -44, 19, -32, 3, -36], 0x7a1a1a, 1.4);
    g.lineStyle(1, 0x3a0a0a, 0.7); g.moveTo(4, -50); g.lineTo(14, -48); noLine(g);
    // horned skull
    opoly(g, [-7, -72, -14, -86, -18, -80, -10, -70], 0xd8ccb0, 1.2);
    opoly(g, [7, -72, 14, -86, 18, -80, 10, -70], 0xd8ccb0, 1.2);
    ink(g, 1.4); g.beginFill(0xeee6d0); g.drawEllipse(0, -72, 9, 8); g.endFill(); noLine(g);
    opoly(g, [-5, -66, -5, -61, 5, -61, 5, -66], 0xd8ccb0, 1.1);
    g.beginFill(0x1a0a0a); g.drawEllipse(-3.4, -73, 2.4, 2.8); g.drawEllipse(3.4, -73, 2.4, 2.8); g.endFill();
    glow(g, 0, -73, 10, 0xff4a3a, 0.16);
    g.beginFill(0xff6a4a); g.drawCircle(-3.4, -73, 1); g.drawCircle(3.4, -73, 1); g.endFill();
}

/** A wooden signpost with two arrow boards, for road junctions by the towns. */
function drawSignpost(g) {
    shadow(g, 11, 4, 0.28);
    opoly(g, [-2.2, 0, -2, -50, 2, -50, 2.2, 0], 0x7a5230, 1.5);
    fpoly(g, [0.4, -50, 2, -50, 2.2, 0, 0.6, 0], 0x5a3a20);
    opoly(g, [-3, -46, 17, -46, 22, -41, 17, -36, -3, -36], 0xc89a5a, 1.5);
    fpoly(g, [-2, -45, 16.5, -45, 20, -41.5, -2, -41.5], 0xe0b878);
    opoly(g, [3, -31, -17, -31, -22, -26, -17, -21, 3, -21], 0xb88a4a, 1.5);
    fpoly(g, [2, -30, -16.5, -30, -20, -26.5, 2, -26.5], 0xd8ac6a);
    g.lineStyle(1, 0x5a3a1a, 0.8);
    g.moveTo(1, -41); g.lineTo(13, -41); g.moveTo(-1, -26); g.lineTo(-12, -26);
    noLine(g);
    g.beginFill(0x3a2a1a); g.drawCircle(0, -41, 0.9); g.drawCircle(0, -26, 0.9); g.endFill();
}

// ---------------------------------------------------------------- REGISTRY
export interface DecorDef { w: number; h: number; pad: number; r: number; solid: boolean; variants: ((g: any) => void)[] }
const D = (w: number, h: number, pad: number, r: number, solid: boolean, variants: ((g: any) => void)[]): DecorDef => ({ w, h, pad, r, solid, variants });
const flowerSets = [[0xff5a7a, 0xffe14d, 0xffffff, 0xff9ad0, 0xb48aff], [0xffffff, 0xffe14d, 0xffffff, 0xffe14d, 0xff9ad0], [0xb48aff, 0x7ab4ff, 0xffffff, 0xb48aff, 0x7ab4ff]];

export const DECOR_DEFS: Record<string, DecorDef> = {
    // field
    appletree: D(84, 104, 14, 13, true, [(g) => drawTree(g, 0x58b04a, { apples: true, seed: 3 }), (g) => drawTree(g, 0x4a9a3e, { apples: true, seed: 8 })]),
    birch: D(64, 96, 12, 8, true, [(g) => drawBirch(g, 0x9acb55, 5), (g) => drawBirch(g, 0xc8d65a, 12)]),
    flowerbed: D(44, 24, 8, 0, false, flowerSets.map((c) => (g) => drawFlowerbed(g, c))),
    haystack: D(48, 40, 10, 12, true, [drawHaystack]),
    tallgrass: D(40, 26, 6, 0, false, [(g) => drawTallGrass(g, 0x6ab84a), (g) => drawTallGrass(g, 0x8ac84a)]),
    scarecrow: D(60, 70, 10, 7, true, [drawScarecrow]),
    wheat: D(44, 34, 6, 0, false, [drawWheat]),
    // forest
    oak: D(84, 104, 14, 13, true, [(g) => drawTree(g, 0x34843e, { trunk: 0x5a3a1e, seed: 4 }), (g) => drawTree(g, 0x267238, { trunk: 0x5a3a1e, seed: 9 }), (g) => drawTree(g, 0x42923e, { trunk: 0x5a3a1e, seed: 13 })]),
    pine: D(64, 106, 12, 11, true, [(g) => drawPine(g, 0x2a6d47), (g) => drawPine(g, 0x36805a)]),
    bigmushroom: D(48, 44, 10, 9, true, [(g) => drawMushroom(g, 0xd23a3a, true), (g) => drawMushroom(g, 0x9a5a2a, false), (g) => drawMushroom(g, 0x8a4ac8, true)]),
    log: D(64, 30, 10, 14, true, [drawLog]),
    stump: D(36, 26, 8, 8, true, [drawStump]),
    fern: D(40, 26, 6, 0, false, [drawFern]),
    glowshroom: D(44, 34, 8, 0, false, [drawGlowShroom]),
    mossrock: D(52, 34, 12, 15, true, [(g) => drawRock(g, 0x7a8a7a, true, 0), (g) => drawRock(g, 0x6a7a6a, true, 1)]),
    // shared
    rock: D(52, 34, 12, 15, true, [(g) => drawRock(g, 0x8b8f99, false, 0), (g) => drawRock(g, 0x9a8f80, false, 1), (g) => drawRock(g, 0x7a8592, false, 0)]),
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
    beachrock: D(52, 34, 12, 15, true, [(g) => drawRock(g, 0xa8a0a0, false, 1), (g) => drawRock(g, 0x8a8a98, false, 0)]),
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
    house: D(116, 112, 14, 40, true, [
        (g) => house(g, 0xe2cfa6, 0xb5473b, 0x4a3826, 1), (g) => house(g, 0xd8d0c0, 0x3f6fa8, 0x3a3a46, 2), (g) => house(g, 0xe8c88a, 0x9a5a2a, 0x4a3826, 3),
        (g) => house(g, 0xdfd6bc, 0x3f8f7a, 0x3a3020, 4), (g) => house(g, 0xd9b890, 0xc88a3a, 0x5a3a1e, 5)]),
    tower: D(70, 140, 12, 22, true, [(g) => drawTower(g, 0xb8b0a0, 0x8a3a3a), (g) => drawTower(g, 0xc8a878, 0x4a6a9a)]),
    gate: D(190, 152, 16, 26, true, [(g) => drawGate(g, 0xb8b0a0, 0x8a3a3a), (g) => drawGate(g, 0xd8b888, 0x4a6a9a), (g) => drawGate(g, 0xe8e4d8, 0x3f6fa8)]),
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
    portal: D(72, 90, 12, 0, false, [drawPortal]),
    signpost: D(52, 58, 8, 0, false, [drawSignpost]),
    lairtotem: D(48, 92, 8, 8, true, [drawLairTotem]),
    vaultgate: D(130, 104, 12, 0, false, [(g) => drawVaultGate(g, true, false), (g) => drawVaultGate(g, true, true), (g) => drawVaultGate(g, false, false), (g) => drawVaultGate(g, false, true)]),
    lever: D(44, 50, 8, 0, false, [(g) => drawLever(g, false), (g) => drawLever(g, true)]),
    keystand: D(40, 56, 8, 0, false, [(g) => drawKeyStand(g, true), (g) => drawKeyStand(g, false)])
};
