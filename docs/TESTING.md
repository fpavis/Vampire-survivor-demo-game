# Testing

Four layers, from the fastest to the slowest. Everything below runs in CI on every push.

| Layer | What it checks | Run it |
|---|---|---|
| **Static** | Types (`tsc`, strict) and lint (oxlint) | `npm run typecheck`, `npm run lint` |
| **Unit tests** | The pure rules in `src/core` and the small pieces around them, in Node: no browser, no game loop | `npm test` (about 15 seconds) |
| **Budgets** | The size of the build, and draw calls, objects, chunk builds and step time of a crowded fight | `npm run check:size`, `npm run check:perf` |
| **Browser tests** | The built game in headless Chromium, driven like a player: keys, a faked controller, panels, saves and reloads | `npm run test:e2e` (about 20 minutes in one go; CI splits it in four) |

## Unit tests

`tests/*.test.ts` (and `.test.mjs` for the test runner itself), Vitest. They cover the rules that live in
`src/core` as pure functions: world generation and its determinism, regions, roads, towns, dungeons and
puzzles, quests and the story, spells and runes, loot and progression, saves (codec, validation, migrations),
input (pad mapping, key bindings, profiles, haptics, spatial navigation), audio, settings and auto-tuning,
the crash report, the service worker the build writes, the colour contrast of the interface and every palette
(`contrast.test.ts`), the rules of the written text (`text.test.mjs`, see `GLOSSARY.md`), and the browser test
runner's own helpers.

A rule that can be written as a pure function should be tested here, not in the browser: it runs in
milliseconds and fails with a precise message.

## Browser tests

Each file in `tests/e2e/` is a *suite*: `smoke`, `phase1` … `phase12`, `phase9f`, `phase9g`, `phase9h`, `phase9i`
and `input`. They share one harness (`harness.mjs`) and one runner (`run.mjs`). `screens.mjs` (every DOM screen with a
way to open it) and `a11y.mjs` (axe-core and a contrast measure) are helpers for the accessibility audit.

```
npm run build                               # the suites test dist/, so build first
npm run test:e2e                            # every suite, in order, ending with one table
npm run test:e2e -- --only phase9g,input    # some suites
npm run test:e2e -- --shard 2/4             # the second of four balanced parts (what CI runs)
node tests/e2e/phase12.mjs                  # one suite on its own
ONLY=mountains node tests/e2e/phase12.mjs   # one section of a suite
```

The runner runs every suite even when one fails, then prints a table (suite, status, checks, failures, time)
and names each failing check. In CI the same table is on the run's summary page.

| Variable | Effect |
|---|---|
| `ONLY=a,b` | Only these sections of a suite (`want('a')` in the suite). The first lines of each suite list its sections |
| `SEED=<n>` / `SEED=random` | The world to play in. **2024 by default**, printed at the top of every suite. A failure in a random world is reproduced with `SEED=<the printed seed>` |
| `THROTTLE=n` | Slows the CPU n times, like a busy CI runner: the way to reproduce a timing failure (`THROTTLE=4`) |
| `BROWSER=firefox` or `webkit` | The engine to drive (Chromium by default). Only `smoke` and `input` are expected to pass outside Chromium; its flags and `THROTTLE` do not apply. The browsers come from `npx playwright-core install firefox webkit` |
| `CHROMIUM_PATH` | The browser binary. Without it the newest headless shell under `PLAYWRIGHT_BROWSERS_PATH` (default `/opt/pw-browsers`) is used, and otherwise Playwright's own |
| `SHOTS=<dir>` | The suites that take screenshots save them there |

### The world is fixed

Every suite plays seed 2024 unless told otherwise. A test that depends on where things are (a camp, a spring,
a mountain) must be able to rely on them being there, and a failure must be the same failure next time. Two
flakes in this project's history came from random worlds: a healing spring placed inside a rock (the hero was
moved off it by the "unstick" code), and a monster spawning next to a reach check.

The *Browser tests in random worlds* workflow (run by hand on GitHub) plays the world-heavy suites in worlds
nobody chose, to find tests that quietly assume a layout. It is not part of the gate: a random layout should
never turn a push red.

### Writing a check

- **Wait for state, never for time.** The game runs slowly on the software GPU of a test machine (a few frames
  a second). Use `page.waitForFunction` (the suites' `until`) on the thing you expect, or step the game
  yourself with `window.game.gameLoop(1)`.
- **Set the scene directly.** `window.game` and `window.__dev` are there for tests: teleport the hero, spawn
  an enemy, grant gold. Test the rule, not the walk to it.
- **Clear what is not yours.** A monster that wanders into a reach check makes it flaky: kill the others
  (`e.dead = true; g.reap()`) or plant the one you need.
- **A check says what should be true**, in words a player would use: `check('a healing spring heals', …)`.
  The third argument is shown next to the result: put the numbers there.
- **Page errors fail the suite.** Anything on `console.error` or an uncaught exception is counted; a suite that
  causes errors on purpose says so with `h.allowErrors(/pattern/)`.

### A new suite

1. Create `tests/e2e/<name>.mjs` from any recent suite: `const h = await suite('<name>', { viewport })`, a page
   from `h.newPage()`, checks with `h.check`, and `await h.finish()` at the end.
2. Add its name to `SUITES` in `runner-lib.mjs` and an estimate of its seconds to `timings.json` (the shards
   are balanced by it). A unit test fails if a file and the list disagree.

## Budgets

`npm run check:size` (after the build): gzipped JavaScript at most 560 KB (488 now), CSS 20 KB.

`npm run check:perf`: a seeded walk and a crowded fight (150 monsters, five boosted spells).

| Measure | Budget | At 0.15 |
|---|---|---|
| Draw calls per frame | 40 | 25 |
| Display objects in the world layer | 1400 | about 965 |
| Particles | 460 | about 440 |
| Chunk views built on a 600-frame walk | 60 | 31 |
| Average simulation step | 30 ms | about 4 ms |

The counts do not depend on the machine, so their budgets are tight; the step time is loose because CI runners
differ. For a real comparison between two builds use `node scripts/perf.mjs`, run alternately against both.

## What tests what

| Area | Browser suite (sections) | Unit tests |
|---|---|---|
| Boot, a new game, entering a place, the map | `smoke` | `config`, `determinism` |
| Resident camps, sight and leash, respawn, persistence (Phase 1) | `phase1` | `population`, `difficulty`, `ambush` |
| Spells, mana, level-ups, loadout, loot (Phase 2) | `phase2` | `spells`, `loot`, `progression` |
| Wallet, drag and drop, salvage, filters (Phase 3) | `phase3` | `loot`, `save` |
| The party: switching, bench, death, healer (Phase 4) | `phase4` | `party` |
| Ground effects, claim zones, ambushes, gathering, town services (Phase 5) | `phase5` | `surfaceFx`, `world5`, `towns`, `townsfolk` |
| Towers, the Expedition Mine, bridges, docks, boats (Phase 6) | `phase6` | `towers` |
| Dungeons, quests, the story, bounties (Phase 7) | `phase7` | `dungeons`, `quests`, `completion` |
| Small screens, the loadout with a pad, depth (8a) | `phase8` | `nav`, `pick` |
| Audio, regions and roads, new spells, accessibility, tips (8b to 8g) | `phase8b` (`audio`, `roads`, `spells`, `access`, `tips`) | `audio`, `ambience`, `roads`, `access`, `tips` |
| Icons, settings, save slots, journal, loadout views, training dummy, codex, game feel, story moments, species, kraken, hazards, vaults, the title screen (9a to 9e) | `phase9` (`icons`, `settings`, `slots`, `journal`, `loadout`, `dummy`, `codex`, `feel`, `sound`, `story`, `species`, `kraken`, `hazards`, `vaults`, `front`) | `icons`, `no-emoji`, `settings`, `slots`, `codex`, `feel`, `skillMeter`, `story-moments`, `species`, `puzzles` |
| Window resize, test tools, boat recall, ambushes, mouse interaction, the world map, dungeon fog, badges, completion, portals, town layouts, travel, look, corruption, world events (10a to 10h) | `phase10` (`resize`, `devtools`, `recall`, `ambush`, `mouse`, `map`, `dfog`, `badges`, `complete`, `portal`, `town`, `travel`, `look`, `corrupt`, `events`) | `mapview`, `travel`, `look`, `corruption`, `blight`, `worldEvents`, `towns` |
| Balance, the game menu, the training ground, per-skill damage (11) | `phase11` (`balance`, `menu`, `yard`, `dps`) | `progression`, `skillMeter`, `party` |
| Tower levels, sieges, townsfolk jobs, escorts, rumours, story scenes (9f) | `phase9f` (`towers`, `siege`, `townsfolk`, `escort`, `rumour`, `scene`) | `towers`, `townsfolk`, `quests`, `story-moments` |
| Hero switching, timers, building, reach and walls, the travel map, mountain outlines and their baked tops (12) | `phase12` (`party`, `building`, `reach`, `travel`, `mountains`) | `rockShape`, `party`, `mapview`, `travel` |
| Controller setup, haptics, map stepping and pins (9g) | `phase9g` (`profile`, `haptics`, `map`) | `input`, `bindings`, `mapview`, `save` |
| Crash screen, storage warnings, a browser without WebGL, offline and install, fullscreen, performance (9h) | `phase9h` (`crash`, `storage`, `title`, `nogl`, `pwa`, `perf`) | `crash`, `app-shell`, `autotune`, `settings` |
| Accessibility of every screen: names, contrast, dialogs, keyboard focus, text at 140%, the page (9i) | `phase9i` (`names`, `contrast`, `dialogs`, `focus`, `text140`, `page`) | `contrast`, `text` |
| Keyboard, mouse and pad on every screen | `input` | `input`, `bindings`, `nav` |
| Saves, migrations, slots | `phase1`, `phase9` (`slots`) | `save`, `slots`, `codex` |
| The test runner itself | | `e2e-runner` |

## In CI

`.github/workflows/ci.yml` runs three jobs side by side:

- **check**: typecheck, lint, unit tests, build, size budget, the single-file test page;
- **perf**: the performance budget;
- **e2e**: the browser tests in four shards (`--shard k/4`), none of which stops the others.

A shard's suites are chosen by their recorded time (`tests/e2e/timings.json`), heaviest first into the lightest
shard. Update the file when a suite changes a lot; the split only has to be roughly even.
