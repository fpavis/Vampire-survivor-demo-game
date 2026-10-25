// End-to-end smoke test: boots the built game in headless Chromium and drives the main flows.
// Usage: npm run build && npm run test:e2e   (set CHROMIUM_PATH to use a specific browser binary)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4179;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-preview.pid); } catch { /* ignore */ } };
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

try {
  await waitForServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => !!window.game, null, { timeout: 15000 });
  check('game boots', true);

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player, null, { timeout: 5000 });
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.game.gameLoop(1); });
  const s1 = await page.evaluate(() => ({ mode: window.game.mode, hp: window.game.state.health, t: window.game.state.time }));
  check('new game runs', s1.mode === 'overworld' && s1.hp > 0 && s1.t > 1, JSON.stringify(s1));

  // enter and leave a place of interest
  const poi = await page.evaluate(() => {
    const src = window.game.overworld;
    for (let r = 0; r < 40; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
      if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
      const p = src.poiForCell(cx, cy);
      if (p) return p;
    }
    return null;
  });
  check('a place of interest exists nearby', !!poi);
  await page.evaluate((p) => {
    const pl = window.game.state.player; pl.wx = p.ex; pl.wy = p.ey; window.game.cam.x = pl.wx; window.game.cam.y = pl.wy;
    window.game.world.update(pl.wx, pl.wy, 1100, 650, true); window.game.gameLoop(1);
  }, poi);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 8000 });
  check('can enter a place', true);
  await page.evaluate(() => { const g = window.game; const p = g.state.player; p.wx = g.interior.exit.x; p.wy = g.interior.exit.y + 10; g.gameLoop(1); });
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 8000 });
  check('can leave a place', true);

  await page.keyboard.press('m');
  const paused = await page.evaluate(() => window.game.state.paused);
  check('world map opens (pauses)', paused === true);
  await page.keyboard.press('m');

  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
} catch (e) {
  console.error(e);
  failed++;
} finally {
  stop();
}
process.exit(failed ? 1 : 0);
