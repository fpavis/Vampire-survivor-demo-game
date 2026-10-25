import { ui } from './bridge';
import { onPad } from './hints';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function PartyBar() {
  const p = ui.party.value;
  if (!p.heroes.length) return null;
  return (
    <div class="vs-party hit">
      {p.heroes.map((h, i) => (
        <button key={h.id} class={`vs-hero${i === p.active ? ' act' : ''}${h.dead ? ' dead' : ''}`} style={{ '--hc': hex(h.color) }}
          title={h.dead ? `${h.name} is down. Revive at a town healer.` : i === p.active ? `${h.name} (active)` : `Switch to ${h.name}`}
          onClick={() => ui.game?.party.switchTo(i)}>
          <span class="pi">{h.dead ? '💀' : h.icon}<i class="lv">{h.level}</i></span>
          <span class="bars">
            <span class="nm">{h.name}<i>Lv {h.level}</i></span>
            <span class="b"><u class="hp" style={{ width: `${Math.max(0, Math.min(100, (h.hp / h.maxHp) * 100))}%` }} /></span>
            <span class="b"><u class="mp" style={{ width: `${Math.max(0, Math.min(100, (h.mana / h.maxMana) * 100))}%` }} /></span>
          </span>
          {!onPad() && <span class="kb">{i + 1}</span>}
          {h.pending > 0 && <span class="pend">⬆{h.pending}</span>}
          {i !== p.active && p.cd > 0 && !h.dead && <span class="cdv" style={{ transform: `scaleX(${p.cd})` }} />}
        </button>
      ))}
    </div>
  );
}

export function Healer() {
  ui.version.value;
  if (!ui.healerOpen.value || !ui.game) return null;
  const game = ui.game;
  const quotes = game.party.quotes() as { id: string; dead: boolean; missing: number; cost: number }[];
  const gold = ui.wallet.value.gold;
  const total = quotes.reduce((a, q) => a + q.cost, 0);
  const canAny = quotes.some((q) => q.cost > 0 && q.cost <= gold);
  return (
    <div class="vs-panel vs-heal hit">
      <button class="vs-btn vs-x" onClick={() => (ui.healerOpen.value = false)}>✕</button>
      <h2>✚ Healer</h2>
      <div class="sub">“Rest your weary heroes.” Healing and reviving cost gold. 🪙 You have {gold}.</div>
      {quotes.map((q, i) => {
        const h = ui.party.value.heroes[i];
        if (!h) return null;
        const label = q.dead ? `Revive — ${q.cost}g` : q.cost > 0 ? `Heal — ${q.cost}g` : 'Healthy';
        return (
          <div class="vs-hrow" key={q.id}>
            <span class="pi">{q.dead ? '💀' : h.icon}</span>
            <span>
              <b>{h.name}</b> <span class="vs-tag">Lv {h.level}</span>
              <div class={`st${q.dead ? ' dead' : ''}`}>{q.dead ? 'Fallen' : `${h.hp} / ${h.maxHp} HP`}</div>
            </span>
            <button class="vs-btn" disabled={q.cost === 0 || q.cost > gold} onClick={() => { game.party.buy(i); ui.version.value++; }}>{label}</button>
          </div>
        );
      })}
      <button class="vs-btn" disabled={!canAny} onClick={() => { game.party.buyAll(); ui.version.value++; }}>Restore everyone{total > 0 ? ` — ${total}g` : ''}</button>
    </div>
  );
}
