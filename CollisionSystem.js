import { COLLISION_CONFIG, STYLES, WORLD_CONFIG } from './config.js';
import { EntityManager } from './entities.js';
import { gameState } from './gameState.js';

export class CollisionSystem {
    constructor(app, worldContainer, effectsManager) {
        this.app = app;
        this.worldContainer = worldContainer;
        this.effectsManager = effectsManager;
        this.game = null; // Reference to game instance
    }

    setGame(game) {
        this.game = game;
    }

    checkCollisions() {
        this.checkPlayerEnemyCollisions();
        this.checkBulletEnemyCollisions();
        this.checkEnemyEnemyCollisions();
    }

    checkPlayerEnemyCollisions() {
        if (!gameState.invulnerable && gameState.player) {
            for (const enemy of gameState.enemies) {
                if (!enemy) continue;

                const collision = this.getCollisionDetails(
                    gameState.player,
                    enemy,
                    COLLISION_CONFIG.enemy.minDistance
                );

                if (collision.hasCollided) {
                    this.handlePlayerEnemyCollision(enemy, collision);
                }
            }
        }
    }

    checkBulletEnemyCollisions() {
        for (let i = gameState.bullets.length - 1; i >= 0; i--) {
            const bullet = gameState.bullets[i];
            let bulletRemoved = false;

            if (!bullet || !bullet.sprite) continue;

            for (let j = gameState.enemies.length - 1; j >= 0; j--) {
                const enemy = gameState.enemies[j];
                if (!enemy || enemy.health <= 0) continue;

                const collision = this.getBulletEnemyCollision(bullet, enemy);
                if (collision.hasCollided) {
                    bulletRemoved = this.handleBulletEnemyCollision(bullet, enemy, i, j);
                    if (bulletRemoved) break;
                }
            }
        }
    }

    checkEnemyEnemyCollisions() {
        for (let i = 0; i < gameState.enemies.length; i++) {
            for (let j = i + 1; j < gameState.enemies.length; j++) {
                const enemy1 = gameState.enemies[i];
                const enemy2 = gameState.enemies[j];
                
                if (!enemy1 || !enemy2) continue;
                
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

    handlePlayerEnemyCollision(enemy, collision) {
        const pushForce = Math.min(
            (collision.minDistance - collision.distance) * COLLISION_CONFIG.enemy.pushForce,
            COLLISION_CONFIG.enemy.maxPushForce
        );

        // Push enemy away
        enemy.x += Math.cos(collision.angle) * pushForce;
        enemy.y += Math.sin(collision.angle) * pushForce;

        // Push player in opposite direction
        gameState.player.x -= Math.cos(collision.angle) * pushForce * COLLISION_CONFIG.player.pushResistance;
        gameState.player.y -= Math.sin(collision.angle) * pushForce * COLLISION_CONFIG.player.pushResistance;

        // Keep player in bounds
        const playerRadius = gameState.player.radius;
        gameState.player.x = Math.max(playerRadius, Math.min(WORLD_CONFIG.width - playerRadius, gameState.player.x));
        gameState.player.y = Math.max(playerRadius, Math.min(WORLD_CONFIG.height - playerRadius, gameState.player.y));

        // Apply damage to player
        if (!gameState.invulnerable) {
            gameState.health -= COLLISION_CONFIG.player.damage;
            gameState.invulnerable = true;

            // Flash player red
            gameState.player.tint = 0xFF0000;

            // Reset after immunity period
            setTimeout(() => {
                if (gameState.player) {
                    gameState.invulnerable = false;
                    gameState.player.tint = STYLES.colors.player;
                }
            }, COLLISION_CONFIG.player.damageImmunityTime);

            // Check for game over
            if (gameState.health <= 0) {
                gameState.gameOver = true;
                if (this.game && this.game.ui) {
                    this.game.ui.showGameOver();
                }
                return true;
            }
        }
        return false;
    }

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
            EntityManager.cleanup(this.app, bullet.sprite);
            gameState.bullets.splice(bulletIndex, 1);
            return true;
        }
        return false;
    }

    handleEnemyDeath(enemy, enemyIndex) {
        // Create death effect
        this.effectsManager.createDeathEffect(enemy.x, enemy.y);
        
        // Add experience gem
        const gem = EntityManager.createExperienceGem(enemy.x, enemy.y, enemy.experienceValue);
        this.worldContainer.addChild(gem.sprite);
        gameState.experienceGems.push(gem);

        // Update score
        gameState.score += enemy.experienceValue;

        // Remove enemy
        EntityManager.cleanup(this.app, enemy);
        gameState.enemies.splice(enemyIndex, 1);
    }

    handleEnemyEnemyCollision(enemy1, enemy2, collision) {
        const pushForce = Math.min(
            (collision.minDistance - collision.distance) * COLLISION_CONFIG.enemy.repelForce,
            COLLISION_CONFIG.enemy.maxPushForce
        );
        
        const pushX = Math.cos(collision.angle) * pushForce;
        const pushY = Math.sin(collision.angle) * pushForce;
        
        enemy1.x -= pushX;
        enemy1.y -= pushY;
        enemy2.x += pushX;
        enemy2.y += pushY;
    }
} 