// @ts-nocheck -- bound to the game runtime; the rules live in core/input/gamepad
// One place for every way of playing: keyboard, mouse, touch and controller. It tracks which one the player is
// using (so prompts and focus rings follow), reads the gamepad, and turns buttons into game actions.
import { DEFAULT_BINDINGS, DIRS, PadMapper, QUICK_PANELS, assignPad, emptyFrame, padKind } from '../core/input/gamepad';
import { KeyMap } from '../core/input/bindings';
import { ui as uiBridge } from '../ui/bridge';
import { isTyping, navAction, navActive, navBack, navConfirm, navModal, navMove, navScope, navWantsArrows, navTab } from '../ui/nav';

const PREFS_KEY = 'vs.input.v1';
const ARROW_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

export class InputSystem {
    constructor(game) {
        this.game = game;
        this.mapper = new PadMapper();
        this.frame = emptyFrame();
        this.device = 'mouse';
        this.menus = [];                 // Pixi menus (title, game over) that take the directions and confirm
        this.pointerLive = false;        // the pointer has moved or pressed since the page loaded (hover may take the highlight)
        this.padId = '';
        this.keys = new KeyMap();
        this.captureKeyCb = null;        // rebinding: the next key press goes here
        this.capturePadCb = null;        // rebinding: the next newly pressed button goes here
        this.captureArmed = false;
        this.loadPrefs();
        this.bind();
    }

    // -------------------------------------------------------------- settings
    loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
            if (typeof p.vibration === 'boolean') uiBridge.vibration.value = p.vibration;
            if (typeof p.deadzone === 'number') uiBridge.deadzone.value = Math.min(0.6, Math.max(0.05, p.deadzone));
            if (p.keys) this.keys = new KeyMap(p.keys);
            if (p.pad) {
                const b = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
                for (const k of Object.keys(b)) if (Array.isArray(p.pad[k]) && p.pad[k].length) b[k] = p.pad[k];
                this.mapper.bindings = b;
            }
        } catch { /* storage unavailable */ }
        this.mapper.options.deadzone = uiBridge.deadzone.value;
    }

    savePrefs() {
        this.mapper.options.deadzone = uiBridge.deadzone.value;
        try { localStorage.setItem(PREFS_KEY, JSON.stringify({ vibration: uiBridge.vibration.value, deadzone: uiBridge.deadzone.value, keys: this.keys.toJSON(), pad: this.mapper.bindings })); } catch { /* storage unavailable */ }
        uiBridge.bindVersion.value++;
    }

    // ------------------------------------------------------------- rebinding
    /** The next key press is handed to `cb` (with its lower-cased name) instead of the game. */
    captureKey(cb) { this.captureKeyCb = cb; this.capturePadCb = null; }
    /** The next controller button pressed after all are released is handed to `cb`. */
    capturePad(cb) { this.capturePadCb = cb; this.captureKeyCb = null; this.captureArmed = false; }
    cancelCapture() { this.captureKeyCb = null; this.capturePadCb = null; }

    rebindPad(action, button) {
        const b = assignPad(this.mapper.bindings, action, button);
        if (!b) return false;
        this.mapper.bindings = b;
        this.savePrefs();
        return true;
    }

    resetBindings() {
        this.keys.reset();
        this.mapper.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
        this.savePrefs();
    }

    // ---------------------------------------------------------------- device
    setDevice(d) {
        if (d === this.device) return;
        this.device = d;
        document.documentElement.dataset.input = d;
        uiBridge.device.value = d;
        const g = this.game;
        if (d === 'pad' || d === 'key') g.pointerKind = d;      // keyboard and controller place build ghosts ahead of the hero
        const joy = g.ui && g.ui.joystick;                       // the on-screen stick is for fingers only
        if (joy) { if (joy.mobile === undefined) joy.mobile = joy.container.visible; joy.container.visible = joy.mobile && d !== 'pad' && d !== 'key'; }
    }

    glyphKind() { return uiBridge.padKind.value; }

    bind() {
        document.documentElement.dataset.input = this.device;
        const g = this.game;
        window.addEventListener('keydown', (e) => {
            if (!e.isTrusted) return;
            g.audio?.unlock();                                     // any real key press may start the sound
            if (this.captureKeyCb && !MODIFIERS.has(e.key)) {
                e.preventDefault(); e.stopImmediatePropagation();
                const cb = this.captureKeyCb; this.captureKeyCb = null;
                cb(e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase());
                return;
            }
            if (!MODIFIERS.has(e.key)) this.setDevice('key');
            // a DOM panel over a canvas menu (Options or Load on the title) takes the keys
            const menu = navActive() ? null : this.menus[this.menus.length - 1];
            if (!menu && this.menus.length && e.key === 'Escape' && navBack()) { e.preventDefault(); e.stopImmediatePropagation(); return; }
            if (menu) {
                const k = e.key;
                if (k === 'ArrowUp' || k === 'w' || k === 'W') menu.move(-1);
                else if (k === 'ArrowDown' || k === 's' || k === 'S') menu.move(1);
                else if (k === 'Enter' || k === ' ') menu.confirm();
                else if (k === 'Escape' && menu.back) menu.back();
                else return;
                e.preventDefault(); e.stopImmediatePropagation();
                return;
            }
            if (isTyping(e.target)) { if (e.key !== 'Escape') e.stopImmediatePropagation(); return; }
            const dir = ARROW_DIR[e.key];
            if (dir && navWantsArrows()) { e.preventDefault(); e.stopImmediatePropagation(); navMove(dir); }
        }, true);
        const pointer = (e) => { if (e.isTrusted) { this.pointerLive = true; this.setDevice(e.pointerType === 'touch' ? 'touch' : 'mouse'); } };
        window.addEventListener('pointerdown', (e) => { if (e.isTrusted) g.audio?.unlock(); }, true);
        window.addEventListener('pointerdown', pointer, true);
        window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 1)) pointer(e); }, true);
        window.addEventListener('gamepadconnected', (e) => {
            this.padId = e.gamepad.id;
            uiBridge.padKind.value = padKind(e.gamepad.id);
            uiBridge.padName.value = e.gamepad.id.replace(/\s*\(.*$/, '');
            g.ui?.toast?.(`Controller connected: ${uiBridge.padName.value}`);
        });
        window.addEventListener('gamepaddisconnected', () => {
            if (this.device === 'pad') this.setDevice('key');
            this.mapper.reset();
            this.frame = emptyFrame();
            g.ui?.toast?.('Controller disconnected');
        });
    }

    // ------------------------------------------------------------ Pixi menus
    /** items: [{ btn, run }]; the selected one is highlighted. Returns a function that removes the menu. */
    pushMenu(spec) {
        const menu = {
            index: 0,
            items: spec.items,
            back: spec.back || null,
            refresh() {
                const list = this.items();
                this.index = Math.max(0, Math.min(list.length - 1, this.index));
                list.forEach((it, i) => it.btn.setSelected && it.btn.setSelected(i === this.index));
            },
            move: (d) => { menu.index += d; menu.refresh(); this.game.audio?.play('uiMove'); },
            confirm: () => { const it = menu.items()[menu.index]; if (it) { this.game.audio?.play('uiOk'); it.run(); } },
            select(btn) { const i = this.items().findIndex((it) => it.btn === btn); if (i >= 0) { this.index = i; this.refresh(); } }
        };
        this.menus.push(menu);
        menu.refresh();
        return { menu, remove: () => { this.menus = this.menus.filter((m) => m !== menu); } };
    }

    // ----------------------------------------------------------------- polling
    readPad() {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        let best = null;
        for (const p of list) {
            if (!p || !p.connected) continue;
            if (p.mapping === 'standard') { best = p; break; }
            best = best || p;
        }
        if (best && best.id !== this.padId) {
            this.padId = best.id;
            uiBridge.padKind.value = padKind(best.id);
            uiBridge.padName.value = best.id.replace(/\s*\(.*$/, '');
        }
        return best;
    }

    /** Called every frame, also while the game is paused or on the title screen. */
    poll() {
        const pad = this.readPad();
        if (this.capturePadCb && pad) {
            // wait until every button is up, then take the first one pressed
            const down = pad.buttons.map((b, i) => (b.pressed || b.value > 0.5 ? i : -1)).filter((i) => i >= 0);
            if (!down.length) this.captureArmed = true;
            else if (this.captureArmed) {
                const cb = this.capturePadCb; this.capturePadCb = null;
                this.mapper.update(pad, performance.now());     // swallow this press so it does not also act
                cb(down[0]);
                return;
            }
            this.frame = this.mapper.update(null, performance.now());
            return;
        }
        const f = this.mapper.update(pad, performance.now());
        this.frame = f;
        if (!pad) return;
        if (f.active) { this.setDevice('pad'); if (f.pressed.size) this.game.audio?.unlock(); }
        if (f.pressed.size || f.stick) this.dispatch(f);
    }

    /** right-stick aim as a unit vector (for dashes and blinks), or null */
    aim() {
        const a = this.frame.aim;
        const m = Math.hypot(a.x, a.y);
        return m > 0.25 ? { x: a.x / m, y: a.y / m } : null;
    }

    rumble(strong = 0.5, weak = 0.4, ms = 140) {
        if (!uiBridge.vibration.value || this.device !== 'pad') return;
        const pad = this.readPad();
        const act = pad && pad.vibrationActuator;
        if (act && act.playEffect) act.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }).catch(() => {});
    }

    // ---------------------------------------------------------------- actions
    /** back out of whatever is open: placement, then the top panel. Returns true if something closed. */
    back() {
        const g = this.game;
        if (g.towers && g.towers.cancelBuild()) return true;
        return navBack();
    }

    /** Esc: back out of things (a sub-panel, the menu itself), otherwise open the game menu */
    escape() {
        const g = this.game;
        if (!g.state.player || g.state.gameOver) return false;
        if (this.back()) return true;
        if (g.ui.mapOverlay) { g.ui.toggleMap(g); return true; }
        g.ui.toggleMenu();
        return true;
    }

    /** A page hotkey (I, U, J, B, C or the d-pad): the game menu opens on that page, or closes when it is there. */
    openPanel(name) {
        const g = this.game;
        if (name === 'build' && g.towers.build) { g.towers.cancelBuild(); return; }
        if (uiBridge.worldMap.value || g.busy) return;
        g.ui.toggleMenu(name);
    }

    dispatch(f) {
        const g = this.game, s = g.state;
        const has = (a) => f.pressed.has(a);
        const menu = navActive() ? null : this.menus[this.menus.length - 1];
        if (menu) {
            const dir = f.stick || DIRS.find((d) => has(d));
            if (dir === 'up' || dir === 'left') menu.move(-1);
            else if (dir === 'down' || dir === 'right') menu.move(1);
            if (has('interact')) menu.confirm();
            if (has('cancel') && menu.back) menu.back();
            return;
        }
        if (!s.player || s.gameOver || g.busy) {
            // panels opened from the title screen (Options, Load Game, Credits)
            if (navActive()) {
                const dir = f.stick || DIRS.find((d) => has(d));
                if (dir) navMove(dir);
                if (has('interact')) navConfirm();
                if (has('cancel')) navBack();
                if (has('prevHero')) navTab(-1);
                if (has('nextHero')) navTab(1);
            }
            return;
        }

        // the world map: the stick pans it (read each frame by the map itself), the shoulders zoom, X recentres
        if (g.ui.mapOverlay) {
            if (has('map') || has('cancel') || has('menu')) { g.ui.toggleMap(g); return; }
            const c = uiBridge.mapCtl;
            if (c) {
                if (has('prevHero')) c.zoom(-1);
                if (has('nextHero')) c.zoom(1);
                if (has('skill1')) c.recenter();
                if (has('interact')) c.confirm();
                // travel: the d-pad steps through the destinations
                const dir = DIRS.find((d) => has(d));
                if (dir && c.step && uiBridge.worldMap.value && uiBridge.worldMap.value.mode === 'travel') c.step(dir === 'up' || dir === 'left' ? -1 : 1);
            }
            return;
        }
        if (has('menu')) { g.ui.toggleMenu(); return; }
        // the game menu, and the ending (which pauses the game), take the d-pad and the face buttons
        if (uiBridge.pauseOpen.value || uiBridge.ending.value) {
            const dir = f.stick || DIRS.find((d) => has(d));
            if (dir) navMove(dir);
            if (has('interact')) navConfirm();
            if (has('cancel')) navBack() || g.ui.closeMenu();
            // LB / RB flip the menu's pages; X, Y and RT act on the focused item (equip, lock, favourite)
            if (has('prevHero')) navTab(-1);
            if (has('nextHero')) navTab(1);
            if (has('skill1')) navAction('x');
            if (has('skill2')) navAction('y');
            if (has('skill3')) navAction('rt');
            if (has('map') && uiBridge.pauseOpen.value) { g.ui.closeMenu(); g.toggleMap(); }
            return;
        }
        if (s.paused) return;

        // inside a panel the face buttons act on the focused item first (X equip, Y lock ...)
        const faces = [['skill1', 'x', 0], ['skill2', 'y', 1], ['skill3', 'rt', 2]];
        for (const [action, face, slot] of faces) {
            if (!has(action)) continue;
            if (navActive() && (navAction(face) || navModal())) continue;
            g.spells.cast(slot);
        }
        if (has('prevHero')) g.party.cycle(-1);
        if (has('nextHero')) g.party.cycle(1);
        if (has('map')) g.toggleMap();
        if (has('cancel')) this.back() || g.tips.dismiss();
        if (has('interact')) {
            if (g.towers.build) g.towers.confirmBuild();
            else if (navActive()) navConfirm();
            else g.interact();
        }
        for (const d of DIRS) {
            if (!has(d)) continue;
            if (navActive()) navMove(d);
            else if (QUICK_PANELS[d]) this.openPanel(QUICK_PANELS[d]);
        }
    }
}
