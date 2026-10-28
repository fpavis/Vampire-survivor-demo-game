// App icons and the social preview image, drawn with the game's own art through the headless browser.
// Usage: npm run build && node scripts/make-icons.mjs
// Writes public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, public/favicon.svg
// and public/og.jpg (the title screen at 1200 x 630). The files are committed; run again only to change them.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// the crossed swords from the game's icon set (core/icons/data.ts), in the game's gold on its night blue
const data = readFileSync('src/core/icons/data.ts', 'utf8');
const m = data.match(/^ {2}"swords": \[(\d+), (\d+), [^,]+, "([^"]+)"\]/m);
if (!m) throw new Error('swords icon not found');
const [, vw, vh, path] = m;

/** The emblem as SVG: a rounded tile (or a full bleed square for maskable icons) with the swords in its middle. */
function svg(size, { inset = 0.2, round = 0.22 } = {}) {
  const pad = size * inset, s = size - pad * 2, r = size * round;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#2a2150"/><stop offset="1" stop-color="#0b0f18"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#d9a440"/></linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  ${round ? `<rect x="${size * 0.03}" y="${size * 0.03}" width="${size * 0.94}" height="${size * 0.94}" rx="${r * 0.86}" fill="none" stroke="#d9a440" stroke-opacity=".55" stroke-width="${Math.max(1, size * 0.018)}"/>` : ''}
  <g transform="translate(${pad} ${pad}) scale(${s / vw} ${s / vh})"><path d="${path}" fill="url(#gold)" stroke="#0b0f18" stroke-width="${vw * 0.012}"/></g>
</svg>`;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/favicon.svg', svg(64, { inset: 0.14, round: 0.2 }));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage();
const shoot = async (file, size, opts) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, opts)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(file);
};
await shoot('public/icons/icon-192.png', 192);
await shoot('public/icons/icon-512.png', 512);
await shoot('public/icons/apple-touch-icon.png', 180, { inset: 0.18, round: 0 });
// maskable: the platform cuts its own shape, so the art keeps to the middle 60% and the colour runs to the edges
await shoot('public/icons/icon-maskable-512.png', 512, { inset: 0.27, round: 0 });

// the social preview: the title screen of the built game
const pv = spawn('npx', ['vite', 'preview', '--port', '4189', '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-pv.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4189/')).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }
const g = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await g.addInitScript((v) => { window.__forceSeed = 2024; localStorage.setItem('vs.whatsnew', v); }, readFileSync('src/core/version.ts', 'utf8').match(/GAME_VERSION = '([^']+)'/)[1]);
await g.goto('http://localhost:4189/');
await g.waitForFunction(() => !!window.game && window.game.titleReady, null, { timeout: 30000 });
await g.waitForTimeout(2500);
await g.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 86 });
console.log('public/og.jpg');
await browser.close();
stop();
process.exit(0);
