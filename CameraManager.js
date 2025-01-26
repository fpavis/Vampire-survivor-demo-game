import { WORLD_CONFIG } from './config.js';
import { gameState } from './gameState.js';

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