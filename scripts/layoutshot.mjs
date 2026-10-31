// Visual check of the HUD layout and depth sorting at three screen sizes: the HUD, the loadout, the journal and a
// town with a hero standing behind a stall and a wall. Also prints any HUD element that covers an open panel.
// Usage: npm run build && node scripts/layoutshot.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { findChromium } from './lib/browser.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'lay';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4209', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });

// which visible HUD elements overlap the open panel?
const covering = (p) => p.evaluate(() => {
  const panel = [...document.querySelectorAll('#ui-root .vs-panel')].pop();
  if (!panel) return [];
  const a = panel.getBoundingClientRect();
  const out = [];
  for (const el of document.querySelectorAll('#ui-root .vs-hud, #ui-root .vs-hud *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
    if (r.right > a.left && r.left < a.right && r.bottom > a.top && r.top < a.bottom) {
      const z = (e) => Number(getComputedStyle(e).zIndex) || 0;
      if (z(el.closest('.vs-hud')) >= z(panel)) out.push(el.className);
    }
  }
  return out;
});

for (const [w, h, name] of [[1280, 720, 'desk'], [820, 460, 'land'], [390, 760, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { window.__forceSeed = 2024; });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4209/'); await p.waitForFunction(() => !!window.game);
  await p.keyboard.press('Enter'); await p.waitForFunction(() => window.game.state.player);
  await p.evaluate(() => {
    const g = window.game; g.godMode = true; g.state.nextLevel = 20; g.state.experience = 20; g.checkLevelUp(); g.state.nextLevel = 1e12;
    g.quests.state.flags.begun = true; g.quests.start(g.quests.lookup('m0_omen'));
    const p = g.state.player;
    for (let i = 0; i < 4; i++) { const e = g.makeEnemy('SLIME', p.wx + 120 + i * 40, p.wy + 30, { level: i < 2 ? 1 : 9 }); if (i % 2) e.health *= 0.5; }
    for (let i = 0; i < 30; i++) g.gameLoop(1);
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${TAG}-${name}-hud.png` });
  for (const [key, panel] of [['i', 'loadout'], ['j', 'journal']]) {
    await p.keyboard.press(key); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${TAG}-${name}-${panel}.png` });
    const cov = await covering(p);
    console.log(`${name} ${panel}: ${cov.length ? 'HUD over panel: ' + [...new Set(cov)].join(', ') : 'clear'}`);
    await p.keyboard.press(key); await p.waitForTimeout(200);
  }
  if (name === 'desk') {
    // the loadout as a controller player sees it: button hints, then the rune picker on an empty socket
    await p.evaluate(() => {
      const g = window.game;
      ['swift', 'heavy', 'multishot', 'frostbite', 'efficient'].forEach((r) => g.spells.addRune(r));
      g.input.setDevice('pad');
      g.input.openPanel('spells');
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${TAG}-${name}-pad-loadout.png` });
    await p.evaluate(() => { const s = document.querySelector('.vs-sock:not(.full)'); s?.focus(); s?.click(); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${TAG}-${name}-pad-picker.png` });
    await p.evaluate(() => { window.game.ui && window.game.input.back(); window.game.input.back(); window.game.input.setDevice('mouse'); });
    await p.waitForTimeout(200);
    // depth: the hero behind a tree, then behind a town wall
    await p.evaluate(() => {
      const g = window.game, p = g.state.player;
      let best = null;
      for (const v of g.world.views.values()) for (const o of v.objects) if (o.occ && Math.abs(o.x - p.x) < 600 && Math.abs(o.y - p.y) < 400 && (!best || o.height > best.height)) best = o;
      if (best) { p.wx = best.x + 6; p.wy = best.zIndex - 14; g.cam.x = p.wx; g.cam.y = p.wy; }
      for (let i = 0; i < 40; i++) g.gameLoop(1);
    });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${TAG}-${name}-behind-tree.png` });
    await p.evaluate(() => {
      const g = window.game, src = g.overworld; let town = null;
      for (let r = 0; r < 60 && !town; r++) for (let cy = -r; cy <= r && !town; cy++) for (let cx = -r; cx <= r && !town; cx++) { if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue; const q = src.poiForCell(cx, cy); if (q && q.type === 'city') town = q; }
      g.enterPlace(town);
    });
    await p.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy);
    const found = await p.evaluate(() => {
      // a free tile directly north of a wall
      const g = window.game, w = g.world, T = 48, p = g.state.player;
      const tx0 = Math.floor(p.wx / T), ty0 = Math.floor(p.wy / T);
      for (let r = 1; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const tx = tx0 + dx, ty = ty0 + dy;
        if (w.blocked((tx + 0.5) * T, (ty + 0.5) * T, 10)) continue;
        const b1 = w.biomeAt(tx, ty + 1);
        if (w.blocked((tx + 0.5) * T, (ty + 1.5) * T, 10) && [7, 8, 10, 12, 14, 15].includes(b1) && w.blocked((tx + 0.5) * T, (ty + 2.5) * T, 10)) {
          p.wx = (tx + 0.5) * T; p.wy = (ty + 0.9) * T; g.cam.x = p.wx; g.cam.y = p.wy; g.world.update(g.cam.x, g.cam.y, 1280, 720, true);
          for (let i = 0; i < 40; i++) g.gameLoop(1);
          return { tx, ty, ghost: g.occlusion.ghostOn };
        }
      }
      return null;
    });
    console.log('behind wall', JSON.stringify(found));
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${TAG}-${name}-behind-wall.png` });
  }
  await ctx.close();
}
await b.close(); process.kill(-pv.pid);
