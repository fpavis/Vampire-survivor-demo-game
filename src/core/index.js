/**
 * @file index.js
 * @description Core module exports that provide access to fundamental game systems and configurations.
 * This is the main entry point for accessing core game functionality.
 * 
 * @module core
 * 
 * Key Exports:
 * - Game: Main game class that coordinates all systems
 * - gameState: Central state management object
 * - config: Game configuration and constants
 * 
 * Usage:
 * ```js
 * import { Game, gameState, GAME_CONFIG } from './core';
 * 
 * // Initialize game
 * const game = new Game();
 * 
 * // Access game state
 * console.log(gameState.level);
 * 
 * // Use configuration
 * const worldWidth = WORLD_CONFIG.width;
 * ```
 * 
 * Note: This is a barrel file that consolidates core exports.
 * Import from here to get access to all core functionality.
 */

// Export core modules
export { Game } from './Game.js';
export { gameState } from './gameState.js';
export { 
    GAME_CONFIG,
    WORLD_CONFIG,
    ENEMY_TYPES,
    LEVEL_SCALING,
    STYLES,
    SPAWN_CONFIG,
    COLLISION_CONFIG,
    LEVELS
} from './config.js'; 