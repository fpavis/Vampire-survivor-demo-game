/**
 * @file EffectsManager.js
 * @description Manages visual effects and particle systems using PixiJS v8 features.
 * Handles particle effects, animations, and visual feedback with proper layer management.
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
    /**
     * @param {PIXI.Application} app - The main PixiJS application
     * @param {import('pixi-viewport').Viewport} viewport - The viewport instance
     * @param {PIXI.Container} worldContainer - The main world container
     */
    constructor(app, viewport, worldContainer) {
        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;

        // Create dedicated layers for different types of effects
        this.layers = {
            background: new PIXI.Container(),
            particles: new PIXI.Container(),
            foreground: new PIXI.Container()
        };

        // Set up layer hierarchy
        Object.values(this.layers).forEach(layer => {
            // Enable culling for performance
            layer.cullable = true;
            this.worldContainer.addChild(layer);
        });

        // Create particle container for better performance
        this.particleContainer = new PIXI.ParticleContainer(1000, {
            scale: true,
            position: true,
            rotation: true,
            uvs: true,
            alpha: true
        });
        this.layers.particles.addChild(this.particleContainer);

        // Set up shared graphics for reuse
        this.sharedGraphics = {
            circle: new PIXI.Graphics()
                .circle(0, 0, 1) // Unit circle for scaling
                .fill({ color: 0xFFFFFF }),
            particle: new PIXI.Graphics()
                .circle(0, 0, 1)
                .fill({ color: 0xFFFFFF })
        };

        // Initialize text style
        this.defaultTextStyle = {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xFFFFFF,
            stroke: { color: 0x000000, width: 2 },
            align: 'center'
        };
    }

    /**
     * Creates a hit effect at the specified position
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     */
    createHitEffect(x, y) {
        const effect = new PIXI.Sprite(this.sharedGraphics.circle.texture);
        effect.anchor.set(0.5);
        effect.position.set(x, y);
        effect.tint = STYLES.particles.HIT.color;
        effect.alpha = 0.5;
        effect.scale.set(10); // Initial size

        this.layers.particles.addChild(effect);

        // Use PixiJS ticker for smooth animation
        const duration = STYLES.particles.HIT.lifetime;
        let elapsed = 0;
        
        const animate = (delta) => {
            elapsed += delta;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                this.layers.particles.removeChild(effect);
                effect.destroy();
                return;
            }

            effect.scale.set(10 * (1 + progress));
            effect.alpha = 0.5 * (1 - progress);
            requestAnimationFrame(() => animate(delta));
        };

        this.app.ticker.add(animate);
    }

    /**
     * Creates a death effect at the specified position
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     */
    createDeathEffect(x, y) {
        const particles = [];
        const particleCount = STYLES.particles.DEATH.count;
        const duration = STYLES.particles.DEATH.lifetime;

        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Sprite(this.sharedGraphics.particle.texture);
            particle.anchor.set(0.5);
            particle.position.set(x, y);
            particle.tint = STYLES.particles.DEATH.color;
            particle.scale.set(3);

            const angle = Math.random() * Math.PI * 2;
            const speed = STYLES.particles.DEATH.speed * (0.5 + Math.random() * 0.5);
            particle.velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            };

            this.particleContainer.addChild(particle);
            particles.push(particle);
        }

        let elapsed = 0;
        const animate = (delta) => {
            elapsed += delta;
            const progress = elapsed / duration;

            if (progress >= 1) {
                particles.forEach(p => {
                    this.particleContainer.removeChild(p);
                    p.destroy();
                });
                return;
            }

            particles.forEach(p => {
                p.x += p.velocity.x * delta;
                p.y += p.velocity.y * delta;
                p.alpha = 1 - progress;
            });

            requestAnimationFrame(() => animate(delta));
        };

        this.app.ticker.add(animate);
    }

    /**
     * Creates a floating damage number
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     * @param {number} amount - Damage amount to display
     */
    createDamageNumber(x, y, amount) {
        const text = new PIXI.Text({
            text: amount.toString(),
            style: this.defaultTextStyle
        });
        text.anchor.set(0.5);
        text.position.set(x, y);

        this.layers.foreground.addChild(text);

        const duration = 60; // frames
        let elapsed = 0;

        const animate = (delta) => {
            elapsed += delta;
            const progress = elapsed / duration;

            if (progress >= 1) {
                this.layers.foreground.removeChild(text);
                text.destroy();
                return;
            }

            text.alpha = 1 - progress;
            text.y -= 1 * delta;

            requestAnimationFrame(() => animate(delta));
        };

        this.app.ticker.add(animate);
    }

    /**
     * Creates a flash effect on a target
     * @param {PIXI.DisplayObject} target - The target to flash
     * @param {number} [color=0xFF0000] - Flash color
     * @param {number} [duration=200] - Effect duration in ms
     */
    createFlashEffect(target, color = 0xFF0000, duration = 200) {
        const originalTint = target.tint;
        target.tint = color;

        this.app.ticker.addOnce(() => {
            setTimeout(() => {
                if (target && !target.destroyed) {
                    target.tint = originalTint;
                }
            }, duration);
        });
    }

    /**
     * Creates a pulse effect on a target
     * @param {PIXI.DisplayObject} target - The target to pulse
     * @param {number} [scale=1.2] - Maximum scale
     * @param {number} [duration=200] - Effect duration in ms
     */
    createPulseEffect(target, scale = 1.2, duration = 200) {
        const originalScale = { x: target.scale.x, y: target.scale.y };
        target.scale.set(originalScale.x * scale, originalScale.y * scale);

        this.app.ticker.addOnce(() => {
            setTimeout(() => {
                if (target && !target.destroyed) {
                    target.scale.set(originalScale.x, originalScale.y);
                }
            }, duration);
        });
    }

    /**
     * Cleans up all resources
     */
    destroy() {
        Object.values(this.layers).forEach(layer => {
            layer.destroy({ children: true });
        });
        
        Object.values(this.sharedGraphics).forEach(graphic => {
            graphic.destroy();
        });

        this.particleContainer.destroy();
        
        this.layers = null;
        this.sharedGraphics = null;
        this.particleContainer = null;
        this.app = null;
        this.viewport = null;
        this.worldContainer = null;
    }
} 