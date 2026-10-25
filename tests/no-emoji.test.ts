import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The game draws every icon from its SVG set (src/core/icons); no emoji may appear in the source.
// Plain text symbols (arrows, ▲, the PlayStation button shapes) are fine: they are not emoji.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css|html)$/.test(f) ? [p] : [];
  });
}

describe('no emoji', () => {
  it('source files contain no emoji', () => {
    const hits: string[] = [];
    for (const p of [...files('src'), 'index.html']) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        const m = line.match(EMOJI);
        if (m) hits.push(`${p}:${i + 1} ${m[0]}  ${line.trim().slice(0, 80)}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
