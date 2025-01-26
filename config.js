export const GAME_CONFIG = {
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    antialias: true,
    resizeTo: window
};

export const ENEMY_TYPES = {
    BASIC: {
        color: 0xFF0000,
        size: 20,
        speed: 2,
        health: 50,
        experience: 5
    },
    TANK: {
        color: 0x8B0000,
        size: 35,
        speed: 1,
        health: 150,
        experience: 15
    },
    FAST: {
        color: 0x0000FF,
        size: 15,
        speed: 3.5,
        health: 30,
        experience: 8
    }
};

export const INITIAL_STATE = {
    health: 100,
    maxHealth: 100,
    level: 1,
    experience: 0,
    nextLevel: 10,
    fireRate: 500,
    playerSpeed: 5,
    attackDamage: 25,
    healthRegen: 0,
    score: 0
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