// Base constants
const BASE_SPAWN_DISTANCE = 600;
const BASE_SPAWN_RATE = 0.02;
const BASE_MAX_ENEMIES = 50;
const BASE_ELITE_CHANCE = 0.1;

// Enemy type ratios
const ENEMY_TYPE_RATIOS = {
    BASIC: 0.6,
    TANK: 0.2,
    FAST: 0.2
};

// Enemy dimensions
const ENEMY_RADIUS = {
    BASIC: 20,
    TANK: 35,
    FAST: 15
};

// Elite modifiers
const ELITE_MODIFIERS = {
    HEALTH: 1.5,
    EXPERIENCE: 2.0,
    SPEED: 1.2
};

// Initial player stats
const INITIAL_PLAYER_STATS = {
    HEALTH: 100,
    FIRE_RATE: 600,
    PLAYER_SPEED: 4.2,
    ATTACK_DAMAGE: 20,
    XP_TO_LEVEL: 25
};

export const GAME_CONFIG = Object.freeze({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    antialias: true,
    resizeTo: window
});

export const SPAWN_CONFIG = Object.freeze({
    baseRate: BASE_SPAWN_RATE,
    maxEnemies: BASE_MAX_ENEMIES,
    typeRatios: Object.freeze(ENEMY_TYPE_RATIOS),
    eliteChance: BASE_ELITE_CHANCE,
    eliteModifiers: Object.freeze(ELITE_MODIFIERS),
    spawnDistance: BASE_SPAWN_DISTANCE
});

export const ENEMY_TYPES = Object.freeze({
    BASIC: Object.freeze({
        color: 0xFF0000,
        size: ENEMY_RADIUS.BASIC,
        speed: 1.8,
        health: 40,
        experience: 8
    }),
    TANK: Object.freeze({
        color: 0x8B0000,
        size: ENEMY_RADIUS.TANK,
        speed: 0.8,
        health: 100,
        experience: 25
    }),
    FAST: Object.freeze({
        color: 0x0000FF,
        size: ENEMY_RADIUS.FAST,
        speed: 3.0,
        health: 25,
        experience: 12
    })
});

export const INITIAL_STATE = Object.freeze({
    health: INITIAL_PLAYER_STATS.HEALTH,
    maxHealth: INITIAL_PLAYER_STATS.HEALTH,
    level: 1,
    experience: 0,
    nextLevel: INITIAL_PLAYER_STATS.XP_TO_LEVEL,
    fireRate: INITIAL_PLAYER_STATS.FIRE_RATE,
    playerSpeed: INITIAL_PLAYER_STATS.PLAYER_SPEED,
    attackDamage: INITIAL_PLAYER_STATS.ATTACK_DAMAGE,
    healthRegen: 0,
    score: 0
});

// Level scaling factors
export const LEVEL_SCALING = Object.freeze({
    experienceMultiplier: 1.8,
    healthUpgrade: 1.3,
    damageUpgrade: 1.25,
    fireRateUpgrade: 0.85,
    speedUpgrade: 1.15,
    healthRegenUpgrade: 1,
    
    // Enemy scaling
    enemyHealthScale: 1.15,
    enemyDamageScale: 1.12,
    enemySpeedScale: 1.05,
    enemySpawnRateScale: 1.08,
    
    // Score and rewards
    scoreMultiplier: 1.5,
    experienceMultiplierPerLevel: 1.2
});

// UI Colors and styles
const UI_COLORS = {
    BACKGROUND: 0x1a1a1a,
    PLAYER: 0x00ff88,
    BULLET: 0xffdd00,
    EXPERIENCE: 0xff00ff,
    HEALTH_BAR: {
        BORDER: 0x333333,
        BACKGROUND: 0x666666,
        HEALTH: 0x00ff00,
        DAMAGE: 0xff0000
    },
    UI_TEXT: {
        PRIMARY: 0xffffff,
        DEBUG: 0xaaaaaa
    }
};

const PARTICLE_EFFECTS = {
    HIT: {
        color: 0xffff00,
        count: 8,
        speed: 5,
        lifetime: 20
    },
    DEATH: {
        color: 0xff0000,
        count: 15,
        speed: 8,
        lifetime: 30
    }
};

export const STYLES = Object.freeze({
    colors: Object.freeze({
        background: UI_COLORS.BACKGROUND,
        player: UI_COLORS.PLAYER,
        bullet: UI_COLORS.BULLET,
        exp: UI_COLORS.EXPERIENCE,
        healthBar: Object.freeze(UI_COLORS.HEALTH_BAR),
        ui: Object.freeze(UI_COLORS.UI_TEXT)
    }),
    particles: Object.freeze(PARTICLE_EFFECTS)
});

export const WORLD_CONFIG = Object.freeze({
    width: 2000,
    height: 2000,
    viewportPadding: 200
});

// Collision configuration
const COLLISION_SETTINGS = {
    PLAYER: {
        radius: 20,
        pushForce: 2,
        pushResistance: 0.3,
        damageImmunityTime: 1000,
        damage: 10,
    },
    ENEMY: {
        pushForce: 2,
        minDistance: 0.9,
        maxPushForce: 10,
        repelForce: 0.5,
    },
    IMPULSE: {
        power: 2,
        sizeFactor: 0.25,
    }
};

export const COLLISION_CONFIG = Object.freeze({
    player: Object.freeze(COLLISION_SETTINGS.PLAYER),
    enemy: Object.freeze(COLLISION_SETTINGS.ENEMY),
    impulse: Object.freeze(COLLISION_SETTINGS.IMPULSE)
}); 