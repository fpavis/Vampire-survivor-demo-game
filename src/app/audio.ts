// Tiny procedural sound-effect synth (no asset files). Music comes in a later phase.
type Blip = { f: number; f2?: number; t: number; type?: OscillatorType; vol?: number; noise?: boolean };

const SOUNDS: Record<string, Blip[]> = {
  dash: [{ f: 520, f2: 180, t: 0.14, type: 'sawtooth', vol: 0.12 }],
  blink: [{ f: 300, f2: 1100, t: 0.12, type: 'sine', vol: 0.14 }, { f: 1100, f2: 200, t: 0.1, type: 'triangle', vol: 0.08 }],
  barrier: [{ f: 220, f2: 440, t: 0.3, type: 'triangle', vol: 0.12 }],
  deny: [{ f: 160, f2: 110, t: 0.12, type: 'square', vol: 0.08 }],
  levelup: [{ f: 523, t: 0.1, type: 'triangle', vol: 0.12 }, { f: 659, t: 0.1, type: 'triangle', vol: 0.12 }, { f: 784, t: 0.18, type: 'triangle', vol: 0.12 }],
  pickup: [{ f: 880, f2: 1320, t: 0.08, type: 'sine', vol: 0.08 }],
  loot: [{ f: 660, t: 0.08, type: 'triangle', vol: 0.12 }, { f: 990, t: 0.08, type: 'triangle', vol: 0.12 }, { f: 1320, t: 0.2, type: 'sine', vol: 0.1 }],
  hurt: [{ f: 140, f2: 70, t: 0.16, type: 'sawtooth', vol: 0.12 }],
  equip: [{ f: 440, f2: 660, t: 0.07, type: 'square', vol: 0.06 }]
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private last: Record<string, number> = {};
  volume = 0.6;
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem('vs-muted') === '1'; } catch { /* storage unavailable */ }
  }

  /** Browsers only allow audio after a user gesture, so call this from input handlers. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AC) this.ctx = new AC();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem('vs-muted', m ? '1' : '0'); } catch { /* ignore */ }
  }

  play(name: string) {
    const ctx = this.ctx;
    const blips = SOUNDS[name];
    if (!ctx || !blips || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.last[name] ?? -1) < 0.05) return;
    this.last[name] = now;
    let at = now;
    for (const b of blips) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = b.type ?? 'sine';
      o.frequency.setValueAtTime(b.f, at);
      if (b.f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, b.f2), at + b.t);
      const v = (b.vol ?? 0.1) * this.volume;
      g.gain.setValueAtTime(v, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + b.t);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + b.t + 0.02);
      at += b.t * 0.9;
    }
  }
}
