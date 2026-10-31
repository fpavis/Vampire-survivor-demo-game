// Vite plugin: writes sw.js into the build with every emitted file and every public file listed, so the
// installed game can start offline. Source maps stay out of the cache.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const listPublic = (dir, root = dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? listPublic(p, root) : [relative(root, p).split('\\').join('/')];
});

export function serviceWorker({ version }) {
  return {
    name: 'survival-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      // the social preview image is for link previews, not for playing
      const skip = new Set(['og.jpg']);
      const files = ['./', ...new Set([...built, ...listPublic('public')].filter((f) => !skip.has(f)))].map((f) => (f === './' ? f : `./${f}`));
      const source = readFileSync('scripts/pwa/sw.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(files, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    }
  };
}
