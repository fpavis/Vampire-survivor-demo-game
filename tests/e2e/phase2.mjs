// Phase 2 end-to-end checks: spells, mana, non-interrupting level-ups, loadout UI, loot, persistence.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4182;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
});
const context = await browser.newContext({ viewport: { width: 1100, height: 650 } });
const errors = [];
let page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);

// ---- 1. starting loadout and HUD
const start = await page.evaluate(() => {
  const g = window.game;
  return { auto: g.spells.auto.length, active0: g.spells.active[0] && g.spells.item(g.spells.active[0]).tpl, mana: g.spells.mana.value, max: g.stats.maxMana };
});
check('starts with a bolt and a dash', start.auto === 1 && start.active0 === 'dash' && start.mana === start.max, JSON.stringify(start));
check('skill bar is rendered in the DOM', (await page.locator('.vs-skill').count()) === 3 && (await page.locator('.vs-mana').count()) === 1);

// ---- 2. dash spends mana, moves the hero and grants invulnerability; no mana = no dash
const dash = await page.evaluate(() => {
  const g = window.game, p = g.state.player;
  const x0 = p.wx; const m0 = g.spells.mana.value;
  g.lastMove = { x: 1, y: 0 };
  const ok = g.spells.cast(0);
  for (let i = 0; i < 20; i++) g.gameLoop(1);
  return { ok, moved: p.wx - x0, spent: m0 - g.spells.mana.value, iframes: g.invulnUntil > 0 };
});
check('dash moves the hero', dash.ok && dash.moved > 60, JSON.stringify(dash));
check('dash costs mana and grants i-frames', dash.spent > 5 && dash.iframes);
// regression: the cooldown must really count down by itself (a test used to reset the timers and hide a skill that never came back)
const again = await page.evaluate(() => {
  const g = window.game;
  g.spells.mana.value = g.stats.maxMana;
  const before = g.spells.slotInfo(0).cdFrac;
  let frames = 0;
  while (g.spells.slotInfo(0).cdFrac > 0 && frames < 3000) { g.gameLoop(1); frames++; }
  g.spells.mana.value = g.stats.maxMana;
  const ready = g.spells.slotInfo(0).cdFrac === 0;
  const ok = g.spells.cast(0);
  return { before, frames, ready, ok };
});
check('an active skill is ready again after its cooldown', again.before > 0 && again.ready && again.ok && again.frames > 5 && again.frames < 2000, JSON.stringify(again));
await page.evaluate(() => { const g = window.game; g.spells.mana.value = g.stats.maxMana; let f = 0; while (g.spells.slotInfo(0).cdFrac > 0 && f++ < 3000) g.gameLoop(1); for (let i = 0; i < 12; i++) g.gameLoop(1); });
await page.waitForTimeout(150);
const dom = await page.evaluate(() => { const b = document.querySelector('.vs-skill'); return { cls: b.className, cd: b.querySelector('.cd').style.transform }; });
check('the skill button is lit again after its cooldown', !/poor/.test(dom.cls) && /scaleY\(0\)/.test(dom.cd), JSON.stringify(dom));
const poor = await page.evaluate(() => { const g = window.game; g.spells.mana.value = 0; g.spells.timers = {}; return g.spells.cast(0); });
check('no mana: active skill refuses', poor === false);

// ---- 3. autofire never needs mana
const fire = await page.evaluate(() => {
  const g = window.game, p = g.state.player;
  g.spells.mana.value = 0; g.state.health = g.state.maxHealth = 1e9;
  const e = g.makeEnemy('SLIME', p.wx + 160, p.wy, { level: 1 });
  e.health = 1e6; e.maxHealth = 1e6;
  const h0 = e.health;
  for (let i = 0; i < 240; i++) g.gameLoop(1);
  return { dealt: h0 - e.health, mana: g.spells.mana.value > 0 };
});
check('auto-cast spells work with zero mana', fire.dealt > 0, JSON.stringify(fire));

// ---- 4. level-ups queue without pausing the game
const lvl = await page.evaluate(() => {
  const g = window.game, s = g.state;
  const f0 = g.frame; const lv0 = s.level;
  s.experience += s.nextLevel * 6;
  g.checkLevelUp();
  for (let i = 0; i < 30; i++) g.gameLoop(1);
  return { gained: s.level - lv0, pending: s.pending, running: g.frame > f0 + 20, paused: s.levelUp };
});
check('level-ups queue as pending picks', lvl.gained >= 3 && lvl.pending === lvl.gained, JSON.stringify(lvl));
check('game keeps running during level-up', lvl.running && !lvl.paused);
check('pill shows pending upgrades', (await page.locator('.vs-pill').count()) === 1);
await page.keyboard.press('u');
await page.waitForSelector('.vs-card');
check('U opens three cards', (await page.locator('.vs-card').count()) === 3);
const before = await page.evaluate(() => window.game.state.pending);
await page.keyboard.press('2');
const after = await page.evaluate(() => ({ p: window.game.state.pending, picks: Object.keys(window.game.state.picks).length }));
check('pressing 2 picks a card', after.p === before - 1 && after.picks === 1, JSON.stringify(after));
await page.evaluate(() => { window.game.pickCard(0); window.game.pickCard(0); window.game.pickCard(0); });
check('pending picks drain to zero', (await page.evaluate(() => window.game.state.pending)) === 0);

// ---- 5. loot and loadout editing with compatibility checks
await page.evaluate(() => { const g = window.game; g.godMode = true; g.spells.addSpell('nova'); g.spells.addRune('piercing'); g.spells.addRune('wide'); g.spells.addRune('ignite'); });
await page.keyboard.press('i');
await page.waitForSelector('.vs-load');
await page.locator('.vs-item', { hasText: 'Frost Nova' }).first().click();
const runeState = await page.evaluate(() => [...document.querySelectorAll('.vs-rune')].map((r) => [r.textContent.trim(), r.classList.contains('bad')]));
const bad = {}; for (const [t, b] of runeState) bad[t.replace(/^\P{L}+/u, '').replace(/[CUREL]$/, '')] = b;   // drop the icon and the rarity letter
check('incompatible runes are greyed out', bad['Piercing'] === true && bad['Ignite'] === true && bad['Wide'] === false, JSON.stringify(runeState));
await page.locator('.vs-rune', { hasText: 'Wide' }).click();
await page.locator('.vs-sock').first().click();
const socketed = await page.evaluate(() => window.game.spells.spells.find((s) => s.tpl === 'nova').runes);
check('click rune then socket equips it', socketed[0] === 'wide', JSON.stringify(socketed));
check('wide rune enlarges the nova', await page.evaluate(() => {
  const g = window.game, it = g.spells.spells.find((s) => s.tpl === 'nova'); return g.spells.resolved(it).p.radius > 130 * 1.2;
}));
await page.keyboard.press('i');

// ---- 7. all expressions run without errors, under a stress loadout, with object caps
const stress = await page.evaluate(() => {
  const g = window.game, p = g.state.player; g.godMode = true; g.state.health = g.state.maxHealth = 1e9;
  for (const id of ['orbit', 'lightning', 'meteor', 'blink', 'barrier']) if (!g.spells.spells.some((s) => s.tpl === id)) g.spells.addSpell(id);
  g.spells.auto = g.spells.spells.filter((s) => ['bolt', 'orbit', 'lightning', 'nova', 'meteor'].includes(s.tpl)).map((s) => s.uid);
  for (const s of g.spells.spells) if (s.tpl === 'bolt') s.runes = ['multishot', 'piercing'];
  g.spells.touch();
  for (let i = 0; i < 60; i++) { const a = i * 0.7; g.makeEnemy('SLIME', p.wx + Math.cos(a) * (150 + i * 4), p.wy + Math.sin(a) * (150 + i * 4), { level: 1 }); }
  let maxObj = 0; const t0 = performance.now();
  for (let i = 0; i < 600; i++) {
    g.gameLoop(1);
    if (i % 100 === 10) { g.spells.mana.value = 99; g.spells.timers = {}; g.spells.cast(1); g.spells.cast(2); }
    maxObj = Math.max(maxObj, g.spells.bullets.length + g.spells.rings.length + g.spells.meteors.length + g.spells.bolts.length + g.spells.decals.length);
  }
  return { maxObj, kills: g.state.kills, ms: Math.round(performance.now() - t0) };
});
check('stress loadout kills enemies', stress.kills > 20, JSON.stringify(stress));
check('spell object count stays capped', stress.maxObj < 260);
check('spells level up from kills', await page.evaluate(() => window.game.spells.spells.some((s) => s.level > 1)));

// ---- 8. skill drops
const drops = await page.evaluate(() => {
  const g = window.game; const before = g.spells.spells.length + g.spells.runes.length;
  g.state.lootFilter = 'off';
  g.grantSkill(3);
  return g.spells.spells.length + g.spells.runes.length - before;
});
check('a skill grant adds exactly one item', drops === 1);

// ---- 9. persistence of loadout, runes, picks, pending, mana
const saved = await page.evaluate(async () => {
  const g = window.game; g.godMode = true;
  g.state.pending = 2; g.state.picks = { reservoir: 2 }; g.recalcStats();
  g.spells.addRune('echo');
  const out = { spells: g.spells.spells.length, runes: g.spells.runes.length, wide: g.spells.spells.find((s) => s.tpl === 'nova').runes[0], auto: g.spells.auto.length };
  await g.requestSave('test', true);
  return out;
});
page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1200);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
const loaded = await page.evaluate(() => {
  const g = window.game;
  return { spells: g.spells.spells.length, runes: g.spells.runes.length, wide: g.spells.spells.find((s) => s.tpl === 'nova').runes[0], auto: g.spells.auto.length, pending: g.state.pending, res: g.state.picks.reservoir, maxMana: g.stats.maxMana };
});
check('loadout and runes survive a reload', loaded.spells === saved.spells && loaded.runes === saved.runes && loaded.wide === 'wide' && loaded.auto === saved.auto, JSON.stringify(loaded));
check('pending picks and stat picks persist', loaded.pending === 2 && loaded.res === 2 && loaded.maxMana === 100, JSON.stringify(loaded));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
preview.kill();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
