/**
 * @file Game.js
 * @description Main game class that initializes and coordinates all game systems.
 * This is the central hub that manages game state, updates, and system interactions.
 * 
 * @module core/Game
 * @requires PIXI.js v8
 * @requires pixi-viewport
 * @requires core/config
 * @requires core/gameState
 * @requires systems/* - All game systems (Asset, Layer, GameLoop, Player, etc.)
 * @requires managers/* - All game managers (UI, Input, Effects, Camera, etc.)
 * 
 * Key Features:
 * - Initializes PixiJS v8 application with WebGPU/WebGL rendering
 * - Sets up viewport and camera management
 * - Manages layered rendering system
 * - Coordinates game systems and managers
 * - Handles window resizing and responsive layout
 * - Controls game state and progression
 * 
 * Usage:
 * ```js
 * // Game initializes automatically when instantiated
 * new Game();
 * ```
 * 
 * System Architecture:
 * - Core Systems:
 *   - AssetSystem: Handles asset loading and management
 *   - LayerSystem: Manages rendering layers and display hierarchy
 *   - GameLoopSystem: Coordinates update cycles
 *   - PlayerSystem: Manages player entity and controls
 *   - CombatSystem: Handles combat mechanics
 *   - CollisionSystem: Manages collision detection
 * 
 * - Managers:
 *   - CameraManager: Viewport and camera control
 *   - InputManager: User input handling
 *   - EnemyManager: Enemy spawning and behavior
 *   - BulletManager: Projectile management
 *   - EffectsManager: Visual effects
 *   - UIManager: User interface
 *   - PortalManager: Level transition points
 *   - ExperienceManager: Experience and leveling
 *   - UpgradeManager: Player upgrades
 * 
 * Initialization Flow:
 * 1. Create PixiJS application with WebGPU preference
 * 2. Initialize core systems (Asset, Layer)
 * 3. Set up camera and viewport
 * 4. Initialize all managers with proper layer references
 * 5. Set up game loop and event handlers
 * 6. Show start screen and await player input
 * 
 * State Management:
 * - Uses gameState for global state
 * - Manages transitions between game states
 * - Handles area/level progression
 * 
 * Performance Considerations:
 * - Implements proper layer management for optimal rendering
 * - Uses WebGPU when available, falls back to WebGL
 * - Manages viewport and camera for efficient rendering
 * - Implements proper cleanup and resource management
 * 
 * @class
 */

// Import PixiJS and Viewport
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

// Game configuration and managers
import { GAME_CONFIG, ENEMY_TYPES, LEVEL_SCALING, STYLES, WORLD_CONFIG, SPAWN_CONFIG, COLLISION_CONFIG, LEVELS } from './config.js';
import { gameState } from './gameState.js';
import { InputManager } from '../managers/InputManager.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { EffectsManager } from '../managers/EffectsManager.js';
import { ViewportSystem } from '../systems/ViewportSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EnemyManager } from '../managers/EnemyManager.js';
import { PortalManager } from '../managers/PortalManager.js';
import { UpgradeManager } from '../managers/UpgradeManager.js';
import { ExperienceManager } from '../managers/ExperienceManager.js';
import { BulletManager } from '../managers/BulletManager.js';

// Import systems
import { AssetSystem } from '../systems/AssetSystem.js';
import { LayerSystem } from '../systems/LayerSystem.js';
import { GameLoopSystem } from '../systems/GameLoopSystem.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';
import { HUDSystem } from '../systems/HUDSystem.js';
import { MenuSystem } from '../systems/MenuSystem.js';
import { DebugSystem } from '../systems/DebugSystem.js';

class Game {
    constructor() {
        this.initializeGame().catch(error => {
            console.error('Game initialization error:', error);
        });
    }

    async initializeGame() {
        try {
            // Create canvas and get viewport dimensions
            const canvas = document.createElement('canvas');
            document.body.appendChild(canvas);
            
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Initialize Pixi application
            this.app = new PIXI.Application();
            await this.app.init({
                canvas,
                width: viewportWidth,
                height: viewportHeight,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                antialias: true,
                hello: true,
                preference: 'webgpu'
            });
            
            // Initialize core systems
            this.assetSystem = new AssetSystem(this.app);
            await this.assetSystem.loadAssets();
            
            // Set up main stage
            this.app.stage.eventMode = 'passive';
            this.app.stage.sortableChildren = true;
            
            // Initialize viewport system first
            this.viewportSystem = new ViewportSystem(this.app);
            
            // Create UI container
            const uiContainer = new PIXI.Container();
            uiContainer.sortableChildren = true;
            uiContainer.eventMode = 'passive';
            uiContainer.label = 'UIContainer';
            uiContainer.zIndex = 1000; // Ensure UI is always on top
            this.app.stage.addChild(uiContainer);
            
            // Initialize layer system
            this.layerSystem = new LayerSystem(this.app, this.viewportSystem);
            const layers = await this.layerSystem.createGameLayers();
            
            // Add UI container to layers
            layers.uiContainer = uiContainer;
            
            // Initialize managers with validated containers
            await this.initializeManagers(layers);
            
            // Initialize game loop system
            this.gameLoopSystem = new GameLoopSystem(this.app, {
                viewport: this.viewportSystem,
                player: this.playerSystem,
                combat: this.combatSystem,
                enemy: this.enemyManager,
                experience: this.experienceManager,
                portal: this.portalManager,
                collision: this.collisionSystem,
                area: this,
                hud: this.hudSystem,
                menu: this.menuSystem,
                debug: this.debugSystem
            });
            
            // Show start screen
            this.menuSystem.showMenu('startMenu');
            this.hudSystem.setVisible(false);
            
            // Set up window resize handler
            window.addEventListener('resize', () => this.handleResize());
            
            if (gameState.debug) {
                console.log('Game setup complete:', {
                    viewport: {
                        found: !!this.viewportSystem,
                        scale: this.viewportSystem.getViewport().scale.x
                    },
                    layers: {
                        ui: !!layers.uiContainer,
                        world: !!layers.worldContainer
                    },
                    systems: {
                        hud: !!this.hudSystem,
                        menu: !!this.menuSystem,
                        debug: !!this.debugSystem
                    }
                });
            }
            
        } catch (error) {
            console.error('Game initialization error:', error);
            throw error;
        }
    }

    async initializeManagers(layers) {
        if (!layers?.uiContainer) {
            throw new Error('UI container not provided in layers');
        }

        // Create shared graphics for UI systems
        const sharedGraphics = await this.createSharedGraphics();

        // Initialize UI systems first
        this.hudSystem = new HUDSystem(layers.uiContainer, sharedGraphics);
        this.menuSystem = new MenuSystem(layers.uiContainer, sharedGraphics);
        this.debugSystem = new DebugSystem(layers.uiContainer, sharedGraphics);

        // Initialize other managers
        this.inputManager = new InputManager(this.app, this.viewportSystem.getViewport());
        this.enemyManager = new EnemyManager(
            this.app, 
            this.viewportSystem.getViewport(), 
            layers.worldContainer,
            layers.entityLayer
        );
        this.bulletManager = new BulletManager(
            this.app, 
            this.viewportSystem.getViewport(), 
            layers.worldContainer,
            layers.bulletLayer
        );
        this.effectsManager = new EffectsManager(
            this.app, 
            this.viewportSystem.getViewport(), 
            layers.worldContainer
        );
        this.portalManager = new PortalManager(
            this.app, 
            this.viewportSystem.getViewport(), 
            layers.worldContainer
        );
        
        // Initialize systems
        this.combatSystem = new CombatSystem(
            this.app, 
            this.viewportSystem.getViewport(), 
            layers.worldContainer
        );
        
        this.collisionSystem = new CollisionSystem(
            this.app, 
            this.viewportSystem.getViewport(), 
            layers.worldContainer,
            this.effectsManager
        );
        
        this.experienceManager = new ExperienceManager(
            this.app, 
            this.viewportSystem.getViewport(), 
            layers.worldContainer
        );
        this.upgradeManager = new UpgradeManager(this.app);

        // Initialize player system with all required managers
        this.playerSystem = new PlayerSystem(this.app, {
            layer: this.layerSystem,
            viewport: this.viewportSystem,
            input: this.inputManager,
            collision: this.collisionSystem,
            hud: this.hudSystem,
            area: this
        });

        // Set up manager references for systems
        const managers = {
            player: this.playerSystem,
            enemy: this.enemyManager,
            bullet: this.bulletManager,
            effects: this.effectsManager,
            portal: this.portalManager,
            experience: this.experienceManager,
            hud: this.hudSystem,
            menu: this.menuSystem,
            debug: this.debugSystem
        };

        this.combatSystem.setManagers(managers);
        this.collisionSystem.setManagers(managers);

        // Register menu callbacks
        this.menuSystem.registerCallback('onStartGame', () => {
            this.startGame();
        });
    }

    /**
     * Create shared graphics resources for UI systems
     * @returns {Promise<Map<string, PIXI.Graphics>>} Map of shared graphics resources
     * @private
     */
    async createSharedGraphics() {
        const graphics = new Map();
        
        // Create textures using Graphics
        const renderTexture = (graphic) => {
            const bounds = graphic.getBounds();
            const texture = this.app.renderer.generateTexture(graphic);
            graphic.destroy();
            return texture;
        };

        // Panel background with rounded corners
        const panel = new PIXI.Graphics()
            .fill({ color: 0x000000, alpha: 0.7 })
            .roundRect(0, 0, 100, 100, 10);
        graphics.set('panel', { texture: renderTexture(panel) });

        // Progress bar with rounded corners
        const bar = new PIXI.Graphics()
            .fill({ color: 0xFFFFFF })
            .roundRect(0, 0, 100, 10, 5);
        graphics.set('bar', { texture: renderTexture(bar) });

        // Button with border and rounded corners
        const button = new PIXI.Graphics()
            .fill({ color: 0x333333 })
            .stroke({ width: 2, color: 0x666666 })
            .roundRect(0, 0, 200, 50, 10);
        graphics.set('button', { texture: renderTexture(button) });

        // Circle for particles and effects
        const circle = new PIXI.Graphics()
            .fill({ color: 0xFFFFFF })
            .circle(0, 0, 50);
        graphics.set('circle', { texture: renderTexture(circle) });

        // Diamond shape for pickups
        const diamond = new PIXI.Graphics()
            .fill({ color: 0xFFFFFF })
            .moveTo(0, -25)
            .lineTo(25, 0)
            .lineTo(0, 25)
            .lineTo(-25, 0)
            .closePath();
        graphics.set('diamond', { texture: renderTexture(diamond) });

        return graphics;
    }

    startGame() {
        try {
            // Set initial area
            this.currentArea = LEVELS.find(level => level.id === 'starting_grounds');
            if (!this.currentArea) {
                throw new Error('Starting area not found');
            }
            
            // Initialize game state
            gameState.reset();
            gameState.debug = true;
            
            // Create player and add to game state
            gameState.player = this.playerSystem.createPlayer();
            
            // Add player to the entity layer
            const entityLayer = this.layerSystem.getLayer('entityLayer');
            if (!entityLayer) {
                throw new Error('Entity layer not initialized');
            }
            entityLayer.addChild(gameState.player);
            
            // Position player at area center
            const centerX = Math.min(this.currentArea.width, Math.max(0, Math.round(this.currentArea.width / 2)));
            const centerY = Math.min(this.currentArea.height, Math.max(0, Math.round(this.currentArea.height / 2)));
            gameState.player.position.set(centerX, centerY);
            
            // Initialize managers with current area configuration
            this.enemyManager.handleEnemySpawning({
                baseRate: this.currentArea.spawnRate,
                maxEnemies: this.currentArea.maxEnemies,
                typeRatios: this.currentArea.enemyRatios,
                eliteChance: this.currentArea.eliteChance,
                modifiers: this.currentArea.enemyModifiers
            });
            this.bulletManager.init();
            
            // Set up camera to follow player
            this.viewportSystem.followPlayer();
            
            // Start game loop
            this.gameLoopSystem.start();
            
            // Show gameplay UI
            this.hudSystem.setVisible(true);
            this.menuSystem.hideMenu('startMenu');
            this.debugSystem.setVisible(gameState.debug);

            if (gameState.debug) {
                console.log('Game started:', {
                    area: this.currentArea.name,
                    player: {
                        exists: !!gameState.player,
                        position: gameState.player?.position,
                        health: gameState.player?.health
                    },
                    enemies: gameState.enemies.length,
                    bullets: gameState.bullets.length,
                    spawnConfig: {
                        rate: this.currentArea.spawnRate,
                        maxEnemies: this.currentArea.maxEnemies,
                        eliteChance: this.currentArea.eliteChance
                    }
                });
            }
            
        } catch (error) {
            console.error('Error starting game:', error);
            throw error;
        }
    }

    initializeArea(area) {
        if (!area) return;

        // Clear existing area elements while preserving player
        this.layerSystem.cleanup();
        
        // Update background
        this.app.renderer.background.color = area.backgroundColor;
        
        // Create background grid
        const backgroundLayer = this.layerSystem.getLayer('backgroundLayer');
        if (backgroundLayer) {
            this.createAreaBackground(area, backgroundLayer);
        }
        
        // Setup portals
        this.portalManager.createAreaPortals(area);
        
        // Reset enemy spawning with new area configuration
        gameState.enemies = [];
        this.enemyManager.handleEnemySpawning({
            baseRate: area.spawnRate,
            maxEnemies: area.maxEnemies,
            typeRatios: area.enemyRatios,
            eliteChance: area.eliteChance,
            modifiers: area.enemyModifiers
        });
        
        // Reset bullets
        gameState.bullets = [];
        this.bulletManager.init();
        
        // Initialize player position if exists
        if (gameState.player) {
            const centerX = Math.min(area.width, Math.max(0, Math.round(area.width / 2)));
            const centerY = Math.min(area.height, Math.max(0, Math.round(area.height / 2)));
            gameState.player.position.set(centerX, centerY);
        }

        if (gameState.debug) {
            console.log('Area initialized:', {
                id: area.id,
                name: area.name,
                dimensions: { width: area.width, height: area.height },
                player: !!gameState.player,
                enemies: gameState.enemies.length,
                bullets: gameState.bullets.length,
                spawnConfig: {
                    rate: area.spawnRate,
                    maxEnemies: area.maxEnemies,
                    eliteChance: area.eliteChance
                }
            });
        }
    }

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

    handleResize() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        this.app.renderer.resize(viewportWidth, viewportHeight);
        this.viewportSystem.handleResize(viewportWidth, viewportHeight);
        this.inputManager.updateScale(viewportWidth, viewportHeight);
        this.ui.handleResize(viewportWidth, viewportHeight);
    }
}

// Initialize game
new Game();