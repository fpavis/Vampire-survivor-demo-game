import { STYLES } from './config.js';
import { gameState } from './gameState.js';

export class UIManager {
    constructor(app, game) {
        this.app = app;
        this.game = game;  // Store game instance for debug toggle
        
        // Create main UI container
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.app.stage.addChild(this.container);
        
        // Initialize UI elements and settings
        this.createUIElements();
        this.settingsMenu = this.createSettingsMenu();
        this.container.addChild(this.settingsMenu);
        
        // Create joystick if on mobile
        if (this.isMobileDevice()) {
            this.createJoystick();
        }
        
        // Add keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleSettings();
            } else if (e.key === 'p' || e.key === 'P') {
                this.toggleDebugView();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        // Update UI positions based on new screen size
        if (this.elements) {
            const panel = this.container.getChildAt(0); // Get the UI panel
            panel.clear();
            panel.beginFill(0x000000, 0.5);
            panel.drawRoundedRect(5, 5, 200, 150, 10);
            panel.endFill();
        }

        // Update settings menu position if it exists
        if (this.settingsMenu) {
            this.settingsMenu.position.set(this.app.screen.width - 320, 60);
        }
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    createUIElements() {
        // Create main UI panel background
        const panel = new PIXI.Graphics();
        panel.beginFill(0x000000, 0.7);
        panel.drawRoundedRect(5, 5, 250, 200, 10);
        panel.endFill();
        panel.zIndex = 1;
        this.container.addChild(panel);

        // Initialize elements object
        this.elements = {};

        // Define text styles
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

        // Create and position all UI elements
        let yPos = 15;
        const SPACING = 30;

        // Health (with icon and bar)
        this.createIcon(15, yPos, 0xFF0000, '❤️');
        this.elements.healthText = new PIXI.Text('Health: 100/100', textStyle);
        this.elements.healthText.position.set(40, yPos);
        this.elements.healthBar = this.createProgressBar(40, yPos + 20, 190, 6, 0xFF0000);
        yPos += SPACING + 10;

        // Weapon (with icon)
        this.createIcon(15, yPos, 0xFFFFFF, '🔫');
        this.elements.weaponText = new PIXI.Text('Weapon: Pistol (1-4)', textStyle);
        this.elements.weaponText.position.set(40, yPos);
        yPos += SPACING;

        // Level (with icon)
        this.createIcon(15, yPos, 0x00FF00, '📊');
        this.elements.levelText = new PIXI.Text('Level: 1', textStyle);
        this.elements.levelText.position.set(40, yPos);
        yPos += SPACING;

        // Experience (with icon and bar)
        this.createIcon(15, yPos, 0xFF00FF, '💎');
        this.elements.experienceText = new PIXI.Text('XP: 0/100', textStyle);
        this.elements.experienceText.position.set(40, yPos);
        this.elements.xpBar = this.createProgressBar(40, yPos + 20, 190, 6, 0x8800FF);
        yPos += SPACING + 10;

        // Score (with icon)
        this.createIcon(15, yPos, 0xFFD700, '⭐');
        this.elements.scoreText = new PIXI.Text('Score: 0', textStyle);
        this.elements.scoreText.position.set(40, yPos);
        yPos += SPACING;

        // Stats text (smaller font for detailed stats)
        const statsStyle = { ...textStyle, fontSize: 14 };
        this.elements.statsText = new PIXI.Text('', statsStyle);
        this.elements.statsText.position.set(15, yPos);

        // Add all elements to container with proper z-index
        Object.values(this.elements).forEach(element => {
            if (element instanceof PIXI.DisplayObject) {
                element.zIndex = 2;
                this.container.addChild(element);
            }
        });

        // Initial stats update
        this.updateStats(gameState);
    }

    updateStats(gameState) {
        if (!this.elements.statsText) return;

        const stats = [
            `ATK: ${Math.round(gameState.attackDamage)}`,
            `Rate: ${Math.round(60000/gameState.fireRate)}rpm`,
            `Speed: ${gameState.playerSpeed.toFixed(1)}`,
            `Regen: ${gameState.healthRegen.toFixed(1)}/s`
        ].join('  |  ');

        this.elements.statsText.text = stats;
    }

    createIcon(x, y, color, emoji) {
        const text = new PIXI.Text(emoji, {
            fontSize: 20,
            align: 'center'
        });
        text.position.set(x, y);
        text.zIndex = 2;
        this.container.addChild(text);
    }

    createProgressBar(x, y, width, height, color) {
        const container = new PIXI.Container();
        container.zIndex = 1;
        
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

    updateHealth(health, maxHealth) {
        if (!this.elements.healthText || !this.elements.healthBar) return;
        
        const currentHealth = Math.floor(health);
        this.elements.healthText.text = `Health: ${currentHealth}/${maxHealth}`;
        this.elements.healthBar.scale.x = Math.max(0, Math.min(1, health / maxHealth));
    }

    updateExperience(experience, nextLevel) {
        if (!this.elements.experienceText || !this.elements.xpBar) return;
        
        this.elements.experienceText.text = `XP: ${experience}/${nextLevel}`;
        this.elements.xpBar.scale.x = Math.max(0, Math.min(1, experience / nextLevel));
    }

    updateScore(score) {
        if (!this.elements.scoreText) return;
        this.elements.scoreText.text = `Score: ${score}`;
    }

    updateLevel(level) {
        if (!this.elements.levelText) return;
        
        this.elements.levelText.text = `Level: ${level}`;
        if (level > this.previousLevel) {
            this.createFlashEffect(this.elements.levelText);
            this.previousLevel = level;
        }
    }

    updateWeaponInfo(weaponName) {
        if (!this.elements.weaponText) return;
        this.elements.weaponText.text = `Weapon: ${weaponName} (1-4)`;
    }

    updateDebugPanel(gameState) {
        if (!this.debugPanel) {
            // Create debug panel container
            this.debugPanel = new PIXI.Container();
            this.debugPanel.zIndex = 100; // Ensure it's above other UI elements
            this.app.stage.addChild(this.debugPanel);

            // Create semi-transparent background
            const bg = new PIXI.Graphics();
            bg.beginFill(0x000000, 0.7);
            bg.drawRoundedRect(0, 0, 200, 360, 10);
            bg.endFill();
            this.debugPanel.addChild(bg);

            // Create title
            const titleStyle = {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xFFD700,
                fontWeight: 'bold'
            };
            const title = new PIXI.Text('Debug Stats', titleStyle);
            title.position.set(10, 10);
            this.debugPanel.addChild(title);

            // Create stats text with sections
            const textStyle = {
                fontFamily: 'Arial',
                fontSize: 14,
                fill: 0xFFFFFF,
                lineHeight: 20
            };

            this.statsText = new PIXI.Text('', textStyle);
            this.statsText.position.set(10, 35);
            this.debugPanel.addChild(this.statsText);

            // Position panel in bottom right with padding
            const updatePosition = () => {
                this.debugPanel.position.set(
                    this.app.screen.width - this.debugPanel.width - 20,
                    this.app.screen.height - this.debugPanel.height - 100
                );
            };

            // Initial position
            updatePosition();

            // Update position on window resize
            window.addEventListener('resize', updatePosition);
        }

        // Calculate fire rate in shots per second
        const baseFireRate = 1000 / gameState.fireRate; // Convert ms delay to shots per second
        const dps = gameState.attackDamage * baseFireRate;

        // Update stats text with sections and formatting
        const stats = [
            '=== Combat Stats ===',
            `Attack Damage: ${Math.round(gameState.attackDamage)}`,
            `Fire Rate: ${baseFireRate.toFixed(2)} shots/sec`,
            `DPS: ${Math.round(dps)}`,
            '',
            '=== Defense Stats ===',
            `Max Health: ${Math.round(gameState.maxHealth)}`,
            `Health Regen: ${gameState.healthRegen.toFixed(1)}/sec`,
            '',
            '=== Movement ===',
            `Speed: ${gameState.playerSpeed.toFixed(1)}`,
            '',
            '=== Progress ===',
            `Level: ${gameState.level}`,
            `XP: ${gameState.experience}/${gameState.nextLevel}`,
            `Score: ${gameState.score}`
        ].join('\n');

        this.statsText.text = stats;
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
        const positionX = joystick.config.positionX || 0.5;
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
        if (!this.settingsMenu) return;
        
        // Toggle visibility and pause state
        const isOpening = !this.settingsMenu.visible;
        this.settingsMenu.visible = isOpening;
        gameState.paused = isOpening;

        // Update UI elements based on state
        if (isOpening) {
            // Opening settings
            this.settingsMenu.children.forEach(child => {
                if (child.eventMode !== undefined) {
                    child.eventMode = 'static';  // Ensure all children are interactive
                }
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

    toggleDebugView() {
        if (this.game && this.game.toggleDebugView) {
            this.game.toggleDebugView();
            
            // Update the checkbox in settings menu if it exists
            if (this.settingsMenu) {
                const debugToggle = this.settingsMenu.children.find(child => 
                    child.children?.[0]?.text === 'Show Debug View:');
                if (debugToggle) {
                    const checkbox = debugToggle.children[2]; // The check mark
                    checkbox.visible = !checkbox.visible;
                }
            }

            // Toggle debug legend
            if (!this.debugLegend) {
                this.createDebugLegend();
            }
            this.debugLegend.visible = gameState.debugView;
        }
    }

    createDebugLegend() {
        this.debugLegend = new PIXI.Container();
        
        // Create semi-transparent background
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.7);
        bg.drawRoundedRect(0, 0, 200, 160, 10);
        bg.endFill();
        this.debugLegend.addChild(bg);

        const legendStyle = {
            fontSize: 14,
            fill: 0xFFFFFF,
            align: 'left'
        };

        const items = [
            { color: 0x00FF00, text: '🟢 Player Collision' },
            { color: 0xFF0000, text: '🔴 Enemy Collision' },
            { color: 0xFF0000, alpha: 0.3, text: '➖ Enemy Target Line' },
            { color: 0xFFFF00, text: '🟡 Bullet Collision' },
            { color: 0xFFFF00, alpha: 0.3, text: '➖ Bullet Trajectory' },
            { color: 0x00FFFF, text: '🔵 XP Collection Range' }
        ];

        items.forEach((item, index) => {
            const text = new PIXI.Text(item.text, legendStyle);
            text.position.set(10, 10 + (index * 25));
            this.debugLegend.addChild(text);
        });

        // Position legend in bottom right
        this.debugLegend.position.set(
            this.app.screen.width - 220,
            this.app.screen.height - 180
        );

        // Add resize handler for legend
        window.addEventListener('resize', () => {
            this.debugLegend.position.set(
                this.app.screen.width - 220,
                this.app.screen.height - 180
            );
        });

        this.debugLegend.visible = false;
        this.container.addChild(this.debugLegend);
    }

    createSettingsMenu() {
        // Create settings menu container
        const menu = new PIXI.Container();
        menu.eventMode = 'static';
        menu.visible = false;
        
        // Create semi-transparent background panel
        const panel = new PIXI.Graphics();
        panel.beginFill(0x000000, 0.8);
        panel.drawRoundedRect(0, 0, 300, 400, 10);
        panel.endFill();
        panel.eventMode = 'static';
        menu.addChild(panel);
        
        // Settings title
        const titleText = new PIXI.Text('Settings', {
            fontSize: 24,
            fill: 0xFFFFFF,
            fontWeight: 'bold'
        });
        titleText.anchor.set(0.5, 0);
        titleText.position.set(panel.width / 2, 20);
        menu.addChild(titleText);

        let currentY = 60;
        const SPACING = 50;

        // Add debug view toggle
        const debugToggle = this.createToggle('Show Debug View:', currentY, () => {
            this.toggleDebugView();
        });
        menu.addChild(debugToggle);
        currentY += SPACING;

        // Add joystick controls (only show if joystick exists)
        if (this.joystick) {
            // Joystick Position Slider
            const positionSlider = this.createSlider('Joystick Position:', currentY, 0, 1, this.joystick.config.positionX || 0.5, (value) => {
                if (this.joystick) {
                    this.joystick.config.positionX = value;
                    this.updateJoystickPosition(this.joystick);
                }
            });
            menu.addChild(positionSlider);
            currentY += SPACING;

            // Joystick Size Slider
            const sizeSlider = this.createSlider('Joystick Size:', currentY, 0.5, 2, this.joystick.config.size || 1, (value) => {
                if (this.joystick) {
                    this.joystick.config.size = value;
                    this.updateJoystickConfig(this.joystick);
                }
            });
            menu.addChild(sizeSlider);
            currentY += SPACING;

            // Joystick Opacity Slider
            const opacitySlider = this.createSlider('Joystick Opacity:', currentY, 0.1, 1, this.joystick.config.opacity || 0.3, (value) => {
                if (this.joystick) {
                    this.joystick.config.opacity = value;
                    this.joystick.container.alpha = value;
                }
            });
            menu.addChild(opacitySlider);
            currentY += SPACING;
        }

        // Position menu in top right
        menu.position.set(this.app.screen.width - 320, 60);
        
        return menu;
    }

    createToggle(label, y, onChange) {
        const container = new PIXI.Container();
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.position.set(20, y);

        const labelText = new PIXI.Text(label, {
            fontSize: 16,
            fill: 0xFFFFFF
        });
        container.addChild(labelText);

        const checkbox = new PIXI.Graphics();
        checkbox.lineStyle(2, 0xFFFFFF);
        checkbox.drawRect(150, 0, 20, 20);
        checkbox.endFill();
        container.addChild(checkbox);

        const check = new PIXI.Graphics();
        check.beginFill(0x00FF00);
        check.drawRect(153, 3, 14, 14);
        check.endFill();
        check.visible = false;
        container.addChild(check);

        container.on('pointerdown', () => {
            check.visible = !check.visible;
            if (onChange) onChange(check.visible);
        });

        return container;
    }

    createSlider(label, y, min, max, initialValue, onChange) {
        const container = new PIXI.Container();
        container.position.set(20, y);

        // Label
        const labelText = new PIXI.Text(label, {
            fontSize: 16,
            fill: 0xFFFFFF
        });
        container.addChild(labelText);

        // Track
        const track = new PIXI.Graphics();
        track.beginFill(0x666666);
        track.drawRect(0, 30, 260, 4);
        track.endFill();
        container.addChild(track);

        // Handle
        const handle = new PIXI.Graphics();
        handle.beginFill(0xFFFFFF);
        handle.drawCircle(0, 0, 8);
        handle.endFill();
        handle.eventMode = 'static';
        handle.cursor = 'pointer';
        
        // Set initial position
        const initialX = (initialValue - min) / (max - min) * 260;
        handle.position.set(initialX, 32);
        container.addChild(handle);

        // Value text
        const valueText = new PIXI.Text(initialValue.toFixed(2), {
            fontSize: 14,
            fill: 0xFFFFFF
        });
        valueText.position.set(270, 25);
        container.addChild(valueText);

        // Make slider interactive
        let dragging = false;
        handle.on('pointerdown', () => dragging = true);
        this.app.stage.on('pointerup', () => dragging = false);
        this.app.stage.on('pointermove', (e) => {
            if (dragging) {
                const bounds = track.getBounds();
                const newX = Math.max(0, Math.min(260, e.global.x - bounds.x - container.parent.x - container.x));
                handle.x = newX;
                
                // Calculate value
                const value = min + (newX / 260) * (max - min);
                valueText.text = value.toFixed(2);
                
                if (onChange) onChange(value);
            }
        });

        return container;
    }

    showGameOver() {
        // Create game over container
        const gameOverScreen = new PIXI.Container();
        gameOverScreen.zIndex = 1000;
        this.app.stage.addChild(gameOverScreen);

        // Dark overlay
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.8);
        overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.endFill();
        gameOverScreen.addChild(overlay);

        // Game Over text
        const gameOverText = new PIXI.Text('GAME OVER', {
            fontSize: 64,
            fill: 0xFF0000,
            fontWeight: 'bold',
            stroke: 0x000000,
            strokeThickness: 6,
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowDistance: 4,
            dropShadowBlur: 4
        });
        gameOverText.anchor.set(0.5);
        gameOverText.position.set(this.app.screen.width / 2, this.app.screen.height / 3);
        gameOverScreen.addChild(gameOverText);

        // Stats text
        const statsText = new PIXI.Text(
            `Final Score: ${gameState.score}\n` +
            `Level Reached: ${gameState.level}\n` +
            `Time Survived: ${Math.floor(Date.now() - gameState.gameStartTime) / 1000}s`, {
            fontSize: 32,
            fill: 0xFFFFFF,
            align: 'center'
        });
        statsText.anchor.set(0.5);
        statsText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
        gameOverScreen.addChild(statsText);

        // Restart button
        const buttonContainer = new PIXI.Container();
        buttonContainer.eventMode = 'static';
        buttonContainer.cursor = 'pointer';
        buttonContainer.position.set(this.app.screen.width / 2, this.app.screen.height * 0.7);

        const button = new PIXI.Graphics();
        button.beginFill(0x00FF00);
        button.drawRoundedRect(-100, -25, 200, 50, 15);
        button.endFill();

        const buttonText = new PIXI.Text('Play Again', {
            fontSize: 24,
            fill: 0x000000,
            fontWeight: 'bold'
        });
        buttonText.anchor.set(0.5);

        buttonContainer.addChild(button, buttonText);
        gameOverScreen.addChild(buttonContainer);

        // Button interactions
        buttonContainer.on('pointerover', () => button.tint = 0x88FF88);
        buttonContainer.on('pointerout', () => button.tint = 0xFFFFFF);
        buttonContainer.on('pointerdown', () => {
            this.app.stage.removeChild(gameOverScreen);
            location.reload(); // Reload the game
        });

        // Handle window resize
        const resizeHandler = () => {
            overlay.width = this.app.screen.width;
            overlay.height = this.app.screen.height;
            gameOverText.position.set(this.app.screen.width / 2, this.app.screen.height / 3);
            statsText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
            buttonContainer.position.set(this.app.screen.width / 2, this.app.screen.height * 0.7);
        };

        window.addEventListener('resize', resizeHandler);

        // Clean up resize handler when game over screen is removed
        gameOverScreen.on('destroyed', () => {
            window.removeEventListener('resize', resizeHandler);
        });
    }

    // Add other UI update methods...
} 