import { gameState } from './gameState.js';
import { LEVEL_SCALING } from './config.js';

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