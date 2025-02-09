/**
 * @file ExperienceManager.js
 * @description Manages the experience system, including experience gem collection, leveling up,
 * and the magnetic pull effect that draws nearby experience gems to the player.
 * 
 * @module managers/ExperienceManager
 * @requires core/gameState
 * 
 * Key Features:
 * - Handles experience gem collection and magnetism
 * - Manages experience point accumulation
 * - Triggers level-up events
 * - Controls gem cleanup during area transitions
 * 
 * Usage:
 * ```js
 * const expManager = new ExperienceManager(app, worldContainer);
 * expManager.setUI(uiManager);
 * expManager.setUpgradeManager(upgradeManager);
 * expManager.updateExperienceGems(delta);
 * ```
 * 
 * Modification Guidelines:
 * - Adjust magnetRange and magnetSpeed to modify gem collection behavior
 * - Modify collectGem method to change experience collection effects
 * - Add new experience-related features by extending the update loop
 * - Implement different experience scaling by modifying the collection logic
 * 
 * @class
 */

import { gameState } from '../core/gameState.js';

export class ExperienceManager {
    constructor(app, worldContainer, ui, upgradeManager) {
        this.app = app;
        this.worldContainer = worldContainer;
        this.ui = ui;
        this.upgradeManager = upgradeManager;
        
        this.magnetRange = 150;
        this.magnetSpeed = 15;
        this.collectionRange = 20;
    }

    setUI(ui) {
        this.ui = ui;
    }

    setUpgradeManager(upgradeManager) {
        this.upgradeManager = upgradeManager;
    }

    updateExperienceGems(delta) {
        for (let i = gameState.experienceGems.length - 1; i >= 0; i--) {
            const gem = gameState.experienceGems[i];
            const dx = gameState.player.x - gem.sprite.x;
            const dy = gameState.player.y - gem.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.magnetRange) {
                const speed = this.magnetSpeed * (1 - distance / this.magnetRange);
                gem.sprite.x += (dx / distance) * speed * delta;
                gem.sprite.y += (dy / distance) * speed * delta;
            }

            // Check if gem should be collected
            if (distance < this.collectionRange) {
                this.collectGem(gem, i);
            }
        }
    }

    collectGem(gem, index) {
        // Add experience
        gameState.experience += gem.value;
        
        // Check for level up
        if (gameState.experience >= gameState.nextLevel) {
            gameState.levelUp = true;
            this.ui.showLevelUp(this.upgradeManager.getRandomUpgrades());
        }
        
        // Update UI
        this.ui.updateExperience(gameState.experience, gameState.nextLevel);
        
        // Remove gem
        this.worldContainer.removeChild(gem.sprite);
        gameState.experienceGems.splice(index, 1);
    }

    cleanup() {
        gameState.experienceGems.forEach(gem => {
            if (gem.sprite && gem.sprite.parent) {
                gem.sprite.parent.removeChild(gem.sprite);
            }
        });
        gameState.experienceGems = [];
    }
} 