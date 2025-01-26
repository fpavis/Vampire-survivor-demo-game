import { INITIAL_STATE } from './config.js';

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        Object.assign(this, {
            ...INITIAL_STATE,
            gameStartTime: Date.now(),
            enemies: [],
            bullets: [],
            experienceGems: [],
            keys: {},
            pointerPosition: null,
            pointerDown: false,
            invulnerable: false,
            gameOver: false,
            levelUp: false,
            paused: false,
            killCount: 0
        });
        this.lastFire = 0;
        this.pendingExperience = 0;
        this.gameTicker = null;
        
        // Ensure nextLevel is properly set
        this.nextLevel = INITIAL_STATE.XP_TO_LEVEL;
    }
}

export const gameState = new GameState(); 