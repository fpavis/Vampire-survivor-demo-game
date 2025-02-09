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

import * as PIXI from 'pixi.js';
import { STYLES } from '../core/config.js';

export class EffectsManager {
    constructor(app, viewport, worldContainer, effectsLayer) {
        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;
        this.effectsLayer = effectsLayer;
        
        if (!this.worldContainer) {
            console.error('EffectsManager: WorldContainer not provided');
            return;
        }
        
        if (!this.effectsLayer) {
            console.error('EffectsManager: EffectsLayer not provided');
            return;
        }
    }

    createHitEffect(x, y) {
        const effect = new PIXI.Graphics();
        effect
            .fill({ color: 0xFFFFFF, alpha: 0.5 })
            .circle(0, 0, 10);
        
        // Convert to world coordinates if needed
        const worldPos = this.viewport.toWorld(new PIXI.Point(x, y));
        effect.position.set(worldPos.x, worldPos.y);
        this.effectsLayer.addChild(effect);

        if (gameState.debug) {
            console.log('Hit effect created:', {
                screen: { x, y },
                world: worldPos,
                alpha: effect.alpha,
                visible: effect.visible
            });
        }

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
                this.effectsLayer.removeChild(effect);
                effect.destroy();
            }
        };
        expand();
    }

    createDeathEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.DEATH.count;
        
        // Convert to world coordinates if needed
        const worldPos = this.viewport.toWorld(new PIXI.Point(x, y));
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            particle
                .fill({ color: STYLES.particles.DEATH.color })
                .circle(0, 0, 3);
            
            const angle = Math.random() * Math.PI * 2;
            const speed = STYLES.particles.DEATH.speed * (0.5 + Math.random() * 0.5);
            
            particle.x = worldPos.x;
            particle.y = worldPos.y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.alpha = 1;
            
            this.effectsLayer.addChild(particle);
            particles.push(particle);
        }
        
        if (gameState.debug) {
            console.log('Death effect created:', {
                screen: { x, y },
                world: worldPos,
                particles: particleCount,
                visible: particles.every(p => p.visible)
            });
        }
        
        this.animateParticles(particles, 0.02);
    }

    createDamageNumber(x, y, amount) {
        // Convert to world coordinates if needed
        const worldPos = this.viewport.toWorld(new PIXI.Point(x, y));
        
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
        text.position.set(worldPos.x, worldPos.y);
        this.effectsLayer.addChild(text);

        if (gameState.debug) {
            console.log('Damage number created:', {
                amount,
                screen: { x, y },
                world: worldPos,
                visible: text.visible
            });
        }

        // Animate and remove
        let alpha = 1;
        let yOffset = 0;
        const fadeOut = () => {
            alpha -= 0.02;
            yOffset -= 0.5;
            text.alpha = alpha;
            text.y = worldPos.y + yOffset;
            
            if (alpha > 0) {
                requestAnimationFrame(fadeOut);
            } else {
                this.effectsLayer.removeChild(text);
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
                    this.effectsLayer.removeChild(p);
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
        
        if (gameState.debug) {
            const worldPos = this.viewport.toWorld(target.position);
            const screenPos = this.viewport.toScreen(target.position);
            console.log('Flash effect created:', {
                target: target.label || 'unknown',
                screen: screenPos,
                world: worldPos,
                color,
                duration
            });
        }
        
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
        
        if (gameState.debug) {
            const worldPos = this.viewport.toWorld(target.position);
            const screenPos = this.viewport.toScreen(target.position);
            console.log('Pulse effect created:', {
                target: target.label || 'unknown',
                screen: screenPos,
                world: worldPos,
                scale,
                duration
            });
        }
        
        // Scale back down
        setTimeout(() => {
            if (target) {
                target.scale.set(originalScale.x, originalScale.y);
            }
        }, duration);
    }
} 