/**
 * @file PortalManager.js
 * @description Manages the creation, display, and interaction with portals.
 * Handles portal visuals, collision detection, and interaction feedback.
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';

export class PortalManager {
    /**
     * @param {PIXI.Application} app - The main PixiJS application
     * @param {import('pixi-viewport').Viewport} viewport - The viewport instance
     * @param {PIXI.Container} worldContainer - The main world container
     */
    constructor(app, viewport, worldContainer) {
        if (!app || !viewport || !worldContainer) {
            throw new Error('PortalManager: Required dependencies not provided');
        }

        this.app = app;
        this.viewport = viewport;
        this.worldContainer = worldContainer;
        
        // Create a dedicated portal layer
        this.portalLayer = new PIXI.Container();
        this.portalLayer.sortableChildren = true;
        this.portalLayer.label = 'PortalLayer';
        
        // Enable culling for performance
        this.portalLayer.cullable = true;
        this.worldContainer.addChild(this.portalLayer);

        // Initialize portal collection
        this.portals = [];
        
        // Create shared graphics for reuse
        this.sharedGraphics = {
            portalCircle: new PIXI.Graphics()
                .circle(0, 0, 1)  // Unit circle for scaling
                .fill({ color: 0x0088FF, alpha: 0.3 }),
            pulseCircle: new PIXI.Graphics()
                .circle(0, 0, 1)
                .fill({ color: 0x00FFFF, alpha: 0.2 })
        };

        if (gameState.debug) {
            console.log('PortalManager initialized:', {
                viewport: {
                    found: true,
                    scale: viewport.scale.x,
                    position: { x: viewport.x, y: viewport.y }
                },
                portalLayer: {
                    found: true,
                    zIndex: this.portalLayer.zIndex
                }
            });
        }
    }

    /**
     * Create portal visuals for all connections in the current area
     * @param {Level} area - The current area containing portal connections
     */
    createAreaPortals(area) {
        // Clear existing portals
        this.cleanup();
        
        if (!area?.connections) return;

        // Create portals for each connection
        area.connections.forEach(targetAreaId => {
            // Calculate portal position based on connection direction
            const dx = targetAreaId.includes('east') ? area.width - 100 :
                      targetAreaId.includes('west') ? 100 :
                      area.width / 2;
            
            const dy = targetAreaId.includes('south') ? area.height - 100 :
                      targetAreaId.includes('north') ? 100 :
                      area.height / 2;
            
            this.createPortal(dx, dy, targetAreaId);
        });
    }

    /**
     * Create a single portal at the specified position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} targetAreaId - ID of the target area
     * @private
     */
    createPortal(x, y, targetAreaId) {
        const radius = 40;
        const container = new PIXI.Container();
        container.label = `Portal-${targetAreaId}`;
        container.sortableChildren = true;
        
        // Create main portal circle using shared graphics
        const portalSprite = new PIXI.Sprite(this.sharedGraphics.portalCircle.texture);
        portalSprite.anchor.set(0.5);
        portalSprite.scale.set(radius);
        portalSprite.zIndex = 1;
        container.addChild(portalSprite);
        
        // Create pulse effect using shared graphics
        const pulseSprite = new PIXI.Sprite(this.sharedGraphics.pulseCircle.texture);
        pulseSprite.anchor.set(0.5);
        pulseSprite.scale.set(radius * 1.2);
        pulseSprite.zIndex = 0;
        container.addChild(pulseSprite);
        
        // Set up pulse animation using PixiJS ticker
        let time = 0;
        const animate = (delta) => {
            time += 0.1 * delta;
            pulseSprite.scale.set(radius * (1.2 + Math.sin(time) * 0.2));
        };
        this.app.ticker.add(animate);
        
        // Store animation reference for cleanup
        container.animation = animate;
        
        // Position and configure container
        container.position.set(x, y);
        container.eventMode = 'static';
        container.cursor = 'pointer';
        
        // Add to layer and store reference
        this.portalLayer.addChild(container);
        this.portals.push({
            x,
            y,
            targetAreaId,
            radius,
            container
        });
    }

    /**
     * Check for portal collisions with the player
     * @param {Function} onPortalEnter - Callback when player enters a portal
     */
    checkPortalCollisions(onPortalEnter) {
        if (!gameState.player) return;
        
        const playerPos = gameState.player.position;
        
        for (const portal of this.portals) {
            const dx = playerPos.x - portal.x;
            const dy = playerPos.y - portal.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < portal.radius) {
                onPortalEnter(portal.targetAreaId);
                break;
            }
        }
    }

    /**
     * Clean up portal resources
     */
    cleanup() {
        // Remove animations and destroy containers
        this.portals.forEach(portal => {
            if (portal.container) {
                this.app.ticker.remove(portal.container.animation);
                portal.container.destroy({ children: true });
            }
        });
        
        // Clear arrays and remove children
        this.portals = [];
        this.portalLayer.removeChildren();
    }

    /**
     * Destroy manager and cleanup resources
     */
    destroy() {
        this.cleanup();
        
        // Destroy shared graphics
        Object.values(this.sharedGraphics).forEach(graphic => {
            graphic.destroy();
        });
        
        // Destroy layer
        if (this.portalLayer) {
            this.portalLayer.destroy({ children: true });
        }
        
        // Clear references
        this.sharedGraphics = null;
        this.portalLayer = null;
        this.app = null;
        this.viewport = null;
        this.worldContainer = null;
    }
} 