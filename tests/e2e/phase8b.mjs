// Phase 8b-8g end-to-end checks: audio (mixer, effects, music that follows the place), regions and roads, new
// spells and runes, accessibility options, onboarding tips.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4189;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (section) => !ONLY || ONLY.includes(section);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const SEED = Number(process.env.SEED) || 2024;
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript((seed) => { window.__forceSeed = seed; }, SEED);
let page = await context.newPage();
const watch = (pg) => { pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); }); };
watch(page);
const ev = (fn, arg) => page.evaluate(fn, arg);
const loop = (n) => ev((n) => { for (let i = 0; i < n; i++) window.game.gameLoop(1); }, n);

await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });

const findTown = () => ev(() => {
  const g = window.game, src = g.overworld; let town = null;
  for (let r = 0; r < 60 && !town; r++) for (let cy = -r; cy <= r && !town; cy++) for (let cx = -r; cx <= r && !town; cx++) {
    if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
    const q = src.poiForCell(cx, cy); if (q && q.type === 'city') town = q;
  }
  return town && town.id;
});

// ---- audio
if (want('audio')) {
  const a0 = await ev(() => window.game.audio.stats());
  check('the audio context runs after the first key press', a0.state === 'running', JSON.stringify(a0));
  await loop(40);
  await page.waitForTimeout(400);
  const a1 = await ev(() => window.game.audio.stats());
  check('the overworld plays its region track', ['field', 'forest', 'desert', 'shore', 'mountain'].includes(a1.track) && a1.bars > 0, JSON.stringify(a1));

  const sounds = await ev(() => {
    const g = window.game, p = g.state.player;
    const before = { ...g.audio.played };
    const e = g.makeEnemy('SLIME', p.wx + 60, p.wy, { level: 1 });
    g.damageEnemy(e, 1, { noCrit: true });
    g.audio.last = {};
    g.damageEnemy(e, 1e6, { noCrit: true });
    g.audio.last = {};
    g.godMode = false; g.invulnUntil = 0; g.hurtPlayer(1); g.godMode = true;
    const diff = {};
    for (const [k, v] of Object.entries(g.audio.played)) if (v !== (before[k] || 0)) diff[k] = v - (before[k] || 0);
    return diff;
  });
  check('hits, kills and getting hurt make sounds', sounds.hit >= 1 && sounds.kill >= 1 && sounds.hurt >= 1, JSON.stringify(sounds));

  const far = await ev(() => {
    const g = window.game, p = g.state.player, n = g.audio.played.kill || 0;
    g.audio.last = {};
    const e = g.makeEnemy('SLIME', p.wx + 5000, p.wy, { level: 1 });
    g.damageEnemy(e, 1e6, { noCrit: true });
    return (g.audio.played.kill || 0) - n;
  });
  check('sounds far off screen are not played', far === 0, String(far));

  const boss = await ev(() => {
    const g = window.game;
    g.spawnBoss();
    for (let i = 0; i < 40; i++) g.gameLoop(1);
    const t = g.audio.stats();
    g.state.enemies.filter((e) => e.isBoss).forEach((e) => { e.dead = true; });
    g.reap();
    return t;
  });
  check('a nearby warlord switches to the boss track at full intensity', boss.track === 'boss' && boss.intensity === 1, JSON.stringify(boss));

  const town = await findTown();
  await ev((id) => { const g = window.game; g.enterPlace(g.overworld.poiForCell(...id.split(',').map(Number))); }, town);
  await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 15000 });
  await loop(40);
  check('a town plays the town track', (await ev(() => window.game.audio.stats().track)) === 'town');
  await ev(() => window.game.exitPlace());
  await page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 15000 });

  await ev(() => { window.game.audio.setVolume('music', 0.25); window.game.audio.setMuted(false); });
  const prefs = await ev(() => JSON.parse(localStorage.getItem('vs.audio.v1') || '{}'));
  check('volumes are remembered', Math.abs(prefs.music - 0.25) < 1e-6, JSON.stringify(prefs));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const sliders = await ev(() => [...document.querySelectorAll('.vs-pause .vs-row span')].map((x) => x.innerText));
  check('the pause menu has volume sliders', ['Master volume', 'Music', 'Effects'].every((l) => sliders.includes(l)), JSON.stringify(sliders));
  await page.keyboard.press('Escape');
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
preview.kill();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll phase 8b checks passed');
process.exit(failed ? 1 : 0);
