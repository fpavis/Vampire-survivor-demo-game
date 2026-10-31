// Keyboard bindings in one place, so every key can be rebound. Pure: the runtime feeds it key names
// (KeyboardEvent.key, lower-cased) and asks which action a key means. Controller bindings live in gamepad.ts.

export type KeyAction =
  | 'up' | 'down' | 'left' | 'right'
  | 'skill1' | 'skill2' | 'skill3' | 'interact' | 'map'
  | 'spells' | 'upgrades' | 'journal' | 'build' | 'party' | 'nextHero' | 'zoomIn' | 'zoomOut';

export const KEY_ACTIONS: { id: KeyAction; label: string }[] = [
  { id: 'up', label: 'Move up' }, { id: 'down', label: 'Move down' }, { id: 'left', label: 'Move left' }, { id: 'right', label: 'Move right' },
  { id: 'interact', label: 'Interact · talk · enter' }, { id: 'skill1', label: 'Skill 1 (Dash …)' }, { id: 'skill2', label: 'Skill 2' },
  { id: 'skill3', label: 'Skill 3' }, { id: 'nextHero', label: 'Next hero' }, { id: 'map', label: 'World map' },
  { id: 'spells', label: 'Spells and runes' }, { id: 'upgrades', label: 'Upgrades' }, { id: 'journal', label: 'Journal' },
  { id: 'build', label: 'Build menu' }, { id: 'party', label: 'Party and stats' },
  { id: 'zoomIn', label: 'Camera zoom in' }, { id: 'zoomOut', label: 'Camera zoom out' }
];

/** Defaults: the first key is the one shown in hints and the one a player rebinds; arrows stay as a second way to walk. */
export const KEY_DEFAULTS: Record<KeyAction, string[]> = {
  up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'],
  skill1: [' '], skill2: ['q'], skill3: ['r'], interact: ['e'], map: ['m'],
  spells: ['i'], upgrades: ['u'], journal: ['j'], build: ['b'], party: ['c'], nextHero: ['tab'],
  zoomIn: ['+', '='], zoomOut: ['-', '_']          // the unshifted key beside the shifted one, and the numpad's
};

/** Keys a player may not take for themselves: menus, pause and the number keys that pick cards and heroes. */
export const RESERVED_KEYS = new Set(['escape', 'enter', '1', '2', '3', 'f', 'l']);

export const normKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key.toLowerCase());

const NAMES: Record<string, string> = {
  ' ': 'Space', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', tab: 'Tab', shift: 'Shift',
  control: 'Ctrl', alt: 'Alt', backspace: 'Backspace', capslock: 'Caps', delete: 'Del'
};
export const keyLabel = (key: string): string => NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1));

export class KeyMap {
  map: Record<KeyAction, string[]>;
  private index = new Map<string, KeyAction>();

  constructor(saved: Partial<Record<KeyAction, string[]>> | null = null) {
    this.map = JSON.parse(JSON.stringify(KEY_DEFAULTS));
    if (saved) for (const a of Object.keys(KEY_DEFAULTS) as KeyAction[]) if (Array.isArray(saved[a]) && saved[a]!.length) this.map[a] = saved[a]!.map(normKey);
    this.reindex();
  }

  private reindex() {
    this.index.clear();
    for (const a of Object.keys(this.map) as KeyAction[]) for (const k of this.map[a]) if (!this.index.has(k)) this.index.set(k, a);
  }

  actionFor(key: string): KeyAction | null { return this.index.get(normKey(key)) ?? null; }
  keysFor(a: KeyAction): string[] { return this.map[a]; }
  primary(a: KeyAction): string { return this.map[a][0]; }
  label(a: KeyAction): string { return keyLabel(this.primary(a)); }

  /**
   * Make `key` the main key of `action`. If another action used that key, the two swap their keys,
   * so nothing is ever left without a key. Returns false for keys that cannot be taken.
   */
  assign(action: KeyAction, key: string): boolean {
    const k = normKey(key);
    if (RESERVED_KEYS.has(k)) return false;
    const old = this.map[action][0];
    if (old === k) return true;
    for (const other of Object.keys(this.map) as KeyAction[]) {
      if (other === action) continue;
      const i = this.map[other].indexOf(k);
      if (i < 0) continue;
      if (i === 0) this.map[other][0] = old;                      // swap the main keys
      else this.map[other].splice(i, 1);                         // a secondary key (an arrow) just moves
    }
    this.map[action] = [k, ...this.map[action].slice(1).filter((x) => x !== k)];
    this.reindex();
    return true;
  }

  reset() { this.map = JSON.parse(JSON.stringify(KEY_DEFAULTS)); this.reindex(); }
  toJSON() { return this.map; }
}
