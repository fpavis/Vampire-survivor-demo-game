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
    stats: { kills: s.kills, score: s.score, bossesDefeated: s.bossesDefeated },
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
      caches: [...game.session.caches]
    },
    quests: game.quests.serialize(),
    tips: [...game.tips.seen],
    regions: [...game.regionsSeen]
  };
}
