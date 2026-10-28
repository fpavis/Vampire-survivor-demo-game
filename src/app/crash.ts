// @ts-nocheck -- bound to the game runtime; the report's shape lives in core/crash
// When something throws. An error in a frame would stop Pixi's ticker (it asks for the next frame only after a
// clean one) and freeze the game without a word, so the game and title loops run inside a guard. Any error is
// shown on a crash screen with a report to copy, and saving stops so the last good save is kept as it was.
import { crashKey, crashReport, describeError, isNoise } from '../core/crash';
import { GAME_VERSION } from '../core/version';
import { ui as uiBridge } from '../ui/bridge';

declare const __BUILD_INFO__: string;
const BUILD = typeof __BUILD_INFO__ === 'string' ? __BUILD_INFO__ : 'dev';

const seen = new Set();

/** Report an error. In the loop it is fatal: the game stops and only Reload is offered. */
export function reportCrash(game, err, where) {
    const { message, stack } = describeError(err);
    if (isNoise(message)) return;
    const key = crashKey(message, stack);
    if (seen.has(key)) return;
    seen.add(key);
    const fatal = where === 'loop';
    // a fatal crash already on screen stays the one shown
    if (game.crashed && game.crashed.fatal && !fatal) return;
    console.error('[crash]', where, err);
    const report = crashReport({
        message, stack, where, version: GAME_VERSION, build: BUILD,
        agent: navigator.userAgent,
        mode: !game.state?.player ? 'title screen' : game.mode || 'unknown',
        place: (game.mode === 'interior' ? game.interiorName : game.regionName) || '',
        log: (uiBridge.log.value || []).map((l) => l.text),
        at: new Date().toISOString()
    });
    game.crashed = { fatal, message };
    if (fatal && game.state) game.state.paused = true;
    uiBridge.crash.value = { message, report, fatal };
}

/** Keep playing after an error outside the loop: saving starts again. */
export function dismissCrash(game) {
    if (game.crashed && game.crashed.fatal) return;
    game.crashed = null;
    uiBridge.crash.value = null;
}

/** A ticker callback that reports a throw instead of freezing; after a fatal crash it only reads the controller. */
export function guarded(game, fn) {
    return (delta) => {
        if (game.crashed && game.crashed.fatal) { try { game.input?.poll(); } catch { /* the input is part of what broke */ } return; }
        try { fn(delta); } catch (err) { reportCrash(game, err, 'loop'); }
    };
}

export function installCrashHandlers(game) {
    window.addEventListener('error', (e) => reportCrash(game, e.error || e.message, 'event'));
    window.addEventListener('unhandledrejection', (e) => reportCrash(game, e.reason, 'promise'));
}
