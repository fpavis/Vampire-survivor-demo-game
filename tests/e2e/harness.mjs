// The shared harness of the browser tests: one preview server and one browser for a suite, the same checks and
// the same result line everywhere.
//
//   const h = await suite('phase9g', { viewport: { width: 1280, height: 720 } });
//   const page = await h.newPage();
//   await page.goto(h.url);
//   h.check('the game boots', await page.evaluate(() => !!window.game));
//   await h.finish();                       // closes everything, prints the result, sets the exit code
//
// Environment: SEED=<n> or SEED=random (the world; 2024 by default, printed), ONLY=a,b (sections, with h.want),
// THROTTLE=n (slows the CPU like a busy CI runner; Chromium only), CHROMIUM_PATH (the browser), SHOTS=<dir>
// (screenshots, used by the suites that take them), BROWSER=chromium|firefox|webkit (the engine; Chromium by default). Run a suite alone with `node tests/e2e/<name>.mjs`, or all of them with run.mjs.
import { chromium, firefox, webkit } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { findChromium, launchArgs } from '../../scripts/lib/browser.mjs';
import { DEFAULT_SEED, RESULT_TAG, pickSeed } from './runner-lib.mjs';

/** A port nothing is listening on, so suites can run side by side. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

export async function suite(name, opts = {}) {
  const viewport = opts.viewport ?? { width: 1280, height: 720 };
  const seed = opts.seed === null ? null : pickSeed(process.env, opts.seed ?? DEFAULT_SEED);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const started = Date.now();
  let failed = 0, total = 0;
  const failures = [];
  const unexpected = [];
  const allowed = [/favicon|404/];

  const check = (what, ok, extra = '') => {
    total++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${what} ${extra}`);
    if (!ok) { failed++; failures.push(what); }
  };

  if (!existsSync('dist/index.html')) throw new Error('no build to test: run `npm run build` first');
  const port = await freePort();
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  const stopPreview = () => { try { process.kill(-preview.pid); } catch { /* gone */ } };
  process.on('exit', stopPreview);
  // the runner stops a suite that overruns with SIGTERM: leave through exit, so the preview server goes too
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => process.exit(1));
  const url = `http://localhost:${port}/`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
    if (i >= 80) throw new Error('the preview server did not start');
    await new Promise((r) => setTimeout(r, 250));
  }
  // Chromium is the engine the suites are written against; Firefox and WebKit run the ones that make sense there
  // (BROWSER=firefox node tests/e2e/smoke.mjs), without Chromium's flags or its CPU throttling
  const engine = process.env.BROWSER || 'chromium';
  if (!['chromium', 'firefox', 'webkit'].includes(engine)) throw new Error(`BROWSER must be chromium, firefox or webkit, not ${engine}`);
  const browser = engine === 'chromium'
    ? await chromium.launch({ executablePath: findChromium(), args: launchArgs(opts.args) })
    : await { firefox, webkit }[engine].launch();
  console.log(`browser ${engine} ${browser.version()}`);

  const init = async (context) => {
    if (seed !== null) await context.addInitScript((s) => { window.__forceSeed = s; }, seed);
    if (opts.init) await context.addInitScript(opts.init, opts.initArg);
  };
  const newContext = async (vp = viewport, extra = {}) => {
    const context = await browser.newContext({ viewport: vp, ...extra });
    await init(context);
    return context;
  };
  const context = await newContext();

  const watch = (page) => {
    const take = (text) => { if (!allowed.some((re) => re.test(text))) unexpected.push(text); };
    page.on('pageerror', (e) => take(e.message));
    page.on('console', (m) => { if (m.type() === 'error') take(m.text()); });
  };
  const newPage = async (ctx = context) => {
    const page = await ctx.newPage();
    watch(page);
    if (process.env.THROTTLE && engine === 'chromium') await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
    return page;
  };

  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;
    check('no page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));
    await browser.close().catch(() => {});
    stopPreview();
    console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
    console.log(RESULT_TAG + JSON.stringify({ suite: name, checks: total, failed, failures, seed, ms: Date.now() - started }));
    process.exit(failed ? 1 : 0);
  };

  // a suite that throws is a failed suite with a reason, not a stack trace and nothing else
  const crash = async (err) => {
    if (done) return;
    check(`the suite ran to its end (${String(err && err.message || err).split('\n')[0].slice(0, 200)})`, false);
    console.log(String(err && err.stack || err).split('\n').slice(0, 6).join('\n'));
    unexpected.length = 0;
    await finish();
  };
  process.on('uncaughtException', crash);
  process.on('unhandledRejection', crash);

  if (seed !== null) console.log(`seed ${seed}`);
  return {
    name, url, seed, browser, context, check, newContext, newPage,
    errors: unexpected,
    /** Errors a suite causes on purpose are not failures. */
    allowErrors: (re) => { allowed.push(re); },
    /** Is this section selected (ONLY=a,b), or are all? */
    want: (section) => !only || only.includes(section),
    finish
  };
}
