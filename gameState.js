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
            paused: false
        });
        this.lastFire = 0;
        this.pendingExperience = 0;
        this.gameTicker = null;
    }
}

export const gameState = new GameState(); 