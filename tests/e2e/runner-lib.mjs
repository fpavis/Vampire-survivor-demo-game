// The runner's pure parts: which suites exist, how they are split between shards, how a result is read and a
// summary written. Kept apart from run.mjs so they can be unit tested (tests/e2e-runner.test.ts).
export const RESULT_TAG = 'E2E-RESULT ';
export const DEFAULT_SEED = 2024;

/** The seed for a run: SEED=<n>, SEED=random, or the suite's own. */
export function pickSeed(env = process.env, own = DEFAULT_SEED) {
  if (env.SEED === 'random') return (Math.random() * 1e9) | 0;
  const n = Number(env.SEED);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : own;
}

/** Every browser suite, in the order they run (earlier phases first). */
export const SUITES = [
  'smoke', 'phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6', 'phase7', 'phase8', 'phase8b', 'phase9',
  'phase10', 'phase11', 'phase9f', 'phase12', 'phase9g', 'phase9h', 'input'
];

/**
 * Split suites over n shards so each takes about as long: heaviest first, each into the lightest shard so far.
 * `weights` are seconds per suite (a suite without one counts as the average). Shard k of n is 1-based; the
 * suites of a shard come back in the order of `suites`.
 */
export function partition(suites, weights, n) {
  const known = suites.map((s) => weights[s]).filter((w) => Number.isFinite(w));
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  const w = (s) => (Number.isFinite(weights[s]) ? weights[s] : avg);
  const bins = Array.from({ length: n }, () => ({ load: 0, items: [] }));
  for (const s of [...suites].sort((a, b) => w(b) - w(a) || suites.indexOf(a) - suites.indexOf(b))) {
    const bin = bins.reduce((m, b) => (b.load < m.load ? b : m), bins[0]);
    bin.items.push(s);
    bin.load += w(s);
  }
  return bins.map((b) => suites.filter((s) => b.items.includes(s)));
}

/** "2/4" → { k: 2, n: 4 }; throws on anything else. */
export function parseShard(text) {
  const m = /^(\d+)\/(\d+)$/.exec(text || '');
  if (!m || +m[1] < 1 || +m[1] > +m[2]) throw new Error(`--shard wants k/n with 1 <= k <= n, not "${text}"`);
  return { k: +m[1], n: +m[2] };
}

/** The harness's result line in a suite's output, or null when it never got that far. */
export function parseResult(output) {
  const line = output.split('\n').reverse().find((l) => l.startsWith(RESULT_TAG));
  if (!line) return null;
  try { return JSON.parse(line.slice(RESULT_TAG.length)); } catch { return null; }
}

/** A suite's outcome: what it reported, or why it has nothing to report. */
export function outcome(name, output, code, ms, timedOut = false) {
  const r = parseResult(output);
  if (r) return { suite: name, checks: r.checks, failed: r.failed, failures: r.failures, ms, seed: r.seed, status: r.failed ? 'failed' : 'passed' };
  const fails = output.split('\n').filter((l) => l.startsWith('FAIL')).map((l) => l.slice(6).trim());
  return { suite: name, checks: 0, failed: Math.max(1, fails.length), failures: fails.length ? fails : [timedOut ? 'timed out' : `exited with code ${code} and no result`], ms, seed: null, status: timedOut ? 'timeout' : 'crashed' };
}

const pad = (v, n) => String(v).padEnd(n);
const secs = (ms) => `${(ms / 1000).toFixed(0)}s`;

/** The end-of-run table, with every failing check by name. */
export function formatSummary(results) {
  const lines = ['', 'Browser tests', `${pad('suite', 10)} ${pad('status', 8)} ${pad('checks', 7)} ${pad('failed', 7)} time`];
  for (const r of results) lines.push(`${pad(r.suite, 10)} ${pad(r.status, 8)} ${pad(r.checks, 7)} ${pad(r.failed, 7)} ${secs(r.ms)}`);
  const checks = results.reduce((a, r) => a + r.checks, 0), failed = results.reduce((a, r) => a + r.failed, 0);
  lines.push(`${pad('total', 10)} ${pad(results.every((r) => r.status === 'passed') ? 'passed' : 'FAILED', 8)} ${pad(checks, 7)} ${pad(failed, 7)} ${secs(results.reduce((a, r) => a + r.ms, 0))}`);
  const bad = results.filter((r) => r.status !== 'passed');
  if (bad.length) {
    lines.push('', 'Failing:');
    for (const r of bad) for (const f of r.failures) lines.push(`  ${r.suite}: ${f}`);
  }
  return lines.join('\n');
}

/** The same, as GitHub step summary markdown. */
export function markdownSummary(results, title = 'Browser tests') {
  const rows = results.map((r) => `| ${r.suite} | ${r.status} | ${r.checks} | ${r.failed} | ${secs(r.ms)} |`);
  const bad = results.filter((r) => r.status !== 'passed').flatMap((r) => r.failures.map((f) => `- **${r.suite}**: ${f}`));
  return [`### ${title}`, '', '| suite | status | checks | failed | time |', '|---|---|---|---|---|', ...rows, ...(bad.length ? ['', ...bad] : []), ''].join('\n');
}
