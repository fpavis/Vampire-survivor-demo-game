import { ui, type QuestView } from './bridge';
import { glyph, quickGlyph } from './hints';
import { Icon } from './Icon';

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

function QuestCard({ q, children }: { q: QuestView; children?: any }) {
  return (
    <div class={`vs-quest${q.ready ? ' ready' : ''}${q.tracked ? ' tracked' : ''}`}>
      <div class="hd"><b>{q.title}</b>{q.level > 0 && <span class="vs-tag">Lv {q.level}</span>}{q.ready && <span class="vs-tag ok">ready</span>}</div>
      <div class="sub">{q.summary}</div>
      <Objectives q={q} />
      {q.reward && <div class="rw">Reward: {q.reward}</div>}
      <div class="vs-acts">{children}</div>
    </div>
  );
}

export function Journal() {
  const v = ui.quests.value;
  const game = ui.game;
  if (!ui.journalOpen.value || !game || !v) return null;
  return (
    <div class="vs-panel vs-journal hit">
      <button class="vs-btn vs-x" onClick={() => (ui.journalOpen.value = false)}><Icon name="close" /> ({quickGlyph('journal')})</button>
      <h2><Icon name="journal" /> Journal</h2>
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
      <div class="vs-sec">BOUNTIES ({v.bounties.length})</div>
      {!v.bounties.length && <div class="vs-empty">None taken. Bounty boards stand in every town.</div>}
      {v.bounties.map((q) => (
        <QuestCard key={q.id} q={q}>
          <button class="vs-btn" onClick={() => game.quests.track(q.id)}><Icon name={q.tracked ? 'radio-on' : 'radio-off'} /> {q.tracked ? 'Tracking' : 'Track'}</button>
          <button class="vs-btn" onClick={() => game.quests.abandon(q.id)}>Drop</button>
        </QuestCard>
      ))}
      <div class="vs-sec">THE DEMON HOST</div>
      <div class="vs-lords">
        {v.lords.map((l) => <span key={l.group} class={`vs-lord${l.dead ? ' dead' : ''}`}><Icon name={l.dead ? 'skull' : 'lord'} /> {l.name}, {l.title}</span>)}
        <span class={`vs-lord sov${v.sovereign.dead ? ' dead' : ''}`}><Icon name={v.sovereign.dead ? 'skull' : 'crown'} /> {v.sovereign.name}, {v.sovereign.title}</span>
      </div>
      <div class="sub">{v.done} quest{v.done === 1 ? '' : 's'} finished.</div>
    </div>
  );
}

export function BoardPanel() {
  const b = ui.board.value;
  const game = ui.game;
  if (!ui.boardOpen.value || !b || !game) return null;
  const mins = Math.floor(b.nextIn / 60), secs = String(b.nextIn % 60).padStart(2, '0');
  return (
    <div class="vs-panel vs-board hit">
      <button class="vs-btn vs-x" onClick={() => game.closeNpcPanels()} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="board" /> {b.town} bounty board</h2>
      <div class="sub">Side jobs, never required. New postings in {mins}:{secs}. Press {glyph('cancel')} to close.</div>
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
  if (!q) return null;
  const next = q.objectives.find((o) => !o.done);
  const left = q.objectives.filter((o) => !o.done).length;
  return (
    <button class="vs-tracker hit" tabIndex={-1} title="Open the journal" onClick={() => ui.game?.input.openPanel('journal')}>
      <div class="t"><Icon name={q.kind === 'main' ? 'journal' : 'board'} /> {q.title}</div>
      {q.ready
        ? <div class="r">{q.giver === 'elder' ? 'Return to the Elder' : 'Claim at a bounty board'}</div>
        : next && <div class="o"><Icon name="box" /> {next.text}{next.progress ? ` (${next.progress})` : ''}{left > 1 ? <span class="more"> +{left - 1}</span> : null}</div>}
    </button>
  );
}
