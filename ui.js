/**
 * UI Manager class responsible for handling all game UI elements
 * Manages HUD, menus, overlays, and user interactions
 */
import { STYLES } from './config.js';
import { gameState } from './gameState.js';

export class UIManager {
    /**
     * Initialize UI Manager
     * @param {PIXI.Application} app - The PIXI application instance
     * @param {Game} game - The main game instance
     */
    constructor(app, game) {
        this.app = app;
        this.game = game;  // Store game instance for debug toggle
        this.upgradeManager = null;  // Will be set later
        
        // Create main UI container with sorting
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.app.stage.addChild(this.container);
        
        // Initialize core UI components
        this.initializeUI();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Initialize all core UI components
     */
    initializeUI() {
        // Create main UI elements
        this.createUIElements();
        
        // Create settings menu
        this.settingsMenu = this.createSettingsMenu();
        this.container.addChild(this.settingsMenu);
        
        // Create joystick if on mobile
        if (this.isMobileDevice()) {
            this.createJoystick();
        }
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
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

    /**
     * Handle window resize events
     */
    handleResize() {
        // Update UI panel
        if (this.elements) {
            const panel = this.container.getChildAt(0);
            panel.clear();
            panel.beginFill(0x000000, 0.5);
            panel.drawRoundedRect(5, 5, 200, 150, 10);
            panel.endFill();
        }

        // Update settings menu position
        if (this.settingsMenu) {
            this.settingsMenu.position.set(this.app.screen.width - 320, 60);
        }
    }

    /**
     * Create main UI elements (health, weapon, level, etc.)
     */
    createUIElements() {
        // Create main UI panel background
        const panel = new PIXI.Graphics();
        panel.beginFill(0x000000, 0.7);
        panel.drawRoundedRect(5, 5, 250, 200, 10);
        panel.endFill();
        panel.zIndex = 1;
        this.container.addChild(panel);

        // Initialize elements container
        this.elements = {};

        // Define base text style
        const textStyle = this.createBaseTextStyle();

        // Create and position all UI elements
        this.createUILayout(textStyle);
    }

    /**
     * Create base text style for UI elements
     * @returns {Object} PIXI.TextStyle configuration
     */
    createBaseTextStyle() {
        return {
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
    }

    /**
     * Create the layout for UI elements
     * @param {Object} textStyle - Base text style for UI elements
     */
    createUILayout(textStyle) {
        let yPos = 15;
        const SPACING = 30;

        // Create health section
        this.createHealthSection(yPos, textStyle);
        yPos += SPACING + 10;

        // Create weapon section
        this.createWeaponSection(yPos, textStyle);
        yPos += SPACING;

        // Create level section
        this.createLevelSection(yPos, textStyle);
        yPos += SPACING;

        // Create experience section
        this.createExperienceSection(yPos, textStyle);
        yPos += SPACING + 10;

        // Create score section
        this.createScoreSection(yPos, textStyle);
        yPos += SPACING;

        // Create stats section
        this.createStatsSection(yPos, textStyle);

        // Add all elements to container
        this.addElementsToContainer();
    }

    /**
     * Create health UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createHealthSection(yPos, textStyle) {
        this.createIcon(15, yPos, 0xFF0000, '❤️');
        this.elements.healthText = new PIXI.Text('Health: 100/100', textStyle);
        this.elements.healthText.position.set(40, yPos);
        this.elements.healthBar = this.createProgressBar(40, yPos + 20, 190, 6, 0xFF0000);
    }

    /**
     * Create weapon UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createWeaponSection(yPos, textStyle) {
        this.createIcon(15, yPos, 0xFFFFFF, '🔫');
        this.elements.weaponText = new PIXI.Text('Weapon: Pistol (1-4)', textStyle);
        this.elements.weaponText.position.set(40, yPos);
    }

    /**
     * Create level UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createLevelSection(yPos, textStyle) {
        this.createIcon(15, yPos, 0x00FF00, '📊');
        this.elements.levelText = new PIXI.Text('Level: 1', textStyle);
        this.elements.levelText.position.set(40, yPos);
    }

    /**
     * Create experience UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createExperienceSection(yPos, textStyle) {
        this.createIcon(15, yPos, 0xFF00FF, '💎');
        this.elements.experienceText = new PIXI.Text('XP: 0/100', textStyle);
        this.elements.experienceText.position.set(40, yPos);
        this.elements.xpBar = this.createProgressBar(40, yPos + 20, 190, 6, 0x8800FF);
    }

    /**
     * Create score UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createScoreSection(yPos, textStyle) {
        this.createIcon(15, yPos, 0xFFD700, '⭐');
        this.elements.scoreText = new PIXI.Text('Score: 0', textStyle);
        this.elements.scoreText.position.set(40, yPos);
    }

    /**
     * Create stats UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createStatsSection(yPos, textStyle) {
        const statsStyle = { ...textStyle, fontSize: 14 };
        this.elements.statsText = new PIXI.Text('', statsStyle);
        this.elements.statsText.position.set(15, yPos);
    }

    /**
     * Create an icon for UI elements
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} color - Icon color
     * @param {string} emoji - Emoji to use as icon
     */
    createIcon(x, y, color, emoji) {
        const text = new PIXI.Text(emoji, {
            fontSize: 20,
            align: 'center'
        });
        text.position.set(x, y);
        text.zIndex = 2;
        this.container.addChild(text);
    }

    /**
     * Create a progress bar
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Bar width
     * @param {number} height - Bar height
     * @param {number} color - Bar color
     * @returns {PIXI.Graphics} Progress bar graphics object
     */
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

    /**
     * Update stats display
     * @param {Object} gameState - Current game state
     */
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

    /**
     * Create a flash effect on a UI element
     * @param {PIXI.DisplayObject} target - Target element to flash
     */
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

    /**
     * Update health display
     * @param {number} health - Current health
     * @param {number} maxHealth - Maximum health
     */
    updateHealth(health, maxHealth) {
        if (!this.elements.healthText || !this.elements.healthBar) return;
        
        const currentHealth = Math.floor(health);
        this.elements.healthText.text = `Health: ${currentHealth}/${maxHealth}`;
        this.elements.healthBar.scale.x = Math.max(0, Math.min(1, health / maxHealth));
    }

    /**
     * Update experience display
     * @param {number} experience - Current experience
     * @param {number} nextLevel - Experience needed for next level
     */
    updateExperience(experience, nextLevel) {
        if (!this.elements.experienceText || !this.elements.xpBar) return;
        
        this.elements.experienceText.text = `XP: ${experience}/${nextLevel}`;
        this.elements.xpBar.scale.x = Math.max(0, Math.min(1, experience / nextLevel));
    }

    /**
     * Update score display
     * @param {number} score - Current score
     */
    updateScore(score) {
        if (!this.elements.scoreText) return;
        this.elements.scoreText.text = `Score: ${score}`;
    }

    /**
     * Update level display
     * @param {number} level - Current level
     */
    updateLevel(level) {
        if (!this.elements.levelText) return;
        
        this.elements.levelText.text = `Level: ${level}`;
        if (level > this.previousLevel) {
            this.createFlashEffect(this.elements.levelText);
            this.previousLevel = level;
        }
    }

    /**
     * Update weapon info display
     * @param {string} weaponName - Current weapon name
     */
    updateWeaponInfo(weaponName) {
        if (!this.elements.weaponText) return;
        this.elements.weaponText.text = `Weapon: ${weaponName} (1-4)`;
    }

    /**
     * Add all UI elements to the main container
     */
    addElementsToContainer() {
        Object.values(this.elements).forEach(element => {
            if (element instanceof PIXI.DisplayObject) {
                element.zIndex = 2;
                this.container.addChild(element);
            }
        });
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Create joystick for mobile controls
     */
    createJoystick() {
        const joystickContainer = new PIXI.Container();
        
        // Create base and stick graphics
        const base = this.createJoystickBase();
        const stick = this.createJoystickStick();

        joystickContainer.addChild(base, stick);
        this.container.addChild(joystickContainer);

        // Initialize joystick state
        const joystick = this.initializeJoystickState(joystickContainer, stick);

        // Setup joystick interaction
        this.setupJoystickInteraction(joystick);

        // Position joystick based on configuration
        this.updateJoystickPosition(joystick);
        
        // Store joystick reference
        this.joystick = joystick;

        // Handle visibility and orientation
        this.setupJoystickResponsiveness(joystick);

        return joystick;
    }

    /**
     * Create joystick base circle
     * @returns {PIXI.Graphics} Base circle graphics
     */
    createJoystickBase() {
        const base = new PIXI.Graphics();
        base.beginFill(0x000000, 0.2);
        base.lineStyle(2, 0xFFFFFF, 0.3);
        base.drawCircle(0, 0, 130);
        base.endFill();
        return base;
    }

    /**
     * Create joystick stick circle
     * @returns {PIXI.Graphics} Stick circle graphics
     */
    createJoystickStick() {
        const stick = new PIXI.Graphics();
        stick.beginFill(0xFFFFFF, 0.3);
        stick.drawCircle(0, 0, 50);
        stick.endFill();
        return stick;
    }

    /**
     * Initialize joystick state object
     * @param {PIXI.Container} container - Joystick container
     * @param {PIXI.Graphics} stick - Joystick stick graphics
     * @returns {Object} Joystick state object
     */
    initializeJoystickState(container, stick) {
        return {
            container: container,
            stick: stick,
            baseRadius: 130,
            active: false,
            data: null,
            position: { x: 0, y: 0 },
            config: {
                rightHanded: false,
                safeAreaInset: 0,
                opacity: 0.3,
                size: 1.0,
                positionX: 0.5
            }
        };
    }

    /**
     * Setup joystick interaction handlers
     * @param {Object} joystick - Joystick state object
     */
    setupJoystickInteraction(joystick) {
        const container = joystick.container;
        container.eventMode = 'static';
        container.cursor = 'pointer';
        
        // Touch handlers with better touch handling
        container.on('pointerdown', (e) => {
            e.stopPropagation();
            this.onJoystickDown(e, joystick);
        });

        // Use passive listeners for better performance
        this.app.stage.on('pointermove', (e) => this.onJoystickMove(e, joystick), { passive: true });
        this.app.stage.on('pointerup', () => this.onJoystickUp(joystick), { passive: true });
        this.app.stage.on('pointerupoutside', () => this.onJoystickUp(joystick), { passive: true });
    }

    /**
     * Setup joystick responsiveness
     * @param {Object} joystick - Joystick state object
     */
    setupJoystickResponsiveness(joystick) {
        // Mobile detection with better device checking
        const isMobile = this.checkMobileDevice();
        joystick.container.visible = isMobile;

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
    }

    /**
     * Update joystick configuration
     * @param {Object} joystick - Joystick state object
     */
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

    /**
     * Update joystick position
     * @param {Object} joystick - Joystick state object
     */
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

    /**
     * Check if device is mobile
     * @returns {boolean} True if device is mobile
     */
    checkMobileDevice() {
        // More comprehensive mobile detection
        const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const touchWindow = 'ontouchstart' in window;
        const touchPoints = navigator.maxTouchPoints > 0;
        const mobileScreen = window.innerWidth <= 1024;
        
        return userAgent || (touchWindow && touchPoints) || mobileScreen;
    }

    /**
     * Handle joystick down event
     * @param {PIXI.InteractionEvent} event - Pointer event
     * @param {Object} joystick - Joystick state object
     */
    onJoystickDown(event, joystick) {
        joystick.active = true;
        joystick.data = event.data;
        joystick.stick.alpha = 0.8;
    }

    /**
     * Handle joystick move event
     * @param {PIXI.InteractionEvent} event - Pointer event
     * @param {Object} joystick - Joystick state object
     */
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

    /**
     * Handle joystick up event
     * @param {Object} joystick - Joystick state object
     */
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
        
        // Create background panel
        this.createSettingsBackground(menu);
        
        // Create title
        this.createSettingsTitle(menu);

        // Add settings options
        this.addSettingsOptions(menu);

        // Position menu in top right
        menu.position.set(this.app.screen.width - 320, 60);
        
        return menu;
    }

    createSettingsBackground(menu) {
        const panel = new PIXI.Graphics();
        panel.beginFill(0x000000, 0.8);
        panel.drawRoundedRect(0, 0, 300, 400, 10);
        panel.endFill();
        panel.eventMode = 'static';
        menu.addChild(panel);
    }

    createSettingsTitle(menu) {
        const titleText = new PIXI.Text('Settings', {
            fontSize: 24,
            fill: 0xFFFFFF,
            fontWeight: 'bold'
        });
        titleText.anchor.set(0.5, 0);
        titleText.position.set(menu.width / 2, 20);
        menu.addChild(titleText);
    }

    addSettingsOptions(menu) {
        let currentY = 60;
        const SPACING = 50;

        // Add debug view toggle
        const debugToggle = this.createToggle('Show Debug View:', currentY, () => {
            this.toggleDebugView();
        });
        menu.addChild(debugToggle);
        currentY += SPACING;

        // Add joystick controls if available
        if (this.joystick) {
            this.addJoystickSettings(menu, currentY, SPACING);
        }
    }

    addJoystickSettings(menu, startY, spacing) {
        let currentY = startY;

        // Joystick Position Slider
        const positionSlider = this.createSlider('Joystick Position:', currentY, 0, 1, this.joystick.config.positionX || 0.5, (value) => {
            if (this.joystick) {
                this.joystick.config.positionX = value;
                this.updateJoystickPosition(this.joystick);
            }
        });
        menu.addChild(positionSlider);
        currentY += spacing;

        // Joystick Size Slider
        const sizeSlider = this.createSlider('Joystick Size:', currentY, 0.5, 2, this.joystick.config.size || 1, (value) => {
            if (this.joystick) {
                this.joystick.config.size = value;
                this.updateJoystickConfig(this.joystick);
            }
        });
        menu.addChild(sizeSlider);
        currentY += spacing;

        // Joystick Opacity Slider
        const opacitySlider = this.createSlider('Joystick Opacity:', currentY, 0.1, 1, this.joystick.config.opacity || 0.3, (value) => {
            if (this.joystick) {
                this.joystick.config.opacity = value;
                this.joystick.container.alpha = value;
            }
        });
        menu.addChild(opacitySlider);
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
        this.setupSliderInteraction(handle, track, min, max, valueText, onChange);

        return container;
    }

    setupSliderInteraction(handle, track, min, max, valueText, onChange) {
        let dragging = false;
        handle.on('pointerdown', () => dragging = true);
        this.app.stage.on('pointerup', () => dragging = false);
        this.app.stage.on('pointermove', (e) => {
            if (dragging) {
                const bounds = track.getBounds();
                const newX = Math.max(0, Math.min(260, e.global.x - bounds.x - handle.parent.parent.x - handle.parent.x));
                handle.x = newX;
                
                // Calculate value
                const value = min + (newX / 260) * (max - min);
                valueText.text = value.toFixed(2);
                
                if (onChange) onChange(value);
            }
        });
    }

    showGameOver() {
        gameState.gameOver = true;
        
        // Create game over container
        const gameOverScreen = new PIXI.Container();
        gameOverScreen.zIndex = 1000;
        this.app.stage.addChild(gameOverScreen);

        // Create and animate overlay
        this.createGameOverOverlay(gameOverScreen);

        // Create game over text and stats
        this.createGameOverContent(gameOverScreen);

        // Create restart button
        this.createRestartButton(gameOverScreen);

        // Handle window resize
        this.setupGameOverResize(gameOverScreen);
    }

    /**
     * Create and animate the game over overlay
     * @param {PIXI.Container} container - Game over screen container
     */
    createGameOverOverlay(container) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0);
        overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.endFill();
        container.addChild(overlay);

        // Animate overlay fade in
        let alpha = 0;
        const fadeIn = () => {
            alpha += 0.05;
            overlay.clear();
            overlay.beginFill(0x000000, Math.min(0.8, alpha));
            overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
            overlay.endFill();

            if (alpha < 0.8) requestAnimationFrame(fadeIn);
        };
        fadeIn();
    }

    /**
     * Create game over text and stats
     * @param {PIXI.Container} container - Game over screen container
     */
    createGameOverContent(container) {
        // Game over text with effects
        const gameOverText = new PIXI.Text('GAME OVER', {
            fontSize: 64,
            fill: ['#FF0000', '#880000'], // Gradient fill
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 10,
            dropShadowDistance: 5
        });
        gameOverText.anchor.set(0.5);
        gameOverText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);

        // Stats container
        const statsContainer = this.createGameOverStats();

        // Add pulsing animation to game over text
        const pulseText = () => {
            gameOverText.scale.x = 1 + Math.sin(Date.now() / 300) * 0.1;
            gameOverText.scale.y = gameOverText.scale.x;
            requestAnimationFrame(pulseText);
        };
        pulseText();

        container.addChild(gameOverText, statsContainer);
    }

    /**
     * Create game over stats display
     * @returns {PIXI.Container} Stats container
     */
    createGameOverStats() {
        const statsContainer = new PIXI.Container();
        statsContainer.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

        // Stats background
        const statsBg = new PIXI.Graphics();
        statsBg.beginFill(0x000000, 0.5);
        statsBg.lineStyle(2, 0x444444);
        statsBg.drawRoundedRect(-150, -60, 300, 120, 10);
        statsBg.endFill();
        statsContainer.addChild(statsBg);

        // Stats text style
        const statsStyle = {
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center'
        };

        // Create stats text
        const finalScoreText = new PIXI.Text(`Score: ${gameState.score}`, statsStyle);
        finalScoreText.anchor.set(0.5);
        finalScoreText.position.set(0, -30);

        const levelText = new PIXI.Text(`Level Reached: ${gameState.level}`, statsStyle);
        levelText.anchor.set(0.5);
        levelText.position.set(0, 10);

        statsContainer.addChild(finalScoreText, levelText);
        return statsContainer;
    }

    /**
     * Create restart button
     * @param {PIXI.Container} container - Game over screen container
     */
    createRestartButton(container) {
        const button = new PIXI.Container();
        button.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + 100);

        // Button background
        const buttonBg = new PIXI.Graphics();
        buttonBg.beginFill(0x00AA00);
        buttonBg.lineStyle(3, 0x00FF00);
        buttonBg.drawRoundedRect(-100, -25, 200, 50, 15);
        buttonBg.endFill();

        // Button text
        const buttonText = new PIXI.Text('Play Again', {
            fontSize: 28,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2
        });
        buttonText.anchor.set(0.5);

        button.addChild(buttonBg, buttonText);

        // Make button interactive
        this.setupRestartButton(button, buttonBg);

        container.addChild(button);
    }

    /**
     * Setup restart button interactivity
     * @param {PIXI.Container} button - Button container
     * @param {PIXI.Graphics} buttonBg - Button background
     */
    setupRestartButton(button, buttonBg) {
        button.eventMode = 'static';
        button.cursor = 'pointer';

        // Button hover effects
        button.on('pointerover', () => {
            buttonBg.tint = 0xAAFFAA;
            button.scale.set(1.05);
        });
        button.on('pointerout', () => {
            buttonBg.tint = 0xFFFFFF;
            button.scale.set(1);
        });

        button.on('pointerdown', () => {
            this.app.stage.removeChild(button.parent);
            location.reload(); // Reload the game
        });
    }

    /**
     * Setup game over screen resize handling
     * @param {PIXI.Container} gameOverScreen - Game over screen container
     */
    setupGameOverResize(gameOverScreen) {
        const resizeHandler = () => {
            const overlay = gameOverScreen.getChildAt(0);
            overlay.width = this.app.screen.width;
            overlay.height = this.app.screen.height;

            const gameOverText = gameOverScreen.getChildAt(1);
            const statsContainer = gameOverScreen.getChildAt(2);
            const button = gameOverScreen.getChildAt(3);

            gameOverText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);
            statsContainer.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
            button.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + 100);
        };

        window.addEventListener('resize', resizeHandler);

        // Clean up resize handler when game over screen is removed
        gameOverScreen.on('destroyed', () => {
            window.removeEventListener('resize', resizeHandler);
        });
    }

    showLevelUp(upgrades) {
        gameState.levelUp = true;

        // Dark overlay with animation
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0);  // Start transparent
        overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.endFill();
        this.app.stage.addChild(overlay);

        // Animate overlay
        let alpha = 0;
        const fadeIn = () => {
            alpha += 0.05;
            overlay.clear();
            overlay.beginFill(0x000000, Math.min(0.7, alpha));
            overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
            overlay.endFill();
            
            if (alpha < 0.7) requestAnimationFrame(fadeIn);
        };
        fadeIn();

        // Create level up content
        this.createLevelUpContent(upgrades);
    }

    createLevelUpContent(upgrades) {
        // Level up text with glow effect
        const levelUpText = new PIXI.Text('LEVEL UP!', {
            fontSize: 48,
            fill: ['#FFD700', '#FFA500'], // Gold gradient
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 10,
            dropShadowDistance: 5
        });
        levelUpText.anchor.set(0.5);
        levelUpText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 120);

        // Add pulsing animation to level up text
        const pulseText = () => {
            levelUpText.scale.x = 1 + Math.sin(Date.now() / 200) * 0.1;
            levelUpText.scale.y = levelUpText.scale.x;
            requestAnimationFrame(pulseText);
        };
        pulseText();

        // Create upgrade options
        this.createUpgradeOptions(upgrades, levelUpText);
    }

    createUpgradeOptions(upgrades, levelUpText) {
        let selectedIndex = 0;

        // Create upgrade option containers
        const optionContainers = upgrades.map((upgrade, index) => {
            const container = new PIXI.Container();
            
            // Background for option
            const bg = new PIXI.Graphics();
            bg.beginFill(0x333333, 0.8);
            bg.lineStyle(2, 0x666666);
            bg.drawRoundedRect(-150, -30, 300, 60, 10);
            bg.endFill();
            
            const text = new PIXI.Text(upgrade.text, {
                fontSize: 20,
                fill: 0xFFFFFF,
                align: 'center'
            });
            text.anchor.set(0.5);

            container.addChild(bg, text);
            container.position.set(
                this.app.screen.width / 2,
                this.app.screen.height / 2 + index * 80
            );
            
            // Make container interactive
            container.eventMode = 'static';
            container.cursor = 'pointer';
            
            // Add hover and click handlers
            container.on('pointerover', () => {
                selectedIndex = index;
                this.updateUpgradeSelection(optionContainers, selectedIndex);
            });
            
            container.on('pointerdown', () => {
                // Apply selected upgrade
                upgrade.action();
                
                // Cleanup
                this.cleanupLevelUp(container.parent);
                
                // Complete level up
                if (this.upgradeManager) {
                    this.upgradeManager.handleLevelUp();
                }
            });

            return container;
        });

        // Update the instruction text
        const instructionText = new PIXI.Text(
            'Use ↑↓ or touch/click to select\nSPACE or tap/click to confirm', {
            fontSize: 16,
            fill: 0xCCCCCC,
            align: 'center'
        });
        instructionText.anchor.set(0.5);
        instructionText.position.set(
            this.app.screen.width / 2,
            this.app.screen.height / 2 + (upgrades.length * 80) + 40
        );

        // Function to update selection
        const updateSelection = () => {
            optionContainers.forEach((container, index) => {
                const bg = container.getChildAt(0);
                const text = container.getChildAt(1);
                
                if (index === selectedIndex) {
                    bg.clear();
                    bg.beginFill(0x666666, 0.9);
                    bg.lineStyle(2, 0xFFD700);
                    bg.drawRoundedRect(-150, -30, 300, 60, 10);
                    bg.endFill();
                    text.style.fill = 0xFFD700;
                    container.filters = null;
                    container.scale.set(1.1);
                } else {
                    bg.clear();
                    bg.beginFill(0x333333, 0.8);
                    bg.lineStyle(2, 0x666666);
                    bg.drawRoundedRect(-150, -30, 300, 60, 10);
                    bg.endFill();
                    text.style.fill = 0xFFFFFF;
                    container.filters = [new PIXI.BlurFilter(1)];
                    container.scale.set(1);
                }
            });
        };

        // Cleanup function
        const cleanup = () => {
            window.removeEventListener('keydown', handleKeyPress);
            this.app.stage.removeChild(levelUpText, instructionText);
            optionContainers.forEach(container => this.app.stage.removeChild(container));
        };

        // Handle key events
        const handleKeyPress = (e) => {
            switch(e.key) {
                case 'ArrowUp':
                    selectedIndex = (selectedIndex - 1 + upgrades.length) % upgrades.length;
                    updateSelection();
                    break;
                case 'ArrowDown':
                    selectedIndex = (selectedIndex + 1) % upgrades.length;
                    updateSelection();
                    break;
                case ' ':  // Space key
                    // Apply selected upgrade
                    upgrades[selectedIndex].action();
                    
                    // Cleanup
                    cleanup();
                    
                    // Complete level up
                    if (this.upgradeManager) {
                        this.upgradeManager.handleLevelUp();
                    }
                    break;
            }
        };

        // Add all elements to stage
        this.app.stage.addChild(levelUpText, instructionText);
        optionContainers.forEach(container => this.app.stage.addChild(container));

        // Initial selection update
        updateSelection();

        window.addEventListener('keydown', handleKeyPress);
    }

    cleanupLevelUp(container) {
        window.removeEventListener('keydown', this.handleKeyPress);
        this.app.stage.removeChild(container);
    }

    setUpgradeManager(upgradeManager) {
        this.upgradeManager = upgradeManager;
    }

    showLevelInfo(levelName, description) {
        // Create container for level info
        const container = new PIXI.Container();
        container.zIndex = 1000;

        // Create semi-transparent background
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.7);
        bg.drawRect(0, 0, this.app.screen.width, 80);
        bg.endFill();
        container.addChild(bg);

        // Create level name text
        const nameText = new PIXI.Text(levelName, {
            fontFamily: 'Arial',
            fontSize: 32,
            fill: 0xFFD700,
            align: 'center',
            stroke: 0x000000,
            strokeThickness: 4
        });
        nameText.anchor.set(0.5);
        nameText.position.set(this.app.screen.width / 2, 20);
        container.addChild(nameText);

        // Create description text
        const descText = new PIXI.Text(description, {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: 0xFFFFFF,
            align: 'center',
            stroke: 0x000000,
            strokeThickness: 3
        });
        descText.anchor.set(0.5);
        descText.position.set(this.app.screen.width / 2, 55);
        container.addChild(descText);

        // Add to stage
        this.app.stage.addChild(container);

        // Animate in
        container.alpha = 0;
        container.y = -80;
        
        const fadeIn = () => {
            container.alpha += 0.1;
            container.y += 8;
            if (container.alpha < 1) {
                requestAnimationFrame(fadeIn);
            }
        };
        fadeIn();

        // Remove after delay
        setTimeout(() => {
            const fadeOut = () => {
                container.alpha -= 0.1;
                container.y -= 8;
                if (container.alpha > 0) {
                    requestAnimationFrame(fadeOut);
                } else {
                    this.app.stage.removeChild(container);
                }
            };
            fadeOut();
        }, 3000);
    }

    updateDebugPanel(gameState) {
        if (!this.debugPanel) {
            this.createDebugPanel();
        }

        // Calculate combat stats
        const baseFireRate = 1000 / gameState.fireRate;
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
        this.updateDebugPanelPosition();
    }

    createDebugPanel() {
        // Create debug panel container
        this.debugPanel = new PIXI.Container();
        this.debugPanel.zIndex = 100; // Ensure it's above other UI elements
        this.container.addChild(this.debugPanel);

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
        this.updateDebugPanelPosition();
    }

    updateDebugPanelPosition() {
        if (!this.debugPanel) return;
        
        this.debugPanel.position.set(
            this.app.screen.width - this.debugPanel.width - 20,
            this.app.screen.height - this.debugPanel.height - 100
        );
    }

    toggleDebugView() {
        if (!this.debugPanel) {
            this.createDebugPanel();
        } else {
            this.container.removeChild(this.debugPanel);
            this.debugPanel = null;
            this.statsText = null;
        }
    }
} 