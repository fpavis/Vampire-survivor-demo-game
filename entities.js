import { ENEMY_TYPES, STYLES } from './config.js';
import { gameState } from './gameState.js';

export class EntityManager {
    static createPlayer(app) {
        const container = new PIXI.Container();
        
        // Main player circle with gradient
        const player = new PIXI.Graphics();
        const gradient = new PIXI.Graphics();
        
        // Create gradient effect
        gradient.beginFill(STYLES.colors.player);
        gradient.drawCircle(0, 0, 18);
        gradient.endFill();
        gradient.beginFill(0xffffff, 0.3);
        gradient.drawCircle(0, 0, 15);
        gradient.endFill();
        
        // Add glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(STYLES.colors.player, 0.2);
        glow.drawCircle(0, 0, 25);
        glow.endFill();
        
        container.addChild(glow, gradient);
        container.x = app.screen.width / 2;
        container.y = app.screen.height / 2;
        
        // Add pulsing animation
        const pulseAnimation = (delta) => {
            glow.scale.x = 1 + Math.sin(Date.now() / 200) * 0.1;
            glow.scale.y = glow.scale.x;
        };
        app.ticker.add(pulseAnimation);
        
        // Store ticker function for cleanup
        container.pulseAnimation = pulseAnimation;
        
        return container;
    }

    static createEnemy(app, typeKey, x, y) {
        const type = ENEMY_TYPES[typeKey];
        const container = new PIXI.Container();
        
        // Create enemy body with gradient
        const enemy = new PIXI.Graphics();
        enemy.beginFill(type.color);
        enemy.drawCircle(0, 0, type.size);
        enemy.endFill();
        enemy.beginFill(0xffffff, 0.2);
        enemy.drawCircle(0, 0, type.size * 0.7);
        enemy.endFill();
        
        // Create health bar container
        const healthBarContainer = new PIXI.Container();
        const healthBarBg = new PIXI.Graphics();
        const healthBarFg = new PIXI.Graphics();
        
        // Health bar background
        healthBarBg.beginFill(STYLES.colors.healthBar.background);
        healthBarBg.lineStyle(1, STYLES.colors.healthBar.border);
        healthBarBg.drawRoundedRect(-type.size, -type.size - 10, type.size * 2, 5, 2);
        healthBarBg.endFill();
        
        // Health bar foreground
        healthBarFg.beginFill(STYLES.colors.healthBar.health);
        healthBarFg.drawRoundedRect(-type.size, -type.size - 10, type.size * 2, 5, 2);
        healthBarFg.endFill();
        
        healthBarContainer.addChild(healthBarBg, healthBarFg);
        container.addChild(enemy, healthBarContainer);
        
        // Set enemy properties
        Object.assign(container, {
            health: type.health,
            maxHealth: type.health,
            speed: type.speed,
            experienceValue: type.experience,
            type: typeKey,
            healthBar: healthBarFg
        });

        // Use provided coordinates instead of screen-based ones
        container.x = x;
        container.y = y;
        
        // Add pulse animation for enemy
        const pulseAnimation = (delta) => {
            enemy.alpha = 0.8 + Math.sin(Date.now() / 300) * 0.2;
        };
        app.ticker.add(pulseAnimation);
        container.pulseAnimation = pulseAnimation;

        return container;
    }

    static createBullet(startX, startY, targetX, targetY) {
        const container = new PIXI.Container();
        
        // Create bullet with trail effect
        const bullet = new PIXI.Graphics();
        bullet.beginFill(STYLES.colors.bullet);
        bullet.drawCircle(0, 0, 5);
        bullet.endFill();
        
        // Add glow
        const glow = new PIXI.Graphics();
        glow.beginFill(STYLES.colors.bullet, 0.3);
        glow.drawCircle(0, 0, 8);
        glow.endFill();
        
        container.addChild(glow, bullet);
        container.x = startX;
        container.y = startY;

        const angle = Math.atan2(targetY - startY, targetX - startX);
        const speed = 8;

        return {
            sprite: container,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed
        };
    }

    static createExperienceGem(app, x, y, value) {
        const container = new PIXI.Container();
        
        // Create gem with glow effect
        const gem = new PIXI.Graphics();
        gem.beginFill(STYLES.colors.exp);
        gem.drawPolygon([
            -8, 0,   // Left point
            0, -12,  // Top point
            8, 0,    // Right point
            0, 12    // Bottom point
        ]);
        gem.endFill();
        
        // Add inner highlight
        const highlight = new PIXI.Graphics();
        highlight.beginFill(0xffffff, 0.5);
        highlight.drawPolygon([
            -4, 0,
            0, -6,
            4, 0,
            0, 6
        ]);
        highlight.endFill();
        
        // Add glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(STYLES.colors.exp, 0.3);
        glow.drawCircle(0, 0, 15);
        glow.endFill();
        
        // Add value text
        const valueText = new PIXI.Text(`${value}`, {
            fontSize: 14,
            fill: 0xffffff,
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowDistance: 1
        });
        valueText.anchor.set(0.5);
        valueText.y = -20;
        
        container.addChild(glow, gem, highlight, valueText);
        container.x = x;
        container.y = y;
        
        // Add floating animation
        let time = Math.random() * Math.PI * 2;
        const floatAnimation = (delta) => {
            time += 0.05;
            container.y += Math.sin(time) * 0.3;
        };
        app.ticker.add(floatAnimation);
        
        // Store ticker function for cleanup
        container.floatAnimation = floatAnimation;
        
        return {
            sprite: container,
            value: value
        };
    }

    static cleanup(app, entity) {
        if (entity.pulseAnimation) {
            app.ticker.remove(entity.pulseAnimation);
        }
        if (entity.floatAnimation) {
            app.ticker.remove(entity.floatAnimation);
        }
        // Remove any other animations or tickers here
        if (entity.parent) {
            entity.parent.removeChild(entity);
        }
    }
} 