// Mixer, sound effects and music, all synthesized with Web Audio (no files).
// master ─┬─ music bus   ← track gains (crossfaded) ← scheduled notes   (ducked under stingers and dialogue)
//         ├─ sfx bus     ← effect voices (panned and attenuated by distance)
//         ├─ ambient bus ← the bed of sound for where you are (crossfaded) and its occasional calls
//         └─ ui bus      ← interface clicks
import { SFX, sfxLength, spatial, voiceLayers, type Layer } from '../core/audio/sfx';
import { TRACKS, barNotes, midiToHz, secondsPerBar, type NoteEvent, type TrackDef } from '../core/audio/music';
import { BEDS, type BedEvent, type BedId } from '../core/audio/ambience';

export type BusName = 'master' | 'music' | 'sfx' | 'ambient' | 'ui';
const PREFS_KEY = 'vs.audio.v1';
const MAX_VOICES = 28;
const DEFAULT_VOL: Record<BusName, number> = { master: 0.8, music: 0.5, sfx: 0.8, ambient: 0.6, ui: 0.7 };
const CHILD_BUSES: BusName[] = ['music', 'sfx', 'ambient', 'ui'];
/** Music level while a stinger plays or a conversation is open. */
const DUCK = 0.35;

export interface PlayOpts { x?: number; y?: number; pitch?: number; vol?: number }

export class AudioManager {
  ctx: AudioContext | null = null;
  private buses: Partial<Record<BusName, GainNode>> = {};
  private noise: AudioBuffer | null = null;
  private longNoise: AudioBuffer | null = null;
  private duckUntil = 0;
  private duckHold = false;
  /** True while the music is ducked (for tests and the debug overlay). */
  ducked = false;
  private last: Record<string, number> = {};
  private active: Record<string, number> = {};
  private voices = 0;
  private seq = 0;
  volumes: Record<BusName, number> = { ...DEFAULT_VOL };
  muted = false;
  listener = { x: 0, y: 0 };
  music = new MusicPlayer(this);
  ambience = new AmbiencePlayer(this);
  played: Record<string, number> = {};          // counts per sound, for tests and the debug overlay

  constructor() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (p) { this.muted = !!p.muted; for (const k of Object.keys(DEFAULT_VOL) as BusName[]) if (typeof p[k] === 'number') this.volumes[k] = Math.max(0, Math.min(1, p[k])); }
      else this.muted = localStorage.getItem('vs-muted') === '1';
    } catch { /* storage unavailable */ }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume();
      });
    }
  }

  /** Browsers only allow audio after a user gesture, so call this from input handlers. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    this.buses.master = master;
    for (const b of CHILD_BUSES) { const g = ctx.createGain(); g.connect(master); this.buses[b] = g; }
    // white noise: one second shared by every noise layer and drum, five seconds for the ambient beds (no audible loop)
    const fill = (sec: number) => {
      const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * sec), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    };
    this.noise = fill(1);
    this.longNoise = fill(5);
    this.applyVolumes();
    this.music.start();
    this.ambience.start();
  }

  bus(name: BusName): GainNode | null { return this.buses[name] ?? null; }
  noiseBuffer(long = false) { return long ? this.longNoise : this.noise; }

  private applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.buses.master!.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, now, 0.05);
    for (const b of CHILD_BUSES) if (b !== 'music') this.buses[b]!.gain.setTargetAtTime(this.volumes[b], now, 0.05);
    this.applyMusic();
  }

  /** The music bus at its level, or ducked while a stinger plays or a conversation is open. */
  private applyMusic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.ducked = this.duckHold || now < this.duckUntil - 0.02;
    this.buses.music!.gain.setTargetAtTime(this.volumes.music * (this.ducked ? DUCK : 1), now, this.ducked ? 0.08 : 0.45);
  }

  /** Lower the music for `sec` seconds. */
  duck(sec: number) {
    if (!this.ctx) return;
    this.duckUntil = Math.max(this.duckUntil, this.ctx.currentTime + sec);
    this.applyMusic();
    setTimeout(() => this.applyMusic(), sec * 1000 + 40);
  }

  /** Keep the music lowered while something needs listening to (a conversation). */
  setDuckHold(on: boolean) {
    if (this.duckHold === on) return;
    this.duckHold = on;
    this.applyMusic();
  }

  /** A short musical phrase (discovery, boss, victory) with the music ducked under it. */
  stinger(name: string) {
    const def = SFX[name];
    if (!def || !this.ctx || this.ctx.state !== 'running' || this.muted) return;
    this.play(name);
    this.duck(sfxLength(def) + 0.5);
  }

  private savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...this.volumes, muted: this.muted })); } catch { /* ignore */ }
  }

  setMuted(m: boolean) { this.muted = m; this.applyVolumes(); this.savePrefs(); }
  setVolume(bus: BusName, v: number) { this.volumes[bus] = Math.max(0, Math.min(1, v)); this.applyVolumes(); this.savePrefs(); }

  /** Play a named effect. With `x, y` (world position) it is panned and fades with distance from the camera. */
  play(name: string, opts: PlayOpts = {}) {
    const ctx = this.ctx, def = SFX[name];
    if (!ctx || !def || ctx.state !== 'running' || this.muted) return;
    const now = ctx.currentTime;
    if (now - (this.last[name] ?? -1) < (def.gap ?? 0.05)) return;
    if ((this.active[name] ?? 0) >= (def.max ?? 4) || this.voices >= MAX_VOICES) return;
    let pan = 0, gain = opts.vol ?? 1;
    if (opts.x !== undefined && opts.y !== undefined) {
      const s = spatial(opts.x - this.listener.x, opts.y - this.listener.y);
      if (!s) return;
      pan = s.pan; gain *= s.gain;
    }
    this.last[name] = now;
    this.played[name] = (this.played[name] ?? 0) + 1;
    const out = ctx.createGain();
    out.gain.value = gain;
    let dest: AudioNode = out;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(this.buses[def.bus ?? 'sfx']!); }
    else out.connect(this.buses[def.bus ?? 'sfx']!);
    const r = ((this.seq = (this.seq * 1103515245 + 12345) >>> 0) % 1000) / 1000;
    for (const l of voiceLayers(def, r, opts.pitch ?? 1)) this.layer(l, now, dest);
    const len = sfxLength(def);
    this.active[name] = (this.active[name] ?? 0) + 1;
    this.voices++;
    setTimeout(() => { this.active[name]--; this.voices--; out.disconnect(); }, (len + 0.08) * 1000);
  }

  private layer(l: Layer, now: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const t0 = now + (l.at ?? 0), t1 = t0 + l.t;
    const g = ctx.createGain();
    const peak = Math.max(0.0002, l.vol ?? 0.1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + Math.min(l.t * 0.5, l.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    g.connect(dest);
    if (l.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = l.hp ? 'highpass' : 'bandpass';
      f.Q.value = l.q ?? 1;
      f.frequency.setValueAtTime(l.f, t0);
      if (l.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, l.f2), t1);
      src.connect(f).connect(g);
      src.start(t0, Math.random() * 0.5);
      src.stop(t1 + 0.02);
    } else {
      const o = ctx.createOscillator();
      o.type = l.wave;
      o.frequency.setValueAtTime(l.f, t0);
      if (l.f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, l.f2), t1);
      o.connect(g);
      o.start(t0);
      o.stop(t1 + 0.02);
    }
  }

  /** Snapshot for tests and the debug overlay. */
  stats() {
    return {
      state: this.ctx?.state ?? 'none', voices: this.voices, track: this.music.trackId, dark: this.music.dark,
      intensity: this.music.intensity, bars: this.music.barsPlayed, volumes: { ...this.volumes }, muted: this.muted,
      bed: this.ambience.bedId, calls: this.ambience.calls, ducked: this.ducked
    };
  }
}

/** Schedules procedural tracks a little ahead of time and crossfades between them. */
export class MusicPlayer {
  trackId: string | null = null;
  dark = false;
  intensity = 0;
  barsPlayed = 0;
  private want: { id: string; dark: boolean } | null = null;
  private cur: { track: TrackDef; gain: GainNode; bar: number; next: number; dark: boolean } | null = null;
  private timer: any = null;

  constructor(private mgr: AudioManager) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 60);
    if (this.want) this.switchTo(this.want.id, this.want.dark);
  }

  /** Ask for a track; the switch crossfades over two seconds. */
  setTrack(id: string, dark = false) {
    this.want = { id, dark };
    if (!this.mgr.ctx) return;
    if (this.cur && this.cur.track.id === id && this.cur.dark === dark) return;
    this.switchTo(id, dark);
  }

  setIntensity(v: number) { this.intensity = Math.max(0, Math.min(1, v)); }

  private switchTo(id: string, dark: boolean) {
    const ctx = this.mgr.ctx!, bus = this.mgr.bus('music');
    const track = TRACKS[id];
    if (!track || !bus) return;
    const now = ctx.currentTime;
    if (this.cur) {
      const old = this.cur.gain;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0.0001, now + 2);
      setTimeout(() => old.disconnect(), 2600);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(1, now + 2);
    gain.connect(bus);
    this.cur = { track, gain, bar: 0, next: now + 0.1, dark };
    this.trackId = id;
    this.dark = dark;
  }

  private tick() {
    const ctx = this.mgr.ctx, c = this.cur;
    if (!ctx || !c || ctx.state !== 'running') return;
    while (c.next < ctx.currentTime + 0.3) {
      const spb = secondsPerBar(c.track, c.dark) / 4;
      for (const n of barNotes(c.track, c.bar, { intensity: this.intensity, dark: c.dark })) this.note(n, c.next + n.beat * spb, n.len * spb, c.track, c.gain);
      c.next += spb * 4;
      c.bar++;
      this.barsPlayed++;
    }
  }

  private note(n: NoteEvent, t0: number, len: number, track: TrackDef, dest: AudioNode) {
    const ctx = this.mgr.ctx!;
    const g = ctx.createGain();
    g.connect(dest);
    const extra: AudioNode[] = [];
    const env = (attack: number, release: number, sustain = 1) => {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(n.vol, t0 + attack);
      if (sustain < 1) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, n.vol * sustain), t0 + Math.max(attack + 0.01, len));
      g.gain.setValueAtTime(Math.max(0.0001, n.vol * sustain), t0 + Math.max(attack + 0.01, len));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + release);
      return t0 + len + release + 0.05;
    };
    const osc = (type: OscillatorType, hz: number, end: number, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = hz; o.detune.value = detune;
      o.connect(g); o.start(t0); o.stop(end);
      return o;
    };
    const noise = (type: BiquadFilterType, hz: number, end: number) => {
      const src = ctx.createBufferSource(); src.buffer = this.mgr.noiseBuffer(); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz;
      src.connect(f).connect(g); src.start(t0, Math.random() * 0.5); src.stop(end);
    };
    const hz = midiToHz(n.midi);
    switch (n.voice) {
      case 'pad': {
        const end = env(0.35, 0.6, 0.8);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
        g.disconnect(); g.connect(lp); lp.connect(dest);
        extra.push(lp);
        osc(track.pad.wave, hz, end, -7); osc(track.pad.wave, hz, end, 7);
        break;
      }
      case 'bass': osc(track.bass.wave, hz, env(0.01, 0.08, 0.6)); break;
      case 'lead': osc(track.lead.wave, hz, env(0.015, 0.12, 0.7)); break;
      case 'arp': osc(track.arp?.wave ?? 'triangle', hz, env(0.004, 0.06, 0.25)); break;
      case 'bell': { const end = env(0.004, 1.2, 0.3); osc('sine', hz, end); osc('sine', hz * 2.76, end); break; }
      case 'kick': {
        g.gain.setValueAtTime(n.vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        const o = osc('sine', 120, t0 + 0.25); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.2);
        break;
      }
      case 'snare': g.gain.setValueAtTime(n.vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16); noise('bandpass', 1800, t0 + 0.18); break;
      case 'hat': g.gain.setValueAtTime(n.vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05); noise('highpass', 7000, t0 + 0.06); break;
    }
    setTimeout(() => { g.disconnect(); extra.forEach((x) => x.disconnect()); }, (t0 - ctx.currentTime + len + 2) * 1000);
  }
}

/** The ambient bed for where the hero is: looping bands of filtered noise (wind, waves, rustle) that swell slowly,
 *  and calls now and then (birds, gulls, an owl, drips). Crossfades when the place changes. */
export class AmbiencePlayer {
  bedId: BedId | null = null;
  /** Calls played so far (for tests). */
  calls = 0;
  private want: BedId | null = null;
  private cur: { id: BedId; gain: GainNode; nodes: AudioScheduledSourceNode[]; next: number[] } | null = null;
  private timer: any = null;

  constructor(private mgr: AudioManager) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 200);
    if (this.want) this.switchTo(this.want);
  }

  setBed(id: BedId) {
    this.want = id;
    if (!this.mgr.ctx) return;
    if (this.cur && this.cur.id === id) return;
    this.switchTo(id);
  }

  private switchTo(id: BedId) {
    const ctx = this.mgr.ctx!, bus = this.mgr.bus('ambient');
    if (!bus) return;
    const now = ctx.currentTime;
    if (this.cur) {
      const old = this.cur;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0.0001, now + 2.5);
      setTimeout(() => { for (const n of old.nodes) { try { n.stop(); } catch { /* already stopped */ } } old.gain.disconnect(); }, 2800);
    }
    const def = BEDS[id];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(1, now + 2.5);
    gain.connect(bus);
    const nodes: AudioScheduledSourceNode[] = [];
    for (const b of def.bands) {
      const src = ctx.createBufferSource();
      src.buffer = this.mgr.noiseBuffer(true);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = b.type; f.frequency.value = b.f; f.Q.value = b.q;
      const g = ctx.createGain();
      g.gain.value = b.vol;
      src.connect(f).connect(g).connect(gain);
      if (b.swell) {
        // a slow sine moves the loudness between (1 - depth) and 1 of the band's level: gusts, waves
        g.gain.value = b.vol * (1 - b.swell.depth / 2);
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = b.swell.rate;
        depth.gain.value = (b.vol * b.swell.depth) / 2;
        lfo.connect(depth).connect(g.gain);
        lfo.start(now);
        nodes.push(lfo);
      }
      src.start(now, Math.random() * 4);
      nodes.push(src);
    }
    const r = (e: BedEvent) => e.every[0] + Math.random() * (e.every[1] - e.every[0]);
    this.cur = { id, gain, nodes, next: def.events.map((e) => now + r(e)) };
    this.bedId = id;
  }

  private tick() {
    const ctx = this.mgr.ctx, c = this.cur;
    if (!ctx || !c || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    BEDS[c.id].events.forEach((e, i) => {
      if (now < c.next[i]) return;
      c.next[i] = now + e.every[0] + Math.random() * (e.every[1] - e.every[0]);
      this.call(e, c.gain, now);
    });
  }

  private call(e: BedEvent, dest: AudioNode, now: number) {
    const ctx = this.mgr.ctx!;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out: AudioNode = pan ?? dest;
    if (pan) { pan.pan.value = Math.random() * 1.4 - 0.7; pan.connect(dest); }
    const k = 0.9 + Math.random() * 0.2;
    for (let n = 0; n < e.notes; n++) {
      const t0 = now + n * e.gap, t1 = t0 + e.t;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = e.wave;
      o.frequency.setValueAtTime(e.f * k, t0);
      o.frequency.exponentialRampToValueAtTime(e.f2 * k, t1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(e.vol, t0 + Math.min(0.02, e.t / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t1);
      o.connect(g).connect(out);
      o.start(t0); o.stop(t1 + 0.02);
    }
    this.calls++;
    setTimeout(() => pan?.disconnect(), (e.notes * e.gap + e.t + 0.3) * 1000);
  }
}
