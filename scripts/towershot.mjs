// Visual check: builds every kind of tower (and a scaffold) at a valid spot and takes screenshots.
// Usage: npm run build && node scripts/towershot.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { findChromium } from './lib/browser.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'tw';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4204', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { window.__forceSeed = 2024; });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4204/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter'); await p.waitForFunction(() => window.game.state.player);
await p.evaluate(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; g.popRuntime.population = null; });
const kinds = ['spire', 'ward', 'beacon', 'waypoint', 'climb', 'bridge', 'dock'];
for (const kind of kinds) {
  const info = await p.evaluate((kind) => {
    const g = window.game, T = 48;
    for (let r = 30; r < 520; r += 2) for (let a = 0; a < 6.28; a += 0.03) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      const res = g.towers.check(kind, tx, ty);
      if (!res.ok) continue;
      if (kind === 'bridge') { /* any valid crossing */ }
      const { newTower } = window.__dev.towersApi;
      const rec = { ...newTower(kind, tx, ty, res.plan), built: true };
      g.towers.recs.push(rec);
      g.towers.rebuildWorld(true, rec);
      const p = g.state.player; p.wx = (tx + 0.5) * T + 40; p.wy = (ty + 0.5) * T + 190; g.cam.x = p.wx; g.cam.y = p.wy - 60; g.lastFogTx = null;
      g.world.update(g.cam.x, g.cam.y, 1280, 720, true);
      for (const e of [...g.state.enemies]) e.dead = true; g.reap();
      for (let i = 0; i < 60; i++) g.gameLoop(1);
      // oxlint-disable-next-line no-self-assign -- the setter refreshes the docks
      if (kind === 'dock') g.towers.complete = g.towers.complete;
      return { tx, ty, plan: res.plan };
    }
    return null;
  }, kind);
  console.log(kind, JSON.stringify(info));
  if (info) { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${TAG}-${kind}.png` }); }
}
await b.close(); process.kill(-pv.pid);
