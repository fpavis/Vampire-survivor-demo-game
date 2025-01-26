import { GAME_CONFIG, ENEMY_TYPES, INITIAL_STATE, LEVEL_SCALING, STYLES, WORLD_CONFIG, SPAWN_CONFIG, COLLISION_CONFIG, LEVELS } from './config.js';
import { gameState } from './gameState.js';
import { EntityManager } from './entities.js';
import { UIManager } from './ui.js';
import { Weapon } from './weapons.js';
import { InputManager } from './InputManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { EffectsManager } from './EffectsManager.js';
import { CameraManager } from './CameraManager.js';
import { CombatSystem } from './CombatSystem.js';
import { EnemyManager } from './EnemyManager.js';
import { PortalManager } from './PortalManager.js';
import { UpgradeManager } from './UpgradeManager.js';
import { ExperienceManager } from './ExperienceManager.js';

class Game {
    constructor() {
        try {
            this.app = new PIXI.Application(GAME_CONFIG);
            document.body.appendChild(this.app.view);
            
            // Create main container for the game world
            this.worldContainer = new PIXI.Container();
            this.app.stage.addChild(this.worldContainer);
            
            // Initialize managers
            this.inputManager = new InputManager(this.app, this.worldContainer);
            this.effectsManager = new EffectsManager(this.app, this.worldContainer);
            this.collisionSystem = new CollisionSystem(this.app, this.worldContainer, this.effectsManager);
            this.collisionSystem.setGame(this);
            this.cameraManager = new CameraManager(this.app, this.worldContainer);
            this.combatSystem = new CombatSystem(this.app, this.worldContainer);
            this.enemyManager = new EnemyManager(this.app, this.worldContainer);
            this.portalManager = new PortalManager(this.app, this.worldContainer);
            this.experienceManager = new ExperienceManager(this.app, this.worldContainer);
            
            // Add resize handler
            window.addEventListener('resize', () => this.handleResize());
            
            this.showStartScreen();
            this.currentArea = LEVELS.find(level => level.id === 'starting_grounds');
        } catch (error) {
            console.error('Game initialization error:', error);
        }
    }

    handleResize() {
        if (gameState.player) {
            gameState.player.x = Math.min(Math.max(15, gameState.player.x), this.app.screen.width - 15);
            gameState.player.y = Math.min(Math.max(15, gameState.player.y), this.app.screen.height - 15);
        }
        this.updateGrid();
    }

    init() {
        // Clean up previous game state
        if (gameState.player) {
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
        
        gameState.reset();
        
        // Initialize the first area
        this.initializeArea(this.currentArea);
        
        // Center camera on player initially
        this.cameraManager.update();
        
        // Start game loop
        if (gameState.gameTicker) {
            this.app.ticker.remove(gameState.gameTicker);
        }
        gameState.gameTicker = (delta) => this.gameLoop(delta);
        this.app.ticker.add(gameState.gameTicker);

        // Initialize weapons
        this.initializeWeapons();
    }

    gameLoop(delta) {
        if (gameState.gameOver || gameState.levelUp || gameState.paused) return;

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
    }

    handleMovement(delta) {
        const movement = this.inputManager.getMovementDirection(delta, gameState.playerSpeed, this.ui.joystick);
        
        gameState.player.x += movement.x;
        gameState.player.y += movement.y;

        gameState.player.x = Math.max(15, Math.min(WORLD_CONFIG.width - 15, gameState.player.x));
        gameState.player.y = Math.max(15, Math.min(WORLD_CONFIG.height - 15, gameState.player.y));
    }

    updateEntities(delta) {
        this.enemyManager.handleEnemySpawning(delta, this.currentArea);
        this.enemyManager.updateEnemies(delta);
        this.combatSystem.updateProjectiles(delta);
    }

    initializeArea(area) {
        // Clean up previous area
        this.worldContainer.removeChildren();
        gameState.enemies = [];
        gameState.bullets = [];
        this.experienceManager.cleanup();
        
        // Create background for the area
        const background = new PIXI.Graphics();
        background.beginFill(area.backgroundColor);
        background.drawRect(0, 0, area.width, area.height);
        background.endFill();
        background.name = 'background';
        this.worldContainer.addChild(background);
        
        // Add grid
        this.updateGrid(true);
        
        // Position player if this is a new game
        if (!gameState.player) {
            gameState.player = EntityManager.createPlayer(this.app);
            gameState.player.x = area.width / 2;
            gameState.player.y = area.height / 2;
            this.worldContainer.addChild(gameState.player);
        }
        
        // Initialize UI if needed
        if (!this.ui) {
            this.ui = new UIManager(this.app, this);
            this.upgradeManager = new UpgradeManager(this.ui);
            this.ui.setUpgradeManager(this.upgradeManager);
            this.portalManager.setUI(this.ui);
            this.experienceManager.setUI(this.ui);
            this.experienceManager.setUpgradeManager(this.upgradeManager);
        }
        
        // Create portals to connected areas
        this.portalManager.createAreaPortals(area);
        
        // Show area name and description
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

    updateGrid(forceRedraw = false) {
        const gridSize = 100;
        const existingGrid = this.worldContainer.getChildByName('grid');
        
        if (existingGrid && !forceRedraw) {
            return;
        }
        
        if (existingGrid) {
            this.worldContainer.removeChild(existingGrid);
        }
        
        const grid = new PIXI.Graphics();
        grid.name = 'grid';
        grid.lineStyle(1, 0x333333, 0.3);
        
        for (let x = 0; x <= this.currentArea.width; x += gridSize) {
            grid.moveTo(x, 0);
            grid.lineTo(x, this.currentArea.height);
        }
        
        for (let y = 0; y <= this.currentArea.height; y += gridSize) {
            grid.moveTo(0, y);
            grid.lineTo(this.currentArea.width, y);
        }
        
        // Add grid at index 1 if container has children, otherwise just add it
        if (this.worldContainer.children.length > 0) {
            this.worldContainer.addChildAt(grid, 1);
        } else {
            this.worldContainer.addChild(grid);
        }
    }

    showStartScreen() {
        const startScreen = new PIXI.Container();
        
        const background = new PIXI.Graphics();
        background.beginFill(0x000000, 0.7);
        background.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        background.endFill();
        startScreen.addChild(background);
        
        const title = new PIXI.Text('Vampire Survivor Demo', {
            fontFamily: 'Arial',
            fontSize: 48,
            fill: 0xffffff,
            align: 'center'
        });
        title.x = this.app.screen.width / 2 - title.width / 2;
        title.y = this.app.screen.height / 3;
        startScreen.addChild(title);
        
        const startButton = new PIXI.Graphics();
        startButton.beginFill(0x00ff00);
        startButton.drawRect(0, 0, 200, 50);
        startButton.endFill();
        startButton.x = this.app.screen.width / 2 - 100;
        startButton.y = this.app.screen.height / 2;
        startButton.interactive = true;
        startButton.buttonMode = true;
        startScreen.addChild(startButton);
        
        const buttonText = new PIXI.Text('Start Game', {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0x000000,
            align: 'center'
        });
        buttonText.x = startButton.x + 100 - buttonText.width / 2;
        buttonText.y = startButton.y + 25 - buttonText.height / 2;
        startScreen.addChild(buttonText);
        
        startButton.on('pointerdown', () => {
            this.app.stage.removeChild(startScreen);
            this.init();
        });
        
        this.app.stage.addChild(startScreen);
    }
}

// Initialize game with error handling
try {
    const game = new Game();
} catch (error) {
    console.error('Failed to start game:', error);
}