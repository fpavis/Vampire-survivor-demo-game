// @ts-nocheck -- game glue in the style of the other app systems
// The story's big moments on screen: a card when a warlord or demon lord shows itself and when it falls, the ending
// with its closing roll, the death screen and the "you wake in ..." card after a respawn.
import { ui as uiBridge } from '../ui/bridge';
import { ENEMY_TYPES } from '../core/config';
import { EPILOGUE, bossIntroCard, runSummary, victoryCard } from '../core/story/ending';
import { CREDITS } from '../core/version';

export class StoryDirector {
    constructor(game) {
        this.game = game;
        this.seq = 0;
        this.timer = null;
        this.pendingEnding = false;
    }

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
        const c = bossIntroCard(e.lord || null, ENEMY_TYPES[e.type] ? ENEMY_TYPES[e.type].name : e.type, this.groupOf(e));
        this.card(c, 4200);
        g.audio.stinger('stingBoss');
        g.ui.logMessage(`${c.name}, ${c.title}`, c.lord ? 'lord' : 'lair', true);
    }

    victory(e) {
        const g = this.game;
        const c = victoryCard(e.lord || null, ENEMY_TYPES[e.type] ? ENEMY_TYPES[e.type].name : e.type, this.groupOf(e));
        this.card(c, 5200);
        g.audio.stinger('stingVictory');
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
        if (this.pendingEnding && !uiBridge.dialog.value && !g.busy && !uiBridge.ending.value) { this.pendingEnding = false; this.ending(); }
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
