// Turns the single-file Vite build into page content for the hosted test page:
// the publishing tool supplies <!doctype>, <html>, <head> and <body>, so those wrappers are removed here.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-single/index.html', 'utf8');
let out = src
  .replace(/<!doctype[^>]*>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head[^>]*>/gi, '')
  .replace(/<\/?body[^>]*>/gi, '')
  .replace(/<meta\s+charset[^>]*>/gi, '')
  .replace(/<meta\s+name="viewport"[^>]*>/gi, '')
  // the installable-app and sharing tags point at files the hosted page does not have
  .replace(/<link\s+rel="(manifest|icon|apple-touch-icon)"[^>]*>/gi, '')
  .replace(/<meta\s+(property="og:[^"]*"|name="(twitter:card|theme-color|description)")[^>]*>/gi, '')
  .trim();
// full-bleed dark game surface; deliberately a single look, so set it explicitly
out = out.replace('</style>', 'html,body{height:100%;background:#000;color:#dfe8ff;color-scheme:dark}</style>');
writeFileSync('dist-single/artifact.html', out + '\n');
console.log(`artifact.html ${(out.length / 1024).toFixed(0)} KB`);
