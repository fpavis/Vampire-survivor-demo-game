// The crash screen and the storage warning: what the player sees when something has gone wrong, in plain words,
// with a way to keep their progress (the last good save is never written over after a crash).
import { useEffect, useRef, useState } from 'preact/hooks';
import { ui } from './bridge';
import { Icon } from './Icon';
import { exportSave } from '../core/save/slots';
import { buildSave } from '../app/saveManager';
import { dismissCrash } from '../app/crash';

/** Copy text, or say to select it by hand when the browser will not let the page write to the clipboard. */
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function CrashScreen() {
  const c = ui.crash.value;
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('');
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setCopied(''); setOpen(false); if (c) first.current?.focus(); }, [c]);
  if (!c) return null;
  const copy = async () => {
    const ok = await copyText(c.report);
    setCopied(ok ? 'yes' : 'no');
    if (!ok) { setOpen(true); setTimeout(() => area.current?.select(), 0); }
  };
  return (
    <div class="vs-crash" role="alertdialog" aria-modal="true" aria-labelledby="vs-crash-h">
      <div class="vs-panel box hit">
        <h2 id="vs-crash-h"><Icon name="warning" /> Something went wrong</h2>
        <p>{c.fatal
          ? 'The game ran into an error it cannot get past, and has stopped. Your last save is safe: nothing has been saved since.'
          : 'Something failed in the background. You can keep playing; if anything looks wrong, reload. Your last save is safe.'}</p>
        <p class="msg"><code>{c.message}</code></p>
        <p class="sub">Sending the error report helps find the cause.</p>
        <div class="vs-acts">
          <button ref={first} class="vs-btn" data-act="crash-copy" onClick={copy}><Icon name="scroll" /> {copied === 'yes' ? 'Copied' : 'Copy the error report'}</button>
          <button class="vs-btn" data-act="crash-reload" onClick={() => location.reload()}><Icon name="reset" /> Reload</button>
          {!c.fatal && <button class="vs-btn" data-act="crash-keep" onClick={() => dismissCrash(ui.game)}>Keep playing</button>}
        </div>
        {copied === 'no' && <p class="sub">This browser would not copy it: select the report below and copy it.</p>}
        <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary>The report</summary>
          <textarea ref={area} class="vs-in" readOnly rows={8} value={c.report} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
        </details>
      </div>
    </div>
  );
}

/** Saving is not possible right now: say why, and offer the progress as text to keep. */
export function StorageBanner() {
  const why = ui.storageWarn.value;
  const g = ui.game;
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  if (!why || !g || ui.crash.value) return null;
  const playing = !!g.state?.player;
  const exportNow = () => { setText(exportSave(buildSave(g))); setCopied(false); };
  const copy = async () => setCopied(await copyText(text));
  return (
    <div class="vs-storage hit" role="status">
      <Icon name="warning" />
      <span>{why === 'memory'
        ? 'This browser is not letting the game save (storage is blocked, as in some private windows). Progress lasts until the page is closed.'
        : 'Saving failed twice: the browser’s storage may be full or blocked.'}{playing ? ' Export your progress to keep it.' : ''}</span>
      <span class="vs-acts">
        {playing && <button class="vs-btn" data-act="storage-export" onClick={exportNow}>Export progress</button>}
        <button class="vs-btn" data-act="storage-dismiss" onClick={() => { g.storageDismissed = true; ui.storageWarn.value = null; }}>Dismiss</button>
      </span>
      {text && (
        <span class="vs-export">
          <textarea class="vs-in" readOnly rows={2} value={text} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          <button class="vs-btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </span>
      )}
    </div>
  );
}
