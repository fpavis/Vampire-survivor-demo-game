/**
 * @file CombatSystem.js
 * @description Manages all combat-related mechanics in the game, including weapon firing and projectile updates.
 * This system is responsible for:
 * - Handling weapon firing logic
 * - Creating and managing projectiles
 * - Updating projectile positions
 * - Coordinating with BulletManager for bullet lifecycle
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';

/**
 * Manages combat mechanics and weapon systems
 * @class CombatSystem
 */
export class CombatSystem {
    /**
     * Creates a new CombatSystem instance
     * @param {PIXI.Application} app - The main PIXI application instance
     * @param {import('pixi-viewport').Viewport} viewport - The game's viewport for coordinate transformations
     * @param {PIXI.Container} worldContainer - The main world container
     */
    constructor(app, viewport, worldContainer) {
        if (!app || !viewport || !worldContainer) {
            throw new Error('CombatSystem: Required dependencies not provided');
        }

        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;
        
        // Create dedicated layers for combat elements
        this.layers = {
            bullets: new PIXI.Container(),
            effects: new PIXI.Container()
        };

        // Configure layers
        Object.values(this.layers).forEach(layer => {
            layer.sortableChildren = true;
            layer.cullable = true;  // Enable culling for performance
            this.worldContainer.addChild(layer);
        });

        // Create particle container for better performance with bullets
        this.bulletContainer = new PIXI.ParticleContainer(1000, {
            scale: true,
            position: true,
            rotation: true,
            uvs: true,
            alpha: true
        });
        this.layers.bullets.addChild(this.bulletContainer);

        // Create shared graphics for reuse
        this.sharedGraphics = {
            bullet: new PIXI.Graphics()
                .circle(0, 0, 1)  // Unit circle for scaling
                .fill({ color: 0xFFDD00 })
        };

        // Initialize manager references
        this.managers = null;

        if (gameState.debug) {
            console.log('CombatSystem initialized:', {
                viewport: {
                    found: true,
                    scale: viewport.scale.x
                },
                layers: {
                    bullets: !!this.layers.bullets,
                    effects: !!this.layers.effects
                }
            });
        }
    }

    /**
     * Sets up manager references for system coordination
     * @param {Object} managers - Object containing references to other game managers
     */
    setManagers(managers) {
        if (!managers) {
            throw new Error('CombatSystem: Managers not provided');
        }
        this.managers = managers;
    }

    /**
     * Main combat update loop
     * @param {number} delta - Time elapsed since last update
     */
    handleCombat(delta) {
        if (!this.managers) return;
        
        this.updateWeapons(delta);
        this.updateProjectiles(delta);
    }

    /**
     * Updates weapon states and handles firing logic
     * @param {number} delta - Time elapsed since last update
     * @private
     */
    updateWeapons(delta) {
        if (!this.managers?.player) return;
        
        const player = this.managers.player;
        const now = Date.now();
        
        // Update each weapon
        player.weapons.forEach(weapon => {
            if (weapon.canFire(now)) {
                this.fireWeapon(weapon, player);
            }
        });
    }

    /**
     * Handles weapon firing and projectile creation
     * @param {Weapon} weapon - The weapon to fire
     * @param {Player} player - The player entity
     * @private
     */
    fireWeapon(weapon, player) {
        if (!this.managers?.bullet) return;
        
        const bullets = weapon.createProjectiles(player.x, player.y);
        bullets.forEach(bullet => {
            // Create bullet sprite using shared graphics
            const sprite = new PIXI.Sprite(this.sharedGraphics.bullet.texture);
            sprite.anchor.set(0.5);
            sprite.scale.set(bullet.radius || 5);
            
            // Add sprite to bullet and container
            bullet.sprite = sprite;
            this.bulletContainer.addChild(sprite);
            
            // Add to bullet manager
            this.managers.bullet.addBullet(bullet);
        });
    }

    /**
     * Updates all active projectiles
     * @param {number} delta - Time elapsed since last update
     * @private
     */
    updateProjectiles(delta) {
        if (!this.managers?.bullet) return;
        
        gameState.bullets.forEach(bullet => {
            if (bullet?.update) {
                bullet.update(delta);
                
                // Update sprite position if it exists
                if (bullet.sprite && !bullet.sprite.destroyed) {
                    bullet.sprite.position.set(bullet.x, bullet.y);
                    bullet.sprite.rotation = bullet.rotation || 0;
                }
            }
        });
    }

    /**
     * Cleans up combat system resources
     */
    cleanup() {
        // Remove all bullets
        if (this.bulletContainer) {
            this.bulletContainer.removeChildren();
        }
        
        // Clear all layers
        Object.values(this.layers).forEach(layer => {
            layer.removeChildren();
        });
    }

    /**
     * Destroys the combat system and cleans up resources
     */
    destroy() {
        this.cleanup();
        
        // Destroy shared graphics
        Object.values(this.sharedGraphics).forEach(graphic => {
            graphic.destroy();
        });
        
        // Destroy layers
        Object.values(this.layers).forEach(layer => {
            layer.destroy({ children: true });
        });
        
        // Destroy bullet container
        if (this.bulletContainer) {
            this.bulletContainer.destroy({ children: true });
        }
        
        // Clear references
        this.sharedGraphics = null;
        this.layers = null;
        this.bulletContainer = null;
        this.managers = null;
        this.app = null;
        this.viewport = null;
        this.worldContainer = null;
    }
} 