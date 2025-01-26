import { STYLES } from './config.js';
import { gameState } from './gameState.js';

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

        // Add keyboard shortcut for settings
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleSettings();
            }
        });

        // Sort children by zIndex
        this.app.stage.sortChildren();
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

        // Create settings button in top right
        const settingsButton = new PIXI.Container();
        const settingsIcon = new PIXI.Text('⚙️', { fontSize: 24 });
        settingsIcon.anchor.set(0.5);
        
        const settingsBg = new PIXI.Graphics();
        settingsBg.beginFill(0x000000, 0.3);
        settingsBg.drawCircle(0, 0, 20);
        settingsBg.endFill();
        
        settingsButton.addChild(settingsBg, settingsIcon);
        // Position in top right with margin
        settingsButton.position.set(this.app.screen.width - 40, 40);
        settingsButton.eventMode = 'static';
        settingsButton.cursor = 'pointer';
        
        // Add window resize handler for settings button
        window.addEventListener('resize', () => {
            settingsButton.position.set(this.app.screen.width - 40, 40);
        });
        
        settingsButton.on('pointerdown', () => this.toggleSettings());
        settingsButton.on('pointerover', () => {
            settingsBg.clear();
            settingsBg.beginFill(0x333333, 0.5);
            settingsBg.drawCircle(0, 0, 20);
        });
        settingsButton.on('pointerout', () => {
            settingsBg.clear();
            settingsBg.beginFill(0x000000, 0.3);
            settingsBg.drawCircle(0, 0, 20);
        });
        
        this.container.addChild(settingsButton);

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
        base.beginFill(0x000000, 0.2);
        base.lineStyle(2, 0xFFFFFF, 0.3);
        base.drawCircle(0, 0, 130);
        base.endFill();

        // Stick - bigger and more transparent
        const stick = new PIXI.Graphics();
        stick.beginFill(0xFFFFFF, 0.3);
        stick.drawCircle(0, 0, 50);
        stick.endFill();

        joystickContainer.addChild(base, stick);
        this.container.addChild(joystickContainer);

        // Joystick state with configuration
        const joystick = {
            container: joystickContainer,
            stick: stick,
            baseRadius: 130,
            active: false,
            data: null,
            position: { x: 0, y: 0 },
            config: {
                rightHanded: false,  // Add option for right/left handed
                safeAreaInset: 0,    // Will be updated based on device
                opacity: 0.3,        // Configurable opacity
                size: 1.0,           // Size multiplier
                positionX: 0.5       // Position multiplier
            }
        };

        // Apply configuration
        this.updateJoystickConfig(joystick);

        // Touch handlers with better touch handling
        joystickContainer.eventMode = 'static';
        joystickContainer.cursor = 'pointer';
        
        // Improved touch handling
        joystickContainer.on('pointerdown', (e) => {
            e.stopPropagation();
            this.onJoystickDown(e, joystick);
        });

        // Use passive listeners for better performance
        this.app.stage.on('pointermove', (e) => this.onJoystickMove(e, joystick), { passive: true });
        this.app.stage.on('pointerup', () => this.onJoystickUp(joystick), { passive: true });
        this.app.stage.on('pointerupoutside', () => this.onJoystickUp(joystick), { passive: true });

        // Position joystick based on configuration
        this.updateJoystickPosition(joystick);
        
        // Store joystick reference
        this.joystick = joystick;

        // Mobile detection with better device checking
        const isMobile = this.checkMobileDevice();
        joystickContainer.visible = isMobile;

        // Handle orientation change and resize
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateJoystickPosition(joystick);
                this.updateJoystickConfig(joystick);
            }, 100);
        });

        window.addEventListener('resize', () => {
            this.updateJoystickPosition(joystick);
        });

        // Return for settings menu access
        return joystick;
    }

    updateJoystickConfig(joystick) {
        // Get device safe area
        const safeArea = {
            top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0'),
            bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'),
            left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sal') || '0'),
            right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0')
        };

        // Update configuration
        joystick.config.safeAreaInset = Math.max(safeArea.bottom, 20);
        
        // Apply opacity
        joystick.container.alpha = joystick.config.opacity;
        
        // Apply size
        const scale = joystick.config.size;
        joystick.container.scale.set(scale);
    }

    updateJoystickPosition(joystick) {
        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;
        
        // Calculate position based on screen size and orientation
        const bottomOffset = screenHeight * 0.15 + joystick.config.safeAreaInset;
        
        // Use positionX value (0 to 1) to determine x position
        const positionX = joystick.config.positionX || 0;
        const margin = screenWidth * 0.15; // 15% margin from edges
        const usableWidth = screenWidth - (margin * 2); // Width available for positioning
        const x = margin + (usableWidth * positionX); // Linear interpolation
            
        joystick.container.position.set(
            x,
            screenHeight - bottomOffset
        );
    }

    checkMobileDevice() {
        // More comprehensive mobile detection
        const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const touchWindow = 'ontouchstart' in window;
        const touchPoints = navigator.maxTouchPoints > 0;
        const mobileScreen = window.innerWidth <= 1024;
        
        return userAgent || (touchWindow && touchPoints) || mobileScreen;
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

    toggleSettings() {
        if (!this.settingsMenu) {
            this.createSettingsMenu();
        }

        // Toggle visibility and pause state
        const isOpening = !this.settingsMenu.visible;
        this.settingsMenu.visible = isOpening;
        gameState.paused = isOpening;

        // Update UI elements based on state
        if (isOpening) {
            // Opening settings
            this.settingsMenu.children.forEach(child => {
                child.eventMode = 'static';  // Ensure all children are interactive
            });
        } else {
            // Closing settings
            this.settingsMenu.children.forEach(child => {
                if (child instanceof PIXI.Graphics) {
                    child.eventMode = 'none';
                }
            });
        }
    }

    createSettingsMenu() {
        const menu = new PIXI.Container();
        menu.visible = false;
        menu.zIndex = 2000; // Ensure it's above other UI elements
        menu.eventMode = 'static'; // Make entire menu interactive

        // Background overlay
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.8);
        overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.endFill();
        overlay.eventMode = 'static'; // Make overlay interactive
        overlay.on('pointerdown', (e) => e.stopPropagation()); // Prevent clicks through overlay
        menu.addChild(overlay);

        // Settings panel - moved to top right
        const panel = new PIXI.Graphics();
        panel.beginFill(0x333333, 0.95);
        panel.lineStyle(2, 0xFFFFFF, 0.8);
        panel.drawRoundedRect(0, 0, 300, 400, 10);
        panel.endFill();
        panel.position.set(
            this.app.screen.width - 320,  // 20px margin from right
            20  // 20px margin from top
        );
        panel.eventMode = 'static'; // Make panel interactive
        menu.addChild(panel);

        // Title
        const title = new PIXI.Text('Settings', {
            fontSize: 24,
            fill: 0xFFFFFF,
            fontWeight: 'bold'
        });
        title.position.set(panel.x + 150, panel.y + 20);
        title.anchor.x = 0.5;
        menu.addChild(title);

        // Pause text
        const pauseText = new PIXI.Text('GAME PAUSED', {
            fontSize: 48,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 4,
            dropShadowDistance: 2
        });
        pauseText.anchor.set(0.5);
        pauseText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
        menu.addChild(pauseText);

        // Settings options
        const options = [
            {
                label: 'Joystick Position',
                type: 'slider',
                min: 0,
                max: 1,
                step: 0.1,
                get: () => this.joystick.config.rightHanded ? 1 : 0,
                set: (value) => {
                    this.joystick.config.rightHanded = value > 0.5;
                    this.joystick.config.positionX = value; // Store actual position value
                    this.updateJoystickPosition(this.joystick);
                }
            },
            {
                label: 'Joystick Size',
                type: 'slider',
                min: 0.5,
                max: 1.5,
                step: 0.1,
                get: () => this.joystick.config.size,
                set: (value) => {
                    this.joystick.config.size = value;
                    this.updateJoystickConfig(this.joystick);
                }
            },
            {
                label: 'Opacity',
                type: 'slider',
                min: 0.1,
                max: 1.0,
                step: 0.1,
                get: () => this.joystick.config.opacity,
                set: (value) => {
                    this.joystick.config.opacity = value;
                    this.updateJoystickConfig(this.joystick);
                }
            }
        ];

        // Create UI elements for each option
        let yOffset = 70;
        options.forEach(option => {
            const label = new PIXI.Text(option.label, {
                fontSize: 16,
                fill: 0xFFFFFF
            });
            label.position.set(panel.x + 20, panel.y + yOffset);
            menu.addChild(label);

            if (option.type === 'slider') {
                const slider = this.createSlider(
                    panel.x + 150,
                    panel.y + yOffset,
                    option.min,
                    option.max,
                    option.step,
                    option.get(),
                    (value) => option.set(value)
                );
                menu.addChild(slider);
            }

            yOffset += 50;
        });

        // Close button
        const closeButton = new PIXI.Graphics();
        closeButton.beginFill(0xFF0000);
        closeButton.drawRoundedRect(0, 0, 80, 30, 5);
        closeButton.endFill();
        closeButton.position.set(panel.x + 110, panel.y + 350);
        closeButton.eventMode = 'static';
        closeButton.cursor = 'pointer';

        const closeText = new PIXI.Text('Close', {
            fontSize: 16,
            fill: 0xFFFFFF
        });
        closeText.anchor.set(0.5);
        closeText.position.set(40, 15);
        closeButton.addChild(closeText);

        closeButton.on('pointerdown', () => {
            this.toggleSettings();  // Use toggleSettings instead of direct visibility change
        });

        menu.addChild(closeButton);
        this.container.addChild(menu);
        this.settingsMenu = menu;

        // Handle window resize
        window.addEventListener('resize', () => {
            if (menu.visible) {
                overlay.clear();
                overlay.beginFill(0x000000, 0.8);
                overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
                panel.position.set(
                    this.app.screen.width - 320,
                    20
                );
                pauseText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
            }
        });

        return menu;
    }

    createSlider(x, y, min, max, step, initial, onChange) {
        const slider = new PIXI.Container();
        slider.position.set(x, y);

        const track = new PIXI.Graphics();
        track.beginFill(0x666666);
        track.drawRect(0, 0, 100, 4);
        track.endFill();

        const handle = new PIXI.Graphics();
        handle.beginFill(0xFFFFFF);
        handle.drawCircle(0, 0, 8);
        handle.endFill();

        const initialX = ((initial - min) / (max - min)) * 100;
        handle.position.set(initialX, 2);

        slider.addChild(track, handle);
        slider.eventMode = 'static';
        handle.eventMode = 'static';
        handle.cursor = 'pointer';

        let dragging = false;
        handle.on('pointerdown', () => dragging = true);
        this.app.stage.on('pointerup', () => dragging = false);
        this.app.stage.on('pointermove', (e) => {
            if (!dragging) return;
            const bounds = slider.getBounds();
            let x = Math.max(0, Math.min(100, e.global.x - bounds.x));
            handle.position.x = x;
            const value = min + (x / 100) * (max - min);
            onChange(Math.round(value / step) * step);
        });

        return slider;
    }

    // Add other UI update methods...
} 