# Survival Game 

A fast-paced, browser-based survival game built with PixiJS where you fight endless waves of enemies, collect experience, and level up to become stronger.

![Game Preview](preview.gif) <!-- TODO: Add your game preview gif -->

## Features

- **Pseudo-3D View**: Tilted ground plane, upright billboard sprites sorted by depth, raised walls and mountains, cliffs, shadows, atmospheric haze and vignette
- **Five Biomes, Infinite World**: Chunk-streamed terrain from layered noise
  - **Verdant Fields** (apple trees, birches, flower beds, haystacks, scarecrows) · **Whispering Woods** (oaks, pines, giant and glowing mushrooms, logs, ferns) · **Scorched Dunes** (cacti, spires, bones, oasis palms) · **Salt Shore** (palms, shells, driftwood, sea stacks, shallows and deep water) · **Stonecrest Mountains** (snowy pines, boulders, crystals, ore, tall walls and peaks)
  - Harmless wildlife per biome (rabbits, butterflies, deer, foxes, lizards, snakes, sandpipers, goats) that flee from you
- **Places to Enter**: caves, ruins and towns are scattered across the world map. Walk up to an entrance and press **E** (or tap the prompt)
  - **Caves** – cellular-automata tunnels, crystals, guarded treasure chests
  - **Ruins** – rooms and corridors with pillars, torches and a guardian vault
  - **Towns** – safe streets with markets, villagers, a healing fountain and an altar that grants a free upgrade
  - Treasure chests and altars give free upgrade picks without costing a level
- **World Map**: live minimap plus a full-screen map (**M**) that remembers everything you have explored and every place you have discovered. Drag it, or use WASD or the left stick, to look around without walking there; the wheel, + and - or the shoulder buttons zoom about the cursor, C or X brings it back to you, and hovering a place names it. Fog stays as it is: only land you have seen is ever drawn. Towns you have entered carry a **Visited** flag, places you have finished a **Cleared** tick, and each dungeon floor remembers what you explored
- **Regions and roads**: the world is cut into named regions (Hearthvale at the start, then the likes of "the Weald of Morvale") with a banner when you cross into one and their names and capitals on the world map. Roads link neighbouring towns and lead from the start to the nearest one, routed around water and walls; you walk 25% faster on them and signposts (**E**) name where they lead
- **Smart Enemies** (18 regular types + 5 warlords): each region has its own roster and its own warlord
  - Behaviours: chasing slimes, swarming bees/bats/scarabs, boars that wind up and charge (and get stunned by walls), wolf packs that circle, lunge and retreat, web-spitting spiders and skeleton archers that kite, slamming golems/treants with ground telegraphs, burrowing scorpions, diving vultures, strafing crabs, boulder-lobbing trolls, jellyfish nova bursts, phasing ghosts
  - Warlords (Boar King, Ancient Treant, Sand Pharaoh, Crab King, Stone Titan) chain dashes, slams, volleys, boulders and summons, and enrage below half health
  - Navigation: tile **raycasting** for line of sight, a small **flow field** that routes around lakes, mountains and walls, **whisker probes** for local obstacle avoidance and stuck detection
- **Everything Levels Up**:
  - Spells (equipment that levels from its own kills): Arcane Bolt, Spirit Blades, Chain Lightning, Frost Nova, Meteor, Ember Trail, Seeker Wisps, Returning Glaive, Spore Cloud (auto-cast, free) and Dash, Blink, Aegis, Earthshatter, Mending Light (active: Space / Q / R, cost mana). 23 runes, among them Keen Edge (critical hits), Ricochet, Seeking, Mana Siphon, Splinter, Overcharge and Aftershock. Socket runes into spells (`I` opens the loadout: drag and drop, search, sort, lock, salvage; incompatible runes are greyed out). Enemies drop gold (10%), resources (1%) and rarely a spell or rune (0.1%)
  - A party of three heroes (switch with 1/2/3 or Tab; **J** is the journal; bench heroes lend auras; a town Healer revives the fallen for gold). 12 stat cards per hero in four paths (Arcane, Vigor, Wayfarer, Spirit). Level-ups never pause the game: press `U` to pick when convenient
  - Rarity-tiered upgrade cards that show exactly what changes (e.g. `Damage: 22 → 28`)
  - Enemies scale with your level; elites appear and a regional warlord shows up every few levels
- **World systems**: ground surfaces (lava and poison hurt, mud and quicksand slow, ice speeds you up, springs heal, mana wells and glyphs boost your magic; fireproof golems and poison-bred spiders shrug them off), claimable hold-out zones that become safe havens, ambush plates, harvestable trees, rocks and ore, and towns with a merchant, an innkeeper, a healer and gossiping townsfolk
- **Towers, docks and boats**: press **B** to build. Lay a site (click, or Enter), haul gold, wood, stone and iron to it and press **E**; the scaffold grows in stages and a ceremony marks the finished tower. **Arcane Spire** (fires a socketed auto-cast spell from the tower with the spell's own level and runes), **Warding Obelisk** (a dome that holds monsters out and heals you), **Beacon** (reveals a wide area of the map), **Waypoint** (fast travel between waypoints for a gold fare), **Climbing Tower** (carves a stair into a mountain and opens a plateau of ore and crystals), **Bridge Tower** (spans deep water) and **Dock** (moors a boat: sail deep water with WASD, step ashore with **E**, find buried treasure on remote islands, beware gulls and jellyfish). All edits are saved as small deltas on top of the seeded world
- **Quests, story and dungeons**: every town has an **Elder** (a data-driven main story: five demon lords hold the five regions, Azrathul the Demon Sovereign waits above them) and a **bounty board** (four rotating side jobs from templates: cull, deliver, scout, clear, build, survive; claim the reward at any board). Objectives listen to the world: kills, finding places on the map, clearing dungeons, collecting, delivering goods, building towers, entering places, surviving. **J** opens the journal (D-pad → on a controller), a tracker sits under your portrait and tracked quests mark the world map. Nothing is mandatory: the story only moves when you talk to the Elder
  - **Dungeons** are a seeded share of caves and ruins (marked on the map): 2 to 5 floors, harder with every step down, stairs that stay **sealed until the floor's guardians fall**, a **boss on the last floor** (the nearest dungeon of each region is its demon lord's lair) and a **guaranteed chest of skills** that waits for you if you leave. Climbing-tower plateaus hide a three-floor **Skyvault** and some remote islands hide a **drowned shrine** (reach them by boat)
  - **Vaults**: about two dungeon floors in three have a sealed vault with a richer chest. Each gate is a puzzle: find the **key** somewhere on the floor (a couple of guards keep it), pull every **lever**, or light all three **pressure plates** before the first one fades. The generator proves every vault can be solved and never stands between you and the stairs, and an open vault stays open. Dungeon chests favour the schools of magic of their region and pay better deeper down
- **Graphics**: baked ground textures with organic biome borders, shore foam, earthen banks and water depth; textured cliffs with moss, snow and glowing crystal veins; a light map for caves, ruins and the dark far regions (torches, crystals, spells and explosions glow); region ambience (leaves, pollen, blowing sand, snow, cave motes, ash); `npm run gallery` saves screenshots of every scene
- **Art**: three distinct, rigged heroes (mage, knight, druid) with walk cycles, shaded robes, armour and sleeves; outlined, shaded monsters with animated legs, wings and glowing eyes; ink-outlined trees with clustered three-tone crowns, feathered palms and snow-laden pines, faceted rocks with cracks, moss and ore; spell effects with trails, shockwaves, light pillars and dash afterimages; gabled, half-timbered town houses with shutters, flower boxes and lanterns; varied townsfolk; gilded minimap frame. `node scripts/artsheet.mjs` lays every sprite out on one sheet, `node scripts/decorsheet.mjs` every tree, rock and prop, and `node scripts/spellshot.mjs` captures each spell
- **Readable depth**: trees, rocks and buildings in front of the hero fade while they cover them, walls and cliffs show the hero as a silhouette, and names, health bars and damage numbers float above the world. Ordinary monsters show no labels; level tags appear only on elites, warlords and monsters above your level
- **Sound and music**: every common action has a synthesized sound (hits, crits, kills, each spell, pickups, chests, stairs, building, quests, menus), placed in stereo by where it happens. Procedural music follows the region, towns, caves and dungeons and bosses, gets drums when a fight heats up and darker far from the start. Master, music, effects and menu volume in the pause menu
- **Accessibility**: text size (90–140%), colour-blind palettes (red-green, blue-yellow) with shape cues on threat tags (▲ ) and rarity letters, reduced motion (no shaking or flashing; follows the system setting), and rebinding of every key and controller button (conflicts swap)
- **Onboarding**: short tips that come up once when they matter (moving, gems, level-ups, loot, towns, roads, dark caves, building, quests, the map, bosses) and name the keys or buttons of your device; switch them off or see them again in the pause menu, which also has a How to play page
- **Performance**: monster, hero and pickup art is baked into shared texture atlases and additive glows batch with everything else, so a fight with 150 monsters draws in about 25 calls per frame (the pixel style adds one screen pass). **F3** shows frame rate, step time and draw calls; `node scripts/perf.mjs` runs the benchmark (`PERF_SETTINGS='{"artStyle":"smooth"}'` compares looks)
- **Saves and settings**: Continue picks up the newest save; three save slots plus the autosave, each keeping its last three versions as backups (a damaged save is reported and its backup can be loaded), with export and import as text or a file and a picture of where you were. Settings sit in tabs (Game, Video, Audio, Controls, Accessibility, Help) on the title screen and in the pause menu: quality preset, render scale, frame-rate limit, camera zoom, screen shake and flash strength, damage numbers, HUD and minimap size, monster health bars, click to move, aiming at the cursor and more. The journal keeps a log of recent messages and your statistics
- **Party and loadouts**: the spell panel shows any hero's loadout without switching to them (hero tabs, **Tab**, or LB/RB), with a button to make that hero active. Each hero keeps three loadout sets, and a resting hero can **assist** with one of their auto spells, cast alongside the active hero at 60% power and a slower pace. Star your favourite spells to keep them at the top; new finds carry a New badge; the sort order is remembered; every spell shows a rough damage estimate for one monster and for a group, and runes show the before and after. The **Resonance** rune makes kills cast your next auto spell. Every town has a **training dummy** with a damage meter, and the healer has their own say
- **Finishing places**: a cave, ruin or dungeon is **cleared** once every floor's monsters are down, every chest (vault and boss chests too) is open and its boss has fallen: a banner says so, the map marks it and the journal lists what is left ("boss defeated · floors 2/3 cleared · chests 5/7"). In dungeons of several floors a **portal** opens beside the boss's arena once it falls and stays on later visits: one step back to the entrance
- **Towns of their own**: every town is laid out from its seed (hamlets, towns and cities; one square, a market street or twin squares; houses on lots with alleys between them), yet the healer always stands by the fountain, the merchant at the market, the elder before the town hall, the innkeeper at the inn's door, and the generator proves each service can be walked to from the gate
- **Teleporters and waypoints**: every town has a teleporter dais inside its gate, attuned the first time you walk in. Using one, or a waypoint you built, opens the world map in travel mode with every destination ringed (gold for towns, violet for waypoints): pick one on the map or in the list and travel. Between two of your own waypoints it is free; any trip to or from a town costs gold by distance
- **Pixel art and screen filters**: by default everything in the world is drawn at the same pixel grain as the ground (choose fine, medium or chunky pixels, or the smooth style), with the camera moving in whole pixels so nothing shimmers. Optional screen filters (pixelate, a CRT screen with scanlines and a curved glass, film grain) and colour grades (warm, cool, noir, sepia) apply to the scene only: the HUD and names stay crisp
- **The ground is felt**: standing on lava tints the scene red, makes the air shimmer and glows hot at the screen edges; ice turns it blue with frost creeping in; quicksand drains the colour; swamps, springs, mana wells and glyphs each have their own tint. The surface chip says what the ground does to you. Strength follows the flash setting, and reduced motion stops the shimmer
- **Corrupted lands**: large, uncommon patches of blight lie over the far regions. The ground there is drained and violet, the trees stand dead among black spires and crystals, violet ash drifts, the music darkens and the land has its own drone. It breeds monsters: camps two and a half times as common and bigger, more wanderers, and world events three times as often (levels stay the same)
- **World events**: every few minutes out in the world a **warband**, a **swarm** (in two groups) or a pack of **hunters** comes for the party from off screen, announced with a banner that says where from and followed by a marker on the map. Beat them for a chest roll and gold; run far enough and they lose your trail. They never start near the start, near a town, at sea or when you are already in a fight
- **Fairer ambushes, boat recall, click to use**: an ambush plate now raises half again as many monsters, on a wide ring with one side always open, and they close in group by group after showing themselves. A dock can **recall your boat** from wherever you left it. An experimental setting lets a mouse click use a chest, door, tree or person within reach
- **Codex**: the journal's Codex tab is a bestiary of the monsters you have met (portrait, habits, numbers, how many you defeated), a compendium of the spells and runes you have found, and a list of the regions and places you have discovered
- **Story moments**: warlords and demon lords announce themselves with a letterboxed card and fall with one of their own; turning in the last quest plays the ending, with the epilogue, a roll of your run and the credits (skippable). The death screen shows how far you got and brings the party back at the last town
- **Game feel**: a short hit-stop on crits and big kills (follows the shake setting), a camera that looks a little ahead while you walk, damage numbers that add up on one monster instead of piling up, sparkle trails on pickups flying in, and panels that ease in. Reduced motion turns all of it off
- **Ambience**: each region, town, cave, dungeon and the open sea has its own bed of sound (wind, birds, waves, an owl, drips), with its own volume slider; stingers mark discoveries, warlords and victories with the music ducked under them; footsteps change with the ground (grass, sand, stone, snow, water, wood, mud)
- **Smarter monsters, a sea boss**: monsters plan their way around lava, quicksand and poison swamp when a detour is cheaper than wading through, and still come straight across when there is no way round. Out on the open sea, sailing too close to a **kraken's** lair raises it: it slams with its tentacles, sprays ink and calls up jellyfish, follows you to the shore but never onto land, and pays out the sea's riches when it sinks. A slain kraken stays slain
- **Monsters at every tier**: each region gains a new species from level 25 and another from level 37 (Thornback and Scarecrow Wight, Stalker Mantis and Thorn Witch, Sandworm and Djinn, Siren and Deep Lurker, Harpy and Yeti), and warlord lairs are marked by a horned-skull totem. Town houses, gates, stalls, wells, shrines, ruin entrances and caves are drawn in the same ink style as the trees and monsters
- **Modern UI**: XP bar, animated health bar, warlord health bar, biome banners, spell and stat slots, mana bar and active skill bar, floating damage numbers with crits, damage vignette. On phones and small windows the HUD shrinks, stacks down the left edge and steps aside whenever a panel is open, so it never covers a menu (`node scripts/layoutshot.mjs` checks three screen sizes)
- **Responsive Controls**: keyboard (WASD), mouse (click and hold), touch with a virtual joystick, and **gamepad** (Xbox, PlayStation, Switch and generic pads through the browser Gamepad API). Prompts, skill keys and hints follow whichever device you used last (`[E]` becomes `[A]` or `[✕]`)
  - Controller: left stick moves, right stick aims dashes and blinks, **A** interacts and confirms, **B** backs out, **X / Y / RT** are the three skills, **LB / RB** switch heroes, **View** is the map, **Start** pauses, and the **D-pad** opens spells (↑), level-up cards (↓) and the build menu (←) or moves through any open panel
  - Every panel works with the keyboard (arrow keys move focus while a panel is open, Enter presses, Esc backs out; WASD keeps walking), the mouse and a controller, including equipping, unequipping and salvaging spells without dragging
  - In the spell loadout the face buttons act on what is focused: **X** equips or unequips a spell (or sockets a rune), **Y** locks it, **A** on a socket opens a rune picker that lists only the runes that fit with their exact effect, **LB / RB** switch the hero whose loadout you see; on a keyboard **F** and **L** do the same. A hint bar along the bottom shows the buttons for your device
  - The pause menu (Esc / Start) has volume sliders, controller vibration, stick dead zone, the touch joystick options, accessibility options, rebinding, tips, a How to play page and a table of every control

## Getting Started

### Prerequisites

- Node.js 20 or newer
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Run it

```bash
npm install
npm run dev        # dev server with hot reload
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | TypeScript strict type check |
| `npm test` | Unit tests (Vitest): world generation, regions and roads, spells, saves, input, audio, accessibility, tips and more |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run build:single` | One self-contained HTML file in `dist-single/` (used for test pages) |
| `npm run test:e2e` | Headless-browser end-to-end suites of the built game, phase 1 to 10 plus input (needs a Chromium; set `CHROMIUM_PATH`; `ONLY=` picks sections of the later suites) |
| `node scripts/perf.mjs [frames]` | Benchmark after `npm run build`: 150 monsters and a full spell loadout; prints step and render times and draw calls |

The roadmap lives in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) and the design notes in
[docs/VISION.md](docs/VISION.md).

## How to Play

1. **Start the game**: press Enter (or A) on the title screen; tips appear as you play
2. **Move**: WASD or the arrow keys, click and hold the mouse, the touch joystick, or the left stick
3. **Fight**: spells cast themselves at monsters that come close; active skills (Space / Q / R, or X / Y / RT) cost mana
4. **Grow**: pick up gems for experience, press **U** to choose upgrade cards, and **I** to equip spells and socket runes
5. **Explore**: follow the roads to towns (healer, merchant, elder, bounty board), enter caves, ruins and dungeons with **E**, open the map with **M**
6. **Settings**: Esc or Start pauses; the pause menu has sound, accessibility, rebinding, tips and How to play

## Built With

- [PixiJS](https://pixijs.com/) - 2D WebGL renderer
- Modern JavaScript (ES6+)
- HTML5 Canvas
- CSS3

## Game Design

### Player Stats
- Health: 100 (base)
- Movement Speed: 5 (base)
- Attack Damage: 25 (base)
- Fire Rate: 2 shots/second (base)

### Enemy Types
- **Basic**: Balanced stats, medium speed
- **Tank**: High health, slow movement
- **Fast**: Low health, high speed

### Level Progression
- Experience required doubles each level
- Enemies become more numerous over time
- Score multiplier increases with level

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- Engine: [PixiJS](https://pixijs.com/), UI: [Preact](https://preactjs.com/)
- Sound effects and music: synthesized in the browser with the Web Audio API
- Icons: [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)), and [Material Design Icons](https://pictogrammers.com/library/mdi/) ([Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)); only the icons in use are bundled (`scripts/build-icons.mjs`)
- Fonts: [Cinzel](https://fonts.google.com/specimen/Cinzel) by Natanael Gama and [Nunito](https://fonts.google.com/specimen/Nunito) by Vernon Adams, Cyreal and Jacques Le Bailly ([SIL Open Font License](https://openfontlicense.org))

## Future Features

- [ ] Multiple Character Classes
- [ ] New Enemy Types
- [ ] Power-up Items
- [x] Sound Effects & Music
- [ ] High Score System
- [ ] Mobile-Optimized Controls
- [ ] Additional Weapon Types
- [ ] Boss Battles

## DEMO
https://fpavis.github.io/Vampire-survivor-demo-game/
