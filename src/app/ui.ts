// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import * as PIXI from 'pixi.js';
import { access } from './access';
import { RARITY, LIMITS } from '../core/config';
import { gameState } from './gameState';
import { ui as uiBridge } from '../ui/bridge';
import { glyph, localize } from '../ui/hints';
import { TEMPLATES, CORE_INFO } from '../core/spells/spells';
import { CARDS } from '../core/hero/stats';

import { WORLD_CONFIG } from '../core/config';
import { IconLabel, iconSprite } from '../render/icons';
const WORLD_T = WORLD_CONFIG.tile;
import { FONT_UI as FONT, FONT_DISPLAY as DISPLAY } from '../ui/fonts';
import { settings } from './settings';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HUD_CARDS = 8;          // card icons on the HUD row before "+N"

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class UIManager {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.zIndex = 1000;  // Keep UI on top
        app.stage.addChild(this.container);
        this.elements = {};
        this.shown = { hp: -1, xp: -1, level: -1, slots: '' };
        this.displayHp = 100;
        this.displayXp = 0;
        this.damageFlash = 0;
        this.previousLevel = 1;

        this.createHUD();
        this.createJoystick();

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.game && this.game.input) this.game.input.escape();
        });
        // Pixi resizes the canvas on the next animation frame after the window changes; the renderer's own
        // 'resize' event fires after that, when app.screen holds the new size (a window listener would read the old one)
        app.renderer.on('resize', () => this.layoutHUD());

        app.stage.sortableChildren = true;
        this.layoutHUD();
    }

    // ------------------------------------------------------------------ HUD
    createHUD() {
        const hud = new PIXI.Container();
        this.hud = hud;
        this.container.addChild(hud);

        // Damage / low-health vignette
        this.vignette = new PIXI.Graphics();
        this.vignette.eventMode = 'none';
        this.container.addChildAt(this.vignette, 0);

        // Experience bar across the top
        this.xpBar = new PIXI.Graphics();
        this.elements.levelText = new PIXI.Text('LV 1', {
            fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: 0xffffff, stroke: 0x000000, strokeThickness: 3
        });
        this.elements.levelText.position.set(10, 1);
        this.elements.xpText = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 11, fontWeight: 'bold', fill: 0xdad6ff, stroke: 0x000000, strokeThickness: 3
        });
        this.elements.xpText.anchor.set(0.5, 0);
        this.elements.xpText.y = 2;

        // Health panel
        this.panel = new PIXI.Graphics();
        this.panel.beginFill(0x0a0e18, 0.72);
        this.panel.lineStyle(1.5, 0xd9a440, 0.55);
        this.panel.drawRoundedRect(0, 0, 268, 64, 12);
        this.panel.endFill();
        this.panel.position.set(12, 26);

        this.hpBar = new PIXI.Graphics();
        this.hpBar.position.set(40, 10);
        this.elements.heart = iconSprite('heart', 24);
        this.elements.heart.position.set(21, 20);
        this.elements.healthText = new PIXI.Text('100/100', {
            fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: 0xffffff, stroke: 0x000000, strokeThickness: 3
        });
        this.elements.healthText.anchor.set(0.5);
        this.elements.healthText.position.set(40 + 110, 10 + 10);
        // time, kills and score, each behind its icon
        const statStyle = { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', fill: 0xe6e9f2, stroke: 0x000000, strokeThickness: 3 };
        this.elements.stats = [['timer', 0xe6e9f2], ['skull', undefined], ['star', 0xffd84a]].map(([icon, color]) => {
            const l = new IconLabel(icon, '', statStyle, 16, 4, 0);
            l.iconColor = color;
            l.y = 48;
            return l;
        });
        this.panel.addChild(this.hpBar, this.elements.heart, this.elements.healthText, ...this.elements.stats);

        // Weapon / passive inventory
        this.slotsContainer = new PIXI.Container();
        this.slotsContainer.position.set(12, 98);
        this.elements.statsText = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 12, fill: 0xb8c0d4, stroke: 0x000000, strokeThickness: 3, lineHeight: 16
        });

        // Banner
        this.elements.banner = new IconLabel('', '', {
            fontFamily: DISPLAY, fontSize: 40, fontWeight: 'bold', fill: 0xffffff,
            stroke: 0x000000, strokeThickness: 6, dropShadow: true, dropShadowDistance: 4, dropShadowAlpha: 0.6
        }, 44, 12);
        this.elements.banner.visible = false;
        this.bannerTimer = 0;

        hud.addChild(this.xpBar, this.elements.levelText, this.elements.xpText, this.panel,
            this.slotsContainer, this.elements.statsText, this.elements.banner);

        // Settings button in the top right
        const settingsButton = new PIXI.Container();
        const settingsIcon = iconSprite('settings', 24, 0xe6e9f2);
        const settingsBg = new PIXI.Graphics();
        const drawBg = (alpha) => {
            settingsBg.clear();
            settingsBg.beginFill(0x0a0e18, alpha);
            settingsBg.lineStyle(1, 0xffffff, 0.2);
            settingsBg.drawCircle(0, 0, 20);
            settingsBg.endFill();
        };
        drawBg(0.6);
        settingsButton.addChild(settingsBg, settingsIcon);
        settingsButton.eventMode = 'static';
        settingsButton.cursor = 'pointer';
        settingsButton.on('pointerdown', (e) => { e.stopPropagation(); this.toggleMenu(); });
        settingsButton.on('pointerover', () => drawBg(0.9));
        settingsButton.on('pointerout', () => drawBg(0.6));
        this.settingsButton = settingsButton;
        hud.addChild(settingsButton);

        this.createExtras();
        this.setHUDVisible(false);
    }

    setHUDVisible(visible) {
        this.container.visible = visible;
    }

    /** Phones and small windows get a smaller HUD; the DOM side uses the same breakpoints (see ui/style.ts). */
    get compact() {
        return this.app.screen.width < 900 || this.app.screen.height < 600;
    }

    layoutHUD() {
        const w = this.app.screen.width, h = this.app.screen.height;
        const k = (this.compact ? 0.8 : 1) * Math.min(1.3, access.textScale) * settings.hudScale;
        this.hudScale = k;
        this.toastText.scale.set(access.textScale);
        this.prompt.scale.set(access.textScale);
        this.panel.scale.set(k);
        this.panel.position.set(12, k < 1 ? 24 : 26);
        this.slotsContainer.scale.set(k);
        this.slotsContainer.position.set(12, this.panel.y + 64 * k + 8);
        this.settingsButton.position.set(w - 34, 50);
        this.elements.xpText.x = w / 2;
        this.elements.banner.position.set(w / 2, h * 0.24);
        this.layoutExtras();
        this.shown.xp = -1; // force redraw of the wide bar
        this.drawVignette(this.vigAlpha || 0);
    }

    drawBar(g, w, h, frac, c1, c2) {
        g.clear();
        g.beginFill(0x000000, 0.55);
        g.drawRoundedRect(0, 0, w, h, h / 2);
        g.endFill();
        frac = clamp(frac, 0, 1);
        if (frac > 0) {
            const fw = Math.max(h, w * frac);
            g.beginFill(c1);
            g.drawRoundedRect(0, 0, fw, h, h / 2);
            g.endFill();
            g.beginFill(c2, 0.85);
            g.drawRoundedRect(2, 2, Math.max(0, fw - 4), h * 0.42, h * 0.2);
            g.endFill();
        }
        g.lineStyle(1, 0xffffff, 0.25);
        g.drawRoundedRect(0, 0, w, h, h / 2);
    }

    drawVignette(alpha) {
        const w = this.app.screen.width, h = this.app.screen.height;
        this.vignette.clear();
        if (alpha <= 0.01) return;
        const steps = 6;
        for (let i = 0; i < steps; i++) {
            const inset = i * Math.min(w, h) * 0.05;
            this.vignette.lineStyle(Math.min(w, h) * 0.05 + 1, 0xff1a1a, alpha * (1 - i / steps) * 0.55);
            this.vignette.drawRect(inset + 0, inset, w - inset * 2, h - inset * 2);
        }
    }

    flashDamage() {
        this.damageFlash = (access.reducedMotion ? 0.35 : 1) * settings.flash;
    }

    /** A big centred announcement, with an optional icon before it. */
    banner(text, color = 0xffffff, icon = '') {
        this.logMessage(text, icon, true);
        const b = this.elements.banner;
        b.text.style.fill = color;
        b.set(icon, text);
        b.visible = true;
        b.alpha = 1;
        b.scale.set(access.reducedMotion ? 1 : 0.4);
        this.bannerTimer = 150;
    }

    // Called every frame from the game loop
    update(game, delta) {
        const s = game.state;
        this.displayHp += (s.health - this.displayHp) * Math.min(1, 0.25 * delta);
        this.displayXp += (s.experience - this.displayXp) * Math.min(1, 0.25 * delta);

        const hp = Math.round(this.displayHp * 2) / 2;
        const key = `${hp}|${s.maxHealth}`;
        if (key !== this.shown.hpKey) {
            this.shown.hpKey = key;
            const frac = this.displayHp / s.maxHealth;
            this.drawBar(this.hpBar, 220, 20, frac,
                frac < 0.3 ? 0xd83a3a : 0x3fcf62, frac < 0.3 ? 0xff8a8a : 0x9dffb4);
            this.elements.healthText.text = `${Math.ceil(s.health)} / ${s.maxHealth}`;
        }

        const w = this.app.screen.width;
        const xpKey = `${Math.round(this.displayXp * 4)}|${s.nextLevel}|${w}`;
        if (xpKey !== this.shown.xpKey) {
            this.shown.xpKey = xpKey;
            this.drawBar(this.xpBar, w, 18, this.displayXp / s.nextLevel, 0x7a4dff, 0xc3adff);
            this.elements.xpText.text = `${Math.floor(s.experience)} / ${s.nextLevel} XP`;
        }
        if (s.level !== this.shown.level) {
            this.elements.levelText.text = `LV ${s.level}`;
            if (this.shown.level > 0) this.createFlashEffect(this.elements.levelText);
            this.shown.level = s.level;
        }

        const stat = `${formatTime(s.time)}|${s.kills}|${Math.floor(s.score)}`;
        if (stat !== this.shown.stat) {
            this.shown.stat = stat;
            const vals = stat.split('|');
            let x = 12;
            this.elements.stats.forEach((l, i) => { l.set(['timer', 'skull', 'star'][i], vals[i], l.iconColor); l.x = x; x += l.width + 14; });
        }

        this.updateSlots(game);

        // damage vignette + low health pulse
        this.damageFlash = Math.max(0, this.damageFlash - 0.05 * delta);
        const low = s.health / s.maxHealth < 0.3 ? 0.35 + 0.25 * Math.sin(game.frame * 0.12) : 0;
        const vig = Math.max(this.damageFlash, low);
        if (Math.abs(vig - (this.vigAlpha || 0)) > 0.02) {
            this.vigAlpha = vig;
            this.drawVignette(vig);
        }

        this.updateExtras(game, delta);

        // banner animation
        if (this.bannerTimer > 0) {
            this.bannerTimer -= delta;
            const b = this.elements.banner;
            b.scale.set(Math.min(1, b.scale.x + 0.1 * delta));
            if (this.bannerTimer < 30) b.alpha = Math.max(0, this.bannerTimer / 30);
            if (this.bannerTimer <= 0) b.visible = false;
        }
    }

    updateSlots(game) {
        const s = game.state;
        const sig = game.spells.auto.map((u) => { const it = game.spells.item(u); return it ? it.tpl + it.level : ''; }).join(',') + '|' +
            Object.entries(s.picks).map(([k, v]) => k + v).join(',');
        if (sig === this.shown.slots) return;
        this.shown.slots = sig;

        this.slotsContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
        const drawSlot = (x, y, icon, level, max, color) => {
            const c = new PIXI.Container();
            c.position.set(x, y);
            const bg = new PIXI.Graphics();
            bg.beginFill(0x0a0e18, 0.7);
            bg.lineStyle(2, color, level >= max ? 1 : 0.55);
            bg.drawRoundedRect(0, 0, 40, 40, 9);
            bg.endFill();
            const t = iconSprite(icon, 26);
            t.position.set(20, 19);
            const lv = new PIXI.Text(level >= max ? 'MAX' : `${level}`, {
                fontFamily: FONT, fontSize: 11, fontWeight: 'bold', fill: level >= max ? 0xffd84a : 0xffffff,
                stroke: 0x000000, strokeThickness: 3
            });
            lv.anchor.set(1, 1);
            lv.position.set(38, 39);
            c.addChild(bg, t, lv);
            this.slotsContainer.addChild(c);
        };
        game.spells.auto.map((u) => game.spells.item(u)).filter(Boolean).forEach((it, i) => {
            const t = TEMPLATES[it.tpl];
            drawSlot(i * 44, 0, t.icon, it.level, t.max, CORE_INFO[t.core].color);
        });
        const autoRow = game.spells.auto.length ? 1 : 0;
        // the eight highest ranks, then "+N" (the game menu's Party page lists every one)
        const picks = Object.entries(s.picks).filter(([id, lvl]) => CARDS[id] && lvl > 0).sort((a, b) => b[1] - a[1]);
        picks.slice(0, HUD_CARDS).forEach(([id, lvl], i) => {
            drawSlot(i * 44, autoRow * 44, CARDS[id].icon, lvl, CARDS[id].max, CARDS[id].mastery ? 0xffd84a : 0x7be07b);
        });
        if (picks.length > HUD_CARDS) {
            const more = new PIXI.Text(`+${picks.length - HUD_CARDS}`, { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', fill: 0xdfe6f2, stroke: 0x000000, strokeThickness: 3 });
            more.anchor.set(0, 0.5);
            more.position.set(HUD_CARDS * 44 + 2, autoRow * 44 + 20);
            this.slotsContainer.addChild(more);
        }
        this.slotRows = autoRow + (picks.length ? 1 : 0);
        this.publishHudTop();

        const st = game.stats;
        this.elements.statsText.visible = false;   // detailed numbers live in the spell panel / tooltips
        this.elements.statsText.position.set(12, 98 + (picks.length ? 92 : 48));
        this.elements.statsText.text =
            `Damage ×${st.might.toFixed(2)}   Speed ×${st.speed.toFixed(2)}\n` +
            `Crit ${Math.round(st.crit * 100)}%   Armour ${Math.round(st.armor * 100)}%   Regen ${st.regen.toFixed(1)}/s`;
    }


    // --------------------------------------------- minimap, prompt, zone name, boss bar, map
    createExtras() {
        const hud = this.hud;

        // minimap
        this.mapBox = new PIXI.Container();
        this.mapFrame = new PIXI.Graphics();
        // gilded frame with corner studs and a north plaque, matching the title screen
        const mf = this.mapFrame;
        mf.beginFill(0x000000, 0.35); mf.drawRoundedRect(-5, -3, 182, 182, 16); mf.endFill();
        mf.beginFill(0x0e1220, 0.95);
        mf.lineStyle(2.5, 0xd9a440, 1);
        mf.drawRoundedRect(-7, -7, 184, 184, 16);
        mf.endFill();
        mf.lineStyle(1, 0x5a3a10, 0.9);
        mf.drawRoundedRect(-2, -2, 174, 174, 13);
        mf.lineStyle(0);
        mf.beginFill(0xf3c75a);
        for (const [x, y] of [[-4, -4], [174, -4], [-4, 174], [174, 174]]) mf.drawPolygon([x, y - 5, x + 5, y, x, y + 5, x - 5, y]);
        mf.endFill();
        mf.lineStyle(1.5, 0xd9a440, 1);
        mf.beginFill(0x0e1220);
        mf.drawRoundedRect(73, -15, 24, 16, 5);
        mf.endFill();
        mf.lineStyle(0);
        const north = new PIXI.Text('N', { fontFamily: DISPLAY, fontSize: 12, fontWeight: 'bold', fill: 0xf3c75a });
        north.anchor.set(0.5);
        north.position.set(85, -7);
        mf.addChild(north);
        this.mapTexture = null;
        this.mapSprite = new PIXI.Sprite();
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff); mask.drawRoundedRect(0, 0, 170, 170, 12); mask.endFill();
        this.mapSprite.mask = mask;
        this.mapZone = new IconLabel('', '', {
            fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: 0xffffff, stroke: 0x000000, strokeThickness: 3
        }, 15, 4, 1);
        this.mapZone.position.set(172, 187);
        const hint = new PIXI.Text('[M] world map', { fontFamily: FONT, fontSize: 11, fill: 0xaab4cc, stroke: 0x000000, strokeThickness: 3 });
        this.mapHint = hint;
        hint.anchor.set(0.5, 0);
        hint.position.set(85, 196);
        this.mapBox.addChild(this.mapFrame, this.mapSprite, mask, this.mapZone, hint);
        this.mapBox.eventMode = 'static';
        this.mapBox.cursor = 'pointer';
        this.mapBox.on('pointerdown', (e) => { e.stopPropagation(); if (this.onMapToggle) this.onMapToggle(); });
        hud.addChild(this.mapBox);

        // interaction prompt
        this.prompt = new PIXI.Container();
        const pbg = new PIXI.Graphics();
        this.promptBg = pbg;
        this.promptText = new PIXI.Text('', { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', fill: 0xffffff });
        this.promptText.anchor.set(0.5);
        this.prompt.addChild(pbg, this.promptText);
        this.prompt.eventMode = 'static';
        this.prompt.cursor = 'pointer';
        this.prompt.on('pointerdown', (e) => { e.stopPropagation(); if (this.onInteract) this.onInteract(); });
        this.prompt.visible = false;
        this.promptKey = '';
        hud.addChild(this.prompt);

        // zone name banner
        this.zoneText = new IconLabel('', '', {
            fontFamily: DISPLAY, fontSize: 30, fontWeight: 'bold', fill: 0xffffff, stroke: 0x000000, strokeThickness: 6,
            dropShadow: true, dropShadowDistance: 3, dropShadowAlpha: 0.6, letterSpacing: 2
        }, 34, 10);
        this.zoneText.visible = false;
        this.zoneTimer = 0;
        hud.addChild(this.zoneText);

        // boss bar
        this.bossBox = new PIXI.Container();
        this.bossName = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 16, fontWeight: 'bold', fill: 0xffe8e8, stroke: 0x000000, strokeThickness: 4, letterSpacing: 2
        });
        this.bossName.anchor.set(0.5, 1);
        this.bossBar = new PIXI.Graphics();
        this.bossBox.addChild(this.bossName, this.bossBar);
        this.bossBox.visible = false;
        this.bossShown = -1;
        hud.addChild(this.bossBox);

        // full screen fade (used when entering / leaving places)
        this.fadeG = new PIXI.Graphics();
        this.fadeG.zIndex = 10;
        this.fadeAlpha = 0;
        this.fadeTarget = 0;
        this.fadeSpeed = 0.06;
        this.fadeCb = null;
        this.fadeG.eventMode = 'none';
        this.container.addChild(this.fadeG);
        this.container.sortableChildren = true;

        // small non-blocking message (saves, discoveries)
        this.toastText = new IconLabel('', '', {
            fontFamily: FONT, fontSize: 14, fontWeight: 'bold', fill: 0xdfe8ff, stroke: 0x000000, strokeThickness: 4
        }, 18, 6, 0);
        this.toastText.visible = false;
        this.toastTimer = 0;
        hud.addChild(this.toastText);
    }

    /** A small message at the bottom left, with an optional icon. */
    toast(text, icon = '') {
        this.logMessage(text, icon, false);
        this.toastText.set(icon, text);
        this.toastText.visible = true;
        this.toastText.alpha = 1;
        this.toastTimer = 150;
    }

    /** Keep the last 50 messages for the journal's log (a repeat within two seconds is not logged again). */
    logMessage(text, icon, big) {
        const log = uiBridge.log.value;
        const t = gameState.time || 0;
        const last = log[log.length - 1];
        if (last && last.text === text && t - last.t < 2) return;
        uiBridge.log.value = [...log.slice(-49), { t, text, icon, big }];
    }

    /** Where the DOM column (tracker, party) may start: just below the canvas health panel and spell slots. */
    publishHudTop() {
        const k = this.hudScale || 1;
        const top = Math.round(this.slotsContainer.y + (this.slotRows || 0) * 44 * k + 6);
        if (top !== this.hudTop) {
            this.hudTop = top;
            document.documentElement.style.setProperty('--hud-top', `${top}px`);
        }
    }

    layoutExtras() {
        const w = this.app.screen.width, h = this.app.screen.height;
        const mk = (this.compact ? 0.62 : 1) * (this.minimapScale || 1);
        this.mapBox.scale.set(mk);
        this.mapBox.position.set(w - 12 - 177 * mk, mk < 1 ? 76 : 92);
        // the zone name stays readable: keep its size and right-align it under the map so it never runs off screen
        this.mapZone.scale.set(1 / mk);
        this.mapZone.x = 172;
        this.mapHint.visible = mk === 1;
        this.publishHudTop();
        this.toastText.position.set(14, h - 24);
        this.prompt.position.set(w / 2, h - 120);
        this.zoneText.position.set(w / 2, h * 0.16);
        this.bossBox.position.set(w / 2, 62);
        this.bossShown = -1;
        this.drawFade();
    }

    drawFade() {
        const w = this.app.screen.width, h = this.app.screen.height;
        this.fadeG.clear();
        this.fadeG.beginFill(0x000000, 1);
        this.fadeG.drawRect(0, 0, w, h);
        this.fadeG.endFill();
        this.fadeG.alpha = this.fadeAlpha;
    }

    fade(target, speed = 0.06, cb = null) {
        this.fadeTarget = target;
        this.fadeSpeed = speed;
        this.fadeCb = cb;
        this.fadeG.visible = true;
    }

    setPrompt(text) {
        if (!text) { this.prompt.visible = false; this.promptKey = ''; return; }
        text = localize(text);
        this.prompt.visible = true;
        if (text === this.promptKey) return;
        this.promptKey = text;
        this.promptText.text = text;
        const w = this.promptText.width + 44, h = 44;
        this.promptBg.clear();
        this.promptBg.beginFill(0x0a0e18, 0.88);
        this.promptBg.lineStyle(2, 0xffd84a, 0.9);
        this.promptBg.drawRoundedRect(-w / 2, -h / 2, w, h, 14);
        this.promptBg.endFill();
    }

    showZone(name, icon, color) {
        this.zoneText.text.style.fill = color;
        this.zoneText.set(icon, name);
        this.zoneText.visible = true;
        this.zoneText.alpha = 0;
        this.zoneTimer = 190;
    }

    updateExtras(game, delta) {
        // minimap refreshes a few times per second
        if (game.map.dirty || game.frame - (this.lastMapDraw || -99) > 7) {
            this.lastMapDraw = game.frame;
            game.map.dirty = false;
            const p = game.state.player;
            game.map.updateMinimap(p.wx, p.wy, game.frame, game.world.bounded ? 3 : 2);
            if (!this.mapTexture) {
                this.mapTexture = PIXI.Texture.from(game.map.minimap);
                this.mapSprite.texture = this.mapTexture;
            } else {
                this.mapTexture.baseTexture.update();
            }
        }
        const zoneName = (game.zoneIcon || '') + '|' + (game.zoneLabel || '');
        if (zoneName !== this.shownZone) {
            this.shownZone = zoneName;
            this.mapZone.set(game.zoneIcon || '', game.zoneLabel || '');
        }

        if (this.zoneTimer > 0) {
            this.zoneTimer -= delta;
            const t = this.zoneTimer;
            this.zoneText.alpha = Math.min(1, (190 - t) / 25, t / 40);
            this.zoneText.y = this.app.screen.height * 0.16 + (t < 40 ? (40 - t) * -0.4 : 0);
            if (t <= 0) this.zoneText.visible = false;
        }

        // warlord health bar
        const boss = game.state.enemies.find((e) => e.isBoss && !e.dead);
        if (boss) {
            this.bossBox.visible = true;
            const frac = Math.max(0, boss.health / boss.maxHealth);
            const key = Math.round(frac * 200) + boss.type;
            if (key !== this.bossShown) {
                this.bossShown = key;
                this.bossName.text = boss.enraged ? `${boss.bossName} — ENRAGED` : boss.bossName;
                this.drawBar(this.bossBar, 340, 14, frac, boss.enraged ? 0xff3a3a : 0xc03030, 0xff9a9a);
                this.bossBar.position.set(-170, 4);
            }
        } else this.bossBox.visible = false;

        if (this.toastTimer > 0) {
            this.toastTimer -= delta;
            this.toastText.alpha = Math.min(1, this.toastTimer / 40);
            if (this.toastTimer <= 0) this.toastText.visible = false;
        }

        // fade
        if (this.fadeAlpha !== this.fadeTarget) {
            const dir = this.fadeTarget > this.fadeAlpha ? 1 : -1;
            this.fadeAlpha = clamp(this.fadeAlpha + dir * this.fadeSpeed * delta, 0, 1);
            if ((dir > 0 && this.fadeAlpha >= this.fadeTarget) || (dir < 0 && this.fadeAlpha <= this.fadeTarget)) {
                this.fadeAlpha = this.fadeTarget;
                const cb = this.fadeCb;
                this.fadeCb = null;
                if (cb) cb();
            }
            this.fadeG.alpha = this.fadeAlpha;
        }
        this.fadeG.visible = this.fadeAlpha > 0.001;
    }

    // Full-screen world map: a DOM panel (src/ui/WorldMap.tsx) that pans and zooms over the paused game
    get mapOverlay() { return !!uiBridge.worldMap.value; }

    toggleMap(game, mode = 'view', from = null) {
        if (uiBridge.worldMap.value) {
            uiBridge.worldMap.value = null;
            gameState.paused = false;
            return;
        }
        if (gameState.levelUp || gameState.gameOver) return;
        gameState.paused = true;
        gameState.pointerDown = false;
        if (game) game.moveTarget = null;
        uiBridge.worldMap.value = { mode, from };
    }

    createFlashEffect(target) {
        if (!target.originalScale) target.originalScale = { x: target.scale.x, y: target.scale.y };
        if (target.flashTimeout) clearTimeout(target.flashTimeout);
        target.scale.set(target.originalScale.x * 1.5, target.originalScale.y * 1.5);
        target.tint = 0xFFFF00;
        target.flashTimeout = setTimeout(() => {
            target.scale.set(target.originalScale.x, target.originalScale.y);
            target.tint = 0xFFFFFF;
            target.flashTimeout = null;
        }, 250);
    }

    createJoystick() {
        const joystickContainer = new PIXI.Container();
        
        // Base circle - bigger and more transparent
        const base = new PIXI.Graphics();
        base.beginFill(0x000000, 0.2);
        base.lineStyle(2, 0xFFFFFF, 0.3);
        base.drawCircle(0, 0, 130);
        base.endFill();

        // Stick - bigger and more transparent
        const stick = new PIXI.Graphics();
        stick.beginFill(0xFFFFFF, 0.3);
        stick.drawCircle(0, 0, 50);
        stick.endFill();

        joystickContainer.addChild(base, stick);
        this.container.addChild(joystickContainer);

        // Joystick state with configuration
        const joystick = {
            container: joystickContainer,
            stick: stick,
            baseRadius: 130,
            active: false,
            data: null,
            position: { x: 0, y: 0 },
            config: {
                rightHanded: false,  // Add option for right/left handed
                safeAreaInset: 0,    // Will be updated based on device
                opacity: 0.3,        // Configurable opacity
                size: 1.0,           // Size multiplier
                positionX: 0.5       // Position multiplier
            }
        };

        // Apply configuration
        this.updateJoystickConfig(joystick);

        // Touch handlers with better touch handling
        joystickContainer.eventMode = 'static';
        joystickContainer.cursor = 'pointer';
        
        // Improved touch handling
        joystickContainer.on('pointerdown', (e) => {
            e.stopPropagation();
            this.onJoystickDown(e, joystick);
        });

        // Use passive listeners for better performance
        this.app.stage.on('pointermove', (e) => this.onJoystickMove(e, joystick), { passive: true });
        this.app.stage.on('pointerup', () => this.onJoystickUp(joystick), { passive: true });
        this.app.stage.on('pointerupoutside', () => this.onJoystickUp(joystick), { passive: true });

        // Position joystick based on configuration
        this.updateJoystickPosition(joystick);
        
        // Store joystick reference
        this.joystick = joystick;

        // Mobile detection with better device checking
        const isMobile = this.checkMobileDevice();
        joystickContainer.visible = isMobile;

        // Handle orientation change and resize
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateJoystickPosition(joystick);
                this.updateJoystickConfig(joystick);
            }, 100);
        });

        this.app.renderer.on('resize', () => {
            this.updateJoystickPosition(joystick);
        });

        // Return for settings menu access
        return joystick;
    }

    updateJoystickConfig(joystick) {
        // Get device safe area
        const safeArea = {
            top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0'),
            bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'),
            left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sal') || '0'),
            right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0')
        };

        // Update configuration
        joystick.config.safeAreaInset = Math.max(safeArea.bottom, 20);
        
        // Apply opacity
        joystick.container.alpha = joystick.config.opacity;
        
        // Apply size
        const scale = joystick.config.size;
        joystick.container.scale.set(scale);
    }

    updateJoystickPosition(joystick) {
        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;
        
        // Calculate position based on screen size and orientation
        const bottomOffset = screenHeight * 0.15 + joystick.config.safeAreaInset;
        
        // Use positionX value (0 to 1) to determine x position
        const positionX = joystick.config.positionX || 0;
        const margin = screenWidth * 0.15; // 15% margin from edges
        const usableWidth = screenWidth - (margin * 2); // Width available for positioning
        const x = margin + (usableWidth * positionX); // Linear interpolation
            
        joystick.container.position.set(
            x,
            screenHeight - bottomOffset
        );
    }

    checkMobileDevice() {
        // More comprehensive mobile detection
        const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const touchWindow = 'ontouchstart' in window;
        const touchPoints = navigator.maxTouchPoints > 0;
        const mobileScreen = window.innerWidth <= 1024;
        
        return userAgent || (touchWindow && touchPoints) || mobileScreen;
    }

    onJoystickDown(event, joystick) {
        joystick.active = true;
        joystick.data = event.data;
        joystick.stick.alpha = 0.8;
    }

    onJoystickMove(event, joystick) {
        if (!joystick.active) return;

        const newPosition = joystick.data.getLocalPosition(joystick.container);
        const distance = Math.sqrt(newPosition.x * newPosition.x + newPosition.y * newPosition.y);
        
        if (distance <= joystick.baseRadius) {
            joystick.stick.position = newPosition;
        } else {
            // Normalize the position to the base radius
            const angle = Math.atan2(newPosition.y, newPosition.x);
            joystick.stick.position.x = Math.cos(angle) * joystick.baseRadius;
            joystick.stick.position.y = Math.sin(angle) * joystick.baseRadius;
        }

        // Update normalized position (-1 to 1)
        joystick.position = {
            x: joystick.stick.position.x / joystick.baseRadius,
            y: joystick.stick.position.y / joystick.baseRadius
        };
    }

    onJoystickUp(joystick) {
        joystick.active = false;
        joystick.data = null;
        joystick.stick.position.set(0, 0);
        joystick.stick.alpha = 0.5;
        joystick.position = { x: 0, y: 0 };
    }

    /** The game menu (src/ui/Menu.tsx) is a DOM panel over the paused game, so the keyboard, mouse and controller
     *  all drive it. Opened on `page`, or on the page it was left on. */
    openMenu(page = null) {
        if (gameState.gameOver || !gameState.player) return;
        if (page && uiBridge.pauseOpen.value && uiBridge.menuPage.value === 'spells' && page !== 'spells') this.leaveSpells();
        if (page) uiBridge.menuPage.value = page;
        uiBridge.menuSeq.value++;
        if (uiBridge.pauseOpen.value) return;
        uiBridge.pauseOpen.value = true;
        gameState.paused = true;
        gameState.pointerDown = false;
    }

    closeMenu() {
        if (!uiBridge.pauseOpen.value) return;
        if (uiBridge.menuPage.value === 'spells') this.leaveSpells();
        uiBridge.pauseOpen.value = false;
        uiBridge.slotsOpen.value = null;      // and whatever it had opened on top
        uiBridge.rebindOpen.value = false;
        gameState.paused = false;
    }

    /** Leaving the Spells page: what was new has been seen, and the view returns to the active hero. */
    leaveSpells() {
        const sp = this.game && this.game.spells;
        if (sp && (sp.viewHero != null || sp.spells.some((s) => s.isNew) || (sp.newRunes && sp.newRunes.size))) { sp.clearNew(); sp.setView(null); }
    }

    /** Esc / Start with nothing else open; a page hotkey (I, U, J, B, C) closes the menu when it is on that page. */
    toggleMenu(page = null) {
        if (uiBridge.pauseOpen.value && (!page || uiBridge.menuPage.value === page)) this.closeMenu();
        else this.openMenu(page);
    }

    // Add other UI update methods...
}
