import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file: used for the hosted test page.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', outDir: 'dist-single', assetsInlineLimit: 100_000_000 }
});
