/**
 * @file BulletManager.js
 * @description Manages bullet creation, updates, and cleanup in the game.
 * Handles bullet pooling, lifecycle, and rendering optimization.
 * 
 * Key Features:
 * - Bullet pooling for performance optimization
 * - Automatic bullet cleanup when out of bounds
 * - Visual effects (glow, animations)
 * - Efficient update cycle using PIXI.Ticker
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';
import { STYLES } from '../core/config.js';
import { PROJECTILE_TYPES } from '../weapons/Weapon.js';

/**
 * Represents a single bullet in the game
 * @class Bullet
 * @extends PIXI.Container
 * 
 * Features:
 * - Container-based structure for complex visuals
 * - Automatic glow effect with animation
 * - Optimized rendering with proper z-indexing
 * - Efficient cleanup of resources
 */
class Bullet extends PIXI.Container {
    /**
     * Creates a new bullet instance
     * @param {object} config - Configuration object for bullet
     */
    constructor(config) {
        super();
        
        // Set container properties for optimal rendering
        this.label = 'BulletContainer';
        this.sortableChildren = true;
        this.zIndex = config.zIndex || 8;
        this.eventMode = 'none';
        
        // Initialize transform matrix for proper positioning
        this.transform.setFromMatrix(new PIXI.Matrix());
        
        // Store bullet properties
        this.damage = config.damage;
        this.piercing = config.piercing;
        this.range = config.range;
        this.pattern = config.pattern;
        this.weaponType = config.weaponType;
        
        // Set up movement properties
        this.position.set(config.x, config.y);
        this.velocity = {
            x: config.dx,
            y: config.dy
        };
        this.rotation = Math.atan2(config.dy, config.dx);
        
        // Create visuals based on projectile type
        this._createProjectileVisuals(config);
        
        // Add special effects based on projectile type
        this._createSpecialEffects(config);
    }

    /**
     * Creates projectile visuals based on type configuration
     * @private
     */
    _createProjectileVisuals(config) {
        const texture = PIXI.Assets.get(config.textureKey);
        if (!texture?.valid) {
            // Create fallback graphics
            this.body = new PIXI.Graphics()
                .fill({ color: config.glowColor || STYLES.colors.bullet })
                .circle(0, 0, config.size || 5);
        } else {
            this.body = PIXI.Sprite.from(texture);
            const scale = config.size / Math.max(texture.width, texture.height);
            this.body.scale.set(scale);
        }
        
        this.body.anchor.set(0.5);
        this.body.eventMode = 'none';
        this.body.zIndex = 1;
        this.addChild(this.body);
    }

    /**
     * Creates special effects based on projectile type
     * @private
     */
    _createSpecialEffects(config) {
        // Add glow effect if texture exists
        const glowTexture = PIXI.Assets.get(config.glowTextureKey);
        if (glowTexture) {
            this._addGlowEffect(glowTexture, config);
        }

        // Add trail effect if specified
        if (config.trail) {
            this._addTrailEffect(config);
        }
    }

    /**
     * Adds glow effect to the projectile
     * @private
     */
    _addGlowEffect(glowTexture, config) {
        this.glow = PIXI.Sprite.from(glowTexture);
        this.glow.anchor.set(0.5);
        this.glow.zIndex = 0;
        this.glow.eventMode = 'none';
        
        const glowScale = (this.body.width * (config.glowScale || 1.5)) / glowTexture.width;
        this.glow.scale.set(glowScale);
        this.addChild(this.glow);
        
        // Add pulsing animation
        let glowTime = Math.random() * Math.PI * 2;
        const updateGlow = (delta) => {
            glowTime += delta * 0.1;
            const scale = 1 + Math.sin(glowTime) * 0.2;
            this.glow.scale.set(glowScale * scale);
        };
        PIXI.Ticker.shared.add(updateGlow);
        
        this._cleanupGlow = () => {
            PIXI.Ticker.shared.remove(updateGlow);
        };
    }

    /**
     * Adds trail effect to the projectile
     * @private
     */
    _addTrailEffect(config) {
        this.trail = new PIXI.Graphics();
        this.trail.zIndex = -1;
        this.addChild(this.trail);
        
        let trailPoints = [];
        const updateTrail = (delta) => {
            trailPoints.unshift({ x: this.x, y: this.y });
            if (trailPoints.length > 10) trailPoints.pop();
            
            this.trail.clear();
            if (trailPoints.length < 2) return;
            
            this.trail
                .lineStyle({
                    width: config.size * 0.8,
                    color: config.glowColor,
                    alpha: 0.5
                });
            
            this.trail.moveTo(trailPoints[0].x, trailPoints[0].y);
            for (let i = 1; i < trailPoints.length; i++) {
                const point = trailPoints[i];
                this.trail.lineTo(point.x, point.y);
            }
        };
        
        PIXI.Ticker.shared.add(updateTrail);
        this._cleanupTrail = () => {
            PIXI.Ticker.shared.remove(updateTrail);
            trailPoints = [];
        };
    }
    
    /**
     * Updates bullet position and transform
     * @param {number} delta - Time elapsed since last update
     */
    update(delta) {
        this.position.x += this.velocity.x * delta;
        this.position.y += this.velocity.y * delta;
        this.transform.updateTransform(this.parent.transform);
    }
    
    /**
     * Cleans up bullet resources
     */
    cleanup() {
        if (this._cleanupGlow) {
            this._cleanupGlow();
        }
        if (this._cleanupTrail) {
            this._cleanupTrail();
        }
        if (this.parent) {
            this.parent.removeChild(this);
        }
        this.destroy({ children: true, texture: true });
    }
}

/**
 * Manages bullet creation, pooling, and lifecycle in the game
 * @class BulletManager
 */
export class BulletManager {
    constructor(app) {
        this.app = app;
        this.bullets = [];
        this.bulletPool = [];
        this.bulletLayer = null;
    }

    /**
     * Initializes the bullet manager
     */
    init() {
        this.bullets = [];
        this.bulletPool = [];
        if (gameState.debug) {
            console.log('BulletManager initialized');
        }
    }

    /**
     * Sets the layer where bullets will be rendered
     * @param {PIXI.Container} layer - The container for bullets
     */
    setLayer(layer) {
        this.bulletLayer = layer;
    }

    /**
     * Creates a new bullet with the given configuration
     * @param {object} config - Bullet configuration object
     */
    addBullet(config) {
        if (!this.bulletLayer) {
            console.warn('BulletManager: No bullet layer set');
            return null;
        }

        // Get bullet from pool or create new one
        let bullet = this.bulletPool.pop() || new Bullet(config);
        
        // Reset bullet with new config if reusing from pool
        if (bullet.parent) {
            Object.assign(bullet, {
                position: { x: config.x, y: config.y },
                velocity: { x: config.dx, y: config.dy },
                rotation: Math.atan2(config.dy, config.dx),
                damage: config.damage,
                piercing: config.piercing,
                range: config.range,
                pattern: config.pattern,
                weaponType: config.weaponType
            });
        }

        this.bulletLayer.addChild(bullet);
        this.bullets.push(bullet);

        if (gameState.debug) {
            console.log(`Added bullet: type=${config.weaponType}, damage=${config.damage}`);
        }

        return bullet;
    }

    /**
     * Updates all active bullets
     * @param {number} delta - Time elapsed since last update
     */
    updateBullets(delta) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Skip if bullet was already removed
            if (!bullet || !bullet.parent) {
                this.bullets.splice(i, 1);
                continue;
            }

            bullet.update(delta);

            // Check if bullet is out of range or off screen
            const bounds = this.bulletLayer.getBounds();
            if (!bounds.contains(bullet.x, bullet.y)) {
                this.removeBullet(bullet, i);
                continue;
            }

            // Handle bullet pattern behavior if defined
            if (bullet.pattern && typeof bullet.pattern === 'function') {
                bullet.pattern(bullet, delta);
            }
        }
    }

    /**
     * Removes a bullet and returns it to the pool
     * @param {Bullet} bullet - The bullet to remove
     * @param {number} index - Index in bullets array
     */
    removeBullet(bullet, index) {
        if (!bullet) return;

        // Remove from active bullets array
        if (index !== undefined) {
            this.bullets.splice(index, 1);
        } else {
            const idx = this.bullets.indexOf(bullet);
            if (idx !== -1) this.bullets.splice(idx, 1);
        }

        // Return to pool if not destroyed
        if (!bullet.destroyed) {
            bullet.cleanup();
            this.bulletPool.push(bullet);
        }
    }

    /**
     * Cleans up all bullets and resets the manager
     */
    cleanup() {
        // Clean up all active bullets
        for (const bullet of this.bullets) {
            if (bullet && !bullet.destroyed) {
                bullet.cleanup();
            }
        }

        // Clean up pooled bullets
        for (const bullet of this.bulletPool) {
            if (bullet && !bullet.destroyed) {
                bullet.cleanup();
            }
        }

        this.bullets = [];
        this.bulletPool = [];
        
        if (gameState.debug) {
            console.log('BulletManager cleaned up');
        }
    }
} 