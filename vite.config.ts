import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';
import { serviceWorker } from './scripts/pwa/plugin.mjs';

function buildInfo(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${sha} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  } catch { return 'dev'; }
}

const BUILD = buildInfo();

export default defineConfig({
  base: './',
  // the main build is installable and plays offline (a service worker caches it); the test page is not
  plugins: [serviceWorker({ version: BUILD.replace(/[^\w.-]+/g, '-') })],
  define: { __BUILD_INFO__: JSON.stringify(BUILD), __DEVTOOLS_BUTTON__: false, __PWA__: true },
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000
  }
});
