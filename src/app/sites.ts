// @ts-nocheck -- Pixi-bound runtime over the typed site rules (core/world/sites)
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { engage } from '../core/ai/ai';
import {
    CLAIMED_REGEN, CLAIMED_SAFE_RADIUS, CLAIM_RADIUS, CLAIM_SECONDS, Sites, insideSite, newClaim, stepClaim
} from '../core/world/sites';
import { pickRosterEntry } from '../core/world/population';
import { EntityManager } from '../render/entities';
import { ui as uiBridge } from '../ui/bridge';

const T = WORLD_CONFIG.tile;
const TILT = WORLD_CONFIG.tilt;
const CHUNK = T * WORLD_CONFIG.chunkTiles;
const SHOW_DIST = CHUNK * 3;
const HIDE_DIST = CHUNK * 4.2;

/** Claimable hold-out zones (banner on a stone ring) and on-step ambush plates. */
export class SitesRuntime {
    constructor(game) {
        this.game = game;
        this.sites = null;
        this.shown = new Map();     // site id -> display
        this.states = new Map();    // claim id -> ClaimState (in-session hold-out progress)
        this.waves = [];            // { site, members, kind }
        this.timer = 0;
        this.inside = null;
    }

    reset(source) {
        this.clearDisplays();
        this.sites = new Sites(source);
        this.states.clear();
        this.waves = [];
        this.timer = 0;
        this.inside = null;
        uiBridge.hold.value = null;
    }

    clearDisplays() {
        for (const d of this.shown.values()) { d.obj.destroy({ children: true }); d.ground.destroy(); }
        this.shown.clear();
    }

    claimed(id) { return this.game.session.claimed[id] !== undefined; }
    triggered(id) { return this.game.session.triggered[id] !== undefined; }

    /** is (x, y) inside the calm around a claimed flag? Hostile spawns avoid it. */
    safeAt(x, y) {
        if (!this.sites || this.game.mode !== 'overworld') return false;
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        for (const s of this.sites.near(tx, ty, CLAIMED_SAFE_RADIUS / T + 2)) {
            if (s.kind === 'claim' && this.claimed(s.id) && (s.x - x) ** 2 + (s.y - y) ** 2 < CLAIMED_SAFE_RADIUS * CLAIMED_SAFE_RADIUS) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ display
    build(site) {
        const g = this.game;
        const obj = new PIXI.Container();
        const ground = new PIXI.Graphics();
        g.groundLayer.addChild(ground);
        let flag = null;
        if (site.kind === 'claim') {
            const pole = new PIXI.Graphics();
            pole.lineStyle(1.4, 0x2a1a10, 0.9);
            pole.beginFill(0x7a5a3a); pole.drawRoundedRect(-2.2, -84, 4.4, 84, 2); pole.endFill();
            pole.beginFill(0xe8b040); pole.drawCircle(0, -86, 4); pole.endFill();
            pole.beginFill(0x8a8478); pole.drawEllipse(0, 1, 12, 5); pole.endFill();
            flag = new PIXI.Graphics();
            flag.position.set(2, -80);
            const shadow = new PIXI.Graphics();
            shadow.beginFill(0x000000, 0.3); shadow.drawEllipse(0, 0, 16, 6); shadow.endFill();
            obj.addChild(shadow, pole, flag);
        }
        obj.position.set(site.x, site.y * TILT);
        obj.zIndex = site.y;
        g.objectLayer.addChild(obj);
        const d = { site, obj, ground, flag, last: '' };
        this.shown.set(site.id, d);
        return d;
    }

    draw(d, t) {
        const site = d.site, g = this.game;
        const st = this.states.get(site.id);
        const claimed = this.claimed(site.id), sprung = this.triggered(site.id);
        const prog = st ? st.progress : 0;
        const key = `${claimed}|${sprung}|${Math.round(prog * 100)}|${(t / 6) | 0}`;
        if (key === d.last) return;
        d.last = key;
        const gr = d.ground;
        gr.clear();
        if (site.kind === 'claim') {
            const R = CLAIM_RADIUS;
            const col = claimed ? 0xf3c75a : 0xb8b4a8;
            // ring of standing stones
            gr.lineStyle(3, col, claimed ? 0.8 : 0.45);
            gr.drawCircle(site.x, site.y, R);
            gr.lineStyle(1.5, col, claimed ? 0.5 : 0.25);
            gr.drawCircle(site.x, site.y, R - 7);
            gr.lineStyle(0);
            for (let k = 0; k < 14; k++) {
                const a = (k / 14) * Math.PI * 2;
                const x = site.x + Math.cos(a) * R, y = site.y + Math.sin(a) * R;
                gr.beginFill(claimed ? 0xd8b868 : 0x8a8478); gr.drawEllipse(x, y, 7, 5); gr.endFill();
                gr.beginFill(0xffffff, 0.25); gr.drawEllipse(x - 1.5, y - 1.5, 3.5, 2); gr.endFill();
            }
            if (claimed) {
                gr.beginFill(0xf3c75a, 0.07 + 0.03 * Math.sin(t * 0.05)); gr.drawCircle(site.x, site.y, R); gr.endFill();
            } else if (prog > 0) {
                gr.lineStyle(7, 0xffe27a, 0.9);
                gr.arc(site.x, site.y, R - 14, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
                gr.lineStyle(0);
                gr.beginFill(0xffe27a, 0.07 + 0.08 * prog); gr.drawCircle(site.x, site.y, R); gr.endFill();
            }
            if (d.flag) {
                d.flag.clear();
                const c = claimed ? 0xf3c75a : prog > 0 ? 0xd8a840 : 0x9a9a9a;
                const wave = Math.sin(t * 0.12);
                d.flag.lineStyle(1.2, 0x2a1a10, 0.85);
                d.flag.beginFill(c);
                d.flag.drawPolygon([0, 0, 22, 2 + wave * 2, 30 + wave * 2, 9, 22, 16 - wave * 2, 0, 18]);
                d.flag.endFill();
                d.flag.lineStyle(0);
                d.flag.beginFill(0xffffff, 0.35); d.flag.drawPolygon([0, 0, 22, 2 + wave * 2, 18, 6, 0, 6]); d.flag.endFill();
                if (claimed) { d.flag.beginFill(0x8a5a10); d.flag.drawPolygon([9, 6, 15, 9, 9, 13, 5, 9]); d.flag.endFill(); }
            }
        } else {
            // ambush plate: a sigil that pulses red until sprung
            const R = 34;
            const a = sprung ? 0.18 : 0.55 + 0.3 * Math.sin(t * 0.1);
            const col = sprung ? 0x6a5a5a : 0xff4a3a;
            gr.beginFill(0x1a1010, sprung ? 0.35 : 0.6); gr.drawCircle(site.x, site.y, R); gr.endFill();
            gr.lineStyle(2.5, col, a); gr.drawCircle(site.x, site.y, R);
            gr.lineStyle(1.5, col, a * 0.8); gr.drawCircle(site.x, site.y, R - 8);
            gr.lineStyle(2, col, a);
            for (let k = 0; k < 3; k++) {
                const ang = -Math.PI / 2 + (k / 3) * Math.PI * 2, ang2 = ang + (2 / 3) * Math.PI * 2;
                gr.moveTo(site.x + Math.cos(ang) * (R - 6), site.y + Math.sin(ang) * (R - 6));
                gr.lineTo(site.x + Math.cos(ang2) * (R - 6), site.y + Math.sin(ang2) * (R - 6));
            }
            gr.lineStyle(0);
            if (sprung) { gr.lineStyle(1.5, 0x000000, 0.5); gr.moveTo(site.x - 18, site.y - 6); gr.lineTo(site.x + 4, site.y + 4); gr.lineTo(site.x + 20, site.y - 8); gr.lineStyle(0); }
        }
    }

    // ------------------------------------------------------------------- update
    update(delta) {
        const g = this.game;
        if (!this.sites || g.mode !== 'overworld' || !g.state.player) return;
        const p = g.state.player;
        const ptx = Math.floor(p.wx / T), pty = Math.floor(p.wy / T);

        this.timer -= delta;
        if (this.timer <= 0) {
            this.timer = 24;
            for (const s of this.sites.near(ptx, pty, SHOW_DIST / T)) {
                if (this.shown.has(s.id)) continue;
                if (Math.hypot(s.x - p.wx, s.y - p.wy) < SHOW_DIST) this.build(s);
            }
            for (const [id, d] of this.shown) {
                if (Math.hypot(d.site.x - p.wx, d.site.y - p.wy) > HIDE_DIST) { d.obj.destroy({ children: true }); d.ground.destroy(); this.shown.delete(id); }
            }
            this.checkWaves();
        }

        const t = g.frame;
        let nowInside = null;
        for (const d of this.shown.values()) {
            const s = d.site;
            this.draw(d, t);
            if (s.kind === 'claim') {
                if (this.claimed(s.id)) {
                    if (insideSite(s, p.wx, p.wy) && g.state.health < g.state.maxHealth) {
                        g.state.health = Math.min(g.state.maxHealth, g.state.health + CLAIMED_REGEN * delta / 60);
                        if ((t | 0) % 18 === 0) g.fx.burst(p.wx, p.wy, 4, 0xf3c75a, 2, 0.8, { size: 0.6, life: 26, up: 1.6, gravity: -0.02, glow: true });
                    }
                    continue;
                }
                const inside = insideSite(s, p.wx, p.wy);
                let st = this.states.get(s.id);
                if (!st) { if (!inside) continue; st = newClaim(); this.states.set(s.id, st); }
                const r = stepClaim(st, inside, delta / 60, s.waves);
                if (inside) nowInside = s;
                if (r.spawnWave) this.spawnWave(s, st.wavesSent);
                if (r.completed) this.complete(s);
            } else if (!this.triggered(s.id) && (s.x - p.wx) ** 2 + (s.y - p.wy) ** 2 < s.radius * s.radius) {
                this.spring(s);
            }
        }
        // HUD: progress bar while holding a zone
        if (nowInside) {
            const st = this.states.get(nowInside.id);
            uiBridge.hold.value = { progress: st.progress, label: 'Hold the zone', wave: st.wavesSent, waves: nowInside.waves, seconds: Math.ceil(CLAIM_SECONDS * (1 - st.progress)) };
        } else if (uiBridge.hold.value) uiBridge.hold.value = null;
        this.inside = nowInside;
    }

    enemyMix(site, n, elites) {
        const g = this.game;
        const out = [];
        for (let i = 0; i < n; i++) {
            const entry = pickRosterEntry(site.group, site.level, Math.random());
            out.push({ type: entry.type, elite: i < elites });
        }
        return out;
    }

    ring(site, mix, radius) {
        const g = this.game;
        const members = [];
        mix.forEach((m, i) => {
            const a = (i / mix.length) * Math.PI * 2 + Math.random() * 0.5;
            const type = g.enemyTypes[m.type];
            let x = site.x + Math.cos(a) * radius, y = site.y + Math.sin(a) * radius;
            if (!type.flying && g.world.blocked(x, y, type.radius)) { const f = g.world.findFree(x, y, type.radius); x = f.x; y = f.y; }
            const e = g.makeEnemy(m.type, x, y, { level: site.level, elite: m.elite });
            e.siteId = site.id;
            engage(g, e, false);
            g.fx.burst(x, y, 10, 0xff5a3a, 14, 2.4, { size: 0.8, life: 22, glow: true });
            members.push(e);
        });
        return members;
    }

    spawnWave(site, n) {
        const g = this.game;
        const count = 3 + Math.floor(site.level / 7) + n * 2;
        const members = this.ring(site, this.enemyMix(site, count, n === site.waves ? 1 : 0), CLAIM_RADIUS + 70);
        this.waves.push({ site, members, kind: 'wave' });
        g.ui.banner(`WAVE ${n} / ${site.waves}`, 0xffb04a);
        g.audio.play('deny');
        g.fx.addShake(3);
    }

    spring(site) {
        const g = this.game;
        g.session.triggered[site.id] = g.state.time;
        const members = this.ring(site, this.enemyMix(site, site.waves, Math.max(1, Math.floor(site.waves / 3))), 150);
        this.waves.push({ site, members, kind: 'ambush' });
        g.ui.banner('⚠  AMBUSH!  ⚠', 0xff4a3a);
        g.fx.shockwave(site.x, site.y, 200, 0xff4a3a, 30, 6);
        g.fx.flash(site.x, site.y, 260, 0xff4a3a, 30);
        g.fx.addShake(7);
        g.audio.play('deny');
        g.requestSave('ambush');
    }

    // reward for beating an ambush
    checkWaves() {
        const g = this.game;
        this.waves = this.waves.filter((w) => {
            if (w.members.some((m) => !m.dead)) return true;
            if (w.kind === 'ambush') {
                g.ui.banner('AMBUSH BEATEN', 0x9bffb0);
                g.grantLoot(1);
                for (let i = 0; i < 4; i++) g.dropGem(w.site.x + (Math.random() - 0.5) * 80, w.site.y + (Math.random() - 0.5) * 60, Math.round(10 + w.site.level * 3), 'coin');
            }
            return false;
        });
    }

    complete(site) {
        const g = this.game;
        g.session.claimed[site.id] = g.state.time;
        g.events.emit('ZoneClaimed', { id: site.id, level: site.level });
        for (const w of this.waves) if (w.site === site) w.members.forEach((m) => { if (!m.dead) g.damageEnemy(m, 1e9, { noCrit: true, quiet: true }); });
        this.waves = this.waves.filter((w) => w.site !== site);
        g.ui.banner('ZONE CLAIMED', 0xf3c75a);
        g.fx.pillar(site.x, site.y, 0xf3c75a, 80, 90, 320);
        g.fx.shockwave(site.x, site.y, CLAIM_RADIUS * 1.5, 0xf3c75a, 36, 8);
        g.fx.addShake(5);
        g.audio.play('fanfare');
        g.fog.revealCircle(site.tx, site.ty, 26);
        g.syncMap();
        g.grantLoot(1);
        for (let i = 0; i < 8; i++) g.dropGem(site.x + (Math.random() - 0.5) * 120, site.y + (Math.random() - 0.5) * 90, Math.round(14 + site.level * 4), 'coin');
        g.map.dirty = true;
        g.requestSave('claimed', true);
        uiBridge.hold.value = null;
    }
}
