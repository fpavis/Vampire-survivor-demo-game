import { GAME_CONFIG, ENEMY_TYPES, INITIAL_STATE, LEVEL_SCALING, STYLES, WORLD_CONFIG, SPAWN_CONFIG } from './config.js';
import { gameState } from './gameState.js';
import { EntityManager } from './entities.js';
import { UIManager } from './ui.js';

class Game {
    constructor() {
        this.app = null;
        this.worldContainer = null;
        this.damageFlashOverlay = null;
        this.currentFlashAnimation = null;
        this.ui = null;
        // gameState.reset(); // gameState is a global singleton, reset in its own class or in Game.init()
    }

    async initialize() {
        try {
            this.app = new PIXI.Application();
            await this.app.init(GAME_CONFIG);
            document.body.appendChild(this.app.canvas);
            
            this.worldContainer = new PIXI.Container();
            this.app.stage.addChild(this.worldContainer);

            this.damageFlashOverlay = new PIXI.Graphics();
            this.damageFlashOverlay.visible = false;
            this.app.stage.addChild(this.damageFlashOverlay);
            this.currentFlashAnimation = null;
            
            window.addEventListener('resize', () => this.handleResize());
            
            // UIManager (this.ui) will be initialized in the main init() method, 
            // called after the start screen, as it depends on a fully initialized app.
            
            this.showStartScreen(); // This method uses this.app, which is now initialized.
        } catch (error) {
            console.error('Game initialization error during async initialize:', error);
            throw error; 
        }
    }

    handleResize() {
        // Update game elements positions if needed
        if (gameState.player) {
            // Keep player in bounds after resize
            gameState.player.x = Math.min(Math.max(15, gameState.player.x), this.app.screen.width - 15);
            gameState.player.y = Math.min(Math.max(15, gameState.player.y), this.app.screen.height - 15);
        }

        // Adjust grid if it exists
        this.updateGrid();
    }

    updateGrid(worldSized = false) {
        const oldGrid = this.worldContainer.children.find(child => child.name === 'grid');
        if (oldGrid) {
            this.worldContainer.removeChild(oldGrid);
            oldGrid.destroy(); // Added this line
        }

        const grid = new PIXI.Graphics();
        grid.name = 'grid';
        
        const width = worldSized ? WORLD_CONFIG.width : this.app.screen.width;
        const height = worldSized ? WORLD_CONFIG.height : this.app.screen.height;

        // --- New: Set line style on context ---
        grid.lineStyle(1, 0x333333, 0.3); 
        // ---
        
        // Vertical lines
        for (let i = 0; i < width; i += 50) {
            grid.moveTo(i, 0);
            grid.lineTo(i, height);
        }
        // Horizontal lines
        for (let i = 0; i < height; i += 50) {
            grid.moveTo(0, i);
            grid.lineTo(width, i);
        }

        let hasPathData = false;
        if (grid.context && grid.context.buildCmds && Array.isArray(grid.context.buildCmds) && grid.context.buildCmds.length > 0) {
            hasPathData = true;
        }
        // The console.warn related to the fallback (else if block) has been removed.

        // Debugging logs
        console.log('Updating grid. worldSized:', worldSized, 'Calculated Width:', width, 'Calculated Height:', height);
        console.log('Grid object instance before stroke decision:', grid);
        console.log('--- Grid Object Details (console.dir) ---');
        console.dir(grid);
        console.log('-----------------------------------------');

        if (grid.context) {
            console.log('Grid context exists. Path data (if available):', grid.context.path);
            console.log('Grid context build commands/instructions (if available):', grid.context.buildCmds || grid.context.instructions);
            try {
                console.log('Stringified grid.context.path (first level):', JSON.stringify(grid.context.path, (key, value) => {
                    if (value instanceof PIXI.Matrix) return '[PIXI.Matrix]';
                    if (value instanceof PIXI.Point) return `[PIXI.Point x:${value.x} y:${value.y}]`;
                    if (value instanceof PIXI.GraphicsPath && key !== '') return '[PIXI.GraphicsPath]';
                    if (typeof value === 'number' && !isFinite(value)) return String(value);
                    if (value instanceof PIXI.Polygon) return '[PIXI.Polygon with ' + value.points.length + ' points]';
                    return value;
                }, 2));
            } catch (e) {
                console.warn('Could not stringify grid.context.path:', e.message);
            }
        } else {
            console.warn('Grid context (grid.context) is undefined before stroke decision.');
        }
        console.log('Path data check: hasPathData =', hasPathData);
        
        if (hasPathData) {
            console.log('About to call grid.stroke()');
            // --- Modified stroke call ---
            grid.stroke(); // Use context's style, no arguments
            // ---
            console.log('grid.stroke() call completed.');
            this.worldContainer.addChildAt(grid, 1);
        } else {
            console.log('Skipping grid.stroke() and addChildAt() because no path data was generated (e.g., dimensions too small).');
            grid.destroy(); // Clean up the unused Graphics object
        }
    }

    showStartScreen() {
        // Create a container for start screen elements
        const startScreen = new PIXI.Container();
        startScreen.eventMode = 'static';
        this.app.stage.addChild(startScreen);

        // Dark background
        const background = new PIXI.Graphics();
        background.rect(0, 0, this.app.screen.width, this.app.screen.height);
        background.fill({ color: 0x000000, alpha: 0.85 });
        startScreen.addChild(background);

        // Game title
        const titleText = new PIXI.Text({
            text: 'Survival Game',
            style: {
                fontSize: 64,
                fill: 0xffffff,
                align: 'center',
                fontWeight: 'bold'
            }
        });
        titleText.anchor.set(0.5);
        titleText.position.set(this.app.screen.width / 2, this.app.screen.height / 3);
        startScreen.addChild(titleText);

        // Instructions text
        const instructionsText = new PIXI.Text({
            text: 'Use WASD or arrow keys to move\nMouse/touch to move on mobile\nEnemies drop experience gems\nLevel up to become stronger',
            style: {
                fontSize: 24,
                fill: 0xcccccc,
                align: 'center'
            }
        });
        instructionsText.anchor.set(0.5);
        instructionsText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
        startScreen.addChild(instructionsText);

        // Start button container
        const buttonContainer = new PIXI.Container();
        buttonContainer.eventMode = 'static';
        buttonContainer.cursor = 'pointer';
        buttonContainer.position.set(this.app.screen.width / 2, this.app.screen.height * 0.7);

        // Button background
        const button = new PIXI.Graphics();
        button.roundRect(-100, -30, 200, 60, 15);
        button.fill(0x00ff00);

        // Button text
        const buttonText = new PIXI.Text({
            text: 'Start Game',
            style: {
                fontSize: 32,
                fill: 0x000000,
                fontWeight: 'bold'
            }
        });
        buttonText.anchor.set(0.5);

        // Add text to button
        buttonContainer.addChild(button, buttonText);
        startScreen.addChild(buttonContainer);

        // Button interactions
        buttonContainer.on('pointerover', () => {
            button.tint = 0x88ff88;
        });
        
        buttonContainer.on('pointerout', () => {
            button.tint = 0xffffff; // Reset tint
        });

        buttonContainer.on('pointerdown', () => {
            // Remove start screen
            this.app.stage.removeChild(startScreen);
            startScreen.destroy({ children: true }); // Clean up start screen resources
            
            // Clean up any existing game state
            if (this.worldContainer) {
                this.worldContainer.removeChildren();
            }
            
            // Initialize new game
            this.bindEvents();
            this.init();
        });

        // Handle window resize
        const resizeHandler = () => {
            // Update background
            background.clear();
            background.rect(0, 0, this.app.screen.width, this.app.screen.height);
            background.fill({ color: 0x000000, alpha: 0.85 });

            // Update text positions
            titleText.position.set(this.app.screen.width / 2, this.app.screen.height / 3);
            instructionsText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
            buttonContainer.position.set(this.app.screen.width / 2, this.app.screen.height * 0.7);
        };

        window.addEventListener('resize', resizeHandler);

        // Clean up resize handler when start screen is removed
        startScreen.on('destroyed', () => {
            window.removeEventListener('resize', resizeHandler);
        });
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => gameState.keys[e.key] = true);
        window.addEventListener('keyup', (e) => gameState.keys[e.key] = false);

        // Add pointer events for mouse/touch control
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;

        // Handle both mouse and touch
        this.app.stage.on('pointermove', (e) => {
            gameState.pointerPosition = { x: e.globalX, y: e.globalY }; // Changed e.global.x/y
        });

        this.app.stage.on('pointerdown', (e) => {
            gameState.pointerPosition = { x: e.globalX, y: e.globalY }; // Changed e.global.x/y
            gameState.pointerDown = true;
        });

        this.app.stage.on('pointerup', () => {
            gameState.pointerDown = false;
        });

        // Handle pointer leaving the game area
        this.app.stage.on('pointerleave', () => {
            gameState.pointerDown = false;
        });
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
        this.worldContainer.removeChildren();
        
        // Create background that fills world
        const background = new PIXI.Graphics();
        background.rect(0, 0, WORLD_CONFIG.width, WORLD_CONFIG.height);
        background.fill(STYLES.colors.background);
        background.name = 'background';
        
        this.worldContainer.addChild(background);
        this.updateGrid(true);  // true for world-sized grid
        
        // Initialize player in center of world
        gameState.player = EntityManager.createPlayer(this.app); // Assuming createPlayer is updated
        gameState.player.x = WORLD_CONFIG.width / 2;
        gameState.player.y = WORLD_CONFIG.height / 2;
        this.worldContainer.addChild(gameState.player);
        
        // Initialize UI only once here
        if (!this.ui) {
            this.ui = new UIManager(this.app); // Assuming UIManager is updated
        }
        this.ui.updateKillCounter(gameState.kills); // Initialize kill counter display
        
        // Center camera on player initially
        this.updateCamera();
        
        // Start game loop
        if (gameState.gameTicker) {
            this.app.ticker.remove(gameState.gameTicker);
        }
        gameState.gameTicker = (ticker) => this.gameLoop(ticker.deltaTime); // Pass ticker.deltaTime
        this.app.ticker.add(gameState.gameTicker);
    }

    gameLoop(delta) { // delta is now passed from ticker
        if (gameState.gameOver || gameState.levelUp || gameState.paused) return;

        this.handleMovement(delta);
        this.handleCombat(delta);
        this.updateEntities(delta);
        this.handleEnemyCollisions(delta); // Call new enemy collision handler
        this.updateExperienceGems(delta);
        this.handleHealthRegen(delta);
        this.checkCollisions();
        
        // Update all UI elements
        this.ui.updateHealth(gameState.health, gameState.maxHealth);
        this.ui.updateScore(gameState.score);
        this.ui.updateLevel(gameState.level);
        this.ui.updateExperience(gameState.experience, gameState.nextLevel);
        this.ui.updateKillCounter(gameState.kills); // Update kill counter display
        this.ui.updateDebugPanel(gameState);
    }

    handleMovement(delta) {
        const speed = gameState.playerSpeed * delta;
        const { keys, player } = gameState;

        // Handle keyboard movement
        let dx = 0;
        let dy = 0;

        // Arrow keys and WASD
        if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
        if (keys.ArrowRight || keys.d || keys.D) dx += 1;
        if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
        if (keys.ArrowDown || keys.s || keys.S) dy += 1;

        // Handle joystick input if available
        if (this.ui.joystick && this.ui.joystick.active) {
            // Joystick takes complete priority when active
            dx = this.ui.joystick.position.x;
            dy = this.ui.joystick.position.y;
        }
        // Only handle pointer/mouse if joystick is not active and not on mobile
        else if (gameState.pointerDown && gameState.pointerPosition && (!this.ui.joystick || !this.ui.joystick.visible)) {
            const pointer = gameState.pointerPosition;
            // Convert pointer position to world coordinates
            const worldX = pointer.x - this.worldContainer.x; // pointer.x is already globalX
            const worldY = pointer.y - this.worldContainer.y; // pointer.y is already globalY
            
            // Calculate direction to pointer
            const dirX = worldX - player.x;
            const dirY = worldY - player.y;
            const distance = Math.sqrt(dirX * dirX + dirY * dirY);

            // Only move if there's a significant distance to travel
            if (distance > 5) {
                dx = dirX / distance;
                dy = dirY / distance;
            } else { // Stop if close enough
                dx = 0;
                dy = 0;
            }
        }

        // Apply movement if there's any input
        if (dx !== 0 || dy !== 0) {
            // For joystick, we don't need to normalize as it's already normalized
            // For keyboard, normalize diagonal movement
            if (!this.ui.joystick || !this.ui.joystick.active) {
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length > 0) { // Avoid division by zero
                    dx = dx / length;
                    dy = dy / length;
                }
            }

            player.x += dx * speed;
            player.y += dy * speed;
        }

        // Keep player in world bounds
        player.x = Math.max(15, Math.min(WORLD_CONFIG.width - 15, player.x));
        player.y = Math.max(15, Math.min(WORLD_CONFIG.height - 15, player.y));

        // Update camera position
        this.updateCamera();
    }

    handleCombat(delta) {
        if (Date.now() - gameState.lastFire > gameState.fireRate && gameState.enemies.length > 0) {
            const closestEnemy = this.findClosestEnemy();
        if (!closestEnemy) return;

            const bullet = EntityManager.createBullet( // Assuming createBullet is updated
                gameState.player.x,
                gameState.player.y,
                closestEnemy.x,
                closestEnemy.y
            );

            // Add bullet to worldContainer instead of app.stage
            this.worldContainer.addChild(bullet.sprite);
            gameState.bullets.push(bullet);
            gameState.lastFire = Date.now();
        }
    }

    findClosestEnemy() {
    let closest = null;
    let minDistance = Infinity;

        gameState.enemies.forEach(enemy => {
            const dx = enemy.x - gameState.player.x;
            const dy = enemy.y - gameState.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
            minDistance = distance;
            closest = enemy;
        }
    });

    return closest;
}

    updateEntities(delta) {
        // Handle enemy spawning
        this.handleEnemySpawning(delta);

        // Update existing enemies
        gameState.enemies.forEach(enemy => {
            // Calculate direction to player
            const dx = gameState.player.x - enemy.x;
            const dy = gameState.player.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Move enemy towards player
            if (dist > 0) {
                const normalizedDx = dx / dist;
                const normalizedDy = dy / dist;
                enemy.x += normalizedDx * enemy.speed * delta;
                enemy.y += normalizedDy * enemy.speed * delta;
            }

            // Update health bar
            const healthPercent = enemy.health / enemy.maxHealth;
            // Assuming enemy.healthBar is a PIXI.Graphics object
            enemy.healthBar.clear(); // Clear previous drawing
            enemy.healthBar.roundRect(0, 0, ENEMY_TYPES[enemy.type].size * 2, 5, 2);
            enemy.healthBar.fill(STYLES.colors.healthBar.background); // Background
            enemy.healthBar.roundRect(0, 0, healthPercent * (ENEMY_TYPES[enemy.type].size * 2), 5, 2);
            enemy.healthBar.fill(healthPercent < 0.3 ? STYLES.colors.healthBar.damage : STYLES.colors.healthBar.health); // Foreground
        });

        // Update bullets
        for (let i = gameState.bullets.length - 1; i >= 0; i--) {
            const bullet = gameState.bullets[i];
            bullet.sprite.x += bullet.dx * delta;
            bullet.sprite.y += bullet.dy * delta;

            if (this.isOffScreen(bullet.sprite)) {
                EntityManager.cleanup(this.app, bullet.sprite);
                gameState.bullets.splice(i, 1);
            }
        }
    }

    handleEnemySpawning(delta) {
        // Check max enemies before spawning
        if (gameState.enemies.length >= SPAWN_CONFIG.maxEnemies) return;

        // Calculate spawn chance based on level
        const spawnChance = SPAWN_CONFIG.baseRate * Math.pow(LEVEL_SCALING.enemySpawnRateScale, gameState.level - 1);
        
        if (Math.random() < spawnChance * delta) {
            // Determine enemy type based on ratios
            const roll = Math.random();
            let type = 'BASIC';
            let cumulative = 0;
            
            for (const [enemyType, ratio] of Object.entries(SPAWN_CONFIG.typeRatios)) {
                cumulative += ratio;
                if (roll <= cumulative) {
                    type = enemyType;
                    break;
                }
            }
            
            const spawnPos = this.createEnemy();
            const enemy = EntityManager.createEnemy(this.app, type, spawnPos.x, spawnPos.y); // Assuming createEnemy is updated
            
            // Scale enemy stats with level
            const levelScale = gameState.level - 1;
            enemy.health *= Math.pow(LEVEL_SCALING.enemyHealthScale, levelScale);
            enemy.maxHealth = enemy.health;
            enemy.speed *= Math.pow(LEVEL_SCALING.enemySpeedScale, levelScale);
            enemy.experienceValue = Math.floor(ENEMY_TYPES[type].experience * Math.pow(LEVEL_SCALING.experienceMultiplierPerLevel, levelScale));
            
            // Check for elite enemy
            if (Math.random() < SPAWN_CONFIG.eliteChance) {
                enemy.tint = 0xFFD700; // Gold tint
                enemy.health *= SPAWN_CONFIG.eliteModifiers.health;
                enemy.maxHealth = enemy.health;
                enemy.experienceValue *= SPAWN_CONFIG.eliteModifiers.experience;
                enemy.speed *= SPAWN_CONFIG.eliteModifiers.speed;
            }
            
            this.worldContainer.addChild(enemy);
            gameState.enemies.push(enemy);
        }
    }

    isOffScreen(sprite) {
        // Check if the sprite is too far from the player
        const dx = sprite.x - gameState.player.x;
        const dy = sprite.y - gameState.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return dist > 1000; // Remove bullets when they're far from the player
    }

    checkCollisions() {
        // Bullet-enemy collisions with proper cleanup
        for (let bIndex = gameState.bullets.length - 1; bIndex >= 0; bIndex--) {
            const bullet = gameState.bullets[bIndex];
            if (!bullet || !bullet.sprite) continue; // Bullet might have been cleaned up
            
            for (let eIndex = gameState.enemies.length - 1; eIndex >= 0; eIndex--) {
                const enemy = gameState.enemies[eIndex];
                if (!bullet || !bullet.sprite || bullet.sprite.destroyed || !enemy || enemy.destroyed) {
                    continue; 
                }

                const dx = bullet.sprite.x - enemy.x;
                const dy = bullet.sprite.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const collisionDist = ENEMY_TYPES[enemy.type].size + 5; // 5 is bullet radius approximation

                if (dist < collisionDist) {
                    this.createHitEffect(bullet.sprite.x, bullet.sprite.y);
                    enemy.health -= gameState.attackDamage;
                    
                    EntityManager.cleanup(this.app, bullet.sprite);
                    gameState.bullets.splice(bIndex, 1);

                    if (enemy.health <= 0) {
                        this.createDeathEffect(enemy.x, enemy.y);
                        EntityManager.cleanup(this.app, enemy);
                        gameState.enemies.splice(eIndex, 1);
                        gameState.score += ENEMY_TYPES[enemy.type].experience * 2;
                        gameState.kills++; // Increment kills
                        this.ui.updateScore(gameState.score);
                        this.ui.updateKillCounter(gameState.kills); // Update UI

                        const gem = EntityManager.createExperienceGem(this.app, enemy.x, enemy.y, enemy.experienceValue);
                        gameState.experienceGems.push(gem);
                        this.worldContainer.addChild(gem.sprite);
                    }
                    break; // Bullet can only hit one enemy
                }
            }
        }

        // Player-enemy collisions
        gameState.enemies.forEach(enemy => {
            if (!enemy || enemy.destroyed || !gameState.player || gameState.player.destroyed) {
                return; 
            }
            const dx = gameState.player.x - enemy.x;
            const dy = gameState.player.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const playerRadius = 15; // Approximate player radius
            const enemyRadius = ENEMY_TYPES[enemy.type].size;
            const collisionThreshold = (playerRadius + enemyRadius) * 0.8; // 80% of sum of radii

            if (dist < collisionThreshold) { 
                gameState.health -= 0.5; // Player takes damage
                this.triggerDamageFlash(); 
                this.ui.updateHealth(gameState.health, gameState.maxHealth);

                const overlap = collisionThreshold - dist;
                const pushForce = overlap * 0.5; // How much to push in total, apply half to each or full to one

                if (dist > 0) { // Avoid division by zero
                    const pushBackDx = (enemy.x - gameState.player.x) / dist;
                    const pushBackDy = (enemy.y - gameState.player.y) / dist;
                    
                    // Push enemy away
                    enemy.x += pushBackDx * pushForce;
                    enemy.y += pushBackDy * pushForce;

                    // Push player away (player's boundary check in handleMovement will correct if needed)
                    gameState.player.x -= pushBackDx * pushForce;
                    gameState.player.y -= pushBackDy * pushForce;
                }


                if (gameState.health <= 0 && !gameState.gameOver) {
                    gameState.health = 0;
                    this.ui.updateHealth(0, gameState.maxHealth);
                    this.showGameOver();
                }
            }
        });
    }

    updateExperienceGems(delta) {
        if (gameState.pendingExperience === undefined) {
            gameState.pendingExperience = 0;
        }

        if (gameState.pendingExperience > 0) {
            const expToAdd = Math.max(1, Math.floor(gameState.pendingExperience * 0.1));
            gameState.experience += expToAdd;
            gameState.pendingExperience -= expToAdd;
            this.ui.updateExperience(gameState.experience, gameState.nextLevel);

            if (gameState.experience >= gameState.nextLevel && !gameState.levelUp) {
                this.showLevelUp();
                return; 
            }
        }

        for (let i = gameState.experienceGems.length - 1; i >= 0; i--) {
            const gem = gameState.experienceGems[i];
            if (!gem || !gem.sprite || !gameState.player) continue;
            
            const dx = gameState.player.x - gem.sprite.x;
            const dy = gameState.player.y - gem.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const magnetSpeed = 4; // Speed of magnet effect

            if (dist < 100) { // Magnet radius
                gem.sprite.x += (dx / dist) * magnetSpeed * delta;
                gem.sprite.y += (dy / dist) * magnetSpeed * delta;
            }

            if (dist < 20) { // Collection radius
                gameState.pendingExperience += gem.value;
                EntityManager.cleanup(this.app, gem.sprite);
                // this.app.stage.removeChild(gem.sprite); // Already removed by cleanup if it was added to app.stage
                this.worldContainer.removeChild(gem.sprite); // Ensure removal from worldContainer
                gameState.experienceGems.splice(i, 1);
            }
        }
    }

    handleHealthRegen(delta) {
        if (gameState.healthRegen > 0 && gameState.health < gameState.maxHealth) {
            gameState.health = Math.min(
                gameState.health + (gameState.healthRegen / 60) * delta, // Assuming 60 FPS for regen rate
                gameState.maxHealth
            );
            this.ui.updateHealth(gameState.health, gameState.maxHealth);
        }
    }

    showGameOver() {
        gameState.gameOver = true;
        if (gameState.gameTicker) {
            this.app.ticker.remove(gameState.gameTicker);
        }
        
        if (gameState.player) {
            EntityManager.cleanup(this.app, gameState.player);
        }
        gameState.experienceGems.forEach(gem => {
            if (gem && gem.sprite) EntityManager.cleanup(this.app, gem.sprite);
        });

        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.fill({ color: 0x000000, alpha: 0 }); // Start transparent
        this.app.stage.addChild(overlay);

        let alpha = 0;
        const fadeInTicker = PIXI.Ticker.shared.add(() => {
            alpha += 0.05 * PIXI.Ticker.shared.deltaTime; // Use ticker delta for smooth animation
            overlay.clear();
            overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
            overlay.fill({color: 0x000000, alpha: Math.min(0.8, alpha)});
            if (alpha >= 0.8) {
                PIXI.Ticker.shared.remove(fadeInTicker);
            }
        });
        
        const gameOverTextStyle = new PIXI.TextStyle({
            fontSize: 64,
            fill: ['#FF0000', '#880000'], // Gradient fill
            fontWeight: 'bold',
            stroke: { color: '#000000', width: 6 },
            dropShadow: {
                color: '#000000',
                blur: 10,
                distance: 5,
                alpha: 0.7
            }
        });
        const gameOverText = new PIXI.Text({ text: 'GAME OVER', style: gameOverTextStyle });
        gameOverText.anchor.set(0.5);
        gameOverText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);

        const statsContainer = new PIXI.Container();
        statsContainer.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

        const statsBg = new PIXI.Graphics();
        statsBg.roundRect(-150, -60, 300, 120, 10);
        statsBg.fill({ color: 0x000000, alpha: 0.5 });
        statsBg.stroke({ width: 2, color: 0x444444 });
        statsContainer.addChild(statsBg);

        const statsStyle = new PIXI.TextStyle({
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center'
        });
        const finalScoreText = new PIXI.Text({ text: `Score: ${gameState.score}`, style: statsStyle });
        finalScoreText.anchor.set(0.5);
        finalScoreText.position.set(0, -30);
        const levelText = new PIXI.Text({ text: `Level Reached: ${gameState.level}`, style: statsStyle });
        levelText.anchor.set(0.5);
        levelText.position.set(0, 10);
        statsContainer.addChild(finalScoreText, levelText);

        const button = new PIXI.Container();
        button.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + 100);
        const buttonBg = new PIXI.Graphics();
        buttonBg.roundRect(-100, -25, 200, 50, 15);
        buttonBg.fill(0x00AA00);
        buttonBg.stroke({ width: 3, color: 0x00FF00 });
        
        const buttonTextStyle = new PIXI.TextStyle({
            fontSize: 28,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            dropShadow: {
                color: '#000000',
                distance: 2,
                alpha: 0.5
            }
        });
        const buttonText = new PIXI.Text({ text: 'Play Again', style: buttonTextStyle });
        buttonText.anchor.set(0.5);
        button.addChild(buttonBg, buttonText);
        button.eventMode = 'static';
        button.cursor = 'pointer';

        button.on('pointerover', () => { buttonBg.tint = 0xAAFFAA; button.scale.set(1.05); });
        button.on('pointerout', () => { buttonBg.tint = 0xFFFFFF; button.scale.set(1); });
        button.on('pointerdown', () => {
            this.app.stage.removeChild(overlay, gameOverText, statsContainer, button);
            overlay.destroy(); gameOverText.destroy(); statsContainer.destroy({children:true}); button.destroy({children:true});
            this.init();
        });

        const pulseTicker = PIXI.Ticker.shared.add(() => {
            gameOverText.scale.x = 1 + Math.sin(Date.now() / 300) * 0.1;
            gameOverText.scale.y = gameOverText.scale.x;
        });
        gameOverText.on('destroyed', () => PIXI.Ticker.shared.remove(pulseTicker));


        this.app.stage.addChild(overlay, gameOverText, statsContainer, button);
    }

    showLevelUp() {
        gameState.levelUp = true;

        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.fill({ color: 0x000000, alpha: 0 });
        this.app.stage.addChild(overlay);

        let alpha = 0;
        const fadeInTicker = PIXI.Ticker.shared.add(() => {
            alpha += 0.05 * PIXI.Ticker.shared.deltaTime;
            overlay.clear();
            overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
            overlay.fill({color: 0x000000, alpha: Math.min(0.7, alpha)});
            if (alpha >= 0.7) PIXI.Ticker.shared.remove(fadeInTicker);
        });

        const levelUpTextStyle = new PIXI.TextStyle({
            fontSize: 48,
            fill: ['#FFD700', '#FFA500'],
            fontWeight: 'bold',
            stroke: { color: '#000000', width: 4 },
            dropShadow: {
                color: '#000000',
                blur: 10,
                distance: 5,
                alpha: 0.7
            }
        });
        const levelUpText = new PIXI.Text({ text: 'LEVEL UP!', style: levelUpTextStyle });
        levelUpText.anchor.set(0.5);
        levelUpText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 120);
        
        const pulseTicker = PIXI.Ticker.shared.add(() => {
            levelUpText.scale.x = 1 + Math.sin(Date.now() / 200) * 0.1;
            levelUpText.scale.y = levelUpText.scale.x;
        });
        levelUpText.on('destroyed', () => PIXI.Ticker.shared.remove(pulseTicker));


        const upgrades = this.getRandomUpgrades();
        let selectedIndex = 0;
        const optionContainers = [];

        upgrades.forEach((upgrade, index) => {
            const container = new PIXI.Container();
            const bg = new PIXI.Graphics();
            const text = new PIXI.Text({ 
                text: upgrade.text, 
                style: { fontSize: 20, fill: 0xFFFFFF, align: 'center' }
            });
            text.anchor.set(0.5);
            container.addChild(bg, text);
            container.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + index * 80);
            container.eventMode = 'static';
            container.cursor = 'pointer';
            container.on('pointerover', () => { selectedIndex = index; updateSelection(); });
            container.on('pointerdown', () => {
                upgrades[index].action();
                cleanup();
                this.levelUpComplete();
            });
            optionContainers.push(container);
            this.app.stage.addChild(container);
        });
        
        const instructionTextStyle = new PIXI.TextStyle({
            fontSize: 16, fill: 0xCCCCCC, align: 'center'
        });
        const instructionText = new PIXI.Text({
            text: 'Use ↑↓ or touch/click to select\nSPACE or tap/click to confirm',
            style: instructionTextStyle
        });
        instructionText.anchor.set(0.5);
        instructionText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + (upgrades.length * 80) + 40);

        const updateSelection = () => {
            optionContainers.forEach((container, index) => {
                const bg = container.getChildAt(0); // Assuming bg is the first child
                const text = container.getChildAt(1); // Assuming text is the second child
                bg.clear();
                if (index === selectedIndex) {
                    bg.roundRect(-150, -30, 300, 60, 10);
                    bg.fill({ color: 0x666666, alpha: 0.9 });
                    bg.stroke({ width: 2, color: 0xFFD700 });
                    text.style.fill = 0xFFD700;
                    container.filters = null; // Remove blur
                    container.scale.set(1.1);
                } else {
                    bg.roundRect(-150, -30, 300, 60, 10);
                    bg.fill({ color: 0x333333, alpha: 0.8 });
                    bg.stroke({ width: 2, color: 0x666666 });
                    text.style.fill = 0xFFFFFF;
                    container.filters = [new PIXI.BlurFilter({ strength: 1 })]; // BlurFilter takes options object
                    container.scale.set(1);
                }
            });
        };
        
        const cleanup = () => {
            window.removeEventListener('keydown', handleKeyPress);
            PIXI.Ticker.shared.remove(fadeInTicker); // Ensure fadein ticker is removed
            PIXI.Ticker.shared.remove(pulseTicker); // Ensure pulse ticker is removed
            this.app.stage.removeChild(overlay, levelUpText, instructionText);
            optionContainers.forEach(container => this.app.stage.removeChild(container));
            overlay.destroy(); levelUpText.destroy(); instructionText.destroy();
            optionContainers.forEach(container => container.destroy({children:true}));
        };

        const handleKeyPress = (e) => {
            switch(e.key) {
                case 'ArrowUp': selectedIndex = (selectedIndex - 1 + upgrades.length) % upgrades.length; updateSelection(); break;
                case 'ArrowDown': selectedIndex = (selectedIndex + 1) % upgrades.length; updateSelection(); break;
                case ' ': upgrades[selectedIndex].action(); cleanup(); this.levelUpComplete(); break;
            }
        };

        this.app.stage.addChild(levelUpText, instructionText);
        updateSelection();
        window.addEventListener('keydown', handleKeyPress);
    }

    levelUpComplete() {
        gameState.level++;
        gameState.experience = 0;
        gameState.nextLevel = Math.floor(gameState.nextLevel * LEVEL_SCALING.experienceMultiplier);
        gameState.levelUp = false;
        
        this.ui.updateLevel(gameState.level);
        this.ui.updateExperience(gameState.experience, gameState.nextLevel);
        this.ui.updateHealth(gameState.health, gameState.maxHealth);
        this.ui.updateDebugPanel(gameState);
    }

    updateCamera() {
        const targetX = -gameState.player.x + this.app.screen.width / 2;
        const targetY = -gameState.player.y + this.app.screen.height / 2;
        
        const minX = Math.min(0, -WORLD_CONFIG.width + this.app.screen.width); // Ensure minX is 0 or negative
        const minY = Math.min(0, -WORLD_CONFIG.height + this.app.screen.height); // Ensure minY is 0 or negative
        
        this.worldContainer.x = Math.max(Math.min(targetX, 0), minX);
        this.worldContainer.y = Math.max(Math.min(targetY, 0), minY);
    }

    createEnemy() {
        const angle = Math.random() * Math.PI * 2;
        // Ensure player exists before trying to access its position
        const playerX = gameState.player ? gameState.player.x : WORLD_CONFIG.width / 2;
        const playerY = gameState.player ? gameState.player.y : WORLD_CONFIG.height / 2;

        const spawnX = playerX + Math.cos(angle) * SPAWN_CONFIG.spawnDistance;
        const spawnY = playerY + Math.sin(angle) * SPAWN_CONFIG.spawnDistance;
        
        const x = Math.max(50, Math.min(WORLD_CONFIG.width - 50, spawnX));
        const y = Math.max(50, Math.min(WORLD_CONFIG.height - 50, spawnY));
        
        return { x, y };
    }

    createHitEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.hit.count * 2; // More particles for better visual
        const baseSpeed = STYLES.particles.hit.speed;
        const baseLifetime = STYLES.particles.hit.lifetime; // frames, will convert to seconds

        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            const size = Math.random() * 2 + 1; // Vary size: 1 to 3
            const shapeType = Math.random();

            if (shapeType < 0.6) { // 60% chance for circle
                particle.shapeType = 'circle';
                particle.shapeSize = size;
                particle.circle(0, 0, size);
            } else { // 40% chance for square
                particle.shapeType = 'rect';
                particle.shapeSize = size; // Assuming square particles, so width and height are 'size'
                particle.rect(-size / 2, -size / 2, size, size);
            }
            
            // Dynamic color: Start bright yellow, fade to orange
            particle.initialColor = { r: 255, g: 255, b: 0 }; // Yellow
            particle.targetColor = { r: 255, g: 165, b: 0 }; // Orange
            particle.fill(PIXI.Color.shared.setValue([particle.initialColor.r/255, particle.initialColor.g/255, particle.initialColor.b/255]).toNumber());
            
            const angle = Math.random() * Math.PI * 2; // Random direction for more spread
            const speed = baseSpeed * (0.7 + Math.random() * 0.6); // Vary speed: 70% to 130% of base
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.alpha = 0.9 + Math.random() * 0.1; // Start with high alpha
            particle.initialAlpha = particle.alpha;
            
            // Lifespan in seconds, varied
            particle.lifetime = (baseLifetime / 60) * (0.8 + Math.random() * 0.4); // Convert frame-based lifetime to seconds and vary
            particle.age = 0; // Age in seconds
            
            this.worldContainer.addChild(particle);
            particles.push(particle);
        }
        
        const animate = (ticker) => {
            const deltaSeconds = ticker.deltaMS / 1000; // Correct delta in seconds

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.age += deltaSeconds;

                if (p.age >= p.lifetime) {
                    this.worldContainer.removeChild(p);
                    p.destroy();
                    particles.splice(i, 1);
                    continue;
                }

                p.x += p.vx * deltaSeconds * 60; // Keep similar speed scaling as before if speeds were per-frame
                p.y += p.vy * deltaSeconds * 60;
                
                const lifeRatio = p.age / p.lifetime;
                p.alpha = p.initialAlpha * (1 - lifeRatio);

                // Interpolate color
                const r = p.initialColor.r + (p.targetColor.r - p.initialColor.r) * lifeRatio;
                const g = p.initialColor.g + (p.targetColor.g - p.initialColor.g) * lifeRatio;
                const b = p.initialColor.b + (p.targetColor.b - p.initialColor.b) * lifeRatio;
                p.clear(); // Clear previous fill
                if (p.shapeType === 'circle') {
                     p.circle(0, 0, p.shapeSize);
                } else if (p.shapeType === 'rect') {
                     // Assuming square particles where width and height are p.shapeSize
                     p.rect(-p.shapeSize / 2, -p.shapeSize / 2, p.shapeSize, p.shapeSize);
                }
                p.fill(PIXI.Color.shared.setValue([r/255, g/255, b/255]).toNumber());
            }
            
            if (particles.length === 0) {
                PIXI.Ticker.shared.remove(animate);
            }
        };
        PIXI.Ticker.shared.add(animate);
    }

    createDeathEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.death.count * 3; // Increased particle count
        const baseSpeed = STYLES.particles.death.speed;
        const baseLifetime = STYLES.particles.death.lifetime; // frames, will convert to seconds

        // Central Flash
        const flash = new PIXI.Graphics();
        flash.circle(0, 0, 30); // Larger flash radius
        flash.fill({color: 0xFFFFFF, alpha: 0.9});
        flash.x = x;
        flash.y = y;
        this.worldContainer.addChild(flash);

        let flashAge = 0;
        const flashLifetime = 0.1; // seconds
        const flashTicker = (ticker) => {
            const deltaSeconds = ticker.deltaMS / 1000;
            flashAge += deltaSeconds;
            if (flashAge >= flashLifetime) {
                this.worldContainer.removeChild(flash);
                flash.destroy();
                PIXI.Ticker.shared.remove(flashTicker);
            } else {
                const lifeRatio = flashAge / flashLifetime;
                flash.scale.set(1 + lifeRatio * 2); // Expands
                flash.alpha = 0.9 * (1 - lifeRatio); // Fades
            }
        };
        PIXI.Ticker.shared.add(flashTicker);


        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            const size = Math.random() * 4 + 2; // Vary size: 2 to 6
            const shapeType = Math.random();
            const colorPalette = [0xFF0000, 0xFF4500, 0xFFA500, 0xFFFF00]; // Reds, Oranges, Yellows
            const chosenColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];

            if (shapeType < 0.5) { // 50% Circles
                particle.circle(0, 0, size);
            } else if (shapeType < 0.8) { // 30% Triangles
                particle.poly([
                    0, -size,
                    -size * 0.866, size * 0.5,
                    size * 0.866, size * 0.5
                ]);
            } else { // 20% Lines
                particle.rect(-size/2, -1, size, 2); // Short lines
            }
            particle.fill(chosenColor);
            
            const angle = Math.random() * Math.PI * 2;
            // Greater variation in speed and direction
            const speed = baseSpeed * (0.5 + Math.random() * 1.0); // 50% to 150% of base
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.alpha = 0.8 + Math.random() * 0.2;
            particle.initialAlpha = particle.alpha;
            // Lingering or faster particles
            particle.lifetime = (baseLifetime / 60) * (0.6 + Math.random() * 0.8); 
            particle.age = 0;
            particle.rotation = Math.random() * Math.PI * 2; // Random initial rotation for shapes
            
            this.worldContainer.addChild(particle);
            particles.push(particle);
        }
        
        const animate = (ticker) => {
            const deltaSeconds = ticker.deltaMS / 1000;
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.age += deltaSeconds;

                if (p.age >= p.lifetime) {
                    this.worldContainer.removeChild(p);
                    p.destroy();
                    particles.splice(i, 1);
                    continue;
                }

                p.x += p.vx * deltaSeconds * 60;
                p.y += p.vy * deltaSeconds * 60;
                p.rotation += p.vx * 0.001 * deltaSeconds * 60; // Slow rotation based on horizontal velocity
                p.alpha = p.initialAlpha * (1 - (p.age / p.lifetime));
            }
            
            if (particles.length === 0) {
                PIXI.Ticker.shared.remove(animate);
            }
        };
        PIXI.Ticker.shared.add(animate);
    }

    handleEnemyCollisions(delta) {
        const enemies = gameState.enemies;
        for (let i = 0; i < enemies.length; i++) {
            const enemy1 = enemies[i];
            const enemy1Data = ENEMY_TYPES[enemy1.type];

            for (let j = i + 1; j < enemies.length; j++) {
                const enemy2 = enemies[j];
                const enemy2Data = ENEMY_TYPES[enemy2.type];

                const dx = enemy1.x - enemy2.x;
                const dy = enemy1.y - enemy2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Use a slightly smaller collision distance for packing, or adjust based on visual size
                const collisionDist = (enemy1Data.size + enemy2Data.size) * 0.7; // 70% of sum of radii for closer packing

                if (dist < collisionDist && dist > 0) { // dist > 0 to avoid issues if perfectly overlapped
                    const overlap = (collisionDist - dist); 
                    const pushMagnitude = overlap / 2; // Each enemy pushed by half the overlap

                    const pushX = (dx / dist) * pushMagnitude;
                    const pushY = (dy / dist) * pushMagnitude;

                    enemy1.x += pushX;
                    enemy1.y += pushY;
                    enemy2.x -= pushX;
                    enemy2.y -= pushY;

                    // Optional: Add slight damping to enemy movement if they are being pushed
                    // This can prevent them from "jittering" too much when clumped.
                    // For example, slightly reduce their speed or apply a counter-force.
                    // enemy1.vx *= 0.95; enemy1.vy *= 0.95;
                    // enemy2.vx *= 0.95; enemy2.vy *= 0.95;
                    // This would require enemies to have vx/vy properties managed in updateEntities
                } else if (dist === 0) { // Handle exact overlap case
                    const pushX = (Math.random() - 0.5) * 0.5; // Small random push
                    const pushY = (Math.random() - 0.5) * 0.5;
                    enemy1.x += pushX;
                    enemy1.y += pushY;
                    enemy2.x -= pushX;
                    enemy2.y -= pushY;
                }
            }
        }
    }

    triggerDamageFlash() {
        if (this.currentFlashAnimation) {
            PIXI.Ticker.shared.remove(this.currentFlashAnimation);
            this.currentFlashAnimation = null; // Clear existing animation
        }

        this.damageFlashOverlay.clear();
        this.damageFlashOverlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
        // Alpha is handled by the animation loop directly on the object's alpha property
        this.damageFlashOverlay.fill({ color: 0xFF0000 }); 
        this.damageFlashOverlay.alpha = 0.4; // Initial alpha for the flash
        this.damageFlashOverlay.visible = true;

        let elapsed = 0;
        const flashDuration = 200; // milliseconds (0.2 seconds)

        const animateFlash = (ticker) => {
            // Correct way to get deltaMS in PixiJS v8 ticker is ticker.deltaMS or ticker.deltaTime (if you adjust for TARGET_FPMS)
            // Assuming ticker.deltaMS is available and provides milliseconds
            // If not, use ticker.deltaTime and convert: elapsed += (ticker.deltaTime / PIXI.settings.TARGET_FPMS) * 1000;
             elapsed += ticker.deltaMS;


            const progress = Math.min(elapsed / flashDuration, 1);
            this.damageFlashOverlay.alpha = 0.4 * (1 - progress); // Fade out from initial alpha

            if (progress >= 1) {
                PIXI.Ticker.shared.remove(animateFlash);
                this.damageFlashOverlay.visible = false;
                this.currentFlashAnimation = null;
            }
        };

        this.currentFlashAnimation = animateFlash;
        PIXI.Ticker.shared.add(animateFlash);
    }

    getRandomUpgrades() {
        const allUpgrades = [
            { 
                key: '1', 
                text: 'Increase Fire Rate', 
                action: () => {
                    gameState.fireRate *= LEVEL_SCALING.fireRateUpgrade;
                    if (this.ui) this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '2', 
                text: 'Increase Speed', 
                action: () => {
                    gameState.playerSpeed *= LEVEL_SCALING.speedUpgrade;
                    if (this.ui) this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '3', 
                text: 'Increase Health', 
                action: () => {
                    gameState.maxHealth = Math.floor(gameState.maxHealth * LEVEL_SCALING.healthUpgrade);
                    gameState.health = gameState.maxHealth;
                    if (this.ui) {
                        this.ui.updateHealth(gameState.health, gameState.maxHealth);
                        this.ui.updateDebugPanel(gameState);
                    }
                }
            },
            { 
                key: '4', 
                text: 'Increase Attack Damage', 
                action: () => {
                    gameState.attackDamage *= LEVEL_SCALING.damageUpgrade;
                    if (this.ui) this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '5', 
                text: 'Increase Health Regen', 
                action: () => {
                    gameState.healthRegen += LEVEL_SCALING.healthRegenUpgrade;
                    if (this.ui) this.ui.updateDebugPanel(gameState);
                }
            }
        ];

        // Shuffle and return 3 random upgrades
        return allUpgrades.sort(() => 0.5 - Math.random()).slice(0, 3);
    }
}

// Initialize game with error handling
(async () => {
    try {
        const game = new Game();
        await game.initialize(); // Call the new async initialize method
    } catch (error) {
        console.error('Failed to start game:', error);
        const body = document.querySelector('body');
        if (body) {
            // Clear body and show error
            while (body.firstChild) {
                body.removeChild(body.firstChild);
            }
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `<div style="color: white; text-align: center; padding-top: 50px; font-family: Arial, sans-serif;">
                <h1>Game Initialization Error</h1>
                <p>Failed to initialize the game. Please check the console for more details or try refreshing the page.</p>
            </div>`;
            body.appendChild(errorDiv);
        }
    }
})();