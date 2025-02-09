/**
 * @file index.js
 * @description Entities module exports that provide access to game entity systems.
 * Centralizes all entity-related functionality including player, enemies, and projectiles.
 * 
 * @module entities
 * 
 * Key Exports:
 * - EntityManager: Factory class for creating and managing game entities
 * - Entity types: Player, enemies, projectiles, and collectibles
 * 
 * Usage:
 * ```js
 * import { EntityManager } from './entities';
 * 
 * // Create player
 * const player = EntityManager.createPlayer(app);
 * 
 * // Create enemy
 * const enemy = EntityManager.createEnemy(app, 'BASIC', x, y);
 * ```
 * 
 * Note: This is a barrel file that consolidates entity-related exports.
 * Import from here to get access to all entity functionality.
 */

// Export entity modules
export * from './Entity.js'; 