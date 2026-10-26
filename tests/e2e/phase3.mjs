// Phase 3 end-to-end checks: wallet pickups, drag and drop, salvage, filters, persistence.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4183;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
});
const context = await browser.newContext({ viewport: { width: 1200, height: 760 } });
const errors = [];
let page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
await page.evaluate(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });

// ---- 1. wallet pickups
const wallet = await page.evaluate(() => {
  const g = window.game, p = g.state.player;
  g.dropGem(p.wx + 5, p.wy, 25, 'coin'); g.dropGem(p.wx, p.wy + 5, 3, 'wood'); g.dropGem(p.wx - 5, p.wy, 2, 'iron');
  for (let i = 0; i < 30; i++) g.gameLoop(1);
  return { ...g.state.wallet, gems: g.state.gems.length };
});
check('gold and resources are picked up into the wallet', wallet.gold === 25 && wallet.wood === 3 && wallet.iron === 2 && wallet.gems === 0, JSON.stringify(wallet));
check('wallet is shown in the HUD', (await page.locator('.vs-wallet').innerText()).includes('25'));

// ---- 2. kill loot never puts gold or resources in the spell inventory
const inv = await page.evaluate(() => {
  const g = window.game, p = g.state.player;
  const before = g.spells.spells.length + g.spells.runes.length;
  for (let i = 0; i < 400; i++) { const e = g.makeEnemy('SLIME', p.wx + 300, p.wy, { level: 5 }); g.damageEnemy(e, 1e9, { noCrit: true }); }
  const bad = [...g.spells.runes].some((r) => ['gold', 'wood', 'stone', 'iron', 'coin'].includes(r));
  return { bad, coins: g.state.gems.filter((x) => x.kind === 'coin').length, gain: g.spells.spells.length + g.spells.runes.length - before };
});
check('400 kills drop some coins, inventory only holds skills', inv.coins > 10 && !inv.bad && inv.gain <= 4, JSON.stringify(inv));

// ---- 3. drag and drop
await page.evaluate(() => {
  const g = window.game;
  for (const id of ['piercing', 'wide', 'swift']) g.spells.addRune(id);
  g.spells.addSpell('nova'); g.spells.addSpell('meteor');
});
await page.keyboard.press('i');
await page.waitForSelector('.vs-load');
// the panel scrolls: bring the item into view, pick it up, scroll to the target (as a wheel would) and drop it there
const drag = async (from, to) => {
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
  await to.scrollIntoViewIfNeeded();
  const b = await to.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
};
const novaRow = () => page.locator('.vs-item', { hasText: 'Frost Nova' }).first();
await novaRow().click();
const novaRunes = () => page.evaluate(() => window.game.spells.spells.find((s) => s.tpl === 'nova').runes);

await drag(page.locator('.vs-rune', { hasText: 'Wide' }), page.locator('.vs-sock').first());
check('drag a rune from the bag into a socket', (await novaRunes())[0] === 'wide', JSON.stringify(await novaRunes()));
await drag(page.locator('.vs-rune', { hasText: 'Piercing' }), page.locator('.vs-sock').nth(1));
check('incompatible rune cannot be dropped', (await novaRunes())[1] === null && (await page.evaluate(() => window.game.spells.runes.includes('piercing'))));
await drag(page.locator('.vs-rune', { hasText: 'Swift' }), page.locator('.vs-sock').nth(1));
await drag(page.locator('.vs-sock').nth(1), page.locator('.vs-sock').first());
check('moving a rune between sockets swaps legally', (await novaRunes()).includes('swift') && !(await novaRunes()).includes('wide') || (await novaRunes())[0] === 'swift', JSON.stringify(await novaRunes()));
await drag(page.locator('.vs-sock').first(), page.locator('.vs-runes'));
check('drag a socketed rune back to the bag', (await novaRunes())[0] === null, JSON.stringify(await novaRunes()));

// spells: equip / unequip
const autoCount = () => page.evaluate(() => window.game.spells.auto.length);
await drag(page.locator('.vs-item', { hasText: 'Meteor' }).first(), page.locator('[data-drop="unequip"]'));
const n0 = await autoCount();
await drag(page.locator('.vs-item', { hasText: 'Meteor' }).first(), page.locator('[data-drop="equip"]:not([data-slot])'));
check('drag a spell into the auto-cast slots', (await autoCount()) === n0 + 1, `${n0} -> ${await autoCount()}`);
const wasEq = await page.evaluate(() => window.game.spells.equipped(window.game.spells.spells.find((s) => s.tpl === 'meteor').uid));
await drag(page.locator('.vs-item', { hasText: 'Meteor' }).first(), page.locator('[data-drop="unequip"]'));
const nowEq = await page.evaluate(() => window.game.spells.equipped(window.game.spells.spells.find((s) => s.tpl === 'meteor').uid));
check('drag a spell out to the bag', wasEq && !nowEq);
await drag(page.locator('.vs-item', { hasText: 'Frost Nova' }).first(), page.locator('[data-drop="equip"][data-slot="1"]'));
check('auto-cast spell cannot go in an active slot', await page.evaluate(() => window.game.spells.active[1] === null));
await page.evaluate(() => window.game.spells.addSpell('blink'));
await page.waitForTimeout(100);

// ---- 4. salvage, lock
// the 400 kills above can drop a Piercing rune of their own: count them rather than expect none left
const piercing = () => page.evaluate(() => window.game.spells.runes.filter((r) => r === 'piercing').length);
const g0 = await page.evaluate(() => window.game.state.wallet.gold), p0 = await piercing();
await drag(page.locator('.vs-rune', { hasText: 'Piercing' }), page.locator('.vs-salv'));
const g1 = { gold: await page.evaluate(() => window.game.state.wallet.gold), piercing: await piercing(), before: p0 };
check('salvaging a rune pays gold and removes it', g1.gold > g0 && g1.piercing === p0 - 1, JSON.stringify(g1));
await page.locator('.vs-item', { hasText: 'Meteor' }).first().locator('.vs-lockb').click();
await drag(page.locator('.vs-item', { hasText: 'Meteor' }).first(), page.locator('.vs-salv'));
check('locked spells cannot be salvaged', await page.evaluate(() => window.game.spells.spells.some((s) => s.tpl === 'meteor')));
await page.locator('.vs-item', { hasText: 'Meteor' }).first().locator('.vs-lockb').click();
await drag(page.locator('.vs-item', { hasText: 'Meteor' }).first(), page.locator('.vs-salv'));
check('unlocked spell salvages', await page.evaluate(() => !window.game.spells.spells.some((s) => s.tpl === 'meteor')));

// ---- 5. keyboard path
await page.evaluate(() => window.game.spells.addRune('heavy'));
await novaRow().focus(); await page.keyboard.press('Enter');
await page.locator('.vs-rune', { hasText: 'Heavy' }).focus(); await page.keyboard.press('Enter');
await page.locator('.vs-sock').first().focus(); await page.keyboard.press('Enter');
check('keyboard: select rune with Enter, socket with Enter', (await novaRunes())[0] === 'heavy', JSON.stringify(await novaRunes()));

// ---- 6. search and compare tooltip
await page.locator('.vs-in').first().fill('nova');
check('search filters the lists', (await page.locator('.vs-item').count()) <= 2, String(await page.locator('.vs-item').allInnerTexts()));
await page.locator('.vs-in').first().fill('');
await page.evaluate(() => window.game.spells.addRune('multishot'));
await page.evaluate(() => { const it = window.game.spells.spells.find((s) => s.tpl === 'bolt'); window.__bolt = it.uid; });
await page.locator('.vs-item', { hasText: 'Arcane Bolt' }).first().click();
await page.locator('.vs-rune', { hasText: 'Multishot' }).click();
check('compare tooltip shows before/after', (await page.locator('.vs-tip').last().innerText()).includes('Count: 1 → 2'));
await page.keyboard.press('i');

// ---- 7. auto-salvage filter converts drops
const filt = await page.evaluate(() => {
  const g = window.game; g.state.lootFilter = 'advanced';
  const r0 = g.spells.runes.length, gold0 = g.state.wallet.gold;
  for (let i = 0; i < 200; i++) g.grantSkill(0);
  return { runes: g.spells.runes.length - r0, gold: g.state.wallet.gold - gold0 };
});
check('auto-salvage filter turns low runes into gold', filt.gold > 0, JSON.stringify(filt));

// ---- 8. persistence
const saved = await page.evaluate(async () => {
  const g = window.game; g.state.wallet = { gold: 777, wood: 5, stone: 6, iron: 7 }; g.state.lootFilter = 'basic';
  const bolt = g.spells.spells.find((s) => s.tpl === 'bolt'); bolt.locked = true;
  await g.requestSave('test', true);
  return true;
});
page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1200);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
const loaded = await page.evaluate(() => { const g = window.game; return { w: g.state.wallet, f: g.state.lootFilter, lock: g.spells.spells.find((s) => s.tpl === 'bolt').locked, nova: g.spells.spells.find((s) => s.tpl === 'nova').runes }; });
check('wallet, filter and locks survive a reload', loaded.w.gold === 777 && loaded.w.iron === 7 && loaded.f === 'basic' && loaded.lock === true && loaded.nova[0] === 'heavy', JSON.stringify(loaded));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
