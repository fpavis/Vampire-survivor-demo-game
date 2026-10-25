// Phase 9 end-to-end checks: the SVG icon set and fonts (no emoji anywhere on screen), and the later Phase 9 steps.
// Sections can be picked with ONLY=icons,...; SHOTS=<dir> saves screenshots.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4191;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (section) => !ONLY || ONLY.includes(section);

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
const ev = (fn, arg) => page.evaluate(fn, arg);
const loop = (n) => ev((n) => { for (let i = 0; i < n; i++) window.game.gameLoop(1); }, n);

await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
// every text the player can see: the DOM and each canvas text in the scene
const emojiOnScreen = () => ev(() => {
  const EMOJI = /[\p{Extended_Pictographic}️]/u;
  const hits = [];
  const dom = document.body.innerText;
  for (const line of dom.split('\n')) if (EMOJI.test(line)) hits.push('dom: ' + line.slice(0, 60));
  const walk = (o) => {
    if (typeof o.text === 'string' && EMOJI.test(o.text)) hits.push('canvas: ' + o.text.slice(0, 60));
    for (const c of o.children || []) walk(c);
  };
  walk(window.game.app.stage);
  return hits;
});
check('the title screen shows no emoji', (await emojiOnScreen()).length === 0, JSON.stringify(await emojiOnScreen()));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player);
await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });

// ---- icons and fonts
if (want('icons')) {
  await loop(120);
  await page.waitForTimeout(300);
  const fonts = await ev(() => ({ nunito: document.fonts.check('700 16px Nunito'), cinzel: document.fonts.check('700 16px Cinzel'), ui: getComputedStyle(document.getElementById('ui-root')).fontFamily }));
  check('the bundled fonts are loaded and used', fonts.nunito && fonts.cinzel && /Nunito/.test(fonts.ui), JSON.stringify(fonts));
  const hud = await ev(() => ({ icons: document.querySelectorAll('#ui-root svg.vs-icon').length }));
  check('the HUD draws SVG icons', hud.icons >= 5, JSON.stringify(hud));
  const panels = [];
  for (const [open, close] of [['i', 'i'], ['j', 'j'], ['b', 'b'], ['Escape', 'Escape']]) {
    await page.keyboard.press(open);
    await page.waitForTimeout(250);
    panels.push({ open, hits: await emojiOnScreen(), icons: await ev(() => document.querySelectorAll('.vs-panel svg.vs-icon').length) });
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/icons-${open}.png` });
    await page.keyboard.press(close);
    await page.waitForTimeout(200);
  }
  check('panels use icons and show no emoji', panels.every((p) => !p.hits.length && p.icons > 0), JSON.stringify(panels));
  // canvas: a banner with an icon, a toast with an icon, a zone label, the world map
  await ev(() => { const g = window.game; g.ui.banner('NEW SPELL: METEOR', 0xb9a5ff, 'spell-meteor'); g.ui.toast('Found: Meteor', 'chest'); });
  await page.keyboard.press('m');
  await page.waitForTimeout(400);
  const canvas = await ev(() => {
    const g = window.game;
    return { banner: g.ui.elements.banner.children.length, toast: g.ui.toastText.children.length, zone: g.zoneIcon, map: !!g.ui.mapOverlay };
  });
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/icons-map.png` });
  const mapHits = await emojiOnScreen();
  await page.keyboard.press('m');
  check('banners, toasts and the zone label carry icons', canvas.banner === 2 && canvas.toast === 2 && !!canvas.zone, JSON.stringify(canvas));
  check('the world map and its legend show no emoji', canvas.map && mapHits.length === 0, JSON.stringify(mapHits));
}

// ---- settings: every option takes effect and is remembered
if (want('settings')) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const tabs = await ev(() => [...document.querySelectorAll('.vs-pause .vs-tab')].map((t) => t.dataset.tab));
  check('the pause menu has settings tabs', ['game', 'video', 'audio', 'controls', 'access', 'help'].every((t) => tabs.includes(t)), JSON.stringify(tabs));
  // every setting below is changed through the panel's own controls
  await ev(() => document.querySelector('.vs-pause [data-tab="video"]').click());
  await page.waitForTimeout(150);
  const pick = (label, value) => ev(([label, value]) => {
    const row = [...document.querySelectorAll('.vs-pause .vs-row')].find((r) => r.querySelector('span')?.innerText === label);
    const sel = row.querySelector('select'), rng = row.querySelector('input[type=range]');
    const el = sel || rng;
    el.value = String(value);
    el.dispatchEvent(new Event(sel ? 'change' : 'input', { bubbles: true }));
  }, [label, value]);
  await pick('Quality', 'low');
  await pick('Render scale', '0.7');
  await pick('Frame rate limit', '30');
  await pick('Camera', '2');
  await pick('Screen shake', '0');
  await pick('Damage numbers', 'off');
  await pick('HUD size', '1.2');
  await pick('Minimap', 'large');
  await pick('Monster health bars', 'always');
  await page.waitForTimeout(200);
  const v = await ev(() => {
    const g = window.game;
    g.fx.shake = 0; g.fx.addShake(10);
    const pops = g.fx.popups.length;
    const p = g.state.player, e = g.makeEnemy('SLIME', p.wx + 400, p.wy, { level: 1 });
    g.damageEnemy(e, 1, { noCrit: true });
    g.gameLoop(1);
    return {
      particles: g.fx.maxParticles, glows: g.glowLayer.visible, ambience: g.ambience.enabled,
      res: g.app.renderer.resolution, fps: g.app.ticker.maxFPS, zoom: g.worldContainer.scale.x,
      shake: g.fx.shake, popups: g.fx.popups.length - pops, hs: getComputedStyle(document.documentElement).getPropertyValue('--hs').trim(),
      map: g.ui.minimapScale, bar: e.hpBar.bg.visible, saved: JSON.parse(localStorage.getItem('vs.settings.v1') || '{}')
    };
  });
  check('quality Low lowers the particle budget and turns ambience and glows off', v.particles === 150 && !v.glows && v.ambience === false, JSON.stringify(v));
  check('render scale and the frame limit reach the renderer', Math.abs(v.res - 0.7) < 0.01 && v.fps === 30, JSON.stringify(v));
  check('camera zoom scales the world', Math.abs(v.zoom - 1.2) < 1e-6, JSON.stringify(v));
  check('screen shake off and damage numbers off take effect', v.shake === 0 && v.popups === 0, JSON.stringify(v));
  check('HUD size, minimap size and health bars take effect', v.hs === '1.2' && v.map === 1.3 && v.bar === true, JSON.stringify(v));
  check('settings are remembered', v.saved.quality === 'low' && v.saved.fpsCap === 30 && v.saved.zoom === 2 && v.saved.healthBars === 'always', JSON.stringify(v.saved));
  // the world still maps the pointer correctly when zoomed: the screen centre is the hero
  const centre = await ev(() => { const g = window.game, p = g.state.player; g.applyCamera(); const w = g.screenToWorld(g.app.screen.width / 2, g.app.screen.height / 2); return Math.hypot(w.x - g.cam.x, w.y - g.cam.y); });
  check('screen-to-world follows the zoom', centre < 2, String(centre));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/settings-video.png` });
  // back to the defaults so the rest of the run looks normal
  await ev(() => { localStorage.removeItem('vs.settings.v1'); });
  await pick('Quality', 'high'); await pick('Render scale', '1'); await pick('Frame rate limit', '0'); await pick('Camera', '1');
  await pick('Screen shake', '1'); await pick('Damage numbers', 'all'); await pick('HUD size', '1'); await pick('Minimap', 'medium'); await pick('Monster health bars', 'hurt');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

// ---- save slots, backups, export and import
if (want('slots')) {
  await ev(async () => {
    const g = window.game;
    g.state.wallet.gold = 4321;
    await g.requestSave('manual', true, 'slot2');
    g.state.wallet.gold = 5555;
    await g.requestSave('manual', true, 'slot2');
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await ev(() => [...document.querySelectorAll('.vs-pacts .vs-btn')].find((b) => /Load game/.test(b.innerText)).click());
  await page.waitForSelector('.vs-slots [data-slot-id="slot2"]');
  await page.waitForTimeout(300);
  const card = await ev(() => { const c = document.querySelector('.vs-slots [data-slot-id="slot2"]'); return { text: c.innerText, thumb: !!c.querySelector('img'), backups: /Backups \(1\)/.test(c.innerText) }; });
  check('a manual save fills its slot with a picture and keeps a backup', /Slot 2/.test(card.text) && card.thumb && card.backups, JSON.stringify(card));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/slots.png` });
  // export slot 2, import it into slot 3
  await ev(() => [...document.querySelectorAll('.vs-slots [data-slot-id="slot2"] .vs-btn')].find((b) => b.innerText.trim() === 'Export').click());
  await page.waitForTimeout(150);
  const text = await ev(() => document.querySelector('.vs-slots [data-slot-id="slot2"] .vs-export textarea').value);
  await ev((t) => {
    const ta = document.querySelector('.vs-import textarea');
    ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
    const sel = document.querySelector('.vs-import select');
    sel.value = 'slot3'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, text);
  await page.waitForTimeout(100);
  await ev(() => [...document.querySelectorAll('.vs-import .vs-btn')].find((b) => b.innerText.trim() === 'Import').click());
  await page.waitForTimeout(500);
  const s3 = await ev(async () => (await window.game.store.load('slot3'))?.inventory.wallet.gold);
  check('an exported save imports into another slot', text.startsWith('SURVIVAL-SAVE:1:') && s3 === 5555, String(s3));
  // break slot 2: it shows as unreadable and its backup still loads
  await ev(async () => { const st = window.game.store; if (st.kind === 'indexeddb') { const db = st.db; await new Promise((res) => { const t = db.transaction('saves', 'readwrite'); t.objectStore('saves').put(new Uint8Array([9, 9, 9]), 'slot2'); t.oncomplete = res; }); } else await st.save('slot2', { version: 99 }); });
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await ev(() => [...document.querySelectorAll('.vs-pacts .vs-btn')].find((b) => /Load game/.test(b.innerText)).click());
  await page.waitForTimeout(600);
  const broken = await ev(() => document.querySelector('.vs-slots [data-slot-id="slot2"]').innerText);
  check('a corrupt save is reported, not loaded', /could not be read/.test(broken), broken.slice(0, 120));
  await ev(() => [...document.querySelectorAll('.vs-slots [data-slot-id="slot2"] .vs-btn')].find((b) => /Backups/.test(b.innerText)).click());
  await page.waitForTimeout(150);
  await ev(() => document.querySelector('.vs-slots [data-slot-id="slot2"] [data-act="backup"]').click());
  await page.waitForFunction(() => window.game.state.player && window.game.state.wallet.gold === 4321 && window.game.ui.fadeAlpha < 0.05, null, { timeout: 10000 }).catch(() => {});
  const restored = await ev(() => window.game.state.wallet.gold);
  check('the backup of a corrupt slot loads', restored === 4321, String(restored));
  // delete needs a second press
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await ev(() => [...document.querySelectorAll('.vs-pacts .vs-btn')].find((b) => /Load game/.test(b.innerText)).click());
  await page.waitForTimeout(500);
  await ev(() => document.querySelector('.vs-slots [data-slot-id="slot3"] [data-act="delete"]').click());
  await page.waitForTimeout(100);
  const stillThere = await ev(async () => !!(await window.game.store.load('slot3')));
  await ev(() => document.querySelector('.vs-slots [data-slot-id="slot3"] [data-act="delete"]').click());
  await page.waitForTimeout(400);
  const gone = await ev(async () => !(await window.game.store.load('slot3')));
  check('deleting a save asks for a second press', stillThere && gone, JSON.stringify({ stillThere, gone }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  if (await ev(() => !!document.querySelector('.vs-pause'))) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
}

// ---- journal: message log and statistics, kept in the save
if (want('journal')) {
  const st = await ev(() => {
    const g = window.game, p = g.state.player;
    for (let i = 0; i < 3; i++) { const e = g.makeEnemy('SLIME', p.wx + 60, p.wy, { level: 1 }); g.damageEnemy(e, 1e6, { noCrit: true }); }
    g.ui.toast('A test discovery', 'map');
    g.state.wallet.gold += 25;
    g.state.keys = { d: true }; for (let i = 0; i < 40; i++) g.gameLoop(1); g.state.keys = {};
    return { by: g.state.byType.SLIME, dist: g.state.distance, gold: g.state.goldEarned };
  });
  check('statistics count kills by kind, distance and gold', st.by >= 3 && st.dist > 50 && st.gold >= 25, JSON.stringify(st));
  await page.keyboard.press('j');
  await page.waitForTimeout(200);
  await ev(() => document.querySelector('[data-jtab="log"]').click());
  await page.waitForTimeout(150);
  const log = await ev(() => document.querySelector('.vs-log')?.innerText || '');
  await ev(() => document.querySelector('[data-jtab="stats"]').click());
  await page.waitForTimeout(150);
  const stats = await ev(() => document.querySelector('.vs-stats')?.innerText || '');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/journal-stats.png` });
  await page.keyboard.press('j');
  check('the journal lists recent messages', /A test discovery/.test(log), log.slice(0, 120));
  check('the journal shows statistics', /Monsters defeated/.test(stats) && /Slime/i.test(stats), stats.slice(0, 160));
  const saved = await ev(async () => { const g = window.game; await g.requestSave('test', true); const d = await g.store.load('autosave'); return d.stats; });
  check('statistics are saved', saved.byType.SLIME >= 3 && saved.distance > 50 && saved.goldEarned >= 25, JSON.stringify(saved));
}

// ---- title screen: Load, Options and Credits; quit to the title and continue
if (want('front')) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await ev(() => [...document.querySelectorAll('.vs-pacts .vs-btn')].find((b) => /Quit to title/.test(b.innerText)).click());
  await page.waitForTimeout(200);
  await ev(() => [...document.querySelectorAll('.vs-pacts .vs-btn')].find((b) => /Quit to the title/.test(b.innerText)).click());
  await page.waitForFunction(() => !window.game.state.player && window.game.input.menus.length > 0, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const title = await ev(() => ({ items: window.game.input.menus[0]?.items().map((i) => i.btn.label.text), hud: window.game.ui.container.visible, version: document.querySelector('.vs-version')?.innerText || '' }));
  check('Quit to title returns to a full menu', JSON.stringify(title.items) === JSON.stringify(['CONTINUE', 'NEW GAME', 'LOAD GAME', 'OPTIONS', 'CREDITS']) && !title.hud && /^v\d/.test(title.version), JSON.stringify(title));
  check('the title screen shows no emoji after quitting', (await emojiOnScreen()).length === 0);
  // keyboard: down to Options, Enter opens it, Esc closes it again
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const opt = await ev(() => ({ open: !!document.querySelector('.vs-options'), tabs: document.querySelectorAll('.vs-options .vs-tab').length }));
  await page.keyboard.press('ArrowDown');
  const menuStill = await ev(() => window.game.input.menus[0].index);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Options opens from the title with its tabs and takes the keys', opt.open && opt.tabs === 6 && menuStill === 3, JSON.stringify({ opt, menuStill }));
  check('Esc closes Options', await ev(() => !document.querySelector('.vs-options')));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const credits = await ev(() => document.querySelector('.vs-credits')?.innerText || '');
  check('Credits name the icon and font sources', /game-icons\.net/.test(credits) && /Cinzel/.test(credits) && /Nunito/.test(credits), credits.slice(0, 80));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // Continue loads the newest save
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player, null, { timeout: 8000 });
  check('Continue starts the newest save', await ev(() => window.game.state.byType.SLIME >= 3));
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll phase 9 checks passed');
process.exit(failed ? 1 : 0);
