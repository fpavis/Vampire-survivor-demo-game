import { describe, expect, it } from 'vitest';
import { KEY_ACTIONS, KEY_DEFAULTS, KeyMap, RESERVED_KEYS, keyLabel, normKey, type KeyAction } from '../src/core/input/bindings';

const ACTIONS = Object.keys(KEY_DEFAULTS) as KeyAction[];

describe('key bindings', () => {
  it('every action has a label, a default, and no default key is reserved or shared', () => {
    expect(KEY_ACTIONS.map((a) => a.id).sort()).toEqual([...ACTIONS].sort());
    const seen = new Map<string, KeyAction>();
    for (const a of ACTIONS) {
      expect(KEY_DEFAULTS[a].length, a).toBeGreaterThan(0);
      for (const k of KEY_DEFAULTS[a]) {
        expect(RESERVED_KEYS.has(k), `${a}: ${k}`).toBe(false);
        expect(seen.get(k), `${k} is on ${seen.get(k)} and ${a}`).toBeUndefined();
        seen.set(k, a);
      }
    }
  });

  it('+ and = zoom the camera in, - and _ zoom it out, and a player can move them', () => {
    const m = new KeyMap();
    for (const k of ['+', '=']) expect(m.actionFor(k), k).toBe('zoomIn');
    for (const k of ['-', '_']) expect(m.actionFor(k), k).toBe('zoomOut');
    expect(m.label('zoomIn')).toBe('+');
    expect(m.label('zoomOut')).toBe('-');
    expect(m.assign('zoomIn', 'z')).toBe(true);
    expect(m.actionFor('z')).toBe('zoomIn');
    expect(m.keysFor('zoomIn')).toEqual(['z', '=']);
  });

  it('reads a key press as an action, whatever its case, and knows when it means nothing', () => {
    const m = new KeyMap();
    expect(m.actionFor('w')).toBe('up');
    expect(m.actionFor('W')).toBe('up');
    expect(m.actionFor('ArrowUp')).toBe('up');
    expect(m.actionFor(' ')).toBe('skill1');
    expect(m.actionFor('Tab')).toBe('nextHero');
    expect(m.actionFor('z')).toBeNull();
    expect(normKey('Q')).toBe('q');
  });

  it('shows the main key of an action the way a keycap reads', () => {
    const m = new KeyMap();
    expect(m.label('up')).toBe('W');
    expect(m.label('skill1')).toBe('Space');
    expect(m.label('nextHero')).toBe('Tab');
    expect(keyLabel('arrowleft')).toBe('←');
    expect(keyLabel('f5')).toBe('F5');
    expect(m.keysFor('up')).toEqual(['w', 'arrowup']);
    expect(m.primary('map')).toBe('m');
  });

  it('rebinding gives an action a new main key and frees the old one', () => {
    const m = new KeyMap();
    expect(m.assign('interact', 'X')).toBe(true);
    expect(m.actionFor('x')).toBe('interact');
    expect(m.actionFor('e')).toBeNull();
    expect(m.primary('interact')).toBe('x');
    expect(m.assign('interact', 'x')).toBe(true);          // the same key again changes nothing
    expect(m.keysFor('interact')).toEqual(['x']);
  });

  it('taking a key another action uses swaps the two, so nothing is left without one', () => {
    const m = new KeyMap();
    expect(m.assign('skill2', 'e')).toBe(true);            // E was Interact, Q was Skill 2
    expect(m.primary('skill2')).toBe('e');
    expect(m.primary('interact')).toBe('q');
    expect(m.actionFor('e')).toBe('skill2');
    expect(m.actionFor('q')).toBe('interact');
    for (const a of ACTIONS) expect(m.keysFor(a).length, a).toBeGreaterThan(0);
  });

  it('taking a second way to walk (an arrow) just moves it', () => {
    const m = new KeyMap();
    expect(m.assign('skill1', 'ArrowUp')).toBe(true);
    expect(m.keysFor('skill1')).toEqual(['arrowup']);
    expect(m.keysFor('up')).toEqual(['w']);
    expect(m.actionFor('arrowup')).toBe('skill1');
  });

  it('refuses the keys the menus and the number keys need, and changes nothing', () => {
    const m = new KeyMap();
    const before = JSON.stringify(m.toJSON());
    for (const k of ['Escape', 'Enter', '1', '2', '3', 'F', 'l']) expect(m.assign('map', k), k).toBe(false);
    expect(JSON.stringify(m.toJSON())).toBe(before);
  });

  it('restores what was saved, ignoring what is not usable, and normalising case', () => {
    const m = new KeyMap({ up: ['I'], down: [], left: 'a' as unknown as string[] });
    expect(m.keysFor('up')).toEqual(['i']);
    expect(m.keysFor('down')).toEqual(KEY_DEFAULTS.down);   // an empty list keeps the default
    expect(m.keysFor('left')).toEqual(KEY_DEFAULTS.left);   // so does something that is not a list
    expect(m.keysFor('right')).toEqual(KEY_DEFAULTS.right);
    expect(new KeyMap(null).keysFor('map')).toEqual(['m']);
  });

  it('what toJSON gives comes back as the same map', () => {
    const m = new KeyMap();
    m.assign('journal', 'k');
    m.assign('build', 'g');
    const back = new KeyMap(JSON.parse(JSON.stringify(m.toJSON())));
    expect(back.toJSON()).toEqual(m.toJSON());
    expect(back.actionFor('k')).toBe('journal');
  });

  it('when two actions share a key in old data, the first in the list keeps it', () => {
    const m = new KeyMap({ left: ['w'] });
    expect(m.actionFor('w')).toBe('up');
    expect(m.keysFor('left')).toEqual(['w']);
  });

  it('reset puts every default back', () => {
    const m = new KeyMap();
    m.assign('map', 'n');
    m.assign('skill3', 'e');
    m.reset();
    expect(m.toJSON()).toEqual(KEY_DEFAULTS);
    expect(m.actionFor('m')).toBe('map');
    expect(m.actionFor('n')).toBeNull();
  });
});
