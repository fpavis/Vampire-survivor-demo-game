import { ui } from './bridge';
import { glyph, onPad, quickGlyph } from './hints';
import { fillTip } from '../core/onboarding/tips';
import { Icon } from './Icon';

const QUICK = new Set(['spells', 'upgrades', 'build', 'journal']);

/** What a {placeholder} in a tip reads as on the current device. */
function tipGlyph(name: string): string {
  if (name === 'move') {
    if (onPad()) return 'the left stick';
    if (ui.device.value === 'touch') return 'the joystick';
    const keys = ui.game?.input?.keys;
    return keys ? `${['up', 'left', 'down', 'right'].map((a) => keys.label(a)).join('')} or the arrow keys` : 'WASD or the arrow keys';
  }
  return QUICK.has(name) ? quickGlyph(name as any) : glyph(name as any);
}

/** A small coach card under the party bar: one tip at a time, never in the way. */
export function TipCard() {
  const tip = ui.tip.value;
  if (!tip || !ui.tipsOn.value) return null;
  return (
    <div class="vs-coach hit" role="status" data-tip={tip.id}>
      <span class="ic"><Icon name={tip.icon} /></span>
      <span class="tx">{fillTip(tip.text, tipGlyph)}</span>
      <button class="vs-btn vs-x" onClick={() => ui.game?.tips.dismiss()} title={onPad() ? `Hide (${glyph('cancel')})` : 'Hide'} aria-label="Hide this tip"><Icon name="close" /></button>
    </div>
  );
}
