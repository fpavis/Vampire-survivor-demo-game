import { RARITY, LIMITS } from './config.js';
import { gameState } from './gameState.js';
import { WEAPONS, PASSIVES } from './weapons.js';

const FONT = 'Trebuchet MS, Verdana, Arial, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
            if (e.key === 'Escape') this.toggleSettings();
        });
        window.addEventListener('resize', () => this.layoutHUD());

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
        this.panel.beginFill(0x0a0e18, 0.6);
        this.panel.lineStyle(1, 0xffffff, 0.15);
        this.panel.drawRoundedRect(0, 0, 268, 64, 12);
        this.panel.endFill();
        this.panel.position.set(12, 26);

        this.hpBar = new PIXI.Graphics();
        this.hpBar.position.set(40, 10);
        this.elements.heart = new PIXI.Text('❤️', { fontSize: 22 });
        this.elements.heart.position.set(8, 6);
        this.elements.healthText = new PIXI.Text('100/100', {
            fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: 0xffffff, stroke: 0x000000, strokeThickness: 3
        });
        this.elements.healthText.anchor.set(0.5);
        this.elements.healthText.position.set(40 + 110, 10 + 10);
        this.elements.statLine = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 14, fontWeight: 'bold', fill: 0xe6e9f2, stroke: 0x000000, strokeThickness: 3
        });
        this.elements.statLine.position.set(12, 38);
        this.panel.addChild(this.hpBar, this.elements.heart, this.elements.healthText, this.elements.statLine);

        // Weapon / passive inventory
        this.slotsContainer = new PIXI.Container();
        this.slotsContainer.position.set(12, 98);
        this.elements.statsText = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 12, fill: 0xb8c0d4, stroke: 0x000000, strokeThickness: 3, lineHeight: 16
        });

        // Banner
        this.elements.banner = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 40, fontWeight: 'bold', fill: 0xffffff,
            stroke: 0x000000, strokeThickness: 6, dropShadow: true, dropShadowDistance: 4, dropShadowAlpha: 0.6
        });
        this.elements.banner.anchor.set(0.5);
        this.elements.banner.visible = false;
        this.bannerTimer = 0;

        hud.addChild(this.xpBar, this.elements.levelText, this.elements.xpText, this.panel,
            this.slotsContainer, this.elements.statsText, this.elements.banner);

        // Settings button in the top right
        const settingsButton = new PIXI.Container();
        const settingsIcon = new PIXI.Text('⚙️', { fontSize: 22 });
        settingsIcon.anchor.set(0.5);
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
        settingsButton.on('pointerdown', (e) => { e.stopPropagation(); this.toggleSettings(); });
        settingsButton.on('pointerover', () => drawBg(0.9));
        settingsButton.on('pointerout', () => drawBg(0.6));
        this.settingsButton = settingsButton;
        hud.addChild(settingsButton);

        this.setHUDVisible(false);
    }

    setHUDVisible(visible) {
        this.container.visible = visible;
    }

    layoutHUD() {
        const w = this.app.screen.width, h = this.app.screen.height;
        this.settingsButton.position.set(w - 34, 50);
        this.elements.xpText.x = w / 2;
        this.elements.banner.position.set(w / 2, h * 0.24);
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
        this.damageFlash = 1;
    }

    banner(text, color = 0xffffff) {
        const b = this.elements.banner;
        b.text = text;
        b.style.fill = color;
        b.visible = true;
        b.alpha = 1;
        b.scale.set(0.4);
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

        const stat = `⏱ ${formatTime(s.time)}   ☠ ${s.kills}   ★ ${Math.floor(s.score)}`;
        if (stat !== this.shown.stat) {
            this.shown.stat = stat;
            this.elements.statLine.text = stat;
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
        const sig = game.weapons.list.map((w) => w.id + w.level).join(',') + '|' +
            Object.entries(s.passives).map(([k, v]) => k + v).join(',');
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
            const t = new PIXI.Text(icon, { fontSize: 22 });
            t.anchor.set(0.5);
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
        game.weapons.list.forEach((w, i) => {
            drawSlot(i * 44, 0, WEAPONS[w.id].icon, w.level, WEAPONS[w.id].max, WEAPONS[w.id].color);
        });
        Object.entries(s.passives).forEach(([id, lvl], i) => {
            drawSlot(i * 44, 44, PASSIVES[id].icon, lvl, PASSIVES[id].max, 0x7be07b);
        });

        const st = game.stats;
        this.elements.statsText.position.set(12, 98 + (Object.keys(s.passives).length ? 92 : 48));
        this.elements.statsText.text =
            `Damage ×${st.might.toFixed(2)}   Speed ×${st.speed.toFixed(2)}\n` +
            `Crit ${Math.round(st.crit * 100)}%   Armor ${Math.round(st.armor * 100)}%   Regen ${st.regen.toFixed(1)}/s`;
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

    // ------------------------------------------------------------ level up
    showLevelUp(choices, level, onPick) {
        const app = this.app;
        const overlay = new PIXI.Container();
        overlay.zIndex = 3000;
        overlay.eventMode = 'static';
        app.stage.addChild(overlay);

        let selected = 0;
        let age = 0;
        let cards = [];
        let closed = false;
        const parts = { dim: null, title: null, sub: null, hint: null };

        const pick = (i) => {
            if (closed || age < 14) return;   // ignore accidental instant clicks
            closed = true;
            teardown();
            onPick(choices[i]);
        };

        const drawCard = (choice, w, h, compact, isSel) => {
            const c = new PIXI.Container();
            const rar = RARITY[choice.rarity];
            const bg = new PIXI.Graphics();
            bg.beginFill(0x131826, 0.96);
            bg.lineStyle(isSel ? 4 : 3, isSel ? 0xffffff : rar.color, 1);
            bg.drawRoundedRect(-w / 2, -h / 2, w, h, 16);
            bg.endFill();
            bg.beginFill(rar.color, isSel ? 0.28 : 0.14);
            bg.drawRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, compact ? h - 6 : 34, 13);
            bg.endFill();
            c.addChild(bg);

            const tag = choice.kind === 'heal' ? 'CONSUMABLE'
                : choice.isNew ? 'NEW' : `LV ${choice.toLevel - 1} → ${choice.toLevel}`;
            const tagText = new PIXI.Text(`${rar.name.toUpperCase()}  ·  ${tag}${choice.max ? '  ·  MAX' : ''}`, {
                fontFamily: FONT, fontSize: 12, fontWeight: 'bold', fill: rar.color, letterSpacing: 1
            });
            const iconCircle = new PIXI.Graphics();
            const ir = compact ? 34 : 46;
            iconCircle.beginFill(choice.color, 0.22);
            iconCircle.drawCircle(0, 0, ir);
            iconCircle.endFill();
            iconCircle.lineStyle(2, choice.color, 0.9);
            iconCircle.drawCircle(0, 0, ir);
            const icon = new PIXI.Text(choice.icon, { fontSize: compact ? 34 : 50 });
            icon.anchor.set(0.5);
            iconCircle.addChild(icon);

            const name = new PIXI.Text(choice.name, {
                fontFamily: FONT, fontSize: compact ? 20 : 24, fontWeight: 'bold', fill: 0xffffff
            });
            const textW = compact ? w - ir * 2 - 44 : w - 36;
            const body = new PIXI.Text(choice.lines.join('\n'), {
                fontFamily: FONT, fontSize: compact ? 13 : 15, fill: 0xc9d1e6,
                wordWrap: true, wordWrapWidth: textW, align: compact ? 'left' : 'center', lineHeight: compact ? 17 : 21
            });

            if (compact) {
                tagText.position.set(-w / 2 + 16, -h / 2 + 10);
                iconCircle.position.set(-w / 2 + 16 + ir, 8);
                name.position.set(-w / 2 + 32 + ir * 2, -h / 2 + 30);
                body.position.set(-w / 2 + 32 + ir * 2, -h / 2 + 58);
            } else {
                tagText.anchor.set(0.5, 0);
                tagText.position.set(0, -h / 2 + 10);
                iconCircle.position.set(0, -h / 2 + 100);
                name.anchor.set(0.5, 0);
                name.position.set(0, -h / 2 + 164);
                body.anchor.set(0.5, 0);
                body.position.set(0, -h / 2 + 204);
            }
            c.addChild(tagText, iconCircle, name, body);

            if (!compact) {
                const key = new PIXI.Text(`[ ${cards.length + 1} ]`, {
                    fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: 0x77809a
                });
                key.anchor.set(0.5, 1);
                key.position.set(0, h / 2 - 10);
                c.addChild(key);
            }
            return c;
        };

        const build = () => {
            const w = app.screen.width, h = app.screen.height;
            overlay.removeChildren().forEach((c) => c.destroy({ children: true }));
            cards = [];

            const dim = new PIXI.Graphics();
            dim.beginFill(0x05070d, 0.78);
            dim.drawRect(0, 0, w, h);
            dim.endFill();
            dim.eventMode = 'static';
            overlay.addChild(dim);

            const compact = w < 3 * 250 + 100 || h < 460;
            const title = new PIXI.Text('LEVEL UP!', {
                fontFamily: FONT, fontSize: compact ? 34 : 52, fontWeight: 'bold',
                fill: ['#fff2a8', '#ffb31a'], stroke: 0x2a1600, strokeThickness: 6,
                dropShadow: true, dropShadowDistance: 4, dropShadowAlpha: 0.6
            });
            title.anchor.set(0.5);
            const sub = new PIXI.Text(`You reached level ${level}  —  choose an upgrade`, {
                fontFamily: FONT, fontSize: compact ? 14 : 18, fill: 0xd3d9ea
            });
            sub.anchor.set(0.5);

            let cw, ch, positions;
            if (compact) {
                cw = Math.min(w - 32, 440);
                ch = clamp((h - 150) / choices.length - 12, 96, 128);
                const totalH = choices.length * ch + (choices.length - 1) * 12;
                const top = Math.max(110, (h - totalH) / 2 + 40);
                positions = choices.map((_, i) => ({ x: w / 2, y: top + ch / 2 + i * (ch + 12) }));
                title.position.set(w / 2, Math.max(34, top - 62));
                sub.position.set(w / 2, Math.max(64, top - 30));
            } else {
                cw = 250; ch = 330;
                const gap = 28;
                const totalW = choices.length * cw + (choices.length - 1) * gap;
                positions = choices.map((_, i) => ({ x: w / 2 - totalW / 2 + cw / 2 + i * (cw + gap), y: h / 2 + 30 }));
                title.position.set(w / 2, h / 2 - ch / 2 - 60);
                sub.position.set(w / 2, h / 2 - ch / 2 - 18);
            }
            overlay.addChild(title, sub);

            const hint = new PIXI.Text('Click a card, or use ←/→ and Enter, or press 1-3', {
                fontFamily: FONT, fontSize: 13, fill: 0x8e97b0
            });
            hint.anchor.set(0.5);
            hint.position.set(w / 2, h - 24);
            overlay.addChild(hint);

            choices.forEach((choice, i) => {
                const card = drawCard(choice, cw, ch, compact, i === selected);
                card.position.set(positions[i].x, positions[i].y);
                card.baseY = positions[i].y;
                card.eventMode = 'static';
                card.cursor = 'pointer';
                card.on('pointerover', () => { if (selected !== i) { selected = i; setTimeout(build, 0); } });
                card.on('pointerdown', (e) => { e.stopPropagation(); pick(i); });
                card.scale.set(i === selected ? 1.06 : 1);
                overlay.addChild(card);
                cards.push(card);
            });
            parts.compact = compact;
        };

        const tick = (d) => {
            age += d;
            cards.forEach((card, i) => {
                const a = clamp((age - i * 4) / 12, 0, 1);
                card.alpha = a;
                card.y = card.baseY + (1 - a) * 40;
            });
        };

        const onKey = (e) => {
            if (closed) return;
            const n = choices.length;
            switch (e.key) {
                case 'ArrowLeft': case 'ArrowUp': case 'a': case 'w':
                    selected = (selected - 1 + n) % n; build(); break;
                case 'ArrowRight': case 'ArrowDown': case 'd': case 's':
                    selected = (selected + 1) % n; build(); break;
                case 'Enter': case ' ': pick(selected); e.preventDefault(); break;
                case '1': case '2': case '3':
                    if (Number(e.key) <= n) { selected = Number(e.key) - 1; pick(selected); }
                    break;
            }
        };

        const teardown = () => {
            app.ticker.remove(tick);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', build);
            app.stage.removeChild(overlay);
            overlay.destroy({ children: true });
        };

        build();
        app.ticker.add(tick);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', build);
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

        window.addEventListener('resize', () => {
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

    toggleSettings() {
        if (gameState.levelUp || gameState.gameOver || !gameState.player) return;
        if (!this.settingsMenu) {
            this.createSettingsMenu();
        }

        // Toggle visibility and pause state
        const isOpening = !this.settingsMenu.visible;
        this.settingsMenu.visible = isOpening;
        gameState.paused = isOpening;

        // Update UI elements based on state
        if (isOpening) {
            // Opening settings
            this.settingsMenu.children.forEach(child => {
                child.eventMode = 'static';  // Ensure all children are interactive
            });
        } else {
            // Closing settings
            this.settingsMenu.children.forEach(child => {
                if (child instanceof PIXI.Graphics) {
                    child.eventMode = 'none';
                }
            });
        }
    }

    createSettingsMenu() {
        const menu = new PIXI.Container();
        menu.visible = false;
        menu.zIndex = 2000; // Ensure it's above other UI elements
        menu.eventMode = 'static'; // Make entire menu interactive

        // Background overlay
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.8);
        overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        overlay.endFill();
        overlay.eventMode = 'static'; // Make overlay interactive
        overlay.on('pointerdown', (e) => e.stopPropagation()); // Prevent clicks through overlay
        menu.addChild(overlay);

        // Settings panel - moved to top right
        const panel = new PIXI.Graphics();
        panel.beginFill(0x333333, 0.95);
        panel.lineStyle(2, 0xFFFFFF, 0.8);
        panel.drawRoundedRect(0, 0, 300, 400, 10);
        panel.endFill();
        panel.position.set(
            this.app.screen.width - 320,  // 20px margin from right
            20  // 20px margin from top
        );
        panel.eventMode = 'static'; // Make panel interactive
        menu.addChild(panel);

        // Title
        const title = new PIXI.Text('Settings', {
            fontSize: 24,
            fill: 0xFFFFFF,
            fontWeight: 'bold'
        });
        title.position.set(panel.x + 150, panel.y + 20);
        title.anchor.x = 0.5;
        menu.addChild(title);

        // Pause text
        const pauseText = new PIXI.Text('GAME PAUSED', {
            fontSize: 48,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 4,
            dropShadowDistance: 2
        });
        pauseText.anchor.set(0.5);
        pauseText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
        menu.addChild(pauseText);

        // Settings options
        const options = [
            {
                label: 'Joystick Position',
                type: 'slider',
                min: 0,
                max: 1,
                step: 0.1,
                get: () => this.joystick.config.rightHanded ? 1 : 0,
                set: (value) => {
                    this.joystick.config.rightHanded = value > 0.5;
                    this.joystick.config.positionX = value; // Store actual position value
                    this.updateJoystickPosition(this.joystick);
                }
            },
            {
                label: 'Joystick Size',
                type: 'slider',
                min: 0.5,
                max: 1.5,
                step: 0.1,
                get: () => this.joystick.config.size,
                set: (value) => {
                    this.joystick.config.size = value;
                    this.updateJoystickConfig(this.joystick);
                }
            },
            {
                label: 'Opacity',
                type: 'slider',
                min: 0.1,
                max: 1.0,
                step: 0.1,
                get: () => this.joystick.config.opacity,
                set: (value) => {
                    this.joystick.config.opacity = value;
                    this.updateJoystickConfig(this.joystick);
                }
            }
        ];

        // Create UI elements for each option
        let yOffset = 70;
        options.forEach(option => {
            const label = new PIXI.Text(option.label, {
                fontSize: 16,
                fill: 0xFFFFFF
            });
            label.position.set(panel.x + 20, panel.y + yOffset);
            menu.addChild(label);

            if (option.type === 'slider') {
                const slider = this.createSlider(
                    panel.x + 150,
                    panel.y + yOffset,
                    option.min,
                    option.max,
                    option.step,
                    option.get(),
                    (value) => option.set(value)
                );
                menu.addChild(slider);
            }

            yOffset += 50;
        });

        // Close button
        const closeButton = new PIXI.Graphics();
        closeButton.beginFill(0xFF0000);
        closeButton.drawRoundedRect(0, 0, 80, 30, 5);
        closeButton.endFill();
        closeButton.position.set(panel.x + 110, panel.y + 350);
        closeButton.eventMode = 'static';
        closeButton.cursor = 'pointer';

        const closeText = new PIXI.Text('Close', {
            fontSize: 16,
            fill: 0xFFFFFF
        });
        closeText.anchor.set(0.5);
        closeText.position.set(40, 15);
        closeButton.addChild(closeText);

        closeButton.on('pointerdown', () => {
            this.toggleSettings();  // Use toggleSettings instead of direct visibility change
        });

        menu.addChild(closeButton);
        this.container.addChild(menu);
        this.settingsMenu = menu;

        // Handle window resize
        window.addEventListener('resize', () => {
            if (menu.visible) {
                overlay.clear();
                overlay.beginFill(0x000000, 0.8);
                overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
                panel.position.set(
                    this.app.screen.width - 320,
                    20
                );
                pauseText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
            }
        });

        return menu;
    }

    createSlider(x, y, min, max, step, initial, onChange) {
        const slider = new PIXI.Container();
        slider.position.set(x, y);

        const track = new PIXI.Graphics();
        track.beginFill(0x666666);
        track.drawRect(0, 0, 100, 4);
        track.endFill();

        const handle = new PIXI.Graphics();
        handle.beginFill(0xFFFFFF);
        handle.drawCircle(0, 0, 8);
        handle.endFill();

        const initialX = ((initial - min) / (max - min)) * 100;
        handle.position.set(initialX, 2);

        slider.addChild(track, handle);
        slider.eventMode = 'static';
        handle.eventMode = 'static';
        handle.cursor = 'pointer';

        let dragging = false;
        handle.on('pointerdown', () => dragging = true);
        this.app.stage.on('pointerup', () => dragging = false);
        this.app.stage.on('pointermove', (e) => {
            if (!dragging) return;
            const bounds = slider.getBounds();
            let x = Math.max(0, Math.min(100, e.global.x - bounds.x));
            handle.position.x = x;
            const value = min + (x / 100) * (max - min);
            onChange(Math.round(value / step) * step);
        });

        return slider;
    }

    // Add other UI update methods...
}
