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
import * as PIXI from 'pixi.js';
import { ENEMY_TYPES, STYLES } from '../core/config.js';
import { gameState } from '../core/gameState.js';

class Player extends PIXI.Container {
    constructor(app) {
        super();
        
        if (!app) {
            console.error('Player constructor called without app parameter');
            return;
        }
        
        // Set container properties
        this.label = 'PlayerContainer';
        this.sortableChildren = true;
        this.zIndex = 10;
        this.eventMode = 'static';
        
        // Create player sprite using loaded texture
        const playerTexture = PIXI.Assets.get('player');
        if (gameState.debug) {
            console.log('Player texture:', {
                exists: !!playerTexture,
                valid: playerTexture?.valid,
                width: playerTexture?.width,
                height: playerTexture?.height
            });
        }

        // Create player body with proper transform handling
        if (!playerTexture) {
            if (gameState.debug) console.warn('Using fallback graphics for player');
            const gfx = new PIXI.Graphics()
                .fill({ color: 0x00ff88 })
                .circle(0, 0, 20);
            this.body = gfx;
        } else {
            this.body = PIXI.Sprite.from(playerTexture);
            const desiredSize = 40;
            const scale = desiredSize / Math.max(playerTexture.width, playerTexture.height);
            this.body.scale.set(scale);
        }
        
        // Set body properties with proper transform origin
        this.body.anchor.set(0.5);
        this.body.zIndex = 1;
        this.body.eventMode = 'none';
        this.body.label = 'PlayerBody';
        this.addChild(this.body);
        
        // Add glow effect with proper transform handling
        const glowTexture = PIXI.Assets.get('playerGlow');
        if (glowTexture) {
            this.glow = PIXI.Sprite.from(glowTexture);
            this.glow.anchor.set(0.5);
            this.glow.zIndex = 0;
            this.glow.eventMode = 'none';
            this.glow.label = 'PlayerGlow';
            const glowScale = (this.body.width * 1.25) / glowTexture.width;
            this.glow.scale.set(glowScale);
            this.addChild(this.glow);
        }
        
        // Create health bar container with proper screen-space positioning
        this.healthBarContainer = new PIXI.Container();
        this.healthBarContainer.position.set(-20, -35);
        this.healthBarContainer.zIndex = 2;
        this.healthBarContainer.eventMode = 'none';
        this.healthBarContainer.label = 'PlayerHealthBarContainer';
        this.addChild(this.healthBarContainer);
        
        // Health bar background with proper bounds
        this.healthBarBg = new PIXI.Graphics()
            .fill({ color: 0x000000, alpha: 0.5 })
            .rect(0, 0, 40, 5);
        this.healthBarBg.label = 'PlayerHealthBarBg';
        this.healthBarContainer.addChild(this.healthBarBg);
        
        // Health bar foreground with proper bounds
        this.healthBarFg = new PIXI.Graphics()
            .fill({ color: 0x00FF00 })
            .rect(0, 0, 40, 5);
        this.healthBarFg.label = 'PlayerHealthBarFg';
        this.healthBarContainer.addChild(this.healthBarFg);
        
        // Set properties
        this.health = 100;
        this.maxHealth = 100;
        this.radius = 20;
        this.type = 'player';
        this.speed = 5;
        
        // Initialize transform matrix after all children are added
        if (this.transform) {
            this.transform.setFromMatrix(new PIXI.Matrix());
        }
        
        // Ensure visibility
        this.visible = true;
        this.alpha = 1;
        
        if (gameState.debug) {
            console.log('Player setup complete:', {
                position: { x: this.x, y: this.y },
                dimensions: {
                    width: this.width,
                    height: this.height,
                    radius: this.radius
                },
                visibility: {
                    visible: this.visible,
                    alpha: this.alpha
                },
                components: {
                    body: {
                        type: this.body instanceof PIXI.Sprite ? 'Sprite' : 'Graphics',
                        scale: this.body.scale,
                        anchor: this.body.anchor,
                        visible: this.body.visible
                    },
                    glow: this.glow ? {
                        scale: this.glow.scale,
                        alpha: this.glow.alpha,
                        visible: this.glow.visible
                    } : null,
                    healthBar: {
                        position: {
                            x: this.healthBarContainer.x,
                            y: this.healthBarContainer.y
                        },
                        visible: this.healthBarContainer.visible,
                        children: this.healthBarContainer.children.length
                    }
                },
                children: this.children.map(child => ({
                    label: child.label,
                    visible: child.visible,
                    position: { x: child.x, y: child.y }
                }))
            });
        }
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
        // Set rotation and update transform
        this.rotation = angle;
        this.transform.updateTransform(this.parent.transform);
    }

    getWorldPosition() {
        // Use PixiJS's native transform system for accurate world position
        return this.getGlobalPosition(new PIXI.Point(), true);
    }

    getScreenPosition() {
        // Get screen position using parent's transform
        return this.parent.toGlobal(this.position, undefined, true);
    }

    setWorldPosition(x, y) {
        if (!this.parent) {
            console.error('Cannot set world position: no parent container');
            return;
        }

        // Create a temporary point for position conversion
        const worldPoint = new PIXI.Point(x, y);
        
        // Convert world coordinates to local using parent's transform
        const localPos = this.parent.toLocal(worldPoint);
        
        // Set position using local coordinates
        this.position.set(localPos.x, localPos.y);
        
        // Update transform
        if (this.transform) {
            this.transform.updateTransform(this.parent.transform);
        }
    }
}

export { Player };  // Explicit export

export class EntityManager {
    static createPlayer(app) {
        if (gameState.debug) console.log('EntityManager.createPlayer called with app:', !!app);
        if (!app) {
            console.error('createPlayer called without app parameter');
            return null;
        }
        const player = new Player(app);
        if (gameState.debug) {
            console.log('Player instance created:', {
                success: !!player,
                type: player?.type,
                position: player ? { x: player.x, y: player.y } : null,
                dimensions: player ? {
                    width: player.width,
                    height: player.height,
                    radius: player.radius
                } : null
            });
        }
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
        container.label = 'ExperienceGemContainer';
        container.sortableChildren = true;
        container.eventMode = 'none';
        
        // Create glow effect
        const glow = new PIXI.Graphics()
            .fill({ color: STYLES.colors.exp, alpha: 0.3 })
            .circle(0, 0, 12);
        glow.label = 'GemGlow';
        container.addChild(glow);
        
        // Create gem shape
        const gem = new PIXI.Graphics()
            .fill({ color: STYLES.colors.exp })
            .poly(0, 0, [
                -6, 0,   // Left point
                0, -8,   // Top point
                6, 0,    // Right point
                0, 8     // Bottom point
            ]);
        gem.label = 'GemBody';
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
        valueText.label = 'GemText';
        container.addChild(valueText);
        
        // Set container position
        container.position.set(x, y);
        
        // Add pulsing animation using shared ticker
        let pulseTime = Math.random() * Math.PI * 2;
        const updatePulse = (delta) => {
            pulseTime += delta * 0.1;
            const scale = 1 + Math.sin(pulseTime) * 0.1;
            gem.scale.set(scale);
            glow.scale.set(scale);
            valueText.scale.set(scale);
        };
        
        // Use shared ticker for animation
        PIXI.Ticker.shared.add(updatePulse);

        return {
            sprite: container,
            value: value,
            cleanup: () => {
                PIXI.Ticker.shared.remove(updatePulse);
                container.destroy({ children: true });
            }
        };
    }

    static cleanup(app, entity) {
        if (!entity) return;
        
        // Remove from parent
        if (entity.parent) {
            entity.parent.removeChild(entity);
        }
        
        // Destroy the entity and all children
        entity.destroy({ 
            children: true,
            texture: true,
            baseTexture: false 
        });
    }
}

export class Enemy extends PIXI.Container {
    constructor(type = 'BASIC', x = 0, y = 0, app) {
        super();
        
        // Set container properties with proper transform handling
        this.label = 'EnemyContainer';
        this.sortableChildren = true;
        this.zIndex = 5;
        this.eventMode = 'none';
        
        // Initialize transform matrix
        this.transform.setFromMatrix(new PIXI.Matrix());
        
        // Get enemy config
        const enemyConfig = ENEMY_TYPES[type];
        if (!enemyConfig) {
            console.error(`Invalid enemy type: ${type}`);
            return;
        }
        
        // Set enemy properties
        this.type = type;
        this.health = enemyConfig.health || 100;
        this.maxHealth = this.health;
        this.speed = enemyConfig.speed || 2;
        this.radius = enemyConfig.size || 20;
        this.experienceValue = enemyConfig.experience || 10;
        this.isElite = false;
        
        // Create enemy sprite with proper transform handling
        const textureName = enemyConfig.texture || 'basicEnemy';
        const enemyTexture = PIXI.Assets.get(textureName);
        
        if (!enemyTexture) {
            if (gameState.debug) console.warn('Using fallback graphics for enemy');
            const gfx = new PIXI.Graphics()
                .fill({ color: enemyConfig.color || 0xFF0000 })
                .circle(0, 0, this.radius);
            this.body = gfx;
        } else {
            this.body = PIXI.Sprite.from(enemyTexture);
            const scale = (this.radius * 2) / Math.max(enemyTexture.width, enemyTexture.height);
            this.body.scale.set(scale);
        }
        
        // Set body properties with proper transform origin
        this.body.anchor.set(0.5);
        this.body.zIndex = 1;
        this.body.eventMode = 'none';
        this.body.label = 'EnemyBody';
        this.addChild(this.body);
        
        // Create health bar with proper screen-space positioning
        this.healthBarContainer = new PIXI.Container();
        this.healthBarContainer.position.set(-20, -30);
        this.healthBarContainer.zIndex = 2;
        this.healthBarContainer.eventMode = 'none';
        this.healthBarContainer.label = 'EnemyHealthBarContainer';
        this.addChild(this.healthBarContainer);
        
        // Health bar background
        this.healthBarBg = new PIXI.Graphics()
            .fill({ color: 0x000000, alpha: 0.5 })
            .rect(0, 0, 40, 4);
        this.healthBarBg.label = 'EnemyHealthBarBg';
        this.healthBarContainer.addChild(this.healthBarBg);
        
        // Health bar foreground
        this.healthBarFg = new PIXI.Graphics()
            .fill({ color: 0xFF0000 })
            .rect(0, 0, 40, 4);
        this.healthBarFg.label = 'EnemyHealthBarFg';
        this.healthBarContainer.addChild(this.healthBarFg);
        
        // Set initial position with proper transform
        this.setWorldPosition(x, y);
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
                this.eliteGlow = PIXI.Sprite.from(glowTexture);
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

    setWorldPosition(x, y) {
        // Convert world coordinates to local space using parent's transform
        const localPos = this.parent.toLocal(new PIXI.Point(x, y), undefined, true);
        this.position.set(localPos.x, localPos.y);
        
        // Update transform matrix
        this.transform.updateTransform(this.parent.transform);
    }

    getWorldPosition() {
        // Use PixiJS's native transform system for accurate world position
        return this.getGlobalPosition(new PIXI.Point(), true);
    }
} 