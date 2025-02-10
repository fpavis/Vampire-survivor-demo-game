/**
 * @file ViewportSystem.js
 * @description Core viewport and camera management using pixi-viewport.
 * 
 * This system implements:
 * - Viewport initialization and configuration
 * - Camera controls (drag, pinch, wheel)
 * - World boundaries and clamping
 * - Coordinate transformations
 * - Player following behavior
 * 
 * Key Features:
 * - Smooth camera movement with deceleration
 * - Multi-touch support with pinch-to-zoom
 * - Mouse wheel zooming with smooth transitions
 * - World boundary clamping to prevent out-of-bounds
 * - Automatic centering of small worlds
 */

import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { gameState } from '../core/gameState.js';
import { WORLD_CONFIG } from '../core/config.js';

/**
 * Main viewport system that coordinates viewport, camera, and rendering.
 * Follows pixi-viewport's plugin-based architecture for viewport manipulation.
 * @public
 */
export class ViewportSystem {
    constructor(app) {
        if (!app) throw new Error('ViewportSystem requires a valid PIXI Application');
        
        this.app = app;
        
        // Initialize viewport with proper configuration
        // screenWidth/Height: Current window dimensions
        // worldWidth/Height: Total size of the game world
        // events: Use the renderer's event system
        // ticker: Use the app's ticker for updates
        // disableOnContextMenu: Prevents right-click issues during drag
        // stopPropagation: Stops events from bubbling up
        // passiveWheel: Better handling of wheel events (false for more control)
        this.viewport = new Viewport({
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            worldWidth: WORLD_CONFIG.width,
            worldHeight: WORLD_CONFIG.height,
            events: this.app.renderer.events,
            ticker: this.app.ticker,
            disableOnContextMenu: true,
            stopPropagation: true,
            passiveWheel: false
        });

        // Create a container for all game world objects
        // This separates world objects from UI elements
        this.worldContainer = new PIXI.Container();
        this.worldContainer.label = 'WorldContainer';
        
        // Set up proper display hierarchy:
        // worldContainer -> viewport -> stage
        this.viewport.addChild(this.worldContainer);
        this.app.stage.addChild(this.viewport);

        // Initialize viewport features and plugins
        this.initializeViewport();
    }

    /**
     * Initialize viewport plugins and settings.
     * Each plugin adds specific interaction capabilities:
     * - drag: One-finger/mouse dragging
     * - pinch: Two-finger touch for mobile zoom/pan
     * - wheel: Mouse wheel zoom
     * - decelerate: Smooth stop after movement
     * - clamp: Keeps viewport within world boundaries
     * - clampZoom: Limits minimum/maximum zoom levels
     * @private
     */
    initializeViewport() {
        this.viewport
            // Drag plugin: Enables one-finger/mouse dragging
            .drag({
                wheel: false,          // Disable wheel-based dragging (handled by wheel plugin)
                wheelScroll: false,    // Disable wheel scrolling
                clampWheel: false,     // Disable wheel clamping
                underflow: 'center'    // Center content if world is smaller than screen
            })
            // Pinch plugin: Enables two-finger touch gestures
            .pinch({
                percent: 2,            // Zoom by 2% with each pinch
                noDrag: false,         // Allow two-finger dragging
                factor: 1,             // Normal pinch speed
                center: null           // Use center of pinch gesture
            })
            // Wheel plugin: Enables mouse wheel zooming
            .wheel({
                percent: 0.1,          // Zoom by 0.1% per wheel tick
                smooth: 8,             // Smooth zoom over 8 frames
                interrupt: true,       // Stop smoothing on user input
                reverse: false,        // Standard zoom direction
                center: null,          // Use mouse position as zoom center
                lineHeight: 20,        // Standard scroll line height
                axis: 'all'           // Allow zooming on both axes
            })
            // Decelerate plugin: Adds momentum and smooth stopping
            .decelerate({
                friction: 0.95,        // Higher value = faster stop
                bounce: 0.8,          // Bounce factor at boundaries
                minSpeed: 0.01        // Stop threshold
            })
            // Clamp plugin: Prevents moving outside world boundaries
            .clamp({
                direction: 'all',      // Clamp both x and y axes
                underflow: 'center'    // Center when zoomed out
            })
            // ClampZoom plugin: Limits zoom levels
            .clampZoom({
                minScale: 0.5,         // Maximum zoom out (50%)
                maxScale: 2.0          // Maximum zoom in (200%)
            });

        // Initialize the view position and zoom
        this.centerView();
    }

    /**
     * Centers the viewport on the world.
     * Uses findFit to calculate the optimal zoom level
     * that fits the entire world in view.
     * @private
     */
    centerView() {
        // Find scale that fits world in viewport
        const scale = this.viewport.findFit(WORLD_CONFIG.width, WORLD_CONFIG.height);
        // Apply zoom with centering
        this.viewport.setZoom(scale, true);
        // Move to world center
        this.viewport.moveCenter(WORLD_CONFIG.width / 2, WORLD_CONFIG.height / 2);
    }

    /**
     * Handles window resize events.
     * Updates viewport dimensions and maintains view center.
     * @param {number} width - New window width
     * @param {number} height - New window height
     * @public
     */
    handleResize(width, height) {
        this.viewport.resize(width, height);
        this.centerView();
    }

    /**
     * Updates viewport and camera position.
     * Called each frame to handle smooth camera following.
     * @param {number} delta - Time elapsed since last update
     * @public
     */
    update(delta) {
        if (gameState.player) {
            this.followPlayer(delta);
        }
    }

    /**
     * Makes the viewport follow the player with smooth animation.
     * Uses viewport.animate for smooth transitions to new positions.
     * @param {number} delta - Time elapsed since last update
     * @private
     */
    followPlayer(delta) {
        if (!gameState.player) return;

        const bounds = gameState.player.getBounds();
        if (!bounds) return;

        // Calculate center point of player
        const center = {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
        };

        // Animate viewport to player position
        this.viewport.animate({
            position: center,          // Target position
            time: 100 * delta,        // Animation duration
            ease: 'easeInOutSine'     // Smooth easing function
        });
    }

    /**
     * Converts screen coordinates to world coordinates.
     * Essential for input handling and UI positioning.
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @returns {PIXI.Point} World coordinates
     * @public
     */
    screenToWorld(x, y) {
        return this.viewport.toWorld(new PIXI.Point(x, y));
    }

    /**
     * Converts world coordinates to screen coordinates.
     * Used for rendering UI elements at world positions.
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     * @returns {PIXI.Point} Screen coordinates
     * @public
     */
    worldToScreen(x, y) {
        return this.viewport.toScreen(new PIXI.Point(x, y));
    }

    /**
     * Checks if a world position is currently visible in the viewport.
     * Useful for culling and optimization.
     * @param {number} worldX - World X coordinate
     * @param {number} worldY - World Y coordinate
     * @returns {boolean} True if position is visible
     * @public
     */
    isInView(worldX, worldY) {
        const bounds = this.viewport.getVisibleBounds();
        return bounds ? bounds.contains(worldX, worldY) : false;
    }

    /**
     * Gets the world container for adding game entities.
     * All game objects should be added to this container.
     * @returns {PIXI.Container} The world container
     * @public
     */
    getWorldContainer() {
        return this.worldContainer;
    }

    /**
     * Gets the viewport instance for direct manipulation.
     * Provides access to viewport methods and properties.
     * @returns {Viewport} The viewport instance
     * @public
     */
    getViewport() {
        return this.viewport;
    }

    /**
     * Cleans up resources and removes event listeners.
     * Important for preventing memory leaks.
     * @public
     */
    destroy() {
        if (this.viewport) {
            this.viewport.destroy();
            this.viewport = null;
        }

        if (this.worldContainer) {
            this.worldContainer.destroy({ children: true });
            this.worldContainer = null;
        }

        this.app = null;
    }
} 