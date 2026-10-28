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
  // Xbox pads also call themselves "Wireless Controller", so they are checked before the generic Sony name
  if (/xbox|xinput|045e|microsoft/.test(s)) return 'xbox';
  if (/playstation|dualshock|dualsense|054c|ps4|ps5|wireless controller/.test(s)) return 'playstation';
  if (/nintendo|switch|pro controller|057e|joy-con/.test(s)) return 'switch';
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

/** Actions a player may move to another button. The d-pad stays fixed: it moves through menus. */
export const PAD_REBINDABLE: PadAction[] = ['interact', 'cancel', 'skill1', 'skill2', 'skill3', 'prevHero', 'nextHero', 'map', 'menu'];
export const PAD_ACTION_LABEL: Partial<Record<PadAction, string>> = {
  interact: 'Interact · confirm', cancel: 'Back · cancel', skill1: 'Skill 1', skill2: 'Skill 2', skill3: 'Skill 3',
  prevHero: 'Previous hero', nextHero: 'Next hero', map: 'World map', menu: 'Pause'
};

/**
 * Move `action` to `button`. Whatever action held that button takes the old button instead (a swap), so no
 * action is ever left without a button. D-pad buttons and unknown actions are refused (returns null).
 */
export function assignPad(bindings: Record<PadAction, number[]>, action: PadAction, button: number): Record<PadAction, number[]> | null {
  if (!PAD_REBINDABLE.includes(action) || button < 0 || button > 11) return null;
  const out = JSON.parse(JSON.stringify(bindings)) as Record<PadAction, number[]>;
  const old = out[action][0];
  for (const other of PAD_REBINDABLE) if (other !== action && out[other][0] === button) out[other] = [old];
  out[action] = [button];
  return out;
}

// ------------------------------------------------------------ pad profiles
/**
 * A controller the browser does not lay out in its "standard" way: which of its raw inputs is each standard
 * button. A source is a raw button index, or an axis pushed one way ({ axis, dir }) for pads that report the
 * d-pad as a hat; null means it was skipped (the standard index is used as it is).
 */
export type PadSource = number | { axis: number; dir: 1 | -1 } | null;
export interface PadProfile { buttons: PadSource[] }

/** The guided setup asks for these, in order. */
export const SETUP_STEPS: { btn: number; prompt: string }[] = [
  { btn: BTN.A, prompt: 'the bottom face button (A on Xbox, ✕ on PlayStation)' },
  { btn: BTN.B, prompt: 'the right face button (B, ○)' },
  { btn: BTN.X, prompt: 'the left face button (X, □)' },
  { btn: BTN.Y, prompt: 'the top face button (Y, △)' },
  { btn: BTN.LB, prompt: 'the left shoulder (LB, L1)' },
  { btn: BTN.RB, prompt: 'the right shoulder (RB, R1)' },
  { btn: BTN.LT, prompt: 'the left trigger (LT, L2)' },
  { btn: BTN.RT, prompt: 'the right trigger (RT, R2)' },
  { btn: BTN.BACK, prompt: 'the small left button (View, Share, Back)' },
  { btn: BTN.START, prompt: 'the small right button (Menu, Options, Start)' },
  { btn: BTN.UP, prompt: 'up on the d-pad' },
  { btn: BTN.DOWN, prompt: 'down on the d-pad' },
  { btn: BTN.LEFT, prompt: 'left on the d-pad' },
  { btn: BTN.RIGHT, prompt: 'right on the d-pad' }
];

/** The profile from what was pressed at each setup step (in SETUP_STEPS order). */
export function profileFromCaptures(captures: PadSource[]): PadProfile {
  const buttons: PadSource[] = Array.from({ length: 16 }, () => null);
  SETUP_STEPS.forEach((st, k) => { buttons[st.btn] = captures[k] ?? null; });
  return { buttons };
}

const NONE: PadButton = { pressed: false, value: 0 };
/** A raw snapshot seen through a profile: buttons where the standard layout has them, sticks as they are. */
export function applyProfile(snap: PadSnapshot, p: PadProfile): PadSnapshot {
  const buttons: PadButton[] = [];
  for (let i = 0; i < Math.max(16, snap.buttons.length); i++) {
    const src = p.buttons[i];
    if (src === null || src === undefined) buttons.push(snap.buttons[i] ?? NONE);
    else if (typeof src === 'number') buttons.push(snap.buttons[src] ?? NONE);
    else { const v = (snap.axes[src.axis] ?? 0) * src.dir; buttons.push(v > 0.5 ? { pressed: true, value: v } : NONE); }
  }
  return { id: snap.id, axes: snap.axes, buttons };
}

/**
 * During setup: the input newly pressed since `rest` (the axes at rest), or null. A button wins over an axis;
 * the first two axes (the left stick) are not taken, so a nudged stick never answers for a button.
 */
export function newlyPressed(snap: PadSnapshot, rest: readonly number[]): PadSource {
  for (let i = 0; i < snap.buttons.length; i++) if (down(snap.buttons[i])) return i;
  for (let a = 2; a < snap.axes.length; a++) {
    const d = (snap.axes[a] ?? 0) - (rest[a] ?? 0);
    if (Math.abs(d) > 0.6) return { axis: a, dir: d > 0 ? 1 : -1 };
  }
  return null;
}

/** A rumble: the heavy (low) and light (high) motors, 0..1, and how long it lasts. */
export interface Rumble { strong: number; weak: number; ms: number }
export type HapticName = 'hurt' | 'crit' | 'bigKill' | 'bossKill' | 'levelUp' | 'chest' | 'quest' | 'bossIntro' | 'switch' | 'dash' | 'slam' | 'wipe' | 'test';

/**
 * What each moment feels like, and how soon it may be felt again (ms), so a stream of hits or crits does not
 * turn into one long buzz. Small things use the light motor briefly; the heavy motor is kept for big moments.
 */
export const HAPTICS: Record<HapticName, Rumble & { cooldown: number }> = {
  hurt: { strong: 0.55, weak: 0.3, ms: 150, cooldown: 200 },
  crit: { strong: 0, weak: 0.3, ms: 50, cooldown: 400 },
  bigKill: { strong: 0.45, weak: 0.35, ms: 130, cooldown: 300 },
  bossKill: { strong: 1, weak: 0.7, ms: 520, cooldown: 1500 },
  levelUp: { strong: 0.3, weak: 0.8, ms: 260, cooldown: 600 },
  chest: { strong: 0.2, weak: 0.6, ms: 170, cooldown: 400 },
  quest: { strong: 0.3, weak: 0.7, ms: 240, cooldown: 600 },
  bossIntro: { strong: 0.8, weak: 0.25, ms: 600, cooldown: 3000 },
  switch: { strong: 0.2, weak: 0.45, ms: 110, cooldown: 300 },
  dash: { strong: 0.12, weak: 0.35, ms: 80, cooldown: 200 },
  slam: { strong: 0.9, weak: 0.5, ms: 220, cooldown: 300 },
  wipe: { strong: 1, weak: 1, ms: 700, cooldown: 3000 },
  test: { strong: 0.6, weak: 0.6, ms: 200, cooldown: 250 }
};

/** A rumble at the player's strength (0..1), or null when that is nothing. The length stays as it is. */
export function scaleRumble(r: Rumble, strength: number): Rumble | null {
  const k = Math.max(0, Math.min(1, strength));
  if (k <= 0 || (r.strong <= 0 && r.weak <= 0)) return null;
  return { strong: Math.min(1, r.strong * k), weak: Math.min(1, r.weak * k), ms: r.ms };
}

/** Keeps each pattern to its cooldown. */
export class HapticGate {
  private last = new Map<HapticName, number>();
  allow(name: HapticName, now: number): boolean {
    const t = this.last.get(name);
    if (t !== undefined && now - t < HAPTICS[name].cooldown) return false;
    this.last.set(name, now);
    return true;
  }
}

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
