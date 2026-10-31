// Visual check: every baked decoration sprite (trees, rocks, props, landmarks) on one sheet, at 1.5x.
// Usage: npm run build && node scripts/decorsheet.mjs <out-dir> [tag] [filter] [scale]
import { chromium } from 'playwright-core';
import { findChromium } from './lib/browser.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'decor'; const FILTER = process.argv[4] || ''; const SCALE = Number(process.argv[5]) || 1.5;
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4198', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4198/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.game.state.player && window.__dev);
await p.evaluate(([filter, scale]) => {
  const { PIXI, game } = window.__dev;
  const app = game.app;
  const sheet = new PIXI.Container(); sheet.zIndex = 5000; app.stage.addChild(sheet);
  const bg = new PIXI.Graphics(); bg.beginFill(0x6a8a4a); bg.drawRect(0, 0, 1500, 1100); bg.endFill();
  for (let y = 0; y < 1100; y += 24) for (let x = 0; x < 1500; x += 24) if ((x + y) % 48 === 0) { bg.beginFill(0x628244); bg.drawRect(x, y, 24, 24); bg.endFill(); }
  sheet.addChild(bg);
  const tex = game.world.decorTextures;
  const want = filter ? filter.split(',') : null;
  let x = 60, y = Math.max(150, 108 * scale), rowH = 0;
  for (const type of Object.keys(tex)) {
    if (want && !want.includes(type)) continue;
    tex[type].forEach((set, v) => {
      const s = new PIXI.Sprite(set.texture);
      s.anchor.set(0.5, set.anchorY);
      s.scale.set(scale);
      const w = Math.max(70, set.texture.width * scale + 12), h = set.texture.height * scale * set.anchorY;
      if (x + w > 1480) { x = 60; y += Math.max(rowH, 108 * scale) + 40; rowH = 0; }
      s.position.set(x + w / 2 - 30, y);
      sheet.addChild(s);
      const t = new PIXI.Text(`${type}${v ? ' ' + v : ''}`, { fontFamily: 'Arial', fontSize: 11, fill: 0xffffff, stroke: 0x000000, strokeThickness: 3 });
      t.anchor.set(0.5, 0); t.position.set(x + w / 2 - 30, y + 6); sheet.addChild(t);
      x += w; rowH = Math.max(rowH, h);
    });
  }
  game.state.paused = true;
  const ui = document.getElementById('ui-root'); if (ui) ui.style.display = 'none';
}, [FILTER, SCALE]);
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/${TAG}.png` });
await b.close(); process.kill(-pv.pid);
