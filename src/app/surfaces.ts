import { WORLD_CONFIG } from '../core/config';
import { NO_EFFECT, enemyEffect, isImmune, playerEffect, type SurfaceDef } from '../core/world/surfaces';

type Game = any;                     // the game object is untyped until the sim is split out
import { ui as uiBridge } from '../ui/bridge';

const T = WORLD_CONFIG.tile;

/** Applies what the ground does to the party and to monsters standing on it. */
export class SurfaceSystem {
    game: Game;
    fx: ReturnType<typeof playerEffect>;
    current: SurfaceDef | null;
    shown: string;

    constructor(game: Game) {
        this.game = game;
        this.fx = NO_EFFECT;       // current effect on the active hero (read by movement, mana and cooldowns)
        this.current = null;
        this.shown = '';
    }

    reset() { this.fx = NO_EFFECT; this.current = null; this.shown = ''; uiBridge.surface.value = null; }

    update(delta: number) {
        const g = this.game;
        const p = g.state.player;
        if (!p || g.mode !== 'overworld') { if (this.current) this.reset(); return; }
        const level = g.zoneLevelNow || 1;
        const def = g.world.surfaceAtPos(p.wx, p.wy);
        this.current = def;
        this.fx = playerEffect(def ? def.id : null, level);
        const fx = this.fx;
        const s = g.state;
        if (fx.dps > 0) g.damagePlayerDot(fx.dps * delta / 60);
        if (fx.heal > 0 && s.health < s.maxHealth) s.health = Math.min(s.maxHealth, s.health + fx.heal * delta / 60);
        const key = def ? def.id : '';
        if (key !== this.shown) {
            this.shown = key;
            uiBridge.surface.value = def ? { name: def.name, desc: def.desc, color: def.color, bad: def.playerDps > 0 || def.playerSpeed < 0.9 } : null;
            if (def && def.id !== 'road') g.audio.play(def.playerDps > 0 ? 'deny' : 'surface');
        }
        if (def && fx.dps > 0 && (g.frame | 0) % 14 === 0) g.fx.burst(p.wx, p.wy, 6, def.glow || def.color, 3, 1.4, { size: 0.7, life: 20, up: 1.5, glow: true });
        if (def && fx.heal > 0 && (g.frame | 0) % 10 === 0) g.fx.burst(p.wx, p.wy, 4, def.glow, 2, 0.8, { size: 0.6, life: 26, up: 1.8, gravity: -0.02, glow: true });

        // monsters: staggered checks so a big crowd stays cheap
        const f = g.frame | 0;
        for (const e of s.enemies) {
            if (e.dead || e.flying || e.phasing) { e.surfSpeed = 1; continue; }
            if ((f + e.uid) % 8 !== 0) continue;
            const sd = g.world.surfaceAtPos(e.wx, e.wy);
            if (!sd) { e.surfSpeed = 1; continue; }
            const ef = enemyEffect(sd.id, e.type, e.flying, e.level || level);
            e.surfSpeed = ef.speed;
            if (ef.dps > 0) g.damageEnemy(e, ef.dps * 8 / 60, { noCrit: true, quiet: true, color: sd.glow || sd.color });
        }
    }

    /** would a ground enemy be hurt by standing at (x, y)? Used so monsters path around lava and swamp. */
    hazardousFor(e: { flying?: boolean; phasing?: boolean; type: string }, x: number, y: number): boolean {
        if (e.flying || e.phasing) return false;
        const sd = this.game.world.surfaceAtPos(x, y);
        return !!(sd && sd.hazard && !isImmune(e.type, !!e.flying, sd.id));
    }
}
