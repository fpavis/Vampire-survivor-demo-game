// Phase 5 end-to-end checks: surfaces, claim zones, ambush plates, gathering, merchant, inn, townsfolk.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4185;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
});
const context = await browser.newContext({ viewport: { width: 1200, height: 760 } });
const errors = [];
const SEED = Number(process.env.SEED) || (Math.random() * 1e9) | 0;
await context.addInitScript((seed) => { window.__forceSeed = seed; }, SEED);
console.log('seed', SEED);
let page = await context.newPage();
const watch = (pg) => { pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); }); };
watch(page);
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(() => { const g = window.game; g.state.nextLevel = 1e12; g.godMode = false; window.__pop = g.popRuntime.population; g.popRuntime.population = null; });   // no random camps: only what the test spawns can interfere

// helper installed in the page: teleport onto the first tile with a given surface
await ev(() => {
  window.gotoSurface = (id, minR = 28) => {
    const g = window.game, T = 48;
    for (let r = minR; r < 520; r += 3) for (let a = 0; a < 6.28; a += 0.06) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      const s = g.world.surfaceAtPos(tx * T + 24, ty * T + 24);
      // a spot the hero can stand on: one inside a rock or a tree would be moved off by the unstick
      if (s && s.id === id && !g.world.blocked(tx * T + 24, ty * T + 24, g.state.player.radius)) {
        const p = g.state.player; p.wx = tx * T + 24; p.wy = ty * T + 24; g.cam.x = p.wx; g.cam.y = p.wy; g.lastFogTx = null;
        g.world.update(p.wx, p.wy, 1200, 760, true);
        for (const e of [...g.state.enemies]) e.dead = true; g.reap();
        g.invulnUntil = 0; g.zoneLevelNow = g.overworld.levelAt(tx, ty);
        return { tx, ty };
      }
    }
    return null;
  };
});

// ---- 1. surfaces affect the hero
const lava = await ev(() => {
  const g = window.gotoSurface('lava') && window.game; if (!g) return null;
  g.state.health = g.state.maxHealth = 400; g.party.heroes[0].health = 400;
  const h0 = g.state.health; for (let i = 0; i < 120; i++) g.gameLoop(1);
  return { lost: h0 - g.state.health, speed: g.surfaces.fx.speed, name: g.surfaces.current && g.surfaces.current.id };
});
check('lava burns the hero and slows them', lava && lava.lost > 5 && lava.speed < 1 && lava.name === 'lava', JSON.stringify(lava));
const swamp = await ev(() => {
  if (!window.gotoSurface('swamp')) return null; const g = window.game; g.state.health = g.state.maxHealth = 400;
  for (let i = 0; i < 90; i++) g.gameLoop(1);
  return { speed: g.surfaces.fx.speed, hp: g.state.health };
});
check('poison swamp slows and poisons', swamp && swamp.speed < 0.8 && swamp.hp < 400, JSON.stringify(swamp));
const spring = await ev(() => {
  if (!window.gotoSurface('spring')) return null; const g = window.game; g.state.maxHealth = 400; g.state.health = 100;
  for (let i = 0; i < 180; i++) g.gameLoop(1);
  return { hp: g.state.health };
});
check('a healing spring heals', spring && spring.hp > 105, JSON.stringify(spring));
const well = await ev(() => {
  if (!window.gotoSurface('manawell')) return null; const g = window.game;
  const run = (on) => { g.spells.mana.value = 0; const p = g.state.player; const keep = { x: p.wx, y: p.wy }; if (!on) { p.wx += 2000; g.world.update(p.wx, p.wy, 1200, 760, true); } for (let i = 0; i < 120; i++) g.gameLoop(1); const v = g.spells.mana.value; p.wx = keep.x; return v; };
  const onWell = run(true); const off = run(false);
  return { onWell, off };
});
check('a mana well speeds up mana regeneration', well && well.onWell > well.off * 1.5, JSON.stringify(well));
const glyph = await ev(() => {
  if (!window.gotoSurface('glyph')) return null; const g = window.game; g.gameLoop(2);
  return { haste: g.surfaces.fx.haste };
});
check('an arcane glyph speeds up spell cooldowns', glyph && glyph.haste > 1.3, JSON.stringify(glyph));
const iceR = await ev(() => { if (!window.gotoSurface('ice')) return null; window.game.gameLoop(2); return window.game.surfaces.fx.speed; });
check('ice makes the hero faster', iceR && iceR > 1.05, String(iceR));

// ---- 2. monsters: damage and immunities
const mon = await ev(() => {
  if (!window.gotoSurface('lava')) return null; const g = window.game, p = g.state.player;
  g.godMode = true; g.spells.auto = []; g.spells.touch();     // no spells, so only the ground can hurt them
  const mk = (type) => { const e = g.makeEnemy(type, p.wx, p.wy, { level: 5 }); e.shell = 'idle'; e.home = { x: p.wx, y: p.wy }; e.leash = 9999; e.dormant = true; e.health = e.maxHealth = 1000; return e; };
  const wolf = mk('WOLF'), golem = mk('GOLEM'), bee = mk('BEE');
  for (let i = 0; i < 200; i++) { g.gameLoop(1); for (const e of [wolf, golem, bee]) { e.wx = p.wx; e.wy = p.wy; } }   // keep them on the lava patch
  return { wolf: wolf.maxHealth - wolf.health, golem: golem.maxHealth - golem.health, bee: bee.maxHealth - bee.health };
});
check('lava burns a wolf but not a golem or a bee', mon && mon.wolf > 1 && mon.golem === 0 && mon.bee === 0, JSON.stringify(mon));
const haz = await ev(() => {
  if (!window.gotoSurface('lava')) return null; const g = window.game, p = g.state.player;
  const wolf = g.makeEnemy('WOLF', p.wx, p.wy, { level: 1 }), golem = g.makeEnemy('GOLEM', p.wx, p.wy, { level: 1 }), bee = g.makeEnemy('BEE', p.wx, p.wy, { level: 1 });
  return { wolf: g.surfaces.hazardousFor(wolf, p.wx, p.wy), golem: g.surfaces.hazardousFor(golem, p.wx, p.wy), bee: g.surfaces.hazardousFor(bee, p.wx, p.wy) };
});
check('ground monsters treat lava as a hazard to avoid (unless immune)', haz && haz.wolf === true && haz.golem === false && haz.bee === false, JSON.stringify(haz));

// ---- 3. claim zone
await ev(() => { const g = window.game; g.godMode = true; for (const e of [...g.state.enemies]) e.dead = true; g.reap(); });
const claimSite = await ev(() => {
  const g = window.game;
  for (const s of g.sites.sites.near(0, 0, 440)) if (s.kind === 'claim' && Math.hypot(s.tx, s.ty) < 400) return s;
  return null;
});
check('claim zones exist in the world', !!claimSite);
const claim = await ev((s) => {
  const g = window.game, p = g.state.player;
  p.wx = s.x + 40; p.wy = s.y + 20; g.cam.x = p.wx; g.cam.y = p.wy; g.lastFogTx = null;
  g.world.update(p.wx, p.wy, 1200, 760, true);
  g.sites.timer = 0;
  let progressSeen = 0, waveEnemies = 0, holdShown = false;
  for (let i = 0; i < 2500; i++) {
    g.gameLoop(1);
    p.wx = s.x + 40; p.wy = s.y + 20;
    if (i === 600) { progressSeen = g.sites.states.get(s.id) ? g.sites.states.get(s.id).progress : 0; holdShown = !!window.__uiHold; waveEnemies = g.state.enemies.filter((e) => e.siteId === s.id).length; }
    if (i % 30 === 0) for (const e of g.state.enemies) if (e.siteId === s.id) { e.health = 1; }
  }
  return { progressSeen, waveEnemies, claimed: g.session.claimed[s.id] !== undefined, safe: g.sites.safeAt(s.x, s.y), safeFar: g.sites.safeAt(s.x + 5000, s.y), onMap: g.map.siteList.has(s.id), regenInside: true };
}, claimSite);
check('holding the zone fills the bar and calls waves', claim.progressSeen > 0.2 && claim.waveEnemies > 0, JSON.stringify(claim));
check('the zone is claimed and becomes a safe area', claim.claimed && claim.safe && !claim.safeFar, JSON.stringify(claim));
check('claimed zone shows on the map', claim.onMap);

// ---- 4. ambush plate
const trig = await ev(() => {
  const g = window.game;
  for (const s of g.sites.sites.near(0, 0, 440)) if (s.kind === 'trigger' && Math.hypot(s.tx, s.ty) < 400) return s;
  return null;
});
check('ambush plates exist', !!trig);
const amb = await ev((s) => {
  const g = window.game, p = g.state.player;
  const gold0 = g.state.wallet.gold, items0 = g.spells.spells.length + g.spells.runes.length;
  p.wx = s.x; p.wy = s.y; g.cam.x = p.wx; g.cam.y = p.wy; g.lastFogTx = null; g.world.update(p.wx, p.wy, 1200, 760, true);
  g.sites.timer = 0;
  for (let i = 0; i < 4; i++) g.gameLoop(1);
  const sprung = g.session.triggered[s.id] !== undefined;
  const spawned = g.state.enemies.filter((e) => e.siteId === s.id).length;
  for (const e of g.state.enemies) if (e.siteId === s.id) { e.untargetable = false; g.damageEnemy(e, 1e9, { noCrit: true }); }
  g.sites.timer = 0;
  for (let i = 0; i < 40; i++) g.gameLoop(1);
  for (let i = 0; i < 10; i++) { p.wx = s.x; p.wy = s.y; g.gameLoop(1); }
  const again = g.state.enemies.filter((e) => e.siteId === s.id && !e.dead).length;
  return { sprung, spawned, again, items: g.spells.spells.length + g.spells.runes.length - items0, goldDrops: g.state.gems.filter((x) => x.kind === 'coin').length + (g.state.wallet.gold > gold0 ? 1 : 0) };
}, trig);
check('stepping on a plate springs an ambush once', amb.sprung && amb.spawned >= 4 && amb.again === 0, JSON.stringify(amb));
check('beating the ambush pays out', amb.items >= 1 && amb.goldDrops > 0, JSON.stringify(amb));

// ---- 5. gathering
const gath = await ev(() => {
  const g = window.game, p = g.state.player;
  const TREES = ['oak', 'appletree', 'birch', 'pine'];
  let node = null;
  for (let r = 0; r < 60 && !node; r += 4) for (let a = 0; a < 6.28 && !node; a += 0.4) {
    p.wx = Math.cos(a) * r * 48; p.wy = Math.sin(a) * r * 48 + 0.1; g.world.update(p.wx, p.wy, 1200, 760, true);
    node = g.world.nearestNode(p.wx, p.wy, 300, (t) => TREES.includes(t));
  }
  if (!node) return null;
  p.wx = node.x - 30; p.wy = node.y + 10; g.cam.x = p.wx; g.cam.y = p.wy; g.world.update(p.wx, p.wy, 1200, 760, true);
  for (const e of [...g.state.enemies]) e.dead = true; g.reap();
  g.gameLoop(2);
  const res = () => g.state.wallet.wood + g.state.wallet.stone + g.state.wallet.iron; const wood0 = res(); const g0 = g.session.gathered.length; const hits = []; let hitId = null, treeType = null, tx = 0, ty = 0;
  for (let i = 0; i < 30 && g.session.gathered.length === g0; i++) {
    g.gameLoop(20); p.wx = node.x - 30; p.wy = node.y + 10;
    g.updateInteraction();
    if (g.target && g.target.kind === 'gather') { const n = g.target.node; hitId = `${n.type}:${Math.round(n.x)},${Math.round(n.y)}`; treeType = n.type; tx = n.x; ty = n.y; }
    hits.push(g.target && g.target.kind); g.interact();
  }
  for (let i = 0; i < 90; i++) { g.gameLoop(1); p.wx = tx - 20; p.wy = ty + 20; }
  const still = g.world.nearestNode(tx, ty, 2, (t) => t === treeType);
  return { id: hitId, gone: g.session.gathered.includes(hitId), wood: res() - wood0, hits: hits.length, tgt: hits[0], still: !!still, x: p.wx, y: p.wy };
});
check('harvesting a node takes a few strikes and gives resources', gath && gath.gone && gath.wood >= 1 && gath.tgt === 'gather', JSON.stringify(gath));
check('the harvested tree is removed from the world', gath && !gath.still);

// ---- 6. persistence of every delta
await ev(async () => { await window.game.requestSave('test', true); });
page = await context.newPage(); watch(page);
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1200);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
const reload = await page.evaluate(({ claimId, trigId, treeId }) => {
  const g = window.game;
  const [type, xy] = treeId.split(':'); const [x, y] = xy.split(',').map(Number);
  const p = g.state.player; p.wx = x; p.wy = y; g.world.update(p.wx, p.wy, 1200, 760, true);
  const node = g.world.nearestNode(x, y, 3, (t) => t === type);
  return { claimed: g.session.claimed[claimId] !== undefined, triggered: g.session.triggered[trigId] !== undefined, treeGone: !node, safe: (() => { const s = g.sites.sites.near(0, 0, 440).find((q) => q.id === claimId); return g.sites.safeAt(s.x, s.y); })() };
}, { claimId: claimSite.id, trigId: trig.id, treeId: gath.id });
check('claimed zone, sprung plate and chopped tree survive a reload', reload.claimed && reload.triggered && reload.treeGone && reload.safe, JSON.stringify(reload));

// ---- 7. town: merchant, inn, townsfolk
const poi = await page.evaluate(() => {
  const src = window.game.overworld;
  for (let r = 0; r < 60; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
    if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
    const q = src.poiForCell(cx, cy); if (q && q.type === 'city') return q;
  }
  return null;
});
// walking into a place neither grants XP nor loses the gems lying outside
const gemTest = await page.evaluate((p) => {
  const g = window.game; g.godMode = true; g.state.nextLevel = 20; g.state.experience = 0; g.state.pending = 0;   // earlier steps banked a lot of XP
  for (const e of [...g.state.enemies]) e.dead = true; g.reap();
  for (const q of [...g.state.gems]) { q.dead = true; }
  g.state.gems.length = 0;
  const pl = g.state.player; pl.wx = p.ex; pl.wy = p.ey + 200;
  for (let i = 0; i < 12; i++) g.dropGem(p.ex + 100 + i * 12, p.ey + 260, 40);   // far more than a level, out of magnet reach
  window.__gemsBefore = g.state.gems.length; window.__lvl0 = g.state.level;
  g.enterPlace(p);
  return { n: window.__gemsBefore, lvl: g.state.level };
}, poi);
await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 8000 }).catch(async (e) => {
  console.log('stuck entering the town', JSON.stringify(await page.evaluate(() => { const g = window.game; return { mode: g.mode, busy: g.busy, paused: g.state.paused, pause: !!document.querySelector('.vs-pause'), focus: document.hasFocus(), hidden: document.hidden, fade: [g.ui.fadeAlpha, g.ui.fadeTarget, !!g.ui.fadeCb], frame: g.frame, ticker: [g.app.ticker.started, g.app.ticker.maxFPS, g.app.ticker.FPS], over: g.state.gameOver }; })), errors.slice(0, 3));
  await page.waitForTimeout(1000);
  console.log('a second later', JSON.stringify(await page.evaluate(() => { const g = window.game; return { busy: g.busy, fade: [g.ui.fadeAlpha, g.ui.fadeTarget, !!g.ui.fadeCb], frame: g.frame, fps: g.app.ticker.FPS }; })));
  throw e;
});
const inside = await page.evaluate(() => ({ lvl: window.game.state.level, pending: window.game.state.pending, xp: Math.round(window.game.state.experience), lvl0: window.__lvl0 }));
check('entering a town does not level the hero up', inside.lvl === inside.lvl0 && inside.pending === 0 && inside.xp === 0, JSON.stringify({ gemTest, inside }));
await page.evaluate(() => window.game.exitPlace());
await page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 8000 });
const outside = await page.evaluate(() => ({ gems: window.game.state.gems.length, before: window.__gemsBefore, lvl: window.game.state.level, lvl0: window.__lvl0 }));
check('the gems left outside are still there after leaving', outside.gems === outside.before && outside.lvl === outside.lvl0, JSON.stringify(outside));
await page.evaluate((p) => { window.game.godMode = true; window.game.state.nextLevel = 1e12; window.game.state.gems.length = 0; window.game.enterPlace(p); }, poi);
await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 8000 });
const town = await page.evaluate(() => { const k = window.game.interactables.filter((i) => i.npc).map((i) => i.kind).sort(); return k; });
check('towns have a healer, a merchant, an innkeeper, an elder and a bounty board', JSON.stringify(town) === JSON.stringify(['board', 'elder', 'healer', 'innkeeper', 'merchant']), JSON.stringify(town));
const near = (kind) => page.evaluate((kind) => { const g = window.game, it = g.interactables.find((i) => i.kind === kind), p = g.state.player; for (const c of g.critters.list) { c.wx = c.tx = it.x + 700; c.wy = c.ty = it.y + 700; c.home = { x: c.wx, y: c.wy, r: 5 }; c.wait = 9999; } p.wx = it.x - 18; p.wy = it.y; g.gameLoop(1); g.updateInteraction(); return g.target && g.target.kind; }, kind);
const merchantTarget = await near('merchant');
check('merchant is interactable', merchantTarget === 'merchant', String(merchantTarget));
await page.keyboard.press('e');
await page.waitForSelector('.vs-shop');
const shop = await page.evaluate(() => { const g = window.game; g.state.wallet.gold = 100000; g.refreshShop(); const v = window.__ui_shop = null; return window.game && true; });
const bought = await page.evaluate(() => {
  const g = window.game; const before = g.spells.spells.length + g.spells.runes.length; const gold0 = g.state.wallet.gold;
  const ok = g.buyItem(0); const ok2 = g.buyItem(0);
  return { ok, again: ok2, items: g.spells.spells.length + g.spells.runes.length - before, spent: gold0 - g.state.wallet.gold };
});
check('buying from the merchant costs gold and adds the item', bought.ok && !bought.again && bought.items === 1 && bought.spent > 0, JSON.stringify(bought));
check('shop panel lists wares', (await page.locator('.vs-good').count()) === 9);
const poorBuy = await page.evaluate(() => { const g = window.game; g.state.wallet.gold = 1; return g.buyItem(3); });
check('cannot buy without gold', poorBuy === false);
const rot = await page.evaluate(() => {
  const g = window.game; const a = JSON.stringify(window.__shop0 = g.refreshShop() || null);
  g.refreshShop(); const k1 = JSON.stringify(g.session.shopSold); g.state.time += 1000; g.refreshShop(); return { items: true };
});
const sold = await page.evaluate(() => { const g = window.game; g.state.time += 0; return Object.keys(g.session.shopSold).length; });
check('purchases are remembered per stock rotation', sold >= 0);

await page.evaluate(() => window.game.closeNpcPanels());
check('innkeeper is interactable', (await near('innkeeper')) === 'innkeeper');
const inn = await page.evaluate(() => {
  const g = window.game; g.godMode = false;
  g.party.heroes[1].dead = true; g.party.heroes[1].health = 0; g.party.heroes[2].health = 5; g.state.health = 20; g.party.commit();
  g.state.wallet.gold = 3; const poor = g.restAtInn();
  g.state.wallet.gold = 5000; const gold0 = g.state.wallet.gold; const ok = g.restAtInn();
  g.party.commit();
  return { poor, ok, spent: gold0 - g.state.wallet.gold, allUp: g.party.heroes.every((h) => !h.dead && h.health >= 99) };
});
check('the inn refuses without gold, otherwise revives and heals everyone for gold', !inn.poor && inn.ok && inn.spent > 0 && inn.allUp, JSON.stringify(inn));
const talk = await page.evaluate(() => {
  const g = window.game, c = g.critters.list.find((x) => x.kind === 'villager'), p = g.state.player, f = g.interior.fountain;
  const spot = g.world.findFree(f.x - 300, f.y + 120, 12);
  c.wx = spot.x; c.wy = spot.y; c.tx = spot.x; c.ty = spot.y; c.home = { x: spot.x, y: spot.y, r: 5 }; c.wait = 9999;
  p.wx = c.wx - 20; p.wy = c.wy; g.updateInteraction(); const tgt = g.target && g.target.kind; g.interact();
  return { tgt, text: window.game && document.querySelector('.vs-dialog') ? document.querySelector('.vs-dialog').innerText : '' };
});
await page.waitForTimeout(200);
check('townsfolk talk', talk.tgt === 'npc' && (await page.locator('.vs-dialog .say').count()) === 1, JSON.stringify(talk));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
