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
import { Occlusion } from '../render/occlusion';
import { PartAtlas } from '../render/atlas';
import { Lighting } from '../render/lighting';
import { Ambience } from '../render/ambience';
import { SpellSystem } from './spells';
import { PartyRuntime } from './party';
import { SurfaceSystem } from './surfaces';
import { SitesRuntime } from './sites';
import { TowerSystem } from './towers';
import { SeaSystem } from './sea';
import { BOAT_SPEED, TOWER_DEFS } from '../core/world/towers';
import { NODES, isNode, nodeId, rollYield } from '../core/economy/gather';
import { CARDS, computeStats, offerCards, dominantPath } from '../core/hero/stats';
import { rollSkillDrop, TEMPLATES, RUNES } from '../core/spells/spells';
import { rollKillLoot, filteredOut, runeValue, spellValue, emptyWallet, dungeonAffinity, dungeonPower } from '../core/loot/loot';
import { STOCK_EPOCH_SECONDS, epochOf, innCost, rumorFor, stockFor } from '../core/economy/shop';
import { createBoard, createNpc } from '../render/npcArt';
import { AudioManager } from './audio';
import { pickTrack } from '../core/audio/music';
import { STEP_SOUND, STRIDE, ambientFor, footstepFor } from '../core/audio/ambience';
import { mountUi } from '../ui/mount';
import { ui as uiBridge } from '../ui/bridge';
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
import { randomSeed, seedFromText } from '../core/sim/rng';
import {
    enemyDamageScale, enemyHealthScale, enemySpeedScale, enemyXpScale, threatBand, tierName, tierOf
} from '../core/world/difficulty';
import { createSaveStore } from '../core/save/store';
import { buildSave, captureThumb } from './saveManager';
import { PopulationRuntime } from './populationRuntime';
import { perceptionOf } from '../core/config';
import { engage } from '../core/ai/ai';
import { installDevTools } from './devtools';
import { InputSystem } from './input';
import { DungeonSystem } from './dungeons';
import { QuestSystem } from './quests';
import { TipSystem } from './tips';
import { TrainingDummy } from './dummy';
import { StoryDirector } from './story';
import { VaultSystem } from './vaults';
import { isTyping } from '../ui/nav';
import { normKey } from '../core/input/bindings';
import { pickClicked } from '../core/input/pick';
import { access, applyAccess, loadAccess } from './access';
import { cameraLead, hitStopFrames } from '../core/sim/feel';
import { PerfOverlay } from './perfOverlay';
import { quickGlyph } from '../ui/hints';

const TILT = WORLD_CONFIG.tilt;
const T = WORLD_CONFIG.tile;
import { FONT_UI as FONT, FONT_DISPLAY as SERIF } from '../ui/fonts';
import { settings, loadSettings, applySettings, setSettings } from './settings';
import { showDamageNumber } from '../core/settings/settings';
import { formatPlayTime, listSlots, newestSlot, shouldRotate, slotLabel, writeSlot } from '../core/save/slots';
import { discover, emptyCodex } from '../core/codex/codex';
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
        // additive glows (sparks, embers) drawn together above the objects, so they batch instead of
        // switching blend modes between every sprite
        this.glowLayer = new PIXI.Container();
        this.worldContainer.addChild(this.groundLayer, this.objectLayer, this.glowLayer);
        EntityManager.atlas = new PartAtlas(this.app.renderer);
        this.app.stage.addChild(this.worldContainer);

        this.createAtmosphere();

        this.world = new World(this.app, this.groundLayer, this.objectLayer);
        this.occlusion = new Occlusion(this);
        this.fx = new Effects(this);
        this.spells = new SpellSystem(this);
        this.party = new PartyRuntime(this);
        this.surfaces = new SurfaceSystem(this);
        this.sites = new SitesRuntime(this);
        this.towers = new TowerSystem(this);
        this.sea = new SeaSystem(this);
        this.dungeons = new DungeonSystem(this);
        this.world.extraPois = (cx, cy) => this.dungeons.poisForChunk(cx, cy);   // plateau and island entrances
        this.floor = 0;
        this.boat = null;           // { dockId } while sailing
        this.pointerKind = 'mouse';
        this.audio = new AudioManager();
        this.lastMove = { x: 0, y: 0 };
        this.camLead = { x: 0, y: 0 };
        this.hitStop = 0;              // frames the action holds still after a heavy hit
        this.lastCritStop = -1e9;
        this.safeFor = 0;
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
        this.input = new InputSystem(this);
        loadAccess();
        applyAccess(this);
        this.perf = new PerfOverlay(this);
        loadSettings();
        applySettings(this);
        this.ui.game = this;
        mountUi(this);

        // persistent-world plumbing
        this.events = new EventBus();
        // statistics
        this.events.on('EnemyKilled', (e) => { const by = gameState.byType; by[e.type] = (by[e.type] || 0) + 1; });
        this.events.on('HeroDied', () => { gameState.deaths++; });
        this.codex = emptyCodex();
        this.events.on('EnemyKilled', (e) => this.codexFound('monsters', e.type));
        this.lastBackupAt = {};
        this.quests = new QuestSystem(this);
        this.tips = new TipSystem(this);
        this.dummy = new TrainingDummy(this);
        this.story = new StoryDirector(this);
        this.vaults = new VaultSystem(this);
        this.events.on('QuestCompleted', (e) => { if (e.id === 'm6_sovereign') this.story.queueEnding(); });
        this.session = { clearedCamps: {}, defeatedLairs: {}, cities: [], lastCity: null, claimed: {}, triggered: {}, gathered: [], shopSold: {}, boats: {}, caches: [] };
        this.gemStash = null;
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

        this.app.renderer.on('resize', () => this.handleResize());     // after Pixi's own (deferred) resize
        const flush = () => { if (this.state.player && !this.state.gameOver && this.mode) this.requestSave('hidden', true); };
        document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
        window.addEventListener('pagehide', flush);

        this.world.setSource(new OverworldSource(randomSeed()));
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.viewW, this.viewH, true);

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
        this.lighting = new Lighting(this.app, this.app.stage);
        this.ambience = new Ambience(this.app, this.app.stage);
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
        this.lighting.resize();
    }

    handleResize() {
        this.layoutAtmosphere();
        // the world stays centred and its edges loaded even while the game is paused (step() does not run then)
        if (this.state.player) { this.applyCamera(); this.world.update(this.cam.x, this.cam.y, this.viewW, this.viewH, true); }
    }

    applyCamera() {
        const { width, height } = this.app.screen;
        const s = this.fx.shake;
        const sx = s ? (Math.random() - 0.5) * s : 0;
        const sy = s ? (Math.random() - 0.5) * s : 0;
        const z = this.zoom || 1;
        this.worldContainer.scale.set(z);
        this.worldContainer.x = Math.round(width / 2 - this.cam.x * z + sx);
        this.worldContainer.y = Math.round(height / 2 - this.cam.y * TILT * z + sy);
    }

    /** World position (ground plane) under a screen point. */
    screenToWorld(px, py) {
        const z = this.zoom || 1;
        return { x: (px - this.worldContainer.x) / z, y: (py - this.worldContainer.y) / z / TILT };
    }

    /** The screen size in world units, for loading chunks (larger when zoomed out). */
    get viewW() { return this.app.screen.width / (this.zoom || 1); }
    get viewH() { return this.app.screen.height / (this.zoom || 1); }

    menuLoop(delta) {
        this.input.poll();
        this.audio.music.setTrack('title');
        this.frame += delta;
        this.cam.x += 0.7 * delta;
        this.cam.y += Math.sin(this.frame * 0.004) * 0.5 * delta;
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.viewW, this.viewH);
        this.world.animate(delta);
    }

    // --------------------------------------------------------- start screen
    makeMenuButton(text, fill, width = 280) {
        const button = new PIXI.Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';
        const bg = new PIXI.Graphics();
        // a dark plate with a gold frame and a coloured inlay
        const draw = (hover) => {
            bg.clear();
            bg.beginFill(0x000000, 0.35); bg.drawRoundedRect(-width / 2 + 3, -25, width, 56, 12); bg.endFill();
            bg.beginFill(0x0e1220, 0.95);
            bg.lineStyle(2, hover ? 0xffe08a : 0xd9a440, 1);
            bg.drawRoundedRect(-width / 2, -28, width, 56, 12);
            bg.endFill();
            bg.lineStyle(0);
            bg.beginFill(hover ? fill.hover : fill.base, hover ? 0.95 : 0.78);
            bg.drawRoundedRect(-width / 2 + 5, -23, width - 10, 46, 9);
            bg.endFill();
            bg.beginFill(0xffffff, 0.18); bg.drawRoundedRect(-width / 2 + 8, -21, width - 16, 16, 7); bg.endFill();
            bg.beginFill(0x000000, 0.18); bg.drawRoundedRect(-width / 2 + 8, 6, width - 16, 14, 7); bg.endFill();
            bg.beginFill(0xf3c75a);
            bg.drawPolygon([-width / 2, -6, -width / 2 + 6, 0, -width / 2, 6, -width / 2 - 6, 0]);
            bg.drawPolygon([width / 2, -6, width / 2 + 6, 0, width / 2, 6, width / 2 - 6, 0]);
            bg.endFill();
        };
        draw(false);
        const label = new PIXI.Text(text, {
            fontFamily: SERIF, fontSize: 25, fontWeight: 'bold', fill: 0xffffff,
            letterSpacing: 3, stroke: 0x000000, strokeThickness: 3, dropShadow: true, dropShadowDistance: 2, dropShadowAlpha: 0.6
        });
        label.anchor.set(0.5);
        button.addChild(bg, label);
        const base = () => button.baseScale || 1;
        // a pointer resting over a button when the menu appears must not steal the keyboard highlight:
        // hovering counts once the pointer has really moved
        const hoverOn = () => {
            if (button.hovered || !this.input?.pointerLive) return;
            button.hovered = true;
            draw(true); button.scale.set(base() * 1.05);
            if (button.onHover) button.onHover();
        };
        button.on('pointerover', hoverOn);
        button.on('pointermove', hoverOn);
        button.on('pointerout', () => { button.hovered = false; draw(!!button.selected); button.scale.set(base() * (button.selected ? 1.05 : 1)); });
        // the keyboard and controller highlight a button the same way the mouse does
        button.setSelected = (v) => { button.selected = v; draw(v); button.scale.set(base() * (v ? 1.05 : 1)); };
        button.label = label;
        return button;
    }

    showStartScreen() {
        const { app } = this;
        const screen = new PIXI.Container();
        screen.zIndex = 3000;
        screen.eventMode = 'static';
        app.stage.addChild(screen);
        uiBridge.title.value = true;
        this.audio.music.setTrack('title');

        // dark at the top and bottom, the world still visible through the middle
        const gc = document.createElement('canvas');
        gc.width = 2; gc.height = 256;
        const gctx = gc.getContext('2d');
        const grad = gctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'rgba(4,6,12,0.88)');
        grad.addColorStop(0.45, 'rgba(4,6,12,0.55)');
        grad.addColorStop(0.62, 'rgba(4,6,12,0.45)');
        grad.addColorStop(1, 'rgba(4,6,12,0.88)');
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, 2, 256);
        const dim = new PIXI.Sprite(PIXI.Texture.from(gc));
        const title = new PIXI.Text('SURVIVAL', {
            fontFamily: SERIF, fontSize: 92, fontWeight: 'bold', fill: ['#fff8dc', '#f3c75a', '#b0731c'], fillGradientStops: [0, 0.55, 1],
            stroke: 0x2a1604, strokeThickness: 8, dropShadow: true, dropShadowColor: 0xffb44a, dropShadowBlur: 18,
            dropShadowDistance: 0, dropShadowAlpha: 0.55, letterSpacing: 10
        });
        title.anchor.set(0.5);
        const subtitle = new PIXI.Text('THREE HEROES  ·  ONE ENDLESS, DEMON-HAUNTED WORLD', {
            fontFamily: SERIF, fontSize: 15, fill: 0xf0e2b8, letterSpacing: 3, dropShadow: true, dropShadowDistance: 2, dropShadowAlpha: 0.8
        });
        subtitle.anchor.set(0.5);
        // ornamental divider
        const orn = new PIXI.Graphics();
        orn.lineStyle(2, 0xd9a440, 0.9);
        orn.moveTo(-190, 0); orn.lineTo(-14, 0); orn.moveTo(14, 0); orn.lineTo(190, 0);
        orn.lineStyle(0);
        orn.beginFill(0xf3c75a); orn.drawPolygon([0, -8, 9, 0, 0, 8, -9, 0]); orn.endFill();
        orn.beginFill(0xd9a440); orn.drawCircle(-196, 0, 3); orn.drawCircle(196, 0, 3); orn.endFill();
        const note = new PIXI.Text('', { fontFamily: FONT, fontSize: 14, fill: 0xffc98a, align: 'center' });
        note.anchor.set(0.5);

        const green = { base: 0x3fcf6a, hover: 0x5fe28a, text: 0x0b2a14 };
        const blue = { base: 0x4a7fe0, hover: 0x6a9aff, text: 0x061233 };
        const slate = { base: 0x3a4766, hover: 0x56658c, text: 0x0b1020 };
        const continueBtn = this.makeMenuButton('CONTINUE', green, 340);
        const newBtn = this.makeMenuButton('NEW GAME', blue, 340);
        const loadBtn = this.makeMenuButton('LOAD GAME', slate, 340);
        const optionsBtn = this.makeMenuButton('OPTIONS', slate, 340);
        const creditsBtn = this.makeMenuButton('CREDITS', slate, 340);
        const summary = new PIXI.Text('', { fontFamily: FONT, fontSize: 14, fill: 0xb8c4e0 });
        summary.anchor.set(0.5);
        continueBtn.visible = false;
        summary.visible = false;
        screen.addChild(dim, title, orn, subtitle, continueBtn, summary, newBtn, loadBtn, optionsBtn, creditsBtn, note);

        const layout = () => {
            const w = app.screen.width, h = app.screen.height;
            dim.width = w; dim.height = h;
            const s = clamp(Math.min(w / 900, h / 760), 0.5, 1);
            title.scale.set(s);
            title.position.set(w / 2, h * 0.17);
            orn.scale.set(s);
            orn.position.set(w / 2, h * 0.17 + 64 * s);
            subtitle.scale.set(clamp(w / 820, 0.6, 1) * Math.max(0.75, s));
            subtitle.position.set(w / 2, h * 0.17 + 92 * s);
            // the menu: Continue (with what it continues) on top, then the rest at an even step
            const bs = clamp(Math.min(w / 520, h / 720), 0.62, 1);
            const step = 64 * bs;
            let y = h * 0.17 + 140 * s;
            for (const b of [continueBtn, newBtn, loadBtn, optionsBtn, creditsBtn]) {
                if (!b.visible) continue;
                b.scale.set(b.selected ? bs * 1.05 : bs);
                b.baseScale = bs;
                b.position.set(w / 2, y);
                if (b === continueBtn) { summary.scale.set(bs); summary.position.set(w / 2, y + 40 * bs); y += 22 * bs; }
                y += step;
            }
            note.position.set(w / 2, h * 0.93);
        };
        layout();
        app.renderer.on('resize', layout);

        let started = false;
        let save = null;          // the newest readable save (Continue)
        let autosave = false;     // New Game overwrites the autosave: ask first
        let confirmNew = false;
        const begin = (data) => {
            if (started) return;
            started = true;
            this.titleBegin = null;
            uiBridge.title.value = false;
            uiBridge.optionsOpen.value = false;
            uiBridge.slotsOpen.value = null;
            uiBridge.creditsOpen.value = false;
            app.renderer.off('resize', layout);
            menuNav.remove();
            app.stage.removeChild(screen);
            screen.destroy({ children: true });
            this.bindEvents();
            this.init(data);
        };
        this.titleBegin = begin;
        const startNew = () => {
            if (autosave && !confirmNew) {
                confirmNew = true;
                newBtn.label.text = 'OVERWRITE AUTOSAVE?';
                setTimeout(() => { confirmNew = false; if (!started) newBtn.label.text = 'NEW GAME'; }, 3500);
                return;
            }
            const seedText = uiBridge.newGameSeed.value;
            this.pendingSeed = seedText ? seedFromText(seedText) : null;
            begin(null);
        };
        const items = [
            { btn: continueBtn, run: () => { if (save) begin(save); } },
            { btn: newBtn, run: startNew },
            { btn: loadBtn, run: () => (uiBridge.slotsOpen.value = 'load') },
            { btn: optionsBtn, run: () => (uiBridge.optionsOpen.value = true) },
            { btn: creditsBtn, run: () => (uiBridge.creditsOpen.value = true) }
        ];
        // arrows, W / S, the d-pad and the stick move the highlight; Enter, Space and A press it
        const menuNav = this.input.pushMenu({ items: () => items.filter((it) => it.btn.visible) });
        for (const it of items) {
            it.btn.onHover = () => menuNav.menu.select(it.btn);
            it.btn.on('pointerdown', (e) => { e.stopPropagation(); it.run(); });
        }

        // find the saves once the store is ready (titleReady: Continue is offered if there is a save; tests wait for it)
        this.titleReady = false;
        this.storeReady.then(async (store) => {
            if (!store.persistent) note.text = 'Progress cannot be saved in this environment (no browser storage available).';
            try {
                const slots = await listSlots(store);
                if (started) return;
                autosave = !!slots[0].data;
                const newest = newestSlot(slots);
                if (slots.some((x) => x.data === 'corrupt')) note.text = 'A saved game could not be read. Load Game lists its backups.';
                if (newest) {
                    save = newest.data;
                    const lead = save.party.heroes[save.party.active];
                    summary.text = [newest.label + (save.name ? `: ${save.name}` : ''), `Level ${lead.level}`, formatPlayTime(save.playSeconds), save.meta?.place || save.meta?.region].filter(Boolean).join('  ·  ');
                    continueBtn.visible = true;
                    summary.visible = true;
                    layout();
                    menuNav.menu.refresh();
                }
            } catch (err) {
                note.text = `Could not read the saved games (${err && err.message ? err.message : err}). You can start a new game.`;
            }
            this.titleReady = true;
        });

        // gentle idle animation
        const idle = () => {
            if (started) { app.ticker.remove(idle); return; }
            title.y = app.screen.height * 0.17 + Math.sin(this.frame * 0.03) * 4;
            // a panel opened from the menu (Options, Load Game, Credits) gets the stage: the menu fades back
            const panel = !!uiBridge.slotsOpen.value || uiBridge.optionsOpen.value || uiBridge.creditsOpen.value || uiBridge.rebindOpen.value;
            const a = panel ? 0.12 : 1;
            for (const c of screen.children) if (c !== dim) c.alpha += (a - c.alpha) * 0.25;
        };
        app.ticker.add(idle);
    }

    bindEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;
        window.addEventListener('keydown', (e) => {
            if (isTyping(e.target)) return;
            if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
            gameState.keys[normKey(e.key)] = true;
            this.audio.unlock();
            if (!gameState.player || gameState.gameOver) return;
            const act = this.input.keys.actionFor(e.key);
            if (uiBridge.worldMap.value) { if (act === 'map') this.toggleMap(); return; }
            if (act === 'skill1' && !e.repeat) this.spells.cast(0);
            else if (act === 'skill2' && !e.repeat) this.spells.cast(1);
            else if (act === 'skill3' && !e.repeat) this.spells.cast(2);
            else if (act === 'interact') this.interact();
            else if (act === 'map') this.toggleMap();
        });
        window.addEventListener('keyup', (e) => { gameState.keys[normKey(e.key)] = false; });
        window.addEventListener('blur', () => {
            gameState.keys = {};
            // leaving the window pauses the game (setting)
            if (settings.pauseOnBlur && gameState.player && !gameState.gameOver && !uiBridge.pauseOpen.value && !this.busy) this.ui.toggleSettings();
        });

        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;
        let hoverAt = 0;
        this.app.stage.on('pointermove', (e) => {
            this.pointerKind = e.pointerType || 'mouse';
            gameState.pointerPosition = { x: e.global.x, y: e.global.y };
            // the cursor turns into a hand over something that can be clicked (checked at most ten times a second)
            const now = performance.now();
            if (settings.mouseInteract && this.pointerKind === 'mouse' && now - hoverAt > 100 && gameState.player && !gameState.paused) {
                hoverAt = now;
                const at = this.screenToWorld(e.global.x, e.global.y);
                this.app.view.style.cursor = pickClicked(this.clickTargets(), at.x, at.y) ? 'pointer' : '';
            } else if (!settings.mouseInteract && this.app.view.style.cursor) this.app.view.style.cursor = '';
        });
        this.app.stage.on('pointerdown', (e) => {
            this.audio.unlock();
            this.pointerKind = e.pointerType || 'mouse';
            gameState.pointerPosition = { x: e.global.x, y: e.global.y };
            if (this.towers.build && !gameState.gameOver && !gameState.paused) { if (this.pointerKind === 'mouse') { this.towers.updateBuild(); this.towers.confirmBuild(); } return; }
            if (gameState.levelUp || gameState.gameOver || gameState.paused) return;
            gameState.pointerPosition = { x: e.global.x, y: e.global.y };
            // experimental: clicking something within reach uses it (as E would) and does not start a walk
            if (settings.mouseInteract && this.pointerKind === 'mouse' && !this.busy) {
                const at = this.screenToWorld(e.global.x, e.global.y);
                const t = pickClicked(this.clickTargets(), at.x, at.y);
                if (t) { this.target = t; this.interact(); return; }
            }
            // click to move: walk to the clicked spot; otherwise the hero follows the held pointer
            if (settings.clickToMove && this.pointerKind === 'mouse') { this.moveTarget = this.screenToWorld(e.global.x, e.global.y); return; }
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
        this.dummy.clear();
        s.gems = [];
        this.interactables.forEach((i) => { if (i.sprite) { this.objectLayer.removeChild(i.sprite); i.sprite.destroy(); } });
        this.interactables = [];
        this.critters.reset();
        this.hazards.reset();
        this.dungeons.clearFeatures();
        this.vaults.clear();
        this.spells.clearProjectiles();
        this.fx.clear();
        if (this.ambience) this.ambience.clear();
    }

    // everything drawn on top of the overworld that must go when the world is swapped (towns, caves) or rebuilt
    clearOverworldDisplays() {
        this.sites.clearDisplays();
        this.surfaces.reset();
        this.towers.cancelBuild();
        this.towers.clearDisplays();
        this.sea.reset();
        this.dungeons.reset();
        this.closeNpcPanels();
        uiBridge.towerPanel.value = null;
        uiBridge.waypointOpen.value = null;
        uiBridge.buildMenuOpen.value = false;
    }

    clearEntities() {
        const s = this.state;
        this.clearWorldEntities();
        if (s.player) EntityManager.cleanup(s.player);
        this.spells.reset();
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
        this.zoneIcon = '';
        this.moveTarget = null;
        this.regionId = null;
        this.regionsSeen = new Set(save && save.regions ? save.regions : []);
        this.codex = save && save.codex ? { monsters: [...save.codex.monsters], spells: [...save.codex.spells], runes: [...save.codex.runes] } : emptyCodex();
        this.interior = null;
        this.interiorPoi = null;
        this.autosaveTimer = 1800;
        this.createdAt = save ? save.createdAt : Date.now();
        this.lastFogTx = null;
        this.lastFogTy = null;

        this.app.ticker.remove(this.menuTicker);
        if (this.gameTicker) this.app.ticker.remove(this.gameTicker);

        // the world: seed + saved deltas
        this.overworld = new OverworldSource(save ? save.seed : (window.__forceSeed ?? this.pendingSeed ?? randomSeed()));
        this.pendingSeed = null;
        this.world.setSource(this.overworld);
        this.world.onChunk = null;
        this.session = { clearedCamps: {}, defeatedLairs: {}, cities: [], lastCity: null, claimed: {}, triggered: {}, gathered: [], shopSold: {}, boats: {}, caches: [] };
        this.gemStash = null;
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
        this.world.removed = new Set(this.session.gathered);
        this.world.setSource(this.overworld);   // regenerate chunks without harvested nodes
        this.popRuntime.reset(this.overworld);
        this.sites.reset(this.overworld);
        this.map.reset();
        this.map.setMode('overworld');
        this.map.lairDefeated = (id) => this.session.defeatedLairs[id] !== undefined;
        // badges on the map: towns once visited, caves, ruins and dungeons once everything in them is done
        this.map.placeBadge = (p) => (p.type === 'city' ? (this.session.cities.some((c) => c.id === p.id) ? 'visited' : null) : (this.visited[p.id] && this.visited[p.id].complete ? 'cleared' : null));
        this.map.extras = () => {
            const out = [];
            for (const r of this.towers.recs) out.push({ tx: r.tx, ty: r.ty, icon: r.built ? TOWER_DEFS[r.kind].icon : 'site', label: r.built ? '' : 'Site', color: '#ffd070' });
            for (const c of this.sea.known.values()) if (!this.sea.isOpened(c.id) && this.fog.isRevealed(c.tx, c.ty)) out.push({ tx: c.tx, ty: c.ty, icon: 'x-mark', label: 'Treasure', color: '#ffd84a' });
            for (const l of this.sea.krakensSeen.values()) if (!this.sea.krakenDefeated(l.id)) out.push({ tx: l.tx, ty: l.ty, icon: 'kraken', label: 'Kraken', color: '#ff7a9a' });
            for (const m of this.quests.markers()) out.push(m);
            return out;
        };
        this.map.regions = () => [...this.regionsSeen].map((id) => {
            const r = this.overworld.region(id);
            return { tx: r.tx, ty: r.ty, name: r.name, title: r.title, capital: r.capital ? r.capital.name : null };
        });
        this.map.siteState = (id) => (this.session.claimed[id] !== undefined || this.session.triggered[id] !== undefined ? 'done' : 'open');
        this.map.sitesFor = (cx, cy) => this.sites.sites ? this.sites.sites.near(cx * 12 + 6, cy * 12 + 6, 10) : [];
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

        gameState.maxHealth = 100;
        this.stats = computeStats({});
        this.party.init(save);
        // the codex knows every spell and rune the party carries (starting spells, and saves made before the codex)
        for (const sp of this.spells.spells) { discover(this.codex.spells, sp.tpl); for (const r of sp.runes) if (r) discover(this.codex.runes, r); }
        for (const r of this.spells.runes) discover(this.codex.runes, r);
        if (save) {
            gameState.kills = save.stats.kills;
            gameState.score = save.stats.score;
            gameState.bossesDefeated = save.stats.bossesDefeated;
            gameState.byType = { ...(save.stats.byType || {}) };
            gameState.distance = save.stats.distance || 0;
            gameState.goldEarned = save.stats.goldEarned || 0;
            gameState.deaths = save.stats.deaths || 0;
            gameState.time = save.playSeconds;
            this.session.lastCity = save.world.lastCity || null;
            this.session.claimed = { ...save.world.claimed };
            this.session.triggered = { ...save.world.triggered };
            this.session.gathered = [...save.world.gathered];
            this.world.removed = new Set(this.session.gathered);
            this.world.setSource(this.overworld);   // chunks regenerate without the harvested nodes
            this.session.shopSold = JSON.parse(JSON.stringify(save.world.shopSold));
            this.session.boats = JSON.parse(JSON.stringify(save.world.boats));
            this.session.caches = [...save.world.caches];
        }
        this.quests.load(save ? save.quests : null);
        this.towers.load(save ? save.world.towers : []);     // tower sites, edits and sprites reach the world before any chunk is built
        this.sea.reset();
        this.dungeons.reset();
        this.boat = null;
        uiBridge.sailing.value = false;
        EntityManager.heroLevel = gameState.level;

        this.cam.x = player.wx;
        this.cam.y = player.wy;
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.viewW, this.viewH, true);
        this.updateFog();
        this.syncMap();

        if (save && save.player.boat && this.session.boats[save.player.boat]) { this.sea.refresh(); this.sea.board(save.player.boat); }
        this.ui.game = this;
        mountUi(this);
        uiBridge.visible.value = true;
        uiBridge.muted.value = this.audio.muted;
        uiBridge.cards.value = [];
        uiBridge.cardsOpen.value = false;
        uiBridge.pending.value = gameState.pending;
        this.party.publish();
        this.closeNpcPanels();
        uiBridge.wallet.value = { ...gameState.wallet };
        uiBridge.filter.value = gameState.lootFilter;
        this.cardsKey = '';
        this.safeFor = 999;
        this.ensureCards();
        this.ui.onInteract = () => this.interact();
        this.ui.onMapToggle = () => this.toggleMap();
        this.ui.setHUDVisible(true);
        this.ui.shown = { hp: -1, xp: -1, level: -1, slots: '' };
        this.ui.displayHp = gameState.health;
        this.ui.displayXp = gameState.experience;
        this.ui.fadeAlpha = 0; this.ui.fadeTarget = 0;
        applySettings(this);

        this.lastGold = gameState.wallet.gold;
        this.gameTicker = (delta) => this.gameLoop(delta);
        this.app.ticker.add(this.gameTicker);
        this.tips.reset(save && save.tips ? save.tips : []);
        this.events.emit('GameLoaded', { slot: save ? this.saveSlot : 'new' });
        if (!save) this.requestSave('new', true);
    }

    // ------------------------------------------------------------- saving
    async requestSave(reason, force = false, slot = this.saveSlot) {
        if (!this.store || !this.state.player || this.state.gameOver) return false;
        const now = performance.now();
        if (!force && now - this.lastSaveAt < 3000) return false;
        this.lastSaveAt = now;
        const quiet = reason === 'auto' || reason === 'hidden' || reason === 'new';
        try {
            // a fresh picture for the slot list: on every manual save, otherwise every few minutes; never in the
            // middle of a scene change, when the screen is dark and half built
            if (!this.busy && (!quiet || !this.lastThumb || now - (this.lastThumbAt || 0) > 300000)) { this.lastThumb = captureThumb(this) || this.lastThumb; this.lastThumbAt = now; }
            const wall = Date.now();
            const rotate = shouldRotate(this.lastBackupAt[slot] ?? null, wall, !quiet);
            await writeSlot(this.store, slot, buildSave(this), rotate);
            if (rotate) this.lastBackupAt[slot] = wall;
            this.events.emit('GameSaved', { slot });
            if (!quiet) this.ui.toast(slot === this.saveSlot ? 'Game saved' : `Saved to ${slotLabel(slot)}`, 'save');
            return true;
        } catch (err) {
            console.warn('save failed', err);
            this.ui.toast('Saving failed: the browser storage may be full or blocked', 'alert');
            return false;
        }
    }

    /** The codex learns of a monster, spell or rune (the first time only). */
    codexFound(kind, id) {
        if (this.codex && discover(this.codex[kind], id)) uiBridge.version.value++;
    }

    /** Start the given save in place of the running session (Load from the pause menu or the title). */
    loadSave(data) {
        uiBridge.pauseOpen.value = false;
        uiBridge.slotsOpen.value = null;
        this.state.paused = false;
        this.closeNpcPanels();
        this.ui.fade(1, 0.12, () => { this.state.gameOver = false; this.init(data); this.ui.fade(0, 0.06); });
    }

    /** Save, end the session and go back to the title screen. */
    async quitToTitle() {
        await this.requestSave('quit', true);
        uiBridge.pauseOpen.value = false;
        this.closeNpcPanels();
        this.state.paused = false;
        if (this.gameTicker) this.app.ticker.remove(this.gameTicker);
        this.gameTicker = null;
        this.clearEntities();
        gameState.reset();
        this.mode = null;
        this.boat = null;
        uiBridge.visible.value = false;
        this.ui.setHUDVisible(false);
        this.world.setSource(new OverworldSource(randomSeed()));
        this.cam.x = 0; this.cam.y = 0;
        this.applyCamera();
        this.app.ticker.add(this.menuTicker);
        this.showStartScreen();
    }

    // reveal the map around the player (called whenever they enter a new tile)
    updateFog() {
        const p = this.state.player;
        const tx = Math.floor(p.wx / T), ty = Math.floor(p.wy / T);
        if (tx === this.lastFogTx && ty === this.lastFogTy) return;
        this.lastFogTx = tx; this.lastFogTy = ty;
        if (this.mode === 'overworld') this.fog.revealCircle(tx, ty, 17);
        else if (this.interiorFog.revealCircle(tx, ty, 9) > 0 && this.interiorState) this.interiorState.fog = this.interiorFog.toJSON();
    }

    syncMap() {
        const fog = this.mode === 'overworld' ? this.fog : this.interiorFog;
        this.map.sync(fog, this.world, this.mode === 'overworld' ? this.popRuntime.population : null, this.session);
    }

    // amount 0 = daylight, ~0.5 = a dim cave. Darkness is a light map: ambient colour plus glowing sources.
    setAmbient(amount) {
        this.ambient = amount;
        if (amount <= 0.01) { this.lighting.setAmbient(this.regionAmbient(), true); return; }
        const k = Math.max(0.12, 1 - amount * 1.45);
        const c = (f) => Math.round(255 * Math.min(1, k * f));
        this.lighting.setAmbient((c(0.82) << 16) | (c(0.88) << 8) | c(1.08));
    }

    // darker, tinted daylight in the dangerous far regions (by difficulty tier)
    regionAmbient() {
        if (this.mode !== 'overworld' || !this.state.player || !this.overworld) return 0xffffff;
        const p = this.state.player;
        const tier = tierOf(this.overworld.levelAt(Math.floor(p.wx / T), Math.floor(p.wy / T)));
        return [0xffffff, 0xf0e6f4, 0xdcd4cc, 0xb0bcdc, 0xd4a8a8, 0xb0a0c8][Math.min(tier, 5)];
    }

    // gather light sources near the camera and render the light map (called once per rendered frame)
    renderLights() {
        const L = this.lighting;
        L.fade(1);
        if (!L.enabled || !this.state.player) { L.render(this.worldContainer); return; }
        const p = this.state.player;
        const t = this.frame;
        const def = this.party?.def ? this.party.def() : null;
        L.add({ x: p.wx, y: p.wy, z: 30, r: 330, color: 0xfff0d8, i: 1 });
        L.add({ x: p.wx, y: p.wy, z: 50, r: 120, color: def ? def.color : 0x9fd8ff, i: 0.55 });
        const vw = this.app.screen.width, vh = this.app.screen.height / TILT;
        this.world.views.forEach((v) => {
            for (const l of v.lights) {
                if (Math.abs(l.x - this.cam.x) > vw * 0.75 + l.r || Math.abs(l.y - this.cam.y) > vh * 0.75 + l.r) continue;
                const flick = l.flicker ? 0.9 + 0.1 * Math.sin(t * 0.31 + l.phase) * Math.sin(t * 0.17 + l.phase * 2) : 1;
                L.add({ x: l.x, y: l.y, z: l.z, r: l.r * flick, color: l.color, i: l.i });
            }
        });
        this.spells.emitLights(L);
        this.dungeons.emitLights(L);
        this.vaults.emitLights(L);
        for (const g of this.state.gems) if (g.kind === 'gem') L.add({ x: g.wx, y: g.wy, z: 12, r: 46, color: EntityManager.gemTier(g.value).color, i: 0.6 });
        for (const it of this.interactables) {
            if (it.kind === 'chest' && !it.opened) L.add({ x: it.x, y: it.y, z: 16, r: 90, color: 0xffd060, i: 0.55 });
            if (it.kind === 'healer') L.add({ x: it.x + 16, y: it.y, z: 50, r: 150, color: 0x9bffb0, i: 0.8 });
        }
        this.fx.emitLights(L);
        L.render(this.worldContainer);
    }

    toggleMap() {
        if (!this.state.player || this.busy) return;
        this.ui.toggleMap(this);
    }

    // ------------------------------------------------------------ game loop
    // The simulation advances in fixed 1/60 s steps; rendering simply follows the latest state.
    gameLoop(rawDelta) {
        const t0 = this.perf && this.perf.shown ? performance.now() : 0;
        this.input.poll();
        this.accum = Math.min(this.accum + rawDelta * this.timeScale, 5 * this.timeScale);
        while (this.accum >= 1) {
            this.accum -= 1;
            this.step(1);
        }
        if (this.state.player && !this.state.paused) this.ambience.update(Math.min(rawDelta, 2.5), this.cam, this.worldContainer);
        this.occlusion.update(Math.min(rawDelta, 2.5));
        this.renderLights();
        if (t0) this.perf.frame(performance.now() - t0);
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
        // hit-stop: the action holds for a moment after a crit or a big kill
        if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - 1); return; }

        const delta = Math.min(rawDelta, 2.5);
        this.frame += delta;
        s.time += delta / 60;

        EntityManager.heroLevel = s.level;
        this.movePlayer(delta);
        this.updateFog();
        this.surfaces.update(delta);
        this.sites.update(delta);
        this.towers.update(delta);
        this.sea.update(delta);
        this.dungeons.update(delta);
        this.vaults.update(delta);
        this.quests.update(delta);
        this.tips.update(delta);
        this.story.update();
        this.updateShakers(delta);
        this.spells.update(delta);
        this.party.update(delta);
        this.updateSafety(delta);
        this.syncUi();
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
        this.world.update(this.cam.x, this.cam.y, this.viewW, this.viewH);
        this.world.animate(delta);
        this.updateZone();
        this.updateMusic(delta);
        this.syncMap();
        this.ui.update(this, delta);

        this.autosaveTimer -= delta;
        if (this.autosaveTimer <= 0) {
            this.autosaveTimer = 1800;
            if (this.mode === 'overworld') this.requestSave('auto');
        }

        if (s.health <= 0) this.party.onDown();
    }

    // -------------------------------------------------------------- player
    movePlayer(delta) {
        const { keys, player } = this.state;
        let dx = 0, dy = 0;
        const km = this.input.keys;
        const held = (a) => km.keysFor(a).some((k) => keys[k]);
        if (held('left')) dx -= 1;
        if (held('right')) dx += 1;
        if (held('up')) dy -= 1;
        if (held('down')) dy += 1;

        const joy = this.ui.joystick;
        let analog = false;
        if (joy && joy.active) {
            dx = joy.position.x;
            dy = joy.position.y;
            analog = true;
        } else if (this.input.frame.move.x !== 0 || this.input.frame.move.y !== 0) {
            dx = this.input.frame.move.x;
            dy = this.input.frame.move.y;
            analog = true;
        } else if (this.state.pointerDown && this.state.pointerPosition) {
            const p = this.state.pointerPosition;
            const { x: tx, y: ty } = this.screenToWorld(p.x, p.y);
            const ddx = tx - player.wx, ddy = ty - player.wy;
            const dist = Math.hypot(ddx, ddy);
            if (dist > 8) { dx = ddx / dist; dy = ddy / dist; }
        }
        // click to move: walk to the clicked spot until any other movement takes over
        if (this.moveTarget) {
            if (dx || dy) this.moveTarget = null;
            else {
                const ddx = this.moveTarget.x - player.wx, ddy = this.moveTarget.y - player.wy;
                const dist = Math.hypot(ddx, ddy);
                if (dist > 10) { dx = ddx / dist; dy = ddy / dist; } else this.moveTarget = null;
            }
        }

        const ox = player.wx, oy = player.wy;
        let moving = false;
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            if (!analog || len > 1) { dx /= len; dy /= len; }
            const inShallows = !this.boat && this.world.biomeAtPos(player.wx, player.wy) === BIOME.SHALLOW;
            let mul = inShallows ? 0.72 : this.boat ? BOAT_SPEED : 1;
            if (this.frame < player.slowUntil) mul *= 1 - player.slowAmt;
            mul *= this.surfaces.fx.speed;
            const speed = this.state.playerSpeed * this.stats.speed * delta * mul;
            this.world.tryMove(player, dx * speed, dy * speed * 1.2, player.radius, !!this.boat);
            const walked = Math.hypot(player.wx - ox, player.wy - oy);
            this.state.distance += walked;
            // footsteps, by the ground underfoot
            if (!this.boat) {
                this.stepDist = (this.stepDist || 0) + walked;
                if (this.stepDist >= STRIDE) {
                    this.stepDist = 0;
                    const step = footstepFor(this.world.biomeAtPos(player.wx, player.wy), this.surfaces.current ? this.surfaces.current.id : null);
                    this.lastStep = step;
                    this.audio.play(STEP_SOUND[step], { vol: 0.85 });
                }
            }
            moving = true;
            this.lastMove = { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) };
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

    // ground damage over time: quiet, ignores nothing but a ward and a dash
    damagePlayerDot(amount) {
        const s = this.state;
        if (this.godMode || this.spells.barrierActive || this.frame < (this.invulnUntil || 0)) return;
        s.health -= amount * (1 - this.stats.armor);
        this.safeFor = 0;
        this.dotAcc = (this.dotAcc || 0) + amount;
        if (this.dotAcc > 6) { this.dotAcc = 0; this.ui.flashDamage(); }
    }

    // burst hits (dashes, slams, projectiles) grant a short grace period so stacked attacks stay fair
    hurtPlayer(amount, burst = false) {
        const s = this.state;
        if (this.godMode) return;
        if (this.spells.barrierActive || this.frame < (this.invulnUntil || 0)) return;
        this.safeFor = 0;
        if (burst) {
            if (this.frame < (this.invulnUntil || 0)) return;
            this.invulnUntil = this.frame + 18;
        }
        s.health -= amount * (1 - this.stats.armor);
        if (this.frame - (this.lastHurt || -99) > 12) {
            this.lastHurt = this.frame;
            this.ui.flashDamage();
            this.fx.addShake(3);
            this.input.rumble(0.55, 0.3, 150);
            this.audio.play('hurt');
        }
    }

    updateCamera(delta) {
        const p = this.state.player;
        const t = 1 - Math.pow(0.001, delta / 60);
        // the camera looks a little ahead of the hero while walking (not under reduced motion)
        const want = access.reducedMotion || this.busy ? { x: 0, y: 0 } : cameraLead(this.lastMove.x, this.lastMove.y, !!p.moving, Math.min(6, Math.hypot(this.playerVel.x, this.playerVel.y)));   // a blink or dash must not swing the camera
        const k = 1 - Math.pow(0.04, delta / 60);
        this.camLead.x += (want.x - this.camLead.x) * k;
        this.camLead.y += (want.y - this.camLead.y) * k;
        this.cam.x += (p.wx + this.camLead.x - this.cam.x) * t;
        this.cam.y += (p.wy + this.camLead.y - this.cam.y) * t;
        this.applyCamera();
    }

    /** Freeze the action for a moment (crits, big kills); scaled by the shake setting, off under reduced motion. */
    addHitStop(kind) {
        if (access.reducedMotion) return;
        const n = hitStopFrames(kind, settings.shake, this.frame, this.lastCritStop);
        if (!n) return;
        if (kind === 'crit') this.lastCritStop = this.frame;
        this.hitStop = Math.max(this.hitStop, n);
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

        let engaged = 0;
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (e.dead || e.dummy) continue;
            updateEnemy(this, e, delta);
            // a warlord or demon lord that notices the party gets its card
            if ((e.isBoss || e.dungeonBoss) && !e.introduced && !e.dormant && (!e.home || e.shell === 'engaged')) { e.introduced = true; this.story.bossIntro(e); }
            // a warning sound when a big hitter starts to wind up (charges, slams, dives, boss abilities)
            const st = e.ai && e.ai.state;
            if (st !== e.lastAiState) {
                if (st === 'windup' && (e.isBoss || e.elite || e.radius >= 18)) this.audio.play('warn', { x: e.wx, y: e.wy });
                e.lastAiState = st;
            }
            if (!e.dormant && (!e.home || e.shell === 'engaged') && Math.abs(e.wx - p.wx) < 520 && Math.abs(e.wy - p.wy) < 420) engaged++;
        }
        this.engagedNear = engaged;
        this.dummy.update();

        // clearing every monster of a place pays out once
        if (this.mode === 'interior' && this.interiorState && !this.interiorState.cleared && this.interiorHostiles > 0) {
            if (!list.some((e) => !e.dead && !e.minion)) {
                this.interiorState.cleared = true;
                this.ui.banner(this.interior && this.interior.dungeon ? 'FLOOR CLEARED!' : 'PLACE CLEARED!', 0xffd84a);
                this.dropGem(p.wx + 30, p.wy + 20, 0, 'heart');
                for (let i = 0; i < 6; i++) this.dropGem(p.wx + (Math.random() - 0.5) * 120, p.wy + 40 + Math.random() * 40, 12 + this.zoneLevelNow * 2);
                this.dungeons.checkComplete();
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
            this.audio.play('elite', { x: x, y: y });
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
        this.occlusion.float(e, e.hpBar.bar);
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
        this.ui.banner(`${type.name.toUpperCase()} APPROACHES`, 0xff5a5a, 'warning');
        this.fx.addShake(6);
        this.audio.play('roar');
    }

    damageEnemy(e, amount, opts = {}) {
        if (e.dead || e.untargetable) return;
        const crit = !opts.noCrit && Math.random() < this.stats.crit + (opts.critBonus || 0);
        const dmg = amount * (crit ? 2 : 1) * (1 - (e.armor || 0));
        e.health -= dmg;
        if (!opts.quiet) {
            e.hitFlash = 6;
            if (showDamageNumber(settings.damageNumbers, crit)) {
                if (crit) this.fx.popup(e.wx, e.wy, Math.round(dmg), 0xffd84a, 24, e.baseHeight + 8);
                else this.fx.damageNumber(e.uid, e.wx, e.wy, dmg, opts.color || 0xffffff, 16, e.baseHeight + 8);
            }
            this.audio.play(crit ? 'crit' : 'hit', { x: e.wx, y: e.wy });
            if (crit) this.addHitStop('crit');
        }
        // the training dummy only counts the damage: no knock-back, no waking, no death
        if (e.dummy) { this.dummy.hit(dmg); e.hitFlash = 6; e.health = e.maxHealth; return; }

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
        if (e.health <= 0) this.killEnemy(e, opts.spell);
    }

    killEnemy(e, spell) {
        if (e.dead) return;
        e.dead = true;
        const s = this.state;
        const type = ENEMY_TYPES[e.type];
        s.kills++;
        s.score += e.experienceValue * 2;
        this.fx.death(e.wx, e.wy, type.color, e.isBoss);
        this.audio.play(e.isBoss ? 'bossDown' : e.radius > 22 || e.elite ? 'killBig' : 'kill', { x: e.wx, y: e.wy });
        if (e.isBoss || e.dungeonBoss) this.addHitStop('bossKill');
        else if (e.elite || e.radius > 22) this.addHitStop('bigKill');

        if (type.onDeath) this.spawnMinions(type.onDeath.spawn, type.onDeath.count, e.wx, e.wy, e.level);
        this.events.emit('EnemyKilled', { type: e.type, level: e.level, x: e.wx, y: e.wy, boss: !!e.isBoss, group: this.mode === 'interior' && this.interiorPoi ? this.interiorPoi.group : this.zoneGroup, dungeon: !!e.dungeonBoss });
        if (e.guardian) this.dungeons.guardianDown();
        if (e.dungeonBoss) this.dungeons.bossDown(e);
        if (e.kraken) this.sea.krakenDown(e);
        this.popRuntime.onKill(e);
        this.spells.onKill(e, spell);
        this.dropLoot(e);

        if (e.isBoss) {
            s.bossesDefeated++;
            for (let i = 0; i < 10; i++) {
                this.dropGem(e.wx + (Math.random() - 0.5) * 120, e.wy + (Math.random() - 0.5) * 90, Math.ceil(e.experienceValue / 6));
            }
            this.dropGem(e.wx, e.wy + 20, 0, 'heart');
            this.dropGem(e.wx + 30, e.wy, 0, 'heart');
            this.fx.addShake(12);
            this.story.victory(e);
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
            else if (old.kind !== 'heart') this.collect(old);
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
    /** Music follows the place, the region, a nearby boss and how many monsters are on you. */
    updateMusic(delta) {
        const s = this.state, p = s.player, a = this.audio;
        a.listener.x = this.cam.x; a.listener.y = this.cam.y;
        this.musicHeat = (this.musicHeat || 0) + ((Math.min(1, (this.engagedNear || 0) / 7)) - (this.musicHeat || 0)) * Math.min(1, 0.02 * delta);
        if ((this.frame | 0) % 30 !== 0) return;
        // keep the music down while someone is talking
        a.setDuckHold(!!uiBridge.dialog.value);
        if (!p || s.gameOver) { a.music.setTrack('title'); a.ambience.setBed('silence'); return; }
        const boss = s.enemies.some((e) => e.isBoss && !e.dead && Math.abs(e.wx - p.wx) < 1100 && Math.abs(e.wy - p.wy) < 900);
        const inside = this.mode === 'interior' && this.interiorPoi;
        const id = pickTrack({ boss, place: inside ? this.interiorPoi.type : null, dungeon: !!(inside && this.interior && this.interior.dungeon), sailing: !!this.boat, group: this.zoneGroup });
        a.music.setTrack(id, !inside && (this.zoneTier || 0) >= 2);
        a.music.setIntensity(boss ? 1 : this.musicHeat);
        a.ambience.setBed(ambientFor({ group: this.zoneGroup, place: inside ? this.interiorPoi.type : null, dungeon: !!(inside && this.interior && this.interior.dungeon), sailing: !!this.boat }));
        if (s.health > 0 && s.health / s.maxHealth < 0.25) a.play('heartbeat');
    }

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
        this.zoneTier = tier;
        this.zoneThreat = threatBand(level, this.state.level);
        this.lighting.setAmbient(this.regionAmbient(), false);
        this.ambience.setRegion(group, tier >= 2);
        const regionId = this.overworld.regionId(tx, ty);
        const region = this.overworld.region(regionId);
        this.zoneIcon = info.icon;
        this.regionName = region.name;
        this.zoneLabel = `${region.name} · ${info.name} · Lv ${level}`;
        const newRegion = regionId !== this.regionId;
        if (newRegion) {
            this.regionId = regionId;
            const first = !this.regionsSeen.has(regionId);
            this.regionsSeen.add(regionId);
            this.map.dirty = true;
            if (this.frame > 30) {
                this.ui.showZone(region.name.toUpperCase(), 'fleur', 0xf3d08a);
                this.ui.toast(`${first ? 'Discovered ' : ''}${region.title}${region.capital ? ` · capital: ${region.capital.name}` : ''}`, first ? 'map' : '');
                if (first) this.audio.stinger('stingDiscover');
            }
            this.events.emit('RegionEntered', { id: regionId, name: region.name, first });
        }
        if (group !== this.zoneGroup) {
            this.zoneGroup = group;
            const prefix = tierName(tier);
            if (this.frame > 30 && !newRegion) this.ui.showZone(`${prefix ? prefix + ' ' : ''}${info.name}  ·  Lv ${level}`, info.icon, info.color);
            this.events.emit('ZoneChanged', { group, level, tier });
        }
    }

    updateInteraction() {
        const p = this.state.player;
        let target = null;

        if (this.mode === 'overworld' && this.boat) {
            if (this.sea.landNear(p.wx, p.wy)) target = { kind: 'ashore', text: '[E]  Step ashore' };
        } else if (this.mode === 'overworld') {
            const poi = this.world.nearestPoi(p.wx, p.wy, 72);
            const tower = this.towers.targetFor(p);
            const boat = this.sea.boatNear(p.wx, p.wy);
            const cache = this.sea.cacheTarget(p.wx, p.wy);
            if (poi) target = { kind: 'enter', poi, text: `[E]  Enter ${poi.name}` };
            else if (tower) target = tower;
            else if (boat) target = { kind: 'boat', id: boat.id, text: '[E]  Board the boat' };
            else if (cache) target = { kind: 'cache', cache, text: '[E]  Dig up the buried treasure' };
            else {
                const node = this.world.nearestNode(p.wx, p.wy, 64, isNode);
                const sign = !node && this.world.nearestNode(p.wx, p.wy, 70, (t) => t === 'signpost');
                if (node) {
                    const def = NODES[node.type];
                    const left = def.hits - (node._hits || 0);
                    target = { kind: 'gather', node, text: `[E]  ${def.verb} (${def.resource})${left < def.hits ? `  ·  ${left} more` : ''}` };
                } else if (sign) target = { kind: 'sign', sign, text: '[E]  Read the signpost' };
            }
        } else {
            let best = Infinity;
            const consider = (t, x, y, r) => {
                const d = Math.hypot(p.wx - x, p.wy - y);
                if (d < r && d < best) { best = d; target = t; }
            };
            this.interiorCandidates((t, x, y, r) => consider(t, x, y, r));
        }
        this.target = target;
        if ((uiBridge.towerPanel.value || uiBridge.waypointOpen.value) && (!target || target.kind !== 'tower')) { uiBridge.towerPanel.value = null; uiBridge.waypointOpen.value = null; }
        const open = uiBridge.healerOpen.value ? 'healer' : uiBridge.shopOpen.value ? 'merchant' : uiBridge.innOpen.value ? 'innkeeper' : uiBridge.boardOpen.value ? 'board' : uiBridge.dialog.value ? (uiBridge.dialog.value.script ? 'elder' : 'npc') : null;
        if (open && (!target || target.kind !== open)) this.closeNpcPanels();
        this.ui.setPrompt(target ? target.text : null);
    }

    /** Everything that can be used inside a place: add(target, x, y, reach, height on screen in world units). */
    interiorCandidates(add) {
        for (const it of this.interactables) {
            if (it.kind === 'chest' && !it.opened) add({ kind: 'chest', it, text: '[E]  Open treasure' }, it.x, it.y, 64, 70);
            if (it.npc) add({ kind: it.kind, text: { healer: '[E]  Talk to the Healer', merchant: '[E]  Browse the Merchant\'s wares', innkeeper: '[E]  Talk to the Innkeeper', elder: '[E]  Speak with the Elder', board: '[E]  Read the bounty board' }[it.kind] }, it.x, it.y, 90, 150);
        }
        for (const c of this.critters.list) {
            if (c.kind === 'villager') add({ kind: 'npc', c, text: '[E]  Talk' }, c.wx, c.wy, 56, 130);
        }
        const src = this.interior;
        if (src.fountain) add({ kind: 'fountain', text: this.fountainReady() ? '[E]  Drink from the fountain' : 'The fountain is recharging…' }, src.fountain.x, src.fountain.y + 20, 96, 170);
        if (src.altar) add({ kind: 'altar', text: this.interiorState.altarUsed ? 'The altar is quiet' : '[E]  Pray at the altar' }, src.altar.x, src.altar.y + 20, 80, 170);
        if (this.dungeons.portal) add({ kind: 'portal', text: '[E]  Step through the portal to the entrance' }, this.dungeons.portal.x, this.dungeons.portal.y, 80, 130);
        if (src.floor > 0) add({ kind: 'up', text: '[E]  Climb back up' }, src.exit.x, src.exit.y, 74, 150);
        else add({ kind: 'exit', text: `[E]  Leave ${this.interiorName}` }, src.exit.x, src.exit.y, 74, 150);
        this.vaults.considerTargets((t, x, y, r) => add(t, x, y, r, t.act === 'gate' ? 220 : 110));
        if (src.stairsDown) {
            const left = this.dungeons.guardiansLeft();
            add({ kind: 'down', sealed: left > 0, text: left > 0 ? `The way down is sealed · ${left} guardian${left > 1 ? 's' : ''} left` : '[E]  Descend' }, src.stairsDown.x, src.stairsDown.y, 80, 110);
        }
    }

    /**
     * Experimental mouse interaction: every target within the hero's reach, each with the box it is drawn in, so a
     * click on it can use it. Only things already in reach are offered: clicking never extends the range.
     */
    clickTargets() {
        const p = this.state.player, out = [];
        const reach = (x, y, r) => Math.hypot(p.wx - x, p.wy - y) < r;
        const tall = (type, fallback) => {
            const set = this.world.decorTextures && this.world.decorTextures[type];
            return set && set[0] ? set[0].texture.height * set[0].anchorY / TILT : fallback;
        };
        if (this.mode === 'overworld') {
            if (this.boat) return out;
            const poi = this.world.nearestPoi(p.wx, p.wy, 72);
            if (poi) out.push({ t: { kind: 'enter', poi, text: `[E]  Enter ${poi.name}` }, x: poi.ex, y: poi.ey, w: 140, h: 280 });
            const tower = this.towers.targetFor(p);
            if (tower) out.push({ t: tower, x: (tower.rec.tx + 0.5) * T, y: (tower.rec.ty + 0.5) * T, w: 130, h: 360 });
            const boat = this.sea.boatNear(p.wx, p.wy);
            if (boat) out.push({ t: { kind: 'boat', id: boat.id, text: '[E]  Board the boat' }, x: boat.x, y: boat.y, w: 120, h: 90 });
            const cache = this.sea.cacheTarget(p.wx, p.wy);
            if (cache) out.push({ t: { kind: 'cache', cache, text: '[E]  Dig up the buried treasure' }, x: (cache.tx + 0.5) * T, y: (cache.ty + 0.5) * T, w: 70, h: 80 });
            for (const node of this.world.nodesNear(p.wx, p.wy, 64, isNode)) {
                const def = NODES[node.type];
                out.push({ t: { kind: 'gather', node, text: `[E]  ${def.verb} (${def.resource})` }, x: node.x, y: node.y, w: 70, h: tall(node.type, 120) });
            }
            for (const sign of this.world.nodesNear(p.wx, p.wy, 70, (t) => t === 'signpost')) out.push({ t: { kind: 'sign', sign, text: '[E]  Read the signpost' }, x: sign.x, y: sign.y, w: 60, h: 120 });
        } else if (this.interior) {
            this.interiorCandidates((t, x, y, r, h) => { if (reach(x, y, r)) out.push({ t, x, y, w: 80, h }); });
        }
        return out;
    }

    /** A signpost names the towns its roads lead to. */
    readSign(sign) {
        const roads = this.overworld.roads;
        const [cx, cy] = String(sign.sign).split(',').map(Number);
        const node = roads.nodeOfCell(cx, cy);
        const dests = node ? roads.destinations(node) : [];
        this.audio.play('blip');
        this.ui.toast(dests.length ? `${node.name} · the road leads to ${dests.join(' and ')}` : 'The letters have worn away.');
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
            case 'exit': case 'portal': this.exitPlace(); break;
            case 'up': this.changeFloor(-1); break;
            case 'down': if (t.sealed) { this.audio.play('deny'); this.ui.toast('Defeat the guardians first: the seal holds until they fall'); } else this.changeFloor(1); break;
            case 'chest': this.openChest(t.it); break;
            case 'vault': this.vaults.interact(t); break;
            case 'gather': this.gatherHit(t.node); break;
            case 'sign': this.readSign(t.sign); break;
            case 'site': case 'tower': this.towers.interact(t); break;
            case 'boat': this.sea.board(t.id); break;
            case 'ashore': this.sea.disembark(); break;
            case 'cache': this.sea.open(t.cache); break;
            case 'healer': case 'merchant': case 'innkeeper': this.openNpc(t.kind); break;
            case 'elder': if (uiBridge.dialog.value && uiBridge.dialog.value.script) this.quests.advance(); else this.quests.talkToElder(); break;
            case 'board': if (uiBridge.boardOpen.value) this.closeNpcPanels(); else this.quests.openBoard(); break;
            case 'npc': if (uiBridge.dialog.value) uiBridge.dialog.value = null; else this.talkToVillager(t.c); break;
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
                    this.grantLoot(2);
                }
                break;
        }
    }

    enterPlace(poi) {
        if (this.busy) return;
        this.busy = true;
        this.audio.play('door');
        this.state.pointerDown = false;
        this.state.keys = {};
        this.ui.fade(1, 0.09, () => {
            const s = this.state;
            const p = s.player;
            // gems lying on the ground wait where they fell: nothing is lost, and nothing is granted just for walking in
            this.gemStash = this.mode === 'overworld' ? { poiId: poi.id, gems: s.gems.map((g) => ({ x: g.wx, y: g.wy, value: g.value, kind: g.kind })) } : null;
            this.clearWorldEntities();
            this.popRuntime.clearActive();
            this.clearOverworldDisplays();

            if (!this.visited[poi.id]) this.audio.stinger('stingDiscover');      // the first time inside a place
            this.visited[poi.id] = this.visited[poi.id] || { opened: [], cleared: false, altarUsed: false };
            // visited towns become respawn points
            if (poi.type === 'city' && !this.session.cities.some((c) => c.id === poi.id)) {
                this.session.cities.push({ id: poi.id, name: poi.name, ex: poi.ex, ey: poi.ey });
            }
            if (poi.type === 'city') this.session.lastCity = poi.id;
            this.events.emit('PlaceEntered', { id: poi.id, name: poi.name, kind: poi.type, dungeon: poi.dungeon ? poi.dungeon.realm : null, group: poi.group });
            this.loadFloor(poi, 0, 'start');
            this.requestSave('place', true);
            this.ui.fade(0, 0.06, () => { this.busy = false; this.checkLevelUp(); });
        });
    }

    /** Build floor `floor` of a place and put the party on it (the screen is already faded out). */
    loadFloor(poi, floor, arrive = 'start') {
        const p = this.state.player;
        const place = this.visited[poi.id];
        const src = createInterior(poi, floor);
        this.interior = src;
        this.interiorPoi = poi;
        this.interiorName = poi.name;
        this.floor = floor;
        // the ground floor keeps its state on the place itself (as before); deeper floors keep theirs beside it
        this.interiorState = floor === 0 ? place : ((place.floors ||= {})[floor] ||= { opened: [], cleared: false, altarUsed: false });
        this.world.setSource(src);
        // each floor remembers what was explored (saved with the place); restored chunks repaint on the map
        this.interiorFog = this.interiorState.fog ? FogOfWar.fromJSON(this.interiorState.fog) : new FogOfWar();
        this.lastFogTx = null;
        this.map.setMode('interior');
        this.mode = 'interior';
        this.flow.centerTx = NaN;
        this.setAmbient(src.ambient);
        this.ambience.clear();
        this.ambience.setRegion(poi.type);

        const from = arrive === 'end' && src.stairsDown ? { x: src.stairsDown.x, y: src.stairsDown.y + 1.5 * T } : src.start;
        const spot = this.world.findFree(from.x, from.y, p.radius + 2);
        p.wx = spot.x; p.wy = spot.y;
        this.cam.x = p.wx; this.cam.y = p.wy;
        this.populateInterior(src, poi);
        this.dungeons.showFeatures();
        this.dungeons.checkComplete(true);        // a place finished before completion was tracked gets its badge
        const label = src.dungeon ? `${poi.name} · floor ${floor + 1} of ${src.floors}` : poi.name;
        this.zoneIcon = POI_INFO[poi.type].icon;
        this.zoneLabel = label;
        this.ui.showZone(label, POI_INFO[poi.type].icon, GROUP_INFO[poi.type].color);
        if (src.dungeon) this.events.emit('FloorEntered', { id: poi.id, floor, floors: src.floors });

        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.viewW, this.viewH, true);
    }

    /** Take the stairs: +1 goes down, -1 goes up. */
    changeFloor(delta) {
        if (this.busy || this.mode !== 'interior' || !this.interior || !this.interior.dungeon) return;
        const next = this.floor + delta;
        if (next < 0 || next >= this.interior.floors) return;
        this.busy = true;
        this.state.pointerDown = false;
        this.state.keys = {};
        this.audio.play('stairs');
        this.ui.fade(1, 0.09, () => {
            let banked = 0;
            this.state.gems.forEach((g) => { if (g.kind === 'gem') banked += g.value; else if (g.kind !== 'heart') this.collect(g); });
            if (banked > 0) { this.addXp(banked); this.ui.toast(`Gathered the gems you left behind: +${Math.round(banked * this.stats.growth)} XP`); }
            const poi = this.interiorPoi;
            this.clearWorldEntities();
            this.loadFloor(poi, next, delta > 0 ? 'start' : 'end');
            this.requestSave('floor', true);
            this.ui.fade(0, 0.06, () => { this.busy = false; this.checkLevelUp(); });
        });
    }

    populateInterior(src, poi) {
        const st = this.interiorState;
        this.interiorHostiles = 0;
        if (!st.cleared) {
            src.spawns.forEach((sp) => {
                if (poi.dungeon && sp.elite && st.unsealed) return;       // the guardians of an opened floor stay dead
                const type = ENEMY_TYPES[sp.type];
                let x = sp.x, y = sp.y;
                if (!type.flying && this.world.blocked(x, y, type.radius)) { const f = this.world.findFree(x, y, type.radius); x = f.x; y = f.y; }
                const e = this.makeEnemy(sp.type, x, y, { dormant: true, aggro: 380, elite: !!sp.elite, level: this.dungeons.levelOf(poi, src.floor) });
                if (poi.dungeon && sp.elite) e.guardian = true;
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
            if (!opened) this.map.markers.push({ tx: c.x / T, ty: c.y / T, icon: 'chest' });
        });
        if (poi.type === 'city' && src.services) {
            // each town's own layout says where its people stand (all of them proven reachable from the gate)
            const sv = src.services;
            for (const k of ['healer', 'merchant', 'innkeeper', 'elder']) this.spawnNpc(k, sv[k].x, sv[k].y);
            this.spawnBoard(sv.board.x, sv.board.y);
            this.dummy.spawn(sv.dummy.x, sv.dummy.y);
        } else if (poi.type === 'city' && src.fountain) {
            this.spawnNpc('healer', src.fountain.x + 120, src.fountain.y + 10);
            this.spawnNpc('merchant', src.fountain.x - 130, src.fountain.y + 20);
            if (src.altar) this.spawnNpc('innkeeper', src.altar.x + 150, src.altar.y + 70);
            this.spawnNpc('elder', src.fountain.x - 230, src.fountain.y - 150);
            this.spawnBoard(src.fountain.x + 240, src.fountain.y - 140);
            this.dummy.spawn(src.fountain.x + 260, src.fountain.y + 150);
        }
        this.map.markers.push({ tx: src.exit.x / T, ty: src.exit.y / T, icon: src.floor > 0 ? 'stairs-up' : 'door' });
        if (src.stairsDown) this.map.markers.push({ tx: src.stairsDown.x / T, ty: src.stairsDown.y / T, icon: 'stairs-down' });
        if (src.dungeon && src.boss) {
            const place = this.visited[poi.id];
            if (!place.bossDead) { this.dungeons.spawnBoss(src, poi, place); this.map.markers.push({ tx: src.boss.x / T, ty: src.boss.y / T, icon: 'lair' }); }
            else if (!place.bossChestOpened) this.dungeons.spawnBossChest(src.boss.x, src.boss.y);
            if (place.bossDead) this.dungeons.spawnExitPortal(src);
        }
        src.npcs.forEach((n) => this.critters.spawnVillager(n.x, n.y, n.hue));
        this.vaults.setup(src, st);
    }

    // Chop a tree / mine a rock: a few strikes, then it is gone for good (saved as a world delta).
    gatherHit(node) {
        if (this.frame < (this.gatherCd || 0)) return;
        this.gatherCd = this.frame + 16;
        const def = NODES[node.type];
        node._hits = (node._hits || 0) + 1;
        const wood = def.resource === 'wood';
        const col = wood ? 0x9b6a3a : def.resource === 'iron' ? 0x9ab4d0 : 0xb8bcc8;
        const top = node._sprite ? node._sprite.height * 0.5 : 30;
        this.fx.burst(node.x, node.y, top * 0.6, col, 8, 2.4, { size: 0.7, life: 24, up: 2 });
        if (wood) this.fx.burst(node.x, node.y, top, 0x6ab84a, 5, 1.6, { size: 0.8, life: 40, gravity: 0.03, up: 0.6 });
        this.fx.addShake(1.5);
        this.audio.play(wood ? 'chop' : 'mine');
        (this.shakers ||= []).push({ s: node._sprite, t: 14 });
        if (node._hits < def.hits) return;
        const gains = rollYield(node.type, Math.random, Math.floor(this.zoneLevelNow / 25));
        const id = this.world.removeDecor(node);
        this.session.gathered.push(id);
        for (const y of gains) {
            for (let i = 0; i < y.amount; i++) this.dropGem(node.x + (Math.random() - 0.5) * 50, node.y + 10 + Math.random() * 30, 1, y.resource);
        }
        this.fx.burst(node.x, node.y, top, col, 18, 3.4, { size: 0.9, life: 34, up: 3 });
        this.fx.popup(node.x, node.y, gains.map((y) => `+${y.amount} ${y.resource}`).join('  '), 0xffe9a8, 18, top + 20);
        this.audio.play('pickup');
        this.requestSave('gather');
    }

    animateNpcs() {
        for (const it of this.interactables) if (it.sprite && it.sprite.animate) it.sprite.animate(this.frame);
    }

    updateShakers(delta) {
        this.animateNpcs();
        const sh = this.shakers;
        if (!sh || !sh.length) return;
        for (let i = sh.length - 1; i >= 0; i--) {
            const k = sh[i];
            k.t -= delta;
            if (!k.s || k.s.destroyed) { sh.splice(i, 1); continue; }
            k.s.rotation = k.t > 0 ? Math.sin(k.t * 1.6) * 0.07 * (k.t / 14) : 0;
            if (k.t <= 0) sh.splice(i, 1);
        }
    }

    // Named town NPCs: healer (revive / heal for gold), merchant (spells and runes), innkeeper (rest and save).
    spawnNpc(role, x, y) {
        const spot = this.world.findFree(x, y, 14);
        const c = createNpc(role);
        c.position.set(spot.x, spot.y * TILT);
        c.zIndex = spot.y;
        this.objectLayer.addChild(c);
        this.occlusion.float(c, c.label);
        this.interactables.push({ kind: role, x: spot.x, y: spot.y, sprite: c, npc: true });
        const icon = { healer: 'healer', merchant: 'merchant', innkeeper: 'innkeeper', elder: 'elder' }[role];
        this.map.markers.push({ tx: spot.x / T, ty: spot.y / T, icon });
        return c;
    }

    spawnBoard(x, y) {
        const spot = this.world.findFree(x, y, 16);
        const c = createBoard();
        c.position.set(spot.x, spot.y * TILT);
        c.zIndex = spot.y;
        this.objectLayer.addChild(c);
        this.occlusion.float(c, c.label);
        this.interactables.push({ kind: 'board', x: spot.x, y: spot.y, sprite: c, npc: true });
        this.map.markers.push({ tx: spot.x / T, ty: spot.y / T, icon: 'board' });
        return c;
    }

    openNpc(kind) {
        const b = uiBridge;
        const was = { healer: b.healerOpen.value, merchant: b.shopOpen.value, innkeeper: b.innOpen.value };
        b.healerOpen.value = b.shopOpen.value = b.innOpen.value = b.boardOpen.value = false;
        b.dialog.value = null;
        this.quests.closeDialogue();
        this.party.commit();
        if (kind === 'healer') b.healerOpen.value = !was.healer;
        else if (kind === 'merchant') { b.shopOpen.value = !was.merchant; this.refreshShop(); }
        else if (kind === 'innkeeper') b.innOpen.value = !was.innkeeper;
        this.audio.play('equip');
    }

    closeNpcPanels() {
        const b = uiBridge;
        b.healerOpen.value = b.shopOpen.value = b.innOpen.value = b.boardOpen.value = false;
        b.dialog.value = null;
        this.quests.closeDialogue();
    }

    // ---- merchant
    shopKey() { return `${this.interiorPoi ? this.interiorPoi.id : 'x'}:${epochOf(this.state.time)}`; }

    refreshShop() {
        const poi = this.interiorPoi;
        if (!poi) return;
        const level = Math.max(1, this.overworld.levelAt(poi.tx, poi.ty));
        const epoch = epochOf(this.state.time);
        const sold = this.session.shopSold[this.shopKey()] || [];
        uiBridge.shop.value = {
            town: poi.name,
            nextIn: Math.ceil(STOCK_EPOCH_SECONDS - (this.state.time % STOCK_EPOCH_SECONDS)),
            items: stockFor(poi.seed, epoch, level).map((it, i) => ({ ...it, sold: sold.includes(i) }))
        };
    }

    buyItem(i) {
        const view = uiBridge.shop.value;
        const it = view && view.items[i];
        if (!it || it.sold) return false;
        const w = this.state.wallet;
        if (w.gold < it.price) { this.ui.toast('Not enough gold'); this.audio.play('deny'); return false; }
        w.gold -= it.price;
        if (it.kind === 'spell') this.spells.addSpell(it.tpl);
        else this.spells.addRune(it.id);
        const key = this.shopKey();
        (this.session.shopSold[key] ||= []).push(i);
        // keep only the current epoch's records
        for (const k of Object.keys(this.session.shopSold)) if (!k.endsWith(':' + epochOf(this.state.time))) delete this.session.shopSold[k];
        uiBridge.wallet.value = { ...w };
        uiBridge.version.value = this.spells.version;
        this.audio.play('buy');
        this.ui.toast(it.kind === 'spell' ? `Bought ${TEMPLATES[it.tpl].name}` : `Bought ${RUNES[it.id].name} rune`);
        this.refreshShop();
        this.requestSave('shop');
        return true;
    }

    // ---- inn
    innQuote() {
        this.party.commit();
        const hs = this.party.heroes;
        return innCost(hs.reduce((a, h) => a + h.level, 0) / hs.length);
    }

    restAtInn() {
        const cost = this.innQuote();
        const w = this.state.wallet;
        if (w.gold < cost) { this.ui.toast('Not enough gold for a room'); this.audio.play('deny'); return false; }
        w.gold -= cost;
        uiBridge.wallet.value = { ...w };
        this.party.restAll();
        this.audio.play('levelup');
        this.fx.pillar(this.state.player.wx, this.state.player.wy, 0xffd8a0, 50, 60, 200);
        this.ui.banner('WELL RESTED', 0xffd8a0);
        this.requestSave('inn', true);
        return true;
    }

    // ---- townsfolk
    talkToVillager(c) {
        const poi = this.interiorPoi;
        const dirs = ['north', 'east', 'south', 'west'];
        const seed = ((poi ? poi.seed : 1) ^ Math.imul(Math.round(c.home ? c.home.x : c.wx) + 7, 7919) ^ Math.round(c.home ? c.home.y : c.wy)) | 0;
        uiBridge.dialog.value = { speaker: 'Townsperson', icon: 'person', text: rumorFor(seed, dirs[Math.abs(seed) % 4]) };
    }

    openChest(it) {
        if (it.opened) return;
        it.opened = true;
        if (it.idx !== 'boss') this.interiorState.opened.push(it.idx);
        const set = this.world.decorTextures.chest;
        it.sprite.texture = set[1].texture;
        this.fx.burst(it.x, it.y, 28, 0xffd84a, 30, 3.2, { size: 0.9, life: 40, up: 4.2 });
        this.audio.play('chest');
        this.map.markers = this.map.markers.filter((m) => Math.abs(m.tx - it.x / T) > 0.01 || m.icon !== 'chest');
        this.map.dirty = true;
        if (it.idx === 'boss') { this.fx.pillar(it.x, it.y, 0xffd84a, 80, 80, 300); this.dungeons.openBossChest(it); }
        else if (it.idx === 'vault') this.vaults.openChest(it);
        else this.grantLoot(it.big ? 1 : 0, this.chestLootOpts());
        this.dungeons.checkComplete();
    }

    /** Chests inside a dungeon favour its region's schools and pay better the deeper they are. */
    chestLootOpts() {
        const poi = this.mode === 'interior' ? this.interiorPoi : null;
        if (!poi || !poi.dungeon) return {};
        return { affinity: dungeonAffinity(poi.group, poi.dungeon.realm), bonus: dungeonPower(this.floor || 0) };
    }

    // Chests and altars hand out spells and runes (never blocks play).
    grantLoot(tier, opts = {}) {
        const rand = Math.random;
        const found = [];
        const roll = (power) => {
            const d = rollSkillDrop(rand, power + (opts.bonus || 0), opts.affinity || []);
            if (d.kind === 'spell') { this.spells.addSpell(d.tpl); found.push(TEMPLATES[d.tpl].name); }
            else { this.spells.addRune(d.id); found.push(`${RUNES[d.id].name} rune`); }
        };
        roll(1 + tier);
        if (tier >= 1 || Math.random() < 0.3) roll(1 + tier);
        if (tier >= 2) roll(2 + tier);
        this.audio.play('loot');
        this.ui.toast(`Found: ${found.join(', ')}`, 'chest');
        const p = this.state.player;
        this.fx.popup(p.wx, p.wy, found[0], 0xffe27a, 20, 80);
        uiBridge.version.value = this.spells.version;
    }

    // Independent per-kill rolls: gold, resource, skill (XP gem is handled in killEnemy).
    dropLoot(e) {
        const group = this.mode === 'interior' && this.interiorPoi ? this.interiorPoi.type : this.world.groupAtPos(e.wx, e.wy);
        const loot = rollKillLoot(Math.random, { level: e.level || 1, elite: e.elite, boss: e.isBoss, group });
        const jig = () => (Math.random() - 0.5) * 40;
        if (loot.gold) this.dropGem(e.wx + jig(), e.wy + jig(), loot.gold, 'coin');
        if (loot.resource) this.dropGem(e.wx + jig(), e.wy + jig(), loot.resource.amount, loot.resource.id);
        if (loot.skill) this.grantSkill(loot.power, e.isBoss);
    }

    grantSkill(power, loud = true) {
        // inside a dungeon, kills follow its loot too (its schools; deeper floors give rarer runes)
        const o = this.chestLootOpts();
        const d = rollSkillDrop(Math.random, power + (o.bonus || 0), o.affinity || []);
        if (d.kind === 'spell') {
            this.spells.addSpell(d.tpl);
            this.ui.banner(`NEW SPELL: ${TEMPLATES[d.tpl].name.toUpperCase()}`, 0xb9a5ff, TEMPLATES[d.tpl].icon);
        } else if (filteredOut(d.id, this.state.lootFilter)) {
            const g = Math.round(runeValue(d.id));
            this.state.wallet.gold += g;
            this.ui.toast(`Auto-salvaged ${RUNES[d.id].name} rune (+${g} gold)`);
            return;
        } else {
            this.spells.addRune(d.id);
            this.ui.banner(`RUNE: ${RUNES[d.id].name.toUpperCase()}`, 0x9ff2ff, RUNES[d.id].icon);
        }
        this.audio.play('loot');
        uiBridge.version.value = this.spells.version;
    }

    collect(g) {
        const w = this.state.wallet;
        if (g.kind === 'coin') w.gold += g.value;
        else if (w[g.kind] !== undefined) w[g.kind] += g.value;
        else return;
        this.events.emit('Collected', { resource: g.kind === 'coin' ? 'gold' : g.kind, count: g.value });
        this.audio.play(g.kind === 'coin' ? 'coin' : 'pickup');
        uiBridge.wallet.value = { ...w };
    }

    toastGold(g) { if (g > 0) this.ui.toast(`Salvaged for ${g} gold`); }

    salvageRune(id) {
        const i = this.spells.runes.indexOf(id);
        if (i < 0) return 0;
        this.spells.runes.splice(i, 1);
        const g = Math.round(runeValue(id));
        this.state.wallet.gold += g;
        this.spells.touch();
        uiBridge.wallet.value = { ...this.state.wallet };
        return g;
    }

    salvageSpell(uid) {
        const it = this.spells.item(uid);
        if (!it || it.locked || this.spells.equipped(uid) || this.spells.heldBy(uid)) return 0;
        const g = spellValue(it);
        this.spells.runes.push(...it.runes.filter(Boolean));
        this.spells.spells = this.spells.spells.filter((x) => x.uid !== uid);
        this.state.wallet.gold += g;
        this.spells.touch();
        uiBridge.wallet.value = { ...this.state.wallet };
        return g;
    }

    // Switch the world back to the overworld and put the hero at (x, y).
    applyOverworld(x, y) {
        const s = this.state;
        const p = s.player;
        this.clearWorldEntities();
        this.popRuntime.clearActive();
        this.clearOverworldDisplays();
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
        this.world.update(this.cam.x, this.cam.y, this.viewW, this.viewH, true);
        this.updateFog();
        this.map.dirty = true;
    }

    exitPlace() {
        if (this.busy) return;
        this.busy = true;
        this.audio.play('door');
        this.state.pointerDown = false;
        this.state.keys = {};
        this.ui.fade(1, 0.09, () => {
            const s = this.state;
            let banked = 0;
            s.gems.forEach((g) => { if (g.kind === 'gem') banked += g.value; else if (g.kind !== 'heart') this.collect(g); });
            if (banked > 0) { this.addXp(banked); this.ui.toast(`Gathered the gems you left behind: +${Math.round(banked * this.stats.growth)} XP`); }
            const poi = this.interiorPoi;
            this.events.emit('PlaceLeft', { id: poi.id });
            this.applyOverworld(poi.ex, poi.ey + 34);
            // the gems that were on the ground outside are still there
            const stash = this.gemStash;
            this.gemStash = null;
            if (stash && stash.poiId === poi.id) for (const d of stash.gems) this.dropGem(d.x, d.y, d.value, d.kind);
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
        const trails = settings.quality !== 'low';
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
                // a short sparkle trail behind a gem flying in (inside the particle budget, not on low quality)
                if (trails && g.vel > 4 && ((this.frame | 0) + i) % 3 === 0) {
                    const col = g.kind === 'gem' ? EntityManager.gemTier(g.value).color : g.kind === 'coin' ? 0xffd84a : g.kind === 'heart' ? 0xff7a94 : 0xcfd8e8;
                    this.fx.burst(g.wx, g.wy, 10, col, 1, 0.25, { size: 0.42, life: 14, glow: true });
                }
            }

            if (dist < 20) {
                if (g.kind === 'coin' || g.kind === 'wood' || g.kind === 'stone' || g.kind === 'iron') {
                    this.collect(g);
                    this.fx.popup(p.wx, p.wy, `+${g.value} ${g.kind === 'coin' ? 'gold' : g.kind}`, g.kind === 'coin' ? 0xffd84a : 0xcfd8e8, 16, 60);
                } else if (g.kind === 'heart') {
                    this.audio.play('heal');
                    const heal = s.maxHealth * 0.25;
                    s.health = Math.min(s.maxHealth, s.health + heal);
                    this.fx.popup(p.wx, p.wy, `+${Math.round(heal)}`, 0xff7a94, 20, 60);
                    this.fx.burst(p.wx, p.wy, 20, 0xff6a8a, 12, 2.4, { size: 0.7 });
                } else {
                    this.gainExp(g.value);
                    this.fx.burst(g.wx, g.wy, 12, EntityManager.gemTier(g.value).color, 4, 1.8, { size: 0.5, life: 16 });
                    this.gemStreak = this.frame - (this.lastGemAt || -999) < 40 ? Math.min(12, (this.gemStreak || 0) + 1) : 0;
                    this.lastGemAt = this.frame;
                    this.audio.play('gem', { pitch: Math.pow(2, this.gemStreak / 12) });
                }
                EntityManager.cleanup(g);
                s.gems.splice(i, 1);
            }
        }
    }

    gainExp(value) {
        this.addXp(value);
        this.checkLevelUp();
    }

    // the active hero earns full XP, living bench heroes earn half
    addXp(value) {
        this.state.experience += value * this.stats.growth;
        this.party.addBenchXp(value);
    }

    // ---------------------------------------------------- levelling & upgrades
    // Levels queue up "pending picks"; nothing pauses. Cards are chosen from a side panel when the player wants.
    checkLevelUp() {
        const s = this.state;
        if (s.gameOver) return;
        let gained = 0;
        while (s.experience >= s.nextLevel) {
            s.experience -= s.nextLevel;
            s.level++;
            s.nextLevel = xpForLevel(s.level);
            s.pending++;
            gained++;
            s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.1);
            this.events.emit('HeroLevelUp', { level: s.level });
        }
        if (!gained) return;
        this.ui.displayXp = s.experience;
        const p = s.player;
        for (const e of s.enemies) {
            const dx = e.wx - p.wx, dy = e.wy - p.wy;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 260) { e.kvx += (dx / d) * 10; e.kvy += (dy / d) * 10; }
        }
        this.fx.burst(p.wx, p.wy, 10, 0xffe27a, 30, 5, { size: 0.9, life: 34, up: 3, glow: true });
        this.fx.pillar(p.wx, p.wy, 0xffe27a, 60, 70, 260);
        this.fx.shockwave(p.wx, p.wy, 220, 0xffe27a, 26, 6);
        this.fx.addShake(3);
        this.input.rumble(0.3, 0.8, 260);
        this.audio.play('levelup');
        this.ui.toast(`Level ${s.level}!  ${s.pending} upgrade${s.pending > 1 ? 's' : ''} ready (${quickGlyph('upgrades')})`);
        this.requestSave('level', true);
        this.ensureCards();
    }

    ensureCards() {
        const s = this.state;
        uiBridge.pending.value = s.pending;
        if (s.pending <= 0) { uiBridge.cards.value = []; uiBridge.cardsOpen.value = false; return; }
        if (!uiBridge.cards.value.length) uiBridge.cards.value = offerCards(s.picks, Math.random, 3);
        if (uiBridge.autoPick.value) this.autoPickCards();
    }

    autoPickCards() {
        while (this.state.pending > 0 && uiBridge.cards.value.length) {
            const dom = dominantPath(this.state.picks);
            const cards = uiBridge.cards.value;
            let idx = cards.findIndex((c) => dom && CARDS[c.id].path === dom);
            if (idx < 0) idx = 0;
            this.pickCard(idx);
        }
    }

    pickCard(i) {
        const s = this.state;
        const card = uiBridge.cards.value[i];
        if (!card || s.pending <= 0) return;
        s.picks[card.id] = card.toLevel;
        s.pending--;
        this.recalcStats();
        this.audio.play('pickup');
        uiBridge.picks.value = { ...s.picks };
        uiBridge.cards.value = [];
        if (s.pending > 0) uiBridge.cards.value = offerCards(s.picks, Math.random, 3);
        else uiBridge.cardsOpen.value = false;
        uiBridge.pending.value = s.pending;
        this.ui.shown.slots = '';
        this.requestSave('pick', true);
    }

    recalcStats() {
        this.party.refreshStats();
    }

    // threat awareness: spell/rune editing is only allowed in a quiet moment
    updateSafety(delta) {
        const s = this.state;
        const p = s.player;
        let threat = false;
        for (const e of s.enemies) {
            if (e.dead || e.dummy || e.dormant || e.shell === 'idle') continue;
            if ((e.wx - p.wx) ** 2 + (e.wy - p.wy) ** 2 < 600 * 600) { threat = true; break; }
        }
        this.safeFor = threat ? 0 : this.safeFor + delta;
    }

    syncUi() {
        // gold earned: every rise of the purse counts, whatever paid it
        const gold = this.state.wallet.gold;
        if (gold > this.lastGold) this.state.goldEarned += gold - this.lastGold;
        this.lastGold = gold;
        if ((this.frame | 0) % 6 !== 0) return;
        const b = uiBridge;
        const sp = this.spells;
        b.mana.value = sp.mana.value;
        b.maxMana.value = this.stats.maxMana;
        b.safe.value = this.godMode || this.safeFor >= 180;
        b.version.value = sp.version;
        b.pending.value = this.state.pending;
        const keys = ['Space', 'Q', 'R'];
        b.active.value = [0, 1, 2].map((i) => {
            const v = sp.slotInfo(i);
            if (!v) return null;
            return { uid: v.item.uid, icon: v.r.tpl.icon, name: v.r.tpl.name, key: keys[i], cost: v.cost, cdFrac: Math.round(v.cdFrac * 20) / 20, affordable: v.affordable, color: v.r.color };
        });
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
    // The party wakes up in the last town it entered, or at the start.
    respawnTarget() {
        const c = this.session.cities.find((x) => x.id === this.session.lastCity);
        return c ? { x: c.ex, y: c.ey + 40, label: c.name } : { x: 0, y: 0, label: 'the starting area' };
    }

    respawn(target) {
        const s = this.state;
        uiBridge.death.value = null;
        this.ui.fade(1, 0.1, () => {
            s.gameOver = false;
            this.gemStash = null;
            this.sea.abandon();
            this.party.wipeRevive();
            s.player.visible = true;
            s.pointerDown = false;
            this.applyOverworld(target.x, target.y);
            this.map.dirty = true;
            this.invulnUntil = this.frame + 120;
            this.ui.fade(0, 0.06, () => this.story.wake(target.label));
            this.requestSave('respawn', true);
        });
    }

    showGameOver() {
        this.audio.music.setTrack('title');
        const s = this.state;
        if (s.gameOver) return;
        s.gameOver = true;
        s.health = 0;
        s.pointerDown = false;
        this.ui.update(this, 1);
        this.fx.death(s.player.wx, s.player.wy, 0x6aa8ff, true);
        s.player.visible = false;
        this.events.emit('HeroDied', { respawnAt: this.respawnTarget().label });
        this.story.showDeath(this.respawnTarget());
    }

    /** Respawn from the death screen. */
    deathRespawn() {
        if (!this.state.gameOver || this.busy) return;
        this.respawn(this.respawnTarget());
    }

    /** Start over from the death screen (the screen asks for a second press first). */
    deathNewGame() {
        uiBridge.death.value = null;
        this.state.gameOver = false;
        this.init(null);
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
