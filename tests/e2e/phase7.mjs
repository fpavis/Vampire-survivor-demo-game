// Phase 7 end-to-end checks: dungeons (floors, seals, boss, chest, persistence, plateau and sea), quests, story, bounties.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4188;
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
const SEED = Number(process.env.SEED) || 2024;
await context.addInitScript((seed) => { window.__forceSeed = seed; }, SEED);
let page = await context.newPage();
const watch = (pg) => { pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); }); };
watch(page);
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; g.popRuntime.population = null; for (const e of [...g.state.enemies]) e.dead = true; g.reap(); });

const installHelpers = () => {
  const T = 48;
  window.fieldDungeon = () => { const g = window.game; const id = g.quests.resolve({ kind: 'dungeon', group: 'field', nth: 0 }); return id ? g.quests.poiById(id) : null; };
  window.nearestDungeon = (group) => {
    const src = window.game.overworld; let best = null;
    for (let r = 0; r < 40; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
      if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
      const q = src.poiForCell(cx, cy);
      if (q && q.dungeon && (!group || q.group === group)) { const d = Math.hypot(q.tx, q.ty); if (!best || d < best.d) best = { poi: q, d }; }
    }
    return best && best.poi;
  };
  window.inside = () => { const g = window.game; return g.mode === 'interior' && !g.busy; };
  window.stand = (x, y) => { const g = window.game, p = g.state.player; p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.world.update(x, y, 1200, 760, true); g.gameLoop(2); g.updateInteraction(); };
  window.killAll = (pred = () => true) => { const g = window.game; for (const e of [...g.state.enemies]) if (!e.dead && pred(e)) { e.untargetable = false; e.dormant = false; g.damageEnemy(e, 1e9, { noCrit: true }); } g.gameLoop(2); };
  window.findSpot = (kind, minR = 14) => { const g = window.game; for (let r = minR; r < 520; r += 2) for (let a = 0; a < 6.28; a += 0.03) { const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r); const res = g.towers.check(kind, tx, ty); if (res.ok) return { tx, ty, plan: res.plan || null }; } return null; };
  window.buildNow = (kind, spot) => {
    const g = window.game, { newTower } = window.__dev.towersApi;
    const rec = newTower(kind, spot.tx, spot.ty, spot.plan || undefined);
    g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec);
    const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 9999; g.towers.deliver(rec);
    return rec;
  };
  window.T = T;
};
await ev(installHelpers);
const waitInside = () => page.waitForFunction(() => window.inside(), null, { timeout: 8000 });
const waitOutside = () => page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 8000 });

// ---- 1. a land dungeon: floors, seal, guardians, stairs
const dun = await ev(() => { const p = window.fieldDungeon(); return p && { id: p.id, name: p.name, floors: p.dungeon.floors, boss: p.dungeon.boss, group: p.group, type: p.type, realm: p.dungeon.realm }; });
check('a dungeon exists in the fields', !!dun && dun.group === 'field', JSON.stringify(dun));
await ev((id) => { const g = window.game; const poi = window.fieldDungeon(); window.__poi = poi; g.state.nextLevel = 1e12; g.enterPlace(poi); }, dun.id);
await waitInside();
const f0 = await ev(() => { const g = window.game, i = g.interior; return { floor: g.floor, floors: i.floors, stairs: !!i.stairsDown, boss: !!i.boss, guardians: g.state.enemies.filter((e) => e.guardian).length, label: g.zoneLabel, hasUpMarker: g.map.markers.some((m) => m.icon === 'stairs-down') }; });
check('the dungeon opens on its first floor with stairs down and guardians', f0.floor === 0 && f0.floors >= 2 && f0.stairs && !f0.boss && f0.guardians >= 2 && f0.hasUpMarker, JSON.stringify(f0));
check('the zone label names the floor', /floor 1 of/.test(f0.label), f0.label);
const sealed = await ev(() => { const g = window.game, s = g.interior.stairsDown; window.stand(s.x, s.y + 30); return { kind: g.target && g.target.kind, sealed: g.target && g.target.sealed, text: g.target && g.target.text }; });
check('the stairs are sealed while guardians live', sealed.kind === 'down' && sealed.sealed === true && /sealed/.test(sealed.text), JSON.stringify(sealed));
await ev(() => { window.game.interact(); });
check('pressing E on a sealed stair does nothing', (await ev(() => window.game.floor)) === 0);
await ev(() => { window.killAll((e) => e.guardian); window.game.updateInteraction(); });
const open = await ev(() => { const g = window.game; return { sealed: g.target && g.target.sealed, text: g.target && g.target.text, left: g.dungeons.guardiansLeft() }; });
check('killing every guardian unseals the stairs', open.left === 0 && open.sealed === false && /Descend/.test(open.text), JSON.stringify(open));
await ev(() => { window.game.interact(); });
await page.waitForFunction(() => window.game.floor === 1 && !window.game.busy, null, { timeout: 8000 });
const f1 = await ev(() => { const g = window.game, i = g.interior; g.updateInteraction(); return { floor: g.floor, up: !!i.stairsUp || i.floor > 0, label: g.zoneLabel, levelOk: g.state.enemies.every((e) => e.level >= 1), target: g.target && g.target.kind }; });
check('the stairs take the party down a floor', f1.floor === 1 && /floor 2 of/.test(f1.label), JSON.stringify(f1));
await ev(() => { const g = window.game; const s = g.interior.exit; window.stand(s.x, s.y + 30); });
check('a way back up stands where you arrive', (await ev(() => window.game.target && window.game.target.kind)) === 'up');
await ev(() => { window.game.interact(); });
await page.waitForFunction(() => window.game.floor === 0 && !window.game.busy, null, { timeout: 8000 });
const back = await ev(() => { const g = window.game; return { floor: g.floor, guardians: g.state.enemies.filter((e) => e.guardian && !e.dead).length }; });
check('going back up returns to the first floor, and the broken seal stays broken', back.floor === 0 && back.guardians === 0, JSON.stringify(back));

// ---- 2. the boss floor, the guaranteed chest, persistence
const last = dun.floors - 1;
for (let f = 0; f < last; f++) {
  await ev(() => { window.game.changeFloor(1); });
  await page.waitForFunction((n) => window.game.floor === n && !window.game.busy, f + 1, { timeout: 8000 });
}
const boss = await ev(() => { const g = window.game, b = g.state.enemies.find((e) => e.dungeonBoss); return b && { name: b.bossName, isBoss: !!b.isBoss, type: b.type, level: b.level, hasStairs: !!g.interior.stairsDown, marker: g.map.markers.some((m) => m.icon === 'lair') }; });
check('the last floor holds the boss and no stairs', boss && boss.isBoss && !boss.hasStairs && boss.marker, JSON.stringify(boss));
const items0 = await ev(() => window.game.spells.spells.length + window.game.spells.runes.length);
await ev(() => { window.killAll((e) => e.dungeonBoss); });
const chest = await ev(() => { const g = window.game; return { dead: g.visited[g.interiorPoi.id].bossDead, chest: g.interactables.some((i) => i.kind === 'chest' && i.idx === 'boss'), cleared: !!g.interiorState }; });
check('the boss falls and leaves a chest', chest.dead && chest.chest, JSON.stringify(chest));
await ev(() => { const g = window.game; const it = g.interactables.find((i) => i.idx === 'boss'); window.stand(it.x, it.y + 30); });
check('the chest is the interaction target', (await ev(() => window.game.target && window.game.target.kind)) === 'chest');
// leave and come back: the boss stays dead, the chest waits
await ev(() => { window.game.exitPlace(); });
await waitOutside();
await ev((id) => { window.game.enterPlace(window.__poi); }, dun.id);
await waitInside();
for (let f = 0; f < last; f++) {
  await ev(() => { window.game.changeFloor(1); });
  await page.waitForFunction((n) => window.game.floor === n && !window.game.busy, f + 1, { timeout: 8000 });
}
const again = await ev(() => { const g = window.game; return { boss: g.state.enemies.some((e) => e.dungeonBoss && !e.dead), chest: g.interactables.some((i) => i.idx === 'boss' && !i.opened) }; });
check('after leaving and returning the boss stays dead and its chest is still there', !again.boss && again.chest, JSON.stringify(again));
await ev(() => { const g = window.game; const it = g.interactables.find((i) => i.idx === 'boss'); window.stand(it.x, it.y + 30); g.interact(); for (let i = 0; i < 30; i++) g.gameLoop(1); });
const items1 = await ev(() => window.game.spells.spells.length + window.game.spells.runes.length);
check('opening the boss chest grants a guaranteed pick', items1 > items0, `${items0} -> ${items1}`);
check('the chest is spent for good', await ev(() => { const g = window.game; return g.visited[g.interiorPoi.id].bossChestOpened === true && !g.interactables.some((i) => i.idx === 'boss' && !i.opened); }));
await ev(() => { window.game.exitPlace(); });
await waitOutside();


// ---- 3. plateau and sea dungeons
const plat = await ev(() => {
  const g = window.game, spot = window.findSpot('climb', 20);
  const rec = window.buildNow('climb', spot);
  const poi = g.dungeons.plateauOf(rec);
  const c = (rec.tx), d = rec;
  window.stand((poi.ex), (poi.ey) + 0);
  g.world.update(poi.ex, poi.ey, 1200, 760, true);
  const near = g.world.nearestPoi(poi.ex, poi.ey, 72);
  return { id: poi.id, name: poi.name, found: !!near && near.id === poi.id, realm: poi.dungeon.realm, floors: poi.dungeon.floors, target: g.target && g.target.kind, text: g.target && g.target.text };
});
check('a climbing tower plateau hosts a Skyvault entrance the world knows about', plat.found && plat.realm === 'plateau' && plat.floors === 3, JSON.stringify(plat));
check('walking up to it offers to enter', plat.target === 'enter' && /Skyvault/.test(plat.text), plat.text);
await ev(() => { const g = window.game; g.enterPlace(g.world.nearestPoi(g.state.player.wx, g.state.player.wy, 72)); });
await waitInside();
const pf = await ev(() => { const g = window.game; return { kind: g.interior.kind, floors: g.interior.floors, realm: g.interior.dungeon.realm, guardians: g.interior.guardians }; });
check('the Skyvault is a three-floor ruin with guardians', pf.kind === 'ruins' && pf.floors === 3 && pf.realm === 'plateau' && pf.guardians >= 2, JSON.stringify(pf));
await ev(() => { window.game.exitPlace(); });
await waitOutside();
const sea = await ev(() => {
  const g = window.game;
  for (let cy = -14; cy <= 14; cy++) for (let cx = -14; cx <= 14; cx++) {
    const p = g.dungeons.seaCell(cx, cy);
    if (!p) continue;
    const ch = g.world.getChunk(Math.floor(p.tx / 12), Math.floor(p.ty / 12));
    const cache = g.sea.cachesNear(p.tx, p.ty, 3).some((c) => c.tx === p.tx && c.ty === p.ty);
    return { id: p.id, name: p.name, inChunk: ch.pois.some((q) => q.id === p.id), noTreasure: !cache, floors: p.dungeon.floors };
  }
  return null;
});
check('islands can hold a drowned shrine, which stands in the world instead of the treasure', sea && sea.inChunk && sea.noTreasure && sea.floors === 3, JSON.stringify(sea));

// ---- 4. towns: the elder, the board, the story chain
const town = await ev(() => { const src = window.game.overworld; for (let r = 0; r < 60; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) { if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue; const q = src.poiForCell(cx, cy); if (q && q.type === 'city') return { id: q.id, name: q.name }; } return null; });
const enterTown = async () => {
  await ev((id) => { const g = window.game; g.state.player.wx = 0; for (let cy = -40; cy <= 40; cy++) for (let cx = -40; cx <= 40; cx++) { const q = g.overworld.poiForCell(cx, cy); if (q && q.id === id) { g.enterPlace(q); return; } } }, town.id);
  await waitInside();
};
await enterTown();
const npcs = await ev(() => window.game.interactables.filter((i) => i.npc).map((i) => i.kind).sort());
check('towns now also have an elder and a bounty board', JSON.stringify(npcs) === JSON.stringify(['board', 'elder', 'healer', 'innkeeper', 'merchant']), JSON.stringify(npcs));
const near = (kind) => ev((kind) => { const g = window.game, it = g.interactables.find((i) => i.kind === kind), p = g.state.player; for (const c of g.critters.list) { c.wx = c.tx = it.x + 700; c.wy = c.ty = it.y + 700; c.home = { x: c.wx, y: c.wy, r: 5 }; c.wait = 9999; } p.wx = it.x - 24; p.wy = it.y + 10; g.gameLoop(2); g.updateInteraction(); return g.target && g.target.kind; }, kind);
check('the elder is an interaction target', (await near('elder')) === 'elder');
const clickChoice = async (text) => { await page.locator('.vs-dialog .vs-choices button', { hasText: text }).first().click(); await page.waitForTimeout(80); };
await ev(() => { window.game.interact(); });
await page.waitForSelector('.vs-dialog .vs-choices button');
const intro = await page.locator('.vs-dialog .say').innerText();
check('the elder tells of the demon host', /sky|throne|demon/i.test(intro), intro.slice(0, 80));
await page.locator('.vs-dialog .vs-choices button', { hasText: 'Continue' }).click();
await page.waitForTimeout(80);
await clickChoice('Tell me about the lords');
const lore = await page.locator('.vs-dialog .say').innerText();
check('the lore branch names the lords and returns to the question', /Morwen/.test(lore));
await page.locator('.vs-dialog .vs-choices button', { hasText: 'Continue' }).click();
await page.waitForTimeout(80);
check('nothing is forced: the story has not begun yet', (await ev(() => window.game.quests.state.flags.begun)) === undefined);
await clickChoice('We will fight them');
const begun = await ev(() => { const q = window.game.quests.state; return { begun: q.flags.begun, active: Object.keys(q.active) }; });
check('accepting starts the story and the first quest', begun.begun === true && begun.active.includes('m0_omen'), JSON.stringify(begun));
await page.locator('.vs-dialog .vs-choices button').first().click();      // "Farewell"
await page.waitForTimeout(80);
check('the tracker shows the quest', (await page.locator('.vs-tracker').innerText()).includes('An Omen in the Sky'));

// kill a dozen monsters
await ev(() => { const g = window.game, p = g.state.player; for (let i = 0; i < 12; i++) { const e = g.makeEnemy('SLIME', p.wx + 400 + i * 20, p.wy, { level: 1 }); e.untargetable = false; g.damageEnemy(e, 1e9, { noCrit: true }); } g.gameLoop(2); });
const ready0 = await ev(() => { const v = window.game.quests.questView('m0_omen'); return { ready: v.ready, prog: v.objectives[0].progress }; });
check('twelve kills finish the objective', ready0.ready, JSON.stringify(ready0));
await page.keyboard.press('j');
await page.waitForSelector('.vs-journal');
const jFocus = await page.waitForFunction(() => !!(document.activeElement && document.activeElement.closest('.vs-journal')), null, { timeout: 4000 }).then(() => true, () => false);
check('opening the journal with the keyboard puts focus inside it', jFocus);
const jr = await page.locator('.vs-journal').innerText();
check('the journal shows the chapter, the quest, and that it is ready', /PROLOGUE/i.test(jr) && /An Omen in the Sky/.test(jr) && /ready/.test(jr), jr.slice(0, 120).replace(/\n/g, ' | '));
await page.keyboard.press('j');
await page.waitForTimeout(80);
const gold0 = await ev(() => window.game.state.wallet.gold);
await near('elder');
await ev(() => { window.game.interact(); });
await page.waitForSelector('.vs-dialog');
await page.locator('.vs-dialog .vs-choices button', { hasText: /Continue|Farewell/ }).click();
await page.waitForTimeout(100);
const t1 = await ev(() => { const q = window.game.quests.state; return { done: q.done, gold: window.game.state.wallet.gold }; });
check('the elder pays out the finished quest', t1.done.includes('m0_omen') && t1.gold >= gold0 + 60, JSON.stringify({ t1, gold0 }));
await ev(() => window.game.closeNpcPanels());

// the next chapter: its places come from the seeded world
await near('elder');
await ev(() => { window.game.interact(); });
await page.waitForSelector('.vs-dialog');
for (let i = 0; i < 3 && (await page.locator('.vs-dialog .vs-choices button', { hasText: 'Continue' }).count()); i++) { await page.locator('.vs-dialog .vs-choices button', { hasText: 'Continue' }).click(); await page.waitForTimeout(80); }
await clickChoice('We will do it');
const m1 = await ev(() => { const q = window.game.quests.state.active.m1_hollow; return q && { targets: q.targets, p: window.game.quests.markers().map((m) => m.icon) }; });
check('chapter one begins and its dungeon is found from the seed', m1 && m1.targets[0] && m1.targets[0] === dun.id, JSON.stringify({ m1, dun: dun.id }));
check('the quest puts its target on the map even before you have seen it', m1 && m1.p.length >= 1, JSON.stringify(m1 && m1.p));
await ev(() => window.game.closeNpcPanels());
await ev(() => { window.game.exitPlace(); });
await waitOutside();
// the lair was cleared earlier in this test: make it fresh again so the story can be played for real
await ev(() => { const g = window.game; delete g.visited[window.__poi.id]; });

// discover: seeing the place on the map completes the objective
// (places seen before the quest count too: the party stood at this dungeon's door earlier in the test, so the
// objective may already be done when the map knows the place; otherwise revealing it must complete it)
const disc0 = await ev((id) => ({ done: window.game.quests.questView('m1_hollow').objectives[0].done, seen: window.game.map.discoveredPois().some((p) => p.id === id) }), dun.id);
await ev((id) => { const g = window.game; const poi = window.__poi; g.fog.revealCircle(poi.tx, poi.ty, 6); g.syncMap(); g.quests.scanTimer = 0; for (let i = 0; i < 4; i++) g.gameLoop(1); }, dun.id);
const disc1 = await ev(() => window.game.quests.questView('m1_hollow').objectives[0].done);
check('seeing the dungeon completes the discover objective', disc1 === true && (disc0.seen || disc0.done === false), `${JSON.stringify(disc0)} -> ${disc1}`);

// clear: the lord of the fields sits in that dungeon
await ev(() => { window.game.enterPlace(window.__poi); });
await waitInside();
for (let f = 0; f < last; f++) {
  await ev(() => { window.game.changeFloor(1); });
  await page.waitForFunction((n) => window.game.floor === n && !window.game.busy, f + 1, { timeout: 8000 });
}
const lordName = await ev(() => { const b = window.game.state.enemies.find((e) => e.dungeonBoss); return b ? b.bossName : null; });
check('the nearest field dungeon holds the first demon lord', /MORWEN/.test(lordName || ''), String(lordName));
await ev(() => { window.killAll((e) => e.dungeonBoss); });
await ev(() => { window.game.exitPlace(); });
await waitOutside();
const m1r = await ev(() => { const v = window.game.quests.questView('m1_hollow'); return { ready: v.ready, objs: v.objectives.map((o) => o.done) }; });
check('clearing the dungeon finishes the chapter quest', m1r.ready && m1r.objs.every(Boolean), JSON.stringify(m1r));

// back to the elder for the story beat and the reward
await enterTown();
await near('elder');
const lootBefore = await ev(() => window.game.spells.spells.length + window.game.spells.runes.length);
await ev(() => { window.game.interact(); });
await page.waitForSelector('.vs-dialog');
await page.locator('.vs-dialog .vs-choices button', { hasText: /Continue|Farewell/ }).click();
await page.waitForTimeout(150);
const m1d = await ev(() => { const q = window.game.quests.state; return { done: q.done, lord: q.flags['lord.field'], items: window.game.spells.spells.length + window.game.spells.runes.length }; });
check('the turn-in pays gold, a guaranteed pick, and fells the lord in the story', m1d.done.includes('m1_hollow') && m1d.lord === true && m1d.items > lootBefore, JSON.stringify({ m1d, lootBefore }));
await ev(() => window.game.closeNpcPanels());
await page.keyboard.press('j');
await page.waitForSelector('.vs-journal');
check('the journal crosses the fallen lord off', /Morwen/.test(await page.locator('.vs-lord.dead').first().innerText().catch(() => '')));
await page.keyboard.press('j');

// ---- 5. bounty boards
await near('board');
await ev(() => { window.game.interact(); });
await page.waitForSelector('.vs-board');
const offers = await page.locator('.vs-board .vs-good').count();
check('the board posts four bounties', offers === 4, String(offers));
await ev(() => { window.game.state.wallet.wood = 40; window.game.state.wallet.stone = 40; window.game.state.wallet.iron = 40; });
const posted = await ev(() => window.game.state.interior ? null : null);
await page.locator('.vs-board .vs-good').nth(0).locator('button').click();
await page.waitForTimeout(100);
const kill0 = await ev(() => { const g = window.game; const id = Object.keys(g.quests.state.active).find((i) => i.startsWith('b:')); const def = g.quests.state.active[id].def; return { id, enemy: def.objectives[0].enemy, count: def.objectives[0].count, gold: def.rewards.gold }; });
check('accepting a bounty adds it to your list', !!kill0.id && kill0.count >= 12, JSON.stringify(kill0));
await ev((k) => { const g = window.game, p = g.state.player; for (let i = 0; i < k.count; i++) { const e = g.makeEnemy(k.enemy, p.wx + 400 + i * 15, p.wy, { level: 1 }); e.untargetable = false; g.damageEnemy(e, 1e9, { noCrit: true }); } g.gameLoop(2); }, kill0);
await page.waitForTimeout(150);
const claimBtn = page.locator('.vs-board .vs-quest.ready .vs-btn', { hasText: 'Claim reward' });
check('the finished bounty can be claimed at the board', (await claimBtn.count()) === 1);
const g0 = await ev(() => window.game.state.wallet.gold);
await claimBtn.click();
await page.waitForTimeout(150);
const g1 = await ev(() => ({ gold: window.game.state.wallet.gold, done: window.game.quests.state.done.some((d) => d.startsWith('b:')) }));
check('claiming pays the bounty', g1.done && g1.gold >= g0 + kill0.gold, JSON.stringify({ g0, g1, pay: kill0.gold }));
// a delivery bounty takes goods from the wallet
await page.locator('.vs-board .vs-good').nth(1).locator('button').click();
await page.waitForTimeout(100);
const del = await ev(() => { const g = window.game; const id = Object.keys(g.quests.state.active).find((i) => i.startsWith('b:') && g.quests.state.active[i].def.objectives[0].type === 'deliver'); const o = g.quests.state.active[id].def.objectives[0]; return { id, res: o.resource, count: o.count, have: g.state.wallet[o.resource] }; });
const gold2 = await ev(() => window.game.state.wallet.gold);
await page.locator('.vs-board .vs-quest.ready .vs-btn', { hasText: 'Claim reward' }).click();
await page.waitForTimeout(150);
const after = await ev((d) => ({ have: window.game.state.wallet[d.res], gold: window.game.state.wallet.gold }), del);
check('a delivery bounty takes the goods and pays', after.have === del.have - del.count && after.gold > gold2, JSON.stringify({ del, after }));
await ev(() => window.game.closeNpcPanels());
await ev(() => { window.game.exitPlace(); });
await waitOutside();

// ---- 6. every objective type listens to the world
const types = await ev((spotBeacon) => {
  const g = window.game, { newTower } = window.__dev.towersApi;
  const mk = (id, objectives) => ({ id, title: id, summary: id, kind: 'bounty', giver: 'board', objectives, rewards: { gold: 1 } });
  const defs = [
    mk('t.build', [{ type: 'build', kind: 'waypoint' }]),
    mk('t.gather', [{ type: 'gather', resource: 'wood', count: 3 }]),
    mk('t.survive', [{ type: 'survive', seconds: 2 }]),
    mk('t.enter', [{ type: 'enter', target: { kind: 'dungeon' } }]),
    mk('t.boss', [{ type: 'killBoss', count: 1 }])
  ];
  for (const d of defs) g.quests.start(d);
  return Object.keys(g.quests.state.active).filter((k) => k.startsWith('t.'));
});
check('five test quests are active', types.length === 5, JSON.stringify(types));
await ev(() => { const g = window.game; const spot = window.findSpot('waypoint', 30); window.buildNow('waypoint', spot); });
await ev(() => { const g = window.game, p = g.state.player; for (let i = 0; i < 3; i++) g.dropGem(p.wx + i, p.wy + 5, 1, 'wood'); for (let i = 0; i < 40; i++) g.gameLoop(1); });
await ev(() => { const g = window.game; g.zoneGroup = g.zoneGroup || 'field'; for (let i = 0; i < 200; i++) g.gameLoop(1); });
await ev(() => { const g = window.game; const e = g.makeEnemy('BOAR_KING', g.state.player.wx + 400, g.state.player.wy, { level: 1 }); e.untargetable = false; g.damageEnemy(e, 1e9, { noCrit: true }); });
await ev(() => { const g = window.game; const id = g.quests.state.active['t.enter'].targets[0]; g.enterPlace(g.quests.poiById(id)); });
await waitInside();
const ready = await ev(() => Object.fromEntries(['t.build', 't.gather', 't.survive', 't.enter', 't.boss'].map((id) => [id, window.game.quests.questView(id).ready])));
check('build, gather, survive, enter and boss-kill objectives all complete from play', Object.values(ready).every(Boolean), JSON.stringify(ready));
await ev(() => { window.game.exitPlace(); });
await waitOutside();

// a dungeon cleared before the quest was taken still counts
const pre = await ev(() => {
  const g = window.game;
  const def = { id: 't.pre', title: 'pre', summary: 'pre', kind: 'bounty', giver: 'board', objectives: [{ type: 'clear', target: { kind: 'dungeon', group: window.__poi.group, nth: 0 } }], rewards: { gold: 1 } };
  const target = window.__poi.id;
  g.visited[target] = { ...(g.visited[target] || { opened: [], cleared: false, altarUsed: false }), bossDead: true };
  g.quests.start(def);
  return g.quests.questView('t.pre').ready;
});
check('a dungeon that was already cleared counts for a quest taken afterwards', pre === true);

// ---- 7. everything survives a reload
const snap = await ev(() => { const q = window.game.quests.state; return { done: [...q.done], flags: { ...q.flags }, active: Object.keys(q.active).sort(), boards: JSON.parse(JSON.stringify(q.bounties)), bossDead: window.game.visited[window.__poi.id].bossDead }; });
await ev(async () => { await window.game.requestSave('test', true); });
page = await context.newPage(); watch(page);
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
const reload = await page.evaluate(() => { const q = window.game.quests.state; return { done: [...q.done], flags: { ...q.flags }, active: Object.keys(q.active).sort(), boards: JSON.parse(JSON.stringify(q.bounties)), bossDead: Object.values(window.game.visited).some((v) => v.bossDead) }; });
check('quests, story flags, bounty rotations and dungeon progress survive a reload', JSON.stringify(reload.done) === JSON.stringify(snap.done) && JSON.stringify(reload.flags) === JSON.stringify(snap.flags) && JSON.stringify(reload.active) === JSON.stringify(snap.active) && JSON.stringify(reload.boards) === JSON.stringify(snap.boards) && reload.bossDead === snap.bossDead, JSON.stringify({ snap, reload }));
check('the tracker is back after a reload', (await page.locator('.vs-tracker').count()) === 1 || reload.active.length === 0);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
