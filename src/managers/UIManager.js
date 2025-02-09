/**
 * @file UIManager.js
 * @description Manages all user interface elements, including HUD, menus, notifications,
 * and interactive UI components. Handles UI updates, animations, and user interaction.
 * 
 * @module managers/UIManager
 * @requires core/config
 * @requires core/gameState
 * 
 * Key Features:
 * - Creates and updates HUD elements (health, XP, score)
 * - Manages menus and settings panels
 * - Handles level-up UI and upgrade selection
 * - Displays notifications and messages
 * - Controls mobile UI elements (joystick)
 * - Manages game over screen
 * - Implements debug view
 * 
 * Usage:
 * ```js
 * const ui = new UIManager(app, game);
 * ui.updateHealth(currentHealth, maxHealth);
 * ui.showMessage("Level Up!", 0x00FF00);
 * ui.showLevelUp(upgrades);
 * ```
 * 
 * Modification Guidelines:
 * - Add new UI elements by extending createUIElements
 * - Modify UI styles in createBaseTextStyle
 * - Add new UI animations and effects
 * - Implement new menu types
 * - Extend mobile support features
 * - Add new debug information
 * 
 * @class
 */

import * as PIXI from 'pixi.js';
import { STYLES } from '../core/config.js';
import { gameState } from '../core/gameState.js';

export class UIManager {
    /**
     * Initialize UI Manager
     * @param {PIXI.Application} app - The PIXI application instance
     * @param {Game} game - The main game instance
     */
    constructor(app, game) {
        this.app = app;
        this.game = game;
        this.elements = {};
        this.debugPanel = null;
        this.joystick = null;
        this.container = null;  // Will be set via setContainer
        
        // Create separate containers for different UI states
        this.gameplayUI = new PIXI.Container();
        this.startScreenUI = new PIXI.Container();
        this.gameOverUI = new PIXI.Container();
        this.levelUpUI = new PIXI.Container();
        
        // Create mouse coordinate overlay
        this.mouseCoordOverlay = null;
        
        // Debug flag
        this.debug = false;
    }

    setContainer(container) {
        this.container = container;
        
        // Add containers to main UI container now that it's set
        this.container.addChild(this.gameplayUI);
        this.container.addChild(this.startScreenUI);
        this.container.addChild(this.gameOverUI);
        this.container.addChild(this.levelUpUI);
        
        // Initialize UI
        this.initializeUI();
        this.gameplayUI.visible = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize mouse coordinate overlay
        this.initializeMouseCoordOverlay();
        
        console.log('UI container set and initialized:', {
            container: this.container ? 'set' : 'not set',
            children: this.container.children.length
        });
    }

    /**
     * Initialize all core UI components
     */
    initializeUI() {
        if (!this.container) {
            console.error('UI container not set');
            return;
        }

        // Create UI elements
        this.createUIElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Create debug panel if needed
        if (gameState.debug) {
            this.createDebugPanel();
        }
        
        // Check for mobile device and create joystick if needed
        this.checkMobileDevice();
        
        console.log('UI initialized:', {
            container: this.container ? 'set' : 'not set',
            elements: Object.keys(this.elements),
            debug: !!this.debugPanel,
            joystick: !!this.joystick
        });
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
            } else if (e.key === 'c' || e.key === 'C') {
                this.toggleCoordinateOverlay();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        const padding = 20;
        
        // Position gameplay UI elements
        this.gameplayUI.position.set(padding, padding);

        // Position start screen UI
        if (this.startScreenUI.visible) {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            // Center the start screen container
            this.startScreenUI.position.set(centerX, centerY);
            
            // Update background to cover the entire screen
            const background = this.startScreenUI.getChildByLabel('background');
            if (background) {
                background.clear();
                background
                    .fill({ color: 0x000000, alpha: 0.5 })
                    .rect(0, 0, this.app.screen.width, this.app.screen.height);
                background.position.set(-centerX, -centerY);
            }
        }

        // Position debug panel if it exists
        if (this.debugPanel) {
            this.debugPanel.position.set(
                this.app.screen.width - this.debugPanel.width - padding,
                padding
            );
        }
    }

    /**
     * Create main UI elements (health, weapon, level, etc.)
     */
    createUIElements() {
        // Create main UI panel background
        const panel = new PIXI.Graphics();
        panel
            .fill({ color: 0x000000, alpha: 0.7 })
            .roundRect(5, 5, 250, 200, 10);
        panel.zIndex = 1;
        this.container.addChild(panel);
        this.elements.panel = panel;

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
            fill: 0xFFFFFF,
            stroke: {
                color: 0x000000,
                width: 2,
                alignment: 0
            }
        };
    }

    /**
     * Create the layout for UI elements
     * @param {Object} textStyle - Base text style for UI elements
     */
    createUILayout(textStyle) {
        // If no textStyle provided, create default one
        if (!textStyle) {
            textStyle = {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xFFFFFF,
                align: 'left'
            };
        }

        // Starting position for UI elements
        let yPos = 20;
        const spacing = 50;

        // Create and add each section to gameplayUI
        const healthSection = this.createHealthSection(yPos, textStyle);
        this.gameplayUI.addChild(healthSection);
        this.elements.healthText = this.healthText;
        this.elements.healthBar = this.healthBar;
        yPos += spacing;

        const weaponSection = this.createWeaponSection(yPos, textStyle);
        this.gameplayUI.addChild(weaponSection);
        this.elements.weaponText = this.weaponText;
        yPos += spacing;

        const levelSection = this.createLevelSection(yPos, textStyle);
        this.gameplayUI.addChild(levelSection);
        this.elements.levelText = this.levelText;
        yPos += spacing;

        const experienceSection = this.createExperienceSection(yPos, textStyle);
        this.gameplayUI.addChild(experienceSection);
        this.elements.experienceText = this.expText;
        this.elements.xpBar = this.expBar;
        yPos += spacing;

        const scoreSection = this.createScoreSection(yPos, textStyle);
        this.gameplayUI.addChild(scoreSection);
        this.elements.scoreText = this.scoreText;
        yPos += spacing;

        const statsSection = this.createStatsSection(yPos, textStyle);
        this.gameplayUI.addChild(statsSection);
        this.elements.statsText = this.statsText;

        // Initially hide the gameplay UI
        this.gameplayUI.visible = false;

        // Position all UI elements
        this.handleResize();

        console.log('UI elements created:', Object.keys(this.elements));
    }

    /**
     * Create health UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createHealthSection(yPos, textStyle) {
        const container = new PIXI.Container();
        container.position.set(0, yPos);
        
        // Create health text
        this.healthText = new PIXI.Text({
            text: 'Health: 100/100',
            style: textStyle
        });
        container.addChild(this.healthText);
        
        // Create health bar
        this.healthBar = new PIXI.Graphics();
        this.healthBar.position.set(0, 25);
        this.healthBar
            .fill({ color: 0x00FF00 })
            .rect(0, 0, 200, 20);
        container.addChild(this.healthBar);
        
        return container;
    }

    /**
     * Create weapon UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createWeaponSection(yPos, textStyle) {
        const container = new PIXI.Container();
        container.position.set(0, yPos);
        
        this.weaponText = new PIXI.Text({
            text: 'Weapon: Pistol',
            style: textStyle
        });
        container.addChild(this.weaponText);
        
        return container;
    }

    /**
     * Create level UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createLevelSection(yPos, textStyle) {
        const container = new PIXI.Container();
        container.position.set(0, yPos);
        
        this.levelText = new PIXI.Text({
            text: 'Level: 1',
            style: textStyle
        });
        container.addChild(this.levelText);
        
        return container;
    }

    /**
     * Create experience UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createExperienceSection(yPos, textStyle) {
        const container = new PIXI.Container();
        container.position.set(0, yPos);
        
        // Create XP text
        this.expText = new PIXI.Text({
            text: 'XP: 0/100',
            style: textStyle
        });
        container.addChild(this.expText);
        
        // Create XP bar
        this.expBar = new PIXI.Graphics();
        this.expBar.position.set(0, 25);
        this.expBar
            .fill({ color: 0xFF00FF })
            .rect(0, 0, 200, 10);
        container.addChild(this.expBar);
        
        return container;
    }

    /**
     * Create score UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createScoreSection(yPos, textStyle) {
        const container = new PIXI.Container();
        container.position.set(0, yPos);
        
        this.scoreText = new PIXI.Text({
            text: 'Score: 0',
            style: textStyle
        });
        container.addChild(this.scoreText);
        
        return container;
    }

    /**
     * Create stats UI section
     * @param {number} yPos - Vertical position
     * @param {Object} textStyle - Text style configuration
     */
    createStatsSection(yPos, textStyle) {
        const container = new PIXI.Container();
        container.position.set(0, yPos);
        
        // Create stats background
        const background = new PIXI.Graphics();
        background
            .fill({ color: 0x000000, alpha: 0.3 })
            .roundRect(0, 0, 200, 80, 10);
        container.addChild(background);
        
        // Create stats text
        this.statsText = new PIXI.Text({
            text: 'Stats\nDamage: 20\nSpeed: 4.2\nFire Rate: 0.6',
            style: textStyle
        });
        this.statsText.position.set(10, 10);
        container.addChild(this.statsText);
        
        return container;
    }

    /**
     * Create an icon for UI elements
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} color - Icon color
     * @param {string} emoji - Emoji to use as icon
     */
    createIcon(x, y, color, emoji) {
        const text = new PIXI.Text({
            text: emoji,
            style: {
                fontSize: 20,
                align: 'center'
            }
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
        bg.fill({ color: 0x000000, alpha: 0.5 });
        bg.roundRect(0, 0, width, height, height/2);
        
        // Progress
        const bar = new PIXI.Graphics();
        bar.fill({ color });
        bar.roundRect(0, 0, width, height, height/2);
        
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
            if (element && element.position !== undefined) {
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
        base
            .fill({ color: 0x000000, alpha: 0.2 })
            .stroke({ width: 2, color: 0xFFFFFF, alpha: 0.3 })
            .circle(0, 0, 130);
        return base;
    }

    /**
     * Create joystick stick circle
     * @returns {PIXI.Graphics} Stick circle graphics
     */
    createJoystickStick() {
        const stick = new PIXI.Graphics();
        stick
            .fill({ color: 0xFFFFFF, alpha: 0.3 })
            .circle(0, 0, 50);
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
        if (!this.debugPanel) {
            this.createDebugPanel();
        } else {
            this.container.removeChild(this.debugPanel);
            this.debugPanel = null;
            this.statsText = null;
        }
    }

    createDebugLegend() {
        this.debugLegend = new PIXI.Container();
        
        // Create semi-transparent background
        const bg = new PIXI.Graphics();
        bg.fill({ color: 0x000000, alpha: 0.7 })
            .roundRect(0, 0, 200, 160, 10);
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
        panel
            .fill({ color: 0x000000, alpha: 0.8 })
            .roundRect(0, 0, 300, 400, 10);
        panel.eventMode = 'static';
        menu.addChild(panel);
    }

    createSettingsTitle(menu) {
        const titleText = new PIXI.Text({
            text: 'Settings',
            style: {
                fontSize: 24,
                fill: 0xFFFFFF,
                fontWeight: 'bold'
            }
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

        const labelText = new PIXI.Text({
            text: label,
            style: {
                fontSize: 16,
                fill: 0xFFFFFF
            }
        });
        container.addChild(labelText);

        const checkbox = new PIXI.Graphics();
        checkbox
            .stroke({ width: 2, color: 0xFFFFFF })
            .rect(150, 0, 20, 20);
        container.addChild(checkbox);

        const check = new PIXI.Graphics();
        check
            .fill({ color: 0x00FF00 })
            .rect(153, 3, 14, 14);
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
        const labelText = new PIXI.Text({
            text: label,
            style: {
                fontSize: 16,
                fill: 0xFFFFFF
            }
        });
        container.addChild(labelText);

        // Track
        const track = new PIXI.Graphics();
        track
            .fill({ color: 0x666666 })
            .rect(0, 30, 260, 4);
        container.addChild(track);

        // Handle
        const handle = new PIXI.Graphics();
        handle
            .fill({ color: 0xFFFFFF })
            .circle(0, 0, 8);
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
        overlay
            .fill({ color: 0x000000, alpha: 0 })
            .rect(0, 0, this.app.screen.width, this.app.screen.height);
        container.addChild(overlay);

        // Animate overlay fade in
        let alpha = 0;
        const fadeIn = () => {
            alpha += 0.05;
            overlay.clear();
            overlay
                .fill({ color: 0x000000, alpha: Math.min(0.8, alpha) })
                .rect(0, 0, this.app.screen.width, this.app.screen.height);

            if (alpha < 0.8) requestAnimationFrame(fadeIn);
        };
        fadeIn();
    }

    /**
     * Create game over text and stats
     * @param {PIXI.Container} container - Game over screen container
     */
    createGameOverContent(container) {
        const gameOverText = new PIXI.Text({
            text: 'GAME OVER',
            style: {
                fontSize: 64,
                fill: { gradient: ['#FF0000', '#880000'] },
                fontWeight: 'bold',
                stroke: { color: '#000000', width: 6 },
                dropShadow: true,
                dropShadowColor: '#000000',
                dropShadowBlur: 10,
                dropShadowDistance: 5
            }
        });
        gameOverText.anchor.set(0.5);
        gameOverText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);

        // Stats container
        const statsContainer = this.createGameOverStats();

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
        statsBg
            .fill({ color: 0x000000, alpha: 0.5 })
            .stroke({ width: 2, color: 0x444444 })
            .roundRect(-150, -60, 300, 120, 10);

        statsContainer.addChild(statsBg);

        // Stats text style
        const statsStyle = {
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center'
        };

        // Create stats text
        const finalScoreText = new PIXI.Text({
            text: `Score: ${gameState.score}`,
            style: statsStyle
        });
        finalScoreText.anchor.set(0.5);
        finalScoreText.position.set(0, -30);

        const levelText = new PIXI.Text({
            text: `Level Reached: ${gameState.level}`,
            style: statsStyle
        });
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
        buttonBg
            .fill({ color: 0x00AA00 })
            .stroke({ width: 3, color: 0x00FF00 })
            .roundRect(-100, -25, 200, 50, 15);

        // Button text
        const buttonText = new PIXI.Text({
            text: 'Play Again',
            style: {
                fontSize: 28,
                fill: 0xFFFFFF,
                fontWeight: 'bold',
                dropShadow: true,
                dropShadowColor: '#000000',
                dropShadowDistance: 2
            }
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
        const levelUpText = new PIXI.Text({
            text: 'LEVEL UP!',
            style: {
                fontSize: 48,
                fill: { gradient: ['#FFD700', '#FFA500'] },
                fontWeight: 'bold',
                stroke: { color: '#000000', width: 4 },
                dropShadow: true,
                dropShadowColor: '#000000',
                dropShadowBlur: 10,
                dropShadowDistance: 5
            }
        });
        levelUpText.anchor.set(0.5);
        levelUpText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 120);

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
            bg.fill({ color: 0x333333, alpha: 0.8 });
            bg.setStrokeStyle({ width: 2, color: 0x666666 });
            bg.roundRect(-150, -30, 300, 60, 10);
            
            const text = new PIXI.Text({
                text: upgrade.text,
                style: {
                    fontSize: 20,
                    fill: 0xFFFFFF,
                    align: 'center'
                }
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
            
            return container;
        });

        // Update the instruction text
        const instructionText = new PIXI.Text({
            text: 'Use ↑↓ or touch/click to select\nSPACE or tap/click to confirm',
            style: {
                fontSize: 16,
                fill: 0xCCCCCC,
                align: 'center'
            }
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
                    bg.fill({ color: 0x666666, alpha: 0.9 });
                    bg.setStrokeStyle({ width: 2, color: 0xFFD700 });
                    bg.roundRect(-150, -30, 300, 60, 10);
                    text.style.fill = 0xFFD700;
                    container.filters = null;
                    container.scale.set(1.1);
                } else {
                    bg.clear();
                    bg.fill({ color: 0x333333, alpha: 0.8 });
                    bg.setStrokeStyle({ width: 2, color: 0x666666 });
                    bg.roundRect(-150, -30, 300, 60, 10);
                    text.style.fill = 0xFFFFFF;
                    container.filters = [new PIXI.BlurFilter(1)];
                    container.scale.set(1);
                }
            });
        };

        // Add all elements to stage
        this.app.stage.addChild(levelUpText, instructionText);
        optionContainers.forEach(container => this.app.stage.addChild(container));

        // Initial selection update
        updateSelection();
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
        bg.fill({ color: 0x000000, alpha: 0.7 })
            .rect(0, 0, this.app.screen.width, 80);
        container.addChild(bg);

        // Create level name text
        const nameText = new PIXI.Text({
            text: levelName,
            style: {
                fontFamily: 'Arial',
                fontSize: 32,
                fill: 0xFFD700,
                align: 'center',
                stroke: { color: '#000000', width: 4 }
            }
        });
        nameText.anchor.set(0.5);
        nameText.position.set(this.app.screen.width / 2, 20);
        container.addChild(nameText);

        // Create description text
        const descText = new PIXI.Text({
            text: description,
            style: {
                fontFamily: 'Arial',
                fontSize: 20,
                fill: 0xFFFFFF,
                align: 'center',
                stroke: { color: '#000000', width: 3 }
            }
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
        bg.fill({ color: 0x000000, alpha: 0.7 })
            .roundRect(0, 0, 200, 360, 10);
        this.debugPanel.addChild(bg);

        // Create title
        const title = new PIXI.Text({
            text: 'Debug Stats',
            style: {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xFFD700,
                fontWeight: 'bold'
            }
        });
        title.position.set(10, 10);
        this.debugPanel.addChild(title);

        // Create stats text with sections
        this.statsText = new PIXI.Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 14,
                fill: 0xFFFFFF,
                lineHeight: 20
            }
        });
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

    showMessage(text, color = 0xFFFFFF, duration = 2000) {
        const message = new PIXI.Text({
            text: text,
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fill: color,
                stroke: 0x000000,
                strokeThickness: 4
            }
        });
        
        message.anchor.set(0.5);
        message.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);
        
        // Add to stage
        this.app.stage.addChild(message);
        
        // Animate in
        message.alpha = 0;
        message.scale.set(0.5);
        
        let progress = 0;
        const fadeIn = () => {
            progress += 0.1;
            message.alpha = Math.min(1, progress);
            message.scale.set(0.5 + (0.5 * progress));
            
            if (progress < 1) {
                requestAnimationFrame(fadeIn);
            } else {
                // Hold, then fade out
                setTimeout(() => {
                    progress = 1;
                    const fadeOut = () => {
                        progress -= 0.1;
                        message.alpha = Math.max(0, progress);
                        message.scale.set(1 - (0.2 * (1 - progress)));
                        
                        if (progress > 0) {
                            requestAnimationFrame(fadeOut);
                        } else {
                            this.app.stage.removeChild(message);
                        }
                    };
                    fadeOut();
                }, duration);
            }
        };
        fadeIn();
    }

    showStartScreen(onStartGame) {
        console.log('Showing start screen');
        
        // Hide other UI elements
        this.gameplayUI.visible = false;
        this.gameOverUI.visible = false;
        this.levelUpUI.visible = false;
        
        // Create container for start screen
        const startScreen = new PIXI.Container();
        startScreen.sortableChildren = true;
        startScreen.eventMode = 'static';
        
        // Create semi-transparent background
        const bg = new PIXI.Graphics()
            .fill({ color: 0x000000, alpha: 0.7 })
            .rect(0, 0, this.app.screen.width, this.app.screen.height);
        startScreen.addChild(bg);
        
        // Create title text
        const title = new PIXI.Text({
            text: 'Vampire Survivor Demo',
            style: {
                fontFamily: 'Arial',
                fontSize: 48,
                fill: 0xFFFFFF,
                align: 'center',
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowDistance: 4
            }
        });
        title.anchor.set(0.5);
        title.position.set(this.app.screen.width / 2, this.app.screen.height / 3);
        startScreen.addChild(title);
        
        // Create start button
        const button = new PIXI.Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';
        
        const buttonBg = new PIXI.Graphics()
            .fill({ color: 0x00FF00 })
            .roundRect(0, 0, 200, 60, 10);
        
        const buttonText = new PIXI.Text({
            text: 'Start Game',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fill: 0xFFFFFF,
                align: 'center'
            }
        });
        buttonText.anchor.set(0.5);
        buttonText.position.set(100, 30);
        
        button.addChild(buttonBg);
        button.addChild(buttonText);
        button.position.set(
            this.app.screen.width / 2 - 100,
            this.app.screen.height * 0.6
        );
        
        // Add button interaction
        button.on('pointerdown', () => {
            console.log('Start button clicked');
            this.container.removeChild(startScreen);
            this.showGameplayUI();  // Show gameplay UI
            if (onStartGame) {
                console.log('Calling onStartGame callback');
                onStartGame();
            }
        });
        
        button.on('pointerover', () => {
            buttonBg.tint = 0x00CC00;
        });
        
        button.on('pointerout', () => {
            buttonBg.tint = 0xFFFFFF;
        });
        
        startScreen.addChild(button);
        this.container.addChild(startScreen);
        
        console.log('Start screen setup complete');
    }

    showGameplayUI() {
        console.log('Showing gameplay UI');
        this.gameplayUI.visible = true;
        this.gameOverUI.visible = false;
        this.levelUpUI.visible = false;
    }

    initializeMouseCoordOverlay() {
        // Create container for mouse coordinates
        this.mouseCoordOverlay = new PIXI.Container();
        this.mouseCoordOverlay.zIndex = 9999; // Always on top
        
        // Create text for coordinates using v8 syntax
        const coordStyle = {
            fontSize: 12,
            fill: 0xFFFFFF,
            stroke: { 
                color: 0x000000,
                width: 3
            },
            fontFamily: 'Arial'
        };
        
        this.coordText = new PIXI.Text({
            text: '',
            style: coordStyle
        });
        this.mouseCoordOverlay.addChild(this.coordText);
        
        // Add to container
        this.container.addChild(this.mouseCoordOverlay);
        
        // Add mousemove listener
        this.app.stage.eventMode = 'static';
        this.app.stage.on('pointermove', this.updateMouseCoordinates.bind(this));
    }

    updateMouseCoordinates(event) {
        if (!this.mouseCoordOverlay || !this.game.worldContainer) return;

        // Get viewport coordinates
        const viewportX = Math.round(event.global.x);
        const viewportY = Math.round(event.global.y);

        // Calculate world coordinates using CameraManager
        const worldPos = this.game.cameraManager.screenToWorld(viewportX, viewportY);
        const worldX = Math.round(worldPos.x);
        const worldY = Math.round(worldPos.y);

        // Update text content
        this.coordText.text = `Viewport: (${viewportX}, ${viewportY})\nWorld: (${worldX}, ${worldY})`;
        
        // Position text next to cursor with offset
        this.mouseCoordOverlay.position.set(
            viewportX + 15, // Offset from cursor
            viewportY + 15
        );

        // Keep coordinates within screen bounds
        if (viewportX + this.coordText.width + 20 > this.app.screen.width) {
            this.mouseCoordOverlay.x = viewportX - this.coordText.width - 15;
        }
        if (viewportY + this.coordText.height + 20 > this.app.screen.height) {
            this.mouseCoordOverlay.y = viewportY - this.coordText.height - 15;
        }
    }

    toggleCoordinateOverlay() {
        if (this.mouseCoordOverlay) {
            this.mouseCoordOverlay.visible = !this.mouseCoordOverlay.visible;
        }
    }
} 