import { useEffect } from 'preact/hooks';
import { Loadout } from './Loadout';
import { Healer, PartyBar } from './Party';
import { Dialog, Inn, Shop } from './Town';
import { BuildHud, BuildMenu, SailingHint, TowerPanel, WaypointPanel } from './Build';
import { PauseMenu } from './Pause';
import { BoardPanel, Journal, Tracker } from './Quests';
import { glyph, onPad, quickGlyph } from './hints';
import { isTyping } from './nav';
import { ui, PICK_KEYS } from './bridge';
import { CARDS, PATHS } from '../core/hero/stats';
import { RARITY } from '../core/config';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function ActiveBar() {
  const slots = ui.active.value;
  const keys = [glyph('skill1'), glyph('skill2'), glyph('skill3')];
  const mana = ui.mana.value, max = ui.maxMana.value;
  const w = ui.wallet.value;
  const open = (p: 'spells' | 'journal' | 'build') => ui.game?.input.openPanel(p);
  return (
    <div class="vs-bar hit vs-hud">
      <div class="vs-btns">
        <button class="vs-btn vs-ico" onClick={() => open('spells')} title={`Spells and runes (${quickGlyph('spells')})`} aria-label="Spells and runes">🎒</button>
        <button class="vs-btn vs-ico" onClick={() => open('journal')} title={`Journal (${quickGlyph('journal')})`} aria-label="Journal">📖</button>
        <button class="vs-btn vs-ico" onClick={() => open('build')} title={`Build (${quickGlyph('build')})`} aria-label="Build">🔨</button>
      </div>
      <div class="vs-wallet" title="Gold, wood, stone, iron">
        <span>🪙 {w.gold}</span>{w.wood > 0 && <span>🪵 {w.wood}</span>}{w.stone > 0 && <span>🪨 {w.stone}</span>}{w.iron > 0 && <span>⛓ {w.iron}</span>}
      </div>
      {ui.surface.value && (
        <div class={`vs-surface${ui.surface.value.bad ? ' bad' : ''}`} style={{ '--sc': `#${ui.surface.value.color.toString(16).padStart(6, '0')}` }}>
          <b>{ui.surface.value.name}</b> · {ui.surface.value.desc}
        </div>
      )}
      <div class="vs-mana" title="Mana: spent by active skills only. Auto-cast spells are free.">
        <i style={{ width: `${Math.max(0, Math.min(100, (mana / max) * 100))}%` }} />
        <b>{Math.floor(mana)} / {Math.floor(max)}</b>
      </div>
      <div class="vs-skills">
        {slots.map((s, i) =>
          s ? (
            <button key={i} class={`vs-skill${s.affordable ? '' : ' poor'}`} style={{ borderColor: s.affordable ? hex(s.color) : undefined }}
              onClick={() => ui.game?.spells.cast(i)} title={`${s.name} — ${s.cost} mana`}>
              {s.icon}
              <span class="k">{keys[i]}</span>
              <span class="c">{s.cost}</span>
              <span class="cd" style={{ transform: `scaleY(${s.cdFrac})` }} />
            </button>
          ) : (
            <div key={i} class="vs-skill empty"><span class="k">{keys[i]}</span></div>
          )
        )}
      </div>
    </div>
  );
}

function CardsPanel() {
  const cards = ui.cards.value;
  const pending = ui.pending.value;
  if (!ui.cardsOpen.value || !pending) return null;
  const pick = (i: number) => ui.game?.pickCard(i);
  return (
    <div class="vs-panel vs-cards hit">
      <button class="vs-btn vs-x" onClick={() => (ui.cardsOpen.value = false)}>✕</button>
      <h2>Level up! <span style={{ color: '#ffd84a' }}>{pending > 1 ? `×${pending} ready` : ''}</span></h2>
      <div class="sub">{onPad() ? `The game keeps running. Choose with the D-pad and ${glyph('interact')}, close with ${glyph('cancel')}.` : `The game keeps running. Pick a card (1–3) or close this with U.`}</div>
      {cards.map((c, i) => {
        const def = CARDS[c.id], r = RARITY[Math.min(3, c.rarity)], path = PATHS[def.path];
        return (
          <button key={c.id} class="vs-card" style={{ '--rc': hex(r.color) }} onClick={() => pick(i)}>
            <div class="ic">{def.icon}</div>
            <div>
              <div class="tg">{path.icon} {path.name.toUpperCase()} · {c.isNew ? 'NEW' : `LV ${c.toLevel - 1} → ${c.toLevel}`}</div>
              <div class="nm">{def.name}</div>
              {c.lines.map((l) => <div class="ln">{l}</div>)}
            </div>
            {!onPad() && <div class="kb">[{PICK_KEYS[i]}]</div>}
          </button>
        );
      })}
      <label class="vs-check"><input type="checkbox" checked={ui.autoPick.value} onChange={(e) => (ui.autoPick.value = (e.target as HTMLInputElement).checked)} />
        Auto-pick for me (favours your strongest path)</label>
    </div>
  );
}

function HoldBar() {
  const h = ui.hold.value;
  if (!h) return null;
  return (
    <div class="vs-hold">
      <div class="t">🚩 {h.label} — wave {h.wave} / {h.waves} · {h.seconds}s</div>
      <div class="b"><i style={{ width: `${Math.round(h.progress * 100)}%` }} /></div>
    </div>
  );
}

function Pill() {
  const n = ui.pending.value;
  if (!n || ui.cardsOpen.value) return null;
  return (
    <button class="vs-pill hit" onClick={() => (ui.cardsOpen.value = true)}>
      ⬆ {n} upgrade{n > 1 ? 's' : ''}<span class="long"> ready</span> · {quickGlyph('upgrades')}
    </button>
  );
}

/** Panels that take the screen: on small screens the HUD steps aside while one is open. */
const modalOpen = () =>
  ui.loadoutOpen.value || ui.healerOpen.value || ui.shopOpen.value || ui.innOpen.value || ui.boardOpen.value ||
  ui.journalOpen.value || ui.buildMenuOpen.value || !!ui.towerPanel.value || !!ui.waypointOpen.value ||
  ui.pauseOpen.value || !!ui.dialog.value;

export function App() {
  const modal = modalOpen();
  useEffect(() => { document.documentElement.classList.toggle('vs-modal', modal); }, [modal]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ui.visible.value || ui.pauseOpen.value || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      const game = ui.game;
      if (!game) return;
      if (k === 'u') game.input.openPanel('upgrades');
      else if (k === 'i') game.input.openPanel('spells');
      else if (k === 'j') game.input.openPanel('journal');
      else if (ui.cardsOpen.value && ui.pending.value && PICK_KEYS.includes(k)) game.pickCard(Number(k) - 1);
      else if (PICK_KEYS.includes(k)) game.party.switchTo(Number(k) - 1);
      else if (k === 'b') game.input.openPanel('build');
      else if (k === 'enter' && game.towers.build) { e.preventDefault(); game.towers.confirmBuild(); }
      else if (k === 'tab') { e.preventDefault(); game.party.cycle(e.shiftKey ? -1 : 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!ui.visible.value) return null;
  return (
    <>
      <HoldBar />
      <div class="vs-left vs-hud">
        <Pill />
        <Tracker />
        <PartyBar />
      </div>
      <CardsPanel />
      <Loadout />
      <Healer />
      <Shop />
      <Inn />
      <Dialog />
      <BoardPanel />
      <Journal />
      <BuildMenu />
      <BuildHud />
      <TowerPanel />
      <WaypointPanel />
      <SailingHint />
      <PauseMenu />
      <ActiveBar />
    </>
  );
}
