// Phase 9h end-to-end checks: robustness. A crash shows a screen with a report and keeps the last good save;
// storage that will not save says so. Sections can be picked with ONLY=crash,...; THROTTLE=n slows the CPU.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4193;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (section) => !ONLY || ONLY.includes(section);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
});
// errors the tests cause on purpose are expected; anything else is a failure
const PLANTED = /test crash|background oops|rejected oops|\[crash\]|storage test/;
const errors = [];
const newPage = async (context) => {
  const page = await context.newPage();
  page.on('pageerror', (e) => { if (!PLANTED.test(e.message)) errors.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text()) && !PLANTED.test(m.text())) errors.push(m.text()); });
  if (process.env.THROTTLE) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
  return page;
};
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` });
await context.addInitScript(() => { window.__forceSeed = 2024; });
let page = await newPage(context);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const start = async (cont = false) => {
  await page.waitForFunction(() => !!window.game && window.game.titleReady, null, { timeout: 15000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player && window.__dev);
};

await page.goto(`http://localhost:${PORT}/`);
await start();

// ---- 9h.1: a crash in a frame stops the game on a screen that says so; the last good save is kept
if (want('crash')) {
  const saved = await ev(async () => { const g = window.game; g.state.kills = 4242; return g.requestSave('manual', true); });
  check('a save is made before the crash', saved === true);

  await ev(() => { const g = window.game; g.state.kills = 999; g.step = () => { throw new Error('test crash in a frame'); }; });
  const shown = await until(() => !!document.querySelector('.vs-crash'));
  await until(() => document.activeElement?.dataset?.act === 'crash-copy', null, 3000);
  const screen = await ev(() => ({
    text: document.querySelector('.vs-crash')?.innerText || '',
    keep: !!document.querySelector('[data-act="crash-keep"]'),
    fatal: !!window.game.crashed?.fatal,
    focus: document.activeElement?.dataset?.act || ''
  }));
  check('an error in a frame shows the crash screen', shown && /Something went wrong/.test(screen.text) && /test crash in a frame/.test(screen.text), screen.text.slice(0, 120).replace(/\n/g, ' | '));
  check('...says the game stopped and the last save is safe, with only Reload', screen.fatal && !screen.keep && /has stopped/.test(screen.text) && /last save is safe/.test(screen.text), JSON.stringify({ fatal: screen.fatal, keep: screen.keep }));
  check('...with the first button focused for keys and pads', screen.focus === 'crash-copy', screen.focus);
  const f0 = await ev(() => window.game.frame);
  await page.waitForTimeout(600);
  const f1 = await ev(() => window.game.frame);
  check('the game no longer advances', f0 === f1, `${f0} -> ${f1}`);
  const refused = await ev(() => window.game.requestSave('manual', true));
  check('nothing is saved after the crash', refused === false);
  await ev(() => document.querySelector('[data-act="crash-copy"]').click());
  await page.waitForTimeout(300);
  const report = await ev(async () => { try { return await navigator.clipboard.readText(); } catch { return document.querySelector('.vs-crash textarea')?.value || ''; } });
  check('the report copies: the error, the version, the stack and what was happening', /Error: test crash in a frame/.test(report) && /Version: \d+\.\d+\.\d+/.test(report) && /Stack:\n.*\S/.test(report) && /Playing: overworld/.test(report), report.split('\n').slice(0, 5).join(' | '));

  // Reload: the save from before the crash is the one that comes back
  await ev(() => document.querySelector('[data-act="crash-reload"]').click());
  await page.waitForFunction(() => !!window.game && window.game.titleReady && !document.querySelector('.vs-crash'), null, { timeout: 15000 });
  await start(true);
  const kills = await ev(() => window.game.state.kills);
  check('Reload brings back the last good save', kills === 4242, String(kills));

  // an error outside the loop: the game runs on, and the player may keep playing
  await ev(() => { setTimeout(() => { throw new Error('background oops'); }, 0); });
  await until(() => !!document.querySelector('.vs-crash'));
  const soft = await ev(() => ({ keep: !!document.querySelector('[data-act="crash-keep"]'), fatal: !!window.game.crashed?.fatal, text: document.querySelector('.vs-crash')?.innerText || '' }));
  // the loop still runs: count its calls for a moment
  const loops = await ev(() => new Promise((r) => {
    const g = window.game, o = g.gameLoop;
    let n = 0;
    const done = () => { g.gameLoop = o; r(n); };
    g.gameLoop = function (d) { if (++n >= 2) setTimeout(done, 0); return o.call(this, d); };
    setTimeout(done, 6000);
  }));
  check('an error outside the loop offers Keep playing, and the game runs on', soft.keep && !soft.fatal && /background/.test(soft.text) && loops > 0, JSON.stringify({ keep: soft.keep, fatal: soft.fatal, loops }));
  check('...nothing is saved while it is up', (await ev(() => window.game.requestSave('manual', true))) === false);
  await ev(() => document.querySelector('[data-act="crash-keep"]').click());
  const kept = await ev(async () => ({ gone: !document.querySelector('.vs-crash'), saves: await window.game.requestSave('manual', true) }));
  check('Keep playing closes it and saving works again', kept.gone && kept.saves === true, JSON.stringify(kept));
  await ev(() => { Promise.reject(new Error('rejected oops')); });
  const rej = await until(() => /rejected oops/.test(document.querySelector('.vs-crash')?.innerText || ''));
  check('a rejected promise is caught the same way', rej);
  await ev(() => document.querySelector('[data-act="crash-keep"]').click());
  // the same error again is not shown twice
  await ev(() => { setTimeout(() => { throw new Error('background oops'); }, 0); });
  await page.waitForTimeout(300);
  check('the same error again is not shown a second time', await ev(() => !document.querySelector('.vs-crash')));
}

// ---- 9h.1: saving that fails, or storage the browser will not give, says so with a way to keep the progress
if (want('storage')) {
  await ev(() => { const g = window.game; g.saveFailures = 0; g.storageDismissed = false; g.store.__save = g.store.save; g.store.save = () => Promise.reject(new Error('storage test: quota exceeded')); });
  await ev(() => window.game.requestSave('manual', true));
  const once = await ev(() => !!document.querySelector('.vs-storage'));
  await ev(() => window.game.requestSave('manual', true));
  const twice = await until(() => !!document.querySelector('.vs-storage'));
  const text = await ev(() => document.querySelector('.vs-storage')?.innerText || '');
  check('a failed save toasts; two in a row put up the storage warning', !once && twice && /Saving failed twice/.test(text), text.replace(/\n/g, ' | '));
  await ev(() => document.querySelector('[data-act="storage-export"]').click());
  const exported = await ev(() => document.querySelector('.vs-storage textarea')?.value || '');
  check('Export gives the progress as text to keep', exported.length > 200, `${exported.slice(0, 24)}… (${exported.length})`);
  await ev(() => { const g = window.game; g.store.save = g.store.__save; });
  await ev(() => window.game.requestSave('manual', true));
  check('a save that works again takes the warning down', await until(() => !document.querySelector('.vs-storage')));

  // no storage at all: a page where IndexedDB and localStorage both refuse (the first page is closed, so the two
  // do not share the software GPU)
  await page.close();
  const bare = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await bare.addInitScript(() => {
    window.__forceSeed = 2024;
    Object.defineProperty(window, 'indexedDB', { get() { throw new Error('storage test: blocked'); } });
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage test: blocked'); } });
  });
  const p2 = await newPage(bare);
  await p2.goto(`http://localhost:${PORT}/`);
  await p2.waitForFunction(() => !!window.game && window.game.titleReady, null, { timeout: 30000 });
  await p2.keyboard.press('Enter');
  await p2.waitForFunction(() => window.game.state.player, null, { timeout: 30000 });
  const mem = await p2.waitForFunction(() => /not letting the game save/.test(document.querySelector('.vs-storage')?.innerText || ''), null, { timeout: 8000 }).then(() => true, () => false);
  check('with no storage at all, the game says so as it starts', mem);
  await p2.evaluate(() => document.querySelector('[data-act="storage-dismiss"]').click());
  check('...and the warning can be dismissed', await p2.evaluate(() => !document.querySelector('.vs-storage')));
  await bare.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
