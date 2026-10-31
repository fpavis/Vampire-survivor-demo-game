import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';

function buildInfo(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${sha} ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (test build)`;
  } catch { return 'test build'; }
}

// One self-contained HTML file: used for the hosted test page. Shows the test-tools button.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  define: { __BUILD_INFO__: JSON.stringify(buildInfo()), __DEVTOOLS_BUTTON__: true, __PWA__: false },
  build: { target: 'es2022', outDir: 'dist-single', assetsInlineLimit: 100_000_000 }
});
