import { useEffect } from 'preact/hooks';
import { Loadout } from './Loadout';
import { Healer, PartyBar } from './Party';
import { Dialog, Inn, Shop } from './Town';
import { BuildHud, BuildMenu, SailingHint, TowerPanel } from './Build';
import { OptionsPanel, PauseMenu } from './Pause';
import { SlotsPanel } from './Slots';
import { CreditsPanel, TitleExtras } from './Front';
import { RebindPanel } from './Rebind';
import { TipCard } from './Tips';
import { WorldMap } from './WorldMap';
import { DeathScreen, Ending, StoryCard } from './Story';
import { Icon } from './Icon';
import { setSettings } from '../app/settings';
import { BoardPanel, Journal, Tracker } from './Quests';
import { glyph, onPad, quickGlyph } from './hints';
import { isTyping } from './nav';
import { ui, PICK_KEYS, panelOpen } from './bridge';
import { CARDS, PATHS } from '../core/hero/stats';
import { RARITY } from '../core/config';
import { hexCss, rarityColor } from '../core/access/palettes';

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
        <button class="vs-btn vs-ico" onClick={() => open('spells')} title={`Spells and runes (${quickGlyph('spells')})`} aria-label="Spells and runes"><Icon name="backpack" /></button>
        <button class="vs-btn vs-ico" onClick={() => open('journal')} title={`Journal (${quickGlyph('journal')})`} aria-label="Journal"><Icon name="journal" /></button>
        <button class="vs-btn vs-ico" onClick={() => open('build')} title={`Build (${quickGlyph('build')})`} aria-label="Build"><Icon name="hammer" /></button>
      </div>
      <div class="vs-wallet" title="Gold, wood, stone, iron">
        <span><Icon name="res-gold" /> {w.gold}</span>{w.wood > 0 && <span><Icon name="res-wood" /> {w.wood}</span>}{w.stone > 0 && <span><Icon name="res-stone" /> {w.stone}</span>}{w.iron > 0 && <span><Icon name="res-iron" /> {w.iron}</span>}
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
              <Icon name={s.icon} />
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
      <button class="vs-btn vs-x" onClick={() => (ui.cardsOpen.value = false)} aria-label="Close"><Icon name="close" /></button>
      <h2>Level up! <span style={{ color: '#ffd84a' }}>{pending > 1 ? `×${pending} ready` : ''}</span></h2>
      <div class="sub">{onPad() ? `The game keeps running. Choose with the D-pad and ${glyph('interact')}, close with ${glyph('cancel')}.` : `The game keeps running. Pick a card (1–3) or close this with U.`}</div>
      {cards.map((c, i) => {
        const def = CARDS[c.id], r = RARITY[Math.min(3, c.rarity)], path = PATHS[def.path];
        return (
          <button key={c.id} class="vs-card" style={{ '--rc': hexCss(rarityColor(ui.palette.value, Math.min(3, c.rarity))) }} onClick={() => pick(i)}>
            <div class="ic"><Icon name={def.icon} /></div>
            <div>
              <div class="tg"><Icon name={path.icon} /> {path.name.toUpperCase()} · {r.name.toUpperCase()} · {c.isNew ? 'NEW' : `LV ${c.toLevel - 1} → ${c.toLevel}`}</div>
              <div class="nm">{def.name}</div>
              {c.lines.map((l) => <div class="ln">{l}</div>)}
            </div>
            {!onPad() && <div class="kb">[{PICK_KEYS[i]}]</div>}
          </button>
        );
      })}
      <label class="vs-check"><input type="checkbox" checked={ui.autoPick.value} onChange={(e) => setSettings(ui.game, { autoPick: (e.target as HTMLInputElement).checked })} />
        Auto-pick for me (favours your strongest path)</label>
    </div>
  );
}

function HoldBar() {
  const h = ui.hold.value;
  if (!h) return null;
  return (
    <div class="vs-hold">
      <div class="t"><Icon name="flag" /> {h.label} — wave {h.wave} / {h.waves} · {h.seconds}s</div>
      <div class="b"><i style={{ width: `${Math.round(h.progress * 100)}%` }} /></div>
    </div>
  );
}

function Pill() {
  const n = ui.pending.value;
  if (!n || ui.cardsOpen.value) return null;
  return (
    <button class="vs-pill hit" onClick={() => (ui.cardsOpen.value = true)}>
      <Icon name="upgrade" /> {n} upgrade{n > 1 ? 's' : ''}<span class="long"> ready</span> · {quickGlyph('upgrades')}
    </button>
  );
}

/** The training dummy's meter, while the player is near it and hitting it. */
function DummyMeter() {
  const m = ui.dummy.value;
  if (!m) return null;
  return (
    <div class="vs-meter" role="status" aria-live="off">
      <Icon name="dummy" />
      <span><b>Training dummy</b>
        <span class="n"><b>{m.dps}</b> damage/s</span>
        <small>best {m.peak}/s · total {m.total}</small></span>
    </div>
  );
}

export function App() {
  const modal = panelOpen();
  useEffect(() => { document.documentElement.classList.toggle('vs-modal', modal); }, [modal]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ui.visible.value || ui.pauseOpen.value || ui.worldMap.value || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      const game = ui.game;
      if (!game) return;
      const act = game.input.keys.actionFor(e.key);
      if (act === 'upgrades') game.input.openPanel('upgrades');
      else if (act === 'spells') game.input.openPanel('spells');
      else if (act === 'journal') game.input.openPanel('journal');
      else if (ui.cardsOpen.value && ui.pending.value && PICK_KEYS.includes(k)) game.pickCard(Number(k) - 1);
      else if (PICK_KEYS.includes(k) && ui.loadoutOpen.value) game.spells.setView(Number(k) - 1);
      else if (PICK_KEYS.includes(k)) game.party.switchTo(Number(k) - 1);
      else if (act === 'build') game.input.openPanel('build');
      else if (k === 'enter' && game.towers.build) { e.preventDefault(); game.towers.confirmBuild(); }
      else if (act === 'nextHero' && ui.loadoutOpen.value) { e.preventDefault(); game.spells.cycleView(e.shiftKey ? -1 : 1); }
      else if (act === 'nextHero') { e.preventDefault(); game.party.cycle(e.shiftKey ? -1 : 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // shown on the title screen and in the game alike
  const front = (
    <>
      <TitleExtras />
      <OptionsPanel />
      <SlotsPanel />
      <CreditsPanel />
      <RebindPanel />
    </>
  );
  if (!ui.visible.value) return front;
  return (
    <>
      <HoldBar />
      <div class="vs-left vs-hud">
        <Pill />
        <Tracker />
        <PartyBar />
        <DummyMeter />
        <TipCard />
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
      <SailingHint />
      <WorldMap />
      <PauseMenu />
      <ActiveBar />
      <StoryCard />
      <DeathScreen />
      <Ending />
      {front}
    </>
  );
}
