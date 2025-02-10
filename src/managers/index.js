/**
 * @file managers/index.js
 * @description Exports all game manager classes
 * 
 * Available Managers:
 * - InputManager: Handles user input and movement
 * - UIManager: Manages game UI elements and HUD
 * - EnemyManager: Controls enemy spawning and behavior
 * - BulletManager: Handles projectile creation and updates
 * - EffectsManager: Manages visual effects and particles
 * - PortalManager: Controls area transitions and portals
 * - ExperienceManager: Handles experience orbs and leveling
 * - UpgradeManager: Manages player upgrades and abilities
 * 
 * Note: Viewport and camera functionality is now handled by ViewportSystem
 * in the systems directory.
 * 
 * Example Usage:
 * ```javascript
 * import { InputManager, UIManager } from './managers';
 * 
 * const input = new InputManager(app);
 * const ui = new UIManager(app, game);
 * ```
 */

export * from './InputManager.js';
export * from './UIManager.js';
export * from './EnemyManager.js';
export * from './BulletManager.js';
export * from './EffectsManager.js';
export * from './PortalManager.js';
export * from './ExperienceManager.js';
export * from './UpgradeManager.js'; 