// Focus navigation for the DOM panels, shared by keyboard (arrow keys), controller (d-pad) and mouse (hover).
// The top-most open panel is the "scope": directions move focus between its buttons, confirm presses the focused
// one, back closes the panel. Panels never pause the game, so movement keys and the left stick keep working.
import { pickNeighbor, type Dir, type Rect } from '../core/input/gamepad';
import { ui } from './bridge';

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), select:not([disabled]), input:not([disabled]):not([type=hidden]), [tabindex="0"]';
const TEXTY = new Set(['text', 'search', 'number', 'email', 'password', '']);

const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const isText = (el: Element | null): el is HTMLInputElement => el instanceof HTMLInputElement && TEXTY.has(el.type);

/** True while the player is typing into a field: hotkeys must leave their keys alone. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (isText(el) || el instanceof HTMLTextAreaElement);
}

/** The top-most open panel, or null. */
export function navScope(): HTMLElement | null {
  const panels = document.querySelectorAll<HTMLElement>('#ui-root .vs-panel');
  for (let i = panels.length - 1; i >= 0; i--) if (visible(panels[i])) return panels[i];
  return null;
}
export const navActive = () => !!navScope();

/** Arrow keys go to a panel only when it is a real menu: a lone close button leaves them free for walking. */
export function navWantsArrows(): boolean {
  const s = navScope();
  return !!s && candidates(s).length > 1;
}

function candidates(scope: HTMLElement): HTMLElement[] {
  const pad = ui.device.value === 'pad';
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => visible(el) && !(pad && isText(el)));
}

function current(scope: HTMLElement): HTMLElement | null {
  const a = document.activeElement as HTMLElement | null;
  return a && a !== document.body && scope.contains(a) && a.matches(FOCUSABLE) ? a : null;
}

const rectOf = (el: HTMLElement): Rect => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** Focus the first sensible element (not a text field, which would swallow the hotkeys). */
export function navFocusFirst(scope = navScope()): boolean {
  if (!scope) return false;
  const all = candidates(scope).filter((el) => !isText(el));
  // start on the content, not on the close button or the sort / filter controls
  let items = all.filter((el) => !el.classList.contains('vs-x') && !(el instanceof HTMLSelectElement) && !(el instanceof HTMLInputElement));
  if (!items.length) items = all.filter((el) => !el.classList.contains('vs-x'));
  if (!items.length) { if (!all.length) return false; items.push(...all); }
  const rects = items.map(rectOf);
  focusEl(items[pickNeighbor(null, rects, 'down')]);
  return true;
}

function setValue(el: HTMLInputElement | HTMLSelectElement, fire = true) {
  if (!fire) return;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Left / right on a slider or a drop-down changes its value instead of moving focus. */
function adjust(el: HTMLElement, dir: Dir, wrap = false): boolean {
  if (dir !== 'left' && dir !== 'right') return false;
  const sign = dir === 'right' ? 1 : -1;
  if (el instanceof HTMLInputElement && el.type === 'range') {
    const step = Number(el.step) || 1, min = Number(el.min || 0), max = Number(el.max || 100);
    el.value = String(Math.min(max, Math.max(min, el.valueAsNumber + sign * step)));
    setValue(el);
    return true;
  }
  if (el instanceof HTMLSelectElement) {
    const n = el.options.length;
    let i = el.selectedIndex + sign;
    if (wrap) i = (i + n) % n;
    if (i >= 0 && i < n && i !== el.selectedIndex) { el.selectedIndex = i; setValue(el); }
    return true;
  }
  return false;
}

export function navMove(dir: Dir): boolean {
  const scope = navScope();
  if (!scope) return false;
  const items = candidates(scope);
  if (!items.length) return true;
  const cur = current(scope);
  if (cur && adjust(cur, dir)) return true;
  if (!cur) { navFocusFirst(scope); return true; }
  const idx = items.indexOf(cur);
  const next = pickNeighbor(rectOf(cur), items.map(rectOf), dir, idx);
  if (next >= 0) focusEl(items[next]);
  return true;
}

export function navConfirm(): boolean {
  const scope = navScope();
  if (!scope) return false;
  const cur = current(scope);
  if (!cur) { navFocusFirst(scope); return true; }
  if (cur instanceof HTMLSelectElement) adjust(cur, 'right', true);
  else if (isText(cur)) return true;
  else if (cur instanceof HTMLButtonElement || cur instanceof HTMLInputElement) cur.click();
  else {
    // a tabbable row with its own Enter handler (spell and rune rows in the loadout)
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    cur.dispatchEvent(ev);
  }
  return true;
}

export type PadFace = 'x' | 'y' | 'rt';

/**
 * Offer a face button to the focused element of the top panel as a cancelable `vs-pad` event (detail: the button).
 * Returns true when a panel handled it (equip, lock ...), so the button does not also cast a skill.
 */
export function navAction(button: PadFace): boolean {
  const scope = navScope();
  if (!scope) return false;
  const ev = new CustomEvent<PadFace>('vs-pad', { detail: button, bubbles: true, cancelable: true });
  (current(scope) ?? scope).dispatchEvent(ev);
  return ev.defaultPrevented;
}

/** Panels that sit beside the action (level-up cards) let unhandled skill buttons through; the others do not. */
export const navModal = () => { const s = navScope(); return !!s && !s.classList.contains('vs-cards'); };

/** Close the top-most panel (or leave a text field). */
export function navBack(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (a && isText(a)) { a.blur(); return true; }
  const scope = navScope();
  if (!scope) return false;
  const close = scope.querySelector<HTMLElement>('.vs-x');
  if (close) { close.click(); return true; }
  return false;
}

/** Wire focus rings to the active device, hover to focus, and auto-focus for newly opened panels. */
export function installNav() {
  const root = document.getElementById('ui-root');
  if (!root || (root as any).__nav) return;
  (root as any).__nav = true;
  let lastScope: HTMLElement | null = null;
  let queued = false;
  const check = () => {
    queued = false;
    const scope = navScope();
    const fresh = scope && scope !== lastScope;
    lastScope = scope;
    if (!scope || ui.device.value === 'mouse' || ui.device.value === 'touch') return;
    if (fresh || !current(scope)) {
      const a = document.activeElement as HTMLElement | null;
      if (!a || a === document.body || !scope.contains(a)) navFocusFirst(scope);
    }
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(check); } }).observe(root, { childList: true, subtree: true });
  root.addEventListener('pointerover', (e) => {
    // only a mouse the player is really using moves focus; one resting under a freshly opened panel must not
    if ((e as PointerEvent).pointerType !== 'mouse' || ui.device.value !== 'mouse') return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(FOCUSABLE);
    const scope = navScope();
    if (el && scope && scope.contains(el) && !isText(el) && !(el instanceof HTMLSelectElement)) el.focus({ preventScroll: true });
  });
}
