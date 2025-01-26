import { gameState } from './gameState.js';
import { INITIAL_STATE } from './config.js';

// Weapon configurations
const WEAPON_CONFIGS = {
    PISTOL: {
        name: 'Pistol',
        damage: 20,
        fireRate: 500,
        projectileSpeed: 8,
        projectileSize: 5,
        color: 0xFFFF00,
        pattern: 'single',
        range: 500,
        piercing: false
    },
    SHOTGUN: {
        name: 'Shotgun',
        damage: 15,
        fireRate: 800,
        projectileSpeed: 7,
        projectileSize: 4,
        color: 0xFF8800,
        pattern: 'spread',
        range: 300,
        piercing: false
    },
    LASER: {
        name: 'Laser',
        damage: 25,
        fireRate: 1000,
        projectileSpeed: 12,
        projectileSize: 6,
        color: 0x00FFFF,
        pattern: 'beam',
        range: 600,
        piercing: true
    },
    MACHINEGUN: {
        name: 'Machine Gun',
        damage: 10,
        fireRate: 200,
        projectileSpeed: 10,
        projectileSize: 3,
        color: 0xFF0000,
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
    }

    canFire(currentTime) {
        // Calculate actual fire rate by applying player's fire rate modifier
        const actualFireRate = this.fireRate * (gameState.fireRate / INITIAL_STATE.fireRate);
        return currentTime - this.lastFireTime >= actualFireRate;
    }

    fire(origin, target, currentTime) {
        if (!this.canFire(currentTime)) return [];

        this.lastFireTime = currentTime;
        const pattern = WEAPON_PATTERNS[this.pattern];
        if (!pattern) return [];

        const projectiles = pattern(this, Math.atan2(target.y - origin.y, target.x - origin.x));
        return projectiles.map(proj => this.createProjectile(origin, proj));
    }

    createProjectile(origin, projConfig) {
        const speed = projConfig.speed || this.projectileSpeed;
        // Add random damage variation (±12%)
        const damageVariation = 0.88 + (Math.random() * 0.24); // Random between 0.88 and 1.12
        const baseDamage = projConfig.damage * (gameState.attackDamage / INITIAL_STATE.attackDamage);
        const finalDamage = Math.round(baseDamage * damageVariation);

        return {
            x: origin.x,
            y: origin.y,
            dx: Math.cos(projConfig.angle) * speed,
            dy: Math.sin(projConfig.angle) * speed,
            damage: finalDamage,
            size: this.projectileSize,
            color: this.color,
            piercing: projConfig.piercing || false,
            range: projConfig.range || this.range,
            distanceTraveled: 0,
            active: true
        };
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