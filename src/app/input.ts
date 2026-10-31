// @ts-nocheck -- bound to the game runtime; the rules live in core/input/gamepad
// One place for every way of playing: keyboard, mouse, touch and controller. It tracks which one the player is
// using (so prompts and focus rings follow), reads the gamepad, and turns buttons into game actions.
import {
    DEFAULT_BINDINGS, DIRS, HAPTICS, HapticGate, PadMapper, QUICK_PANELS, SETUP_STEPS, applyProfile, assignPad, emptyFrame, newlyPressed, padKind,
    profileFromCaptures, scaleRumble
} from '../core/input/gamepad';
import { KeyMap } from '../core/input/bindings';
import { ui as uiBridge } from '../ui/bridge';
import { isTyping, navAction, navActive, navBack, navConfirm, navModal, navMove, navScope, navTab, navTrap, navWantsArrows } from '../ui/nav';

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
        this.profiles = {};              // per controller id: how its raw buttons map onto the standard layout
        this.setup = null;               // the guided setup in progress
        this.warned = new Set();         // unrecognised controllers already pointed at the setup
        this.hapticGate = new HapticGate();
        this.loadPrefs();
        this.bind();
    }

    // -------------------------------------------------------------- settings
    loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
            if (typeof p.vibration === 'boolean') uiBridge.vibration.value = p.vibration;
            if (typeof p.vibrationStrength === 'number') uiBridge.vibrationStrength.value = Math.min(1, Math.max(0, p.vibrationStrength));
            if (typeof p.deadzone === 'number') uiBridge.deadzone.value = Math.min(0.6, Math.max(0.05, p.deadzone));
            if (p.keys) this.keys = new KeyMap(p.keys);
            if (p.profiles && typeof p.profiles === 'object') this.profiles = p.profiles;
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
        try { localStorage.setItem(PREFS_KEY, JSON.stringify({ vibration: uiBridge.vibration.value, vibrationStrength: uiBridge.vibrationStrength.value, deadzone: uiBridge.deadzone.value, keys: this.keys.toJSON(), pad: this.mapper.bindings, profiles: this.profiles })); } catch { /* storage unavailable */ }
        uiBridge.padProfile.value = !!this.profiles[this.padId];
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

    // ---------------------------------------------------------- pad setup
    /** Walk through every standard button on the controller in hand, so a pad the browser does not know works. */
    startPadSetup() {
        const pad = this.readPad();
        if (!pad) { this.game.ui?.toast?.('Press any button on the controller first, so the game can see it'); return false; }
        this.setup = { id: pad.id, step: 0, captures: [], armed: false, rest: [...pad.axes] };
        this.publishSetup();
        return true;
    }

    publishSetup() {
        const st = this.setup;
        uiBridge.padSetup.value = st ? { name: st.id.replace(/\s*\(.*$/, ''), step: st.step, total: SETUP_STEPS.length, prompt: SETUP_STEPS[st.step]?.prompt || '' } : null;
    }

    /** This step's button is missing on the pad: leave it where the standard layout has it. */
    skipPadSetupStep() { if (this.setup) this.takeSetupInput(null); }

    cancelPadSetup() { this.setup = null; this.publishSetup(); this.mapper.reset(); }

    takeSetupInput(src, pad = null) {
        const st = this.setup;
        st.captures.push(src);
        st.step++;
        this.game.audio?.play('uiOk');
        if (st.step < SETUP_STEPS.length) { this.publishSetup(); return; }
        const prof = profileFromCaptures(st.captures);
        this.profiles[st.id] = prof;
        this.setup = null;
        this.publishSetup();
        this.mapper.reset();
        // the last button is still held: swallow it so it does not also act
        if (pad) this.mapper.update(applyProfile(pad, prof), performance.now());
        this.savePrefs();
        this.game.ui?.toast?.('Controller set up: its buttons now work as on a standard pad');
    }

    /** During setup: wait until everything is let go, then take the next button or hat direction pressed. */
    pollSetup(pad) {
        const st = this.setup;
        if (!pad || pad.id !== st.id) return;
        const src = newlyPressed(pad, st.rest);
        if (src === null) { st.armed = true; return; }
        if (!st.armed) return;
        st.armed = false;
        this.takeSetupInput(src, pad);
    }

    forgetPadProfile() {
        if (!this.profiles[this.padId]) return false;
        delete this.profiles[this.padId];
        this.mapper.reset();
        this.savePrefs();
        this.game.ui?.toast?.('The controller is read in the standard way again');
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
            if (this.setup && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.cancelPadSetup(); return; }
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
            // Tab walks a modal panel's controls (the Spells page keeps it for showing the next hero)
            if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && !(uiBridge.pauseOpen.value && uiBridge.menuPage.value === 'spells') && navTrap(e.shiftKey)) { e.preventDefault(); return; }
            if (isTyping(e.target)) { if (e.key !== 'Escape') e.stopImmediatePropagation(); return; }
            // a story scene takes the keys: Enter, Space or E reads on, Esc skips it
            if (g.story && g.story.current) {
                const k = e.key.toLowerCase();
                if (k === 'enter' || k === ' ' || k === 'e') g.story.advance();
                else if (k === 'escape') g.story.endScene();
                e.preventDefault(); e.stopImmediatePropagation();
                return;
            }
            const dir = ARROW_DIR[e.key];
            if (dir && navWantsArrows()) { e.preventDefault(); e.stopImmediatePropagation(); navMove(dir); }
        }, true);
        const pointer = (e) => { if (e.isTrusted) { this.pointerLive = true; this.setDevice(e.pointerType === 'touch' ? 'touch' : 'mouse'); } };
        window.addEventListener('pointerdown', (e) => { if (e.isTrusted) g.audio?.unlock(); }, true);
        window.addEventListener('pointerdown', pointer, true);
        // a mouse that really moves, as opposed to a stationary one under a panel that opens. Not every engine reports
        // movementX and movementY on pointer events (Safari reports none), so the distance is measured here
        let lastMouse: { x: number; y: number } | null = null;
        window.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const moved = lastMouse ? Math.abs(e.clientX - lastMouse.x) + Math.abs(e.clientY - lastMouse.y) : Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
            lastMouse = { x: e.clientX, y: e.clientY };
            if (moved > 1) pointer(e);
        }, true);
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
            uiBridge.padProfile.value = !!this.profiles[best.id];
            // a pad the browser cannot lay out, and no setup for it yet: say where to fix that, once
            if (best.mapping !== 'standard' && !this.profiles[best.id] && !this.warned.has(best.id)) {
                this.warned.add(best.id);
                this.game.ui?.toast?.('This controller is not recognised: set it up in Settings, Controls');
            }
        }
        return best;
    }

    /** Called every frame, also while the game is paused or on the title screen. */
    poll() {
        const raw = this.readPad();
        if (this.setup) { this.frame = this.mapper.update(null, performance.now()); this.pollSetup(raw); return; }
        // a controller set up by the player is read through its profile
        const prof = raw && this.profiles[raw.id];
        const pad = prof ? applyProfile(raw, prof) : raw;
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

    /**
     * A named moment felt through the controller (core/input/gamepad HAPTICS), each kept to its cooldown, at the
     * player's strength. Only while playing on the pad, except the test from Settings, which may be clicked.
     */
    haptic(name) {
        const p = HAPTICS[name];
        if (!p || !uiBridge.vibration.value || (this.device !== 'pad' && name !== 'test')) return;
        if (!this.hapticGate.allow(name, performance.now())) return;
        const r = scaleRumble(p, uiBridge.vibrationStrength.value);
        const pad = this.readPad();
        const act = pad && pad.vibrationActuator;
        if (r && act && act.playEffect) act.playEffect('dual-rumble', { startDelay: 0, duration: r.ms, weakMagnitude: r.weak, strongMagnitude: r.strong }).catch(() => {});
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
        // in a search box or drop-down of the game menu, one press is enough: leave the field and close the menu
        // (unless a panel sits on top of the menu, which closes first)
        const a = document.activeElement as HTMLElement | null;
        if (uiBridge.pauseOpen.value && a && (a instanceof HTMLSelectElement || a instanceof HTMLTextAreaElement || (a instanceof HTMLInputElement && a.type !== 'range' && a.type !== 'checkbox')) && navScope()?.classList.contains('vs-menu')) {
            a.blur();
            g.ui.closeMenu();
            return true;
        }
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
        // the crash screen: the d-pad moves between its buttons, A presses
        if (uiBridge.crash.value) {
            const dir = f.stick || DIRS.find((d) => has(d));
            if (dir) navMove(dir);
            if (has('interact')) navConfirm();
            return;
        }
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
                // the d-pad steps through the destinations (travel) or the places on the map (looking); Y pins
                const dir = DIRS.find((d) => has(d));
                const by = dir === 'up' || dir === 'left' ? -1 : 1;
                if (dir && uiBridge.worldMap.value?.mode === 'travel') c.step?.(by);
                else if (dir) c.stepMark?.(by);
                if (has('skill2')) c.pin?.();
            }
            return;
        }
        // a story scene: A reads on, B or Start skips it
        if (g.story.current) {
            if (has('interact')) g.story.advance();
            else if (has('cancel') || has('menu')) g.story.endScene();
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
        if (has('zoomIn')) g.zoomBy(1);
        if (has('zoomOut')) g.zoomBy(-1);
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
