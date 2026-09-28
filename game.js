import {
    GAME_CONFIG, ENEMY_TYPES, LEVEL_SCALING, WORLD_CONFIG, SPAWN_CONFIG, xpForLevel
} from './config.js';
import { gameState } from './gameState.js';
import { EntityManager } from './entities.js';
import { UIManager } from './ui.js';
import { World, BIOME } from './world.js';
import { Effects } from './effects.js';
import { WeaponSystem, computeStats, generateChoices } from './weapons.js';

const TILT = WORLD_CONFIG.tilt;
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
        this.ui = new UIManager(this.app);

        window.addEventListener('resize', () => this.handleResize());

        this.world.reset();
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
        const subtitle = new PIXI.Text('An endless world awaits', {
            fontFamily: FONT, fontSize: 22, fill: 0xcfd8f0, letterSpacing: 3
        });
        subtitle.anchor.set(0.5);
        const info = new PIXI.Text(
            'WASD / arrows / mouse / touch to move\nYour weapons fire automatically\nCollect gems to level up and pick upgrades\nMountains and deep water block your way', {
            fontFamily: FONT, fontSize: 19, fill: 0xd8deef, align: 'center', lineHeight: 30
        });
        info.anchor.set(0.5);

        const button = new PIXI.Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';
        const bg = new PIXI.Graphics();
        const drawButton = (hover) => {
            bg.clear();
            bg.beginFill(hover ? 0x5fe28a : 0x3fcf6a);
            bg.lineStyle(3, 0xd9ffe6, 0.9);
            bg.drawRoundedRect(-120, -32, 240, 64, 18);
            bg.endFill();
            bg.beginFill(0xffffff, 0.22);
            bg.drawRoundedRect(-114, -28, 228, 24, 12);
            bg.endFill();
        };
        drawButton(false);
        const label = new PIXI.Text('START', {
            fontFamily: FONT, fontSize: 32, fontWeight: 'bold', fill: 0x0b2a14, letterSpacing: 3
        });
        label.anchor.set(0.5);
        button.addChild(bg, label);
        button.on('pointerover', () => { drawButton(true); button.scale.set(1.06); });
        button.on('pointerout', () => { drawButton(false); button.scale.set(1); });

        screen.addChild(dim, title, subtitle, info, button);

        const layout = () => {
            const w = app.screen.width, h = app.screen.height;
            dim.clear();
            dim.beginFill(0x04060c, 0.62);
            dim.drawRect(0, 0, w, h);
            dim.endFill();
            const s = clamp(w / 900, 0.55, 1);
            title.scale.set(s);
            title.position.set(w / 2, h * 0.24);
            subtitle.position.set(w / 2, h * 0.24 + 70 * s);
            info.scale.set(clamp(w / 700, 0.7, 1));
            info.position.set(w / 2, h * 0.5);
            button.position.set(w / 2, h * 0.76);
        };
        layout();
        window.addEventListener('resize', layout);

        let started = false;
        const start = () => {
            if (started) return;
            started = true;
            window.removeEventListener('resize', layout);
            window.removeEventListener('keydown', onKey);
            app.stage.removeChild(screen);
            screen.destroy({ children: true });
            this.bindEvents();
            this.init();
        };
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') start(); };
        window.addEventListener('keydown', onKey);
        button.on('pointerdown', (e) => { e.stopPropagation(); start(); });

        // gentle idle animation
        const idle = () => {
            if (started) { app.ticker.remove(idle); return; }
            title.y = h(app) * 0.24 + Math.sin(this.frame * 0.03) * 4;
        };
        const h = (a) => a.screen.height;
        app.ticker.add(idle);
    }

    bindEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;
        window.addEventListener('keydown', (e) => {
            if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
            gameState.keys[e.key] = true;
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
    clearEntities() {
        const s = this.state;
        s.enemies.forEach((e) => EntityManager.cleanup(e));
        s.gems.forEach((g) => EntityManager.cleanup(g));
        if (s.player) EntityManager.cleanup(s.player);
        this.weapons.reset();
        this.fx.clear();
    }

    init() {
        this.clearEntities();
        gameState.reset();
        this.bossCount = 0;
        this.frame = 0;

        this.app.ticker.remove(this.menuTicker);
        if (this.gameTicker) this.app.ticker.remove(this.gameTicker);

        this.world.reset();
        const player = EntityManager.createPlayer();
        const spot = this.world.findFree(0, 0, player.radius + 2);
        player.wx = spot.x;
        player.wy = spot.y;
        player.facing = 1;
        this.objectLayer.addChild(player);
        EntityManager.place(player);
        gameState.player = player;

        this.weapons.acquire('bolt');
        this.stats = computeStats({});
        gameState.maxHealth = this.stats.maxHealth;
        gameState.health = gameState.maxHealth;
        gameState.nextLevel = xpForLevel(1);

        this.cam.x = player.wx;
        this.cam.y = player.wy;
        this.applyCamera();
        this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height, true);

        this.ui.setHUDVisible(true);
        this.ui.shown = { hp: -1, xp: -1, level: -1, slots: '' };
        this.ui.displayHp = gameState.health;
        this.ui.displayXp = 0;

        this.gameTicker = (delta) => this.gameLoop(delta);
        this.app.ticker.add(this.gameTicker);
    }

    // ------------------------------------------------------------ game loop
    gameLoop(rawDelta) {
        const s = this.state;
        if (s.gameOver) {
            this.fx.update(rawDelta);
            this.applyCamera();
            this.world.animate(rawDelta);
            return;
        }
        if (s.levelUp || s.paused) return;

        const delta = Math.min(rawDelta, 2.5);
        this.frame += delta;
        s.time += delta / 60;

        this.movePlayer(delta);
        this.weapons.update(delta);
        this.updateEnemies(delta);
        this.updateGems(delta);
        this.regen(delta);
        this.fx.update(delta);
        this.reap();
        this.syncVisuals(delta);
        this.updateCamera(delta);
        this.world.update(this.cam.x, this.cam.y, this.app.screen.width, this.app.screen.height);
        this.world.animate(delta);
        this.ui.update(this, delta);

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

        let moving = false;
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            if (!analog || len > 1) { dx /= len; dy /= len; }
            // Screen-space feel: vertical ground speed is boosted to offset the tilt
            const inShallows = this.world.biomeAtPos(player.wx, player.wy) === BIOME.SHALLOW;
            const speed = this.state.playerSpeed * this.stats.speed * delta * (inShallows ? 0.72 : 1);
            this.world.tryMove(player, dx * speed, dy * speed * 1.2, player.radius);
            moving = true;
            if (Math.abs(dx) > 0.15) player.facing = dx > 0 ? 1 : -1;
        }
        player.moving = moving;
    }

    regen(delta) {
        const s = this.state;
        if (this.stats.regen > 0 && s.health < s.maxHealth) {
            s.health = Math.min(s.maxHealth, s.health + (this.stats.regen / 60) * delta);
        }
    }

    hurtPlayer(amount) {
        const s = this.state;
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
        this.spawnEnemies(delta);

        const list = s.enemies;
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (e.dead) continue;
            const dx = p.wx - e.wx, dy = p.wy - e.wy;
            const dist = Math.hypot(dx, dy) || 1;

            if (dist > SPAWN_CONFIG.despawnDistance) { e.dead = true; e.silent = true; continue; }

            let mul = 1 + clamp((dist - 520) / 500, 0, 1.6);
            if (this.frame < e.slowUntil) mul *= 1 - e.slowAmount;
            if (!e.flying && this.world.biomeAtPos(e.wx, e.wy) === BIOME.SHALLOW) mul *= 0.8;

            const step = e.speed * mul * delta;
            const vx = (dx / dist) * step + e.kvx * delta;
            const vy = (dy / dist) * step + e.kvy * delta;
            e.kvx *= Math.pow(0.86, delta);
            e.kvy *= Math.pow(0.86, delta);
            if (e.flying) { e.wx += vx; e.wy += vy; } else this.world.tryMove(e, vx, vy, e.radius * 0.8);
            if (Math.abs(dx) > 4) e.facing = dx > 0 ? 1 : -1;

            // soft separation so packs don't stack into a single blob
            for (let j = i + 1; j < list.length; j++) {
                const o = list[j];
                if (o.dead) continue;
                const ox = o.wx - e.wx, oy = o.wy - e.wy;
                const min = (e.radius + o.radius) * 0.8;
                if (Math.abs(ox) > min || Math.abs(oy) > min) continue;
                const d = Math.hypot(ox, oy) || 0.01;
                if (d >= min) continue;
                const push = (min - d) * 0.2 * delta;
                const nx = ox / d * push, ny = oy / d * push;
                if (e.flying) { e.wx -= nx; e.wy -= ny; } else this.world.tryMove(e, -nx, -ny, e.radius * 0.8);
                if (o.flying) { o.wx += nx; o.wy += ny; } else this.world.tryMove(o, nx, ny, o.radius * 0.8);
            }

            // contact damage
            const touch = e.radius + p.radius;
            if (dist < touch) this.hurtPlayer(e.damage * (delta / 60));
        }
    }

    pickEnemyType(level) {
        const options = Object.entries(ENEMY_TYPES).filter(([, t]) => !t.boss && t.minLevel <= level);
        const total = options.reduce((sum, [, t]) => sum + t.weight, 0);
        let roll = Math.random() * total;
        for (const [key, t] of options) {
            roll -= t.weight;
            if (roll <= 0) return key;
        }
        return options[0][0];
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

    scaleEnemy(e, type) {
        const ls = this.state.level - 1;
        e.health = e.maxHealth = type.health * Math.pow(LEVEL_SCALING.enemyHealthScale, ls);
        e.speed = type.speed * Math.min(LEVEL_SCALING.enemySpeedCap, Math.pow(LEVEL_SCALING.enemySpeedScale, ls));
        e.damage = type.damage * Math.pow(LEVEL_SCALING.enemyDamageScale, ls);
        e.experienceValue = Math.max(1, Math.round(type.experience * (1 + LEVEL_SCALING.experienceScale * ls)));
    }

    spawnEnemies(delta) {
        const s = this.state;
        const max = Math.min(SPAWN_CONFIG.maxCap, SPAWN_CONFIG.baseMax + SPAWN_CONFIG.maxPerLevel * s.level);
        if (s.enemies.length >= max) return;
        const rate = SPAWN_CONFIG.baseRate * (1 + SPAWN_CONFIG.rateGrowth * (s.level - 1)) * (1 + s.time / 500);
        if (Math.random() >= rate * delta) return;

        const group = s.level >= 3 && Math.random() < 0.12 ? 2 + Math.floor(Math.random() * 3) : 1;
        const key = this.pickEnemyType(s.level);
        const type = ENEMY_TYPES[key];
        const origin = this.spawnPoint(type.flying);
        if (!origin) return;
        for (let i = 0; i < group && s.enemies.length < max; i++) {
            const x = origin.x + (i ? (Math.random() - 0.5) * 90 : 0);
            const y = origin.y + (i ? (Math.random() - 0.5) * 90 : 0);
            if (!type.flying && this.world.blocked(x, y, type.radius)) continue;
            const e = EntityManager.createEnemy(key, x, y);
            this.scaleEnemy(e, type);
            const eliteChance = s.level >= 3 ? Math.min(0.2, SPAWN_CONFIG.eliteChance + 0.004 * s.level) : 0;
            if (Math.random() < eliteChance) {
                const m = SPAWN_CONFIG.eliteModifiers;
                EntityManager.markElite(e);
                e.health = e.maxHealth = e.health * m.health;
                e.experienceValue = Math.round(e.experienceValue * m.experience);
                e.speed *= m.speed;
                e.damage *= m.damage;
            }
            this.objectLayer.addChild(e);
            EntityManager.place(e);
            s.enemies.push(e);
        }
    }

    spawnBoss() {
        const s = this.state;
        const p = s.player;
        const type = ENEMY_TYPES.BOSS;
        const pt = this.spawnPoint(false) || { x: p.wx + 700, y: p.wy };
        const e = EntityManager.createEnemy('BOSS', pt.x, pt.y);
        this.scaleEnemy(e, type);
        e.health = e.maxHealth = e.health * (1 + this.bossCount * 0.6);
        e.isBoss = true;
        this.bossCount++;
        this.objectLayer.addChild(e);
        EntityManager.place(e);
        s.enemies.push(e);
        this.ui.banner('⚠  A WARLORD APPROACHES  ⚠', 0xff5a5a);
        this.fx.addShake(6);
    }

    damageEnemy(e, amount, opts = {}) {
        if (e.dead) return;
        const crit = !opts.noCrit && Math.random() < this.stats.crit;
        const dmg = amount * (crit ? 2 : 1);
        e.health -= dmg;
        e.hitFlash = 6;
        this.fx.popup(e.wx, e.wy, Math.round(dmg), crit ? 0xffd84a : (opts.color || 0xffffff), crit ? 24 : 16, e.baseHeight + 8);

        const k = opts.knock;
        if (k) {
            const len = Math.hypot(k.x, k.y) || 1;
            const resist = e.type === 'BOSS' ? 0.25 : e.type === 'TANK' ? 0.6 : 1;
            e.kvx += (k.x / len) * k.force * resist;
            e.kvy += (k.y / len) * k.force * resist;
        }
        if (e.health <= 0) this.killEnemy(e);
    }

    killEnemy(e) {
        if (e.dead) return;
        e.dead = true;
        const s = this.state;
        s.kills++;
        s.score += e.experienceValue * 2;
        const type = ENEMY_TYPES[e.type];
        this.fx.death(e.wx, e.wy, type.color, !!e.isBoss);

        if (e.isBoss) {
            s.bossesDefeated++;
            for (let i = 0; i < 10; i++) {
                this.dropGem(e.wx + (Math.random() - 0.5) * 120, e.wy + (Math.random() - 0.5) * 90, Math.ceil(e.experienceValue / 6));
            }
            this.dropGem(e.wx, e.wy + 20, 0, 'heart');
            this.dropGem(e.wx + 30, e.wy, 0, 'heart');
            this.fx.addShake(12);
            this.ui.banner('WARLORD DEFEATED!', 0xffd84a);
        } else {
            this.dropGem(e.wx, e.wy, e.experienceValue);
            if (Math.random() < (e.elite ? 0.12 : 0.025)) this.dropGem(e.wx + 14, e.wy + 6, 0, 'heart');
        }
    }

    dropGem(x, y, value, kind = 'gem') {
        const s = this.state;
        // keep the number of gems bounded: the oldest one is absorbed immediately
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

    applyChoice(choice) {
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

        s.experience = Math.max(0, s.experience - s.nextLevel);
        s.level++;
        s.nextLevel = xpForLevel(s.level);
        s.levelUp = false;
        s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.1);
        this.ui.displayXp = s.experience;
        this.ui.shown.slots = '';

        // Level-up shockwave gives breathing room
        const p = s.player;
        for (const e of s.enemies) {
            const dx = e.wx - p.wx, dy = e.wy - p.wy;
            if (dx * dx + dy * dy < 260 * 260) e.kvx += (dx / (Math.hypot(dx, dy) || 1)) * 10, e.kvy += (dy / (Math.hypot(dx, dy) || 1)) * 10;
        }
        this.fx.burst(p.wx, p.wy, 10, 0xffe27a, 30, 5, { size: 0.9, life: 34, up: 3 });
        this.fx.addShake(5);

        if (s.level % SPAWN_CONFIG.bossEvery === 0) this.spawnBoss();
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
    showGameOver() {
        const s = this.state;
        if (s.gameOver) return;
        s.gameOver = true;
        s.health = 0;
        s.pointerDown = false;
        this.ui.update(this, 1);
        this.fx.death(s.player.wx, s.player.wy, 0x6aa8ff, true);
        s.player.visible = false;

        const { app } = this;
        const screen = new PIXI.Container();
        screen.zIndex = 3000;
        screen.eventMode = 'static';
        screen.alpha = 0;
        app.stage.addChild(screen);

        const dim = new PIXI.Graphics();
        const title = new PIXI.Text('YOU DIED', {
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
            ['Time survived', this.formatTime(s.time)],
            ['Level reached', `${s.level}`],
            ['Enemies defeated', `${s.kills}`],
            ['Score', `${Math.floor(s.score)}`]
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

        const button = new PIXI.Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';
        const bg = new PIXI.Graphics();
        const drawButton = (hover) => {
            bg.clear();
            bg.beginFill(hover ? 0x5fe28a : 0x3fcf6a);
            bg.lineStyle(3, 0xd9ffe6, 0.9);
            bg.drawRoundedRect(-120, -28, 240, 56, 16);
            bg.endFill();
        };
        drawButton(false);
        const label = new PIXI.Text('PLAY AGAIN', { fontFamily: FONT, fontSize: 26, fontWeight: 'bold', fill: 0x0b2a14, letterSpacing: 2 });
        label.anchor.set(0.5);
        button.addChild(bg, label);
        button.on('pointerover', () => { drawButton(true); button.scale.set(1.06); });
        button.on('pointerout', () => { drawButton(false); button.scale.set(1); });

        screen.addChild(dim, title, panel, button);

        const layout = () => {
            const w = app.screen.width, h = app.screen.height;
            dim.clear();
            dim.beginFill(0x120404, 0.72);
            dim.drawRect(0, 0, w, h);
            dim.endFill();
            const sc = clamp(w / 800, 0.55, 1);
            title.scale.set(sc);
            title.position.set(w / 2, h * 0.2);
            panel.position.set(w / 2, h * 0.47);
            button.position.set(w / 2, h * 0.47 + 165);
        };
        layout();
        window.addEventListener('resize', layout);

        const fade = (d) => {
            screen.alpha = Math.min(1, screen.alpha + 0.04 * d);
            if (screen.alpha >= 1) app.ticker.remove(fade);
        };
        app.ticker.add(fade);

        let done = false;
        const restart = () => {
            if (done || screen.alpha < 0.6) return;
            done = true;
            app.ticker.remove(fade);
            window.removeEventListener('resize', layout);
            window.removeEventListener('keydown', onKey);
            app.stage.removeChild(screen);
            screen.destroy({ children: true });
            this.init();
        };
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') restart(); };
        window.addEventListener('keydown', onKey);
        button.on('pointerdown', (e) => { e.stopPropagation(); restart(); });
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
}

window.game = new Game();
