import { useEffect } from 'preact/hooks';
import { Healer, PartyBar } from './Party';
import { Dialog, Inn, Shop } from './Town';
import { BuildHud, SailingHint, TowerPanel } from './Build';
import { OptionsPanel, PadSetup } from './Pause';
import { CrashScreen, StorageBanner } from './Crash';
import { GameMenu } from './Menu';
import { SlotsPanel } from './Slots';
import { CreditsPanel, TitleExtras } from './Front';
import { RebindPanel } from './Rebind';
import { TipCard } from './Tips';
import { WorldMap } from './WorldMap';
import { DeathScreen, Ending, Scene, StoryCard } from './Story';
import { Icon } from './Icon';
import { BoardPanel, Tracker } from './Quests';
import { glyph, quickGlyph } from './hints';
import { isTyping } from './nav';
import { ui, PICK_KEYS, menuOn, panelOpen, type MenuPage } from './bridge';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function ActiveBar() {
  const slots = ui.active.value;
  const keys = [glyph('skill1'), glyph('skill2'), glyph('skill3')];
  const mana = ui.mana.value, max = ui.maxMana.value;
  const w = ui.wallet.value;
  const open = (p: MenuPage) => ui.game?.input.openPanel(p);
  return (
    <div class="vs-bar hit vs-hud">
      <div class="vs-btns">
        <button class="vs-btn vs-ico" onClick={() => ui.game?.ui.toggleMenu()} title="Game menu (Esc)" aria-label="Game menu"><Icon name="party" /></button>
        <button class="vs-btn vs-ico" onClick={() => open('spells')} title={`Spells and runes (${quickGlyph('spells')})`} aria-label="Spells and runes"><Icon name="backpack" /></button>
        <button class="vs-btn vs-ico" onClick={() => open('journal')} title={`Journal (${quickGlyph('journal')})`} aria-label="Journal"><Icon name="journal" /></button>
        <button class="vs-btn vs-ico" onClick={() => open('build')} title={`Build (${quickGlyph('build')})`} aria-label="Build"><Icon name="hammer" /></button>
      </div>
      <div class="vs-wallet" title="Gold, wood, stone, iron">
        <span><Icon name="res-gold" /> {w.gold}</span>{w.wood > 0 && <span><Icon name="res-wood" /> {w.wood}</span>}{w.stone > 0 && <span><Icon name="res-stone" /> {w.stone}</span>}{w.iron > 0 && <span><Icon name="res-iron" /> {w.iron}</span>}
      </div>
      {ui.surface.value && (
        <div class={`vs-surface${ui.surface.value.bad ? ' bad' : ''}`} style={{ '--sc': `#${ui.surface.value.color.toString(16).padStart(6, '0')}` }}>
          <Icon name={ui.surface.value.bad ? 'warning' : 'star'} /> <b>{ui.surface.value.name}</b> · {ui.surface.value.desc}
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
  if (!n || panelOpen()) return null;      // a panel open: it would sit on top of it
  return (
    <button class="vs-pill hit" onClick={() => ui.game?.ui.openMenu('upgrades')}>
      <Icon name="upgrade" /> {n} upgrade{n > 1 ? 's' : ''}<span class="long"> ready</span> · {quickGlyph('upgrades')}
    </button>
  );
}

/** The training ground's meter while the player is near its dummies and hitting them: the whole, then each skill. */
function DummyMeter() {
  const m = ui.dummy.value;
  if (!m) return null;
  return (
    <div class="vs-meter hit" role="status" aria-live="off">
      <div class="hd"><Icon name="dummy" /><b>Training ground</b>
        <button class="vs-btn vs-mini" data-act="reset" tabIndex={-1} title="Start counting again" onClick={() => ui.game?.dummy.reset()}>Reset</button></div>
      <span class="n"><b>{m.dps}</b> damage/s <small>{m.hit} of {m.of} dummies hit</small></span>
      <small>best {m.peak}/s · total {m.total}</small>
      <div class="vs-mrows">
        {m.rows.map((r) => (
          <div key={r.key} class="vs-mrow" style={{ '--sh': `${Math.round(r.share * 100)}%` }}>
            <Icon name={r.icon} /><span class="nm">{r.name}{r.kind && <i class="vs-kind">{r.kind}</i>}</span>
            <b>{r.dps}/s</b><span class="sh">{Math.round(r.share * 100)}%</span>
          </div>
        ))}
      </div>
      <small class="note">Kill effects (Death Echo, Splinter, Resonance, Vampiric, Mana Siphon) never go off here: a dummy does not die.</small>
    </div>
  );
}

export function App() {
  const modal = panelOpen();
  useEffect(() => { document.documentElement.classList.toggle('vs-modal', modal); }, [modal]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ui.visible.value || ui.worldMap.value || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      const game = ui.game;
      if (!game || !game.state.player || game.state.gameOver) return;
      const act = game.input.keys.actionFor(e.key);
      // C, I, U, J, B: the game menu on that page (pressed again there, it closes)
      if (act === 'party' || act === 'spells' || act === 'upgrades' || act === 'journal' || act === 'build') {
        // a sub-panel on top of the menu (the rune picker, save slots, rebinding) keeps the keys
        if (!ui.pauseOpen.value || !ui.slotsOpen.value) game.input.openPanel(act);
        return;
      }
      if (ui.pauseOpen.value) {
        if (menuOn('upgrades') && ui.pending.value && PICK_KEYS.includes(k)) game.pickCard(Number(k) - 1);
        else if (menuOn('spells') && PICK_KEYS.includes(k)) game.spells.setView(Number(k) - 1);
        else if (menuOn('spells') && act === 'nextHero') { e.preventDefault(); game.spells.cycleView(e.shiftKey ? -1 : 1); }
        return;
      }
      if (PICK_KEYS.includes(k)) game.party.switchTo(Number(k) - 1);
      else if (k === 'enter' && game.towers.build) { e.preventDefault(); game.towers.confirmBuild(); }
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
      {/* the upgrades pill sits on its own at the top: inside the scaled left column it would land on the party */}
      <div class="vs-pillbar vs-hud"><Pill /></div>
      <div class="vs-left vs-hud">
        <Tracker />
        <PartyBar />
        <DummyMeter />
        <TipCard />
      </div>
      <Healer />
      <Shop />
      <Inn />
      <Dialog />
      <BoardPanel />
      <BuildHud />
      <TowerPanel />
      <SailingHint />
      <WorldMap />
      <GameMenu />
      <ActiveBar />
      <StoryCard />
      <Scene />
      <DeathScreen />
      <Ending />
      <PadSetup />
      <StorageBanner />
      <CrashScreen />
      {front}
    </>
  );
}
