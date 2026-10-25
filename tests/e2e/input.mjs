// Input end-to-end checks: a faked gamepad drives the title screen, movement, skills, panels, the pause menu and
// build mode; the keyboard and mouse paths through the same panels; hints that follow the device in use.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4187;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
});
const context = await browser.newContext({ viewport: { width: 1200, height: 760 } });
const errors = [];
const SEED = Number(process.env.SEED) || 2024;
await context.addInitScript((seed) => {
  window.__forceSeed = seed;
  // a controller that the test moves by hand
  window.__pad = {
    id: 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)', index: 0, connected: true, mapping: 'standard',
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    vibrationActuator: { playEffect: (...a) => { (window.__rumble = window.__rumble || []).push(a); return Promise.resolve('complete'); } }
  };
  window.__padOn = false;
  navigator.getGamepads = () => (window.__padOn ? [window.__pad, null, null, null] : [null, null, null, null]);
}, SEED);

let page = await context.newPage();
const watch = (pg) => { pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); }); };
watch(page);
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const ev = (fn, arg) => page.evaluate(fn, arg);
const pad = (o = {}) => page.evaluate((o) => {
  const p = window.__pad; window.__padOn = true;
  p.axes = o.axes || [0, 0, 0, 0];
  for (let i = 0; i < 17; i++) { const on = (o.down || []).includes(i); p.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }
}, o);
const step = (n = 1) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.game.gameLoop(1); }, n);
const tap = async (...btns) => { await pad({ down: btns }); await step(1); await pad(); await step(1); await page.waitForTimeout(70); };
// for screens driven by the real ticker: hold until a poll has seen the press, release until a poll has seen that
const realTap = async (...btns) => {
  await pad({ down: btns });
  await page.waitForFunction(() => window.game.input.frame.held.size > 0, null, { timeout: 8000 });
  await pad();
  await page.waitForFunction(() => window.game.input.frame.held.size === 0, null, { timeout: 8000 });
};
const focusInfo = () => ev(() => { const a = document.activeElement; return a && a !== document.body ? { cls: a.className, tag: a.tagName, text: (a.innerText || '').slice(0, 40), type: a.type || '', inPanel: !!a.closest('.vs-panel') } : null; });
const focusSettled = () => page.waitForFunction(() => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest('.vs-panel'); }, null, { timeout: 4000 });
const device = () => ev(() => document.documentElement.dataset.input);

await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);

// ---- 0. the title screen takes the pad
await realTap(B.A);
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
check('A on the title screen starts the game', true);
check('the title screen switched the device to the controller', (await device()) === 'pad', await device());
await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; g.popRuntime.population = null; for (const e of [...g.state.enemies]) e.dead = true; g.reap(); });

// ---- 1. the left stick walks, the dead zone ignores drift
await ev(() => {   // stand where there is a clear run to the east, whatever the seed put around the start
  const g = window.game, p = g.state.player;
  const open = (x, y) => { for (let d = 0; d <= 360; d += 16) if (g.world.blocked(x + d, y, p.radius + 4)) return false; return true; };
  for (let r = 0; r < 1200; r += 48) for (let a = 0; a < 6.28; a += 0.4) {
    const x = p.wx + Math.cos(a) * r, y = p.wy + Math.sin(a) * r;
    if (open(x, y)) { p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.world.update(x, y, 1200, 760, true); return; }
  }
});
const walk = await ev(() => ({ x: window.game.state.player.wx }));
await pad({ axes: [1, 0, 0, 0] }); await step(30);
const after = await ev(() => ({ x: window.game.state.player.wx }));
check('the left stick walks the hero', after.x - walk.x > 30, JSON.stringify({ walk, after }));
await pad({ axes: [0.12, 0.08, 0, 0] }); const d0 = await ev(() => window.game.state.player.wx); await step(30);
const d1 = await ev(() => window.game.state.player.wx);
check('stick drift inside the dead zone does nothing', Math.abs(d1 - d0) < 0.5, `${d0} -> ${d1}`);
await pad({ axes: [0.5, 0, 0, 0] }); const h0 = await ev(() => window.game.state.player.wx); await step(30);
const h1 = await ev(() => window.game.state.player.wx);
await pad({ axes: [1, 0, 0, 0] }); const f0 = await ev(() => window.game.state.player.wx); await step(30);
const f1 = await ev(() => window.game.state.player.wx);
check('a gentle push walks slower than a full push', h1 - h0 > 5 && (h1 - h0) < (f1 - f0) * 0.8, `${h1 - h0} vs ${f1 - f0}`);
await pad();

// ---- 2. hints follow the device
const padPrompt = await ev(() => { const g = window.game; g.ui.promptKey = ''; g.ui.setPrompt('[E]  Test'); return g.ui.promptText.text; });
check('prompts show the controller button while a pad is in use', padPrompt.includes('[A]'), padPrompt);
await ev(() => { window.__pad.id = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'; });
await tap(B.LT);
const psPrompt = await ev(() => { const g = window.game; g.ui.promptKey = ''; g.ui.setPrompt('[E]  Test'); return g.ui.promptText.text; });
check('...and a PlayStation pad shows its own symbols', psPrompt.includes('[✕]'), psPrompt);
await ev(() => { window.__pad.id = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)'; });
await page.keyboard.press('x');
const keyPrompt = await ev(() => { const g = window.game; g.ui.promptKey = ''; g.ui.setPrompt('[E]  Test'); return { text: g.ui.promptText.text, dev: document.documentElement.dataset.input }; });
check('pressing a key switches hints back to the keyboard', keyPrompt.text.includes('[E]') && keyPrompt.dev === 'key', JSON.stringify(keyPrompt));
await page.mouse.move(300, 300); await page.mouse.move(360, 340);
check('moving the mouse switches the device to the mouse', (await device()) === 'mouse', await device());
await ev(() => { window.game.ui.setPrompt(null); });

// ---- 3. skills, aim and heroes
const skill = await ev(() => { const g = window.game; g.spells.timers = {}; g.spells.mana.value = g.stats.maxMana; return { mana: g.spells.mana.value }; });
await tap(B.X);
const skill2 = await ev(() => { const g = window.game; return { mana: g.spells.mana.value, dashing: !!g.spells.dashing, cd: g.spells.slotInfo(0).cdFrac }; });
check('X casts the first active skill (dash)', skill2.mana < skill.mana && skill2.cd > 0, JSON.stringify({ skill, skill2 }));
await ev(() => { const g = window.game; g.spells.dashing = null; g.spells.timers = {}; g.spells.mana.value = g.stats.maxMana; g.lastMove = { x: 1, y: 0 }; });
await pad({ axes: [0, 0, 0, -1] }); await step(1);
const aim = await ev(() => window.game.spells.aimDir());
check('the right stick aims the dash', aim.y < -0.9 && Math.abs(aim.x) < 0.2, JSON.stringify(aim));
await pad();
await ev(() => { window.game.party.cdUntil = 0; });
await tap(B.RB);
const hero1 = await ev(() => window.game.party.active);
await ev(() => { window.game.party.cdUntil = 0; });
await tap(B.LB);
const hero0 = await ev(() => window.game.party.active);
check('RB and LB switch heroes', hero1 === 1 && hero0 === 0, `${hero1} ${hero0}`);

// ---- 4. level-up cards with the d-pad
await ev(() => { const g = window.game; g.state.nextLevel = 20; g.state.experience = 20; g.checkLevelUp(); g.state.nextLevel = 1e12; });
await tap(B.DOWN);
await page.waitForSelector('.vs-cards', { timeout: 3000 });
await focusSettled();
const c0 = await focusInfo();
check('opening the cards focuses a card, not the close button', c0 && /vs-card/.test(c0.cls), JSON.stringify(c0));
await tap(B.DOWN);
const c1 = await focusInfo();
check('the d-pad moves to the next card', c1 && /vs-card/.test(c1.cls) && c1.text !== c0.text, JSON.stringify({ c0, c1 }));
await tap(B.UP);
const c2 = await focusInfo();
check('...and back', c2 && c2.text === c0.text, JSON.stringify(c2));
await tap(B.A);
const picked = await ev(() => ({ pending: window.game.state.pending, open: !!document.querySelector('.vs-cards') }));
check('A picks the focused card', picked.pending === 0 && !picked.open, JSON.stringify(picked));

// ---- 5. the spell panel: open, navigate, back
await tap(B.UP);
await page.waitForSelector('.vs-load', { timeout: 3000 });
await focusSettled();
const l0 = await focusInfo();
check('the d-pad up opens the spell panel and focuses inside it', l0 && l0.inPanel && l0.tag !== 'INPUT', JSON.stringify(l0));
const seen = new Set([l0.text + l0.cls]);
for (const b of [B.DOWN, B.DOWN, B.RIGHT, B.DOWN]) { await tap(b); const f = await focusInfo(); if (f) seen.add(f.text + f.cls); }
check('moving around the panel visits different elements', seen.size >= 3, String(seen.size));
await tap(B.B);
check('B closes the panel', !(await ev(() => !!document.querySelector('.vs-load'))));

// ---- 6. the pause menu
await tap(B.START);
await page.waitForSelector('.vs-pause', { timeout: 3000 });
await focusSettled();
const paused = await ev(() => ({ paused: window.game.state.paused, focus: document.activeElement && document.activeElement.innerText }));
check('Start pauses and focuses the menu', paused.paused && /Resume/.test(paused.focus || ''), JSON.stringify(paused));
await pad({ axes: [0, 1, 0, 0] }); await step(1); await pad(); await step(1);
const stickNav = await focusInfo();
check('the stick moves through the pause menu', stickNav && !/Resume/.test(stickNav.text), JSON.stringify(stickNav));
let reached = null;
for (let i = 0; i < 12; i++) { const f = await focusInfo(); if (f && /Sound/.test(f.text)) { reached = f; break; } await tap(B.DOWN); }
const m0 = await ev(() => document.activeElement.innerText);
await tap(B.A);
const m1 = await ev(() => document.activeElement.innerText);
check('A presses the focused button (sound toggles)', reached && m0 !== m1, `${m0} -> ${m1}`);
await tap(B.A);
let slider = null;
for (let i = 0; i < 12; i++) { const f = await focusInfo(); if (f && f.type === 'range') { slider = f; break; } await tap(B.DOWN); }
const dz0 = await ev(() => Number(document.activeElement.value));
await tap(B.RIGHT); await tap(B.RIGHT);
const dz1 = await ev(() => Number(document.activeElement.value));
check('left and right adjust the focused slider', slider && dz1 > dz0, `${dz0} -> ${dz1}`);
const saved = await ev(() => JSON.parse(localStorage.getItem('vs.input.v1') || '{}'));
check('the dead zone setting is remembered', Math.abs(saved.deadzone - dz1) < 0.001, JSON.stringify(saved));
await tap(B.B);
const closed = await ev(() => ({ paused: window.game.state.paused, panel: !!document.querySelector('.vs-pause') }));
check('B closes the pause menu and the game runs again', !closed.paused && !closed.panel, JSON.stringify(closed));
await tap(B.START); await tap(B.START);
check('Start toggles the pause menu', !(await ev(() => window.game.state.paused)));

// ---- 7. keyboard: Esc backs out in order, arrows move through panels, typing is left alone
await page.keyboard.press('i');
await page.waitForSelector('.vs-load');
await page.keyboard.press('Escape');
await page.waitForTimeout(80);
const esc1 = await ev(() => ({ load: !!document.querySelector('.vs-load'), pause: !!document.querySelector('.vs-pause') }));
check('Esc closes an open panel first', !esc1.load && !esc1.pause, JSON.stringify(esc1));
await page.keyboard.press('Escape');
await page.waitForSelector('.vs-pause');
await page.keyboard.press('Escape');
await page.waitForTimeout(80);
check('Esc with nothing open opens the pause menu, and closes it again', !(await ev(() => !!document.querySelector('.vs-pause'))));

await ev(() => { const g = window.game; g.state.nextLevel = 20; g.state.experience = 600; g.checkLevelUp(); g.state.nextLevel = 1e12; });   // several picks waiting
const pend0 = await ev(() => window.game.state.pending);
await page.keyboard.press('u');
await page.waitForSelector('.vs-cards');
await focusSettled();
const k0 = await focusInfo();
await page.keyboard.press('ArrowDown');
const k1 = await focusInfo();
const keysDown = await ev(() => Object.keys(window.game.state.keys).filter((k) => window.game.state.keys[k]));
check('arrow keys move through a panel instead of walking', k0 && k1 && k1.text !== k0.text && !keysDown.includes('ArrowDown'), JSON.stringify({ k0, k1, keysDown }));
let walked = 0;
for (const key of ['d', 'a', 's', 'w']) {                       // whichever way is open in this world
  const p0 = await ev(() => ({ x: window.game.state.player.wx, y: window.game.state.player.wy }));
  await page.keyboard.down(key); await ev(() => { for (let i = 0; i < 25; i++) window.game.gameLoop(1); }); await page.keyboard.up(key);
  const p1 = await ev(() => ({ x: window.game.state.player.wx, y: window.game.state.player.wy }));
  walked = Math.max(walked, Math.hypot(p1.x - p0.x, p1.y - p0.y));
  if (walked > 15) break;
}
check('WASD still walks while a panel is open', walked > 15, String(walked));
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
const k2 = await ev(() => window.game.state.pending);
check('Enter presses the focused card', pend0 >= 2 && k2 === pend0 - 1, `${pend0} -> ${k2}`);
if (await ev(() => !!document.querySelector('.vs-cards'))) await page.keyboard.press('Escape');
await ev(() => { window.game.state.pending = 0; window.game.ensureCards(); });
check('Esc closed the cards without opening the pause menu', !(await ev(() => !!document.querySelector('.vs-pause'))));

// typing in the search box must not trigger hotkeys
await ev(() => { const g = window.game; g.spells.timers = {}; g.spells.mana.value = g.stats.maxMana; });
await page.keyboard.press('i');
await page.waitForSelector('.vs-load');
await page.locator('.vs-load input.vs-in').first().click();
const typed = await (async () => {
  await page.keyboard.type('qru e');
  return ev(() => ({ value: document.querySelector('.vs-load input.vs-in').value, open: !!document.querySelector('.vs-load'), mana: window.game.spells.mana.value, max: window.game.stats.maxMana }));
})();
check('typing in the search field is not read as hotkeys', typed.value === 'qru e' && typed.open && typed.mana === typed.max, JSON.stringify(typed));
await page.keyboard.press('Escape');
const stillOpen = await ev(() => !!document.querySelector('.vs-load'));
check('Esc leaves the field first, the panel stays', stillOpen);

// equip with the keyboard alone: select a spell, then its Equip button, Enter
await page.locator('.vs-load input.vs-in').first().fill('');
await ev(() => { const g = window.game; g.spells.addSpell('nova'); });
await page.waitForTimeout(100);
const novaRow = page.locator('.vs-item', { hasText: 'Frost Nova', hasNotText: /on (Aria|Brann|Cyra)/ }).first();   // the spare one, not a hero's
await novaRow.focus();
await page.keyboard.press('Enter');
const equipBtn = page.locator('.vs-acts button', { hasText: /^⚔ Equip$/ }).first();
await equipBtn.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
const equipped = await ev(() => { const g = window.game; const nova = g.spells.spells.filter((s) => s.tpl === 'nova' && !g.spells.heldBy(s.uid)).pop() || g.spells.spells.filter((s) => s.tpl === 'nova').pop(); return { on: g.spells.auto.includes(nova.uid) }; });
check('a spell can be equipped with the keyboard, no dragging needed', equipped.on, JSON.stringify(equipped));
const unequipBtn = page.locator('.vs-acts button', { hasText: /^Unequip$/ }).first();
await unequipBtn.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
const unequipped = await ev(() => { const g = window.game; const nova = g.spells.spells.filter((s) => s.tpl === 'nova').pop(); return !g.spells.auto.includes(nova.uid); });
check('...and unequipped again', unequipped);
await page.keyboard.press('Escape');
await ev(() => { document.activeElement && document.activeElement.blur(); });
if (await ev(() => !!document.querySelector('.vs-pause'))) await page.keyboard.press('Escape');
await page.waitForTimeout(80);

// ---- 8. build mode with the pad
await ev(() => {
  const T = 48, g = window.game;
  window.findSpot = (kind) => { for (let r = 14; r < 300; r += 2) for (let a = 0; a < 6.28; a += 0.03) { const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r); const res = g.towers.check(kind, tx, ty); if (res.ok) return { tx, ty, plan: res.plan }; } return null; };
  window.goTo = (x, y) => { const p = g.state.player; p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.lastFogTx = null; g.world.update(x, y, 1200, 760, true); for (const e of [...g.state.enemies]) e.dead = true; g.reap(); };
  const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 999;
  window.T = T;
});
const spot = await ev(() => window.findSpot('spire'));
await ev((s) => { window.goTo((s.tx - 2.9) * 48, (s.ty + 0.5) * 48); window.game.lastMove = { x: 1, y: 0 }; for (let i = 0; i < 4; i++) window.game.gameLoop(1); }, spot);
await tap(B.LEFT);
await page.waitForSelector('.vs-build', { timeout: 3000 });
await focusSettled();
const bf = await focusInfo();
check('the d-pad left opens the build menu with a Place button focused', bf && /Place/.test(bf.text), JSON.stringify(bf));
await tap(B.A);
const placing = await ev(() => { const b = window.game.towers.build; return b && { kind: b.kind }; });
check('A on a structure starts placing it', placing && placing.kind === 'spire', JSON.stringify(placing));
await ev((s) => { window.goTo((s.tx - 2.9) * 48, (s.ty + 0.5) * 48); window.game.lastMove = { x: 1, y: 0 }; for (let i = 0; i < 4; i++) window.game.gameLoop(1); }, spot);
const ghost = await ev(() => { const b = window.game.towers.build; return b && { tx: b.tx, ty: b.ty, valid: b.valid }; });
check('with a pad the ghost sits ahead of the hero', ghost && ghost.valid && ghost.tx === spot.tx && ghost.ty === spot.ty, JSON.stringify(ghost));
await tap(B.B);
check('B cancels placing', (await ev(() => window.game.towers.build)) === null);
await tap(B.LEFT); await page.waitForTimeout(120); await tap(B.A);
await ev((s) => { window.goTo((s.tx - 2.9) * 48, (s.ty + 0.5) * 48); window.game.lastMove = { x: 1, y: 0 }; for (let i = 0; i < 4; i++) window.game.gameLoop(1); }, spot);
await tap(B.A);
const laid = await ev(() => ({ n: window.game.towers.recs.length, built: window.game.towers.recs[0] && window.game.towers.recs[0].built }));
check('A lays the construction site', laid.n === 1 && laid.built === false, JSON.stringify(laid));
await ev(() => { const g = window.game, rec = g.towers.recs[0]; window.goTo((rec.tx + 0.5) * 48, (rec.ty + 0.5) * 48 + 70); g.gameLoop(2); g.updateInteraction(); });
const siteTarget = await ev(() => window.game.target && window.game.target.kind);
await tap(B.A);
const delivered = await ev(() => { const r = window.game.towers.recs[0]; return { built: r.built, gold: r.delivered.gold }; });
check('A at a construction site delivers the materials', siteTarget === 'site' && (delivered.built || delivered.gold > 0), JSON.stringify({ siteTarget, delivered }));

// ---- 9. rumble
await ev(() => { window.__rumble = []; const g = window.game; g.godMode = false; g.state.health = g.state.maxHealth = 500; g.invulnUntil = 0; g.lastHurt = -99; });
await pad({ axes: [0.3, 0, 0, 0] }); await step(1); await pad();
await ev(() => { window.game.hurtPlayer(5); });
const rumbled = await ev(() => window.__rumble.length);
check('taking damage rumbles the controller', rumbled > 0, String(rumbled));
await ev(() => { window.__rumble = []; });
await ev(() => { window.game.ui; });
await page.evaluate(() => { document.dispatchEvent(new Event('x')); });
await ev(() => { const g = window.game; g.godMode = true; });

// ---- 10. unplugging falls back to the keyboard
await ev(() => { window.__padOn = false; window.dispatchEvent(new Event('gamepaddisconnected')); });
check('unplugging the controller falls back to keyboard hints', (await device()) === 'key', await device());

// ---- 11. the title screen with a save: pad and keyboard choose between Continue and New Game
await ev(() => { window.game.state.wallet.gold = 777; });
await ev(async () => { await window.game.requestSave('test', true); });
page = await context.newPage(); watch(page);
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.waitForTimeout(1500);
const sel = () => page.evaluate(() => window.game.input.menus[0] && window.game.input.menus[0].index);
check('the title screen starts on Continue', (await sel()) === 0, String(await sel()));
await realTap(B.DOWN);
check('d-pad down moves the highlight to New Game', (await sel()) === 1, String(await sel()));
await realTap(B.UP);
check('...and up goes back', (await sel()) === 0);
await page.keyboard.press('ArrowDown');
check('the keyboard moves the highlight too', (await sel()) === 1, String(await sel()));
await page.keyboard.press('Enter');
const warn = await page.evaluate(() => window.game.input.menus[0].items()[1].btn.label.text);
check('New Game with a save asks before overwriting', /OVERWRITE/.test(warn), warn);
await page.keyboard.press('ArrowUp');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
const loaded = await page.evaluate(() => window.game.state.wallet.gold);
check('Continue loads the saved game', loaded === 777, String(loaded));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
preview.kill();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
