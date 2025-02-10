/**
 * @file HUDSystem.js
 * @description Handles all gameplay HUD elements including health bars, experience,
 * score display, and other in-game UI elements.
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';

export class HUDSystem {
    /**
     * @param {PIXI.Container} container - The UI container to add HUD elements to
     * @param {Map<string, {texture: PIXI.Texture}>} sharedGraphics - Shared graphics resources
     */
    constructor(container, sharedGraphics) {
        if (!container || !(container instanceof PIXI.Container)) {
            throw new Error('HUDSystem: Valid PIXI.Container not provided');
        }

        if (!sharedGraphics || !(sharedGraphics instanceof Map)) {
            throw new Error('HUDSystem: Shared graphics not provided');
        }

        this.container = container;
        this.sharedGraphics = sharedGraphics;
        
        // Initialize collections
        this.elements = new Map();
        
        // Create HUD elements
        this.createHUDElements();
        
        // Initially hide HUD
        this.setVisible(false);
    }

    /**
     * Create all HUD elements
     * @private
     */
    createHUDElements() {
        const padding = 20;
        let yPos = padding;
        const spacing = 50;

        // Health display
        this.createHealthDisplay(padding, yPos);
        yPos += spacing;

        // Experience bar
        this.createExperienceBar(padding, yPos);
        yPos += spacing;

        // Score display
        this.createScoreDisplay(padding, yPos);
        yPos += spacing;

        // Stats display
        this.createStatsDisplay(padding, yPos);
    }

    /**
     * Create health display
     * @private
     */
    createHealthDisplay(x, y) {
        const container = new PIXI.Container();
        container.position.set(x, y);

        // Health text
        const text = new PIXI.Text({
            text: 'Health: 100/100',
            style: {
                fontSize: 16,
                fill: 0xFFFFFF
            }
        });
        container.addChild(text);

        // Health bar background
        const barBg = new PIXI.Sprite(this.sharedGraphics.get('bar').texture);
        barBg.tint = 0x333333;
        barBg.position.set(0, 25);
        barBg.width = 200;
        container.addChild(barBg);

        // Health bar
        const bar = new PIXI.Sprite(this.sharedGraphics.get('bar').texture);
        bar.tint = 0x00FF00;
        bar.position.set(0, 25);
        bar.width = 200;
        container.addChild(bar);

        this.elements.set('health', { text, bar, container });
        this.container.addChild(container);
    }

    /**
     * Create experience bar
     * @private
     */
    createExperienceBar(x, y) {
        const container = new PIXI.Container();
        container.position.set(x, y);

        // XP text
        const text = new PIXI.Text({
            text: 'XP: 0/100',
            style: {
                fontSize: 16,
                fill: 0xFFFFFF
            }
        });
        container.addChild(text);

        // XP bar background
        const barBg = new PIXI.Sprite(this.sharedGraphics.get('bar').texture);
        barBg.tint = 0x333333;
        barBg.position.set(0, 25);
        barBg.width = 200;
        container.addChild(barBg);

        // XP bar
        const bar = new PIXI.Sprite(this.sharedGraphics.get('bar').texture);
        bar.tint = 0xFF00FF;
        bar.position.set(0, 25);
        bar.width = 200;
        container.addChild(bar);

        this.elements.set('experience', { text, bar, container });
        this.container.addChild(container);
    }

    /**
     * Create score display
     * @private
     */
    createScoreDisplay(x, y) {
        const container = new PIXI.Container();
        container.position.set(x, y);

        const text = new PIXI.Text({
            text: 'Score: 0',
            style: {
                fontSize: 16,
                fill: 0xFFFFFF
            }
        });
        container.addChild(text);

        this.elements.set('score', { text, container });
        this.container.addChild(container);
    }

    /**
     * Create stats display
     * @private
     */
    createStatsDisplay(x, y) {
        const container = new PIXI.Container();
        container.position.set(x, y);

        // Stats panel background
        const panel = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        panel.width = 200;
        panel.height = 100;
        container.addChild(panel);

        // Stats text
        const text = new PIXI.Text({
            text: 'Loading stats...',
            style: {
                fontSize: 14,
                fill: 0xFFFFFF,
                align: 'left'
            }
        });
        text.position.set(10, 10);
        container.addChild(text);

        this.elements.set('stats', { text, panel, container });
        this.container.addChild(container);
    }

    /**
     * Set HUD visibility
     * @param {boolean} visible - Whether the HUD should be visible
     */
    setVisible(visible) {
        this.elements.forEach(element => {
            if (element.container) {
                element.container.visible = visible;
            }
        });
    }

    /**
     * Update health display
     * @param {number} current - Current health
     * @param {number} max - Maximum health
     */
    updateHealth(current, max) {
        const health = this.elements.get('health');
        if (!health) return;

        health.text.text = `Health: ${Math.floor(current)}/${max}`;
        health.bar.scale.x = Math.max(0, Math.min(1, current / max));
    }

    /**
     * Update experience display
     * @param {number} current - Current experience
     * @param {number} next - Experience needed for next level
     */
    updateExperience(current, next) {
        const exp = this.elements.get('experience');
        if (!exp) return;

        exp.text.text = `XP: ${current}/${next}`;
        exp.bar.scale.x = Math.max(0, Math.min(1, current / next));
    }

    /**
     * Update score display
     * @param {number} score - Current score
     */
    updateScore(score) {
        const scoreElement = this.elements.get('score');
        if (!scoreElement) return;

        scoreElement.text.text = `Score: ${score}`;
    }

    /**
     * Update stats display
     * @param {Object} stats - Current game stats
     */
    updateStats(stats) {
        const statsElement = this.elements.get('stats');
        if (!statsElement) return;

        statsElement.text.text = [
            `Level: ${stats.level}`,
            `Damage: ${Math.round(stats.damage)}`,
            `Speed: ${stats.speed.toFixed(1)}`,
            `Fire Rate: ${(1000/stats.fireRate).toFixed(1)}/s`
        ].join('\n');
    }

    /**
     * Handle resize event
     * @param {number} width - New width
     * @param {number} height - New height
     */
    handleResize(width, height) {
        // Update HUD element positions if needed
        // This can be implemented based on your layout requirements
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.elements.forEach(element => {
            if (element.container) {
                element.container.destroy({ children: true });
            }
        });
        this.elements.clear();
        this.container = null;
        this.sharedGraphics = null;
    }
} 