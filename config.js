export const GAME_CONFIG = {
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0b1118,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    resizeTo: window
};

// Pseudo-3D projection: ground plane (x, y) is squashed vertically by `tilt`,
// upright objects (billboards) are drawn on top of it and sorted by depth (y).
export const WORLD_CONFIG = {
    tile: 48,          // world units per terrain tile
    chunkTiles: 12,    // tiles per chunk edge
    tilt: 0.6,         // vertical squash of the ground plane
    spawnClearing: 9,  // radius (tiles) of the guaranteed safe start area
    maxCachedChunks: 500
};

export const SPAWN_CONFIG = {
    baseRate: 0.02,       // spawn chance per frame at level 1
    rateGrowth: 0.045,      // extra rate per player level
    baseMax: 26,           // max enemies at level 1
    maxPerLevel: 4,
    maxCap: 120,
    eliteChance: 0.06,
    eliteModifiers: { health: 2.2, experience: 3, speed: 1.15, damage: 1.3 },
    despawnDistance: 1900, // enemies further than this are recycled
    bossEvery: 7,          // a regional warlord appears every N player levels
    wanderTypes: 1
};

// Enemy catalogue. `art` selects the sprite, `ai` the behaviour (see ai.js).
// Times are in frames (60 per second), speeds in world units per frame.
export const ENEMY_TYPES = {
    // ---- fields
    SLIME: { name: 'Slime', art: 'slime', color: 0x4cd964, radius: 15, speed: 1.7, health: 30, damage: 6, experience: 6, flying: false,
        ai: { kind: 'chase', hop: true } },
    BEE: { name: 'Bee', art: 'bee', color: 0xffc933, radius: 9, speed: 2.4, health: 10, damage: 3, experience: 3, flying: true,
        ai: { kind: 'swarm', cohesion: 0.55, separation: 1.5, wobble: 0.9 } },
    BOAR: { name: 'Boar', art: 'boar', color: 0x8a5a3a, radius: 20, speed: 1.5, health: 70, damage: 9, experience: 14, flying: false,
        ai: { kind: 'charger', range: 320, windup: 44, dash: 34, dashSpeed: 7.4, recover: 55, cooldown: [70, 150], burst: 1.4 } },
    // ---- forest
    WOLF: { name: 'Wolf', art: 'wolf', color: 0x8a8f9a, radius: 15, speed: 2.3, health: 38, damage: 7, experience: 10, flying: false,
        ai: { kind: 'pack', orbit: 190, lunge: 6.8, lungeTime: 24, windup: 16, retreat: 70, cooldown: [70, 190], maxLunging: 2 } },
    SPIDER: { name: 'Spider', art: 'spider', color: 0x5a3a6a, radius: 12, speed: 2.0, health: 28, damage: 5, experience: 11, flying: false,
        ai: { kind: 'kiter', min: 190, max: 300, shotCooldown: [90, 150], windup: 14, shots: 1, shotSpeed: 5.2, shotDamage: 4, effect: 'web', shotColor: 0xe8e8f0 } },
    TREANT: { name: 'Treant', art: 'treant', color: 0x6a4a2a, radius: 28, speed: 0.8, health: 190, damage: 14, experience: 30, flying: false, armor: 0.15,
        ai: { kind: 'slammer', reach: 70, radius: 105, windup: 52, recover: 46, cooldown: [60, 110], slamDamage: 22 } },
    // ---- desert
    SCORPION: { name: 'Scorpion', art: 'scorpion', color: 0xc8924a, radius: 14, speed: 1.7, health: 45, damage: 8, experience: 12, flying: false,
        ai: { kind: 'burrower', burrowSpeed: 3.6, surfaceDist: 85, surfaceWindup: 26, fightTime: [150, 230], burrowTime: 22 } },
    VULTURE: { name: 'Vulture', art: 'vulture', color: 0x3a3236, radius: 13, speed: 2.6, health: 32, damage: 9, experience: 12, flying: true,
        ai: { kind: 'diver', orbit: 230, circleTime: [100, 210], windup: 28, dive: 8.6, diveTime: 44, retreat: 80, burst: 1.3 } },
    MUMMY: { name: 'Mummy', art: 'mummy', color: 0xd8d0b0, radius: 22, speed: 1.15, health: 150, damage: 13, experience: 26, flying: false,
        ai: { kind: 'chase', hop: false }, onDeath: { spawn: 'SCARAB', count: 3 } },
    SCARAB: { name: 'Scarab', art: 'scarab', color: 0x2a9a8a, radius: 8, speed: 2.8, health: 8, damage: 3, experience: 2, flying: false,
        ai: { kind: 'swarm', cohesion: 0.5, separation: 1.2, wobble: 0.6 } },
    // ---- shore
    CRAB: { name: 'Crab', art: 'crab', color: 0xe0583a, radius: 16, speed: 1.6, health: 48, damage: 9, experience: 13, flying: false, armor: 0.3,
        ai: { kind: 'strafer', orbit: 130, strafeSpeed: 1.3, lunge: 6.2, lungeTime: 20, windup: 16, recover: 40, cooldown: [90, 160] } },
    GULL: { name: 'Gull', art: 'gull', color: 0xf2f2f2, radius: 11, speed: 2.5, health: 22, damage: 6, experience: 8, flying: true,
        ai: { kind: 'swarm', cohesion: 0.5, separation: 1.3, wobble: 0.7, dive: { windup: 20, speed: 8, time: 30, cooldown: [150, 300] } } },
    JELLY: { name: 'Jellyfish', art: 'jelly', color: 0xd070ff, radius: 16, speed: 1.0, health: 55, damage: 6, experience: 18, flying: true,
        ai: { kind: 'floater', range: 280, burstCooldown: [170, 260], windup: 30, shots: 7, shotSpeed: 3.2, shotDamage: 6, shotColor: 0xe08aff } },
    // ---- mountain
    BAT: { name: 'Bat', art: 'bat', color: 0x8a5cff, radius: 11, speed: 2.7, health: 20, damage: 6, experience: 8, flying: true,
        ai: { kind: 'swarm', cohesion: 0.35, separation: 1.2, wobble: 1.4, erratic: [18, 40] } },
    GOLEM: { name: 'Golem', art: 'golem', color: 0xa08a6a, radius: 26, speed: 0.85, health: 140, damage: 18, experience: 26, flying: false, armor: 0.2,
        ai: { kind: 'slammer', reach: 66, radius: 100, windup: 56, recover: 50, cooldown: [70, 130], slamDamage: 24 } },
    TROLL: { name: 'Rock Troll', art: 'troll', color: 0x7a8a6a, radius: 24, speed: 1.1, health: 120, damage: 14, experience: 28, flying: false,
        ai: { kind: 'lobber', min: 260, max: 400, cooldown: [150, 230], windup: 34, flight: 64, radius: 70, lobDamage: 22 } },
    // ---- ruins
    SKELETON: { name: 'Skeleton', art: 'skeleton', color: 0xe8e2cc, radius: 13, speed: 1.6, health: 34, damage: 6, experience: 12, flying: false,
        ai: { kind: 'kiter', min: 170, max: 280, shotCooldown: [80, 140], windup: 16, shots: 1, shotSpeed: 6.2, shotDamage: 8, shotColor: 0xeee6cc } },
    GHOST: { name: 'Ghost', art: 'ghost', color: 0xcfe8ff, radius: 13, speed: 1.5, health: 40, damage: 9, experience: 16, flying: true, phase: true,
        ai: { kind: 'diver', orbit: 160, circleTime: [70, 150], windup: 26, dive: 5.4, diveTime: 40, retreat: 0, burst: 1.2 } },

    // ---- warlords: one per region
    BOAR_KING: { name: 'Boar King', art: 'boarking', color: 0xa86a3a, radius: 46, speed: 1.6, health: 900, damage: 26, experience: 160, flying: false, boss: true, armor: 0.1,
        ai: { kind: 'boss', abilities: ['dash', 'dash', 'slam', 'summon'], dash: { windup: 40, speed: 8.4, time: 36, recover: 45 }, slam: { radius: 130, windup: 50, damage: 28 }, summon: { type: 'SLIME', count: 4 } } },
    ANCIENT_TREANT: { name: 'Ancient Treant', art: 'ancienttreant', color: 0x4a6a2a, radius: 52, speed: 0.9, health: 1300, damage: 28, experience: 170, flying: false, boss: true, armor: 0.2,
        ai: { kind: 'boss', abilities: ['slam', 'volley', 'summon', 'slam'], slam: { radius: 150, windup: 60, damage: 32 }, volley: { count: 10, speed: 3.6, damage: 11, color: 0x7ada4a }, summon: { type: 'SPIDER', count: 3 } } },
    SAND_PHARAOH: { name: 'Sand Pharaoh', art: 'pharaoh', color: 0xe8c040, radius: 44, speed: 1.3, health: 1000, damage: 26, experience: 165, flying: false, boss: true,
        ai: { kind: 'boss', abilities: ['summon', 'volley', 'dash', 'volley'], dash: { windup: 34, speed: 8, time: 34, recover: 40 }, volley: { count: 5, spread: 0.9, speed: 4.6, damage: 12, color: 0xffd84a, aimed: true }, summon: { type: 'SCARAB', count: 7 } } },
    CRAB_KING: { name: 'Crab King', art: 'crabking', color: 0xd04a2a, radius: 50, speed: 1.4, health: 1100, damage: 28, experience: 165, flying: false, boss: true, armor: 0.3,
        ai: { kind: 'boss', abilities: ['dash', 'slam', 'summon', 'dash'], dash: { windup: 34, speed: 8.6, time: 32, recover: 40 }, slam: { radius: 140, windup: 46, damage: 30 }, summon: { type: 'CRAB', count: 2 } } },
    STONE_TITAN: { name: 'Stone Titan', art: 'titan', color: 0x7a7e8a, radius: 56, speed: 0.95, health: 1500, damage: 32, experience: 190, flying: false, boss: true, armor: 0.25,
        ai: { kind: 'boss', abilities: ['slam', 'lob', 'summon', 'lob'], slam: { radius: 160, windup: 64, damage: 36 }, lob: { count: 4, radius: 80, damage: 26 }, summon: { type: 'BAT', count: 6 } } }
};

export const INITIAL_STATE = {
    health: 100,
    maxHealth: 100,
    level: 1,
    experience: 0,
    nextLevel: 20,
    playerSpeed: 3.8,
    score: 0
};

// XP needed to go from `level` to `level + 1`
export function xpForLevel(level) {
    return Math.floor(18 + 11 * (level - 1) + 2.6 * Math.pow(level - 1, 1.55));
}

export const LEVEL_SCALING = {
    enemyHealthScale: 1.09,
    enemyDamageScale: 1.035,
    enemySpeedScale: 1.02,
    enemySpeedCap: 1.7,
    experienceScale: 0.12     // extra XP per player level (linear)
};

export const LIMITS = {
    weaponSlots: 5,
    passiveSlots: 6
};

export const RARITY = [
    { name: 'Common', color: 0x9aa4b2 },
    { name: 'Rare', color: 0x4aa8ff },
    { name: 'Epic', color: 0xb765ff },
    { name: 'Legendary', color: 0xffc233 }
];

export const STYLES = {
    colors: {
        player: 0x3b6fe0,
        bullet: 0xffd84a,
        healthBar: {
            border: 0x1b1b1b,
            background: 0x3a3a3a,
            health: 0x4cd964,
            damage: 0xff4747
        }
    },
    particles: {
        hit: { color: 0xffee88, count: 6, speed: 2.4 },
        death: { color: 0xff5a5a, count: 14, speed: 3.4 }
    }
};
