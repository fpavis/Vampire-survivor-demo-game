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

import { gameState } from '../core/gameState.js';
import { EntityManager } from '../entities/Entity.js';

export class CombatSystem {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
    }

    handleCombat(delta) {
        const currentTime = Date.now();
        const weapon = gameState.player.weapons[gameState.player.activeWeapon];
        if (!weapon) return;

        if (weapon.canFire(currentTime) && gameState.enemies.length > 0) {
            const closestEnemy = this.findClosestEnemy();
            if (!closestEnemy) return;

            const projectiles = weapon.fire(
                { x: gameState.player.x, y: gameState.player.y },
                { x: closestEnemy.x, y: closestEnemy.y },
                currentTime
            );

            this.createProjectiles(projectiles);
        }
    }

    createProjectiles(projectiles) {
        projectiles.forEach(projectile => {
            const sprite = new PIXI.Graphics();
            sprite
                .fill({ color: projectile.color })
                .circle(0, 0, projectile.size);
            
            sprite.x = projectile.x;
            sprite.y = projectile.y;
            sprite.zIndex = 8;  // Above enemies, below player
            
            // Add to world container
            this.worldContainer.addChild(sprite);
            
            // Add to game state
            gameState.bullets.push({
                sprite,
                dx: projectile.dx,
                dy: projectile.dy,
                damage: projectile.damage,
                piercing: projectile.piercing,
                range: projectile.range,
                distanceTraveled: 0,
                size: projectile.size || 5
            });
            
            console.log('Projectile created:', {
                position: { x: sprite.x, y: sprite.y },
                damage: projectile.damage,
                parent: sprite.parent === this.worldContainer ? 'worldContainer' : 'unknown'
            });
        });
    }

    findClosestEnemy() {
        let closestEnemy = null;
        let closestDistance = Infinity;

        gameState.enemies.forEach(enemy => {
            const dx = enemy.x - gameState.player.x;
            const dy = enemy.y - gameState.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        });

        return closestEnemy;
    }

    updateProjectiles(delta) {
        for (let i = gameState.bullets.length - 1; i >= 0; i--) {
            const bullet = gameState.bullets[i];
            
            bullet.sprite.x += bullet.dx * delta;
            bullet.sprite.y += bullet.dy * delta;

            const distanceThisFrame = Math.sqrt(
                (bullet.dx * delta) ** 2 + 
                (bullet.dy * delta) ** 2
            );
            bullet.distanceTraveled += distanceThisFrame;

            const shouldRemove = 
                this.isOffScreen(bullet.sprite) || 
                (bullet.range && bullet.distanceTraveled >= bullet.range);

            if (shouldRemove) {
                EntityManager.cleanup(this.app, bullet.sprite);
                gameState.bullets.splice(i, 1);
            }
        }
    }

    isOffScreen(sprite) {
        const bounds = sprite.getBounds();
        return bounds.x + bounds.width < 0 ||
               bounds.x > this.app.screen.width ||
               bounds.y + bounds.height < 0 ||
               bounds.y > this.app.screen.height;
    }
} 