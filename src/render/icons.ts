// Icons on the canvas: drawn from the SVG path data with Path2D into cached textures (synchronous, so a
// sprite is ready the moment it is made), plus a small icon-and-text row for banners, toasts and labels.
import * as PIXI from 'pixi.js';
import { iconDef, isIcon, outlineWidth, OUTLINE, hexCss, type IconName } from '../core/icons/icons';

const RES = 2;
const textures = new Map<string, PIXI.Texture>();
const paths = new Map<string, Path2D>();

const pathOf = (name: IconName) => {
  let p = paths.get(name);
  if (!p) { p = new Path2D(iconDef(name).d); paths.set(name, p); }
  return p;
};

/** Draw an icon centred at (x, y) on a 2D canvas context, `size` pixels tall. */
export function drawIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, color?: number) {
  if (!isIcon(name)) return;
  const def = iconDef(name);
  const k = size / Math.max(def.w, def.h);
  ctx.save();
  ctx.translate(x - (def.w * k) / 2, y - (def.h * k) / 2);
  ctx.scale(k, k);
  const p = pathOf(name);
  const sw = outlineWidth(name);
  if (sw) { ctx.lineJoin = 'round'; ctx.lineWidth = sw * 2; ctx.strokeStyle = hexCss(OUTLINE); ctx.stroke(p); }
  ctx.fillStyle = hexCss(color ?? def.color ?? 0xffffff);
  ctx.fill(p);
  ctx.restore();
}

/** A cached texture of an icon, `size` logical pixels square. */
export function iconTexture(name: string, size = 24, color?: number): PIXI.Texture {
  const key = `${name}|${size}|${color ?? ''}`;
  let t = textures.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  const px = Math.ceil(size * RES) + 4;
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  drawIcon(ctx, name, px / 2, px / 2, size * RES, color);
  t = PIXI.Texture.from(c, { resolution: RES });
  textures.set(key, t);
  return t;
}

/** A sprite of an icon, anchored at its centre. */
export function iconSprite(name: string, size = 24, color?: number): PIXI.Sprite {
  const s = new PIXI.Sprite(iconTexture(name, size, color));
  s.anchor.set(0.5);
  return s;
}

/**
 * A row of an icon and a text, centred on its origin like a text with anchor 0.5. `set` changes both later;
 * `text` is the PIXI.Text inside, for styles.
 */
export class IconLabel extends PIXI.Container {
  text: PIXI.Text;
  private icon: PIXI.Sprite | null = null;
  private iconName = '';
  constructor(icon: string, text: string, style: Partial<PIXI.ITextStyle>, private iconSize = 0, private gap = 6, private anchorX = 0.5) {
    super();
    this.text = new PIXI.Text(text, style);
    this.text.anchor.set(0, 0.5);
    this.addChild(this.text);
    this.set(icon, text);
  }

  set(icon: string, text: string, iconColor?: number) {
    if (text !== this.text.text) this.text.text = text;
    const size = this.iconSize || Math.round(Number(this.text.style.fontSize) * 1.15);
    const key = `${icon}|${iconColor ?? ''}|${size}`;
    if (key !== this.iconName) {
      this.iconName = key;
      if (this.icon) { this.removeChild(this.icon); this.icon.destroy(); this.icon = null; }
      if (icon) { this.icon = iconSprite(icon, size, iconColor); this.addChild(this.icon); }
    }
    this.layout(size);
  }

  private layout(size: number) {
    const iw = this.icon ? size + this.gap : 0;
    const w = iw + this.text.width;
    const x0 = -w * this.anchorX;
    if (this.icon) this.icon.position.set(x0 + size / 2, 0);
    this.text.position.set(x0 + iw, 0);
  }
}
