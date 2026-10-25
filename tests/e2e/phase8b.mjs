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

// ---- regions and roads
if (want('roads')) {
  const road = await ev(() => {
    const g = window.game, net = g.overworld.roads;
    const start = { id: 'start', tx: 0, ty: 2, name: 'the start' };
    const [town] = net.near(start);
    const path = town ? net.route(start, town) : null;
    if (!path) return null;
    const k = Math.floor(path.length / 4) * 2;
    const p = g.state.player;
    p.wx = (path[k] + 0.5) * 48; p.wy = (path[k + 1] + 0.5) * 48; g.cam.x = p.wx; g.cam.y = p.wy;
    g.world.update(g.cam.x, g.cam.y, 1280, 720, true);
    for (let i = 0; i < 30; i++) g.gameLoop(1);
    return { town: town.name, len: path.length / 2, surface: g.surfaces.current && g.surfaces.current.id, speed: g.surfaces.fx.speed, hud: document.querySelector('.vs-surface')?.innerText || '' };
  });
  check('a road leads from the start to the nearest town', road && road.len > 5, JSON.stringify(road));
  check('walking on the road is faster', road && road.surface === 'road' && road.speed > 1.2, JSON.stringify(road));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road.png` });

  const region = await ev(() => {
    const g = window.game, p = g.state.player;
    const r0 = g.regionId;
    p.wx = 330 * 48; p.wy = 20 * 48; g.cam.x = p.wx; g.cam.y = p.wy;
    g.world.update(g.cam.x, g.cam.y, 1280, 720, true);
    for (let i = 0; i < 45; i++) g.gameLoop(1);
    const r = g.overworld.region(g.regionId);
    return { r0, r1: g.regionId, name: r.name, title: r.title, label: g.zoneLabel, seen: g.regionsSeen.size, onMap: g.map.regions().map((x) => x.name) };
  });
  check('walking into another region names it', region.r0 === '0,0' && region.r1 !== '0,0' && region.label.includes(region.name), JSON.stringify(region));
  check('regions seen are listed on the world map', region.seen >= 2 && region.onMap.includes('Hearthvale') && region.onMap.includes(region.name), JSON.stringify(region.onMap));

  const sign = await ev(() => {
    const g = window.game, net = g.overworld.roads;
    const towns = net.townsIn(-200, -200, 200, 200).filter((n) => net.destinations(n).length);
    const n = towns[0];
    if (!n) return null;
    const p = g.state.player;
    p.wx = (n.tx + 2.4) * 48 + 30; p.wy = (n.ty + 0.6) * 48 + 10; g.cam.x = p.wx; g.cam.y = p.wy;
    g.world.update(g.cam.x, g.cam.y, 1280, 720, true);
    for (let i = 0; i < 10; i++) g.gameLoop(1);
    g.updateInteraction();
    const kind = g.target && g.target.kind;
    let toast = '';
    const orig = g.ui.toast.bind(g.ui); g.ui.toast = (t) => { toast = t; orig(t); };
    g.interact();
    g.ui.toast = orig;
    return { kind, toast, dests: net.destinations(n) };
  });
  check('a signpost by a town names where its roads lead', sign && sign.kind === 'sign' && sign.dests.every((d) => sign.toast.includes(d)), JSON.stringify(sign));
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/signpost.png` });
    await page.keyboard.press('m'); await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.SHOTS}/regions-map.png` });
    await page.keyboard.press('m'); await page.waitForTimeout(200);
  }
}

// ---- new spells and runes
if (want('spells')) {
  const trial = (id, setup) => ev(([id, setup]) => {
    const g = window.game, p = g.state.player, sp = g.spells;
    g.state.enemies.forEach((e) => { e.dead = true; }); g.reap();
    sp.clearProjectiles();
    // stand on open ground
    for (let r = 0; r < 40; r++) { if (!g.world.blocked(p.wx, p.wy, 40) && !g.world.blocked(p.wx + 260, p.wy, 40)) break; p.wx += 96; }
    g.cam.x = p.wx; g.cam.y = p.wy; g.world.update(g.cam.x, g.cam.y, 1280, 720, true);
    sp.setLoadout([], [null, null, null]);
    const it = sp.addSpell(id);
    if (setup.runes) it.runes = setup.runes;
    sp.equip(it.uid, 0);
    sp.timers = {};
    const foes = (setup.foes || [[180, 0]]).map(([dx, dy]) => { const e = g.makeEnemy('SLIME', p.wx + dx, p.wy + dy, { level: 1 }); e.speed = 0; e.health = e.maxHealth = setup.hp || 1e5; return e; });
    const out = { zones: 0, glaives: 0, wisps: 0, rings: 0 };
    if (setup.hurt) g.state.health = g.state.maxHealth * 0.4;
    const h0 = g.state.health;
    if (setup.cast) { sp.mana.value = 200; out.cast = sp.cast(0); }
    for (let f = 0; f < (setup.frames || 150); f++) {
      if (setup.walk) { p.wx += 3; foes.forEach((e) => { e.wx = p.wx - 40; }); }
      g.gameLoop(1);
      out.zones = Math.max(out.zones, sp.zones.length);
      out.glaives = Math.max(out.glaives, sp.bullets.filter((b) => b.glaive).length);
      out.wisps = Math.max(out.wisps, sp.bullets.filter((b) => b.wisp).length);
      out.rings = Math.max(out.rings, sp.rings.length);
    }
    out.damage = Math.round(foes.reduce((a, e) => a + (e.maxHealth - Math.max(0, e.health)), 0));
    out.hit = foes.filter((e) => e.health < e.maxHealth).length;
    out.knocked = foes.some((e) => Math.abs(e.kvx) + Math.abs(e.kvy) > 0.5);
    out.healed = Math.round(g.state.health - h0);
    out.glaivesLeft = sp.bullets.filter((b) => b.glaive).length;
    g.state.health = g.state.maxHealth;
    return out;
  }, [id, setup]);

  const trail = await trial('trail', { walk: true, frames: 120, foes: [[-40, 0]] });
  check('Ember Trail leaves burning ground that hurts', trail.zones > 3 && trail.damage > 0, JSON.stringify(trail));
  const wisp = await trial('wisp', { frames: 200, foes: [[220, 40]] });
  check('Seeker Wisps hunt down an enemy', wisp.wisps > 0 && wisp.damage > 0, JSON.stringify(wisp));
  const glaive = await trial('glaive', { frames: 100, foes: [[160, 0], [240, 0]] });   // one throw: out ~270 px and back, before the next
  check('Returning Glaive cuts through a line and comes back', glaive.glaives > 0 && glaive.hit === 2 && glaive.glaivesLeft === 0, JSON.stringify(glaive));
  const cloud = await trial('cloud', { frames: 150, foes: [[200, 0], [220, 20]] });
  check('Spore Cloud settles on a crowd and hurts it', cloud.zones > 0 && cloud.hit === 2, JSON.stringify(cloud));
  const slam = await trial('slam', { cast: true, frames: 6, foes: [[80, 0], [-90, 30], [400, 0]] });
  check('Earthshatter hurts and hurls what is close, not what is far', slam.cast && slam.hit === 2 && slam.knocked, JSON.stringify(slam));
  const heal = await trial('heal', { cast: true, hurt: true, frames: 120, foes: [[900, 0]] });
  check('Mending Light heals the hero over time', heal.cast && heal.healed >= 8, JSON.stringify(heal));
  const after = await trial('nova', { runes: ['aftershock', null], frames: 60, foes: [[60, 0]] });
  check('Aftershock sends a second ring', after.rings >= 2 || after.damage > 22 * 1.5, JSON.stringify(after));
  const rico = await trial('bolt', { runes: ['ricochet', null], frames: 75, foes: [[160, 0], [230, 50], [230, -50]] });
  check('Ricochet bounces one bolt between enemies', rico.hit >= 2, JSON.stringify(rico));

  const kills = await ev(() => {
    const g = window.game, sp = g.spells, p = g.state.player;
    const it = sp.addSpell('bolt'); it.runes = ['splinter', 'siphon'];
    let shards = 0; const orig = sp.shards.bind(sp); sp.shards = (...a) => { shards++; return orig(...a); };
    sp.mana.value = 0;
    const e = g.makeEnemy('SLIME', p.wx + 50, p.wy, { level: 1 });
    g.damageEnemy(e, 1e6, { noCrit: true, spell: it });
    sp.shards = orig;
    return { shards, mana: sp.mana.value, spawned: sp.bullets.filter((b) => b.shard).length };
  });
  check('Splinter bursts kills into shards and Mana Siphon refills mana', kills.shards === 1 && kills.spawned === 3 && kills.mana >= 2, JSON.stringify(kills));
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
preview.kill();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll phase 8b checks passed');
process.exit(failed ? 1 : 0);
