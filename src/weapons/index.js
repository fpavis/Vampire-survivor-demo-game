/**
 * @file index.js
 * @description Weapons module exports that provide access to weapon systems and configurations.
 * Centralizes all weapon-related functionality for easy access.
 * 
 * @module weapons
 * 
 * Key Exports:
 * - Weapon: Base weapon class for all weapon types
 * - WEAPON_UPGRADES: Available weapon upgrade configurations
 * 
 * Usage:
 * ```js
 * import { Weapon, WEAPON_UPGRADES } from './weapons';
 * 
 * // Create a weapon
 * const pistol = new Weapon('PISTOL');
 * 
 * // Access upgrade info
 * const damageUpgrade = WEAPON_UPGRADES.DAMAGE;
 * ```
 * 
 * Note: This is a barrel file that consolidates weapon-related exports.
 * Import from here to get access to all weapon functionality.
 */

// Export weapon modules
export * from './Weapon.js'; 