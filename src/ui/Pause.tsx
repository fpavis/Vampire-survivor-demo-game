import { useState } from 'preact/hooks';
import { ui } from './bridge';
import { glyph, onPad, quickGlyph } from './hints';
import { padGlyph } from '../core/input/gamepad';

const kind = () => ui.padKind.value;

function Controls() {
  const pad = (a: Parameters<typeof padGlyph>[1]) => padGlyph(kind(), a);
  const rows: [string, string, string][] = [
    ['Move', 'W A S D', 'Left stick'],
    ['Aim dashes and blinks', 'Move direction / hold the mouse', 'Right stick'],
    ['Interact · confirm', 'E · Enter', pad('interact')],
    ['Skills (Dash …)', 'Space · Q · R', `${pad('skill1')} · ${pad('skill2')} · ${pad('skill3')}`],
    ['Switch hero', '1 2 3 · Tab', `${pad('prevHero')} · ${pad('nextHero')}`],
    ['Spells and runes', 'I', quickGlyph('spells')],
    ['Level-up cards', 'U', quickGlyph('upgrades')],
    ['Build menu', 'B', quickGlyph('build')],
    ['Journal and quests', 'J', quickGlyph('journal')],
    ['World map', 'M', pad('map')],
    ['Pause · settings', 'Esc', pad('menu')],
    ['Back · close · cancel', 'Esc', pad('cancel')],
    ['Move through a menu', '↑ ↓ ← → (WASD still walks)', 'D-pad']
  ];
  return (
    <table class="vs-keys">
      <thead><tr><th>Action</th><th>Keyboard and mouse</th><th>Controller</th></tr></thead>
      <tbody>{rows.map(([a, k, p]) => <tr key={a}><td>{a}</td><td>{k}</td><td>{p}</td></tr>)}</tbody>
    </table>
  );
}

function Slider({ label, min, max, step, value, onInput, fmt }: { label: string; min: number; max: number; step: number; value: number; onInput: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label class="vs-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />
      <b class="v">{fmt ? fmt(value) : value}</b>
    </label>
  );
}

export function PauseMenu() {
  const [help, setHelp] = useState(false);
  const [, bump] = useState(0);
  if (!ui.pauseOpen.value || !ui.game) return null;
  const game = ui.game;
  const joy = game.ui.joystick;
  const touch = joy && game.ui.checkMobileDevice();
  const close = () => game.ui.toggleSettings();
  const setJoy = (patch: any) => { Object.assign(joy.config, patch); game.ui.updateJoystickConfig(joy); game.ui.updateJoystickPosition(joy); bump((n) => n + 1); };
  return (
    <div class="vs-panel vs-pause hit">
      <button class="vs-btn vs-x" onClick={close}>✕ ({glyph('menu')})</button>
      <h2>⏸ Paused</h2>
      <div class="sub">{onPad() ? 'D-pad to move, A to press, B to go back.' : 'Arrow keys or the mouse to choose, Enter to press, Esc to go back.'}</div>
      <button class="vs-btn big" onClick={close}>▶ Resume</button>
      <div class="vs-sec">SOUND</div>
      <button class="vs-btn" onClick={() => { ui.muted.value = !ui.muted.value; game.audio.setMuted(ui.muted.value); }}>{ui.muted.value ? '🔇 Sound is off' : '🔊 Sound is on'}</button>
      {([['master', 'Master volume'], ['music', 'Music'], ['sfx', 'Effects'], ['ui', 'Menu sounds']] as const).map(([bus, label]) => (
        <Slider key={bus} label={label} min={0} max={1} step={0.05} value={game.audio.volumes[bus]} fmt={(v) => `${Math.round(v * 100)}%`}
          onInput={(v) => { game.audio.setVolume(bus, v); if (bus !== 'music') game.audio.play(bus === 'ui' ? 'uiMove' : 'pickup'); bump((n) => n + 1); }} />
      ))}
      <div class="vs-sec">CONTROLLER{ui.padName.value ? ` — ${ui.padName.value}` : ' — none detected (press any button on it)'}</div>
      <button class="vs-btn" onClick={() => { ui.vibration.value = !ui.vibration.value; game.input.savePrefs(); game.input.rumble(0.6, 0.6, 200); }}>{ui.vibration.value ? '📳 Vibration is on' : '📴 Vibration is off'}</button>
      <Slider label="Stick dead zone" min={0.05} max={0.6} step={0.05} value={ui.deadzone.value} fmt={(v) => `${Math.round(v * 100)}%`}
        onInput={(v) => { ui.deadzone.value = v; game.input.savePrefs(); }} />
      {touch && (
        <>
          <div class="vs-sec">TOUCH CONTROLS</div>
          <Slider label="Joystick position" min={0} max={1} step={0.1} value={joy.config.positionX ?? 0.5} fmt={(v) => (v < 0.34 ? 'left' : v > 0.66 ? 'right' : 'middle')} onInput={(v) => setJoy({ positionX: v, rightHanded: v > 0.5 })} />
          <Slider label="Joystick size" min={0.5} max={1.5} step={0.1} value={joy.config.size} fmt={(v) => `${Math.round(v * 100)}%`} onInput={(v) => setJoy({ size: v })} />
          <Slider label="Joystick opacity" min={0.1} max={1} step={0.1} value={joy.config.opacity} fmt={(v) => `${Math.round(v * 100)}%`} onInput={(v) => setJoy({ opacity: v })} />
        </>
      )}
      <div class="vs-sec">HELP</div>
      <button class="vs-btn" onClick={() => setHelp(!help)}>{help ? '▾ Hide the controls' : '▸ Show all controls'}</button>
      {help && <Controls />}
      <div class="vs-sec">GAME</div>
      <button class="vs-btn" onClick={() => { game.requestSave('manual', true); game.ui.toast('Game saved'); }}>💾 Save now</button>
    </div>
  );
}
