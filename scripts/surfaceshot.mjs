// Visual check: teleports next to each kind of ground surface and takes a screenshot.
// Usage: npm run build && node scripts/surfaceshot.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'surf';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4201', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4201/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter'); await p.waitForFunction(() => window.game.state.player);
const ids = ['lava', 'swamp', 'mud', 'ice', 'quicksand', 'tidal', 'spring', 'manawell', 'glyph'];
for (const id of ids) {
  const found = await p.evaluate((id) => {
    const g = window.game, T = 48; g.godMode = true; g.state.nextLevel = 1e12;
    for (let r = 28; r < 420; r += 3) for (let a = 0; a < 6.28; a += 0.07) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      const s = g.world.surfaceAtPos(tx * T + 24, ty * T + 24);
      if (s && s.id === id) {
        const pl = g.state.player; pl.wx = tx * T + 24; pl.wy = ty * T + 24 + 60; g.cam.x = pl.wx; g.cam.y = pl.wy; g.lastFogTx = null;
        g.world.update(pl.wx, pl.wy, 1280, 720, true);
        for (const e of [...g.state.enemies]) e.dead = true; g.reap();
        for (let i = 0; i < 40; i++) g.gameLoop(1);
        return { tx, ty };
      }
    }
    return null;
  }, id);
  console.log(id, JSON.stringify(found));
  if (found) { await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/${TAG}-${id}.png` }); }
}
await b.close(); pv.kill();
