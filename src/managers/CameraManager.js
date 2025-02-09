/**
 * @file CameraManager.js
 * @description Manages the game camera, following the player and handling screen-to-world coordinate
 * conversions. Controls the viewport and ensures smooth camera movement within world boundaries.
 * 
 * @module managers/CameraManager
 * @requires core/config
 * @requires core/gameState
 * 
 * Key Features:
 * - Follows player movement
 * - Handles camera boundaries
 * - Converts between screen and world coordinates
 * - Determines if entities are in view
 * 
 * Usage:
 * ```js
 * const cameraManager = new CameraManager(app, worldContainer);
 * cameraManager.update();
 * const worldPos = cameraManager.screenToWorld(screenX, screenY);
 * const isVisible = cameraManager.isInView(entityX, entityY);
 * ```
 * 
 * Modification Guidelines:
 * - Adjust camera movement by modifying the update method
 * - Change boundary behavior in the position clamping logic
 * - Modify view checking by updating isInView parameters
 * - Add camera effects by extending the update method
 * 
 * @class
 */

import { WORLD_CONFIG } from '../core/config.js';
import { gameState } from '../core/gameState.js';

export class CameraManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
    }

    update() {
        // Calculate where the camera should be
        const targetX = -gameState.player.x + this.app.screen.width / 2;
        const targetY = -gameState.player.y + this.app.screen.height / 2;
        
        // Clamp camera position to world bounds
        const minX = -WORLD_CONFIG.width + this.app.screen.width;
        const minY = -WORLD_CONFIG.height + this.app.screen.height;
        
        this.worldContainer.x = Math.max(Math.min(targetX, 0), minX);
        this.worldContainer.y = Math.max(Math.min(targetY, 0), minY);
    }

    screenToWorld(screenX, screenY) {
        return {
            x: screenX - this.worldContainer.x,
            y: screenY - this.worldContainer.y
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX + this.worldContainer.x,
            y: worldY + this.worldContainer.y
        };
    }

    isInView(worldX, worldY, margin = 100) {
        const screenPos = this.worldToScreen(worldX, worldY);
        return screenPos.x >= -margin &&
               screenPos.x <= this.app.screen.width + margin &&
               screenPos.y >= -margin &&
               screenPos.y <= this.app.screen.height + margin;
    }
} 