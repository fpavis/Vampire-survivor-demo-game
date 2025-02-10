/**
 * @file GameLoopSystem.js
 * @description Core game loop system that manages the main update cycle and coordinates all game systems.
 * Implements two separate tickers:
 * 1. System Ticker: For high-priority, critical updates (collision, camera)
 * 2. Game Ticker: For standard game logic and visual updates
 * 
 * Key Features:
 * - Manages frame-rate independent updates
 * - Coordinates system updates in proper order
 * - Handles game state transitions
 * - Provides debug logging for performance monitoring
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';

export class GameLoopSystem {
    /**
     * Creates a new GameLoopSystem instance
     * @param {PIXI.Application} app - The main PIXI application instance
     * @param {Object} managers - Object containing all game manager references
     */
    constructor(app, managers) {
        this.app = app;
        this.managers = managers;
        
        // Initialize two separate tickers for different update priorities
        this.systemTicker = PIXI.Ticker.system;  // For critical systems (collision, camera)
        this.gameTicker = PIXI.Ticker.shared;    // For game logic and visual updates
        
        // Configure ticker settings for optimal performance
        this.gameTicker.maxFPS = 60;  // Cap frame rate at 60 FPS
        this.gameTicker.minFPS = 30;  // Minimum acceptable frame rate
    }

    /**
     * Starts the game loop system
     * Sets up both system and game tickers with proper priorities
     */
    start() {
        if (gameState.player) {
            // Clean up any existing game ticker
            if (gameState.gameTicker) {
                this.gameTicker.remove(gameState.gameTicker);
            }
            
            // Create new game loop function and store in game state
            gameState.gameTicker = (delta) => this.gameLoop(delta);
            
            // Add game loop to shared ticker with normal priority
            // This handles most game updates (movement, combat, UI)
            this.gameTicker.add(gameState.gameTicker, PIXI.UPDATE_PRIORITY.NORMAL);
            
            // Add critical systems to system ticker with high priority
            // This ensures collision and camera updates happen even if game lags
            this.systemTicker.add(this.updateCriticalSystems, this, PIXI.UPDATE_PRIORITY.HIGH);
            
            // Start tickers if not already running
            if (!this.gameTicker.started) this.gameTicker.start();
            if (!this.systemTicker.started) this.systemTicker.start();
        }
    }

    /**
     * Stops the game loop system
     * Cleans up both tickers
     */
    stop() {
        if (gameState.gameTicker) {
            this.gameTicker.remove(gameState.gameTicker);
        }
        this.systemTicker.remove(this.updateCriticalSystems, this);
    }

    /**
     * Main game loop function
     * Handles all standard priority updates each frame
     * @param {number} delta - Time elapsed since last update (normalized by PIXI)
     */
    gameLoop = (delta) => {
        // Skip updates if game is in a paused state
        if (gameState.gameOver || gameState.levelUp || gameState.paused || !gameState.player) return;

        // Validate and fix player position if needed
        this.validatePlayerPosition();

        // Update input state first
        this.managers.input.update(delta);

        // Update sequence for standard game systems
        // Order is important for gameplay consistency
        this.managers.player.updateMovement(delta);     // Handle player movement with physics
        this.managers.combat.handleCombat(delta);       // Process combat actions
        this.updateEntities(delta);                     // Update all game entities
        this.managers.experience.updateExperienceGems(delta);  // Update experience pickups
        this.managers.player.handleHealthRegen(delta);   // Process health regeneration
        
        // Check for area transitions (portals)
        this.managers.portal.checkPortalCollisions(this.managers.area.currentArea, (newArea) => {
            this.managers.area.currentArea = newArea;
            this.managers.area.initializeArea(newArea);
        });
        
        // Final updates for visual elements
        this.managers.ui.update();                // Update UI elements
        this.app.stage.sortChildren();           // Sort display list for proper layering
    }

    /**
     * Updates player movement using the input manager
     * @param {number} delta - Time elapsed since last update
     * @private
     */
    updatePlayerMovement(delta) {
        if (!gameState.player) return;

        // Get movement vector from input manager
        const movement = this.managers.input.getMovementDirection(delta, gameState.playerSpeed);
        
        // Update player position
        gameState.player.position.x += movement.x;
        gameState.player.position.y += movement.y;

        // Update player rotation based on aim direction
        const aimDirection = this.managers.input.getAimDirection();
        gameState.player.rotation = Math.atan2(aimDirection.y, aimDirection.x);

        // Ensure transform is updated
        gameState.player.updateTransform();

        if (gameState.debug && Math.random() < 0.01) {
            console.log('Player movement:', {
                position: { ...gameState.player.position },
                movement: { x: movement.x, y: movement.y },
                rotation: gameState.player.rotation,
                aim: { x: aimDirection.x, y: aimDirection.y }
            });
        }
    }

    /**
     * Validates and corrects player position if needed
     * Ensures player stays within valid world bounds and has valid coordinates
     * @private
     */
    validatePlayerPosition() {
        if (!gameState.debug || !gameState.player) return;

        const currentArea = this.managers.area.currentArea;
        if (!currentArea) return;

        // Get player's current position
        const playerPos = {
            x: gameState.player.position.x,
            y: gameState.player.position.y
        };

        // Check if position is valid
        const isValidPosition = (
            Number.isFinite(playerPos.x) &&
            Number.isFinite(playerPos.y) &&
            playerPos.x >= 0 &&
            playerPos.y >= 0 &&
            playerPos.x <= currentArea.width &&
            playerPos.y <= currentArea.height
        );

        if (!isValidPosition) {
            console.warn('Invalid player position detected:', playerPos);

            // Calculate safe position (center of current area or nearest valid point)
            const safePosition = {
                x: Math.min(Math.max(0, currentArea.width / 2), currentArea.width),
                y: Math.min(Math.max(0, currentArea.height / 2), currentArea.height)
            };

            // Smoothly interpolate to safe position
            const lerpFactor = 0.15; // Adjust for smoother or faster correction
            gameState.player.position.x = playerPos.x * (1 - lerpFactor) + safePosition.x * lerpFactor;
            gameState.player.position.y = playerPos.y * (1 - lerpFactor) + safePosition.y * lerpFactor;

            // Ensure transform is updated
            gameState.player.updateTransform();

            if (gameState.debug) {
                console.log('Correcting player position:', {
                    previous: playerPos,
                    target: safePosition,
                    current: {
                        x: gameState.player.position.x,
                        y: gameState.player.position.y
                    },
                    area: {
                        width: currentArea.width,
                        height: currentArea.height
                    }
                });
            }
        }
    }

    /**
     * Updates critical systems that need to run at system priority
     * These updates happen even if the game loop is struggling
     * @param {number} delta - Time elapsed since last update
     */
    updateCriticalSystems = (delta) => {
        if (gameState.gameOver || gameState.paused) return;
        
        // Update collision detection
        this.managers.collision.checkCollisions();
        
        // Update camera position and bounds
        this.managers.camera.update(delta);
    }

    /**
     * Updates all game entities (enemies, bullets, etc.)
     * @param {number|Object} delta - Time elapsed since last update
     */
    updateEntities(delta) {
        // Ensure delta is a number (handle both PIXI delta types)
        const deltaTime = typeof delta === 'number' ? delta : delta.deltaTime;
        
        // Update enemy spawning and behavior
        this.managers.enemy.handleEnemySpawning(deltaTime, this.managers.area.currentArea);
        this.managers.enemy.updateEnemies(deltaTime);
        
        // Update projectiles
        this.managers.combat.updateProjectiles(deltaTime);
        
        // Debug logging (1% chance per frame to avoid spam)
        if (gameState.debug && Math.random() < 0.01) {
            console.log('Entity state:', {
                enemies: gameState.enemies.length,
                bullets: gameState.bullets.length,
                delta: deltaTime,
                currentArea: this.managers.area.currentArea.id
            });
        }
    }
} 