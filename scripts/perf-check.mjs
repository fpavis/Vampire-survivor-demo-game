// A performance budget for CI. Counts that do not depend on the machine (draw calls, objects alive, chunks
// built on a walk) have tight budgets; the simulation step has a loose one, as CI runners vary in speed.
// Usage: npm run build && node scripts/perf-check.mjs   (exits 1 when anything is over budget)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const BUDGET = {
  drawCalls: 40,          // per frame in the crowded fight (25 at 0.15)
  objectLayer: 1400,      // display objects in the world layer at once (about 960)
  particles: 460,         // the high preset's cap, plus a little (about 445)
  chunkBuilds: 60,        // chunk views built on a 600-frame walk across the world (31)
  stepMs: 30              // average simulation step, crowded fight (about 5 ms on a developer machine)
};

const PORT = 4185;
const pv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-pv.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.addInitScript(() => { window.__forceSeed = 2024; });
await p.goto(`http://localhost:${PORT}/`);
await p.waitForFunction(() => !!window.game && window.game.titleReady, null, { timeout: 60000 });
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.game.state.player, null, { timeout: 60000 });

const res = await p.evaluate(() => {
  const g = window.game, s = g.state, sp = g.spells;
  g.godMode = true; s.nextLevel = 1e12;
  g.app.ticker.stop();
  // a seeded random, so the fight is the same every run
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  Math.random = rnd;

  // the walk: east across the world at a brisk pace, counting chunk views built
  let builds = 0;
  const bv = g.world.buildView.bind(g.world);
  g.world.buildView = (cx, cy) => { builds++; return bv(cx, cy); };
  const pl = s.player;
  for (let f = 0; f < 600; f++) { pl.wx += 14; g.cam.x = pl.wx; g.cam.y = pl.wy; g.lastFogTx = null; g.gameLoop(1); }
  g.world.buildView = bv;

  // the crowded fight: 150 monsters closing in, five auto-cast spells at their best
  for (const e of s.enemies) e.dead = true;
  g.reap();
  const ids = ['bolt', 'orbit', 'lightning', 'meteor', 'wisp'];
  const items = ids.map((id) => { const it = sp.addSpell(id, 8); it.runes = id === 'bolt' || id === 'wisp' ? ['multishot', 'piercing'] : id === 'meteor' ? ['multishot', null] : it.runes; return it; });
  sp.setLoadout(items.map((it) => it.uid), sp.active);
  const kinds = ['SLIME', 'BAT', 'WOLF', 'SPIDER', 'BOAR', 'SKELETON'];
  const spawn = () => {
    const a = rnd() * Math.PI * 2, d = 380 + rnd() * 420;
    const e = g.makeEnemy(kinds[Math.floor(rnd() * kinds.length)], pl.wx + Math.cos(a) * d, pl.wy + Math.sin(a) * d, { level: 3 });
    e.health = e.maxHealth = e.maxHealth * 6;
  };
  const gl = g.app.renderer.gl;
  let draws = 0;
  const de = gl.drawElements.bind(gl), da = gl.drawArrays.bind(gl);
  gl.drawElements = (...a) => { draws++; return de(...a); };
  gl.drawArrays = (...a) => { draws++; return da(...a); };
  const step = [];
  let objectLayer = 0, particles = 0, rendered = 0;
  for (let f = 0; f < 360; f++) {
    while (s.enemies.length < 150) spawn();
    const t0 = performance.now();
    g.gameLoop(1);
    if (f >= 60) step.push(performance.now() - t0);
    // render every 4th frame only: the software GPU of a CI runner is slow, and draw calls do not change with it
    if (f % 4 === 0) { if (f === 60) draws = 0; g.app.renderer.render(g.app.stage); if (f >= 60) rendered++; }
    objectLayer = Math.max(objectLayer, g.objectLayer.children.length);
    particles = Math.max(particles, g.fx.particles.length);
  }
  return { drawCalls: Math.round(draws / Math.max(1, rendered)), objectLayer, particles, chunkBuilds: builds, stepMs: +(step.reduce((x, y) => x + y, 0) / step.length).toFixed(2) };
});
await b.close();
stop();

let over = 0;
console.log('measure        value   budget');
for (const k of Object.keys(BUDGET)) {
  const ok = res[k] <= BUDGET[k];
  if (!ok) over++;
  console.log(`${k.padEnd(14)} ${String(res[k]).padStart(6)}   ${String(BUDGET[k]).padStart(6)}  ${ok ? 'ok' : 'OVER BUDGET'}`);
}
if (errors.length) { console.log('page errors:', errors.slice(0, 3).join(' | ')); over++; }
console.log(over ? `\n${over} over budget` : '\nwithin budget');
process.exit(over ? 1 : 0);
