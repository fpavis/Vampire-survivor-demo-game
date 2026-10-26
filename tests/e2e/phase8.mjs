// Phase 8a end-to-end checks: the HUD never covers an open panel on small screens, the loadout is fully usable with a
// controller (X equips, Y locks, sockets open a rune picker, X does not cast inside the panel, LB / RB switch hero),
// level tags only on monsters that matter, and the depth helpers (fading decor, silhouette, floating labels).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4190;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
});
const SEED = Number(process.env.SEED) || 2024;
const errors = [];

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((seed) => {
    window.__forceSeed = seed;
    window.__pad = {
      id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
    };
    window.__padOn = false;
    navigator.getGamepads = () => (window.__padOn ? [window.__pad, null, null, null] : [null, null, null, null]);
  }, SEED);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => !!window.game);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player);
  await page.evaluate(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; g.popRuntime.population = null; g.quests.state.flags.begun = true; g.quests.start(g.quests.lookup('m0_omen')); for (let i = 0; i < 10; i++) g.gameLoop(1); });
  return { context, page };
}

// ---- 1. small screens: panels sit above the HUD, and the HUD steps aside while one is open
const overlap = (page) => page.evaluate(() => {
  const panel = [...document.querySelectorAll('#ui-root .vs-panel')].pop();
  if (!panel) return { panel: false };
  const a = panel.getBoundingClientRect();
  const bad = [];
  for (const el of document.querySelectorAll('#ui-root .vs-hud button, #ui-root .vs-hud .vs-wallet, #ui-root .vs-hud .vs-mana, #ui-root .vs-tracker')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const hit = document.elementFromPoint(Math.min(r.right - 2, Math.max(r.left + 2, (a.left + a.right) / 2)), (r.top + r.bottom) / 2);
    if (r.right > a.left && r.left < a.right && r.bottom > a.top && r.top < a.bottom && hit && !panel.contains(hit) && el.contains(hit)) bad.push(el.className);
  }
  return { panel: true, bad };
});
for (const [w, h, name] of [[740, 420, 'landscape phone'], [390, 760, 'portrait phone'], [1280, 720, 'desktop']]) {
  const { context, page } = await open(w, h);
  for (const key of ['i', 'j']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
    const o = await overlap(page);
    check(`${name}: no HUD element over the ${key === 'i' ? 'loadout' : 'journal'}`, o.panel && o.bad.length === 0, JSON.stringify(o));
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
  if (w < 900) {
    await page.evaluate(() => window.game.input.openPanel('spells'));
    await page.waitForTimeout(250);
    const hud = await page.evaluate(() => getComputedStyle(document.querySelector('.vs-bar')).display);
    check(`${name}: the skill bar steps aside while a panel is open`, hud === 'none', hud);
    await page.evaluate(() => window.game.input.openPanel('spells'));
    await page.waitForTimeout(150);
    const back = await page.evaluate(() => getComputedStyle(document.querySelector('.vs-bar')).display);
    check(`${name}: and comes back when it closes`, back !== 'none', back);
  }
  await context.close();
}

// ---- 2. the loadout with a controller
const { context, page } = await open(1200, 760);
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, RT: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const ev = (fn, arg) => page.evaluate(fn, arg);
const pad = (o = {}) => page.evaluate((o) => {
  const p = window.__pad; window.__padOn = true;
  p.axes = o.axes || [0, 0, 0, 0];
  for (let i = 0; i < 17; i++) { const on = (o.down || []).includes(i); p.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }
}, o);
const step = (n = 1) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.game.gameLoop(1); }, n);
const tap = async (...btns) => { await pad({ down: btns }); await step(1); await pad(); await step(1); await page.waitForTimeout(80); };
const focused = () => ev(() => { const a = document.activeElement; return a ? { cls: a.className, spell: a.dataset?.spell || null, rune: a.dataset?.rune || null, sock: a.dataset?.drop === 'socket' ? Number(a.dataset.slot) : null, text: (a.innerText || '').slice(0, 30) } : null; });

// give the hero runes to socket and a spare auto spell
await ev(() => { const g = window.game; g.spells.addRune('swift'); g.spells.addRune('swift'); g.spells.addRune('heavy'); g.spells.touch(); });
await tap(B.UP);
await page.waitForFunction(() => { const a = document.activeElement; return !!a && !!a.closest('.vs-load'); }, null, { timeout: 4000 });
const hints = await ev(() => document.querySelector('.vs-hintbar')?.innerText || '');
check('the loadout shows controller hints', /equip/.test(hints) && /\bX\b/.test(hints) && /LB/.test(hints), JSON.stringify(hints));

// X on an equipped auto spell unequips it, X again equips it, and no skill was cast
const f0 = await focused();
const before = await ev((uid) => ({ eq: window.game.spells.equipped(uid), mana: window.game.spells.mana.value }), f0.spell);
await tap(B.X);
const mid = await ev((uid) => ({ eq: window.game.spells.equipped(uid), mana: window.game.spells.mana.value }), f0.spell);
check('X on a focused spell toggles it', !!f0.spell && before.eq && !mid.eq, JSON.stringify({ f0, before, mid }));
check('X did not cast a skill while the loadout is open', mid.mana >= before.mana - 0.01, JSON.stringify({ before: before.mana, after: mid.mana }));
await page.waitForFunction(() => !!document.activeElement?.closest('.vs-load'), null, { timeout: 4000 }).catch(() => {});
const follow = await focused();
check('focus follows the spell into its new list', follow && follow.spell === f0.spell, JSON.stringify(follow));
await ev((uid) => document.querySelector(`[data-spell="${uid}"]`)?.focus(), f0.spell);
await tap(B.X);
check('X again equips it', await ev((uid) => window.game.spells.equipped(uid), f0.spell));

// Y locks and unlocks (the panel re-renders the row in its new list from the game loop: focus it once it is there)
await page.waitForFunction((uid) => !!document.querySelector(`[data-drop="equip"] [data-spell="${uid}"]`), f0.spell, { timeout: 4000 }).catch(() => {});
await ev((uid) => document.querySelector(`[data-spell="${uid}"]`)?.focus(), f0.spell);
await tap(B.Y);
const locked = await page.waitForFunction((uid) => window.game.spells.item(uid).locked === true, f0.spell, { timeout: 3000 }).then(() => true, () => false);
await ev((uid) => document.querySelector(`[data-spell="${uid}"]`)?.focus(), f0.spell);
await tap(B.Y);
const unlocked = await page.waitForFunction((uid) => !window.game.spells.item(uid).locked, f0.spell, { timeout: 3000 }).then(() => false, () => true);
check('Y locks and unlocks the focused spell', locked === true && unlocked === false, JSON.stringify({ locked, unlocked }));

// A on the spell selects it; then walk to an empty socket and open the picker
await ev((uid) => document.querySelector(`[data-spell="${uid}"]`)?.focus(), f0.spell);
await tap(B.A);
await ev(() => document.querySelector('.vs-sock:not(.full)')?.focus());
await tap(B.A);
await page.waitForFunction(() => !!document.querySelector('.vs-picker'), null, { timeout: 3000 }).catch(() => {});
const pick = await ev(() => ({ open: !!document.querySelector('.vs-picker'), items: [...document.querySelectorAll('.vs-pick')].map((b) => b.innerText.split('\n')[0]) }));
check('A on an empty socket opens a rune picker listing runes that fit', pick.open && pick.items.length > 0, JSON.stringify(pick));
await page.waitForFunction(() => { const a = document.activeElement; return !!a && !!a.closest('.vs-picker'); }, null, { timeout: 3000 }).catch(() => {});
const pf = await focused();
check('the picker takes the focus', /vs-pick/.test(pf?.cls || ''), JSON.stringify(pf));
const runesBefore = await ev(() => window.game.spells.runes.length);
await tap(B.A);
const socketed = await ev((uid) => ({ runes: window.game.spells.item(uid).runes, bag: window.game.spells.runes.length, picker: !!document.querySelector('.vs-picker') }), f0.spell);
check('A in the picker sockets the rune and closes it', socketed.bag === runesBefore - 1 && socketed.runes.some(Boolean) && !socketed.picker, JSON.stringify(socketed));
const back = await focused();
check('focus returns to the socket', back && back.sock !== null, JSON.stringify(back));
await tap(B.X);
const out = await ev((uid) => ({ runes: window.game.spells.item(uid).runes, bag: window.game.spells.runes.length }), f0.spell);
check('X on a filled socket takes the rune out', out.bag === runesBefore && !out.runes.some(Boolean), JSON.stringify(out));

// B closes the picker first, then the panel
await ev(() => document.querySelector('.vs-sock:not(.full)')?.focus());
await tap(B.X);
const pk2 = await ev(() => !!document.querySelector('.vs-picker'));
await tap(B.B);
const after = await ev(() => ({ picker: !!document.querySelector('.vs-picker'), loadout: !!document.querySelector('.vs-load') }));
check('B closes the picker but keeps the loadout', pk2 && !after.picker && after.loadout, JSON.stringify({ pk2, after }));

// X on a rune in the bag sockets it into the first socket that fits
await ev(() => document.querySelector('.vs-rune[data-rune]')?.focus());
const bag0 = await ev(() => window.game.spells.runes.length);
await tap(B.X);
const bag1 = await ev(() => window.game.spells.runes.length);
check('X on a rune sockets it into the selected spell', bag1 === bag0 - 1, `${bag0} -> ${bag1}`);

// RB switches the hero shown in the loadout
const h0 = await ev(() => window.game.party.active);
const title0 = await ev(() => document.querySelector('.vs-load h2').innerText);
await ev(() => { window.game.party.cdUntil = 0; });
await tap(B.RB);
await page.waitForTimeout(150);
const title1 = await ev(() => document.querySelector('.vs-load h2').innerText);
check('RB switches the hero whose loadout is shown', title0.split('\n')[0] !== title1.split('\n')[0], JSON.stringify({ title0, title1, h0 }));
await tap(B.B);
check('B closes the loadout', !(await ev(() => !!document.querySelector('.vs-load'))));

// ---- 3. monsters: tags only where they matter
const tags = await ev(() => {
  const g = window.game, p = g.state.player;
  const even = g.makeEnemy('SLIME', p.wx + 200, p.wy, { level: g.state.level });
  const high = g.makeEnemy('SLIME', p.wx + 240, p.wy, { level: g.state.level + 12 });
  for (let i = 0; i < 3; i++) g.gameLoop(1);
  const tagOf = (e) => !!(e.hpBar.bar.visible && e.hpBar.label && e.hpBar.label.visible);
  const r = { evenTag: tagOf(even), evenBar: even.hpBar.bar.visible, highTag: tagOf(high) };
  even.health = even.maxHealth * 0.5; g.gameLoop(1);
  r.evenHurtBar = even.hpBar.bar.visible && even.hpBar.fg.visible;
  r.overlay = even.hpBar.bar.parent === g.occlusion.layer;
  return r;
});
check('an ordinary monster at the hero level shows nothing until hurt', !tags.evenTag && !tags.evenBar, JSON.stringify(tags));
check('a monster far above the hero shows its level', tags.highTag, JSON.stringify(tags));
check('a hurt monster shows its health bar on the overlay layer', tags.evenHurtBar && tags.overlay, JSON.stringify(tags));

// ---- 4. depth: decor in front of the hero fades, walls show a silhouette
const fade = await ev(() => {
  const g = window.game, p = g.state.player;
  let best = null;
  for (const v of g.world.views.values()) for (const o of v.objects) if (o.occ && o.visible && Math.abs(o.x - p.x) < 900 && Math.abs(o.y - p.y) < 600 && o.height > 70 && (!best || o.height > best.height)) best = o;
  if (!best) return null;
  p.wx = best.x; p.wy = best.zIndex - 10; g.cam.x = p.wx; g.cam.y = p.wy;
  for (let i = 0; i < 30; i++) g.gameLoop(1);
  const faded = best.alpha;
  p.wy = best.zIndex + 60; g.cam.y = p.wy;
  for (let i = 0; i < 60; i++) g.gameLoop(1);
  return { faded, restored: best.alpha };
});
check('tall decor in front of the hero fades, then comes back', fade && fade.faded < 0.6 && fade.restored > 0.95, JSON.stringify(fade));

const ghost = await ev(() => {
  const g = window.game, src = g.overworld; let town = null;
  for (let r = 0; r < 60 && !town; r++) for (let cy = -r; cy <= r && !town; cy++) for (let cx = -r; cx <= r && !town; cx++) { if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue; const q = src.poiForCell(cx, cy); if (q && q.type === 'city') town = q; }
  g.enterPlace(town);
  return !!town;
});
await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 15000 });
const sil = await ev(() => {
  const g = window.game, w = g.world, T = 48, p = g.state.player;
  const WALLS = [7, 8, 10, 12, 14, 15];
  const tx0 = Math.floor(p.wx / T), ty0 = Math.floor(p.wy / T);
  for (let r = 1; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const tx = tx0 + dx, ty = ty0 + dy;
    if (w.blocked((tx + 0.5) * T, (ty + 0.5) * T, 10) || !WALLS.includes(w.biomeAt(tx, ty + 1))) continue;
    p.wx = (tx + 0.5) * T; p.wy = (ty + 0.9) * T; g.cam.x = p.wx; g.cam.y = p.wy; w.update(g.cam.x, g.cam.y, 1200, 760, true);
    for (let i = 0; i < 20; i++) g.gameLoop(1);
    const on = g.occlusion.ghostOn && g.occlusion.ghost.visible;
    p.wy = (ty - 2.5) * T; g.cam.y = p.wy;
    for (let i = 0; i < 30; i++) g.gameLoop(1);
    return { on, off: !g.occlusion.ghostOn };
  }
  return null;
});
check('a wall in front of the hero shows the hero as a silhouette', ghost && sil && sil.on && sil.off, JSON.stringify(sil));
const npcLabels = await ev(() => { const g = window.game; return g.interactables.filter((i) => i.npc).every((i) => i.sprite.label && i.sprite.label.parent === g.occlusion.layer); });
check('town names float above the stalls', npcLabels);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await context.close();
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll phase 8 checks passed');
process.exit(failed ? 1 : 0);
