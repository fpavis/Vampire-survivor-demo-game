// @ts-nocheck -- Pixi-bound renderer helper
// Names that float over the world: town NPC roles, the bounty board, monster level tags, an escorted villager.
// A name is drawn on its own texture at the size it ends up on the screen: the camera zoom is divided out of its scale
// (so it is as big at 0.8 as at 1.6) and the texture's resolution follows the screen's pixels and the text-size
// setting (so it stays crisp on a sharp display and under dynamic resolution, which lowers the renderer's own).
import * as PIXI from 'pixi.js';
import { FONT_UI } from '../ui/fonts';
import { access } from '../app/access';

export const LABEL_PX = 15;                  // a name's height on the screen at the standard text size
const live = new Set();
export const labelView = { scale: 1, res: 2 };

/** A floating name: bottom-centre anchored, outlined, with a soft shadow. */
export function makeLabel(text, fill, px = LABEL_PX) {
    const t = new PIXI.Text(text, {
        fontFamily: FONT_UI, fontWeight: '800', fontSize: px, fill,
        stroke: 0x0c0a12, strokeThickness: 2, lineJoin: 'round',
        dropShadow: true, dropShadowColor: 0x000000, dropShadowAlpha: 0.55, dropShadowBlur: 3, dropShadowDistance: 1, dropShadowAngle: Math.PI / 2
    });
    t.anchor.set(0.5, 1);
    t.resolution = labelView.res;
    t.scale.set(labelView.scale);
    live.add(t);
    return t;
}

/** Called once per rendered frame with the camera zoom and the renderer's resolution. */
export function tuneLabels(zoom, rendererRes) {
    const text = Math.min(1.4, Math.max(0.9, access.textScale));
    const scale = text / Math.max(0.1, zoom);            // on the screen: zoom x scale = the text size, whatever the zoom
    const res = Math.min(4, Math.max(1, Math.ceil(rendererRes * text * 2 - 0.01) / 2));
    const resChanged = res !== labelView.res;
    labelView.scale = scale;
    labelView.res = res;
    for (const t of live) {
        if (t.destroyed) { live.delete(t); continue; }
        if (resChanged) t.resolution = res;
        t.scale.set(scale);
    }
}

/** How many labels are alive (tests). */
export const liveLabels = () => [...live].filter((t) => !t.destroyed);
