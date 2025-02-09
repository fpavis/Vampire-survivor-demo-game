/**
 * @file InputManager.js
 * @description Handles all user input including keyboard, mouse, and touch controls.
 * Manages player movement, weapon switching, and provides cross-platform input support.
 * 
 * @module managers/InputManager
 * @requires core/gameState
 * 
 * Key Features:
 * - Handles keyboard WASD/Arrow key movement
 * - Processes mouse/touch input for movement
 * - Manages weapon switching hotkeys
 * - Supports virtual joystick for mobile
 * - Provides normalized movement vectors
 * 
 * Usage:
 * ```js
 * const inputManager = new InputManager(app, worldContainer);
 * inputManager.handleWeaponSwitch(callback);
 * const movement = inputManager.getMovementDirection(delta, playerSpeed, joystick);
 * ```
 * 
 * Modification Guidelines:
 * - Add new input methods by extending bindEvents
 * - Modify control schemes in getMovementDirection
 * - Add new hotkeys in handleWeaponSwitch
 * - Implement custom touch controls
 * - Add gamepad support
 * 
 * @class
 */

import { gameState } from '../core/gameState.js';

export class InputManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
        this.keys = {};
        this.pointerPosition = null;
        this.pointerDown = false;
        
        // Scale tracking for proper coordinate conversion
        this.scale = {
            x: 1,
            y: 1
        };
        
        this.bindEvents();
        this.debug = false;
    }

    bindEvents() {
        // Keyboard events with prevention of key repeat
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase(); // Normalize key case
            
            if (!this.keys[key]) {
                this.keys[key] = true;
                
                // Debug teleport on 'B' key press
                if (key === 'b' && this.debug) {
                    this.handleDebugTeleport();
                }
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Set up stage for input
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;

        // Handle pointer events
        this.app.stage.on('pointermove', (e) => {
            const pos = e.global.clone();
            this.pointerPosition = this.screenToWorld(pos.x, pos.y);
            
            if (this.debug) {
                console.log('Pointer Move:', {
                    screen: e.global,
                    world: this.pointerPosition,
                    scale: this.scale
                });
            }
        });

        this.app.stage.on('pointerdown', (e) => {
            const pos = e.global.clone();
            this.pointerPosition = this.screenToWorld(pos.x, pos.y);
            this.pointerDown = true;
        });

        this.app.stage.on('pointerup', () => {
            this.pointerDown = false;
        });

        this.app.stage.on('pointerleave', () => {
            this.pointerDown = false;
            this.pointerPosition = null;
        });
    }

    updateScale(width, height) {
        this.scale = {
            x: width / this.app.screen.width,
            y: height / this.app.screen.height
        };
    }

    screenToWorld(screenX, screenY) {
        // Convert screen coordinates to world space considering scale
        const worldX = (screenX / this.scale.x) - this.worldContainer.x;
        const worldY = (screenY / this.scale.y) - this.worldContainer.y;
        
        return { x: worldX, y: worldY };
    }

    handleWeaponSwitch(callback) {
        window.addEventListener('keydown', (e) => {
            const weaponKey = e.key;
            if (['1', '2', '3', '4'].includes(weaponKey)) {
                callback(parseInt(weaponKey));
            }
        });
    }

    getMovementDirection(delta, playerSpeed, joystick = null) {
        if (!gameState.player) return { x: 0, y: 0 };

        let dx = 0;
        let dy = 0;

        // Handle keyboard movement with normalized case
        if (this.keys['arrowleft'] || this.keys['a']) dx -= 1;
        if (this.keys['arrowright'] || this.keys['d']) dx += 1;
        if (this.keys['arrowup'] || this.keys['w']) dy -= 1;
        if (this.keys['arrowdown'] || this.keys['s']) dy += 1;

        // Handle joystick input
        if (joystick?.active) {
            dx = joystick.position.x;
            dy = joystick.position.y;
        }
        // Handle pointer/mouse movement
        else if (this.pointerDown && this.pointerPosition && (!joystick || !joystick.visible)) {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            // Calculate direction from center to pointer
            const dirX = (this.pointerPosition.x - centerX) / this.scale.x;
            const dirY = (this.pointerPosition.y - centerY) / this.scale.y;
            
            // Apply dead zone
            const distance = Math.sqrt(dirX * dirX + dirY * dirY);
            if (distance > 5) {
                dx = dirX / distance;
                dy = dirY / distance;
            }
        }

        // Normalize movement vector if there is movement
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length > 0) {
                dx = dx / length;
                dy = dy / length;
            }
        }

        // Apply speed and delta
        const speed = playerSpeed * delta;
        const movement = {
            x: dx * speed,
            y: dy * speed
        };

        if (this.debug && (movement.x !== 0 || movement.y !== 0)) {
            console.log('Movement:', {
                raw: { dx, dy },
                speed,
                final: movement,
                scale: this.scale
            });
        }

        return movement;
    }

    handleDebugTeleport() {
        const { gameState } = window;
        if (!gameState.player) {
            console.warn('Debug teleport: No player found');
            return;
        }

        // Calculate center of viewport
        const centerX = Math.floor(this.app.screen.width / 2);
        const centerY = Math.floor(this.app.screen.height / 2);

        // Set player position to center
        gameState.player.position.set(centerX, centerY);

        // Reset world container position to 0,0
        this.worldContainer.position.set(0, 0);

        console.log('Debug teleport activated:', {
            player: {
                x: gameState.player.x,
                y: gameState.player.y,
                visible: gameState.player.visible
            },
            world: {
                x: this.worldContainer.x,
                y: this.worldContainer.y
            },
            viewport: {
                width: this.app.screen.width,
                height: this.app.screen.height,
                center: { x: centerX, y: centerY }
            }
        });
    }
} 