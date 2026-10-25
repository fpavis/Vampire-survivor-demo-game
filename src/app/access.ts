// Accessibility settings: text size, colour palette, reduced motion and onboarding tips. Stored per browser and applied to the
// DOM (a CSS variable and a class) and to the canvas HUD; renderers read the current values from here.
import { ui as uiBridge } from '../ui/bridge';
import type { PaletteId } from '../core/access/palettes';

const KEY = 'vs.access.v1';

export interface AccessPrefs { textScale: number; palette: PaletteId; reducedMotion: boolean; tips: boolean }

export const access: AccessPrefs = { textScale: 1, palette: 'default', reducedMotion: false, tips: true };

export function loadAccess(): AccessPrefs {
  let saved: Partial<AccessPrefs> | null = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage unavailable */ }
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  access.textScale = Math.max(0.9, Math.min(1.4, Number(saved?.textScale) || 1));
  access.palette = (['default', 'redgreen', 'blueyellow'] as PaletteId[]).includes(saved?.palette as PaletteId) ? saved!.palette as PaletteId : 'default';
  access.reducedMotion = typeof saved?.reducedMotion === 'boolean' ? saved.reducedMotion : prefersReduced;
  access.tips = saved?.tips !== false;
  return access;
}

export function setAccess(game: any, patch: Partial<AccessPrefs>) {
  Object.assign(access, patch);
  try { localStorage.setItem(KEY, JSON.stringify(access)); } catch { /* ignore */ }
  applyAccess(game);
}

export function applyAccess(game: any) {
  const root = document.documentElement;
  root.style.setProperty('--ts', String(access.textScale));
  root.classList.toggle('vs-reduced', access.reducedMotion);
  root.dataset.palette = access.palette;
  uiBridge.textScale.value = access.textScale;
  uiBridge.palette.value = access.palette;
  uiBridge.reducedMotion.value = access.reducedMotion;
  uiBridge.tipsOn.value = access.tips;
  if (game?.ui?.layoutHUD) game.ui.layoutHUD();
}
