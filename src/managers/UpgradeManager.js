/**
 * @file UpgradeManager.js
 * @description Manages the player upgrade system, including level-up bonuses, stat improvements,
 * and upgrade selection UI. Controls the progression and power scaling of the player.
 * 
 * @module managers/UpgradeManager
 * @requires core/gameState
 * @requires core/config
 * 
 * Key Features:
 * - Generates random upgrade options
 * - Handles level-up stat increases
 * - Manages upgrade selection UI
 * - Controls player progression
 * - Implements upgrade scaling
 * 
 * Usage:
 * ```js
 * const upgradeManager = new UpgradeManager(ui);
 * const upgrades = upgradeManager.getRandomUpgrades();
 * upgradeManager.handleLevelUp();
 * ```
 * 
 * Modification Guidelines:
 * - Add new upgrade types in the upgrade pool
 * - Modify upgrade effects and scaling
 * - Adjust level-up bonuses
 * - Implement new progression systems
 * - Add upgrade combinations or paths
 * 
 * @class
 */

import { gameState } from '../core/gameState.js';
import { LEVEL_SCALING } from '../core/config.js';

export class UpgradeManager {
    constructor(ui) {
        this.ui = ui;
    }

    getRandomUpgrades() {
        const allUpgrades = [
            { 
                key: '1', 
                text: 'Increase Fire Rate', 
                action: () => {
                    gameState.fireRate *= LEVEL_SCALING.fireRateUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '2', 
                text: 'Increase Speed', 
                action: () => {
                    gameState.playerSpeed *= LEVEL_SCALING.speedUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '3', 
                text: 'Increase Health', 
                action: () => {
                    gameState.maxHealth = Math.floor(gameState.maxHealth * LEVEL_SCALING.healthUpgrade);
                    gameState.health = gameState.maxHealth;
                    this.ui.updateHealth(gameState.health, gameState.maxHealth);
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '4', 
                text: 'Increase Attack Damage', 
                action: () => {
                    gameState.attackDamage *= LEVEL_SCALING.damageUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            },
            { 
                key: '5', 
                text: 'Increase Health Regen', 
                action: () => {
                    gameState.healthRegen += LEVEL_SCALING.healthRegenUpgrade;
                    this.ui.updateDebugPanel(gameState);
                }
            }
        ];

        // Shuffle and return 3 random upgrades
        return allUpgrades.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    handleLevelUp() {
        // Update level-related stats
        gameState.level++;
        gameState.experience = 0;
        
        // Calculate next level XP requirement
        gameState.nextLevel = Math.floor(gameState.nextLevel * LEVEL_SCALING.experienceMultiplier);
        
        gameState.levelUp = false;
        
        // Update UI with new level info
        this.ui.updateLevel(gameState.level);
        this.ui.updateExperience(gameState.experience, gameState.nextLevel);
        this.ui.updateHealth(gameState.health, gameState.maxHealth);
        this.ui.updateDebugPanel(gameState);
    }
} 