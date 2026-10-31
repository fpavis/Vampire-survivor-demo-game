import { hexCss, iconDef, isIcon, outlineWidth, OUTLINE } from '../core/icons/icons';

interface Props { name: string; size?: string | number; color?: number | string; title?: string; class?: string }

/** An icon from the game's SVG set. Unknown names render nothing. */
export function Icon({ name, size, color, title, class: cls }: Props) {
  if (!isIcon(name)) return null;
  const def = iconDef(name);
  const fill = color === undefined ? (def.color === null ? 'currentColor' : hexCss(def.color)) : typeof color === 'number' ? hexCss(color) : color;
  const sw = outlineWidth(name);
  return (
    <svg class={`vs-icon${cls ? ' ' + cls : ''}`} viewBox={`0 0 ${def.w} ${def.h}`} width={size} height={size}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} focusable="false">
      {title && <title>{title}</title>}
      <path d={def.d} fill={fill} {...(sw ? { stroke: hexCss(OUTLINE), 'stroke-width': sw, 'stroke-linejoin': 'round', 'paint-order': 'stroke' } : {})} />
    </svg>
  );
}
