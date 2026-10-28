import { fontsReady } from './ui/fonts';
import { startGame } from './app/game';

declare const __PWA__: boolean;

fontsReady().then(() => startGame());

// the main build caches itself to play offline (not in development, nor in the single-file test page)
if (__PWA__ && import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* not available here */ }); });
}
