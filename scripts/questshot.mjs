// Visual check of the quest UI: the elder and the board in town, the dialogue, the journal, the board panel, the tracker.
// Usage: npm run build && node scripts/questshot.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'qs';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4208', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { window.__forceSeed = 2024; });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4208/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter'); await p.waitForFunction(() => window.game.state.player);
const shot = async (n) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/${TAG}-${n}.png` }); };
await p.evaluate(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; g.popRuntime.population = null; });
await p.evaluate(() => {
  const g = window.game, src = g.overworld; let town = null;
  for (let r = 0; r < 60 && !town; r++) for (let cy = -r; cy <= r && !town; cy++) for (let cx = -r; cx <= r && !town; cx++) { if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue; const q = src.poiForCell(cx, cy); if (q && q.type === 'city') town = q; }
  g.enterPlace(town);
});
await p.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy);
await p.evaluate(() => {
  const g = window.game, it = g.interactables.find((i) => i.kind === 'elder'), q = g.state.player;
  for (const c of g.critters.list) { c.wx = c.tx = it.x + 900; c.wy = c.ty = it.y + 900; c.home = { x: c.wx, y: c.wy, r: 5 }; c.wait = 9999; }
  q.wx = it.x + 40; q.wy = it.y + 12; g.cam.x = it.x + 150; g.cam.y = it.y + 40; g.world.update(g.cam.x, g.cam.y, 1280, 720, true); g.gameLoop(5); g.updateInteraction();
});
await shot('elder');
await p.evaluate(() => window.game.interact());
await p.waitForSelector('.vs-dialog');
await shot('dialogue');
await p.locator('.vs-dialog .vs-choices button').first().click();
await p.locator('.vs-dialog .vs-choices button', { hasText: 'We will fight' }).click();
await p.locator('.vs-dialog .vs-choices button').first().click();
await p.evaluate(() => { const g = window.game, q = g.state.player; for (let i = 0; i < 7; i++) { const e = g.makeEnemy('SLIME', q.wx + 400, q.wy, { level: 1 }); e.untargetable = false; g.damageEnemy(e, 1e9, { noCrit: true }); } g.gameLoop(2); });
await p.keyboard.press('j'); await p.waitForSelector('.vs-journal');
await shot('journal');
await p.keyboard.press('j');
await p.evaluate(() => {
  const g = window.game, it = g.interactables.find((i) => i.kind === 'board'), q = g.state.player;
  q.wx = it.x - 40; q.wy = it.y + 14; g.cam.x = it.x - 150; g.cam.y = it.y + 40; g.world.update(g.cam.x, g.cam.y, 1280, 720, true); g.gameLoop(5); g.updateInteraction(); g.interact();
});
await p.waitForSelector('.vs-board');
await shot('board');
await b.close(); pv.kill();
