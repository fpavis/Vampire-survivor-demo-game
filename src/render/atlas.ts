// @ts-nocheck -- Pixi display objects are walked and patched in place
// Bakes static vector art into a shared texture atlas. Monsters, gems, bolts and blades are drawn with
// PIXI.Graphics (many vertices, one draw call each); after baking, each Graphics keeps its transform (so the
// animations that rotate wings or swing legs still work) but draws a sprite cut from the atlas instead, and
// thousands of sprites share a few textures, so they batch into a handful of draw calls.
// Additive parts (glows, sparks) are stored with zero alpha: under the normal premultiplied blend a texel with
// colour and no alpha adds its colour, so they batch with everything else instead of switching blend modes.
import * as PIXI from 'pixi.js';

// Graphics up to this many points go through the batcher instead of a draw call of their own (Pixi's default is 100).
PIXI.GraphicsGeometry.BATCHABLE_SIZE = 1000;

const PAGE = 1024;          // logical size of an atlas page
const RES = 2;              // texels per logical pixel (sharp at the zooms we use)
const PAD = 2;

export class PartAtlas {
  private pages: PIXI.RenderTexture[] = [];
  private x = PAD; private y = PAD; private row = 0;
  private frames = new Map<string, { texture: PIXI.Texture; ox: number; oy: number; add: boolean } | null>();
  private m = new PIXI.Matrix();

  constructor(private renderer: PIXI.Renderer) {}

  get pageCount() { return this.pages.length; }
  get partCount() { return this.frames.size; }

  /** The atlas frame for a Graphics drawn under `key` (rendered on first use, without its transform). */
  frame(key: string, g: PIXI.Graphics) {
    if (this.frames.has(key)) return this.frames.get(key);
    // draw the geometry alone: no position, rotation, scale, alpha or children of its own
    const saved = { x: g.x, y: g.y, r: g.rotation, sx: g.scale.x, sy: g.scale.y, px: g.pivot.x, py: g.pivot.y, a: g.alpha, v: g.visible, t: g.tint, kids: g.children.slice() };
    for (const k of saved.kids) g.removeChild(k);
    const restore = () => {
      g.position.set(saved.x, saved.y); g.rotation = saved.r; g.scale.set(saved.sx, saved.sy); g.pivot.set(saved.px, saved.py); g.alpha = saved.a; g.visible = saved.v; g.tint = saved.t;
      for (const k of saved.kids) g.addChild(k);
    };
    const lb = g.getLocalBounds().clone();
    const w = Math.ceil(lb.width) + 2, h = Math.ceil(lb.height) + 2;
    if (!isFinite(w) || !isFinite(h) || w <= 2 || h <= 2 || w > PAGE - PAD * 2 || h > PAGE - PAD * 2) { restore(); this.frames.set(key, null); return null; }
    if (this.pages.length && this.x + w + PAD > PAGE) { this.x = PAD; this.y += this.row + PAD; this.row = 0; }
    if (!this.pages.length || this.y + h + PAD > PAGE) {
      this.pages.push(PIXI.RenderTexture.create({ width: PAGE, height: PAGE, resolution: RES }));
      this.x = PAD; this.y = PAD; this.row = 0;
    }
    const page = this.pages[this.pages.length - 1];
    const x = this.x, y = this.y;
    g.position.set(0, 0); g.rotation = 0; g.scale.set(1, 1); g.pivot.set(0, 0); g.alpha = 1; g.visible = true; g.tint = 0xffffff;
    this.m.set(1, 0, 0, 1, x + 1 - lb.x, y + 1 - lb.y);
    const add = g.blendMode === PIXI.BLEND_MODES.ADD;
    const draw = () => this.renderer.render(g, { renderTexture: page, clear: false, transform: this.m });
    if (add) this.colourOnly(draw); else draw();
    restore();
    this.x += w + PAD;
    this.row = Math.max(this.row, h);
    const f = { texture: new PIXI.Texture(page.baseTexture, new PIXI.Rectangle(x, y, w, h)), ox: lb.x - 1, oy: lb.y - 1, add };
    this.frames.set(key, f);
    return f;
  }

  /** Run `draw` with additive blending that adds colour but leaves the target's alpha as it is (zero on a new page). */
  private colourOnly(draw: () => void) {
    const st = this.renderer.state as any, gl = this.renderer.gl, ADD = PIXI.BLEND_MODES.ADD;
    const was = st.blendModes[ADD];
    st.blendModes[ADD] = [gl.ONE, gl.ONE, gl.ZERO, gl.ONE];
    st.blendMode = -1;
    try { draw(); } finally { st.blendModes[ADD] = was; st.blendMode = -1; }
  }

  /**
   * Swap every static Graphics under `root` for an atlas sprite. `key` names the art (e.g. the monster type),
   * so identical art shares one frame; parts are told apart by their order in the tree.
   */
  bake(root: PIXI.Container, key: string) {
    let n = 0;
    const visit = (o: PIXI.DisplayObject) => {
      if (o instanceof PIXI.Graphics && !o.filters && o.geometry.graphicsData.length) {
        const f = this.frame(`${key}#${n++}`, o);
        if (f) {
          const s = new PIXI.Sprite(f.texture);
          s.position.set(f.ox, f.oy);
          s.blendMode = f.add ? PIXI.BLEND_MODES.NORMAL : o.blendMode;
          s.tint = o.tint;
          o.clear();
          o.addChildAt(s, 0);
          o.baked = s;
        }
      }
      if (o.children) for (const c of o.children.slice()) if (c !== o.baked) visit(c);
    };
    visit(root);
    return root;
  }
}
