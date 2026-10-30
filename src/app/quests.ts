// @ts-nocheck -- bound to the game runtime; the rules live in core/quest and core/story
// Quests, the story and bounty boards at runtime: listens to what happens in the world, keeps the quest state,
// pays rewards, runs the elder's dialogue and publishes everything the journal, tracker and board show.
import * as PIXI from 'pixi.js';
import { ui as uiBridge } from '../ui/bridge';
import {
    abandonQuest, addRep, applyEvent, canStart, defOf, describeObjective, goalOf, hasFlag, isActive, isDone, isReady, newQuestState, progressText,
    repOf, repTier, setFlag, startQuest, townOfQuest, turnIn, withRep
} from '../core/quest/quests';
import { BOUNTY_SLOTS, BOUNTY_EPOCH_SECONDS, boardBounties, epochOf } from '../core/quest/bounties';
import { innRumour, jobSlot, jobThanks, relicIcon, rumourFee, townJob } from '../core/quest/townsfolk';
import { iconSprite } from '../render/icons';
import { findPlace } from '../core/quest/places';
import { bearing } from '../core/quest/text';
import { CHAPTERS, DEMON_LORDS, DIALOGUES, SOVEREIGN, chapterOfQuest, currentMainQuest, elderScript, lookupMain } from '../core/story/story';
import { DialogueRunner } from '../core/story/dialogue';
import { WORLD_CONFIG } from '../core/config';

const T = WORLD_CONFIG.tile;
const TILT = WORLD_CONFIG.tilt;

const rewardText = (r) => [r.gold ? `${r.gold} gold` : '', r.xp ? `${r.xp} xp` : '', r.loot ? `${r.loot >= 2 ? 'rare ' : ''}skills` : '',
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
            this.state.rep = { ...(saved.rep || {}) };
            this.state.rumours = JSON.parse(JSON.stringify(saved.rumours || {}));
        }
        this.mark = null;
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
    start(def, resolver = null) {
        if (!startQuest(this.state, def, this.game.state.time, this.ctx(), resolver || ((t) => this.resolve(t)))) return false;
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
        ev.on('PlaceCleared', (e) => this.fire({ type: 'clear', poi: { id: e.id, type: e.type, group: e.group } }));
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
                if (def.objectives.some((o) => o.type === 'escort')) continue;      // paid on arrival
                g.ui.toast(`${def.title}: all done. ${this.backText(def)}`);
                g.audio.play('levelup');
            } else if (u.objectiveDone) {
                g.ui.toast(describeObjective(def.objectives[u.index], this.names(), this.state.active[u.quest].targets[u.index]), 'check');
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
                // a dungeon is cleared when its lord falls; a cave or ruins when its monsters do
                const done = (vid) => (o.type === 'clear' ? g.visited[vid] && (g.visited[vid].bossDead || (g.visited[vid].cleared && !vid.startsWith('plat:') && !vid.startsWith('sea:') && !this.poiById(vid)?.dungeon)) : !!g.visited[vid]);
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
        if (this.mark && this.mark.sprite && !this.mark.sprite.destroyed) this.mark.sprite.y = -64 + Math.sin(g.frame * 0.08) * 3;
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
        g.input.haptic('quest');
    }

    turnInQuest(id) {
        const g = this.game;
        const def = defOf(this.state, this.lookup, id);
        const town = def ? townOfQuest(id, def) : null;
        const before = town ? repTier(repOf(this.state, town)) : null;
        const res = turnIn(this.state, this.lookup, id, g.state.wallet);
        if (!res.ok) { g.ui.toast(res.reason || 'Not ready yet'); g.audio.play('deny'); return false; }
        for (const [k, n] of Object.entries(res.consume)) g.state.wallet[k] -= n;
        this.pay(before ? withRep(res.rewards, before) : res.rewards, def.title);
        // the town that asked thinks better of the party
        if (town) {
            const after = repTier(addRep(this.state, town));
            if (after.index > before.index) {
                const name = this.townName(town);
                g.ui.toast(`${name} now knows you as ${this.tierTitle(after, name)}${after.bonus ? ` · bounties pay ${Math.round(after.bonus * 100)}% more` : ''}`, 'fleur');
                g.audio.stinger('stingDiscover');
            }
        }
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
        const def = defOf(this.state, this.lookup, id);
        if (abandonQuest(this.state, id)) { this.game.ui.toast(def && def.kind === 'job' ? 'Job dropped' : 'Bounty dropped'); this.publish(); return true; }
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
        if (Object.values(this.state.active).filter((q) => q.def && q.def.kind === 'bounty').length >= 6) { this.game.ui.toast('Your bounty list is full (6)'); return false; }
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

    // ------------------------------------------------------------- towns
    townName(id) { const p = this.poiById(id); return p ? p.name : 'the town'; }
    tierTitle(t, name) { return t.name === 'Hero' ? `Hero of ${name}` : t.name; }

    /** Where a finished quest is handed in. */
    backText(def) {
        if (def.giver === 'elder') return 'Return to the Elder';
        if (def.giver === 'board') return 'Claim it at a bounty board';
        if (def.giver === 'inn') return 'Claim it at any inn';
        return `Return to ${this.townName(def.town)}`;
    }

    /** The town the party stands in, with its standing: { id, name, n, tier }. */
    standingHere() {
        const poi = this.game.mode === 'interior' ? this.game.interiorPoi : null;
        if (!poi || poi.type !== 'city') return null;
        const n = repOf(this.state, poi.id);
        return { id: poi.id, name: poi.name, n, tier: repTier(n) };
    }

    /** What the merchant takes off for a party the town trusts (0 to 0.1). */
    discountHere() { const s = this.standingHere(); return s ? s.tier.discount : 0; }
    freeInnHere() { const s = this.standingHere(); return !!(s && s.tier.freeInn); }

    standingView(id, n) {
        const t = repTier(n), name = this.townName(id);
        return { town: name, tier: this.tierTitle(t, name), n, next: t.next ? { name: this.tierTitle(t.next, name), at: t.next.min } : null, bonus: t.bonus, discount: t.discount, freeInn: t.freeInn };
    }

    /** `{place}` in a generated quest's text, named (the place it resolved to, or the nearest that fits). */
    fillText(def, text = def.summary) {
        if (!text.includes('{place}')) return text;
        const q = this.state.active[def.id];
        const i = def.objectives.findIndex((o) => 'target' in o);
        if (i < 0) return text.replaceAll('{place}', 'a place nearby');
        let id = q ? q.targets[i] : null;
        if (!q) { const key = `${def.id}:${i}`; if (!this.offerCache.has(key)) this.offerCache.set(key, this.resolve(def.objectives[i].target)); id = this.offerCache.get(key); }
        return text.replaceAll('{place}', this.names().place(def.objectives[i].target, id));
    }

    // --------------------------------------------------------- townsfolk
    /** The job a town's people have for the party: the one taken (from any rotation), else this rotation's. */
    jobHere(poi) {
        const g = this.game;
        for (const q of Object.values(this.state.active)) if (q.def && q.def.giver === 'townsfolk' && q.def.town === poi.id) return { def: q.def, taken: true };
        const villagers = g.interior && g.interior.npcs ? g.interior.npcs.length : 0;
        const epoch = epochOf(g.state.time), info = this.boardInfo(poi);
        const def = townJob(g.overworld.seed, info, epoch);
        if (isDone(this.state, def.id)) return null;
        const slot = jobSlot(g.overworld.seed, info, epoch, villagers);
        return slot < 0 ? null : { def: { ...def, npc: slot }, taken: false };
    }

    /** A marker over the townsperson with a job: gold to offer, grey while under way, green when it can be handed in. */
    refreshMark() {
        const g = this.game, poi = g.interiorPoi;
        const job = g.mode === 'interior' && poi && poi.type === 'city' ? this.jobHere(poi) : null;
        const c = job ? g.critters.list.find((v) => v.kind === 'villager' && v.slot === job.def.npc) : null;
        const state = !c ? null : !job.taken ? 'offer' : isReady(this.state, job.def) ? 'ready' : 'taken';
        const key = state && `${job.def.id}:${state}`;
        if (this.mark && this.mark.key === key && this.mark.c === c && !this.mark.sprite.destroyed) return;
        if (this.mark) {
            if (!this.mark.sprite.destroyed) this.mark.sprite.destroy();
            g.map.markers = g.map.markers.filter((m) => m !== this.mark.marker);
            g.map.dirty = true;
        }
        this.mark = null;
        if (!state) return;
        const sprite = iconSprite('quest-marker', 22, state === 'offer' ? 0xffd84a : state === 'ready' ? 0x8ae6a0 : 0x9aa4b0);
        sprite.y = -64;
        c.addChild(sprite);
        const marker = { tx: c.home.x / T, ty: c.home.y / T, icon: 'quest-marker' };
        g.map.markers.push(marker);
        g.map.dirty = true;
        this.mark = { key, c, sprite, marker };
    }

    /** Talking to the townsperson with a job: the offer, a reminder, or the thanks. False for everyone else. */
    talkToVillager(c) {
        const g = this.game, poi = g.interiorPoi;
        if (!poi || poi.type !== 'city') return false;
        const job = this.jobHere(poi);
        if (!job || c.slot !== job.def.npc) return false;
        const def = job.def, who = { speaker: 'Townsperson', icon: 'person' };
        if (!job.taken) {
            this.offer = def;
            uiBridge.dialog.value = { ...who, text: this.fillText(def), choices: [{ index: 0, text: `Accept · ${rewardText(def.rewards)}` }, { index: 1, text: 'Not now' }], job: true };
        } else if (isReady(this.state, def)) {
            uiBridge.dialog.value = { ...who, text: jobThanks(def) };
            this.turnInQuest(def.id);
        } else uiBridge.dialog.value = { ...who, text: `Any luck? ${this.hintFor(def)}` };
        g.audio.play('blip');
        return true;
    }

    /** The answer to a townsperson's offer: 0 takes the job. */
    answer(index) {
        const def = this.offer;
        this.offer = null;
        uiBridge.dialog.value = null;
        if (index === 0 && def) this.start(def);
        this.refreshMark();
    }

    /** Inside the place a fetch job names, the thing lies in the room farthest from the gate (once). */
    placeRelics(src, poi) {
        const g = this.game;
        if (src.floor > 0) return;
        for (const [id, q] of Object.entries(this.state.active)) {
            const def = q.def;
            if (!def) continue;
            def.objectives.forEach((o, i) => {
                if (o.type !== 'fetch' || q.progress[i] >= 1 || q.targets[i] !== poi.id) return;
                const spots = src.chests.length ? src.chests : [src.exit];
                let best = spots[0], far = -1;
                for (const c of spots) { const d = Math.hypot(c.x - src.start.x, c.y - src.start.y); if (d > far) { far = d; best = c; } }
                const at = g.world.findFree(best.x + T, best.y, 14);
                const sprite = new PIXI.Container();
                const glow = new PIXI.Graphics();
                glow.beginFill(0xffd84a, 0.22); glow.drawEllipse(0, 0, 26, 12); glow.endFill();
                glow.beginFill(0xffe9a8, 0.35); glow.drawEllipse(0, 0, 14, 6); glow.endFill();
                const ic = iconSprite(relicIcon(o.item), 26);
                ic.y = -22;
                sprite.addChild(glow, ic);
                sprite.position.set(at.x, at.y * TILT);
                sprite.zIndex = at.y;
                sprite.animate = (f) => { ic.y = -22 + Math.sin(f * 0.07) * 4; glow.alpha = 0.75 + Math.sin(f * 0.11) * 0.25; };
                g.objectLayer.addChild(sprite);
                const marker = { tx: at.x / T, ty: at.y / T, icon: 'quest-marker' };
                g.map.markers.push(marker);
                g.interactables.push({ kind: 'relic', x: at.x, y: at.y, sprite, item: o.item, quest: id, marker });
            });
        }
    }

    pickRelic(it) {
        const g = this.game;
        if (it.taken) return;
        it.taken = true;
        g.fx.burst(it.x, it.y, 24, 0xffd84a, 26, 3, { size: 0.8, life: 36, up: 3.6 });
        g.audio.play('pickup');
        g.interactables = g.interactables.filter((x) => x !== it);
        it.sprite.destroy();
        g.map.markers = g.map.markers.filter((m) => m !== it.marker);
        g.map.dirty = true;
        g.ui.toast(`Recovered ${it.item}`, 'check');
        this.fire({ type: 'fetch', item: it.item });
    }

    // ------------------------------------------------------------ the inn
    /** The place an innkeeper would talk about: the nearest unexplored one not yet cleared, unseen ones first. */
    rumourPlace(poi) {
        const g = this.game, near = { tx: poi.tx, ty: poi.ty };
        const seen = new Set(g.map.discoveredPois().map((p) => p.id));
        const found = [];
        for (const kind of ['dungeon', 'cave', 'ruins']) for (let nth = 0; nth < 3; nth++) {
            const p = findPlace(g.overworld, { kind, nth, near });
            if (p && !found.some((f) => f.id === p.id)) found.push(p);
        }
        const v = (p) => g.visited[p.id];
        const open = found.filter((p) => !(v(p) && (v(p).complete || v(p).bossDead || (!p.dungeon && v(p).cleared))));
        const d = (p) => Math.hypot(p.tx - near.tx, p.ty - near.ty);
        open.sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)) || d(a) - d(b));
        return open[0] ?? null;
    }

    /** This town's rumour in this rotation (null until asked). */
    rumourHere() {
        const poi = this.game.interiorPoi;
        const r = poi && this.state.rumours ? this.state.rumours[poi.id] : null;
        return r && r.epoch === epochOf(this.game.state.time) ? r : null;
    }

    askRumour() {
        const g = this.game, poi = g.interiorPoi;
        if (!poi || poi.type !== 'city' || this.rumourHere()) return false;
        const p = this.rumourPlace(poi);
        if (!p) { g.ui.toast('“Quiet times. Nothing worth the telling.”'); return false; }
        this.places.set(p.id, p);
        (this.state.rumours ||= {})[poi.id] = { epoch: epochOf(g.state.time), place: p.id };
        g.audio.play('blip');
        g.requestSave('quest');
        return true;
    }

    /** Pay the innkeeper to point it out: the fog round it lifts. */
    markRumour() {
        const g = this.game, r = this.rumourHere(), p = r && this.poiById(r.place);
        if (!p || r.marked) return false;
        const fee = rumourFee(this.boardInfo(g.interiorPoi).level), w = g.state.wallet;
        if (w.gold < fee) { g.ui.toast(`The innkeeper wants ${fee} gold for that`, 'res-gold'); g.audio.play('deny'); return false; }
        w.gold -= fee;
        uiBridge.wallet.value = { ...w };
        r.marked = true;
        g.fog.revealCircle(p.tx, p.ty, 10);
        g.map.pois.set(p.id, p);
        g.map.dirty = true;
        g.ui.toast(`${p.name} is marked on your map`, 'map');
        g.audio.play('equip');
        g.requestSave('quest');
        return true;
    }

    /** Take the rumour on as a job: clear the place, paid at any inn. */
    takeRumour() {
        const g = this.game, r = this.rumourHere(), p = r && this.poiById(r.place);
        if (!p) return false;
        const def = innRumour(this.boardInfo(g.interiorPoi), r.epoch, { id: p.id, name: p.name, kind: p.dungeon ? 'dungeon' : p.type });
        if (isActive(this.state, def.id) || isDone(this.state, def.id)) return false;
        return this.start(def, () => p.id);
    }

    /** What the Inn panel shows about rumours and the jobs it pays for. */
    innView() {
        const g = this.game, poi = g.interiorPoi;
        if (!poi || poi.type !== 'city') return null;
        const r = this.rumourHere(), p = r ? this.poiById(r.place) : null;
        const epoch = epochOf(g.state.time), info = this.boardInfo(poi);
        let rumour = null;
        if (p) {
            const def = innRumour(info, r.epoch, { id: p.id, name: p.name, kind: p.dungeon ? 'dungeon' : p.type });
            const pl = g.state.player;
            rumour = {
                place: p.name, kind: p.dungeon ? 'dungeon' : p.type, where: bearing({ tx: Math.floor(pl.wx / T), ty: Math.floor(pl.wy / T) }, p),
                marked: !!r.marked, fee: rumourFee(info.level), reward: rewardText(def.rewards),
                status: isDone(this.state, def.id) ? 'done' : isActive(this.state, def.id) ? 'taken' : 'open'
            };
        }
        const claims = Object.keys(this.state.active).filter((id) => { const d = this.state.active[id].def; return d && d.giver === 'inn'; }).map((id) => this.questView(id)).filter(Boolean);
        return { asked: !!r, rumour, claims, nextIn: Math.max(0, Math.round((epoch + 1) * BOUNTY_EPOCH_SECONDS - g.state.time)), free: this.freeInnHere(), standing: this.standingView(poi.id, repOf(this.state, poi.id)) };
    }

    // ------------------------------------------------------------------ views
    questView(id) {
        const def = defOf(this.state, this.lookup, id);
        const q = this.state.active[id];
        if (!def || !q) return null;
        return {
            id, title: def.title, summary: this.fillText(def), kind: def.kind, giver: def.giver, level: def.level ?? 0, back: this.backText(def),
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
            standing: Object.entries(this.state.rep || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id, n]) => this.standingView(id, n)),
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
                offers: rot.defs.map((d, slot) => ({ slot, title: d.title, summary: d.summary, level: d.level, reward: rewardText(withRep(d.rewards, repTier(repOf(this.state, poi.id)))), lines: d.objectives.map((o, i) => this.offerLine(d, o, i)), taken: rot.taken.includes(slot) })),
                mine: bounties.filter((q) => q.kind === 'bounty'),
                standing: this.standingView(poi.id, repOf(this.state, poi.id))
            };
        } else uiBridge.board.value = null;
        if (this.game.mode === 'interior') this.refreshMark();
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
                if (p) out.push({ tx: p.tx, ty: p.ty, icon: o.type === 'clear' ? 'swords' : 'quest-marker', label: def.title, color: '#7ad8ff' });
            });
        }
        return out;
    }
}
