# Survival Game 🎮

A fast-paced, browser-based survival game built with PixiJS where you fight endless waves of enemies, collect experience, and level up to become stronger.

![Game Preview](preview.gif) <!-- TODO: Add your game preview gif -->

## 🌟 Features

- **Pseudo-3D View**: Tilted ground plane, upright billboard sprites sorted by depth, raised mountain blocks, cliffs, shadows, atmospheric haze and vignette
- **Infinite Procedural World**: Chunk-streamed terrain generated from layered noise, so you can walk forever
  - Biomes: deep/shallow water, sand, dry lands, grassland, forest, hills, mountains and snowy peaks
  - Trees, pines, rocks, bushes, cacti and dead trees that block movement; deep water and mountains are impassable, shallows slow you down
- **Everything Levels Up**:
  - 5 weapons with 8 levels each: Arcane Bolt, Spirit Blades, Chain Lightning, Frost Nova, Meteor
  - 9 passives with 5 levels each: Might, Haste, Swiftness, Vitality, Recovery, Magnet, Armor, Wisdom, Precision
  - Rarity-tiered upgrade cards that show exactly what changes (e.g. `Damage: 22 → 28`)
  - Enemies scale with your level; new enemy types unlock (Slime, Bat, Golem), elites appear and a boss shows up every 5 levels
- **Modern UI**: XP bar, animated health bar, timer/kill/score counters, weapon and passive inventory, floating damage numbers with crits, damage vignette
- **Responsive Controls**: keyboard (WASD / arrows), mouse (click and hold), touch and virtual joystick

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Local web server (for development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/survival-game.git
```

2. Navigate to the project directory:
```bash
cd survival-game
```

3. Start a local web server. For example, using Python:
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

4. Open your browser and navigate to:
```
http://localhost:8000
```

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
