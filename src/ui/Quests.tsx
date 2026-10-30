import { ui, type QuestView, type StandingView } from './bridge';
import { glyph } from './hints';
import { Icon } from './Icon';
import { useState } from 'preact/hooks';
import { formatPlayTime } from '../core/save/slots';
import { BESTIARY_ORDER, bestiaryEntry } from '../core/codex/codex';
import { CORE_INFO, RARITY_NAMES, RUNES, TEMPLATES } from '../core/spells/spells';
import { GROUP_INFO, POI_INFO } from '../core/world/biomes';
import { progressText } from '../core/world/completion';
import { portrait } from '../app/portraits';

function Objectives({ q }: { q: QuestView }) {
  return (
    <ul class="vs-obj">
      {q.objectives.map((o, i) => (
        <li key={i} class={o.done ? 'done' : ''}>
          <span class="ck"><Icon name={o.done ? 'box-checked' : 'box'} /></span>
          <span class="tx">{o.text}</span>
          {o.progress && <span class="pr">{o.progress}</span>}
        </li>
      ))}
    </ul>
  );
}

export function QuestCard({ q, children }: { q: QuestView; children?: any }) {
  const from = q.giver === 'townsfolk' ? 'townsfolk' : q.giver === 'inn' ? 'rumour' : '';
  return (
    <div class={`vs-quest${q.ready ? ' ready' : ''}${q.tracked ? ' tracked' : ''}`}>
      <div class="hd"><b>{q.title}</b>{q.level > 0 && <span class="vs-tag">Lv {q.level}</span>}{from && <span class="vs-tag">{from}</span>}{q.ready && <span class="vs-tag ok">ready</span>}</div>
      <div class="sub">{q.summary}</div>
      <Objectives q={q} />
      {q.reward && <div class="rw">Reward: {q.reward}</div>}
      <div class="vs-acts">{children}</div>
    </div>
  );
}

/** "Known · 4 of 8 to Trusted · bounties +10%": a town's regard for the party. */
export function Standing({ s }: { s: StandingView }) {
  const perks = [s.bonus ? `bounties +${Math.round(s.bonus * 100)}%` : '', s.discount ? `${Math.round(s.discount * 100)}% off at the market` : '', s.freeInn ? 'a free bed' : ''].filter(Boolean);
  return (
    <div class="vs-standing" data-standing={s.town}>
      <Icon name="fleur" /> <b>{s.tier}</b>
      <small>{s.next ? `${s.n} of ${s.next.at} to ${s.next.name}` : `${s.n} done`}{perks.length ? ` · ${perks.join(' · ')}` : ''}</small>
    </div>
  );
}

type JTab = 'quests' | 'log' | 'stats' | 'codex';
type CTab = 'monsters' | 'spells' | 'runes' | 'places';

/** Monsters met, spells and runes found, places and regions discovered. */
function Codex() {
  const g = ui.game;
  ui.version.value;
  const [tab, setTab] = useState<CTab>('monsters');
  const cx = g.codex as { monsters: string[]; spells: string[]; runes: string[] };
  const kills = g.state.byType as Record<string, number>;
  const tpls = Object.values(TEMPLATES), runes = Object.values(RUNES).sort((a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name));
  const pois = (g.map?.discoveredPois?.() ?? []) as any[];
  const counts: Record<CTab, string> = {
    monsters: `${cx.monsters.length}/${BESTIARY_ORDER.length}`, spells: `${cx.spells.length}/${tpls.length}`,
    runes: `${cx.runes.length}/${runes.length}`, places: String(pois.length)
  };
  return (
    <div class="vs-codex">
      <div class="vs-subtabs">
        {([['monsters', 'Bestiary'], ['spells', 'Spells'], ['runes', 'Runes'], ['places', 'Places']] as const).map(([id, label]) => (
          <button key={id} class={`vs-btn${tab === id ? ' on' : ''}`} data-ctab={id} onClick={() => setTab(id)}>{label} <small>{counts[id]}</small></button>
        ))}
      </div>
      {tab === 'monsters' && BESTIARY_ORDER.map((type) => {
        if (!cx.monsters.includes(type)) return <div key={type} class="vs-cx unknown"><span class="pic">?</span><span><b>Not yet met</b></span></div>;
        const b = bestiaryEntry(type)!;
        const pic = portrait(g, type);
        return (
          <div key={type} class="vs-cx" data-monster={type}>
            <span class="pic">{pic ? <img src={pic} alt="" /> : <Icon name="skull" />}</span>
            <span class="tx">
              <b>{b.name}</b>{b.boss && <span class="vs-tag">warlord</span>}{b.flying && <span class="vs-tag">flies</span>}
              <small>{b.behaviour}</small>
              <small class="num">Health {b.health} · damage {b.damage} at level 1 · {b.speed}{b.armor ? ` · armour ${Math.round(b.armor * 100)}%` : ''} · defeated {kills[type] || 0}</small>
            </span>
          </div>
        );
      })}
      {tab === 'spells' && tpls.map((t) => (cx.spells.includes(t.id)
        ? <div key={t.id} class="vs-cx"><span class="pic"><Icon name={t.icon} /></span><span class="tx"><b>{t.name}</b> <span class="vs-tag">{CORE_INFO[t.core].name}</span><span class="vs-tag">{t.mode === 'auto' ? 'auto-cast' : 'active'}</span><small>{t.desc}</small></span></div>
        : <div key={t.id} class="vs-cx unknown"><span class="pic">?</span><span><b>Undiscovered spell</b></span></div>))}
      {tab === 'runes' && runes.map((r) => (cx.runes.includes(r.id)
        ? <div key={r.id} class="vs-cx"><span class="pic"><Icon name={r.icon} /></span><span class="tx"><b>{r.name}</b> <span class="vs-tag">{RARITY_NAMES[r.rarity]}</span><small>{r.desc}</small></span></div>
        : <div key={r.id} class="vs-cx unknown"><span class="pic">?</span><span><b>Undiscovered rune</b> <span class="vs-tag">{RARITY_NAMES[r.rarity]}</span></span></div>))}
      {tab === 'places' && (
        <>
          <div class="vs-sec">REGIONS</div>
          {!g.regionsSeen?.size && <div class="vs-empty">None yet.</div>}
          <div class="vs-kinds">{[...(g.regionsSeen ?? [])].map((id: string) => { const r = g.overworld.region(id); return <span key={id}><b>{r.title.charAt(0).toUpperCase() + r.title.slice(1)}</b></span>; })}</div>
          <div class="vs-sec">PLACES</div>
          {!pois.length && <div class="vs-empty">None yet. Places appear on the map as you explore.</div>}
          {pois.map((p) => {
            const v = g.visited[p.id];
            // towns: visited or not; caves, ruins and dungeons: how much of them is done
            const prog = v && p.type !== 'city' ? g.dungeons?.progress(p) : null;
            const state = prog ? progressText(prog) : v || g.session?.cities?.some((c: { id: string }) => c.id === p.id) ? 'visited' : 'seen from afar';
            return (
              <div key={p.id} class="vs-cx" data-place={p.id}>
                <span class="pic"><Icon name={p.dungeon ? 'lair' : POI_INFO[p.type as keyof typeof POI_INFO]?.icon ?? 'map'} /></span>
                <span class="tx"><b>{p.name}</b><small>{(POI_INFO[p.type as keyof typeof POI_INFO]?.label ?? p.type)}{p.dungeon ? ' (dungeon)' : ''} · {GROUP_INFO[p.group as keyof typeof GROUP_INFO]?.name ?? ''} · {state}</small></span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/** Kills, distance, gold and the rest, read from the running game. */
function Stats() {
  const g = ui.game;
  ui.version.value;                       // refresh while open
  const s = g.state;
  const byType = Object.entries(s.byType as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const name = (k: string) => g.enemyTypes?.[k]?.name ?? k;
  const rows: [string, string, string][] = [
    ['timer', 'Play time', formatPlayTime(s.time)],
    ['skull', 'Monsters defeated', String(s.kills)],
    ['lair', 'Warlords and bosses defeated', String(s.bossesDefeated)],
    ['road', 'Distance travelled', `${(s.distance / 48 / 1000).toFixed(2)} km`],
    ['res-gold', 'Gold earned', String(Math.round(s.goldEarned))],
    ['place-town', 'Places discovered', String(g.map?.discoveredPois?.().length ?? 0)],
    ['map', 'Regions discovered', String(g.regionsSeen?.size ?? 0)],
    ['heart', 'Party wipes', String(s.deaths)]
  ];
  return (
    <div class="vs-stats">
      {rows.map(([icon, label, value]) => <div key={label} class="vs-stat"><Icon name={icon} /><span>{label}</span><b>{value}</b></div>)}
      <div class="vs-sec">MONSTERS BY KIND</div>
      {!byType.length && <div class="vs-empty">None yet.</div>}
      <div class="vs-kinds">{byType.slice(0, 24).map(([k, n]) => <span key={k}>{name(k)} <b>{n}</b></span>)}</div>
    </div>
  );
}

function Log() {
  const log = ui.log.value;
  if (!log.length) return <div class="vs-empty">Nothing yet. Discoveries, loot, quests and level-ups are listed here.</div>;
  return (
    <ul class="vs-log">
      {[...log].reverse().map((e, i) => (
        <li key={log.length - i} class={e.big ? 'big' : ''}>
          <span class="t">{formatPlayTime(e.t).replace('under a minute', '0 min')}</span>
          {e.icon ? <Icon name={e.icon} /> : <i class="dot" />}
          <span class="x">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The Journal page of the game menu: quests, the message log, statistics and the codex. */
export function JournalPage() {
  const [tab, setTab] = useState<JTab>('quests');
  const v = ui.quests.value;
  const game = ui.game;
  if (!game || !v) return <div class="vs-page vs-journal"><h2><Icon name="journal" /> Journal</h2><div class="vs-empty">Nothing written yet.</div></div>;
  return (
    <div class="vs-page vs-journal">
      <h2><Icon name="journal" /> Journal</h2>
      <div class="vs-tabs" role="tablist">
        {([['quests', 'Quests', 'scroll'], ['log', 'Log', 'journal'], ['stats', 'Statistics', 'gauge'], ['codex', 'Codex', 'codex']] as const).map(([id, label, icon]) => (
          <button key={id} class={`vs-btn vs-tab${tab === id ? ' on' : ''}`} role="tab" aria-selected={tab === id} data-jtab={id} onClick={() => setTab(id)}>
            <Icon name={icon} /><span class="tl">{label}</span>
          </button>
        ))}
      </div>
      {tab === 'log' && <Log />}
      {tab === 'stats' && <Stats />}
      {tab === 'codex' && <Codex />}
      {tab === 'quests' && (
        <>
      {!v.begun && <div class="sub">Find the Elder in a town: the old stories say someone should speak with you. Nothing here is required, ever.</div>}
      {v.chapter && <div class="vs-sec">{v.chapter.title.toUpperCase()}</div>}
      {v.chapter && <div class="sub">{v.chapter.blurb}</div>}
      {v.main && (
        <QuestCard q={v.main}>
          <button class="vs-btn" onClick={() => game.quests.track(v.main!.id)}><Icon name={v.main.tracked ? 'radio-on' : 'radio-off'} /> {v.main.tracked ? 'Tracking' : 'Track'}</button>
        </QuestCard>
      )}
      {!v.main && v.next && v.begun && (
        <div class="vs-quest">
          <div class="hd"><b>{v.next.title}</b>{v.next.level > 0 && <span class="vs-tag">Lv {v.next.level}</span>}</div>
          <div class="sub">{v.next.summary}</div>
          <div class="rw">{v.next.status === 'offer' ? 'Speak with the Elder in any town to take this on.' : 'Not available yet: grow stronger first.'}</div>
        </div>
      )}
      <div class="vs-sec">BOUNTIES AND JOBS ({v.bounties.length})</div>
      {!v.bounties.length && <div class="vs-empty">None taken. Bounty boards stand in every town; townsfolk and innkeepers have work too.</div>}
      {v.bounties.map((q) => (
        <QuestCard key={q.id} q={q}>
          <button class="vs-btn" onClick={() => game.quests.track(q.id)}><Icon name={q.tracked ? 'radio-on' : 'radio-off'} /> {q.tracked ? 'Tracking' : 'Track'}</button>
          <button class="vs-btn" onClick={() => game.quests.abandon(q.id)}>Drop</button>
        </QuestCard>
      ))}
      {!!v.standing?.length && (
        <>
          <div class="vs-sec">STANDING</div>
          {v.standing.map((st) => <div key={st.town} class="vs-strow"><span>{st.town}</span><Standing s={st} /></div>)}
        </>
      )}
      <div class="vs-sec">THE DEMON HOST</div>
      <div class="vs-lords">
        {v.lords.map((l) => <span key={l.group} class={`vs-lord${l.dead ? ' dead' : ''}`}><Icon name={l.dead ? 'skull' : 'lord'} /> {l.name}, {l.title}</span>)}
        <span class={`vs-lord sov${v.sovereign.dead ? ' dead' : ''}`}><Icon name={v.sovereign.dead ? 'skull' : 'crown'} /> {v.sovereign.name}, {v.sovereign.title}</span>
      </div>
      <div class="sub">{v.done} quest{v.done === 1 ? '' : 's'} finished.</div>
        </>
      )}
    </div>
  );
}

export function BoardPanel() {
  const b = ui.board.value;
  const game = ui.game;
  if (!ui.boardOpen.value || !b || !game) return null;
  const mins = Math.floor(b.nextIn / 60), secs = String(b.nextIn % 60).padStart(2, '0');
  return (
    <div class="vs-panel vs-board hit" role="dialog" aria-label="Bounty board">
      <button class="vs-btn vs-x" onClick={() => game.closeNpcPanels()} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="board" /> {b.town} bounty board</h2>
      <div class="sub">Side jobs, never required. New postings in {mins}:{secs}. Press {glyph('cancel')} to close.</div>
      {b.standing && <Standing s={b.standing} />}
      <div class="vs-sec">POSTED</div>
      <div class="vs-goods">
        {b.offers.map((o) => (
          <div key={o.slot} class={`vs-good${o.taken ? ' sold' : ''}`} style={{ '--gc': '#ffd070' }}>
            <span class="ic"><Icon name="scroll" /></span>
            <span class="tx">
              <b>{o.title}{o.level > 0 && <span class="vs-tag">Lv {o.level}</span>}</b>
              <small>{o.summary}</small>
              <small>{o.lines.join(' · ')}</small>
              <small class="cost">{o.reward}</small>
            </span>
            <button class="vs-btn" disabled={o.taken} onClick={() => game.quests.acceptBounty(o.slot)}>{o.taken ? 'Taken' : 'Accept'}</button>
          </div>
        ))}
      </div>
      <div class="vs-sec">YOUR BOUNTIES ({b.mine.length})</div>
      {!b.mine.length && <div class="vs-empty">You have not taken any.</div>}
      {b.mine.map((q) => (
        <QuestCard key={q.id} q={q}>
          <button class="vs-btn" disabled={!q.ready || !q.payable} onClick={() => game.quests.turnInQuest(q.id)}>{q.ready ? (q.payable ? 'Claim reward' : 'Bring the goods') : 'In progress'}</button>
          <button class="vs-btn" onClick={() => game.quests.abandon(q.id)}>Drop</button>
        </QuestCard>
      ))}
    </div>
  );
}

/** The tracked quest in one or two lines: its title and the next thing to do. Tap it for the journal. */
export function Tracker() {
  const q = ui.tracker.value;
  if (!q || !ui.settings.value.tracker) return null;
  const next = q.objectives.find((o) => !o.done);
  const left = q.objectives.filter((o) => !o.done).length;
  return (
    <button class="vs-tracker hit" tabIndex={-1} title="Open the journal" onClick={() => ui.game?.ui.openMenu('journal')}>
      <div class="t"><Icon name={q.kind === 'main' ? 'journal' : q.kind === 'job' ? 'person' : 'board'} /> {q.title}</div>
      {q.ready
        ? <div class="r">{q.back ?? (q.giver === 'elder' ? 'Return to the Elder' : 'Claim at a bounty board')}</div>
        : next && <div class="o"><Icon name="box" /> {next.text}{next.progress ? ` (${next.progress})` : ''}{left > 1 ? <span class="more"> +{left - 1}</span> : null}</div>}
    </button>
  );
}
