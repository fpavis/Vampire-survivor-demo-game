// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
import {
    GAME_CONFIG, ENEMY_TYPES, WORLD_CONFIG, SPAWN_CONFIG, xpForLevel
} from '../core/config';
import { gameState } from './gameState';
import { EntityManager } from '../render/entities';
import { UIManager } from './ui';
import { World, BIOME } from '../render/world';
import { Effects } from '../render/effects';
import { WeaponSystem, computeStats, generateChoices } from './weapons';
import { OverworldSource } from '../core/world/terrain';
import { createInterior } from '../core/world/interiors';
import { Hazards } from './hazards';
import { Critters } from '../render/critters';
import { MapView } from '../render/map';
import { FlowField } from '../core/world/nav';
import { updateEnemy, SpatialHash } from '../core/ai/ai';
import { GROUP_INFO, POI_INFO, WARLORDS, groupOf } from '../core/world/biomes';
import { FogOfWar } from '../core/world/fog';
import { EventBus } from '../core/sim/events';
import { randomSeed } from '../core/sim/rng';
import {
    enemyDamageScale, enemyHealthScale, enemySpeedScale, enemyXpScale, threatBand, tierName, tierOf
} from '../core/world/difficulty';
import { createSaveStore } from '../core/save/store';
import { buildSave } from './saveManager';
import { PopulationRuntime } from './populationRuntime';
import { perceptionOf } from '../core/config';
import { engage } from '../core/ai/ai';
import { installDevTools } from './devtools';

const TILT = WORLD_CONFIG.tilt;
const T = WORLD_CONFIG.tile;
const FONT = 'Trebuchet MS, Verdana, Arial, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Game {
    constructor() {
        this.app = new PIXI.Application(GAME_CONFIG);
        document.body.appendChild(this.app.view);
        this.app.stage.sortableChildren = true;

        this.state = gameState;
        this.frame = 0;
        this.stats = computeStats({});
        this.cam = { x: 0, y: 0 };
        this.bossCount = 0;
        this.eventsBound = false;

        // Layers: the ground is a flat, tilted plane; objects are upright billboards sorted by depth.
        this.worldContainer = new PIXI.Container();
        this.groundLayer = new PIXI.Container();
        this.groundLayer.scale.y = TILT;
        this.objectLayer = new PIXI.Container();
        this.objectLayer.sortableChildren = true;
        this.worldContainer.addChild(this.groundLayer, this.objectLayer);
        this.app.stage.addChild(this.worldContainer);

        this.createAtmosphere();

        this.world = new World(this.app, this.groundLayer, this.objectLayer);
        this.fx = new Effects(this);
        this.weapons = new WeaponSystem(this);
        this.hazards = new Hazards(this);
        this.critters = new Critters(this);
        this.map = new MapView();
        this.hash = new SpatialHash();
        this.flow = new FlowField(this.world, 40);
        this.counts = { lunging: 0 };
        this.uidCounter = 0;
        this.interactables = [];
        this.visited = {};
        this.mode = 'overworld';
        this.busy = false;
        this.playerVel = { x: 0, y: 0 };
        this.ambient = 0;
        this.ui = new UIManager(this.app);

        // persistent-world plumbing
        this.events = new EventBus();
        this.session = { clearedCamps: {}, defeatedLairs: {}, cities: [] };
        this.fog = new FogOfWar();
        this.interiorFog = new FogOfWar();
        this.popRuntime = new PopulationRuntime(this);
        this.enemyTypes = ENEMY_TYPES;
        this.createdAt = Date.now();
        this.accum = 0;
        this.timeScale = 1;
        this.godMode = false;
        this.zoneLevelNow = 1;
        this.zoneThreat = 'even';
        this.autosaveTimer = 1800;
        this.lastSaveAt = 0;
        this.saveSlot = 'autosave';
        this.storeReady = createSaveStore().then((store) => { this.store = store; return store; });

        window.addEventListener('resize', () => this.handleResize());
        const flush = () => { if (this.state.player && !this.state.gameOver && this.mode) this.requestSave('hidden', true); };
        document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
        window.addEventListener('pagehide', flush);

        this.world.setSource(new OverworldSource(randomSeed()));
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height, true);

        this.menuTicker = (delta) => this.menuLoop(delta);
        this.app.ticker.add(this.menuTicker);
        this.showStartScreen();
    }

    // -------------------------------------------------------------- scenery
    createAtmosphere() {
        const mk = (w, h, paint) => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            paint(canvas.getContext('2d'), w, h);
            return PIXI.Texture.from(canvas);
        };
        // Darkened edges pull the eye to the centre
        const vig = mk(256, 256, (ctx, w, h) => {
            const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
            g.addColorStop(0, 'rgba(0,0,10,0)');
            g.addColorStop(1, 'rgba(0,0,14,0.62)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        });
        // Atmospheric haze toward the horizon (top of the screen) sells the depth
        const haze = mk(4, 256, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, 'rgba(150,178,215,0.34)');
            g.addColorStop(0.5, 'rgba(150,178,215,0.08)');
            g.addColorStop(1, 'rgba(150,178,215,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        });
        // cave / ruin darkness: only a pool of light around the player
        const dark = mk(256, 256, (ctx, w, h) => {
            const gr = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.5);
            gr.addColorStop(0, 'rgba(2,2,8,0)');
            gr.addColorStop(0.55, 'rgba(2,2,8,0.7)');
            gr.addColorStop(1, 'rgba(2,2,8,1)');
            ctx.fillStyle = gr;
            ctx.fillRect(0, 0, w, h);
        });
        this.darkSprite = new PIXI.Sprite(dark);
        this.darkSprite.eventMode = 'none';
        this.darkSprite.zIndex = 9;
        this.darkSprite.anchor.set(0.5);
        this.darkSprite.visible = false;
        this.app.stage.addChild(this.darkSprite);
        this.vignetteSprite = new PIXI.Sprite(vig);
        this.hazeSprite = new PIXI.Sprite(haze);
        [this.hazeSprite, this.vignetteSprite].forEach((s) => {
            s.eventMode = 'none';
            s.zIndex = 10;
            this.app.stage.addChild(s);
        });
        this.layoutAtmosphere();
    }

    layoutAtmosphere() {
        const { width, height } = this.app.screen;
        this.vignetteSprite.width = width;
        this.vignetteSprite.height = height;
        this.hazeSprite.width = width;
        this.hazeSprite.height = height * 0.7;
        this.darkSprite.position.set(width / 2, height / 2);
        const dk = Math.max(width, height) * 1.5;
        this.darkSprite.width = dk;
        this.darkSprite.height = dk;
    }

    handleResize() {
        this.layoutAtmosphere();
        if (this.state.player) this.applyCamera();
    }

    applyCamera() {
        const { width, height } = this.app.screen;
        const s = this.fx.shake;
        const sx = s ? (Math.random() - 0.5) * s : 0;
        const sy = s ? (Math.random() - 0.5) * s : 0;
        this.worldContainer.x = Math.round(width / 2 - this.cam.x + sx);
        this.worldContainer.y = Math.round(height / 2 - this.cam.y * TILT + sy);
    }

    menuLoop(delta) {
        this.frame += delta;
        this.cam.x += 0.7 * delta;
        this.cam.y += Math.sin(this.frame * 0.004) * 0.5 * delta;
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height);
        this.world.animate(delta);
    }

    // --------------------------------------------------------- start screen
    makeMenuButton(text, fill, width = 280) {
        const button = new PIXI.Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';
        const bg = new PIXI.Graphics();
        const draw = (hover) => {
            bg.clear();
            bg.beginFill(hover ? fill.hover : fill.base);
            bg.lineStyle(3, 0xffffff, 0.8);
            bg.drawRoundedRect(-width / 2, -28, width, 56, 16);
            bg.endFill();
            bg.beginFill(0xffffff, 0.2);
            bg.drawRoundedRect(-width / 2 + 6, -24, width - 12, 20, 10);
            bg.endFill();
        };
        draw(false);
        const label = new PIXI.Text(text, { fontFamily: FONT, fontSize: 26, fontWeight: 'bold', fill: fill.text, letterSpacing: 2 });
        label.anchor.set(0.5);
        button.addChild(bg, label);
        button.on('pointerover', () => { draw(true); button.scale.set(1.05); });
        button.on('pointerout', () => { draw(false); button.scale.set(1); });
        button.label = label;
        return button;
    }

    showStartScreen() {
        const { app } = this;
        const screen = new PIXI.Container();
        screen.zIndex = 3000;
        screen.eventMode = 'static';
        app.stage.addChild(screen);

        const dim = new PIXI.Graphics();
        const title = new PIXI.Text('SURVIVAL', {
            fontFamily: FONT, fontSize: 84, fontWeight: 'bold', fill: ['#ffffff', '#8fb6ff'],
            stroke: 0x0a1230, strokeThickness: 9, dropShadow: true, dropShadowDistance: 6, dropShadowAlpha: 0.6, letterSpacing: 6
        });
        title.anchor.set(0.5);
        const subtitle = new PIXI.Text('An endless world awaits', { fontFamily: FONT, fontSize: 22, fill: 0xcfd8f0, letterSpacing: 3 });
        subtitle.anchor.set(0.5);
        const info = new PIXI.Text(
            'WASD / arrows / mouse / touch to move  ·  E to interact  ·  M for the map\nYour spells fire automatically  ·  The farther you travel, the deadlier it gets\nProgress is saved automatically', {
            fontFamily: FONT, fontSize: 18, fill: 0xd8deef, align: 'center', lineHeight: 28
        });
        info.anchor.set(0.5);
        const note = new PIXI.Text('', { fontFamily: FONT, fontSize: 14, fill: 0xffc98a, align: 'center' });
        note.anchor.set(0.5);

        const green = { base: 0x3fcf6a, hover: 0x5fe28a, text: 0x0b2a14 };
        const blue = { base: 0x4a7fe0, hover: 0x6a9aff, text: 0x061233 };
        const continueBtn = this.makeMenuButton('CONTINUE', green, 340);
        const newBtn = this.makeMenuButton('NEW GAME', blue, 340);
        const summary = new PIXI.Text('', { fontFamily: FONT, fontSize: 14, fill: 0xb8c4e0 });
        summary.anchor.set(0.5);
        continueBtn.visible = false;
        summary.visible = false;
        screen.addChild(dim, title, subtitle, info, continueBtn, summary, newBtn, note);

        const layout = () => {
            const w = app.screen.width, h = app.screen.height;
            dim.clear();
            dim.beginFill(0x04060c, 0.62);
            dim.drawRect(0, 0, w, h);
            dim.endFill();
            const s = clamp(w / 900, 0.55, 1);
            title.scale.set(s);
            title.position.set(w / 2, h * 0.2);
            subtitle.position.set(w / 2, h * 0.2 + 70 * s);
            info.scale.set(clamp(w / 760, 0.62, 1));
            info.position.set(w / 2, h * 0.43);
            continueBtn.position.set(w / 2, h * 0.62);
            summary.position.set(w / 2, h * 0.62 + 40);
            newBtn.position.set(w / 2, continueBtn.visible ? h * 0.62 + 90 : h * 0.66);
            note.position.set(w / 2, h * 0.9);
        };
        layout();
        window.addEventListener('resize', layout);

        let started = false;
        let save = null;
        let confirmNew = false;
        const begin = (data) => {
            if (started) return;
            started = true;
            window.removeEventListener('resize', layout);
            window.removeEventListener('keydown', onKey);
            app.stage.removeChild(screen);
            screen.destroy({ children: true });
            this.bindEvents();
            this.init(data);
        };
        const startNew = () => {
            if (save && !confirmNew) {
                confirmNew = true;
                newBtn.label.text = 'OVERWRITE SAVE?';
                setTimeout(() => { confirmNew = false; if (!started) newBtn.label.text = 'NEW GAME'; }, 3500);
                return;
            }
            begin(null);
        };
        const onKey = (e) => {
            if (e.key === 'Enter' || e.key === ' ') { if (save) begin(save); else startNew(); }
        };
        window.addEventListener('keydown', onKey);
        continueBtn.on('pointerdown', (e) => { e.stopPropagation(); if (save) begin(save); });
        newBtn.on('pointerdown', (e) => { e.stopPropagation(); startNew(); });

        // look for an existing save once the store is ready
        this.storeReady.then(async (store) => {
            if (!store.persistent) note.text = 'Progress cannot be saved in this environment (no browser storage available).';
            try {
                const data = await store.load(this.saveSlot);
                if (data && !started) {
                    save = data;
                    const mins = Math.floor(data.playSeconds / 60);
                    summary.text = `Level ${data.hero.level}  ·  ${mins} min played  ·  ${Object.keys(data.world.clearedCamps).length} camps cleared  ·  ${data.world.cities.length} towns visited`;
                    continueBtn.visible = true;
                    summary.visible = true;
                    layout();
                }
            } catch (err) {
                note.text = `Could not read the saved game (${err && err.message ? err.message : err}). You can start a new game.`;
            }
        });

        // gentle idle animation
        const idle = () => {
            if (started) { app.ticker.remove(idle); return; }
            title.y = app.screen.height * 0.2 + Math.sin(this.frame * 0.03) * 4;
        };
        app.ticker.add(idle);
    }

    bindEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;
        window.addEventListener('keydown', (e) => {
            if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
            gameState.keys[e.key] = true;
            if (!gameState.player || gameState.gameOver) return;
            if (e.key === 'e' || e.key === 'E') this.interact();
            else if (e.key === 'm' || e.key === 'M') this.toggleMap();
        });
        window.addEventListener('keyup', (e) => { gameState.keys[e.key] = false; });
        window.addEventListener('blur', () => { gameState.keys = {}; });

        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;
        this.app.stage.on('pointermove', (e) => {
            gameState.pointerPosition = { x: e.global.x, y: e.global.y };
        });
        this.app.stage.on('pointerdown', (e) => {
            if (gameState.levelUp || gameState.gameOver || gameState.paused) return;
            gameState.pointerPosition = { x: e.global.x, y: e.global.y };
            gameState.pointerDown = true;
        });
        this.app.stage.on('pointerup', () => { gameState.pointerDown = false; });
        this.app.stage.on('pointerupoutside', () => { gameState.pointerDown = false; });
    }

    // ------------------------------------------------------------ new game
    clearWorldEntities() {
        const s = this.state;
        s.enemies.forEach((e) => EntityManager.cleanup(e));
        s.gems.forEach((g) => EntityManager.cleanup(g));
        s.enemies = [];
        s.gems = [];
        this.interactables.forEach((i) => { if (i.sprite) { this.objectLayer.removeChild(i.sprite); i.sprite.destroy(); } });
        this.interactables = [];
        this.critters.reset();
        this.hazards.reset();
        this.weapons.clearProjectiles();
        this.fx.clear();
    }

    clearEntities() {
        const s = this.state;
        this.clearWorldEntities();
        if (s.player) EntityManager.cleanup(s.player);
        this.weapons.reset();
    }

    init(save = null) {
        this.clearEntities();
        gameState.reset();
        this.bossCount = 0;
        this.pendingBoss = false;
        this.frame = 0;
        this.accum = 0;
        this.mode = 'overworld';
        this.busy = false;
        this.zoneGroup = null;
        this.zoneLabel = '';
        this.interior = null;
        this.interiorPoi = null;
        this.autosaveTimer = 1800;
        this.createdAt = save ? save.createdAt : Date.now();
        this.lastFogTx = null;
        this.lastFogTy = null;

        this.app.ticker.remove(this.menuTicker);
        if (this.gameTicker) this.app.ticker.remove(this.gameTicker);

        // the world: seed + saved deltas
        this.overworld = new OverworldSource(save ? save.seed : randomSeed());
        this.world.setSource(this.overworld);
        this.world.onChunk = null;
        this.session = { clearedCamps: {}, defeatedLairs: {}, cities: [] };
        this.visited = {};
        this.fog = new FogOfWar();
        this.interiorFog = new FogOfWar();
        if (save) {
            this.session.clearedCamps = { ...save.world.clearedCamps };
            this.session.defeatedLairs = { ...save.world.defeatedLairs };
            this.session.cities = save.world.cities.map((c) => ({ ...c }));
            this.visited = JSON.parse(JSON.stringify(save.world.places));
            this.fog = FogOfWar.fromJSON(save.world.fog);
        }
        this.popRuntime.reset(this.overworld);
        this.map.reset();
        this.map.setMode('overworld');
        this.map.lairDefeated = (id) => this.session.defeatedLairs[id] !== undefined;
        this.setAmbient(0);
        this.flow.centerTx = NaN;

        const player = EntityManager.createPlayer();
        const start = save ? save.player : { x: 0, y: 0 };
        const spot = this.world.findFree(start.x, start.y, player.radius + 2);
        player.wx = spot.x;
        player.wy = spot.y;
        player.facing = 1;
        player.slowUntil = 0;
        player.slowAmt = 0;
        this.objectLayer.addChild(player);
        EntityManager.place(player);
        gameState.player = player;
        this.playerVel = { x: 0, y: 0 };

        if (save) {
            const hero = save.hero;
            this.weapons.list = hero.weapons.map((w) => ({ id: w.id, level: w.level, timer: 20 }));
            gameState.passives = { ...hero.passives };
            this.stats = computeStats(gameState.passives);
            gameState.maxHealth = this.stats.maxHealth;
            gameState.level = hero.level;
            gameState.experience = hero.experience;
            gameState.nextLevel = hero.nextLevel;
            gameState.health = clamp(hero.health, 1, gameState.maxHealth);
            gameState.kills = save.stats.kills;
            gameState.score = save.stats.score;
            gameState.bossesDefeated = save.stats.bossesDefeated;
            gameState.time = save.playSeconds;
        } else {
            this.weapons.acquire('bolt');
            this.stats = computeStats({});
            gameState.maxHealth = this.stats.maxHealth;
            gameState.health = gameState.maxHealth;
            gameState.nextLevel = xpForLevel(1);
        }
        EntityManager.heroLevel = gameState.level;

        this.cam.x = player.wx;
        this.cam.y = player.wy;
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height, true);
        this.updateFog();
        this.syncMap();

        this.ui.game = this;
        this.ui.onInteract = () => this.interact();
        this.ui.onMapToggle = () => this.toggleMap();
        this.ui.setHUDVisible(true);
        this.ui.shown = { hp: -1, xp: -1, level: -1, slots: '' };
        this.ui.displayHp = gameState.health;
        this.ui.displayXp = gameState.experience;
        this.ui.fadeAlpha = 0; this.ui.fadeTarget = 0;

        this.gameTicker = (delta) => this.gameLoop(delta);
        this.app.ticker.add(this.gameTicker);
        this.events.emit('GameLoaded', { slot: save ? this.saveSlot : 'new' });
        if (!save) this.requestSave('new', true);
    }

    // ------------------------------------------------------------- saving
    async requestSave(reason, force = false) {
        if (!this.store || !this.state.player || this.state.gameOver) return;
        const now = performance.now();
        if (!force && now - this.lastSaveAt < 3000) return;
        this.lastSaveAt = now;
        try {
            await this.store.save(this.saveSlot, buildSave(this));
            this.events.emit('GameSaved', { slot: this.saveSlot });
            if (reason !== 'auto' && reason !== 'hidden' && reason !== 'new') this.ui.toast('Game saved');
        } catch (err) {
            console.warn('save failed', err);
            this.ui.toast('Saving failed');
        }
    }

    // reveal the map around the player (called whenever they enter a new tile)
    updateFog() {
        const p = this.state.player;
        const tx = Math.floor(p.wx / T), ty = Math.floor(p.wy / T);
        if (tx === this.lastFogTx && ty === this.lastFogTy) return;
        this.lastFogTx = tx; this.lastFogTy = ty;
        if (this.mode === 'overworld') this.fog.revealCircle(tx, ty, 17);
        else this.interiorFog.revealCircle(tx, ty, 9);
    }

    syncMap() {
        const fog = this.mode === 'overworld' ? this.fog : this.interiorFog;
        this.map.sync(fog, this.world, this.mode === 'overworld' ? this.popRuntime.population : null, this.session);
    }

    setAmbient(amount) {
        this.ambient = amount;
        this.darkSprite.visible = amount > 0.01;
        this.darkSprite.alpha = Math.min(0.95, amount);
    }

    toggleMap() {
        if (!this.state.player || this.busy) return;
        this.ui.toggleMap(this);
    }

    // ------------------------------------------------------------ game loop
    // The simulation advances in fixed 1/60 s steps; rendering simply follows the latest state.
    gameLoop(rawDelta) {
        this.accum = Math.min(this.accum + rawDelta * this.timeScale, 5 * this.timeScale);
        while (this.accum >= 1) {
            this.accum -= 1;
            this.step(1);
        }
    }

    step(rawDelta) {
        const s = this.state;
        if (s.gameOver) {
            this.fx.update(rawDelta);
            this.applyCamera();
            this.world.animate(rawDelta);
            this.ui.updateExtras(this, rawDelta);   // keeps the respawn fade running
            return;
        }
        // keep the fade animation running during scene changes
        if (this.busy) { this.ui.updateExtras(this, rawDelta); this.world.animate(rawDelta); return; }
        if (s.levelUp || s.paused) return;

        const delta = Math.min(rawDelta, 2.5);
        this.frame += delta;
        s.time += delta / 60;

        EntityManager.heroLevel = s.level;
        this.movePlayer(delta);
        this.updateFog();
        this.weapons.update(delta);
        this.updateEnemies(delta);
        this.hazards.update(delta);
        this.critters.update(delta);
        this.updateGems(delta);
        this.updateInteraction(delta);
        this.regen(delta);
        this.fx.update(delta);
        this.reap();
        this.syncVisuals(delta);
        this.updateCamera(delta);
        this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height);
        this.world.animate(delta);
        this.updateZone();
        this.syncMap();
        this.ui.update(this, delta);

        this.autosaveTimer -= delta;
        if (this.autosaveTimer <= 0) {
            this.autosaveTimer = 1800;
            if (this.mode === 'overworld') this.requestSave('auto');
        }

        if (s.health <= 0) this.showGameOver();
    }

    // -------------------------------------------------------------- player
    movePlayer(delta) {
        const { keys, player } = this.state;
        let dx = 0, dy = 0;
        if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
        if (keys.ArrowRight || keys.d || keys.D) dx += 1;
        if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
        if (keys.ArrowDown || keys.s || keys.S) dy += 1;

        const joy = this.ui.joystick;
        let analog = false;
        if (joy && joy.active) {
            dx = joy.position.x;
            dy = joy.position.y;
            analog = true;
        } else if (this.state.pointerDown && this.state.pointerPosition) {
            const p = this.state.pointerPosition;
            const tx = p.x - this.worldContainer.x;
            const ty = (p.y - this.worldContainer.y) / TILT;
            const ddx = tx - player.wx, ddy = ty - player.wy;
            const dist = Math.hypot(ddx, ddy);
            if (dist > 8) { dx = ddx / dist; dy = ddy / dist; }
        }

        const ox = player.wx, oy = player.wy;
        let moving = false;
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            if (!analog || len > 1) { dx /= len; dy /= len; }
            const inShallows = this.world.biomeAtPos(player.wx, player.wy) === BIOME.SHALLOW;
            let mul = inShallows ? 0.72 : 1;
            if (this.frame < player.slowUntil) mul *= 1 - player.slowAmt;
            const speed = this.state.playerSpeed * this.stats.speed * delta * mul;
            this.world.tryMove(player, dx * speed, dy * speed * 1.2, player.radius);
            moving = true;
            if (Math.abs(dx) > 0.15) player.facing = dx > 0 ? 1 : -1;
        }
        player.moving = moving;
        this.playerVel.x = (player.wx - ox) / Math.max(delta, 0.001);
        this.playerVel.y = (player.wy - oy) / Math.max(delta, 0.001);
    }

    slowPlayer(frames, amount) {
        const p = this.state.player;
        p.slowUntil = Math.max(p.slowUntil, this.frame + frames);
        p.slowAmt = amount;
    }

    regen(delta) {
        const s = this.state;
        if (this.stats.regen > 0 && s.health < s.maxHealth) {
            s.health = Math.min(s.maxHealth, s.health + (this.stats.regen / 60) * delta);
        }
    }

    // burst hits (dashes, slams, projectiles) grant a short grace period so stacked attacks stay fair
    hurtPlayer(amount, burst = false) {
        const s = this.state;
        if (this.godMode) return;
        if (burst) {
            if (this.frame < (this.invulnUntil || 0)) return;
            this.invulnUntil = this.frame + 18;
        }
        s.health -= amount * (1 - this.stats.armor);
        if (this.frame - (this.lastHurt || -99) > 12) {
            this.lastHurt = this.frame;
            this.ui.flashDamage();
            this.fx.addShake(3);
        }
    }

    updateCamera(delta) {
        const p = this.state.player;
        const t = 1 - Math.pow(0.001, delta / 60);
        this.cam.x += (p.wx - this.cam.x) * t;
        this.cam.y += (p.wy - this.cam.y) * t;
        this.applyCamera();
    }

    // ------------------------------------------------------------- enemies
    updateEnemies(delta) {
        const s = this.state;
        const p = s.player;
        // resident camps, lairs and a few roamers come to life near the player
        this.popRuntime.update(delta);

        this.hash.clear();
        const list = s.enemies;
        for (let i = 0; i < list.length; i++) if (!list[i].dead) this.hash.insert(list[i]);
        this.counts.lunging = 0;
        this.flow.update(p.wx, p.wy);

        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (e.dead) continue;
            updateEnemy(this, e, delta);
        }

        // clearing every monster of a place pays out once
        if (this.mode === 'interior' && this.interiorState && !this.interiorState.cleared && this.interiorHostiles > 0) {
            if (!list.some((e) => !e.dead && !e.minion)) {
                this.interiorState.cleared = true;
                this.ui.banner('PLACE CLEARED!', 0xffd84a);
                this.dropGem(p.wx + 30, p.wy + 20, 0, 'heart');
                for (let i = 0; i < 6; i++) this.dropGem(p.wx + (Math.random() - 0.5) * 120, p.wy + 40 + Math.random() * 40, 12 + this.zoneLevelNow * 2);
            }
        }
    }

    spawnPoint(flying) {
        const p = this.state.player;
        const rx = this.app.screen.width / 2 + 90;
        const ry = this.app.screen.height / 2 / TILT + 90;
        for (let tries = 0; tries < 8; tries++) {
            const a = Math.random() * Math.PI * 2;
            const c = Math.cos(a), sn = Math.sin(a);
            const d = 1 / Math.max(Math.abs(c) / rx, Math.abs(sn) / ry) + Math.random() * 60;
            const x = p.wx + c * d, y = p.wy + sn * d;
            if (flying || !this.world.blocked(x, y, 24)) return { x, y };
        }
        return null;
    }

    // Enemy strength comes from the monster's own level (its zone), never from the hero.
    makeEnemy(key, x, y, opts = {}) {
        const type = ENEMY_TYPES[key];
        const level = Math.max(1, Math.round(opts.level ?? 1));
        const e = EntityManager.createEnemy(key, x, y);
        e.uid = ++this.uidCounter;
        e.level = level;
        e.tier = tierOf(level);
        const prefix = tierName(e.tier);
        e.bossName = `${prefix ? prefix + ' ' : ''}${type.name}`.toUpperCase();
        e.health = e.maxHealth = type.health * enemyHealthScale(level);
        e.speed = type.speed * enemySpeedScale(level);
        e.damage = type.damage * enemyDamageScale(level);
        e.experienceValue = Math.max(1, Math.round(type.experience * enemyXpScale(level)));
        if (opts.elite && !type.boss) {
            const m = SPAWN_CONFIG.eliteModifiers;
            EntityManager.markElite(e);
            e.health = e.maxHealth = e.health * m.health;
            e.experienceValue = Math.round(e.experienceValue * m.experience);
            e.speed *= m.speed;
            e.damage *= m.damage;
        }
        e.perc = perceptionOf(key);
        if (opts.home) {
            e.home = { x: opts.home.x, y: opts.home.y };
            e.leash = opts.leash || e.perc.leash;
            e.shell = 'idle';
            e.campId = opts.campId;
            e.roamer = !!opts.roamer;
            e.isLair = !!opts.lair;
        }
        if (opts.dormant) { e.dormant = true; e.aggro = opts.aggro || 420; }
        if (opts.minion) e.minion = true;
        this.objectLayer.addChild(e);
        EntityManager.place(e);
        this.state.enemies.push(e);
        return e;
    }

    spawnMinions(key, count, x, y, level = this.zoneLevelNow) {
        const type = ENEMY_TYPES[key];
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + Math.random();
            const r = 60 + Math.random() * 50;
            let px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
            if (!type.flying && this.world.blocked(px, py, type.radius)) { const f = this.world.findFree(px, py, type.radius); px = f.x; py = f.y; }
            const m = this.makeEnemy(key, px, py, { level, minion: true });
            m.experienceValue = Math.max(1, Math.floor(m.experienceValue * 0.5));
            engage(this, m, false);
        }
    }

    // test helper: summon the regional warlord next to the player
    spawnBoss() {
        const p = this.state.player;
        const group = this.world.groupAtPos(p.wx, p.wy);
        const key = WARLORDS[group] || WARLORDS.field;
        const type = ENEMY_TYPES[key];
        const pt = this.spawnPoint(false) || { x: p.wx + 700, y: p.wy };
        const e = this.makeEnemy(key, pt.x, pt.y, { level: this.zoneLevelNow + 2 });
        e.shell = 'engaged'; e.ai = null;
        this.ui.banner(`⚠  ${type.name.toUpperCase()} APPROACHES  ⚠`, 0xff5a5a);
        this.fx.addShake(6);
    }

    damageEnemy(e, amount, opts = {}) {
        if (e.dead || e.untargetable) return;
        const crit = !opts.noCrit && Math.random() < this.stats.crit;
        const dmg = amount * (crit ? 2 : 1) * (1 - (e.armor || 0));
        e.health -= dmg;
        e.hitFlash = 6;
        this.fx.popup(e.wx, e.wy, Math.round(dmg), crit ? 0xffd84a : (opts.color || 0xffffff), crit ? 24 : 16, e.baseHeight + 8);

        const k = opts.knock;
        if (k) {
            const len = Math.hypot(k.x, k.y) || 1;
            const resist = e.isBoss ? 0.2 : e.radius > 22 ? 0.55 : 1;
            e.kvx += (k.x / len) * k.force * resist;
            e.kvy += (k.y / len) * k.force * resist;
        }
        // a sleeping or idle monster wakes up when hurt
        if (e.dormant) e.dormant = false;
        if (e.home && e.shell !== 'engaged') engage(this, e);
        if (e.health <= 0) this.killEnemy(e);
    }

    killEnemy(e) {
        if (e.dead) return;
        e.dead = true;
        const s = this.state;
        const type = ENEMY_TYPES[e.type];
        s.kills++;
        s.score += e.experienceValue * 2;
        this.fx.death(e.wx, e.wy, type.color, e.isBoss);

        if (type.onDeath) this.spawnMinions(type.onDeath.spawn, type.onDeath.count, e.wx, e.wy, e.level);
        this.events.emit('EnemyKilled', { type: e.type, level: e.level, x: e.wx, y: e.wy, boss: !!e.isBoss });
        this.popRuntime.onKill(e);

        if (e.isBoss) {
            s.bossesDefeated++;
            for (let i = 0; i < 10; i++) {
                this.dropGem(e.wx + (Math.random() - 0.5) * 120, e.wy + (Math.random() - 0.5) * 90, Math.ceil(e.experienceValue / 6));
            }
            this.dropGem(e.wx, e.wy + 20, 0, 'heart');
            this.dropGem(e.wx + 30, e.wy, 0, 'heart');
            this.fx.addShake(12);
            this.ui.banner(`${type.name.toUpperCase()} DEFEATED!`, 0xffd84a);
            this.requestSave('boss', true);
        } else {
            this.dropGem(e.wx, e.wy, e.experienceValue);
            if (Math.random() < (e.elite ? 0.12 : 0.025)) this.dropGem(e.wx + 14, e.wy + 6, 0, 'heart');
        }
    }

    dropGem(x, y, value, kind = 'gem') {
        const s = this.state;
        if (s.gems.length > 260) {
            const old = s.gems.shift();
            if (old.kind === 'gem') this.gainExp(old.value);
            EntityManager.cleanup(old);
        }
        const gem = EntityManager.createGem(x, y, value, kind);
        gem.vel = 0;
        this.objectLayer.addChild(gem);
        EntityManager.place(gem);
        s.gems.push(gem);
    }

    reap() {
        const s = this.state;
        if (!s.enemies.some((e) => e.dead)) return;
        s.enemies = s.enemies.filter((e) => {
            if (!e.dead) return true;
            EntityManager.cleanup(e);
            return false;
        });
    }

    // ------------------------------------------------- zones & places of interest
    updateZone() {
        if ((this.frame | 0) % 20 !== 0) return;
        if (this.mode !== 'overworld') return;
        const p = this.state.player;
        const tx = Math.floor(p.wx / T), ty = Math.floor(p.wy / T);
        const group = this.world.groupAtPos(p.wx, p.wy);
        const level = this.overworld.levelAt(tx, ty);
        const tier = tierOf(level);
        const info = GROUP_INFO[group];
        this.zoneLevelNow = level;
        this.zoneThreat = threatBand(level, this.state.level);
        this.zoneLabel = `${info.icon} ${info.name} · Lv ${level}`;
        if (group !== this.zoneGroup) {
            this.zoneGroup = group;
            const prefix = tierName(tier);
            if (this.frame > 30) this.ui.showZone(`${prefix ? prefix + ' ' : ''}${info.name}  ·  Lv ${level}`, info.icon, info.color);
            this.events.emit('ZoneChanged', { group, level, tier });
        }
    }

    updateInteraction() {
        const p = this.state.player;
        let target = null;

        if (this.mode === 'overworld') {
            const poi = this.world.nearestPoi(p.wx, p.wy, 72);
            if (poi) target = { kind: 'enter', poi, text: `[E]  Enter ${poi.name}` };
        } else {
            let best = Infinity;
            const consider = (t, x, y, r) => {
                const d = Math.hypot(p.wx - x, p.wy - y);
                if (d < r && d < best) { best = d; target = t; }
            };
            for (const it of this.interactables) {
                if (it.kind === 'chest' && !it.opened) consider({ kind: 'chest', it, text: '[E]  Open treasure' }, it.x, it.y, 64);
            }
            const src = this.interior;
            if (src.fountain) consider({ kind: 'fountain', text: this.fountainReady() ? '[E]  Drink from the fountain' : 'The fountain is recharging…' }, src.fountain.x, src.fountain.y + 20, 96);
            if (src.altar) consider({ kind: 'altar', text: this.interiorState.altarUsed ? 'The altar is quiet' : '[E]  Pray at the altar' }, src.altar.x, src.altar.y + 20, 80);
            consider({ kind: 'exit', text: `[E]  Leave ${this.interiorName}` }, src.exit.x, src.exit.y, 74);
        }
        this.target = target;
        this.ui.setPrompt(target ? target.text : null);
    }

    fountainReady() {
        return this.frame - (this.interiorState.fountainAt || -99999) > 1500;
    }

    interact() {
        const t = this.target;
        const s = this.state;
        if (!t || this.busy || s.levelUp || s.paused || s.gameOver) return;
        switch (t.kind) {
            case 'enter': this.enterPlace(t.poi); break;
            case 'exit': this.exitPlace(); break;
            case 'chest': this.openChest(t.it); break;
            case 'fountain':
                if (this.fountainReady()) {
                    this.interiorState.fountainAt = this.frame;
                    s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.6);
                    const f = this.interior.fountain;
                    this.fx.popup(s.player.wx, s.player.wy, 'Refreshed!', 0x7ad0ff, 20, 70);
                    this.fx.burst(f.x, f.y, 40, 0x9adfff, 26, 2.6, { size: 0.7, life: 34, up: 3.4 });
                }
                break;
            case 'altar':
                if (!this.interiorState.altarUsed) {
                    this.interiorState.altarUsed = true;
                    this.fx.burst(this.interior.altar.x, this.interior.altar.y, 50, 0xc8a0ff, 30, 2.6, { size: 0.8, life: 40, up: 3.6 });
                    this.openTreasure(1, 'BLESSING', 'The altar grants you a gift');
                }
                break;
        }
    }

    enterPlace(poi) {
        if (this.busy) return;
        this.busy = true;
        this.state.pointerDown = false;
        this.state.keys = {};
        this.ui.fade(1, 0.09, () => {
            const s = this.state;
            const p = s.player;
            // gems on the ground are banked so nothing is lost
            let banked = 0;
            s.gems.forEach((g) => { if (g.kind === 'gem') banked += g.value; });
            this.clearWorldEntities();
            this.popRuntime.clearActive();
            s.experience += banked * this.stats.growth;

            const src = createInterior(poi);
            this.interior = src;
            this.interiorPoi = poi;
            this.interiorName = poi.name;
            this.visited[poi.id] = this.visited[poi.id] || { opened: [], cleared: false, altarUsed: false };
            this.interiorState = this.visited[poi.id];
            // visited towns become respawn points
            if (poi.type === 'city' && !this.session.cities.some((c) => c.id === poi.id)) {
                this.session.cities.push({ id: poi.id, name: poi.name, ex: poi.ex, ey: poi.ey });
            }
            this.events.emit('PlaceEntered', { id: poi.id, name: poi.name, kind: poi.type });

            this.world.setSource(src);
            this.interiorFog = new FogOfWar();
            this.lastFogTx = null;
            this.map.setMode('interior');
            this.mode = 'interior';
            this.flow.centerTx = NaN;
            this.setAmbient(src.ambient);

            const spot = this.world.findFree(src.start.x, src.start.y, p.radius + 2);
            p.wx = spot.x; p.wy = spot.y;
            this.cam.x = p.wx; this.cam.y = p.wy;
            this.populateInterior(src, poi);
            this.zoneLabel = `${POI_INFO[poi.type].icon} ${poi.name}`;
            this.ui.showZone(poi.name, POI_INFO[poi.type].icon, GROUP_INFO[poi.type].color);

            this.applyCamera();
            this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height, true);
            this.requestSave('place', true);
            this.ui.fade(0, 0.06, () => { this.busy = false; this.checkLevelUp(); });
        });
    }

    populateInterior(src, poi) {
        const st = this.interiorState;
        this.interiorHostiles = 0;
        if (!st.cleared) {
            src.spawns.forEach((sp) => {
                const type = ENEMY_TYPES[sp.type];
                let x = sp.x, y = sp.y;
                if (!type.flying && this.world.blocked(x, y, type.radius)) { const f = this.world.findFree(x, y, type.radius); x = f.x; y = f.y; }
                this.makeEnemy(sp.type, x, y, { dormant: true, aggro: 380, elite: !!sp.elite, level: Math.max(1, this.overworld.levelAt(poi.tx, poi.ty)) });
                this.interiorHostiles++;
            });
        }
        src.chests.forEach((c, i) => {
            const set = this.world.decorTextures.chest;
            const opened = st.opened.includes(i);
            const sprite = new PIXI.Sprite(set[opened ? 1 : 0].texture);
            sprite.anchor.set(0.5, set[0].anchorY);
            sprite.position.set(c.x, c.y * TILT);
            sprite.zIndex = c.y;
            if (c.big) sprite.scale.set(1.35);
            this.objectLayer.addChild(sprite);
            this.interactables.push({ kind: 'chest', x: c.x, y: c.y, idx: i, big: !!c.big, opened, sprite });
            if (!opened) this.map.markers.push({ tx: c.x / T, ty: c.y / T, icon: '🎁' });
        });
        this.map.markers.push({ tx: src.exit.x / T, ty: src.exit.y / T, icon: '🚪' });
        src.npcs.forEach((n) => this.critters.spawnVillager(n.x, n.y, n.hue));
    }

    openChest(it) {
        if (it.opened) return;
        it.opened = true;
        this.interiorState.opened.push(it.idx);
        const set = this.world.decorTextures.chest;
        it.sprite.texture = set[1].texture;
        this.fx.burst(it.x, it.y, 28, 0xffd84a, 30, 3.2, { size: 0.9, life: 40, up: 4.2 });
        this.map.markers = this.map.markers.filter((m) => Math.abs(m.tx - it.x / T) > 0.01 || m.icon !== '🎁');
        this.map.dirty = true;
        this.openTreasure(it.big ? 2 : 1, 'TREASURE!', it.big ? 'A great hoard! Pick two rewards' : 'Choose a reward');
    }

    // free upgrade picks (chests and altars) -- they do not cost a level
    openTreasure(picks, title, subtitle) {
        const s = this.state;
        s.levelUp = true;
        s.pointerDown = false;
        s.keys = {};
        const offer = (n) => {
            const choices = generateChoices(this, 3, { rarityBoost: picks > 1 ? 2 : 1 });
            this.ui.showLevelUp(choices, 0, (choice) => {
                this.applyUpgrade(choice);
                if (n > 1) offer(n - 1);
                else { s.levelUp = false; this.ui.shown.slots = ''; this.checkLevelUp(); }
            }, { title, subtitle: n > 1 ? subtitle : (picks > 1 ? 'Pick your second reward' : subtitle) });
        };
        offer(picks);
    }

    // Switch the world back to the overworld and put the hero at (x, y).
    applyOverworld(x, y) {
        const s = this.state;
        const p = s.player;
        this.clearWorldEntities();
        this.popRuntime.clearActive();
        this.world.setSource(this.overworld);
        this.map.setMode('overworld');
        this.mode = 'overworld';
        this.interior = null;
        this.interiorPoi = null;
        this.flow.centerTx = NaN;
        this.setAmbient(0);
        this.zoneGroup = null;
        this.lastFogTx = null;
        const spot = this.world.findFree(x, y, p.radius + 2);
        p.wx = spot.x; p.wy = spot.y;
        this.cam.x = p.wx; this.cam.y = p.wy;
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height, true);
        this.updateFog();
        this.map.dirty = true;
    }

    exitPlace() {
        if (this.busy) return;
        this.busy = true;
        this.state.pointerDown = false;
        this.state.keys = {};
        this.ui.fade(1, 0.09, () => {
            const s = this.state;
            let banked = 0;
            s.gems.forEach((g) => { if (g.kind === 'gem') banked += g.value; });
            s.experience += banked * this.stats.growth;
            const poi = this.interiorPoi;
            this.events.emit('PlaceLeft', { id: poi.id });
            this.applyOverworld(poi.ex, poi.ey + 34);
            this.requestSave('place', true);
            this.ui.fade(0, 0.06, () => {
                this.busy = false;
                this.checkLevelUp();
            });
        });
    }

    // ---------------------------------------------------------------- gems
    updateGems(delta) {
        const s = this.state;
        const p = s.player;
        const magnet = 95 * this.stats.magnet;
        for (let i = s.gems.length - 1; i >= 0; i--) {
            const g = s.gems[i];
            const dx = p.wx - g.wx, dy = p.wy - g.wy;
            const dist = Math.hypot(dx, dy) || 1;

            if (dist < magnet) g.magnetized = true;
            if (g.magnetized) {
                g.vel = Math.min(14, g.vel + 0.6 * delta);
                const step = Math.min(dist, (g.vel + 2) * delta);
                g.wx += (dx / dist) * step;
                g.wy += (dy / dist) * step;
            }

            if (dist < 20) {
                if (g.kind === 'heart') {
                    const heal = s.maxHealth * 0.25;
                    s.health = Math.min(s.maxHealth, s.health + heal);
                    this.fx.popup(p.wx, p.wy, `+${Math.round(heal)}`, 0xff7a94, 20, 60);
                    this.fx.burst(p.wx, p.wy, 20, 0xff6a8a, 12, 2.4, { size: 0.7 });
                } else {
                    this.gainExp(g.value);
                    this.fx.burst(g.wx, g.wy, 12, EntityManager.gemTier(g.value).color, 4, 1.8, { size: 0.5, life: 16 });
                }
                EntityManager.cleanup(g);
                s.gems.splice(i, 1);
            }
        }
    }

    gainExp(value) {
        const s = this.state;
        s.experience += value * this.stats.growth;
        this.checkLevelUp();
    }

    // ---------------------------------------------------- levelling & upgrades
    checkLevelUp() {
        const s = this.state;
        if (s.levelUp || s.gameOver || s.experience < s.nextLevel) return;
        s.levelUp = true;
        s.pointerDown = false;
        s.keys = {};
        const choices = generateChoices(this, 3);
        this.fx.burst(s.player.wx, s.player.wy, 20, 0xffe27a, 26, 4, { size: 0.9, life: 40, up: 4 });
        this.ui.showLevelUp(choices, s.level + 1, (choice) => this.applyChoice(choice));
    }

    applyUpgrade(choice) {
        const s = this.state;
        switch (choice.kind) {
            case 'weapon':
                this.weapons.acquire(choice.id);
                break;
            case 'passive':
                s.passives[choice.id] = choice.toLevel;
                this.recalcStats();
                break;
            case 'heal':
                s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.5);
                break;
        }
        this.ui.shown.slots = '';
    }

    applyChoice(choice) {
        const s = this.state;
        this.applyUpgrade(choice);

        s.experience = Math.max(0, s.experience - s.nextLevel);
        s.level++;
        s.nextLevel = xpForLevel(s.level);
        s.levelUp = false;
        s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.1);
        this.ui.displayXp = s.experience;

        // Level-up shockwave gives breathing room
        const p = s.player;
        for (const e of s.enemies) {
            const dx = e.wx - p.wx, dy = e.wy - p.wy;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 260) { e.kvx += (dx / d) * 10; e.kvy += (dy / d) * 10; }
        }
        this.fx.burst(p.wx, p.wy, 10, 0xffe27a, 30, 5, { size: 0.9, life: 34, up: 3 });
        this.fx.addShake(5);

        this.events.emit('HeroLevelUp', { level: s.level });
        this.requestSave('level', true);
        this.checkLevelUp();
    }

    recalcStats() {
        const s = this.state;
        const old = this.stats;
        this.stats = computeStats(s.passives);
        s.maxHealth = this.stats.maxHealth;
        if (this.stats.maxHealth > old.maxHealth) s.health += this.stats.maxHealth - old.maxHealth;
        s.health = Math.min(s.health, s.maxHealth);
    }

    // ------------------------------------------------------------- visuals
    syncVisuals(delta) {
        const s = this.state;
        const p = s.player;
        EntityManager.place(p);
        EntityManager.animatePlayer(p, this.frame, p.moving, p.facing);

        for (const e of s.enemies) {
            if (e.dead) continue;
            EntityManager.place(e);
            EntityManager.animateEnemy(e, this.frame);
            if (e.elite) e.marker.alpha = 0.6 + Math.sin(this.frame * 0.15) * 0.4;
        }
        for (const g of s.gems) {
            EntityManager.place(g);
            EntityManager.animateGem(g, this.frame);
        }
    }

    // ------------------------------------------------------------ game over
    // The whole party is down. The world persists: respawn at the nearest visited town, or the start.
    respawnTarget() {
        const p = this.state.player;
        const from = this.mode === 'interior' && this.interiorPoi ? { x: this.interiorPoi.ex, y: this.interiorPoi.ey } : { x: p.wx, y: p.wy };
        let best = null, bd = Infinity;
        for (const c of this.session.cities) {
            const d = Math.hypot(c.ex - from.x, c.ey - from.y);
            if (d < bd) { bd = d; best = c; }
        }
        return best ? { x: best.ex, y: best.ey + 40, label: best.name } : { x: 0, y: 0, label: 'the starting area' };
    }

    respawn(target) {
        const s = this.state;
        this.ui.fade(1, 0.1, () => {
            s.gameOver = false;
            s.health = s.maxHealth;
            s.player.visible = true;
            s.pointerDown = false;
            this.applyOverworld(target.x, target.y);
            this.map.dirty = true;
            this.invulnUntil = this.frame + 120;
            this.ui.fade(0, 0.06, () => {});
            this.requestSave('respawn', true);
        });
    }

    showGameOver() {
        const s = this.state;
        if (s.gameOver) return;
        s.gameOver = true;
        s.health = 0;
        s.pointerDown = false;
        this.ui.update(this, 1);
        this.fx.death(s.player.wx, s.player.wy, 0x6aa8ff, true);
        s.player.visible = false;
        this.events.emit('HeroDied', { respawnAt: this.respawnTarget().label });

        const { app } = this;
        const screen = new PIXI.Container();
        screen.zIndex = 3000;
        screen.eventMode = 'static';
        screen.alpha = 0;
        app.stage.addChild(screen);

        const dim = new PIXI.Graphics();
        const title = new PIXI.Text('YOU FELL', {
            fontFamily: FONT, fontSize: 76, fontWeight: 'bold', fill: ['#ff6a6a', '#a10d0d'],
            stroke: 0x1a0000, strokeThickness: 8, dropShadow: true, dropShadowDistance: 6, dropShadowAlpha: 0.6, letterSpacing: 4
        });
        title.anchor.set(0.5);

        const panel = new PIXI.Container();
        const pbg = new PIXI.Graphics();
        pbg.beginFill(0x0c1120, 0.85);
        pbg.lineStyle(2, 0xffffff, 0.2);
        pbg.drawRoundedRect(-190, -95, 380, 190, 16);
        pbg.endFill();
        const rows = [
            ['Time played', this.formatTime(s.time)],
            ['Hero level', `${s.level}`],
            ['Enemies defeated', `${s.kills}`],
            ['Zone level', `${this.zoneLevelNow}`]
        ];
        panel.addChild(pbg);
        rows.forEach(([k, v], i) => {
            const y = -66 + i * 43;
            const kt = new PIXI.Text(k, { fontFamily: FONT, fontSize: 19, fill: 0xa9b3cc });
            kt.position.set(-160, y - 12);
            const vt = new PIXI.Text(v, { fontFamily: FONT, fontSize: 24, fontWeight: 'bold', fill: 0xffffff });
            vt.anchor.set(1, 0);
            vt.position.set(160, y - 15);
            panel.addChild(kt, vt);
        });

        const target = this.respawnTarget();
        const green = { base: 0x3fcf6a, hover: 0x5fe28a, text: 0x0b2a14 };
        const blue = { base: 0x4a7fe0, hover: 0x6a9aff, text: 0x061233 };
        const respawnBtn = this.makeMenuButton(`RESPAWN AT ${target.label.toUpperCase()}`, green, 420);
        const newBtn = this.makeMenuButton('NEW GAME', blue, 420);
        const hint = new PIXI.Text('Your progress, the map and cleared places are kept.', { fontFamily: FONT, fontSize: 14, fill: 0xb8c4e0 });
        hint.anchor.set(0.5);
        screen.addChild(dim, title, panel, respawnBtn, hint, newBtn);

        const layout = () => {
            const w = app.screen.width, h = app.screen.height;
            dim.clear();
            dim.beginFill(0x120404, 0.72);
            dim.drawRect(0, 0, w, h);
            dim.endFill();
            const sc = clamp(w / 800, 0.55, 1);
            title.scale.set(sc);
            title.position.set(w / 2, h * 0.17);
            panel.position.set(w / 2, h * 0.42);
            respawnBtn.position.set(w / 2, h * 0.42 + 150);
            hint.position.set(w / 2, h * 0.42 + 190);
            newBtn.position.set(w / 2, h * 0.42 + 240);
        };
        layout();
        window.addEventListener('resize', layout);

        const fade = (d) => {
            screen.alpha = Math.min(1, screen.alpha + 0.04 * d);
            if (screen.alpha >= 1) app.ticker.remove(fade);
        };
        app.ticker.add(fade);

        let done = false;
        let confirmNew = false;
        const close = () => {
            done = true;
            app.ticker.remove(fade);
            window.removeEventListener('resize', layout);
            window.removeEventListener('keydown', onKey);
            app.stage.removeChild(screen);
            screen.destroy({ children: true });
        };
        const doRespawn = () => {
            if (done || screen.alpha < 0.6) return;
            close();
            this.respawn(target);
        };
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') doRespawn(); };
        window.addEventListener('keydown', onKey);
        respawnBtn.on('pointerdown', (e) => { e.stopPropagation(); doRespawn(); });
        newBtn.on('pointerdown', (e) => {
            e.stopPropagation();
            if (done || screen.alpha < 0.6) return;
            if (!confirmNew) {
                confirmNew = true;
                newBtn.label.text = 'THIS ERASES YOUR SAVE - CLICK TO CONFIRM';
                setTimeout(() => { confirmNew = false; if (!done) newBtn.label.text = 'NEW GAME'; }, 3500);
                return;
            }
            close();
            this.state.gameOver = false;
            this.init(null);
        });
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
}

export function startGame() {
    const game = new Game();
    // exposed for debugging and the in-page test tools
    (window as any).game = game;
    installDevTools(game);
    return game;
}
