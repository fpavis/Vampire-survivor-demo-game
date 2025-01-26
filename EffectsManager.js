import { STYLES } from './config.js';

export class EffectsManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
    }

    createHitEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.HIT.count;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(STYLES.particles.HIT.color);
            particle.drawCircle(0, 0, 2);
            particle.endFill();
            
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = STYLES.particles.HIT.speed;
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.alpha = 1;
            
            this.worldContainer.addChild(particle);
            particles.push(particle);
        }
        
        this.animateParticles(particles, 0.05);
    }

    createDeathEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.DEATH.count;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(STYLES.particles.DEATH.color);
            particle.drawCircle(0, 0, 3);
            particle.endFill();
            
            const angle = Math.random() * Math.PI * 2;
            const speed = STYLES.particles.DEATH.speed * (0.5 + Math.random() * 0.5);
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.alpha = 1;
            
            this.worldContainer.addChild(particle);
            particles.push(particle);
        }
        
        this.animateParticles(particles, 0.02);
    }

    createDamageNumber(x, y, damage) {
        const container = new PIXI.Container();
        container.x = x;
        container.y = y;

        // Create the damage text with outline
        const text = new PIXI.Text(Math.round(damage), {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xFF0000,
            stroke: 0x000000,
            strokeThickness: 3,
            align: 'center'
        });
        text.anchor.set(0.5);
        container.addChild(text);

        // Add to world container
        this.worldContainer.addChild(container);

        // Animation variables
        let lifetime = 0;
        const TOTAL_LIFETIME = 60; // frames
        const moveSpeed = 1;
        const fadeStart = 30; // when to start fading

        // Create animation ticker
        const ticker = new PIXI.Ticker();
        ticker.add((delta) => {
            lifetime += delta;
            
            // Move upward
            container.y -= moveSpeed * delta;
            
            // Start fading after fadeStart frames
            if (lifetime > fadeStart) {
                const fadeProgress = (lifetime - fadeStart) / (TOTAL_LIFETIME - fadeStart);
                container.alpha = 1 - fadeProgress;
            }
            
            // Remove when animation is complete
            if (lifetime >= TOTAL_LIFETIME) {
                ticker.destroy();
                this.worldContainer.removeChild(container);
                container.destroy({ children: true });
            }
        });
        ticker.start();
    }

    animateParticles(particles, fadeRate) {
        const animate = () => {
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= fadeRate;
                if (p.alpha <= 0) {
                    this.worldContainer.removeChild(p);
                }
            });
            
            if (particles[0].alpha > 0) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    createFlashEffect(target, color = 0xFF0000, duration = 200) {
        // Store original tint
        const originalTint = target.tint;
        
        // Apply flash color
        target.tint = color;
        
        // Reset after duration
        setTimeout(() => {
            if (target) {
                target.tint = originalTint;
            }
        }, duration);
    }

    createPulseEffect(target, scale = 1.2, duration = 200) {
        // Store original scale
        const originalScale = { x: target.scale.x, y: target.scale.y };
        
        // Scale up
        target.scale.set(originalScale.x * scale, originalScale.y * scale);
        
        // Scale back down
        setTimeout(() => {
            if (target) {
                target.scale.set(originalScale.x, originalScale.y);
            }
        }, duration);
    }
} 