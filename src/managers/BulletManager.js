import { gameState } from '../core/gameState.js';
import { STYLES } from '../core/config.js';

class Bullet extends PIXI.Container {
    constructor(x, y, angle, speed, app) {
        super();
        
        // Set container properties
        this.sortableChildren = true;
        this.zIndex = 8;  // Above enemies, below player
        this.eventMode = 'none';
        
        // Position and movement
        this.position.set(x, y);
        this.rotation = angle;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        
        // Create bullet core using loaded texture
        const bulletTexture = PIXI.Assets.cache.get('bullet');
        if (!bulletTexture || !bulletTexture.valid) {
            console.error('Invalid bullet texture:', bulletTexture);
            return;
        }
        
        this.body = new PIXI.Sprite(bulletTexture);
        this.body.anchor.set(0.5);
        this.body.eventMode = 'none';
        this.addChild(this.body);
        
        // Create bullet glow using loaded texture
        const glowTexture = PIXI.Assets.cache.get('bulletGlow');
        if (glowTexture?.valid) {
            this.glow = new PIXI.Sprite(glowTexture);
            this.glow.anchor.set(0.5);
            this.glow.eventMode = 'none';
            this.glow.zIndex = -1;
            this.addChild(this.glow);
        } else {
            console.warn('Invalid bullet glow texture:', glowTexture);
        }
        
        // Create trail using the bullet texture
        if (bulletTexture.valid) {
            this.trail = new PIXI.Sprite(bulletTexture);
            this.trail.anchor.set(0.5);
            this.trail.eventMode = 'none';
            this.trail.zIndex = -2;
            this.trail.alpha = 0.3;
            this.trail.scale.set(0.6);
            this.trail.x = -Math.cos(angle) * 5;
            this.trail.y = -Math.sin(angle) * 5;
            this.addChild(this.trail);
        }
        
        console.log('Bullet sprites created:', {
            position: { x: this.x, y: this.y },
            velocity: this.velocity,
            sprites: {
                body: {
                    texture: !!this.body.texture,
                    visible: this.body.visible,
                    parent: this.body.parent === this
                },
                glow: this.glow ? {
                    texture: !!this.glow.texture,
                    visible: this.glow.visible,
                    parent: this.glow.parent === this
                } : 'not created',
                trail: this.trail ? {
                    texture: !!this.trail.texture,
                    visible: this.trail.visible,
                    parent: this.trail.parent === this
                } : 'not created'
            }
        });
    }
    
    update(delta) {
        // Update position
        this.x += this.velocity.x * delta;
        this.y += this.velocity.y * delta;
        
        // Update trail
        if (this.trail) {
            this.trail.alpha = Math.max(0.1, this.trail.alpha - 0.1 * delta);
        }
        
        // Update glow
        if (this.glow) {
            const pulseScale = 1 + Math.sin(performance.now() * 0.01) * 0.2;
            this.glow.scale.set(pulseScale);
        }
    }
}

export class BulletManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
        this.bulletSpeed = 10;
    }
    
    createBullet(x, y, angle) {
        const bullet = new Bullet(x, y, angle, this.bulletSpeed, this.app);
        
        // Add bullet to world container
        this.worldContainer.addChild(bullet);
        gameState.bullets.push(bullet);
        
        return bullet;
    }
    
    updateBullets(delta) {
        gameState.bullets.forEach(bullet => {
            bullet.update(delta);
        });
    }
} 