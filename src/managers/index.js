/**
 * @file index.js
 * @description Managers module exports that provide access to all game management systems.
 * Centralizes access to systems that control different aspects of gameplay.
 * 
 * @module managers
 * 
 * Key Exports:
 * - CameraManager: Controls viewport and camera movement
 * - CollisionSystem: Handles collision detection and resolution
 * - CombatSystem: Manages combat mechanics and weapons
 * - EffectsManager: Controls visual effects and particles
 * - EnemyManager: Handles enemy spawning and behavior
 * - ExperienceManager: Manages XP collection and leveling
 * - InputManager: Processes player input
 * - PortalManager: Controls area transitions
 * - UIManager: Manages game interface
 * - UpgradeManager: Handles player upgrades
 * 
 * Usage:
 * ```js
 * import {
 *   CameraManager,
 *   CollisionSystem,
 *   EnemyManager,
 *   // ... other managers
 * } from './managers';
 * 
 * // Initialize managers
 * const camera = new CameraManager(app, worldContainer);
 * const enemies = new EnemyManager(app, worldContainer);
 * ```
 * 
 * Note: This is a barrel file that consolidates all game management systems.
 * Import from here to get access to all manager functionality.
 */

// Export all manager modules
export * from './CameraManager.js';
export * from './CollisionSystem.js';
export * from './CombatSystem.js';
export * from './EffectsManager.js';
export * from './EnemyManager.js';
export * from './ExperienceManager.js';
export * from './InputManager.js';
export * from './PortalManager.js';
export * from './UIManager.js';
export * from './UpgradeManager.js'; 