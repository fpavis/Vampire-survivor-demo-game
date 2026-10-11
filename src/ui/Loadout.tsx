import { useEffect, useState } from 'preact/hooks';
import { ui } from './bridge';
import { beginDrag, checkDrop, configureDnd, dragging, type DropTarget, type Payload } from './dnd';
import {
  CORE_INFO, RARITY_NAMES, RUNES, TEMPLATES, canSocket, describeSpell, previewRune, resolveSpell, spellXpFor, type SpellItem
} from '../core/spells/spells';
import { runeValue, spellValue } from '../core/loot/loot';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const RC = ['#9aa4b2', '#4aa8ff', '#b765ff', '#ffc233', '#ff7a5a'];
const MAX_AUTO = 5;

type SpellSort = 'level' | 'name' | 'type';
type RuneSort = 'rarity' | 'name';

/** Wires the DnD engine to the live game. */
function useDndWiring() {
  useEffect(() => {
    const game = ui.game;
    const sp = () => game.spells;
    const validate = (p: Payload, t: DropTarget) => {
      if (p.kind === 'rune') {
        if (t.type === 'socket') {
          const it: SpellItem | undefined = sp().item(t.uid!);
          if (!it) return { ok: false };
          // moving within the same spell: pretend the source socket is empty
          const probe: SpellItem = typeof p.from === 'object' && p.from.uid === it.uid
            ? { ...it, runes: it.runes.map((r, i) => (i === (p.from as any).slot ? null : r)) } : it;
          return canSocket(probe, p.id, t.slot!);
        }
        if (t.type === 'bag') return typeof p.from === 'object' ? { ok: true } : { ok: false };
        if (t.type === 'salvage') return p.from === 'bag' ? { ok: true } : { ok: false, reason: 'Take it out of the socket first' };
        return { ok: false };
      }
      const it: SpellItem | undefined = sp().item(p.uid);
      if (!it) return { ok: false };
      const mode = TEMPLATES[it.tpl].mode;
      if (t.type === 'equip') {
        if (t.slot === undefined) {
          if (mode !== 'auto') return { ok: false, reason: 'Active skills go into the Space / Q / R slots' };
          if (sp().auto.includes(it.uid)) return { ok: false };
          return sp().auto.length >= MAX_AUTO ? { ok: false, reason: 'All auto-cast slots are full' } : { ok: true };
        }
        return mode === 'active' ? { ok: true } : { ok: false, reason: 'Only active skills fit in these slots' };
      }
      if (t.type === 'unequip') return sp().equipped(it.uid) ? { ok: true } : { ok: false };
      if (t.type === 'salvage') {
        if (sp().equipped(it.uid)) return { ok: false, reason: 'Unequip it before salvaging' };
        return it.locked ? { ok: false, reason: 'Locked 🔒 — unlock it first' } : { ok: true };
      }
      return { ok: false };
    };
    const commit = (p: Payload, t: DropTarget) => {
      const s = sp();
      if (p.kind === 'rune') {
        if (typeof p.from === 'object') s.unsocket(p.from.uid, p.from.slot);
        if (t.type === 'socket') s.socket(t.uid!, p.id, t.slot!);
        else if (t.type === 'salvage') game.toastGold(game.salvageRune(p.id));
      } else if (t.type === 'equip') s.equip(p.uid, t.slot ?? -1);
      else if (t.type === 'unequip') s.unequip(p.uid);
      else if (t.type === 'salvage') game.toastGold(game.salvageSpell(p.uid));
      game.audio.play('equip');
    };
    configureDnd(validate, commit, (r) => game.ui.toast(r));
  }, []);
}

function Ghost() {
  const d = dragging.value;
  if (!d) return null;
  return <div class="vs-ghost" style={{ left: `${d.x}px`, top: `${d.y}px` }}>{d.label}</div>;
}

function dropClass(t: DropTarget): string {
  const d = dragging.value;
  if (!d) return '';
  const chk = checkDrop(d.payload, t);
  const h = d.hover;
  const over = h && h.type === t.type && h.uid === t.uid && h.slot === t.slot;
  return ` ${chk.ok ? 'can' : 'cant'}${over ? ' over' : ''}`;
}

function SpellRow({ it, sel, onSel }: { it: SpellItem; sel: boolean; onSel: () => void }) {
  const t = TEMPLATES[it.tpl];
  const core = CORE_INFO[t.core];
  const game = ui.game;
  return (
    <div class={`vs-item${sel ? ' sel' : ''}`} tabIndex={0} style={{ touchAction: 'none' }}
      onKeyDown={(e) => { if (e.key === 'Enter') onSel(); }}
      onPointerDown={(e) => beginDrag(e as any, { kind: 'spell', uid: it.uid }, `${t.icon} ${t.name}`, onSel)}>
      <span class="ic">{t.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{t.name}</b> <span style={{ color: hex(core.color) }}>· {core.name}</span>
        <small>Lv {it.level}{it.level < t.max ? ` · ${it.xp}/${spellXpFor(it.level)} xp` : ' · MAX'} · {t.mode === 'auto' ? 'auto' : 'active'}</small>
      </span>
      <span>{it.runes.map((r) => (r ? RUNES[r].icon : '◦')).join(' ')}</span>
      <button class="vs-lockb" title={it.locked ? 'Locked: cannot be salvaged' : 'Lock to protect from salvage'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); it.locked = !it.locked; game.spells.touch(); }}>{it.locked ? '🔒' : '🔓'}</button>
    </div>
  );
}

export function Loadout() {
  ui.version.value;
  useDndWiring();
  const [selUid, setSel] = useState<string | null>(null);
  const [selRune, setRune] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [spellSort, setSpellSort] = useState<SpellSort>('level');
  const [runeSort, setRuneSort] = useState<RuneSort>('rarity');
  const [fitsOnly, setFits] = useState(false);
  const game = ui.game;
  if (!ui.loadoutOpen.value || !game) return null;
  const sp = game.spells;
  const wallet = ui.wallet.value;
  const all: SpellItem[] = sp.spells;
  const item: SpellItem | undefined = all.find((s) => s.uid === selUid) ?? all[0];
  const tpl = item ? TEMPLATES[item.tpl] : null;
  const resolved = item ? resolveSpell(item) : null;
  const ql = q.trim().toLowerCase();

  const spellMatches = (s: SpellItem) => !ql || TEMPLATES[s.tpl].name.toLowerCase().includes(ql) || CORE_INFO[TEMPLATES[s.tpl].core].name.toLowerCase().includes(ql);
  const cmpSpell = (a: SpellItem, b: SpellItem) =>
    spellSort === 'level' ? b.level - a.level : spellSort === 'name' ? TEMPLATES[a.tpl].name.localeCompare(TEMPLATES[b.tpl].name) : TEMPLATES[a.tpl].mode.localeCompare(TEMPLATES[b.tpl].mode);
  const autoEq = (sp.auto.map((u: string) => sp.item(u)).filter(Boolean) as SpellItem[]).filter(spellMatches);
  const bagSpells = all.filter((s) => !sp.equipped(s.uid) && spellMatches(s)).sort(cmpSpell);

  const firstEmpty = item ? Math.max(0, item.runes.findIndex((r) => r === null)) : 0;
  const runeCounts: Record<string, number> = {};
  for (const r of sp.runes as string[]) runeCounts[r] = (runeCounts[r] || 0) + 1;
  const runeIds = Object.keys(runeCounts)
    .filter((id) => !ql || RUNES[id].name.toLowerCase().includes(ql))
    .filter((id) => !fitsOnly || (item && canSocket(item, id, firstEmpty).ok))
    .sort((a, b) => (runeSort === 'rarity' ? RUNES[b].rarity - RUNES[a].rarity || a.localeCompare(b) : RUNES[a].name.localeCompare(RUNES[b].name)));

  const trySocket = (slot: number) => {
    if (!item) return;
    if (selRune) {
      if (!canSocket(item, selRune, slot).ok) return;
      sp.socket(item.uid, selRune, slot);
      game.audio.play('equip');
      setRune(null);
    } else if (item.runes[slot]) sp.unsocket(item.uid, slot);
  };
  const preview = item && selRune ? previewRune(item, selRune, firstEmpty) : [];
  const selReason = item && selRune ? canSocket(item, selRune, firstEmpty).reason : undefined;

  return (
    <div class="vs-panel vs-load hit">
      <button class="vs-btn vs-x" onClick={() => (ui.loadoutOpen.value = false)}>✕ (I)</button>
      <h2>Spells &amp; Runes</h2>
      <div class="sub">Drag spells and runes (or click, then click a target). Greyed runes don’t fit — hover for why. Changes apply instantly.</div>
      <div class="vs-tools">
        <input class="vs-in" placeholder="Search…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <label>Spells <select class="vs-in" value={spellSort} onChange={(e) => setSpellSort((e.target as HTMLSelectElement).value as SpellSort)}><option value="level">by level</option><option value="name">by name</option><option value="type">by type</option></select></label>
        <label>Runes <select class="vs-in" value={runeSort} onChange={(e) => setRuneSort((e.target as HTMLSelectElement).value as RuneSort)}><option value="rarity">by rarity</option><option value="name">by name</option></select></label>
      </div>
      <div class="vs-cols">
        <div>
          <div class="vs-sec">AUTO-CAST ({autoEq.length}/{MAX_AUTO}) — free, always firing</div>
          <div class={`vs-zone${dropClass({ type: 'equip' })}`} data-drop="equip">
            {autoEq.map((s) => <SpellRow key={s.uid} it={s} sel={item?.uid === s.uid} onSel={() => setSel(s.uid)} />)}
            {!autoEq.length && <div class="vs-empty">Drop an auto-cast spell here</div>}
          </div>
          <div class="vs-sec">ACTIVE SKILLS — cost mana</div>
          <div class="vs-actives">
            {[0, 1, 2].map((i) => {
              const s = sp.active[i] ? sp.item(sp.active[i]) : null;
              return (
                <div key={i} class={`vs-azone${dropClass({ type: 'equip', slot: i })}`} data-drop="equip" data-slot={i}>
                  <div class="vs-key">{['Space', 'Q', 'R'][i]}</div>
                  {s && spellMatches(s) ? <SpellRow it={s} sel={item?.uid === s.uid} onSel={() => setSel(s.uid)} /> : <div class="vs-empty">{s ? '(hidden by search)' : 'empty'}</div>}
                </div>
              );
            })}
          </div>
          <div class="vs-sec">SPELL BAG ({bagSpells.length})</div>
          <div class={`vs-zone${dropClass({ type: 'unequip' })}`} data-drop="unequip">
            {bagSpells.map((s) => <SpellRow key={s.uid} it={s} sel={item?.uid === s.uid} onSel={() => setSel(s.uid)} />)}
            {!bagSpells.length && <div class="vs-empty">Nothing here. Drop spells to unequip them.</div>}
          </div>
        </div>
        <div>
          {item && tpl && resolved && (
            <>
              <div class="vs-sec">SELECTED</div>
              <div><b>{tpl.icon} {tpl.name}</b> — {tpl.desc}</div>
              <div class="vs-tip">{describeSpell(resolved).join('  ·  ')}</div>
              <div class="vs-socks">
                {item.runes.map((r: string | null, i: number) => {
                  const target: DropTarget = { type: 'socket', uid: item.uid, slot: i };
                  return (
                    <button key={i} class={`vs-sock${r ? ' full' : ''}${selRune && canSocket(item, selRune, i).ok ? ' drop' : ''}${dropClass(target)}`}
                      data-drop="socket" data-uid={item.uid} data-slot={i} style={{ touchAction: 'none' }}
                      title={r ? `${RUNES[r].name}: ${RUNES[r].desc} (click to remove, or drag out)` : 'Empty socket'}
                      onPointerDown={(e) => { if (r) beginDrag(e as any, { kind: 'rune', id: r, from: { uid: item.uid, slot: i } }, `${RUNES[r].icon} ${RUNES[r].name}`, () => trySocket(i)); }}
                      onClick={() => { if (!r) trySocket(i); }}>
                      {r ? RUNES[r].icon : '+'}
                    </button>
                  );
                })}
              </div>
              <div class="vs-sec">RUNES IN BAG ({sp.runes.length})
                <label class="vs-fit"><input type="checkbox" checked={fitsOnly} onChange={(e) => setFits((e.target as HTMLInputElement).checked)} /> fits selected spell</label>
              </div>
              <div class={`vs-zone vs-runes${dropClass({ type: 'bag' })}`} data-drop="bag">
                {!runeIds.length && <div class="vs-empty">{sp.runes.length ? 'No runes match.' : 'No runes yet. Rare drops from enemies, chests and altars.'}</div>}
                {runeIds.map((id) => {
                  const def = RUNES[id];
                  const chk = canSocket(item, id, firstEmpty);
                  return (
                    <div key={id} class={`vs-rune${selRune === id ? ' sel' : ''}${chk.ok ? '' : ' bad'}`} tabIndex={0} style={{ touchAction: 'none', borderColor: selRune === id ? undefined : RC[def.rarity] }}
                      title={`${def.name} (${RARITY_NAMES[def.rarity]}) — ${chk.ok ? def.desc : chk.reason}`}
                      onKeyDown={(e) => { if (e.key === 'Enter') setRune(selRune === id ? null : id); }}
                      onPointerDown={(e) => beginDrag(e as any, { kind: 'rune', id, from: 'bag' }, `${def.icon} ${def.name}`, () => setRune(selRune === id ? null : id))}>
                      <span class="ic">{def.icon}</span>{def.name}{runeCounts[id] > 1 ? ` ×${runeCounts[id]}` : ''}
                    </div>
                  );
                })}
              </div>
              <div class="vs-tip">
                {selRune && <b>{RUNES[selRune].name}: {RUNES[selRune].desc}</b>}
                {selRune && preview.length > 0 && <div>{preview.join('  ·  ')}</div>}
                {selRune && !preview.length && selReason && <div style={{ color: '#ff9a9a' }}>✕ {selReason}</div>}
              </div>
            </>
          )}
          <div class={`vs-zone vs-salv${dropClass({ type: 'salvage' })}`} data-drop="salvage">
            ♻ Drop here to salvage for gold
            {item && !sp.equipped(item.uid) && !item.locked && <span class="vs-small"> (selected spell: {spellValue(item)}g)</span>}
          </div>
          <div class="vs-foot">
            <span title="Gold">🪙 {wallet.gold}</span> <span title="Wood">🪵 {wallet.wood}</span> <span title="Stone">🪨 {wallet.stone}</span> <span title="Iron">⛓ {wallet.iron}</span>
            <label>Auto-salvage drops:{' '}
              <select class="vs-in" value={ui.filter.value} onChange={(e) => { const v = (e.target as HTMLSelectElement).value as any; ui.filter.value = v; game.state.lootFilter = v; }}>
                <option value="off">off</option><option value="basic">basic runes</option><option value="advanced">basic + advanced</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <Ghost />
    </div>
  );
}
export { runeValue };
