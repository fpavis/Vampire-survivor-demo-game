// Phase 4 end-to-end checks: party of three, switching, bench auras, death rules, healer, persistence.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4184;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
});
const context = await browser.newContext({ viewport: { width: 1200, height: 760 } });
const errors = [];
let page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---- 1. roster
const roster = await ev(() => {
  const g = window.game, tpl = (u) => g.spells.item(u).tpl;
  return g.party.heroes.map((h) => ({ id: h.id, auto: h.auto.map(tpl), active: h.active.filter(Boolean).map(tpl) }));
});
check('party has three heroes with different starting loadouts', roster.length === 3 && new Set(roster.map((r) => r.auto[0])).size === 3, JSON.stringify(roster));
check('party bar shows three portraits', (await page.locator('.vs-hero').count()) === 3);

// ---- 2. switching
await ev(() => { const g = window.game; g.godMode = false; g.state.nextLevel = 1e12; });
const sw = await ev(() => {
  const g = window.game;
  const before = { auto: g.spells.auto.map((u) => g.spells.item(u).tpl), look: g.state.player.heroId };
  const ok = g.party.switchTo(1);
  const after = { auto: g.spells.auto.map((u) => g.spells.item(u).tpl), look: g.state.player.heroId, active: g.party.active };
  const again = g.party.switchTo(2);                 // cooldown
  return { ok, again, before, after };
});
check('switching changes the loadout and look', sw.ok && sw.after.active === 1 && sw.after.auto[0] === 'orbit' && sw.before.auto[0] === 'bolt' && sw.before.look === 'aria' && sw.after.look === 'brann', JSON.stringify(sw));
check('switching has a cooldown', sw.again === false);
await ev(() => { for (let i = 0; i < 200; i++) window.game.gameLoop(1); });
await page.keyboard.press('3');
check('number keys switch heroes', (await ev(() => window.game.party.active)) === 2);
await ev(() => { for (let i = 0; i < 200; i++) window.game.gameLoop(1); });
await page.keyboard.press('Tab');
check('Tab cycles heroes', (await ev(() => window.game.party.active)) === 0);

// ---- 3. only the active hero takes damage
const dmg = await ev(() => {
  const g = window.game;
  g.invulnUntil = 0; g.spells.barrierUntil = 0;
  const hp0 = g.party.heroes.map((h) => h.health);
  g.hurtPlayer(30);
  g.party.commit();
  return { before: hp0, after: g.party.heroes.map((h) => h.health) };
});
check('only the active hero is damaged', dmg.after[0] < dmg.before[0] && dmg.after[1] === dmg.before[1] && dmg.after[2] === dmg.before[2], JSON.stringify(dmg));

// ---- 4. bench aura, regen and shared xp
const bench = await ev(() => {
  const g = window.game;
  const base = g.stats.might;
  g.party.heroes[1].picks = { might: 4 };
  g.recalcStats();
  const boosted = g.stats.might;
  g.party.heroes[2].dead = true; g.recalcStats();
  const noDead = g.stats.might;
  g.party.heroes[2].dead = false; g.recalcStats();
  const hp = g.party.heroes[1].health = 20;
  const xp0 = g.party.heroes[1].experience;
  g.addXp(100);
  for (let i = 0; i < 300; i++) g.gameLoop(1);
  return { base, boosted, noDead, regen: g.party.heroes[1].health > hp, xp: g.party.heroes[1].experience > xp0 || g.party.heroes[1].level > 1 };
});
check('bench hero aura boosts the active hero', bench.boosted > bench.base, JSON.stringify(bench));
check('bench regenerates and earns xp', bench.regen && bench.xp);

// ---- 5. hero death: next hero steps in, dead heroes locked
const down = await ev(() => {
  const g = window.game;
  g.state.health = 0; g.step(1);
  const h = g.party.heroes;
  return { dead: h.map((x) => x.dead), active: g.party.active, over: g.state.gameOver };
});
check('fallen hero is replaced by the next hero', down.dead[0] === true && down.active !== 0 && !down.over, JSON.stringify(down));
await ev(() => { for (let i = 0; i < 200; i++) window.game.gameLoop(1); });
check('a dead hero cannot be switched to', (await ev(() => window.game.party.switchTo(0))) === false);

// ---- 6. healer in a town
const poi = await ev(() => {
  const src = window.game.overworld;
  for (let r = 0; r < 60; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
    if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
    const p = src.poiForCell(cx, cy);
    if (p && p.type === 'city') return p;
  }
  return null;
});
check('a town exists nearby', !!poi);
await ev((p) => { window.game.enterPlace(p); }, poi);
await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 8000 });
const town = await ev(() => { const g = window.game; return { healer: g.interactables.some((i) => i.kind === 'healer'), last: g.session.lastCity }; });
check('town has a healer and becomes the respawn point', town.healer && !!town.last, JSON.stringify(town));
await ev(() => {
  const g = window.game, it = g.interactables.find((i) => i.kind === 'healer'), p = g.state.player;
  p.wx = it.x - 40; p.wy = it.y; g.gameLoop(1);
});
await page.keyboard.press('e');
await page.waitForSelector('.vs-heal');
check('E talks to the healer', (await page.locator('.vs-hrow').count()) === 3);
const poor = await ev(() => { const g = window.game; g.state.wallet.gold = 5; return g.party.buy(0); });
check('healer refuses without gold', poor === false && (await ev(() => window.game.party.heroes[0].dead)) === true);
const paid = await ev(() => {
  const g = window.game; g.state.wallet.gold = 1000;
  const ok = g.party.buy(0);
  return { ok, dead: g.party.heroes[0].dead, hp: g.party.heroes[0].health, gold: g.state.wallet.gold };
});
check('revive costs gold and brings the hero back at full health', paid.ok && !paid.dead && paid.hp === 100 && paid.gold < 1000, JSON.stringify(paid));
check('revived hero can be switched to', await ev(() => { window.game.party.cdUntil = 0; return window.game.party.switchTo(0); }));
const healed = await ev(() => {
  const g = window.game; g.party.heroes[1].health = 10; g.party.heroes[2].health = 30; const g0 = g.state.wallet.gold;
  g.party.buyAll();
  return { hp: g.party.heroes.map((h) => h.health), spent: g0 - g.state.wallet.gold };
});
check('restore-everyone heals the party for gold', healed.hp.every((h) => h >= 100 || h === Math.round(h)) && healed.hp[1] === 100 && healed.hp[2] === 100 && healed.spent > 0, JSON.stringify(healed));

// ---- 7. save and reload keeps heroes, deaths, picks, active hero
await ev(() => {
  const g = window.game;
  g.party.heroes[1].dead = true; g.party.heroes[1].health = 0;
  g.party.heroes[2].picks = { reservoir: 3 }; g.party.heroes[2].level = 9;
});
await ev(async () => { await window.game.requestSave('test', true); });
page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1200);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
const loaded = await page.evaluate(() => { const g = window.game; return { n: g.party.heroes.length, dead: g.party.heroes.map((h) => h.dead), lvl: g.party.heroes[2].level, res: g.party.heroes[2].picks.reservoir, last: g.session.lastCity, active: g.party.active }; });
check('party state survives a reload', loaded.n === 3 && loaded.dead[1] === true && loaded.lvl === 9 && loaded.res === 3 && !!loaded.last, JSON.stringify(loaded));

// ---- 8. party wipe respawns at the LAST visited town, not the nearest
const wipe = await page.evaluate(async () => {
  const g = window.game;
  g.session.cities.push({ id: 'last', name: 'Lasttown', ex: 3000, ey: 3000 });
  g.session.cities.push({ id: 'near', name: 'Neartown', ex: 100, ey: 100 });
  g.session.lastCity = 'last';
  for (let i = 0; i < 4; i++) { g.state.health = 0; g.step(1); }
  const over = g.state.gameOver;
  const target = g.respawnTarget();
  g.respawn(target);
  await new Promise((r) => setTimeout(r, 1500));
  for (let i = 0; i < 10; i++) g.gameLoop(1);
  return { over, label: target.label, alive: g.party.heroes.every((h) => !h.dead && h.health > 0), partial: g.party.heroes.every((h) => h.health < 100), near: Math.hypot(g.state.player.wx - 3000, g.state.player.wy - 3040) < Math.hypot(g.state.player.wx - 100, g.state.player.wy - 140) };   // closer to the last town than to the nearer one (the exact spot is nudged if that tile is water)
});
check('party wipe ends in the death screen', wipe.over);
check('respawn at last visited town with the party revived but hurt', wipe.label === 'Lasttown' && wipe.alive && wipe.near && wipe.partial, JSON.stringify(wipe));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
preview.kill();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
