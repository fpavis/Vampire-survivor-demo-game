// Visual check of dungeons: sealed and open stairs, the boss floor, plateau and island entrances.
// Usage: npm run build && node scripts/dungeonshot.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'dg';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4207', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { window.__forceSeed = 2024; });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4207/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter'); await p.waitForFunction(() => window.game.state.player);
const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${TAG}-${n}.png` }); };
await p.evaluate(() => {
  const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; g.popRuntime.population = null;
  window.stand = (x, y) => { const q = g.state.player; q.wx = x; q.wy = y; g.cam.x = x; g.cam.y = y; g.world.update(x, y, 1280, 720, true); for (let i = 0; i < 20; i++) g.gameLoop(1); };
  const src = g.overworld; let best = null;
  for (let r = 0; r < 40; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) { if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue; const q = src.poiForCell(cx, cy); if (q && q.dungeon && (!best || Math.hypot(q.tx, q.ty) < Math.hypot(best.tx, best.ty))) best = q; }
  window.__poi = best;
  g.state.player.wx = best.ex; g.state.player.wy = best.ey - 120; g.cam.x = best.ex; g.cam.y = best.ey - 120; g.world.update(best.ex, best.ey - 120, 1280, 720, true); for (let i = 0; i < 20; i++) g.gameLoop(1);
});
await shot('entrance');
await p.evaluate(() => window.game.enterPlace(window.__poi));
await p.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy);
await p.evaluate(() => { const g = window.game; const s = g.interior.stairsDown; window.stand(s.x - 20, s.y + 110); });
await shot('stairs-sealed');
await p.evaluate(() => { const g = window.game; for (const e of [...g.state.enemies]) if (e.guardian) { e.untargetable = false; g.damageEnemy(e, 1e9, { noCrit: true }); } const s = g.interior.stairsDown; window.stand(s.x - 20, s.y + 110); });
await shot('stairs-open');
const floors = await p.evaluate(() => window.game.interior.floors);
for (let f = 1; f < floors; f++) {
  await p.evaluate(() => window.game.changeFloor(1));
  await p.waitForFunction((n) => window.game.floor === n && !window.game.busy, f, { timeout: 12000 });
}
await p.evaluate(() => { const g = window.game; const s = g.interior.boss; window.stand(s.x - 20, s.y + 280); });
await shot('boss');
await b.close(); process.kill(-pv.pid);
