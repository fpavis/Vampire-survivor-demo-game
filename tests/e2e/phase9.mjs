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
// the panels refresh from the game loop, which runs slowly on a software GPU: wait for the state, not a fixed time
const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 4000 }).then(() => true, () => false);

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

// ---- party and loadout: another hero's loadout, sets, assist, favourites, New badges, sort memory, DPS
if (want('loadout')) {
  const prep = await ev(() => {
    const g = window.game, sp = g.spells;
    g.party.cdUntil = 0;
    const nova = sp.addSpell('nova', 2), cloud = sp.addSpell('cloud', 1);
    return { nova: nova.uid, cloud: cloud.uid, active: g.party.active, heroes: g.party.heroes.length };
  });
  await page.keyboard.press('i');
  await page.waitForSelector('.vs-load');
  const badge = await ev((uid) => !!document.querySelector(`[data-spell="${uid}"] .vs-new`), prep.nova);
  check('a newly found spell carries a New badge', badge);
  const other = (prep.active + 1) % prep.heroes;
  await ev((i) => document.querySelector(`.vs-load [data-hero="${i}"]`).click(), other);
  await until(() => !!document.querySelector('.vs-viewing'));
  const view = await ev(() => ({ title: document.querySelector('.vs-load h2').innerText.split('\n')[0], banner: !!document.querySelector('.vs-viewing'), view: window.game.spells.viewIndex(), active: window.game.party.active }));
  check('a hero tab shows that hero\'s loadout without switching', /\(resting\)/.test(view.title) && view.banner && view.view === other && view.active === prep.active, JSON.stringify(view));
  // equip with the keyboard: it lands on the resting hero, not on the active one
  await ev((uid) => document.querySelector(`[data-spell="${uid}"]`).focus(), prep.nova);
  await page.keyboard.press('f');
  await until((uid) => !!document.querySelector(`[data-zone="auto"] [data-spell="${uid}"], [data-drop="equip"] [data-spell="${uid}"]`), prep.nova);
  const eq = await ev(({ uid, other }) => { const g = window.game; g.party.commit(); return { rest: g.party.heroes[other].auto.includes(uid), live: g.spells.auto.includes(uid) }; }, { uid: prep.nova, other });
  check('equipping while viewing a resting hero changes that hero\'s loadout', eq.rest && !eq.live, JSON.stringify(eq));
  // loadout sets: keep, change, load back
  await ev(() => document.querySelector('[data-keep="0"]').click());
  const setOn = await until(() => !document.querySelector('[data-set="0"]').disabled);
  await ev((uid) => window.game.spells.unequip(uid), prep.nova);
  await ev(() => document.querySelector('[data-set="0"]').click());
  const back = await ev(({ uid, other }) => window.game.party.heroes[other].auto.includes(uid), { uid: prep.nova, other });
  check('a kept loadout set equips again in one press', setOn && back);
  // assist: select the spell, lend it to the party
  await ev((uid) => document.querySelector(`[data-spell="${uid}"]`).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), prep.nova);
  await until(() => !!document.querySelector('[data-act="assist"]'));
  await ev(() => document.querySelector('[data-act="assist"]').click());
  await until(() => /assists with/.test(document.querySelector('.vs-viewing')?.innerText || ''));
  const assist = await ev(({ uid, other }) => window.game.party.heroes[other].assist === uid && /assist/.test(document.querySelector('.vs-viewing').innerText), { uid: prep.nova, other });
  check('a resting hero can assist with one of their auto spells', assist);
  // favourites go first in the bag
  const bag0 = await ev(() => [...document.querySelectorAll('[data-drop="unequip"] [data-spell]')].map((e) => e.dataset.spell));
  const last = bag0[bag0.length - 1];
  await ev((uid) => document.querySelector(`[data-drop="unequip"] [data-spell="${uid}"] .vs-favb`).click(), last);
  await until((uid) => document.querySelector('[data-drop="unequip"] [data-spell]')?.dataset.spell === uid, last);
  const bag1 = await ev(() => [...document.querySelectorAll('[data-drop="unequip"] [data-spell]')].map((e) => e.dataset.spell));
  check('a favourite spell is listed first', bag0.length > 1 && bag1[0] === last && await ev((uid) => window.game.spells.item(uid).fav === true, last), JSON.stringify({ bag0, bag1 }));
  // a damage estimate is shown for the selected spell
  const dps = await ev(() => document.querySelector('.vs-load .vs-dps')?.innerText || '');
  check('the selected spell shows a damage estimate', /\d+\s*\/s on one monster/.test(dps) && /group of five/.test(dps), dps);
  // sort order is remembered
  await ev(() => { const s = document.querySelectorAll('.vs-tools select')[0]; s.value = 'name'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(150);
  // Tab shows the next hero, still without switching
  const v0 = await ev(() => window.game.spells.viewIndex());
  await page.keyboard.press('Tab');
  await until((v0) => window.game.spells.viewIndex() !== v0, v0);
  const v1 = await ev(() => ({ view: window.game.spells.viewIndex(), active: window.game.party.active }));
  check('Tab shows the next hero in the spell panel', v1.view !== v0 && v1.active === prep.active, JSON.stringify({ v0, v1 }));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/loadout-view.png` });
  // Make active
  await ev((i) => window.game.spells.setView(i), other);
  await until(() => !!document.querySelector('[data-act="make-active"]'));
  await ev(() => { window.game.party.cdUntil = 0; document.querySelector('[data-act="make-active"]').click(); });
  await until(() => !document.querySelector('.vs-viewing'));
  const made = await ev((uid) => ({ active: window.game.party.active, title: document.querySelector('.vs-load h2').innerText.split('\n')[0], live: window.game.spells.auto.includes(uid) }), prep.nova);
  check('Make active switches to the hero being viewed', made.active === other && !/\(resting\)/.test(made.title) && made.live, JSON.stringify(made));
  await page.keyboard.press('i');
  await until(() => !document.querySelector('.vs-load'));
  const after = await ev(() => ({ isNew: window.game.spells.spells.some((s) => s.isNew), view: window.game.spells.viewHero ?? null }));
  check('closing the panel clears the New badges and the view', !after.isNew && after.view === null, JSON.stringify(after));
  await page.keyboard.press('i');
  await page.waitForSelector('.vs-load');
  const sortKept = await ev(() => document.querySelectorAll('.vs-tools select')[0].value);
  await page.keyboard.press('i');
  check('the spell sort order is remembered', sortKept === 'name', sortKept);
  // the assisting hero (now resting again after switching back) fires their spell from the party
  const fired = await ev(({ uid, back }) => {
    const g = window.game, sp = g.spells, p = g.state.player;
    g.party.cdUntil = 0; g.party.switchTo(back);
    const h = g.party.heroes.find((x) => x.assist === uid);
    for (let i = 0; i < 6; i++) g.makeEnemy('SLIME', p.wx + 80 + i * 10, p.wy + 20, { level: 1 });
    let n = 0; const orig = sp.fireAuto.bind(sp);
    sp.fireAuto = (r) => { const ok = orig(r); if (ok && r.item.uid === uid) n++; return ok; };
    for (let i = 0; i < 400; i++) g.gameLoop(1);
    sp.fireAuto = orig;
    return { n, resting: !!h && g.party.heroes.indexOf(h) !== g.party.active };
  }, { uid: prep.nova, back: prep.active });
  check('an assisting resting hero casts their spell, at a slower pace', fired.resting && fired.n >= 1 && fired.n <= 4, JSON.stringify(fired));
  const saved = await ev(async () => { const g = window.game; await g.requestSave('test', true); const d = await g.store.load('autosave'); return { presets: d.party.heroes.map((h) => h.presets.filter(Boolean).length), assist: d.party.heroes.map((h) => h.assist), fav: d.inventory.spells.some((s) => s.fav) }; });
  check('sets, assist and favourites are saved', saved.presets.some((n) => n > 0) && saved.assist.includes(prep.nova) && saved.fav, JSON.stringify(saved));
}

// ---- towns: the training dummy, and the healer's own lines
if (want('dummy')) {
  const town = await ev(() => {
    const g = window.game, src = g.overworld;
    for (let r = 0; r < 60; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
      if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
      const q = src.poiForCell(cx, cy);
      if (q && q.type === 'city') { g.enterPlace(q); return q.id; }
    }
    return null;
  });
  await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 8000 });
  const d0 = await ev(() => {
    const g = window.game, e = g.state.enemies.find((x) => x.dummy);
    if (!e) return null;
    let kills = 0; const off = g.events.on('EnemyKilled', () => kills++);
    const p = g.state.player; p.wx = e.wx - 120; p.wy = e.wy;
    for (let i = 0; i < 300; i++) g.gameLoop(1);
    g.damageEnemy(e, 1e9, { noCrit: true });
    for (let i = 0; i < 20; i++) g.gameLoop(1);
    if (typeof off === 'function') off();
    return { alive: !e.dead && g.state.enemies.includes(e), hp: e.health === e.maxHealth, kills, safe: g.safeFor > 100, total: Math.round(g.dummy.meter.total), x: e.wx, y: e.wy, marker: g.map.markers.some((m) => m.icon === 'dummy') };
  });
  check('every town has a training dummy that takes hits and never dies', !!d0 && d0.alive && d0.hp && d0.kills === 0 && d0.total > 1000, JSON.stringify(d0));
  check('the dummy is no threat: the town stays safe for editing spells', !!d0 && d0.safe, JSON.stringify(d0));
  await page.waitForTimeout(200);
  const meter = await ev(() => document.querySelector('.vs-meter')?.innerText || '');
  check('the damage meter shows while hitting the dummy', /Training dummy/.test(meter) && /damage\/s/.test(meter), meter.replace(/\n/g, ' '));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/dummy.png` });
  await ev(() => {
    const g = window.game, it = g.interactables.find((i) => i.kind === 'healer'), p = g.state.player;
    for (const c of g.critters.list) { c.wx = c.tx = it.x + 700; c.wy = c.ty = it.y + 700; c.home = { x: c.wx, y: c.wy, r: 5 }; c.wait = 9999; }
    p.wx = it.x - 30; p.wy = it.y; g.gameLoop(1); g.updateInteraction();
  });
  await page.keyboard.press('e');
  await page.waitForSelector('.vs-heal', { timeout: 3000 }).catch(() => {});
  const says = await ev(() => document.querySelector('.vs-heal .vs-says')?.innerText || '');
  check('the healer speaks their own lines', says.length > 10 && /“.+”/.test(says), says);
  await ev(() => window.game.closeNpcPanels?.());
  await ev(() => window.game.exitPlace());
  await page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 8000 });
  check('leaving town clears the dummy and its meter', await ev(() => !window.game.state.enemies.some((e) => e.dummy) && !document.querySelector('.vs-meter')));
}

// ---- codex: bestiary with portraits, spells, runes and places
if (want('codex')) {
  await ev(() => { const g = window.game, p = g.state.player; const e = g.makeEnemy('BOAR', p.wx + 60, p.wy, { level: 1 }); g.damageEnemy(e, 1e6, { noCrit: true }); g.gameLoop(1); });
  await page.keyboard.press('j');
  await page.waitForTimeout(200);
  await ev(() => document.querySelector('[data-jtab="codex"]').click());
  await page.waitForTimeout(200);
  const best = await ev(() => { const el = document.querySelector('[data-monster="BOAR"]'); return { shown: !!el, img: !!el?.querySelector('img[src^="data:image/png"]'), text: el?.innerText || '', unknown: document.querySelectorAll('.vs-cx.unknown').length, count: document.querySelector('[data-ctab="monsters"] small')?.innerText }; });
  check('the bestiary lists a monster met, with a portrait and its habits', best.shown && best.img && /Boar/.test(best.text) && /defeated [1-9]/.test(best.text) && best.unknown > 0, JSON.stringify(best));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/codex-bestiary.png` });
  await ev(() => document.querySelector('[data-ctab="spells"]').click());
  await page.waitForTimeout(100);
  const spells = await ev(() => ({ known: document.querySelectorAll('.vs-codex .vs-cx:not(.unknown)').length, text: document.querySelector('.vs-codex').innerText }));
  check('the spell compendium lists the spells found', spells.known >= 3 && /Nova|Spore Cloud/i.test(spells.text), String(spells.known));
  await ev(() => document.querySelector('[data-ctab="places"]').click());
  await page.waitForTimeout(100);
  const places = await ev(() => ({ n: document.querySelectorAll('[data-place]').length, text: document.querySelector('.vs-codex').innerText }));
  check('the places list shows the places discovered', places.n >= 1 && /visited|cleared|seen/.test(places.text), JSON.stringify({ n: places.n }));
  await page.keyboard.press('j');
  const saved = await ev(async () => { const g = window.game; await g.requestSave('test', true); const d = await g.store.load('autosave'); return d.codex; });
  check('the codex is saved', saved.monsters.includes('BOAR') && saved.spells.includes('nova') && saved.spells.length >= 3, JSON.stringify(saved));
}

// ---- 9d: game feel, sound, story moments, new species
if (want('feel')) {
  const feel = await ev(() => {
    const g = window.game, p = g.state.player;
    g.hitStop = 0; g.lastCritStop = -1e9;
    const elite = g.makeEnemy('SLIME', p.wx + 80, p.wy, { level: 1, elite: true });
    g.damageEnemy(elite, 1e9, { noCrit: true });
    const stop = g.hitStop;
    for (let i = 0; i < 12; i++) g.gameLoop(1);
    // three quick hits on one monster make one number that adds up
    const golem = g.makeEnemy('GOLEM', p.wx + 260, p.wy, { level: 5 });
    golem.armor = 0;
    const n0 = g.fx.popups.length;
    g.damageEnemy(golem, 7, { noCrit: true }); g.damageEnemy(golem, 7, { noCrit: true }); g.damageEnemy(golem, 7, { noCrit: true });
    const stack = g.fx.stacks.get(golem.uid);
    return { stop, added: g.fx.popups.length - n0, text: stack && stack.t.text };
  });
  check('a big kill holds the action for a moment', feel.stop >= 4, JSON.stringify(feel));
  check('quick hits on one monster stack into one number', feel.added === 1 && feel.text === '21', JSON.stringify(feel));
  const lead = await ev(() => {
    const g = window.game, p = g.state.player;
    for (const e of [...g.state.enemies]) e.dead = true; g.reap();
    // walk the way that is open (a wall ahead would stop the hero, and a hero who does not move has no lead)
    let best = { moved: -1, ahead: 0 };
    for (const [key, dx, dy] of [['d', 1, 0], ['a', -1, 0], ['s', 0, 1], ['w', 0, -1]]) {
      const x0 = p.wx, y0 = p.wy;
      g.state.keys = { [key]: true }; for (let i = 0; i < 150; i++) g.gameLoop(1); g.state.keys = {};
      const moved = (p.wx - x0) * dx + (p.wy - y0) * dy;
      const ahead = (g.cam.x - p.wx) * dx + (g.cam.y - p.wy) * dy;
      for (let i = 0; i < 240; i++) g.gameLoop(1);
      if (moved > best.moved) best = { moved: Math.round(moved), ahead: Math.round(ahead), key };
      if (moved > 150) break;
    }
    return { ...best, still: Math.round(Math.hypot(g.cam.x - p.wx, g.cam.y - p.wy)) };
  });
  check('the camera looks ahead while walking and settles when standing', lead.moved > 150 && lead.ahead > 15 && lead.still < 6, JSON.stringify(lead));
  const trail = await ev(() => {
    const g = window.game, p = g.state.player;
    g.dropGem(p.wx + 150, p.wy, 5);
    const gem = g.state.gems[g.state.gems.length - 1]; gem.magnetized = true; gem.vel = 8;
    const n0 = g.fx.particles.length;
    for (let i = 0; i < 6; i++) g.gameLoop(1);
    return g.fx.particles.length - n0;
  });
  check('a gem flying in leaves a short trail', trail > 0, String(trail));
  await page.keyboard.press('j');
  await until(() => !!document.querySelector('.vs-journal'));
  const anim = await ev(() => getComputedStyle(document.querySelector('.vs-journal')).animationName);
  await ev(() => document.documentElement.classList.add('vs-reduced'));
  const reduced = await ev(() => getComputedStyle(document.querySelector('.vs-journal')).animationName);
  await ev(() => document.documentElement.classList.remove('vs-reduced'));
  await page.keyboard.press('j');
  check('panels ease in, and not under reduced motion', anim === 'vs-panel-in' && reduced === 'none', JSON.stringify({ anim, reduced }));
}

if (want('sound')) {
  const s0 = await ev(async () => {
    const g = window.game, a = g.audio;
    a.unlock(); await a.ctx.resume();
    for (let i = 0; i < 40; i++) g.gameLoop(1);
    return a.stats();
  });
  check('an ambient bed plays for the region', s0.state === 'running' && ['field', 'forest', 'desert', 'shore', 'mountain'].includes(s0.bed), JSON.stringify(s0));
  const duck = await ev(async () => {
    const a = window.game.audio;
    a.stinger('stingDiscover');
    const during = a.ducked;
    await new Promise((r) => setTimeout(r, 3200));
    return { during, after: a.ducked, played: a.played.stingDiscover || 0 };
  });
  check('a stinger plays with the music ducked under it, then the music returns', duck.during && !duck.after && duck.played >= 1, JSON.stringify(duck));
  const steps = await ev(async () => {
    const g = window.game, a = g.audio;
    const before = Object.entries(a.played).filter(([k]) => k.startsWith('step')).reduce((n, [, v]) => n + v, 0);
    // back and forth, so a wall ahead cannot stop the walk; real time between strides lets each step sound play
    const d0 = g.state.distance;
    for (let k = 0; k < 4; k++) { g.state.keys = k % 2 ? { a: true } : { d: true }; for (let i = 0; i < 30; i++) g.gameLoop(1); g.state.keys = {}; await new Promise((r) => setTimeout(r, 130)); }
    const after = Object.entries(a.played).filter(([k]) => k.startsWith('step')).reduce((n, [, v]) => n + v, 0);
    return { steps: after - before, last: g.lastStep, walked: Math.round(g.state.distance - d0) };
  });
  check('footsteps follow the ground underfoot', steps.walked > 100 && steps.steps >= 2 && !!steps.last, JSON.stringify(steps));
}

if (want('story')) {
  await ev(() => { const g = window.game; for (const e of [...g.state.enemies]) e.dead = true; g.reap(); g.spawnBoss(); for (let i = 0; i < 3; i++) g.gameLoop(1); });
  const boss = await until(() => !!document.querySelector('[data-card="boss"] .n'));
  const bossText = await ev(() => document.querySelector('.vs-story-card')?.innerText || '');
  check('a warlord shows itself with a card', boss && /great foe/i.test(bossText) && /Warlord of/i.test(bossText), bossText.replace(/\n/g, ' | '));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/card-boss.png` });
  await ev(() => { const g = window.game, e = g.state.enemies.find((x) => x.isBoss && !x.dead); e.lord = 'forest'; g.damageEnemy(e, 1e12, { noCrit: true }); for (let i = 0; i < 3; i++) g.gameLoop(1); });
  const vic = await until(() => /Thornax/.test(document.querySelector('[data-card="victory"]')?.innerText || ''));
  check('a demon lord falls with a victory card', vic);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/card-victory.png` });
  // the ending, after the Sovereign's quest is turned in
  await ev(() => { const g = window.game; g.events.emit('QuestCompleted', { id: 'm6_sovereign' }); for (let i = 0; i < 3; i++) g.gameLoop(1); });
  const ending = await until(() => !!document.querySelector('.vs-ending .vs-roll'));
  const endState = await ev(() => ({ paused: window.game.state.paused, text: document.querySelector('.vs-ending')?.innerText || '' }));
  if (process.env.SHOTS) { await page.waitForTimeout(4000); await page.screenshot({ path: `${process.env.SHOTS}/ending.png` }); }
  await page.keyboard.press('Escape');
  const skipped = await until(() => !document.querySelector('.vs-ending') && !window.game.state.paused);
  check('the ending rolls the epilogue, the run and the credits, paused, and can be skipped', ending && endState.paused && /The road so far/.test(endState.text) && /game-icons\.net/.test(endState.text) && skipped, endState.text.slice(0, 80));
  // the death screen and the way back
  await ev(() => { const g = window.game; g.godMode = false; for (const h of g.party.heroes) h.dead = true; for (let i = 0; i < 4; i++) { g.state.health = 0; g.step(1); } });
  const death = await until(() => !!document.querySelector('.vs-death [data-act="respawn"]'));
  const deathText = await ev(() => document.querySelector('.vs-death')?.innerText || '');
  if (process.env.SHOTS) { await page.waitForTimeout(1000); await page.screenshot({ path: `${process.env.SHOTS}/death.png` }); }
  await ev(() => document.querySelector('.vs-death [data-act="respawn"]').click());
  const back = await until(() => !window.game.state.gameOver && !document.querySelector('.vs-death'));
  for (let i = 0; i < 60 && !(await ev(() => !!document.querySelector('[data-card="wake"]'))); i++) await loop(2);
  const wake = await ev(() => document.querySelector('[data-card="wake"]')?.innerText || '');
  await ev(() => { window.game.godMode = true; });
  check('the death screen shows the run and respawns the party', death && /You fell/i.test(deathText) && /Monsters defeated/.test(deathText) && back, deathText.slice(0, 60));
  check('after a respawn a card says where you woke', /You wake in/.test(wake), wake);
}

if (want('species')) {
  const sp = await ev(() => {
    const g = window.game, p = g.state.player;
    for (const e of [...g.state.enemies]) e.dead = true; g.reap();
    const keys = ['THORNBACK', 'WIGHT', 'MANTIS', 'THORNWITCH', 'SANDWORM', 'DJINN', 'SIREN', 'LURKER', 'HARPY', 'YETI'];
    const made = keys.map((k, i) => g.makeEnemy(k, p.wx - 400 + (i % 5) * 200, p.wy - 140 + Math.floor(i / 5) * 260, { level: 30 }));
    for (let i = 0; i < 240; i++) g.gameLoop(1);
    const states = new Set(made.map((e) => e.ai && e.ai.state));
    const drawn = made.every((e) => e.body && e.body.children.length > 0 && e.baseHeight > 30);
    for (const e of made) if (!e.dead) g.damageEnemy(e, 1e12, { noCrit: true });
    return { n: made.length, drawn, states: [...states], totem: !!g.world.decorTextures.lairtotem, codex: keys.every((k) => g.codex.monsters.includes(k)) };
  });
  check('ten new species for tiers 2 and 3 spawn, act and are drawn', sp.n === 10 && sp.drawn && sp.states.length >= 2, JSON.stringify(sp));
  check('they join the bestiary when defeated, and lairs have a totem sprite', sp.codex && sp.totem, JSON.stringify(sp));
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
