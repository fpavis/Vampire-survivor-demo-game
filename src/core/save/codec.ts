import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { migrate } from './migrations';
import type { SaveData } from './schema';

export function encodeSave(data: SaveData): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(data)), { level: 6 });
}

export function decodeSave(bytes: Uint8Array): SaveData {
  let json: string;
  try { json = strFromU8(gunzipSync(bytes)); } catch { json = strFromU8(bytes); } // allow plain JSON too
  return migrate(JSON.parse(json));
}

// Export / import as a text file players can keep.
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64.trim());
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
