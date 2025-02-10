/**
 * @file DebugSystem.js
 * @description Handles all debug-related UI elements including stats display,
 * coordinate overlay, and other debugging tools.
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';

export class DebugSystem {
    /**
     * @param {PIXI.Container} container - The UI container to add debug elements to
     * @param {Map<string, {texture: PIXI.Texture}>} sharedGraphics - Shared graphics resources
     */
    constructor(container, sharedGraphics) {
        if (!container || !(container instanceof PIXI.Container)) {
            throw new Error('DebugSystem: Valid PIXI.Container not provided');
        }

        if (!sharedGraphics || !(sharedGraphics instanceof Map)) {
            throw new Error('DebugSystem: Shared graphics not provided');
        }

        this.container = container;
        this.sharedGraphics = sharedGraphics;
        
        // Initialize collections
        this.elements = new Map();
        
        // Create debug elements
        this.createDebugPanel();
        this.createCoordinateOverlay();
        this.createFPSDisplay();
        this.createEntityCounter();
        this.createCollisionDebug();
        
        // Initially hide debug elements
        this.setVisible(false);
    }

    /**
     * Create debug panel
     * @private
     */
    createDebugPanel() {
        const panel = new PIXI.Container();
        panel.label = 'debugPanel';
        panel.sortableChildren = true;
        

        // Panel background
        const bg = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        bg.width = 250;
        bg.height = 400;
        bg.alpha = 0.8;
        bg.zIndex = 0;
        panel.addChild(bg);
        
        // Create sections
        const sections = {
            performance: this.createDebugSection('Performance', 0),
            game: this.createDebugSection('Game State', 1),
            player: this.createDebugSection('Player Stats', 2),
            system: this.createDebugSection('System Info', 3)
        };
        
        Object.values(sections).forEach(section => {
            section.position.set(10, section.index * 100 + 10);
            section.zIndex = 1;
            panel.addChild(section);
        });
        
        // Position panel in top right
        panel.position.set(window.innerWidth - bg.width - 20, 20);
        
        this.elements.set('debugPanel', { container: panel, sections });
        this.container.addChild(panel);
    }

    /**
     * Create a debug section with title
     * @param {string} title - Section title
     * @param {number} index - Section index for positioning
     * @returns {PIXI.Container} Section container
     * @private
     */
    createDebugSection(title, index) {
        const section = new PIXI.Container();
        section.index = index;
        
        // Section title
        const titleText = new PIXI.Text({
            text: title,
            style: {
                fontSize: 16,
                fill: 0xFFD700,
                fontWeight: 'bold'
            }
        });
        section.addChild(titleText);
        
        // Section content
        const content = new PIXI.Text({
            text: 'Loading...',
            style: {
                fontSize: 14,
                fill: 0xFFFFFF,
                lineHeight: 18
            }
        });
        content.position.set(0, 20);
        section.addChild(content);
        
        return section;
    }

    /**
     * Create coordinate overlay
     * @private
     */
    createCoordinateOverlay() {
        const overlay = new PIXI.Container();
        overlay.label = 'coordOverlay';
        overlay.zIndex = 9999;
        overlay.sortableChildren = true;
        

        // Create background
        const bg = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        bg.alpha = 0.8;
        bg.zIndex = 0;
        overlay.addChild(bg);
        
        // Create text displays
        const screenCoords = new PIXI.Text({
            text: 'Screen: (0, 0)',
            style: {
                fontSize: 12,
                fill: 0xFFFFFF
            }
        });
        screenCoords.zIndex = 1;
        overlay.addChild(screenCoords);
        
        const worldCoords = new PIXI.Text({
            text: 'World: (0, 0)',
            style: {
                fontSize: 12,
                fill: 0xFFFFFF
            }
        });
        worldCoords.position.y = 15;
        worldCoords.zIndex = 1;
        overlay.addChild(worldCoords);
        
        this.elements.set('coordOverlay', {
            container: overlay,
            elements: { bg, screenCoords, worldCoords }
        });
        this.container.addChild(overlay);
        
        // Set up mouse tracking
        this.container.eventMode = 'static';
        this.container.on('pointermove', this.updateCoordinates.bind(this));
    }

    /**
     * Create FPS display
     * @private
     */
    createFPSDisplay() {
        const display = new PIXI.Container();
        display.label = 'fpsDisplay';
        display.sortableChildren = true;
        

        // Background
        const bg = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        bg.width = 80;
        bg.height = 30;
        bg.alpha = 0.8;
        bg.zIndex = 0;
        display.addChild(bg);
        
        // FPS text
        const text = new PIXI.Text({
            text: '60 FPS',
            style: {
                fontSize: 14,
                fill: 0x00FF00
            }
        });
        text.position.set(10, 8);
        text.zIndex = 1;
        display.addChild(text);
        
        // Position in top left
        display.position.set(10, 10);
        
        this.elements.set('fpsDisplay', {
            container: display,
            elements: { bg, text }
        });
        this.container.addChild(display);
    }

    /**
     * Create entity counter
     * @private
     */
    createEntityCounter() {
        const counter = new PIXI.Container();
        counter.label = 'entityCounter';
        counter.sortableChildren = true;
        

        // Background
        const bg = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        bg.width = 120;
        bg.height = 80;
        bg.alpha = 0.8;
        bg.zIndex = 0;
        counter.addChild(bg);
        
        // Counter text
        const text = new PIXI.Text({
            text: 'Entities:\n0 enemies\n0 bullets\n0 effects',
            style: {
                fontSize: 12,
                fill: 0xFFFFFF,
                lineHeight: 16
            }
        });
        text.position.set(10, 8);
        text.zIndex = 1;
        counter.addChild(text);
        
        // Position below FPS display
        counter.position.set(10, 50);
        
        this.elements.set('entityCounter', {
            container: counter,
            elements: { bg, text }
        });
        this.container.addChild(counter);
    }

    /**
     * Create collision debug visualization
     * @private
     */
    createCollisionDebug() {
        const graphics = new PIXI.Graphics();
        graphics.label = 'collisionDebug';
        graphics.zIndex = 9998;
        
        this.elements.set('collisionDebug', {
            container: graphics,
            elements: {}
        });
        this.container.addChild(graphics);
    }

    /**
     * Update coordinate display
     * @param {PIXI.FederatedPointerEvent} event - Pointer event
     * @private
     */
    updateCoordinates(event) {
        const overlay = this.elements.get('coordOverlay');
        if (!overlay?.container.visible) return;

        const { screenCoords, worldCoords, bg } = overlay.elements;
        const x = Math.round(event.global.x);
        const y = Math.round(event.global.y);
        
        // Update text
        screenCoords.text = `Screen: (${x}, ${y})`;
        
        // Get world coordinates if available
        if (gameState.viewportSystem) {
            const worldPos = gameState.viewportSystem.screenToWorld(x, y);
            worldCoords.text = `World: (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`;
        }
        
        // Update background size
        const padding = 5;
        bg.width = Math.max(screenCoords.width, worldCoords.width) + padding * 2;
        bg.height = screenCoords.height + worldCoords.height + padding * 2;
        
        // Position overlay near cursor
        overlay.container.position.set(
            x + 15,
            y + 15
        );
        
        // Keep within screen bounds
        if (x + bg.width + 20 > window.innerWidth) {
            overlay.container.x = x - bg.width - 15;
        }
        if (y + bg.height + 20 > window.innerHeight) {
            overlay.container.y = y - bg.height - 15;
        }
    }

    /**
     * Update debug stats
     * @param {Object} stats - Current game stats
     */
    updateStats(stats) {
        const debugPanel = this.elements.get('debugPanel');
        if (!debugPanel?.container.visible) return;

        const { sections } = debugPanel;
        
        // Update performance stats
        const performanceText = sections.performance.getChildAt(1);
        performanceText.text = [
            `FPS: ${Math.round(stats.fps)}`,
            `Draw Calls: ${stats.drawCalls}`,
            `Objects: ${stats.objects}`
        ].join('\n');
        
        // Update game stats
        const gameText = sections.game.getChildAt(1);
        gameText.text = [
            `Level: ${stats.level}`,
            `Score: ${stats.score}`,
            `Time: ${Math.floor(stats.time / 1000)}s`,
            `Kills: ${stats.kills}`
        ].join('\n');
        
        // Update player stats
        const playerText = sections.player.getChildAt(1);
        playerText.text = [
            `Health: ${Math.round(stats.health)}/${stats.maxHealth}`,
            `Speed: ${stats.speed.toFixed(1)}`,
            `Damage: ${Math.round(stats.damage)}`,
            `Fire Rate: ${(1000/stats.fireRate).toFixed(1)}/s`
        ].join('\n');
        
        // Update system info
        const systemText = sections.system.getChildAt(1);
        systemText.text = [
            `Resolution: ${window.innerWidth}x${window.innerHeight}`,
            `Device Pixel Ratio: ${window.devicePixelRatio}`,
            `WebGL Version: ${stats.webglVersion || 'Unknown'}`,
            `Renderer: ${stats.rendererType || 'Unknown'}`
        ].join('\n');
    }

    /**
     * Update FPS display
     * @param {number} fps - Current FPS
     */
    updateFPS(fps) {
        const display = this.elements.get('fpsDisplay');
        if (!display?.container.visible) return;

        const text = display.elements.text;
        text.text = `${Math.round(fps)} FPS`;
        text.style.fill = fps >= 55 ? 0x00FF00 : fps >= 30 ? 0xFFFF00 : 0xFF0000;
    }

    /**
     * Update entity counter
     * @param {Object} counts - Entity counts
     */
    updateEntityCounter(counts) {
        const counter = this.elements.get('entityCounter');
        if (!counter?.container.visible) return;

        counter.elements.text.text = [
            'Entities:',
            `${counts.enemies} enemies`,
            `${counts.bullets} bullets`,
            `${counts.effects} effects`
        ].join('\n');
    }

    /**
     * Update collision visualization
     * @param {Object[]} colliders - Array of collision objects
     */
    updateCollisionDebug(colliders) {
        const graphics = this.elements.get('collisionDebug')?.container;
        if (!graphics?.visible) return;

        graphics.clear();
        
        colliders.forEach(collider => {
            graphics
                .stroke({ width: 2, color: collider.color || 0x00FF00, alpha: 0.8 })
                .circle(collider.x, collider.y, collider.radius);
            
            if (collider.velocity) {
                graphics
                    .stroke({ width: 1, color: collider.color || 0x00FF00, alpha: 0.3 })
                    .moveTo(collider.x, collider.y)
                    .lineTo(
                        collider.x + collider.velocity.x * 10,
                        collider.y + collider.velocity.y * 10
                    );
            }
        });
    }

    /**
     * Set debug elements visibility
     * @param {boolean} visible - Whether elements should be visible
     */
    setVisible(visible) {
        this.elements.forEach(element => {
            if (element.container) {
                element.container.visible = visible;
            }
        });
    }

    /**
     * Toggle coordinate overlay visibility
     */
    toggleCoordinates() {
        const overlay = this.elements.get('coordOverlay');
        if (overlay?.container) {
            overlay.container.visible = !overlay.container.visible;
        }
    }

    /**
     * Toggle collision debug visibility
     */
    toggleCollisionDebug() {
        const graphics = this.elements.get('collisionDebug');
        if (graphics?.container) {
            graphics.container.visible = !graphics.container.visible;
        }
    }

    /**
     * Handle resize event
     * @param {number} width - New width
     * @param {number} height - New height
     */
    handleResize(width, height) {
        // Update debug panel position
        const debugPanel = this.elements.get('debugPanel');
        if (debugPanel?.container) {
            debugPanel.container.position.set(width - debugPanel.container.width - 20, 20);
        }
        
        // Update FPS display position
        const fpsDisplay = this.elements.get('fpsDisplay');
        if (fpsDisplay?.container) {
            fpsDisplay.container.position.set(10, 10);
        }
        
        // Update entity counter position
        const entityCounter = this.elements.get('entityCounter');
        if (entityCounter?.container) {
            entityCounter.container.position.set(10, 50);
        }
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