/**
 * @file PlayerSystem.js
 * This file contains two main classes:
 * 1. Player - The actual player entity that exists in the game world
 * 2. PlayerSystem - The system that manages the player entity and its interactions
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';
import { Weapon } from '../weapons/Weapon.js';
import { GameEntity } from '../core/GameEntity.js';

/**
 * Player entity class - Represents the actual player in the game
 * Handles:
 * - Visual representation (sprite)
 * - Health management
 * - Weapon management
 * - Combat actions
 * @extends PIXI.Container
 */
class Player extends PIXI.Container {
    constructor(app) {
        super();
        
        // Set rendering properties for the player container
        this.zIndex = 10;  // Player renders above most entities
        this.eventMode = 'static';  // Enable interaction events
        
        // Create the player's visual representation
        // Try to use a texture, fall back to a simple shape if texture not found
        const texture = PIXI.Assets.get('player');
        this.sprite = texture ? 
            new PIXI.Sprite(texture) : 
            this.createFallbackSprite();
            
        // Center the sprite's anchor point and add it to the container
        this.sprite.anchor.set(0.5);
        this.addChild(this.sprite);
        
        // Create and initialize the health bar
        this.setupHealthBar();
        
        // Initialize player stats
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 5;
        
        // Set up collision detection area
        this.hitArea = new PIXI.Circle(0, 0, 20);
        
        // Initialize weapon system
        this.weapons = [];          // Array to hold all player weapons
        this.currentWeaponIndex = 0;  // Index of currently selected weapon
        this.lastFireTime = 0;      // Timestamp of last weapon fire (for fire rate)

        // Movement properties
        this.movementSmoothing = {
            current: new PIXI.Point(),
            target: new PIXI.Point(),
            factor: 0.2  // Adjust for smoother/faster movement
        };
    }
    
    /**
     * Creates a simple circular sprite if no texture is available
     * Used as a fallback visual representation
     */
    createFallbackSprite() {
        const graphics = new PIXI.Graphics()
            .fill({ color: 0x00ff88 })
            .circle(0, 0, 20);
        return graphics;
    }
    
    /**
     * Creates the health bar visual component
     * Positioned above the player sprite
     */
    setupHealthBar() {
        this.healthBar = new PIXI.Graphics();
        this.healthBar.y = -30;  // Position above player
        this.addChild(this.healthBar);
        this.updateHealthBar();
    }
    
    /**
     * Updates the health bar visual based on current health
     * Changes color to red when health is low
     */
    updateHealthBar() {
        const width = 40;
        const height = 4;
        const healthPercent = this.health / this.maxHealth;
        
        this.healthBar.clear()
            // Draw background
            .fill({ color: 0x000000, alpha: 0.5 })
            .rect(-width/2, 0, width, height)
            // Draw health amount (red if low, green if healthy)
            .fill({ color: healthPercent < 0.3 ? 0xFF0000 : 0x00FF00 })
            .rect(-width/2, 0, width * healthPercent, height);
    }
    
    /**
     * Handles damage taken by the player
     * Updates health and visual feedback
     * @returns {boolean} True if player died from this damage
     */
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        // Visual feedback - flash the player
        PIXI.Tween.to(this, { alpha: 0.5 }, 100)
            .yoyo(true)
            .start();
            
        return this.health <= 0;
    }

    /**
     * Gets the player's current position in world coordinates
     * Used for weapon firing and collision detection
     */
    getWorldPosition() {
        return {
            x: this.position.x,
            y: this.position.y
        };
    }

    /**
     * Weapon management methods
     */
    addWeapon(weapon) {
        this.weapons.push(weapon);
    }

    switchWeapon() {
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
        return this.weapons[this.currentWeaponIndex];
    }

    getCurrentWeapon() {
        return this.weapons[this.currentWeaponIndex];
    }

    /**
     * Main weapon firing logic
     * Coordinates between weapon system and bullet manager
     * @returns {boolean} Whether a shot was fired
     */
    handleWeaponFiring(currentTime, bulletManager) {
        const weapon = this.getCurrentWeapon();
        if (!weapon || !bulletManager) return false;

        if (weapon.canFire(currentTime)) {
            // Get projectile configurations from weapon
            const projectiles = weapon.fire(
                this.getWorldPosition(),
                this.getAimDirection(),
                currentTime
            );

            // Create actual bullets through bullet manager
            projectiles.forEach(config => {
                bulletManager.addBullet(config);
            });

            return true;
        }

        return false;
    }

    /**
     * Gets the direction the player is aiming
     * Currently just aims right, but can be updated with actual input handling
     */
    getAimDirection() {
        return { x: 1, y: 0 };
    }

    /**
     * Updates player movement with smoothing
     * @param {Object} rawMovement - Raw movement vector from input
     * @param {number} delta - Time elapsed since last update
     */
    updateMovement(rawMovement, delta) {
        // Validate inputs
        if (!rawMovement || !Number.isFinite(delta)) {
            console.warn('Invalid movement parameters:', { rawMovement, delta });
            return;
        }

        // Update movement target
        this.movementSmoothing.target.set(rawMovement.x, rawMovement.y);

        // Apply smoothing
        this.movementSmoothing.current.x += (
            this.movementSmoothing.target.x - this.movementSmoothing.current.x
        ) * this.movementSmoothing.factor;
        
        this.movementSmoothing.current.y += (
            this.movementSmoothing.target.y - this.movementSmoothing.current.y
        ) * this.movementSmoothing.factor;

        // Apply speed and delta time
        const deltaSpeed = this.speed * (delta / 16.667); // Normalize to 60fps
        
        // Update position
        this.position.x += this.movementSmoothing.current.x * deltaSpeed;
        this.position.y += this.movementSmoothing.current.y * deltaSpeed;

        // Clean up very small movements
        if (Math.abs(this.movementSmoothing.current.x) < 0.001) {
            this.movementSmoothing.current.x = 0;
        }
        if (Math.abs(this.movementSmoothing.current.y) < 0.001) {
            this.movementSmoothing.current.y = 0;
        }
    }
}

/**
 * PlayerSystem class - Manages the player entity and its interactions
 * Handles:
 * - Player creation and initialization
 * - Player updates and state management
 * - Coordination with other game systems
 */
export class PlayerSystem {
    /**
     * Initialize the player system with required dependencies
     */
    constructor(app, managers) {
        this.app = app;
        this.managers = managers;  // References to other game systems
        this.lastUpdateTime = 0;   // For timing updates
    }

    /**
     * Creates a new player instance with initial setup
     * Called when starting a new game or respawning
     */
    createPlayer() {
        const player = new Player(this.app);
        
        // Give player their starting weapon
        const startingWeapon = new Weapon('PISTOL');
        player.addWeapon(startingWeapon);
        
        // Debug logging
        if (gameState.debug) {
            console.log('Player created:', {
                position: player.position,
                health: player.health,
                weapon: player.getCurrentWeapon()
            });
        }
        
        return player;
    }

    /**
     * Handles health regeneration over time
     * Updates UI to reflect changes
     */
    handleHealthRegen(delta) {
        if (gameState.healthRegen > 0 && gameState.health < gameState.maxHealth) {
            gameState.health = Math.min(
                gameState.maxHealth,
                gameState.health + gameState.healthRegen * delta
            );
            this.managers.ui.updateHealth(gameState.health, gameState.maxHealth);
        }
    }

    /**
     * Processes damage taken by the player
     * Handles visual feedback and checks for death
     */
    takeDamage(amount) {
        if (!gameState.player) return false;
        
        gameState.player.health = Math.max(0, gameState.player.health - amount);
        this.updateHealthBar(gameState.player);
        
        // Visual feedback
        PIXI.Tween.to(gameState.player, { alpha: 0.5 }, 100)
            .yoyo(true)
            .start();
            
        return gameState.player.health <= 0;
    }

    /**
     * Cleans up player resources
     * Called when player dies or game ends
     */
    cleanup() {
        if (gameState.player?.parent) {
            gameState.player.parent.removeChild(gameState.player);
        }
        if (gameState.player) {
            gameState.player.destroy({ children: true });
            gameState.player = null;
        }
    }

    /**
     * Updates player combat state
     * Handles weapon firing and combat mechanics
     */
    updateCombat(delta) {
        if (!gameState.player || !this.managers.bullet) return;

        const currentTime = Date.now();
        this.lastUpdateTime = currentTime;

        // Handle automatic weapon firing
        gameState.player.handleWeaponFiring(currentTime, this.managers.bullet);
    }

    /**
     * Updates player movement state
     * @param {number} delta - Time elapsed since last update
     */
    updateMovement(delta) {
        if (!gameState.player) return;

        // Get raw movement input
        const rawMovement = this.managers.input.getRawMovementVector();
        
        // Update player movement with physics
        gameState.player.updateMovement(rawMovement, delta);

        // Update player rotation based on aim
        const aimDirection = this.managers.input.getAimDirection();
        gameState.player.rotation = Math.atan2(aimDirection.y, aimDirection.x);

        if (gameState.debug && Math.random() < 0.01) {
            console.log('Player movement:', {
                position: { ...gameState.player.position },
                movement: { 
                    current: { ...gameState.player.movementSmoothing.current },
                    target: { ...gameState.player.movementSmoothing.target }
                },
                rotation: gameState.player.rotation
            });
        }
    }
} 