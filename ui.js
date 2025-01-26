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
        this.createJoystick();  // Initialize joystick
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

    createJoystick() {
        const joystickContainer = new PIXI.Container();
        
        // Base circle - bigger and more transparent
        const base = new PIXI.Graphics();
        base.beginFill(0x000000, 0.2);  // More transparent background
        base.lineStyle(2, 0xFFFFFF, 0.3);  // More transparent border
        base.drawCircle(0, 0, 130);  // Increased size for better control
        base.endFill();

        // Stick - bigger and more transparent
        const stick = new PIXI.Graphics();
        stick.beginFill(0xFFFFFF, 0.3);  // More transparent stick
        stick.drawCircle(0, 0, 50);  // Increased size proportionally
        stick.endFill();

        joystickContainer.addChild(base, stick);
        this.container.addChild(joystickContainer);

        // Joystick state
        const joystick = {
            container: joystickContainer,
            stick: stick,
            baseRadius: 130,  // Match the new radius
            active: false,
            data: null,
            position: { x: 0, y: 0 }
        };

        // Touch handlers
        joystickContainer.eventMode = 'static';
        joystickContainer.on('pointerdown', (e) => {
            e.stopPropagation();  // Prevent click-to-move when using joystick
            this.onJoystickDown(e, joystick);
        });
        this.app.stage.on('pointermove', (e) => this.onJoystickMove(e, joystick));
        this.app.stage.on('pointerup', () => this.onJoystickUp(joystick));
        this.app.stage.on('pointerupoutside', () => this.onJoystickUp(joystick));

        // Position joystick at bottom center, 10% up from bottom
        const bottomPercentage = 0.10;  // 10% from bottom
        const bottomOffset = this.app.screen.height * bottomPercentage;
        joystickContainer.position.set(
            this.app.screen.width / 2,
            this.app.screen.height - bottomOffset
        );
        
        // Store joystick reference
        this.joystick = joystick;

        // Show joystick on mobile devices using multiple checks
        const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const touchWindow = 'ontouchstart' in window;
        const touchPoints = navigator.maxTouchPoints > 0;
        const isMobile = userAgent || touchWindow || touchPoints;
            
        joystickContainer.visible = isMobile;

        // Add debug text for mobile detection
        const debugText = new PIXI.Text(
            `Mobile Detection:\nUser Agent: ${userAgent}\nTouch Window: ${touchWindow}\nTouch Points: ${touchPoints}\nFinal: ${isMobile}`, 
            {
                fontSize: 14,
                fill: 0xFFFFFF,
                stroke: '#000000',
                strokeThickness: 2,
                align: 'left'
            }
        );
        debugText.position.set(10, this.app.screen.height - 200);
        this.container.addChild(debugText);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const newBottomOffset = this.app.screen.height * bottomPercentage;
            joystickContainer.position.set(
                this.app.screen.width / 2,
                this.app.screen.height - newBottomOffset
            );
            debugText.position.set(10, this.app.screen.height - 200);
        });
    }

    onJoystickDown(event, joystick) {
        joystick.active = true;
        joystick.data = event.data;
        joystick.stick.alpha = 0.8;
    }

    onJoystickMove(event, joystick) {
        if (!joystick.active) return;

        const newPosition = joystick.data.getLocalPosition(joystick.container);
        const distance = Math.sqrt(newPosition.x * newPosition.x + newPosition.y * newPosition.y);
        
        if (distance <= joystick.baseRadius) {
            joystick.stick.position = newPosition;
        } else {
            // Normalize the position to the base radius
            const angle = Math.atan2(newPosition.y, newPosition.x);
            joystick.stick.position.x = Math.cos(angle) * joystick.baseRadius;
            joystick.stick.position.y = Math.sin(angle) * joystick.baseRadius;
        }

        // Update normalized position (-1 to 1)
        joystick.position = {
            x: joystick.stick.position.x / joystick.baseRadius,
            y: joystick.stick.position.y / joystick.baseRadius
        };
    }

    onJoystickUp(joystick) {
        joystick.active = false;
        joystick.data = null;
        joystick.stick.position.set(0, 0);
        joystick.stick.alpha = 0.5;
        joystick.position = { x: 0, y: 0 };
    }

    // Add other UI update methods...
} 