import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { serviceWorker } from '../scripts/pwa/plugin.mjs';

type Emitted = { type: string; fileName: string; source: string };
const root = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** What the plugin writes for a given build, by running its generateBundle against a fake bundle. */
function emit(version: string, built: string[]): Emitted {
  const out: Emitted[] = [];
  const plugin = serviceWorker({ version }) as unknown as { generateBundle: (this: { emitFile: (f: Emitted) => void }, o: unknown, b: Record<string, unknown>) => void };
  plugin.generateBundle.call({ emitFile: (f) => out.push(f) }, {}, Object.fromEntries(built.map((f) => [f, {}])));
  expect(out.length).toBe(1);
  return out[0];
}

/** The worker's own constants, read by running its source with a stub of the worker scope. */
function readWorker(source: string): { version: string; files: string[]; cache: string } {
  const scope: Record<string, unknown> = { addEventListener: () => {}, self: undefined, caches: {}, URL };
  scope.self = scope;
  runInNewContext(`${source}\nthis.__out = { version: VERSION, files: FILES, cache: CACHE };`, scope);
  return scope.__out as { version: string; files: string[]; cache: string };
}

describe('the service worker the build writes', () => {
  const built = ['index.html', 'assets/index-abc123.js', 'assets/index-abc123.js.map', 'assets/index-def456.css', 'assets/font-xyz.woff2'];

  it('is one asset called sw.js, valid JavaScript, with the build version in its cache name', () => {
    const f = emit('abc1234-2026-10-28', built);
    expect(f).toMatchObject({ type: 'asset', fileName: 'sw.js' });
    const w = readWorker(f.source);
    expect(w.version).toBe('abc1234-2026-10-28');
    expect(w.cache).toBe('survival-abc1234-2026-10-28');
    expect(f.source).not.toContain('__VERSION__');
    expect(f.source).not.toContain('__FILES__');
  });

  it('lists the start page, every built file and every file of public/, with ./ paths', () => {
    const { files } = readWorker(emit('v', built).source);
    expect(files[0]).toBe('./');
    for (const b of ['index.html', 'assets/index-abc123.js', 'assets/index-def456.css', 'assets/font-xyz.woff2']) expect(files, b).toContain(`./${b}`);
    for (const p of ['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png']) expect(files, p).toContain(`./${p}`);
    expect(files.every((f) => f === './' || f.startsWith('./'))).toBe(true);
    expect(new Set(files).size).toBe(files.length);
  });

  it('leaves out source maps and the social preview image', () => {
    const { files } = readWorker(emit('v', built).source);
    expect(files.some((f) => f.endsWith('.map'))).toBe(false);
    expect(files).not.toContain('./og.jpg');
    expect(files).not.toContain('./sw.js');
  });

  it('a new build is a new cache: the version differs, so the old files are dropped on activate', () => {
    const a = readWorker(emit('one', built).source), b = readWorker(emit('two', built).source);
    expect(a.cache).not.toBe(b.cache);
    const src = emit('one', built).source;
    expect(src).toContain("k.startsWith('survival-') && k !== CACHE");
  });

  it('serves the page network first and everything else cache first, ignoring Vary', () => {
    const src = emit('v', built).source;
    expect(src).toMatch(/req\.mode === 'navigate'/);
    expect(src).toMatch(/fetch\(req\)\.catch/);
    expect(src).toMatch(/ignoreVary: true/);
  });
});

describe('the installable app', () => {
  const manifest = JSON.parse(root('public/manifest.webmanifest'));
  const html = root('index.html');

  it('has a manifest that names the game and points at icons that exist', () => {
    expect(manifest.name).toBe('Survival Game');
    expect(manifest.start_url).toBe('./');
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.orientation).toBe('landscape');
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const i of manifest.icons) expect(existsSync(new URL(`../public/${i.src}`, import.meta.url)), i.src).toBe(true);
  });

  it('the page links the manifest, the icons and a social image that exist', () => {
    for (const re of [/rel="manifest" href="([^"]+)"/, /rel="icon" href="([^"]+)"/, /rel="apple-touch-icon" href="([^"]+)"/, /property="og:image" content="([^"]+)"/]) {
      const m = html.match(re);
      expect(m, String(re)).not.toBeNull();
      expect(existsSync(new URL(`../public/${m![1]}`, import.meta.url)), m![1]).toBe(true);
    }
    expect(html).toMatch(/<meta name="description" content="[^"]{20,}"/);
    expect(html).toMatch(/<meta name="theme-color"/);
  });

  it('the hosted test page never registers a worker, and the main build does', () => {
    expect(root('vite.single.config.ts')).toMatch(/__PWA__: false/);
    expect(root('vite.config.ts')).toMatch(/__PWA__: true/);
    expect(root('vite.config.ts')).toMatch(/serviceWorker\(/);
    expect(root('src/main.ts')).toMatch(/__PWA__ && import\.meta\.env\.PROD/);
    // the hosted page has none of the app tags either (they point at files it does not carry)
    expect(root('scripts/make-artifact.mjs')).toMatch(/manifest\|icon\|apple-touch-icon/);
  });
});

describe('the release files agree on the version', () => {
  const version = /GAME_VERSION = '([^']+)'/.exec(root('src/core/version.ts'))![1];

  it('package.json and the lock file carry the game version', () => {
    expect(JSON.parse(root('package.json')).version).toBe(version);
    expect(JSON.parse(root('package-lock.json')).version).toBe(version);
  });

  it('the changelog starts with this version and the licence names a holder', () => {
    expect(root('CHANGELOG.md')).toMatch(new RegExp(`^## ${version.replace(/\./g, '\\.')} · \\d{4}-\\d{2}-\\d{2}`, 'm'));
    expect(root('LICENSE')).not.toMatch(/\[Your Name\]/);
  });

  it('the first changelog entry is the newest one', () => {
    const entries = [...root('CHANGELOG.md').matchAll(/^## (\d+)\.(\d+)\.(\d+) ·/gm)].map((m) => m.slice(1).map(Number));
    expect(entries[0].join('.')).toBe(version);
    for (let i = 1; i < entries.length; i++) {
      const [a, b] = [entries[i - 1], entries[i]];
      expect(a[0] * 1e6 + a[1] * 1e3 + a[2], `${a.join('.')} before ${b.join('.')}`).toBeGreaterThan(b[0] * 1e6 + b[1] * 1e3 + b[2]);
    }
  });
});

describe('the page', () => {
  it('has no element whose id would hide a global the game and its tests use', () => {
    const ids = [...root('index.html').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    // window.game is the game: an element with id="game" answers to that name first and every test that waits for it passes too early
    for (const reserved of ['game', '__dev', 'app', 'ui']) expect(ids, reserved).not.toContain(reserved);
  });
});
