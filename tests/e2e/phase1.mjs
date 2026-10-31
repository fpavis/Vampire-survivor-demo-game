// Phase 1 end-to-end checks: resident camps, enemy sight and leash, persistence across reloads, respawn.
import { suite } from './harness.mjs';

const h = await suite('phase1', { viewport: { width: 1100, height: 650 } });
const { check } = h;
let page = await h.newPage();
await page.goto(h.url);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
// keep the level-up pause (a deliberate game feature) from freezing the simulation mid-test
await page.evaluate(() => { window.game.state.nextLevel = 1e12; });

// ---- 1. camps near a spot a few chunks from the start exist and are idle until the hero comes into sight
// (a camp beyond the spawn range of the start: a nearer one may already have seen the hero before the test began)
const camp = await page.evaluate(() => {
  const g = window.game, pop = g.popRuntime.population;
  for (let r = 4; r < 12; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
    if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
    for (const c of pop.campsForChunk(cx, cy)) if (!c.lair && c.members.length >= 2) return c;
  }
  return null;
});
check('a camp exists near the start', !!camp, camp ? `${camp.id} lvl ${camp.level}` : '');

const idleState = await page.evaluate((c) => {
  const g = window.game, p = g.state.player;
  p.wx = c.x + 1500; p.wy = c.y; g.cam.x = p.wx; g.cam.y = p.wy; g.state.health = g.state.maxHealth = 1e9;
  for (let i = 0; i < 90; i++) g.gameLoop(1);
  const members = g.state.enemies.filter((e) => e.campId === c.id);
  return { spawned: members.length, idle: members.every((e) => e.shell === 'idle'), levelOk: members.every((e) => e.level === c.level) };
}, camp);
check('camp spawns when the hero is within about 3 chunks', idleState.spawned === camp.members.length, JSON.stringify(idleState));
check('camp monsters are idle and carry the zone level', idleState.idle && idleState.levelOk);

const sight = await page.evaluate((c) => {
  const g = window.game, p = g.state.player;
  const e = g.state.enemies.find((x) => x.campId === c.id);
  const sightRange = e.perc.sight;
  const maxSight = Math.max(...g.state.enemies.filter((x) => x.campId === c.id).map((x) => x.perc.sight));
  // well outside sight of every member (members wander up to ~220 units from home): stay idle
  p.wx = c.x + maxSight + 420; p.wy = c.y; for (let i = 0; i < 60; i++) g.gameLoop(1);
  const outside = g.state.enemies.filter((x) => x.campId === c.id).every((x) => x.shell === 'idle');
  // inside sight: notice
  p.wx = e.wx + Math.min(sightRange * 0.4, 140); p.wy = e.wy; for (let i = 0; i < 40; i++) g.gameLoop(1);
  const inside = g.state.enemies.filter((x) => x.campId === c.id).some((x) => x.shell === 'engaged');
  return { outside, inside, sightRange };
}, camp);
check('monsters ignore a hero outside their sight range', sight.outside);
check('monsters notice a hero inside their sight range', sight.inside);

const leash = await page.evaluate((c) => {
  const g = window.game, p = g.state.player;
  // make this camp's members hunt the hero, then run far away
  const mine = g.state.enemies.filter((x) => x.campId === c.id);
  p.wx = c.x + 100; p.wy = c.y; for (let i = 0; i < 30; i++) g.gameLoop(1);
  const engagedBefore = mine.filter((x) => x.shell === 'engaged').length;
  const uids = new Set(mine.map((x) => x.uid));
  p.wx = c.x + 2600; p.wy = c.y;
  for (let i = 0; i < 900; i++) g.gameLoop(1);
  const stillChasing = g.state.enemies.filter((x) => uids.has(x.uid) && !x.dead && x.shell === 'engaged').length;
  return { engagedBefore, stillChasing };
}, camp);
check('monsters do not follow a hero who leaves their territory', leash.engagedBefore > 0 && leash.stillChasing === 0, JSON.stringify(leash));

// ---- 2. clearing a camp is remembered
const cleared = await page.evaluate((c) => {
  const g = window.game, p = g.state.player;
  p.wx = c.x + 200; p.wy = c.y; g.cam.x = p.wx; g.cam.y = p.wy;
  for (let i = 0; i < 60; i++) g.gameLoop(1);
  for (const e of g.state.enemies.filter((x) => x.campId === c.id)) { e.untargetable = false; g.damageEnemy(e, 1e9, { noCrit: true }); }
  g.gameLoop(1);
  return { flagged: g.session.clearedCamps[c.id] !== undefined, left: g.state.enemies.filter((x) => x.campId === c.id && !x.dead).length, active: g.popRuntime.active.has(c.id), total: g.state.enemies.filter((x) => x.campId === c.id).length, expected: c.members.length };
}, camp);
check('a cleared camp is recorded', cleared.flagged && cleared.left === 0, JSON.stringify(cleared));
const stays = await page.evaluate((c) => {
  const g = window.game, p = g.state.player;
  p.wx = c.x + 3000; for (let i = 0; i < 60; i++) g.gameLoop(1);
  p.wx = c.x + 100; for (let i = 0; i < 80; i++) g.gameLoop(1);
  return g.state.enemies.filter((x) => x.campId === c.id && !x.dead).length;
}, camp);
check('a cleared camp stays empty when you return', stays === 0);

// ---- 3. zone level rises with distance and enemies carry it
const levels = await page.evaluate(() => {
  const g = window.game, src = g.overworld, out = {};
  for (const d of [60, 600, 1500]) out[d] = src.levelAt(d, 0);
  return out;
});
check('zone level rises with distance', levels[60] === 1 && levels[600] > levels[60] && levels[1500] > levels[600], JSON.stringify(levels));

// ---- 4. persistence: write a recognisable state, save, reload the page, continue
const before = await page.evaluate(async () => {
  const g = window.game;
  g.state.level = 9; g.state.experience = 7; g.state.nextLevel = 150; g.state.picks = { might: 2 };
  g.spells.addSpell('nova');
  g.state.kills = 321; g.state.time = 777;
  const spot = g.world.findFree(5000, -3200, 14);
  g.state.player.wx = spot.x; g.state.player.wy = spot.y; g.lastFogTx = null;
  g.updateFog();
  const out = { px: Math.round(spot.x), py: Math.round(spot.y), seed: g.overworld.seed, fogTiles: g.fog.revealedTileCount(), cleared: Object.keys(g.session.clearedCamps).length };
  await g.requestSave('test', true);
  return out;
});
page = await h.newPage();
await page.goto(h.url);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1200);
await page.keyboard.press('Enter');     // Continue
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
const after = await page.evaluate(() => {
  const g = window.game;
  return {
    seed: g.overworld.seed, fogTiles: g.fog.revealedTileCount(), cleared: Object.keys(g.session.clearedCamps).length,
    level: g.state.level, kills: g.state.kills, time: Math.round(g.state.time), might: g.state.picks.might,
    nova: g.spells.level('nova'), x: Math.round(g.state.player.wx), y: Math.round(g.state.player.wy)
  };
});
check('same world seed after reload', after.seed === before.seed);
check('hero progress restored', after.level === 9 && after.kills === 321 && after.might === 2 && after.nova === 1, JSON.stringify(after));
check('fog of war restored', after.fogTiles >= before.fogTiles, `${before.fogTiles} -> ${after.fogTiles}`);
check('cleared camps restored', after.cleared === before.cleared);
check('position restored near where we saved', Math.abs(after.x - before.px) < 120 && Math.abs(after.y - before.py) < 120, `${before.px},${before.py} -> ${after.x},${after.y}`);

// ---- 5. death and respawn keep the world
const respawn = await page.evaluate(async () => {
  const g = window.game;
  g.session.cities.push({ id: 'far', name: 'Fartown', ex: 90000, ey: 90000 });
  g.session.cities.push({ id: 't', name: 'Testtown', ex: 400, ey: 400 });
  g.session.lastCity = 't';
  for (let i = 0; i < 3; i++) { g.state.health = 0; g.step(1); }
  const died = g.state.gameOver;
  const target = g.respawnTarget();
  g.respawn(target);
  await new Promise((r) => setTimeout(r, 300));
  // the respawn waits for a fade that advances per frame, so step frames rather than wall time (slow machines)
  for (let i = 0; i < 80 && (g.state.gameOver || g.busy); i++) g.gameLoop(1);
  for (let i = 0; i < 10; i++) g.gameLoop(1);
  return { died, label: target.label, alive: g.state.health > 0 && !g.state.gameOver, near: Math.hypot(g.state.player.wx - 400, g.state.player.wy - 440) < 200 };
});
check('party death shows the death flow', respawn.died);
check('respawns at the last visited town with the party revived', respawn.alive && respawn.near && respawn.label === 'Testtown', JSON.stringify(respawn));

await h.finish();
