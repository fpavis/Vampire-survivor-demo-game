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
| 4 Party and death | **Done, with deferrals** | Fixed party of three heroes, no classes: each has own level, stat-card picks, health, mana and loadout (distinct starters), shared inventory (a spell is equipped by one hero at a time). Switch with 1/2/3, Tab or portraits (2.5 s cooldown, tag-in shockwave and i-frames, per-hero look). Only the active hero is damaged; on death the next living hero steps in; dead heroes are locked until revived by the town **Healer NPC** (gold: heal and revive, restore everyone). Bench: AURA (half of each living bench hero's own bonuses to the active hero, never max health/mana), RESERVE (slow regen) and half XP so bench heroes level (their upgrade cards wait until you switch). Party wipe: death screen, respawn at the **last visited town** (or the start) with everyone revived at 40% health. Save v4 (+v3 migration). **Deferred:** ASSIST bench role (bench casting), recruitment/roster growth beyond three, dedicated healer dialogue |
| 5 Surfaces, zones, resources, towns | **Done, with deferrals** | Surface layer (`core/world/surfaces.ts`): lava, poison swamp, mud, ice, quicksand, tidal pools, healing springs, mana wells and arcane glyphs; seeded per biome, harsher with zone level, none near the start; baked into the ground with organic edges, glowing and lighting the dark. Player: damage over time, slow/speed, healing, mana regen and cooldown boosts, HUD note. Monsters take the same effects, with an immunity table (golems and fire, spiders and poison...; fliers ignore everything) and ground monsters steer around hazards they are not immune to. Claim zones (hold out 36 s against waves, then claimed for good: no hostile spawns, healing aura, fog reveal, loot) and ambush plates (step on one: a wave, loot if you win), both seeded sites with saved deltas and map markers. Resource nodes: chop trees, mine rocks and ore; harvested nodes stay gone. Towns: **Merchant** (3 spells + 6 runes, rotating every 15 min of play, priced above salvage value), **Innkeeper** (rest heals and revives the party for gold and saves), **Healer**, and talkative townsfolk. Save v5 (+v4 migration). **Deferred:** hazard costs inside the flow field (monsters avoid by local steering), walk-on unlock gates and vaults, tower build sites on claimed zones, quest board and real dialogue trees, gathering tools |
| 6 Towers, docks, boats | **Done, with deferrals** | Build mode (B menu, placement ghost under the mouse or ahead of the hero, validity reasons, Enter / click to lay a site), construction sites with staged resource delivery (scaffold stages) and a completion ceremony; seven structures in `core/world/towers.ts` with rules unit-tested (footprint, spacing, distance from towns and the start, planners for bridge / climb / pier). **Arcane Spire** fires an armed spare auto-cast spell from the tower using the spell runtime (level and runes of the spell; that spell is unavailable to heroes meanwhile); **Warding Obelisk** dome pushes monsters out (bosses resist) and heals; **Beacon** reveals 44 tiles of fog; **Waypoint** fast travel with a distance fare; **Climbing Tower** carves a stair and plateau (`BIOME.PLATEAU`) into mountains with ore and crystals; **Bridge Tower** spans deep water (`BIOME.BRIDGE`); **Dock** moors a boat. Tile-delta terrain edits are re-derived from the saved tower records (`world.edits`, chunk re-bake on change). Sailing movement mode (speed, shallows, reefs and sea stacks block, step ashore), sea monsters (gulls, jellyfish), seeded island treasure caches with map markers. Save v6 (+v5 migration: `towers`, `boats`, `caches`, `player.boat`). Also fixed: an enemy engaged before its first AI update had no steering state (NaN position). e2e `phase6.mjs` (seeded; passes on several seeds). **Deferred:** tower upgrades and levels, siege events and enemies attacking or disabling towers, kraken and sea bosses, a true second height layer (plateaus are a walkable biome on the same plane), tower build sites on claimed zones, interior (dungeon) towers |
| Input (cross-cutting) | **Done** | Controller support and unified navigation. `core/input/gamepad.ts` (dead zones, bindings with edges and auto-repeat, controller-family glyphs, spatial navigation; unit-tested). `app/input.ts` tracks the active device (keyboard, mouse, touch, pad), polls the pad every frame (also on the title screen and while paused), maps buttons to actions, aims dashes with the right stick, rumbles on damage and level-up. `ui/nav.ts` focuses the top panel's buttons spatially for arrow keys, d-pad and hover, with confirm, back and slider/select adjustment; focus rings only for keyboard and pad. Device-aware hints everywhere. Pause menu rebuilt in the DOM (sound, vibration, dead zone, touch joystick, controls table). Loadout is fully operable with buttons. Title and game-over screens take arrows / d-pad / stick. e2e `input.mjs` uses a faked gamepad. **Deferred:** rebinding buttons, per-pad profiles for non-standard mappings, haptics beyond damage and level-up, focus-driven map panning |
| 7 Quests, story, dungeons | **Done, with deferrals** | **Dungeons** (`core/world/dungeons.ts`, `core/world/interiors.ts`): a seeded share of caves and ruins on land, 2 to 5 floors by zone level (+2 levels per floor, boss +1), generated per floor with stairs, a boss clearing on the last floor and at least two **guardians** per floor that keep the stairs **sealed**; the boss (the region's warlord, named after the demon lord in the lord's lair) leaves a **guaranteed chest** (loot tier 2, 3 for deep dungeons) that waits if you leave; broken seals, boss and chest state persist per floor. **Plateau Skyvaults** (3 floors) open on the plateau a climbing tower carves and **drowned shrines** replace some island treasure; both are hosted by the world as extra POIs. **Quest engine** (`core/quest`): data-defined quests with 10 objective types (talk, kill, kill boss, discover, enter, clear, gather, deliver, survive, build), place targets resolved from the seed ("the nearest dungeon of the Whispering Woods"), prerequisites, rewards (gold, xp, loot picks, resources, flags), turn-in with hand-overs, places already seen or cleared count; **bounty boards** (`bounties.ts`) generate four postings per town per 20 minutes of play from templates. **Story framework** (`core/story`): chapters, five demon lords plus the sovereign, a seven-quest main chain, the elder's dialogue as data, and a dialogue runner with choices, conditions, effects and variables. Runtime (`app/quests.ts`, `app/dungeons.ts`): the Elder and a bounty board in every town (new NPC and board art), dialogue UI with choices, journal (J / D-pad right), HUD tracker, board panel, map markers that reveal quest places early. Save v7 (+v6 migration). e2e `phase7.mjs`. **Deferred:** the story's real writing, dungeon keys / levers / puzzles beyond the seal, dungeon-weighted loot tables (overworld drops are unchanged), fetch-item and escort objectives, quest givers beyond the Elder and the board, bounty reputation, recruitment, voiced or animated story scenes |
| 8a Polish: UI, depth, controller loadout, art | **Done, with deferrals** | **Layering**: panels sit above the HUD; on phones and small windows (under 900 × 600) the canvas HUD shrinks, the minimap scales down, the upgrade pill, tracker and party bar stack in one left column below the health panel (the canvas publishes `--hud-top`), and the HUD steps aside while a panel is open; panels fill small screens. **Declutter**: wallet shows gold and only the resources you hold, the sound button moved to the pause menu, an icon toolbar (spells, journal, build), a one-line tracker that opens the journal, a compact party bar, level tags only on elites, warlords and monsters above the hero, bars only once hurt. **Depth** (`render/occlusion.ts`): tall decor in front of the hero fades out, walls and cliffs in front show a silhouette of the hero, NPC names, monster bars and damage numbers float on a layer above the world and the light map. **Controller loadout**: X / Y / RT act on the focused item inside panels (X equip, unequip or socket, Y lock) instead of casting, sockets open a rune picker that lists only fitting runes with their stat change, hero switcher in the panel title, device-aware hint bar, focus follows an item when it moves lists. **Art**: ink-outlined trees with clustered three-tone crowns, rim light and leaf flecks, snow-laden pines, feathered palms, faceted rocks, boulders, ore and ice with cracks and moss; redrawn bee, boar, spider, treant, scorpion, mummy, scarab and gull; shaded hero robes, armour and sleeves. Fixed: Xbox Wireless Controllers were labelled as PlayStation pads. e2e `phase8.mjs`, `scripts/layoutshot.mjs`, `scripts/decorsheet.mjs`. **Deferred:** viewing another hero's loadout without switching to them, rebinding the pad buttons, art for the remaining props and landmarks (houses, gates, stalls), and the rest of Phase 8 (music, SFX, regions and roads, accessibility, performance, onboarding) |
| 8b–8g Audio, regions and roads, spells, accessibility, performance, onboarding | **Done, with deferrals** | **Audio** (`core/audio/sfx.ts`, `core/audio/music.ts`, `app/audio.ts`): about 50 synthesized effects as data with pitch variation, per-sound and global voice limits and stereo placement by distance from the camera; procedural music (a track per region group, town, cave and ruins, dungeon, boss and title) played by a look-ahead scheduler with 2 s crossfades, a combat layer that follows nearby fighting and darker variants far out; master, music, effects and menu volumes. **Regions and roads** (`core/world/regions.ts`, `core/world/roads.ts`): seeded named regions with banners, map labels and capitals; A* roads between neighbouring towns and from the start, baked into the ground, 25% faster, free of decor and camps, with signposts. **Spells**: Ember Trail, Seeker Wisps, Returning Glaive, Spore Cloud, Earthshatter, Mending Light; crit, homing, mana-on-kill and echo parameters; eight new runes. **Accessibility**: text size, colour-blind palettes with shape cues, reduced motion, keyboard and controller rebinding. **Performance**: atlas-baked art, zero-alpha additive glows, larger Graphics batches, ground details in the ground texture, culling, spatial queries; about 1,120 → 23 draw calls per frame in the benchmark (numbers under 8f); F3 overlay; `scripts/perf.mjs`. **Onboarding**: fifteen once-only tips that follow the input device, tips switch, How to play page. Save v8 (tips seen, regions discovered). e2e `phase8b.mjs`. **Deferred:** viewing another hero's loadout without switching to them; art for houses, gates and stalls |
| 9 Deferred work, quality of life, professional polish | **In progress** | **9a done**: every emoji replaced by SVG icons (game-icons.net and Material Design Icons, 150 extracted by `scripts/build-icons.mjs`; `<Icon>` in the DOM, Path2D textures and icon labels on the canvas, the map and minimap); Cinzel and Nunito bundled; CSS design tokens and one panel frame; tests that no emoji is in the source or on screen. **9b done**: title menu with Continue (newest save), New Game (optional seed), Load Game, Options and Credits, version and a What's new card; three save slots plus the autosave, each with three rolling backups, corrupt-save detection with backup loading, rename, delete (second press), export and import as text or file, thumbnails; tabbed settings (Game, Video, Audio, Controls, Accessibility, Help) from the title and the pause menu with quality, render scale, frame limit, camera zoom, shake, flash, damage numbers, HUD size, minimap size and opacity, health bars, tracker, click to move, aim at cursor, auto-pick, confirm salvage, pause on focus loss; Quit to title; journal Log and Statistics tabs; save v9 (statistics). **9c done**: the spell panel views and edits any hero's loadout (hero tabs, Tab, LB/RB) with Make active; three loadout sets per hero; ASSIST (a resting hero casts one chosen auto spell at 60% power and 1.6× cooldown); favourites, New badges, remembered sort order; damage estimates per spell and before→after per rune; the Resonance rune (kills cast the next auto spell, at most twice a second; trigger chains capped at two levels); a training dummy with a damage meter in every town; a Codex journal tab (bestiary with portraits, spells, runes, regions and places); healer lines. CI: the title menu no longer lets a resting pointer take the keyboard highlight. **9d done**: game feel (hit-stop on crits and big kills, camera lead, stacked damage numbers, pickup trails, eased panels; all off under reduced motion); ambient beds per region and place with an Ambience volume, stingers for discovery, bosses and victory with music ducking (also during conversations), footsteps by ground; boss intro and victory cards for warlords, demon lords and the Sovereign, the ending with epilogue, run summary and scrolling credits, a DOM death screen and a "you wake in" card; houses, gates, stalls, wells, shrines, ruin entrances and cave mouths redrawn in the ink style, a lair totem, a busier bounty board; ten tier 2 and 3 species (two per region, from levels 25 and 37). Save thumbnails no longer stall scene changes. **9e done**: dungeon **vaults** (`core/world/puzzles.ts`) on about 65% of dungeon floors: a room carved off solid rock behind a gate, opened by a key (with guards), 2–3 levers or 3 timed pressure plates; the generator proves each one solvable by BFS with the gate shut (every part reachable, the stairs or boss reachable, the vault not) and sets the plate window from the shortest tour at a slow hero's pace plus slack; gates block bodies and the flow field through world blockers; open vaults and their chests persist per floor (`app/vaults.ts`). Dungeon-weighted loot: chests favour two schools per region or realm and gain half a rarity step per floor. **Hazard costs**: the flow field is Dial's algorithm over tile costs (lava 8, quicksand 6, poison swamp 5, mud 2), diagonals pay for the corners they brush, and monsters with sight of the hero but a hazard in the way follow it; a monster standing on a landmark's coarse tile footprint is guided back onto the field. **Kraken**: seeded lairs in the open sea (6 tiles of water all round, away from the start), a water-bound boss that rises when a boat comes within 650 px, with its own cards, map marker, art and bestiary line; a defeat is kept with the lairs (no save change). Next: 9f–9i. |
| 10 Playtest feedback | **Done** | After two hours of play the owner asked for eleven changes; they came first, before 9f–9i. **10a**: every full-screen layer follows a window resize (Pixi resizes on the next frame, so all layouts listen to the renderer's own resize); dev tools for gold, resources, a build kit, finishing sites, places to jump to and an export box; a dock **recalls** your boat; ambushes raise half again as many monsters (6–15) on a 380–480 px ring with one side open, shown first and closing in group by group; experimental **click to use** (a setting) for anything already in reach. **10b**: the world map is a DOM panel to pan (drag, keys, stick) and zoom (wheel, keys, shoulders) over explored land only, with hover names; dungeon floors keep their explored fog in the save; Visited and Cleared badges. **10c**: a place is cleared when every floor is cleared, every chest (vault and boss too) opened and the boss down (`core/world/completion.ts`, from the seed, so unvisited floors count); banner, stinger, event, badge, journal progress; an exit portal by the boss arena in multi-floor dungeons. **10d**: towns per seed (`core/world/towns.ts`): three sizes, three street plans, houses on lots, decor; services where they belong, sides varied; `verifyTown` proves every service and the exit reachable and uncrowded, with retries and the old town as a fallback; generator version 3. **10e**: a teleporter in every town (attuned on entry); the world map's travel mode with ringed destinations, a list and a confirm bar; free between waypoints, otherwise a fare by distance (`core/world/travel.ts`); the waypoint panel is gone. **10f**: the pixel art style by default (one `WorldGradeFilter` pass draws the world at the ground's 2 px grain, cells in whole device pixels, the camera snapped to them; fine, medium, chunky or smooth), screen filters (pixelate, CRT with click warping, film grain) and colour grades on a `sceneRoot` under the names and HUD; the ground felt on screen (`core/world/surfaceFx.ts`: tint, desaturation, edge glow, heat shimmer, eased, scaled by the flash setting, no shimmer under reduced motion). **10g**: corrupted lands (`core/world/corruption.ts`: about 8% of land in large patches past 150 tiles, cached a chunk at a time with a safe chunk skip); drained violet ground, dead trees among blight spires and crystals, violet ash, a darker violet day, the dark music and a drone; camps 2.5 times as common and bigger, more roamers; a discovery banner once; generator version 4. World events (`core/world/worldEvents.ts`, `app/worldEvents.ts`): warbands, swarms and hunters every 2.5–4.5 minutes (a third of that in the blight), never near the start, a town, at sea, in a fight or a safe zone; off-screen spawns, a banner with the direction, a map marker, a reward, and they give up if you get away. |

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

Phase 8 is split in steps. Controller support moved to the cross-cutting Input work above.

**8a: Polish pass (UI, z-order, equipment on controller, art)**

Problems found by playing on a desktop window, a 740×420 landscape phone and a 390×760 portrait phone:
- On small screens the party bar, the skill bar, the wallet and the HUD buttons are drawn *over* open
  panels (loadout, journal, shops), hiding their buttons; in portrait the tracker, the pill and the minimap
  crowd the top of the screen.
- Clutter: every ordinary monster shows a "Lv N" label and a full health bar, the wallet lists zero
  resources, the HUD has a sound button that the pause menu already covers, the tracker always lists every
  objective, the party bar is as large on a phone as on a desktop.
- Z-order: the hero disappears behind cliff walls and tall trees standing south of them, NPC names are
  hidden behind market stalls, damage numbers go under trees.
- Equipment on a controller works but is slow: X / Y / RT cast skills even while the loadout is open, there
  is no way to equip, lock or swap heroes from the panel with face buttons, sockets list every rune instead
  of the ones that fit, and the panel shows no button hints.
- Art: trees and rocks have no ink outline (heroes and monsters do), canopies are flat blobs, rocks are
  three plain polygons; several monsters (bee, scarab, boar, gull, mummy, spider) read poorly; heroes lack
  shading.

Tasks
- **Layering**: panels sit above every HUD element; while a panel is open on a small screen the HUD bars,
  tracker and minimap step aside; panels fill small screens and scroll inside.
- **Declutter**: level labels only on elites, bosses and monsters well above the hero; health bars only once
  damaged (elites and bosses always); wallet shows gold and the resources you hold; sound button removed
  from the HUD (pause menu); tracker shows the tracked quest's next objective and folds to its title; a
  compact party bar and skill bar on small screens.
- **Z-order**: decor in front of the hero fades out while it covers the hero; the hero shows as a
  silhouette through walls; names, health bars and damage numbers draw on an overlay above the world.
- **Controller equipment**: inside a panel the face buttons act on the focused element instead of casting
  (X equip / unequip, Y lock, A open, B back); LB / RB switch the hero whose loadout is shown; sockets
  open a rune picker that lists only runes that fit, with the stat change; a button-hint bar along the
  bottom of the panel follows the device (keyboard keys, Xbox / PlayStation / Switch glyphs).
- **Art**: outlined trees with layered, three-tone canopies, rim light, roots and bark; faceted outlined
  rocks, boulders, ore and ice with cracks, moss and snow caps; shaded heroes; redrawn bee, scarab, boar,
  gull, mummy and spider, plus outline and shading passes on the rest.

Acceptance
- At 740×420 and 390×760 no HUD element covers an open panel's buttons (checked by an e2e that compares
  bounding boxes); a pad can equip a spell, socket a rune through the picker, lock a spell and switch the
  shown hero without touching the mouse, and X does not cast while the loadout is open; a hero standing
  behind a wall or tree stays visible; ordinary monsters at the hero's level show no label until hurt.

**8b Audio**: a mixer with master, music, effects and UI buses, voice limits and stereo position by distance;
about 40 synthesized effects as data (hits, deaths, every spell, pickups, bosses, chests, stairs, seals,
building, quests, UI); procedural music as data (a track per region group, town, cave and ruins, dungeon,
boss and title, with a combat layer and darker variants far out) played by a look-ahead scheduler with
crossfades; volume sliders.

**8c Regions and roads**: named regions (seeded Voronoi cells with a name, a level band and a capital town),
region banners and names on the world map; roads between neighbouring towns and from the start to the
nearest town, routed around water and walls, drawn into the ground, faster to walk on, kept free of decor
and camps, with signposts.

**8d Archetypes and runes**: Ember Trail, Seeker Wisps, Returning Glaive, Spore Cloud (auto), Earthshatter
and Mending Light (active); crit, homing, mana-on-kill and echo parameters; eight runes (Keen Edge,
Colossal, Ricochet, Seeking, Mana Siphon, Splinter, Overcharge, Aftershock).

**8e Accessibility**: text size, colour-blind palettes with shape cues, reduced motion, keyboard and
controller rebinding.

**8f Performance**: a benchmark script (150 monsters, ~200 spell objects), culling, caps, spatial queries,
fewer per-frame allocations, an FPS overlay; measured numbers recorded here.

Measured with `node scripts/perf.mjs 200`: 1280 × 720, 150 monsters kept alive around the hero, five auto-cast
spells at level 8 with Multishot and Piercing. The ticker is stopped so every frame is timed the same way, and draw
calls are counted after a 60-frame warm-up. Same machine, runs alternated; before = the 8e commit.

| | Before | After |
|---|---|---|
| Draw calls per frame | 1,112–1,130 | 23 |
| Render time per frame (software GPU) | ~600 ms | ~360 ms |
| Simulation step, average / p95 | 6.8–7.0 / 14.5–15.3 ms | 5.9–6.6 / 10.5–11.9 ms |

Render times come from a software GPU (SwiftShader), so they only compare runs with each other. On a real GPU
the draw-call count is what matters. What brought it down:
- Monster, hero, critter, gem, bolt, wisp and blade art is baked into shared atlas pages (`render/atlas.ts`).
- Additive glows are stored with zero alpha so they batch with normal sprites without a blend switch.
- Graphics up to 1,000 points are batched.
- Grass, pebble and floor-joint details are painted into the ground texture.
- Additive particles go to one glow layer.
- Decor is culled off screen.
- `nearestEnemies` uses the spatial hash, and occlusion reuses its sets.

F3 or the pause menu shows frame rate, step time and draw calls in game.

**8g Onboarding**: contextual, non-blocking tips that follow the input device, a How to play page, a tips
switch; save v8 keeps seen tips and discovered regions.

Acceptance: the music follows region, town, dungeon and boss; every common action makes a sound; a road
leads from the start to a town and the hero walks faster on it; regions are named on the map; the new
spells and runes work in loadouts, shops and loot; each accessibility option visibly takes effect and
persists; the benchmark meets the frame budget on the reference run; a new player gets each tip once.

### Phase 9: Deferred work, quality of life, professional polish (XL)

Phase 9 has three goals:
- Close the items deferred in Phases 1–8.
- Add the options and conveniences players expect from a finished game.
- Bring presentation, robustness and tooling to release quality.

Steps run in the order below, so the game stays shippable after each one. Each step is typechecked,
unit-tested, e2e-checked, committed and published to the test page, as in Phase 8. New saved state goes
through save migrations from v9 on, each with a migration test.

**Decisions** (confirmed by the owner):
- One difficulty, with no difficulty modes.
- SVG icons everywhere and no emoji anywhere, in the DOM UI and on the canvas.
- Recruitment is deferred beyond Phase 9.
- Performance: no reference hardware is named, so optimise as far as possible: quality presets, render
  scale, a first-run benchmark that picks defaults, and profiling work.
- The second height layer is dropped.

**Deferral audit.** Items deferred earlier that are already done:
- drag and drop (Phase 3);
- gold and resource spending (shops, healer, inn, towers);
- the quest board and dialogue scripts (Phase 7);
- music (8b);
- pad button rebinding (8e).

The rest are in the steps below (marked *deferred*) or listed under Later.

**9a Visual identity: icons, fonts, design tokens**
- **Icons:** every emoji is replaced by an SVG icon, in panels, buttons, the HUD, toasts, banners, map
  markers, the minimap, prompts, dialogue and data (spells, runes, cards, heroes, towers, biomes, quests,
  tips).
  - Sources: game-icons.net (CC BY 3.0) for game content and Material Design Icons (Apache 2.0) for UI
    glyphs. A build script extracts only the icons in use into a generated module.
  - The DOM gets an `<Icon>` component. The canvas draws icons through `Path2D` into cached textures,
    synchronously, plus an icon-and-text helper for banners and toasts.
  - Each icon has a default colour from the palette and a dark outline, for legibility over the world.
- **Fonts:** a display face for titles and banners and a readable UI face, bundled (OFL) and inlined in the
  single-file build. The canvas text waits for them to load.
- **Design tokens:** colours, spacing, type scale and radii as CSS variables, with one panel frame style and
  consistent hover, press and focus states.
- **Credits:** in the README; the in-game Credits page comes in 9b.

**9b Front end, saves and settings (QoL)**
- **Title screen:**
  - Continue, New Game (with an optional seed field), Load, Options, Credits.
  - The version and build date in a corner.
  - A "What's new" card after an update.
- **Saves:**
  - Three save slots plus the autosave. Each shows hero levels, play time, region and a thumbnail.
  - Rename, and delete with a second press to confirm.
  - Every slot keeps its last three backups, with "Restore backup" when a save fails to load.
  - Export and import a save as a file. The test page's sandbox blocks downloads, so there the export shows
    the text to copy.
- **Settings, in tabs** (Game, Video, Audio, Controls, Accessibility, Help). They open from the title and the
  pause menu, and every option persists. New options:
  - **Game:**
    - auto-pick upgrades;
    - confirm before salvaging;
    - pause when the window loses focus.
  - **Video:**
    - quality preset (Low, Medium, High: particles, light map, ambience, render resolution);
    - render scale (50–100%);
    - a 30 / 60 / uncapped frame limit;
    - camera zoom (three steps);
    - shake and flash intensity;
    - damage numbers (all / crits only / off).
  - **HUD:**
    - HUD scale;
    - minimap size and opacity;
    - monster health bars (hurt only / always / off);
    - tracker on or off.
  - **Controls:**
    - mouse mode (hold to move / click to move);
    - aim actives at the cursor or along the move direction.
- **Message log:**
  - The last 50 toasts and banners.
  - A statistics page: kills by monster, bosses, distance, gold earned, play time.

**9c Party, loadout and spells (deferred + QoL)**
- **Party and loadout:**
  - *Deferred:* view and edit any hero's loadout without switching the active hero.
  - Three loadout presets per hero.
  - "New" badges; sort and filter memory.
  - *Deferred:* favourites (a star that pins items to the top).
  - *Deferred:* ASSIST bench role (a benched hero casts one chosen auto spell at a reduced rate).
  - *Deferred:* the healer gets their own dialogue.
- **Spells:**
  - *Deferred:* spell preview against a training dummy, before and after a change.
  - *Deferred:* a codex: a bestiary of monsters seen, a spell and rune compendium, a places list.
  - *Deferred:* trigger chains two levels deep and spell-to-spell triggers.

**9d Art, presentation and juice**
- *Deferred:* houses, town gates, market stalls, wells and notice boards in the ink style, plus shrines, ruin
  entrances and lairs.
- *Deferred:* tiered monster species per biome: at least one new species per biome for tiers 2 and 3.
- **Story moments:**
  - Boss intro cards and demon lord victory cards.
  - An ending sequence with scrolling credits.
  - Restyled death and respawn screens.
- **Game feel:**
  - Hit-stop on crits and big kills.
  - The camera leads slightly in the direction of travel.
  - Stacked damage numbers.
  - Pickup trails.
  - Eased panel transitions (none under reduced motion).
- **Audio:**
  - Ambient beds per biome.
  - Stingers for discoveries, boss start and victory.
  - Music ducking.
  - Footsteps by surface.

**9e World and dungeons (deferred)**
- **Dungeons:**
  - Keys, levers and pressure plates, with puzzles the generator proves solvable.
  - Dungeon-weighted loot.
  - Vaults and unlock gates.
- **Monster navigation:** hazard costs in the flow field.
- **Sea:** a kraken sea boss.

**9f Towers, quests and story (deferred)**
- **Towers:**
  - Upgrades and levels.
  - Siege events that temporarily disable towers (towers stay indestructible).
  - Build sites on claimed zones.
  - Interior towers.
- **Quests:**
  - Fetch and escort objectives.
  - Townsfolk quest givers and innkeeper rumours.
  - Bounty reputation per town.
- **Story:** a writing pass with lord introductions and defeats, Elder lines between chapters and an
  epilogue, told in scenes with portraits, letterbox and camera pans. Voice acting is out of scope.

**9g Input (deferred)**
- Per-pad profiles for non-standard mappings (a guided setup, saved per pad).
- Richer haptics with their own intensity.
- A pad-driven world map: pan and zoom (**done in 10b**), move between markers, custom pins.

**9h Robustness, performance and engineering**
- **Crashes and storage:**
  - A crash screen with "copy error report" that keeps the last good save.
  - A full or blocked storage warning.
- **Offline and mobile:**
  - Installable and offline on Pages, with app icons and a social preview image.
  - A fullscreen toggle and an orientation hint.
- **Performance, as far as it goes:**
  - Profile the update and render paths again.
  - Pool bullets and particles.
  - Skip AI and animation for far, idle monsters.
  - Dynamic resolution when frames run long.
  - A first-run benchmark that picks the quality preset.
- **Tooling:**
  - ESLint and Prettier in CI.
  - A perf regression check in CI.
  - A bundle size budget.
  - Fewer `@ts-nocheck` files.
- *Deferred:* the headless `Simulation` split, with deterministic sim tests.

**9i Release readiness**
- **Text:** a proofreading pass and a glossary.
- **Accessibility audit:** contrast, focus order, ARIA labels, 140% text on a phone.
- **Release:**
  - A changelog, a 1.0 checklist, and the README and docs updated.
  - The full e2e chain, visual scripts and perf runs.
  - Publish.
  - Merge to main only on the owner's approval.

**Later (beyond Phase 9):** recruitment and a roster beyond three heroes; localization (a string table);
voice acting.

**Dropped:** the second height layer.

Acceptance
- No emoji remains in the source or on screen. A test scans `src` for emoji, and an e2e scans the rendered
  DOM.
- Settings open from the title and the pause menu, sit in tabs and persist, and each option takes visible
  effect.
- Three slots and their backups survive a corrupt save.
- A hero's loadout can be edited without switching to them.
- Towns use the new art.
- Bosses have intro and victory cards, and finishing the story rolls the credits.
- Puzzle dungeons are always solvable.
- Tower upgrades, sieges and escorts work end to end.
- The world map can be driven with a pad.
- A crash shows the report screen and keeps the save.
- CI runs lint and the perf check.
- The benchmark improves on the 8f numbers.

### Phase 10: Playtest feedback (L)

After about two hours of play the owner sent eleven groups of feedback. They were taken before 9f–9i, in eight
steps, each committed, checked by CI and published to the test page:

- **10a** Bugs and testing tools: the resize bug, dev tools, boat recall, fairer ambushes, click to use.
- **10b** A pannable, zoomable world map; dungeon fog that persists; Visited and Cleared badges.
- **10c** Dungeon completion and the exit portal.
- **10d** Varied towns with every service reachable (a proof per layout).
- **10e** Town teleporters and the travel network (free only between the party's own waypoints).
- **10f** One pixel grain for all art, screen filters and colour grades, and terrain felt on screen.
- **10g** Corrupted lands (denser, not higher level) and overworld events.
- **10h** Docs, the full e2e chain, perf, publish.

Decisions: pixel art by default with a Smooth switch; feedback before 9f–9i; corrupted lands only denser;
travel paid unless both ends are waypoints. No save version change: the new fields are optional (`complete`
and `fog` on places, attuned towns are the visited ones, the blight is derived from the seed, events are
transient). The generator version is 3 for the towns and 4 for the corrupted lands.

Acceptance
- A resize leaves no layer at the old size; the map pans and zooms without revealing fog.
- Every town layout passes the walkability proof; every service can be walked to and used in e2e.
- A dungeon is cleared only when everything in it is done; the portal leads out and stays.
- Travel charges the right fare and lands on the destination's teleporter or waypoint.
- The pixel style is one pass with the camera on whole cells; the HUD and names stay outside the filters.
- Corrupted land is barren, violet and denser; events start off screen, pay out, and give up.

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
