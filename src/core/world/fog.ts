import { WORLD_CONFIG } from '../config';

const CT = WORLD_CONFIG.chunkTiles;
const BYTES = Math.ceil((CT * CT) / 8);

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Per-tile "has the player seen this" bitmask, stored per chunk (18 bytes per chunk).
// It is part of the save file and feeds the minimap and the world map.
export class FogOfWar {
  private chunks = new Map<string, Uint8Array>();
  /** chunks whose bits changed since the map last synchronised */
  readonly dirty = new Set<string>();
  version = 0;

  static key(cx: number, cy: number): string { return `${cx},${cy}`; }

  isRevealed(tx: number, ty: number): boolean {
    const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
    const bits = this.chunks.get(FogOfWar.key(cx, cy));
    if (!bits) return false;
    const i = (ty - cy * CT) * CT + (tx - cx * CT);
    return (bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  /** Reveal one tile. Returns true when it was not revealed before. */
  reveal(tx: number, ty: number): boolean {
    const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
    const key = FogOfWar.key(cx, cy);
    let bits = this.chunks.get(key);
    if (!bits) { bits = new Uint8Array(BYTES); this.chunks.set(key, bits); }
    const i = (ty - cy * CT) * CT + (tx - cx * CT);
    const mask = 1 << (i & 7);
    if (bits[i >> 3] & mask) return false;
    bits[i >> 3] |= mask;
    this.dirty.add(key);
    this.version++;
    return true;
  }

  /** Reveal a disc of tiles. Returns how many tiles were newly revealed. */
  revealCircle(cxTile: number, cyTile: number, radius: number): number {
    let added = 0;
    const r = Math.ceil(radius), r2 = radius * radius;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r2) continue;
        if (this.reveal(cxTile + x, cyTile + y)) added++;
      }
    }
    return added;
  }

  chunkKeys(): string[] { return [...this.chunks.keys()]; }

  revealedTileCount(): number {
    let n = 0;
    for (const bits of this.chunks.values()) for (let i = 0; i < bits.length; i++) { let b = bits[i]; while (b) { n += b & 1; b >>= 1; } }
    return n;
  }

  clear(): void { this.chunks.clear(); this.dirty.clear(); this.version++; }

  markAllDirty(): void { for (const k of this.chunks.keys()) this.dirty.add(k); }

  toJSON(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, bits] of this.chunks) out[k] = toBase64(bits);
    return out;
  }

  static fromJSON(data: Record<string, string> | undefined): FogOfWar {
    const fog = new FogOfWar();
    if (!data) return fog;
    for (const [k, b64] of Object.entries(data)) {
      let bytes: Uint8Array;
      try { bytes = fromBase64(b64); } catch { continue; }
      if (bytes.length !== BYTES) continue; // ignore corrupt chunks rather than crash
      fog.chunks.set(k, bytes);
      fog.dirty.add(k);
    }
    fog.version++;
    return fog;
  }
}
