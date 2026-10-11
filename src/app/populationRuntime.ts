import { WORLD_CONFIG } from '../core/config';
import { POPULATION, Population, pickRosterEntry, type Camp } from '../core/world/population';
import type { OverworldSource } from '../core/world/terrain';
import { groupOf } from '../core/world/biomes';
import { tierOf } from '../core/world/difficulty';

const CHUNK = WORLD_CONFIG.tile * WORLD_CONFIG.chunkTiles;
const SPAWN_DIST = CHUNK * 3.0;
const DESPAWN_DIST = CHUNK * 4.2;
const ROAMER_LEASH = 320;

interface ActiveCamp { camp: Camp; members: any[] }

/** Brings seeded camps to life near the player, tracks clears, and adds a few ambient roamers. */
export class PopulationRuntime {
  population: Population | null = null;
  active = new Map<string, ActiveCamp>();
  roamers: any[] = [];
  private timer = 0;
  private roamerTimer = 0;

  constructor(private game: any) {}

  reset(source: OverworldSource): void {
    this.population = new Population(source);
    this.active.clear();
    this.roamers = [];
    this.timer = 0;
  }

  /** forget live references (the entities themselves are removed by the game) */
  clearActive(): void {
    this.active.clear();
    this.roamers = [];
    this.timer = 0;
  }

  isCleared(camp: Camp): boolean {
    const s = this.game.session;
    if (camp.lair) return s.defeatedLairs[camp.id] !== undefined;
    const t = s.clearedCamps[camp.id];
    if (t === undefined) return false;
    if (this.game.state.time - t > POPULATION.respawnSeconds) { delete s.clearedCamps[camp.id]; return false; }
    return true;
  }

  update(delta: number): void {
    const g = this.game;
    if (!this.population || g.mode !== 'overworld') return;
    this.timer -= delta;
    if (this.timer <= 0) {
      this.timer = 20;
      const p = g.state.player;
      const pcx = Math.floor(p.wx / CHUNK), pcy = Math.floor(p.wy / CHUNK);
      for (let cy = pcy - 4; cy <= pcy + 4; cy++) {
        for (let cx = pcx - 4; cx <= pcx + 4; cx++) {
          for (const camp of this.population.campsForChunk(cx, cy)) {
            if (this.active.has(camp.id)) continue;
            if (Math.hypot(camp.x - p.wx, camp.y - p.wy) > SPAWN_DIST) continue;
            if (this.isCleared(camp)) continue;
            this.spawnCamp(camp);
          }
        }
      }
      for (const [id, a] of this.active) {
        if (Math.hypot(a.camp.x - p.wx, a.camp.y - p.wy) > DESPAWN_DIST && !a.members.some((m) => !m.dead && m.shell === 'engaged')) this.despawn(id);
      }
    }
    this.updateRoamers(delta);
  }

  private spawnCamp(camp: Camp): void {
    const g = this.game;
    const members: any[] = [];
    camp.members.forEach((m, i) => {
      const a = (i / camp.members.length) * Math.PI * 2 + (i * 1.7);
      const r = i === 0 && camp.lair ? 0 : 25 + (i % 4) * 22;
      let x = camp.x + Math.cos(a) * r, y = camp.y + Math.sin(a) * r;
      const type = g.enemyTypes[m.type];
      if (!type.flying && g.world.blocked(x, y, type.radius)) { const f = g.world.findFree(x, y, type.radius); x = f.x; y = f.y; }
      const e = g.makeEnemy(m.type, x, y, {
        level: camp.level, home: { x: camp.x, y: camp.y }, leash: camp.leash, campId: camp.id, elite: m.elite, lair: camp.lair && i === 0
      });
      members.push(e);
    });
    this.active.set(camp.id, { camp, members });
  }

  private despawn(id: string): void {
    const a = this.active.get(id);
    if (!a) return;
    for (const e of a.members) if (!e.dead) { e.dead = true; e.silent = true; }
    this.active.delete(id);
  }

  /** called by the game when an enemy dies */
  onKill(e: any): void {
    if (e.roamer) { this.roamers = this.roamers.filter((r) => r !== e); return; }
    if (!e.campId) return;
    const a = this.active.get(e.campId);
    if (!a) return;
    if (a.members.some((m) => !m.dead)) return;
    this.active.delete(e.campId);
    const g = this.game;
    if (a.camp.lair) {
      g.session.defeatedLairs[a.camp.id] = g.state.time;
      g.events.emit('LairDefeated', { id: a.camp.id, type: a.camp.members[0].type });
    } else {
      g.session.clearedCamps[a.camp.id] = g.state.time;
      g.events.emit('CampCleared', { id: a.camp.id });
    }
    g.map.dirty = true;
  }

  private updateRoamers(delta: number): void {
    const g = this.game;
    const p = g.state.player;
    this.roamerTimer -= delta;
    this.roamers = this.roamers.filter((r) => {
      if (r.dead) return false;
      if (Math.hypot(r.wx - p.wx, r.wy - p.wy) > CHUNK * 3.4 && r.shell !== 'engaged') { r.dead = true; r.silent = true; return false; }
      return true;
    });
    if (this.roamerTimer > 0) return;
    this.roamerTimer = 100;
    const source = g.overworld;
    const cap = 3 + Math.floor(g.zoneLevelNow / 12);
    if (this.roamers.length >= cap) return;
    const pt = g.spawnPoint(true);
    if (!pt) return;
    const tx = Math.floor(pt.x / WORLD_CONFIG.tile), ty = Math.floor(pt.y / WORLD_CONFIG.tile);
    const group = groupOf(source.biomeAt(tx, ty));
    const level = source.levelAt(tx, ty);
    const entry = pickRosterEntry(group, level, Math.random());
    const type = g.enemyTypes[entry.type];
    if (!type.flying && g.world.blocked(pt.x, pt.y, type.radius)) return;
    const e = g.makeEnemy(entry.type, pt.x, pt.y, { level, home: { x: pt.x, y: pt.y }, leash: ROAMER_LEASH, roamer: true });
    this.roamers.push(e);
    void tierOf;
  }
}
