/**
 * @file LayerSystem.js
 * @description Manages the game's rendering layers and their organization
 */

import * as PIXI from 'pixi.js';
import { LAYER_CONFIG } from '../core/config.js';

/**
 * System for managing game layers and their rendering order
 * @class
 */
export class LayerSystem {
    /**
     * Creates a new LayerSystem
     * @param {PIXI.Application} app - The main PIXI application
     * @param {ViewportSystem} viewportSystem - The viewport system for managing view and camera
     */
    constructor(app, viewportSystem) {
        this.app = app;
        this.viewportSystem = viewportSystem;
        this.layers = new Map();
    }

    /**
     * Creates all game layers and sets up their hierarchy
     * @returns {Promise<Object>} Object containing all created layers
     */
    async createGameLayers() {
        // Validate viewport system
        if (!this.viewportSystem?.getViewport()) {
            throw new Error('LayerSystem: ViewportSystem not initialized');
        }

        // Set up viewport and world container properties
        const viewport = this.viewportSystem.getViewport();
        const worldContainer = this.viewportSystem.getWorldContainer();
        
        viewport.sortableChildren = true;
        viewport.eventMode = 'passive';
        worldContainer.sortableChildren = true;
        worldContainer.eventMode = 'passive';

        // Add viewport to stage with proper z-index
        this.app.stage.addChild(viewport);
        viewport.zIndex = 10;

        // Create and configure each layer
        for (const [name, config] of Object.entries(LAYER_CONFIG)) {
            const layer = new PIXI.Container();
            layer.label = name;
            layer.sortableChildren = true;
            layer.zIndex = config.zIndex;
            layer.eventMode = config.interactive ? 'static' : 'none';
            
            // Add layer to world container
            worldContainer.addChild(layer);
            this.layers.set(name, layer);
        }

        // Return an object with all layers for easy access
        return {
            backgroundLayer: this.layers.get('background'),
            terrainLayer: this.layers.get('terrain'),
            entityLayer: this.layers.get('entities'),
            bulletLayer: this.layers.get('bullets'),
            effectsLayer: this.layers.get('effects'),
            portalLayer: this.layers.get('portals'),
            uiContainer: this.layers.get('ui')
        };
    }

    /**
     * Gets the current state of the layer system
     * @returns {Object} Current state of layers and containers
     */
    getState() {
        const viewport = this.viewportSystem.getViewport();
        const worldContainer = this.viewportSystem.getWorldContainer();
        
        return {
            viewport: {
                sortableChildren: viewport.sortableChildren,
                zIndex: viewport.zIndex,
                visible: viewport.visible,
                alpha: viewport.alpha
            },
            worldContainer: {
                sortableChildren: worldContainer.sortableChildren,
                children: worldContainer.children.map(c => ({
                    name: c.name,
                    zIndex: c.zIndex,
                    visible: c.visible
                }))
            },
            layers: Array.from(this.layers.entries()).map(([name, layer]) => ({
                name,
                zIndex: layer.zIndex,
                visible: layer.visible,
                children: layer.children.length
            }))
        };
    }
} 