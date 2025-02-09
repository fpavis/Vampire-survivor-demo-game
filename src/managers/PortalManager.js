/**
 * @file PortalManager.js
 * @description Manages the creation, display, and interaction with portals that allow players to move between different areas
 * in the game. Each portal shows its destination, requirements, and handles player transitions between areas.
 * 
 * @module managers/PortalManager
 * @requires core/gameState
 * @requires core/config
 * 
 * Key Features:
 * - Creates and positions portals based on area connections
 * - Displays visual indicators (arrows, text) showing portal destinations
 * - Handles level requirements and transition animations
 * - Manages portal collision detection and area transitions
 * 
 * Usage:
 * ```js
 * const portalManager = new PortalManager(app, worldContainer);
 * portalManager.setUI(uiManager);
 * portalManager.createAreaPortals(currentArea);
 * ```
 * 
 * Modification Guidelines:
 * - Add new portal types by extending the createPortal method in area configurations
 * - Modify portal visuals by updating the createPortalGraphics method
 * - Add new requirements by extending the createRequirementText method
 * - Adjust transition animations in the transitionToArea method
 * 
 * @class
 */

import { gameState } from '../core/gameState.js';
import { LEVELS } from '../core/config.js';

export class PortalManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
        this.portals = [];
        this.transitionInProgress = false;
        this.ui = null;  // Will be set by Game class
    }

    setUI(ui) {
        this.ui = ui;
    }

    createAreaPortals(area) {
        this.portals = [];
        
        area.connections.forEach(targetAreaId => {
            const targetArea = LEVELS.find(level => level.id === targetAreaId);
            if (!targetArea) {
                console.warn(`Target area ${targetAreaId} not found`);
                return;
            }
            
            // Calculate portal position based on relative area positions
            const dx = targetArea.x - area.x;
            const dy = targetArea.y - area.y;
            
            let portalX, portalY;
            if (dx > 0) portalX = area.width - 100;
            else if (dx < 0) portalX = 100;
            else portalX = area.width / 2;
            
            if (dy > 0) portalY = area.height - 100;
            else if (dy < 0) portalY = 100;
            else portalY = area.height / 2;
            
            const portal = {
                x: portalX,
                y: portalY,
                targetAreaId,
                targetArea,
                radius: 40,
                color: 0x00ffff
            };
            
            const graphics = this.createPortalGraphics(portal);
            if (graphics) {
                this.worldContainer.addChild(graphics);
                portal.graphics = graphics;
                this.portals.push(portal);
            }
        });
    }

    createPortalGraphics(portal) {
        if (!portal || !portal.targetArea) {
            console.warn('Invalid portal or target area');
            return null;
        }

        const container = new PIXI.Container();
        
        // Create portal graphics
        const graphics = new PIXI.Graphics();
        graphics.fill({ color: 0x0088FF, alpha: 0.3 })
            .circle(0, 0, 30);
        container.addChild(graphics);
        
        // Add text label
        const text = new PIXI.Text({
            text: portal.targetArea.name || 'Unknown Area',
            style: {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xFFFFFF,
                align: 'center',
                stroke: { color: '#000000', width: 4 }
            }
        });
        text.anchor.set(0.5);
        text.y = -45;
        container.addChild(text);
        
        container.position.set(portal.x, portal.y);
        container.eventMode = 'static';
        container.cursor = 'pointer';
        
        return container;
    }

    createRequirementText(targetArea) {
        let reqString = '';
        targetArea.requirements.forEach(req => {
            switch (req.type) {
                case 'level':
                    reqString = `Level ${req.value} Required`;
                    break;
                case 'score':
                    reqString = `Score ${req.value} Required`;
                    break;
                case 'kill_count':
                    reqString = `${req.value} Kills Required`;
                    break;
            }
        });

        const reqText = new PIXI.Text(reqString, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: gameState.level >= (targetArea.requirements[0]?.value || 0) ? 0x00FF00 : 0xFF0000,
            stroke: 0x000000,
            strokeThickness: 3,
            align: 'center'
        });
        reqText.anchor.set(0.5);
        return reqText;
    }

    checkPortalCollisions(currentArea, onTransition) {
        if (this.transitionInProgress || !gameState.player) return;
        
        for (const portal of this.portals) {
            const dx = gameState.player.x - portal.x;
            const dy = gameState.player.y - portal.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < portal.radius) {
                const targetArea = LEVELS.find(level => level.id === portal.targetAreaId);
                if (targetArea && targetArea.canEnter(gameState)) {
                    this.transitionToArea(targetArea, onTransition);
                    break;
                } else if (targetArea) {
                    this.ui.showMessage("Level requirement not met!", 0xFF0000);
                }
            } else if (distance < portal.radius * 1.5) {
                // Show hover info when near portal
                const targetArea = LEVELS.find(level => level.id === portal.targetAreaId);
                if (targetArea) {
                    this.ui.showMessage(`${targetArea.name} - ${targetArea.description}`, 0xFFFFFF, 500);
                }
            }
        }
    }

    transitionToArea(newArea, onTransition) {
        if (this.transitionInProgress) return;
        
        this.transitionInProgress = true;
        
        // Create transition effect
        const transition = new PIXI.Graphics();
        transition
            .fill({ color: 0x000000 })
            .rect(0, 0, this.app.screen.width, this.app.screen.height);
        transition.alpha = 0;
        this.app.stage.addChild(transition);
        
        // Fade out
        const fadeOut = () => {
            transition.alpha += 0.05;
            if (transition.alpha < 1) {
                requestAnimationFrame(fadeOut);
            } else {
                onTransition(newArea);
                
                // Fade in
                const fadeIn = () => {
                    transition.alpha -= 0.05;
                    if (transition.alpha > 0) {
                        requestAnimationFrame(fadeIn);
                    } else {
                        this.app.stage.removeChild(transition);
                        this.transitionInProgress = false;
                    }
                };
                fadeIn();
            }
        };
        fadeOut();
    }
} 