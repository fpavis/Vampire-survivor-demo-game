# Vision: a survivors-like Final Fantasy world

> **Status: living document, nothing here is implemented yet.**
> This is a captured stream of thought, meant to be revised many times. The goal is to find out what is
> possible, what is expensive, and what should be cut or reshaped before any code is written.
> Feasibility ratings are rough: **Easy** (days), **Medium** (a week or two), **Hard** (weeks, needs new
> architecture), **Risky** (could eat the project or may not fit a browser game).

Source material: the three Materia design notes (`materia-system-spec`, `MATERIA-BALANCE`, `MATERIA`) from the
Godot project. They are used as inspiration and adapted below; their Godot-specific parts (scenes, `.tres`,
Inspector tooling, agent portraits) are not carried over.

---

## 1. The pitch in one paragraph

A survivors-like (auto-attacking, swarm-fighting, level-up-card) game set in a persistent, procedurally
generated Final Fantasy style world: overworld, towns, dungeons, a quest line you may ignore, recruitable
party members you can switch between, and a fog-of-war map that rewards exploration. The world gets more
dangerous the farther you travel from the start. Combat stays survivors-like, but your attacks are **spells
that live on equipment**, level independently of you, and are reshaped by sockets full of **runes and gems**.
Your own level-ups are small stat cards that let you specialise (mana pool, cast speed, movement...).

## 2. Pillars

1. **Exploration first.** The map, fog of war, discovery and danger gradient are the main loop. Quests give
   direction; they never gate movement (Skyrim / Palworld style).
2. **Survivors-like moment to moment.** Auto-fire, crowds, dodging telegraphs, spectacle. No menu combat.
3. **Build-crafting through loot.** Spells are items. Runes change what an attack *does*. Two players should
   end up with visibly different attacks.
4. **Persistent world.** Seed-generated, but what you changed (cleared camps, opened chests, quest state,
   explored map) stays changed.
5. **Roleplay freedom.** Ignore the main quest, skip side quests, go live in a desert. The world still works.

## 3. What already exists (reusable)

| Area | Today | Reuse for the vision |
|---|---|---|
| World | Infinite chunked terrain from noise, 5 biomes, seed-based | Foundation. Needs regions, roads, difficulty field and named zones on top |
| Places | Caves, ruins, towns generated per cell, enterable, with chests / fountain / altar | Foundation for dungeons and cities. Needs multi-floor, NPCs, shops, quests |
| Map | Minimap + world map, remembers chunks the player has seen | Starting point for fog of war (currently chunk-granular, not saved) |
| Enemies | 18 types + 5 warlords, behaviour state machines, raycast + flow-field navigation | Strong base. Needs a level stat and zone-driven spawning |
| Combat | 5 hard-coded weapons with levels, 9 passives, card level-ups | Gets replaced by the spell/rune system and stat cards |
| Rendering | Pseudo-3D tilted ground, billboard sprites, procedural art | Keep |
| Save / quests / party / items / gold / dialogue | none | All new |

## 4. Feature breakdown and feasibility

### 4.1 World: regions, difficulty, persistence

**Wanted:** persistent procedural world; areas have a level; difficulty grows with distance from the start.

- **Difficulty field.** `zoneLevel(x, y) = base + distanceFromStart * k + regionNoise + biomeOffset`. Biomes get
  an inherent flavour (mountains hit harder than fields), so a hard region can sit close to start and an easy
  one far away if noise says so. *Easy.*
- **Named regions / kingdoms.** Voronoi-style cells over the biome map with generated names, a capital town,
  a dominant faction, a level band. Gives quests, dialogue and the map something to refer to. *Medium.*
- **Roads and rivers** linking towns, for FF overworld feel and as navigation hints. *Medium* (roads: path
  search over the tile grid between towns, drawn as ground decals).
- **Persistence model.** Do not save the world, save *deltas* over the seed: cleared camps, opened chests,
  dead named bosses, quest state, fog of war, NPC state, player and party. Everything else regenerates
  deterministically. *Medium.* Risks:
  - Any change to generator code changes old worlds. Needs a `generatorVersion` stamp and a policy (freeze
    old generator versions, or accept breaking saves while in development).
  - Storage: IndexedDB for the bulk (fog bitmaps can get large), localStorage for save metadata. Several
    save slots.
- **Open question:** should the world have an edge or truly be infinite? Infinite is already working, but
  "difficulty grows with distance" means the far world eventually becomes absurd. Possible answers: cap the
  level curve (soft cap), or make the far reaches a late-game endless mode.

### 4.2 Levels for player and enemies

- Enemies get a **level** from their zone, not from the player. This is a deliberate reversal of what the
  game does now (where enemy strength follows player level). It is what makes the world feel authored: you
  see a level-30 monster at level 5 and turn around.
- Damage / XP scaling by level difference (soft, so under-levelled players can still win with skill, and
  over-levelled players get less XP). Needs tuning. *Medium.*
- Survivors-like wave density still applies (ambient swarms), but there are also **fixed encounters**:
  camps, lairs, roaming elites, named bosses. Mixing "endless swarm" with "fixed placed content" is the main
  design tension of the whole project (see section 9).
- Loot has an **item level** from where it dropped (matches the Materia doc's "deeper territory improves
  rarity distribution").

### 4.3 Fog of war and map

**Wanted:** map and minimap with fog of war, so exploration matters.

- Per-tile (or per-2x2-tile) revealed bitmask per chunk, revealed in a radius around the player as they move,
  saved with the game. Unrevealed = black or parchment, revealed-but-not-visible = dimmed. *Medium.*
- Minimap and full map render from the same revealed data (the map module is already structured that way).
- Points of interest should *not* auto-appear when generated; they appear when seen, or when a quest / NPC /
  purchased map reveals them. Gives quests a purpose ("a hermit tells you about a ruin to the east").
- Cartographer NPCs sell regional maps (reveal fog). Landmarks (towers) reveal a region when climbed or
  activated. Both are cheap once fog exists. *Easy after fog.*
- Map markers: quest targets, player pins, discovered towns. *Easy.*

### 4.4 Quests

**Wanted:** quest-driven, but the player is free to ignore it, skip sidequests and roleplay.

- **Quest model:** `{ id, giver, state, objectives[], rewards, locations (resolved from the world), prerequisites }`
  with objective types: kill N of type, kill named boss, reach / discover a place, clear a dungeon, fetch an
  item from a dungeon chest, deliver an item, escort (hard), survive N minutes in a zone. *Medium* for the
  engine, with a journal UI and map markers.
- **Procedural placement.** Quest templates pick real places from the seeded world ("clear the ruin named
  Sunken Citadel, three days' walk east"). The main quest is a hand-written chapter skeleton whose locations
  are slotted procedurally. *Medium-Hard.* The hand-written part (story, dialogue) is the real cost.
- **Side quests / radiant quests** generated by templates at towns (bounty boards). *Medium.*
- **Roleplay support:** no quest ever blocks exploration; the main quest has no timer; towns work whether or
  not you did anything. Factions / reputation is a possible later layer. *Hard, optional.*
- **Requires new content systems:** NPCs with dialogue UI, towns that are more than decoration (inns, shops,
  quest givers), and **currency** (gold). None exist today. *Medium each.*

### 4.5 Party members

**Wanted:** party members you can switch between.

Several shapes, from cheapest to most expensive:

| Option | Description | Cost |
|---|---|---|
| A. Swap hero | You control one character at a time. Others are benched and gain XP slowly. Swapping has a short cooldown (tag-in effect). Each hero has own stat cards, spell slots, gear. | *Medium* |
| B. Followers | Benched / non-active heroes follow you as AI, auto-casting their own spells. You switch control between them. | *Hard* (AI control, hit detection per hero, perf) |
| C. Hybrid | Option A, plus a passive aura or one assist spell contributed by each benched member. | *Medium-Hard* |

Recommended starting point: **A**, designed so **C** can be added. It fits the existing single-player-entity
engine and keeps combat readable. Recruitment through quests and towns. Death rule to decide: game over only
when the active hero dies, or when the whole party is down (FF flavour)?

### 4.6 Player progression: stat cards

**Wanted:** level-ups give small, interesting stat upgrades; players specialise (mana pool, cast speed, move
speed...). Spells are *not* level-up rewards.

- Level-up offers cards from stat pools: mana pool, mana regen, cast speed, move speed, max health, defence,
  pickup range, crit, area / duration multipliers, resistances. *Easy* (the current card system already does
  this shape).
- **Specialisation:** group cards into 3 to 5 paths (for example Arcanist: mana / cast speed / spell power;
  Wayfarer: speed / pickup / stamina; Warden: health / defence / regen). Picking cards from a path raises the
  chance of cards from that path and unlocks path capstones at thresholds. *Medium.*
- **Mana** as an actual resource: spells cost mana, mana pool and regen are build axes. Decision needed: do
  spells auto-cast only when mana allows, or does mana only gate "ultimate" casts? (Auto-casting with a
  resource can feel bad when mana runs dry mid-swarm. See open questions.)
- Per-hero progression: each party member has own level and stat cards, maybe with class-flavoured pools.

### 4.7 Dungeons and cities

- **Cities:** today a single plaza. Wanted: districts, shops, inn (heals / saves), quest board, NPCs with
  dialogue, safe zone. *Medium-Hard* (mostly content and UI).
- **Dungeons:** today single-floor caves and ruins. Wanted: multi-floor, a boss at the end, keys / simple
  puzzles, level scaled to the zone, persistent clear state, unique loot. Floors are cheap with the existing
  interior generator (stairs between sources). *Medium.*
- **Fast travel** between discovered towns and waypoints (cuts backtracking in an open world). *Easy-Medium.*
- **Mounts / airship-style travel** for late game. *Medium, optional.*

### 4.8 Combat feel

Survivors-like combat stays, with these constraints from the new systems:

- Spells are auto-cast with cooldown (and maybe mana). Aiming is automatic (nearest target, or facing).
- The "interesting attacks" come from rune combinations (section 5), not from hand-written weapons.
- Spectacle has a budget: cap live spell entities and particles (the Materia notes already do: 192 visible
  spell objects, 320 particles, 32 afterimages). The web target makes this budget non-optional.
- Enemy telegraphs (already built) become more important once enemies have levels and bigger hits.

---

## 5. Spell system: adapting the Materia spec

The supplied spec is a procedural spell *construction* system: `Spell = Core + Expression + Modifiers + Trigger
+ Payload`, assembled on equipment with a socket graph, validated by capabilities, compiled to an event-driven
runtime. It is a strong fit for "spells are equipment, augmented by runes". It also has a lot of surface area.
Key adaptations proposed for this game:

### 5.1 Vocabulary mapping

| Vision term | Spec term | Notes |
|---|---|---|
| **Spell** (equipment, levels independently) | Board / equipment + its Core and Expression | The unit the player equips in a spell slot |
| **Rune** (changes behaviour) | Modifier, Trigger, Payload components | Seek, Split, Pierce, Bounce, OnHit, OnKill, child Area... |
| **Gem** (numeric augmentation) | *new, not in spec* | Pure stat sockets: power, cooldown, size, mana cost. Optional, see below |
| Spell levels / mastery | Component XP, growth points, milestones at 5/10/15/20 | Spell gains XP from use; own curve per archetype / rarity |
| Spell slots | Three slots unlocking at levels 1 / 10 / 20 | Re-tie to hero level or quests |

### 5.2 Three possible depths (pick one to start, keep the door open)

- **Depth 1: fixed-core spells.** A spell item *comes with* a Core + Expression (for example "Frost +
  Projectile") and N rune sockets (modifiers, triggers, payloads). The player only chooses runes. Simplest UI
  and the most readable for a first release. Internally still compiled to the graph runtime.
- **Depth 2: half-open.** The spell item's Core is fixed (the element identity), but the Expression socket is
  swappable. Gives meaningfully different delivery for the same element.
- **Depth 3: full spec.** Player slots Core, Expression, modifiers, triggers, payloads freely into an
  equipment topology (the Godot project's end state).

Recommendation: **build the runtime as the full graph/event system from day one** (it is the hard part to
retrofit), **ship the UI at Depth 1**, and widen toward Depth 3 only if it proves fun. This also means the
five current weapons become five *pre-built spell items*: Arcane Bolt = Arcane + Projectile; Spirit Blades =
Arcane + Orbit; Chain Lightning = Lightning + Arc/Chain; Frost Nova = Frost + Wave/Area; Meteor = Fire +
delayed Area with a falling visual.

### 5.3 Parts of the spec worth keeping as-is

- Rule list in section 25 of the spec: Core never defines delivery, Expression never defines damage type,
  modifiers never name concrete spells, compatibility by **capabilities** (`provides[]` / `requires[]`), a
  new archetype must automatically work with existing compatible components. This is what keeps the content
  scalable.
- **Event-driven runtime** (CAST, SPAWN, TICK, HIT, KILL, EXPIRE, BOUNCE). It maps cleanly to the existing
  update loops (projectiles, rings, meteors are already event-like).
- **Payload inheritance** (child expressions inherit the parent's Core unless overridden), **fractional
  counts** (`2.4` = two guaranteed, 40 percent for a third).
- **Procedural components from archetypes**: developer writes the archetype algorithm; the generator rolls
  parameters from a rarity budget with conserved total power (pairwise redistribution). Great for loot variety
  without writing items by hand.
- **Drops are never finished spells**: an empty board or a loose component.
- **Compile step** (validate, resolve inheritance, calculate complexity, build execution graph) so the UI
  graph is separate from runtime behaviour.

### 5.4 Parts to simplify or change for this game

- **Capacity / peg economy** (`sockets x (rarity+1)`). It is a good balance lever but a heavy thing to
  explain in a survivors-like where the player is mostly looking at the swarm. Proposal: show a single
  *complexity* bar per spell (spec section 14) and drop the per-rarity "pegs" until balance demands it.
- **Spell slots at levels 1 / 10 / 20** fit a single character; with a party they need re-thinking (slots per
  hero? shared pool?).
- **Agents / portraits / territory patrols** belong to the Godot game's strategy layer. Replaced here by the
  party-member system (4.5). Background-patrol forecasting from the spec has no equivalent.
- **Equipment topology as a gameplay axis** (linear vs branch vs tree, payload depth). Keep as the
  differentiator between equipment rarities; it is what stops high-rarity items being "same but bigger".
- **Gems vs runes:** the vision says "modified with gems" *and* "augmented with runes". Possible meaning: gems
  = numeric (small, always-useful), runes = behavioural (build-defining). Needs confirmation (open question
  in section 8). If merged, drop the gem concept entirely to save scope.

### 5.5 Technical considerations for the browser

- Runtime needs **object pooling** and hard caps on spawned entities from triggers (a Split + OnHit + Split
  chain is exponential). The spec's complexity limit plus a runtime entity budget handles this; both must
  exist.
- **Deterministic visual recipe** per compiled spell (the VFX section of the spec) is nice but optional; a
  small set of shared conventions per Expression family covers most of the value.
- Item and component data must be **serialisable and seedable**: store `(seed, archetype, level, xp, choices)`
  rather than full parameter blobs, regenerate on load. Matches how the world persistence should work.
- A **drag-and-drop socket UI** in PixiJS is the single largest UI task in the project (inventory, board
  graph, filters, details, mobile support). *Hard.* A simplified list-and-slot UI first is strongly
  recommended.

---

## 6. Feasibility summary

| Feature | Rating | Main cost |
|---|---|---|
| Difficulty by distance / zone levels | Easy | Tuning |
| Enemy level stat, level-difference scaling | Medium | Reworking current scaling, balance |
| Named regions, roads, rivers | Medium | World-gen work |
| World persistence (seed + deltas, save slots) | Medium | Save format, generator versioning |
| Fog of war + saved exploration | Medium | Per-tile reveal data, map UI |
| Quest engine + journal + map markers | Medium | Systems and UI |
| Quest *content* (main line, dialogue) | Hard | Writing, volume |
| Towns as living places (NPCs, shops, inn) | Medium-Hard | Content, UI, currency |
| Multi-floor dungeons with bosses | Medium | Generator extension |
| Stat-card specialisation paths | Medium | Design / balance |
| Mana resource and auto-cast rules | Medium | Needs a design decision |
| Party: swap-hero (option A) | Medium | Per-hero state, UI |
| Party: AI followers (option B) | Hard | AI, performance |
| Spell runtime (graph, events, triggers, payloads) | Hard | Core new engine |
| Procedural components + rarity budgets | Medium | Generator, balance |
| Spell / rune socket UI (drag and drop) | Hard | PixiJS UI |
| Spell XP and mastery curves | Medium | Balance |
| Full free-form spell building (Depth 3) | Hard | UI plus validation |
| Everything at once | **Risky** | Scope |

## 7. Suggested order of work (for discussion, not a commitment)

1. **Foundation that everything depends on:** save/load with seed + deltas; generator versioning; per-tile
   fog of war; zone-level / difficulty field; enemy level stat.
2. **Spell runtime:** event-driven graph engine with caps, port the five weapons onto it, level-up stat cards
   replacing weapon cards, mana decision.
3. **Items:** spell items, rune components, procedural generation, simple equip UI (list-and-slot).
4. **World content:** gold, NPCs, shops, inn, quest engine, journal, a first handful of quest templates.
5. **Dungeons:** multi-floor, bosses, unique loot.
6. **Party:** swap-hero, then recruitment, then possible follower AI.
7. **Polish and breadth:** regions and roads, fast travel, main questline, drag-and-drop board UI, more
   archetypes.

Reasoning: steps 1 and 2 are the parts that are painful to retrofit; the rest layers on top.

## 8. Open questions

**Combat and spells**
1. Does casting cost mana? If yes, what happens when mana is empty during a swarm (spells idle, cast slower,
   or fall back to a basic attack)?
2. How many spells at once, and are they all auto-cast, or can the player trigger some manually?
3. Gems vs runes: are they two different things (numeric vs behavioural), or the same? Start at Depth 1, 2 or
   3 (section 5.2)?
4. Do spells level only from use, or also from quests / items?

**World and difficulty**
5. Fixed zone levels (Skyrim-old-style, recommended) or enemies that also scale with the player?
6. Truly infinite world, or an edge / soft level cap?
7. Is there a consequence for exploring far above your level (death penalty, lost XP), or just danger?
8. Permadeath, respawn at last inn / waypoint, or game over?

**Party**
9. Swap-hero (A), followers (B) or hybrid (C)? What ends the run: active hero down, or whole party?
10. How many members, and do they have fixed classes or customisable stat paths?

**Quests and story**
11. How much authored story is wanted for the main line, and what tone (full Final Fantasy melodrama, or a
    lighter thread)?
12. Is reputation / factions in scope, or only quests and rewards?
13. Currency and shops: should gold exist, and can spells/runes be bought as well as dropped?

**Platform and scope**
14. Browser only, or also mobile with touch (affects the spell-board UI significantly)?
15. Art direction: stay fully procedural, or introduce hand-made sprites for key characters and bosses?
16. Audio is entirely absent today; is it in scope?

## 9. Known design tensions to watch

- **Endless swarm vs placed content.** Survivors-likes want constant pressure; exploration RPGs want quiet
  stretches and discovery. Likely answer: a danger-driven ambient density (low in safe zones, high in
  dangerous ones) plus fixed lairs and bosses.
- **Persistence vs procedural.** The more you let the player change the world, the more state you must save.
  Keep the delta model small and explicit.
- **Systems depth vs readability.** A powerful spell graph is invisible if the player cannot tell what a
  build is doing mid-swarm. Visual conventions per expression and capped spectacle matter as much as the
  engine.
- **Scope.** Each pillar alone (quests, party, spell crafting, persistence) is a project. The order in
  section 7 exists to keep every step playable.
