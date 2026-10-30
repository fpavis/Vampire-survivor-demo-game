// End-to-end smoke test: boots the built game in headless Chromium and drives the main flows.
// Usage: npm run build && npm run test:e2e   (set CHROMIUM_PATH to use a specific browser binary)
import { suite } from './harness.mjs';

const h = await suite('smoke', { viewport: { width: 1100, height: 650 } });
const { check, slow } = h;
const page = await h.newPage();

await page.goto(h.url);
await page.waitForFunction(() => !!window.game, null, { timeout: 15000 * slow });
check('game boots', true);

await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 5000 * slow });
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
await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 8000 * slow });
check('can enter a place', true);
await page.evaluate(() => { const g = window.game; const p = g.state.player; p.wx = g.interior.exit.x; p.wy = g.interior.exit.y + 10; g.gameLoop(1); });
await page.keyboard.press('e');
await page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 8000 * slow });
check('can leave a place', true);

await page.keyboard.press('m');
const paused = await page.evaluate(() => window.game.state.paused);
check('world map opens (pauses)', paused === true);
await page.keyboard.press('m');

await h.finish();
