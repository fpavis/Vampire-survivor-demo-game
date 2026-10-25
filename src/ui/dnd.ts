// Pointer-events drag and drop (mouse, touch and pen). Click-without-drag still works as "select".
import { signal } from '@preact/signals';

export type Payload =
  | { kind: 'rune'; id: string; from: 'bag' | { uid: string; slot: number } }
  | { kind: 'spell'; uid: string };

export interface DropTarget { type: 'socket' | 'bag' | 'equip' | 'unequip' | 'salvage'; uid?: string; slot?: number }
export interface DropCheck { ok: boolean; reason?: string }

export const dragging = signal<{ payload: Payload; label: string; icon?: string; x: number; y: number; hover: DropTarget | null } | null>(null);

let validate: (p: Payload, t: DropTarget) => DropCheck = () => ({ ok: true });
let commit: (p: Payload, t: DropTarget) => void = () => {};
let reject: (reason: string) => void = () => {};

export function configureDnd(v: typeof validate, c: typeof commit, r: typeof reject) { validate = v; commit = c; reject = r; }
export const checkDrop = (p: Payload, t: DropTarget) => validate(p, t);

/** The keyboard and controller path: do what a drop would do, with the same rules and the same refusals. */
export function applyDrop(p: Payload, t: DropTarget): boolean {
  const chk = validate(p, t);
  if (chk.ok) { commit(p, t); return true; }
  if (chk.reason) reject(chk.reason);
  return false;
}

function targetAt(x: number, y: number): DropTarget | null {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-drop]') as HTMLElement | null;
  if (!el) return null;
  return { type: el.dataset.drop as DropTarget['type'], uid: el.dataset.uid, slot: el.dataset.slot !== undefined ? Number(el.dataset.slot) : undefined };
}

/** The scrollable panel under a point, if any: dragging near its top or bottom edge scrolls it. */
function scrollerAt(x: number, y: number): HTMLElement | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  for (; el; el = el.parentElement) if (el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
  return null;
}

const EDGE = 56;          // px from a panel's edge where dragging starts to scroll it

/** Attach to onPointerDown of a draggable. `onClick` runs if the pointer never moved far enough to drag. */
export function beginDrag(e: PointerEvent, payload: Payload, label: string, onClick?: () => void, icon?: string) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const sx = e.clientX, sy = e.clientY;
  let active = false;
  let px = sx, py = sy, raf = 0;
  // scroll the panel under the pointer while it rests near the panel's top or bottom edge
  const scroll = () => {
    raf = 0;
    if (!active) return;
    const box = scrollerAt(px, py);
    if (!box) return;
    const r = box.getBoundingClientRect();
    const v = py < r.top + EDGE ? -(r.top + EDGE - py) : py > r.bottom - EDGE ? py - (r.bottom - EDGE) : 0;
    if (!v) return;
    box.scrollTop += Math.max(-18, Math.min(18, v * 0.35));
    dragging.value = dragging.value && { ...dragging.value, hover: targetAt(px, py) };
    raf = requestAnimationFrame(scroll);
  };
  const move = (ev: PointerEvent) => {
    if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 7) return;
    active = true;
    ev.preventDefault();
    px = ev.clientX; py = ev.clientY;
    dragging.value = { payload, label, icon, x: ev.clientX, y: ev.clientY, hover: targetAt(ev.clientX, ev.clientY) };
    if (!raf) raf = requestAnimationFrame(scroll);
  };
  const up = (ev: PointerEvent) => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (!active) { onClick?.(); return; }
    const t = targetAt(ev.clientX, ev.clientY);
    dragging.value = null;
    if (!t) return;                        // dropped on nothing: rolls back, nothing changed
    const chk = validate(payload, t);
    if (chk.ok) commit(payload, t); else if (chk.reason) reject(chk.reason);
  };
  const cancel = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    dragging.value = null;
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}
