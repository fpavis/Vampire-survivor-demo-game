// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import { WORLD_CONFIG, ENEMY_TYPES, perceptionOf } from '../config';
import { BIOME } from '../world/biomes';
import { lineOfSight } from '../world/nav';
import { EntityManager } from '../../render/entities';

const T = WORLD_CONFIG.tile;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndIn = (range) => rnd(range[0], range[1]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

function lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + d * t;
}

// ---------------------------------------------------------------------------
// Spatial hash: neighbour queries for swarming and separation without O(n^2)
// ---------------------------------------------------------------------------
export class SpatialHash {
    constructor(cell = 110) {
        this.cell = cell;
        this.map = new Map();
    }

    clear() { this.map.clear(); }

    key(ix, iy) { return ix * 73856093 ^ iy * 19349663; }

    insert(e) {
        const k = this.key(Math.floor(e.wx / this.cell), Math.floor(e.wy / this.cell));
        let bucket = this.map.get(k);
        if (!bucket) { bucket = []; this.map.set(k, bucket); }
        bucket.push(e);
    }

    // fills `out` with enemies within r (excluding none; caller filters itself)
    near(x, y, r, out) {
        out.length = 0;
        const c = this.cell;
        const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
        const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
        for (let iy = y0; iy <= y1; iy++) {
            for (let ix = x0; ix <= x1; ix++) {
                const b = this.map.get(this.key(ix, iy));
                if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
            }
        }
        return out;
    }
}

const tmpDir = { x: 0, y: 0 };
const flowTmp = { x: 0, y: 0 };
const nearBuf = [];

// ---------------------------------------------------------------------------
// Navigation helpers: line-of-sight raycast, flow field and whisker avoidance
// ---------------------------------------------------------------------------
function refreshLOS(game, e, tx, ty, d) {
    if (game.frame >= e.losAt) {
        e.los = d < 80 || lineOfSight(game.world, e.wx, e.wy, tx, ty);
        e.losAt = game.frame + 6 + (e.uid % 5);
    }
}

// Is the point ahead of the enemy free? Two short probes (a "whisker")
function probe(game, e, dx, dy, look) {
    const r = e.radius * 0.8;
    return !game.world.blocked(e.wx + dx * look * 0.5, e.wy + dy * look * 0.5, r) &&
        !game.world.blocked(e.wx + dx * look, e.wy + dy * look, r);
}

function avoid(game, e, out) {
    const look = e.radius + 36;
    if (probe(game, e, out.x, out.y, look)) return;
    const a0 = Math.atan2(out.y, out.x);
    const s = e.avoidSign;
    const offsets = [0.6, -0.6, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4];
    for (const o of offsets) {
        const a = a0 + o * s;
        const cx = Math.cos(a), cy = Math.sin(a);
        if (probe(game, e, cx, cy, look)) {
            out.x = cx; out.y = cy;
            e.avoidSign = (o * s) > 0 ? s : -s;
            return;
        }
    }
}

// Direction an enemy should walk to reach (tx, ty) -- writes into `out`
function pathDir(game, e, tx, ty, out) {
    const dx = tx - e.wx, dy = ty - e.wy;
    const d = Math.hypot(dx, dy) || 1;
    out.x = dx / d;
    out.y = dy / d;
    if (e.flying || e.phasing) return out;

    refreshLOS(game, e, tx, ty, d);
    if (!e.los && d < 1500 && game.flow.direction(e.wx, e.wy, flowTmp)) {
        out.x = flowTmp.x;
        out.y = flowTmp.y;
    }
    // unstick nudge
    if (e.nudge > 0) {
        const a = Math.atan2(out.y, out.x) + e.nudgeA;
        out.x = Math.cos(a);
        out.y = Math.sin(a);
    }
    avoid(game, e, out);
    return out;
}

function moveMul(game, e) {
    let m = 1;
    if (game.frame < e.slowUntil) m *= 1 - e.slowAmount;
    if (!e.flying && game.world.biomeAtPos(e.wx, e.wy) === BIOME.SHALLOW) m *= 0.8;
    return m;
}

// Move along a unit direction at `speed` (units/frame) and integrate knockback
function steer(game, e, dx, dy, speed, delta, tracked = true) {
    const m = moveMul(game, e);
    const vx = dx * speed * m * delta + e.kvx * delta;
    const vy = dy * speed * m * delta + e.kvy * delta;
    const decay = Math.pow(0.86, delta);
    e.kvx *= decay;
    e.kvy *= decay;
    if (e.flying || e.phasing) { e.wx += vx; e.wy += vy; } else game.world.tryMove(e, vx, vy, e.radius * 0.8);
    if (tracked && speed > 0) e.wantsMove = true;
}

// idle: only knockback is applied
function hold(game, e, delta) {
    steer(game, e, 0, 0, 0, delta, false);
}

function face(e, dx) {
    if (Math.abs(dx) > 3) e.facing = dx > 0 ? 1 : -1;
}

function catchup(e) {
    return 1 + clamp((e.pd - 520) / 500, 0, 1.6);
}

function checkStuck(game, e) {
    if (game.frame < e.stuckAt) return;
    e.stuckAt = game.frame + 24;
    if (e.nudge > 0) { e.nudge = 0; }
    else if (e.wantsMove && !e.flying && Math.hypot(e.wx - e.sx, e.wy - e.sy) < 5 && e.pd > e.radius + 30) {
        e.nudge = 26;
        e.nudgeA = (Math.random() < 0.5 ? 1 : -1) * rnd(1.0, 2.0);
    }
    e.sx = e.wx;
    e.sy = e.wy;
    e.wantsMove = false;
}

function enemyScale(e) {
    return e.damage / ENEMY_TYPES[e.type].damage;
}

function dust(game, e, n = 2) {
    game.fx.burst(e.wx, e.wy, 2, 0xd8c8a0, n, 1.2, { size: 0.7, life: 18, up: 0.8, gravity: 0.08 });
}

// ---------------------------------------------------------------------------
// Behaviours
// ---------------------------------------------------------------------------
function initAI(e) {
    const cfg = ENEMY_TYPES[e.type].ai;
    const a = {
        kind: cfg.kind, cfg, state: 'move', t: 0,
        cd: rndIn(cfg.cooldown || cfg.shotCooldown || cfg.burstCooldown || [40, 100]),
        dir: Math.random() < 0.5 ? 1 : -1, angle: 0, hop: Math.random() * 6, ang: Math.random() * TAU, idx: 0, err: 0, errA: 0
    };
    if (cfg.kind === 'burrower') { a.state = 'burrow'; e.untargetable = true; }
    if (cfg.kind === 'diver' || cfg.kind === 'boss') a.t = cfg.kind === 'boss' ? rnd(60, 110) : rndIn(cfg.circleTime);
    if (cfg.kind === 'diver') a.state = 'circle';
    if (cfg.kind === 'swarm' && cfg.erratic) a.err = rndIn(cfg.erratic);
    if (cfg.kind === 'swarm' && cfg.dive) { a.state = 'fly'; a.cd = rndIn(cfg.dive.cooldown); }
    return a;
}

const BEHAVIOUR = {
    chase(game, e, a, delta) {
        const p = game.state.player;
        a.hop += 0.1 * delta;
        pathDir(game, e, p.wx, p.wy, tmpDir);
        const mult = a.cfg.hop ? 0.15 + 2.0 * Math.max(0, Math.sin(a.hop)) : 1;
        steer(game, e, tmpDir.x, tmpDir.y, e.speed * mult * catchup(e), delta);
        face(e, tmpDir.x);
    },

    swarm(game, e, a, delta) {
        const p = game.state.player;
        const cfg = a.cfg;
        const dx = p.wx - e.wx, dy = p.wy - e.wy;
        const d = e.pd || 1;
        let ux = dx / d, uy = dy / d;
        if (!e.flying) { pathDir(game, e, p.wx, p.wy, tmpDir); ux = tmpDir.x; uy = tmpDir.y; }

        // boid terms
        let cx = 0, cy = 0, n = 0, sx = 0, sy = 0;
        game.hash.near(e.wx, e.wy, 120, nearBuf);
        for (let i = 0; i < nearBuf.length; i++) {
            const o = nearBuf[i];
            if (o === e || o.type !== e.type || o.dead) continue;
            const ox = o.wx - e.wx, oy = o.wy - e.wy;
            const od = Math.hypot(ox, oy) || 1;
            cx += ox; cy += oy; n++;
            if (od < 34) { sx -= ox / od * (34 - od) / 34; sy -= oy / od * (34 - od) / 34; }
        }
        let vx = ux, vy = uy;
        if (n) { vx += (cx / n) / 120 * cfg.cohesion * 2; vy += (cy / n) / 120 * cfg.cohesion * 2; }
        vx += sx * cfg.separation; vy += sy * cfg.separation;
        // wobble perpendicular to the heading
        const w = Math.sin(e.phase * 1.7 + e.uid) * cfg.wobble * 0.6;
        vx += -uy * w; vy += ux * w;

        // bats: sudden turns
        if (cfg.erratic) {
            a.err -= delta;
            if (a.err <= 0) { a.err = rndIn(cfg.erratic); a.errA = rnd(-1.4, 1.4); }
            const ea = Math.atan2(uy, ux) + a.errA;
            vx += Math.cos(ea) * 0.8; vy += Math.sin(ea) * 0.8;
        }

        // gulls: occasional dive bomb
        if (cfg.dive) {
            if (a.state === 'fly') {
                a.cd -= delta;
                if (a.cd <= 0 && d < 420) { a.state = 'windup'; a.t = cfg.dive.windup; a.angle = Math.atan2(dy, dx); }
            } else if (a.state === 'windup') {
                a.t -= delta;
                a.angle = lerpAngle(a.angle, Math.atan2(dy, dx), 0.2);
                if (a.t <= 0) { a.state = 'dash'; a.t = cfg.dive.time; e.dashing = true; e.dashHit = false; }
                hold(game, e, delta);
                face(e, dx);
                return;
            } else if (a.state === 'dash') {
                a.t -= delta;
                steer(game, e, Math.cos(a.angle), Math.sin(a.angle), cfg.dive.speed, delta);
                if (a.t <= 0) { a.state = 'fly'; e.dashing = false; a.cd = rndIn(cfg.dive.cooldown); }
                face(e, Math.cos(a.angle));
                return;
            }
        }

        const len = Math.hypot(vx, vy) || 1;
        steer(game, e, vx / len, vy / len, e.speed * (d > 520 ? catchup(e) : 1), delta);
        face(e, vx);
    },

    charger(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        switch (a.state) {
            case 'move': {
                pathDir(game, e, p.wx, p.wy, tmpDir);
                steer(game, e, tmpDir.x, tmpDir.y, e.speed * catchup(e), delta);
                face(e, tmpDir.x);
                a.cd -= delta;
                if (a.cd <= 0 && e.pd < cfg.range && e.pd > 70 && (e.los || e.pd < 120)) {
                    a.state = 'windup'; a.t = cfg.windup; a.angle = Math.atan2(p.wy - e.wy, p.wx - e.wx);
                }
                break;
            }
            case 'windup': {
                a.t -= delta;
                if (a.t > cfg.windup * 0.35) a.angle = lerpAngle(a.angle, Math.atan2(p.wy - e.wy, p.wx - e.wx), 0.12);
                EntityManager.teleLine(e, a.angle, cfg.dashSpeed * cfg.dash, 28, 1 - a.t / cfg.windup);
                face(e, Math.cos(a.angle));
                hold(game, e, delta);
                if (a.t <= 0) {
                    EntityManager.clearTele(e);
                    a.state = 'dash'; a.t = cfg.dash; e.dashing = true; e.dashHit = false;
                }
                break;
            }
            case 'dash': {
                a.t -= delta;
                const cx = Math.cos(a.angle), cy = Math.sin(a.angle);
                const ahead = cfg.dashSpeed * 1.6 * delta;
                if (!e.flying && game.world.blocked(e.wx + cx * ahead, e.wy + cy * ahead, e.radius * 0.8)) {
                    // slammed into something: stunned
                    a.state = 'stun'; a.t = cfg.recover * 1.8; e.dashing = false;
                    game.fx.burst(e.wx + cx * e.radius, e.wy + cy * e.radius, 16, 0xd8c8a0, 10, 2.5, { size: 0.8, life: 24 });
                    game.fx.addShake(3);
                    break;
                }
                steer(game, e, cx, cy, cfg.dashSpeed, delta);
                if (Math.random() < 0.5) dust(game, e, 1);
                if (a.t <= 0) { a.state = 'recover'; a.t = cfg.recover; e.dashing = false; }
                break;
            }
            case 'stun':
            case 'recover': {
                a.t -= delta;
                steer(game, e, 0, 0, 0, delta, false);
                if (a.state === 'stun' && Math.random() < 0.08) game.fx.burst(e.wx, e.wy, e.baseHeight, 0xffe27a, 1, 0.8, { size: 0.5, life: 16 });
                if (a.t <= 0) { a.state = 'move'; a.cd = rndIn(cfg.cooldown); }
                break;
            }
        }
    },

    pack(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        const ang = Math.atan2(e.wy - p.wy, e.wx - p.wx);
        switch (a.state) {
            case 'move': {
                if (e.pd > cfg.orbit + 60) {
                    pathDir(game, e, p.wx, p.wy, tmpDir);
                    steer(game, e, tmpDir.x, tmpDir.y, e.speed * catchup(e), delta);
                } else {
                    // circle the player, tightening toward the orbit radius
                    const tx = -Math.sin(ang) * a.dir, ty = Math.cos(ang) * a.dir;
                    const radial = clamp((cfg.orbit - e.pd) / 80, -1, 1);
                    let vx = tx + Math.cos(ang) * radial * 0.8, vy = ty + Math.sin(ang) * radial * 0.8;
                    const len = Math.hypot(vx, vy) || 1;
                    tmpDir.x = vx / len; tmpDir.y = vy / len;
                    avoid(game, e, tmpDir);
                    steer(game, e, tmpDir.x, tmpDir.y, e.speed * 1.05, delta);
                }
                face(e, p.wx - e.wx);
                a.cd -= delta;
                refreshLOS(game, e, p.wx, p.wy, e.pd);
                if (a.cd <= 0 && e.pd < cfg.orbit + 120 && e.los && game.counts.lunging < cfg.maxLunging) {
                    a.state = 'windup'; a.t = cfg.windup; a.angle = Math.atan2(p.wy - e.wy, p.wx - e.wx);
                    game.counts.lunging++;
                }
                break;
            }
            case 'windup': {
                game.counts.lunging++;
                a.t -= delta;
                a.angle = lerpAngle(a.angle, Math.atan2(p.wy - e.wy, p.wx - e.wx), 0.25);
                face(e, Math.cos(a.angle));
                hold(game, e, delta);
                if (a.t <= 0) { a.state = 'lunge'; a.t = cfg.lungeTime; e.dashing = true; e.dashHit = false; }
                break;
            }
            case 'lunge': {
                game.counts.lunging++;
                a.t -= delta;
                steer(game, e, Math.cos(a.angle), Math.sin(a.angle), cfg.lunge, delta);
                if (a.t <= 0 || e.dashHit) { a.state = 'retreat'; a.t = cfg.retreat; e.dashing = false; a.dir = Math.random() < 0.5 ? 1 : -1; }
                break;
            }
            case 'retreat': {
                a.t -= delta;
                const ux = (e.wx - p.wx) / (e.pd || 1), uy = (e.wy - p.wy) / (e.pd || 1);
                // flee diagonally so the pack scatters
                const fa = Math.atan2(uy, ux) + a.dir * 0.5;
                tmpDir.x = Math.cos(fa); tmpDir.y = Math.sin(fa);
                avoid(game, e, tmpDir);
                steer(game, e, tmpDir.x, tmpDir.y, e.speed * 1.35, delta);
                face(e, p.wx - e.wx);
                if (a.t <= 0) { a.state = 'move'; a.cd = rndIn(cfg.cooldown); }
                break;
            }
        }
    },

    kiter(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        refreshLOS(game, e, p.wx, p.wy, e.pd);
        if (a.state === 'windup') {
            a.t -= delta;
            EntityManager.teleCircle(e, 26, 1 - a.t / cfg.windup, cfg.shotColor || 0xffffff);
            face(e, p.wx - e.wx);
            hold(game, e, delta);
            if (a.t <= 0) {
                EntityManager.clearTele(e);
                const base = Math.atan2(p.wy - e.wy, p.wx - e.wx);
                const dmg = cfg.shotDamage * enemyScale(e);
                for (let i = 0; i < cfg.shots; i++) {
                    const off = cfg.shots > 1 ? (i - (cfg.shots - 1) / 2) * 0.22 : 0;
                    game.hazards.shot(e.wx, e.wy, base + off, cfg.shotSpeed, dmg, { color: cfg.shotColor, effect: cfg.effect, phase: false });
                }
                a.state = 'move'; a.cd = rndIn(cfg.shotCooldown);
            }
            return;
        }
        let dirx, diry, spd = e.speed;
        if (e.pd < cfg.min) {
            // back away, sliding around obstacles
            tmpDir.x = (e.wx - p.wx) / (e.pd || 1); tmpDir.y = (e.wy - p.wy) / (e.pd || 1);
            avoid(game, e, tmpDir);
            dirx = tmpDir.x; diry = tmpDir.y; spd *= 1.1;
        } else if (e.pd > cfg.max) {
            pathDir(game, e, p.wx, p.wy, tmpDir);
            dirx = tmpDir.x; diry = tmpDir.y; spd *= catchup(e);
        } else {
            const ang = Math.atan2(e.wy - p.wy, e.wx - p.wx);
            tmpDir.x = -Math.sin(ang) * a.dir; tmpDir.y = Math.cos(ang) * a.dir;
            avoid(game, e, tmpDir);
            dirx = tmpDir.x; diry = tmpDir.y; spd *= 0.55;
            if (Math.random() < 0.004) a.dir = -a.dir;
        }
        steer(game, e, dirx, diry, spd, delta);
        face(e, p.wx - e.wx);
        a.cd -= delta;
        if (a.cd <= 0 && e.pd < cfg.max + 90 && (e.los || e.pd < 120)) { a.state = 'windup'; a.t = cfg.windup; }
    },

    slammer(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        switch (a.state) {
            case 'move': {
                pathDir(game, e, p.wx, p.wy, tmpDir);
                steer(game, e, tmpDir.x, tmpDir.y, e.speed * catchup(e), delta);
                face(e, tmpDir.x);
                a.cd -= delta;
                if (a.cd <= 0 && e.pd < cfg.reach + e.radius) { a.state = 'windup'; a.t = cfg.windup; }
                break;
            }
            case 'windup': {
                a.t -= delta;
                EntityManager.teleCircle(e, cfg.radius, 1 - a.t / cfg.windup);
                hold(game, e, delta);
                if (a.t <= 0) {
                    EntityManager.clearTele(e);
                    game.hazards.explode(e.wx, e.wy, cfg.radius, cfg.slamDamage * enemyScale(e), 0xc89a5a);
                    a.state = 'recover'; a.t = cfg.recover;
                }
                break;
            }
            case 'recover': {
                a.t -= delta;
                hold(game, e, delta);
                if (a.t <= 0) { a.state = 'move'; a.cd = rndIn(cfg.cooldown); }
                break;
            }
        }
    },

    burrower(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        switch (a.state) {
            case 'burrow': {
                e.untargetable = true;
                tmpDir.x = (p.wx - e.wx) / (e.pd || 1); tmpDir.y = (p.wy - e.wy) / (e.pd || 1);
                e.phasing = true;
                steer(game, e, tmpDir.x, tmpDir.y, cfg.burrowSpeed * catchup(e), delta);
                face(e, tmpDir.x);
                if (Math.random() < 0.3 * delta) dust(game, e, 1);
                if (e.pd < cfg.surfaceDist) { a.state = 'surface'; a.t = cfg.surfaceWindup; }
                break;
            }
            case 'surface': {
                a.t -= delta;
                EntityManager.teleCircle(e, 74, 1 - a.t / cfg.surfaceWindup, 0xd8a850);
                if (Math.random() < 0.6) dust(game, e, 1);
                hold(game, e, delta);
                if (a.t <= 0) {
                    EntityManager.clearTele(e);
                    e.phasing = false;
                    const f = game.world.findFree(e.wx, e.wy, e.radius);
                    e.wx = f.x; e.wy = f.y;
                    e.untargetable = false;
                    game.fx.burst(e.wx, e.wy, 6, 0xd8c8a0, 14, 3, { size: 1, life: 26, up: 3 });
                    game.hazards.hitPlayerIfInside(e.wx, e.wy, 74, e.damage * 1.2);
                    a.state = 'fight'; a.t = rndIn(cfg.fightTime);
                }
                break;
            }
            case 'fight': {
                a.t -= delta;
                pathDir(game, e, p.wx, p.wy, tmpDir);
                steer(game, e, tmpDir.x, tmpDir.y, e.speed * 1.15, delta);
                face(e, tmpDir.x);
                if (a.t <= 0) { a.state = 'dive'; a.t = cfg.burrowTime; }
                break;
            }
            case 'dive': {
                a.t -= delta;
                hold(game, e, delta);
                if (Math.random() < 0.5) dust(game, e, 1);
                e.body.alpha = Math.max(0.15, a.t / cfg.burrowTime);
                if (a.t <= 0) { a.state = 'burrow'; e.untargetable = true; e.phasing = true; }
                break;
            }
        }
    },

    diver(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        switch (a.state) {
            case 'circle': {
                a.ang += a.dir * 0.022 * delta;
                const tx = p.wx + Math.cos(a.ang) * cfg.orbit, ty = p.wy + Math.sin(a.ang) * cfg.orbit;
                const dx = tx - e.wx, dy = ty - e.wy, d = Math.hypot(dx, dy) || 1;
                steer(game, e, dx / d, dy / d, Math.min(e.speed * 1.5 * catchup(e), d * 0.2 + 0.6), delta);
                face(e, p.wx - e.wx);
                a.t -= delta;
                if (a.t <= 0 && e.pd < cfg.orbit + 160) { a.state = 'windup'; a.t = cfg.windup; a.angle = Math.atan2(p.wy - e.wy, p.wx - e.wx); }
                break;
            }
            case 'windup': {
                a.t -= delta;
                if (a.t > cfg.windup * 0.3) a.angle = lerpAngle(a.angle, Math.atan2(p.wy - e.wy, p.wx - e.wx), 0.2);
                EntityManager.teleLine(e, a.angle, cfg.dive * cfg.diveTime, 24, 1 - a.t / cfg.windup);
                face(e, Math.cos(a.angle));
                hold(game, e, delta);
                if (a.t <= 0) { EntityManager.clearTele(e); a.state = 'dive'; a.t = cfg.diveTime; e.dashing = true; e.dashHit = false; }
                break;
            }
            case 'dive': {
                a.t -= delta;
                steer(game, e, Math.cos(a.angle), Math.sin(a.angle), cfg.dive, delta);
                face(e, Math.cos(a.angle));
                if (a.t <= 0) {
                    e.dashing = false;
                    if (cfg.retreat > 0) { a.state = 'retreat'; a.t = cfg.retreat; } else { a.state = 'circle'; a.t = rndIn(cfg.circleTime); a.dir = -a.dir; }
                }
                break;
            }
            case 'retreat': {
                a.t -= delta;
                const ux = (e.wx - p.wx) / (e.pd || 1), uy = (e.wy - p.wy) / (e.pd || 1);
                steer(game, e, ux, uy, e.speed * 1.3, delta);
                face(e, p.wx - e.wx);
                if (a.t <= 0) { a.state = 'circle'; a.t = rndIn(cfg.circleTime); a.ang = Math.atan2(e.wy - p.wy, e.wx - p.wx); }
                break;
            }
        }
    },

    strafer(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        switch (a.state) {
            case 'move': {
                if (e.pd > cfg.orbit + 50) {
                    pathDir(game, e, p.wx, p.wy, tmpDir);
                    steer(game, e, tmpDir.x, tmpDir.y, e.speed * catchup(e), delta);
                } else {
                    // scuttle sideways around the player
                    const ang = Math.atan2(e.wy - p.wy, e.wx - p.wx);
                    const radial = clamp((cfg.orbit - e.pd) / 60, -1, 1);
                    let vx = -Math.sin(ang) * a.dir + Math.cos(ang) * radial * 0.5;
                    let vy = Math.cos(ang) * a.dir + Math.sin(ang) * radial * 0.5;
                    const len = Math.hypot(vx, vy) || 1;
                    tmpDir.x = vx / len; tmpDir.y = vy / len;
                    avoid(game, e, tmpDir);
                    steer(game, e, tmpDir.x, tmpDir.y, cfg.strafeSpeed, delta);
                    if (Math.random() < 0.012) a.dir = -a.dir;
                }
                face(e, p.wx - e.wx);
                a.cd -= delta;
                refreshLOS(game, e, p.wx, p.wy, e.pd);
                if (a.cd <= 0 && e.pd < cfg.orbit + 100 && e.los) { a.state = 'windup'; a.t = cfg.windup; a.angle = Math.atan2(p.wy - e.wy, p.wx - e.wx); }
                break;
            }
            case 'windup': {
                a.t -= delta;
                a.angle = lerpAngle(a.angle, Math.atan2(p.wy - e.wy, p.wx - e.wx), 0.3);
                EntityManager.teleLine(e, a.angle, cfg.lunge * cfg.lungeTime, 20, 1 - a.t / cfg.windup);
                hold(game, e, delta);
                if (a.t <= 0) { EntityManager.clearTele(e); a.state = 'dash'; a.t = cfg.lungeTime; e.dashing = true; e.dashHit = false; }
                break;
            }
            case 'dash': {
                a.t -= delta;
                const cx = Math.cos(a.angle), cy = Math.sin(a.angle);
                if (game.world.blocked(e.wx + cx * cfg.lunge * 1.6 * delta, e.wy + cy * cfg.lunge * 1.6 * delta, e.radius * 0.8)) a.t = 0;
                else steer(game, e, cx, cy, cfg.lunge, delta);
                if (a.t <= 0) { a.state = 'recover'; a.t = cfg.recover; e.dashing = false; }
                break;
            }
            case 'recover': {
                a.t -= delta;
                hold(game, e, delta);
                if (a.t <= 0) { a.state = 'move'; a.cd = rndIn(cfg.cooldown); a.dir = Math.random() < 0.5 ? 1 : -1; }
                break;
            }
        }
    },

    lobber(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        refreshLOS(game, e, p.wx, p.wy, e.pd);
        switch (a.state) {
            case 'move': {
                let dirx, diry, spd = e.speed;
                if (e.pd < cfg.min) {
                    tmpDir.x = (e.wx - p.wx) / (e.pd || 1); tmpDir.y = (e.wy - p.wy) / (e.pd || 1);
                    avoid(game, e, tmpDir); dirx = tmpDir.x; diry = tmpDir.y; spd *= 1.1;
                } else if (e.pd > cfg.max) {
                    pathDir(game, e, p.wx, p.wy, tmpDir); dirx = tmpDir.x; diry = tmpDir.y; spd *= catchup(e);
                } else {
                    const ang = Math.atan2(e.wy - p.wy, e.wx - p.wx);
                    tmpDir.x = -Math.sin(ang) * a.dir; tmpDir.y = Math.cos(ang) * a.dir; avoid(game, e, tmpDir);
                    dirx = tmpDir.x; diry = tmpDir.y; spd *= 0.5;
                }
                steer(game, e, dirx, diry, spd, delta);
                face(e, p.wx - e.wx);
                a.cd -= delta;
                if (a.cd <= 0 && e.pd < cfg.max + 80 && (e.los || e.pd < 200)) { a.state = 'windup'; a.t = cfg.windup; }
                break;
            }
            case 'windup': {
                a.t -= delta;
                hold(game, e, delta);
                face(e, p.wx - e.wx);
                if (a.t <= 0) {
                    const lead = cfg.flight * 0.7;
                    const tx = p.wx + game.playerVel.x * lead, ty = p.wy + game.playerVel.y * lead;
                    game.hazards.lob(e.wx, e.wy, tx, ty, cfg.flight, cfg.radius, cfg.lobDamage * enemyScale(e));
                    a.state = 'recover'; a.t = 32;
                }
                break;
            }
            case 'recover': {
                a.t -= delta;
                hold(game, e, delta);
                if (a.t <= 0) { a.state = 'move'; a.cd = rndIn(cfg.cooldown); if (Math.random() < 0.5) a.dir = -a.dir; }
                break;
            }
        }
    },

    floater(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        if (a.state === 'windup') {
            a.t -= delta;
            hold(game, e, delta);
            if (a.t <= 0) {
                const dmg = cfg.shotDamage * enemyScale(e);
                const rot = Math.random() * TAU;
                for (let i = 0; i < cfg.shots; i++) {
                    game.hazards.shot(e.wx, e.wy, rot + (i / cfg.shots) * TAU, cfg.shotSpeed, dmg, { color: cfg.shotColor, phase: true, life: 140 });
                }
                a.state = 'move'; a.cd = rndIn(cfg.burstCooldown);
            }
            return;
        }
        const ux = (p.wx - e.wx) / (e.pd || 1), uy = (p.wy - e.wy) / (e.pd || 1);
        let vx, vy;
        if (e.pd > cfg.range) { vx = ux; vy = uy; }
        else if (e.pd < cfg.range * 0.55) { vx = -ux; vy = -uy; }
        else { const s = Math.sin(e.phase * 0.4); vx = -uy * s; vy = ux * s; }
        steer(game, e, vx, vy, e.speed * (e.pd > cfg.range ? catchup(e) : 0.8), delta);
        face(e, ux);
        a.cd -= delta;
        if (a.cd <= 0 && e.pd < cfg.range + 140) { a.state = 'windup'; a.t = cfg.windup; }
    },

    // Warlords chain several abilities, and get faster when below half health
    boss(game, e, a, delta) {
        const p = game.state.player, cfg = a.cfg;
        const enraged = e.health < e.maxHealth * 0.5;
        if (enraged && !e.enraged) {
            e.enraged = true;
            e.speed *= 1.2;
            game.ui.banner(`${ENEMY_TYPES[e.type].name.toUpperCase()} IS ENRAGED!`, 0xff5a5a);
            game.fx.addShake(8);
        }
        const tm = enraged ? 0.7 : 1;
        const sc = enemyScale(e);

        switch (a.state) {
            case 'move': {
                pathDir(game, e, p.wx, p.wy, tmpDir);
                steer(game, e, tmpDir.x, tmpDir.y, e.speed * catchup(e), delta);
                face(e, tmpDir.x);
                a.t -= delta;
                if (a.t <= 0) {
                    a.sub = cfg.abilities[a.idx++ % cfg.abilities.length];
                    a.state = 'windup';
                    a.angle = Math.atan2(p.wy - e.wy, p.wx - e.wx);
                    const w = a.sub === 'dash' ? cfg.dash.windup : a.sub === 'slam' ? cfg.slam.windup : a.sub === 'summon' ? 44 : a.sub === 'volley' ? 38 : 36;
                    a.t = w * tm; a.t0 = a.t;
                }
                break;
            }
            case 'windup': {
                a.t -= delta;
                const prog = 1 - a.t / a.t0;
                hold(game, e, delta);
                if (a.sub === 'dash') {
                    if (prog < 0.65) a.angle = lerpAngle(a.angle, Math.atan2(p.wy - e.wy, p.wx - e.wx), 0.12);
                    EntityManager.teleLine(e, a.angle, cfg.dash.speed * cfg.dash.time, 40, prog);
                    face(e, Math.cos(a.angle));
                } else if (a.sub === 'slam') {
                    EntityManager.teleCircle(e, cfg.slam.radius, prog);
                } else if (a.sub === 'summon') {
                    EntityManager.teleCircle(e, 90, prog, 0xb060ff);
                } else {
                    EntityManager.teleCircle(e, 40, prog, 0xffb040);
                    face(e, p.wx - e.wx);
                }
                if (a.t > 0) break;
                EntityManager.clearTele(e);
                if (a.sub === 'dash') {
                    a.state = 'dash'; a.t = cfg.dash.time; e.dashing = true; e.dashHit = false;
                } else if (a.sub === 'slam') {
                    game.hazards.explode(e.wx, e.wy, cfg.slam.radius, cfg.slam.damage * sc, 0xc89a5a);
                    game.fx.addShake(8);
                    a.state = 'recover'; a.t = 40 * tm;
                } else if (a.sub === 'summon') {
                    game.spawnMinions(cfg.summon.type, cfg.summon.count + (enraged ? 1 : 0), e.wx, e.wy, e.level);
                    game.fx.burst(e.wx, e.wy, 20, 0xb060ff, 24, 3.5, { size: 0.9, life: 34, up: 3 });
                    a.state = 'recover'; a.t = 32 * tm;
                } else if (a.sub === 'volley') {
                    const v = cfg.volley;
                    const n = v.count + (enraged ? 2 : 0);
                    if (v.aimed) {
                        const base = Math.atan2(p.wy - e.wy, p.wx - e.wx);
                        for (let i = 0; i < n; i++) {
                            const off = n > 1 ? (i / (n - 1) - 0.5) * v.spread * 1.6 : 0;
                            game.hazards.shot(e.wx, e.wy, base + off, v.speed, v.damage * sc, { color: v.color });
                        }
                    } else {
                        const rot = Math.random() * TAU;
                        for (let i = 0; i < n; i++) game.hazards.shot(e.wx, e.wy, rot + (i / n) * TAU, v.speed, v.damage * sc, { color: v.color, phase: false });
                    }
                    a.state = 'recover'; a.t = 34 * tm;
                } else if (a.sub === 'lob') {
                    const l = cfg.lob;
                    const n = l.count + (enraged ? 2 : 0);
                    for (let i = 0; i < n; i++) {
                        const tx = p.wx + (i ? rnd(-170, 170) : game.playerVel.x * 30);
                        const ty = p.wy + (i ? rnd(-130, 130) : game.playerVel.y * 30);
                        game.hazards.lob(e.wx, e.wy, tx, ty, 58 + i * 9, l.radius, l.damage * sc);
                    }
                    a.state = 'recover'; a.t = 40 * tm;
                }
                break;
            }
            case 'dash': {
                a.t -= delta;
                const cx = Math.cos(a.angle), cy = Math.sin(a.angle);
                if (game.world.blocked(e.wx + cx * cfg.dash.speed * 1.5 * delta, e.wy + cy * cfg.dash.speed * 1.5 * delta, e.radius * 0.8)) {
                    game.fx.addShake(6);
                    a.t = 0;
                    a.stunned = true;
                } else steer(game, e, cx, cy, cfg.dash.speed, delta);
                if (Math.random() < 0.6) dust(game, e, 1);
                if (a.t <= 0) { a.state = 'recover'; e.dashing = false; a.t = cfg.dash.recover * tm * (a.stunned ? 1.8 : 1); a.stunned = false; }
                break;
            }
            case 'recover': {
                a.t -= delta;
                hold(game, e, delta);
                if (a.t <= 0) { a.state = 'move'; a.t = rnd(70, 130) * tm; }
                break;
            }
        }
    }
};


// ---------------------------------------------------------------------------
// Perception shell for resident monsters (camps, lairs, roamers):
//   idle -> engaged -> returning -> idle
// Monsters only notice the player inside their own sight range, give up after losing track, and never
// follow beyond their leash, so a field monster no longer chases you across a biome border.
// ---------------------------------------------------------------------------
function canSee(game, e, perc) {
    if (e.pd > perc.sight) return false;
    if (e.flying || e.phasing || e.pd < perc.sight * 0.4) return true;
    const p = game.state.player;
    refreshLOS(game, e, p.wx, p.wy, e.pd);
    return e.los;
}

export function engage(game, e, alertAllies = true) {
    if (e.shell === 'engaged') return;
    e.shell = 'engaged';
    e.lostFor = 0;
    e.ai = initAI(e);
    if (alertAllies) {
        const buf = [];
        game.hash.near(e.wx, e.wy, e.perc.alert, buf);
        for (const o of buf) if (o !== e && !o.dead && o.home && o.shell !== 'engaged') engage(game, o, false);
    }
}

function idleWander(game, e, delta) {
    e.untargetable = false;
    e.phasing = !!ENEMY_TYPES[e.type].phase;
    if (!e.wander) e.wander = { tx: e.home.x, ty: e.home.y, wait: rnd(30, 200) };
    const w = e.wander;
    w.wait -= delta;
    const dx = w.tx - e.wx, dy = w.ty - e.wy;
    const d = Math.hypot(dx, dy);
    if (d < 10) {
        hold(game, e, delta);
        if (w.wait <= 0) {
            for (let i = 0; i < 6; i++) {
                const a = Math.random() * TAU, r = rnd(30, 130);
                const tx = e.home.x + Math.cos(a) * r, ty = e.home.y + Math.sin(a) * r;
                if (e.flying || !game.world.blocked(tx, ty, e.radius)) { w.tx = tx; w.ty = ty; break; }
            }
            w.wait = rnd(90, 260);
        }
    } else {
        steer(game, e, dx / d, dy / d, e.speed * 0.35, delta, false);
        face(e, dx);
    }
}

function walkHome(game, e, delta) {
    const dx = e.home.x - e.wx, dy = e.home.y - e.wy;
    const d = Math.hypot(dx, dy);
    if (d < 36) {
        e.shell = 'idle';
        e.health = e.maxHealth;
        e.ai = initAI(e);
        e.untargetable = false;
        e.phasing = !!ENEMY_TYPES[e.type].phase;
        e.dashing = false;
        e.enraged = false;
        return;
    }
    tmpDir.x = dx / d; tmpDir.y = dy / d;
    if (!e.flying && !e.phasing) { avoid(game, e, tmpDir); }
    steer(game, e, tmpDir.x, tmpDir.y, e.speed * 1.3, delta, false);
    face(e, dx);
}

// returns true when the shell fully handled this frame (monster is idle or walking home)
function perceptionShell(game, e, delta) {
    const perc = e.perc;
    if (!e.shell) e.shell = 'idle';
    const homeD = Math.hypot(e.wx - e.home.x, e.wy - e.home.y);

    if (e.shell === 'idle') {
        if (canSee(game, e, perc)) { engage(game, e); return false; }
        idleWander(game, e, delta);
        return true;
    }
    if (e.shell === 'returning') {
        if (e.pd < perc.sight * 0.6 && homeD < e.leash * 0.7) { engage(game, e); return false; }
        walkHome(game, e, delta);
        return true;
    }
    // engaged
    const lost = e.pd > perc.sight * perc.loseMul;
    const leashed = homeD > e.leash;
    if (lost || leashed) {
        e.lostFor = (e.lostFor || 0) + delta;
        if (leashed || e.lostFor > perc.memory) {
            e.shell = 'returning';
            EntityManager.clearTele(e);
            e.dashing = false;
        }
    } else e.lostFor = 0;
    return false;
}

// ---------------------------------------------------------------------------
// Entry point, called once per living enemy per frame
// ---------------------------------------------------------------------------
export function updateEnemy(game, e, delta) {
    const p = game.state.player;
    if (!e.ai) {
        e.ai = initAI(e);
        e.avoidSign = Math.random() < 0.5 ? 1 : -1;
        e.losAt = 0; e.los = true; e.nudge = 0; e.nudgeA = 0;
        e.stuckAt = game.frame + 20; e.sx = e.wx; e.sy = e.wy; e.wantsMove = false;
    }
    const dx = p.wx - e.wx, dy = p.wy - e.wy;
    e.pd = Math.hypot(dx, dy) || 0.001;

    // dormant interior monsters only wake when the player gets close
    if (e.dormant) {
        if (e.pd < (e.aggro || 420)) e.dormant = false;
        else { hold(game, e, delta); return; }
    }

    if (!e.perc) e.perc = perceptionOf(e.type);
    if (e.home && perceptionShell(game, e, delta)) return;

    if (e.nudge > 0) e.nudge -= delta;
    BEHAVIOUR[e.ai.kind](game, e, e.ai, delta);
    checkStuck(game, e);

    // soft separation so packs spread out
    game.hash.near(e.wx, e.wy, e.radius * 2 + 10, nearBuf);
    for (let i = 0; i < nearBuf.length; i++) {
        const o = nearBuf[i];
        if (o === e || o.dead || o.dormant) continue;
        const ox = e.wx - o.wx, oy = e.wy - o.wy;
        const min = (e.radius + o.radius) * 0.85;
        if (Math.abs(ox) > min || Math.abs(oy) > min) continue;
        const d = Math.hypot(ox, oy) || 0.01;
        if (d >= min) continue;
        const push = (min - d) * 0.18 * delta;
        if (e.flying || e.phasing) { e.wx += ox / d * push; e.wy += oy / d * push; }
        else game.world.tryMove(e, ox / d * push, oy / d * push, e.radius * 0.8);
    }

    // contact damage (burrowed enemies are harmless)
    if (!e.untargetable) {
        const touch = e.radius + p.radius;
        const dist = Math.hypot(p.wx - e.wx, p.wy - e.wy);
        if (dist < touch) {
            game.hurtPlayer(e.damage * (delta / 60));
            if (e.dashing && !e.dashHit) {
                e.dashHit = true;
                game.hurtPlayer(e.damage * (e.ai.cfg.burst || (e.ai.cfg.dash && e.ai.cfg.dash.burst) || 1.2), true);
                game.fx.burst(p.wx, p.wy, 20, 0xff6a4a, 8, 2.6, { size: 0.7, life: 20 });
                game.fx.addShake(4);
            }
        }
    }
}
