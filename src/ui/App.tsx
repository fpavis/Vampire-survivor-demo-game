import { useEffect, useState } from 'preact/hooks';
import { ui, PICK_KEYS } from './bridge';
import { CARDS, PATHS } from '../core/hero/stats';
import { RARITY } from '../core/config';
import {
  CORE_INFO, RUNES, TEMPLATES, canSocket, describeSpell, resolveSpell, spellXpFor, type SpellItem
} from '../core/spells/spells';

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

function SpellRow({ it, sel, onSel, eq }: { it: SpellItem; sel: boolean; onSel: () => void; eq: boolean }) {
  const t = TEMPLATES[it.tpl];
  const core = CORE_INFO[t.core];
  return (
    <button class={`vs-item${sel ? ' sel' : ''}${eq ? ' eq' : ''}`} onClick={onSel}>
      <span class="ic">{t.icon}</span>
      <span style={{ flex: 1 }}>
        <b>{t.name}</b> <span style={{ color: hex(core.color) }}>· {core.name}</span>
        <small>Lv {it.level}{it.level < t.max ? ` · ${it.xp}/${spellXpFor(it.level)} xp` : ' · MAX'} · {t.mode === 'auto' ? 'auto-cast' : 'active'}{eq ? ' · equipped' : ''}</small>
      </span>
      <span>{it.runes.map((r) => (r ? RUNES[r].icon : '◦')).join(' ')}</span>
    </button>
  );
}

function Loadout() {
  ui.version.value; // re-render when the game changes the loadout
  const [selUid, setSel] = useState<string | null>(null);
  const [selRune, setRune] = useState<string | null>(null);
  const game = ui.game;
  if (!ui.loadoutOpen.value || !game) return null;
  const sp = game.spells;
  const safe = ui.safe.value;
  const item: SpellItem | undefined = sp.spells.find((s: SpellItem) => s.uid === selUid) ?? sp.spells[0];
  const tpl = item ? TEMPLATES[item.tpl] : null;
  const resolved = item ? resolveSpell(item) : null;

  const trySocket = (slot: number) => {
    if (!item || !safe) return;
    if (selRune) {
      const chk = canSocket(item, selRune, slot);
      if (!chk.ok) return;
      sp.socket(item.uid, selRune, slot);
      game.audio.play('equip');
      setRune(null);
    } else if (item.runes[slot]) {
      sp.unsocket(item.uid, slot);
    }
  };

  const runeCounts: Record<string, number> = {};
  for (const r of sp.runes) runeCounts[r] = (runeCounts[r] || 0) + 1;
  const selRuneDef = selRune ? RUNES[selRune] : null;
  const reasonFor = (id: string) => (item ? canSocket(item, id, item.runes.findIndex((r: string | null) => r === null) < 0 ? 0 : item.runes.findIndex((r: string | null) => r === null)) : { ok: false });

  return (
    <div class="vs-panel vs-load hit">
      <button class="vs-btn vs-x" onClick={() => (ui.loadoutOpen.value = false)}>✕ (I)</button>
      <h2>Spells &amp; Runes</h2>
      <div class="sub">Pick a spell, pick a rune, then click a socket. Runes that don’t fit are greyed out. Edit while no enemies are near.</div>
      {!safe && <div class="vs-lock">🔒 Enemies are nearby — you can look, but not change your loadout yet.</div>}
      <div class="vs-cols">
        <div>
          <div class="vs-sec">SPELLS</div>
          {sp.spells.map((s: SpellItem) => (
            <SpellRow key={s.uid} it={s} sel={item?.uid === s.uid} eq={sp.equipped(s.uid)} onSel={() => setSel(s.uid)} />
          ))}
        </div>
        <div>
          {item && tpl && resolved && (
            <>
              <div class="vs-sec">SELECTED</div>
              <div><b>{tpl.icon} {tpl.name}</b> — {tpl.desc}</div>
              <div class="vs-tip">{describeSpell(resolved).join('  ·  ')}</div>
              <div class="vs-socks">
                {item.runes.map((r: string | null, i: number) => (
                  <button key={i} class={`vs-sock${r ? ' full' : ''}${selRune && canSocket(item, selRune, i).ok ? ' drop' : ''}`}
                    title={r ? `${RUNES[r].name}: ${RUNES[r].desc} (click to remove)` : 'Empty socket'} onClick={() => trySocket(i)}>
                    {r ? RUNES[r].icon : '+'}
                  </button>
                ))}
              </div>
              <div>
                {sp.equipped(item.uid)
                  ? <button class="vs-btn" disabled={!safe} onClick={() => { sp.unequip(item.uid); game.audio.play('equip'); }}>Unequip</button>
                  : <button class="vs-btn" disabled={!safe} onClick={() => {
                      if (!sp.equip(item.uid)) game.ui.toast(tpl.mode === 'auto' ? 'All auto-cast slots are full — unequip one first' : 'No free skill slot');
                      else game.audio.play('equip');
                    }}>Equip</button>}
              </div>
              <div class="vs-sec">RUNES IN BAG ({sp.runes.length})</div>
              {!sp.runes.length && <div class="sub">No runes yet. Rare drops from enemies, chests and altars.</div>}
              {Object.entries(runeCounts).map(([id, n]) => {
                const def = RUNES[id];
                const chk = reasonFor(id);
                return (
                  <button key={id} class={`vs-rune${selRune === id ? ' sel' : ''}${chk.ok ? '' : ' bad'}`}
                    title={chk.ok ? def.desc : (chk as any).reason || def.desc}
                    onClick={() => { if (chk.ok || !item) setRune(selRune === id ? null : id); else setRune(null); }}>
                    <span class="ic">{def.icon}</span>{def.name}{n > 1 ? ` ×${n}` : ''}
                  </button>
                );
              })}
              <div class="vs-tip">
                {selRuneDef ? `${selRuneDef.name}: ${selRuneDef.desc}` : ''}
                {!selRuneDef && item && sp.runes.some((r: string) => !reasonFor(r).ok) ? 'Greyed runes cannot be used on this spell — hover for why.' : ''}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ui.visible.value) return;
      const k = e.key.toLowerCase();
      if (k === 'u') ui.cardsOpen.value = !ui.cardsOpen.value && ui.pending.value > 0;
      else if (k === 'i') ui.loadoutOpen.value = !ui.loadoutOpen.value;
      else if (ui.cardsOpen.value && ui.pending.value && PICK_KEYS.includes(k)) ui.game?.pickCard(Number(k) - 1);
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
      <ActiveBar />
    </>
  );
}
