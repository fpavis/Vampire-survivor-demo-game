/**
 * @file CombatSystem.js
 * @description Manages all combat-related functionality including weapon firing, projectile management,
 * and target acquisition. This system coordinates attacks between the player and enemies.
 * 
 * @module managers/CombatSystem
 * @requires core/gameState
 * @requires entities/Entity
 * 
 * Key Features:
 * - Handles weapon firing mechanics and timing
 * - Manages projectile creation and movement
 * - Implements target acquisition logic
 * - Controls projectile lifecycle and cleanup
 * 
 * Usage:
 * ```js
 * const combatSystem = new CombatSystem(app, worldContainer);
 * combatSystem.handleCombat(delta);
 * combatSystem.updateProjectiles(delta);
 * ```
 * 
 * Modification Guidelines:
 * - Add new weapon types by extending the createProjectiles method
 * - Modify targeting behavior in findClosestEnemy
 * - Implement new projectile effects in updateProjectiles
 * - Add different combat mechanics by extending handleCombat
 * 
 * @class
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';
import { EntityManager } from '../entities/Entity.js';

export class CombatSystem {
    constructor(app, viewport, worldContainer, bulletLayer, entityLayer) {
        if (!app || !viewport || !worldContainer || !bulletLayer || !entityLayer) {
            console.error('CombatSystem: Missing required parameters', {
                app: !!app,
                viewport: !!viewport,
                worldContainer: !!worldContainer,
                bulletLayer: !!bulletLayer,
                entityLayer: !!entityLayer
            });
            return;
        }
        
        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;
        this.bulletLayer = bulletLayer;
        this.entityLayer = entityLayer;
        
        if (gameState.debug) {
            console.log('CombatSystem initialized:', {
                layers: {
                    bullet: {
                        found: !!this.bulletLayer,
                        visible: this.bulletLayer.visible,
                        children: this.bulletLayer.children.length,
                        zIndex: this.bulletLayer.zIndex
                    },
                    entity: {
                        found: !!this.entityLayer,
                        visible: this.entityLayer.visible,
                        children: this.entityLayer.children.length,
                        zIndex: this.entityLayer.zIndex
                    }
                },
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

    setGame(game) {
        this.game = game;
    }

    handleCombat(delta) {
        if (!this.bulletLayer || !this.entityLayer) return;

        // Update projectiles
        this.updateProjectiles(delta);
        
        // Check for collisions
        this.checkCollisions();
    }

    updateProjectiles(delta) {
        if (!this.bulletLayer) return;

        gameState.bullets.forEach((bullet, index) => {
            bullet.update(delta);
            
            // Get bullet's screen position
            const screenPos = this.viewport.toScreen(bullet.position);
            const bounds = this.app.screen;
            const padding = 100; // Extra distance before removal
            
            // Check if bullet is too far from view in screen coordinates
            if (
                screenPos.x < bounds.left - padding ||
                screenPos.x > bounds.right + padding ||
                screenPos.y < bounds.top - padding ||
                screenPos.y > bounds.bottom + padding
            ) {
                if (gameState.debug) {
                    console.log('Projectile removed:', {
                        world: { x: bullet.x, y: bullet.y },
                        screen: screenPos,
                        bounds: {
                            left: bounds.left,
                            right: bounds.right,
                            top: bounds.top,
                            bottom: bounds.bottom
                        }
                    });
                }
                
                this.bulletLayer.removeChild(bullet);
                gameState.bullets.splice(index, 1);
            }
        });
    }

    checkCollisions() {
        if (!this.bulletLayer || !this.entityLayer) return;

        // Check bullet-enemy collisions
        gameState.bullets.forEach((bullet, bulletIndex) => {
            gameState.enemies.forEach((enemy, enemyIndex) => {
                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < enemy.radius + 5) {  // 5 is bullet radius
                    // Handle collision
                    this.handleBulletEnemyCollision(bullet, enemy, bulletIndex, enemyIndex);
                }
            });
        });
    }

    handleBulletEnemyCollision(bullet, enemy, bulletIndex, enemyIndex) {
        if (!this.bulletLayer || !this.entityLayer) return;

        // Remove bullet
        this.bulletLayer.removeChild(bullet);
        gameState.bullets.splice(bulletIndex, 1);
        
        // Damage enemy
        const killed = enemy.takeDamage(10);  // TODO: Get damage from weapon config
        
        if (killed) {
            // Remove enemy
            this.entityLayer.removeChild(enemy);
            gameState.enemies.splice(enemyIndex, 1);
            
            // Create effects
            if (this.game?.effectsManager) {
                this.game.effectsManager.createDeathEffect(enemy.x, enemy.y);
            }
            
            // Drop experience
            if (this.game?.experienceManager) {
                this.game.experienceManager.createExperienceGem(enemy.x, enemy.y, enemy.experienceValue);
            }
            
            if (gameState.debug) {
                console.log('Enemy killed:', {
                    position: { x: enemy.x, y: enemy.y },
                    type: enemy.type,
                    experience: enemy.experienceValue
                });
            }
        } else {
            // Create hit effect
            if (this.game?.effectsManager) {
                this.game.effectsManager.createHitEffect(bullet.x, bullet.y);
            }
            
            if (gameState.debug) {
                console.log('Enemy hit:', {
                    position: { x: enemy.x, y: enemy.y },
                    health: enemy.health,
                    maxHealth: enemy.maxHealth
                });
            }
        }
    }
} 