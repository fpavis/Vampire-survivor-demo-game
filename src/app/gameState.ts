// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import { INITIAL_STATE } from '../core/config';

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        Object.assign(this, { ...INITIAL_STATE });
        this.levelUp = false;
        this.gameOver = false;
        this.paused = false;
        this.keys = {};
        this.time = 0;       // seconds survived
        this.kills = 0;
        this.bossesDefeated = 0;
        this.passives = {};  // id -> level

        this.pointerPosition = null;
        this.pointerDown = false;

        this.player = null;
        this.enemies = [];
        this.gems = [];
    }
}

export const gameState = new GameState();
