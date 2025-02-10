/**
 * @file GameEntity.js
 * @description Base entity class that provides common functionality for all game objects.
 * This is a foundational class that other game entities (like enemies, projectiles) can extend.
 * 
 * Key Features:
 * - Extends PIXI.Container for proper scene graph integration
 * - Provides safe position management methods
 * - Handles world coordinate transformations
 * - Supports render culling for performance optimization
 * 
 * Usage Example:
 * ```js
 * class Enemy extends GameEntity {
 *   constructor() {
 *     super('EnemyEntity');
 *     // Add enemy-specific functionality
 *   }
 * }
 */

import * as PIXI from 'pixi.js';

/**
 * Base entity container with optimized rendering and transform handling
 * This class serves as the foundation for all game objects that:
 * - Need to exist in the game world
 * - Require position management
 * - Need to be culled when off-screen
 * 
 * @extends PIXI.Container - Inherits from PIXI's display object container
 */
export class GameEntity extends PIXI.Container {
    /**
     * Creates a new GameEntity instance
     * @param {string} label - Identifier for the entity, useful for debugging
     */
    constructor(label = 'GameEntity') {
        super();
        
        // Basic entity properties
        this.label = label;                // Identifier for debugging
        this.sortableChildren = true;      // Enable z-index sorting
        this.eventMode = 'none';           // Disable interaction by default for performance
        
        // Culling setup for rendering optimization
        // When an entity is off-screen, it won't be rendered
        this.cullable = true;              // Enable render culling
        this.cullArea = null;              // Area to check for culling
    }

    /**
     * Safely updates the entity's position with validation
     * Prevents setting invalid positions that could break rendering
     * 
     * @param {number} x - X coordinate to move to
     * @param {number} y - Y coordinate to move to
     */
    setPosition(x, y) {
        // Only set position if coordinates are valid numbers
        if (Number.isFinite(x) && Number.isFinite(y)) {
            this.position.set(x, y);
        }
    }

    /**
     * Sets the entity's position in world coordinates
     * This is useful when you need to position entities in absolute world space
     * rather than relative to their parent container
     * 
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     */
    setWorldPosition(x, y) {
        // Validate coordinates to prevent rendering errors
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.error('Invalid world coordinates:', { x, y });
            return;
        }

        // Set position and update bounds for culling
        this.position.set(x, y);
        this.getBounds(true);  // Force bounds update
    }

    /**
     * Gets the entity's position in world coordinates
     * Useful for:
     * - Collision detection
     * - Distance calculations
     * - Camera following
     * 
     * @returns {PIXI.Point} The entity's position in world space
     */
    getWorldPosition() {
        // If entity has a parent, convert local position to global
        // Otherwise, return a copy of the current position
        return this.parent?.toGlobal(this.position) ?? this.position.clone();
    }
}

/**
 * Note on Usage:
 * 
 * GameEntity is designed to be extended by specific entity types.
 * It provides common functionality that most game objects need:
 * 
 * 1. Position Management:
 *    - Safe position updates
 *    - World coordinate conversion
 *    - Bounds tracking
 * 
 * 2. Rendering Optimization:
 *    - Culling support
 *    - Z-index sorting
 *    - Event optimization
 * 
 * 3. Scene Graph Integration:
 *    - Proper parent-child relationships
 *    - Transform hierarchy
 *    - Coordinate space conversion
 * 
 * Example entities that might extend GameEntity:
 * - Enemies
 * - Projectiles
 * - Power-ups
 * - Environmental objects
 */ 