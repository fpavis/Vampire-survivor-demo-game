// Phase 6 end-to-end checks: build mode, construction, spire, ward, beacon, waypoint, Expedition Mine, bridge, dock, boat, island caches.
import { suite } from './harness.mjs';

const h = await suite('phase6', { viewport: { width: 1200, height: 760 } });
const { check } = h;
let page = await h.newPage();
await page.goto(h.url);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(() => { const g = window.game; g.state.nextLevel = 1e12; g.godMode = true; g.popRuntime.population = null; });   // no random camps, no deaths: only what the test spawns

// helpers living in the page
const installHelpers = () => {
  const T = 48;
  window.T = T;
  window.findSpot = (kind, minR = 14) => {
    const g = window.game;
    for (let r = minR; r < 520; r += 2) for (let a = 0; a < 6.28; a += 0.03) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      const res = g.towers.check(kind, tx, ty);
      if (res.ok) return { tx, ty, plan: res.plan || null };
    }
    return null;
  };
  window.goTo = (x, y) => {
    const g = window.game, p = g.state.player;
    p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.lastFogTx = null;
    g.world.update(x, y, 1200, 760, true);
    for (const e of [...g.state.enemies]) e.dead = true;
    g.reap();
  };
  window.rich = () => { const w = window.game.state.wallet; w.gold = 5000; w.wood = 5000; w.stone = 5000; w.iron = 5000; };
  window.buildNow = (kind, spot) => {
    const g = window.game, { newTower } = window.__dev.towersApi;
    const rec = newTower(kind, spot.tx, spot.ty, spot.plan || undefined);
    g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec);
    window.rich(); g.towers.deliver(rec);
    return rec;
  };
  // shortest 4-neighbour path through water (for a boat) from a tile to the water next to the nearest island treasure
  window.waterPath = (sx, sy, box = 130, maxSteps = 60000) => {
    const g = window.game, api = window.__dev.towersApi;
    // reefs and sea stacks block a boat just like land does, so the route must go around them
    const blocked = (tx, ty) => api.boatBlocked(g.world.biomeAt(tx, ty)) || g.world.blocked((tx + 0.5) * 48, (ty + 0.5) * 48, 14, true);
    const caches = g.sea.cachesNear(sx, sy, box).filter((c) => !g.sea.isOpened(c.id));
    if (!caches.length) return null;
    const near = (x, y) => caches.find((c) => Math.max(Math.abs(c.tx - x), Math.abs(c.ty - y)) <= 3);
    const seen = new Map([[sx + ',' + sy, null]]); const q = [[sx, sy]]; let steps = 0, goal = null, cache = null;
    for (let h = 0; h < q.length && !goal && steps++ < maxSteps; h++) {
      const [x, y] = q[h];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || Math.abs(nx - sx) > box || Math.abs(ny - sy) > box || blocked(nx, ny)) continue;
        seen.set(k, [x, y]);
        const c = near(nx, ny);
        if (c) { goal = [nx, ny]; cache = c; break; }
        q.push([nx, ny]);
      }
    }
    if (!goal) return null;
    const path = [];
    for (let k = goal.join(); k;) { path.push(k.split(',').map(Number)); const prev = seen.get(k); k = prev ? prev.join() : null; }
    return { path: path.reverse(), cache };
  };
  // a dock spot whose boat can reach an island treasure by water
  window.findDockWithTreasure = () => {
    const g = window.game, api = window.__dev.towersApi, tried = [];
    for (let r = 16; r < 260; r += 3) for (let a = 0; a < 6.28; a += 0.05) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      if (tried.some((t) => Math.hypot(t[0] - tx, t[1] - ty) < 14)) continue;
      const res = g.towers.check('dock', tx, ty);
      if (!res.ok) continue;
      tried.push([tx, ty]);
      const bs = api.boatSpot(api.newTower('dock', tx, ty, res.plan));
      const wp = window.waterPath(Math.floor(bs.x / 48), Math.floor(bs.y / 48), 130, 40000);
      if (wp) return { tx, ty, plan: res.plan, pathLen: wp.path.length, cache: wp.cache.id };
      if (tried.length > 30) return null;
    }
    return null;
  };
  window.centre = (rec) => ({ x: (rec.tx + 0.5) * T, y: (rec.ty + 0.5) * T });
};
await ev(installHelpers);
// the same helpers are needed after a reload
const installAgain = async (pg) => { await pg.evaluate(installHelpers); };

// ---- 1. build menu and placement ghost (spire)
const sp = await ev(() => window.findSpot('spire'));
check('a valid spire spot exists', !!sp, JSON.stringify(sp));
await ev((s) => { const g = window.game, p = g.state.player, T = 48; window.goTo((s.tx - 2.9) * T, (s.ty + 0.5) * T); g.pointerKind = 'key'; g.lastMove = { x: 1, y: 0 }; for (let i = 0; i < 4; i++) g.gameLoop(1); }, sp);
await page.keyboard.press('b');
await page.waitForSelector('.vs-build', { timeout: 4000 });
check('the build menu lists all seven structures', (await page.locator('.vs-build .vs-good').count()) === 7);
await page.locator('.vs-build .vs-good', { hasText: 'Arcane Spire' }).locator('button').click();
await page.waitForSelector('.vs-buildhud', { timeout: 3000 });
await ev(() => { const g = window.game; g.pointerKind = 'key'; g.state.pointerPosition = null; g.lastMove = { x: 1, y: 0 }; g.gameLoop(2); });
const ghost = await ev(() => { const b = window.game.towers.build; return b && { tx: b.tx, ty: b.ty, valid: b.valid, reason: b.reason }; });
check('the placement ghost sits ahead of the hero and is valid', ghost && ghost.valid && ghost.tx === sp.tx && ghost.ty === sp.ty, JSON.stringify(ghost));
check('the build HUD shows the green state', (await page.locator('.vs-buildhud.ok').count()) === 1);
// an invalid spot is refused with a reason
const refused = await ev(() => {
  const g = window.game, b = g.towers.build; if (!b) return null;
  const r = g.towers.check('spire', 0, 0);   // the starting area is protected
  return r;
});
check('building next to the start is refused with a reason', refused && !refused.ok && !!refused.reason, JSON.stringify(refused));
await page.keyboard.press('Enter');
await ev(() => window.game.gameLoop(2));
const laid = await ev(() => { const g = window.game; return { n: g.towers.recs.length, built: g.towers.recs[0] && g.towers.recs[0].built, mode: !!g.towers.build }; });
check('Enter lays a construction site and leaves build mode', laid.n === 1 && laid.built === false && !laid.mode, JSON.stringify(laid));

// ---- 2. staged delivery and completion
const staged = await ev(() => {
  const g = window.game, rec = g.towers.recs[0], c = window.centre(rec), p = g.state.player;
  window.goTo(c.x, c.y + 70); g.gameLoop(2); g.updateInteraction();
  const target = g.target && g.target.kind;
  const w = g.state.wallet; w.gold = 140; w.wood = 0; w.stone = 0; w.iron = 0;
  g.towers.deliver(rec);
  const half = { built: rec.built, progress: rec.delivered.gold };
  const stage = (window.__dev.towersApi.stageOf)(rec);
  return { target, half, stage };
});
check('the site is the interaction target', staged.target === 'site', JSON.stringify(staged));
check('partial delivery keeps it a construction site', staged.half.built === false && staged.half.progress === 140, JSON.stringify(staged));
await ev(() => { window.rich(); });
await ev(() => { const g = window.game; g.gameLoop(2); g.updateInteraction(); });
await page.keyboard.press('e');
await ev(() => window.game.gameLoop(3));
const done = await ev(() => { const g = window.game, rec = g.towers.recs[0]; return { built: rec.built, cer: !!g.towers.ceremony, wood: g.state.wallet.wood }; });
check('pressing E delivers the rest and completes the tower', done.built && done.cer && done.wood < 5000, JSON.stringify(done));

// ---- 3. spire fires an armed spell; heroes cannot use it meanwhile
const fire = await ev(() => {
  const g = window.game, rec = g.towers.recs[0], c = window.centre(rec);
  g.spells.addSpell('nova');
  const spare = g.spells.candidates ? null : null; void spare;
  const cand = g.towers.candidates();
  const uid = cand.length ? cand[cand.length - 1].uid : null;
  const armed = uid && g.towers.arm(rec.id, uid);
  g.spells.auto = []; g.spells.touch();                               // heroes cast nothing, so only the tower can hurt
  window.goTo(c.x, c.y + 360);
  const e = g.makeEnemy('GOLEM', c.x + 120, c.y + 40, { level: 3 });
  e.shell = 'idle'; e.home = { x: e.wx, y: e.wy }; e.leash = 9999; e.health = e.maxHealth = 800; e.untargetable = false; e.dormant = false;
  for (let i = 0; i < 480; i++) { g.gameLoop(1); if (e.dead) break; }
  return { uid, armed, held: !!(uid && g.spells.heldBy(uid)), lost: e.maxHealth - e.health, dead: !!e.dead, pos: [e.wx | 0, e.wy | 0], tower: [c.x | 0, c.y | 0], rings: g.spells.rings.length, timer: g.spells.timers['tw' + rec.id] };
});
check('the spire is armed with a spare spell and the spell is shown as held', fire.armed && fire.held, JSON.stringify(fire));
check('the armed spire damages enemies in range', fire.lost > 10 || fire.dead, JSON.stringify(fire));
const quiet = await ev(() => {
  const g = window.game, rec = g.towers.recs[0], c = window.centre(rec);
  g.towers.arm(rec.id, null);
  const e = g.makeEnemy('GOLEM', c.x + 120, c.y + 40, { level: 3 });
  e.shell = 'idle'; e.home = { x: e.wx, y: e.wy }; e.leash = 9999; e.health = e.maxHealth = 800; e.untargetable = false;
  for (let i = 0; i < 240; i++) g.gameLoop(1);
  const lost = e.maxHealth - e.health; e.dead = true; g.reap();
  return { lost, spell: rec.spell };
});
check('a disarmed spire stays quiet', quiet.lost === 0 && quiet.spell === null, JSON.stringify(quiet));

// ---- 4. ward: pushes enemies out and heals the hero
const wardSpot = await ev(() => window.findSpot('ward'));
check('a valid ward spot exists', !!wardSpot, JSON.stringify(wardSpot));
const ward = await ev((s) => {
  const g = window.game, rec = window.buildNow('ward', s), c = window.centre(rec), p = g.state.player;
  const { engage } = window.__dev;
  // the hero stands in the dome; a golem that is hunting them comes from outside
  window.goTo(c.x, c.y + 40);
  const e = g.makeEnemy('GOLEM', c.x + 620, c.y + 40, { level: 2 });
  e.health = e.maxHealth = 99999; e.untargetable = false; engage(g, e, false);
  let minToHero = 1e9, minToWard = 1e9;
  for (let i = 0; i < 900; i++) { g.gameLoop(1); minToHero = Math.min(minToHero, Math.hypot(e.wx - p.wx, e.wy - p.wy)); minToWard = Math.min(minToWard, Math.hypot(e.wx - c.x, e.wy - c.y)); p.wx = c.x; p.wy = c.y + 40; }
  e.dead = true; g.reap();
  // heal
  window.goTo(c.x + 120, c.y); g.godMode = false; g.state.maxHealth = 400; g.state.health = 50; g.party.commit && g.party.commit();
  const h0 = g.state.health; for (let i = 0; i < 360; i++) g.gameLoop(1); const h1 = g.state.health; g.godMode = true;
  return { minToHero: Math.round(minToHero), minToWard: Math.round(minToWard), h0, h1, built: rec.built };
}, wardSpot);
check('the ward dome keeps a hunting monster from reaching the hero', ward.built && ward.minToHero > 120, JSON.stringify(ward));
check('the ward heals the hero inside the dome', ward.h1 > ward.h0 + 5, JSON.stringify(ward));

// ---- 5. beacon reveals fog
const beaconSpot = await ev(() => window.findSpot('beacon', 30));
const beacon = await ev((s) => {
  const g = window.game;
  const probe = [];
  for (let k = 0; k < 10; k++) { const an = (k / 10) * Math.PI * 2; probe.push([Math.round(s.tx + Math.cos(an) * 34), Math.round(s.ty + Math.sin(an) * 34)]); }
  const dark = probe.filter(([x, y]) => !g.fog.isRevealed(x, y));
  window.buildNow('beacon', s);
  const lit = dark.filter(([x, y]) => g.fog.isRevealed(x, y));
  return { dark: dark.length, lit: lit.length };
}, beaconSpot);
check('building a beacon lights up a wide area of the map', beacon.dark >= 4 && beacon.lit === beacon.dark, JSON.stringify(beacon));

// ---- 6. waypoint travel
const wpA = await ev(() => window.findSpot('waypoint', 40));
const recA = await ev((s) => { const r = window.buildNow('waypoint', s); return { id: r.id, built: r.built }; }, wpA);
const wpB = await ev(() => window.findSpot('waypoint', 90));
const recB = await ev((s) => { const r = window.buildNow('waypoint', s); return { id: r.id, built: r.built }; }, wpB);
check('two waypoints are built', recA.built && recB.built && recA.id !== recB.id);
const trav = await ev(({ a, b }) => {
  const g = window.game, ra = g.towers.byId(a), c = window.centre(ra);
  window.goTo(c.x, c.y + 70); g.gameLoop(2); g.updateInteraction();
  const tgt = g.target && g.target.kind;
  window.rich(); const gold0 = g.state.wallet.gold;
  const ok = g.towers.travel(a, b);
  return { tgt, ok, gold0 };
}, { a: recA.id, b: recB.id });
await page.waitForFunction(() => !window.game.busy, null, { timeout: 8000 });
const arrived = await ev(({ b, gold0 }) => {
  const g = window.game, c = window.centre(g.towers.byId(b)), p = g.state.player;
  return { d: Math.hypot(p.wx - c.x, p.wy - c.y), paid: gold0 - g.state.wallet.gold };
}, { b: recB.id, gold0: trav.gold0 });
check('the waypoint is the interaction target', trav.tgt === 'tower', JSON.stringify(trav));
check('travelling between two waypoints is free and lands the hero at the other one', trav.ok && arrived.d < 160 && arrived.paid === 0, JSON.stringify(arrived));

// ---- 7. the Expedition Mine (kind 'climb') opens a plateau
const climbSpot = await ev(() => window.findSpot('climb', 20));
check('an Expedition Mine spot exists', !!climbSpot && !!climbSpot.plan, JSON.stringify(climbSpot));
const reach = (rec) => {
  // BFS over tile centres: can the hero walk from the foot of the tower onto the plateau (a free plateau tile)?
  const g = window.game, T = 48, { plateauCentre, DIRS } = window.__dev.towersApi, pc = plateauCentre(rec);
  const r = g.state.player.radius;
  const free = (tx, ty) => !g.world.blocked((tx + 0.5) * T, (ty + 0.5) * T, r);
  const start = [rec.tx - DIRS[rec.dir][0] * 2, rec.ty - DIRS[rec.dir][1] * 2];
  const seen = new Set([start.join()]); const q = [start]; let found = null;
  const box = { x0: Math.min(start[0], pc.tx) - 12, x1: Math.max(start[0], pc.tx) + 12, y0: Math.min(start[1], pc.ty) - 12, y1: Math.max(start[1], pc.ty) + 12 };
  while (q.length && !found) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || nx < box.x0 || nx > box.x1 || ny < box.y0 || ny > box.y1) continue;
      seen.add(k);
      if (!free(nx, ny)) continue;
      if (g.world.biomeAt(nx, ny) === 17 && Math.hypot(nx - rec.tx, ny - rec.ty) > 6) { found = [nx, ny]; break; }
      q.push([nx, ny]);
    }
  }
  return { found: !!found, at: found, centreBiome: g.world.biomeAt(pc.tx, pc.ty), plateauTiles: 0 };
};
await ev((s) => { window.climbReach = null; const g = window.game, { newTower } = window.__dev.towersApi; const rec = newTower('climb', s.tx, s.ty, s.plan); g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec); window.goTo((s.tx + 0.5) * 48, (s.ty + 0.5) * 48 + 150); window.__climbId = rec.id; }, climbSpot);
await ev((fnSrc) => { window.reachFn = new Function('return ' + fnSrc)(); }, reach.toString());
const climbBefore = await ev(() => window.reachFn(window.game.towers.byId(window.__climbId)));
await ev(() => { const g = window.game; window.rich(); g.towers.deliver(g.towers.byId(window.__climbId)); for (let i = 0; i < 4; i++) g.gameLoop(1); });
const climbAfter = await ev(() => window.reachFn(window.game.towers.byId(window.__climbId)));
check('the plateau is unreachable before the tower is built', !climbBefore.found && climbBefore.centreBiome !== 17, JSON.stringify(climbBefore));
check('the Expedition Mine opens a walkable path to the plateau', climbAfter.found && climbAfter.centreBiome === 17, JSON.stringify(climbAfter));

// ---- 8. bridge tower
const bridgeSpot = await ev(() => window.findSpot('bridge', 20));
check('a bridge tower spot exists', !!bridgeSpot && !!bridgeSpot.plan, JSON.stringify(bridgeSpot));
const br = await ev((s) => {
  const g = window.game, api = window.__dev.towersApi;
  const probe = api.newTower('bridge', s.tx, s.ty, s.plan);
  const tiles = api.towerEdits({ ...probe, built: true });
  const r = g.state.player.radius;
  const before = tiles.filter(([x, y]) => g.world.blocked((x + 0.5) * 48, (y + 0.5) * 48, r)).length;
  const rec = window.buildNow('bridge', s);
  window.goTo((s.tx + 0.5) * 48, (s.ty + 0.5) * 48 + 120);
  for (let i = 0; i < 4; i++) g.gameLoop(1);
  const after = tiles.filter(([x, y]) => !g.world.blocked((x + 0.5) * 48, (y + 0.5) * 48, r) && g.world.biomeAt(x, y) === 18).length;
  return { total: tiles.length, before, after, id: rec.id };
}, bridgeSpot);
check('the bridge turns blocked water into walkable planks', br.total > 3 && br.before > 0 && br.after === br.total, JSON.stringify(br));

// ---- 9. dock and boat
const dockSpot = await ev(() => window.findDockWithTreasure());
check('a dock whose boat can reach an island treasure exists', !!dockSpot, JSON.stringify(dockSpot));
const dock = await ev((s) => {
  const g = window.game, rec = window.buildNow('dock', s);
  const c = window.centre(rec);
  window.goTo(c.x, c.y + 70); for (let i = 0; i < 40; i++) g.gameLoop(1);
  return { id: rec.id, spot: g.session.boats[rec.id], hasBoat: g.sea.boats.has(rec.id), c };
}, dockSpot);
check('a finished dock moors a boat', !!dock.spot && dock.hasBoat, JSON.stringify(dock));
const board = await ev((d) => {
  const g = window.game, p = g.state.player, boat = g.sea.boats.get(d.id);
  p.wx = boat.x; p.wy = boat.y + 30; g.gameLoop(2); g.updateInteraction();
  const tgt = g.target && g.target.kind;
  return { tgt };
}, dock);
await page.keyboard.press('e');
await ev(() => window.game.gameLoop(2));
const aboard = await ev(() => ({ boat: !!window.game.boat, sailing: document.querySelector('.vs-sailing') !== null }));
check('the moored boat can be boarded', board.tgt === 'boat' && aboard.boat, JSON.stringify({ board, aboard }));

// sail along the water path to the nearest island treasure
const sail = await ev(async (d) => {
  const g = window.game, p = g.state.player, T = 48, api = window.__dev.towersApi;
  const wp = window.waterPath(Math.floor(p.wx / T), Math.floor(p.wy / T), 130, 40000);
  if (!wp) return { goal: null };
  const path = wp.path;
  const r0 = p.radius, deepTile = path.find(([x, y]) => g.world.biomeAt(x, y) === window.__dev.BIOME.DEEP && g.world.biomeAt(x + 1, y) === window.__dev.BIOME.DEEP && g.world.biomeAt(x - 1, y) === window.__dev.BIOME.DEEP);
  const deep = deepTile && { walk: g.world.blocked((deepTile[0] + 0.5) * T, (deepTile[1] + 0.5) * T, r0, false), boat: g.world.blocked((deepTile[0] + 0.5) * T, (deepTile[1] + 0.5) * T, r0, true) };
  const keys = g.state.keys; let seaSeen = 0, offWater = 0, travelled = 0, last = [p.wx, p.wy], wi = 1, frames = 0, stuck = 0;
  while (wi < path.length && frames++ < 30000) {
    const tx = (path[wi][0] + 0.5) * T, ty = (path[wi][1] + 0.5) * T;
    const dx = tx - p.wx, dy = ty - p.wy;
    keys.d = dx > 6; keys.a = dx < -6; keys.s = dy > 6; keys.w = dy < -6;
    g.gameLoop(1);
    if (Math.abs(p.wx - tx) < 14 && Math.abs(p.wy - ty) < 14) { wi++; stuck = 0; } else stuck++;
    if (stuck > 400) break;
    if ((frames & 15) === 0) {
      seaSeen = Math.max(seaSeen, g.state.enemies.filter((e) => e.seaSpawn && !e.dead).length);
      if (api.boatBlocked(g.world.biomeAtPos(p.wx, p.wy))) offWater++;
      travelled += Math.hypot(p.wx - last[0], p.wy - last[1]); last = [p.wx, p.wy];
    }
  }
  keys.d = keys.a = keys.s = keys.w = false;
  const r = p.radius;
  return { goal: path[path.length - 1], cache: wp.cache.id, len: path.length, frames, reached: wi >= path.length, travelled: Math.round(travelled), seaSeen, offWater, stuckAt: wi < path.length ? path[wi] : null, at: [Math.floor(p.wx / T), Math.floor(p.wy / T)], pos: [Math.round(p.wx), Math.round(p.wy)], why: wi < path.length ? { busy: g.busy, paused: g.state.paused, lvl: !!g.state.levelUp, boat: !!g.boat, bS: g.world.blocked(p.wx, p.wy + 10, r0, true), bN: g.world.blocked(p.wx, p.wy - 10, r0, true), bE: g.world.blocked(p.wx + 10, p.wy, r0, true), bW: g.world.blocked(p.wx - 10, p.wy, r0, true), here: g.world.blocked(p.wx, p.wy, r0, true), r0, solids: (() => { const out = [], cs = 48 * 12; for (let cy = Math.floor((p.wy - 200) / cs); cy <= Math.floor((p.wy + 200) / cs); cy++) for (let cx = Math.floor((p.wx - 200) / cs); cx <= Math.floor((p.wx + 200) / cs); cx++) for (const q of g.world.getChunk(cx, cy).solids) if (Math.hypot(q.x - p.wx, q.y - (p.wy + 10)) < q.r + 40) out.push([Math.round(q.x), Math.round(q.y), q.r, q.type]); return out; })(), biome: g.world.biomeAtPos(p.wx, p.wy), tgtBiome: g.world.biomeAt(path[wi][0], path[wi][1]) } : null, deep };
}, dock);
check('the boat sails across the water along a long path', sail.goal && sail.reached && sail.travelled > 300 && sail.offWater === 0, JSON.stringify(sail));
check('walking is blocked on deep water but the boat is not', sail.deep && sail.deep.walk === true && sail.deep.boat === false, JSON.stringify(sail.deep));
check('sea monsters appear while sailing', sail.seaSeen >= 1, String(sail.seaSeen));

// step ashore and open the island treasure
const shore = await ev(() => {
  const g = window.game, p = g.state.player;
  for (const e of [...g.state.enemies]) e.dead = true; g.reap();
  g.gameLoop(2); g.updateInteraction();
  const tgt = g.target && g.target.kind;
  const ok = g.sea.disembark();
  return { tgt, ok, boat: !!g.boat, hx: p.wx, hy: p.wy };
});
check('the hero can step ashore from the boat', shore.ok && !shore.boat, JSON.stringify(shore));
const loot = await ev((cacheId) => {
  const g = window.game, p = g.state.player, T = 48;
  const c = g.sea.known.get(cacheId) || g.sea.cachesNear(Math.floor(p.wx / T), Math.floor(p.wy / T), 12).find((x) => x.id === cacheId);
  if (!c) return { missing: true };
  const gx = (c.tx + 0.5) * T, gy = (c.ty + 0.5) * T;
  const free = g.world.findFree(gx - 36, gy + 24, p.radius + 2);
  p.wx = free.x; p.wy = free.y; g.world.update(p.wx, p.wy, 1200, 760, true);
  g.sea.timer = 0; for (let i = 0; i < 40; i++) g.gameLoop(1);
  g.updateInteraction();
  const tgt = g.target && g.target.kind;
  const items0 = g.spells.spells.length + g.spells.runes.length, gold0 = g.state.wallet.gold;
  g.interact();
  for (let i = 0; i < 120; i++) g.gameLoop(1);
  return { tgt, opened: g.sea.isOpened(cacheId), coins: g.state.gems.filter((x) => x.kind === 'coin').length, gold: g.state.wallet.gold - gold0, items: g.spells.spells.length + g.spells.runes.length - items0 };
}, sail.cache);
check('the island treasure can be opened and pays out', loot.tgt === 'cache' && loot.opened && (loot.coins > 0 || loot.gold > 0) && loot.items >= 1, JSON.stringify(loot));

// ---- 10. persistence
const before = await ev(() => {
  const g = window.game;
  g.sea.board([...g.sea.boats.keys()][0]);        // save while aboard
  return {
    towers: g.towers.serialize(), boat: g.session.boats, caches: g.session.caches,
    sailing: !!g.boat
  };
});
await ev(async () => { await window.game.requestSave('test', true); });
page = await h.newPage();
await page.goto(h.url);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1200);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
await installAgain(page);
await page.evaluate(() => { window.game.godMode = true; window.game.popRuntime.population = null; });
await page.evaluate(({ src }) => { window.reachFn = new Function('return ' + src)(); }, { src: reach.toString() });
const after = await page.evaluate(({ climbId, bridgeId, dockId, cacheId, beacon }) => {
  const g = window.game, api = window.__dev.towersApi;
  const out = { n: g.towers.recs.length, built: g.towers.recs.filter((r) => r.built).length };
  const climb = g.towers.byId(climbId);
  window.goTo((climb.tx + 0.5) * 48, (climb.ty + 0.5) * 48 + 150);
  out.climb = window.reachFn(climb);
  const br = g.towers.byId(bridgeId);
  window.goTo((br.tx + 0.5) * 48, (br.ty + 0.5) * 48 + 120);
  const tiles = api.towerEdits({ ...br, built: true });
  out.bridge = tiles.every(([x, y]) => g.world.biomeAt(x, y) === 18 && !g.world.blocked((x + 0.5) * 48, (y + 0.5) * 48, g.state.player.radius));
  out.beacon = g.fog.isRevealed(beacon.tx + 30, beacon.ty);
  out.cache = g.session.caches.includes(cacheId);
  out.boats = g.session.boats;
  out.sailing = !!g.boat;
  return out;
}, { climbId: before.towers.find((r) => r.kind === 'climb').id, bridgeId: before.towers.find((r) => r.kind === 'bridge').id, dockId: dock.id, cacheId: sail.cache, beacon: beaconSpot });
check('all towers survive a reload', after.n === before.towers.length && after.built === before.towers.filter((r) => r.built).length, JSON.stringify({ a: after.n, b: before.towers.length }));
check('the plateau opening survives a reload', after.climb.found && after.climb.centreBiome === 17, JSON.stringify(after.climb));
check('the bridge survives a reload', after.bridge);
check('the beacon-revealed fog survives a reload', after.beacon);
check('the opened island treasure stays opened', after.cache);
check('the boat and the sailing state survive a reload', after.sailing && JSON.stringify(after.boats) === JSON.stringify(before.boat), JSON.stringify({ after: after.boats, before: before.boat }));

await h.finish();
