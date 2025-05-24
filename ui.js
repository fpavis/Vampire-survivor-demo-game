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
        // Create UI panel background - Increased height from 150 to 180
        const panel = new PIXI.Graphics();
        panel.roundRect(5, 5, 200, 180, 10); 
        panel.fill({ color: 0x000000, alpha: 0.5 });
        this.container.addChild(panel);

        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 16,
            fill: '#FFFFFF',
            stroke: { color: '#000000', width: 1 },
            dropShadow: {
                color: '#000000',
                blur: 2,
                distance: 1,
                alpha: 0.7
            }
        });

        const debugStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 14,
            fill: '#AAAAAA',
            stroke: { color: '#000000', width: 1 },
            dropShadow: {
                color: '#000000',
                blur: 2,
                distance: 1,
                alpha: 0.7
            }
        });

        // Create stat icons
        this.createIcon(15, 15, '❤️'); // Health
        this.createIcon(15, 45, '⭐'); // Score
        this.createIcon(15, 75, '📊'); // Level
        this.createIcon(15, 105, '💎'); // XP
        this.createIcon(15, 135, '💀'); // Kill Counter Icon

        // Create settings button in top right
        const settingsButton = new PIXI.Container();
        const settingsIcon = new PIXI.Text({ text: '⚙️', style: { fontSize: 24 }});
        settingsIcon.anchor.set(0.5);
        
        const settingsBg = new PIXI.Graphics();
        settingsBg.circle(0, 0, 20);
        settingsBg.fill({ color: 0x000000, alpha: 0.3 });
        
        settingsButton.addChild(settingsBg, settingsIcon);
        settingsButton.position.set(this.app.screen.width - 40, 40);
        settingsButton.eventMode = 'static';
        settingsButton.cursor = 'pointer';
        
        window.addEventListener('resize', () => {
            settingsButton.position.set(this.app.screen.width - 40, 40);
        });
        
        settingsButton.on('pointerdown', () => this.toggleSettings());
        settingsButton.on('pointerover', () => {
            settingsBg.clear();
            settingsBg.circle(0, 0, 20);
            settingsBg.fill({ color: 0x333333, alpha: 0.5 });
        });
        settingsButton.on('pointerout', () => {
            settingsBg.clear();
            settingsBg.circle(0, 0, 20);
            settingsBg.fill({ color: 0x000000, alpha: 0.3 });
        });
        
        this.container.addChild(settingsButton);

        this.elements = {
            scoreText: new PIXI.Text({ text: 'Score: 0', style: textStyle }),
            healthText: new PIXI.Text({ text: 'Health: 100/100', style: textStyle }),
            levelText: new PIXI.Text({ text: 'Level: 1', style: textStyle }),
            experienceText: new PIXI.Text({ text: 'XP: 0/10', style: textStyle }),
            killCounterText: new PIXI.Text({ text: '💀 0', style: textStyle }), // Added kill counter text
            debugText: new PIXI.Text({ text: '', style: debugStyle })
        };

        // Position UI elements with offset for icons
        this.elements.healthText.position.set(40, 10);
        this.elements.scoreText.position.set(40, 40);
        this.elements.levelText.position.set(40, 70);
        this.elements.experienceText.position.set(40, 100);
        this.elements.killCounterText.position.set(40, 130); // Positioned kill counter
        // Adjusted debug text position due to new panel height and kill counter
        this.elements.debugText.position.set(10, 200); 

        Object.values(this.elements).forEach(element => {
            this.container.addChild(element);
        });

        // Adjusted XP bar position due to new kill counter
        this.xpBar = this.createProgressBar(10, 160, 190, 10, 0x8800FF); 
        this.healthBar = this.createProgressBar(40, 30, 160, 6, 0xFF0000);
    }

    createIcon(x, y, emoji) {
        const text = new PIXI.Text({ 
            text: emoji, 
            style: { 
                fontSize: 20, 
                align: 'center' 
            }
        });
        text.position.set(x, y);
        this.container.addChild(text);
    }

    createProgressBar(x, y, width, height, color) {
        const container = new PIXI.Container();
        
        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, width, height, height / 2);
        bg.fill({ color: 0x000000, alpha: 0.5 });
        
        const bar = new PIXI.Graphics();
        bar.roundRect(0, 0, width, height, height / 2);
        bar.fill(color);
        
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

    updateKillCounter(kills) {
        if (this.elements.killCounterText) {
            this.elements.killCounterText.text = `💀 ${kills}`;
        }
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
        
        const base = new PIXI.Graphics();
        base.circle(0, 0, 130);
        base.fill({ color: 0x000000, alpha: 0.2 });
        base.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.3 });

        const stick = new PIXI.Graphics();
        stick.circle(0, 0, 50);
        stick.fill({ color: 0xFFFFFF, alpha: 0.3 });

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
            e.stopPropagation(); // Keep stopPropagation if it's intended to prevent other listeners on the stage
            this.onJoystickDown(e, joystick);
        });

        this.app.stage.on('pointermove', (e) => this.onJoystickMove(e, joystick)); // Passive option is not standard for PIXI events
        this.app.stage.on('pointerup', () => this.onJoystickUp(joystick));
        this.app.stage.on('pointerupoutside', () => this.onJoystickUp(joystick));

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
        if (!joystick.active || !joystick.data) return; // Added check for joystick.data

        const newPosition = event.getLocalPosition(joystick.container); // Use event.getLocalPosition
        const distance = Math.sqrt(newPosition.x * newPosition.x + newPosition.y * newPosition.y);
        
        const stickLimit = joystick.baseRadius - (joystick.stick.width / 2 / joystick.container.scale.x); // consider stick size and scale

        if (distance <= stickLimit) {
            joystick.stick.position.copyFrom(newPosition);
        } else {
            const angle = Math.atan2(newPosition.y, newPosition.x);
            joystick.stick.position.x = Math.cos(angle) * stickLimit;
            joystick.stick.position.y = Math.sin(angle) * stickLimit;
        }

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

        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.fill({ color: 0x000000, alpha: 0.8 });
        overlay.eventMode = 'static';
        overlay.on('pointerdown', (e) => e.stopPropagation());
        menu.addChild(overlay);

        const panel = new PIXI.Graphics();
        panel.roundRect(0, 0, 300, 400, 10);
        panel.fill({ color: 0x333333, alpha: 0.95 });
        panel.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.8 });
        panel.position.set(this.app.screen.width - 320, 20);
        panel.eventMode = 'static';
        menu.addChild(panel);

        const titleStyle = new PIXI.TextStyle({ fontSize: 24, fill: 0xFFFFFF, fontWeight: 'bold' });
        const title = new PIXI.Text({ text: 'Settings', style: titleStyle });
        title.position.set(panel.x + 150, panel.y + 20);
        title.anchor.x = 0.5;
        menu.addChild(title);

        const pauseTextStyle = new PIXI.TextStyle({
            fontSize: 48,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            dropShadow: { color: '#000000', blur: 4, distance: 2, alpha: 0.7 }
        });
        const pauseText = new PIXI.Text({ text: 'GAME PAUSED', style: pauseTextStyle });
        pauseText.anchor.set(0.5);
        pauseText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
        menu.addChild(pauseText);

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
        // Settings options
        const optionTextStyle = new PIXI.TextStyle({ fontSize: 16, fill: 0xFFFFFF });
        let yOffset = 70;
        options.forEach(option => {
            const label = new PIXI.Text({ text: option.label, style: optionTextStyle });
            label.position.set(panel.x + 20, panel.y + yOffset);
            menu.addChild(label);

            if (option.type === 'slider') {
                const slider = this.createSlider(
                    panel.x + 150, // Relative to panel
                    panel.y + yOffset, // Relative to panel
                    option.min,
                    option.max,
                    option.step,
                    option.get(),
                    (value) => option.set(value)
                );
                // slider is a container, add it to the menu, not panel, if positions are relative to menu/stage
                menu.addChild(slider);
            }

            yOffset += 50;
        });

        const closeButton = new PIXI.Graphics();
        closeButton.roundRect(0, 0, 80, 30, 5);
        closeButton.fill(0xFF0000);
        closeButton.position.set(panel.x + (panel.width - 80) / 2, panel.y + panel.height - 50); // Centered at bottom of panel
        closeButton.eventMode = 'static';
        closeButton.cursor = 'pointer';

        const closeTextStyle = new PIXI.TextStyle({ fontSize: 16, fill: 0xFFFFFF });
        const closeText = new PIXI.Text({ text: 'Close', style: closeTextStyle });
        closeText.anchor.set(0.5);
        closeText.position.set(closeButton.width / 2, closeButton.height / 2);
        closeButton.addChild(closeText);

        closeButton.on('pointerdown', () => this.toggleSettings());
        menu.addChild(closeButton); // Add to menu, not panel, if positions are relative to menu/stage

        this.container.addChild(menu);
        this.settingsMenu = menu;

        window.addEventListener('resize', () => {
            if (menu.visible) {
                overlay.clear();
                overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
                overlay.fill({ color: 0x000000, alpha: 0.8 });
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
        slider.position.set(x, y); // x,y are now absolute positions if slider added to menu

        const track = new PIXI.Graphics();
        track.rect(0, 0, 100, 4);
        track.fill(0x666666);

        const handle = new PIXI.Graphics();
        handle.circle(0, 0, 8);
        handle.fill(0xFFFFFF);

        const initialX = ((initial - min) / (max - min)) * 100;
        handle.position.set(initialX, 2); // y position relative to track center

        slider.addChild(track, handle);
        handle.eventMode = 'static'; // Make handle interactive, not the whole slider for dragging
        handle.cursor = 'pointer';

        let dragging = false;
        
        handle.on('pointerdown', (event) => {
            dragging = true;
            // Optional: record initial pointer position relative to handle if needed
            // handle.dragData = event.data.getLocalPosition(handle.parent);
        });
        
        // Listen on stage for move and up to handle dragging outside the handle
        this.app.stage.on('pointermove', (event) => {
            if (!dragging) return;
            
            // Convert global pointer position to slider's local coordinates
            const newPoint = event.getLocalPosition(slider);
            let xPos = Math.max(0, Math.min(100, newPoint.x));
            handle.position.x = xPos; // Corrected
            
            const value = min + (xPos / 100) * (max - min); // Corrected
            onChange(Math.round(value / step) * step);
        });
        
        this.app.stage.on('pointerup', () => {
            dragging = false;
            // delete handle.dragData;
        });
        this.app.stage.on('pointerupoutside', () => { // For robustness
            dragging = false;
            // delete handle.dragData;
        });
        
        // To ensure slider updates correctly when created
        const updateSliderVisual = (currentValue) => {
            const percent = (currentValue - min) / (max-min);
            handle.position.x = percent * 100;
        };
        updateSliderVisual(initial); // Set initial position

        return slider;
    }

    // Add other UI update methods...
} 