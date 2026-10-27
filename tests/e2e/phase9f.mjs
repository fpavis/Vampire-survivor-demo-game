// 9f end-to-end checks: towers that rise in levels, sieges, building on claimed ground (and later steps: quests
// and story scenes). Sections can be picked with ONLY=towers,siege,...; SHOTS=<dir> saves screenshots;
// THROTTLE=n slows the CPU like a busy CI runner.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4194;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (section) => !ONLY || ONLY.includes(section);
const SHOTS = process.env.SHOTS || null;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => { window.__forceSeed = 2024; });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
if (process.env.THROTTLE) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const logHas = (re) => ev((src) => window.__dev.ui.log.value.some((l) => new RegExp(src).test(l.text)), re.source);

await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player && window.__dev);
await ev(() => {
  const g = window.game, T = 48;
  g.godMode = true; g.state.nextLevel = 1e12;
  const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 99999;
  window.__dev.ui.wallet.value = { ...w };              // the panels read the wallet the game publishes
  // a free spot for a tower, spiralling out from (cx, cy); the hero is put beside it with the world loaded
  window.findSpot = (kind, cx = 0, cy = 0, from = 14, to = 300) => {
    for (let r = from; r < to; r += 2) for (let a = 0; a < 6.28; a += 0.05) {
      const tx = Math.round(cx + Math.cos(a) * r), ty = Math.round(cy + Math.sin(a) * r);
      window.goTo((tx + 0.5) * T, (ty + 4) * T);
      const res = g.towers.check(kind, tx, ty);
      if (res.ok) return { tx, ty };
    }
    return null;
  };
  window.goTo = (x, y) => { const p = g.state.player; p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.lastFogTx = null; g.world.update(x, y, 1400, 900, true); };
  // a finished tower at once (as the test tools do)
  window.raise = (kind, spot) => {
    const rec = { id: `t${spot.tx},${spot.ty}`, kind, tx: spot.tx, ty: spot.ty, dir: 0, len: 0, delivered: { gold: 0, wood: 0, stone: 0, iron: 0 }, built: false, spell: null, siege: null };
    g.towers.recs.push(rec);
    rec.delivered = { ...window.__dev.towersApi.towerCost(rec) };
    g.towers.complete(rec);
    return rec.id;
  };
  // every hit a tower lands, with its amount before crits
  window.__towerHits = [];
  const orig = g.damageEnemy.bind(g);
  g.damageEnemy = (e, amount, opts = {}) => { if (opts.source && opts.source.kind === 'tower') window.__towerHits.push(amount); return orig(e, amount, opts); };
});

// ---- 9f.1: spires, obelisks and beacons rise to level 3
if (want('towers')) {
  const spot = await ev(() => window.findSpot('spire'));
  const shot = await ev((spot) => {
    const g = window.game, T = 48;
    const id = window.raise('spire', spot);
    const bolt = g.spells.addSpell('bolt', 3);
    g.towers.arm(id, bolt.uid);
    window.__spire = id;
    // a dummy target for it: a slime held in place near the tower
    const fire = (n) => {
      window.__towerHits = [];
      for (const e of g.state.enemies) if (!e.dead) { e.dead = true; e.silent = true; }
      g.reap();
      const e = g.makeEnemy('SLIME', (spot.tx + 3.5) * T, (spot.ty + 0.5) * T, { level: 1 });
      e.health = e.maxHealth = 1e9;
      for (let i = 0; i < n && window.__towerHits.length < 3; i++) { e.wx = (spot.tx + 3.5) * T; e.wy = (spot.ty + 0.5) * T; g.gameLoop(1); }
      return window.__towerHits.slice();
    };
    window.__fire = fire;
    return fire(900);
  }, spot);
  check('an armed spire fires at what comes near', shot.length > 0, JSON.stringify(shot));
  // stand at the tower (the panel closes when the hero walks off) and open it
  await ev((id) => { const g = window.game, rec = g.towers.byId(id); window.goTo((rec.tx + 0.5) * 48, (rec.ty + 0.5) * 48 + 90); g.updateInteraction(); g.towers.interact({ kind: 'tower', rec }); }, await ev(() => window.__spire));
  await until(() => !!document.querySelector('.vs-tpanel [data-act="upgrade"]'));
  const panel = await ev(() => ({ pips: document.querySelectorAll('.vs-tpanel .vs-tlv i.on').length, text: document.querySelector('.vs-tpanel').innerText }));
  check('its panel shows level 1 and what level 2 would do', panel.pips === 1 && /Level 2/.test(panel.text) && /Damage ×1\.4/.test(panel.text), JSON.stringify(panel));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tower-panel.png` });
  const before = await ev(() => window.game.state.wallet.gold);
  await ev(() => document.querySelector('.vs-tpanel [data-act="upgrade"]').click());
  await until(() => window.game.towers.byId(window.__spire).level === 2);
  await ev(() => document.querySelector('.vs-tpanel [data-act="upgrade"]').click());
  await until(() => window.game.towers.byId(window.__spire).level === 3);
  const top = await ev(() => ({ level: window.game.towers.byId(window.__spire).level, button: !!document.querySelector('.vs-tpanel [data-act="upgrade"]'), gold: window.game.state.wallet.gold, text: document.querySelector('.vs-tpanel').innerText }));
  check('raising it twice takes it to level 3, paid from the wallet, and no further', top.level === 3 && !top.button && top.gold < before && /highest/i.test(top.text), JSON.stringify({ ...top, before }));
  await ev(() => { window.__dev.ui.towerPanel.value = null; });
  const shot3 = await ev(() => window.__fire(900));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  check('a level 3 spire hits much harder', shot3.length > 0 && mean(shot3) > mean(shot) * 1.7, JSON.stringify({ l1: mean(shot), l3: mean(shot3) }));

  // a ward's dome grows: a monster 9 tiles out is pushed only once it is raised
  const ward = await ev(() => window.findSpot('ward', 0, 0, 40));
  const dome = await ev((spot) => {
    const g = window.game, T = 48;
    const id = window.raise('ward', spot), rec = g.towers.byId(id);
    for (const e of g.state.enemies) if (!e.dead) { e.dead = true; e.silent = true; }
    g.reap();
    const at = (lvl) => {
      rec.level = lvl;
      const e = g.makeEnemy('SLIME', (spot.tx + 0.5) * T + 9 * T, (spot.ty + 0.5) * T, { level: 1 });
      e.kvx = e.kvy = 0;
      g.towers.update(1);
      const pushed = Math.abs(e.kvx) + Math.abs(e.kvy);
      e.dead = true; e.silent = true; g.reap();
      return pushed;
    };
    return { l1: at(1), l3: at(3) };
  }, ward);
  check('a level 3 obelisk holds monsters off further out', dome.l1 === 0 && dome.l3 > 0, JSON.stringify(dome));

  // a beacon lights more of the map when raised
  const bspot = await ev(() => window.findSpot('beacon', 0, 0, 80));
  const lit = await ev((spot) => {
    const g = window.game;
    const id = window.raise('beacon', spot);
    const n1 = g.fog.revealedTileCount();
    const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 99999;
    g.towers.upgrade(id);
    return { n1, n2: g.fog.revealedTileCount(), level: g.towers.byId(id).level };
  }, bspot);
  check('a raised beacon reveals more of the land', lit.level === 2 && lit.n2 > lit.n1, JSON.stringify(lit));

  // a site laid on claimed ground costs a quarter less
  const claimed = await ev(() => {
    const g = window.game, T = 48;
    const site = g.sites.sites.near(0, 0, 400).filter((s) => s.kind === 'claim').sort((a, b) => Math.hypot(a.tx, a.ty) - Math.hypot(b.tx, b.ty))[0];
    if (!site) return { site: false };
    g.session.claimed[site.id] = 1;
    let spot = null;
    for (let r = 2; r < 8 && !spot; r++) for (let a = 0; a < 6.28 && !spot; a += 0.2) {
      const tx = Math.round(site.tx + Math.cos(a) * r), ty = Math.round(site.ty + Math.sin(a) * r);
      window.goTo((tx + 0.5) * T, (ty + 3) * T);
      if (g.towers.check('beacon', tx, ty).ok && g.towers.claimedAt(tx, ty)) spot = { tx, ty };
    }
    if (!spot) return { site: true, spot: false };
    g.towers.startBuild('beacon');
    const b = g.towers.build;
    b.tx = spot.tx; b.ty = spot.ty; b.valid = true; b.plan = null; b.last = 'locked';
    g.towers.ghostTile = () => spot;
    g.towers.confirmBuild();
    delete g.towers.ghostTile;
    const rec = g.towers.recs[g.towers.recs.length - 1];
    const full = window.__dev.towersApi.towerCost({ kind: 'beacon' }), cost = window.__dev.towersApi.towerCost(rec);
    return { site: true, spot: true, claimed: rec.claimed, full: full.gold + full.wood + full.stone + full.iron, cost: cost.gold + cost.wood + cost.stone + cost.iron };
  });
  check('a tower laid on claimed ground costs a quarter less', claimed.claimed === true && claimed.cost < claimed.full * 0.8, JSON.stringify(claimed));
  const saved = await ev(async () => { const g = window.game; await g.requestSave('test', true); const d = await g.store.load('autosave'); return d.world.towers.map((t) => ({ kind: t.kind, level: t.level, claimed: t.claimed })); });
  check('levels and claimed ground are saved', saved.some((t) => t.kind === 'spire' && t.level === 3) && saved.some((t) => t.claimed), JSON.stringify(saved));
}

// ---- 9f.1: sieges silence a tower until the besiegers are beaten
if (want('siege')) {
  const spot = await ev(() => window.findSpot('spire', 0, 0, 120));
  const start = await ev((spot) => {
    const g = window.game, T = 48;
    const id = window.raise('spire', spot);
    const bolt = g.spells.addSpell('bolt', 3);
    g.towers.arm(id, bolt.uid);
    window.__siegeTower = id;
    for (const e of g.state.enemies) if (!e.dead) { e.dead = true; e.silent = true; }
    g.reap();
    window.goTo((spot.tx + 0.5) * T, (spot.ty + 9) * T);
    const a = g.worldEvents.start('siege', g.towers.byId(id));
    return { kind: a && a.kind, n: a ? a.members.length : 0, silenced: g.towers.byId(id).siege === (a && a.id) };
  }, spot);
  check('a siege gathers round a tower and silences it', start.kind === 'siege' && start.n >= 6 && start.silenced, JSON.stringify(start));
  check('a banner says which tower is under siege', await logHas(/besiege your Arcane Spire/), '');
  const quiet = await ev(() => {
    const g = window.game;
    window.__towerHits = [];
    for (let i = 0; i < 400; i++) g.gameLoop(1);
    return { hits: window.__towerHits.length, prompt: g.towers.targetFor({ wx: (g.towers.byId(window.__siegeTower).tx + 0.5) * 48, wy: (g.towers.byId(window.__siegeTower).ty + 0.5) * 48 })?.text || '' };
  });
  check('a besieged spire never fires', quiet.hits === 0 && /silenced/.test(quiet.prompt), JSON.stringify(quiet));
  const won = await ev(() => {
    const g = window.game, a = g.worldEvents.active;
    for (const e of a.members) if (!e.dead) g.damageEnemy(e, 1e9, { noCrit: true });
    for (let i = 0; i < 600 && g.worldEvents.active; i++) g.gameLoop(1);
    return { over: !g.worldEvents.active, free: g.towers.byId(window.__siegeTower).siege === null };
  });
  check('beating the besiegers frees the tower', won.over && won.free && await logHas(/THE SIEGE IS BROKEN/), JSON.stringify(won));
  const again = await ev(() => {
    const g = window.game, T = 48, rec = g.towers.byId(window.__siegeTower);
    window.__towerHits = [];
    const e = g.makeEnemy('SLIME', (rec.tx + 3.5) * T, (rec.ty + 0.5) * T, { level: 1 });
    e.health = e.maxHealth = 1e9;
    for (let i = 0; i < 900 && !window.__towerHits.length; i++) { e.wx = (rec.tx + 3.5) * T; e.wy = (rec.ty + 0.5) * T; g.gameLoop(1); }
    e.dead = true; e.silent = true; g.reap();
    return window.__towerHits.length;
  });
  check('...and it fires again', again > 0, String(again));
  const lost = await ev(() => {
    const g = window.game, T = 48, rec = g.towers.byId(window.__siegeTower);
    g.worldEvents.start('siege', rec);
    window.goTo((rec.tx + 0.5) * T + 2600, (rec.ty + 0.5) * T);
    for (let i = 0; i < 900 && g.worldEvents.active; i++) g.gameLoop(1);
    return { over: !g.worldEvents.active, free: rec.siege === null };
  });
  check('walking far away makes the besiegers give up and the tower wakes', lost.over && lost.free && await logHas(/gave up on your Arcane Spire/), JSON.stringify(lost));
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
