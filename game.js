import { GAME_CONFIG, ENEMY_TYPES, INITIAL_STATE, LEVEL_SCALING, STYLES, WORLD_CONFIG, SPAWN_CONFIG } from './config.js';
import { gameState } from './gameState.js';
import { EntityManager } from './entities.js';
import { UIManager } from './ui.js';

class Game {
    constructor() {
        try {
            this.app = new PIXI.Application(GAME_CONFIG);
            document.body.appendChild(this.app.view);
            
            // Create main container for the game world
            this.worldContainer = new PIXI.Container();
            this.app.stage.addChild(this.worldContainer);
            
            // Add resize handler
            window.addEventListener('resize', () => this.handleResize());
            
            this.showStartScreen();
        } catch (error) {
            console.error('Game initialization error:', error);
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
        }

        const grid = new PIXI.Graphics();
        grid.name = 'grid';
        grid.lineStyle(1, 0x333333, 0.3);
        
        const width = worldSized ? WORLD_CONFIG.width : this.app.screen.width;
        const height = worldSized ? WORLD_CONFIG.height : this.app.screen.height;
        
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
        
        this.worldContainer.addChildAt(grid, 1);
    }

    showStartScreen() {
        // Create a container for start screen elements
        const startScreen = new PIXI.Container();
        startScreen.eventMode = 'static';
        this.app.stage.addChild(startScreen);

        // Dark background
        const background = new PIXI.Graphics();
        background.beginFill(0x000000, 0.85);
        background.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        background.endFill();
        startScreen.addChild(background);

        // Game title
        const titleText = new PIXI.Text('Survival Game', {
            fontSize: 64,
            fill: 0xffffff,
            align: 'center',
            fontWeight: 'bold'
        });
        titleText.anchor.set(0.5);
        titleText.position.set(this.app.screen.width / 2, this.app.screen.height / 3);
        startScreen.addChild(titleText);

        // Instructions text
        const instructionsText = new PIXI.Text(
            'Use WASD or arrow keys to move\nMouse/touch to move on mobile\nEnemies drop experience gems\nLevel up to become stronger', {
            fontSize: 24,
            fill: 0xcccccc,
            align: 'center'
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
        button.beginFill(0x00ff00);
        button.drawRoundedRect(-100, -30, 200, 60, 15);
        button.endFill();

        // Button text
        const buttonText = new PIXI.Text('Start Game', {
            fontSize: 32,
            fill: 0x000000,
            fontWeight: 'bold'
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
            button.tint = 0xffffff;
        });

        buttonContainer.on('pointerdown', () => {
            // Remove start screen
            this.app.stage.removeChild(startScreen);
            
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
            background.width = this.app.screen.width;
            background.height = this.app.screen.height;
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
            gameState.pointerPosition = { x: e.global.x, y: e.global.y };
        });

        this.app.stage.on('pointerdown', (e) => {
            gameState.pointerPosition = { x: e.global.x, y: e.global.y };
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
        background.beginFill(STYLES.colors.background);
        background.drawRect(0, 0, WORLD_CONFIG.width, WORLD_CONFIG.height);
        background.endFill();
        background.name = 'background';
        
        this.worldContainer.addChild(background);
        this.updateGrid(true);  // true for world-sized grid
        
        // Initialize player in center of world
        gameState.player = EntityManager.createPlayer(this.app);
        gameState.player.x = WORLD_CONFIG.width / 2;
        gameState.player.y = WORLD_CONFIG.height / 2;
        this.worldContainer.addChild(gameState.player);
        
        // Initialize UI only once here
        if (!this.ui) {
            this.ui = new UIManager(this.app);
        }
        
        // Center camera on player initially
        this.updateCamera();
        
        // Start game loop
        if (gameState.gameTicker) {
            this.app.ticker.remove(gameState.gameTicker);
        }
        gameState.gameTicker = (delta) => this.gameLoop(delta);
        this.app.ticker.add(gameState.gameTicker);
    }

    gameLoop(delta) {
        if (gameState.gameOver || gameState.levelUp || gameState.paused) return;

        this.handleMovement(delta);
        this.handleCombat(delta);
        this.updateEntities(delta);
        this.updateExperienceGems(delta);
        this.handleHealthRegen(delta);
        this.checkCollisions();
        
        // Update all UI elements
        this.ui.updateHealth(gameState.health, gameState.maxHealth);
        this.ui.updateScore(gameState.score);
        this.ui.updateLevel(gameState.level);
        this.ui.updateExperience(gameState.experience, gameState.nextLevel);
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
            const worldX = pointer.x - this.worldContainer.x;
            const worldY = pointer.y - this.worldContainer.y;
            
            // Calculate direction to pointer
            const dirX = worldX - player.x;
            const dirY = worldY - player.y;
            const distance = Math.sqrt(dirX * dirX + dirY * dirY);

            // Only move if there's a significant distance to travel
            if (distance > 5) {
                dx = dirX / distance;
                dy = dirY / distance;
            }
        }

        // Apply movement if there's any input
        if (dx !== 0 || dy !== 0) {
            // For joystick, we don't need to normalize as it's already normalized
            if (!this.ui.joystick || !this.ui.joystick.active) {
                // Normalize diagonal movement only for non-joystick input
                const length = Math.sqrt(dx * dx + dy * dy);
                dx = dx / length;
                dy = dy / length;
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

            const bullet = EntityManager.createBullet(
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
            enemy.healthBar.width = healthPercent * (ENEMY_TYPES[enemy.type].size * 2);
            enemy.healthBar.tint = healthPercent < 0.3 ? STYLES.colors.healthBar.damage : STYLES.colors.healthBar.health;
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
            const enemy = EntityManager.createEnemy(this.app, type, spawnPos.x, spawnPos.y);
            
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
            
            for (let eIndex = gameState.enemies.length - 1; eIndex >= 0; eIndex--) {
                const enemy = gameState.enemies[eIndex];
            const dx = bullet.sprite.x - enemy.x;
            const dy = bullet.sprite.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const collisionDist = ENEMY_TYPES[enemy.type].size + 5;

            if (dist < collisionDist) {
                    // Create hit effect
                    this.createHitEffect(bullet.sprite.x, bullet.sprite.y);
                    
                // Damage enemy
                    enemy.health -= gameState.attackDamage;
                    
                    // Remove bullet with cleanup
                    EntityManager.cleanup(this.app, bullet.sprite);
                    gameState.bullets.splice(bIndex, 1);

                // Check if enemy died
                if (enemy.health <= 0) {
                        this.createDeathEffect(enemy.x, enemy.y);
                        EntityManager.cleanup(this.app, enemy);
                        gameState.enemies.splice(eIndex, 1);
                        gameState.score += ENEMY_TYPES[enemy.type].experience * 2;
                        this.ui.updateScore(gameState.score);

                        // Create experience gem and add to worldContainer
                        const gem = EntityManager.createExperienceGem(this.app, enemy.x, enemy.y, enemy.experienceValue);
                        gameState.experienceGems.push(gem);
                        this.worldContainer.addChild(gem.sprite);  // Add to worldContainer instead of app.stage
                    }
                    break;
                }
            }
        }

        // Player-enemy collisions
        gameState.enemies.forEach(enemy => {
            const dx = gameState.player.x - enemy.x;
            const dy = gameState.player.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 35) {
                gameState.health -= 0.5;
                this.ui.updateHealth(gameState.health, gameState.maxHealth);

                if (gameState.health <= 0 && !gameState.gameOver) {
                    gameState.health = 0;
                    this.ui.updateHealth(0, gameState.maxHealth);
                    this.showGameOver();
                }
            }
        });
    }

    updateExperienceGems(delta) {
        // Add a pending experience property to gameState if it doesn't exist
        if (gameState.pendingExperience === undefined) {
            gameState.pendingExperience = 0;
        }

        // Process pending experience first
        if (gameState.pendingExperience > 0) {
            // Add experience gradually (10% of pending exp per frame, minimum 1)
            const expToAdd = Math.max(1, Math.floor(gameState.pendingExperience * 0.1));
            gameState.experience += expToAdd;
            gameState.pendingExperience -= expToAdd;

            this.ui.updateExperience(gameState.experience, gameState.nextLevel);

            // Check for level up
            if (gameState.experience >= gameState.nextLevel && !gameState.levelUp) {
                this.showLevelUp();
                return; // Stop processing gems while leveling up
            }
        }

        // Process gems
        for (let i = gameState.experienceGems.length - 1; i >= 0; i--) {
            const gem = gameState.experienceGems[i];
            
            // Calculate distance to player
            const dx = gameState.player.x - gem.sprite.x;
            const dy = gameState.player.y - gem.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

            // Magnet effect
            if (dist < 100) {
                gem.sprite.x += (dx / dist) * 4 * delta;
                gem.sprite.y += (dy / dist) * 4 * delta;
            }

            // Collect gem
            if (dist < 20) {
                // Add to pending experience instead of directly to experience
                gameState.pendingExperience += gem.value;
                
                EntityManager.cleanup(this.app, gem.sprite);
                this.app.stage.removeChild(gem.sprite);
                gameState.experienceGems.splice(i, 1);
            }
        }
    }

    handleHealthRegen(delta) {
        if (gameState.healthRegen > 0 && gameState.health < gameState.maxHealth) {
            gameState.health = Math.min(
                gameState.health + (gameState.healthRegen / 60) * delta,
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
        
        // Clean up animations
        if (gameState.player) {
            EntityManager.cleanup(this.app, gameState.player);
        }
        gameState.experienceGems.forEach(gem => {
            EntityManager.cleanup(this.app, gem.sprite);
        });

        // Dark overlay with fade in
    const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0);
        overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.endFill();
        this.app.stage.addChild(overlay);

        // Animate overlay fade in
        let alpha = 0;
        const fadeIn = () => {
            alpha += 0.05;
            overlay.clear();
            overlay.beginFill(0x000000, Math.min(0.8, alpha));
            overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.endFill();

            if (alpha < 0.8) requestAnimationFrame(fadeIn);
        };
        fadeIn();

        // Game over text with effects
        const gameOverText = new PIXI.Text('GAME OVER', {
            fontSize: 64,
            fill: ['#FF0000', '#880000'], // Gradient fill
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 10,
            dropShadowDistance: 5
        });
        gameOverText.anchor.set(0.5);
        gameOverText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);

        // Stats container
        const statsContainer = new PIXI.Container();
        statsContainer.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

        // Stats background
        const statsBg = new PIXI.Graphics();
        statsBg.beginFill(0x000000, 0.5);
        statsBg.lineStyle(2, 0x444444);
        statsBg.drawRoundedRect(-150, -60, 300, 120, 10);
        statsBg.endFill();
        statsContainer.addChild(statsBg);

        // Final stats text
        const statsStyle = {
            fontSize: 24,
            fill: 0xFFFFFF,
        align: 'center'
        };

        const finalScoreText = new PIXI.Text(`Score: ${gameState.score}`, statsStyle);
        finalScoreText.anchor.set(0.5);
        finalScoreText.position.set(0, -30);

        const levelText = new PIXI.Text(`Level Reached: ${gameState.level}`, statsStyle);
        levelText.anchor.set(0.5);
        levelText.position.set(0, 10);

        statsContainer.addChild(finalScoreText, levelText);

        // Play again button with effects
        const button = new PIXI.Container();
        button.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + 100);

        const buttonBg = new PIXI.Graphics();
        buttonBg.beginFill(0x00AA00);
        buttonBg.lineStyle(3, 0x00FF00);
        buttonBg.drawRoundedRect(-100, -25, 200, 50, 15);
        buttonBg.endFill();

        const buttonText = new PIXI.Text('Play Again', {
            fontSize: 28,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2
        });
        buttonText.anchor.set(0.5);

        button.addChild(buttonBg, buttonText);

        // Make button interactive
        button.eventMode = 'static';
        button.cursor = 'pointer';

        // Button hover effects
        button.on('pointerover', () => {
            buttonBg.tint = 0xAAFFAA;
            button.scale.set(1.05);
        });
        button.on('pointerout', () => {
            buttonBg.tint = 0xFFFFFF;
            button.scale.set(1);
        });

        button.on('pointerdown', () => {
            this.app.stage.removeChild(overlay, gameOverText, statsContainer, button);
            this.init();
        });

        // Add pulsing animation to game over text
        const pulseText = () => {
            gameOverText.scale.x = 1 + Math.sin(Date.now() / 300) * 0.1;
            gameOverText.scale.y = gameOverText.scale.x;
            requestAnimationFrame(pulseText);
        };
        pulseText();

        // Add everything to stage
        this.app.stage.addChild(overlay, gameOverText, statsContainer, button);
    }

    showLevelUp() {
        gameState.levelUp = true;

        // Dark overlay with animation
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0);  // Start transparent
        overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.endFill();
        this.app.stage.addChild(overlay);

        // Animate overlay
        let alpha = 0;
        const fadeIn = () => {
            alpha += 0.05;
            overlay.clear();
            overlay.beginFill(0x000000, Math.min(0.7, alpha));
            overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
            overlay.endFill();
            
            if (alpha < 0.7) requestAnimationFrame(fadeIn);
        };
        fadeIn();

        // Level up text with glow effect
        const levelUpText = new PIXI.Text('LEVEL UP!', {
            fontSize: 48,
            fill: ['#FFD700', '#FFA500'], // Gold gradient
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 10,
            dropShadowDistance: 5
        });
        levelUpText.anchor.set(0.5);
        levelUpText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 120);

        // Add pulsing animation to level up text
        const pulseText = () => {
            levelUpText.scale.x = 1 + Math.sin(Date.now() / 200) * 0.1;
            levelUpText.scale.y = levelUpText.scale.x;
            requestAnimationFrame(pulseText);
        };
        pulseText();

        // Get upgrades
        const upgrades = this.getRandomUpgrades();
        let selectedIndex = 0;

        // Create upgrade option containers
        const optionContainers = upgrades.map((upgrade, index) => {
            const container = new PIXI.Container();
            
            // Background for option
            const bg = new PIXI.Graphics();
            bg.beginFill(0x333333, 0.8);
            bg.lineStyle(2, 0x666666);
            bg.drawRoundedRect(-150, -30, 300, 60, 10);
            bg.endFill();
            
            const text = new PIXI.Text(upgrade.text, {
                fontSize: 20,
                fill: 0xFFFFFF,
                align: 'center'
            });
            text.anchor.set(0.5);

            container.addChild(bg, text);
            container.position.set(
                this.app.screen.width / 2,
                this.app.screen.height / 2 + index * 80
            );
            
            // Make container interactive
            container.eventMode = 'static';
            container.cursor = 'pointer';
            
            // Add hover and click handlers
            container.on('pointerover', () => {
                selectedIndex = index;
                updateSelection();
            });
            
            container.on('pointerdown', () => {
                // Apply selected upgrade
                upgrades[index].action();
                
                // Cleanup
                cleanup();
                
                // Complete level up
                this.levelUpComplete();
            });

            return container;
        });

        // Update the instruction text to include mouse/touch instructions
        const instructionText = new PIXI.Text(
            'Use ↑↓ or touch/click to select\nSPACE or tap/click to confirm', {
            fontSize: 16,
            fill: 0xCCCCCC,
            align: 'center'
        });
        instructionText.anchor.set(0.5);
        instructionText.position.set(
            this.app.screen.width / 2,
            this.app.screen.height / 2 + (upgrades.length * 80) + 40
        );

        // Function to update selection
        const updateSelection = () => {
            optionContainers.forEach((container, index) => {
                const bg = container.getChildAt(0);
                const text = container.getChildAt(1);
                
                if (index === selectedIndex) {
                    bg.clear();
                    bg.beginFill(0x666666, 0.9);
                    bg.lineStyle(2, 0xFFD700);
                    bg.drawRoundedRect(-150, -30, 300, 60, 10);
                    bg.endFill();
                    text.style.fill = 0xFFD700;
                    container.filters = null;
                    container.scale.set(1.1);
                } else {
                    bg.clear();
                    bg.beginFill(0x333333, 0.8);
                    bg.lineStyle(2, 0x666666);
                    bg.drawRoundedRect(-150, -30, 300, 60, 10);
                    bg.endFill();
                    text.style.fill = 0xFFFFFF;
                    container.filters = [new PIXI.BlurFilter(1)];
                    container.scale.set(1);
                }
            });
        };

        // Cleanup function
        const cleanup = () => {
            window.removeEventListener('keydown', handleKeyPress);
            this.app.stage.removeChild(overlay, levelUpText, instructionText);
            optionContainers.forEach(container => this.app.stage.removeChild(container));
        };

        // Handle key events
        const handleKeyPress = (e) => {
            switch(e.key) {
                case 'ArrowUp':
                    selectedIndex = (selectedIndex - 1 + upgrades.length) % upgrades.length;
                    updateSelection();
                    break;
                case 'ArrowDown':
                    selectedIndex = (selectedIndex + 1) % upgrades.length;
                    updateSelection();
                    break;
                case ' ':  // Space key
                    // Apply selected upgrade
                    upgrades[selectedIndex].action();
                    
                    // Cleanup
                    cleanup();
                    
                    // Complete level up
                    this.levelUpComplete();
                    break;
            }
        };

        // Add all elements to stage
        this.app.stage.addChild(levelUpText, instructionText);
        optionContainers.forEach(container => this.app.stage.addChild(container));

        // Initial selection update
        updateSelection();

        window.addEventListener('keydown', handleKeyPress);
    }

    levelUpComplete() {
        // Update level-related stats
        gameState.level++;
        gameState.experience = 0;
        gameState.nextLevel = Math.floor(gameState.nextLevel * LEVEL_SCALING.experienceMultiplier);
        gameState.levelUp = false;
        
        // Update all UI elements
        this.ui.updateLevel(gameState.level);
        this.ui.updateExperience(gameState.experience, gameState.nextLevel);
        this.ui.updateHealth(gameState.health, gameState.maxHealth);
        this.ui.updateDebugPanel(gameState);
    }

    updateCamera() {
        // Calculate where the camera should be
        const targetX = -gameState.player.x + this.app.screen.width / 2;
        const targetY = -gameState.player.y + this.app.screen.height / 2;
        
        // Clamp camera position to world bounds
        const minX = -WORLD_CONFIG.width + this.app.screen.width;
        const minY = -WORLD_CONFIG.height + this.app.screen.height;
        
        this.worldContainer.x = Math.max(Math.min(targetX, 0), minX);
        this.worldContainer.y = Math.max(Math.min(targetY, 0), minY);
    }

    createEnemy() {
        // Modify enemy spawn to use world coordinates
        const angle = Math.random() * Math.PI * 2;
        const spawnX = gameState.player.x + Math.cos(angle) * SPAWN_CONFIG.spawnDistance;
        const spawnY = gameState.player.y + Math.sin(angle) * SPAWN_CONFIG.spawnDistance;
        
        // Ensure spawn is within world bounds
        const x = Math.max(50, Math.min(WORLD_CONFIG.width - 50, spawnX));
        const y = Math.max(50, Math.min(WORLD_CONFIG.height - 50, spawnY));
        
        return { x, y };
    }

    createHitEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.hit.count;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(STYLES.particles.hit.color);
            particle.drawCircle(0, 0, 2);
            particle.endFill();
            
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = STYLES.particles.hit.speed;
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.alpha = 1;
            
            this.worldContainer.addChild(particle);
            particles.push(particle);
        }
        
        const animate = () => {
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.05;
                if (p.alpha <= 0) {
                    this.worldContainer.removeChild(p);
                }
            });
            
            if (particles[0].alpha > 0) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    createDeathEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.death.count;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(STYLES.particles.death.color);
            particle.drawCircle(0, 0, 3);
            particle.endFill();
            
            const angle = Math.random() * Math.PI * 2;
            const speed = STYLES.particles.death.speed * (0.5 + Math.random() * 0.5);
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.alpha = 1;
            
            this.worldContainer.addChild(particle);
            particles.push(particle);
        }
        
        const animate = () => {
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.02;
                if (p.alpha <= 0) {
                    this.worldContainer.removeChild(p);
                }
            });
            
            if (particles[0].alpha > 0) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    getRandomUpgrades() {
        const allUpgrades = [
            { 
                key: '1', 
                text: 'Increase Fire Rate', 
                action: () => {
                    gameState.fireRate *= LEVEL_SCALING.fireRateUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '2', 
                text: 'Increase Speed', 
                action: () => {
                    gameState.playerSpeed *= LEVEL_SCALING.speedUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '3', 
                text: 'Increase Health', 
                action: () => {
                    gameState.maxHealth = Math.floor(gameState.maxHealth * LEVEL_SCALING.healthUpgrade);
                    gameState.health = gameState.maxHealth;
                    this.ui.updateHealth(gameState.health, gameState.maxHealth);
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '4', 
                text: 'Increase Attack Damage', 
                action: () => {
                    gameState.attackDamage *= LEVEL_SCALING.damageUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '5', 
                text: 'Increase Health Regen', 
                action: () => {
                    gameState.healthRegen += LEVEL_SCALING.healthRegenUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            }
        ];

        // Shuffle and return 3 random upgrades
        return allUpgrades.sort(() => 0.5 - Math.random()).slice(0, 3);
    }
}

// Initialize game with error handling
try {
    const game = new Game();
} catch (error) {
    console.error('Failed to start game:', error);
}