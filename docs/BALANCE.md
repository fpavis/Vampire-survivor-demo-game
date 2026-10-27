# Balance notes

These notes list how strong the party gets, how fast, and which numbers to change. They started from the
Phase 11 playtest. Every number below is in code. The file and constant are named so a change is one edit plus a test
run.

## The playtest that started this (0.10.0)

| | Value |
| --- | --- |
| Play time | 43 minutes |
| Lands reached | level 29 |
| Active hero (five skills from level 1) | **level 97**, felt overpowered |
| Resting heroes (barely used) | levels **61** and **64** |
| Upgrades waiting | 37, none left to pick after level 60 |

Causes:

1. **XP ignored the hero's level.** A monster gave the same XP to a level 5 hero and a level 95 one. Its XP grows
   linearly with the land's level, while the XP needed per level grows only as about `level^1.55`. So a hero at the
   land's level needed only about 12 kills per level, at any depth.
2. **Resting heroes earned half of everything** with no limit, so they ran far ahead of the land as well.
3. **12 cards with 59 ranks in all.** Every level gives one pick, so the pool ran out at level 60. After that the
   picks piled up with nothing to spend them on.
4. **Big steps.** One rank of Might was +15% damage, and five ranks maxed it.
5. **Auras at 50%.** Two resting heroes with every card complete each lent half of their bonuses. The active hero
   reached damage ×2.5 and cooldowns ×0.4, the floor.

## The rules now (0.11.0)

### Experience against level (`src/core/hero/progression.ts`)

Every gem remembers the level of what dropped it. When it is collected, its XP is multiplied by
`xpLevelFactor(heroLevel, sourceLevel)`:

| Hero compared to the source | Factor | Constant |
| --- | --- | --- |
| below it | `1 + 0.04` per level, at most ×1.5 (catch-up) | `XP_LEVEL.catchUp`, `catchUpMax` |
| equal, up to 2 levels above | ×1 | `XP_LEVEL.free` |
| further above | `0.6` per extra level | `XP_LEVEL.decay` |
| far above | never below ×0.01 | `XP_LEVEL.floor` |

- **Who gets the factor:** the active hero and each resting hero, each by their own level.
- **Resting heroes:** they still get half (`BENCH_XP_SHARE`), so they stay near the land too.
- **Exempt:** quest rewards and the test tools carry no level, so they are paid as they are.
- **Where gems come from:**
  - kills: the monster's level;
  - a cleared place: its level, or the floor's level in a dungeon;
  - gems banked when leaving a place or floor: each keeps its own level.

`simulateLevel()` replays a run, and `tests/progression.test.ts` holds the results:

| Run (base XP 15, Wisdom ×1.3) | Old rule | New rule |
| --- | --- | --- |
| 3,500 kills, lands rising 1 → 29 (the playtest) | hero 100, resting 67 | hero ~36, resting ~34 |
| 3,000 kills, all at level 29 | — | about 40 |
| 20,000 kills, all at level 29 | — | about 50 (grinding gives little) |

The XP curve `xpForLevel` (`src/core/config.ts`) is unchanged. The level factor controls the pace; a steeper curve
changed the results by only a level or two.

### Passive cards (`src/core/hero/stats.ts`)

16 cards with 10 ranks each, 160 ranks in all. Levels 2 to 99 give 98 picks, so a card is always on offer until the
soft cap. Each step is about half the old one; a complete card ends near where an old complete card did.

| Path | Card | Per rank | At rank 10 |
| --- | --- | --- | --- |
| Arcane | Might | +8% damage | +80% |
| | Cast Speed | cooldowns ×0.96 | −34% |
| | Precision | +3% crit | +30% (plus 5% base) |
| | Reach (new) | +5% spell area | +50% |
| Vigor | Vitality | +12 max health | +120 |
| | Recovery | +0.3 HP/s | +3/s |
| | Armor | −3% damage taken | −30% (60% cap) |
| Wayfarer | Swiftness | +4% speed | +40% |
| | Magnet | +18% pickup range | +180% |
| | Wisdom | +6% XP | +60% |
| | Fortune (new) | ×1.06 drop chance | ×1.6 gold, material and skill drops |
| | Greed (new) | +8% coin value | +80% |
| Spirit | Reservoir | +10 max mana | +100 |
| | Wellspring | +1.25 mana/s | +12.5/s |
| | Thrift | −3% mana cost | −30% |
| | Persistence (new) | +6% duration | +60% |

What the new cards touch:

- **Reach:** widens novas, meteors, embers (trail), clouds, slams, wards (barrier) and the circle of orbiting blades.
- **Persistence:** lengthens embers, clouds, wards and Mending Light, and the burn and slow a hit leaves.
- **Neither:** works for towers, which cast with the plain numbers (`SpellSystem.resolved(item, true)`).
- **Fortune:** multiplies the gold, material and skill chances in `rollKillLoot`.
- **Greed:** applies when a coin is picked up (`Game.collect`).

**Mastery.** Once every ordinary card is complete, the offer is filled with endless mastery cards:

| Card | Per rank |
| --- | --- |
| Might | +2% damage |
| Vitality | +8 max health |
| Haste | cooldowns ×0.98, overall floor 0.3 |
| Greed | +3% coin value |

They are offered only when there aren't three ordinary cards left, so a level is never wasted.

**HUD.** The HUD card row shows the 8 highest ranks and "+N" for the rest. The game menu's Party page (C) lists
them all.

### Auras (`src/core/party/party.ts`)

| Constant | Was | Now |
| --- | --- | --- |
| `AURA_STRENGTH` | 0.5 | **0.25** |

- **What is shared:** a living resting hero lends a quarter of its own bonuses: damage, speed, regen, armor, mana
  regen, cooldowns, magnet, XP, and now area, duration, luck and gold.
- **Never shared:** max health and mana.
- **Floors and caps:** the party's cooldown floor stays 0.4 and armor stays capped at 60%.

### Old saves (save version 10)

`MIGRATIONS[9]` refunds every hero's picks as pending upgrades. Levels are kept. The first load shows "Passives were
rebalanced: upgrades refunded …" once. A level 97 save gets 96 picks into 160 ranks.

## The rest of the curve (unchanged)

| What | Where | Rule |
| --- | --- | --- |
| Land level | `core/world/difficulty.ts` | `1 + 0.0301·(distance − 80)^0.85`, ±3 by region, biome offset −1 to +2 |
| Monster health | `enemyHealthScale` | `1 + 0.18·(L−1) + 0.004·(L−1)²` (×9.6 at 30, ×25.5 at 60) |
| Monster damage | `enemyDamageScale` | `1 + 0.08·(L−1) + 0.001·(L−1)²` |
| Monster XP | `enemyXpScale` | `1 + 0.12·(L−1)`; elites ×3, bosses drop 10 gems of 1/6 |
| XP per hero level | `xpForLevel` | `18 + 11·(l−1) + 2.6·(l−1)^1.55`, ×1.14 per level past 99 |
| Spell level | `spellXpFor` | `18·level^1.55` kills; most spells max at 8 |
| Drops | `DROP_RATES` | gold 10%, material 1%, skill 0.1% per kill, more at higher levels and for elites |

## The power curve (`src/core/hero/powerCurve.ts`)

The curve uses a model hero:

- **Active hero:** puts every rank into Might, Cast Speed and Precision first, then the rest.
- **Resting heroes:** spread their ranks evenly.
- **Measure:** `cardDamageFactor = might × (1 + crit) / cooldown`, with auras included.
- **Left out:** spells, runes and towers. The model pins only the part that ran away.

| Lands | Kills | Hero / resting level | Card factor | Monster health | Factor ÷ health |
| --- | --- | --- | --- | --- | --- |
| 5 | 600 | 13 / 11 | 1.9 | ×1.8 | 1.08 |
| 10 | 1,200 | 17 / 16 | 2.3 | ×2.9 | 0.78 |
| 20 | 2,400 | 27 / 25 | 3.6 | ×5.9 | 0.61 |
| 30 | 3,600 | 37 / 35 | 4.3 | ×9.6 | 0.45 |
| 60 | 7,200 | 66 / 64 | 4.5 | ×25.5 | 0.18 |

The tests pin:

- the playtest run's factor under 4.5, and under 90% of what the old XP rule gives;
- no single level adding more than about a tenth;
- the last column falling: further out, monsters gain health faster than cards add damage. Spells, runes and
  towers make up the rest.

## Levers

| To change | Turn | Notes |
| --- | --- | --- |
| How far above the land heroes settle | `XP_LEVEL.free`, `XP_LEVEL.decay` | +1 `free` is about +1 level; decay 0.5 to 0.7 is about ±2 |
| How fast a late hero catches up | `XP_LEVEL.catchUp`, `catchUpMax` | |
| How far resting heroes lag behind | `BENCH_XP_SHARE` | Weak on its own: the level factor holds them near the land, so 0.25 instead of 0.5 costs them about one level |
| How strong a level feels | each card's `value(l)` in `CARDS` | Keep 10 ranks; change the step |
| How much resting heroes lend | `AURA_STRENGTH` | |
| Endless growth past the cards | the mastery cards' steps | |
| How much harder the lands get | `enemyHealthScale` and `enemyDamageScale` | The "Factor ÷ health" column is the quick check |

After a change, run `npx vitest run tests/progression.test.ts`. It prints nothing when the curve is inside its band
and names the broken expectation when it is not.

## Measuring in the game

- **Test tools.** Open them with the backquote key (`` ` ``), or the button on the test page. They can:
  - add XP (+1000 XP, +3 level-ups);
  - teleport by distance from the start (the panel shows the land's level next to the hero's);
  - max every spell's level, and give every spell and rune;
  - turn on god mode and run at ×2 or ×4 speed.
- **Training ground.** Every town has one, away from the fountain, with three dummies (for spells that hit
  several targets). Its meter shows:
  - damage per second over the last five seconds, the best rate, the total, and how many dummies were hit;
  - each skill on its own row, with its kind (zone, burn, echo, spark, burst, shards, linked, assist, tower;
    no label for a direct hit) and its share of the total;
  - a Reset button.

  Compare a spell's DPS before and after a rune or a card, not across sessions. Dummies have no armour and
  never die, so kill effects (Death Echo, Splinter, Resonance, Vampiric, Mana Siphon) never show there.
