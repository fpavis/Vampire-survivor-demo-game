/* eslint-disable no-unused-vars */
import { ENEMY_TYPES, STYLES } from './config.js';
import { gameState } from './gameState.js';

export class EntityManager {
    static createPlayer(app) {
        const container = new PIXI.Container();
        
        // Main player circle with gradient
        const playerBody = new PIXI.Graphics();
        const playerRadius = 18;

        // Concentric circles for depth/energy
        playerBody.circle(0, 0, playerRadius);
        playerBody.fill({ color: STYLES.colors.player, alpha: 0.5 });
        playerBody.circle(0, 0, playerRadius * 0.8);
        playerBody.fill({ color: STYLES.colors.player, alpha: 0.7 });
        playerBody.circle(0, 0, playerRadius * 0.6);
        playerBody.fill({ color: STYLES.colors.player, alpha: 1 });
        playerBody.circle(0, 0, playerRadius * 0.3);
        playerBody.fill({ color: 0xFFFFFF, alpha: 0.8 });


        // Small chevrons/triangles on the perimeter
        const chevronCount = 3;
        const chevronSize = 5;
        for (let i = 0; i < chevronCount; i++) {
            const angle = (i / chevronCount) * Math.PI * 2;
            const x1 = Math.cos(angle) * (playerRadius + 1);
            const y1 = Math.sin(angle) * (playerRadius + 1);
            const x2 = Math.cos(angle + 0.1) * (playerRadius + chevronSize);
            const y2 = Math.sin(angle + 0.1) * (playerRadius + chevronSize);
            const x3 = Math.cos(angle - 0.1) * (playerRadius + chevronSize);
            const y3 = Math.sin(angle - 0.1) * (playerRadius + chevronSize);
            
            // Define the points for the polygon (triangle)
            const chevronPoints = [
                x1, y1,
                x2, y2,
                x3, y3
            ];
            playerBody.poly(chevronPoints);
            playerBody.fill({color: 0xFFFFFF, alpha: 0.9});
        }
        
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, playerRadius * 1.4); // Adjusted glow size
        glow.fill({ color: STYLES.colors.player, alpha: 0.2 });
        
        container.addChild(glow, playerBody);
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
        const enemyBody = new PIXI.Graphics();
        const size = type.size;

        if (typeKey === 'BASIC') {
            // Hexagon with inner core
            const points = [];
            for (let i = 0; i < 6; i++) {
                points.push(Math.cos(i * Math.PI / 3) * size, Math.sin(i * Math.PI / 3) * size);
            }
            enemyBody.poly(points);
            enemyBody.fill(type.color);
            enemyBody.stroke({width: 2, color: 0x000000, alpha: 0.5}); // Border

            enemyBody.circle(0,0, size * 0.4);
            enemyBody.fill({color: 0xFFFFFF, alpha: 0.3});
            enemyBody.circle(0,0, size * 0.2);
            enemyBody.fill(type.color);


        } else if (typeKey === 'TANK') {
            // Thick-bordered octagon with "armor plate" details
            const points = [];
            for (let i = 0; i < 8; i++) {
                points.push(Math.cos(i * Math.PI / 4) * size, Math.sin(i * Math.PI / 4) * size);
            }
            enemyBody.poly(points);
            enemyBody.fill({color: type.color, alpha: 0.7});
            enemyBody.stroke({width: size * 0.2, color: type.color, alpha: 1}); // Thick border

            // Armor plates (simplified as lines/rects for graphics)
            for (let i = 0; i < 4; i++) {
                const angle = i * Math.PI / 2 + Math.PI / 8;
                enemyBody.moveTo(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5);
                enemyBody.lineTo(Math.cos(angle) * size * 0.9, Math.sin(angle) * size * 0.9);
                enemyBody.stroke({width: 2, color: 0x000000, alpha: 0.4});
            }

        } else if (typeKey === 'FAST') {
            // Elongated diamond shape
            const points = [
                0, -size,        // Top point
                size * 0.6, 0,   // Right point
                0, size,         // Bottom point
                -size * 0.6, 0   // Left point
            ];
            enemyBody.poly(points);
            enemyBody.fill(type.color);
            enemyBody.stroke({width: 1, color: 0xFFFFFF, alpha: 0.5});
        } else { // Default to circle if type not recognized
            enemyBody.circle(0, 0, size);
            enemyBody.fill(type.color);
            enemyBody.circle(0, 0, size * 0.7);
            enemyBody.fill({ color: 0xffffff, alpha: 0.2 });
        }
        
        const healthBarContainer = new PIXI.Container();
        const healthBarBg = new PIXI.Graphics();
        const healthBarFg = new PIXI.Graphics();
        
        const healthBarYOffset = -(size + 10);
        healthBarBg.roundRect(-size, healthBarYOffset, size * 2, 5, 2);
        healthBarBg.fill(STYLES.colors.healthBar.background);
        healthBarBg.stroke({ width: 1, color: STYLES.colors.healthBar.border });
        
        healthBarFg.roundRect(-size, healthBarYOffset, size * 2, 5, 2);
        healthBarFg.fill(STYLES.colors.healthBar.health);
        
        healthBarContainer.addChild(healthBarBg, healthBarFg);
        container.addChild(enemyBody, healthBarContainer);
        
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
            enemyBody.alpha = 0.8 + Math.sin(Date.now() / 300) * 0.2; // Apply to enemyBody
        };
        app.ticker.add(pulseAnimation);
        container.pulseAnimation = pulseAnimation;

        return container;
    }

    static createBullet(startX, startY, targetX, targetY) {
        const container = new PIXI.Container();
        const bulletWidth = 12; // Increased width
        const bulletHeight = 6; // Increased height
        
        const bullet = new PIXI.Graphics();
        // Elongated shape (thin rectangle with rounded ends)
        bullet.roundRect(-bulletWidth / 2, -bulletHeight / 2, bulletWidth, bulletHeight, bulletHeight / 2);
        bullet.fill(STYLES.colors.bullet);
        
        const glow = new PIXI.Graphics();
        // Adjusted glow for the new shape
        glow.roundRect(-bulletWidth / 2 - 2, -bulletHeight / 2 - 2, bulletWidth + 4, bulletHeight + 4, (bulletHeight + 4) / 2);
        glow.fill({ color: STYLES.colors.bullet, alpha: 0.25 });
        
        container.addChild(glow, bullet);
        
        // Rotate bullet to face movement direction
        const angleDeg = Math.atan2(targetY - startY, targetX - startX) * 180 / Math.PI;
        container.rotation = Math.PI / 180 * angleDeg;

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
        gem.poly([
            -8, 0,   // Left point
            0, -12,  // Top point
            8, 0,    // Right point
            0, 12    // Bottom point
        ]);
        gem.fill(STYLES.colors.exp);
        
        // Add inner highlight
        const highlight = new PIXI.Graphics();
        highlight.poly([
            -4, 0,
            0, -6,
            4, 0,
            0, 6
        ]);
        highlight.fill({ color: 0xffffff, alpha: 0.5 });
        
        // Add glow effect
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, 15);
        glow.fill({ color: STYLES.colors.exp, alpha: 0.3 });
        
        // Add value text
        const valueText = new PIXI.Text({
            text: `${value}`,
            style: {
                fontSize: 14,
                fill: 0xffffff,
                fontWeight: 'bold',
                dropShadow: {
                    color: 0x000000,
                    distance: 1,
                    alpha: 0.75 // Added alpha for drop shadow
                }
            }
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
        entity.destroy({ children: true }); // Ensure complete cleanup
    }
} 