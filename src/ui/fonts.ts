// The game's two typefaces, bundled with the build (SIL Open Font License): Cinzel for titles and banners,
// Nunito for everything you read. The canvas draws text once, so the game waits for them before starting.
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/cinzel/latin-700.css';

export const FONT_UI = 'Nunito, "Trebuchet MS", Verdana, sans-serif';
export const FONT_DISPLAY = 'Cinzel, Georgia, "Palatino Linotype", serif';

/** Resolves once both faces are ready, or after `timeout` ms so a missing font never blocks the game. */
export function fontsReady(timeout = 2500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const loads = ['600 16px Nunito', '700 16px Nunito', '800 16px Nunito', '700 16px Cinzel'].map((f) => document.fonts.load(f).catch(() => []));
  return Promise.race([Promise.all(loads).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeout))]);
}
