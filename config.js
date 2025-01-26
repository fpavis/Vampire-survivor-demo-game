export const GAME_CONFIG = {
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    antialias: true,
    resizeTo: window
};

export const SPAWN_CONFIG = {
    baseRate: 0.02,        // Base spawn chance per frame
    maxEnemies: 50,       // Maximum number of enemies allowed
    typeRatios: {
        BASIC: 0.6,       // 60% chance for basic enemies
        TANK: 0.2,        // 20% chance for tanks
        FAST: 0.2         // 20% chance for fast enemies
    },
    eliteChance: 0.1,     // 10% chance for elite enemies
    eliteModifiers: {
        health: 1.5,      // 50% more health
        experience: 2.0,   // Double experience
        speed: 1.2        // 20% more speed
    },
    spawnDistance: 600    // Distance from player where enemies spawn
};

export const ENEMY_TYPES = {
    BASIC: {
        color: 0xFF0000,
        size: 20,
        speed: 1.8,        // Slightly slower for better early game
        health: 40,        // Reduced for quicker early kills
        experience: 8      // Increased for faster early progression
    },
    TANK: {
        color: 0x8B0000,
        size: 35,
        speed: 0.8,       // Very slow but threatening
        health: 100,      // Significant health pool
        experience: 25    // Rewards player for the challenge
    },
    FAST: {
        color: 0x0000FF,
        size: 15,
        speed: 3.0,       // Fast but manageable
        health: 25,       // Very fragile
        experience: 12    // Decent reward for the risk
    }
};

export const INITIAL_STATE = {
    health: 100,
    maxHealth: 100,
    level: 1,
    experience: 0,
    nextLevel: 25,        // Lower initial requirement for faster early game
    fireRate: 600,        // Slightly slower initial fire rate
    playerSpeed: 4.2,     // Adjusted for better control
    attackDamage: 20,     // Balanced with enemy health
    healthRegen: 0,
    score: 0
};

// Level scaling factors
export const LEVEL_SCALING = {
    experienceMultiplier: 1.8,    // How much more XP needed per level (was 2.0)
    healthUpgrade: 1.3,           // Health increase per health upgrade
    damageUpgrade: 1.25,          // Damage increase per attack upgrade
    fireRateUpgrade: 0.85,        // Fire rate improvement (lower is faster)
    speedUpgrade: 1.15,           // Speed increase per speed upgrade
    healthRegenUpgrade: 1,        // Fixed health per second per upgrade
    
    // Enemy scaling
    enemyHealthScale: 1.15,       // Enemy health increase per level
    enemyDamageScale: 1.12,       // Enemy damage increase per level
    enemySpeedScale: 1.05,        // Slight speed increase per level
    enemySpawnRateScale: 1.08,    // Spawn rate increase per level
    
    // Score and rewards
    scoreMultiplier: 1.5,         // Score multiplier per level
    experienceMultiplierPerLevel: 1.2  // Experience gain multiplier per level
};

// Add color scheme and styles
export const STYLES = {
    colors: {
        background: 0x1a1a1a,  // Darker background
        player: 0x00ff88,      // Bright cyan-green
        bullet: 0xffdd00,      // Bright yellow
        exp: 0xff00ff,         // Bright magenta
        healthBar: {
            border: 0x333333,
            background: 0x666666,
            health: 0x00ff00,
            damage: 0xff0000
        },
        ui: {
            text: 0xffffff,
            debug: 0xaaaaaa
        }
    },
    particles: {
        hit: {
            color: 0xffff00,
            count: 8,
            speed: 5,
            lifetime: 20
        },
        death: {
            color: 0xff0000,
            count: 15,
            speed: 8,
            lifetime: 30
        }
    }
};

export const WORLD_CONFIG = {
    width: 2000,  // World is larger than viewport
    height: 2000,
    viewportPadding: 200  // Distance from player to edge before camera moves
};

// Collision configuration
export const COLLISION_CONFIG = {
    // Player collision
    player: {
        radius: 20,
        pushForce: 2,      // How much player pushes enemies
        pushResistance: 0.3, // How much player resists being pushed
        damageImmunityTime: 1000,  // Milliseconds
        damage: 10,          // Damage taken from collisions
    },
    // Enemy collision
    enemy: {
        pushForce: 2,        // Base push force for enemy collisions
        minDistance: 0.9,    // Multiplier for minimum distance (1 = touching exactly)
        maxPushForce: 10,    // Maximum push force cap
        repelForce: 0.5,     // How strongly enemies repel each other
    },
    // General collision
    impulse: {
        power: 2,            // Base impulse power
        sizeFactor: 0.25,    // How much object sizes affect impulse (0.25 = width/4)
    }
}; 