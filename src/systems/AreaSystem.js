/**
 * @file AreaSystem.js
 * @description Manages game areas/levels and transitions between them.
 * Handles area state, requirements, transitions, and coordinates with PortalManager.
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';
import { LEVEL_CONFIGS } from '../core/config.js';

/**
 * Represents a game area/level with its properties and behavior
 */
export class Level {
    constructor(config) {
        // Core properties
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        
        // Area dimensions and position
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width;
        this.height = config.height;
        
        // Visual theme
        this.backgroundColor = config.backgroundColor;
        this.borderColor = config.borderColor;
        
        // Gameplay configuration
        this.spawnRate = config.spawnRate;
        this.maxEnemies = config.maxEnemies;
        this.eliteChance = config.eliteChance;
        this.enemyRatios = { ...config.enemyRatios };
        
        // Enemy modifiers
        this.enemyModifiers = {
            health: config.enemyModifiers?.health || 1,
            speed: config.enemyModifiers?.speed || 1,
            damage: config.enemyModifiers?.damage || 1,
            experience: config.enemyModifiers?.experience || 1
        };
        
        // Area connections and state
        this.connections = config.connections || [];
        this.requirements = config.requirements || null;
        this.features = config.features || [];
        this.isUnlocked = config.id === 'starting_grounds' || config.isUnlocked === true;
        this.isCompleted = false;
    }

    // Get spawn configuration for this area
    getSpawnConfig() {
        return {
            baseRate: this.spawnRate,
            maxEnemies: this.maxEnemies,
            typeRatios: this.enemyRatios,
            eliteChance: this.eliteChance,
            eliteModifiers: this.enemyModifiers,
            spawnDistance: 600 // Base spawn distance
        };
    }

    // Check if player meets requirements to enter
    canEnter(gameState) {
        if (!this.requirements) return true;
        
        return this.requirements.every(req => {
            switch (req.type) {
                case 'level':
                    return gameState.level >= req.value;
                case 'score':
                    return gameState.score >= req.value;
                case 'kill_count':
                    return gameState.killCount >= req.value;
                default:
                    return true;
            }
        });
    }
}

/**
 * System for managing game areas and transitions
 */
export class AreaSystem {
    constructor(app, managers) {
        this.app = app;
        this.managers = managers;
        this.currentArea = null;
        this.areas = new Map();
        
        // Initialize areas from config
        this.initializeAreas();
    }

    /**
     * Initialize all game areas from configuration
     */
    initializeAreas() {
        LEVEL_CONFIGS.forEach(config => {
            const area = new Level(config);
            this.areas.set(area.id, area);
        });
        
        if (gameState.debug) {
            console.log('Areas initialized:', {
                count: this.areas.size,
                areas: Array.from(this.areas.keys())
            });
        }
    }

    /**
     * Set the current active area
     * @param {string} areaId - ID of the area to set as current
     */
    setCurrentArea(areaId) {
        const newArea = this.areas.get(areaId);
        if (!newArea) {
            console.error(`Area ${areaId} not found`);
            return false;
        }

        if (!newArea.canEnter(gameState)) {
            this.managers.ui?.showMessage("Level requirement not met!", 0xFF0000);
            return false;
        }

        this.currentArea = newArea;
        return true;
    }

    /**
     * Initialize a new area when entering it
     * @param {Level} area - The area to initialize
     */
    initializeArea(area) {
        if (!area) return;

        // Clear existing area elements
        this.managers.layer?.cleanup();
        
        // Update background
        this.updateAreaVisuals(area);
        
        // Setup portals
        this.managers.portal?.createAreaPortals(area);
        
        // Reset enemy spawning
        gameState.enemies = [];
        
        if (gameState.debug) {
            console.log('Area initialized:', {
                id: area.id,
                name: area.name,
                dimensions: { width: area.width, height: area.height },
                enemies: gameState.enemies.length
            });
        }
    }

    /**
     * Update visual elements for the new area
     * @param {Level} area - The area to update visuals for
     */
    updateAreaVisuals(area) {
        // Update background color
        this.app.renderer.background.color = area.backgroundColor;
        
        // Update grid or other visual elements
        const backgroundLayer = this.managers.layer?.getLayer('backgroundLayer');
        if (backgroundLayer) {
            backgroundLayer.removeChildren();
            this.createAreaBackground(area, backgroundLayer);
        }
    }

    /**
     * Create background visuals for an area
     * @param {Level} area - The area to create background for
     * @param {PIXI.Container} backgroundLayer - The layer to add background to
     */
    createAreaBackground(area, backgroundLayer) {
        // Create grid pattern
        const graphics = new PIXI.Graphics();
        const gridSize = 100;
        
        graphics
            .lineStyle(1, 0x333333, 0.3)
            .fill({ color: area.backgroundColor || 0x1a1a1a });
            
        // Draw vertical lines
        for (let x = 0; x <= area.width; x += gridSize) {
            graphics.moveTo(x, 0).lineTo(x, area.height);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= area.height; y += gridSize) {
            graphics.moveTo(0, y).lineTo(area.width, y);
        }
        
        backgroundLayer.addChild(graphics);
    }

    /**
     * Get available connections from current area
     * @returns {Array} Array of available area connections
     */
    getAvailableConnections() {
        if (!this.currentArea) return [];
        
        return this.currentArea.connections
            .map(id => this.areas.get(id))
            .filter(area => area && area.canEnter(gameState));
    }

    /**
     * Handle transition between areas
     * @param {string} targetAreaId - ID of the area to transition to
     */
    transitionToArea(targetAreaId) {
        const targetArea = this.areas.get(targetAreaId);
        if (!targetArea || !targetArea.canEnter(gameState)) return;

        // Create transition effect
        const transition = new PIXI.Graphics();
        transition
            .fill({ color: 0x000000 })
            .rect(0, 0, this.app.screen.width, this.app.screen.height);
        transition.alpha = 0;
        this.app.stage.addChild(transition);
        
        // Fade out
        PIXI.Tween.to(transition, { alpha: 1 }, 500)
            .onComplete(() => {
                // Switch areas
                this.setCurrentArea(targetAreaId);
                this.initializeArea(targetArea);
                
                // Fade in
                PIXI.Tween.to(transition, { alpha: 0 }, 500)
                    .onComplete(() => {
                        this.app.stage.removeChild(transition);
                    })
                    .start();
            })
            .start();
    }
} 