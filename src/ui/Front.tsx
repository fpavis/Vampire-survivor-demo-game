import { useState } from 'preact/hooks';
import { ui } from './bridge';
import { Icon } from './Icon';
import { CREDITS, GAME_VERSION, WHATS_NEW } from '../core/version';

declare const __BUILD_INFO__: string;
const SEEN_KEY = 'vs.whatsnew';
const seenVersion = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return GAME_VERSION; } };

/** The DOM parts of the title screen: version, "What's new" after an update, and the seed for a new game. */
export function TitleExtras() {
  const [news, setNews] = useState(() => seenVersion() !== WHATS_NEW.version);
  const [seedOpen, setSeedOpen] = useState(false);
  if (!ui.title.value) return null;
  const hide = () => { setNews(false); try { localStorage.setItem(SEEN_KEY, WHATS_NEW.version); } catch { /* ignore */ } };
  const seed = ui.newGameSeed.value;
  const panel = !!ui.slotsOpen.value || ui.optionsOpen.value || ui.creditsOpen.value || ui.rebindOpen.value;
  if (panel) return <div class="vs-version">v{GAME_VERSION} · {typeof __BUILD_INFO__ === 'string' ? __BUILD_INFO__ : 'dev'}</div>;
  return (
    <>
      <div class="vs-version">v{GAME_VERSION} · {typeof __BUILD_INFO__ === 'string' ? __BUILD_INFO__ : 'dev'}</div>
      <div class="vs-seed hit">
        {seedOpen
          ? <><span>World seed</span><input class="vs-in" value={seed} placeholder="random" maxLength={24}
              onInput={(e) => (ui.newGameSeed.value = (e.target as HTMLInputElement).value.trim())}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); setSeedOpen(false); } }} />
            <button class="vs-btn" onClick={() => setSeedOpen(false)}><Icon name="check" /></button></>
          : <button class="vs-btn vs-link" tabIndex={-1} onClick={() => setSeedOpen(true)}>New game seed: <b>{seed || 'random'}</b></button>}
      </div>
      {news && (
        <div class="vs-news hit" role="status">
          <button class="vs-btn vs-x" tabIndex={-1} onClick={hide} aria-label="Hide"><Icon name="close" /></button>
          <div class="h"><Icon name="star" /> What's new in {WHATS_NEW.version}: {WHATS_NEW.title}</div>
          <ul>{WHATS_NEW.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
    </>
  );
}

export function CreditsPanel() {
  if (!ui.creditsOpen.value) return null;
  const close = () => (ui.creditsOpen.value = false);
  return (
    <div class="vs-panel vs-credits hit">
      <button class="vs-btn vs-x" onClick={close} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="star" /> Credits</h2>
      {CREDITS.map((c) => (
        <div key={c.section}>
          <div class="vs-sec">{c.section}</div>
          {c.lines.map((l) => <p key={l}>{l}</p>)}
        </div>
      ))}
      <button class="vs-btn big" onClick={close}>Back</button>
    </div>
  );
}
