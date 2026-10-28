// @ts-nocheck -- bridges the typed party rules (core/party) to the legacy game object.
import { EntityManager } from '../render/entities';
import {
  HERO_DEFS, SWITCH_COOLDOWN_FRAMES, applyHealer, benchTick, benchXp, defOf, healerQuote, levelHero, newHero, nextAlive,
  partyStats, partyWiped, reviveAfterWipe
} from '../core/party/party';
import { computeStats } from '../core/hero/stats';
import { makeSpell } from '../core/spells/spells';
import { ui as uiBridge } from '../ui/bridge';

/**
 * Three heroes share one inventory. The *active* hero's numbers live in game.state / game.spells ("working copy");
 * switching commits them back into heroes[] and loads the next hero.
 */
export class PartyRuntime {
    constructor(game) {
        this.game = game;
        this.heroes = [];
        this.active = 0;
        this.cdUntil = 0;
        this.sync = 0;
    }

    get hero() { return this.heroes[this.active]; }
    def(i = this.active) { return defOf(this.heroes[i].id); }

    // ---------------------------------------------------------------- setup
    init(save) {
        const g = this.game;
        this.cdUntil = 0;          // counted in frames, and the frame count starts again with every session
        if (save) {
            const inv = save.inventory;
            g.spells.setInventory(inv.spells, inv.runes);
            g.state.wallet = { gold: 0, wood: 0, stone: 0, iron: 0, ...inv.wallet };
            g.state.lootFilter = inv.lootFilter || 'off';
            this.heroes = save.party.heroes.map((h) => ({ ...h, picks: { ...h.picks }, auto: [...h.auto], active: [...h.active], presets: h.presets ? h.presets.map((p) => (p ? { auto: [...p.auto], active: [...p.active] } : null)) : [null, null, null], assist: h.assist ?? null }));
            // heroes the save does not know yet (future roster growth) start fresh
            this.active = Math.min(save.party.active, this.heroes.length - 1);
        } else {
            const items = [];
            const uidFor = (tpl) => { const it = makeSpell(tpl); items.push(it); return it.uid; };
            this.heroes = HERO_DEFS.map((d) => newHero(d, d.starter.auto.map(uidFor), [...d.starter.active.map(uidFor), null, null].slice(0, 3)));
            g.spells.setInventory(items, []);
            this.active = 0;
        }
        this.load(this.active, true);
    }

    // working copy <-> hero record
    commit() {
        const g = this.game, s = g.state, h = this.hero;
        if (!h) return;
        h.level = s.level; h.experience = s.experience; h.nextLevel = s.nextLevel; h.pending = s.pending;
        h.health = Math.max(0, s.health); h.picks = { ...s.picks };
        h.mana = g.spells.mana.value;
        h.auto = [...g.spells.auto]; h.active = [...g.spells.active];
    }

    load(i, initial = false) {
        const g = this.game, s = g.state;
        this.active = i;
        const h = this.heroes[i];
        s.level = h.level; s.experience = h.experience; s.nextLevel = h.nextLevel; s.pending = h.pending;
        s.picks = { ...h.picks };
        g.spells.setLoadout(h.auto, h.active);
        // the working copy takes this hero's health and mana before refreshStats commits it back into the record
        // (it used to commit the previous hero's), and with no "max went up" bonus from the previous hero's max
        const hp = h.health, mp = h.mana;
        s.health = hp; g.spells.mana.value = mp; s.maxHealth = 0;
        this.refreshStats();
        s.health = Math.min(Math.max(1, hp), s.maxHealth);
        g.spells.mana.value = Math.min(mp, g.stats.maxMana);
        const def = defOf(h.id);
        const p = s.player;
        if (p && p.heroId !== h.id) EntityManager.setHeroLook(p, h.id, def.color);
        EntityManager.heroLevel = s.level;
        if (!initial) {
            uiBridge.cards.value = [];
            g.ui.displayXp = s.experience;
            g.ui.shown.slots = '';
            g.ui.shown.level = -1;
            g.ensureCards();
        }
        this.publish();
    }

    /** Active hero's stats combined with the living bench auras. */
    refreshStats() {
        const g = this.game, s = g.state;
        this.commit();
        const prevMax = s.maxHealth;
        g.stats = partyStats(this.heroes, this.active);
        s.maxHealth = g.stats.maxHealth;
        if (prevMax && s.maxHealth > prevMax) s.health += s.maxHealth - prevMax;
        s.health = Math.min(s.health, s.maxHealth);
        g.spells.mana.value = Math.min(g.spells.mana.value, g.stats.maxMana);
    }

    // -------------------------------------------------------------- switching
    canSwitch(i) {
        if (i === this.active || i < 0 || i >= this.heroes.length) return { ok: false };
        if (this.heroes[i].dead) return { ok: false, reason: `${this.def(i).name} is down — a healer can revive them in town` };
        if (this.game.frame < this.cdUntil) return { ok: false, reason: `Switching recharges in ${Math.max(1, Math.ceil((this.cdUntil - this.game.frame) / 60))}s` };
        return { ok: true };
    }

    switchTo(i, force = false) {
        const g = this.game;
        if (g.state.gameOver || g.busy) return false;
        if (!force) {
            const c = this.canSwitch(i);
            if (!c.ok) { if (c.reason) g.ui.toast(c.reason); return false; }
        }
        this.commit();
        g.spells.dashing = null;
        this.load(i);
        this.cdUntil = g.frame + (force ? 30 : SWITCH_COOLDOWN_FRAMES);
        g.invulnUntil = Math.max(g.invulnUntil || 0, g.frame + 40);
        // tag-in shockwave: a little breathing room and a flourish in the new hero's colour
        const p = g.state.player, col = this.def().color;
        for (const e of g.state.enemies) {
            const dx = e.wx - p.wx, dy = e.wy - p.wy, d = Math.hypot(dx, dy) || 1;
            if (d < 150) { e.kvx += (dx / d) * 6; e.kvy += (dy / d) * 6; }
        }
        g.fx.burst(p.wx, p.wy, 22, col, 28, 4, { size: 0.9, life: 30, up: 3, glow: true });
        g.fx.pillar(p.wx, p.wy, col, 34, 54, 190);
        g.fx.shockwave(p.wx, p.wy, 150, col, 20, 5);
        g.fx.popup(p.wx, p.wy, this.def().name, col, 20, 90);
        g.audio.play('switch');
        g.input?.haptic('switch');
        return true;
    }

    cycle(dir = 1) {
        for (let k = 1; k <= this.heroes.length; k++) {
            const i = (this.active + dir * k + this.heroes.length * 3) % this.heroes.length;
            if (this.canSwitch(i).ok) return this.switchTo(i);
        }
        return false;
    }

    // ------------------------------------------------------------- death
    /** Called when the active hero's health reaches zero. Returns true if the whole party is down. */
    onDown() {
        const g = this.game, s = g.state;
        const p = s.player;
        const h = this.hero;
        h.dead = true; s.health = 0; h.health = 0;
        g.fx.death(p.wx, p.wy, this.def().color, false);
        this.commit();
        const next = nextAlive(this.heroes, this.active);
        if (next < 0 || partyWiped(this.heroes)) { g.showGameOver(); return true; }
        const fallen = this.def().name;
        this.switchTo(next, true);
        g.invulnUntil = g.frame + 120;
        g.ui.banner(`${fallen.toUpperCase()} HAS FALLEN — ${this.def().name.toUpperCase()} STEPS IN`, 0xff8a8a);
        g.requestSave('hero-down', true);
        return false;
    }

    wipeRevive() {
        this.commit();
        reviveAfterWipe(this.heroes);
        this.load(0);
        this.game.spells.mana.value = this.game.stats.maxMana;
    }

    // ------------------------------------------------------------ per frame
    update(delta) {
        const g = this.game;
        this.heroes.forEach((h, i) => {
            if (i === this.active) return;
            benchTick(h, delta);
            if (h.experience >= h.nextLevel) {
                const gained = levelHero(h);
                if (gained) { g.ui.toast(`${defOf(h.id).name} reached level ${h.level} — switch to spend upgrades`); g.audio.play('levelup'); }
            }
        });
        this.sync += delta;
        if (this.sync >= 6) { this.sync = 0; this.publish(); }
    }

    addBenchXp(v, srcLevel = null) {
        this.heroes.forEach((h, i) => { if (i !== this.active && !h.dead) h.experience += benchXp(h, v, srcLevel); });
    }

    /** inn: everyone is revived, healed and has full mana */
    restAll() {
        this.commit();
        for (const h of this.heroes) { const st = computeStats(h.picks); h.dead = false; h.health = st.maxHealth; h.mana = st.maxMana; }
        const g = this.game;
        g.state.health = this.hero.health;
        g.spells.mana.value = this.hero.mana;
        this.refreshStats();
        this.publish();
    }

    // ------------------------------------------------------------- healer
    quotes() { this.commit(); return this.heroes.map((h) => healerQuote(h)); }

    buy(i) {
        const g = this.game;
        this.commit();
        const h = this.heroes[i];
        const spent = applyHealer(h, g.state.wallet.gold);
        if (spent < 0) { g.ui.toast('Not enough gold'); return false; }
        if (spent === 0) return false;
        g.state.wallet.gold -= spent;
        uiBridge.wallet.value = { ...g.state.wallet };
        if (i === this.active) { g.state.health = h.health; g.spells.mana.value = h.mana; }
        g.audio.play('loot');
        g.fx.burst(g.state.player.wx, g.state.player.wy, 24, 0x9bffb0, 24, 3, { size: 0.8, life: 30, up: 3 });
        g.ui.toast(`${defOf(h.id).name} restored for ${spent} gold`);
        g.requestSave('healer', true);
        this.refreshStats();
        this.publish();
        return true;
    }

    buyAll() {
        let any = false;
        for (let i = 0; i < this.heroes.length; i++) {
            const q = healerQuote(this.heroes[i]);
            if (q.cost > 0 && this.game.state.wallet.gold >= q.cost) any = this.buy(i) || any;
        }
        return any;
    }

    // ---------------------------------------------------------------- save
    serialize() {
        this.commit();
        return {
            active: this.active,
            heroes: this.heroes.map((h) => ({
                id: h.id, level: h.level, experience: h.experience, nextLevel: h.nextLevel, health: Math.round(h.health * 10) / 10,
                mana: Math.round(h.mana), pending: h.pending, picks: { ...h.picks }, auto: [...h.auto], active: [...h.active], dead: !!h.dead,
                presets: (h.presets || [null, null, null]).map((p) => (p ? { auto: [...p.auto], active: [...p.active] } : null)), assist: h.assist ?? null
            }))
        };
    }

    publish() {
        const g = this.game;
        this.commit();
        const cd = Math.max(0, this.cdUntil - g.frame);
        uiBridge.party.value = {
            active: this.active,
            cd: Math.round((cd / SWITCH_COOLDOWN_FRAMES) * 20) / 20,
            heroes: this.heroes.map((h, i) => {
                const st = i === this.active ? g.stats : computeStats(h.picks);
                const d = defOf(h.id);
                return {
                    id: h.id, name: d.name, icon: d.icon, color: d.color, level: h.level, dead: !!h.dead, pending: h.pending,
                    hp: Math.round(h.health), maxHp: Math.round(i === this.active ? g.state.maxHealth : st.maxHealth),
                    mana: Math.round(i === this.active ? g.spells.mana.value : h.mana), maxMana: Math.round(st.maxMana)
                };
            })
        };
    }
}
