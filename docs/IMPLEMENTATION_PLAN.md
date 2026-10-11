# Implementation plan

> Companion to [VISION.md](VISION.md). The vision says *what*, this says *how and in what order*.
> Status: **draft 1, nothing implemented yet.** Sizes are rough: **S** (1-3 days), **M** (about a week),
> **L** (2+ weeks), **XL** (a month or more). They assume one developer working with an AI pair.
> Every phase ends with a playable, deployed game. If a phase grows too big, split it; never leave the
> game broken between phases.

## Progress

Work happens on the long-lived feature branch `claude/zealous-allen-iqnjhe`. **Nothing is merged to `main` until
the whole plan is implemented and tested.** A private hosted test page is republished at each milestone
(`npm run build:artifact`); it includes a test-tools panel (backquote key, or the flask button).

| Phase | Status | Notes |
|---|---|---|
| 0 Tooling and TypeScript | **Done** | Vite, strict TS for the deterministic core, Vitest (55 tests), Playwright e2e, CI. Legacy runtime files carry `@ts-nocheck` until they are rewritten (it already hid one undefined-name bug, so retire it as modules are replaced) |
| 1 Simulation, persistence, difficulty, perception | **Done, with two deferrals** | Fixed 60 Hz step, event bus, RNG streams, saves (IndexedDB, versioned, compressed, migrations), per-tile persisted fog of war, zone levels by distance, tier-tinted land and dead trees, resident camps and warlord lairs, sight / leash / return AI, respawn at nearest visited town. **Deferred:** full headless `Simulation` split from the Pixi renderer (the game still runs in `game.ts`; deterministic sim tests will come with the spell runtime in Phase 2), and tiered *species* per biome (tiers currently change stats, names and terrain; new species are content work) |
| 2 Spell runtime, stats, mana | **Done, with deferrals** | Typed data-driven spell engine (`src/core/spells`): 8 spell templates (5 auto-cast ports of the old weapons with identical level-1 numbers, plus active Dash, Blink, Aegis), 15 runes with modifier + trigger effects (trigger depth capped at 1, hard object caps), `canSocket` compatibility (clashing cores, wrong expression, active-only runes, duplicates), spells level from their own kills. Hero stat cards in 4 specialisation paths (`src/core/hero`), mana as stamina (only active skills spend it), level-ups queue as pending picks with a side panel and optional auto-pick (game never pauses), Preact DOM HUD (mana, Space/Q/R skill bar, loadout panel with click-to-socket), loot: 0.1 % skill drops scaled by enemy level, bosses always drop, chests and altars grant spells/runes, procedural SFX skeleton, save v2 + v1 migration, devtools spell/rune grants, e2e `phase2.mjs`. **Deferred:** drag-and-drop (Phase 3), graph-style trigger chains deeper than one level and spell-to-spell triggers, full headless `Simulation` split, music |
| 3 Items, loot, wallet, board UI | **Done, with deferrals** | Per-kill loot rolls (XP gem 100%, gold 10%, resource 1%, skill 0.1%, scaled by enemy level, elites ×, bosses guaranteed) verified by a 100,000-kill statistical test; wallet (gold, wood, stone, iron) with pickups, HUD and persistence; inventory holds only skills; pointer-events drag and drop (mouse, touch, pen) with ghost, valid/invalid highlights and rollback, plus keyboard path; rune compare tooltip with before/after numbers; search, sort, lock, salvage for gold, auto-salvage loot filter; save v3 + v2 migration. The loadout is editable at any time (the safe-moment rule was dropped by request). **Deferred:** spell preview against a dummy, codex, favourites beyond lock, gold/resource spending (shops arrive with towns, towers in later phases) |
| 4 Party and death | Not started | |
| 5 Surfaces, zones, resources, towns | Not started | |
| 6 Towers, docks, boats | Not started | |
| 7 Quests, story, dungeons | Not started | |
| 8 Audio and polish | Not started | |

## 1. Goals and hard constraints

- Browser game, desktop first, touch playable later. Deployed to GitHub Pages.
- Persistent seeded world: **seed + deltas**, never save generated terrain.
- Everything procedural is **deterministic and testable**.
- Spell system: **flexible, interesting, fast to change, never a bore** (the Godot version was too
  complicated). Complexity lives in the engine, not in the player's face.
- UI: readable, intuitive, **drag and drop**, compatibility checked automatically, level-ups never
  interrupt play.
- Performance budget: 60 fps on a mid laptop with about 150 enemies and 200 spell objects; saves under a few MB.

## 2. Tech stack recommendation

| Concern | Recommendation | Why | Alternatives considered |
|---|---|---|---|
| Language | **TypeScript (strict)** | This project is heading to 30k+ lines with many data models (items, spells, saves). Types catch most of the bugs that would otherwise surface as corrupted saves | Plain JS + JSDoc (cheaper, weaker) |
| Build / dev server | **Vite** | Fast HMR, first-class TS, trivial multi-page (a UI sandbox page), simple Pages build | Webpack (slower), esbuild alone (no dev UX) |
| Renderer | **PixiJS v7 from npm** for now | Already used, all art code is written for it. v8 has a different Graphics API and async init; migrating *and* rewriting at once is risky. Revisit v8 after Phase 3 behind a thin `gfx` helper | PixiJS v8 now (more rewrite), Phaser 3 (tilemaps and scenes, but a rewrite, and its physics is unused), Excalibur / Kaplay (smaller), Godot web export (heavy runtime, and the spell complexity was never the engine's fault) |
| Menus / HUD | **HTML + CSS overlay with Preact** (and `@preact/signals`) | Inventory, spell board, shops, quests, dialogue and settings are **text-heavy and drag-and-drop heavy**. Native pointer events, CSS layout, real text rendering, accessibility, UI scaling, touch, all for free. Canvas UI would mean writing a layout engine and a DnD manager from scratch | Svelte (also great, compiler-based), Solid (fast signals), React (heavier), all-Pixi UI (`@pixi/ui`: fine for HUD, painful for inventories) |
| Game state | **Plain TS core, framework-agnostic**, exposed to the UI through signals and an event bus | The simulation must run headless in tests and must not depend on the UI | Redux / Zustand (not needed), full ECS (see below) |
| ECS | **Not at first.** Typed entity classes plus systems | Measured cost today is about 0.3 ms per frame. Adopt `bitECS` or `miniplex` only if profiling in Phase 2 says so | bitECS, miniplex |
| Drag and drop | Custom pointer-events DnD manager (mouse + touch + keyboard) | Native HTML5 DnD does not work on touch; libraries pull in a framework. A ~200 line manager with ghost, targets, validation, rollback is enough | `dnd-kit` (React-only), `interact.js`, `Sortable` |
| Audio | **ZzFX** (tiny synthesized SFX, no asset pipeline) + **Howler.js** (music, mixing, sprites) | Zero-asset sound from day one, drop-in music later | Raw Web Audio (more code), Tone.js (heavy), Howler only (needs files) |
| Persistence | **IndexedDB via `idb`**, `fflate` compression, versioned schema with migrations | Large delta data (fog, deltas) does not fit localStorage | Dexie (nice, bigger), localStorage (too small) |
| Validation | **valibot** or **zod** for save and data files | Corrupted or old saves fail loudly with a clear message | Hand-rolled checks |
| Content data | JSON / TS data modules under `src/data`, validated at build and load | New enemies, runes, surfaces, quests are data, not code | Spreadsheets (later, via export) |
| Tests | **Vitest** (unit, deterministic sims) + **Playwright** (smoke, screenshots; already used ad hoc) | The headless-browser checks already used in this project become permanent | Jest (slower with Vite), Cypress |
| Lint / format | ESLint + Prettier, `tsc --noEmit` in CI | | |
| CI / deploy | **GitHub Actions**: typecheck, test, build, deploy to Pages | | Committing build output (messy) |

**One manual step for the owner:** switching the site to a build output means changing *Settings, Pages,
Source* to **GitHub Actions**. I cannot change that from this environment.

### Why HTML for the UI (the key recommendation)

The single biggest UI task is the inventory and spell board with drag and drop and live compatibility. In
the DOM it is a list of elements with pointer handlers and CSS states (`.valid`, `.invalid`); on a canvas it
is hit testing, text wrapping, scrolling, tooltips and focus handling by hand. The in-world feedback
(damage numbers, telegraphs, tower ghosts) stays in Pixi. The HUD can be HTML too (crisp text, easy scaling,
screen readers), with the canvas only drawing the world.

### On TypeScript migration

Do it **incrementally** and first (Phase 0): `allowJs`, move files one at a time to `.ts`, turn on `strict`
per file, keep the game playable at every commit. Existing modules are small and cleanly separated, which
makes this cheap.

## 3. Target architecture

```text
src/
  core/            deterministic game logic, no DOM, no Pixi
    sim/           Simulation (fixed 60 Hz step), event bus, RNG streams, time
    world/         noise, terrain sources, chunks, zones, difficulty, POIs, deltas, nav (raycast, flow field)
    entities/      Hero, Enemy, Tower, Boat, Critter, Projectile, Pickup
    ai/            enemy behaviours, perception, leash
    spells/        components, archetypes, graph, compiler, runtime, generators
    items/         item model, loot tables, rarity budgets, inventory, wallet
    party/         roster, loadouts, switching, bench roles, death rules
    quests/        quest engine, objectives, dialogue scripts, story chapters
    surfaces/      surface defs, effects, triggers, claim zones
    towers/        tower defs, construction, docks and boats, terrain edits
    save/          schema, versioning, migrations, IndexedDB, slots
  render/          Pixi: world renderer, sprites, art generators, effects, camera, fog
  ui/              Preact components: HUD, inventory, spell board, shop, journal, map, dialogue, settings
  audio/           audio manager, ZzFX sfx, music crossfade
  data/            content data (enemies, runes, spell archetypes, surfaces, towers, quests)
  app/             bootstrap, game session, state machine (menu, play, dead)
tests/             unit, sim, e2e
```

Principles:

1. **Simulation and rendering are separate.** `Simulation.step(dt)` advances game state at a fixed step
   (accumulated from the frame delta). Renderers read state and interpolate. This gives deterministic tests
   ("simulate 10 minutes in 2 seconds"), simple pause, and stable saves.
2. **UI reads signals, sends commands.** UI never mutates the game; it dispatches commands
   (`equipRune(heroId, spellId, socketId, runeId)`) that the core validates (this is also how compatibility is
   enforced, see 4.3).
3. **Events:** a typed event bus (`EnemyKilled`, `ItemDropped`, `HeroSwitched`, `TowerCompleted`,
   `ZoneEntered`...) feeds quests, audio, achievements, UI toasts and analytics without coupling.
4. **RNG streams:** separate seeded streams for world generation (pure function of `seed + coords`), loot,
   combat and cosmetics, so cosmetic randomness never changes gameplay results and replays stay valid.
5. **Data-driven registries:** archetypes, runes, enemies, surfaces, towers, quests live in data and register
   themselves. Content additions should not touch engine code.
6. **Budgets everywhere:** spell objects, particles, audio voices, towers updated per frame.

## 4. Key data models (sketches)

### 4.1 World and deltas

```ts
interface WorldMeta { seed: number; generatorVersion: number; startPos: Vec2; createdAt: number; }

// Everything that differs from what the seed generates:
interface ChunkDelta {
  tiles?: Record<number, TileOverride>;       // tower terrain edits (ramps, bridges), claimed areas
  nodes?: Record<string, NodeState>;          // resource nodes harvested (depletedAt)
  camps?: Record<string, CampState>;          // cleared camps (clearedAt)
  chests?: Record<string, boolean>;           // opened
  structures?: Structure[];                   // towers, docks, claimed area markers
  fog?: Uint8Array;                           // revealed bitmask (1 bit per tile, or 2x2)
}
```

`generatorVersion` is stamped into every save. Old saves load the generator version they were created with
(kept as frozen code) or are flagged unsupported; this is the price of persistence plus procedural content,
and it must be decided in Phase 1.

### 4.2 Difficulty by distance

Enemy level is a **pure function of position**, independent of the player:

```ts
// distance in tiles from the start; safe radius around the start
const zoneLevel = (d: number) => 1 + A * Math.max(0, d - SAFE) ** P;   // A=0.0301, P=0.85, SAFE=80
// plus region offset (+/- 3) and biome tier modifiers; rounded per zone, not per enemy
```

Proposed numbers (tunable in data), at walking speed 4.75 tiles per second:

| Distance (tiles) | Zone level | Straight walk |
|---:|---:|---:|
| 80 | 1 | 0.3 min |
| 400 | 5 | 1.4 min |
| 900 | 10 | 3.2 min |
| 2,200 | 21 | 7.7 min |
| 5,000 | 42 | 17.5 min |
| 8,500 | 66 | 30 min |
| 13,000 | 95 | 46 min |

Slow incline, large distances, level 99 only far out (and gently continuing after). Real travel is slower than
a straight walk (obstacles, fights, quests), and mounts, boats and fast travel shorten return trips.

**Tiered biomes:** each biome has tier variants by level band (for example tier = floor(level / 12)); a tier
changes the ground palette, decor, surfaces and the **enemy roster** (a stronger species set per biome per
tier). Story link: corruption grows toward demon lord regions. Tier boundaries are blended over a few tiles
to avoid hard seams.

### 4.3 Spells (graph + simple UI)

```ts
type Capability = 'MOVEMENT' | 'POSITION' | 'DIRECTION' | 'COLLISION' | 'HIT_EVENT' | 'KILL_EVENT'
  | 'EXPIRE_EVENT' | 'TICK_EVENT' | 'CAST_EVENT' | 'AREA' | 'PROJECTILE' | 'PERSISTENT'
  | 'CAN_SPAWN_CHILDREN' | 'CAN_HAVE_PAYLOAD' | 'SELF_TARGET';

interface ComponentArchetype {
  id: string; kind: 'core' | 'expression' | 'modifier' | 'trigger' | 'payload';
  provides: Capability[]; requires: Capability[];
  params: Record<string, { min: number; max: number; budgetWeight: number; lowerIsBetter?: boolean }>;
  complexity(p: Params): number;
  // runtime hooks: onCast, onSpawn, onTick, onHit, ... (pure functions of state + context)
}

interface SpellItem {            // the equipment the player owns
  id: string; seed: number; rarity: Rarity; level: number; xp: number;
  mode: 'AUTO' | 'ACTIVE';
  core: ComponentRef; expression: ComponentRef;      // fixed on the item (depth 1 UI)
  runeSockets: { id: string; accepts: RuneKind[]; link?: string }[];   // topology fixed by the item
  runes: Record<string, RuneInstance | null>;
  complexityLimit: number; maxPayloadDepth: number;
}
```

- **Compile:** `compile(spell): Result<RuntimeSpell, CompileError[]>` runs validate, requirement check,
  inheritance, complexity and builds the execution graph. Invalid spells never run.
- **Compatibility is a pure query:** `canSocket(spell, socketId, rune): { ok: true } | { ok: false; reason }`.
  The UI calls it to grey out runes and to explain; the command layer calls it again before committing, so a
  stale or forged drop cannot create an invalid spell.
- **Runtime:** event-driven. Casting creates spell objects from a **pool**; each spell object processes
  `TICK / HIT / KILL / EXPIRE / BOUNCE` through its compiled handlers. Hard caps: live objects, spawn depth,
  spawns per event. Towers and heroes both use the same runtime with an `owner`.
- **AUTO vs ACTIVE:** AUTO spells cast on cooldown with auto-targeting and **no mana cost**. ACTIVE spells are
  bound to inputs and **cost mana**. Dash, blink and barrier are ACTIVE spells with a self-target expression,
  so runes apply to them.
- **Mastery:** spell XP from use, growth points and milestones at 5/10/15/20 as in the Materia notes, with a
  per-archetype curve. Level-ups on a spell never open a modal.
- **Starter content:** the five current weapons become five spell items on this engine (this is also the
  regression test for the runtime).

### 4.4 Items, loot and wallet

```ts
interface Wallet { gold: number; wood: number; stone: number; iron: number; }   // never in inventory slots
type Item = SpellItem | RuneItem | Consumable;                                    // only these occupy slots
```

Loot rolls per kill (independent, decided base rates for a normal enemy):

```ts
const BASE_DROPS = { xpGem: 1.0, gold: 0.10, resource: 0.01, skill: 0.001 };

function rollKill(enemy: Enemy, rng: Rng): Drop[] {
  const m = lootMultiplier(enemy);          // normal 1, elite ~4, mini-boss ~10, scales gently with level
  const drops: Drop[] = [{ kind: 'xpGem', value: xpFor(enemy) }];           // always
  if (rng() < BASE_DROPS.gold * m)     drops.push({ kind: 'gold', amount: goldFor(enemy) });
  if (rng() < BASE_DROPS.resource * m) drops.push({ kind: 'resource', type: resourceFor(enemy), amount: 1 });
  if (rng() < BASE_DROPS.skill * m)    drops.push({ kind: 'skill', item: generateSkill(enemy.zoneLevel, rng) });
  return drops;
}
```

1. **XP gems always drop.** Gold and resources are **auto-collected** into the wallet (never inventory slots),
   so their rates cannot flood anything.
2. **Skills (spell items and runes) are the only inventory items from kills**, 0.1 percent for a normal
   enemy. At 140 kills a minute that is about one skill per 7 minutes, which stays a trickle.
3. Dungeon chests and bosses use guaranteed tables (at least one skill pick per boss).
4. **Salvage and filter:** unwanted rarity thresholds auto-salvage into resources.
5. Multipliers are modest and data-driven; boss kills bypass the roll with a guaranteed table.

Merchants sell runes and spell items at high gold prices with a limited, rotating stock seeded from the
town and the in-game day.

### 4.5 Heroes and party

```ts
interface Hero {
  id: string; name: string; class: ClassId; level: number; xp: number;
  stats: StatBlock; cards: CardPicks;                 // stat card choices, path progress
  autoSlots: (SpellItemId | null)[]; activeSlots: (SpellItemId | null)[];
  benchRole: 'AURA' | 'ASSIST' | 'RESERVE';
  alive: boolean;                                      // false until rested at a city
}
interface Party { heroes: Hero[]; activeId: string; switchCooldown: number; }
```

- **Only the active hero has a body in the world and can be damaged.** Benched heroes contribute by role:
  AURA modifies party stats from the bench, ASSIST casts one reduced support spell, RESERVE gains XP faster.
- **Heroes are loadouts:** switching is the fast way to change spell sets. Editing spells and runes needs
  `isSafeMoment()` (no aggroed hostile within sight, no combat for N seconds, or inside a safe zone).
- **Death:** active hero dies, `alive = false`, control passes to the next living hero. All dead means the
  death screen and respawn at the nearest visited city or the start. Inn rest revives and heals everyone.

### 4.6 Surfaces and zones

```ts
interface SurfaceDef {
  id: string;
  affects: ('player' | 'enemy')[];
  immuneTags?: string[];                       // enemies that ignore it
  dot?: { dps: number; element: Element };
  speedMul?: number; heal?: number; manaRegenMul?: number; fireRateMul?: number;
  onEnter?: TriggerRef;                        // monster wave, unlock gate, start encounter
  navCost?: number;                            // hazard cost in the flow field
}
interface ClaimZone { id: string; center: Vec2; radius: number; holdSeconds: number; waves?: WaveDef; rewards: Reward[]; }
```

Stored as a per-chunk surface byte array generated from the seed; claimed state in deltas. Effects are applied
by a `SurfaceSystem` that looks up the tile under each entity (one array read).

### 4.7 Towers and construction

```ts
interface TowerDef {
  id: string; category: 'TURRET' | 'WARD' | 'TERRAIN' | 'UTILITY' | 'HARBOR';
  cost: Partial<Wallet>;                       // large; resources are the only cap
  buildSteps: number;                          // construction site stages
  spellSlots?: number;                         // turrets hold spell items
  placement: PlacementRule;                    // terrain, anchors, distance to towns
  effect: TowerEffect;                         // dome, fog reveal, tile edits, dock + boat
}
```

- **Construction site:** place a site, deliver resources in stages (each stage animates), finish with a short
  ceremony. Permanent, indestructible, no refund, no count limit.
- **Terrain edits** (climbing ramps, bridges) are **tile overrides in deltas**; the renderer and navigation
  rebuild affected chunks.
- **Plateau generation:** mountain ranges can contain generated plateaus whose wall tiles carry `anchor`
  flags; a Climbing Tower on an anchor converts a ramp strip to walkable tiles. Plateau content is
  high-level loot and secrets.
- **Dock and boat:** the dock is a structure on a shore tile; the boat is a vehicle entity with water-only
  collision (deep and shallow allowed, land blocked). Boarding switches the player to `Sailing` movement mode,
  and the nav and spawn code gain a sea mode.

## 5. System designs for the new decisions

### 5.1 Enemy perception, leash and population

- Add to every enemy type: `sightRange`, `loseRange` (about 1.4x), `memoryFrames`, `leashRadius`, `idle`
  behaviour (`wander | graze | sleep | patrol`), `alertRadius` (shares aggro with neighbours).
- **State shell around the existing AI behaviours:** `IDLE -> ALERT -> ENGAGED -> RETURNING`. The current
  behaviours (chase, charge, kite, slam, boss chains) run only inside `ENGAGED`.
- **Home and leash:** each monster is born at a home position (camp or roamer origin) and returns when the
  player leaves sight range or the leash radius is exceeded. This stops cross-biome convergence.
- **Population model:** per-chunk resident spawns derived from the seed (camps, lairs, roamers) with danger
  density from the zone level; resident state (cleared, respawn timestamp) lives in deltas. A light ambient
  pressure keeps the survivors-like feel in dangerous zones (see risks).
- Existing nav (LOS raycast, flow field, whiskers) is reused unchanged.

### 5.2 Surfaces and zones

- Generate a surface layer per chunk from biome, tier and noise (swamps in wet forest, lava fields in the
  volcanic tier, ice on peaks, quicksand patches in desert).
- `SurfaceSystem.apply(entity, dt)` reads the surface byte, applies DOT, speed multipliers, heals, mana regen
  and fire-rate buffs, honours immunities and `affects` filters.
- Hazard cost in the flow field: damaging tiles get extra path cost for non-immune walkers.
- Trigger tiles and claim zones are small state machines driven by the event bus (`ZoneEntered`, `ClaimTick`).

### 5.3 Resources and gathering

- Resource nodes are the existing decor trees, rocks and ore deposits, promoted to **interactable nodes**
  with a hit count or hold timer; state in deltas. Region decides richness (iron in mountains, wood in
  forests, stone in hills).
- `Wallet` is always visible in the HUD; resources are never inventory items.
- Gathering is hold-to-interact (also available by touch). Tool gear is an open question.

### 5.4 Non-interrupting level-ups and acquisitions

- Gaining a level pushes **pending picks** into a queue and shows a small toast and counter. Picks are made
  from a docked panel or pause tab; an optional auto-pick preset per hero skips them entirely.
- Item drops and chest rewards are **non-modal**: a loot card slides in the corner, items land in the
  inventory, and rare spell items trigger the **acquisition moment** (light beam, sound, reveal card, codex
  entry).

### 5.5 Audio

- `AudioManager` with buses (master, music, sfx, ui), voice limiting and distance attenuation.
- SFX defined as ZzFX parameter sets in data, with variations seeded by spell recipe and enemy type.
- Music crossfade manager keyed by region and state (explore, combat, boss, town, dungeon). Placeholder loops
  first.

## 6. Roadmap

Each phase lists **tasks**, **acceptance criteria** and **size**. Phases are ordered by dependency: the
simulation, save system and spell runtime are painful to retrofit, so they come first.

### Phase 0: Tooling and TypeScript migration (M)

Tasks
- Vite + TypeScript project; `pixi.js` from npm (remove the CDN script); ESLint, Prettier, `tsc --noEmit`.
- Move existing modules to `src/` in the target layout; convert files to `.ts` incrementally, strict on.
- Vitest with first unit tests (noise determinism, `lineOfSight`, flow field reachability, interior
  generators connectivity, level curve).
- Playwright smoke test (boot, enter a place, open map) running in CI.
- GitHub Actions: CI (typecheck, test, build) and Pages deploy.
- UI sandbox page (Vite multi-page) for developing UI components in isolation.

Acceptance: the game plays exactly as today, deployed from CI, strict type check passes, tests green.

Risk: Pages source setting change (owner action).

### Phase 1: Simulation core, persistence, difficulty, perception (L)

Tasks
- Fixed-step `Simulation`, event bus, RNG streams; renderer reads state (decouple `game.js` into session,
  systems and render).
- `GameSession` + `SaveSystem`: IndexedDB, versioned schema with migrations, slots, autosave, export/import;
  world seed fixed at "new game"; `generatorVersion`.
- World deltas store and chunk delta application; **persisted per-tile fog of war** feeding minimap and map.
- Difficulty field (4.2) and **enemy level from zone**; remove player-level scaling of enemies; tier rosters
  (field -> blighted plains and so on) in data.
- Enemy **perception, leash and idle behaviours** (5.1); resident camps and roamers instead of global ambient
  spawn; cleared camps saved.
- Death screen with respawn at nearest visited city or start (placeholder hero rules until Phase 4).

Acceptance
- Save, reload, world and fog identical; killed camps stay dead; same seed gives identical terrain and
  camps.
- Walking out 900 tiles shows level 10 monsters; monsters from other biomes no longer follow across borders;
  enemies do not react beyond their sight range.
- Headless sim of 10 minutes runs deterministically.

### Phase 2: Spell runtime, stats, mana-as-stamina (L)

Tasks
- Component registry, capabilities, compiler, event runtime with pooling and caps (4.3).
- Port the five weapons as pre-built spell items (regression: behaviour parity checks).
- AUTO and ACTIVE modes; input bindings; mana as stamina; dash, blink and barrier as ACTIVE spells.
- Hero stat cards (stat pools only, no spells), paths, level curve to 99 then exponential; non-interrupting
  level-up queue and panel (5.4); HUD moves to Preact.
- Audio manager skeleton, ZzFX effects for casts and hits.

Acceptance
- All five original weapons feel equivalent on the new runtime; fuzz test: random valid graphs always
  compile, invalid ones never run; entity cap prevents runaway chains; level-ups never pause the game;
  frame budget respected at 200 spell objects.

### Phase 3: Items, loot, wallet, spell board UI (L)

Tasks
- Item model, procedural rune generator with rarity budgets, `canSocket` and command layer.
- Loot rolls with the decided rates (4.4: XP gem 100%, gold 10%, resource 1%, skill 0.1%), auto-collect of gold and resources, salvage and loot filter.
- Wallet (gold, wood, stone, iron) and HUD display.
- Preact UI toolkit: panels, scroll lists, tooltips, **pointer-events DnD manager with ghost, valid and
  invalid highlights, rollback**; inventory; spell board with sockets and live compatibility; spell preview
  against a dummy; compare tooltips; sort, filter, search, favourite, lock.
- Acquisition moment for rare finds; codex.
- Safe-moment rule for editing.

Acceptance
- Drag from inventory to socket, between sockets, back to inventory, by mouse, touch and keyboard.
  Incompatible runes cannot be dropped and explain why. Over 100,000 simulated kills the roll rates match
  the table (statistical test) and the inventory holds only skills, never gold or resources. Save and reload keeps every item.

### Phase 4: Party, loadouts, death (M)

Tasks
- Hero model, roster screen, recruitment placeholders, per-hero stat cards and loadouts.
- Fast switching with cooldown and tag-in effect; bench roles (AURA first, then ASSIST and RESERVE).
- Death rules (4.5), rest at a city inn, party death flow.

Acceptance
- Switch heroes in combat; bench aura applies; only the active hero takes damage; dead heroes locked until
  rest; all dead triggers the death screen and respawn.

### Phase 5: World systems: surfaces, zones, resources, towns (L)

Tasks
- Surface layer, `SurfaceSystem`, hazard-aware flow field, immunity flags in enemy data.
- On-step triggers and **claim zones** with hold-out waves.
- Resource nodes, gathering interaction, node deltas.
- Towns become functional: merchants (spells and runes at high prices, rotating stock), inn (save, heal,
  revive), basic NPCs and dialogue UI.

Acceptance
- Lava hurts the player and non-fire enemies, swamp slows, a spring heals; a trigger tile spawns a wave; a
  claimed area stays claimed after reload; chopping a tree gives wood and the tree stays gone after reload;
  shops sell items for gold.

### Phase 6: Towers, docks, boats (XL)

Tasks
- Build mode, placement ghost, construction sites with staged resource delivery and ceremony.
- Turret towers using the spell runtime (loadout UI reuses the spell board).
- Ward dome; beacon (fog reveal); waypoint (fast travel).
- **Tile-delta terrain edits**; plateau generation; Climbing Tower; bridge.
- **Dock and boat**: sailing movement mode, sea navigation, sea content and enemies.

Acceptance
- A turret tower defends an area with a socketed spell; a ward blocks enemies; a climbing tower opens a
  plateau and the opening persists after reload; a boat crosses deep water and reaches an island.

### Phase 7: Quests, story framework, dungeons (XL)

Tasks
- Quest engine, objectives (kill, discover, clear, fetch, deliver, survive, build a tower), journal, map
  markers, quest givers and bounty boards.
- Story framework: chapters, demon lord data, dialogue scripts in data, flags (writing comes later).
- Multi-floor dungeons with bosses and guaranteed loot, plateau and sea dungeons.

Acceptance
- A data-only quest chain plays end to end; clearing a dungeon boss grants a guaranteed pick; the journal and
  map markers update.

### Phase 8: Audio, polish, breadth (L, ongoing)

Tasks: music manager and tracks, remaining SFX, regions and roads, more archetypes and runes, accessibility
options, controller support, performance pass, onboarding.

## 7. What happens to the current code

| Current file | Fate |
|---|---|
| `noise.js`, `terrain.js`, `interiors.js`, `world.js` | Port to TS; split rendering out of `world.js`; terrain sources keep their interface; add surface layer, delta application, difficulty field |
| `nav.js` | Keep, port to TS; add hazard path cost |
| `ai.js` | Keep behaviours; wrap in perception states; type configs |
| `config.js` (enemy catalogue) | Becomes data files with schema validation; add sight, leash, tier fields |
| `entities.js`, `enemyArt.js`, `art.js`, `critters.js` | Keep as the render/art layer; separate sim state from sprites |
| `effects.js`, `hazards.js` | Port; hazards route through the spell runtime where appropriate |
| `weapons.js` | **Replaced** by the spell runtime; the five weapons become starter spell items |
| `ui.js` | HUD and menus move to Preact; Pixi keeps world-space feedback only |
| `map.js` | Port; reads persisted fog data |
| `game.js` | Split into session, systems, state machine and render glue |

## 8. Testing, CI and deployment

- **Unit (Vitest):** noise and generators (determinism), level curve, loot rolls (distribution), spell
  compiler (valid and invalid graphs, fuzz), `canSocket`, save migrations (round trip across versions),
  rarity budget conservation, quest engine.
- **Sim tests:** headless `Simulation` for minutes of game time: no NaNs, entity caps respected, determinism
  with a fixed seed, enemies reach reachable players (nav regression, the current test generalised).
- **E2E (Playwright):** boot, new game, enter place, equip rune by DnD, save and reload, build a tower.
  Screenshots uploaded as CI artifacts.
- **CI:** typecheck, lint, unit, sim, e2e, build; deploy `main` to Pages. Preview builds per PR are optional.
- **Perf checks:** a scripted scenario with 150 enemies and 200 spell objects tracks frame time; a regression
  threshold fails CI.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope (this is several games) | Strict phase order, each phase deployed and playable; cut features, not quality |
| Spell system complexity creeps back | The seven design rules in VISION 5.7; depth-1 UI; usability test of the spell board before adding depth |
| Save breaks when generator changes | `generatorVersion`, frozen generators for released versions, migration tests |
| Survivors pressure vs resident monsters | Playtest early in Phase 1; keep a tunable ambient density and aggro swarms for dangerous zones |
| Drag and drop on touch | Own pointer-event DnD from the start; click-to-equip fallback always present |
| Towers trivialise combat | Resource-gated, long build, tuned damage, bosses and zones that outscale them; towers update at a low rate when far |
| Performance with many towers and spell objects | Pooling, caps, sim culling, spatial hashing |
| Plateaus and boats add a second movement/nav mode | Treat as modes behind interfaces (walk, sail) and add after the base is stable |
| Audio assets | Synth SFX first, placeholder music, replace later |

## 10. Assumptions to confirm before Phase 1

1. **Loot (decided):** XP gem always, gold 10 percent, resource 1 percent, skill 0.1 percent, as independent
   rolls (VISION 5.9d). Still to decide: the split between spell items and runes within the skill roll
   (suggestion: about 1 in 5 a spell item, spell items weighted toward dungeons and bosses).
2. **Towers are indestructible**, enemies can only temporarily disable them or are drawn to them.
3. **Safe moment** for editing means 6 seconds without an aggroed hostile in sight, plus always safe in
   towns, towers and claimed areas.
4. **Pixi v7 stays** for now; v8 is reconsidered after Phase 3.
5. **GitHub Pages source** will be switched to GitHub Actions by the owner.
6. **Preact for UI** (Svelte is an equally valid choice if preferred; decide before Phase 2).

## 11. First concrete steps (when implementation starts)

1. Create the Vite + TypeScript scaffold and move the current files in with `allowJs`.
2. Wire CI and Pages deploy; confirm the deployed game is identical.
3. Convert modules to `.ts` bottom-up (noise, biomes, terrain, nav, then ai, entities, world, game, ui).
4. Add the first unit tests (determinism and nav) as each module is typed.
5. Begin Phase 1 with the `Simulation` split and the save system, since everything after depends on them.
