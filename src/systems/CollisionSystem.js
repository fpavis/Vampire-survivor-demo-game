/**
 * @file CollisionSystem.js
 * @description Handles all collision detection and resolution in the game.
 * This system is responsible for:
 * - Detecting and handling player-enemy collisions
 * - Processing bullet-enemy collisions
 * - Managing enemy-enemy collisions
 * - Checking projectiles that are out of bounds
 * - Coordinating with other systems for collision effects
 */

import { COLLISION_CONFIG, STYLES, WORLD_CONFIG } from '../core/config.js';
import { gameState } from '../core/gameState.js';

/**
 * Manages all collision detection and resolution in the game
 * @class CollisionSystem
 */
export class CollisionSystem {
    /**
     * Creates a new CollisionSystem instance
     * @param {PIXI.Application} app - The main PIXI application instance
     * @param {PIXI.Viewport} viewport - The game's viewport for coordinate transformations
     * @param {PIXI.Container} worldContainer - The main world container
     * @param {EffectsManager} effectsManager - Manager for visual effects
     */
    constructor(app, viewport, worldContainer, effectsManager) {
        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;
        this.effectsManager = effectsManager;
        this.managers = null; // Will be set by setManagers
        
        // Create spatial hash grid for optimized collision detection
        this.gridSize = 100; // Size of each grid cell
        this.spatialGrid = new Map();
        
        if (gameState.debug) {
            console.log('CollisionSystem initialized with layers:', {
                viewport: {
                    scale: this.viewport.scale.x,
                    position: { x: this.viewport.x, y: this.viewport.y }
                },
                world: {
                    found: !!this.worldContainer,
                    children: this.worldContainer.children.length
                }
            });
        }
    }

    /**
     * Sets up manager references for system coordination
     * @param {Object} managers - Object containing references to other game managers
     */
    setManagers(managers) {
        this.managers = managers;
    }

    /**
     * Updates the spatial hash grid with current entity positions
     * @private
     */
    updateSpatialGrid() {
        this.spatialGrid.clear();
        
        // Add enemies to grid
        gameState.enemies.forEach((enemy, index) => {
            if (!enemy) return;
            const cell = this.getGridCell(enemy.x, enemy.y);
            if (!this.spatialGrid.has(cell)) {
                this.spatialGrid.set(cell, new Set());
            }
            this.spatialGrid.get(cell).add({ type: 'enemy', index, entity: enemy });
        });

        // Add player to grid if exists
        if (gameState.player) {
            const cell = this.getGridCell(gameState.player.x, gameState.player.y);
            if (!this.spatialGrid.has(cell)) {
                this.spatialGrid.set(cell, new Set());
            }
            this.spatialGrid.get(cell).add({ type: 'player', entity: gameState.player });
        }

        // Add bullets to grid
        gameState.bullets.forEach((bullet, index) => {
            if (!bullet || !bullet.sprite) return;
            const cell = this.getGridCell(bullet.sprite.x, bullet.sprite.y);
            if (!this.spatialGrid.has(cell)) {
                this.spatialGrid.set(cell, new Set());
            }
            this.spatialGrid.get(cell).add({ type: 'bullet', index, entity: bullet });
        });
    }

    /**
     * Gets the grid cell key for a position
     * @private
     */
    getGridCell(x, y) {
        const cellX = Math.floor(x / this.gridSize);
        const cellY = Math.floor(y / this.gridSize);
        return `${cellX},${cellY}`;
    }

    /**
     * Gets neighboring cells for a position
     * @private
     */
    getNeighboringCells(x, y) {
        const cellX = Math.floor(x / this.gridSize);
        const cellY = Math.floor(y / this.gridSize);
        const cells = [];
        
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                cells.push(`${cellX + i},${cellY + j}`);
            }
        }
        
        return cells;
    }

    /**
     * Main collision detection loop that checks all possible collision types
     */
    checkCollisions() {
        // Update spatial grid first
        this.updateSpatialGrid();
        
        // Check all collision types
        this.checkPlayerEnemyCollisions();
        this.checkBulletEnemyCollisions();
        this.checkEnemyEnemyCollisions();
        this.checkProjectileOutOfBounds();
    }

    /**
     * Checks for collisions between the player and enemies
     * Uses spatial grid for optimization
     * @private
     */
    checkPlayerEnemyCollisions() {
        if (!gameState.invulnerable && gameState.player) {
            const playerCells = this.getNeighboringCells(gameState.player.x, gameState.player.y);
            
            for (const cell of playerCells) {
                const entities = this.spatialGrid.get(cell);
                if (!entities) continue;
                
                for (const { type, entity } of entities) {
                    if (type !== 'enemy') continue;
                    
                    const collision = this.getCollisionDetails(
                        gameState.player,
                        entity,
                        COLLISION_CONFIG.enemy.minDistance
                    );

                    if (collision.hasCollided) {
                        this.handlePlayerEnemyCollision(entity, collision);
                    }
                }
            }
        }
    }

    /**
     * Checks for collisions between bullets and enemies
     * Uses spatial grid for optimization
     * @private
     */
    checkBulletEnemyCollisions() {
        for (let i = gameState.bullets.length - 1; i >= 0; i--) {
            const bullet = gameState.bullets[i];
            if (!bullet || !bullet.sprite) continue;
            
            const bulletCells = this.getNeighboringCells(bullet.sprite.x, bullet.sprite.y);
            let bulletRemoved = false;
            
            for (const cell of bulletCells) {
                const entities = this.spatialGrid.get(cell);
                if (!entities) continue;
                
                for (const { type, entity, index } of entities) {
                    if (type !== 'enemy' || entity.health <= 0) continue;
                    
                    const collision = this.getBulletEnemyCollision(bullet, entity);
                    if (collision.hasCollided) {
                        bulletRemoved = this.handleBulletEnemyCollision(bullet, entity, i, index);
                        if (bulletRemoved) break;
                    }
                }
                if (bulletRemoved) break;
            }
        }
    }

    /**
     * Checks for collisions between enemies
     * Uses spatial grid for optimization
     * @private
     */
    checkEnemyEnemyCollisions() {
        const checkedPairs = new Set();
        
        for (const [cell, entities] of this.spatialGrid) {
            const enemies = Array.from(entities).filter(e => e.type === 'enemy');
            
            // Check collisions between enemies in the same cell
            for (let i = 0; i < enemies.length; i++) {
                for (let j = i + 1; j < enemies.length; j++) {
                    const enemy1 = enemies[i].entity;
                    const enemy2 = enemies[j].entity;
                    
                    // Create unique pair ID to avoid checking same pair twice
                    const pairId = `${Math.min(enemies[i].index, enemies[j].index)},${Math.max(enemies[i].index, enemies[j].index)}`;
                    if (checkedPairs.has(pairId)) continue;
                    checkedPairs.add(pairId);
                    
                    const collision = this.getCollisionDetails(
                        enemy1,
                        enemy2,
                        COLLISION_CONFIG.enemy.minDistance
                    );
                    
                    if (collision.hasCollided) {
                        this.handleEnemyEnemyCollision(enemy1, enemy2, collision);
                    }
                }
            }
        }
    }

    /**
     * Handles collision between player and enemy
     * @private
     */
    handlePlayerEnemyCollision(enemy, collision) {
        // Apply damage to player
        if (this.managers?.player) {
            this.managers.player.takeDamage(COLLISION_CONFIG.player.damage);
        }
        
        // Apply knockback to both entities
        const knockbackForce = COLLISION_CONFIG.player.pushForce;
        const knockbackX = Math.cos(collision.angle) * knockbackForce;
        const knockbackY = Math.sin(collision.angle) * knockbackForce;
        
        // Apply to player (with resistance)
        if (gameState.player) {
            gameState.player.x -= knockbackX * COLLISION_CONFIG.player.pushResistance;
            gameState.player.y -= knockbackY * COLLISION_CONFIG.player.pushResistance;
        }
        
        // Apply to enemy
        enemy.x += knockbackX;
        enemy.y += knockbackY;
        
        // Create collision effect
        this.effectsManager.createHitEffect(
            enemy.x - knockbackX / 2,
            enemy.y - knockbackY / 2
        );
        
        // Set temporary invulnerability
        gameState.invulnerable = true;
        setTimeout(() => {
            gameState.invulnerable = false;
        }, COLLISION_CONFIG.player.damageImmunityTime);
    }

    /**
     * Handles collision between bullet and enemy
     * @private
     */
    handleBulletEnemyCollision(bullet, enemy, bulletIndex, enemyIndex) {
        // Apply damage to enemy
        enemy.health -= bullet.damage;
        
        // Create effects
        this.effectsManager.createDamageNumber(bullet.sprite.x, bullet.sprite.y, bullet.damage);
        this.effectsManager.createHitEffect(bullet.sprite.x, bullet.sprite.y);

        // Check if enemy is defeated
        if (enemy.health <= 0) {
            this.handleEnemyDeath(enemy, enemyIndex);
        }

        // Remove bullet unless it's piercing
        if (!bullet.piercing) {
            if (this.managers?.bullet) {
                this.managers.bullet.removeBullet(bullet, bulletIndex);
            }
            return true;
        }
        return false;
    }

    /**
     * Handles collision between two enemies
     * @private
     */
    handleEnemyEnemyCollision(enemy1, enemy2, collision) {
        const pushForce = Math.min(
            (collision.minDistance - collision.distance) * COLLISION_CONFIG.enemy.repelForce,
            COLLISION_CONFIG.enemy.maxPushForce
        );
        
        const pushX = Math.cos(collision.angle) * pushForce;
        const pushY = Math.sin(collision.angle) * pushForce;
        
        // Apply repulsion forces
        enemy1.x -= pushX;
        enemy1.y -= pushY;
        enemy2.x += pushX;
        enemy2.y += pushY;
    }

    /**
     * Handles enemy death effects and cleanup
     * @private
     */
    handleEnemyDeath(enemy, enemyIndex) {
        // Create death effect
        this.effectsManager.createDeathEffect(enemy.x, enemy.y);
        
        // Add experience gem
        if (this.managers?.experience) {
            const gem = this.managers.experience.createExperienceGem(
                enemy.x,
                enemy.y,
                enemy.experienceValue
            );
            this.worldContainer.addChild(gem.sprite);
            gameState.experienceGems.push(gem);
        }

        // Update score
        gameState.score += enemy.experienceValue;

        // Remove enemy
        if (this.managers?.enemy) {
            this.managers.enemy.removeEnemy(enemy, enemyIndex);
        }
    }

    /**
     * Checks if projectiles are outside the visible area
     * @private
     */
    checkProjectileOutOfBounds() {
        if (!this.managers?.bullet) return;

        const bounds = this.viewport.getVisibleBounds();
        const padding = 100; // Extra distance before removal
        bounds.pad(padding);

        for (let i = gameState.bullets.length - 1; i >= 0; i--) {
            const bullet = gameState.bullets[i];
            if (!bullet || !bullet.sprite) continue;

            if (!bounds.contains(bullet.sprite.x, bullet.sprite.y)) {
                this.managers.bullet.removeBullet(bullet, i);
            }
        }
    }

    /**
     * Calculates collision details between two objects
     * @private
     */
    getCollisionDetails(object1, object2, minDistanceMultiplier = 1) {
        const dx = object2.x - object1.x;
        const dy = object2.y - object1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const radius1 = object1.radius || object1.width / 2;
        const radius2 = object2.radius || object2.width / 2;
        const minDistance = (radius1 + radius2) * minDistanceMultiplier;

        return {
            hasCollided: distance < minDistance,
            distance,
            dx,
            dy,
            angle: Math.atan2(dy, dx),
            minDistance
        };
    }

    /**
     * Calculates collision between a bullet and an enemy
     * @private
     */
    getBulletEnemyCollision(bullet, enemy) {
        const dx = bullet.sprite.x - enemy.x;
        const dy = bullet.sprite.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const bulletRadius = bullet.size / 2;
        const enemyRadius = enemy.width / 2;
        const collisionRadius = bulletRadius + enemyRadius;

        return {
            hasCollided: distance <= collisionRadius,
            distance,
            dx,
            dy
        };
    }
} 