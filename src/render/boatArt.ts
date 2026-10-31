// The player's boat: a back half (hull interior, mast, sail) drawn behind the hero and a front rim drawn over their legs.
import * as PIXI from 'pixi.js';
import { shade } from './decorArt';

const INK = 0x1a1520;

export function createBoat() {
    const back = new PIXI.Container();
    const front = new PIXI.Container();
    const wake = new PIXI.Graphics();
    wake.blendMode = PIXI.BLEND_MODES.ADD;

    const hull = new PIXI.Graphics();
    hull.lineStyle(2, INK, 0.9);
    hull.beginFill(0x7a5230);
    hull.drawPolygon([-36, -10, 36, -10, 46, -20, 38, -2, 20, 8, -20, 8, -38, -2, -46, -20]);
    hull.endFill();
    hull.lineStyle(0);
    hull.beginFill(0x9a6c40); hull.drawPolygon([-30, -10, 30, -10, 36, -14, -36, -14]); hull.endFill();       // inner deck
    hull.beginFill(0x4a2e18); hull.drawEllipse(0, -9, 26, 6); hull.endFill();                                   // dark well the hero stands in
    // mast and sail
    const mast = new PIXI.Graphics();
    mast.lineStyle(1.6, INK, 0.9);
    mast.beginFill(0x5a3a20); mast.drawRoundedRect(-2.5, -86, 5, 80, 2); mast.endFill();
    mast.lineStyle(1.6, INK, 0.9);
    mast.beginFill(0xf4efe0); mast.drawPolygon([4, -84, 38, -50, 4, -22]); mast.endFill();
    mast.lineStyle(0);
    mast.beginFill(0xd8d0bc); mast.drawPolygon([4, -84, 38, -50, 22, -50]); mast.endFill();
    mast.beginFill(0xc8402a); mast.drawPolygon([4, -62, 28, -42, 4, -40]); mast.endFill();
    mast.beginFill(0xe8b040); mast.drawPolygon([-2, -90, 12, -86, -2, -82]); mast.endFill();
    back.addChild(hull, mast);

    const rim = new PIXI.Graphics();
    rim.lineStyle(2, INK, 0.9);
    rim.beginFill(0x8a5c34);
    rim.drawPolygon([-44, -14, 44, -14, 38, -2, 20, 8, -20, 8, -38, -2]);
    rim.endFill();
    rim.lineStyle(0);
    rim.beginFill(0xffffff, 0.18); rim.drawPolygon([-42, -13, 42, -13, 40, -10, -40, -10]); rim.endFill();
    rim.lineStyle(1.2, 0x3a2410, 0.8);
    for (const x of [-26, -12, 2, 16, 30]) { rim.moveTo(x, -14); rim.lineTo(x * 0.85, 7); }
    rim.lineStyle(0);
    rim.beginFill(0xe8b040); rim.drawCircle(-40, -16, 3); rim.drawCircle(40, -16, 3); rim.endFill();
    front.addChild(rim);
    return { back, front, wake };
}
