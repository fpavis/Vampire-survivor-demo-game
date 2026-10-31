import { useEffect, useRef, useState } from 'preact/hooks';
import { ui } from './bridge';
import { Icon } from './Icon';

/** A card over the action when a warlord or demon lord shows itself or falls, and after a respawn. */
export function StoryCard() {
  const c = ui.card.value;
  if (!c) return null;
  const big = c.kind !== 'wake';
  return (
    <div key={c.id} class={`vs-story-card ${c.kind}`} role="status" aria-live="polite" data-card={c.kind}>
      {big && <><i class="bar top" /><i class="bar bottom" /></>}
      <div class="in">
        {big && <div class="k">{c.kind === 'boss' ? 'A great foe' : 'Victory'}</div>}
        <div class="n">{c.name}</div>
        {c.title && <div class="t">{c.title}</div>}
        {c.text && <div class="x">{c.text}</div>}
      </div>
    </div>
  );
}

/** A story scene: letterbox bars, the speaker's portrait (or icon) and name, the line typed out. Click to read on. */
export function Scene() {
  const sc = ui.scene.value;
  if (!sc) return null;
  const done = sc.shown >= sc.text.length;
  const narrator = !sc.speaker;
  return (
    <div class={`vs-scene hit${narrator ? ' narrator' : ''}`} role="dialog" aria-label={sc.speaker || 'Story'} data-scene={sc.id} onClick={() => ui.game?.story.advance()}>
      <i class="bar top" /><i class="bar bottom" />
      <div class="vs-scene-box">
        {!narrator && (
          <span class="pic">{sc.portrait ? <img src={sc.portrait} alt="" /> : <Icon name={sc.icon} />}</span>
        )}
        <div class="tx">
          {!narrator && <div class="who"><b>{sc.speaker}</b>{sc.title && <small>{sc.title}</small>}</div>}
          <p aria-live="polite">{sc.text.slice(0, sc.shown)}<span class="rest">{sc.text.slice(sc.shown)}</span></p>
          <div class="hint">{done ? (sc.index + 1 < sc.count ? 'Continue' : 'Close') : 'Show all'} <Icon name="play" /> <small>Esc skips</small></div>
        </div>
      </div>
    </div>
  );
}

/** The ending: the epilogue, what the run amounted to and the credits, rolling up the screen. */
export function Ending() {
  const e = ui.ending.value;
  const [done, setDone] = useState(false);
  const roll = useRef<HTMLDivElement>(null);
  useEffect(() => { setDone(false); }, [e]);
  if (!e) return null;
  const close = () => ui.game?.story.endEnding();
  return (
    <div class="vs-panel vs-ending hit" role="dialog" aria-label="The end">
      <button class="vs-btn vs-x" onClick={close} aria-label="Skip">Skip <Icon name="close" /></button>
      <div class="vs-roll-view">
        <div class="vs-roll" ref={roll} onAnimationEnd={() => setDone(true)}>
          <h1>The sky clears</h1>
          {e.epilogue.map((l) => <p key={l}>{l}</p>)}
          <h2>The road so far</h2>
          <dl>{e.roll.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {e.credits.map((c) => (
            <section key={c.section}>
              <h2>{c.section}</h2>
              {c.lines.map((l) => <p key={l}>{l}</p>)}
            </section>
          ))}
          <p class="fin">Thank you for playing.</p>
        </div>
      </div>
      <div class="vs-acts">
        <button class={`vs-btn${done ? ' warn' : ''}`} data-act="continue" onClick={close}><Icon name="play" /> Continue your journey</button>
      </div>
    </div>
  );
}

/** The party is down: what happened, and the way back. */
export function DeathScreen() {
  const d = ui.death.value;
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setConfirm(false); }, [d]);
  useEffect(() => {
    if (!d) return;
    // Enter or Space respawns when nothing on the screen has the focus (a mouse player pressing a key)
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && !(document.activeElement instanceof HTMLButtonElement)) { ev.preventDefault(); ui.game?.deathRespawn(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d]);
  if (!d) return null;
  const g = ui.game;
  const newGame = () => {
    if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3500); return; }
    g.deathNewGame();
  };
  return (
    <div class="vs-panel vs-death hit" role="dialog" aria-label="The party has fallen">
      <div class="box">
        <h1>You fell</h1>
        <div class="sub">The whole party is down.</div>
        <div class="rows">
          {d.rows.map(([icon, k, v]) => <div key={k} class="row"><Icon name={icon} /><span>{k}</span><b>{v}</b></div>)}
        </div>
        <div class="vs-acts col">
          <button class="vs-btn big go" data-act="respawn" onClick={() => g.deathRespawn()}><Icon name="heart" /> Respawn at {d.place}</button>
          <button class={`vs-btn${confirm ? ' warn' : ''}`} data-act="new" onClick={newGame}>{confirm ? 'This erases your save. Press again to start over' : 'New game'}</button>
        </div>
        <div class="hint">Your progress, the map and cleared places are kept.</div>
      </div>
    </div>
  );
}
