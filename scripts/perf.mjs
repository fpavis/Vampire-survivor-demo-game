// Performance benchmark: 150 monsters closing in on a hero with a full, rune-boosted loadout (about 200 spell
// objects in flight), measured with the game ticker stopped so every frame is timed the same way.
// Usage: npm run build && node scripts/perf.mjs [frames]
// PERF_SETTINGS='{"artStyle":"smooth"}' applies settings first (to compare looks and screen filters).
// Prints average and 95th-percentile time of the simulation step (gameLoop) and of the render, draw calls per frame
// and object counts.
// Rendering runs on a software GPU here, so its numbers are only useful relative to each other.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const FRAMES = Number(process.argv[2]) || 600;
// own process group, so the preview server goes away with npx (a stale server would serve an old build)
const pv = spawn('npx', ['vite', 'preview', '--port', '4199', '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-pv.pid); } catch {} };
process.on('exit', stop);
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.addInitScript(() => { window.__forceSeed = 2024; });
await p.goto('http://localhost:4199/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.game.state.player);
if (process.env.PERF_SETTINGS) await p.evaluate((patch) => window.__dev.setSettings(patch), JSON.parse(process.env.PERF_SETTINGS));
const res = await p.evaluate((FRAMES) => {
  const g = window.game, s = g.state, sp = g.spells;
  g.godMode = true; s.nextLevel = 1e12;
  g.app.ticker.stop();
  // a busy loadout: five auto-cast spells at max level with extra projectiles
  const ids = ['bolt', 'orbit', 'lightning', 'meteor', 'wisp'];
  const items = ids.map((id) => { const it = sp.addSpell(id, 8); it.runes = id === 'bolt' || id === 'wisp' ? ['multishot', 'piercing'] : id === 'meteor' ? ['multishot', null] : it.runes; return it; });
  sp.setLoadout(items.map((it) => it.uid), sp.active);
  const p = s.player;
  const kinds = ['SLIME', 'BAT', 'WOLF', 'SPIDER', 'BOAR', 'SKELETON'];
  const spawn = () => {
    const a = Math.random() * Math.PI * 2, d = 380 + Math.random() * 420;
    const e = g.makeEnemy(kinds[Math.floor(Math.random() * kinds.length)], p.wx + Math.cos(a) * d, p.wy + Math.sin(a) * d, { level: 3 });
    e.health = e.maxHealth = e.maxHealth * 6;
  };
  for (let i = 0; i < 150; i++) spawn();
  const gl = g.app.renderer.gl;
  let draws = 0;
  const de = gl.drawElements.bind(gl), da = gl.drawArrays.bind(gl);
  gl.drawElements = (...a) => { draws++; return de(...a); };
  gl.drawArrays = (...a) => { draws++; return da(...a); };
  const upd = [], ren = [];
  let maxBullets = 0, maxChildren = 0, maxParticles = 0;
  for (let f = 0; f < FRAMES + 60; f++) {
    while (s.enemies.length < 150) spawn();
    const t0 = performance.now();
    g.gameLoop(1);
    const t1 = performance.now();
    g.app.renderer.render(g.app.stage);
    const t2 = performance.now();
    if (f === 59) draws = 0;
    if (f >= 60) { upd.push(t1 - t0); ren.push(t2 - t1); }
    maxBullets = Math.max(maxBullets, sp.bullets.length + sp.meteors.length + sp.rings.length + sp.bolts.length + Object.values(sp.orbits).reduce((a, o) => a + o.blades.length, 0));
    maxChildren = Math.max(maxChildren, g.objectLayer.children.length);
    maxParticles = Math.max(maxParticles, g.fx.particles.length);
  }
  const stat = (a) => { const v = [...a].sort((x, y) => x - y); return { avg: +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(2), p95: +v[Math.floor(v.length * 0.95)].toFixed(2), max: +v[v.length - 1].toFixed(2) }; };
  return { frames: FRAMES, update: stat(upd), render: stat(ren), drawCallsPerFrame: Math.round(draws / FRAMES), enemies: s.enemies.length, spellObjects: maxBullets, objectLayer: maxChildren, particles: maxParticles };
}, FRAMES);
console.log(JSON.stringify(res, null, 2));
await b.close(); stop();
