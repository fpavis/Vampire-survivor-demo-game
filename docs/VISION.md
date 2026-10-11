# Vision: a survivors-like Final Fantasy world

> **Status: living document, nothing here is implemented yet.**
> Revision 3. Captures the creative direction as a stream of thought, now including two rounds of
> decisions. The technical plan lives in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). The goal is to find out what is possible, what is expensive, and what to cut or reshape before
> code is written.
> Feasibility ratings are rough: **Easy** (days), **Medium** (a week or two), **Hard** (weeks, needs new
> architecture), **Risky** (could eat the project or may not fit a browser game).

Source material: the three Materia design notes (`materia-system-spec`, `MATERIA-BALANCE`, `MATERIA`) from the
earlier Godot project. They are adapted below. The Godot-specific parts (scenes, `.tres`, Inspector tooling,
agent portraits, territory patrols) are not carried over, and a key lesson is recorded: the Godot spell
system was too complicated and unwieldy (see section 6).

---

## 1. The pitch

A survivors-like (auto-attacking, swarm-fighting, stat-card level-ups) set in a persistent, procedurally
generated old-school Final Fantasy world: overworld, towns, dungeons, a main quest about heroes killing evil
demons to save the world that the player may ignore, a party of heroes with their own loadouts who can be
switched on the fly (and who are useful even when benched), a fog-of-war map, and **towers** the player builds
to defend and reshape the world. Attacks are **spells that live on equipment**, level independently of the
hero, and are reshaped by sockets full of **runes**. The hero's own level-ups are small stat cards.

## 2. Pillars

1. **Exploration first.** Map, fog of war, discovery and a danger gradient are the main loop. Quests give
   direction but never gate movement (Skyrim / Palworld style).
2. **Survivors-like moment to moment.** Auto-fire, crowds, dodging telegraphs, spectacle.
3. **Build-crafting through loot.** Spells are items; runes change what an attack does.
4. **Persistent world.** The world is generated once per playthrough and stays the same. What you change
   stays changed.
5. **Roleplay freedom.** Ignore the main quest, skip side quests, build a fortress in a desert.
6. **Readable and quick to change.** Complex underneath, simple to operate. Changing a build must never feel
   like a chore.

---

## 3. Decisions so far

These are the answers from the first review round. They can still be revised.

| Topic | Decision |
|---|---|
| World | Generated once per playthrough from a seed, then stays the same. Only changes (deltas) are saved. |
| Loot | Items drop at **low probability**. **Spell items and runes mostly come from dungeons.** |
| Party | **Hybrid (option C):** each hero has their own loadout, you switch heroes, benched heroes are *not* useless and can be specced as fully passive units (auras etc). |
| Mana | Works like **stamina**: dash, teleport, shield. **Autofire spells are never limited by mana.** |
| Active skills | Besides autofire, the player can trigger **active skills** manually. |
| Spell system | The recommendation is accepted: build the full graph/event runtime, ship a simple UI (depth 1), widen later. |
| Levels | Level cap feel of **99**, then a **soft cap** with exponentially growing XP requirements. |
| Story | Old FF style: heroes kill evil demons to save the world. Build the **framework** now, flesh out later. |
| Sound | **In scope.** |
| UI | Must be **readable and intuitive**. **Drag and drop is required.** QoL features expected. |
| Compatibility | Runes are **auto-checked**: incompatible runes **cannot be socketed**. |
| Level-up popups | **Out of the way, never interrupting gameplay flow.** |
| New feature | **Towers**: placeable structures that autofire with spells, create wards, and modify the world (for example making a mountain climbable). |
| **Round 3** | |
| Towers | **Monumental achievements**: very expensive, **no limit on count (resources are the only cap)**, **permanent once built**. Includes a **dock** to build a **boat** and cross the deep sea. |
| Resources | **Gold** (merchants), **wood, stone, iron** (building). |
| Gems | **Runes only.** No separate gems. |
| Spell shops | **Yes**, spells and runes can be bought. Gold and shops must exist. |
| Drop rate | Base **0.1** for normal enemies, higher for higher-level and stronger monsters, but **not so high that the inventory floods** with items to inspect. **Skills are rare, valuable and sought after**, and getting a new one must feel rewarding. |
| Loadouts | **The hero party acts as the loadouts**: switching heroes is fast (low cooldown). **Changing skills and runes is only possible in safe moments.** |
| Terrain | **Surface effects**: lava, poison swamp and similar that damage over time, speed up or slow down players and/or enemies, slowly heal, boost mana regen or fire rate, trigger events when stepped on (monster wave, unlock an area), and **claimable areas** you hold for a while. |
| Hero death | Only the **active hero can be damaged**. A dead hero **cannot be used until rested in a city**. If the whole party is down: **death screen, respawn at the nearest visited city or the start area**. |
| Enemy level | **Depends only on the area (distance from start)**, not the player. The **distance is large** and the **increase is gradual** (slow incline outwards). **Higher-level monsters come with biome change.** |
| Enemy perception | Enemies have a **limited, per-type view distance** and cannot see the player from far away. **Monsters from different biomes must no longer all converge on the player.** |
| Tech | **TypeScript is allowed.** Framework recommendations welcome (see the implementation plan). |

---

## 4. What already exists (reusable)

| Area | Today | Reuse for the vision |
|---|---|---|
| World | Infinite chunked terrain from noise, 5 biomes, seeded | Foundation. Needs regions, roads, difficulty field, plateaus |
| Places | Caves, ruins, towns generated per cell, enterable, chests / fountain / altar | Foundation for dungeons and cities |
| Map | Minimap + world map, remembers chunks seen | Start of fog of war (not saved, chunk-granular) |
| Enemies | 18 types + 5 regional warlords, behaviour state machines, raycast + flow-field navigation | Strong base. Needs level stat, zone spawning |
| Combat | 5 hard-coded weapons, 9 passives, card level-ups | Replaced by the spell/rune system and stat cards |
| Rendering | Pseudo-3D tilted ground, billboard sprites, procedural art | Keep |
| Save / quests / party / items / gold / dialogue / audio / towers | none | All new |

---

## 5. Systems

### 5.1 World, difficulty, persistence

- **Difficulty field:** `zoneLevel(x, y) = base + distance * k + regionNoise + biomeOffset`. Enemies take
  their level from their zone, **not** from the player (a reversal of today's behaviour). *Easy* for the
  field, *Medium* for reworking enemy scaling.
- **Named regions** (kingdoms): Voronoi-style cells over the biome map, with names, a capital, a level band.
  *Medium.* **Roads and rivers** linking towns. *Medium.*
- **Persistence = seed + deltas.** The world never gets re-rolled. Saved deltas: cleared camps, opened chests,
  dead named bosses, quest state, fog of war, NPC state, **placed towers and the terrain edits they cause**,
  party, inventory. *Medium.* Risks:
  - Generator changes alter existing worlds. Needs a `generatorVersion` stamp: old saves keep running on
    the generator version they were created with (or saves are allowed to break during development only).
  - Storage: IndexedDB for bulk data (fog bitmaps, deltas), several save slots, export / import of saves.
  - Autosave on safe events (entering towns, leaving dungeons, quest steps) plus manual save at inns.
- **Level curve beyond 99** (decided): XP to next level grows polynomially up to 99, then exponentially:
  `xp(L) = base(L)` for `L <= 99`, `xp(L) = xp(99) * g^(L - 99)` after, with `g` about 1.10 to 1.20.
  Stat cards keep being offered past 99, but the exponential cost makes each further level a rare event
  (a long-term endgame sink rather than a wall). *Easy.*
- **Infinite world vs the difficulty gradient (decided in principle):** enemy level depends only on distance
  from the start, with a large scale and a gentle incline (concrete curve in the implementation plan). The
  level keeps growing slowly past the level-99 mark; whether to hard-soft-cap it remains a tuning choice.

### 5.2 Loot and economy

- **Overworld drops are rare** (low probability), mostly consumables, gold, crafting bits. **Dungeons are
  where spell items and runes come from:** chests, rooms, mini-bosses, final bosses with guaranteed picks.
  This ties directly into the pillar "exploration first" and makes dungeons the progression spine.
- Item level comes from the zone / dungeon level; rarity distribution improves with depth (as in the Materia
  notes). Every dropped component starts at level 1 and levels through use.
- **Gold exists and merchants sell spells and runes** (at high prices, with limited and rotating stock), as
  well as consumables and services. Dungeons still carry the guaranteed and best finds. *Medium.*
- Chest rewards go to the **inventory**, not a forced popup (see 5.8).

### 5.3 Party: hybrid, with a useful bench

Each hero has their own level, stat cards, spell loadout and equipment. You control one at a time and can
switch. Benched heroes are not dead weight:

- **Switching:** instant or with a short cooldown, with a brief tag-in effect. Possible bonus on tag-in
  (small shield or a free cast) to make switching feel good rather than punishing.
- **Bench roles** (chosen per hero, part of how you "spec out each for a specific purpose"):
  - **Aura:** fully passive unit. Provides the party an aura scaled by *their* stats and gear (damage, speed,
    regen, pickup range, resistances, mana regen...). Never acts, never gets hit, cannot die.
  - **Assist:** contributes one support spell at reduced power while benched (auto-cast, no aiming).
  - **Reserve:** gains XP faster and heals while waiting, ready to be swapped in.
  - The same hero can be an active fighter in one situation and an aura bearer in another (loadouts are
    swappable, see 5.7 and 5.8).
- **Specialisation:** each hero's stat-card pools are weighted by class (tank, striker, support, mage...), so
  heroes naturally lean toward roles, and an "aura specialist" has a pool with aura strength, aura radius and
  aura cooldown-style cards.
- **Recruitment:** through quests, towns and dungeons.
- **XP sharing:** benched heroes gain a reduced share so no hero is left behind.
- **Death (decided):** only the **active hero can be damaged**; benched heroes are untouchable. When the
  active hero dies they are **unusable until rested in a city**, and control passes to the next living hero.
  When **every hero is down** the **death screen** appears with **respawn at the nearest visited city (or the
  start area)**. Resting at a city inn revives and heals the party.
- **Heroes act as loadouts:** a hero swap is fast (short cooldown) and *is* how you change spell sets in
  combat. **Editing spells and runes is only allowed in safe moments** (no hostiles aggroed nearby and no
  recent combat, or inside safe zones, towns and towers).
- *Cost:* *Medium-Hard.* Per-hero state, UI, aura system, switching rules. Because benched heroes do not
  occupy the battlefield, there is no follower AI or extra collision cost. This is why option C is the
  right middle ground.

### 5.4 Mana as stamina, and active skills

- **Autofire spells have no mana cost.** They run on cooldown only. This keeps the survivors-like core loop
  smooth even at low mana.
- **Mana is the stamina bar** for *active* abilities: **dash, teleport/blink, shield/barrier**, and other
  player-triggered spells. Mana pool and regen become real build axes through stat cards (mana pool, regen,
  mana-cost reduction).
- **Active skills** are spells (same item / rune system) that are bound to manual inputs (keys, buttons,
  touch). In the spell model they are simply spell items with a **trigger mode**: `AUTO` or `ACTIVE`.
  Mobility (dash, blink, barrier) can be implemented as spell Expressions that act on the caster, so runes
  work on them too (a dash that leaves a fire trail, a shield that explodes when it expires).
- Slot structure to decide: N autofire slots plus M active slots per hero. Starting suggestion: 3 auto + 3
  active, with active slots unlocking through levels or quests.
- *Cost:* *Medium.* Mostly input handling, UX for active skills (cooldown/mana display) and balance.

### 5.5 Stat cards and levelling

- Hero level-ups give small stat cards, no spells. Pools: mana pool, mana regen, cast speed, move speed,
  max health, defence, pickup range, crit, area / duration multipliers, resistances, aura power.
- **Specialisation paths** (3 to 5 per hero, class-flavoured): picking cards from a path biases future
  offers and unlocks path capstones at thresholds.
- Levels to 99 and beyond as in 5.1.
- **Non-interrupting presentation** (see 5.8): cards queue up and are chosen when the player wants.
- *Cost:* *Easy-Medium.* The current card system already has the right shape.

### 5.6 Fog of war and map

- Per-tile (or 2x2) revealed bitmask per chunk, revealed in a radius as the player moves, saved with the
  game. Unrevealed = dark, explored-but-not-visible = dimmed. *Medium.*
- Minimap and world map render from the same data (the map module already works this way).
- POIs appear **when seen**, not when generated. Quests, NPC rumours and purchased maps can reveal them early.
- Cartographers sell regional maps; **light towers / beacons** (see 5.9) can reveal fog, which gives towers
  an exploration use. Map markers for quests and player pins. *Easy after fog exists.*

### 5.7 Spell system (adapted Materia)

Vocabulary mapping:

| Vision | Spec |
|---|---|
| **Spell item** (equipment, own levels) | Board + its Core and Expression |
| **Rune** (changes behaviour) | Modifier, Trigger, Payload components |
| Spell mastery | Component XP, growth points, milestones at levels 5/10/15/20 |
| Mode | New: `AUTO` or `ACTIVE` (5.4) |

**Depth 1 for the UI, full graph for the runtime** (decided):

- A spell item **comes with a Core + Expression** (for example Frost + Projectile, or Arcane + Dash) and
  **N rune sockets**. The player chooses runes. Internally every spell is compiled into the event-driven
  graph (CAST, SPAWN, TICK, HIT, KILL, EXPIRE, BOUNCE), so opening up to depth 2/3 later does not require a
  new engine.
- The current five weapons become five pre-built starter spell items (Arcane Bolt, Spirit Blades, Chain
  Lightning, Frost Nova, Meteor).
- **Where they come from:** dungeons mostly (5.2). Overworld drops are rare.

**Lessons from the Godot version (spell system was too complicated and unwieldy).** Design rules for this one:

1. **Few visible concepts.** Spell + runes. Hide the graph; show a list of sockets with plain-language effect.
2. **Compatibility is enforced, not explained after the fact.** Incompatible runes are greyed out in the
   inventory when a socket is selected, cannot be dropped into it, and a tooltip says *why* ("needs a
   projectile"). See 5.8.
3. **Swapping must be quick.** One drag, one click, or one hotkey. Saved **loadout presets** per hero
   (for example "swarm", "boss", "travel") that can be applied in one action, and a quick-swap that works
   outside combat (and possibly a limited one in combat).
4. **Instant feedback:** a live **spell preview** (a training dummy next to the board) that fires the spell
   as you edit it, with plain numbers (damage, cooldown, entities spawned).
5. **No capacity micro-math.** Replace the Godot peg economy with one **complexity bar** per spell (spec
   section 14). Detailed peg-per-rarity accounting is dropped until balance demands it.
6. **Safe by default:** no way to build an invalid spell; no way to lose items by accident (undo, and removed
   runes always return to the inventory).
7. **Numbers stay legible:** keep rune parameters few and meaningful (strength, range, rate).

Keep from the spec: capability-based compatibility (`requires[]` / `provides[]`), event-driven runtime,
payload inheritance of Core, fractional counts (`2.4`), procedural components from archetypes with rarity
budgets, drops are loose components or empty boards (never finished skills), compile step separate from the
UI graph. **Gems vs runes** (numeric vs behavioural sockets): still undecided, recommended to start with runes
only and add numeric gems only if progression needs them.

Technical notes: object pooling and hard entity caps (a Split + OnHit chain is exponential); runtime entity
budget plus complexity limit; items serialised as `(seed, archetype, level, xp, choices)`; a deterministic
visual recipe per compiled spell is optional. *Cost:* runtime *Hard*, generator *Medium*, UI *Hard*.

### 5.8 UI and quality of life

Principles: readable first, no hidden state, everything a hero's build needs on one screen.

- **Drag and drop (required):** inventory to socket, socket to socket, socket back to inventory, spell item
  to spell slot, hero cards between party and bench, tower spell items. Every drag shows a ghost, valid
  targets highlight, invalid targets are dimmed. Click-to-select plus an "equip" button remain for touch and
  accessibility. Drags never leave the inventory in a half-changed state (cancel, rollback).
- **Auto compatibility checking:** with a socket selected the inventory shows only compatible runes
  (with a toggle for the full list), incompatible ones cannot be dropped, and hover explains the reason.
- **Level-up that does not interrupt the game:**
  - Gaining a level does not pause or open a modal. A small non-blocking notification appears (icon plus a
    "pending picks" counter), with a subtle sound.
  - The player picks stat cards from a compact side panel or a pause menu tab when they like, or presses a
    key to open a quick-pick overlay that *may* pause (user setting).
  - Optional auto-pick per hero ("pick from my preferred path") for players who want zero interruption.
  - The same pattern applies to chest and quest rewards: items land in the inventory, never a forced popup.
- **QoL list:** loadout presets, compare tooltips (equipped vs hovered), search / filter / sort, favourite and
  lock, one-click "equip best", undo, item level and rarity colours with shape cues (colour-blind safe), UI
  scale setting, rebindable keys, controller support, touch-friendly sizes, clear cooldown / mana displays,
  damage number density options, screen shake and flash toggles, tooltips with plain language.
- *Cost:* *Hard*, and the single biggest UI task. Build it with a small reusable PixiJS UI toolkit (panels,
  scroll lists, drag manager, tooltips) before building screens.

### 5.9 Towers (new)

Player-built structures that either fight, protect, or change the world. A tower-defence layer on top of the
survivors-like core.

**Categories**

| Category | Behaviour | Examples |
|---|---|---|
| **Turret** | Autofires. Holds one or more **spell items with runes**, using the same spell runtime as heroes (owner type = tower). | Arcane tower, frost tower, lightning spire |
| **Ward** | Area protection: a shield dome or field that repels or weakens enemies, protects a base or a town. | Warding obelisk with a barrier |
| **Terrain / traversal** | Modifies the world. | **Climbing anchor** or lift tower placed near a mountain that opens a route to the **plateau**; bridge tower over water; path clearer |
| **Utility** | Supports exploration and the party. | Light tower / beacon (reveals fog), waypoint for fast travel, healing totem, aura pylon (can hold a benched hero's aura?) |
| **Harbor** | A **dock** on the shore where you build a **boat** to cross deep water. | Dock, boat, later bigger ships. Opens islands and sea content. |

**Mechanics to decide**

- **Cost and resources (decided):** towers are **monumental achievements**. They cost **large amounts of
  wood, stone and iron** (plus gold for the bigger ones). Resources are the **only** cap: **no limit on how
  many** can be built. They are **permanent**: once built they cannot be demolished, moved or refunded.
  Towers are also a **sink for spell items** (a spare spell can power a tower).
- **Construction as an event:** a tower is a **construction site** you stock with resources over time and
  that completes with a short ceremony (and possibly a defend-the-site encounter), so building one feels
  like an achievement rather than a menu click.
- **Placement UI:** build mode, ghost preview on the tile grid, validity colouring (terrain, distance to
  other towers, minimum distance from towns), cancel / refund.
- **Limits:** none by count (decided). Resource cost is the balance lever, so costs must scale so that a
  large tower network is a long-term investment. Performance is protected by sim-level culling (towers far
  from the player update at a low rate).
- **Threat:** since towers are permanent, they are **indestructible** in the recommended design (no loss
  spiral). Pressure comes from events that *disable* a tower temporarily, or from enemies that ignore
  them. Upgrades (levels, extra spell slots) are possible. Needs a decision (open question).
- **Persistence:** tower position, level, loadout and health are part of the saved world deltas.

**The dock and boat.** Deep water is currently a solid wall. With a dock, a boat becomes a vehicle that can
traverse deep water: the player boards at the dock, the boat is a moving platform with its own collision rules
(deep and shallow water allowed, land not), the hero can still cast from the boat, and sea chunks get their
own content (islands, sea POIs, sea enemies such as jellies, gulls and later krakens). The dock is a world
delta (persistent). *Medium-Hard:* movement mode switching, boat entity, water-aware navigation, sea content.

**The mountain-climbing tower in detail.** Mountains are currently solid walls. A *plateau* would be an
elevated region behind or inside a mountain range that is unreachable by default. Cheapest viable design: the
generator marks specific **wall tiles** as "climbable anchors"; a plateau region behind them (a walkable
sub-area with its own loot, nests and views); placing a Climbing Tower on an anchor converts a set of wall
tiles into walkable ramp / stair tiles, saved as a tile-delta overlay. This reuses the existing tile data and
renderer. A true second height layer (walking *over* things, enemies on two levels) is much more expensive
and not needed for the first version.

**Feasibility**

- Turret towers: *Medium* once the spell runtime exists (it is mostly "another caster entity").
- Ward / shield dome: *Medium.*
- Beacon / light tower revealing fog, waypoint: *Easy-Medium* (needs fog and fast travel).
- Climbing tower with plateau: *Medium-Hard* (plateau generation, tile delta overlay, navigation rebuild).
- Bridge tower over water, terrain edits in general: *Medium-Hard* (generic "tile delta" system makes all of
  these variations of the same feature).
- Siege / tower-defence events and enemy targeting of towers: *Hard-ish* (enemy AI work).
- **Risks:** towers can trivialise the game (balance), tower entities cost performance, and persistent world
  edits increase save size and generator-versioning pressure.

### 5.9b Terrain surfaces and claimable areas (new)

A **surface layer** on top of the biome: every tile can carry a surface (lava, poison swamp, ice, quicksand,
healing spring, mana well, haste road...) that affects entities standing on it.

| Effect | Targets | Example surfaces |
|---|---|---|
| Damage over time | player, enemies, or both | lava, poison swamp, thorns |
| Slow / speed up | player, enemies, or both | mud, swamp, ice, road, haste glyph |
| Slow healing | player (maybe enemies) | healing spring |
| Mana regen boost / fire-rate boost | player | mana well, arcane glyph |
| **On-step trigger** | player | monster wave, unlock a gate, open a vault, start an encounter |
| **Claimable area** | player | hold out inside the area while a bar fills (waves optional), then the area is **claimed** |

- Immunities: fire enemies ignore lava, swamp creatures ignore poison. Surfaces are data (`SurfaceDef`) with
  target filters, so adding a surface is a data change.
- **Enemy AI awareness:** ground enemies avoid damaging surfaces in the flow field (extra path cost) unless
  immune. Flying enemies ignore surfaces.
- **Claimed areas** are saved as world deltas and can give lasting benefits: a safe zone, a build site for
  towers, passive buffs, a fast-travel point, fog reveal.
- **Biome and tier flavour:** swamp surfaces in forest, lava and ice in mountains, quicksand in desert,
  tidal pools on the shore; harsher surfaces appear at higher zone levels.
- *Cost:* surfaces and effects *Medium*; hazard-aware AI *Medium*; trigger and claim zones *Medium*.

### 5.9c Resources and gathering (new)

- **Gold:** earned from enemies, chests, quests; spent at merchants (spells, runes, consumables, services,
  inns, maps).
- **Wood, stone, iron:** needed for towers (and later crafting). Gathered from **resource nodes** in the
  world: trees (wood), rocks (stone), ore deposits (iron, mountains and hills), plus occasional drops.
  Gathering is an interaction (hold to harvest) so it fits an action game; depleted nodes are world deltas
  (with an optional long respawn).
- **Stackable and auto-collected:** resources and gold go straight to the wallet and never occupy
  inventory slots. This is the key to avoiding inventory spam.
- *Cost:* *Medium* (nodes, gathering interaction, wallet UI, deltas).

### 5.9d Loot rules (new)

At survivors-like kill rates (about 60 to 250 kills per minute) a flat 10 percent chance of an *item* per
kill would produce **6 to 25 items per minute**, which is exactly the inventory flood to avoid. So the rule
proposed is:

- The **0.1 base roll** is the chance that a kill drops **something**, scaled up by monster level and
  strength. Most of what drops is **stackable and auto-collected** (gold, wood, stone, iron, consumables).
- **Runes and spell items are a separate, much rarer roll** (a small fraction of drops). Dungeons, chests
  and bosses carry the guaranteed and better ones; merchants sell some at high gold prices.
- **Skills are the rare, valuable chase.** A new spell item gets a **rewarding acquisition moment**: a
  light-beam drop, a distinct sound, a short non-blocking reveal card, a codex entry, and a first-cast
  showcase on equip. Duplicates and unwanted items **auto-salvage** into resources by a loot filter.
- Loot filter and salvage rules are a QoL feature, not an afterthought.
- *Needs confirmation:* is the 0.1 meant as "10 percent a kill drops anything" (as modelled above)?

### 5.9e Enemy perception and zone ownership (new)

Today monsters spawn around the player and chase from anywhere, so earlier biomes follow you into new ones.
Revised model:

- Enemies have a **`sightRange` per type** (for example bats 500, golems 260, boars 340), a lose-track range
  and a short memory. They **idle, wander or sleep** until the player is inside their sight range, and give
  up and return home when the player escapes.
- Every monster has a **home position and leash radius**, so a field monster does not follow you across a
  biome border. Groups share alerts to keep the swarm feel inside an area.
- **Resident population:** monsters belong to their zone (seeded camps, lairs, roamers), with a danger-driven
  density. Cleared camps stay cleared (world delta, optional long respawn). This replaces the
  "everything chases you forever" ambient spawn.
- **Enemy level is a pure function of the area** (distance from the start with regional variation), with a
  large distance scale and a gentle incline. **Higher tiers change the biome and roster**: each biome has
  tier variants (for example Verdant Fields, then Blighted Plains, then Ashen Wastes) with stronger species,
  and harsher surfaces. See the implementation plan for the curve.
- *Cost:* *Medium* (perception layer exists conceptually in the AI; population and leash are new).

### 5.10 Quests and story

- **Story framework (old FF style):** a world threatened by an **evil demon host**. A prologue, a gathering of
  heroes, a series of **demon lords / generals** each holding a region (and a dungeon as their lair), a
  final demon sovereign. The existing five regional **warlords** can be reframed as demon lieutenants or
  region bosses. Framework only now: chapter list, data-driven dialogue scripts, quest flags; the writing
  comes later.
- **Quest engine:** `{ id, giver, state, objectives[], rewards, locations, prerequisites }`. Objective types:
  kill N / kill named boss / discover place / clear dungeon / fetch / deliver / survive a time in a zone /
  **build a tower** (a natural fit with 5.9). *Medium* for the engine, journal UI and map markers.
- **Main quest** is a hand-written chapter skeleton whose locations are filled in procedurally from the
  seeded world. **Side quests** come from bounty boards and NPCs via templates.
- **Free play:** no quest blocks exploration, no timers on the main quest, towns work without quests.
- **Needs:** NPCs with dialogue UI, gold, towns with inns / shops / quest boards. *Medium each.*
- Authoring cost of the story itself is the long-term cost. Keep the framework data-driven (JSON) so writing
  does not require code changes.

### 5.11 Dungeons and towns

- **Dungeons** (the progression spine, 5.2): multi-floor, level-scaled, a boss at the end, keys / simple
  puzzles, guaranteed loot tiers, persistent clear state, and the main source of spell items and runes.
  Floors are cheap with the existing interior generator (stairs between sources). *Medium.*
- **Towns:** districts, shops, inn (heal and save), quest board, NPCs, safe zone, services such as tower
  parts. *Medium-Hard* (mostly content and UI).
- **Fast travel** between discovered towns and waypoints. *Easy-Medium.* Mounts / airship later (optional).

### 5.12 Sound (in scope)

- **SFX:** Web Audio. Start with **synthesized sound effects** (sfxr-style generators: tiny, no asset
  pipeline) with per-spell and per-enemy variations driven by the spell recipe. *Easy-Medium.*
- **Music:** per biome, town, dungeon, boss, combat intensity. Options: licensed / original tracks as
  compressed files, or **generative** layered loops. Recommendation: placeholder loops with a simple
  crossfade manager now, replace with real music later. *Medium.* Needs a source of music assets.
- **Mix:** master / music / sfx sliders, mute on blur, spatial pan and distance attenuation for off-screen
  events, a voice cap so a swarm does not turn into noise.
- Audio is not present today at all, so the manager is new infrastructure.

### 5.13 Combat feel

- Spells auto-cast on cooldown (not mana-limited) with automatic aiming; active skills are manual.
- The variety of attacks comes from rune combinations, not hand-written weapons.
- Spectacle budget: cap live spell entities and particles (the Materia notes use 192 spell objects, 320
  particles, 32 afterimages). On the web this budget is mandatory.
- Enemy telegraphs (already built) matter more when enemies have levels and larger hits.

---

## 6. Architecture notes

- **Data-driven content:** spell archetypes, rune archetypes, enemy types, quest templates, dialogue and tower
  definitions as data files, so adding content never requires engine edits (rule 10 of the spell spec,
  generalised).
- **Systems as modules:** `SaveSystem`, `SpellRuntime`, `ItemSystem`, `PartySystem`, `QuestSystem`,
  `TowerSystem`, `AudioSystem`, `UIToolkit`, `WorldDeltas`, plus the existing world / AI modules.
- **Tooling:** the project is plain ES modules with PixiJS from a CDN. At this size it will pay to add a
  bundler (Vite), TypeScript or JSDoc types, an automated test runner (the headless-browser checks used so
  far would become proper tests), and a build step for Pages.
- **Determinism:** everything procedural must be seedable and reproducible, including item components and
  quest placement, so saves stay small.
- **Performance:** pooling, entity caps, spatial hashing (exists), chunk streaming (exists), save deltas
  compact and incremental.

## 7. Feasibility summary

| Feature | Rating | Main cost |
|---|---|---|
| Difficulty by distance / zone levels | Easy | Tuning |
| Enemy level stat, level-difference scaling | Medium | Reworking current scaling |
| Level cap 99 + exponential soft cap | Easy | Curve tuning |
| Named regions, roads, rivers | Medium | World-gen work |
| Persistent world (seed + deltas, slots, versioning) | Medium | Save format |
| Fog of war + saved exploration | Medium | Per-tile reveal data |
| Quest engine + journal + markers | Medium | Systems and UI |
| Story framework (data-driven) | Medium | Structure; writing later |
| Quest content / dialogue | Hard | Writing volume |
| Gold, shops, inn, NPCs | Medium-Hard | Content + UI |
| Multi-floor dungeons, bosses, dungeon loot | Medium | Generator extension |
| Low-probability drops, dungeon-gated spells | Easy | Loot tables |
| Stat-card specialisation paths | Medium | Design / balance |
| Mana-as-stamina, dash / blink / shield | Medium | Mobility spells, input |
| Active skills alongside autofire | Medium | Input, UX, balance |
| Party hybrid: swap + loadouts | Medium | Per-hero state, UI |
| Benched aura / assist / reserve roles | Medium | Aura system, balance |
| Spell runtime (graph, events, triggers, payloads) | Hard | Core new engine |
| Procedural components + rarity budgets | Medium | Generator, balance |
| Drag and drop UI with live compatibility | Hard | UI toolkit |
| Non-interrupting level-up flow | Easy-Medium | UX design |
| Loadout presets / quick swap | Medium | UI + state |
| Turret and ward towers | Medium | After spell runtime |
| Climbing tower + plateaus / terrain edits | Medium-Hard | Plateau generation, tile deltas |
| Siege events, towers as enemy targets | Hard | Enemy AI |
| Surface effects (lava, swamp, buffs) + hazard-aware AI | Medium | Surface layer, flow-field costs |
| On-step triggers and claimable (hold-out) areas | Medium | Trigger and zone system |
| Resources, nodes, gathering, wallet | Medium | Nodes, deltas, UI |
| Enemy perception, leash, resident population | Medium | AI layer, spawning rework |
| Dock and boat (deep-sea traversal) | Medium-Hard | Movement mode, sea content |
| Sound: SFX | Easy-Medium | Synth + manager |
| Sound: music | Medium | Asset source |
| Free-form spell building (depth 3) | Hard | UI + validation |
| Everything at once | **Risky** | Scope |

## 8. Suggested order of work (for discussion)

1. **Foundations:** build tooling, save/load with seed + deltas, generator versioning, fog of war, zone-level
   field, enemy level stat, audio manager skeleton.
2. **Spell runtime:** event-driven graph with entity caps; port the five weapons; AUTO vs ACTIVE modes; mana
   as stamina with dash / blink / shield; stat cards replacing weapon cards; non-interrupting level-up flow.
3. **Items and UI toolkit:** spell items, runes, procedural generation, loot tables (dungeon-gated), drag and
   drop inventory with compatibility filtering, loadout presets.
4. **World content:** gold, NPCs, shops, inn, quest engine, journal, story framework, multi-floor
   dungeons with bosses.
5. **Party:** hybrid party, switching, loadouts per hero, bench roles (aura first).
6. **Towers:** turret and ward first, then beacons / waypoints, then terrain edits and the climbing tower.
7. **Polish and breadth:** regions and roads, fast travel, music, siege events, more archetypes, deeper
   spell-building if it proves fun.

Reasoning: steps 1 and 2 are painful to retrofit; party, towers and quests all depend on the spell runtime
and the save system.

## 9. Open questions (round 3)

Most earlier questions are answered (see the decisions table). Remaining:

1. **Loot interpretation:** confirm 0.1 as "10 percent a kill drops something, mostly auto-collected
   stackables", with runes and spells a much smaller sub-roll (5.9d).
2. **Tower threats:** towers are permanent, so should they be fully indestructible (recommended), or can
   events temporarily disable them?
3. **Resource tools:** is gathering free-hand (hold to harvest) or do axes and pickaxes exist as upgradable
   gear?
4. **Safe moment definition:** how long without combat before editing is allowed (suggestion: 6 seconds with
   no aggroed hostile within sight), and are towers, towns and claimed areas always safe?
5. **Party size and class list:** how many heroes at start and in total, fixed classes or stat-path built?
6. **Boat scope:** one boat type to start, or a progression (raft, boat, ship) tied to resources?
7. **Dungeon spell drops:** guaranteed spell in each dungeon boss chest, or a high-chance roll?
8. **Revive rules:** does resting at an inn cost gold, and are there consumables that revive in the field?
9. **Music source** (composed, licensed free, generated) and **art direction** (stay procedural or add
   hand-made sprites for heroes and bosses).
10. **Platforms:** browser only, or mobile touch as well (affects UI density and the build mode controls).

## 10. Known design tensions

- **Endless swarm vs placed content.** Survivors-likes want constant pressure; exploration RPGs want quiet
  stretches. Likely answer: danger-driven ambient density plus fixed lairs and bosses.
- **Persistence vs procedural.** The more the player changes the world (towers, terrain edits), the more
  state must be saved and versioned.
- **Systems depth vs readability and speed of change.** The Godot lesson. A powerful spell graph is useless
  if the player cannot read or change it fast. The UI rules in 5.7 and 5.8 exist for this.
- **Towers vs balance.** Towers that autofire with player-grade spells can make the survivors-like core
  redundant unless limited, costed and made vulnerable.
- **Scope.** Each pillar alone (quests, party, spells, persistence, towers, audio) is a project. The order in
  section 8 keeps every step playable.
