// Monster portraits for the codex: each monster's sprite drawn once to an image and kept for the session.
import type * as PIXI from 'pixi.js';
import { EntityManager } from '../render/entities';

const cache = new Map<string, string>();

/** A data URL of the monster's sprite ('' when it cannot be drawn here). */
export function portrait(game: { app: PIXI.Application }, type: string): string {
    const known = cache.get(type);
    if (known !== undefined) return known;
    let url = '';
    try {
        const e = EntityManager.createEnemy(type, 0, 0) as PIXI.Container & { body: PIXI.Container };
        const canvas = game.app.renderer.extract.canvas(e.body) as HTMLCanvasElement;
        url = canvas.toDataURL('image/png');
        EntityManager.cleanup(e);
    } catch { url = ''; }
    cache.set(type, url);
    return url;
}
