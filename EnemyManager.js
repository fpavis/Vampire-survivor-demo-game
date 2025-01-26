import { gameState } from './gameState.js';
import { EntityManager } from './entities.js';
import { LEVEL_SCALING } from './config.js';

export class EnemyManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
    }

    handleEnemySpawning(delta, currentArea) {
        const spawnConfig = currentArea.getSpawnConfig();
        if (gameState.enemies.length >= spawnConfig.maxEnemies) return;

        const spawnChance = spawnConfig.baseRate * Math.pow(LEVEL_SCALING.enemySpawnRateScale, gameState.level - 1);
        
        if (Math.random() < spawnChance * delta) {
            this.spawnEnemy(spawnConfig, currentArea);
        }
    }

    spawnEnemy(spawnConfig, currentArea) {
        // Determine enemy type based on ratios
        const roll = Math.random();
        let type = 'BASIC';
        let cumulative = 0;
        
        for (const [enemyType, ratio] of Object.entries(spawnConfig.typeRatios)) {
            cumulative += ratio;
            if (roll <= cumulative) {
                type = enemyType;
                break;
            }
        }
        
        // Calculate spawn position
        const angle = Math.random() * Math.PI * 2;
        const spawnDistance = spawnConfig.spawnDistance;
        const spawnX = gameState.player.x + Math.cos(angle) * spawnDistance;
        const spawnY = gameState.player.y + Math.sin(angle) * spawnDistance;
        
        // Ensure spawn is within area bounds
        const x = Math.max(50, Math.min(currentArea.width - 50, spawnX));
        const y = Math.max(50, Math.min(currentArea.height - 50, spawnY));
        
        // Create and configure enemy
        let enemy = EntityManager.createEnemy(this.app, type, x, y);
        
        // Scale enemy stats with level
        const levelScale = gameState.level - 1;
        enemy = this.scaleEnemyWithLevel(enemy, levelScale);
        
        // Apply area-specific modifiers
        enemy = currentArea.modifyEnemy(enemy);
        
        // Check for elite enemy
        if (Math.random() < spawnConfig.eliteChance) {
            enemy = this.makeEliteEnemy(enemy, spawnConfig.eliteModifiers);
        }
        
        this.worldContainer.addChild(enemy);
        gameState.enemies.push(enemy);
    }

    scaleEnemyWithLevel(enemy, levelScale) {
        enemy.health *= Math.pow(LEVEL_SCALING.enemyHealthScale, levelScale);
        enemy.maxHealth = enemy.health;
        enemy.speed *= Math.pow(LEVEL_SCALING.enemySpeedScale, levelScale);
        enemy.experienceValue = Math.floor(enemy.experienceValue * Math.pow(LEVEL_SCALING.experienceMultiplierPerLevel, levelScale));
        return enemy;
    }

    makeEliteEnemy(enemy, eliteModifiers) {
        enemy.tint = 0xFFD700; // Gold tint
        enemy.health *= eliteModifiers.health;
        enemy.maxHealth = enemy.health;
        enemy.experienceValue *= eliteModifiers.experience;
        enemy.speed *= eliteModifiers.speed;
        return enemy;
    }

    updateEnemies(delta) {
        gameState.enemies.forEach(enemy => {
            this.updateEnemyPosition(enemy, delta);
            this.updateEnemyHealthBar(enemy);
        });
    }

    updateEnemyPosition(enemy, delta) {
        const dx = gameState.player.x - enemy.x;
        const dy = gameState.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            const normalizedDx = dx / dist;
            const normalizedDy = dy / dist;
            enemy.x += normalizedDx * enemy.speed * delta;
            enemy.y += normalizedDy * enemy.speed * delta;
        }
    }

    updateEnemyHealthBar(enemy) {
        const healthPercent = enemy.health / enemy.maxHealth;
        enemy.healthBar.clear();
        enemy.healthBar.beginFill(healthPercent < 0.3 ? 0xFF0000 : 0x00FF00);
        enemy.healthBar.drawRect(-enemy.radius, -enemy.radius - 10, enemy.healthBarWidth * healthPercent, 4);
        enemy.healthBar.endFill();
    }
} 