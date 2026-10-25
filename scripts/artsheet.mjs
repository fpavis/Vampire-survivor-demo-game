// Visual check: every hero, enemy, pickup and spell sprite laid out on one sheet.
// Usage: npm run build && node scripts/artsheet.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'sheet';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4197', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1500, height: 1180 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4197/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.game.state.player && window.__dev);
await p.evaluate(() => {
  const { PIXI, EntityManager, ENEMY_TYPES, game } = window.__dev;
  const app = game.app;
  const sheet = new PIXI.Container(); sheet.zIndex = 5000; app.stage.addChild(sheet);
  const bg = new PIXI.Graphics(); bg.beginFill(0x5a7a4a); bg.drawRect(0, 0, 1500, 1180); bg.endFill();
  for (let y = 0; y < 1180; y += 24) for (let x = 0; x < 1500; x += 24) if ((x + y) % 48 === 0) { bg.beginFill(0x527044); bg.drawRect(x, y, 24, 24); bg.endFill(); }
  sheet.addChild(bg);
  const items = [];
  const label = (t, x, y) => { const s = new PIXI.Text(t, { fontFamily: 'Arial', fontSize: 11, fill: 0xffffff, stroke: 0x000000, strokeThickness: 3 }); s.anchor.set(0.5, 0); s.position.set(x, y); sheet.addChild(s); };
  const put = (c, x, y, name, scale = 1.3) => { c.position.set(x, y); c.scale.set(scale); sheet.addChild(c); label(name, x, y + 8); items.push(c); };
  // heroes
  const heroes = game.party.heroes.map((h, i) => {
    const pl = EntityManager.createPlayer(game.party.heroes[i].id);
    const def = game.party.def(i);
    pl.aura.tint = def.color; if (pl.aura.baked) pl.aura.baked.tint = def.color;
    put(pl, 90 + i * 120, 150, def.name, 1.6); pl.facing = 1; return pl;
  });
  // enemies
  const keys = Object.keys(ENEMY_TYPES);
  const enemies = keys.map((k, i) => {
    const e = EntityManager.createEnemy(k, 0, 0); e.ai = null;
    const big = ENEMY_TYPES[k].boss;
    const col = i % 8, row = Math.floor(i / 8);
    put(e, 95 + col * 182, 370 + row * 270 + (big ? 50 : 0), ENEMY_TYPES[k].name, big ? 1.15 : 2);
    return e;
  });
  // pickups & spells
  const misc = [];
  [[3, 'gem'], [12, 'gem'], [30, 'gem'], [80, 'gem'], [25, 'coin'], [3, 'wood'], [3, 'stone'], [2, 'iron'], [0, 'heart']].forEach(([v, k], i) => {
    const g = EntityManager.createGem(0, 0, v, k); put(g, 520 + i * 60, 150, k, 1.6); misc.push(g);
  });
  const bolt = EntityManager.createBolt(0, 0, 0, 0xffd84a); put(bolt, 1120, 160, 'bolt', 1.8);
  const blade = EntityManager.createBlade(); put(blade, 1200, 160, 'blade', 1.8);
  let t = 0;
  app.ticker.add(() => {
    t++;
    heroes.forEach((h, i) => EntityManager.animatePlayer(h, t, i === 1, 1));
    enemies.forEach((e) => EntityManager.animateEnemy(e));
    misc.forEach((g) => EntityManager.animateGem(g, t));
  });
  game.state.paused = true;
  const ui = document.getElementById('ui-root'); if (ui) ui.style.display = 'none';
});
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/${TAG}.png` });
// close-up of the heroes and pickups
await p.screenshot({ path: `${OUT}/${TAG}-heroes.png`, clip: { x: 0, y: 30, width: 740, height: 170 } });
await p.screenshot({ path: `${OUT}/${TAG}-pickups.png`, clip: { x: 480, y: 70, width: 780, height: 130 } });
await b.close(); pv.kill();
