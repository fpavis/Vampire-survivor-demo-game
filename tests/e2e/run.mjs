// Runs the browser suites. Every suite runs, a failure does not stop the rest, and the end of the output is one
// table with the failing checks named.
//
//   node tests/e2e/run.mjs                      all suites, in order
//   node tests/e2e/run.mjs --only phase9g,input just these
//   node tests/e2e/run.mjs --shard 2/4          the second of four balanced parts (CI)
//   node tests/e2e/run.mjs --jobs 2             two suites at once (they share the CPU: timing checks may wobble)
//   node tests/e2e/run.mjs --timeout 1200       seconds a suite may take (1500 by default)
//   node tests/e2e/run.mjs --list               which suites this would run
//   node tests/e2e/run.mjs --dir <folder>       the *.mjs files of another folder (the runner's own test uses it)
// Other environment variables go to the suites: SEED, ONLY (sections), THROTTLE, CHROMIUM_PATH.
import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUITES, formatSummary, markdownSummary, outcome, parseShard, partition } from './runner-lib.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const timings = JSON.parse(readFileSync(new URL('./timings.json', import.meta.url), 'utf8'));

const dir = opt('dir') ? pathResolve(opt('dir')) : fileURLToPath(new URL('./', import.meta.url));
const ALL = opt('dir') ? readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, '')).sort() : SUITES;
let suites = ALL;
if (opt('only')) {
  const want = opt('only').split(',');
  const unknown = want.filter((s) => !ALL.includes(s));
  if (unknown.length) { console.error(`unknown suite: ${unknown.join(', ')} (have ${ALL.join(', ')})`); process.exit(2); }
  suites = ALL.filter((s) => want.includes(s));
}
if (opt('shard')) { const { k, n } = parseShard(opt('shard')); suites = partition(suites, timings, n)[k - 1]; }
if (args.includes('--list')) { console.log(suites.join('\n')); process.exit(0); }

const jobs = Math.max(1, Number(opt('jobs')) || 1);
const limit = (Number(opt('timeout')) || 1500) * 1000;

function run(name) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [pathResolve(dir, `${name}.mjs`)], { env: process.env, detached: true });
    let output = '', timedOut = false;
    const take = (d) => { const s = d.toString(); output += s; if (jobs === 1) process.stdout.write(s); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    // an overrunning suite is asked to leave (so it can stop its server), then killed if it does not
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
      setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 5000).unref();
    }, limit);
    child.on('close', (code) => {
      clearTimeout(timer);
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* the usual: nothing left */ }
      if (jobs > 1) process.stdout.write(output);
      resolve(outcome(name, output, code, Date.now() - t0, timedOut));
    });
  });
}

const results = [];
const queue = [...suites];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length) {
    const name = queue.shift();
    console.log(`\n=== ${name} ===`);
    results.push(await run(name));
  }
}));
results.sort((a, b) => ALL.indexOf(a.suite) - ALL.indexOf(b.suite));

console.log(formatSummary(results));
if (opt('json')) writeFileSync(opt('json'), JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdownSummary(results, opt('title') || 'Browser tests'));
process.exit(results.every((r) => r.status === 'passed') ? 0 : 1);
