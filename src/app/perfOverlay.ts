// A small frame-rate readout (F3 or the video settings): frames per second, simulation time per frame and draw calls,
// and the last key pressed with the state of the menu and the window (to see where a key went when it did nothing).
// Draw calls are counted by wrapping the WebGL draw functions only while the overlay is shown.
import { ui } from '../ui/bridge';

export class PerfOverlay {
  shown = false;
  private el: HTMLDivElement | null = null;
  private steps: number[] = [];
  private draws = 0;
  private frames = 0;
  private last = performance.now();
  private unwrap: (() => void) | null = null;
  private lastKey = 'none';

  constructor(private game: any) {
    window.addEventListener('keydown', (e) => {
      this.lastKey = `${e.key}${e.isTrusted ? '' : ' (script)'}`;
      if (e.key === 'F3') { e.preventDefault(); this.toggle(); }
    }, true);
  }

  toggle(on = !this.shown) {
    this.shown = on;
    if (on) {
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.className = 'vs-perf';
        document.getElementById('ui-root')?.appendChild(this.el);
      }
      this.el.style.display = 'block';
      const gl = this.game.app.renderer.gl;
      const de = gl.drawElements, da = gl.drawArrays;
      gl.drawElements = (...a: any[]) => { this.draws++; return de.apply(gl, a); };
      gl.drawArrays = (...a: any[]) => { this.draws++; return da.apply(gl, a); };
      this.unwrap = () => { gl.drawElements = de; gl.drawArrays = da; };
    } else {
      if (this.el) this.el.style.display = 'none';
      this.unwrap?.();
      this.unwrap = null;
    }
  }

  /** Called once per rendered frame with the time the simulation step took. */
  frame(stepMs: number) {
    if (!this.shown || !this.el) return;
    this.frames++;
    this.steps.push(stepMs);
    const now = performance.now();
    if (now - this.last < 500) return;
    const secs = (now - this.last) / 1000;
    const avg = this.steps.reduce((a, b) => a + b, 0) / this.steps.length;
    const g = this.game;
    this.el.textContent = `${Math.round(this.frames / secs)} fps · step ${avg.toFixed(1)} ms · ${Math.round(this.draws / this.frames)} draws · ${g.state.enemies.length} foes`
      + `\nkey ${this.lastKey} · menu ${ui.pauseOpen.value ? 'open' : 'closed'} · window ${document.hasFocus() ? 'focused' : 'not focused'}`;
    this.frames = 0; this.draws = 0; this.steps.length = 0; this.last = now;
  }
}
