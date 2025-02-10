/**
 * @file EnemyManager.js
 * @description Manages enemy spawning, behavior, and state updates. Handles enemy scaling with level,
 * elite enemy creation, and enemy movement patterns. Controls the enemy population in each area.
 * 
 * @module managers/EnemyManager
 * @requires core/gameState
 * @requires core/config
 * 
 * Key Features:
 * - Controls enemy spawning rates and positions
 * - Manages enemy scaling with player level
 * - Handles elite enemy creation and modifications
 * - Updates enemy positions and states
 * - Controls enemy health bar displays
 * 
 * Usage:
 * ```js
 * const enemyManager = new EnemyManager(app, worldContainer);
 * enemyManager.handleEnemySpawning(delta, currentArea);
 * enemyManager.updateEnemies(delta);
 * ```
 * 
 * Modification Guidelines:
 * - Add new enemy types in the ENEMY_TYPES configuration
 * - Modify spawn behavior in handleEnemySpawning
 * - Adjust enemy scaling in scaleEnemyWithLevel
 * - Implement new movement patterns in updateEnemyPosition
 * - Add elite enemy variations in makeEliteEnemy
 * 
 * @class
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';
import { ENEMY_TYPES, LEVEL_SCALING } from '../core/config.js';

/**
 * Enemy entity with type-based configuration and health management
 * @extends PIXI.Container
 */
class Enemy extends PIXI.Container {
    constructor(type = 'BASIC', x = 0, y = 0) {
        super();
        
        const config = ENEMY_TYPES[type];
        if (!config) return;
        
        // Core setup
        this.zIndex = 5;
        this.eventMode = 'none';
        this.type = type;
        
        // Create sprite using texture cache
        const texture = PIXI.Assets.get(config.texture || 'basicEnemy');
        this.sprite = texture ? 
            new PIXI.Sprite(texture) : 
            this.createFallbackSprite(config);
            
        // Optimize sprite properties
        this.sprite.anchor.set(0.5);
        this.addChild(this.sprite);
        
        // Setup health bar
        this.setupHealthBar();
        
        // Game properties
        this.health = config.health || 100;
        this.maxHealth = this.health;
        this.speed = config.speed || 2;
        this.experienceValue = config.experience || 10;
        
        // Set position and hitArea
        this.position.set(x, y);
        this.hitArea = new PIXI.Circle(0, 0, config.size || 20);
    }
    
    createFallbackSprite(config) {
        const graphics = new PIXI.Graphics()
            .fill({ color: config.color || 0xFF0000 })
            .circle(0, 0, config.size || 20);
        return graphics;
    }
    
    setupHealthBar() {
        this.healthBar = new PIXI.Graphics();
        this.healthBar.y = -30;
        this.addChild(this.healthBar);
        this.updateHealthBar();
    }
    
    updateHealthBar() {
        const width = 40;
        const height = 4;
        const healthPercent = this.health / this.maxHealth;
        
        this.healthBar.clear()
            .fill({ color: 0x000000, alpha: 0.5 })
            .rect(-width/2, 0, width, height)
            .fill({ color: healthPercent < 0.3 ? 0xFF0000 : 0x00FF00 })
            .rect(-width/2, 0, width * healthPercent, height);
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        PIXI.Tween.to(this, { alpha: 0.5 }, 100)
            .yoyo(true)
            .start();
            
        return this.health <= 0;
    }

    makeElite() {
        this.isElite = true;
        this.health *= 1.5;
        this.maxHealth = this.health;
        this.speed *= 1.2;
        this.experienceValue *= 2;
        
        // Visual indication of elite status
        this.sprite.tint = 0xFFD700; // Gold tint
        this.scale.set(1.2); // 20% larger
        
        this.updateHealthBar();
    }

    getWorldPosition() {
        return {
            x: this.position.x,
            y: this.position.y
        };
    }
}

export class EnemyManager {
    constructor(app, viewport, worldContainer, entityLayer) {
        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;
        this.entityLayer = entityLayer;
        this.debugCounter = 0;  // Add counter for debug logs
    }

    handleEnemySpawning(delta, currentArea) {
        // Ensure we have valid inputs
        if (!currentArea || !gameState.player) {
            console.log('Missing required data for spawning:', { currentArea: !!currentArea, player: !!gameState.player });
            return;
        }

        // Get spawn configuration
        const spawnConfig = currentArea.getSpawnConfig();
        if (!spawnConfig) {
            console.error('No spawn config found for area');
            return;
        }

        // Check enemy limit
        if (gameState.enemies.length >= spawnConfig.maxEnemies) {
            return;
        }

        // Convert delta to seconds with better precision
        const deltaSeconds = Number((delta / 60).toFixed(4));

        // Calculate spawn chance with better precision
        const baseSpawnRate = Number((spawnConfig.baseRate || 1.05).toFixed(4));
        const spawnChance = Number((baseSpawnRate * deltaSeconds).toFixed(4));

        // Debug logging - only log every 60 frames (approximately once per second)
        this.debugCounter = (this.debugCounter + 1) % 60;
        if (this.debugCounter === 0) {
            console.log('Spawn calculation:', {
                deltaSeconds,
                baseSpawnRate,
                spawnChance,
                currentEnemies: gameState.enemies.length,
                maxEnemies: spawnConfig.maxEnemies,
                spawnProbability: `${(spawnChance * 100).toFixed(2)}%`
            });
        }

        // Roll for spawn with better precision
        if (Number(Math.random().toFixed(4)) < spawnChance) {
            console.log('Spawning enemy...');
            this.spawnEnemy(spawnConfig, currentArea);
        }
    }

    spawnEnemy(spawnConfig, currentArea) {
        // Validate required parameters
        if (!spawnConfig || !currentArea || !gameState.player) {
            console.error('Missing required parameters for enemy spawn');
            return;
        }

        // Get player's position directly
        const playerPos = gameState.player.getWorldPosition();
        if (!Number.isFinite(playerPos.x) || !Number.isFinite(playerPos.y)) {
            console.error('Invalid player position:', playerPos);
            // Use center of area as fallback
            playerPos.x = currentArea.width / 2;
            playerPos.y = currentArea.height / 2;
        }

        // Determine enemy type
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
        
        // Calculate spawn position with validation
        const angle = Math.random() * Math.PI * 2;
        const spawnDistance = Math.max(300, spawnConfig.spawnDistance || 600);
        
        // Calculate spawn position in world coordinates
        let spawnX = playerPos.x + Math.cos(angle) * spawnDistance;
        let spawnY = playerPos.y + Math.sin(angle) * spawnDistance;
        
        // Validate calculated positions
        if (!Number.isFinite(spawnX) || !Number.isFinite(spawnY)) {
            console.error('Invalid initial spawn calculation:', {
                playerPos,
                angle,
                spawnDistance,
                calculated: { x: spawnX, y: spawnY }
            });
            // Use fallback position at area edge
            spawnX = Math.random() * currentArea.width;
            spawnY = Math.random() * currentArea.height;
        }
        
        // Clamp spawn position to area bounds with padding
        const padding = 50;
        spawnX = Math.max(padding, Math.min(currentArea.width - padding, spawnX));
        spawnY = Math.max(padding, Math.min(currentArea.height - padding, spawnY));

        if (gameState.debug) {
            console.log('Spawn position calculated:', {
                player: playerPos,
                spawn: { x: spawnX, y: spawnY },
                area: {
                    width: currentArea.width,
                    height: currentArea.height
                }
            });
        }

        // Create enemy
        const enemy = new Enemy(type, spawnX, spawnY);
        
        // Apply level scaling
        this.scaleEnemyWithLevel(enemy, Math.max(0, gameState.level - 1));

        // Check for elite enemy
        if (Math.random() < (spawnConfig.eliteChance || 0.1)) {
            enemy.makeElite();
        }

        // Add to game
        enemy.zIndex = 5;
        this.entityLayer.addChild(enemy);
        gameState.enemies.push(enemy);

        if (gameState.debug) {
            console.log('Enemy spawned:', {
                type,
                position: { x: enemy.x, y: enemy.y },
                health: enemy.health,
                speed: enemy.speed,
                isElite: enemy.isElite,
                parent: !!enemy.parent,
                visible: enemy.visible
            });
        }
    }

    scaleEnemyWithLevel(enemy, levelScale) {
        enemy.health *= Math.pow(LEVEL_SCALING.enemyHealthScale, levelScale);
        enemy.maxHealth = enemy.health;
        enemy.speed *= Math.pow(LEVEL_SCALING.enemySpeedScale, levelScale);
        enemy.experienceValue = Math.floor(enemy.experienceValue * Math.pow(LEVEL_SCALING.experienceMultiplierPerLevel, levelScale));
        enemy.updateHealthBar();
        return enemy;
    }

    updateEnemies(delta) {
        gameState.enemies.forEach(enemy => {
            this.updateEnemyPosition(enemy, delta);
        });
    }

    updateEnemyPosition(enemy, delta) {
        // Get world positions
        const playerWorldPos = this.viewport.toWorld(gameState.player.position);
        const enemyWorldPos = this.viewport.toWorld(enemy.position);
        
        // Calculate direction in world coordinates
        const dx = playerWorldPos.x - enemyWorldPos.x;
        const dy = playerWorldPos.y - enemyWorldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            const normalizedDx = dx / dist;
            const normalizedDy = dy / dist;
            
            // Update position in world coordinates
            const newX = enemy.x + normalizedDx * enemy.speed * delta;
            const newY = enemy.y + normalizedDy * enemy.speed * delta;
            
            // Set new position
            enemy.position.set(newX, newY);
        }
    }
} 