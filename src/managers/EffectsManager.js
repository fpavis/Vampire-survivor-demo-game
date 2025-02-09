/**
 * @file EffectsManager.js
 * @description Manages visual effects and particle systems in the game, including hit effects,
 * death animations, damage numbers, and other visual feedback elements.
 * 
 * @module managers/EffectsManager
 * @requires core/config
 * 
 * Key Features:
 * - Creates particle effects for hits and deaths
 * - Displays floating damage numbers
 * - Manages visual feedback effects
 * - Handles effect cleanup and lifecycle
 * - Controls visual polish and game feel
 * 
 * Usage:
 * ```js
 * const effectsManager = new EffectsManager(app, worldContainer);
 * effectsManager.createHitEffect(x, y);
 * effectsManager.createDamageNumber(x, y, damage);
 * effectsManager.createDeathEffect(x, y);
 * ```
 * 
 * Modification Guidelines:
 * - Add new particle effects by creating new effect methods
 * - Modify particle behavior in animateParticles
 * - Adjust visual styles in STYLES configuration
 * - Implement new animation types for different effects
 * - Add screen shake or other game feel elements
 * 
 * @class
 */

import { STYLES } from '../core/config.js';

export class EffectsManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
    }

    createHitEffect(x, y) {
        const effect = new PIXI.Graphics();
        effect
            .fill({ color: 0xFFFFFF, alpha: 0.5 })
            .circle(0, 0, 10);
        
        effect.position.set(x, y);
        this.worldContainer.addChild(effect);

        // Animate and remove
        let scale = 1;
        let alpha = 0.5;
        const expand = () => {
            scale += 0.1;
            alpha -= 0.05;
            effect.scale.set(scale);
            effect.alpha = alpha;
            
            if (alpha > 0) {
                requestAnimationFrame(expand);
            } else {
                this.worldContainer.removeChild(effect);
                effect.destroy();
            }
        };
        expand();
    }

    createDeathEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.DEATH.count;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            particle
                .fill({ color: STYLES.particles.DEATH.color })
                .circle(0, 0, 3);
            
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

    createDamageNumber(x, y, amount) {
        const text = new PIXI.Text({
            text: amount.toString(),
            style: {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xFFFFFF,
                stroke: { color: 0x000000, width: 2 },
                align: 'center'
            }
        });
        text.anchor.set(0.5);
        text.position.set(x, y);
        this.worldContainer.addChild(text);

        // Animate and remove
        let alpha = 1;
        let yOffset = 0;
        const fadeOut = () => {
            alpha -= 0.02;
            yOffset -= 0.5;
            text.alpha = alpha;
            text.y = y + yOffset;
            
            if (alpha > 0) {
                requestAnimationFrame(fadeOut);
            } else {
                this.worldContainer.removeChild(text);
                text.destroy();
            }
        };
        fadeOut();
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