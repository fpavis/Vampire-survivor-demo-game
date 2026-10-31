// The game's icon set: names, colours and outline style. Path data lives in data.ts (generated).
import { ICON_DATA } from './data';

export type IconName = keyof typeof ICON_DATA;

export const isIcon = (name: string): name is IconName => Object.prototype.hasOwnProperty.call(ICON_DATA, name);

/** viewBox size, palette colour (null: follow the text colour) and path data of an icon. */
export function iconDef(name: IconName): { w: number; h: number; color: number | null; d: string } {
  const [w, h, color, d] = ICON_DATA[name];
  return { w, h, color, d };
}

/** Game icons get a dark outline so they read over the world; interface glyphs do not. */
export const OUTLINE = 0x0b0a14;
export const outlineWidth = (name: IconName) => (ICON_DATA[name][2] === null ? 0 : ICON_DATA[name][0] * 0.05);

export const hexCss = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
