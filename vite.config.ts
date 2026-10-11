import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';

function buildInfo(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${sha} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  } catch { return 'dev'; }
}

export default defineConfig({
  base: './',
  define: { __BUILD_INFO__: JSON.stringify(buildInfo()), __DEVTOOLS_BUTTON__: false },
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000
  }
});
