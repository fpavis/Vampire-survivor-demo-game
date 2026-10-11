import { describe, expect, it } from 'vitest';
import { BIOME, isSolidBiome, isWaterBiome } from '../src/core/world/biomes';
import { OverworldSource } from '../src/core/world/terrain';
import {
  DIRS, TOWER_DEFS, TOWER_KINDS, boatBlocked, boatSpot, cacheForCell, checkPlacement, deposit, editMap, emptyCost, fareBetween,
  isFunded, newTower, planBridge, planClimb, plateauCentre, plateauDecor, progressOf, remaining, stageOf, towerEdits, type PlaceEnv, type TowerRec
} from '../src/core/world/towers';

const src = new OverworldSource(2024);
const baseBiome = (x: number, y: number) => src.biomeAt(x, y);
const env = (towers: TowerRec[] = [], pois: PlaceEnv['pois'] = []): PlaceEnv => ({ baseBiomeAt: baseBiome, biomeAt: baseBiome, towers, pois });

/** every tile reachable on foot from (sx, sy) within a box, given a biome function */
function reach(sx: number, sy: number, biomeAt: (x: number, y: number) => number, box = 60): Set<string> {
  const seen = new Set<string>([`${sx},${sy}`]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of DIRS.slice(0, 4)) {
      const nx = x + dx, ny = y + dy;
      if (Math.abs(nx - sx) > box || Math.abs(ny - sy) > box || seen.has(`${nx},${ny}`)) continue;
      const b = biomeAt(nx, ny);
      if (isSolidBiome(b) || isWaterBiome(b)) continue;
      seen.add(`${nx},${ny}`);
      q.push([nx, ny]);
    }
  }
  return seen;
}

function find(kind: 'climb' | 'bridge' | 'dock', accept: (tx: number, ty: number, plan: { dir: number; len: number }) => boolean = () => true): { tx: number; ty: number; plan: { dir: number; len: number } } | null {
  for (let r = 30; r < 520; r += 2) for (let a = 0; a < 6.28; a += 0.03) {
    const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
    const res = checkPlacement(kind, tx, ty, env());
    if (res.ok && res.plan && accept(tx, ty, res.plan)) return { tx, ty, plan: res.plan };
  }
  return null;
}
// the far shore of a bridge must not already be reachable on foot
const bridgeIsNeeded = (tx: number, ty: number, plan: { dir: number; len: number }) => {
  const [dx, dy] = DIRS[plan.dir];
  return !reach(tx, ty, baseBiome, 40).has(`${tx + dx * (plan.len + 1)},${ty + dy * (plan.len + 1)}`);
};

describe('construction', () => {
  it('towers are expensive and ordered sensibly', () => {
    for (const k of TOWER_KINDS) {
      const c = TOWER_DEFS[k].cost;
      expect(c.gold + c.wood + c.stone + c.iron, k).toBeGreaterThan(150);
    }
    const total = (k: keyof typeof TOWER_DEFS) => Object.values(TOWER_DEFS[k].cost).reduce((a, b) => a + b, 0);
    expect(total('climb')).toBeGreaterThan(total('spire'));
    expect(total('ward')).toBeGreaterThan(total('beacon'));
  });

  it('deposits only what is missing and never more than the wallet holds', () => {
    const rec = newTower('beacon', 20, 20);
    const wallet = { gold: 30, wood: 100, stone: 10, iron: 0 };
    const given = deposit(rec, wallet);
    expect(given).toEqual({ gold: 30, wood: 36, stone: 10, iron: 0 });
    expect(wallet).toEqual({ gold: 0, wood: 64, stone: 0, iron: 0 });
    expect(isFunded(rec)).toBe(false);
    expect(progressOf(rec)).toBeGreaterThan(0.3);
    expect(progressOf(rec)).toBeLessThan(0.8);
    const more = deposit(rec, { gold: 1000, wood: 1000, stone: 1000, iron: 1000 });
    expect(more.wood).toBe(0);
    expect(more.gold).toBe(40);
    expect(isFunded(rec)).toBe(true);
    expect(progressOf(rec)).toBe(1);
    expect(remaining(TOWER_DEFS.beacon.cost, rec.delivered)).toEqual(emptyCost());
  });

  it('stages grow as material arrives', () => {
    const rec = newTower('spire', 20, 20);
    expect(stageOf(rec)).toBe(0);
    deposit(rec, { gold: 1e6, wood: 20, stone: 0, iron: 0 });
    const s1 = stageOf(rec);
    deposit(rec, { gold: 1e6, wood: 1e6, stone: 1e6, iron: 1e6 });
    expect(stageOf(rec)).toBe(3);
    expect(s1).toBeLessThanOrEqual(3);
  });

  it('fares grow with distance', () => {
    expect(fareBetween({ tx: 0, ty: 0 }, { tx: 400, ty: 0 })).toBeGreaterThan(fareBetween({ tx: 0, ty: 0 }, { tx: 40, ty: 0 }));
  });
});

describe('placement rules', () => {
  const land = (() => { for (let x = 60; x < 400; x++) { let ok = true; for (let j = -2; j <= 2 && ok; j++) for (let i = -2; i <= 2; i++) { const b = baseBiome(x + i, 70 + j); if (isSolidBiome(b) || isWaterBiome(b)) { ok = false; break; } } if (ok) return { tx: x, ty: 70 }; } return null; })()!;

  it('open ground is fine for a spire, water and walls are not', () => {
    expect(land).toBeTruthy();
    expect(checkPlacement('spire', land.tx, land.ty, env()).ok).toBe(true);
    let water: [number, number] | null = null;
    for (let x = -300; x < 300 && !water; x++) for (let y = -300; y < 300; y += 7) if (baseBiome(x, y) === BIOME.DEEP) { water = [x, y]; break; }
    expect(checkPlacement('spire', water![0], water![1], env()).ok).toBe(false);
  });

  it('keeps distance from other towers and from towns', () => {
    const other = newTower('spire', land.tx + 3, land.ty);
    expect(checkPlacement('spire', land.tx, land.ty, env([other])).reason).toMatch(/tower/);
    expect(checkPlacement('spire', land.tx, land.ty, env([], [{ tx: land.tx + 5, ty: land.ty, type: 'city' }])).reason).toMatch(/town/);
    expect(checkPlacement('spire', land.tx, land.ty, env([], [{ tx: land.tx + 4, ty: land.ty, type: 'cave' }])).reason).toMatch(/landmark/);
    expect(checkPlacement('spire', 3, 3, env()).reason).toMatch(/journey/);
  });

  it('towers can be built in great numbers when far enough apart (no count limit)', () => {
    const towers: TowerRec[] = [];
    for (let i = 0; i < 60; i++) towers.push(newTower('beacon', land.tx + i * 12, land.ty));
    expect(checkPlacement('beacon', land.tx + 61 * 12, land.ty, env(towers)).reason ?? '').not.toMatch(/limit|many/i);
  });

  it('special towers refuse unsuitable ground', () => {
    const flat: PlaceEnv = { baseBiomeAt: () => BIOME.GRASS, biomeAt: () => BIOME.GRASS, towers: [], pois: [] };
    expect(checkPlacement('climb', 100, 100, flat).reason).toMatch(/mountain/);
    expect(checkPlacement('bridge', 100, 100, flat).reason).toMatch(/water/);
    expect(checkPlacement('dock', 100, 100, flat).reason).toMatch(/water/);
  });
});

describe('terrain edits', () => {
  it('a climbing tower opens a plateau that was unreachable', () => {
    const spot = find('climb');
    expect(spot).not.toBeNull();
    const rec = { ...newTower('climb', spot!.tx, spot!.ty, spot!.plan), built: true };
    const edits = editMap([rec]);
    const edited = (x: number, y: number) => edits.get(`${x},${y}`) ?? baseBiome(x, y);
    const c = plateauCentre(rec)!;
    expect(isSolidBiome(baseBiome(c.tx, c.ty)) || baseBiome(c.tx, c.ty) === BIOME.HILL).toBe(true);
    const before = reach(rec.tx, rec.ty, baseBiome, 40);
    const after = reach(rec.tx, rec.ty, edited, 40);
    expect(before.has(`${c.tx},${c.ty}`)).toBe(false);
    expect(after.has(`${c.tx},${c.ty}`)).toBe(true);
    expect(edited(c.tx, c.ty)).toBe(BIOME.PLATEAU);
  });

  it('edits are deterministic and only touch solid rock', () => {
    const spot = find('climb')!;
    const rec = { ...newTower('climb', spot.tx, spot.ty, spot.plan), built: true };
    expect(towerEdits(rec)).toEqual(towerEdits({ ...rec }));
    for (const [x, y] of towerEdits(rec)) {
      const b = baseBiome(x, y);
      expect([BIOME.MOUNTAIN, BIOME.PEAK, BIOME.HILL, BIOME.GRASS, BIOME.FOREST, BIOME.DRY, BIOME.SAND]).toContain(b);
    }
  });

  it('a plateau grows ore and crystals', () => {
    const spot = find('climb')!;
    const rec = { ...newTower('climb', spot.tx, spot.ty, spot.plan), built: true };
    const d = plateauDecor(rec, src.seed);
    expect(d.filter((x) => x.type === 'ore').length).toBeGreaterThan(2);
    expect(d.some((x) => x.type === 'crystal')).toBe(true);
    expect(plateauDecor(newTower('spire', 0, 0), 1)).toEqual([]);
  });

  it('a bridge joins two shores', () => {
    const spot = find('bridge', bridgeIsNeeded);
    expect(spot).not.toBeNull();
    const rec = { ...newTower('bridge', spot!.tx, spot!.ty, spot!.plan), built: true };
    const edits = editMap([rec]);
    const edited = (x: number, y: number) => edits.get(`${x},${y}`) ?? baseBiome(x, y);
    const [dx, dy] = DIRS[rec.dir];
    const far = { tx: rec.tx + dx * (rec.len + 1), ty: rec.ty + dy * (rec.len + 1) };
    expect(reach(rec.tx, rec.ty, baseBiome, 40).has(`${far.tx},${far.ty}`)).toBe(false);
    expect(reach(rec.tx, rec.ty, edited, 40).has(`${far.tx},${far.ty}`)).toBe(true);
    for (const [x, y, b] of towerEdits(rec)) { expect(b).toBe(BIOME.BRIDGE); expect(isWaterBiome(baseBiome(x, y)) || b === BIOME.BRIDGE).toBe(true); }
  });

  it('a dock makes a pier and a boat spot in water', () => {
    const spot = find('dock');
    expect(spot).not.toBeNull();
    const rec = { ...newTower('dock', spot!.tx, spot!.ty, spot!.plan), built: true };
    const pier = towerEdits(rec);
    expect(pier.length).toBe(rec.len);
    const boat = boatSpot(rec);
    const b = baseBiome(Math.floor(boat.x / 48), Math.floor(boat.y / 48));
    expect(isWaterBiome(b)).toBe(true);
  });

  it('planners never choose a direction without the needed terrain', () => {
    expect(planClimb(150, 150, () => BIOME.GRASS)).toBeNull();
    expect(planBridge(150, 150, () => BIOME.GRASS, 18, false)).toBeNull();
    // a hand-made strait: land | shallows, deep water, shallows | land
    const strait = (x: number) => (x < 10 ? BIOME.GRASS : x < 12 ? BIOME.SHALLOW : x < 14 ? BIOME.DEEP : x < 16 ? BIOME.SHALLOW : BIOME.GRASS);
    const plan = planBridge(9, 0, (x, y) => (Math.abs(y) > 3 ? BIOME.MOUNTAIN : strait(x)), 18, false);
    expect(plan).toEqual({ dir: 0, len: 7 });
    // a ford of shallows alone can simply be waded: no bridge tower is needed there
    const ford = (x: number) => (x < 10 ? BIOME.GRASS : x < 16 ? BIOME.SHALLOW : BIOME.GRASS);
    expect(planBridge(9, 0, (x, y) => (Math.abs(y) > 3 ? BIOME.MOUNTAIN : ford(x)), 18, false)).toBeNull();
  });

  it('boats may only float on open water', () => {
    expect(boatBlocked(BIOME.DEEP)).toBe(false);
    expect(boatBlocked(BIOME.SHALLOW)).toBe(false);
    for (const b of [BIOME.GRASS, BIOME.SAND, BIOME.MOUNTAIN, BIOME.BRIDGE, BIOME.PLATEAU]) expect(boatBlocked(b)).toBe(true);
  });
});

describe('island caches', () => {
  it('are deterministic, rare and sit on tiny islands', () => {
    let n = 0;
    for (let cy = -14; cy <= 14; cy++) for (let cx = -14; cx <= 14; cx++) {
      const a = cacheForCell(src.seed, cx, cy, baseBiome), b = cacheForCell(src.seed, cx, cy, baseBiome);
      expect(a).toEqual(b);
      if (a) { n++; expect(isWaterBiome(baseBiome(a.tx, a.ty))).toBe(false); }
    }
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThan(150);
  });
});
