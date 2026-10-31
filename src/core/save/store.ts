import { decodeSave, encodeSave, fromBase64, toBase64 } from './codec';
import { summarize, type SaveData, type SaveSummary } from './schema';

export interface SaveStore {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory';
  /** false when progress will be lost on reload (memory fallback) */
  readonly persistent: boolean;
  list(): Promise<SaveSummary[]>;
  load(slot: string): Promise<SaveData | null>;
  save(slot: string, data: SaveData): Promise<void>;
  remove(slot: string): Promise<void>;
}

export class MemoryStore implements SaveStore {
  readonly kind = 'memory' as const;
  readonly persistent = false;
  private slots = new Map<string, Uint8Array>();

  async list(): Promise<SaveSummary[]> {
    const out: SaveSummary[] = [];
    for (const [slot, bytes] of this.slots) { try { out.push(summarize(slot, decodeSave(bytes))); } catch { /* skip corrupt */ } }
    return out;
  }
  async load(slot: string): Promise<SaveData | null> {
    const b = this.slots.get(slot);
    return b ? decodeSave(b) : null;
  }
  async save(slot: string, data: SaveData): Promise<void> { this.slots.set(slot, encodeSave(data)); }
  async remove(slot: string): Promise<void> { this.slots.delete(slot); }
}

const DB_NAME = 'survival-game';
const STORE = 'saves';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbStore implements SaveStore {
  readonly kind = 'indexeddb' as const;
  readonly persistent = true;
  private constructor(private db: IDBDatabase) {}

  static async open(): Promise<IndexedDbStore> { return new IndexedDbStore(await openDb()); }

  async list(): Promise<SaveSummary[]> {
    const keys = (await tx(this.db, 'readonly', (s) => s.getAllKeys())) as string[];
    const out: SaveSummary[] = [];
    for (const k of keys) {
      try { const d = await this.load(String(k)); if (d) out.push(summarize(String(k), d)); } catch { /* skip corrupt */ }
    }
    return out;
  }
  async load(slot: string): Promise<SaveData | null> {
    const bytes = (await tx(this.db, 'readonly', (s) => s.get(slot))) as Uint8Array | undefined;
    return bytes ? decodeSave(bytes) : null;
  }
  async save(slot: string, data: SaveData): Promise<void> { await tx(this.db, 'readwrite', (s) => s.put(encodeSave(data), slot)); }
  async remove(slot: string): Promise<void> { await tx(this.db, 'readwrite', (s) => s.delete(slot)); }
}

const LS_PREFIX = 'survival-game:save:';

export class LocalStorageStore implements SaveStore {
  readonly kind = 'localstorage' as const;
  readonly persistent = true;

  async list(): Promise<SaveSummary[]> {
    const out: SaveSummary[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LS_PREFIX)) continue;
      const slot = key.slice(LS_PREFIX.length);
      try { const d = await this.load(slot); if (d) out.push(summarize(slot, d)); } catch { /* skip corrupt */ }
    }
    return out;
  }
  async load(slot: string): Promise<SaveData | null> {
    const raw = localStorage.getItem(LS_PREFIX + slot);
    return raw ? decodeSave(fromBase64(raw)) : null;
  }
  async save(slot: string, data: SaveData): Promise<void> { localStorage.setItem(LS_PREFIX + slot, toBase64(encodeSave(data))); }
  async remove(slot: string): Promise<void> { localStorage.removeItem(LS_PREFIX + slot); }
}

/** Best available store: IndexedDB, then localStorage, then in-memory (progress lost on reload). */
export async function createSaveStore(): Promise<SaveStore> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const store = await IndexedDbStore.open();
      await store.list(); // proves the database is usable (some sandboxes throw lazily)
      return store;
    }
  } catch { /* fall through */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_PREFIX + '__probe', '1');
      localStorage.removeItem(LS_PREFIX + '__probe');
      return new LocalStorageStore();
    }
  } catch { /* fall through */ }
  return new MemoryStore();
}
