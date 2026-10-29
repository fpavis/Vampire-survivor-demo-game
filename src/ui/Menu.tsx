// The game menu, in the manner of an RPG: Esc / Start opens it over the paused game, a list of pages on the left
// and the page on the right. Party shows each hero's stats and passives, Spells their loadouts, Upgrades the cards
// waiting to be picked, then the journal, building, the map, saving and the settings. The hotkeys (C, I, U, J, B)
// open it straight on their page; LB / RB flip the pages.
import { useEffect, useRef, useState } from 'preact/hooks';
import { ui, MENU_PAGES, PICK_KEYS, type MenuPage } from './bridge';
import { glyph, onPad } from './hints';
import { Icon } from './Icon';
import { SpellsPage } from './Loadout';
import { JournalPage } from './Quests';
import { BuildPage } from './Build';
import { SettingsPage } from './Pause';
import { setSettings } from '../app/settings';
import { CARDS, CARD_IDS, MASTERY_IDS, PATHS, computeStats, ranksTaken, type HeroStats, type PathId, type Picks } from '../core/hero/stats';
import { AURA_STRENGTH, auraOf, defOf, partyStats } from '../core/party/party';
import { TEMPLATES } from '../core/spells/spells';
import { RARITY } from '../core/config';
import { hexCss, rarityColor } from '../core/access/palettes';
import type { KeyAction } from '../core/input/bindings';
import { slotLabel } from '../core/save/slots';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

const PAGE_INFO: Record<MenuPage, { label: string; icon: string; key?: KeyAction }> = {
  party: { label: 'Party', icon: 'party', key: 'party' },
  spells: { label: 'Spells', icon: 'backpack', key: 'spells' },
  upgrades: { label: 'Upgrades', icon: 'upgrade', key: 'upgrades' },
  journal: { label: 'Journal', icon: 'journal', key: 'journal' },
  build: { label: 'Build', icon: 'hammer', key: 'build' },
  save: { label: 'Save & Load', icon: 'save' },
  settings: { label: 'Settings', icon: 'settings' }
};

const keyLabel = (a: KeyAction) => { ui.bindVersion.value; const k = ui.game?.input?.keys; return k ? k.label(a) : ''; };
const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]';

/** Put focus on the page's first item (keyboard and controller only: the mouse needs no focus ring). */
function focusPage(body: HTMLElement | null, nav: HTMLElement | null, page: MenuPage) {
  if (!body || (ui.device.value !== 'key' && ui.device.value !== 'pad')) return;
  const first = Array.from(body.querySelectorAll<HTMLElement>(FOCUSABLE))
    .find((el) => el.getClientRects().length > 0 && !el.classList.contains('vs-x') && !el.hasAttribute('data-skipfocus'));
  const target = first ?? nav?.querySelector<HTMLElement>(`[data-page="${page}"]`);
  target?.focus({ preventScroll: true });
}

export function GameMenu() {
  const [quit, setQuit] = useState(false);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const open = ui.pauseOpen.value;
  const page = ui.menuPage.value;
  const seq = ui.menuSeq.value;
  const go = (p: MenuPage) => ui.game?.ui.openMenu(p);
  // LB / RB (from nav.ts) flip the pages
  useEffect(() => {
    if (!root) return;
    const onPage = (e: Event) => {
      const d = (e as CustomEvent<number>).detail;
      const i = MENU_PAGES.indexOf(ui.menuPage.value);
      go(MENU_PAGES[(i + d + MENU_PAGES.length) % MENU_PAGES.length]);
    };
    root.addEventListener('vs-page', onPage);
    return () => root.removeEventListener('vs-page', onPage);
  }, [root]);
  // a page that was just opened (or jumped to) takes the focus, so the d-pad and arrows start on its content
  useEffect(() => { if (open) requestAnimationFrame(() => focusPage(body.current, nav.current, ui.menuPage.value)); }, [open, page, seq]);
  useEffect(() => { if (!open) setQuit(false); }, [open]);
  const game = ui.game;
  if (!open || !game) return null;
  const close = () => game.ui.closeMenu();
  const pending = ui.pending.value;
  const askQuit = () => {
    if (!quit) { setQuit(true); setTimeout(() => setQuit(false), 3500); return; }
    game.quitToTitle();
  };
  const openMap = () => { close(); game.toggleMap(); };
  const item = (p: MenuPage) => {
    const info = PAGE_INFO[p];
    return (
      <button key={p} class={`vs-btn vs-mp${p === page ? ' on' : ''}`} data-page={p} aria-current={p === page ? 'page' : undefined} onClick={() => go(p)}>
        <Icon name={info.icon} /><span class="ml">{info.label}</span>
        {p === 'upgrades' && pending > 0 && <i class="vs-badge">{pending}</i>}
        {info.key && !onPad() && <kbd>{keyLabel(info.key)}</kbd>}
      </button>
    );
  };
  return (
    <div class="vs-panel vs-menu hit" ref={setRoot} role="dialog" aria-label="Game menu">
      <button class="vs-btn vs-x" onClick={close} aria-label="Close the menu"><Icon name="close" /> ({glyph('menu')})</button>
      <nav class="vs-mnav" ref={nav}>
        <div class="vs-mtitle"><Icon name="pause" /> Paused</div>
        <button class="vs-btn vs-mp" data-page="resume" onClick={close}><Icon name="play" /><span class="ml">Resume</span></button>
        {MENU_PAGES.slice(0, 5).map(item)}
        <button class="vs-btn vs-mp" data-page="map" onClick={openMap}><Icon name="map" /><span class="ml">World map</span>{!onPad() && <kbd>{keyLabel('map')}</kbd>}</button>
        {MENU_PAGES.slice(5).map(item)}
        <button class={`vs-btn vs-mp${quit ? ' warn' : ''}`} data-page="quit" onClick={askQuit}><Icon name="door" /><span class="ml">{quit ? 'Quit? Press again' : 'Quit to title'}</span></button>
        <div class="vs-mhint">{onPad() ? `${glyph('prevHero')} ${glyph('nextHero')} pages · ${glyph('cancel')} back` : 'Esc resumes'}</div>
      </nav>
      <div class="vs-mbody" ref={body}>
        {page === 'party' && <PartyPage />}
        {page === 'spells' && <SpellsPage />}
        {page === 'upgrades' && <UpgradesPage />}
        {page === 'journal' && <JournalPage />}
        {page === 'build' && <BuildPage />}
        {page === 'save' && <SavePage />}
        {page === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ party
type Row = [string, keyof HeroStats, (v: number) => string, (v: number) => string];   // label, stat, value, an aura's share
const NONE = '\u2014';
const plus = (v: number) => (Math.abs(v - 1) < 0.005 ? NONE : `+${pct(v - 1)}`);
const STAT_ROWS: Record<PathId, Row[]> = {
  arcane: [
    ['Spell damage', 'might', plus, (v) => `+${pct(v)}`],
    ['Cooldowns', 'cooldown', (v) => (v < 0.995 ? `-${pct(1 - v)}` : NONE), (v) => `-${pct(v)}`],
    ['Critical chance', 'crit', pct, pct],
    ['Spell area', 'area', plus, (v) => `+${pct(v)}`]
  ],
  vigor: [
    ['Max health', 'maxHealth', (v) => `${Math.round(v)}`, () => ''],
    ['Regeneration', 'regen', (v) => (v > 0.04 ? `${v.toFixed(1)}/s` : NONE), (v) => `+${v.toFixed(1)}/s`],
    ['Damage taken', 'armor', (v) => (v > 0.004 ? `-${pct(v)}` : NONE), (v) => `-${pct(v)}`]
  ],
  mobility: [
    ['Move speed', 'speed', plus, (v) => `+${pct(v)}`],
    ['Pickup range', 'magnet', plus, (v) => `+${pct(v)}`],
    ['XP gain', 'growth', plus, (v) => `+${pct(v)}`],
    ['Find chance', 'luck', plus, (v) => `+${pct(v)}`],
    ['Gold found', 'gold', plus, (v) => `+${pct(v)}`]
  ],
  mana: [
    ['Max mana', 'maxMana', (v) => `${Math.round(v)}`, () => ''],
    ['Mana regen', 'manaRegen', (v) => `${v.toFixed(1)}/s`, (v) => `+${v.toFixed(1)}/s`],
    ['Mana cost', 'manaCost', (v) => (v < 0.995 ? `-${pct(1 - v)}` : NONE), () => ''],
    ['Effect duration', 'duration', plus, (v) => `+${pct(v)}`]
  ]
};
// what a resting hero lends (the aura's own field for each stat that has one)
const AURA_OF: Partial<Record<keyof HeroStats, keyof ReturnType<typeof auraOf>>> = {
  might: 'might', cooldown: 'cooldown', area: 'area', regen: 'regen', armor: 'armor', speed: 'speed', magnet: 'magnet',
  growth: 'growth', luck: 'luck', gold: 'gold', manaRegen: 'manaRegen', duration: 'duration'
};

/** Every passive card, by path: ranks as pips and what they give now; mastery ranks after. */
export function Passives({ picks }: { picks: Picks }) {
  const paths = Object.keys(PATHS) as PathId[];
  const mastery = MASTERY_IDS.filter((id) => (picks[id] || 0) > 0);
  return (
    <div class="vs-passives">
      {paths.map((p) => {
        const ids = CARD_IDS.filter((id) => CARDS[id].path === p);
        const n = ids.reduce((a, id) => a + (picks[id] || 0), 0);
        return (
          <div key={p} class="vs-ppath" style={{ '--pc': hex(PATHS[p].color) }}>
            <div class="vs-sec"><Icon name={PATHS[p].icon} /> {PATHS[p].name.toUpperCase()} <small>{n} / {ids.length * 10}</small></div>
            {ids.map((id) => {
              const c = CARDS[id], r = picks[id] || 0;
              return (
                <div key={id} class={`vs-pcard${r ? '' : ' none'}${r >= c.max ? ' max' : ''}`} data-card={id} title={c.desc}>
                  <span class="ic"><Icon name={c.icon} /></span>
                  <span class="nm">{c.name}</span>
                  <span class="pips" aria-label={`rank ${r} of ${c.max}`}>{Array.from({ length: c.max }, (_, i) => <i key={i} class={i < r ? 'on' : ''} />)}</span>
                  <span class="v">{r ? `${c.label} ${c.fmt(c.value(r))}` : c.label}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      {mastery.length > 0 && (
        <div class="vs-ppath" style={{ '--pc': '#ffd84a' }}>
          <div class="vs-sec"><Icon name="star" /> MASTERY</div>
          {mastery.map((id) => {
            const c = CARDS[id], r = picks[id];
            return (
              <div key={id} class="vs-pcard max" data-card={id} title={c.desc}>
                <span class="ic"><Icon name={c.icon} /></span>
                <span class="nm">{c.name.replace('Mastery: ', '')}</span>
                <span class="pips"><b>×{r}</b></span>
                <span class="v">{c.label} {c.fmt(c.value(r))}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One bar: health, mana or experience. */
const Bar = ({ cls, v, max, label }: { cls: string; v: number; max: number; label: string }) => (
  <div class={`vs-pbar ${cls}`}><i style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%` }} /><b>{label}</b></div>
);

export function PartyPage() {
  ui.version.value; ui.picks.value; ui.pending.value;
  const view = ui.party.value;
  const game = ui.game;
  const [sel, setSel] = useState<number | null>(null);
  if (!game?.party?.heroes?.length) return null;
  game.party.commit();                         // the active hero's live numbers into its record
  const heroes = game.party.heroes;
  const active = game.party.active;
  const hi = Math.min(sel ?? active, heroes.length - 1);
  const h = heroes[hi], def = defOf(h.id), hv = view.heroes[hi];
  const isActive = hi === active;
  const own = computeStats(h.picks);
  const total = isActive ? partyStats(heroes, hi) : own;
  const lends = auraOf(own);
  const health = isActive ? game.state.health : h.health;
  const spells = [...h.auto, ...h.active].filter(Boolean).map((u: string) => game.spells.item(u)).filter(Boolean);
  return (
    <div class="vs-page vs-partyp">
      <h2><Icon name="party" /> Party
        <span class="vs-heroes">{heroes.map((x: any, i: number) => {
          const d = defOf(x.id);
          return (
            <button key={x.id} class={`vs-btn vs-hb${i === hi ? ' on' : ''}${i === active ? ' act' : ''}${x.dead ? ' down' : ''}`} data-hero={i}
              title={`${d.name}${i === active ? ' (active)' : ''}`} onClick={() => setSel(i)}><Icon name={x.dead ? 'skull' : d.icon} /></button>
          );
        })}</span>
      </h2>
      <div class="vs-phead" style={{ '--hc': hex(def.color) }}>
        <span class="pi"><Icon name={h.dead ? 'skull' : def.icon} /></span>
        <div class="who">
          <div class="nm">{def.name} <span class="vs-tag">{isActive ? 'active' : h.dead ? 'down' : 'resting'}</span></div>
          <div class="lv">Level {h.level}{h.pending > 0 ? ` · ${h.pending} upgrade${h.pending > 1 ? 's' : ''} waiting` : ''}</div>
          <Bar cls="xp" v={h.experience} max={h.nextLevel} label={`${Math.floor(h.experience)} / ${h.nextLevel} XP`} />
          <Bar cls="hp" v={health} max={own.maxHealth} label={`${Math.ceil(Math.max(0, health))} / ${Math.round(total.maxHealth)} health`} />
          <Bar cls="mp" v={hv ? hv.mana : h.mana} max={own.maxMana} label={`${Math.floor(hv ? hv.mana : h.mana)} / ${Math.round(own.maxMana)} mana`} />
        </div>
        <div class="acts">
          {isActive && h.pending > 0 && <button class="vs-btn" onClick={() => game.ui.openMenu('upgrades')}><Icon name="upgrade" /> Spend upgrades</button>}
          {!isActive && <button class="vs-btn" data-act="make-active" disabled={h.dead} onClick={() => game.party.switchTo(hi)}><Icon name="swap" /> Make {def.name} active</button>}
        </div>
      </div>
      <div class="vs-pcols">
        <div>
          <div class="vs-sec">STATS{isActive ? ' — with the resting heroes’ auras' : ` — lends ${pct(AURA_STRENGTH)} of these while resting`}</div>
          <table class="vs-stats">
            <thead><tr><th>Stat</th><th>Own</th>{isActive ? <><th>Auras</th><th>Total</th></> : <th>Lends</th>}</tr></thead>
            {(Object.keys(STAT_ROWS) as PathId[]).map((p) => (
              <tbody key={p}>
                <tr class="grp"><td colSpan={isActive ? 4 : 3}><Icon name={PATHS[p].icon} /> {PATHS[p].name}</td></tr>
                {STAT_ROWS[p].map(([label, k, f, share]) => {
                  const a = AURA_OF[k];
                  const diff = (total[k] as number) - (own[k] as number);
                  const lend = a ? (lends as any)[a] as number : 0;
                  return (
                    <tr key={k} data-stat={k}>
                      <td>{label}</td>
                      <td>{f(own[k] as number)}</td>
                      {isActive
                        ? <><td class="au">{Math.abs(diff) > 1e-6 ? share(Math.abs(diff)) : ''}</td><td><b>{f(total[k] as number)}</b></td></>
                        : <td class="au">{a && lend > 1e-6 ? share(lend) : ''}</td>}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        <div>
          <div class="vs-sec">SPELLS</div>
          {!spells.length && <div class="vs-empty">Nothing equipped.</div>}
          <div class="vs-pspells">
            {spells.map((s: any) => {
              const t = TEMPLATES[s.tpl];
              return <span key={s.uid} class="vs-pspell" title={t.desc}><Icon name={t.icon} /> {t.name} <small>Lv {s.level}{t.mode === 'active' ? ' · active' : ''}{h.assist === s.uid ? ' · assists' : ''}</small></span>;
            })}
          </div>
          <div class="vs-sec">PASSIVES <small>{ranksTaken(h.picks)} ranks</small></div>
          <Passives picks={h.picks} />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- upgrades
export function UpgradesPage() {
  const cards = ui.cards.value;
  const pending = ui.pending.value;
  ui.picks.value;
  const game = ui.game;
  useEffect(() => { if (game && pending > 0 && !ui.cards.value.length) game.ensureCards(); }, [pending]);
  if (!game) return null;
  const pick = (i: number) => game.pickCard(i);
  const waiting = (ui.party.value.heroes || []).filter((h, i) => i !== ui.party.value.active && h.pending > 0);
  return (
    <div class="vs-page vs-upg">
      <h2><Icon name="upgrade" /> Upgrades {pending > 0 && <span class="vs-tag ok">{pending} ready</span>}</h2>
      {pending > 0 ? (
        <>
          <div class="sub">{onPad() ? `Choose with the d-pad and ${glyph('interact')}.` : 'Pick a card (1–3, or click it).'} Each rank is a small step; a card has ten.</div>
          <div class="vs-cards">
            {cards.map((c, i) => {
              const def = CARDS[c.id], r = RARITY[Math.min(3, c.rarity)], path = PATHS[def.path];
              return (
                <button key={c.id} class="vs-card" style={{ '--rc': hexCss(rarityColor(ui.palette.value, Math.min(3, c.rarity))) }} onClick={() => pick(i)}>
                  <div class="ic"><Icon name={def.icon} /></div>
                  <div>
                    <div class="tg"><Icon name={path.icon} /> {path.name.toUpperCase()} · {def.mastery ? 'MASTERY' : r.name.toUpperCase()} · {c.isNew ? 'NEW' : `RANK ${c.toLevel - 1} → ${c.toLevel}`}</div>
                    <div class="nm">{def.name}</div>
                    {c.lines.map((l, k) => <div key={k} class="ln">{l}</div>)}
                  </div>
                  {!onPad() && <div class="kb">[{PICK_KEYS[i]}]</div>}
                </button>
              );
            })}
          </div>
        </>
      ) : <div class="vs-empty">No upgrades waiting: every level brings one.</div>}
      <label class="vs-check"><input type="checkbox" checked={ui.autoPick.value} onChange={(e) => setSettings(game, { autoPick: (e.target as HTMLInputElement).checked })} />
        Pick for me as levels come (favours your strongest path)</label>
      {waiting.map((h) => <div key={h.id} class="vs-note"><Icon name={h.icon} /> {h.name} has {h.pending} upgrade{h.pending > 1 ? 's' : ''} waiting: make {h.name} active (Party page) to spend them.</div>)}
      <div class="vs-sec">PASSIVES — {defOf(game.party.hero?.id ?? 'aria').name}</div>
      <Passives picks={game.state.picks} />
    </div>
  );
}

// ---------------------------------------------------------- save and load
function SavePage() {
  const game = ui.game;
  return (
    <div class="vs-page vs-savep">
      <h2><Icon name="save" /> Save &amp; Load</h2>
      <div class="sub">The game saves itself as you play: every half minute out in the world, and on levels, places and bosses. Keep a copy in a slot of its own, or go back to one.</div>
      <div class="vs-acts">
        <button class="vs-btn big" onClick={() => (ui.slotsOpen.value = 'save')}><Icon name="save" /> Save game…</button>
        <button class="vs-btn big" onClick={() => (ui.slotsOpen.value = 'load')}><Icon name="journal" /> Load game…</button>
      </div>
      {game?.saveSlot && <div class="vs-note"><Icon name="save" /> This game saves to: {slotLabel(game.saveSlot)}</div>}
    </div>
  );
}
