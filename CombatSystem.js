import { gameState } from './gameState.js';
import { EntityManager } from './entities.js';

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
            sprite.beginFill(projectile.color);
            sprite.drawCircle(0, 0, projectile.size);
            sprite.endFill();
            sprite.x = projectile.x;
            sprite.y = projectile.y;
            
            this.worldContainer.addChild(sprite);
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