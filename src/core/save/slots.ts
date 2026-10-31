// Save slots: the autosave plus three manual slots, each with up to three rolling backups, and a text form of a
// save that players can export and import. Works on any SaveStore.
import { decodeSave, encodeSave, fromBase64, toBase64 } from './codec';
import type { SaveData } from './schema';
import type { SaveStore } from './store';

export const SLOT_IDS = ['autosave', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export const BACKUPS = 3;
/** Autosaves refresh the backups at most this often; manual saves always do. */
export const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

export const backupKey = (slot: string, n: number) => `${slot}~bak${n}`;
export const slotLabel = (slot: string) => (slot === 'autosave' ? 'Autosave' : `Slot ${slot.replace('slot', '')}`);

export interface BackupInfo { key: string; savedAt: number }
export interface SlotInfo {
  id: SlotId;
  label: string;
  /** null: empty; 'corrupt': present but unreadable */
  data: SaveData | null | 'corrupt';
  backups: BackupInfo[];
}

/** Whether the backups should roll before this write. */
export const shouldRotate = (lastBackupAt: number | null, now: number, manual: boolean) =>
  manual || lastBackupAt === null || now - lastBackupAt >= BACKUP_INTERVAL_MS;

async function tryLoad(store: SaveStore, key: string): Promise<SaveData | null | 'corrupt'> {
  try { return await store.load(key); } catch { return 'corrupt'; }
}

/** Every slot with its save (or its state) and its readable backups. */
export async function listSlots(store: SaveStore): Promise<SlotInfo[]> {
  const out: SlotInfo[] = [];
  for (const id of SLOT_IDS) {
    const data = await tryLoad(store, id);
    const backups: BackupInfo[] = [];
    for (let n = 1; n <= BACKUPS; n++) {
      const b = await tryLoad(store, backupKey(id, n));
      if (b && b !== 'corrupt') backups.push({ key: backupKey(id, n), savedAt: b.savedAt });
    }
    out.push({ id, label: slotLabel(id), data, backups });
  }
  return out;
}

/** Shift the backups down one place and keep the slot's current save as the newest backup. */
export async function rotateBackups(store: SaveStore, slot: string): Promise<void> {
  const cur = await tryLoad(store, slot);
  if (!cur || cur === 'corrupt') return;          // never push a broken save into the backups
  for (let n = BACKUPS; n > 1; n--) {
    const prev = await tryLoad(store, backupKey(slot, n - 1));
    if (prev && prev !== 'corrupt') await store.save(backupKey(slot, n), prev);
  }
  await store.save(backupKey(slot, 1), cur);
}

/** Write a save, rolling the backups first when `rotate` says so. */
export async function writeSlot(store: SaveStore, slot: string, data: SaveData, rotate: boolean): Promise<void> {
  if (rotate) await rotateBackups(store, slot);
  await store.save(slot, data);
}

export async function deleteSlot(store: SaveStore, slot: string): Promise<void> {
  await store.remove(slot);
  for (let n = 1; n <= BACKUPS; n++) await store.remove(backupKey(slot, n));
}

/** The most recently written readable save, for Continue. */
export function newestSlot(slots: SlotInfo[]): SlotInfo | null {
  let best: SlotInfo | null = null;
  for (const s of slots) if (s.data && s.data !== 'corrupt' && (!best || s.data.savedAt > (best.data as SaveData).savedAt)) best = s;
  return best;
}

const EXPORT_PREFIX = 'SURVIVAL-SAVE:1:';

/** A save as one line of text (compressed, base64) that can be kept in a file or pasted back. */
export const exportSave = (data: SaveData) => EXPORT_PREFIX + toBase64(encodeSave(data));

/** Read an exported save (migrated and validated); throws with a readable message when the text is not one. */
export function importSave(text: string): SaveData {
  const t = text.replace(/\s+/g, '');
  if (!t.startsWith(EXPORT_PREFIX)) throw new Error('This is not a saved game from this game.');
  try { return decodeSave(fromBase64(t.slice(EXPORT_PREFIX.length))); }
  catch (e) { throw new Error(`The saved game could not be read: ${e instanceof Error ? e.message : String(e)}`); }
}

/** "3 h 12 min", "12 min", "under a minute" */
export function formatPlayTime(seconds: number): string {
  const m = Math.floor(seconds / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h} h ${m % 60} min`;
  return m > 0 ? `${m} min` : 'under a minute';
}
