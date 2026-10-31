// Which Chromium to drive. CHROMIUM_PATH wins; otherwise the newest headless shell installed under the Playwright
// browsers folder (a sandbox may carry a build that Playwright's own version number does not name); otherwise
// undefined, and Playwright uses the browser it installed itself (CI: `npx playwright-core install chromium`).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
export const launchArgs = (extra = []) => [...FLAGS, ...extra];

/** The version number in a folder name such as chromium_headless_shell-1243. */
const versionOf = (name) => Number(name.match(/-(\d+)$/)?.[1] ?? 0);

/** The browser binary to launch, or undefined to let Playwright choose. */
export function findChromium(env = process.env, root = env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers') {
  if (env.CHROMIUM_PATH) return env.CHROMIUM_PATH;
  if (!existsSync(root)) return undefined;
  const shells = readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort((a, b) => versionOf(b) - versionOf(a));
  for (const dir of shells) {
    for (const rel of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell', 'chrome-linux/chrome']) {
      const p = join(root, dir, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}
