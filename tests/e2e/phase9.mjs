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

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.kill(-preview.pid);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll phase 9 checks passed');
process.exit(failed ? 1 : 0);
