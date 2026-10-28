// @ts-nocheck -- game glue in the style of the other app systems
// The story's big moments on screen: a card when a warlord shows itself and when it falls; a scene (letterbox bars,
// a portrait, the line typed out, the camera on the speaker) when a demon lord or the Sovereign does, when the Elder
// has a word between chapters, and before the ending; the ending with its closing roll, the death screen and the
// "you wake in ..." card after a respawn. "Story scenes: Cards only" shows cards instead and never holds play.
import { ui as uiBridge } from '../ui/bridge';
import { ENEMY_TYPES } from '../core/config';
import { EPILOGUE, INTERLUDES, bossIntroCard, interludeDue, krakenCard, lordFallScene, lordIntroScene, runSummary, victoryCard } from '../core/story/ending';
import { CHAPTERS } from '../core/story/story';
import { CREDITS } from '../core/version';
import { settings } from './settings';
import { access } from './access';
import { portrait } from './portraits';

/** Characters typed per frame. */
const TYPE_SPEED = 1.5;

export class StoryDirector {
    constructor(game) {
        this.game = game;
        this.seq = 0;
        this.timer = null;
        this.pendingEnding = false;
        this.current = null;          // the scene playing
        this.interlude = null;        // a chapter whose interlude waits for the party to be in town
        game.events.on('PlaceEntered', (e) => { if (e.kind === 'city') this.interlude = this.dueInterlude(); });
    }

    // ------------------------------------------------------------ scenes
    /**
     * Play a scene: `lines` of { speaker, title, text, lord, portrait?, icon? }, the camera easing to `at` (x, y).
     * Play holds until the last line is read or the scene is skipped; `then` runs after. False when the player
     * prefers cards, or a scene is already playing.
     */
    play(lines, opts = {}) {
        const g = this.game;
        if (settings.storyScenes === 'cards' || this.current || !lines.length) return false;
        this.current = { id: ++this.seq, lines, index: 0, shown: 0, at: opts.at || null, then: opts.then || null, wasPaused: g.state.paused };
        g.state.paused = true;
        g.state.keys = {};
        g.state.pointerDown = false;
        uiBridge.card.value = null;
        g.closeNpcPanels();
        this.publishScene();
        return true;
    }

    publishScene() {
        const sc = this.current;
        if (!sc) { uiBridge.scene.value = null; return; }
        const l = sc.lines[sc.index];
        uiBridge.scene.value = { id: sc.id, index: sc.index, count: sc.lines.length, speaker: l.speaker || '', title: l.title || '', text: l.text, shown: Math.floor(sc.shown), portrait: l.portrait || '', icon: l.icon || (l.speaker ? 'lord' : 'fleur') };
    }

    /** Each frame of a scene (the world holds): type the line out and ease the camera to the speaker. */
    updateScene(delta) {
        const g = this.game, sc = this.current;
        if (!sc) return;
        const len = sc.lines[sc.index].text.length;
        if (sc.shown < len) { sc.shown = access.reducedMotion ? len : Math.min(len, sc.shown + TYPE_SPEED * delta); this.publishScene(); }
        if (sc.at && !access.reducedMotion) {
            const k = 1 - Math.pow(0.9, delta);
            g.cam.x += (sc.at.x - g.cam.x) * k;
            g.cam.y += (sc.at.y - g.cam.y) * k;
            g.applyCamera();
            g.world.update(g.cam.x, g.cam.y, g.viewW, g.viewH);
        }
    }

    /** Enter, A or a click: show the whole line, then the next, then end. */
    advance() {
        const sc = this.current;
        if (!sc) return;
        const len = sc.lines[sc.index].text.length;
        if (sc.shown < len) sc.shown = len;
        else if (sc.index + 1 < sc.lines.length) { sc.index++; sc.shown = 0; }
        else { this.endScene(); return; }
        this.game.audio.play('blip');
        this.publishScene();
    }

    /** Esc or B: the rest of the scene is skipped. */
    endScene() {
        const g = this.game, sc = this.current;
        if (!sc) return;
        this.current = null;
        uiBridge.scene.value = null;
        if (!sc.wasPaused && !uiBridge.pauseOpen.value) g.state.paused = false;
        if (sc.then) sc.then();
    }

    /** The Elder's interlude for the latest chapter closed, once (earlier untold ones are passed over). */
    dueInterlude() {
        const q = this.game.quests.state;
        const ch = interludeDue((id) => q.done.includes(id), (id) => !!q.flags[`interlude.${id}`]);
        if (!ch) return null;
        for (const c of CHAPTERS) { q.flags[`interlude.${c.id}`] = true; if (c.id === ch) break; }
        return ch;
    }

    /** Where the Elder stands in this town (the camera goes there), or null. */
    elderAt() {
        const it = this.game.interactables.find((i) => i.kind === 'elder');
        return it ? { x: it.x, y: it.y } : null;
    }

    elderLine(text) { return { speaker: 'The Elder', title: '', text, lord: null, icon: 'elder' }; }

    /** Show a card over the action for `ms` milliseconds (it never blocks play). */
    card(c, ms) {
        const id = ++this.seq;
        uiBridge.card.value = { id, kind: c.kind, name: c.name, title: c.title || '', text: c.text || '' };
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { if (uiBridge.card.value && uiBridge.card.value.id === id) uiBridge.card.value = null; }, ms);
    }

    /** A warlord, demon lord or the Sovereign has noticed the party. */
    bossIntro(e) {
        const g = this.game;
        const c = e.kraken ? krakenCard('boss') : bossIntroCard(e.lord || null, ENEMY_TYPES[e.type] ? ENEMY_TYPES[e.type].name : e.type, this.groupOf(e));
        g.audio.stinger('stingBoss');
        g.input?.haptic('bossIntro');
        // a demon lord speaks for itself; a warlord, or anyone when the player prefers cards, gets the card
        const pic = e.lord ? portrait(g, e.type) : '';
        if (!e.lord || !this.play(lordIntroScene(e.lord).map((l) => ({ ...l, portrait: pic })), { at: { x: e.wx, y: e.wy } })) this.card(c, 4200);
        g.ui.logMessage(`${c.name}, ${c.title}`, c.lord ? 'lord' : 'lair', true);
    }

    victory(e) {
        const g = this.game;
        const c = e.kraken ? krakenCard('victory') : victoryCard(e.lord || null, ENEMY_TYPES[e.type] ? ENEMY_TYPES[e.type].name : e.type, this.groupOf(e));
        g.audio.stinger('stingVictory');
        const pic = e.lord ? portrait(g, e.type) : '';
        if (!e.lord || !this.play(lordFallScene(e.lord).map((l) => (l.lord ? { ...l, portrait: pic } : { ...l, icon: 'crown' })), { at: { x: e.wx, y: e.wy } })) this.card(c, 5200);
        g.ui.logMessage(`${c.name} ${c.title}`, 'crown', true);
    }

    /** The region a boss belongs to: its dungeon's, or the ground it stands on. */
    groupOf(e) {
        const g = this.game;
        if (e.group) return e.group;
        if (g.mode === 'overworld') return g.world.groupAtPos(e.wx, e.wy);
        return g.interiorPoi ? g.interiorPoi.group : g.zoneGroup;
    }

    wake(place) {
        this.card({ kind: 'wake', name: `You wake in ${place}`, title: '', text: 'The party is back on its feet, still hurting. A healer can mend the rest.' }, 3800);
    }

    // ------------------------------------------------------------ the ending
    /** The Sovereign's quest was turned in: the ending plays once the conversation is over. */
    queueEnding() { this.pendingEnding = true; }

    update() {
        const g = this.game;
        if (this.pendingEnding && !uiBridge.dialog.value && !g.busy && !uiBridge.ending.value) {
            this.pendingEnding = false;
            // the Elder leads into the ending (with cards only, it simply begins)
            if (!this.play([this.elderLine(INTERLUDES.ch6)], { at: this.elderAt(), then: () => this.ending() })) this.ending();
            return;
        }
        // the Elder's word between chapters, once the party is in town and nothing else is open
        if (this.interlude && !g.busy && g.mode === 'interior' && !uiBridge.dialog.value && !this.current) {
            const ch = this.interlude;
            this.interlude = null;
            const text = INTERLUDES[ch];
            if (!this.play([this.elderLine(text)], { at: this.elderAt() })) g.ui.toast(`The Elder: "${text}"`, 'elder');
        }
    }

    ending() {
        const g = this.game, s = g.state;
        s.paused = true;
        s.keys = {};
        uiBridge.card.value = null;
        uiBridge.ending.value = {
            epilogue: EPILOGUE,
            roll: runSummary({
                time: s.time, level: Math.max(...g.party.heroes.map((h) => h.level)), kills: s.kills, bosses: s.bossesDefeated,
                distance: s.distance, gold: s.goldEarned, places: g.map.discoveredPois().length, regions: g.regionsSeen.size, deaths: s.deaths
            }),
            credits: CREDITS
        };
        g.audio.music.setTrack('title');
        g.events.emit('EndingShown', {});
    }

    endEnding() {
        if (!uiBridge.ending.value) return;
        uiBridge.ending.value = null;
        if (!uiBridge.pauseOpen.value) this.game.state.paused = false;
    }

    // ------------------------------------------------------------ the death screen
    showDeath(target) {
        const g = this.game, s = g.state;
        uiBridge.death.value = {
            place: target.label,
            rows: [
                ['timer', 'Time played', g.formatTime(s.time)],
                ['star', 'Hero level', String(s.level)],
                ['skull', 'Monsters defeated', String(s.kills)],
                ['gauge', 'Zone level', String(g.zoneLevelNow)]
            ]
        };
    }
}
