# Vision: a survivors-like Final Fantasy world

> **Status: living document, nothing here is implemented yet.**
> Revision 2. Captures the creative direction as a stream of thought, now including the first round of
> decisions. The goal is to find out what is possible, what is expensive, and what to cut or reshape before
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
- **Infinite world vs the difficulty gradient:** distance difficulty grows without bound, so the far reaches
  become absurd. Decision still needed: soft-cap the zone level (recommended), or keep it open as an endless
  late-game mode.

### 5.2 Loot and economy

- **Overworld drops are rare** (low probability), mostly consumables, gold, crafting bits. **Dungeons are
  where spell items and runes come from:** chests, rooms, mini-bosses, final bosses with guaranteed picks.
  This ties directly into the pillar "exploration first" and makes dungeons the progression spine.
- Item level comes from the zone / dungeon level; rarity distribution improves with depth (as in the Materia
  notes). Every dropped component starts at level 1 and levels through use.
- Gold is needed (shops, towers, services). Towns buy and sell consumables, towers parts and basic
  runes, but the *best* spell items remain dungeon-only. *Medium.*
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
- **Death rule** still open: run ends when the active hero dies, or when the whole party is down (FF-style,
  recommended), possibly with the bench able to "revive" the active hero once.
- *Cost:* *Medium-Hard.* Per-hero state, UI, aura system, switching rules. Because benched heroes do not
  occupy the battlefield, there is no follower AI or extra collision cost. This is why option C is the
  right middle ground.

### 5.4 Resources: mana as stamina, and active skills

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

**Mechanics to decide**

- **Cost and resources:** gold plus materials. Needs a materials concept (ore, wood, essence) from
  harvesting or dungeons. Towers are also a **sink for spell items** (a spare spell can power a tower).
- **Placement UI:** build mode, ghost preview on the tile grid, validity colouring (terrain, distance to
  other towers, minimum distance from towns), cancel / refund.
- **Limits:** tower cap per area or a "tower budget" tied to hero level or a town upgrade, to protect
  balance and performance.
- **Upkeep and threat:** towers can be attacked by enemies (siege events), can be repaired, and can be
  upgraded (levels, extra spell slots). Optional: towers draw aggro from enemies, which creates
  tower-defence moments.
- **Persistence:** tower position, level, loadout and health are part of the saved world deltas.

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

## 9. Open questions (round 2)

**Spells and items**
1. Gems vs runes: start with runes only (recommended) or have separate numeric gem sockets too?
2. Autofire / active slot counts per hero. Suggestion: 3 auto + 3 active, active slots unlocked by progression.
3. Can spell items be bought at all, or strictly dungeon-only (and tower parts bought)? How low is "low
   probability" for overworld drops (for example 1 percent per normal kill, higher for elites)?
4. Is quick-swapping loadouts allowed during combat (limited by cooldown) or only in safe moments?

**Party**
5. Death rule: active hero down = game over, or whole party down (recommended, with a once-per-fight bench
   revive)?
6. Party size and class list. How many heroes, and are classes fixed or built from stat paths?
7. Aura numbers: should a benched aura hero be fully immune, and do aura strengths scale with *their* level
   (recommended) or the active hero's?

**Towers**
8. Resources for building (gold only, or materials from harvesting)? Is there harvesting at all?
9. Tower limits (cap, budget, per-area) and whether enemies attack towers (siege events).
10. Plateau content: what lives on plateaus (high-level loot, hidden dungeons, rare spell vendors)?
11. Can towers be moved or sold back, and what happens to their loadout?

**World and difficulty**
12. Soft-cap the zone level, or keep the world's danger unbounded?
13. Fixed zone levels (decided in principle) with any scaling for under-levelled players, or none?
14. Penalty for dying: lose gold, lose XP, respawn at last inn, or just restart the encounter?

**Story and presentation**
15. How many demon lords and chapters for the framework (suggestion: 5 lords for the 5 biomes + a final
    sovereign)?
16. Music source: composed tracks, licensed free tracks, or generated loops?
17. Art direction: stay procedural, or add hand-made sprites for heroes and bosses?
18. Platforms: browser only, or mobile with touch controls too (affects UI density)?

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
