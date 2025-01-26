import { gameState } from './gameState.js';
import { LEVELS } from './config.js';

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
            if (!targetArea) return;
            
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
            
            const portal = area.createPortal(targetAreaId, portalX, portalY);
            this.createPortalGraphics(portal);
            this.portals.push(portal);
        });
    }

    createPortalGraphics(portal) {
        const graphics = new PIXI.Graphics();
        graphics.portalData = portal;
        
        // Create portal visual
        const drawPortal = (scale = 1) => {
            graphics.clear();
            graphics.lineStyle(3, portal.color, 0.8);
            graphics.beginFill(portal.color, 0.2);
            graphics.drawCircle(0, 0, portal.radius * scale);
            graphics.endFill();
            
            // Add inner circles for effect
            graphics.lineStyle(2, portal.color, 0.5);
            graphics.drawCircle(0, 0, portal.radius * 0.7 * scale);
            graphics.lineStyle(1, portal.color, 0.3);
            graphics.drawCircle(0, 0, portal.radius * 0.4 * scale);
        };
        
        // Initial draw
        drawPortal();
        graphics.x = portal.x;
        graphics.y = portal.y;
        
        // Add pulsing animation
        let time = 0;
        const animate = () => {
            time += portal.pulseSpeed;
            const scale = 1 + Math.sin(time) * portal.pulseRange;
            drawPortal(scale);
        };
        
        this.app.ticker.add(animate);
        this.worldContainer.addChild(graphics);
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
            }
        }
    }

    transitionToArea(newArea, onTransition) {
        if (this.transitionInProgress) return;
        
        this.transitionInProgress = true;
        
        // Create transition effect
        const transition = new PIXI.Graphics();
        transition.beginFill(0x000000);
        transition.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        transition.endFill();
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