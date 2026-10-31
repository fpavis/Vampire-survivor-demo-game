import { useState } from 'preact/hooks';
import { ui } from './bridge';
import { KEY_ACTIONS, type KeyAction } from '../core/input/bindings';
import { PAD_ACTION_LABEL, PAD_REBINDABLE, buttonLabel, type PadAction } from '../core/input/gamepad';
import { Icon } from './Icon';

/** Lists every action with its key and controller button; pick one, then press the new key or button. */
export function RebindPanel() {
  const [waiting, setWaiting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  ui.bindVersion.value;
  if (!ui.rebindOpen.value || !ui.game) return null;
  const input = ui.game.input;
  const close = () => { input.cancelCapture(); setWaiting(null); ui.rebindOpen.value = false; };
  const askKey = (a: KeyAction) => {
    setWaiting(`k:${a}`); setNote('');
    input.captureKey((key: string) => {
      setWaiting(null);
      if (key === 'escape') return;
      if (!input.keys.assign(a, key)) { setNote('That key is kept for menus, cards and heroes (Esc, Enter, 1–3, F, L).'); return; }
      input.savePrefs();
    });
  };
  const askPad = (a: PadAction) => {
    setWaiting(`p:${a}`); setNote('');
    input.capturePad((btn: number) => {
      setWaiting(null);
      if (!input.rebindPad(a, btn)) setNote('The d-pad and the sticks stay as they are: they move through menus.');
    });
  };
  const kind = ui.padKind.value;
  const b = input.mapper.bindings;
  return (
    <div class="vs-panel vs-rebind hit" role="dialog" aria-label="Keys and buttons">
      <button class="vs-btn vs-x" onClick={close} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="keyboard" /> Keys and buttons</h2>
      <div class="sub">Choose an action, then press the new key or controller button. Taking a key that is already used swaps the two.</div>
      {note && <div class="vs-lock">{note}</div>}
      <div class="vs-sec">KEYBOARD</div>
      <div class="vs-binds">
        {KEY_ACTIONS.map(({ id, label }) => (
          <div key={id} class="vs-bind">
            <span>{label}</span>
            <button class={`vs-btn${waiting === `k:${id}` ? ' wait' : ''}`} data-bind={`key:${id}`} onClick={() => askKey(id)}>
              {waiting === `k:${id}` ? 'Press a key…' : input.keys.label(id)}
            </button>
          </div>
        ))}
      </div>
      <div class="vs-sec">CONTROLLER{ui.padName.value ? ` — ${ui.padName.value}` : ''}</div>
      <div class="vs-binds">
        {PAD_REBINDABLE.map((id) => (
          <div key={id} class="vs-bind">
            <span>{PAD_ACTION_LABEL[id]}</span>
            <button class={`vs-btn${waiting === `p:${id}` ? ' wait' : ''}`} data-bind={`pad:${id}`} onClick={() => askPad(id)}>
              {waiting === `p:${id}` ? 'Press a button…' : buttonLabel(kind, b[id][0])}
            </button>
          </div>
        ))}
      </div>
      <div class="vs-acts">
        <button class="vs-btn" onClick={() => { input.resetBindings(); setNote('Back to the default keys and buttons.'); }}><Icon name="reset" /> Reset to defaults</button>
        <button class="vs-btn" onClick={close}>Done</button>
      </div>
    </div>
  );
}
