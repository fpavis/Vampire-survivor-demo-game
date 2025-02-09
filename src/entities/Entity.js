/**
 * @file Entity.js
 * @description Manages the creation and configuration of all game entities including
 * the player, enemies, projectiles, and collectibles. Provides factory methods for
 * entity creation with proper properties and visual elements.
 * 
 * @module entities/Entity
 * @requires core/config
 * @requires core/gameState
 * 
 * Key Features:
 * - Creates and configures game entities
 * - Manages entity visual representations
 * - Handles entity cleanup and disposal
 * - Sets up entity properties and behaviors
 * - Creates particle effects and animations
 * 
 * Usage:
 * ```js
 * // Create player
 * const player = EntityManager.createPlayer(app);
 * 
 * // Create enemy
 * const enemy = EntityManager.createEnemy(app, 'BASIC', x, y);
 * 
 * // Create projectile
 * const bullet = EntityManager.createBullet(startX, startY, targetX, targetY);
 * 
 * // Create collectible
 * const gem = EntityManager.createExperienceGem(x, y, value);
 * ```
 * 
 * Entity Types:
 * - Player: Main character with health and collision
 * - Enemies: Various enemy types with behaviors
 * - Projectiles: Bullets and attack effects
 * - Collectibles: Experience gems and power-ups
 * 
 * Modification Guidelines:
 * - Add new entity types with appropriate properties
 * - Modify entity visuals and animations
 * - Add new entity behaviors and effects
 * - Implement new particle systems
 * - Extend cleanup procedures for new types
 * 
 * @class
 */

/* eslint-disable no-unused-vars */
import { ENEMY_TYPES, STYLES } from '../core/config.js';
import { gameState } from '../core/gameState.js';

class Player extends PIXI.Container {
    constructor(app) {
        super();
        
        if (!app) {
            console.error('Player constructor called without app parameter');
            return;
        }
        
        console.log('Creating player instance...', { app: !!app });
        
        this.label = 'PlayerContainer';
        
        // Set container properties
        this.sortableChildren = true;
        this.zIndex = 10;
        this.eventMode = 'static';
        
        // Create player sprite using loaded texture
        const playerTexture = PIXI.Assets.get('player');
        console.log('Player texture:', {
            exists: !!playerTexture,
            valid: playerTexture?.valid,
            width: playerTexture?.width,
            height: playerTexture?.height
        });

        // Create player body
        if (!playerTexture) {
            console.warn('Using fallback graphics for player');
            // Create a fallback graphics for debugging
            const gfx = new PIXI.Graphics()
                .fill({ color: 0x00ff88 })
                .circle(0, 0, 20);
            this.body = gfx;
        } else {
            this.body = new PIXI.Sprite(playerTexture);
            // Set the sprite's scale to match the desired size
            const desiredSize = 40; // diameter
            const scale = desiredSize / Math.max(playerTexture.width, playerTexture.height);
            this.body.scale.set(scale);
        }
        
        this.body.anchor.set(0.5);
        this.body.zIndex = 1;
        this.body.eventMode = 'none';
        this.body.label = 'PlayerBody';
        this.addChild(this.body);
        
        console.log('Player body created:', {
            type: this.body instanceof PIXI.Sprite ? 'Sprite' : 'Graphics',
            position: { x: this.body.x, y: this.body.y },
            scale: this.body.scale,
            anchor: this.body.anchor,
            parent: !!this.body.parent,
            visible: this.body.visible,
            alpha: this.body.alpha
        });
        
        // Add glow effect
        const glowTexture = PIXI.Assets.get('playerGlow');
        console.log('Player glow texture:', {
            exists: !!glowTexture,
            valid: glowTexture?.valid,
            width: glowTexture?.width,
            height: glowTexture?.height
        });

        if (glowTexture) {
            this.glow = new PIXI.Sprite(glowTexture);
            this.glow.anchor.set(0.5);
            this.glow.zIndex = 0;
            this.glow.eventMode = 'none';
            this.glow.label = 'PlayerGlow';
            // Scale glow to be slightly larger than the body
            const glowScale = (this.body.width * 1.25) / glowTexture.width;
            this.glow.scale.set(glowScale);
            this.addChild(this.glow);
            
            console.log('Player glow created:', {
                position: { x: this.glow.x, y: this.glow.y },
                scale: this.glow.scale,
                anchor: this.glow.anchor,
                parent: !!this.glow.parent,
                visible: this.glow.visible,
                alpha: this.glow.alpha
            });
        }
        
        // Create health bar container
        this.healthBarContainer = new PIXI.Container();
        this.healthBarContainer.position.set(-20, -35);
        this.healthBarContainer.zIndex = 2;
        this.healthBarContainer.eventMode = 'none';
        this.healthBarContainer.label = 'PlayerHealthBarContainer';
        this.addChild(this.healthBarContainer);
        
        // Health bar background
        this.healthBarBg = new PIXI.Graphics()
            .fill({ color: 0x000000, alpha: 0.5 })
            .rect(0, 0, 40, 5);
        this.healthBarBg.label = 'PlayerHealthBarBg';
        this.healthBarContainer.addChild(this.healthBarBg);
        
        // Health bar foreground
        this.healthBarFg = new PIXI.Graphics()
            .fill({ color: 0x00FF00 })
            .rect(0, 0, 40, 5);
        this.healthBarFg.label = 'PlayerHealthBarFg';
        this.healthBarContainer.addChild(this.healthBarFg);
        
        // Set initial position
        const initialX = Math.floor(app.screen.width / 2);
        const initialY = Math.floor(app.screen.height / 2);
        this.position.set(initialX, initialY);
        
        // Set properties
        this.health = 100;
        this.maxHealth = 100;
        this.radius = 20;
        this.type = 'player';
        this.speed = 5;
        
        console.log('Player container setup:', {
            position: { x: this.x, y: this.y },
            children: this.children.length,
            visible: this.visible,
            alpha: this.alpha,
            bounds: this.getBounds(),
            parent: !!this.parent
        });
    }
    
    updateHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        this.healthBarFg.clear();
        this.healthBarFg
            .fill({ color: healthPercent < 0.3 ? 0xFF0000 : 0x00FF00 })
            .rect(0, 0, 40 * healthPercent, 5);
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        // Visual feedback
        this.alpha = 0.5;
        setTimeout(() => this.alpha = 1, 100);
        
        return this.health <= 0;
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.updateHealthBar();
        
        // Visual feedback
        const healEffect = new PIXI.Graphics()
            .fill({ color: 0x00FF00, alpha: 0.5 })
            .circle(0, 0, this.radius * 1.5);
        this.addChild(healEffect);
        
        // Animate and remove heal effect
        let alpha = 0.5;
        const fadeOut = () => {
            alpha -= 0.05;
            healEffect.alpha = alpha;
            if (alpha > 0) {
                requestAnimationFrame(fadeOut);
            } else {
                this.removeChild(healEffect);
            }
        };
        fadeOut();
    }
    
    setRotation(angle) {
        this.rotation = angle;
        // Update weapon indicator rotation if it exists
        /*
        if (this.weaponIndicator) {
            this.weaponIndicator.rotation = angle;
        }
        */
    }
}

export { Player };  // Explicit export

export class EntityManager {
    static createPlayer(app) {
        console.log('EntityManager.createPlayer called with app:', !!app);
        if (!app) {
            console.error('createPlayer called without app parameter');
            return null;
        }
        const player = new Player(app);
        console.log('Player instance created:', !!player);
        return player;
    }

    static createEnemy(app, type, x, y) {
        const enemy = new Enemy(type, x, y, app);
        return enemy;
    }

    static createBullet(startX, startY, targetX, targetY) {
        const container = new PIXI.Container();
        
        // Create bullet glow effect
        const glow = new PIXI.Graphics();
        glow
            .fill({ color: STYLES.colors.bullet, alpha: 0.3 })
            .circle(0, 0, 8);
        container.addChild(glow);
        
        // Create bullet trail effect
        const trail = new PIXI.Graphics();
        trail
            .fill({ color: STYLES.colors.bullet, alpha: 0.2 })
            .ellipse(0, 0, 12, 6);
        trail.rotation = Math.atan2(targetY - startY, targetX - startX);
        container.addChild(trail);
        
        // Create bullet core
        const bullet = new PIXI.Graphics();
        bullet
            .fill({ color: STYLES.colors.bullet })
            .circle(0, 0, 4);
        container.addChild(bullet);
        
        // Set container position
        container.x = startX;
        container.y = startY;
        
        // Calculate angle and speed
        const angle = Math.atan2(targetY - startY, targetX - startX);
        const speed = 8;
        
        // Add pulsing animation
        let pulseTime = Math.random() * Math.PI * 2;
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
            width: 8,
            height: 8,
            cleanup: () => {
                if (container.ticker) {
                    container.ticker.destroy();
                }
            }
        };
    }

    static createExperienceGem(x, y, value) {
        const container = new PIXI.Container();
        
        // Create glow effect
        const glow = new PIXI.Graphics();
        glow
            .fill({ color: STYLES.colors.exp, alpha: 0.3 })
            .circle(0, 0, 12);
        container.addChild(glow);
        
        // Create gem shape
        const gem = new PIXI.Graphics();
        const points = [
            -6, 0,   // Left point
            0, -8,   // Top point
            6, 0,    // Right point
            0, 8     // Bottom point
        ];
        gem
            .fill({ color: STYLES.colors.exp })
            .poly(0, 0, points);
        container.addChild(gem);
        
        // Create value text
        const valueText = new PIXI.Text({
            text: `+${value}`,
            style: {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: 0xFFFFFF,
                stroke: { color: 0x000000, width: 2 },
                align: 'center'
            }
        });
        valueText.anchor.set(0.5);
        valueText.y = -20;
        container.addChild(valueText);
        
        // Set container position
        container.position.set(x, y);
        
        // Add pulsing animation
        let pulseTime = Math.random() * Math.PI * 2;
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

export class Enemy extends PIXI.Container {
    constructor(type = 'BASIC', x = 0, y = 0, app) {
        super();
        this.label = 'EnemyContainer';
        
        const config = ENEMY_TYPES[type];
        if (!config) {
            console.error('Invalid enemy type:', type);
            return;
        }
        
        // Set container properties
        this.sortableChildren = true;
        this.zIndex = 5;
        this.eventMode = 'static';
        
        // Create enemy sprite using loaded texture
        const textureName = type.toLowerCase() + 'Enemy';
        const enemyTexture = PIXI.Assets.get(textureName);
        console.log('Enemy texture:', {
            type,
            textureName,
            exists: !!enemyTexture,
            valid: enemyTexture?.valid,
            width: enemyTexture?.width,
            height: enemyTexture?.height
        });

        if (!enemyTexture) {
            console.error('Failed to get enemy texture:', textureName);
            // Create fallback graphics
            this.body = new PIXI.Graphics()
                .fill({ color: config.color || 0xFF0000 })
                .circle(0, 0, config.size);
        } else {
            this.body = new PIXI.Sprite(enemyTexture);
            // Scale sprite to match desired size
            const scale = (config.size * 2) / enemyTexture.width;
            this.body.scale.set(scale);
        }
        
        this.body.anchor.set(0.5);
        this.body.zIndex = 1;
        this.body.eventMode = 'none';
        this.body.label = 'EnemyBody';
        this.addChild(this.body);
        
        console.log('Enemy body created:', {
            type,
            sprite: this.body instanceof PIXI.Sprite,
            position: { x: this.body.x, y: this.body.y },
            scale: this.body.scale,
            size: config.size,
            bounds: this.body.getBounds()
        });
        
        // Create health bar container
        this.healthBarContainer = new PIXI.Container();
        this.healthBarContainer.position.set(-config.size, -config.size - 10);
        this.healthBarContainer.zIndex = 2;
        this.healthBarContainer.eventMode = 'none';
        this.healthBarContainer.label = 'EnemyHealthBarContainer';
        this.addChild(this.healthBarContainer);
        
        // Health bar background
        this.healthBarBg = new PIXI.Graphics()
            .fill({ color: 0x000000, alpha: 0.5 })  // Default black background with transparency
            .rect(0, 0, config.size * 2, 4);
        this.healthBarBg.label = 'EnemyHealthBarBg';
        this.healthBarContainer.addChild(this.healthBarBg);
        
        // Health bar foreground
        this.healthBarFg = new PIXI.Graphics()
            .fill({ color: 0x00FF00 })  // Default green for health
            .rect(0, 0, config.size * 2, 4);
        this.healthBarFg.label = 'EnemyHealthBarFg';
        this.healthBarContainer.addChild(this.healthBarFg);
        
        // Set position and properties
        this.position.set(x, y);
        this.type = type;
        this.radius = config.size;
        this.health = config.health;
        this.maxHealth = config.health;
        this.speed = config.speed;
        this.experienceValue = config.experience;
        
        console.log('Enemy container setup:', {
            type,
            position: { x: this.x, y: this.y },
            children: this.children.length,
            bounds: this.getBounds(),
            visible: this.visible,
            parent: !!this.parent
        });
    }
    
    updateHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        this.healthBarFg.clear();
        this.healthBarFg
            .fill({ color: healthPercent < 0.3 ? 0xFF0000 : 0x00FF00 })
            .rect(0, 0, this.radius * 2 * healthPercent, 4);
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        // Visual feedback
        this.alpha = 0.5;
        setTimeout(() => this.alpha = 1, 100);
        
        return this.health <= 0;
    }
    
    makeElite() {
        this.isElite = true;
        this.health *= 1.5;
        this.maxHealth = this.health;
        this.speed *= 1.2;
        this.experienceValue *= 2;
        
        // Add elite glow
        if (!this.eliteGlow) {
            const glowTexture = PIXI.Assets.get('eliteGlow');
            if (glowTexture) {
                this.eliteGlow = new PIXI.Sprite(glowTexture);
                this.eliteGlow.anchor.set(0.5);
                this.eliteGlow.zIndex = -1;
                // Scale glow to be slightly larger than the body
                const glowScale = (this.body.width * 1.25) / glowTexture.width;
                this.eliteGlow.scale.set(glowScale);
                this.addChild(this.eliteGlow);
                
                console.log('Elite glow added:', {
                    scale: this.eliteGlow.scale,
                    bounds: this.eliteGlow.getBounds(),
                    visible: this.eliteGlow.visible,
                    parent: !!this.eliteGlow.parent
                });
            } else {
                console.warn('Elite glow texture not found');
            }
        }
        
        // Scale up the body
        this.body.scale.set(this.body.scale.x * 1.2);
        this.updateHealthBar();
    }
} 