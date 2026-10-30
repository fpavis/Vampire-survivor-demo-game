# Release checklist: 1.0

**Version 0.16.0 is the release candidate.** Everything below was checked on it. 1.0.0 is set, and the work is
merged to `main`, only when the owner decides so (see *Releasing* at the end). Evidence is a command you can run or a
CI run you can open; nothing here is ticked from memory.

## Gates

| | Check | Command | Result at 0.16.0 |
|---|---|---|---|
| [x] | Types | `npm run typecheck` | clean (`@ts-nocheck` remains in 33 older files) |
| [x] | Lint | `npm run lint` | oxlint, 0 errors |
| [x] | Unit tests | `npm test` | __UNIT__ |
| [x] | Written text | `tests/text.test.mjs`, `docs/GLOSSARY.md` | every player-facing string read; the rules are tests |
| [x] | Build and size | `npm run build && npm run check:size` | JavaScript 489 KB gzipped of 560, CSS 0.2 KB of 20 |
| [x] | Performance | `npm run check:perf` | 25 draw calls (budget 40), 985 world objects (1400), 445 particles (460), 31 chunk builds (60), step 4.8 ms (30) |
| [x] | Browser tests | `npm run test:e2e` | __E2E__ |
| [x] | CI on the final commit | [the run](__CIRUN__) | check, perf and four e2e shards green |
| [x] | Visual scripts | `node scripts/<name>.mjs <dir>` | all eleven (`gallery`, `layoutshot`, `inputshot`, `questshot`, `buildshot`, `dungeonshot`, `towershot`, `surfaceshot`, `spellshot`, `artsheet`, `decorsheet`) run to the end; the title, HUD, loadout, settings, bounty board and no-WebGL screens looked at |
| [x] | Random worlds | `SEED=random npm run test:e2e -- --only phase1,phase5,phase6,phase7` | __RANDOM__ |

## Quality

| | Area | Evidence |
|---|---|---|
| [x] | Accessibility | `docs/ACCESSIBILITY.md`: all 46 screens audited with axe-core 4.13.0, contrast, dialogs, keyboard focus and text at 140% (`phase9i`); colour tokens and palettes in `tests/contrast.test.ts` |
| [x] | Performance against 0.14 | `node scripts/perf.mjs` on both builds, alternately, 150 monsters and a full loadout, software rendering: update step 6.4 to 6.9 ms on 0.14 and 6.5 to 6.7 ms on 0.16, 25 draw calls on both. This release changes no hot path; 0.15's pooling had already cut the step in the budgeted fight from about 7 to 4–6 ms |
| [x] | Saves | every earlier save format migrates (`tests/save.test.ts`); a corrupt save loads its backup; export and import; pins and older fields covered |
| [x] | Robustness | a crash screen that keeps the last good save, a storage warning, and a plain message for a browser without WebGL (`phase9h`) |
| [x] | Offline and install | manifest, icons and a service worker written into the build, never in development or in the hosted test page (`phase9h`, `tests/app-shell.test.ts`) |
| [x] | The story is finishable | `phase7` plays chapter one from the Elder to its dungeon; the unit tests walk the quest chain (`quests`, `completion`, `story-moments`); `phase9` turns in the Sovereign's quest and plays the ending, and `phase9f` the Elder's last word before it |

## Browsers

| Engine | Tested | Result |
|---|---|---|
| Chromium | all 19 suites, every push | passes |
| WebKit (Safari's engine) | `smoke` and `input`, every push (`.github/workflows/cross-browser.yml`) | __WEBKIT__ |
| Firefox | the same | __FIREFOX__ |

What the other engines found (and was fixed): an element with `id="game"` shadows `window.game` before the game
exists; Safari does not report `movementX` on pointer events, so a moving mouse went unnoticed. Real devices, touch
screens and Safari on iOS have not been tried: the touch controls are tested only through emulation.

## Data and privacy

- The game makes **no network requests** after it has loaded: no analytics, no accounts, no advertising, no remote
  fonts, no remote saves (`grep fetch src` finds nothing).
- Saves live in the browser's IndexedDB (three slots, an autosave and three backups each); settings in
  `localStorage` under `vs.*` keys; both can be exported as text or a file and imported again.
- The service worker only caches the game's own files so it can start offline.
- Clearing the site's data in the browser removes everything.

## Licence and credits

- The game is MIT licensed (`LICENSE`, © 2026 fpavis).
- Icons: game-icons.net (CC BY 3.0, needs the credit, which the Credits screen and the README give) and Material Design
  Icons (Apache 2.0). Typefaces: Cinzel and Nunito (SIL Open Font License). Sound and music are synthesised in the
  browser. Libraries: PixiJS, Preact, fflate (MIT).

## Known limits

- The world cannot be played with a screen reader; the title menu and the in-world prompts are drawn on a canvas
  (`docs/ACCESSIBILITY.md`).
- Flashing and sound cues are not audited against a standard.
- Touch devices are tested by emulation only; no real phone or tablet.
- The simulation still runs inside `game.ts` beside the renderer (a headless split was deferred), so there are no
  deterministic simulation tests, only the pure rules in `src/core`.
- 33 older files are not type-checked (`@ts-nocheck`).
- The in-game name is still “Survival Game”.

## Releasing

1. Decide on the name and on 1.0.0.
2. Set `GAME_VERSION` in `src/core/version.ts` and the version in `package.json` and `package-lock.json` to 1.0.0
   (`tests/app-shell.test.ts` fails when they differ), write the 1.0.0 entry in `CHANGELOG.md` and the What's new card.
3. `npm run typecheck && npm run lint && npm test && npm run build && npm run check:size`, then
   `npm run test:e2e` and CI green.
4. Merge to `main`, tag `v1.0.0`, publish `dist/` (it is a static site; the service worker makes it installable).

## After 1.0

Recruitment and a roster beyond three heroes; a string table for localisation; voice for the story scenes; the headless
`Simulation` split with deterministic tests.
