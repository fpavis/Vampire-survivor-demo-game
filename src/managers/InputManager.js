/**
 * @file InputManager.js
 * @description Handles raw input processing from keyboard and pointer devices.
 * Core responsibilities:
 * 1. Raw input capture (keyboard, mouse, touch)
 * 2. Input state management
 * 3. Basic input vector normalization
 * 4. Coordinate space conversion for pointer input
 * 
 * Note: This manager focuses purely on input handling and state management.
 * Movement physics, smoothing, and actual movement application are handled by PlayerSystem.
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';

export class InputManager {
    /**
     * Creates a new InputManager instance
     * @param {PIXI.Application} app - Main PIXI application for event binding
     * @param {PIXI.Viewport} viewport - Viewport for coordinate transformations
     */
    constructor(app, viewport) {
        this.app = app;
        this.viewport = viewport;
        
        // Tracks all current input states in a centralized structure
        this.inputState = {
            // Set of currently pressed keys
            keys: new Set(),
            
            // Pointer (mouse/touch) state
            pointer: {
                position: new PIXI.Point(),     // Screen coordinates
                isDown: false,                  // Pressed state
                worldPosition: new PIXI.Point() // World coordinates
            },
            
            // Normalized movement vector
            movement: {
                x: 0,          // Horizontal component (-1 to 1)
                y: 0,          // Vertical component (-1 to 1)
                magnitude: 0   // Length of movement vector
            }
        };

        // Set up input handling systems
        this.initializeEventSystem();
        this.setupKeyboardEvents();
        this.setupPointerEvents();
    }

    /**
     * Configures the PIXI event system for input handling
     * Sets up the stage for proper event propagation
     * @private
     */
    initializeEventSystem() {
        this.app.stage.eventMode = 'static';    // Enable event handling
        this.app.stage.hitArea = this.app.screen; // Make entire screen interactive
        this.app.stage.interactive = true;      // Enable interaction events
    }

    /**
     * Sets up keyboard event listeners with proper cleanup
     * Handles keydown, keyup, and window blur events
     * @private
     */
    setupKeyboardEvents() {
        // Handle key press with repeat prevention
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;  // Prevent key repeat
            this.inputState.keys.add(e.code);
            this.updateMovementVector();
        });

        // Handle key release
        window.addEventListener('keyup', (e) => {
            this.inputState.keys.delete(e.code);
            this.updateMovementVector();
        });

        // Clear all keys when window loses focus
        window.addEventListener('blur', () => {
            this.inputState.keys.clear();
            this.updateMovementVector();
        });
    }

    /**
     * Sets up pointer (mouse/touch) event listeners
     * Uses PIXI's event system for better performance
     * @private
     */
    setupPointerEvents() {
        this.app.stage
            .on('pointermove', this.handlePointerMove.bind(this))
            .on('pointerdown', this.handlePointerDown.bind(this))
            .on('pointerup', this.handlePointerUp.bind(this))
            .on('pointerupoutside', this.handlePointerUp.bind(this))
            .on('pointerleave', this.handlePointerLeave.bind(this));
    }

    /**
     * Handles pointer movement and coordinate transformation
     * Stores both screen and world coordinates
     * @private
     */
    handlePointerMove(event) {
        this.inputState.pointer.position.copyFrom(event.global);
        const worldPos = this.viewport.toWorld(event.global);
        this.inputState.pointer.worldPosition.copyFrom(worldPos);
    }

    /**
     * Handles pointer down event
     * Updates position and down state
     * @private
     */
    handlePointerDown(event) {
        this.inputState.pointer.isDown = true;
        this.handlePointerMove(event);
    }

    /**
     * Handles pointer up event
     * Clears down state
     * @private
     */
    handlePointerUp() {
        this.inputState.pointer.isDown = false;
    }

    /**
     * Handles pointer leave event
     * Resets pointer state when cursor leaves game area
     * @private
     */
    handlePointerLeave() {
        this.inputState.pointer.isDown = false;
        this.inputState.pointer.position.set(0, 0);
        this.inputState.pointer.worldPosition.set(0, 0);
    }

    /**
     * Updates the movement vector based on current key states
     * Handles WASD and Arrow keys with proper normalization
     * @private
     */
    updateMovementVector() {
        let dx = 0;
        let dy = 0;

        // Calculate raw directional input
        if (this.inputState.keys.has('KeyW') || this.inputState.keys.has('ArrowUp')) dy -= 1;
        if (this.inputState.keys.has('KeyS') || this.inputState.keys.has('ArrowDown')) dy += 1;
        if (this.inputState.keys.has('KeyA') || this.inputState.keys.has('ArrowLeft')) dx -= 1;
        if (this.inputState.keys.has('KeyD') || this.inputState.keys.has('ArrowRight')) dx += 1;

        // Normalize diagonal movement to prevent faster diagonal speed
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        // Update movement state
        this.inputState.movement = { 
            x: dx, 
            y: dy, 
            magnitude: Math.sqrt(dx * dx + dy * dy) 
        };
    }

    /**
     * Gets the current raw movement vector
     * @returns {Object} Normalized movement vector {x, y, magnitude}
     */
    getRawMovementVector() {
        return { ...this.inputState.movement };
    }

    /**
     * Gets the current aim direction in world coordinates
     * Calculates direction from player to pointer position
     * @returns {PIXI.Point} Normalized aim vector
     */
    getAimDirection() {
        if (!gameState.player) return new PIXI.Point(1, 0);

        const playerWorldPos = this.viewport.toWorld(gameState.player.position);
        const dx = this.inputState.pointer.worldPosition.x - playerWorldPos.x;
        const dy = this.inputState.pointer.worldPosition.y - playerWorldPos.y;
        
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return new PIXI.Point(1, 0);

        return new PIXI.Point(dx / length, dy / length);
    }

    /**
     * Updates input manager state
     * Currently used as a hook for future input buffering or sequences
     * @param {number} delta - Time elapsed since last update
     */
    update(delta) {
        // Reserved for future input buffering or complex input sequences
    }

    /**
     * Sets up weapon switching hotkeys
     * @param {Function} callback - Function to call when weapon switch is triggered
     */
    handleWeaponSwitch(callback) {
        window.addEventListener('keydown', (e) => {
            if (['1', '2', '3', '4'].includes(e.key)) {
                callback(parseInt(e.key));
            }
        });
    }
} 