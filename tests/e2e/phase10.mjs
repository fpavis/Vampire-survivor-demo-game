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
    await goTo(trig.x, trig.y);
    const amb = await ev((s) => {
      const g = window.game, p = g.state.player;
      for (const e of [...g.state.enemies]) if (!e.siteId) { e.dead = true; e.silent = true; }
      g.reap();
      g.sites.timer = 0;
      for (let i = 0; i < 3; i++) { p.wx = s.x; p.wy = s.y; g.gameLoop(1); }
      const mine = () => g.state.enemies.filter((e) => e.siteId === s.id && !e.dead);
      const ms = mine();
      const dists = ms.map((e) => Math.hypot(e.wx - s.x, e.wy - s.y));
      const angles = ms.map((e) => Math.atan2(e.wy - s.y, e.wx - s.x)).sort((a, b) => a - b);
      let gap = angles.length ? angles[0] + Math.PI * 2 - angles[angles.length - 1] : 0;
      for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i] - angles[i - 1]);
      const asleep = ms.filter((e) => e.dormant).length;
      for (let i = 0; i < 140; i++) { p.wx = s.x; p.wy = s.y; g.gameLoop(1); }
      const awake = mine().filter((e) => !e.dormant).length;
      for (const e of mine()) g.damageEnemy(e, 1e9, { noCrit: true });
      g.sites.timer = 0; for (let i = 0; i < 30; i++) g.gameLoop(1);
      return { waves: s.waves, n: ms.length, min: Math.round(Math.min(...dists)), max: Math.round(Math.max(...dists)), gap: Math.round(gap * 180 / Math.PI), asleep, awake };
    }, trig);
    check('an ambush springs half again as many monsters, 6 or more', amb.n >= 6 && amb.n === Math.max(6, Math.min(15, Math.round(amb.waves * 1.5))), JSON.stringify(amb));
    check('they rise well away from the plate and leave one side open', amb.min >= 300 && amb.gap >= 110, JSON.stringify(amb));
    check('they show themselves first, then close in group by group', amb.asleep === amb.n && amb.awake === amb.n, JSON.stringify(amb));
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

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll phase 10 checks passed');
process.exit(failed ? 1 : 0);
