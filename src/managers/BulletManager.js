import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';
import { STYLES } from '../core/config.js';

class Bullet extends PIXI.Container {
    constructor(x, y, angle, speed, app) {
        super();
        
        // Set container properties
        this.label = 'BulletContainer';
        this.sortableChildren = true;
        this.zIndex = 8;  // Above enemies, below player
        this.eventMode = 'none';
        
        // Initialize transform matrix
        this.transform.setFromMatrix(new PIXI.Matrix());
        
        // Position and movement in world coordinates
        this.position.set(x, y);
        this.rotation = angle;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        
        // Create bullet core using loaded texture
        const bulletTexture = PIXI.Assets.get('bullet');
        if (!bulletTexture?.valid) {
            if (gameState.debug) console.warn('Using fallback bullet graphics');
            // Create fallback graphics
            this.body = new PIXI.Graphics()
                .fill({ color: STYLES.colors.bullet || 0xffdd00 })
                .circle(0, 0, 5);
        } else {
            this.body = PIXI.Sprite.from(bulletTexture);
            // Scale sprite to desired size
            const desiredSize = 10;
            const scale = desiredSize / Math.max(bulletTexture.width, bulletTexture.height);
            this.body.scale.set(scale);
        }
        
        // Set body properties
        this.body.anchor.set(0.5);
        this.body.eventMode = 'none';
        this.body.zIndex = 1;
        this.body.label = 'BulletBody';
        this.addChild(this.body);
        
        // Create bullet glow using loaded texture
        const glowTexture = PIXI.Assets.get('bulletGlow');
        if (glowTexture) {
            this.glow = PIXI.Sprite.from(glowTexture);
            this.glow.anchor.set(0.5);
            this.glow.zIndex = 0;
            this.glow.eventMode = 'none';
            this.glow.label = 'BulletGlow';
            const glowScale = (this.body.width * 1.5) / glowTexture.width;
            this.glow.scale.set(glowScale);
            this.addChild(this.glow);
            
            // Add glow animation
            let glowTime = Math.random() * Math.PI * 2;
            const updateGlow = (delta) => {
                glowTime += delta * 0.1;
                const scale = 1 + Math.sin(glowTime) * 0.2;
                this.glow.scale.set(glowScale * scale);
            };
            PIXI.Ticker.shared.add(updateGlow);
            
            // Store cleanup function
            this._cleanupGlow = () => {
                PIXI.Ticker.shared.remove(updateGlow);
            };
        }
    }
    
    update(delta) {
        // Update position based on velocity
        this.position.x += this.velocity.x * delta;
        this.position.y += this.velocity.y * delta;
        
        // Update transform
        this.transform.updateTransform(this.parent.transform);
    }
    
    cleanup() {
        // Remove glow animation if exists
        if (this._cleanupGlow) {
            this._cleanupGlow();
        }
        
        // Remove from parent and destroy
        if (this.parent) {
            this.parent.removeChild(this);
        }
        this.destroy({ children: true, texture: true });
    }
}

export class BulletManager {
    constructor(app, viewport, worldContainer, bulletLayer) {
        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;
        this.bulletLayer = bulletLayer;
        
        if (!this.viewport) {
            console.error('BulletManager: Viewport not provided');
            return;
        }
        
        if (!this.worldContainer) {
            console.error('BulletManager: WorldContainer not provided');
            return;
        }
        
        if (!this.bulletLayer) {
            console.error('BulletManager: BulletLayer not provided');
            return;
        }
        
        // Initialize bullet pool
        this.bulletPool = [];
        this.maxBullets = 100;
        
        // Add update to system ticker for consistent updates
        PIXI.Ticker.system.add(this.update, this, PIXI.UPDATE_PRIORITY.HIGH);
    }
    
    createBullet(startX, startY, targetX, targetY, speed = 8) {
        // Calculate angle
        const angle = Math.atan2(targetY - startY, targetX - startX);
        
        // Try to reuse a bullet from the pool
        let bullet = this.bulletPool.pop();
        if (!bullet) {
            bullet = new Bullet(startX, startY, angle, speed, this.app);
        } else {
            // Reset bullet properties
            bullet.position.set(startX, startY);
            bullet.rotation = angle;
            bullet.velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            };
            bullet.visible = true;
        }
        
        // Add to bullet layer and game state
        this.bulletLayer.addChild(bullet);
        gameState.bullets.push(bullet);
        
        return bullet;
    }
    
    update = (delta) => {
        if (gameState.gameOver || gameState.paused) return;
        
        // Update all active bullets
        gameState.bullets.forEach((bullet, index) => {
            if (bullet && bullet.velocity) {
                // Update position based on velocity
                bullet.position.x += bullet.velocity.x * delta;
                bullet.position.y += bullet.velocity.y * delta;
                
                // Update transform
                bullet.transform.updateTransform(this.bulletLayer.transform);
                
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
                    this.recycleBullet(bullet);
                    gameState.bullets.splice(index, 1);
                }
            }
        });
    }
    
    recycleBullet(bullet) {
        // Remove from layer
        this.bulletLayer.removeChild(bullet);
        
        // Add to pool if not full
        if (this.bulletPool.length < this.maxBullets) {
            bullet.visible = false;
            this.bulletPool.push(bullet);
        } else {
            bullet.cleanup();
        }
    }
    
    cleanup() {
        // Remove update ticker
        PIXI.Ticker.system.remove(this.update, this);
        
        // Clean up all bullets
        this.bulletLayer.children.forEach(bullet => {
            bullet.cleanup();
        });
        this.bulletLayer.removeChildren();
        
        // Clear bullet pool
        this.bulletPool.forEach(bullet => {
            bullet.cleanup();
        });
        this.bulletPool = [];
    }
} 