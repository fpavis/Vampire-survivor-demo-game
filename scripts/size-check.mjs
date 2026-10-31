// A size budget for the built game: the gzipped JavaScript and CSS of dist/assets. Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = { js: 560, css: 20 };     // at 0.15: about 490 and 0.2 (the interface styles travel in the JS)
const dir = 'dist/assets';
const sum = { js: 0, css: 0 };
for (const f of readdirSync(dir)) {
  const kind = f.endsWith('.js') ? 'js' : f.endsWith('.css') ? 'css' : null;
  if (!kind) continue;
  const kb = gzipSync(readFileSync(`${dir}/${f}`), { level: 9 }).length / 1024;
  sum[kind] += kb;
  console.log(`${f.padEnd(40)} ${kb.toFixed(1).padStart(7)} KB gzipped`);
}
let over = 0;
for (const k of Object.keys(BUDGET_KB)) {
  const ok = sum[k] <= BUDGET_KB[k];
  if (!ok) over++;
  console.log(`${k.toUpperCase()} total ${sum[k].toFixed(1)} KB of ${BUDGET_KB[k]} KB ${ok ? 'ok' : 'OVER BUDGET'}`);
}
process.exit(over ? 1 : 0);
