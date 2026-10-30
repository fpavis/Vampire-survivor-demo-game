import { useState } from 'preact/hooks';
import { ui } from './bridge';
import { padGlyph } from '../core/input/gamepad';
import { PALETTES } from '../core/access/palettes';
import { setAccess } from '../app/access';
import { setSettings } from '../app/settings';
import { Icon } from './Icon';
import { FullscreenToggle } from './Device';

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
    ['Game menu (party, spells, journal …)', 'Esc', pad('menu')],
    ['Party and stats', key('party'), `${pad('menu')}, then ${pad('prevHero')} ${pad('nextHero')}`],
    ['Spells and runes', key('spells'), 'D-pad ↑'],
    ['Upgrades', key('upgrades'), 'D-pad ↓'],
    ['Build', key('build'), 'D-pad ←'],
    ['Journal and quests', key('journal'), 'D-pad →'],
    ['Flip the menu’s pages', 'Click a page, or its key', `${pad('prevHero')} · ${pad('nextHero')}`],
    ['World map', key('map'), pad('map')],
    ['On the map: from place to place · pin', 'Q E · P or right-click', `D-pad · ${pad('skill2')}`],
    ['Back · close · cancel', 'Esc', pad('cancel')],
    ['Equip · lock on the Spells page', 'F · L', `${pad('skill1')} · ${pad('skill2')}`],
    ['Move through a menu', '↑ ↓ ← →', 'D-pad']
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
  ['Grow', 'Each level gives an upgrade card: passives in small steps, listed on the Party page of the game menu (Esc). Monsters far below your level give little experience, so move on to harder lands. Spells and runes drop from monsters, chests and bosses; equip them and socket runes on the Spells page.'],
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

type Tab = 'game' | 'video' | 'audio' | 'controls' | 'access' | 'help';
const TABS: [Tab, string, string][] = [
  ['game', 'Game', 'settings'], ['video', 'Video', 'gauge'], ['audio', 'Audio', 'sound-on'],
  ['controls', 'Controls', 'gamepad'], ['access', 'Accessibility', 'palette'], ['help', 'Help', 'bulb']
];
const TAB_KEY = 'vs.ui.tab';
const loadTab = (): Tab => { try { const t = localStorage.getItem(TAB_KEY) as Tab; return TABS.some(([id]) => id === t) ? t : 'game'; } catch { return 'game'; } };

function Toggle({ label, on, set, icon }: { label: string; on: boolean; set: (v: boolean) => void; icon?: string }) {
  return (
    <button class={`vs-btn vs-toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => set(!on)}>
      {icon && <Icon name={icon} />}<span class="lb">{label}</span><span class="st">{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function Choice<T extends string | number>({ label, value, options, set }: { label: string; value: T; options: [T, string][]; set: (v: T) => void }) {
  return (
    <label class="vs-row">
      <span>{label}</span>
      <select class="vs-in" value={String(value)} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; const o = options.find(([k]) => String(k) === v); if (o) set(o[0]); }}>
        {options.map(([k, t]) => <option key={String(k)} value={String(k)}>{t}</option>)}
      </select>
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The settings, in tabs: shared by the game menu and Options on the title screen. */
function SettingsTabs({ title }: { title: boolean }) {
  const [tab, setTabState] = useState<Tab>(loadTab);
  const [help, setHelp] = useState(false);
  const [, bump] = useState(0);
  const game = ui.game;
  const s = ui.settings.value;
  const set = (patch: any) => setSettings(game, patch);
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };
  const joy = game.ui?.joystick;
  const touch = joy && game.ui.checkMobileDevice();
  const setJoy = (patch: any) => { Object.assign(joy.config, patch); game.ui.updateJoystickConfig(joy); game.ui.updateJoystickPosition(joy); bump((n) => n + 1); };
  // LB / RB (or the Tab key) step through the tabs
  const ref = (el: HTMLElement | null) => {
    if (!el || (el as any).__tabs) return;
    (el as any).__tabs = true;
    el.addEventListener('vs-tab', (e: Event) => {
      const d = (e as CustomEvent<number>).detail;
      setTabState((cur) => { const i = TABS.findIndex(([id]) => id === cur); const n = TABS[(i + d + TABS.length) % TABS.length][0]; try { localStorage.setItem(TAB_KEY, n); } catch { /* ignore */ } return n; });
    });
  };
  return (
    <div class="vs-settings" ref={ref}>
      <div class="vs-tabs" role="tablist">
        {TABS.map(([id, label, icon]) => (
          <button key={id} class={`vs-btn vs-tab${tab === id ? ' on' : ''}`} role="tab" aria-selected={tab === id} data-tab={id} onClick={() => setTab(id)}>
            <Icon name={icon} /><span class="tl">{label}</span>
          </button>
        ))}
      </div>
      <div class="vs-tabbody" role="tabpanel">
        {tab === 'game' && (
          <>
            <Toggle label="Pick upgrades automatically" on={s.autoPick} set={(v) => set({ autoPick: v })} icon="upgrade" />
            <Toggle label="Ask before salvaging" on={s.confirmSalvage} set={(v) => set({ confirmSalvage: v })} icon="recycle" />
            <Toggle label="Pause when the window loses focus" on={s.pauseOnBlur} set={(v) => set({ pauseOnBlur: v })} icon="pause" />
          </>
        )}
        {tab === 'video' && (
          <>
            <FullscreenToggle />
            <Choice label="Quality" value={s.quality} options={[['high', 'High'], ['medium', 'Medium'], ['low', 'Low (fewer effects)']]} set={(v) => set({ quality: v })} />
            <Slider label="Render scale" min={0.5} max={1} step={0.05} value={s.renderScale} fmt={pct} onInput={(v) => set({ renderScale: v })} />
            <Toggle label="Lower the resolution a little when the game cannot keep up" on={s.dynRes} set={(v) => set({ dynRes: v })} icon="gauge" />
            <Choice label="Frame rate limit" value={s.fpsCap} options={[[0, 'None'], [60, '60 fps'], [30, '30 fps (saves battery)']]} set={(v) => set({ fpsCap: v })} />
            <Choice label="Camera" value={s.zoom} options={[[0, 'Far'], [1, 'Normal'], [2, 'Close']]} set={(v) => set({ zoom: v })} />
            <Choice label="Art style" value={s.artStyle} options={[['pixel', 'Pixel art (everything at the ground’s grain)'], ['smooth', 'Smooth']]} set={(v) => set({ artStyle: v })} />
            {s.artStyle === 'pixel' && <Choice label="Pixel size" value={s.pixelSize} options={[[2, 'Fine'], [3, 'Medium'], [4, 'Chunky']]} set={(v) => set({ pixelSize: v })} />}
            <Choice label="Screen filter" value={s.postFx} options={[['none', 'None'], ['pixelate', 'Pixelate'], ['crt', 'CRT screen'], ['grain', 'Film grain']]} set={(v) => set({ postFx: v })} />
            <Choice label="Colour grade" value={s.colorGrade} options={[['none', 'None'], ['warm', 'Warm'], ['cool', 'Cool'], ['noir', 'Noir'], ['sepia', 'Sepia']]} set={(v) => set({ colorGrade: v })} />
            <Slider label="Screen shake" min={0} max={1} step={0.1} value={s.shake} fmt={pct} onInput={(v) => set({ shake: v })} />
            <Slider label="Damage flash" min={0} max={1} step={0.1} value={s.flash} fmt={pct} onInput={(v) => set({ flash: v })} />
            <Choice label="Damage numbers" value={s.damageNumbers} options={[['all', 'All'], ['crits', 'Critical hits only'], ['off', 'Off']]} set={(v) => set({ damageNumbers: v })} />
            <Toggle label="Frame rate overlay (F3)" on={!!game.perf?.shown} set={() => { game.perf.toggle(); bump((n) => n + 1); }} icon="gauge" />
            <div class="vs-sec">HUD</div>
            <Slider label="HUD size" min={0.8} max={1.3} step={0.05} value={s.hudScale} fmt={pct} onInput={(v) => set({ hudScale: v })} />
            <Choice label="Minimap" value={s.minimap} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} set={(v) => set({ minimap: v })} />
            <Slider label="Minimap opacity" min={0.4} max={1} step={0.05} value={s.minimapOpacity} fmt={pct} onInput={(v) => set({ minimapOpacity: v })} />
            <Choice label="Monster health bars" value={s.healthBars} options={[['hurt', 'When hurt'], ['always', 'Always'], ['off', 'Off']]} set={(v) => set({ healthBars: v })} />
            <Toggle label="Quest tracker" on={s.tracker} set={(v) => set({ tracker: v })} icon="journal" />
            <Choice label="Story scenes" value={s.storyScenes} options={[['full', 'Full (the game holds while they speak)'], ['cards', 'Cards only (play goes on)']]} set={(v) => set({ storyScenes: v })} />
          </>
        )}
        {tab === 'audio' && (
          <>
            <button class="vs-btn" onClick={() => { ui.muted.value = !ui.muted.value; game.audio.setMuted(ui.muted.value); }}><Icon name={ui.muted.value ? 'sound-off' : 'sound-on'} /> {ui.muted.value ? 'Sound is off' : 'Sound is on'}</button>
            {([['master', 'Master volume'], ['music', 'Music'], ['sfx', 'Effects'], ['ambient', 'Ambience'], ['ui', 'Menu sounds']] as const).map(([bus, label]) => (
              <Slider key={bus} label={label} min={0} max={1} step={0.05} value={game.audio.volumes[bus]} fmt={pct}
                onInput={(v) => { game.audio.setVolume(bus, v); if (bus !== 'music') game.audio.play(bus === 'ui' ? 'uiMove' : 'pickup'); bump((n) => n + 1); }} />
            ))}
          </>
        )}
        {tab === 'controls' && (
          <>
            <div class="vs-sec">MOUSE</div>
            <Toggle label="Click to move (instead of holding)" on={s.clickToMove} set={(v) => set({ clickToMove: v })} icon="arrow-right" />
            <Toggle label="Aim dashes and blinks at the cursor" on={s.aimAtCursor} set={(v) => set({ aimAtCursor: v })} icon="spell-dash" />
            <Toggle label="Experimental mouse interaction: click a chest, tree or door within reach to use it" on={s.mouseInteract} set={(v) => set({ mouseInteract: v })} icon="hand" />
            <div class="vs-sec">CONTROLLER{ui.padName.value ? ` — ${ui.padName.value}` : ' — none detected (press any button on it)'}</div>
            <button class="vs-btn" onClick={() => { ui.vibration.value = !ui.vibration.value; game.input.savePrefs(); game.input.haptic('test'); }}><Icon name={ui.vibration.value ? 'vibrate' : 'vibrate-off'} /> {ui.vibration.value ? 'Vibration is on' : 'Vibration is off'}</button>
            {ui.vibration.value && (
              <>
                <Slider label="Vibration strength" min={0} max={1} step={0.1} value={ui.vibrationStrength.value} fmt={pct}
                  onInput={(v) => { ui.vibrationStrength.value = v; game.input.savePrefs(); game.input.haptic('test'); }} />
                <button class="vs-btn" data-act="rumble-test" onClick={() => game.input.haptic('test')}><Icon name="vibrate" /> Test the vibration</button>
              </>
            )}
            <Slider label="Stick dead zone" min={0.05} max={0.6} step={0.05} value={ui.deadzone.value} fmt={pct}
              onInput={(v) => { ui.deadzone.value = v; game.input.savePrefs(); }} />
            {ui.padName.value && (
              <div class="vs-row vs-padrow">
                <span>Controller layout{ui.padProfile.value ? ' · set up by you' : ''}</span>
                <span class="vs-acts">
                  <button class="vs-btn" data-act="pad-setup" onClick={() => game.input.startPadSetup()}><Icon name="gamepad" /> Set up this controller</button>
                  {ui.padProfile.value && <button class="vs-btn" data-act="pad-forget" onClick={() => game.input.forgetPadProfile()}>Forget its setup</button>}
                </span>
              </div>
            )}
            {touch && (
              <>
                <div class="vs-sec">TOUCH CONTROLS</div>
                <Slider label="Joystick position" min={0} max={1} step={0.1} value={joy.config.positionX ?? 0.5} fmt={(v) => (v < 0.34 ? 'left' : v > 0.66 ? 'right' : 'middle')} onInput={(v) => setJoy({ positionX: v, rightHanded: v > 0.5 })} />
                <Slider label="Joystick size" min={0.5} max={1.5} step={0.1} value={joy.config.size} fmt={pct} onInput={(v) => setJoy({ size: v })} />
                <Slider label="Joystick opacity" min={0.1} max={1} step={0.1} value={joy.config.opacity} fmt={pct} onInput={(v) => setJoy({ opacity: v })} />
              </>
            )}
            <div class="vs-sec">KEYS AND BUTTONS</div>
            <button class="vs-btn" onClick={() => (ui.rebindOpen.value = true)}><Icon name="keyboard" /> Rebind keys and buttons…</button>
            <button class="vs-btn" onClick={() => setHelp(!help)}><Icon name={help ? 'chevron-down' : 'chevron-right'} /> {help ? 'Hide the controls' : 'Show all controls'}</button>
            {help && <Controls />}
          </>
        )}
        {tab === 'access' && (
          <>
            <Slider label="Text size" min={0.9} max={1.4} step={0.1} value={ui.textScale.value} fmt={pct}
              onInput={(v) => setAccess(game, { textScale: v })} />
            <button class="vs-btn" onClick={() => {
              const i = PALETTES.findIndex((p) => p.id === ui.palette.value);
              setAccess(game, { palette: PALETTES[(i + 1) % PALETTES.length].id });
            }}><Icon name="palette" /> Colours: {PALETTES.find((p) => p.id === ui.palette.value)?.label}</button>
            <button class="vs-btn" onClick={() => setAccess(game, { reducedMotion: !ui.reducedMotion.value })}>
              <Icon name={ui.reducedMotion.value ? 'motion-off' : 'motion'} /> {ui.reducedMotion.value ? 'Reduced motion is on (no shaking or flashing)' : 'Reduced motion is off'}</button>
          </>
        )}
        {tab === 'help' && (
          <>
            <button class="vs-btn" onClick={() => setAccess(game, { tips: !ui.tipsOn.value })}><Icon name="bulb" /> {ui.tipsOn.value ? 'Tips are on' : 'Tips are off'}</button>
            {!title && <button class="vs-btn" onClick={() => { game.tips.forget(); setAccess(game, { tips: true }); game.ui.toast('Tips will show again', 'bulb'); }}><Icon name="reset" /> Show every tip again</button>}
            <button class="vs-btn" onClick={() => (ui.creditsOpen.value = true)}><Icon name="star" /> Credits</button>
            <div class="vs-sec">HOW TO PLAY</div>
            <HowToPlay />
          </>
        )}
      </div>
    </div>
  );
}

/** The guided controller setup: one button at a time, for pads the browser does not lay out itself. */
export function PadSetup() {
  const st = ui.padSetup.value;
  const game = ui.game;
  if (!st || !game) return null;
  return (
    <div class="vs-panel vs-padsetup hit" role="dialog" aria-label="Controller setup">
      <h2><Icon name="gamepad" /> Set up {st.name || 'the controller'}</h2>
      <div class="sub">Step {st.step + 1} of {st.total}. Let go of everything, then press:</div>
      <div class="ask" aria-live="polite">{st.prompt}</div>
      <div class="vs-bar"><u style={{ width: `${(st.step / st.total) * 100}%` }} /></div>
      <div class="vs-acts">
        <button class="vs-btn" data-act="pad-skip" onClick={() => game.input.skipPadSetupStep()}>It has no such button: skip</button>
        <button class="vs-btn" data-act="pad-cancel" onClick={() => game.input.cancelPadSetup()}>Cancel (Esc)</button>
      </div>
    </div>
  );
}

/** The Settings page of the game menu. */
export function SettingsPage() {
  return (
    <div class="vs-page vs-pause">
      <h2><Icon name="settings" /> Settings</h2>
      <SettingsTabs title={false} />
    </div>
  );
}

/** Options from the title screen: the same settings, without the game's own actions. */
export function OptionsPanel() {
  if (!ui.optionsOpen.value || !ui.game) return null;
  const close = () => (ui.optionsOpen.value = false);
  return (
    <div class="vs-panel vs-pause vs-options hit">
      <button class="vs-btn vs-x" onClick={close} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="settings" /> Options</h2>
      <SettingsTabs title={true} />
    </div>
  );
}
