/**
 * @file Game.js
 * @description Main game class that initializes and coordinates all game systems.
 * This is the central hub that manages game state, updates, and system interactions.
 * 
 * @module core/Game
 * @requires PIXI.js
 * @requires all manager modules
 * @requires core/config
 * @requires core/gameState
 * 
 * Key Features:
 * - Initializes game systems and managers
 * - Manages game loop and updates
 * - Handles area transitions and initialization
 * - Controls game state and progression
 * - Manages window resizing and responsiveness
 * - Coordinates all game subsystems
 * 
 * Usage:
 * ```js
 * // Initialize game
 * const game = new Game();
 * 
 * // Start new game
 * game.init();
 * 
 * // Handle area transition
 * game.initializeArea(newArea);
 * ```
 * 
 * Modification Guidelines:
 * - Add new game systems by extending the constructor
 * - Modify game loop behavior in gameLoop method
 * - Add new initialization steps in init method
 * - Implement new area features in initializeArea
 * - Add new game states and transitions
 * 
 * System Architecture:
 * - Managers: Handle specific game systems (combat, enemies, UI, etc.)
 * - Game Loop: Coordinates updates of all systems
 * - State Management: Tracks and updates game state
 * - Area Management: Handles level transitions and setup
 * 
 * @class
 */

// Import PixiJS and Viewport
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

// Game configuration and managers
import { GAME_CONFIG, ENEMY_TYPES, LEVEL_SCALING, STYLES, WORLD_CONFIG, SPAWN_CONFIG, COLLISION_CONFIG, LEVELS } from './config.js';
import { gameState } from './gameState.js';
import { EntityManager } from '../entities/Entity.js';
import { UIManager } from '../managers/UIManager.js';
import { Weapon } from '../weapons/Weapon.js';
import { InputManager } from '../managers/InputManager.js';
import { CollisionSystem } from '../managers/CollisionSystem.js';
import { EffectsManager } from '../managers/EffectsManager.js';
import { CameraManager } from '../managers/CameraManager.js';
import { CombatSystem } from '../managers/CombatSystem.js';
import { EnemyManager } from '../managers/EnemyManager.js';
import { PortalManager } from '../managers/PortalManager.js';
import { UpgradeManager } from '../managers/UpgradeManager.js';
import { ExperienceManager } from '../managers/ExperienceManager.js';
import { BulletManager } from '../managers/BulletManager.js';

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
            
            // Initialize Pixi application with v8 syntax
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
            
            // Initialize asset loader first
            await this.loadAssets();
            
            // Set up main stage with v8 syntax
            this.app.stage.eventMode = 'passive';
            this.app.stage.sortableChildren = true;
            
            // Configure tickers
            this.systemTicker = PIXI.Ticker.system;
            this.gameTicker = PIXI.Ticker.shared;
            this.gameTicker.maxFPS = 60;
            this.gameTicker.minFPS = 30;
            
            // Initialize camera system first and wait for it
            this.cameraManager = new CameraManager(this.app);
            
            // Wait for camera initialization
            await new Promise(resolve => {
                if (this.cameraManager.mainContainer && this.cameraManager.worldContainer) {
                    resolve();
                } else {
                    requestAnimationFrame(resolve);
                }
            });
            
            // Validate camera containers
            if (!this.cameraManager?.mainContainer || !this.cameraManager?.worldContainer) {
                throw new Error('Camera containers not properly initialized');
            }
            
            // Create and validate game layers
            await this.createGameLayers();
            
            // Validate all required containers and layers before manager initialization
            const requiredContainers = {
                mainContainer: this.cameraManager.mainContainer,
                worldContainer: this.cameraManager.worldContainer,
                entityLayer: this.entityLayer,
                bulletLayer: this.bulletLayer,
                effectsLayer: this.effectsLayer,
                portalLayer: this.portalLayer,
                uiContainer: this.uiContainer
            };
            
            for (const [name, container] of Object.entries(requiredContainers)) {
                if (!container) {
                    throw new Error(`${name} not initialized`);
                }
                if (!container.parent && name !== 'mainContainer') {
                    throw new Error(`${name} not properly added to scene graph`);
                }
            }
            
            // Initialize managers with validated containers
            this.initializeManagers();
            
            // Set initial area
            this.currentArea = LEVELS.find(level => level.id === 'starting_grounds');
            if (!this.currentArea) {
                throw new Error('Starting area not found');
            }
            
            // Show start screen
            this.ui.showStartScreen(() => {
                console.log('Start screen callback triggered');
                this.init();
            });
            
        } catch (error) {
            console.error('Game initialization error:', error);
            throw error;
        }
    }

    async createGameLayers() {
        // Create layer containers with proper PixiJS v8 settings
        const createLayer = (name, zIndex, eventMode = 'none') => {
            // Create base container with initial properties
            const layer = new PIXI.Container();
            
            // Set properties after creation
            layer.label = name;
            layer.sortableChildren = true;
            layer.eventMode = eventMode;
            layer.visible = true;
            layer.zIndex = zIndex;
            
            // Initialize transform properties explicitly
            layer.position.set(0, 0);
            layer.scale.set(1, 1);
            layer.pivot.set(0, 0);
            layer.angle = 0;
            
            return layer;
        };

        // Validate and initialize world container transform
        if (!this.cameraManager?.worldContainer) {
            throw new Error('World container not available for layer initialization');
        }

        // Initialize world container transform if needed
        if (!this.cameraManager.worldContainer.position) {
            this.cameraManager.worldContainer.position.set(0, 0);
            this.cameraManager.worldContainer.scale.set(1, 1);
            this.cameraManager.worldContainer.pivot.set(0, 0);
            this.cameraManager.worldContainer.angle = 0;
        }

        // Create all game layers
        const layers = {
            backgroundLayer: createLayer('BackgroundLayer', 0),
            entityLayer: createLayer('EntityLayer', 10, 'passive'),
            bulletLayer: createLayer('BulletLayer', 20),
            portalLayer: createLayer('PortalLayer', 15),
            effectsLayer: createLayer('EffectsLayer', 30)
        };

        // Add layers to world container and initialize them
        for (const [name, layer] of Object.entries(layers)) {
            // Add to world container first
            this.cameraManager.worldContainer.addChild(layer);
            
            // Store reference in game instance
            this[name] = layer;
        }

        // Create and initialize UI container
        this.uiContainer = createLayer('UILayer', 100, 'passive');
        this.app.stage.addChild(this.uiContainer);

        // Wait for next frame to ensure DOM updates
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Final validation of all layers including UI
        const allLayers = [...Object.values(layers), this.uiContainer];
        for (const layer of allLayers) {
            if (!layer.parent) {
                throw new Error(`Layer ${layer.label} not properly added to scene graph`);
            }
        }

        // Log successful initialization if in debug mode
        if (gameState.debug) {
            console.log('Layer initialization complete:', {
                backgroundLayer: !!this.backgroundLayer,
                entityLayer: !!this.entityLayer,
                bulletLayer: !!this.bulletLayer,
                portalLayer: !!this.portalLayer,
                effectsLayer: !!this.effectsLayer,
                uiContainer: !!this.uiContainer
            });
        }
    }

    initializeManagers() {
        // Validate required containers first
        if (!this.cameraManager?.mainContainer) {
            throw new Error('Main container not initialized');
        }
        
        if (!this.cameraManager?.worldContainer) {
            throw new Error('World container not initialized');
        }
        
        if (!this.cameraManager?.viewport) {
            throw new Error('Viewport not initialized');
        }

        const worldContainer = this.cameraManager.worldContainer;
        const viewport = this.cameraManager.viewport;
        
        if (gameState.debug) {
            console.log('Initializing managers with:', {
                viewport: {
                    found: !!viewport,
                    scale: viewport?.scale?.x,
                    position: { x: viewport?.x, y: viewport?.y }
                },
                worldContainer: {
                    found: !!worldContainer,
                    children: worldContainer?.children?.length
                }
            });
        }
        
        // Validate game layers
        const requiredLayers = {
            entityLayer: this.entityLayer,
            bulletLayer: this.bulletLayer,
            effectsLayer: this.effectsLayer,
            portalLayer: this.portalLayer,
            uiContainer: this.uiContainer
        };
        
        // Validate layers exist and are properly parented
        for (const [name, layer] of Object.entries(requiredLayers)) {
            if (!layer) {
                throw new Error(`${name} not initialized`);
            }
            if (!layer.parent && name !== 'mainContainer') {
                throw new Error(`${name} not properly added to scene graph`);
            }
        }
        
        // Initialize managers with validated containers
        try {
            // Input manager needs main container for event handling
            this.inputManager = new InputManager(
                this.app,
                this.cameraManager.mainContainer
            );
            
            // Enemy manager needs world container and entity layer
            this.enemyManager = new EnemyManager(
                this.app,
                viewport,
                worldContainer,
                this.entityLayer
            );
            
            // Bullet manager needs world container and bullet layer
            this.bulletManager = new BulletManager(
                this.app,
                viewport,
                worldContainer,
                this.bulletLayer
            );
            
            // Effects manager needs world container and effects layer
            this.effectsManager = new EffectsManager(
                this.app,
                viewport,
                worldContainer,
                this.effectsLayer
            );
            
            // Portal manager needs world container and portal layer
            this.portalManager = new PortalManager(
                this.app,
                viewport,
                worldContainer,
                this.portalLayer
            );
            
            // Combat system needs world container and layers
            this.combatSystem = new CombatSystem(
                this.app,
                viewport,
                worldContainer,
                this.bulletLayer,
                this.entityLayer
            );
            
            // Collision system needs world container and effects manager
            this.collisionSystem = new CollisionSystem(
                this.app,
                viewport,
                worldContainer,
                this.effectsManager
            );
            
            // Experience manager needs world container
            this.experienceManager = new ExperienceManager(
                this.app,
                viewport,
                worldContainer
            );
            
            // Upgrade manager only needs app reference
            this.upgradeManager = new UpgradeManager(this.app);
            
            // Initialize UI last so it has access to all managers
            this.ui = new UIManager(this.app, this);
            this.ui.setContainer(this.uiContainer);
            
            // Log successful initialization
            if (gameState.debug) {
                console.log('Managers initialized:', {
                    input: !!this.inputManager,
                    enemy: !!this.enemyManager,
                    bullet: !!this.bulletManager,
                    effects: !!this.effectsManager,
                    portal: !!this.portalManager,
                    combat: !!this.combatSystem,
                    collision: !!this.collisionSystem,
                    experience: !!this.experienceManager,
                    upgrade: !!this.upgradeManager,
                    ui: !!this.ui
                });
            }
            
        } catch (error) {
            console.error('Failed to initialize managers:', error);
            throw error;
        }
    }

    async loadAssets() {
        console.log('Loading game assets...');
        
        try {
            // Define default colors in case config values are undefined
            const defaultColors = {
                player: 0x00ff88,
                enemy: 0xFF0000,
                rangedEnemy: 0x00FF00,
                bullet: 0xffdd00,
                portal: 0x00ffff
            };

            // Get colors from config with fallbacks
            const colors = {
                player: STYLES.colors?.player || defaultColors.player,
                enemy: ENEMY_TYPES.BASIC?.color || defaultColors.enemy,
                rangedEnemy: ENEMY_TYPES.FAST?.color || defaultColors.rangedEnemy,
                bullet: STYLES.colors?.bullet || defaultColors.bullet,
                portal: defaultColors.portal
            };

            console.log('Creating textures with colors:', colors);

            // Create textures for each asset type using v8's approach
            const assetManifest = {};

            for (const [name, color] of Object.entries({
                player: colors.player,
                playerGlow: colors.player,
                basicEnemy: colors.enemy,
                rangedEnemy: colors.rangedEnemy,
                eliteGlow: 0xFFD700,
                bullet: colors.bullet,
                bulletGlow: colors.bullet,
                portal: colors.portal,
                portalGlow: colors.portal,
                healEffect: 0x00FF00
            })) {
                const isGlow = name.includes('Glow');
                const radius = this.getRadiusForAsset(name);
                const canvas = isGlow ? 
                    this.createGlowTexture(radius, color) : 
                    this.createCircleTexture(radius, color);
                
                // Validate canvas before converting to data URL
                if (!canvas || !canvas.width || !canvas.height) {
                    console.error(`Invalid canvas for ${name}:`, canvas);
                    continue;
                }
                
                // Convert canvas to base64 data URL
                const dataUrl = canvas.toDataURL('image/png');
                
                // Add to asset manifest with validation metadata
                assetManifest[name] = {
                    src: dataUrl,
                    data: { 
                        type: isGlow ? 'glow' : 'circle',
                        width: canvas.width,
                        height: canvas.height,
                        color: color
                    }
                };
            }

            // Initialize assets with proper manifest structure
            await PIXI.Assets.init({
                manifest: {
                    bundles: [{
                        name: 'game-textures',
                        assets: assetManifest
                    }]
                }
            });

            // Load the bundle and validate textures
            try {
                const textures = await PIXI.Assets.loadBundle('game-textures');
                
                // Validate loaded textures
                const validatedTextures = {};
                for (const [name, texture] of Object.entries(textures)) {
                    if (texture && texture.valid !== false && texture.width > 0 && texture.height > 0) {
                        validatedTextures[name] = texture;
                    } else {
                        console.error(`Invalid texture loaded for ${name}:`, texture);
                    }
                }
                
                console.log('Loaded and validated textures:', Object.keys(validatedTextures));
                return validatedTextures;
            } catch (error) {
                console.error('Failed to load textures:', error);
                throw error;
            }
        } catch (error) {
            console.error('Asset loading error:', error);
            throw error;
        }
    }

    getRadiusForAsset(name) {
        const radiusMap = {
            player: 20,
            playerGlow: 25,
            basicEnemy: 20,
            rangedEnemy: 20,
            eliteGlow: 25,
            bullet: 5,
            bulletGlow: 8,
            portal: 40,
            portalGlow: 45,
            healEffect: 30
        };
        return radiusMap[name] || 20;
    }

    createCircleTexture(radius, color) {
        const canvas = document.createElement('canvas');
        const size = radius * 2;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, size, size);

        // Draw filled circle
        ctx.beginPath();
        ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.fill();

        // Draw border
        ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 1;
        ctx.stroke();

        return canvas;
    }

    createGlowTexture(radius, color) {
        const canvas = document.createElement('canvas');
        const size = radius * 2;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, size, size);

        // Create radial gradient with multiple stops for better glow effect
        const gradient = ctx.createRadialGradient(
            radius, radius, 0,           // Inner circle
            radius, radius, radius       // Outer circle
        );

        const colorHex = `#${color.toString(16).padStart(6, '0')}`;
        gradient.addColorStop(0, colorHex + 'FF');    // 100% opacity at center
        gradient.addColorStop(0.3, colorHex + 'B3');  // 70% opacity
        gradient.addColorStop(0.6, colorHex + '66');  // 40% opacity
        gradient.addColorStop(0.8, colorHex + '33');  // 20% opacity
        gradient.addColorStop(1, colorHex + '00');    // 0% opacity at edge

        // Draw gradient circle
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        return canvas;
    }

    init() {
        if (gameState.debug) console.log('Game.init() called - starting game initialization');
        
        // Reset game state
        gameState.reset();
        
        // Clean up previous game state
        this.cleanup();
        
        // Initialize the first area
        this.initializeArea(this.currentArea);
        
        // Initialize weapons
        this.initializeWeapons();
        
        // Set up game loop
        if (gameState.player) {
            // Remove existing ticker if any
            if (gameState.gameTicker) {
                this.gameTicker.remove(gameState.gameTicker);
            }
            
            // Create new game loop ticker
            gameState.gameTicker = (delta) => this.gameLoop(delta);
            
            // Add to shared ticker for visual updates
            this.gameTicker.add(gameState.gameTicker, PIXI.UPDATE_PRIORITY.NORMAL);
            
            // Add critical systems to system ticker
            this.systemTicker.add(this.updateCriticalSystems, this, PIXI.UPDATE_PRIORITY.HIGH);
            
            // Start tickers if not already running
            if (!this.gameTicker.started) this.gameTicker.start();
            if (!this.systemTicker.started) this.systemTicker.start();
        }
    }

    cleanup() {
        // Remove tickers
        if (gameState.gameTicker) {
            this.gameTicker.remove(gameState.gameTicker);
        }
        this.systemTicker.remove(this.updateCriticalSystems, this);
        
        // Clean up entities
        if (gameState.player) {
            EntityManager.cleanup(this.app, gameState.player);
        }
        
        gameState.enemies.forEach(enemy => {
            EntityManager.cleanup(this.app, enemy);
        });
        
        gameState.bullets.forEach(bullet => {
            EntityManager.cleanup(this.app, bullet.sprite);
        });
        
        gameState.experienceGems.forEach(gem => {
            EntityManager.cleanup(this.app, gem.sprite);
        });
    }

    updateCriticalSystems = (delta) => {
        if (gameState.gameOver || gameState.paused) return;
        
        // Update collision system
        this.collisionSystem.checkCollisions();
        
        // Update camera position
        this.cameraManager.update(delta);
    }

    handleResize() {
        // Get new viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Update application dimensions
        this.app.renderer.resize(viewportWidth, viewportHeight);
        
        // Update camera and viewport
        this.cameraManager.handleResize(viewportWidth, viewportHeight);
        
        // Update input manager scale
        this.inputManager.updateScale(viewportWidth, viewportHeight);
        
        // Update UI layout
        if (this.ui) {
            this.ui.handleResize(viewportWidth, viewportHeight);
        }
    }

    gameLoop(delta) {
        if (gameState.gameOver || gameState.levelUp || gameState.paused || !gameState.player) return;

        // Handle gameplay updates
        this.handleMovement(delta);
        this.combatSystem.handleCombat(delta);
        this.updateEntities(delta);
        this.experienceManager.updateExperienceGems(delta);
        this.handleHealthRegen(delta);
        
        // Check for area transitions
        this.portalManager.checkPortalCollisions(this.currentArea, (newArea) => {
            this.currentArea = newArea;
            this.initializeArea(newArea);
        });
        
        // Update UI and sort display list
        this.updateUI();
        this.app.stage.sortChildren();
    }

    handleMovement(delta) {
        if (!gameState.player) return;
        
        // Get movement input
        const movement = this.inputManager.getMovementDirection(delta, gameState.playerSpeed, this.ui.joystick);
        
        // Early return if no movement
        if (!movement || (movement.x === 0 && movement.y === 0)) return;
        
        // Calculate new player position
        const currentPos = gameState.player.getWorldPosition();
        const newX = currentPos.x + movement.x;
        const newY = currentPos.y + movement.y;
        
        // Check world boundaries
        const boundedX = Math.max(0, Math.min(newX, this.currentArea.width));
        const boundedY = Math.max(0, Math.min(newY, this.currentArea.height));
        
        // Store current position for collision resolution
        const prevX = gameState.player.x;
        const prevY = gameState.player.y;
        
        // Update player position
        gameState.player.setWorldPosition(boundedX, boundedY);
        
        // Check for collisions
        if (this.collisionSystem.checkPlayerEnemyCollisions()) {
            // If there's a collision, revert position
            gameState.player.setWorldPosition(prevX, prevY);
            return;
        }
        
        // Update camera to follow player
        this.cameraManager.update(delta);
    }

    updateEntities(delta) {
        // Convert delta to a number if it's a ticker
        const deltaTime = typeof delta === 'number' ? delta : delta.deltaTime;
        
        // Handle enemy spawning and updates
        this.enemyManager.handleEnemySpawning(deltaTime, this.currentArea);
        this.enemyManager.updateEnemies(deltaTime);
        this.combatSystem.updateProjectiles(deltaTime);
        
        // Log entity state periodically for debugging
        if (gameState.debug && Math.random() < 0.01) {
            console.log('Entity state:', {
                enemies: gameState.enemies.length,
                bullets: gameState.bullets.length,
                delta: deltaTime,
                currentArea: this.currentArea.id
            });
        }
    }

    initializeArea(area) {
        if (!area || !area.width || !area.height) {
            console.error('Invalid area configuration:', area);
            return;
        }

        // Clean up existing entities
        this.cleanupArea();
        
        // Create area background
        const background = new PIXI.Graphics()
            .fill({ color: area.backgroundColor })
            .rect(0, 0, area.width, area.height);
        background.label = 'areaBackground';
        background.zIndex = 0;
        background.eventMode = 'none';
        this.backgroundLayer.addChild(background);
        
        // Set camera bounds
        this.cameraManager.setBounds(area.width, area.height);
        
        // Create or update player
        this.initializePlayer(area);
        
        // Create portals
        this.portalManager.createAreaPortals(area);
        
        // Show area info
        this.ui.showLevelInfo(area.name, area.description);
    }

    initializePlayer(area) {
        if (!gameState.player) {
            gameState.player = EntityManager.createPlayer(this.app);
            if (!gameState.player) {
                console.error('Failed to create player instance');
                return;
            }
        }
        
        // Ensure player is properly set up
        if (gameState.player) {
            // Set proper rendering properties
            gameState.player.zIndex = 10;
            gameState.player.visible = true;
            gameState.player.eventMode = 'static';
            
            // Position player at area center
            const centerX = Math.round(area.width / 2);
            const centerY = Math.round(area.height / 2);
            
            // Add player to entity layer if needed
            if (gameState.player.parent !== this.entityLayer) {
                if (gameState.player.parent) {
                    gameState.player.parent.removeChild(gameState.player);
                }
                this.entityLayer.addChild(gameState.player);
            }
            
            // Set player position in world coordinates
            gameState.player.setWorldPosition(centerX, centerY);
            
            // Center camera on player
            this.cameraManager.followPlayer();
        }
    }

    cleanupArea() {
        // Keep player if it exists
        const player = gameState.player;
        
        // Clean up layers
        [this.backgroundLayer, this.entityLayer, this.bulletLayer, 
         this.portalLayer, this.effectsLayer].forEach(layer => {
            if (layer) {
                layer.removeChildren();
                if (player && layer === this.entityLayer) {
                    layer.addChild(player);
                }
            }
        });
        
        // Reset game entities
        gameState.enemies = [];
        gameState.bullets = [];
        this.experienceManager?.cleanup();
    }

    initializeWeapons() {
        gameState.player.weapons = {
            1: new Weapon('PISTOL'),
            2: new Weapon('SHOTGUN'),
            3: new Weapon('LASER'),
            4: new Weapon('MACHINEGUN')
        };
        gameState.player.activeWeapon = 1;

        this.inputManager.handleWeaponSwitch((weaponKey) => {
            gameState.player.activeWeapon = weaponKey;
            const weapon = gameState.player.weapons[gameState.player.activeWeapon];
            this.ui.updateWeaponInfo(weapon.name);
        });
    }

    updateUI() {
        this.ui.updateHealth(gameState.health, gameState.maxHealth);
        this.ui.updateScore(gameState.score);
        this.ui.updateLevel(gameState.level);
        this.ui.updateExperience(gameState.experience, gameState.nextLevel);
        this.ui.updateDebugPanel(gameState);
    }

    handleHealthRegen(delta) {
        if (gameState.healthRegen > 0 && gameState.health < gameState.maxHealth) {
            gameState.health = Math.min(
                gameState.maxHealth,
                gameState.health + gameState.healthRegen * delta
            );
            this.ui.updateHealth(gameState.health, gameState.maxHealth);
        }
    }

    updateGrid(forceUpdate = false) {
        // Remove existing grid if it exists
        const existingGrid = this.worldContainer.children.find(child => child.label === 'grid');
        if (existingGrid) {
            this.worldContainer.removeChild(existingGrid);
        }

        // Create new grid
        const grid = new PIXI.Graphics();
        grid.label = 'grid';
        
        // Set stroke style once for all lines
        grid.stroke({
            width: 1,
            color: 0x333333,
            alpha: 0.3
        });
        
        // Draw vertical lines
        for (let x = 0; x <= this.currentArea.width; x += WORLD_CONFIG.gridSize) {
            grid
                .moveTo(x, 0)
                .lineTo(x, this.currentArea.height);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.currentArea.height; y += WORLD_CONFIG.gridSize) {
            grid
                .moveTo(0, y)
                .lineTo(this.currentArea.width, y);
        }
        
        grid.zIndex = 1;
        grid.visible = true;
        this.worldContainer.addChild(grid);
    }
}

// Initialize game
new Game();