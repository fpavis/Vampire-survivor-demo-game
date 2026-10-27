import { ui, type QuestView } from './bridge';
import { hexCss, rarityColor } from '../core/access/palettes';
import { glyph } from './hints';
import { Icon } from './Icon';
import { CORE_INFO, RARITY_NAMES, RUNES, TEMPLATES, describeSpell, makeSpell, resolveSpell } from '../core/spells/spells';
import { QuestCard, Standing } from './Quests';
import { useState } from 'preact/hooks';

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
      <button class="vs-btn vs-x" onClick={() => game.closeNpcPanels()} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="merchant" /> {s.town} Market</h2>
      <div class="sub">Spells and runes for gold. New wares in {mins}:{secs}. <Icon name="res-gold" /> You have {gold}.{s.discount ? ` ${Math.round(s.discount * 100)}% off: the town trusts you.` : ''}</div>
      <div class="vs-goods">
        {s.items.map((it, i) => {
          const isSpell = it.kind === 'spell';
          const tpl = isSpell ? TEMPLATES[it.tpl] : null;
          const rune = !isSpell ? RUNES[it.id] : null;
          const color = isSpell ? hex(CORE_INFO[tpl!.core].color) : RC(rune!.rarity);
          const detail = isSpell ? describeSpell(resolveSpell(makeSpell(it.tpl))).join(' · ') : rune!.desc;
          return (
            <div key={i} class={`vs-good${it.sold ? ' sold' : ''}`} style={{ '--gc': color }}>
              <span class="ic"><Icon name={isSpell ? tpl!.icon : rune!.icon} /></span>
              <span class="tx">
                <b>{isSpell ? tpl!.name : `${rune!.name} rune`}</b>
                <small>{isSpell ? `${tpl!.mode === 'auto' ? 'Auto-cast' : 'Active'} spell · ${CORE_INFO[tpl!.core].name}` : `${RARITY_NAMES[rune!.rarity]} rune`}</small>
                <small>{detail}</small>
              </span>
              <button class="vs-btn" disabled={it.sold || gold < it.price} onClick={() => game.buyItem(i)}>{it.sold ? 'Sold' : <><Icon name="res-gold" /> {it.price}</>}</button>
            </div>
          );
        })}
      </div>
      <div class="sub" style={{ marginTop: '8px' }}>Tip: drop unwanted spells and runes into the salvage slot on the Spells page (I) to turn them into gold.</div>
    </div>
  );
}

/** The innkeeper's rumour: ask, pay to have it marked on the map, take it on; and the rumours to be paid for. */
function Rumours() {
  const game = ui.game;
  const [, redraw] = useState(0);         // what the innkeeper said lives in the quest state, not in a signal
  const v = game.quests.innView();
  if (!v) return null;
  const bump = () => redraw((n) => n + 1);
  const r = v.rumour;
  const gold = ui.wallet.value.gold;
  return (
    <div class="vs-rumour">
      <div class="vs-sec">RUMOURS</div>
      {!v.asked && <button class="vs-btn" data-act="ask" onClick={() => { game.quests.askRumour(); bump(); }}><Icon name="scroll" /> Ask for rumours</button>}
      {r && (
        <div class="vs-good" style={{ '--gc': '#7ad8ff' }}>
          <span class="ic"><Icon name={r.kind === 'dungeon' ? 'lair' : r.kind === 'cave' ? 'place-cave' : 'place-ruins'} /></span>
          <span class="tx">
            <b>{r.place}</b>
            <small>“Something stirs in {r.place}, {r.where}. Clear it out and come back: any inn will pay.”</small>
            <small class="cost">{r.reward}</small>
          </span>
          <span class="vs-acts">
            <button class="vs-btn" data-act="mark" disabled={r.marked || gold < r.fee} onClick={() => { game.quests.markRumour(); bump(); }}>{r.marked ? 'Marked' : <>Mark it on my map · <Icon name="res-gold" /> {r.fee}</>}</button>
            <button class="vs-btn" data-act="take" disabled={r.status !== 'open'} onClick={() => { game.quests.takeRumour(); bump(); }}>{r.status === 'open' ? 'Take it on' : r.status === 'taken' ? 'Taken' : 'Done'}</button>
          </span>
        </div>
      )}
      {v.asked && !r && <div class="vs-empty">Nothing new until the next rotation.</div>}
      {v.claims.map((q: QuestView) => (
        <QuestCard key={q.id} q={q}>
          <button class="vs-btn" data-act="claim" disabled={!q.ready} onClick={() => { game.quests.turnInQuest(q.id); bump(); }}>{q.ready ? 'Claim reward' : 'In progress'}</button>
        </QuestCard>
      ))}
    </div>
  );
}

export function Inn() {
  ui.version.value;
  if (!ui.innOpen.value || !ui.game) return null;
  const game = ui.game;
  const cost = game.innQuote();
  const view = game.quests.innView();
  const gold = ui.wallet.value.gold;
  const heroes = ui.party.value.heroes;
  const needs = heroes.some((h) => h.dead || h.hp < h.maxHp || h.mana < h.maxMana);
  return (
    <div class="vs-panel vs-inn hit">
      <button class="vs-btn vs-x" onClick={() => game.closeNpcPanels()} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="innkeeper" /> The Inn</h2>
      <div class="sub">“A warm bed mends the whole party — even the fallen. We’ll note your progress in the ledger, too.”</div>
      <div class="vs-hrow-mini">
        {heroes.map((h) => (
          <span key={h.id} class={h.dead ? 'dead' : ''}><Icon name={h.dead ? 'skull' : h.icon} /> {h.name} {h.dead ? 'fallen' : `${h.hp}/${h.maxHp}`}</span>
        ))}
      </div>
      <button class="vs-btn big" disabled={gold < cost || !needs} onClick={() => { game.restAtInn(); ui.version.value++; }}>
        {!needs ? 'Everyone is fully rested' : cost === 0 ? 'Rest the night — on the house' : <>Rest the night — <Icon name="res-gold" /> {cost}</>}
      </button>
      {gold < cost && needs && <div class="sub" style={{ color: '#ff9a9a', marginTop: '6px' }}>You need {cost - gold} more gold.</div>}
      {view && view.standing.n > 0 && <Standing s={view.standing} />}
      <Rumours />
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
        <button class="vs-btn vs-x" onClick={close} aria-label="Close"><Icon name="close" /></button>
        <div class="who"><span class="ic"><Icon name={d.icon} /></span><b>{d.speaker}</b></div>
        <div class="say">“{d.text}”</div>
        <div class="vs-choices">
          {d.choices && d.choices.length > 0
            ? d.choices.map((c) => <button key={c.index} class="vs-btn" onClick={() => game.quests.advance(c.index)}>{c.text}</button>)
            : <button class="vs-btn" onClick={() => game.quests.advance()}>{d.last ? 'Farewell' : <>Continue <Icon name="play" /></>}</button>}
        </div>
      </div>
    );
  }
  return (
    <div class="vs-panel vs-dialog hit">
      <button class="vs-btn vs-x" onClick={() => (ui.dialog.value = null)} aria-label="Close"><Icon name="close" /></button>
      <div class="who"><span class="ic"><Icon name={d.icon} /></span><b>{d.speaker}</b></div>
      <div class="say">“{d.text}”</div>
      {d.job && d.choices
        ? <div class="vs-choices">{d.choices.map((c) => <button key={c.index} class="vs-btn" data-choice={c.index} onClick={() => game.quests.answer(c.index)}>{c.text}</button>)}</div>
        : <div class="sub">Walk away or press {glyph('interact')} to close.</div>}
    </div>
  );
}
