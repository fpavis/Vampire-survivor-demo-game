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
    player: pos,
    hero: {
      level: s.level,
      experience: s.experience,
      nextLevel: s.nextLevel,
      health: Math.max(1, s.health),
      mana: Math.round(game.spells.mana.value),
      pendingPicks: s.pending,
      wallet: { ...s.wallet },
      lootFilter: s.lootFilter,
      picks: { ...s.picks },
      ...(({ spells, runes, auto, active }) => ({ spells, runes, auto, active }))(game.spells.serialize())
    },
    stats: { kills: s.kills, score: s.score, bossesDefeated: s.bossesDefeated },
    world: {
      clearedCamps: { ...game.session.clearedCamps },
      defeatedLairs: { ...game.session.defeatedLairs },
      places: JSON.parse(JSON.stringify(game.visited)),
      fog: game.fog.toJSON(),
      cities: game.session.cities.map((c: any) => ({ ...c }))
    }
  };
}
