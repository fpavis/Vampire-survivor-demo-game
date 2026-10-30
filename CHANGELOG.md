# Changelog

What changed in each version, newest first. The game shows a short “What's new” card on the title screen after an
update; the longer reasons and the design are in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
Saves from every earlier version still load: each change of the save format came with a migration, from the first
format on (`src/core/save/migrations.ts`).

## 0.16.0 · 2026-10-30 · Words and access

- All the game's text read through and corrected: monsters in the plural (“Cull the Wolves”), British spelling,
  typographic apostrophes, quotes and ellipses, “health” instead of “HP”, and the last story quest no longer
  mentions a tower where the Expedition Mine is meant. The terms are written down in `docs/GLOSSARY.md` and a test
  keeps the rules.
- Every screen audited for accessibility (`docs/ACCESSIBILITY.md`): every panel is a named dialog, Tab stays inside
  an open panel, icon buttons have names, the page has a landmark and a heading, the greys and the colour-blind
  palettes reach 4.5:1 on the panels, and text at 140% fits on a phone held sideways (bars and badges grow with the
  text, the death screen and the What's new card scroll, the hint bar no longer covers the spells).
- Key names in messages and in the loadout's help follow the player's own bindings.
- Release files: this changelog, `docs/RELEASE.md` (the 1.0 checklist), the licence filled in.

## 0.15.0 · 2026-10-29 · Installable, steadier and faster

- Installable, and plays offline once loaded (a manifest, icons and a service worker written into the build);
  a Fullscreen switch and a hint to turn an upright phone.
- A crash screen with a copyable error report, which keeps the last good save; a warning when the browser will not
  let the game save, with Export.
- Dynamic resolution keeps the frame rate up; the first start picks the graphics quality for the device.
- Lighter fights: spent bolts and sparks are reused, monsters far off screen rest, the world remembers its last chunk.
- Tooling: oxlint, a size budget and a performance budget in CI; the browser tests share one harness and runner on a
  fixed world and run in four shards (`docs/TESTING.md`).

## 0.14.0 · 2026-10-28 · Controllers, vibration and the world map

- A controller the browser does not lay out can be set up button by button; vibration has its own strength, a test
  and more moments to feel.
- On the world map the d-pad (or Q and E) goes from place to place; pins (Y, P or a right-click) are saved and shown
  on the minimap.

## 0.13.0 · 2026-10-27 · Fixes from the second playtest

- Switching heroes no longer passes wounds or drains mana, works after loading a save, and says how long it has left.
- Mountains and cave walls have rounded natural edges, with baked tops, a wandering snowline and gradient cliffs.
- Spells look for monsters on screen; bolts stop at walls and mountains.
- The climbing tower is the Expedition Mine. Bridges can be walked onto from their gatehouse and building never traps
  the hero. The travel map scrolls over everything explored.

## 0.12.0 · 2026-10-27 · Towers that grow, townsfolk with work, and lords who speak

- Spires, obelisks and beacons rise to level 3; sieges silence a tower until the besiegers are beaten; building on
  claimed ground costs a quarter less.
- Townsfolk jobs (recover a thing, walk a traveller to the next town, thin the monsters), innkeeper rumours, and town
  standing (Known, Trusted, Hero) with better pay, prices and a free bed.
- The demon lords speak in scenes, the Elder has a word between chapters and leads into the ending.

## 0.11.0 · 2026-10-27 · A game menu, fairer levels and a training ground

- One game menu (Esc or Start): party, spells, upgrades, journal, building, the map, saves and settings.
- Experience is weighed against level; passives come in ten small ranks with four new ones and mastery after.
  Passives from older saves are refunded.
- A training ground with three dummies and a damage meter in every town.

## 0.10.0 · 2026-10-27 · Pixel art, teleporters and corrupted lands

- Pixel art by default (or smooth), screen filters and colour grades; the ground is felt (lava, ice, quicksand).
- A world map to pan and zoom; dungeon floors remember what was explored; places are cleared when everything is done.
- Towns of three sizes and street plans, each with a teleporter and travel between towns and waypoints.
- Corrupted lands; warbands, swarms and hunters; fairer ambushes; boat recall; click to use.

## 0.9.0 · 2026-10-25 · A new look, new monsters and an ending

- Every emoji replaced by drawn icons; new typefaces; a title menu with Continue, New Game, Load Game, Options and
  Credits; three save slots with backups, export and import; settings in tabs.
- Edit any hero's spells, three loadout sets per hero, Assist from a resting hero, a codex, a training dummy.
- Ten more monsters for the far regions, boss cards, an ending with credits, a death screen, towns redrawn in ink.
- Game feel (hit-stop, camera lead), sound beds per region, dungeon vaults with keys, levers and plates, monsters that
  walk around lava, and a kraken in the open sea.

## Before 0.9.0 · Phases 1 to 8

The game was built in phases and not versioned until 0.9.0:

1. **World and saves**: a fixed 60 Hz step, a streamed world of five regions, persistent fog of war, zone levels by
   distance, resident camps and warlord lairs with sight and leash, versioned compressed saves.
2. **Spells and stats**: a data-driven spell engine with runes, mana for active skills, four stat paths, level-ups
   that never pause the game.
3. **Items**: loot rolls, a wallet, drag and drop, salvage and filters.
4. **The party**: three heroes with a bench (aura, reserve, half experience), a healer, and respawn at the last town.
5. **Surfaces and towns**: lava, mud, ice, springs; claim zones and ambushes; gathering; towns with services.
6. **Building**: towers, a bridge, a dock and boats, and the climbing tower.
7. **Story and dungeons**: quests, the Elder and the five lords, dungeons with guardians and bosses, bounties.
8. **Polish**: small-screen layout, depth sorting, a controller for every screen, audio and music, regions and
   roads, accessibility settings, onboarding tips.
