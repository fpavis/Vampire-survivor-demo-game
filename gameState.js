import { INITIAL_STATE } from './config.js';

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        Object.assign(this, {...INITIAL_STATE});
        this.lastFire = 0;
        this.levelUp = false;
        this.gameOver = false;
        this.paused = false;
        this.keys = {};
        this.pendingExperience = 0;
        
        this.pointerPosition = null;
        this.pointerDown = false;
        
        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.experienceGems = [];
        this.gameTicker = null;
    }
}

export const gameState = new GameState(); 