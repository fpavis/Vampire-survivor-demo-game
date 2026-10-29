import * as PIXI from 'pixi.js';
import { DECOR_DEFS } from './decorArt';
import './towerArt';   // registers the tower sprites in DECOR_DEFS

export type DecorTextures = Record<string, { texture: PIXI.Texture; anchorY: number }[]>;

export function bakeDecorTextures(app: PIXI.Application): DecorTextures {
    const out: DecorTextures = {};
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
