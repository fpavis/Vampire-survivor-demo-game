import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RESULT_TAG, SUITES, formatSummary, markdownSummary, outcome, parseResult, parseShard, partition, pickSeed } from './e2e/runner-lib.mjs';
import { findChromium } from '../scripts/lib/browser.mjs';
import timings from './e2e/timings.json' with { type: 'json' };

const line = (o) => `PASS  something\n${RESULT_TAG}${JSON.stringify(o)}\n`;

describe('the browser test runner', () => {
  it('knows every suite file, and no file that is not one', () => {
    const files = readdirSync(new URL('./e2e/', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, ''));
    const support = new Set(['harness', 'run', 'runner-lib', 'screens', 'a11y']);
    expect(files.filter((f) => !support.has(f)).sort()).toEqual([...SUITES].sort());
    expect(new Set(SUITES).size).toBe(SUITES.length);
  });

  it('has a time for every suite', () => {
    for (const s of SUITES) expect(timings[s], s).toBeGreaterThan(0);
    expect(Object.keys(timings).sort()).toEqual([...SUITES].sort());
  });

  it('splits the suites into shards: all of them, once, and about equal', () => {
    for (const n of [1, 2, 3, 4, 6]) {
      const shards = partition(SUITES, timings, n);
      expect(shards.length).toBe(n);
      expect(shards.flat().sort()).toEqual([...SUITES].sort());
      const loads = shards.map((s) => s.reduce((a, x) => a + timings[x], 0));
      const heaviest = Math.max(...SUITES.map((s) => timings[s]));
      expect(Math.max(...loads) - Math.min(...loads), `n=${n}`).toBeLessThanOrEqual(heaviest);
    }
  });

  it('keeps the run order within a shard, and counts a suite with no time as average', () => {
    const [a] = partition(['x', 'y', 'z'], { x: 10 }, 1);
    expect(a).toEqual(['x', 'y', 'z']);
    const shards = partition(['a', 'b', 'c', 'd'], { a: 100, b: 1, c: 1, d: 1 }, 2);
    expect(shards.find((s) => s.includes('a'))).toEqual(['a']);
  });

  it('reads --shard k/n and refuses nonsense', () => {
    expect(parseShard('2/4')).toEqual({ k: 2, n: 4 });
    for (const bad of ['0/4', '5/4', '2', 'a/b', '', undefined]) expect(() => parseShard(bad), String(bad)).toThrow();
  });

  it('reads a suite\'s result, and says why when there is none', () => {
    const ok = outcome('x', line({ suite: 'x', checks: 5, failed: 0, failures: [], seed: 2024, ms: 1000 }), 0, 1500);
    expect(ok).toMatchObject({ status: 'passed', checks: 5, failed: 0, seed: 2024 });
    const bad = outcome('x', line({ suite: 'x', checks: 5, failed: 1, failures: ['it works'], seed: 2024 }), 1, 1500);
    expect(bad).toMatchObject({ status: 'failed', failed: 1, failures: ['it works'] });
    const crashed = outcome('x', 'PASS a\nFAIL  b broke\nTypeError: boom\n', 1, 10);
    expect(crashed).toMatchObject({ status: 'crashed', failures: ['b broke'] });
    expect(outcome('x', '', 1, 10).failures[0]).toMatch(/no result/);
    expect(outcome('x', 'partial', null, 10, true)).toMatchObject({ status: 'timeout', failures: ['timed out'] });
    expect(parseResult('nothing here')).toBeNull();
    expect(parseResult(`${RESULT_TAG}{not json`)).toBeNull();
  });

  it('writes a summary that names every failing check', () => {
    const results = [
      { suite: 'smoke', status: 'passed', checks: 7, failed: 0, failures: [], ms: 12000 },
      { suite: 'phase5', status: 'failed', checks: 30, failed: 2, failures: ['a spring heals', 'lava burns'], ms: 90000 }
    ];
    const text = formatSummary(results);
    expect(text).toContain('FAILED');
    expect(text).toContain('phase5: a spring heals');
    expect(text).toContain('phase5: lava burns');
    expect(text).toMatch(/total\s+FAILED\s+37\s+2/);
    expect(formatSummary(results.slice(0, 1))).not.toContain('Failing:');
    expect(markdownSummary(results)).toContain('- **phase5**: a spring heals');
  });

  it('picks the world: 2024 unless told otherwise', () => {
    expect(pickSeed({})).toBe(2024);
    expect(pickSeed({ SEED: '77' })).toBe(77);
    expect(pickSeed({ SEED: 'nonsense' })).toBe(2024);
    expect(pickSeed({ SEED: '-5' })).toBe(2024);
    expect(pickSeed({}, 99)).toBe(99);
    const r = pickSeed({ SEED: 'random' });
    expect(Number.isInteger(r) && r >= 0).toBe(true);
  });

  it('finds the browser: the variable first, else the newest build, else leaves it to Playwright', () => {
    expect(findChromium({ CHROMIUM_PATH: '/x/chrome' })).toBe('/x/chrome');
    expect(findChromium({}, '/no/such/folder')).toBeUndefined();
  });
});

describe('running suites for real (fixture suites, no browser)', () => {
  const run = (...args) => spawnSync(process.execPath, ['tests/e2e/run.mjs', '--dir', 'tests/fixtures/e2e', ...args], { encoding: 'utf8', timeout: 60000 });

  it('runs every suite through a failure, a crash and a hang, names each, and exits 1', () => {
    const json = join(tmpdir(), `e2e-runner-${process.pid}.json`);
    const r = run('--timeout', '2', '--json', json);
    expect(r.status).toBe(1);
    const out = r.stdout;
    // the suites after the broken ones still ran
    expect(out).toContain('=== after ===');
    expect(out).toContain('=== ok ===');
    expect(out).toMatch(/after\s+passed\s+1\s+0/);
    expect(out).toMatch(/failing\s+failed\s+2\s+1/);
    expect(out).toMatch(/crashes\s+crashed/);
    expect(out).toMatch(/hangs\s+timeout/);
    expect(out).toMatch(/ok\s+passed\s+2\s+0/);
    // and the failures are named at the end
    const end = out.slice(out.indexOf('Failing:'));
    expect(end).toContain('failing: a spring heals');
    expect(end).toContain('hangs: timed out');
    expect(end).toMatch(/crashes: gets going|crashes: exited with code/);
    expect(existsSync(json)).toBe(true);
    const results = JSON.parse(readFileSync(json, 'utf8'));
    expect(results.map((x) => x.suite)).toEqual(['after', 'crashes', 'failing', 'hangs', 'ok']);
    expect(results.filter((x) => x.status === 'passed').map((x) => x.suite)).toEqual(['after', 'ok']);
  });

  it('exits 0 when everything passes, and --only picks suites', () => {
    const r = run('--only', 'ok,after');
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain('=== failing ===');
    expect(r.stdout).toMatch(/total\s+passed\s+3\s+0/);
  });

  it('refuses a suite it does not have, and lists a shard without running it', () => {
    const bad = run('--only', 'nope');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('unknown suite: nope');
    const a = run('--shard', '1/2', '--list').stdout.split('\n').filter(Boolean);
    const b = run('--shard', '2/2', '--list').stdout.split('\n').filter(Boolean);
    expect([...a, ...b].sort()).toEqual(['after', 'crashes', 'failing', 'hangs', 'ok']);
    expect(a.filter((x) => b.includes(x))).toEqual([]);
  });
});
