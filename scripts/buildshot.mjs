// Visual check of the Phase 6 UI: build menu, placement ghost, tower panel, ward dome, sailing.
// Usage: npm run build && node scripts/buildshot.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'ui';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4205', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { window.__forceSeed = 2024; });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4205/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter'); await p.waitForFunction(() => window.game.state.player);
await p.evaluate(() => {
  const g = window.game, T = 48;
  g.godMode = true; g.state.nextLevel = 1e12; g.popRuntime.population = null;
  const w = g.state.wallet; w.gold = 400; w.wood = 90; w.stone = 120; w.iron = 20;
  window.spot = (kind) => { for (let r = 14; r < 300; r += 2) for (let a = 0; a < 6.28; a += 0.03) { const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r); const res = g.towers.check(kind, tx, ty); if (res.ok) return { tx, ty, plan: res.plan }; } return null; };
  window.go = (x, y) => { const q = g.state.player; q.wx = x; q.wy = y; g.cam.x = x; g.cam.y = y; g.lastFogTx = null; g.world.update(x, y, 1280, 720, true); for (const e of [...g.state.enemies]) e.dead = true; g.reap(); };
});
const shot = async (name) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` }); };

// build menu
const sp = await p.evaluate(() => { const s = window.spot('spire'); window.go((s.tx - 2.9) * 48, (s.ty + 0.5) * 48); window.game.pointerKind = 'key'; window.game.lastMove = { x: 1, y: 0 }; for (let i = 0; i < 5; i++) window.game.gameLoop(1); return s; });
await p.keyboard.press('b'); await p.waitForSelector('.vs-build'); await shot('menu');
await p.locator('.vs-build .vs-good', { hasText: 'Arcane Spire' }).locator('button').click();
await p.evaluate(() => { const g = window.game; g.pointerKind = 'key'; g.state.pointerPosition = null; g.lastMove = { x: 1, y: 0 }; g.gameLoop(2); });
await shot('ghost-valid');
await p.evaluate((s) => { window.go((s.tx - 2.9) * 48 - 48 * 14, (s.ty + 0.5) * 48); const g = window.game; g.pointerKind = 'key'; g.lastMove = { x: 0, y: 1 }; for (let i = 0; i < 5; i++) g.gameLoop(1); }, sp);
await shot('ghost-other');
await p.evaluate((s) => { window.go((s.tx - 2.9) * 48, (s.ty + 0.5) * 48); const g = window.game; g.lastMove = { x: 1, y: 0 }; for (let i = 0; i < 5; i++) g.gameLoop(1); }, sp);
await p.keyboard.press('Enter');
await p.evaluate(() => { const g = window.game; for (let i = 0; i < 3; i++) g.gameLoop(1); const rec = g.towers.recs[0], c = { x: (rec.tx + .5) * 48, y: (rec.ty + .5) * 48 }; window.go(c.x, c.y + 110); g.cam.y = c.y - 20; });
await shot('site');
await p.evaluate(() => { const g = window.game, rec = g.towers.recs[0]; const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 999; g.towers.deliver(rec); });
await p.waitForTimeout(500); await shot('ceremony');
await p.evaluate(() => { const g = window.game, rec = g.towers.recs[0]; g.spells.addSpell('nova'); const cand = g.towers.candidates(); g.towers.arm(rec.id, cand[cand.length - 1].uid); const c = { x: (rec.tx + .5) * 48, y: (rec.ty + .5) * 48 }; window.go(c.x, c.y + 80); g.gameLoop(3); g.updateInteraction(); });
await p.keyboard.press('e'); await p.waitForSelector('.vs-tpanel'); await shot('spire-panel');
await p.keyboard.press('e').catch(() => {});

// ward dome
await p.evaluate(() => { const g = window.game; g.towers.arm; const s = window.spot('ward'); const { newTower } = window.__dev.towersApi; const rec = newTower('ward', s.tx, s.ty); g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec); g.towers.deliver(rec); window.go((s.tx + 0.5) * 48 + 150, (s.ty + 0.5) * 48 + 150); for (let i = 0; i < 90; i++) g.gameLoop(1); });
await shot('ward');

// sailing
await p.evaluate(() => {
  const g = window.game; const s = window.spot('dock'); const { newTower } = window.__dev.towersApi; const rec = newTower('dock', s.tx, s.ty, s.plan); g.towers.recs.push(rec); g.towers.rebuildWorld(true, rec);
  const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 999; g.towers.deliver(rec);
  const c = { x: (rec.tx + .5) * 48, y: (rec.ty + .5) * 48 }; window.go(c.x, c.y + 70); for (let i = 0; i < 40; i++) g.gameLoop(1);
  g.sea.board(rec.id);
  const [dx, dy] = window.__dev.towersApi.DIRS[rec.dir]; g.state.keys.d = dx > 0; g.state.keys.a = dx < 0; g.state.keys.s = dy > 0; g.state.keys.w = dy < 0;
  for (let i = 0; i < 160; i++) g.gameLoop(1);
  g.state.keys.d = g.state.keys.a = g.state.keys.s = g.state.keys.w = false;
});
await shot('sailing');
await b.close(); pv.kill();
