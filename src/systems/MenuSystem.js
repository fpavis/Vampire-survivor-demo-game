/**
 * @file MenuSystem.js
 * @description Handles all menu-related UI elements including start screen,
 * game over screen, settings menu, and other non-gameplay UI elements.
 */

import * as PIXI from 'pixi.js';
import { gameState } from '../core/gameState.js';

export class MenuSystem {
    /**
     * @param {PIXI.Container} container - The UI container to add menu elements to
     * @param {Map<string, {texture: PIXI.Texture}>} sharedGraphics - Shared graphics resources
     */
    constructor(container, sharedGraphics) {
        if (!container || !(container instanceof PIXI.Container)) {
            throw new Error('MenuSystem: Valid PIXI.Container not provided');
        }

        if (!sharedGraphics || !(sharedGraphics instanceof Map)) {
            throw new Error('MenuSystem: Shared graphics not provided');
        }

        this.container = container;
        this.sharedGraphics = sharedGraphics;
        
        // Initialize collections
        this.menus = new Map();
        this.callbacks = new Map();
        
        // Create standard menus
        this.createStartMenu();
        this.createGameOverMenu();
        this.createSettingsMenu();
        this.createPauseMenu();
    }

    /**
     * Create start menu
     * @private
     */
    createStartMenu() {
        const menu = new PIXI.Container();
        menu.label = 'startMenu';
        menu.sortableChildren = true;
        

        // Create semi-transparent overlay
        const overlay = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        overlay.width = window.innerWidth;
        overlay.height = window.innerHeight;
        overlay.alpha = 0.7;
        overlay.zIndex = 0;
        menu.addChild(overlay);
        
        // Create title
        const title = new PIXI.Text({
            text: 'Vampire Survivor Demo',
            style: {
                fontSize: 48,
                fill: 0xFFFFFF,
                align: 'center',
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowDistance: 4
            }
        });
        title.anchor.set(0.5);
        title.zIndex = 1;
        menu.addChild(title);
        
        // Create start button
        const startButton = this.createButton('Start Game', () => {
            this.hideMenu('startMenu');
            this.callbacks.get('onStartGame')?.();
        });
        startButton.zIndex = 1;
        menu.addChild(startButton);
        
        // Add to collection
        this.menus.set('startMenu', { container: menu, elements: { overlay, title, startButton } });
        this.container.addChild(menu);
        
        // Initially show start menu
        menu.visible = true;
    }

    /**
     * Create game over menu
     * @private
     */
    createGameOverMenu() {
        const menu = new PIXI.Container();
        menu.label = 'gameOverMenu';
        menu.sortableChildren = true;
        

        // Create overlay
        const overlay = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        overlay.width = window.innerWidth;
        overlay.height = window.innerHeight;
        overlay.alpha = 0.8;
        overlay.zIndex = 0;
        menu.addChild(overlay);
        
        // Create game over text
        const title = new PIXI.Text({
            text: 'GAME OVER',
            style: {
                fontSize: 64,
                fill: 0xFF0000,
                align: 'center',
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowDistance: 6
            }
        });
        title.anchor.set(0.5);
        title.zIndex = 1;
        menu.addChild(title);
        
        // Create stats panel
        const statsPanel = new PIXI.Container();
        statsPanel.zIndex = 1;
        
        const statsBg = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        statsBg.width = 300;
        statsBg.height = 200;
        statsPanel.addChild(statsBg);
        
        const statsText = new PIXI.Text({
            text: 'Loading stats...',
            style: {
                fontSize: 20,
                fill: 0xFFFFFF,
                align: 'left'
            }
        });
        statsText.position.set(20, 20);
        statsPanel.addChild(statsText);
        
        menu.addChild(statsPanel);
        
        // Create restart button
        const restartButton = this.createButton('Play Again', () => {
            this.hideMenu('gameOverMenu');
            this.callbacks.get('onRestart')?.();
        });
        restartButton.zIndex = 1;
        menu.addChild(restartButton);
        
        // Add to collection
        this.menus.set('gameOverMenu', { 
            container: menu, 
            elements: { overlay, title, statsPanel, statsText, restartButton }
        });
        this.container.addChild(menu);
        
        // Initially hide
        menu.visible = false;
    }

    /**
     * Create settings menu
     * @private
     */
    createSettingsMenu() {
        const menu = new PIXI.Container();
        menu.label = 'settingsMenu';
        menu.sortableChildren = true;
        

        // Create panel background
        const panel = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        panel.width = 400;
        panel.height = 500;
        panel.alpha = 0.9;
        panel.zIndex = 0;
        menu.addChild(panel);
        
        // Create title
        const title = new PIXI.Text({
            text: 'Settings',
            style: {
                fontSize: 32,
                fill: 0xFFFFFF,
                align: 'center'
            }
        });
        title.anchor.set(0.5, 0);
        title.zIndex = 1;
        menu.addChild(title);
        
        // Create settings options
        const options = new PIXI.Container();
        options.zIndex = 1;
        
        // Add settings controls here (volume, graphics, etc.)
        
        menu.addChild(options);
        
        // Create close button
        const closeButton = this.createButton('Close', () => {
            this.hideMenu('settingsMenu');
        });
        closeButton.zIndex = 1;
        menu.addChild(closeButton);
        
        // Add to collection
        this.menus.set('settingsMenu', { 
            container: menu, 
            elements: { panel, title, options, closeButton }
        });
        this.container.addChild(menu);
        
        // Initially hide
        menu.visible = false;
    }

    /**
     * Create pause menu
     * @private
     */
    createPauseMenu() {
        const menu = new PIXI.Container();
        menu.label = 'pauseMenu';
        menu.sortableChildren = true;
        

        // Create semi-transparent overlay
        const overlay = new PIXI.Sprite(this.sharedGraphics.get('panel').texture);
        overlay.width = window.innerWidth;
        overlay.height = window.innerHeight;
        overlay.alpha = 0.5;
        overlay.zIndex = 0;
        menu.addChild(overlay);
        
        // Create title
        const title = new PIXI.Text({
            text: 'Paused',
            style: {
                fontSize: 48,
                fill: 0xFFFFFF,
                align: 'center'
            }
        });
        title.anchor.set(0.5);
        title.zIndex = 1;
        menu.addChild(title);
        
        // Create buttons container
        const buttons = new PIXI.Container();
        buttons.zIndex = 1;
        
        // Resume button
        const resumeButton = this.createButton('Resume', () => {
            this.hideMenu('pauseMenu');
            gameState.paused = false;
        });
        buttons.addChild(resumeButton);
        
        // Settings button
        const settingsButton = this.createButton('Settings', () => {
            this.showMenu('settingsMenu');
        });
        settingsButton.position.y = 70;
        buttons.addChild(settingsButton);
        
        // Quit button
        const quitButton = this.createButton('Quit to Menu', () => {
            this.hideMenu('pauseMenu');
            this.showMenu('startMenu');
            this.callbacks.get('onQuit')?.();
        });
        quitButton.position.y = 140;
        buttons.addChild(quitButton);
        
        menu.addChild(buttons);
        
        // Add to collection
        this.menus.set('pauseMenu', { 
            container: menu, 
            elements: { overlay, title, buttons }
        });
        this.container.addChild(menu);
        
        // Initially hide
        menu.visible = false;
    }

    /**
     * Create a button with standard styling
     * @param {string} text - Button text
     * @param {Function} onClick - Click handler
     * @returns {PIXI.Container} Button container
     * @private
     */
    createButton(text, onClick) {
        const button = new PIXI.Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';
        
        // Button background
        const bg = new PIXI.Sprite(this.sharedGraphics.get('button').texture);
        bg.width = 200;
        bg.height = 50;
        button.addChild(bg);
        
        // Button text
        const buttonText = new PIXI.Text({
            text,
            style: {
                fontSize: 24,
                fill: 0xFFFFFF,
                align: 'center'
            }
        });
        buttonText.anchor.set(0.5);
        buttonText.position.set(bg.width / 2, bg.height / 2);
        button.addChild(buttonText);
        
        // Add interactivity
        button.on('pointerdown', onClick);
        button.on('pointerover', () => {
            bg.tint = 0xCCCCCC;
            buttonText.scale.set(1.1);
        });
        button.on('pointerout', () => {
            bg.tint = 0xFFFFFF;
            buttonText.scale.set(1);
        });
        
        return button;
    }

    /**
     * Show a specific menu
     * @param {string} menuName - Name of menu to show
     */
    showMenu(menuName) {
        const menu = this.menus.get(menuName);
        if (!menu) return;
        
        // Hide all other menus first
        this.menus.forEach((m, name) => {
            if (name !== menuName) {
                m.container.visible = false;
            }
        });
        
        // Show requested menu
        menu.container.visible = true;
        
        // Update menu positions
        this.updateMenuPositions();
        
        // Handle game state
        if (menuName !== 'startMenu') {
            gameState.paused = true;
        }
    }

    /**
     * Hide a specific menu
     * @param {string} menuName - Name of menu to hide
     */
    hideMenu(menuName) {
        const menu = this.menus.get(menuName);
        if (!menu) return;
        
        menu.container.visible = false;
        
        // Update game state
        if (menuName === 'pauseMenu' || menuName === 'settingsMenu') {
            gameState.paused = false;
        }
    }

    /**
     * Register a callback
     * @param {string} name - Callback name
     * @param {Function} callback - Callback function
     */
    registerCallback(name, callback) {
        this.callbacks.set(name, callback);
    }

    /**
     * Update menu positions based on screen size
     * @private
     */
    updateMenuPositions() {
        this.menus.forEach(menu => {
            const { container, elements } = menu;
            
            // Center menu container
            if (elements.overlay) {
                elements.overlay.width = window.innerWidth;
                elements.overlay.height = window.innerHeight;
            }
            
            if (elements.title) {
                elements.title.position.set(window.innerWidth / 2, window.innerHeight * 0.2);
            }
            
            if (elements.buttons) {
                elements.buttons.position.set(
                    window.innerWidth / 2 - 100,
                    window.innerHeight * 0.4
                );
            }
            
            // Position specific elements for each menu type
            switch (container.name) {
                case 'startMenu':
                    if (elements.startButton) {
                        elements.startButton.position.set(
                            window.innerWidth / 2 - 100,
                            window.innerHeight * 0.6
                        );
                    }
                    break;
                    
                case 'gameOverMenu':
                    if (elements.statsPanel) {
                        elements.statsPanel.position.set(
                            window.innerWidth / 2 - 150,
                            window.innerHeight * 0.4
                        );
                    }
                    if (elements.restartButton) {
                        elements.restartButton.position.set(
                            window.innerWidth / 2 - 100,
                            window.innerHeight * 0.7
                        );
                    }
                    break;
                    
                case 'settingsMenu':
                    container.position.set(
                        window.innerWidth / 2 - 200,
                        window.innerHeight * 0.1
                    );
                    break;
            }
        });
    }

    /**
     * Handle resize event
     * @param {number} width - New width
     * @param {number} height - New height
     */
    handleResize(width, height) {
        this.updateMenuPositions();
    }

    /**
     * Update game over stats
     * @param {Object} stats - Final game stats
     */
    updateGameOverStats(stats) {
        const menu = this.menus.get('gameOverMenu');
        if (!menu?.elements.statsText) return;
        
        menu.elements.statsText.text = [
            'Final Stats:',
            `Level: ${stats.level}`,
            `Score: ${stats.score}`,
            `Time Survived: ${Math.floor(stats.time / 1000)}s`,
            `Enemies Defeated: ${stats.kills}`
        ].join('\n');
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.menus.forEach(menu => {
            menu.container.destroy({ children: true });
        });
        this.menus.clear();
        this.callbacks.clear();
        this.container = null;
        this.sharedGraphics = null;
    }
} 