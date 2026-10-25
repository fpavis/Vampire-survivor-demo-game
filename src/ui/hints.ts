// Device-aware button hints: the same prompt reads "[E]" on a keyboard and "[A]" (or "[✕]") on a controller.
import { KEY_GLYPH, QUICK_KEY, padGlyph, type PadAction, type QuickPanel } from '../core/input/gamepad';
import { ui } from './bridge';

export const onPad = () => ui.device.value === 'pad';
export const glyph = (a: PadAction): string => (onPad() ? padGlyph(ui.padKind.value, a) : KEY_GLYPH[a]);
const QUICK_PAD: Record<QuickPanel, string> = { spells: 'D-pad ↑', upgrades: 'D-pad ↓', build: 'D-pad ←', journal: 'D-pad →' };
export const quickGlyph = (p: QuickPanel): string => (onPad() ? QUICK_PAD[p] : QUICK_KEY[p]);

/** "[E]" in any prompt text becomes the interact button of whatever the player is using. */
export const localize = (text: string): string => text.replace('[E]', `[${glyph('interact')}]`);
