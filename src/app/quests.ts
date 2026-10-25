// @ts-nocheck -- bound to the game runtime; the rules live in core/quest and core/story
// Quests, the story and bounty boards at runtime: listens to what happens in the world, keeps the quest state,
// pays rewards, runs the elder's dialogue and publishes everything the journal, tracker and board show.
import { ui as uiBridge } from '../ui/bridge';
import {
    abandonQuest, applyEvent, canStart, defOf, describeObjective, goalOf, hasFlag, isActive, isDone, isReady, newQuestState, progressText,
    setFlag, startQuest, turnIn
} from '../core/quest/quests';
import { BOUNTY_SLOTS, boardBounties, epochOf } from '../core/quest/bounties';
import { findPlace } from '../core/quest/places';
import { bearing } from '../core/quest/text';
import { CHAPTERS, DEMON_LORDS, DIALOGUES, SOVEREIGN, chapterOfQuest, currentMainQuest, elderScript, lookupMain } from '../core/story/story';
import { DialogueRunner } from '../core/story/dialogue';
import { WORLD_CONFIG } from '../core/config';

const T = WORLD_CONFIG.tile;

const rewardText = (r) => [r.gold ? `🪙 ${r.gold}` : '', r.xp ? `✨ ${r.xp} xp` : '', r.loot ? `🎁 ${r.loot >= 2 ? 'rare ' : ''}skills` : '',
    ...Object.entries(r.resources || {}).map(([k, v]) => `${v} ${k}`)].filter(Boolean).join('  ·  ');

export class QuestSystem {
    constructor(game) {
        this.game = game;
        this.state = newQuestState();
        this.places = new Map();          // place id -> Poi, for names and markers
        this.offerCache = new Map();      // `${quest}:${objective}` -> place id for the postings on a board
        this.runner = null;
        this.scanTimer = 0;
        this.surviveAcc = 0;
        this.lookup = (id) => lookupMain(id);
        this.dctx = this.dialogueContext();
        this.bind();
    }

    // ---------------------------------------------------------------- state
    load(saved) {
        this.state = newQuestState();
        if (saved) {
            this.state.active = JSON.parse(JSON.stringify(saved.active || {}));
            this.state.done = [...(saved.done || [])];
            this.state.flags = { ...(saved.flags || {}) };
            this.state.tracked = saved.tracked ?? null;
            this.state.bounties = JSON.parse(JSON.stringify(saved.bounties || {}));
        }
        this.runner = null;
        this.places.clear();
        uiBridge.dialog.value = null;
        this.publish();
    }

    serialize() { return JSON.parse(JSON.stringify(this.state)); }

    level() { return this.game.state.level; }
    ctx() { return { level: this.level() }; }

    // --------------------------------------------------------------- places
    poiById(id) {
        if (this.places.has(id)) return this.places.get(id);
        const g = this.game;
        let p = null;
        if (id.startsWith('plat:')) { const rec = g.towers.byId(id.slice(5)); p = rec && rec.built ? g.dungeons.plateauOf(rec) : null; }
        else if (id.startsWith('sea:')) { const [cx, cy] = id.slice(4).split(',').map(Number); p = g.dungeons.seaCell(cx, cy); }
        else { const [cx, cy] = id.split(',').map(Number); if (Number.isFinite(cx) && Number.isFinite(cy)) p = g.overworld.poiForCell(cx, cy); }
        if (p) this.places.set(id, p);
        return p;
    }

    resolve(t) {
        if (t.realm === 'plateau' || t.realm === 'sea') return null;      // any matching one counts, and only exists once built
        const p = findPlace(this.game.overworld, t);
        if (!p) return null;
        this.places.set(p.id, p);
        return p.id;
    }

    names() {
        return {
            place: (t, resolved) => {
                const p = resolved ? this.poiById(resolved) : null;
                if (p) return p.name;
                return t.realm === 'plateau' ? 'a Skyvault' : t.realm === 'sea' ? 'a drowned shrine' : t.kind === 'town' ? 'a town' : t.kind === 'dungeon' ? 'a dungeon' : 'a place';
            }
        };
    }

    // ------------------------------------------------------------- starting
    start(def) {
        if (!startQuest(this.state, def, this.game.state.time, this.ctx(), (t) => this.resolve(t))) return false;
        this.game.ui.toast(`Quest started: ${def.title}`);
        this.game.audio.play('quest');
        this.checkDiscover();
        this.syncVisited();
        this.publish();
        this.game.requestSave('quest');
        return true;
    }

    // --------------------------------------------------------------- events
    bind() {
        const g = this.game, ev = g.events;
        ev.on('EnemyKilled', (e) => this.fire({ type: 'kill', enemy: e.type, group: e.group, boss: !!e.boss }));
        ev.on('PlaceEntered', (e) => this.fire({ type: 'enter', poi: { id: e.id, type: e.kind, group: e.group, ...(e.dungeon ? { dungeon: { realm: e.dungeon } } : {}) } }));
        ev.on('DungeonCleared', (e) => this.fire({ type: 'clear', poi: { id: e.id, type: e.type, group: e.group, dungeon: { realm: e.realm } } }));
        ev.on('TowerBuilt', (e) => this.fire({ type: 'build', kind: e.kind }));
        ev.on('Collected', (e) => this.fire({ type: 'gather', resource: e.resource, count: e.count }));
    }

    fire(ev) {
        const ups = applyEvent(this.state, this.lookup, ev);
        if (!ups.length) return;
        const g = this.game;
        for (const u of ups) {
            const def = defOf(this.state, this.lookup, u.quest);
            if (!def) continue;
            if (u.ready && u.objectiveDone) {
                g.ui.toast(`${def.title}: all done. ${def.giver === 'elder' ? 'Return to the Elder' : 'Claim it at a bounty board'}`);
                g.audio.play('levelup');
            } else if (u.objectiveDone) {
                g.ui.toast(`✔ ${describeObjective(def.objectives[u.index], this.names(), this.state.active[u.quest].targets[u.index])}`);
                g.audio.play('pickup');
            }
        }
        this.publish();
        if (ups.some((u) => u.objectiveDone)) g.requestSave('quest');
    }

    /** places seen on the map count as discovered, including ones seen before the quest began */
    checkDiscover() {
        const g = this.game;
        if (g.mode !== 'overworld') return;
        const wants = Object.keys(this.state.active).some((id) => {
            const def = defOf(this.state, this.lookup, id);
            return def && def.objectives.some((o, i) => o.type === 'discover' && this.state.active[id].progress[i] < 1);
        });
        if (!wants) return;
        for (const p of g.map.discoveredPois()) this.fire({ type: 'discover', poi: { id: p.id, type: p.type, group: p.group, ...(p.dungeon ? { dungeon: { realm: p.dungeon.realm } } : {}) } });
    }

    /** a dungeon already cleared (or a place already visited) counts for a quest that asks for it later */
    syncVisited() {
        const g = this.game;
        const facts = (p) => ({ id: p.id, type: p.type, group: p.group, ...(p.dungeon ? { dungeon: { realm: p.dungeon.realm } } : {}) });
        for (const id of Object.keys(this.state.active)) {
            const def = defOf(this.state, this.lookup, id), q = this.state.active[id];
            if (!def) continue;
            def.objectives.forEach((o, i) => {
                if (q.progress[i] >= goalOf(o) || (o.type !== 'clear' && o.type !== 'enter')) return;
                const done = (vid) => (o.type === 'clear' ? g.visited[vid] && g.visited[vid].bossDead : !!g.visited[vid]);
                const t = q.targets[i];
                const ids = t ? [t] : Object.keys(g.visited);
                for (const vid of ids) {
                    if (!done(vid)) continue;
                    const p = this.poiById(vid);
                    if (p) this.fire({ type: o.type, poi: facts(p) });
                }
            });
        }
    }

    update(delta) {
        const g = this.game;
        if (!g.state.player || g.state.paused) return;
        this.scanTimer -= delta;
        if (this.scanTimer <= 0) { this.scanTimer = 45; this.checkDiscover(); this.syncVisited(); }
        if (g.mode === 'overworld' && !g.boat) {
            this.surviveAcc += delta / 60;
            if (this.surviveAcc >= 1) {
                const whole = Math.floor(this.surviveAcc);
                this.surviveAcc -= whole;
                if (g.zoneGroup) this.fire({ type: 'survive', seconds: whole, group: g.zoneGroup });
            }
        }
    }

    // -------------------------------------------------------------- rewards
    pay(r, title) {
        const g = this.game, w = g.state.wallet;
        if (r.gold) w.gold += r.gold;
        for (const [k, v] of Object.entries(r.resources || {})) w[k] = (w[k] || 0) + v;
        uiBridge.wallet.value = { ...w };
        if (r.xp) { g.addXp(r.xp); g.checkLevelUp(); }
        if (r.loot) g.grantLoot(r.loot);
        const p = g.state.player;
        g.fx.pillar(p.wx, p.wy, 0xffd84a, 60, 70, 260);
        g.ui.banner(`QUEST COMPLETE · ${title.toUpperCase()}`, 0xffd84a);
        g.audio.play('questDone');
        g.input.rumble(0.3, 0.7, 240);
    }

    turnInQuest(id) {
        const g = this.game;
        const def = defOf(this.state, this.lookup, id);
        const res = turnIn(this.state, this.lookup, id, g.state.wallet);
        if (!res.ok) { g.ui.toast(res.reason || 'Not ready yet'); g.audio.play('deny'); return false; }
        for (const [k, n] of Object.entries(res.consume)) g.state.wallet[k] -= n;
        this.pay(res.rewards, def.title);
        g.events.emit('QuestCompleted', { id });
        this.publish();
        g.requestSave('quest', true);
        return true;
    }

    canPay(def) {
        const w = this.game.state.wallet;
        const need = {};
        for (const o of def.objectives) if (o.type === 'deliver') need[o.resource] = (need[o.resource] || 0) + o.count;
        return Object.entries(need).every(([k, n]) => (w[k] || 0) >= n);
    }

    abandon(id) {
        if (abandonQuest(this.state, id)) { this.game.ui.toast('Bounty dropped'); this.publish(); return true; }
        return false;
    }

    track(id) { this.state.tracked = this.state.tracked === id ? null : id; this.publish(); this.game.map.dirty = true; }

    // -------------------------------------------------------------- dialogue
    current() { return currentMainQuest(this.state, this.level()); }

    hintFor(def) {
        const g = this.game, q = this.state.active[def.id];
        if (!q) return def.summary;
        const p = g.state.player;
        const here = { tx: Math.floor(p.wx / T), ty: Math.floor(p.wy / T) };
        const lines = [];
        def.objectives.forEach((o, i) => {
            if (o.type !== 'deliver' && q.progress[i] >= goalOf(o)) return;
            let line = describeObjective(o, this.names(), q.targets[i]);
            if (o.type === 'deliver') line += ` (you carry ${g.state.wallet[o.resource] || 0})`;
            else if (q.targets[i]) { const poi = this.poiById(q.targets[i]); if (poi) line += `: ${bearing(here, poi)}`; }
            lines.push(line);
        });
        return lines.length ? lines.join('. ') + '.' : 'Everything is done: speak to me.';
    }

    dialogueContext() {
        return {
            check: (c) => {
                if ('flag' in c) return hasFlag(this.state, c.flag);
                if ('noFlag' in c) return !hasFlag(this.state, c.noFlag);
                if ('gold' in c) return this.game.state.wallet.gold >= c.gold;
                const def = lookupMain(c.quest);
                const st = isDone(this.state, c.quest) ? 'done' : isActive(this.state, c.quest) ? (def && isReady(this.state, def) ? 'ready' : 'active') : 'none';
                return st === c.is;
            },
            apply: (e) => {
                const g = this.game;
                const questId = (id) => (id === 'current' ? (this.current() ? this.current().def.id : null) : id);
                if ('flag' in e) setFlag(this.state, e.flag, e.value ?? true);
                else if ('start' in e) { const id = questId(e.start); const def = id && lookupMain(id); if (def) this.start(def); }
                else if ('turnIn' in e) { const id = questId(e.turnIn); if (id) this.turnInQuest(id); }
                else if ('gold' in e) { g.state.wallet.gold += e.gold; uiBridge.wallet.value = { ...g.state.wallet }; }
                else if ('loot' in e) g.grantLoot(e.loot);
                else if ('talk' in e) this.fire({ type: 'talk', npc: e.talk });
                else if ('say' in e) g.ui.toast(e.say);
                this.publish();
            },
            vars: (name) => {
                const cur = this.current();
                if (name === 'quest.title') return cur ? cur.def.title : '';
                if (name === 'quest.summary') return cur ? cur.def.summary : '';
                if (name === 'quest.hint') return cur ? this.hintFor(cur.def) : '';
                return `{${name}}`;
            }
        };
    }

    talkToElder() {
        const script = elderScript(this.state, this.level(), (def) => this.canPay(def));
        this.startDialogue(script);
    }

    startDialogue(id) {
        const script = DIALOGUES[id];
        if (!script) return;
        this.fire({ type: 'talk', npc: 'elder' });
        this.runner = new DialogueRunner(script, this.dctx);
        this.pushDialog();
        this.game.audio.play('blip');
    }

    pushDialog() {
        if (!this.runner || this.runner.done) { this.runner = null; uiBridge.dialog.value = null; return; }
        const v = this.runner.view();
        uiBridge.dialog.value = { speaker: v.speaker, icon: v.icon, text: v.text, choices: v.choices, last: v.last, script: true };
    }

    advance(choice) {
        this.game.audio.play('blip');
        if (!this.runner) return;
        this.runner.advance(choice);
        this.pushDialog();
    }

    closeDialogue() { this.runner = null; }

    // ---------------------------------------------------------------- boards
    boardInfo(poi) {
        const o = this.game.overworld;
        return { id: poi.id, group: poi.group, level: Math.max(1, o.levelAt(poi.tx, poi.ty)), tx: poi.tx, ty: poi.ty };
    }

    boardRotation(poi) {
        const epoch = epochOf(this.game.state.time);
        let b = this.state.bounties[poi.id];
        if (!b || b.epoch !== epoch) b = this.state.bounties[poi.id] = { epoch, taken: [] };
        return { epoch, taken: b.taken, defs: boardBounties(this.game.overworld.seed, this.boardInfo(poi), epoch) };
    }

    openBoard() {
        const poi = this.game.interiorPoi;
        if (!poi || poi.type !== 'city') return;
        const b = uiBridge;
        b.healerOpen.value = b.shopOpen.value = b.innOpen.value = false;
        b.dialog.value = null;
        b.boardOpen.value = true;
        this.publish();
        this.game.audio.play('equip');
    }

    acceptBounty(slot) {
        const poi = this.game.interiorPoi;
        if (!poi) return false;
        const rot = this.boardRotation(poi);
        const def = rot.defs[slot];
        if (!def || rot.taken.includes(slot)) return false;
        if (Object.values(this.state.active).filter((q) => q.def).length >= 6) { this.game.ui.toast('Your bounty list is full (6)'); return false; }
        if (!this.start(def)) return false;
        rot.taken.push(slot);
        this.publish();
        return true;
    }

    /** an objective on a posting, with the place named and its direction when it points somewhere */
    offerLine(def, o, i) {
        if (!('target' in o)) return describeObjective(o, this.names(), null);
        const key = `${def.id}:${i}`;
        if (!this.offerCache.has(key)) this.offerCache.set(key, this.resolve(o.target));
        const id = this.offerCache.get(key);
        const poi = id ? this.poiById(id) : null;
        const text = describeObjective(o, this.names(), id);
        if (!poi) return text;
        const p = this.game.state.player;
        return `${text} (${bearing({ tx: Math.floor(p.wx / T), ty: Math.floor(p.wy / T) }, poi)})`;
    }

    // ------------------------------------------------------------------ views
    questView(id) {
        const def = defOf(this.state, this.lookup, id);
        const q = this.state.active[id];
        if (!def || !q) return null;
        return {
            id, title: def.title, summary: def.summary, kind: def.kind, giver: def.giver, level: def.level ?? 0,
            ready: isReady(this.state, def), payable: this.canPay(def),
            tracked: this.state.tracked === id,
            reward: rewardText(def.rewards),
            objectives: def.objectives.map((o, i) => ({
                text: describeObjective(o, this.names(), q.targets[i]),
                progress: progressText(o, o.type === 'deliver' ? Math.min(goalOf(o), this.game.state.wallet[o.resource] || 0) : q.progress[i]),
                done: o.type === 'deliver' ? false : q.progress[i] >= goalOf(o)
            }))
        };
    }

    publish() {
        const cur = this.current();
        const ch = cur ? chapterOfQuest(cur.def.id) : null;
        const mainId = cur && cur.status !== 'offer' && cur.status !== 'locked' ? cur.def.id : null;
        const bounties = Object.keys(this.state.active).filter((id) => this.state.active[id].def).map((id) => this.questView(id)).filter(Boolean);
        const main = mainId ? this.questView(mainId) : null;
        uiBridge.quests.value = {
            begun: !!this.state.flags.begun,
            chapter: ch ? { title: ch.title, blurb: ch.blurb } : (this.state.flags.finale ? { title: 'Epilogue', blurb: 'The world is still wide.' } : null),
            next: cur && !main ? { title: cur.def.title, summary: cur.def.summary, status: cur.status, level: cur.def.level ?? 0 } : null,
            main, bounties,
            done: this.state.done.length,
            lords: DEMON_LORDS.map((l) => ({ name: l.name, title: l.title, group: l.group, dead: !!this.state.flags[`lord.${l.group}`] })),
            sovereign: { name: SOVEREIGN.name, title: SOVEREIGN.title, dead: !!this.state.flags.finale }
        };
        const trackedId = this.state.tracked && this.state.active[this.state.tracked] ? this.state.tracked : (main ? main.id : (bounties[0] ? bounties[0].id : null));
        uiBridge.tracker.value = trackedId ? this.questView(trackedId) : null;
        // the board shows what the town posts and what you carry
        const poi = this.game.interiorPoi;
        if (uiBridge.boardOpen.value && this.game.mode === 'interior' && poi && poi.type === 'city') {
            const rot = this.boardRotation(poi);
            uiBridge.board.value = {
                town: poi.name,
                nextIn: Math.max(0, Math.round((rot.epoch + 1) * 1200 - this.game.state.time)),
                offers: rot.defs.map((d, slot) => ({ slot, title: d.title, summary: d.summary, level: d.level, reward: rewardText(d.rewards), lines: d.objectives.map((o, i) => this.offerLine(d, o, i)), taken: rot.taken.includes(slot) })),
                mine: bounties
            };
        } else uiBridge.board.value = null;
    }

    /** quest markers for the world map: where the tracked quest wants you to go (revealed even before you have seen it) */
    markers() {
        const out = [];
        const ids = this.state.tracked && this.state.active[this.state.tracked] ? [this.state.tracked] : Object.keys(this.state.active);
        for (const id of ids) {
            const def = defOf(this.state, this.lookup, id);
            const q = this.state.active[id];
            if (!def) continue;
            def.objectives.forEach((o, i) => {
                const rid = q.targets[i];
                if (!rid || q.progress[i] >= goalOf(o)) return;
                const p = this.poiById(rid);
                if (p) out.push({ tx: p.tx, ty: p.ty, icon: o.type === 'clear' ? '⚔' : '❗', label: def.title, color: '#7ad8ff' });
            });
        }
        return out;
    }
}
