// Player settings at run time: loaded from this browser, applied to the renderer, camera, effects and HUD, and
// published to the DOM UI. Systems read the current values from `settings`.
import { DEFAULT_SETTINGS, MINIMAP_SCALE, QUALITY, ZOOMS, sanitizeSettings, type Settings } from '../core/settings/settings';
import { ui as uiBridge } from '../ui/bridge';

const KEY = 'vs.settings.v1';

export const settings: Settings = { ...DEFAULT_SETTINGS };

/** Has this browser saved settings before? (If not, this is a first start.) */
export function hasSavedSettings(): boolean {
  try { return localStorage.getItem(KEY) !== null; } catch { return true; }
}

export function loadSettings(): Settings {
  let raw: unknown = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage unavailable */ }
  Object.assign(settings, sanitizeSettings(raw));
  return settings;
}

export function setSettings(game: any, patch: Partial<Settings>) {
  Object.assign(settings, sanitizeSettings({ ...settings, ...patch }));
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  applySettings(game);
}

/** Camera zoom factor for the current setting. */
export const zoomFactor = () => ZOOMS[settings.zoom] ?? 1;

export function applySettings(game: any) {
  uiBridge.settings.value = { ...settings };
  uiBridge.autoPick.value = settings.autoPick;
  if (!game?.app) return;
  const q = QUALITY[settings.quality];
  const app = game.app;
  // video
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  // dynamic resolution takes a share of the chosen scale while frames run long (app/autotune)
  const res = Math.max(0.5, dpr * settings.renderScale * (game.autoTune ? game.autoTune.factor : 1));
  if (Math.abs(app.renderer.resolution - res) > 0.01) {
    app.renderer.resolution = res;
    app.renderer.resize(app.screen.width, app.screen.height);
  }
  app.ticker.maxFPS = settings.fpsCap;
  if (game.fx) game.fx.maxParticles = q.particles;
  if (game.glowLayer) game.glowLayer.visible = q.glows;
  if (game.ambience) game.ambience.enabled = q.ambience;
  if (game.lighting?.setScale) game.lighting.setScale(q.lightRes);
  game.zoom = zoomFactor();
  if (game.state?.player) game.applyCamera();
  // HUD
  document.documentElement.style.setProperty('--hs', String(settings.hudScale));
  if (game.ui?.mapBox) { game.ui.minimapScale = MINIMAP_SCALE[settings.minimap]; game.ui.mapBox.alpha = settings.minimapOpacity; }
  game.ui?.layoutHUD?.();
}
