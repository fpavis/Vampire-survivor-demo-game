import * as PIXI from 'pixi.js';

export class CollisionSystem {
    constructor(worldContainer) {
        this.worldContainer = worldContainer;
        this.debugGraphics = null;
    }

    drawDebugCircle(x, y, radius, color = 0xFF0000) {
        if (!this.debugGraphics) {
            this.debugGraphics = new PIXI.Graphics();
            this.worldContainer.addChild(this.debugGraphics);
        }

        this.debugGraphics
            .stroke({ color, width: 2, alpha: 0.5 })
            .circle(x, y, radius);
    }

    checkCollision(circle1, circle2) {
        const dx = circle2.x - circle1.x;
        const dy = circle2.y - circle1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (circle1.radius + circle2.radius);
    }

    handlePlayerEnemyCollision(player, enemy) {
        if (this.checkCollision(
            { x: player.x, y: player.y, radius: player.hitboxRadius },
            { x: enemy.x, y: enemy.y, radius: enemy.hitboxRadius }
        )) {
            // Apply push force
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const pushForce = 5;

            if (distance > 0) {
                const pushX = (dx / distance) * pushForce;
                const pushY = (dy / distance) * pushForce;
                
                player.x += pushX;
                player.y += pushY;
            }

            return true;
        }
        return false;
    }

    clearDebugGraphics() {
        if (this.debugGraphics) {
            this.debugGraphics.clear();
        }
    }
} 