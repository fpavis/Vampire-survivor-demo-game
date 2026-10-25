// Controller input rules: dead zones, button bindings with edges and auto-repeat, controller-specific labels,
// and spatial navigation between UI elements. Pure and deterministic: the runtime feeds it snapshots and a clock.

export type PadAction =
  | 'interact' | 'cancel' | 'skill1' | 'skill2' | 'skill3'
  | 'prevHero' | 'nextHero' | 'map' | 'menu'
  | 'up' | 'down' | 'left' | 'right';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Vec { x: number; y: number }

export interface PadButton { pressed: boolean; value: number }
export interface PadSnapshot { id: string; axes: readonly number[]; buttons: readonly PadButton[] }

/** Button indices of the browser's "standard" gamepad mapping. */
export const BTN = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15
} as const;

export const DEFAULT_BINDINGS: Record<PadAction, number[]> = {
  interact: [BTN.A], cancel: [BTN.B],
  skill1: [BTN.X], skill2: [BTN.Y], skill3: [BTN.RT],
  prevHero: [BTN.LB], nextHero: [BTN.RB],
  map: [BTN.BACK], menu: [BTN.START],
  up: [BTN.UP], down: [BTN.DOWN], left: [BTN.LEFT], right: [BTN.RIGHT]
};

export const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
export const isDir = (a: PadAction): a is Dir => a === 'up' || a === 'down' || a === 'left' || a === 'right';

/** Radial dead zone that rescales the remaining range to 0..1, so slow pushes stay precise. */
export function deadzone(x: number, y: number, dz: number): Vec {
  const m = Math.hypot(x, y);
  if (m <= dz || m === 0) return { x: 0, y: 0 };
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return { x: x * k, y: y * k };
}

/** Dominant direction of a stick push, or null below the threshold. */
export function stickDir(v: Vec, threshold = 0.55): Dir | null {
  if (Math.hypot(v.x, v.y) < threshold) return null;
  return Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : (v.y > 0 ? 'down' : 'up');
}

export interface PadFrame {
  move: Vec;                       // left stick after the dead zone
  aim: Vec;                        // right stick after the dead zone
  held: Set<PadAction>;
  pressed: Set<PadAction>;         // edges this poll; directions also repeat while held
  stick: Dir | null;               // left-stick direction event (edge + repeat), for menus where the stick navigates
  active: boolean;                 // any button or stick is in use this poll
}

export const emptyFrame = (): PadFrame => ({ move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, held: new Set(), pressed: new Set(), stick: null, active: false });

export interface PadOptions { deadzone: number; repeatDelay: number; repeatRate: number }
export const DEFAULT_PAD_OPTIONS: PadOptions = { deadzone: 0.2, repeatDelay: 380, repeatRate: 120 };

const down = (b: PadButton | undefined) => !!b && (b.pressed || b.value > 0.5);

/** Turns raw snapshots into logical actions. Keeps the little state needed for edges and auto-repeat. */
export class PadMapper {
  options: PadOptions;
  bindings: Record<PadAction, number[]>;
  private prev = new Set<PadAction>();
  private dirSince = new Map<string, number>();     // 'dpad:up' / 'stick:left' -> time of last emission
  private dirStart = new Map<string, number>();
  private stickPrev: Dir | null = null;

  constructor(options: Partial<PadOptions> = {}, bindings = DEFAULT_BINDINGS) {
    this.options = { ...DEFAULT_PAD_OPTIONS, ...options };
    this.bindings = bindings;
  }

  reset() { this.prev.clear(); this.dirSince.clear(); this.dirStart.clear(); this.stickPrev = null; }

  private repeats(key: string, held: boolean, now: number): boolean {
    if (!held) { this.dirSince.delete(key); this.dirStart.delete(key); return false; }
    const start = this.dirStart.get(key);
    if (start === undefined) { this.dirStart.set(key, now); this.dirSince.set(key, now); return true; }
    const last = this.dirSince.get(key)!;
    const wait = last === start ? this.options.repeatDelay : this.options.repeatRate;
    if (now - last >= wait) { this.dirSince.set(key, now); return true; }
    return false;
  }

  update(snap: PadSnapshot | null, now: number): PadFrame {
    const f = emptyFrame();
    if (!snap) { this.reset(); return f; }
    const dz = this.options.deadzone;
    f.move = deadzone(snap.axes[0] ?? 0, snap.axes[1] ?? 0, dz);
    f.aim = deadzone(snap.axes[2] ?? 0, snap.axes[3] ?? 0, dz);
    let any = f.move.x !== 0 || f.move.y !== 0 || f.aim.x !== 0 || f.aim.y !== 0;

    for (const action of Object.keys(this.bindings) as PadAction[]) {
      const isHeld = this.bindings[action].some((i) => down(snap.buttons[i]));
      if (isHeld) { f.held.add(action); any = true; }
      if (isDir(action)) {
        if (this.repeats('dpad:' + action, isHeld, now)) f.pressed.add(action);
      } else if (isHeld && !this.prev.has(action)) f.pressed.add(action);
    }

    const sd = stickDir(f.move);
    if (sd !== this.stickPrev) { if (this.stickPrev) this.repeats('stick:' + this.stickPrev, false, now); this.stickPrev = sd; }
    f.stick = sd && this.repeats('stick:' + sd, true, now) ? sd : null;

    this.prev = new Set(f.held);
    f.active = any;
    return f;
  }
}

// ------------------------------------------------------------------ labels
export type PadKind = 'xbox' | 'playstation' | 'switch' | 'generic';

export function padKind(id: string): PadKind {
  const s = (id || '').toLowerCase();
  if (/playstation|dualshock|dualsense|054c|ps4|ps5|wireless controller/.test(s)) return 'playstation';
  if (/nintendo|switch|pro controller|057e|joy-con/.test(s)) return 'switch';
  if (/xbox|xinput|045e|microsoft/.test(s)) return 'xbox';
  return 'generic';
}

const LABELS: Record<PadKind, string[]> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →'],
  switch: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →'],
  generic: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →']
};

export const buttonLabel = (kind: PadKind, index: number) => LABELS[kind][index] ?? `Btn ${index}`;
export const padGlyph = (kind: PadKind, action: PadAction, bindings = DEFAULT_BINDINGS) => buttonLabel(kind, bindings[action][0]);

export const KEY_GLYPH: Record<PadAction, string> = {
  interact: 'E', cancel: 'Esc', skill1: 'Space', skill2: 'Q', skill3: 'R', prevHero: 'Shift+Tab', nextHero: 'Tab',
  map: 'M', menu: 'Esc', up: '↑', down: '↓', left: '←', right: '→'
};

/** Panels that the d-pad opens when no menu is up (the buttons are fixed, so they live here as data). */
export type QuickPanel = 'spells' | 'upgrades' | 'build' | 'journal';
export const QUICK_PANELS: Record<Dir, QuickPanel | null> = { up: 'spells', down: 'upgrades', left: 'build', right: 'journal' };
export const QUICK_KEY: Record<QuickPanel, string> = { spells: 'I', upgrades: 'U', build: 'B', journal: 'J' };

// ------------------------------------------------------- spatial navigation
export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Index of the element to focus when moving `dir` from `cur`, or -1 when nothing lies that way.
 * With no current element the top-left-most one is chosen. Elements that overlap the current one along the
 * other axis are strongly preferred, so a column of buttons moves straight up and down.
 */
export function pickNeighbor(cur: Rect | null, items: readonly Rect[], dir: Dir, currentIndex = -1): number {
  if (!items.length) return -1;
  if (!cur) {
    let best = 0;
    for (let i = 1; i < items.length; i++) {
      const a = items[i], b = items[best];
      if (a.y < b.y - 4 || (Math.abs(a.y - b.y) <= 4 && a.x < b.x)) best = i;
    }
    return best;
  }
  const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
  let best = -1, bestScore = Infinity;
  for (let i = 0; i < items.length; i++) {
    if (i === currentIndex) continue;
    const r = items[i];
    const rx = r.x + r.w / 2, ry = r.y + r.h / 2;
    const horizontal = dir === 'left' || dir === 'right';
    const sign = dir === 'right' || dir === 'down' ? 1 : -1;
    const along = (horizontal ? rx - cx : ry - cy) * sign;
    if (along <= 1) continue;                                           // not that way
    const lo = horizontal ? cur.y : cur.x, hi = lo + (horizontal ? cur.h : cur.w);
    const rlo = horizontal ? r.y : r.x, rhi = rlo + (horizontal ? r.h : r.w);
    const overlap = Math.min(hi, rhi) - Math.max(lo, rlo);
    const across = Math.abs(horizontal ? ry - cy : rx - cx);
    const score = along + (overlap > 0 ? across * 0.25 : across * 3 + 200);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}
