// Lists the player-facing text in src, one line per string with its file and line, for proofreading.
// Usage: node scripts/text-dump.mjs [out-file]   (prints to the terminal without one)
// It finds quoted strings that read like prose or names, and the text between JSX tags. It is a reading aid, not a
// parser: the rules in tests/text.test.ts use the same scan, so what the pass reads is what the test checks.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP_FILES = [/^src[\\/]app[\\/]devtools\.ts$/, /\.d\.ts$/];

/** Every .ts and .tsx file under dir. */
export function sourceFiles(dir = 'src') {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(f) && !SKIP_FILES.some((re) => re.test(p)) ? [p] : [];
  });
}

const QUOTED = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const CODEISH = /^(?:[a-z][\w.-]*|[.#][\w.#:\s>-]+|\w+:[\w-]+|#[0-9a-f]{3,8}|[\w-]+\/[\w./-]+|\d[\d.,:%\s-]*|[A-Z0-9_]+|\W+)$/;

/** Does a quoted string look like something the player reads? */
export function looksLikeText(s) {
  if (s.length < 2 || !/[A-Za-z]{2}/.test(s)) return false;
  if (/^(?:https?:|data:|\.{0,2}\/)|\.(?:png|svg|jpg|json|css|js|mjs|webmanifest)$/.test(s)) return false;
  if (/[{};]|=>|\bvar\(|\brgba?\(|\bpx\b|\bcalc\(/.test(s) && !/\$\{[^}]*\}[^$]*\s[A-Za-z]{3}/.test(s)) return false;
  if (CODEISH.test(s) || /(?:^|\s)(?:vs|data)-[\w-]+/.test(s)) return false;     // an identifier, or a list of CSS classes
  // a single lower-case word is an identifier; a phrase, or a word that starts with a capital, is text
  return /\s/.test(s) ? /[A-Za-z]{3,}\s+\S/.test(s) : /^[A-Z][a-z]{2,}/.test(s);
}

/** [{ line, text, kind }] for one source file. Comments are left out. */
export function textIn(file, src = readFileSync(file, 'utf8')) {
  const out = [];
  const lines = src.split('\n');
  let inBlock = false;
  lines.forEach((raw, i) => {
    let line = raw;
    if (inBlock) { const end = line.indexOf('*/'); if (end < 0) return; line = line.slice(end + 2); inBlock = false; }
    // drop block comments that start on this line, then a trailing // comment (not one inside a string)
    for (let start = line.indexOf('/*'); start >= 0; start = line.indexOf('/*')) {
      const end = line.indexOf('*/', start + 2);
      if (end < 0) { line = line.slice(0, start); inBlock = true; break; }
      line = line.slice(0, start) + ' '.repeat(end + 2 - start) + line.slice(end + 2);
    }
    line = stripLineComment(line);
    if (/^\s*(?:import|export\s+\*|export\s+\{)/.test(line) && /from\s+['"]/.test(line)) return;
    for (const m of line.matchAll(QUOTED)) {
      if (looksLikeText(m[2])) out.push({ line: i + 1, text: m[2], kind: 'string' });
    }
    if (file.endsWith('.tsx')) {
      for (const m of line.matchAll(/>([^<>{}=\n]*[A-Za-z]{2}[^<>{}=\n]*)</g)) {
        const t = m[1].trim();
        if (t.length > 1) out.push({ line: i + 1, text: t, kind: 'jsx' });
      }
    }
  });
  return out;
}

function stripLineComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '/' && line[i + 1] === '/' && line[i - 1] !== ':') return line.slice(0, i);
  }
  return line;
}

/** Everything, grouped by file. */
export function allText() {
  return sourceFiles().map((file) => ({ file, items: textIn(file) })).filter((f) => f.items.length);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const groups = allText();
  const text = groups.map((g) => `## ${g.file}\n` + g.items.map((t) => `${String(t.line).padStart(5)}  ${t.text}`).join('\n')).join('\n\n') + '\n';
  const out = process.argv[2];
  if (out) { writeFileSync(out, text); console.log(`${groups.reduce((n, g) => n + g.items.length, 0)} strings in ${groups.length} files -> ${out}`); }
  else process.stdout.write(text);
}
