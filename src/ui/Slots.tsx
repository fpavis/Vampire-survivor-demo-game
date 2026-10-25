import { useEffect, useState } from 'preact/hooks';
import { ui } from './bridge';
import { Icon } from './Icon';
import { deleteSlot, exportSave, formatPlayTime, importSave, listSlots, writeSlot, SLOT_IDS, slotLabel, type SlotInfo } from '../core/save/slots';
import { HERO_DEFS } from '../core/party/party';
import type { SaveData } from '../core/save/schema';

const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const heroLine = (d: SaveData) => d.party.heroes.map((h) => `${HERO_DEFS.find((x) => x.id === h.id)?.name ?? h.id} ${h.level}`).join(' · ');
const where = (d: SaveData) => d.meta?.place || d.meta?.region || '';

/** Start a save: from the title screen or in place of the running game. */
function startSave(data: SaveData) {
  const g = ui.game;
  ui.slotsOpen.value = null;
  if (g.titleBegin) g.titleBegin(data);
  else g.loadSave(data);
}

function SlotCard({ s, mode, refresh, busy }: { s: SlotInfo; mode: 'load' | 'save'; refresh: () => void; busy: (b: boolean) => void }) {
  const g = ui.game;
  const [confirm, setConfirm] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [showBackups, setShowBackups] = useState(false);
  const [exported, setExported] = useState('');
  const data = s.data && s.data !== 'corrupt' ? s.data : null;
  const ask = (what: string, run: () => void) => {
    if (confirm !== what) { setConfirm(what); setTimeout(() => setConfirm((c) => (c === what ? '' : c)), 3500); return; }
    setConfirm('');
    run();
  };
  const act = async (fn: () => Promise<unknown>) => { busy(true); try { await fn(); } catch (e) { g.ui.toast(e instanceof Error ? e.message : String(e), 'alert'); } busy(false); refresh(); };
  const saveHere = () => act(() => g.requestSave('manual', true, s.id));
  const rename = (name: string) => act(async () => { if (data) await writeSlot(g.store, s.id, { ...data, name: name.trim() || undefined }, false); setRenaming(null); });
  const copy = async () => {
    try { await navigator.clipboard.writeText(exported); g.ui.toast('Copied: keep it somewhere safe', 'check'); }
    catch { g.ui.toast('Select the text and copy it', 'alert'); }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exported], { type: 'text/plain' }));
    a.download = `survival-${s.id}-${new Date().toISOString().slice(0, 10)}.save`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div class={`vs-slot${data ? '' : ' empty'}`} data-slot-id={s.id}>
      <div class="vs-thumb">{data?.thumb ? <img src={data.thumb} alt="" /> : <Icon name={s.data === 'corrupt' ? 'alert' : data ? 'map' : 'save'} />}</div>
      <div class="vs-slotbody">
        <div class="t"><b>{s.label}{data?.name ? `: ${data.name}` : ''}</b>{data && <span class="when">{when(data.savedAt)}</span>}</div>
        {data && <div class="d">{heroLine(data)} · {formatPlayTime(data.playSeconds)}{where(data) ? ` · ${where(data)}` : ''}</div>}
        {!s.data && <div class="d">Empty</div>}
        {s.data === 'corrupt' && <div class="d bad">This save could not be read.{s.backups.length ? ' A backup can be loaded instead.' : ''}</div>}
        {renaming !== null && (
          <div class="vs-acts">
            <input class="vs-in" maxLength={28} value={renaming} placeholder="A name for this save" onInput={(e) => setRenaming((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') rename(renaming); }} />
            <button class="vs-btn" onClick={() => rename(renaming)}><Icon name="check" /> Save name</button>
          </div>
        )}
        <div class="vs-acts">
          {mode === 'load' && data && <button class="vs-btn" data-act="load" onClick={() => startSave(data)}><Icon name="play" /> Load</button>}
          {mode === 'save' && s.id !== 'autosave' && (
            <button class={`vs-btn${confirm === 'save' ? ' warn' : ''}`} data-act="save" onClick={() => (data ? ask('save', saveHere) : saveHere())}>
              <Icon name="save" /> {confirm === 'save' ? 'Overwrite? Press again' : 'Save here'}
            </button>
          )}
          {s.backups.length > 0 && <button class="vs-btn" onClick={() => setShowBackups(!showBackups)}><Icon name={showBackups ? 'chevron-down' : 'chevron-right'} /> Backups ({s.backups.length})</button>}
          {data && <button class="vs-btn" onClick={() => setRenaming(data.name || '')}>Rename</button>}
          {data && <button class="vs-btn" onClick={() => setExported(exported ? '' : exportSave(data))}>Export</button>}
          {s.data && <button class={`vs-btn${confirm === 'delete' ? ' warn' : ''}`} data-act="delete" onClick={() => ask('delete', () => act(() => deleteSlot(g.store, s.id)))}>
            {confirm === 'delete' ? 'Delete with its backups? Press again' : 'Delete'}</button>}
        </div>
        {showBackups && (
          <div class="vs-backups">
            {s.backups.map((b, i) => (
              <div key={b.key} class="vs-acts">
                <span class="d">Backup {i + 1} · {when(b.savedAt)}</span>
                <button class="vs-btn" data-act="backup" onClick={() => act(async () => { const d = await g.store.load(b.key); if (d) startSave(d); })}><Icon name="play" /> Load</button>
              </div>
            ))}
          </div>
        )}
        {exported && (
          <div class="vs-export">
            <textarea class="vs-in" readOnly rows={3} value={exported} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <div class="vs-acts">
              <button class="vs-btn" onClick={copy}>Copy</button>
              <button class="vs-btn" onClick={download}>Download file</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportBox({ refresh }: { refresh: () => void }) {
  const g = ui.game;
  const [text, setText] = useState('');
  const [slot, setSlot] = useState<string>('slot1');
  const [msg, setMsg] = useState('');
  const run = async (t: string) => {
    try {
      const data = importSave(t);
      await writeSlot(g.store, slot, data, true);
      setMsg(`Imported into ${slotLabel(slot)}.`);
      setText('');
      refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };
  const file = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) f.text().then((t) => { setText(t); run(t); });
  };
  return (
    <div class="vs-import">
      <div class="vs-sec">IMPORT A SAVED GAME</div>
      <textarea class="vs-in" rows={3} placeholder="Paste the text of an exported save here" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      <div class="vs-acts">
        <label class="vs-row"><span>Into</span>
          <select class="vs-in" value={slot} onChange={(e) => setSlot((e.target as HTMLSelectElement).value)}>
            {SLOT_IDS.map((id) => <option key={id} value={id}>{slotLabel(id)}</option>)}
          </select>
        </label>
        <button class="vs-btn" disabled={!text.trim()} onClick={() => run(text)}>Import</button>
        <label class="vs-btn vs-file">Choose a file…<input type="file" accept=".save,.txt,text/plain" onChange={file} /></label>
      </div>
      {msg && <div class="d">{msg}</div>}
    </div>
  );
}

/** Save and load: the autosave and three slots, each with backups, export and import. */
export function SlotsPanel() {
  const mode = ui.slotsOpen.value;
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(0);
  const refresh = () => setN((x) => x + 1);
  useEffect(() => {
    if (!mode || !ui.game) return;
    let live = true;
    ui.game.storeReady.then((store: any) => listSlots(store)).then((s: SlotInfo[]) => { if (live) setSlots(s); });
    return () => { live = false; };
  }, [mode, n]);
  if (!mode || !ui.game) return null;
  const close = () => (ui.slotsOpen.value = null);
  return (
    <div class={`vs-panel vs-slots hit${busy ? ' busy' : ''}`}>
      <button class="vs-btn vs-x" onClick={close} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name={mode === 'save' ? 'save' : 'journal'} /> {mode === 'save' ? 'Save game' : 'Load game'}</h2>
      <div class="sub">{mode === 'save'
        ? 'The game also saves itself to the autosave. Each slot keeps its last three versions as backups.'
        : 'Each slot keeps its last three versions as backups. Export a save to keep a copy outside the browser.'}</div>
      {!slots ? <div class="vs-empty">Reading saves…</div> : slots.map((s) => <SlotCard key={s.id + n} s={s} mode={mode} refresh={refresh} busy={setBusy} />)}
      {mode === 'load' && slots && <ImportBox refresh={refresh} />}
    </div>
  );
}
