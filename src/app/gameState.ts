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
        this.byType = {};    // kills per monster type
        this.distance = 0;   // world units walked
        this.goldEarned = 0;
        this.deaths = 0;     // party wipes
        this.picks = {};     // stat card id -> level
        this.wallet = { gold: 0, wood: 0, stone: 0, iron: 0 };
        this.lootFilter = 'off';
        this.pending = 0;    // level-ups waiting for a card

        this.pointerPosition = null;
        this.pointerDown = false;

        this.player = null;
        this.enemies = [];
        this.gems = [];
    }
}

export const gameState = new GameState();
