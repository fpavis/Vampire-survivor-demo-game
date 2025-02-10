/**
 * @file config.js
 * @description Central configuration module that defines all game constants, settings,
 * and configuration objects. Controls game balance and feature settings.
 * 
 * @module core/config
 * 
 * Configuration Categories:
 * - GAME_CONFIG: Core game settings and PIXI.js configuration
 * - WORLD_CONFIG: World dimensions and boundaries
 * - INITIAL_STATE: Starting game state values
 * - ENEMY_TYPES: Enemy definitions and properties
 * - LEVEL_SCALING: Progression and difficulty scaling
 * - STYLES: Visual styling and UI configuration
 * - SPAWN_CONFIG: Enemy spawning rules and rates
 * - COLLISION_CONFIG: Collision detection settings
 * - LEVELS: Area/level definitions and requirements
 * 
 * Usage:
 * ```js
 * import { GAME_CONFIG, ENEMY_TYPES, LEVEL_SCALING } from './config.js';
 * 
 * // Access configuration
 * const worldWidth = WORLD_CONFIG.width;
 * const enemyHealth = ENEMY_TYPES.BASIC.health;
 * const levelMultiplier = LEVEL_SCALING.experienceMultiplier;
 * ```
 * 
 * Modification Guidelines:
 * - Add new configuration categories as needed
 * - Adjust values for game balance
 * - Add new enemy types and properties
 * - Define new level configurations
 * - Extend scaling rules for progression
 * 
 * Note: This is a critical file for game balance and behavior.
 * Changes here can have wide-ranging effects on gameplay.
 * 
 * @type {Object}
 */

// Base constants
const BASE_SPAWN_DISTANCE = 600;
const BASE_SPAWN_RATE = 0.02;
const BASE_MAX_ENEMIES = 50;
const BASE_ELITE_CHANCE = 0.1;
const GRID_SIZE = 100;  // Grid cell size for background grid

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
    resizeTo: window,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',  // or 'webgpu' if targeting modern browsers
    hello: true,  // enables PixiJS welcome message for debugging
    defaultRenderOptions: {
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
        backgroundAlpha: 1
    }
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
    score: 0,
    XP_TO_LEVEL: INITIAL_PLAYER_STATS.XP_TO_LEVEL,
    debug: true
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
    viewportPadding: 200,
    gridSize: GRID_SIZE  // Add grid size to WORLD_CONFIG
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

// Area/Level configurations
export const LEVEL_CONFIGS = [
    {
        id: 'starting_grounds',
        name: "Training Grounds",
        description: "A safe area to learn the basics",
        x: 0,
        y: 0,
        width: 2000,
        height: 2000,
        backgroundColor: 0x1a1a1a,
        enemyRatios: { BASIC: 1 },
        maxEnemies: 20,
        spawnRate: 0.05,
        eliteChance: 0,
        enemyModifiers: {
            health: 0.7,
            speed: 0.7,
            experience: 1.2
        },
        isUnlocked: true,
        connections: ['forest_edge']
    },
    {
        id: 'forest_edge',
        name: "Forest Edge",
        description: "The outskirts of a mysterious forest",
        x: 2000,
        y: 0,
        width: 2000,
        height: 2000,
        backgroundColor: 0x1a2f1a,
        enemyRatios: { BASIC: 0.7, FAST: 0.3 },
        maxEnemies: 30,
        spawnRate: BASE_SPAWN_RATE * 0.8,
        eliteChance: 0.05,
        enemyModifiers: {
            health: 1,
            speed: 1,
            experience: 1
        },
        requirements: [{ type: 'level', value: 2 }],
        connections: ['starting_grounds', 'deep_forest']
    },
    {
        id: 'deep_forest',
        name: "Deep Forest",
        description: "Dense forest teeming with stronger enemies",
        x: 4000,
        y: 0,
        width: 2000,
        height: 2000,
        backgroundColor: 0x152815,
        enemyRatios: { BASIC: 0.5, FAST: 0.3, TANK: 0.2 },
        maxEnemies: 40,
        spawnRate: BASE_SPAWN_RATE,
        eliteChance: 0.08,
        enemyModifiers: {
            health: 1.2,
            speed: 1.1,
            experience: 1.1
        },
        requirements: [{ type: 'level', value: 4 }],
        connections: ['forest_edge', 'ancient_ruins']
    },
    {
        id: 'ancient_ruins',
        name: "Ancient Ruins",
        description: "Mysterious ruins filled with powerful enemies",
        x: 4000,
        y: 2000,
        width: 2000,
        height: 2000,
        backgroundColor: 0x2a2a3a,
        enemyRatios: { BASIC: 0.4, FAST: 0.3, TANK: 0.3 },
        maxEnemies: 45,
        spawnRate: BASE_SPAWN_RATE * 1.1,
        eliteChance: 0.1,
        enemyModifiers: {
            health: 1.4,
            speed: 1.2,
            experience: 1.2
        },
        requirements: [{ type: 'level', value: 6 }],
        connections: ['deep_forest']
    }
];

// Export level configurations directly
export { LEVEL_CONFIGS as LEVELS };

// Layer configuration for rendering order
export const LAYER_CONFIG = {
    BACKGROUND: 'background',
    GRID: 'grid',
    GAME_OBJECTS: 'gameObjects',
    ENEMIES: 'enemies',
    PLAYER: 'player',
    BULLETS: 'bullets',
    EFFECTS: 'effects',
    UI: 'ui'
}; 