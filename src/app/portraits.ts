// @ts-nocheck -- game glue in the style of the other app systems
// Monster portraits for the codex: each monster's sprite drawn once to an image and kept for the session.
import { EntityManager } from '../render/entities';

const cache = new Map();

/** A data URL of the monster's sprite ('' when it cannot be drawn here). */
export function portrait(game, type) {
    if (cache.has(type)) return cache.get(type);
    let url = '';
    try {
        const e = EntityManager.createEnemy(type, 0, 0);
        url = game.app.renderer.extract.canvas(e.body).toDataURL('image/png');
        EntityManager.cleanup(e);
    } catch { url = ''; }
    cache.set(type, url);
    return url;
}
