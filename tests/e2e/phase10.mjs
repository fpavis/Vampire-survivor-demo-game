// Phase 10 end-to-end checks: the owner's playtest feedback (resize, test tools, boat recall, ambushes, click to
// interact, and the later Phase 10 steps). Sections can be picked with ONLY=resize,...; SHOTS=<dir> saves screenshots;
// THROTTLE=n slows the CPU like a busy CI runner.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4192;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (section) => !ONLY || ONLY.includes(section);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => { window.__forceSeed = 2024; });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
if (process.env.THROTTLE) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
const ev = (fn, arg) => page.evaluate(fn, arg);
const loop = (n) => ev((n) => { for (let i = 0; i < n; i++) window.game.gameLoop(1); }, n);
// panels and resizes follow the game's own ticker, slow on a software GPU: wait for the state, never a fixed time
const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player && window.__dev);
await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });
// a hero standing at a world position, with the world around it loaded
const goTo = (x, y) => ev(([x, y]) => {
  const g = window.game, p = g.state.player;
  p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.lastFogTx = null;
  g.world.update(x, y, g.viewW, g.viewH, true);
  for (let i = 0; i < 3; i++) g.gameLoop(1);
}, [x, y]);

// ---- 10a: everything follows the window when it is resized
if (want('resize')) {
  // every full-screen layer must match the screen, measured after Pixi's own (deferred) resize
  const layers = () => ev(() => {
    const g = window.game, w = g.app.screen.width, h = g.app.screen.height, ui = g.ui;
    const fade = ui.fadeG.getLocalBounds();
    return {
      w, h,
      vignette: Math.round(g.vignetteSprite.width) === w && Math.round(g.vignetteSprite.height) === h,
      haze: Math.round(g.hazeSprite.width) === w,
      light: g.lighting.rt.width / w,
      fade: Math.round(fade.width) === w && Math.round(fade.height) === h,
      minimap: Math.round(ui.mapBox.x + 177 * ui.mapBox.scale.x),
      prompt: Math.round(ui.prompt.x) === Math.round(w / 2),
      centred: Math.abs(g.worldContainer.x - (w / 2 - g.cam.x * g.worldContainer.scale.x)) < 2
    };
  });
  const before = await layers();
  const sizes = [[1600, 1000], [900, 1100], [1280, 720]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    const ok = await until(([w, h]) => window.game.app.screen.width === w && window.game.app.screen.height === h, [w, h]);
    await loop(1);
    const l = await layers();
    check(`after a resize to ${w}x${h} the overlays, light map, fade and HUD fit the new screen`,
      ok && l.vignette && l.haze && l.fade && l.prompt && Math.abs(l.light - before.light) < 0.02 && Math.abs(l.minimap - (w - 12)) <= 2, JSON.stringify(l));
  }
  // a resize while the game is paused keeps the world centred
  await ev(() => { window.game.state.paused = true; });
  await page.setViewportSize({ width: 1500, height: 820 });
  await until(() => window.game.app.screen.width === 1500);
  const paused = await layers();
  await ev(() => { window.game.state.paused = false; });
  await page.setViewportSize({ width: 1280, height: 720 });
  await until(() => window.game.app.screen.width === 1280);
  check('a resize while paused keeps the world centred', paused.centred && paused.vignette, JSON.stringify(paused));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/resize.png` });
}

// ---- 10a: test tools for money, materials and building
if (want('devtools')) {
  const eco = await ev(() => {
    const g = window.game, t = window.__dev.tools, api = window.__dev.towersApi;
    t.emptyWallet();
    t.addGold(1000); t.addResources(100);
    const after = { ...g.state.wallet };
    t.buildKit();
    const kit = api.buildKit(2), w = g.state.wallet;
    const funded = api.TOWER_KINDS.every((k) => api.RES.every((r) => w[r] >= api.TOWER_DEFS[k].cost[r] * 2));
    return { after, funded, hud: { ...window.__dev.game.ui && g.state.wallet }, kitGold: kit.gold };
  });
  check('test tools grant gold and materials', eco.after.gold === 1000 && eco.after.wood === 100 && eco.after.stone === 100 && eco.after.iron === 100, JSON.stringify(eco.after));
  check('the build kit funds every kind of tower twice', eco.funded, JSON.stringify(eco));
  const wallet = await until(() => /\d/.test(document.querySelector('.vs-wallet')?.innerText || '') && (document.querySelector('.vs-wallet')?.innerText || '').replace(/\D/g, '').length >= 4);
  check('the wallet on screen follows the test tools', wallet);
  const site = await ev(() => {
    const g = window.game, api = window.__dev.towersApi, p = g.state.player;
    let spot = null;
    for (let r = 14; r < 120 && !spot; r += 2) for (let a = 0; a < 6.28 && !spot; a += 0.2) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      if (g.towers.check('beacon', tx, ty).ok) spot = { tx, ty };
    }
    if (!spot) return { spot };
    const rec = api.newTower('beacon', spot.tx, spot.ty);
    g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec);
    p.wx = (spot.tx + 0.5) * 48; p.wy = (spot.ty + 2.5) * 48;
    const n = window.__dev.tools.finishSites(false);
    return { spot, n, built: rec.built };
  });
  check('a construction site can be finished at once', site.n === 1 && site.built, JSON.stringify(site));
  // the panel's own buttons, export into the box (no prompt dialogs, which hosted pages block)
  await page.keyboard.press('`');
  await until(() => getComputedStyle(document.getElementById('devtools')).display === 'block');
  await page.locator('#devtools button', { hasText: /^Export$/ }).click();
  const exported = await until(() => (document.querySelector('#devtools textarea')?.value || '').length > 200);
  await ev(() => { document.querySelector('#devtools textarea').value = 'not a save'; });
  await page.locator('#devtools button', { hasText: /^Import$/ }).click();
  const rejected = await until(() => /Not a valid save/.test(document.querySelector('#devtools textarea')?.value || ''));
  await page.locator('#devtools button', { hasText: /^Towns$/ }).click();
  const listed = await until(() => document.querySelectorAll('#devtools .row button').length > 30);
  await page.keyboard.press('`');
  check('saves export to and import from a box in the panel, without dialogs', exported && rejected);
  check('the panel lists the nearest towns to jump to', listed);
}

// ---- 10a: a boat left on a far shore can be called back to its dock
if (want('recall')) {
  const dock = await ev(() => {
    const g = window.game, api = window.__dev.towersApi;
    let spot = null;
    for (let r = 16; r < 260 && !spot; r += 3) for (let a = 0; a < 6.28 && !spot; a += 0.05) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      const res = g.towers.check('dock', tx, ty);
      if (res.ok) spot = { tx, ty, plan: res.plan };
    }
    if (!spot) return null;
    const rec = api.newTower('dock', spot.tx, spot.ty, spot.plan);
    g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec);
    rec.delivered = { ...api.TOWER_DEFS.dock.cost }; g.towers.complete(rec);
    return { id: rec.id, tx: rec.tx, ty: rec.ty, home: api.boatSpot(rec) };
  });
  check('a dock can be built for the test', !!dock, JSON.stringify(dock));
  if (dock) {
    await goTo((dock.tx + 0.5) * 48, (dock.ty + 1.5) * 48);
    const r = await ev((d) => {
      const g = window.game, rec = g.towers.byId(d.id);
      // the boat was left a long way off
      g.session.boats[d.id] = { x: d.home.x + 900, y: d.home.y + 300 };
      const b = g.sea.boats.get(d.id); if (b) { b.x = d.home.x + 900; b.y = d.home.y + 300; }
      g.updateInteraction();
      const offered = g.target && g.target.act === 'recall' ? g.target.text : null;
      g.interact();
      const at = g.session.boats[d.id];
      g.updateInteraction();
      return { offered, home: Math.hypot(at.x - d.home.x, at.y - d.home.y) < 1, again: !!(g.target && g.target.act === 'recall'), can: g.sea.canRecall(rec) };
    }, dock);
    check('a dock offers to recall a boat left elsewhere, and the boat comes home', !!r.offered && r.home && !r.again && !r.can, JSON.stringify(r));
  }
}

// ---- 10a: ambushes are bigger but rise farther out, in groups, leaving a way out
if (want('ambush')) {
  const trig = await ev(() => {
    const g = window.game;
    for (const s of g.sites.sites.near(0, 0, 440)) if (s.kind === 'trigger' && !g.session.triggered[s.id] && Math.hypot(s.tx, s.ty) < 400) return s;
    return null;
  });
  check('an ambush plate exists', !!trig);
  if (trig) {
    // arrive beside the plate, not on it: it must spring inside the one evaluate below, or the page's own ticker
    // runs on between calls (long on a slow runner) and the first group is awake before anyone looks
    await goTo(trig.x, trig.y + 1400);
    const amb = await ev((s) => {
      const g = window.game, p = g.state.player;
      for (const e of [...g.state.enemies]) if (!e.siteId) { e.dead = true; e.silent = true; }
      g.reap();
      p.wx = s.x; p.wy = s.y; g.cam.x = s.x; g.cam.y = s.y; g.lastFogTx = null;
      g.world.update(s.x, s.y, g.viewW, g.viewH, true);
      g.sites.timer = 0;
      for (let i = 0; i < 30 && !g.session.triggered[s.id]; i++) { p.wx = s.x; p.wy = s.y; g.gameLoop(1); }
      const mine = () => g.state.enemies.filter((e) => e.siteId === s.id && !e.dead);
      const ms = mine();
      const dists = ms.map((e) => Math.hypot(e.wx - s.x, e.wy - s.y));
      const angles = ms.map((e) => Math.atan2(e.wy - s.y, e.wx - s.x)).sort((a, b) => a - b);
      let gap = angles.length ? angles[0] + Math.PI * 2 - angles[angles.length - 1] : 0;
      for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i] - angles[i - 1]);
      const asleep = ms.filter((e) => e.dormant).length;
      // the groups as planned when it sprang (a monster hit by the hero's spells wakes early, as it should)
      const groups = new Set(ms.map((e) => e.ambushWake)).size;
      // step until every one has woken (hit-stop after a crit holds the frame counter, so count frames, not calls)
      const f0 = g.frame, woke = new Map();
      for (let i = 0; i < 900 && ms.some((e) => !e.dead && !woke.has(e)); i++) {
        p.wx = s.x; p.wy = s.y; g.gameLoop(1);
        for (const e of ms) if (!e.dormant && !woke.has(e)) woke.set(e, Math.round(g.frame - f0));
      }
      const awake = woke.size;
      for (const e of mine()) g.damageEnemy(e, 1e9, { noCrit: true });
      g.sites.timer = 0; for (let i = 0; i < 30; i++) g.gameLoop(1);
      return { waves: s.waves, n: ms.length, min: Math.round(Math.min(...dists)), max: Math.round(Math.max(...dists)), gap: Math.round(gap * 180 / Math.PI), asleep, awake, groups, at: [...new Set(woke.values())].sort((a, b) => a - b) };
    }, trig);
    check('an ambush springs half again as many monsters, 6 or more', amb.n >= 6 && amb.n === Math.max(6, Math.min(15, Math.round(amb.waves * 1.5))), JSON.stringify(amb));
    check('they rise well away from the plate and leave one side open', amb.min >= 300 && amb.gap >= 110, JSON.stringify(amb));
    check('they show themselves first, then close in group by group', amb.asleep === amb.n && amb.awake === amb.n && amb.groups >= 2, JSON.stringify(amb));
  }
}

// ---- 10a: experimental mouse interaction (off by default)
if (want('mouse')) {
  // a tree near the start, and where it is on the screen
  const tree = await ev(() => {
    const g = window.game, isTree = (t) => ['appletree', 'birch', 'oak', 'pine', 'snowpine', 'palm', 'dead'].includes(t);
    for (let r = 4; r < 40; r++) {
      const n = g.world.nearestNode(0, 0, r * 48, (t) => isTree(t));
      if (n) return { x: n.x, y: n.y, type: n.type };
    }
    return null;
  });
  check('a tree to click exists', !!tree, JSON.stringify(tree));
  if (tree) {
    const screenOf = (x, y) => ev(([x, y]) => { const g = window.game, z = g.worldContainer.scale.x; return { x: x * z + g.worldContainer.x, y: y * 0.6 * z + g.worldContainer.y - 30 }; }, [x, y]);
    const state = () => ev((t) => { const g = window.game, n = g.world.nearestNode(t.x, t.y, 4, () => true); return { hits: n ? n._hits || 0 : -1, move: !!g.moveTarget, down: !!g.state.pointerDown, cursor: g.app.view.style.cursor }; }, tree);
    const stand = async (dx, dy) => { await goTo(tree.x + dx, tree.y + dy); await ev(() => { window.game.moveTarget = null; }); };
    const clickTree = async () => { const s = await screenOf(tree.x, tree.y); await page.mouse.move(s.x, s.y); await page.mouse.down(); const st = await state(); await page.mouse.up(); return st; };
    // off: a click on the tree does not chop it
    await ev(() => window.__dev.setSettings({ mouseInteract: false, clickToMove: false }));
    await stand(40, 20);
    const off = await clickTree();
    // on: a click on a tree within reach chops it and starts no walk
    await ev(() => window.__dev.setSettings({ mouseInteract: true, clickToMove: true }));
    await stand(40, 20);
    const on = await clickTree();
    // on, but out of reach: nothing happens to the tree, and click to move walks instead
    await stand(400, 40);
    const far = await clickTree();
    // on: a click on empty ground still walks
    const ground = await ev(() => { const g = window.game; return { x: g.app.screen.width * 0.2, y: g.app.screen.height * 0.8 }; });
    await ev(() => { window.game.moveTarget = null; });
    await page.mouse.click(ground.x, ground.y);
    const walk = await ev(() => !!window.game.moveTarget);
    await ev(() => window.__dev.setSettings({ mouseInteract: false, clickToMove: false }));
    check('with the setting off, clicking a tree does not use it', off.hits === 0, JSON.stringify(off));
    check('with the setting on, clicking a tree in reach chops it and does not walk', on.hits === 1 && !on.move && !on.down, JSON.stringify(on));
    check('a tree out of reach is not used; the click walks instead', far.hits === 1 && far.move, JSON.stringify(far));
    check('clicking empty ground still walks', walk);
  }
}

// ---- 10b: a world map that pans and zooms over everything explored
if (want('map')) {
  await goTo(0, 0);
  await ev(() => { const g = window.game, p = g.state.player; g.fog.revealCircle(Math.floor(p.wx / 48), Math.floor(p.wy / 48), 120); g.syncMap(); });
  const fog0 = await ev(() => window.game.fog.revealedTileCount());
  await page.keyboard.press('m');
  const opened = await until(() => !!document.querySelector('.vs-worldmap canvas') && !!window.__dev.ui.mapCtl && window.game.state.paused);
  check('M opens the world map over the paused game', opened);
  const v0 = await ev(() => window.__dev.ui.mapCtl.view());
  const box = await page.locator('.vs-worldmap canvas').boundingBox();
  // drag the map: the view moves the other way
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 80, { steps: 6 });
  await page.mouse.up();
  const v1 = await ev(() => window.__dev.ui.mapCtl.view());
  check('dragging pans the map', v1.cx > v0.cx + 20 / v0.ppt && v1.cy > v0.cy, JSON.stringify({ v0, v1 }));
  // the wheel zooms about the cursor
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.wheel(0, -200);
  const zoomed = await until((z) => window.__dev.ui.mapCtl.view().z > z, v1.z);
  await page.mouse.wheel(0, 300);
  const zoomedOut = await until((z) => window.__dev.ui.mapCtl.view().z === z, v1.z);
  check('the wheel zooms in and out', zoomed && zoomedOut);
  // held keys pan, C comes back to the party
  await page.keyboard.down('d');
  const keysPan = await until((cx) => window.__dev.ui.mapCtl.view().cx > cx + 3, (await ev(() => window.__dev.ui.mapCtl.view())).cx);
  await page.keyboard.up('d');
  await page.keyboard.press('c');
  const back = await until(() => { const v = window.__dev.ui.mapCtl.view(), p = window.game.state.player; return Math.abs(v.cx - p.wx / 48) < 1 && Math.abs(v.cy - p.wy / 48) < 1; });
  check('keys pan the map and C brings it back to the party', keysPan && back);
  // the pad: shoulders zoom (dispatched as the pad would)
  const pad = await ev(() => { const c = window.__dev.ui.mapCtl, z0 = c.view().z; c.zoom(1); const z1 = c.view().z; c.zoom(-1); return { z0, z1, z2: c.view().z }; });
  check('the pad zooms it too', pad.z1 === pad.z0 + 1 && pad.z2 === pad.z0, JSON.stringify(pad));
  // looking around does not explore anything
  const fog1 = await ev(() => window.game.fog.revealedTileCount());
  check('panning the map reveals nothing new (the fog stays)', fog1 === fog0, `${fog0} -> ${fog1}`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/worldmap.png` });
  const pos = await ev(() => ({ x: window.game.state.player.wx, y: window.game.state.player.wy }));
  await page.keyboard.press('Escape');
  const closed = await until(() => !document.querySelector('.vs-worldmap') && !window.game.state.paused);
  const pos2 = await ev(() => ({ x: window.game.state.player.wx, y: window.game.state.player.wy }));
  check('Esc closes the map, and the hero did not move', closed && pos.x === pos2.x && pos.y === pos2.y, JSON.stringify({ pos, pos2 }));
  // after a resize the map still fills the screen
  await page.keyboard.press('m');
  await until(() => !!document.querySelector('.vs-worldmap canvas'));
  await page.setViewportSize({ width: 1000, height: 700 });
  const fits = await until(() => { const c = document.querySelector('.vs-worldmap canvas'); return c && c.width > 900 && c.width < 1000; });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press('m');
  await until(() => !document.querySelector('.vs-worldmap'));
  check('the map follows a window resize', fits);
}

// ---- 10b: what was explored in a dungeon stays explored
if (want('dfog')) {
  const poi = await ev(() => window.__dev.tools.nearestPlaces('dungeon', 1)[0]);
  const enter = async () => {
    await ev((q) => window.game.enterPlace(q), poi);
    await until(() => window.game.mode === 'interior' && !window.game.busy, undefined, 20000);
  };
  const leave = async () => {
    await ev(() => window.game.exitPlace());
    await until(() => window.game.mode === 'overworld' && !window.game.busy, undefined, 20000);
  };
  await enter();
  const seen = await ev(() => {
    const g = window.game, p = g.state.player, s = g.interior;
    // walk across the floor (revealing as the party goes)
    for (let i = 0; i < 6; i++) { p.wx = (8 + i * 8) * 48; p.wy = (s.h / 2) * 48; g.lastFogTx = null; g.updateFog(); }
    return g.interiorFog.revealedTileCount();
  });
  await leave();
  await enter();
  const again = await ev(() => window.game.interiorFog.revealedTileCount());
  await leave();
  await ev(async () => { await window.game.requestSave('test', true); });
  await page.reload();
  await page.waitForFunction(() => !!window.game && window.game.titleReady);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player && window.__dev, null, { timeout: 15000 });
  await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });
  await enter();
  const reloaded = await ev(() => window.game.interiorFog.revealedTileCount());
  await leave();
  check('a dungeon floor remembers what was explored, also after a reload', seen > 200 && again >= seen && reloaded >= seen, JSON.stringify({ seen, again, reloaded }));
}

// ---- 10b: badges on the map for towns visited
if (want('badges')) {
  const town = await ev(() => window.__dev.tools.nearestPlaces('city', 1)[0]);
  await ev((q) => window.game.enterPlace(q), town);
  await until(() => window.game.mode === 'interior' && !window.game.busy, undefined, 20000);
  await ev(() => window.game.exitPlace());
  await until(() => window.game.mode === 'overworld' && !window.game.busy, undefined, 20000);
  const badge = await ev((q) => {
    const g = window.game;
    g.fog.revealCircle(q.tx, q.ty, 6); g.syncMap();
    const mark = g.map.marks().find((m) => m.label === q.name);
    return { badge: g.map.placeBadge(q), detail: mark ? mark.detail : null };
  }, town);
  check('a town once entered shows a Visited badge on the map', badge.badge === 'visited' && /Visited/.test(badge.detail || ''), JSON.stringify(badge));
}

// ---- 10c: a dungeon is cleared once everything in it is done, and a portal leads out from the boss
const inside = () => until(() => window.game.mode === 'interior' && !window.game.busy, undefined, 20000);
const outside = () => until(() => window.game.mode === 'overworld' && !window.game.busy, undefined, 20000);
// dungeons of several floors near the start, the first with a chest on its ground floor
const deepDungeons = () => ev(() => {
  const g = window.game;
  return window.__dev.tools.nearestPlaces('dungeon', 10).filter((q) => q.dungeon.floors >= 2)
    .sort((a, b) => (g.dungeons.manifest(b)[0].chests > 0) - (g.dungeons.manifest(a)[0].chests > 0));
});
const killAll = (pred) => ev((src) => {
  const g = window.game, pred = new Function('e', `return (${src})(e)`);
  for (const e of [...g.state.enemies]) if (!e.dead && pred(e)) { e.untargetable = false; e.dormant = false; g.damageEnemy(e, 1e9, { noCrit: true }); }
  g.gameLoop(2);
}, pred.toString());

if (want('complete')) {
  const [poi] = await deepDungeons();
  await ev((q) => window.game.enterPlace(q), poi);
  await inside();
  // everything else in the dungeon is done (through its saved state); one chest on this floor is left
  const before = await ev(() => {
    const g = window.game, poi = g.interiorPoi, place = g.visited[poi.id], man = g.dungeons.manifest(poi);
    const last = g.interactables.find((i) => i.kind === 'chest' && typeof i.idx === 'number' && !i.opened);
    man.forEach((m, f) => {
      const st = f === 0 ? place : ((place.floors ||= {})[f] ||= { opened: [], cleared: false, altarUsed: false });
      st.cleared = true;
      for (let i = 0; i < m.chests; i++) if (!st.opened.includes(i) && !(f === 0 && i === last.idx)) st.opened.push(i);
      if (m.vault && !st.opened.includes('vault')) st.opened.push('vault');
    });
    place.bossDead = true; place.bossChestOpened = true;
    g.dungeons.checkComplete();
    return { complete: !!place.complete, text: g.dungeons.progress(poi), idx: last.idx };
  });
  const after = await ev(() => {
    const g = window.game, poi = g.interiorPoi;
    g.openChest(g.interactables.find((i) => i.kind === 'chest' && typeof i.idx === 'number' && !i.opened));
    return { complete: !!g.visited[poi.id].complete, banner: g.ui.elements.banner.text.text, done: g.dungeons.progress(poi).done };
  });
  check('a dungeon is not cleared while a chest is still closed', !before.complete && !before.text.done && before.text.chestsOpened === before.text.chests - 1, JSON.stringify(before));
  check('opening the last chest clears the dungeon, with a banner', after.complete && after.done && /DUNGEON CLEARED/.test(after.banner), JSON.stringify(after));
  await ev(() => window.game.exitPlace());
  await outside();
  const shown = await ev((q) => {
    const g = window.game;
    g.fog.revealCircle(q.tx, q.ty, 6); g.syncMap();
    const mark = g.map.marks().find((m) => m.label === q.name);
    return { badge: g.map.placeBadge(q), detail: mark ? mark.detail : null };
  }, poi);
  check('the map shows a Cleared badge on it', shown.badge === 'cleared' && /Cleared/.test(shown.detail || ''), JSON.stringify(shown));
}

if (want('portal')) {
  const list = await deepDungeons();
  const poi = list[list.length > 1 ? 1 : 0];
  const toBoss = async () => {
    await ev((q) => window.game.enterPlace(q), poi);
    await inside();
    await ev((q) => { const g = window.game; g.clearWorldEntities(); g.loadFloor(q, q.dungeon.floors - 1); for (let i = 0; i < 3; i++) g.gameLoop(1); }, poi);
  };
  await toBoss();
  const pre = await ev(() => ({ portal: !!window.game.dungeons.portal, boss: window.game.state.enemies.some((e) => e.dungeonBoss && !e.dead) }));
  await killAll((e) => e.dungeonBoss);
  const open = await ev(() => {
    const g = window.game, pt = g.dungeons.portal, p = g.state.player;
    if (!pt) return null;
    p.wx = pt.x; p.wy = pt.y + 30; g.updateInteraction();
    // the banner may already show the loot that fell with the boss: read the message log, which keeps every banner
    return { kind: g.target && g.target.kind, text: g.target && g.target.text, sprite: !!pt.sprite && pt.sprite.parent === g.objectLayer, banner: window.__dev.ui.log.value.some((l) => /BOSS DEFEATED/.test(l.text)) };
  });
  check('a portal opens once the boss of a deep dungeon falls', pre.boss && !pre.portal && open && open.sprite && open.banner, JSON.stringify({ pre, open }));
  check('standing at the portal offers the way out', open && open.kind === 'portal', JSON.stringify(open));
  await ev(() => window.game.interact());
  await outside();
  const out = await ev((q) => { const p = window.game.state.player; return { mode: window.game.mode, d: Math.round(Math.hypot(p.wx - q.ex, p.wy - q.ey)) }; }, poi);
  check('stepping through it leads out to the dungeon entrance', out.mode === 'overworld' && out.d < 120, JSON.stringify(out));
  await toBoss();
  const back = await ev(() => ({ portal: !!window.game.dungeons.portal, boss: window.game.state.enemies.some((e) => e.dungeonBoss && !e.dead) }));
  check('the portal is still there on a later visit', back.portal && !back.boss, JSON.stringify(back));
  await ev(() => window.game.exitPlace());
  await outside();
}

// ---- 10d: towns differ, and everyone in them can be walked up to
if (want('town')) {
  const towns = await ev(() => window.__dev.tools.nearestPlaces('city', 3));
  const seen = [];
  for (const q of towns) {
    await ev((q) => window.game.enterPlace(q), q);
    await inside();
    seen.push(await ev(() => {
      const g = window.game, src = g.interior, T = 48, p = g.state.player, W = src.w, H = src.h;
      // every tile the hero fits on, flooding out from where the party arrives (the game's own collision)
      const fits = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && !g.world.blocked((tx + 0.5) * T, (ty + 0.5) * T, p.radius);
      const open = new Uint8Array(W * H), stack = [[Math.floor(p.wx / T), Math.floor(p.wy / T)]];
      open[stack[0][1] * W + stack[0][0]] = 1;
      while (stack.length) {
        const [x, y] = stack.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (fits(nx, ny) && !open[ny * W + nx]) { open[ny * W + nx] = 1; stack.push([nx, ny]); } }
      }
      // stand on the reachable tile nearest a spot and see what E would use
      const walkTo = (x, y) => {
        let best = null, bd = Infinity;
        for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (open[ty * W + tx]) { const d = Math.hypot((tx + 0.5) * T - x, (ty + 0.5) * T - y); if (d < bd) { bd = d; best = [tx, ty]; } }
        for (const c of g.critters.list) { c.wx = c.tx = src.exit.x; c.wy = c.ty = src.exit.y + 9999; c.home = { x: c.wx, y: c.wy, r: 5 }; c.wait = 9999; }
        p.wx = (best[0] + 0.5) * T; p.wy = (best[1] + 0.5) * T; g.updateInteraction();
        return { kind: g.target && g.target.kind, d: Math.round(bd) };
      };
      const out = { size: `${W}x${H}`, tiles: src.tiles.reduce((a, b, i) => (a * 31 + b * (i % 97)) >>> 0, 7), reach: {} };
      for (const k of ['healer', 'merchant', 'innkeeper', 'elder', 'board']) { const it = g.interactables.find((i) => i.kind === k); out.reach[k] = walkTo(it.x, it.y); }
      out.reach.fountain = walkTo(src.fountain.x, src.fountain.y + 20);
      out.reach.altar = walkTo(src.altar.x, src.altar.y + 20);
      out.reach.exit = walkTo(src.exit.x, src.exit.y);
      out.reach.dummy = walkTo(g.dummy.e ? g.dummy.e.wx : src.services.dummy.x, g.dummy.e ? g.dummy.e.wy : src.services.dummy.y);
      out.reach.dummy.kind = out.reach.dummy.d < 70 ? 'dummy' : null;
      return out;
    }));
    await ev(() => window.game.exitPlace());
    await outside();
  }
  const layouts = new Set(seen.map((t) => t.tiles)), sizes = new Set(seen.map((t) => t.size));
  check('towns are laid out differently', layouts.size === seen.length, JSON.stringify(seen.map((t) => t.size)));
  check('and do not all share one size', sizes.size >= 2 || seen.length < 3, JSON.stringify([...sizes]));
  const bad = seen.flatMap((t, i) => Object.entries(t.reach).filter(([k, r]) => r.kind !== k).map(([k, r]) => `${i}:${k}:${r.kind}:${r.d}`));
  check('in every town the healer, merchant, inn, elder, board, fountain, altar, dummy and gate can be walked up to and used', bad.length === 0, bad.join(' '));
}

// ---- 10e: town teleporters and the party's waypoints make one travel network
if (want('travel')) {
  const fresh = await ev(() => { const g = window.game; return window.__dev.tools.nearestPlaces('city', 10).filter((q) => !g.session.cities.some((c) => c.id === q.id)).slice(0, 2); });
  check('two towns not yet visited are near', fresh.length === 2, String(fresh.length));
  const [A, B] = fresh;
  const node = (id) => `town:${id}`;
  const setGold = (n) => ev((n) => { const g = window.game; g.state.wallet.gold = n; window.__dev.ui.wallet.value = { ...g.state.wallet }; }, n);
  const inTown = (id) => until((id) => !window.game.busy && window.game.mode === 'interior' && window.game.interiorPoi && window.game.interiorPoi.id === id, id, 20000);
  // walking into a town attunes its teleporter
  await ev((q) => window.game.enterPlace(q), A);
  await inTown(A.id);
  const att = await ev((id) => { const g = window.game; return { listed: g.session.cities.some((c) => c.id === id), log: window.__dev.ui.log.value.some((l) => /Teleporter attuned/.test(l.text)), node: !!g.travel.node(`town:${id}`) }; }, A.id);
  check('entering a town attunes its teleporter', att.listed && att.log && att.node, JSON.stringify(att));
  await ev(() => window.game.exitPlace()); await outside();
  await ev((q) => window.game.enterPlace(q), B); await inTown(B.id);
  await ev(() => window.game.exitPlace()); await outside();
  await ev((q) => window.game.enterPlace(q), A); await inTown(A.id);
  // E at the teleporter opens the map in travel mode
  const use = await ev(() => {
    const g = window.game, tp = g.interior.services.teleporter, p = g.state.player;
    for (const c of g.critters.list) { c.wx = c.tx = tp.x; c.wy = c.ty = tp.y - 9999; c.home = { x: c.wx, y: c.wy, r: 5 }; c.wait = 9999; }
    p.wx = tp.x; p.wy = tp.y + 30; g.updateInteraction();
    const kind = g.target && g.target.kind;
    g.interact();
    return { kind };
  });
  await until(() => document.querySelectorAll('.vs-worldmap.travel .dest').length > 0);
  const listing = await ev(() => ({ mode: window.__dev.ui.worldMap.value && window.__dev.ui.worldMap.value.mode, towns: document.querySelectorAll('.vs-worldmap .dest.town').length, title: document.querySelector('.vs-worldmap h2').innerText }));
  check('the teleporter opens the map in travel mode, listing the destinations', use.kind === 'teleporter' && listing.mode === 'travel' && listing.towns >= 1, JSON.stringify({ use, listing }));
  // pick the other town in the list, see the fare, travel
  await setGold(5000);
  const fare = await ev(([a, b]) => window.game.travel.from(a).find((d) => d.node.id === b).fare, [node(A.id), node(B.id)]);
  await page.click(`.vs-worldmap [data-dest="${node(B.id)}"]`);
  await until(() => !!document.querySelector('.vs-worldmap .confirm .go'));
  const bar = await ev(() => document.querySelector('.vs-worldmap .confirm').innerText);
  await page.click('.vs-worldmap .confirm .go');
  await inTown(B.id);
  const landed = await ev(() => { const g = window.game, tp = g.interior.services.teleporter, p = g.state.player; return { d: Math.round(Math.hypot(p.wx - tp.x, p.wy - tp.y)), gold: g.state.wallet.gold, map: !!window.__dev.ui.worldMap.value }; });
  check('town to town costs the fare and lands on the other town\'s teleporter', fare > 0 && bar.includes(String(fare)) && 5000 - landed.gold === fare && landed.d < 100 && !landed.map, JSON.stringify({ fare, bar, landed }));
  // without the fare: the Travel button is off and the trip is refused
  await setGold(0);
  await ev((id) => window.game.travel.open(id), node(B.id));
  await until(() => document.querySelectorAll('.vs-worldmap.travel .dest').length > 0);
  await page.click(`.vs-worldmap [data-dest="${node(A.id)}"]`);
  await until(() => !!document.querySelector('.vs-worldmap .confirm .go'));
  const poor = await ev(([b, a]) => { const g = window.game; return { disabled: document.querySelector('.vs-worldmap .confirm .go').disabled, ok: g.travel.go(b, a), here: g.interiorPoi.id, busy: g.busy }; }, [node(B.id), node(A.id)]);
  await page.keyboard.press('Escape');
  await until(() => !window.__dev.ui.worldMap.value);
  check('without the fare the trip is refused', poor.disabled && !poor.ok && poor.here === B.id && !poor.busy, JSON.stringify(poor));
  // two waypoints of the party's own, near the start
  await ev(() => window.game.exitPlace()); await outside();
  await goTo(0, 0);
  const wps = await ev(() => {
    const g = window.game, { newTower } = window.__dev.towersApi;
    const spot = (minR) => { for (let r = minR; r < 520; r += 2) for (let a = 0; a < 6.28; a += 0.05) { const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r); if (g.towers.check('waypoint', tx, ty).ok) return { tx, ty }; } return null; };
    const build = (s) => { const rec = newTower('waypoint', s.tx, s.ty); g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec); const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 99999; g.towers.deliver(rec); return rec.id; };
    return [build(spot(30)), build(spot(80))];
  });
  await setGold(500);
  const w2w = await ev(([a, b]) => { const g = window.game; return { fare: g.travel.from(a).find((d) => d.node.id === b).fare, ok: g.travel.go(a, b) }; }, wps);
  await until(() => !window.game.busy);
  const wpAt = await ev((b) => { const g = window.game, r = g.towers.byId(b), p = g.state.player; return { d: Math.round(Math.hypot(p.wx - (r.tx + 0.5) * 48, p.wy - (r.ty + 0.5) * 48)), gold: g.state.wallet.gold, mode: g.mode }; }, wps[1]);
  check('waypoint to waypoint is free', w2w.ok && w2w.fare === 0 && wpAt.gold === 500 && wpAt.d < 160 && wpAt.mode === 'overworld', JSON.stringify({ w2w, wpAt }));
  // a waypoint to a town is paid, and from the town back out to a waypoint too
  await setGold(5000);
  const w2t = await ev(([b, a]) => { const g = window.game; const fare = g.travel.from(b).find((d) => d.node.id === a).fare; return { fare, ok: g.travel.go(b, a) }; }, [wps[1], node(A.id)]);
  await inTown(A.id);
  const tAt = await ev(() => { const g = window.game, tp = g.interior.services.teleporter, p = g.state.player; return { d: Math.round(Math.hypot(p.wx - tp.x, p.wy - tp.y)), gold: g.state.wallet.gold }; });
  check('a waypoint to a town is paid and lands on its teleporter', w2t.ok && w2t.fare > 0 && 5000 - tAt.gold === w2t.fare && tAt.d < 100, JSON.stringify({ w2t, tAt }));
  const t2w = await ev(([a, w]) => { const g = window.game, g0 = g.state.wallet.gold; const fare = g.travel.from(a).find((d) => d.node.id === w).fare; return { fare, g0, ok: g.travel.go(a, w) }; }, [node(A.id), wps[0]]);
  await until(() => !window.game.busy && window.game.mode === 'overworld', undefined, 20000);
  const owAt = await ev((w) => { const g = window.game, r = g.towers.byId(w), p = g.state.player; return { d: Math.round(Math.hypot(p.wx - (r.tx + 0.5) * 48, p.wy - (r.ty + 0.5) * 48)), gold: g.state.wallet.gold }; }, wps[0]);
  check('a town out to a waypoint is paid and leaves the town', t2w.ok && t2w.fare > 0 && t2w.g0 - owAt.gold === t2w.fare && owAt.d < 160, JSON.stringify({ t2w, owAt }));
  // a waypoint's own E opens the same travel map
  const wpUse = await ev((w) => {
    const g = window.game, r = g.towers.byId(w), p = g.state.player;
    p.wx = (r.tx + 0.5) * 48; p.wy = (r.ty + 0.5) * 48 + 70; g.gameLoop(1); g.updateInteraction();
    const kind = g.target && g.target.kind; g.interact();
    return { kind, map: window.__dev.ui.worldMap.value };
  }, wps[0]);
  await page.keyboard.press('Escape');
  await until(() => !window.__dev.ui.worldMap.value);
  check('using a waypoint opens the travel map too', wpUse.kind === 'tower' && wpUse.map && wpUse.map.mode === 'travel' && wpUse.map.from === wps[0], JSON.stringify(wpUse));
  // attuned teleporters are kept in the save
  await ev(async () => { await window.game.requestSave('test', true); });
  await page.reload();
  await page.waitForFunction(() => !!window.game && window.game.titleReady);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player && window.__dev, null, { timeout: 15000 });
  await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });
  const kept = await ev(([a, b, w]) => { const t = window.game.travel; return { a: !!t.node(a), b: !!t.node(b), w: !!t.node(w) }; }, [node(A.id), node(B.id), wps[0]]);
  check('attuned teleporters and waypoints are still in the network after a reload', kept.a && kept.b && kept.w, JSON.stringify(kept));
}

// ---- 10f: one pixel grain for everything, screen filters, and the ground felt on screen
if (want('look')) {
  const frames = (n) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const state = () => ev(() => {
    const g = window.game, wf = g.worldContainer.filters || [], sf = g.sceneRoot.filters || [], c = g.look.cell;
    return {
      world: wf.length, scene: sf.length, cell: +c.toFixed(3),
      snapped: c > 0 ? Math.abs(g.worldContainer.x / c - Math.round(g.worldContainer.x / c)) < 1e-6 && Math.abs(g.worldContainer.y / c - Math.round(g.worldContainer.y / c)) < 1e-6 : null,
      hud: g.ui.container.parent === g.app.stage, names: g.occlusion.layer.parent === g.app.stage, inScene: g.worldContainer.parent === g.sceneRoot && g.lighting.sprite.parent === g.sceneRoot
    };
  });
  await goTo(0, 0);
  await frames(10);
  const pixel = await state();
  check('the pixel style is the default: the world is drawn at one grain, the camera snaps to it', pixel.world === 1 && pixel.cell >= 2 && pixel.snapped === true, JSON.stringify(pixel));
  check('the HUD and the names stay outside the filtered scene', pixel.hud && pixel.names && pixel.inScene, JSON.stringify(pixel));
  await ev(() => window.__dev.setSettings({ artStyle: 'smooth' }));
  await frames(10);
  const smooth = await state();
  check('the smooth style takes the world filter off entirely', smooth.world === 0 && smooth.scene === 0 && smooth.cell === 0, JSON.stringify(smooth));
  const fx = [];
  for (const [postFx, colorGrade] of [['pixelate', 'none'], ['crt', 'none'], ['grain', 'warm'], ['none', 'noir'], ['none', 'none']]) {
    await ev((p) => window.__dev.setSettings(p), { postFx, colorGrade });
    const f0 = await ev(() => window.game.app.ticker.lastTime);
    await frames(8);
    const st = await state();
    fx.push({ postFx, colorGrade, scene: st.scene, ticking: (await ev(() => window.game.app.ticker.lastTime)) > f0 });
  }
  check('each screen filter and colour grade switches on and the game keeps drawing', fx.slice(0, 4).every((f) => f.scene === 1 && f.ticking) && fx[4].scene === 0, JSON.stringify(fx));
  // a click on the curved CRT glass lands where the picture shows it
  const warp = await ev(() => { const g = window.game; window.__dev.setSettings({ postFx: 'crt' }); const a = g.screenToWorld(20, 20); window.__dev.setSettings({ postFx: 'none' }); const b = g.screenToWorld(20, 20); return { dx: Math.round(a.x - b.x), dy: Math.round(a.y - b.y) }; });
  check('clicks follow the CRT curve', warp.dx < 0 && warp.dy < 0, JSON.stringify(warp));
  // the ground under the hero: lava glows and shimmers, leaving it clears the look
  await ev(() => window.__dev.setSettings({ artStyle: 'pixel' }));
  const onLava = await ev(() => {
    const g = window.game, src = g.overworld;
    for (let r = 40; r < 900; r += 6) for (let a = 0; a < 64; a++) {
      const tx = Math.round(Math.cos(a / 64 * 6.283) * r), ty = Math.round(Math.sin(a / 64 * 6.283) * r);
      if (src.surfaceNumAt(tx, ty, src.biomeAt(tx, ty)) !== 1) continue;
      let w = 0; while (w < 30 && src.surfaceNumAt(tx + w, ty, src.biomeAt(tx + w, ty)) === 1) w++;
      if (w >= 3) return { x: (tx + 1.5) * 48, y: (ty + 0.5) * 48 };
    }
    return null;
  });
  const lookAt = async (x, y, n) => { await goTo(x, y); await ev(([x, y, n]) => { const g = window.game, p = g.state.player; for (let i = 0; i < n; i++) { p.wx = x; p.wy = y; g.gameLoop(1); } }, [x, y, n]); return ev(() => { const g = window.game, u = g.look.worldFx.uniforms; return { surf: g.surfaces.current && g.surfaces.current.id, tint: +u.uTintA.toFixed(3), shimmer: +u.uShimmer.toFixed(3), edge: +g.look.edge.alpha.toFixed(3), chip: window.__dev.ui.surface.value && window.__dev.ui.surface.value.name }; }); };
  const hot = onLava ? await lookAt(onLava.x, onLava.y, 60) : null;
  check('standing on lava tints the scene red, shimmers and glows at the edges', hot && hot.surf === 'lava' && hot.tint > 0.1 && hot.shimmer > 0.5 && hot.edge > 0.2 && hot.chip === 'Lava', JSON.stringify(hot));
  const off = onLava ? await lookAt(onLava.x - 30 * 48, onLava.y - 30 * 48, 90) : null;
  check('stepping off it clears the look', off && off.surf !== 'lava' && off.tint < 0.02 && off.edge < 0.02, JSON.stringify(off));
  await ev(() => window.__dev.setAccess({ reducedMotion: true }));
  const calm = onLava ? await lookAt(onLava.x, onLava.y, 60) : null;
  await ev(() => window.__dev.setAccess({ reducedMotion: false }));
  check('with reduced motion the lava still glows but does not shimmer', calm && calm.tint > 0.1 && calm.shimmer === 0, JSON.stringify(calm));
  await goTo(0, 0);
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll phase 10 checks passed');
process.exit(failed ? 1 : 0);
