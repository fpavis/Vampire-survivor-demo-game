// Accessibility measurements shared by the audit suite: axe-core for structure (names, roles, ARIA, landmarks) and a
// contrast check of our own, because axe cannot decide contrast for text over the moving canvas or over gradients.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

/** Put axe-core into the page (once per page load). */
export async function injectAxe(page) {
  if (!(await page.evaluate(() => typeof window.axe))) return;
  await page.addScriptTag({ content: AXE_SOURCE });
}

// Rules that the game deliberately does not meet, each with the reason:
//  meta-viewport   pinch-zoom is off because two-thumb play on a phone would zoom the page; the text size setting
//                  (90 to 140%) stands in for it
//  color-contrast  decided by contrastReport below, which understands the canvas and gradients
export const AXE_OFF = ['meta-viewport', 'color-contrast'];

/**
 * Violations of WCAG 2.2 A and AA and axe's best practices inside root (or the whole page when root is null), and the
 * ids of the rules that ran, so a test can show a rule it relies on (target size, button names) really did.
 */
export function axeViolations(page, root = null, off = AXE_OFF) {
  return page.evaluate(async ([root, off]) => {
    const rules = Object.fromEntries(off.map((id) => [id, { enabled: false }]));
    const r = await window.axe.run(root ? document.querySelector(root) || document : document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, rules
    });
    return {
      violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, example: v.nodes[0].html.slice(0, 120) })),
      ran: [...r.passes, ...r.violations, ...r.incomplete].map((x) => x.id)
    };
  }, [root, off]);
}

/**
 * The contrast of every piece of visible text in root: its colour against what is behind it, worst case.
 * Behind a text is the stack of backgrounds up to the first opaque one; below a translucent stack lies the canvas, so
 * both black and white are tried. A gradient counts as each of its colour stops. Text with no panel behind it at all
 * (it floats over the world) is reported as `floating`, to be judged by its outline or shadow instead.
 */
export function contrastReport(page, root = '#ui-root') {
  return page.evaluate((rootSel) => {
    const parse = (c) => {
      const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const root = document.querySelector(rootSel) || document.body;
    const out = [];
    for (const el of root.querySelectorAll('*')) {
      // inactive things are exempt (WCAG 1.4.3): disabled controls, runes that do not fit, sold goods, a fallen hero
      if (el.closest('svg') || el.closest('[disabled],[aria-disabled="true"],.vs-rune.bad,.vs-good.sold,.vs-hero.dead')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;                // nothing to see, or hidden for screen readers only
      // opacity of the element and everything above it
      let opacity = 1, layers = [], opaque = false, floating = true;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const s = getComputedStyle(n);
        opacity *= Number(s.opacity);
        if (opaque) continue;
        const bg = parse(s.backgroundColor);
        if (bg && bg.a > 0) { layers.push([bg]); floating = false; if (bg.a > 0.999) opaque = true; }
        if (s.backgroundImage && s.backgroundImage !== 'none') {
          const stops = [...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean);
          if (stops.length) { layers.push(stops); floating = false; if (stops.every((c) => c.a > 0.999)) opaque = true; }
        }
      }
      const fg0 = parse(cs.color); if (!fg0) continue;
      fg0.a *= opacity;
      // every combination of the stops, over each base
      let worst = Infinity;
      const bases = opaque ? [{ r: 0, g: 0, b: 0, a: 1 }] : [{ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }];
      const walk = (i, under) => {
        if (i < 0) { worst = Math.min(worst, ratio(over(fg0, under), under)); return; }
        for (const c of layers[i]) walk(i - 1, over(c, under));
      };
      for (const base of bases) walk(layers.length - 1, base);
      const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const large = px >= 24 || (px >= 18.66 && bold);
      const shadow = cs.textShadow !== 'none' || (cs.webkitTextStrokeWidth && parseFloat(cs.webkitTextStrokeWidth) > 0) || cs.paintOrder.startsWith('stroke');
      out.push({ text: own.slice(0, 40), cls: String(el.className).slice(0, 40), tag: el.tagName.toLowerCase(), ratio: Math.round(worst * 100) / 100, need: large ? 3 : 4.5, px, floating, shadow });
    }
    return out;
  }, root);
}
