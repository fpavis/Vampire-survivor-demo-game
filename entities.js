/* eslint-disable no-unused-vars */
import { ENEMY_TYPES, STYLES } from './config.js';
import { gameState } from './gameState.js';

export class EntityManager {
    static createPlayer(app) {
        const container = new PIXI.Container();
        
        // Create glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(0x00ff00, 0.2);
        glow.drawCircle(0, 0, 25);
        glow.endFill();
        container.addChild(glow);
        
        // Create player body
        const body = new PIXI.Graphics();
        body.beginFill(STYLES.colors.player);
        body.drawCircle(0, 0, 20);  // Fixed size for collision radius
        body.endFill();
        container.addChild(body);

        // Set container dimensions explicitly for collision detection
        container.width = 40;  // Diameter
        container.height = 40; // Diameter
        
        // Add hit area for better collision detection
        container.hitArea = new PIXI.Circle(0, 0, 20);

        return container;
    }

    static createEnemy(app, type, x, y) {
        const config = ENEMY_TYPES[type];
        const container = new PIXI.Container();
        
        // Create enemy body
        const body = new PIXI.Graphics();
        body.beginFill(config.color);
        body.drawCircle(0, 0, config.size);
        body.endFill();
        container.addChild(body);
        
        // Create health bar background
        const healthBarBg = new PIXI.Graphics();
        healthBarBg.beginFill(STYLES.colors.healthBar.background);
        healthBarBg.drawRect(-config.size, -config.size - 10, config.size * 2, 4);
        healthBarBg.endFill();
        container.addChild(healthBarBg);
        
        // Create health bar
        const healthBar = new PIXI.Graphics();
        healthBar.beginFill(STYLES.colors.healthBar.health);
        healthBar.drawRect(-config.size, -config.size - 10, config.size * 2, 4);
        healthBar.endFill();
        container.addChild(healthBar);
        
        // Set container properties
        container.x = x;
        container.y = y;
        
        // Set dimensions to match the circle size exactly
        const diameter = config.size * 2;
        container.width = diameter;
        container.height = diameter;
        
        // Add hit area for collision detection
        container.hitArea = new PIXI.Circle(0, 0, config.size);
        
        // Add enemy properties
        container.health = config.health;
        container.maxHealth = config.health;
        container.speed = config.speed;
        container.experienceValue = config.experience;
        container.healthBar = healthBar;
        container.radius = config.size; // Store radius for easier access
        
        return container;
    }

    static createBullet(startX, startY, targetX, targetY) {
        const container = new PIXI.Container();
        
        // Create bullet glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(STYLES.colors.bullet, 0.3);
        glow.drawCircle(0, 0, 8);
        glow.endFill();
        
        // Create bullet trail effect
        const trail = new PIXI.Graphics();
        trail.beginFill(STYLES.colors.bullet, 0.2);
        trail.drawEllipse(0, 0, 12, 6);
        trail.endFill();
        trail.rotation = Math.atan2(targetY - startY, targetX - startX);
        
        // Create bullet core
        const bullet = new PIXI.Graphics();
        bullet.beginFill(STYLES.colors.bullet);
        bullet.drawCircle(0, 0, 4);
        bullet.endFill();
        
        // Add all parts to container in correct order
        container.addChild(trail);  // Trail behind
        container.addChild(glow);   // Glow in middle
        container.addChild(bullet); // Bullet on top
        
        container.x = startX;
        container.y = startY;
        
        // Calculate angle and speed
        const angle = Math.atan2(targetY - startY, targetX - startX);
        const speed = 8;
        
        // Add pulsing animation
        let pulseTime = Math.random() * Math.PI * 2; // Random start phase
        container.ticker = new PIXI.Ticker();
        container.ticker.add((delta) => {
            pulseTime += delta * 0.2;
            const scale = 1 + Math.sin(pulseTime) * 0.2;
            glow.scale.set(scale);
        });
        container.ticker.start();
        
        return {
            sprite: container,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            width: 8,  // For collision detection
            height: 8, // Keep it circular
            cleanup: () => {
                if (container.ticker) {
                    container.ticker.destroy();
                }
            }
        };
    }

    static createExperienceGem(x, y, value) {
        // Create a container for the gem and effects
        const container = new PIXI.Container();
        
        // Create the glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(STYLES.colors.exp, 0.3);
        glow.drawCircle(0, 0, 12);
        glow.endFill();
        container.addChild(glow);
        
        // Create the gem shape
        const gem = new PIXI.Graphics();
        gem.beginFill(STYLES.colors.exp);
        gem.drawPolygon([
            -6, 0,   // Left point
            0, -8,   // Top point
            6, 0,    // Right point
            0, 8     // Bottom point
        ]);
        gem.endFill();
        container.addChild(gem);
        
        // Add value text
        const valueText = new PIXI.Text(`+${value}`, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xFFFFFF,
            stroke: 0x000000,
            strokeThickness: 2,
            align: 'center'
        });
        valueText.anchor.set(0.5);
        valueText.y = -20; // Position above the gem
        container.addChild(valueText);
        
        // Position the container
        container.x = x;
        container.y = y;
        
        // Add pulsing animation
        let pulseTime = Math.random() * Math.PI * 2; // Random start phase
        container.ticker = new PIXI.Ticker();
        container.ticker.add((delta) => {
            pulseTime += delta * 0.1;
            const scale = 1 + Math.sin(pulseTime) * 0.1;
            gem.scale.set(scale);
            glow.scale.set(scale);
            valueText.scale.set(scale);
        });
        container.ticker.start();

        return {
            sprite: container,
            value: value,
            cleanup: () => {
                if (container.ticker) {
                    container.ticker.destroy();
                }
            }
        };
    }

    static cleanup(app, entity) {
        if (!entity) return;
        
        // Stop any active animations/tickers
        if (entity.ticker) {
            entity.ticker.destroy();
        }
        
        // If the entity has a cleanup function, call it
        if (entity.cleanup) {
            entity.cleanup();
        }
        
        // Remove from parent
        if (entity.parent) {
            entity.parent.removeChild(entity);
        }
        
        // Destroy the entity
        entity.destroy({ children: true });
    }
} 