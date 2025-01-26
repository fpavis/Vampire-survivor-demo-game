import { STYLES } from './config.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.zIndex = 1000;  // Keep UI on top
        app.stage.addChild(this.container);
        this.elements = {};
        this.previousLevel = 1;
        this.createUIElements();
    }

    createUIElements() {
        // Create UI panel background
        const panel = new PIXI.Graphics();
        panel.beginFill(0x000000, 0.5);
        panel.drawRoundedRect(5, 5, 200, 150, 10);
        panel.endFill();
        this.container.addChild(panel);

        const textStyle = {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 2,
            dropShadowDistance: 1
        };

        const debugStyle = {
            ...textStyle,
            fontSize: 14,
            fill: '#AAAAAA'
        };

        // Create stat icons
        this.createIcon(15, 15, 0xFF0000, '❤️'); // Health
        this.createIcon(15, 45, 0xFFD700, '⭐'); // Score
        this.createIcon(15, 75, 0x00FF00, '📊'); // Level
        this.createIcon(15, 105, 0xFF00FF, '💎'); // XP

        this.elements = {
            scoreText: new PIXI.Text('Score: 0', textStyle),
            healthText: new PIXI.Text('Health: 100/100', textStyle),
            levelText: new PIXI.Text('Level: 1', textStyle),
            experienceText: new PIXI.Text('XP: 0/10', textStyle),
            debugText: new PIXI.Text('', debugStyle)
        };

        // Position UI elements with offset for icons
        this.elements.healthText.position.set(40, 10);
        this.elements.scoreText.position.set(40, 40);
        this.elements.levelText.position.set(40, 70);
        this.elements.experienceText.position.set(40, 100);
        this.elements.debugText.position.set(10, 170);

        // Add elements to container
        Object.values(this.elements).forEach(element => {
            this.container.addChild(element);
        });

        // Add XP bar
        this.xpBar = this.createProgressBar(10, 130, 190, 10, 0x8800FF);
        this.healthBar = this.createProgressBar(40, 30, 160, 6, 0xFF0000);
    }

    createIcon(x, y, color, emoji) {
        const text = new PIXI.Text(emoji, {
            fontSize: 20,
            align: 'center'
        });
        text.position.set(x, y);
        this.container.addChild(text);
    }

    createProgressBar(x, y, width, height, color) {
        const container = new PIXI.Container();
        
        // Background
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.5);
        bg.drawRoundedRect(0, 0, width, height, height/2);
        bg.endFill();
        
        // Progress
        const bar = new PIXI.Graphics();
        bar.beginFill(color);
        bar.drawRoundedRect(0, 0, width, height, height/2);
        bar.endFill();
        
        container.addChild(bg, bar);
        container.position.set(x, y);
        this.container.addChild(container);
        
        return bar;
    }

    updateScore(score) {
        this.elements.scoreText.text = `Score: ${score}`;
    }

    updateHealth(health, maxHealth) {
        this.elements.healthText.text = `${Math.floor(health)}/${maxHealth}`;
        this.healthBar.scale.x = health / maxHealth;
    }

    updateLevel(level) {
        this.elements.levelText.text = `Level: ${level}`;
        // Only flash if level has increased
        if (level > this.previousLevel) {
            this.createFlashEffect(this.elements.levelText);
            this.previousLevel = level;
        }
    }

    updateExperience(experience, nextLevel) {
        this.elements.experienceText.text = `XP: ${experience}/${nextLevel}`;
        this.xpBar.scale.x = experience / nextLevel;
    }

    updateDebugPanel(state) {
        this.elements.debugText.text = 
            `⚔️ Attack: ${state.attackDamage} | 🏃 Speed: ${state.playerSpeed.toFixed(1)}\n` +
            `⚡ Attack Speed: ${(1000 / state.fireRate).toFixed(1)}/s\n` +
            `❤️ Regen: ${state.healthRegen.toFixed(1)}/s`;
    }

    createFlashEffect(target) {
        // Store original scale if not already stored
        if (!target.originalScale) {
            target.originalScale = { x: target.scale.x, y: target.scale.y };
        }

        // Cancel any existing flash timeout
        if (target.flashTimeout) {
            clearTimeout(target.flashTimeout);
        }

        // Apply flash effect
        target.scale.set(target.originalScale.x * 1.5, target.originalScale.y * 1.5);
        target.tint = 0xFFFF00;
        
        // Reset after flash
        target.flashTimeout = setTimeout(() => {
            target.scale.set(target.originalScale.x, target.originalScale.y);
            target.tint = 0xFFFFFF;
            target.flashTimeout = null;
        }, 200);
    }

    // Add other UI update methods...
} 