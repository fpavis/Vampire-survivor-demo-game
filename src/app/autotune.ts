// @ts-nocheck -- bound to the game runtime; the rules live in core/settings/autotune
// Feeds frame times to dynamic resolution while playing, and on a first start times the title scene to pick a
// quality preset. Automated browsers (navigator.webdriver) are left alone: they draw on a software GPU at a few
// frames a second, and the tests expect the default settings. A test turns it on with window.__autoTune (an object
// may also shorten the timing: { skip, frames }).
import { frameBudget, initDynRes, pickQuality, stepDynRes } from '../core/settings/autotune';
import { applySettings, hasSavedSettings, setSettings, settings } from './settings';

const QUALITY_NAME = { high: 'High', medium: 'Medium', low: 'Low' };

export class AutoTune {
    constructor(game) {
        this.game = game;
        this.state = initDynRes();
        this.bench = null;         // frame times of the title scene, while the first-run pick is being made
        this.notice = null;        // said once the game starts: what the pick chose
    }

    get allowed() { return typeof navigator === 'undefined' || !navigator.webdriver || !!window.__autoTune; }

    /** The share of the chosen render scale in use now (1: all of it). */
    get factor() { return settings.dynRes && this.allowed ? this.state.factor : 1; }

    /** On the title screen of a first start: time the scene for a couple of seconds, then pick the preset. */
    startBench() {
        if (!this.allowed || hasSavedSettings()) return;
        const t = typeof window !== 'undefined' && typeof window.__autoTune === 'object' ? window.__autoTune : {};
        this.bench = { frames: [], skip: t.skip ?? 30, want: t.frames ?? 120 };
    }

    /** Every frame of the title screen. */
    titleFrame(ms) {
        const b = this.bench;
        if (!b) return;
        if (b.skip > 0) { b.skip--; return; }    // the first frames are spent loading
        b.frames.push(ms);
        if (b.frames.length < b.want) return;
        this.bench = null;
        const q = pickQuality(b.frames);
        setSettings(this.game, { quality: q });   // saved: a first start happens once
        this.notice = `Graphics set to ${QUALITY_NAME[q]} for this device (Settings, Video changes it)`;
    }

    /** The game starts: a pick under way is made from what was timed (or left for the next start, if too little). */
    finishBench() {
        const b = this.bench;
        this.bench = null;
        if (!b || b.frames.length < Math.min(20, b.want)) return;
        const q = pickQuality(b.frames);
        setSettings(this.game, { quality: q });
        this.notice = `Graphics set to ${QUALITY_NAME[q]} for this device (Settings, Video changes it)`;
    }

    /** Every frame of play. */
    playFrame(ms) {
        if (!settings.dynRes || !this.allowed) { if (this.state.factor !== 1) { this.state = initDynRes(); applySettings(this.game); } return; }
        const next = stepDynRes(this.state, ms, frameBudget(settings.fpsCap));
        const changed = next.factor !== this.state.factor;
        this.state = next;
        if (changed) applySettings(this.game);
    }
}
