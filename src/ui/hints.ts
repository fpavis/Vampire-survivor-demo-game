// Device-aware button hints: the same prompt reads "[E]" on a keyboard and "[A]" (or "[✕]") on a controller,
// and follows whatever keys and buttons the player has rebound.
import { KEY_GLYPH, QUICK_KEY, padGlyph, type PadAction, type QuickPanel } from '../core/input/gamepad';
import type { KeyAction } from '../core/input/bindings';
import { ui } from './bridge';

export const onPad = () => ui.device.value === 'pad';

// pad actions that have a rebindable keyboard twin
const KEY_TWIN: Partial<Record<PadAction, KeyAction>> = { interact: 'interact', skill1: 'skill1', skill2: 'skill2', skill3: 'skill3', map: 'map', nextHero: 'nextHero' };

export const glyph = (a: PadAction): string => {
  ui.bindVersion.value;                                   // re-render hints after rebinding
  const input = ui.game?.input;
  if (onPad()) return padGlyph(ui.padKind.value, a, input?.mapper?.bindings);
  const twin = KEY_TWIN[a];
  return twin && input?.keys ? input.keys.label(twin) : KEY_GLYPH[a];
};

const QUICK_PAD: Record<QuickPanel, string> = { spells: 'D-pad ↑', upgrades: 'D-pad ↓', build: 'D-pad ←', journal: 'D-pad →' };
export const quickGlyph = (p: QuickPanel): string => {
  ui.bindVersion.value;
  if (onPad()) return QUICK_PAD[p];
  const keys = ui.game?.input?.keys;
  return keys ? keys.label(p) : QUICK_KEY[p];
};

/** "[E]" in any prompt text becomes the interact button of whatever the player is using. */
export const localize = (text: string): string => text.replace('[E]', `[${glyph('interact')}]`);
