/**
 * @file gameState.js
 * @description Central game state management module that maintains the current state of the game.
 * Provides a single source of truth for game variables and state tracking.
 * 
 * @module core/gameState
 * @requires core/config
 * 
 * Key Features:
 * - Maintains player stats and state
 * - Tracks game progression
 * - Manages entity collections
 * - Controls game flags and status
 * - Provides state reset functionality
 * 
 * Usage:
 * ```js
 * import { gameState } from './gameState.js';
 * 
 * // Access game state
 * console.log(gameState.health);
 * 
 * // Update state
 * gameState.score += 100;
 * 
 * // Reset state
 * gameState.reset();
 * ```
 * 
 * State Properties:
 * - Player: health, level, experience, weapons
 * - Game: score, paused, gameOver
 * - Collections: enemies, bullets, experienceGems
 * - Status: levelUp, invulnerable
 * 
 * Modification Guidelines:
 * - Add new state properties for new features
 * - Extend reset method for new properties
 * - Add state validation if needed
 * - Implement state persistence
 * - Add state change events/callbacks
 * 
 * @type {Object}
 */

import { INITIAL_STATE } from './config.js';

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        Object.assign(this, {
            ...INITIAL_STATE,
            gameStartTime: Date.now(),
            enemies: [],
            bullets: [],
            experienceGems: [],
            keys: {},
            pointerPosition: null,
            pointerDown: false,
            invulnerable: false,
            gameOver: false,
            levelUp: false,
            paused: false,
            killCount: 0
        });
        this.lastFire = 0;
        this.pendingExperience = 0;
        this.gameTicker = null;
        
        // Ensure nextLevel is properly set
        this.nextLevel = INITIAL_STATE.XP_TO_LEVEL;
    }
}

export const gameState = new GameState(); 