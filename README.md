# Survival Game 🎮

A fast-paced, browser-based survival game built with PixiJS where you fight endless waves of enemies, collect experience, and level up to become stronger.

![Game Preview](preview.gif) <!-- TODO: Add your game preview gif -->

## 🌟 Features

- **Pseudo-3D View**: Tilted ground plane, upright billboard sprites sorted by depth, raised walls and mountains, cliffs, shadows, atmospheric haze and vignette
- **Five Biomes, Infinite World**: Chunk-streamed terrain from layered noise
  - 🌾 **Verdant Fields** (apple trees, birches, flower beds, haystacks, scarecrows) · 🌲 **Whispering Woods** (oaks, pines, giant and glowing mushrooms, logs, ferns) · 🏜️ **Scorched Dunes** (cacti, spires, bones, oasis palms) · 🏖️ **Salt Shore** (palms, shells, driftwood, sea stacks, shallows and deep water) · ⛰️ **Stonecrest Mountains** (snowy pines, boulders, crystals, ore, tall walls and peaks)
  - Harmless wildlife per biome (rabbits, butterflies, deer, foxes, lizards, snakes, sandpipers, goats) that flee from you
- **Places to Enter**: caves, ruins and towns are scattered across the world map. Walk up to an entrance and press **E** (or tap the prompt)
  - 🕳️ **Caves** – cellular-automata tunnels, crystals, guarded treasure chests
  - 🏛️ **Ruins** – rooms and corridors with pillars, torches and a guardian vault
  - 🏘️ **Towns** – safe streets with markets, villagers, a healing fountain and an altar that grants a free upgrade
  - Treasure chests and altars give free upgrade picks without costing a level
- **World Map**: live minimap plus a full-screen map (**M**) that remembers everything you have explored and every place you have discovered
- **Smart Enemies** (18 regular types + 5 warlords): each region has its own roster and its own warlord
  - Behaviours: chasing slimes, swarming bees/bats/scarabs, boars that wind up and charge (and get stunned by walls), wolf packs that circle, lunge and retreat, web-spitting spiders and skeleton archers that kite, slamming golems/treants with ground telegraphs, burrowing scorpions, diving vultures, strafing crabs, boulder-lobbing trolls, jellyfish nova bursts, phasing ghosts
  - Warlords (Boar King, Ancient Treant, Sand Pharaoh, Crab King, Stone Titan) chain dashes, slams, volleys, boulders and summons, and enrage below half health
  - Navigation: tile **raycasting** for line of sight, a small **flow field** that routes around lakes, mountains and walls, **whisker probes** for local obstacle avoidance and stuck detection
- **Everything Levels Up**:
  - Spells (equipment that levels from its own kills): Arcane Bolt, Spirit Blades, Chain Lightning, Frost Nova, Meteor (auto-cast, free) and Dash, Blink, Aegis (active: Space / Q / R, cost mana). Socket runes into spells (`I` opens the loadout: drag and drop, search, sort, lock, salvage; incompatible runes are greyed out). Enemies drop gold (10%), resources (1%) and rarely a spell or rune (0.1%)
  - A party of three heroes (switch with 1/2/3 or Tab; bench heroes lend auras; a town Healer revives the fallen for gold). 12 stat cards per hero in four paths (Arcane, Vigor, Wayfarer, Spirit). Level-ups never pause the game: press `U` to pick when convenient
  - Rarity-tiered upgrade cards that show exactly what changes (e.g. `Damage: 22 → 28`)
  - Enemies scale with your level; elites appear and a regional warlord shows up every few levels
- **Modern UI**: XP bar, animated health bar, warlord health bar, biome banners, spell and stat slots, mana bar and active skill bar, floating damage numbers with crits, damage vignette
- **Responsive Controls**: keyboard (WASD / arrows), mouse (click and hold), touch and virtual joystick

## 🚀 Getting Started

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
| `npm test` | Unit tests (Vitest): noise, terrain, interiors, navigation, config |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run build:single` | One self-contained HTML file in `dist-single/` (used for test pages) |
| `npm run test:e2e` | Headless-browser smoke test of the built game (needs a Chromium; set `CHROMIUM_PATH`) |

The roadmap lives in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) and the design notes in
[docs/VISION.md](docs/VISION.md).

## 🎮 How to Play

1. **Start the Game**: Click the "Start Game" button on the title screen
2. **Movement**: 
   - Use arrow keys for keyboard control
   - Click and hold mouse button to move towards cursor
   - Touch and hold on mobile devices
3. **Combat**: 
   - Automatically shoot at nearest enemy
   - Collect experience gems from defeated enemies
4. **Leveling**: 
   - Gain experience to level up
   - Choose one of three random upgrades each level
5. **Survival**: 
   - Avoid enemy contact
   - Manage your health
   - Survive as long as possible

## 🛠️ Built With

- [PixiJS](https://pixijs.com/) - 2D WebGL renderer
- Modern JavaScript (ES6+)
- HTML5 Canvas
- CSS3

## 🎯 Game Design

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎨 Credits

- Game Design & Development: [Your Name]
- Engine: [PixiJS](https://pixijs.com/)
- Sound Effects: N/A
- Music: N/A

## 🔮 Future Features

- [ ] Multiple Character Classes
- [ ] New Enemy Types
- [ ] Power-up Items
- [ ] Sound Effects & Music
- [ ] High Score System
- [ ] Mobile-Optimized Controls
- [ ] Additional Weapon Types
- [ ] Boss Battles

## 📧 DEMO
https://fpavis.github.io/Vampire-survivor-demo-game/
