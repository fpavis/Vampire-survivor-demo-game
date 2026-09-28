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
    rateGrowth: 0.06,      // extra rate per player level
    baseMax: 32,           // max enemies at level 1
    maxPerLevel: 4,
    maxCap: 120,
    eliteChance: 0.06,
    eliteModifiers: { health: 2.2, experience: 3, speed: 1.15, damage: 1.3 },
    despawnDistance: 1900, // enemies further than this are recycled
    bossEvery: 5           // a boss appears every N player levels
};

export const ENEMY_TYPES = {
    BASIC: {
        name: 'Slime', color: 0x4cd964, radius: 15, speed: 1.5, health: 30,
        damage: 6, experience: 6, minLevel: 1, weight: 6, flying: false
    },
    FAST: {
        name: 'Bat', color: 0x8a5cff, radius: 11, speed: 2.7, health: 20,
        damage: 6, experience: 8, minLevel: 2, weight: 3, flying: true
    },
    TANK: {
        name: 'Golem', color: 0xb0794a, radius: 26, speed: 0.85, health: 140,
        damage: 18, experience: 26, minLevel: 4, weight: 2, flying: false
    },
    BOSS: {
        name: 'Warlord', color: 0xd0243c, radius: 46, speed: 1.05, health: 900,
        damage: 30, experience: 160, minLevel: 99, weight: 0, flying: false, boss: true
    }
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
    enemyDamageScale: 1.05,
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
