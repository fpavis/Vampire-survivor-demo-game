// The screen itself: a fullscreen switch for Video settings, and on a phone held upright, a hint to turn it.
import { useEffect, useState } from 'preact/hooks';
import { Icon } from './Icon';

const fsElement = () => document.fullscreenElement ?? null;

/** Fullscreen on and off (shown only where the browser allows it, so not inside a frame that forbids it). */
export function FullscreenToggle() {
  const [on, setOn] = useState(!!fsElement());
  useEffect(() => {
    const sync = () => setOn(!!fsElement());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!document.fullscreenEnabled) return null;
  const toggle = () => {
    const p = fsElement() ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    p?.catch?.(() => { /* refused: the switch stays as it was */ });
  };
  return (
    <button class={`vs-btn vs-toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} data-act="fullscreen" onClick={toggle}>
      <Icon name={on ? 'fullscreen-exit' : 'fullscreen'} /><span class="lb">Fullscreen</span><span class="st">{on ? 'On' : 'Off'}</span>
    </button>
  );
}

const upright = () => typeof matchMedia === 'function' && matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 900px)').matches;

/** On a touch screen held upright, the game asks to be turned sideways (it can be played upright too). */
export function TurnHint() {
  const [show, setShow] = useState(upright());
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const q = matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 900px)');
    const sync = () => setShow(q.matches);
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);
  if (!show || dismissed) return null;
  return (
    <div class="vs-turn hit" role="dialog" aria-label="Turn your device sideways">
      <div class="box">
        <Icon name="rotate-device" size={56} />
        <b>Turn your device sideways</b>
        <span>The game is made for a wide screen.</span>
        <button class="vs-btn" data-act="turn-dismiss" onClick={() => setDismissed(true)}>Play like this</button>
      </div>
    </div>
  );
}
