import { INITIAL_STATE } from '../core/config';

// The live entities are Pixi containers carrying game fields; they stay loosely typed until the sim is split out.
type Entity = any;

class GameState {
    health!: number;
    maxHealth!: number;
    level!: number;
    experience!: number;
    nextLevel!: number;
    playerSpeed!: number;
    score!: number;
    levelUp!: boolean;
    gameOver!: boolean;
    paused!: boolean;
    keys!: Record<string, boolean>;
    time!: number;
    kills!: number;
    bossesDefeated!: number;
    byType!: Record<string, number>;
    distance!: number;
    goldEarned!: number;
    deaths!: number;
    picks!: Record<string, number>;
    wallet!: { gold: number; wood: number; stone: number; iron: number };
    lootFilter!: string;
    pending!: number;
    pointerPosition!: { x: number; y: number } | null;
    pointerDown!: boolean;
    player!: Entity | null;
    enemies!: Entity[];
    gems!: Entity[];

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
