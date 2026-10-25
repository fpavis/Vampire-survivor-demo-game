import { useState } from 'preact/hooks';
import { ui } from './bridge';
import { glyph, onPad, quickGlyph } from './hints';
import { padGlyph } from '../core/input/gamepad';
import { PALETTES } from '../core/access/palettes';
import { setAccess } from '../app/access';
import { Icon } from './Icon';

const kind = () => ui.padKind.value;

export function Controls() {
  ui.bindVersion.value;
  const input = ui.game?.input;
  const pad = (a: Parameters<typeof padGlyph>[1]) => padGlyph(kind(), a, input?.mapper?.bindings);
  const key = (a: string) => (input?.keys ? input.keys.label(a) : a);
  const rows: [string, string, string][] = [
    ['Move', `${key('up')} ${key('left')} ${key('down')} ${key('right')} · arrows`, 'Left stick'],
    ['Aim dashes and blinks', 'Move direction / hold the mouse', 'Right stick'],
    ['Interact · confirm', `${key('interact')} · Enter`, pad('interact')],
    ['Skills (Dash …)', `${key('skill1')} · ${key('skill2')} · ${key('skill3')}`, `${pad('skill1')} · ${pad('skill2')} · ${pad('skill3')}`],
    ['Switch hero', `1 2 3 · ${key('nextHero')}`, `${pad('prevHero')} · ${pad('nextHero')}`],
    ['Spells and runes', key('spells'), 'D-pad ↑'],
    ['Level-up cards', key('upgrades'), 'D-pad ↓'],
    ['Build menu', key('build'), 'D-pad ←'],
    ['Journal and quests', key('journal'), 'D-pad →'],
    ['World map', key('map'), pad('map')],
    ['Pause · settings', 'Esc', pad('menu')],
    ['Back · close · cancel', 'Esc', pad('cancel')],
    ['Equip · lock in the spell panel', 'F · L', `${pad('skill1')} · ${pad('skill2')}`],
    ['Move through a menu', '↑ ↓ ← → (WASD still walks)', 'D-pad']
  ];
  return (
    <table class="vs-keys">
      <thead><tr><th>Action</th><th>Keyboard and mouse</th><th>Controller</th></tr></thead>
      <tbody>{rows.map(([a, k, p]) => <tr key={a}><td>{a}</td><td>{k}</td><td>{p}</td></tr>)}</tbody>
    </table>
  );
}

const HOW_TO: [string, string][] = [
  ['Survive', 'Your spells cast themselves at whatever comes close. Move to stay out of reach, and pick up the gems monsters drop: they are experience.'],
  ['Grow', 'Each level gives an upgrade card. Spells and runes drop from monsters, chests and bosses; equip them and socket runes in the spell panel.'],
  ['Explore', 'Regions get harder the further you go from the start. Roads lead between towns; caves, ruins and dungeons hold treasure and bosses.'],
  ['Towns', 'Healers revive and heal the party, merchants sell spells and runes, the elder gives the story quests and the board gives bounties.'],
  ['Build', 'Wood, stone and iron from trees, rocks and monsters build towers that cast spells for you, and docks with boats to cross the sea.'],
  ['Party', 'Three heroes travel together. Switch who fights; the others rest, lend their aura and catch up on experience.']
];

/** Short sections on how the game works, then every control. */
function HowToPlay() {
  return (
    <div class="vs-howto">
      {HOW_TO.map(([t, d]) => <p key={t}><b>{t}.</b> {d}</p>)}
      <Controls />
    </div>
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
      <button class="vs-btn vs-x" onClick={close}><Icon name="close" /> ({glyph('menu')})</button>
      <h2><Icon name="pause" /> Paused</h2>
      <div class="sub">{onPad() ? 'D-pad to move, A to press, B to go back.' : 'Arrow keys or the mouse to choose, Enter to press, Esc to go back.'}</div>
      <button class="vs-btn big" onClick={close}><Icon name="play" /> Resume</button>
      <div class="vs-sec">SOUND</div>
      <button class="vs-btn" onClick={() => { ui.muted.value = !ui.muted.value; game.audio.setMuted(ui.muted.value); }}><Icon name={ui.muted.value ? 'sound-off' : 'sound-on'} /> {ui.muted.value ? 'Sound is off' : 'Sound is on'}</button>
      {([['master', 'Master volume'], ['music', 'Music'], ['sfx', 'Effects'], ['ui', 'Menu sounds']] as const).map(([bus, label]) => (
        <Slider key={bus} label={label} min={0} max={1} step={0.05} value={game.audio.volumes[bus]} fmt={(v) => `${Math.round(v * 100)}%`}
          onInput={(v) => { game.audio.setVolume(bus, v); if (bus !== 'music') game.audio.play(bus === 'ui' ? 'uiMove' : 'pickup'); bump((n) => n + 1); }} />
      ))}
      <div class="vs-sec">CONTROLLER{ui.padName.value ? ` — ${ui.padName.value}` : ' — none detected (press any button on it)'}</div>
      <button class="vs-btn" onClick={() => { ui.vibration.value = !ui.vibration.value; game.input.savePrefs(); game.input.rumble(0.6, 0.6, 200); }}><Icon name={ui.vibration.value ? 'vibrate' : 'vibrate-off'} /> {ui.vibration.value ? 'Vibration is on' : 'Vibration is off'}</button>
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
      <div class="vs-sec">ACCESSIBILITY</div>
      <Slider label="Text size" min={0.9} max={1.4} step={0.1} value={ui.textScale.value} fmt={(v) => `${Math.round(v * 100)}%`}
        onInput={(v) => setAccess(game, { textScale: v })} />
      <button class="vs-btn" onClick={() => {
        const i = PALETTES.findIndex((p) => p.id === ui.palette.value);
        setAccess(game, { palette: PALETTES[(i + 1) % PALETTES.length].id });
      }}><Icon name="palette" /> Colours: {PALETTES.find((p) => p.id === ui.palette.value)?.label}</button>
      <button class="vs-btn" onClick={() => setAccess(game, { reducedMotion: !ui.reducedMotion.value })}>
        <Icon name={ui.reducedMotion.value ? 'motion-off' : 'motion'} /> {ui.reducedMotion.value ? 'Reduced motion is on (no shaking or flashing)' : 'Reduced motion is off'}</button>
      <button class="vs-btn" onClick={() => (ui.rebindOpen.value = true)}><Icon name="keyboard" /> Rebind keys and buttons…</button>
      <button class="vs-btn" onClick={() => { game.perf.toggle(); bump((n) => n + 1); }}><Icon name="gauge" /> {game.perf.shown ? 'Frame rate is shown (F3)' : 'Show the frame rate (F3)'}</button>
      <div class="vs-sec">HELP</div>
      <button class="vs-btn" onClick={() => setAccess(game, { tips: !ui.tipsOn.value })}><Icon name="bulb" /> {ui.tipsOn.value ? 'Tips are on' : 'Tips are off'}</button>
      <button class="vs-btn" onClick={() => { game.tips.forget(); setAccess(game, { tips: true }); game.ui.toast('Tips will show again'); }}><Icon name="reset" /> Show every tip again</button>
      <button class="vs-btn" onClick={() => setHelp(!help)}><Icon name={help ? 'chevron-down' : 'chevron-right'} /> {help ? 'Hide How to play' : 'How to play'}</button>
      {help && <HowToPlay />}
      <div class="vs-sec">GAME</div>
      <button class="vs-btn" onClick={() => { game.requestSave('manual', true); game.ui.toast('Game saved'); }}><Icon name="save" /> Save now</button>
    </div>
  );
}
