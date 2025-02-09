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
                ...GAME_CONFIG,
                width: viewportWidth,
                height: viewportHeight,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                antialias: true,
                resizeTo: window,
                canvas: canvas,
                backgroundColor: GAME_CONFIG.backgroundColor || 0x1a1a1a,
                hello: true // Enable WebGL debug info
            });
            
            // Initialize asset loader
            await this.loadAssets();
            
            // Set up main stage
            this.app.stage.eventMode = 'passive';
            this.app.stage.sortableChildren = true;
            
            // Create game viewport - this will handle game world scrolling
            this.gameViewport = new PIXI.Container();
            this.gameViewport.sortableChildren = true;
            this.gameViewport.eventMode = 'passive';
            this.gameViewport.label = 'GameViewport';
            this.gameViewport.visible = true;
            this.gameViewport.width = this.app.screen.width;
            this.gameViewport.height = this.app.screen.height;
            
            // Create world container that holds all game entities
            this.worldContainer = new PIXI.Container();
            this.worldContainer.sortableChildren = true;
            this.worldContainer.eventMode = 'passive';
            this.worldContainer.label = 'WorldContainer';
            this.worldContainer.visible = true;
            
            // Create separate layers for different types of entities
            this.backgroundLayer = new PIXI.Container();
            this.backgroundLayer.sortableChildren = true;
            this.backgroundLayer.zIndex = 0;
            this.backgroundLayer.label = 'BackgroundLayer';
            this.backgroundLayer.visible = true;
            
            this.entityLayer = new PIXI.Container();
            this.entityLayer.sortableChildren = true;
            this.entityLayer.zIndex = 10;
            this.entityLayer.label = 'EntityLayer';
            
            this.bulletLayer = new PIXI.Container();
            this.bulletLayer.sortableChildren = true;
            this.bulletLayer.zIndex = 20;
            this.bulletLayer.label = 'BulletLayer';
            
            this.effectsLayer = new PIXI.Container();
            this.effectsLayer.sortableChildren = true;
            this.effectsLayer.zIndex = 30;
            this.effectsLayer.label = 'EffectsLayer';
            
            // Add layers to world container
            this.worldContainer.addChild(this.backgroundLayer);
            this.worldContainer.addChild(this.entityLayer);
            this.worldContainer.addChild(this.bulletLayer);
            this.worldContainer.addChild(this.effectsLayer);
            
            // Add world container to viewport
            this.gameViewport.addChild(this.worldContainer);
            
            // Create UI container that stays fixed on screen
            this.uiContainer = new PIXI.Container();
            this.uiContainer.sortableChildren = true;
            this.uiContainer.eventMode = 'static';
            this.uiContainer.label = 'UIContainer';
            this.uiContainer.zIndex = 1000;
            
            // Add containers to stage
            this.app.stage.addChild(this.gameViewport);
            this.app.stage.addChild(this.uiContainer);
            
            // Debug log viewport and container setup
            console.log('Display hierarchy setup:', {
                viewport: {
                    width: viewportWidth,
                    height: viewportHeight,
                    devicePixelRatio: window.devicePixelRatio,
                    stage: {
                        children: this.app.stage.children.map(child => ({
                            label: child.label,
                            visible: child.visible,
                            alpha: child.alpha,
                            zIndex: child.zIndex
                        }))
                    }
                },
                gameViewport: {
                    visible: this.gameViewport.visible,
                    alpha: this.gameViewport.alpha,
                    children: this.gameViewport.children.map(child => ({
                        label: child.label,
                        visible: child.visible,
                        alpha: child.alpha,
                        zIndex: child.zIndex
                    }))
                },
                worldContainer: {
                    visible: this.worldContainer.visible,
                    alpha: this.worldContainer.alpha,
                    children: this.worldContainer.children.map(child => ({
                        label: child.label,
                        visible: child.visible,
                        alpha: child.alpha,
                        zIndex: child.zIndex
                    }))
                }
            });
            
            // Add debug logging for container setup
            console.log('Container visibility check:', {
                stage: this.app.stage.visible,
                gameViewport: this.gameViewport.visible,
                worldContainer: this.worldContainer.visible,
                backgroundLayer: this.backgroundLayer.visible,
                entityLayer: this.entityLayer?.visible,
                dimensions: {
                    screen: {
                        width: this.app.screen.width,
                        height: this.app.screen.height
                    },
                    viewport: {
                        width: this.gameViewport.width,
                        height: this.gameViewport.height
                    }
                }
            });
            
            // Initialize managers with proper layer references
            this.ui = new UIManager(this.app, this);
            this.ui.setContainer(this.uiContainer);
            
            this.inputManager = new InputManager(this.app, this.entityLayer);
            this.effectsManager = new EffectsManager(this.app, this.effectsLayer);
            this.collisionSystem = new CollisionSystem(this.app, this.entityLayer, this.effectsManager);
            this.collisionSystem.setGame(this);
            this.cameraManager = new CameraManager(this.app, this.gameViewport);
            this.combatSystem = new CombatSystem(this.app, this.bulletLayer);
            this.enemyManager = new EnemyManager(this.app, this.entityLayer);
            this.portalManager = new PortalManager(this.app, this.entityLayer);
            this.experienceManager = new ExperienceManager(this.app, this.entityLayer);
            
            // Setup managers that need UI
            this.upgradeManager = new UpgradeManager(this.ui);
            this.ui.setUpgradeManager(this.upgradeManager);
            this.portalManager.setUI(this.ui);
            this.experienceManager.setUI(this.ui);
            this.experienceManager.setUpgradeManager(this.upgradeManager);
            
            // Add resize handler
            window.addEventListener('resize', () => this.handleResize());
            
            // Set initial area
            this.currentArea = LEVELS.find(level => level.id === 'starting_grounds');
            if (!this.currentArea) {
                throw new Error('Starting area not found');
            }
            
            console.log('Game setup complete, showing start screen...');
            
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
        console.log('Game.init() called - starting game initialization');
        
        // Reset game state
        gameState.reset();
        
        // Clean up previous game state if exists
        if (gameState.player) {
            console.log('Cleaning up existing player');
            EntityManager.cleanup(this.app, gameState.player);
        }
        
        // Clean up all existing entities
        gameState.enemies.forEach(enemy => {
            EntityManager.cleanup(this.app, enemy);
        });
        
        gameState.bullets.forEach(bullet => {
            EntityManager.cleanup(this.app, bullet.sprite);
        });
        
        gameState.experienceGems.forEach(gem => {
            EntityManager.cleanup(this.app, gem.sprite);
        });
        
        console.log('Starting area initialization');
        // Initialize the first area
        this.initializeArea(this.currentArea);
        
        // Initialize weapons
        this.initializeWeapons();
        
        // Only start game loop and camera update if player exists
        if (gameState.player) {
            console.log('Player created successfully');
            
            // Set initial position
            const centerX = Math.floor(this.currentArea.width / 2);
            const centerY = Math.floor(this.currentArea.height / 2);
            gameState.player.position.set(centerX, centerY);
            
            // Log player position after centering
            console.log('Player position after centering:', {
                x: gameState.player.x,
                y: gameState.player.y,
                worldX: this.worldContainer.x,
                worldY: this.worldContainer.y
            });
            
            // Center camera on player with rounded values
            const targetX = Math.round(this.app.screen.width / 2 - gameState.player.x);
            const targetY = Math.round(this.app.screen.height / 2 - gameState.player.y);
            
            // Clamp world container position
            const minX = -Math.floor(this.currentArea.width - this.app.screen.width);
            const minY = -Math.floor(this.currentArea.height - this.app.screen.height);
            this.worldContainer.x = Math.round(Math.max(Math.min(targetX, 0), minX));
            this.worldContainer.y = Math.round(Math.max(Math.min(targetY, 0), minY));
            
            // Log final positions
            console.log('Final positions:', {
                player: { 
                    x: Math.round(gameState.player.x), 
                    y: Math.round(gameState.player.y) 
                },
                world: { 
                    x: Math.round(this.worldContainer.x), 
                    y: Math.round(this.worldContainer.y) 
                },
                screen: { 
                    width: Math.round(this.app.screen.width), 
                    height: Math.round(this.app.screen.height) 
                },
                area: { 
                    width: this.currentArea.width, 
                    height: this.currentArea.height 
                }
            });
            
            // Start game loop
            if (gameState.gameTicker) {
                this.app.ticker.remove(gameState.gameTicker);
            }
            gameState.gameTicker = (delta) => this.gameLoop(delta);
            this.app.ticker.add(gameState.gameTicker);
        } else {
            console.error('Failed to initialize player');
        }
    }

    handleResize() {
        // Get new viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Update world bounds
        const worldBounds = this.worldContainer.getChildByLabel('worldBounds');
        if (worldBounds) {
            worldBounds.clear();
            worldBounds
                .fill({ color: 0x000000, alpha: 0 })
                .rect(0, 0, viewportWidth, viewportHeight);
        }
        
        // Update UI bounds
        const uiBounds = this.uiContainer.getChildByLabel('uiBounds');
        if (uiBounds) {
            uiBounds.clear();
            uiBounds
                .fill({ color: 0x000000, alpha: 0 })
                .rect(0, 0, viewportWidth, viewportHeight);
        }
        
        // Update player bounds if it exists
        if (gameState.player) {
            const padding = 15;
            gameState.player.x = Math.min(Math.max(padding, gameState.player.x), this.currentArea.width - padding);
            gameState.player.y = Math.min(Math.max(padding, gameState.player.y), this.currentArea.height - padding);
            
            // Recenter camera on player
            this.worldContainer.x = this.app.screen.width / 2 - gameState.player.x;
            this.worldContainer.y = this.app.screen.height / 2 - gameState.player.y;
            
            // Clamp world container position
            const minX = -(this.currentArea.width - this.app.screen.width);
            const minY = -(this.currentArea.height - this.app.screen.height);
            this.worldContainer.x = Math.max(Math.min(this.worldContainer.x, 0), minX);
            this.worldContainer.y = Math.max(Math.min(this.worldContainer.y, 0), minY);
        }
        
        // Update UI layout
        if (this.ui) {
            this.ui.handleResize(viewportWidth, viewportHeight);
        }
        
        // Debug log new dimensions
        console.log('Resize event:', {
            viewport: { width: viewportWidth, height: viewportHeight },
            screen: { width: this.app.screen.width, height: this.app.screen.height },
            worldBounds: worldBounds ? worldBounds.getBounds() : null,
            uiBounds: uiBounds ? uiBounds.getBounds() : null,
            world: { x: this.worldContainer.x, y: this.worldContainer.y },
            player: gameState.player ? { x: gameState.player.x, y: gameState.player.y } : null
        });
    }

    gameLoop(delta) {
        if (gameState.gameOver || gameState.levelUp || gameState.paused || !gameState.player) return;

        // Add position logging counter
        this.positionLogCounter = (this.positionLogCounter || 0) + 1;
        
        // Log positions every 60 frames (approximately once per second)
        if (this.positionLogCounter % 60 === 0) {
            console.log('Position Debug:', {
                player: {
                    x: Math.round(gameState.player.x),
                    y: Math.round(gameState.player.y),
                    visible: gameState.player.visible,
                    parent: gameState.player.parent?.label || 'none'
                },
                camera: {
                    x: Math.round(this.worldContainer.x),
                    y: Math.round(this.worldContainer.y),
                    bounds: {
                        minX: -Math.round(this.currentArea.width - this.app.screen.width),
                        minY: -Math.round(this.currentArea.height - this.app.screen.height),
                        screenWidth: this.app.screen.width,
                        screenHeight: this.app.screen.height
                    }
                },
                area: {
                    width: this.currentArea.width,
                    height: this.currentArea.height
                }
            });
        }

        this.handleMovement(delta);
        this.combatSystem.handleCombat(delta);
        this.updateEntities(delta);
        this.experienceManager.updateExperienceGems(delta);
        this.handleHealthRegen(delta);
        this.collisionSystem.checkCollisions();
        this.portalManager.checkPortalCollisions(this.currentArea, (newArea) => {
            this.currentArea = newArea;
            this.initializeArea(newArea);
        });
        this.cameraManager.update();
        
        this.updateUI();
        
        // Sort stage children each frame to maintain zIndex order
        this.app.stage.sortChildren();
    }

    handleMovement(delta) {
        if (!gameState.player) return;
        
        // Get movement input with validation
        const movement = this.inputManager.getMovementDirection(delta, gameState.playerSpeed, this.ui.joystick);
        
        // Early return if no movement
        if (!movement || (movement.x === 0 && movement.y === 0)) return;
        
        // Store current position for collision resolution
        const prevX = gameState.player.x;
        const prevY = gameState.player.y;
        
        // Calculate new position
        const newX = prevX + movement.x;
        const newY = prevY + movement.y;
        
        // Apply boundary constraints
        const minX = gameState.player.radius || 15;
        const minY = gameState.player.radius || 15;
        const maxX = this.currentArea.width - (gameState.player.radius || 15);
        const maxY = this.currentArea.height - (gameState.player.radius || 15);
        
        // Update position with boundary checks
        gameState.player.x = Math.max(minX, Math.min(maxX, newX));
        gameState.player.y = Math.max(minY, Math.min(maxY, newY));
        
        // Check for collisions
        if (this.collisionSystem) {
            const collisions = this.collisionSystem.checkPlayerEnemyCollisions();
            if (collisions) {
                // If there's a collision, revert to previous position
                gameState.player.x = prevX;
                gameState.player.y = prevY;
            }
        }
        
        // Log movement debug info periodically
        if (this.positionLogCounter % 60 === 0) {
            console.log('Movement Debug:', {
                delta,
                movement: {
                    x: movement.x,
                    y: movement.y,
                    speed: gameState.playerSpeed
                },
                position: {
                    previous: { x: prevX, y: prevY },
                    current: { x: gameState.player.x, y: gameState.player.y }
                },
                boundaries: {
                    min: { x: minX, y: minY },
                    max: { x: maxX, y: maxY }
                }
            });
        }
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
        // Validate area parameters
        if (!area || !area.width || !area.height) {
            console.error('Invalid area configuration:', area);
            return;
        }

        console.log('Initializing area:', {
            id: area.id,
            dimensions: { width: area.width, height: area.height },
            backgroundColor: area.backgroundColor,
            validSetup: {
                backgroundLayer: !!this.backgroundLayer,
                entityLayer: !!this.entityLayer,
                worldContainer: !!this.worldContainer
            }
        });
        
        // Store previous player position if exists
        const previousPlayerPos = gameState.player ? {
            x: gameState.player.x,
            y: gameState.player.y
        } : null;
        
        // Clean up current area with validation
        if (this.backgroundLayer) {
            this.backgroundLayer.removeChildren();
            this.backgroundLayer.visible = true;
        }
        if (this.entityLayer) {
            // Keep player if it exists, remove other entities
            const player = this.entityLayer.children.find(child => child === gameState.player);
            this.entityLayer.removeChildren();
            if (player) {
                this.entityLayer.addChild(player);
            }
            this.entityLayer.visible = true;
        }
        if (this.bulletLayer) {
            this.bulletLayer.removeChildren();
            this.bulletLayer.visible = true;
        }
        if (this.effectsLayer) {
            this.effectsLayer.removeChildren();
            this.effectsLayer.visible = true;
        }
        
        // Reset game entities
        gameState.enemies = [];
        gameState.bullets = [];
        if (this.experienceManager) {
            this.experienceManager.cleanup();
        }
        
        // Create area background
        const background = new PIXI.Graphics();
        background
            .fill({ color: area.backgroundColor })
            .rect(0, 0, area.width, area.height);
        background.label = 'areaBackground';
        background.zIndex = 0;
        background.eventMode = 'none';
        background.visible = true;
        this.backgroundLayer.addChild(background);
        
        // Create player if doesn't exist
        if (!gameState.player) {
            console.log('Creating new player...');
            gameState.player = EntityManager.createPlayer(this.app);
            
            if (!gameState.player) {
                console.error('Failed to create player instance');
                return;
            }
            
            // Set initial position to center
            const centerX = Math.floor(area.width / 2);
            const centerY = Math.floor(area.height / 2);
            gameState.player.position.set(centerX, centerY);
        } else if (previousPlayerPos) {
            // Smoothly transition player position if coming from another area
            const targetX = Math.floor(area.width / 2);
            const targetY = Math.floor(area.height / 2);
            
            // Interpolate between previous position and target
            const lerpFactor = 0.3; // Adjust for smoother/faster transition
            gameState.player.x = previousPlayerPos.x + (targetX - previousPlayerPos.x) * lerpFactor;
            gameState.player.y = previousPlayerPos.y + (targetY - previousPlayerPos.y) * lerpFactor;
        }
        
        // Ensure player is properly set up
        if (gameState.player) {
            gameState.player.zIndex = 10;
            gameState.player.visible = true;
            
            // Remove from previous parent if exists
            if (gameState.player.parent) {
                gameState.player.parent.removeChild(gameState.player);
            }
            
            // Add to entity layer
            this.entityLayer.addChild(gameState.player);
            
            // Center viewport on player with smooth transition
            const targetX = -gameState.player.x + this.app.screen.width / 2;
            const targetY = -gameState.player.y + this.app.screen.height / 2;
            
            // Clamp viewport position
            const minX = -area.width + this.app.screen.width;
            const minY = -area.height + this.app.screen.height;
            
            const currentX = this.worldContainer.x;
            const currentY = this.worldContainer.y;
            
            // Smoothly interpolate world container position
            const lerpFactor = 0.3;
            this.worldContainer.x = currentX + (Math.max(Math.min(targetX, 0), minX) - currentX) * lerpFactor;
            this.worldContainer.y = currentY + (Math.max(Math.min(targetY, 0), minY) - currentY) * lerpFactor;
            
            console.log('Player and camera positioned:', {
                player: {
                    position: { x: gameState.player.x, y: gameState.player.y },
                    visible: gameState.player.visible,
                    parent: gameState.player.parent?.label
                },
                camera: {
                    position: { x: this.worldContainer.x, y: this.worldContainer.y },
                    bounds: { minX, minY, maxX: 0, maxY: 0 }
                }
            });
        }
        
        // Create portals
        this.portalManager.createAreaPortals(area);
        
        // Show area info
        this.ui.showLevelInfo(area.name, area.description);
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