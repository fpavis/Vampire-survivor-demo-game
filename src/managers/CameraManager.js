/**
 * @file CameraManager.js
 * @description Manages the game camera, following the player and handling screen-to-world coordinate
 * conversions. Controls the viewport and ensures smooth camera movement within world boundaries.
 * 
 * @module managers/CameraManager
 * @requires core/config
 * @requires core/gameState
 * 
 * Key Features:
 * - Follows player movement
 * - Handles camera boundaries
 * - Converts between screen and world coordinates
 * - Determines if entities are in view
 * 
 * Usage:
 * ```js
 * const cameraManager = new CameraManager(app, worldContainer);
 * cameraManager.update();
 * const worldPos = cameraManager.screenToWorld(screenX, screenY);
 * const isVisible = cameraManager.isInView(entityX, entityY);
 * ```
 * 
 * Modification Guidelines:
 * - Adjust camera movement by modifying the update method
 * - Change boundary behavior in the position clamping logic
 * - Modify view checking by updating isInView parameters
 * - Add camera effects by extending the update method
 * 
 * @class
 */

import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { gameState } from '../core/gameState.js';

export class CameraManager {
    constructor(app) {
        this.app = app;
        
        // Create main viewport container
        this.mainContainer = new PIXI.Container();
        this.mainContainer.label = 'ViewportContainer';
        this.mainContainer.sortableChildren = true;
        this.mainContainer.eventMode = 'static';
        
        // Initialize viewport with proper settings
        this.viewport = new Viewport({
            screenWidth: app.screen.width,
            screenHeight: app.screen.height,
            worldWidth: 1000,  // Initial world size, will be updated with setBounds
            worldHeight: 1000,
            events: app.renderer.events
        });
        
        // Configure viewport
        this.viewport
            .drag()
            .pinch()
            .wheel()
            .decelerate();
        
        // Create world container for game content
        this.worldContainer = new PIXI.Container();
        this.worldContainer.label = 'WorldContainer';
        this.worldContainer.sortableChildren = true;
        this.worldContainer.eventMode = 'passive';
        
        // Add containers to stage in correct order
        this.mainContainer.addChild(this.viewport);
        this.viewport.addChild(this.worldContainer);
        this.app.stage.addChild(this.mainContainer);
        
        // Initialize camera properties
        this.bounds = {
            minX: 0,
            minY: 0,
            maxX: 0,
            maxY: 0
        };
        
        // Setup initial viewport position
        this.setupCamera();
        
        // Debug properties
        this.debug = gameState.debug;
        this._lastLog = 0;
        
        if (this.debug) {
            console.log('CameraManager initialized:', {
                viewport: {
                    width: this.viewport.screenWidth,
                    height: this.viewport.screenHeight,
                    scale: this.viewport.scale.x
                },
                containers: {
                    main: !!this.mainContainer,
                    world: !!this.worldContainer
                }
            });
        }
    }

    setupCamera() {
        // Center the viewport container
        this.mainContainer.position.set(
            this.app.screen.width / 2,
            this.app.screen.height / 2
        );
        
        // Set the pivot to center for proper rotation handling
        this.mainContainer.pivot.set(
            this.app.screen.width / 2,
            this.app.screen.height / 2
        );
    }

    followPlayer(delta = 1) {
        if (!gameState.player) return;
        
        // Get player's position in world space
        const playerWorldPos = gameState.player.getWorldPosition();
        
        // Calculate target position (negative because we move world in opposite direction)
        const targetX = -playerWorldPos.x + this.app.screen.width / 2;
        const targetY = -playerWorldPos.y + this.app.screen.height / 2;
        
        // Apply smooth lerping for camera movement
        const lerpFactor = 0.1 * delta;
        this.worldContainer.position.x += (targetX - this.worldContainer.position.x) * lerpFactor;
        this.worldContainer.position.y += (targetY - this.worldContainer.position.y) * lerpFactor;
        
        // Clamp position within bounds
        this.clampToBounds();
    }

    clampToBounds() {
        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;
        
        this.worldContainer.position.x = Math.max(
            Math.min(this.worldContainer.position.x, -this.bounds.minX),
            -this.bounds.maxX + screenWidth
        );
        
        this.worldContainer.position.y = Math.max(
            Math.min(this.worldContainer.position.y, -this.bounds.minY),
            -this.bounds.maxY + screenHeight
        );
    }

    screenToWorld(screenX, screenY) {
        // Convert screen coordinates to world space using PixiJS's native transform system
        const point = new PIXI.Point(screenX, screenY);
        return this.worldContainer.toLocal(point, this.app.stage);
    }

    worldToScreen(worldX, worldY) {
        // Convert world coordinates to screen space using PixiJS's native transform system
        const point = new PIXI.Point(worldX, worldY);
        return this.worldContainer.toGlobal(point);
    }

    update(delta = 1) {
        if (!gameState.player || !this.worldContainer) {
            if (this.debug) console.warn('CameraManager: Missing player or world container');
            return;
        }

        // Update camera position to follow player
        this.followPlayer(delta);
        
        // Debug logging
        if (this.debug) this.debugLog();
    }

    isInView(worldX, worldY, margin = 100) {
        if (!this.worldContainer) return false;
        
        // Convert world position to screen space
        const screenPos = this.worldToScreen(worldX, worldY);
        
        // Check if point is within screen bounds with margin
        return screenPos.x >= -margin &&
               screenPos.x <= this.app.screen.width + margin &&
               screenPos.y >= -margin &&
               screenPos.y <= this.app.screen.height + margin;
    }

    setBounds(width, height) {
        this.bounds = {
            minX: 0,
            minY: 0,
            maxX: width,
            maxY: height
        };
        
        // Update viewport world size
        if (this.viewport) {
            this.viewport.resize(
                this.app.screen.width,
                this.app.screen.height,
                width,
                height
            );
        }
        
        if (this.debug) {
            console.log('Camera bounds updated:', {
                screen: {
                    width: this.app.screen.width,
                    height: this.app.screen.height
                },
                world: {
                    width,
                    height
                }
            });
        }
    }

    handleResize(width, height) {
        // Update viewport dimensions
        if (this.viewport) {
            this.viewport.resize(
                width,
                height,
                this.bounds.maxX,
                this.bounds.maxY
            );
        }
        
        // Update main container position
        this.mainContainer.position.set(width / 2, height / 2);
        this.mainContainer.pivot.set(width / 2, height / 2);
        
        // Ensure camera stays within bounds after resize
        this.clampToBounds();
        
        if (this.debug) {
            console.log('Camera resized:', {
                viewport: {
                    width: this.viewport?.screenWidth,
                    height: this.viewport?.screenHeight,
                    scale: this.viewport?.scale.x
                },
                bounds: this.bounds
            });
        }
    }

    debugLog() {
        const now = performance.now();
        if (now - this._lastLog < 100) return;
        
        const worldPos = gameState.player ? this.worldToScreen(gameState.player.x, gameState.player.y) : null;
        console.log('Camera State:', {
            viewport: {
                position: {
                    x: Math.round(this.mainContainer.position.x),
                    y: Math.round(this.mainContainer.position.y)
                },
                dimensions: {
                    width: Math.round(this.app.screen.width),
                    height: Math.round(this.app.screen.height)
                }
            },
            world: {
                position: {
                    x: Math.round(this.worldContainer.position.x),
                    y: Math.round(this.worldContainer.position.y)
                },
                bounds: this.bounds
            },
            player: worldPos ? {
                screen: {
                    x: Math.round(worldPos.x),
                    y: Math.round(worldPos.y)
                }
            } : null
        });
        
        this._lastLog = now;
    }

    validateNumber(value, fallback = 0) {
        return Number.isFinite(value) ? value : fallback;
    }
} 