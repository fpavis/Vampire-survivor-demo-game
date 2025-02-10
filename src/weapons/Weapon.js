/**
 * @file Weapon.js
 * @description Manages weapon systems, including different weapon types, firing patterns,
 * and projectile creation. Controls combat mechanics and damage dealing.
 * 
 * @module weapons/Weapon
 * @requires core/gameState
 * @requires core/config
 * 
 * Key Features:
 * - Defines weapon types and properties
 * - Manages firing patterns and timing
 * - Handles weapon upgrades and scaling
 * - Creates projectiles with properties
 * - Controls damage calculation
 * 
 * Weapon Types:
 * - PISTOL: Basic single-shot weapon
 * - SHOTGUN: Spread pattern weapon
 * - LASER: High-damage piercing beam
 * - MACHINEGUN: Rapid-fire weapon
 * 
 * Usage:
 * ```js
 * // Create weapon
 * const weapon = new Weapon('PISTOL');
 * 
 * // Fire weapon
 * const projectiles = weapon.fire(origin, target, currentTime);
 * 
 * // Upgrade weapon
 * weapon.upgrade('DAMAGE');
 * ```
 * 
 * Modification Guidelines:
 * - Add new weapon types in WEAPON_CONFIGS
 * - Create new firing patterns in WEAPON_PATTERNS
 * - Add upgrade types in WEAPON_UPGRADES
 * - Modify projectile properties
 * - Implement new weapon mechanics
 * 
 * @class
 */

import { gameState } from '../core/gameState.js';
import { INITIAL_STATE } from '../core/config.js';

// Projectile type definitions
export const PROJECTILE_TYPES = {
    BASIC: {
        name: 'Basic',
        textureKey: 'bullet',
        glowTextureKey: 'bulletGlow',
        size: 5,
        glowScale: 1.5,
        glowColor: 0xffdd00,
        zIndex: 8
    },
    LASER: {
        name: 'Laser',
        textureKey: 'laserBeam',
        glowTextureKey: 'laserGlow',
        size: 6,
        glowScale: 2.0,
        glowColor: 0x00ffff,
        zIndex: 9,
        trail: true
    },
    SHOTGUN_PELLET: {
        name: 'Shotgun Pellet',
        textureKey: 'pellet',
        glowTextureKey: 'pelletGlow',
        size: 4,
        glowScale: 1.2,
        glowColor: 0xff8800,
        zIndex: 8
    },
    MACHINE_GUN: {
        name: 'Machine Gun',
        textureKey: 'bullet',
        glowTextureKey: 'bulletGlow',
        size: 3,
        glowScale: 1.3,
        glowColor: 0xff0000,
        zIndex: 8
    }
};

// Weapon configurations
export const WEAPON_CONFIGS = {
    PISTOL: {
        name: 'Pistol',
        damage: 20,
        fireRate: 500,
        projectileSpeed: 8,
        projectileType: 'BASIC',
        pattern: 'single',
        range: 500,
        piercing: false
    },
    SHOTGUN: {
        name: 'Shotgun',
        damage: 15,
        fireRate: 800,
        projectileSpeed: 7,
        projectileType: 'SHOTGUN_PELLET',
        pattern: 'spread',
        range: 300,
        piercing: false
    },
    LASER: {
        name: 'Laser',
        damage: 25,
        fireRate: 1000,
        projectileSpeed: 12,
        projectileType: 'LASER',
        pattern: 'beam',
        range: 600,
        piercing: true
    },
    MACHINEGUN: {
        name: 'Machine Gun',
        damage: 10,
        fireRate: 200,
        projectileSpeed: 10,
        projectileType: 'MACHINE_GUN',
        pattern: 'rapid',
        range: 400,
        piercing: false
    }
};

// Weapon patterns implementation
const WEAPON_PATTERNS = {
    single: (weapon, angle) => [{
        angle,
        damage: weapon.damage,
        piercing: weapon.piercing,
        range: weapon.range,
        speed: weapon.projectileSpeed
    }],
    
    spread: (weapon, angle) => {
        const projectiles = [];
        const spreadAngle = Math.PI / 8; // 22.5 degrees
        
        for (let i = -1; i <= 1; i++) {
            projectiles.push({
                angle: angle + (spreadAngle * i),
                damage: weapon.damage * 0.8, // Slightly reduced damage for balance
                piercing: weapon.piercing,
                range: weapon.range,
                speed: weapon.projectileSpeed
            });
        }
        return projectiles;
    },
    
    beam: (weapon, angle) => [{
        angle,
        damage: weapon.damage * 1.5, // Higher damage for beam
        piercing: true, // Beams always pierce
        range: weapon.range * 1.2, // Longer range
        speed: weapon.projectileSpeed * 1.5 // Faster projectiles for beam
    }],

    rapid: (weapon, angle) => [{
        angle: angle + (Math.random() * 0.2 - 0.1), // Slight spread
        damage: weapon.damage * 0.7, // Reduced damage for balance
        piercing: weapon.piercing,
        range: weapon.range * 0.8, // Shorter range
        speed: weapon.projectileSpeed * 1.2 // Slightly faster for machine gun
    }]
};

// Upgrade types
export const WEAPON_UPGRADES = {
    DAMAGE: {
        name: 'Damage Up',
        description: 'Increases weapon damage by 20%',
        modifier: 1.2,
        maxLevel: 5
    },
    FIRE_RATE: {
        name: 'Fire Rate Up',
        description: 'Increases fire rate by 15%',
        modifier: 0.85,
        maxLevel: 5
    },
    PROJECTILE_SPEED: {
        name: 'Projectile Speed Up',
        description: 'Increases projectile speed by 20%',
        modifier: 1.2,
        maxLevel: 3
    },
    PROJECTILE_SIZE: {
        name: 'Projectile Size Up',
        description: 'Increases projectile size by 25%',
        modifier: 1.25,
        maxLevel: 3
    },
    MULTI_SHOT: {
        name: 'Multi Shot',
        description: 'Adds an additional projectile',
        modifier: 1,
        maxLevel: 2
    }
};

export class Weapon {
    constructor(type) {
        const config = WEAPON_CONFIGS[type];
        if (!config) throw new Error(`Invalid weapon type: ${type}`);
        
        Object.assign(this, config);
        
        this.lastFireTime = 0;
        this.level = 1;
        this.upgrades = new Map();
        Object.keys(WEAPON_UPGRADES).forEach(upgrade => {
            this.upgrades.set(upgrade, 0);
        });

        // Get projectile type configuration
        this.projectileConfig = PROJECTILE_TYPES[this.projectileType];
        if (!this.projectileConfig) {
            console.error(`Invalid projectile type: ${this.projectileType}`);
            this.projectileConfig = PROJECTILE_TYPES.BASIC;
        }
    }

    canFire(currentTime) {
        // Calculate actual fire rate by applying player's fire rate modifier
        const actualFireRate = this.fireRate * (gameState.fireRate / INITIAL_STATE.fireRate);
        return currentTime - this.lastFireTime >= actualFireRate;
    }

    createProjectile(origin, projConfig) {
        const speed = projConfig.speed || this.projectileSpeed;
        // Add random damage variation (±12%)
        const damageVariation = 0.88 + (Math.random() * 0.24);
        const baseDamage = projConfig.damage * (gameState.attackDamage / INITIAL_STATE.attackDamage);
        const finalDamage = Math.round(baseDamage * damageVariation);

        // Get projectile type configuration
        const projectileConfig = PROJECTILE_TYPES[this.projectileType];
        if (!projectileConfig) {
            console.warn(`Invalid projectile type: ${this.projectileType}, using BASIC`);
            projectileConfig = PROJECTILE_TYPES.BASIC;
        }

        // Create bullet configuration that matches BulletManager's expectations
        return {
            x: origin.x,
            y: origin.y,
            dx: Math.cos(projConfig.angle) * speed,
            dy: Math.sin(projConfig.angle) * speed,
            damage: finalDamage,
            piercing: projConfig.piercing || false,
            range: projConfig.range || this.range,
            pattern: this.pattern,
            weaponType: this.name,
            // Include all projectile type visual properties
            ...projectileConfig,
            // Allow weapon upgrades to modify projectile appearance
            size: projectileConfig.size * (this.projectileSize || 1),
            glowScale: projectileConfig.glowScale * (this.projectileSize || 1)
        };
    }

    /**
     * Creates projectiles based on weapon pattern and current state
     * @param {Object} origin - Starting position {x, y}
     * @param {Object} target - Target direction {x, y}
     * @param {number} currentTime - Current game time
     * @returns {Array} Array of projectile configurations
     */
    fire(origin, target, currentTime) {
        if (!this.canFire(currentTime)) return [];

        this.lastFireTime = currentTime;

        // Calculate base angle from origin to target
        const angle = Math.atan2(target.y, target.x);
        
        // Get pattern configuration
        const pattern = WEAPON_PATTERNS[this.pattern];
        if (!pattern) {
            console.warn(`Invalid pattern: ${this.pattern}, using single`);
            return [this.createProjectile(origin, { angle, ...this })];
        }

        // Create projectiles based on pattern
        const projectileConfigs = pattern(this, angle);
        return projectileConfigs.map(config => this.createProjectile(origin, config));
    }

    upgrade(type) {
        if (!WEAPON_UPGRADES[type]) return false;
        
        const currentLevel = this.upgrades.get(type);
        if (currentLevel >= WEAPON_UPGRADES[type].maxLevel) return false;
        
        this.upgrades.set(type, currentLevel + 1);
        
        // Apply upgrade effects
        switch(type) {
            case 'DAMAGE':
                this.damage *= WEAPON_UPGRADES.DAMAGE.modifier;
                break;
            case 'FIRE_RATE':
                this.fireRate *= WEAPON_UPGRADES.FIRE_RATE.modifier;
                break;
            case 'PROJECTILE_SPEED':
                this.projectileSpeed *= WEAPON_UPGRADES.PROJECTILE_SPEED.modifier;
                break;
            case 'PROJECTILE_SIZE':
                this.projectileSize *= WEAPON_UPGRADES.PROJECTILE_SIZE.modifier;
                break;
            case 'MULTI_SHOT':
                this.projectileCount += 1;
                break;
        }
        
        return true;
    }

    getUpgradeInfo() {
        return Object.entries(WEAPON_UPGRADES)
            .filter(([type, info]) => this.upgrades.get(type) < info.maxLevel)
            .map(([type, info]) => ({
                type,
                name: info.name,
                description: info.description,
                currentLevel: this.upgrades.get(type),
                maxLevel: info.maxLevel
            }));
    }
}

// Usage example: 