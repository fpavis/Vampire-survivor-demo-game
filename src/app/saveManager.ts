import * as PIXI from 'pixi.js';
import { GENERATOR_VERSION, SAVE_VERSION, type SaveData } from '../core/save/schema';

/** Collects everything worth persisting from a running game (the world itself is regenerated from the seed). */
export function buildSave(game: any): SaveData {
  const s = game.state;
  let pos = { x: s.player.wx, y: s.player.wy };
  if (game.mode === 'interior' && game.interiorPoi) pos = { x: game.interiorPoi.ex, y: game.interiorPoi.ey + 34 };
  return {
    version: SAVE_VERSION,
    generatorVersion: GENERATOR_VERSION,
    seed: game.overworld.seed,
    createdAt: game.createdAt,
    savedAt: Date.now(),
    playSeconds: s.time,
    player: { ...pos, boat: game.boat ? game.boat.dockId : null },
    party: game.party.serialize(),
    inventory: {
      ...game.spells.serialize(),
      wallet: { ...s.wallet },
      lootFilter: s.lootFilter
    },
    stats: { kills: s.kills, score: s.score, bossesDefeated: s.bossesDefeated, byType: { ...s.byType }, distance: Math.round(s.distance), goldEarned: s.goldEarned, deaths: s.deaths },
    world: {
      clearedCamps: { ...game.session.clearedCamps },
      defeatedLairs: { ...game.session.defeatedLairs },
      places: JSON.parse(JSON.stringify(game.visited)),
      fog: game.fog.toJSON(),
      cities: game.session.cities.map((c: any) => ({ ...c })),
      lastCity: game.session.lastCity ?? null,
      claimed: { ...game.session.claimed },
      triggered: { ...game.session.triggered },
      gathered: [...game.session.gathered],
      shopSold: JSON.parse(JSON.stringify(game.session.shopSold)),
      towers: game.towers.serialize(),
      boats: JSON.parse(JSON.stringify(game.session.boats)),
      caches: [...game.session.caches],
      pins: (game.session.pins || []).map((p: any) => ({ ...p }))
    },
    quests: game.quests.serialize(),
    tips: [...game.tips.seen],
    regions: [...game.regionsSeen],
    codex: { monsters: [...game.codex.monsters], spells: [...game.codex.spells], runes: [...game.codex.runes] },
    ...(game.lastThumb ? { thumb: game.lastThumb } : {}),
    meta: game.mode === 'interior' && game.interiorName ? { place: game.interiorName, region: game.regionName || undefined } : { region: game.regionName || undefined }
  };
}

/**
 * A small picture of the game for the slot list: the world without the HUD, cropped to 16:9.
 * The canvas is read right after a render, so it works without preserveDrawingBuffer.
 */
export function captureThumb(game: any): string | undefined {
  const w = 192, h = 108;
  let rt: PIXI.RenderTexture | null = null;
  const hud = game.ui?.container;
  const was = hud ? hud.visible : false;
  try {
    // the scene is drawn straight into a small texture, so only 192 x 108 pixels are read back
    const app = game.app, sw = app.screen.width, sh = app.screen.height;
    const k = Math.max(w / sw, h / sh);
    rt = PIXI.RenderTexture.create({ width: w, height: h, resolution: 1 });
    if (hud) hud.visible = false;
    // screen filters work in screen space: the scaled-down thumbnail is drawn without them
    const draw = () => app.renderer.render(app.stage, { renderTexture: rt!, clear: true, transform: new PIXI.Matrix(k, 0, 0, k, (w - sw * k) / 2, (h - sh * k) / 2) });
    if (game.look) game.look.without(draw); else draw();
    return app.renderer.extract.canvas(rt).toDataURL('image/jpeg', 0.72);
  } catch { return undefined; }
  finally {
    if (hud) hud.visible = was;
    rt?.destroy(true);
  }
}
