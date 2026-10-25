import { ui } from './bridge';
import { hexCss, rarityColor } from '../core/access/palettes';
import { glyph } from './hints';
import { CORE_INFO, RARITY_NAMES, RUNES, TEMPLATES, describeSpell, makeSpell, resolveSpell } from '../core/spells/spells';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
/** Rarity colour in the player's colour palette. */
const RC = (tier: number) => hexCss(rarityColor(ui.palette.value, tier));

export function Shop() {
  const s = ui.shop.value;
  ui.version.value;
  if (!ui.shopOpen.value || !s || !ui.game) return null;
  const game = ui.game;
  const gold = ui.wallet.value.gold;
  const mins = Math.floor(s.nextIn / 60), secs = String(s.nextIn % 60).padStart(2, '0');
  return (
    <div class="vs-panel vs-shop hit">
      <button class="vs-btn vs-x" onClick={() => game.closeNpcPanels()}>✕</button>
      <h2>💰 {s.town} Market</h2>
      <div class="sub">Spells and runes for gold. New wares in {mins}:{secs}. 🪙 You have {gold}.</div>
      <div class="vs-goods">
        {s.items.map((it, i) => {
          const isSpell = it.kind === 'spell';
          const tpl = isSpell ? TEMPLATES[it.tpl] : null;
          const rune = !isSpell ? RUNES[it.id] : null;
          const color = isSpell ? hex(CORE_INFO[tpl!.core].color) : RC(rune!.rarity);
          const detail = isSpell ? describeSpell(resolveSpell(makeSpell(it.tpl))).join(' · ') : rune!.desc;
          return (
            <div key={i} class={`vs-good${it.sold ? ' sold' : ''}`} style={{ '--gc': color }}>
              <span class="ic">{isSpell ? tpl!.icon : rune!.icon}</span>
              <span class="tx">
                <b>{isSpell ? tpl!.name : `${rune!.name} rune`}</b>
                <small>{isSpell ? `${tpl!.mode === 'auto' ? 'Auto-cast' : 'Active'} spell · ${CORE_INFO[tpl!.core].name}` : `${RARITY_NAMES[rune!.rarity]} rune`}</small>
                <small>{detail}</small>
              </span>
              <button class="vs-btn" disabled={it.sold || gold < it.price} onClick={() => game.buyItem(i)}>{it.sold ? 'Sold' : `🪙 ${it.price}`}</button>
            </div>
          );
        })}
      </div>
      <div class="sub" style={{ marginTop: '8px' }}>Tip: drop unwanted spells and runes into the salvage slot in your spell panel (I) to turn them into gold.</div>
    </div>
  );
}

export function Inn() {
  ui.version.value;
  if (!ui.innOpen.value || !ui.game) return null;
  const game = ui.game;
  const cost = game.innQuote();
  const gold = ui.wallet.value.gold;
  const heroes = ui.party.value.heroes;
  const needs = heroes.some((h) => h.dead || h.hp < h.maxHp || h.mana < h.maxMana);
  return (
    <div class="vs-panel vs-inn hit">
      <button class="vs-btn vs-x" onClick={() => game.closeNpcPanels()}>✕</button>
      <h2>🛏 The Inn</h2>
      <div class="sub">“A warm bed mends the whole party — even the fallen. We’ll note your progress in the ledger, too.”</div>
      <div class="vs-hrow-mini">
        {heroes.map((h) => (
          <span key={h.id} class={h.dead ? 'dead' : ''}>{h.dead ? '💀' : h.icon} {h.name} {h.dead ? 'fallen' : `${h.hp}/${h.maxHp}`}</span>
        ))}
      </div>
      <button class="vs-btn big" disabled={gold < cost || !needs} onClick={() => { game.restAtInn(); ui.version.value++; }}>
        {needs ? `Rest the night — 🪙 ${cost}` : 'Everyone is fully rested'}
      </button>
      {gold < cost && needs && <div class="sub" style={{ color: '#ff9a9a', marginTop: '6px' }}>You need {cost - gold} more gold.</div>}
    </div>
  );
}

export function Dialog() {
  const d = ui.dialog.value;
  if (!d || !ui.game) return null;
  const game = ui.game;
  const close = () => game.closeNpcPanels();
  if (d.script) {
    return (
      <div class="vs-panel vs-dialog hit">
        <button class="vs-btn vs-x" onClick={close}>✕</button>
        <div class="who"><span class="ic">{d.icon}</span><b>{d.speaker}</b></div>
        <div class="say">“{d.text}”</div>
        <div class="vs-choices">
          {d.choices && d.choices.length > 0
            ? d.choices.map((c) => <button key={c.index} class="vs-btn" onClick={() => game.quests.advance(c.index)}>{c.text}</button>)
            : <button class="vs-btn" onClick={() => game.quests.advance()}>{d.last ? 'Farewell' : 'Continue ▶'}</button>}
        </div>
      </div>
    );
  }
  return (
    <div class="vs-panel vs-dialog hit">
      <button class="vs-btn vs-x" onClick={() => (ui.dialog.value = null)}>✕</button>
      <div class="who"><span class="ic">{d.icon}</span><b>{d.speaker}</b></div>
      <div class="say">“{d.text}”</div>
      <div class="sub">Walk away or press {glyph('interact')} to close.</div>
    </div>
  );
}
