// Weapon configurations
export const WEAPON_TYPES = {
    PISTOL: {
        id: 'PISTOL',
        name: 'Pistol',
        damage: 20,
        fireRate: 0.5,      // Shots per second
        projectileSpeed: 32,
        projectileCount: 1,
        spread: 0,
        projectileSize: 4,
        color: 0xFFFF00,
        pattern: 'single',
        sound: 'pistolShot',
        description: 'Basic weapon with balanced stats',
        range: 500
    },
    SHOTGUN: {
        id: 'SHOTGUN',
        name: 'Shotgun',
        damage: 15,
        fireRate: 1.2,      // Slower fire rate
        projectileSpeed: 20,
        projectileCount: 5,
        spread: 30,         // Wider spread
        projectileSize: 3,
        color: 0xFF4400,
        pattern: 'spread',
        sound: 'shotgunBlast',
        description: 'Short range, high burst damage',
        spreadCount: 5,
        spreadAngle: Math.PI / 6,
        range: 300
    },
    LASER: {
        id: 'LASER',
        name: 'Laser Rifle',
        damage: 25,
        fireRate: 0.3,      // Faster fire rate
        projectileSpeed: 15,
        projectileCount: 1,
        spread: 0,
        projectileSize: 6,
        color: 0x00FFFF,
        pattern: 'beam',
        sound: 'laserShot',
        description: 'High damage, piercing beam',
        piercing: true,
        range: 800
    },
    MACHINEGUN: {
        id: 'MACHINEGUN',
        name: 'Machine Gun',
        damage: 8,
        fireRate: 8,
        projectileSpeed: 25,
        projectileCount: 1,
        spread: 15,         // Some spread for balance
        projectileSize: 3,
        color: 0xFF0000,
        pattern: 'single',
        sound: 'machinegunFire',
        description: 'High rate of fire, low damage',
        range: 400
    }
};

// Weapon patterns implementation
const WEAPON_PATTERNS = {
    single: (weapon, origin, target) => {
        return [{
            angle: Math.atan2(target.y - origin.y, target.x - origin.x),
            speed: weapon.projectileSpeed,
            damage: weapon.damage
        }];
    },
    spread: (weapon, origin, target) => {
        const baseAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
        const projectiles = [];
        const totalSpread = weapon.spread * (Math.PI / 180);
        
        for (let i = 0; i < weapon.projectileCount; i++) {
            const spreadAngle = totalSpread * (i / (weapon.projectileCount - 1) - 0.5);
            projectiles.push({
                angle: baseAngle + spreadAngle,
                speed: weapon.projectileSpeed * (0.9 + Math.random() * 0.2),
                damage: weapon.damage
            });
        }
        return projectiles;
    },
    beam: (weapon, origin, target) => {
        return [{
            angle: Math.atan2(target.y - origin.y, target.x - origin.x),
            speed: weapon.projectileSpeed * 1.5,
            damage: weapon.damage,
            piercing: true,
            range: 800
        }];
    },
    rapid: (weapon, origin, target) => {
        const baseAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
        const spread = (Math.random() - 0.5) * weapon.spread * (Math.PI / 180);
        return [{
            angle: baseAngle + spread,
            speed: weapon.projectileSpeed,
            damage: weapon.damage
        }];
    }
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
        const config = WEAPON_TYPES[type];
        if (!config) throw new Error(`Invalid weapon type: ${type}`);
        
        Object.assign(this, config);
        
        this.lastFired = 0;
        this.level = 1;
        this.upgrades = new Map();
        Object.keys(WEAPON_UPGRADES).forEach(upgrade => {
            this.upgrades.set(upgrade, 0);
        });
    }

    canFire(currentTime) {
        return currentTime - this.lastFired >= this.fireRate * 1000;
    }

    fire(origin, target, currentTime) {
        if (!this.canFire(currentTime)) return [];

        this.lastFired = currentTime;
        const pattern = WEAPON_PATTERNS[this.pattern];
        if (!pattern) return [];

        const projectiles = pattern(this, origin, target);
        return projectiles.map(proj => this.createProjectile(origin, proj));
    }

    createProjectile(origin, projConfig) {
        const speed = projConfig.speed * 0.16; // Adjust speed for delta time
        return {
            x: origin.x,
            y: origin.y,
            dx: Math.cos(projConfig.angle) * speed,
            dy: Math.sin(projConfig.angle) * speed,
            damage: projConfig.damage,
            size: this.projectileSize,
            color: this.color,
            piercing: projConfig.piercing || false,
            range: projConfig.range,
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