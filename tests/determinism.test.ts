import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { makeRng, shuffle } from '../src/core/world/noise';

// Seeded generation must not depend on the JS engine: a sort with a random comparator calls the comparator a
// different number of times in different engines (and engine versions), so the same seed would build another world.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('engine-independent generation', () => {
  it('nothing in src shuffles with a random comparator', () => {
    const hits: string[] = [];
    for (const p of files('src')) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/\.sort\(\s*\(\s*\)\s*=>/.test(line)) hits.push(`${p}:${i + 1} ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('shuffle is seeded, keeps every item and moves them', () => {
    const a = shuffle([...Array(20).keys()], makeRng(7));
    const b = shuffle([...Array(20).keys()], makeRng(7));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([...Array(20).keys()]);
    expect(a).not.toEqual([...Array(20).keys()]);
  });
});
