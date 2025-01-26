import { gameState } from './gameState.js';

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