import { useEffect } from 'preact/hooks';
import { Loadout } from './Loadout';
import { Healer, PartyBar } from './Party';
import { ui, PICK_KEYS } from './bridge';
import { CARDS, PATHS } from '../core/hero/stats';
import { RARITY } from '../core/config';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function ActiveBar() {
  const slots = ui.active.value;
  const keys = ['Space', 'Q', 'R'];
  const mana = ui.mana.value, max = ui.maxMana.value;
  return (
    <div class="vs-bar hit">
      <div class="vs-btns">
        <button class="vs-btn" onClick={() => (ui.loadoutOpen.value = !ui.loadoutOpen.value)} title="Spells and runes (I)">🎒 Spells</button>
        <button class="vs-btn" onClick={() => { ui.muted.value = !ui.muted.value; ui.game?.audio.setMuted(ui.muted.value); }} title="Sound">{ui.muted.value ? '🔇' : '🔊'}</button>
      </div>
      <div class="vs-wallet" title="Gold, wood, stone, iron">
        <span>🪙 {ui.wallet.value.gold}</span><span>🪵 {ui.wallet.value.wood}</span><span>🪨 {ui.wallet.value.stone}</span><span>⛓ {ui.wallet.value.iron}</span>
      </div>
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
            <div key={i} class="vs-skill empty"><span class="k">{keys[i]}</span>empty</div>
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
      <h2>Level up! <span style={{ color: '#ffd84a' }}>{pending > 1 ? `×${pending} ready` : ''}</span></h2>
      <div class="sub">The game keeps running. Pick a card (1–3) or close this with U.</div>
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
            <div class="kb">[{PICK_KEYS[i]}]</div>
          </button>
        );
      })}
      <label class="vs-check"><input type="checkbox" checked={ui.autoPick.value} onChange={(e) => (ui.autoPick.value = (e.target as HTMLInputElement).checked)} />
        Auto-pick for me (favours your strongest path)</label>
    </div>
  );
}

function Pill() {
  const n = ui.pending.value;
  if (!n || ui.cardsOpen.value) return null;
  return <button class="vs-pill hit" onClick={() => (ui.cardsOpen.value = true)}>⬆ {n} upgrade{n > 1 ? 's' : ''} ready — press U</button>;
}

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ui.visible.value) return;
      const k = e.key.toLowerCase();
      if (k === 'u') ui.cardsOpen.value = !ui.cardsOpen.value && ui.pending.value > 0;
      else if (k === 'i') ui.loadoutOpen.value = !ui.loadoutOpen.value;
      else if (ui.cardsOpen.value && ui.pending.value && PICK_KEYS.includes(k)) ui.game?.pickCard(Number(k) - 1);
      else if (PICK_KEYS.includes(k)) ui.game?.party.switchTo(Number(k) - 1);
      else if (k === 'tab') { e.preventDefault(); ui.game?.party.cycle(e.shiftKey ? -1 : 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!ui.visible.value) return null;
  return (
    <>
      <Pill />
      <CardsPanel />
      <Loadout />
      <Healer />
      <PartyBar />
      <ActiveBar />
    </>
  );
}
