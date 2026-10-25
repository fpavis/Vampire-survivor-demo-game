import { useEffect, useRef, useState } from 'preact/hooks';
import { ui } from './bridge';
import { glyph, onPad, quickGlyph } from './hints';
import { applyDrop, beginDrag, checkDrop, configureDnd, dragging, type DropTarget, type Payload } from './dnd';
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
      const held = sp().heldBy(it.uid);
      if (t.type === 'equip') {
        if (held) return { ok: false, reason: `${held} already has this spell equipped` };
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
        if (held) return { ok: false, reason: `${held} has it equipped` };
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
  const held = game.spells.heldBy(it.uid);
  return (
    <div class={`vs-item${sel ? ' sel' : ''}`} tabIndex={0} style={{ touchAction: 'none' }} data-spell={it.uid}
      onFocus={() => { if (ui.device.value === 'pad' || ui.device.value === 'key') onSel(); }}
      onKeyDown={(e) => { if (e.key === 'Enter') onSel(); }}
      onPointerDown={(e) => beginDrag(e as any, { kind: 'spell', uid: it.uid }, `${t.icon} ${t.name}`, onSel)}>
      <span class="ic">{t.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{t.name}</b> <span style={{ color: hex(core.color) }}>· {core.name}</span>
        <small>{held && <span class="vs-tag">on {held}</span>} Lv {it.level}{it.level < t.max ? ` · ${it.xp}/${spellXpFor(it.level)} xp` : ' · MAX'} · {t.mode === 'auto' ? 'auto' : 'active'}</small>
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
  const [picker, setPicker] = useState<number | null>(null);     // socket whose rune picker is open
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const act = useRef<(button: string, target: HTMLElement) => boolean>(() => false);
  const pickerFrom = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!panel) return;
    // controller face buttons (from nav.ts) and their keyboard twins act on the focused spell, rune or socket
    const onPadEv = (e: Event) => { if (act.current((e as CustomEvent).detail, e.target as HTMLElement)) e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const button = k === 'f' ? 'x' : k === 'l' ? 'y' : null;
      if (button && !e.repeat && act.current(button, e.target as HTMLElement)) { e.preventDefault(); e.stopPropagation(); }
    };
    panel.addEventListener('vs-pad', onPadEv);
    panel.addEventListener('keydown', onKey);
    return () => { panel.removeEventListener('vs-pad', onPadEv); panel.removeEventListener('keydown', onKey); };
  }, [panel]);
  const open = ui.loadoutOpen.value;
  useEffect(() => { if (!open) setPicker(null); }, [open]);
  const game = ui.game;
  if (!open || !game) return null;
  const sp = game.spells;
  const wallet = ui.wallet.value;
  const slotKeys = [glyph('skill1'), glyph('skill2'), glyph('skill3')];
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

  const openPicker = (slot: number) => {
    pickerFrom.current = document.activeElement as HTMLElement | null;
    setPicker(slot);
  };
  const closePicker = () => {
    setPicker(null);
    const back = pickerFrom.current;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  };
  const trySocket = (slot: number) => {
    if (!item) return;
    if (selRune) {
      if (!canSocket(item, selRune, slot).ok) return;
      sp.socket(item.uid, selRune, slot);
      game.audio.play('equip');
      setRune(null);
    } else if (item.runes[slot]) sp.unsocket(item.uid, slot);
    else openPicker(slot);
  };
  // equip or unequip; active skills take the first free Space / Q / R slot
  const toggleEquip = (it: SpellItem) => {
    if (sp.equipped(it.uid)) return applyDrop({ kind: 'spell', uid: it.uid }, { type: 'unequip' });
    if (TEMPLATES[it.tpl].mode === 'auto') return applyDrop({ kind: 'spell', uid: it.uid }, { type: 'equip' });
    const free = [0, 1, 2].find((i) => !sp.active[i]);
    return applyDrop({ kind: 'spell', uid: it.uid }, { type: 'equip', slot: free ?? 0 });
  };
  act.current = (button, target) => {
    const row = target.closest<HTMLElement>('[data-spell]');
    const sock = target.closest<HTMLElement>('[data-drop="socket"]');
    const rune = target.closest<HTMLElement>('[data-rune]');
    if (row) {
      const it = sp.item(row.dataset.spell);
      if (!it) return false;
      if (button === 'x') { toggleEquip(it); return true; }
      if (button === 'y') { it.locked = !it.locked; sp.touch(); return true; }
    }
    if (sock && item && button === 'x') {
      const slot = Number(sock.dataset.slot);
      if (item.runes[slot]) { sp.unsocket(item.uid, slot); game.audio.play('equip'); }
      else openPicker(slot);
      return true;
    }
    if (rune && item && button === 'x') {
      const id = rune.dataset.rune!;
      const slot = item.runes.findIndex((r, i) => r === null && canSocket(item, id, i).ok);
      if (slot < 0) { game.ui.toast(canSocket(item, id, firstEmpty).reason || 'No free socket fits this rune'); return true; }
      sp.socket(item.uid, id, slot);
      game.audio.play('equip');
      if (selRune === id) setRune(null);
      return true;
    }
    return false;
  };
  const preview = item && selRune ? previewRune(item, selRune, firstEmpty) : [];
  const selReason = item && selRune ? canSocket(item, selRune, firstEmpty).reason : undefined;

  return (
    <>
    <div class="vs-panel vs-load hit" ref={setPanel}>
      <button class="vs-btn vs-x" onClick={() => (ui.loadoutOpen.value = false)}>✕ ({quickGlyph('spells')})</button>
      <h2>Spells &amp; Runes — {ui.party.value.heroes[ui.party.value.active]?.name}
        <span class="vs-heroes">{ui.party.value.heroes.map((h, i) => (
          <button key={h.id} class={`vs-btn vs-hb${i === ui.party.value.active ? ' on' : ''}`} tabIndex={-1} disabled={h.dead}
            title={i === ui.party.value.active ? `${h.name}'s loadout` : `Switch to ${h.name}`} onClick={() => game.party.switchTo(i)}>{h.icon}</button>
        ))}</span>
      </h2>
      <div class="sub">Drag spells and runes, or select one and use its buttons (works with the keyboard and a controller too). Greyed runes don’t fit — hover for why. Each hero has their own loadout; a spell can be equipped by one hero at a time.</div>
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
                  <div class="vs-key">{slotKeys[i]}</div>
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
              <div class="vs-acts">
                {tpl.mode === 'auto' && !sp.equipped(item.uid) && (
                  <button class="vs-btn" onClick={() => applyDrop({ kind: 'spell', uid: item.uid }, { type: 'equip' })}>⚔ Equip</button>
                )}
                {tpl.mode === 'active' && [0, 1, 2].map((i) => (
                  <button key={i} class="vs-btn" disabled={sp.active[i] === item.uid} onClick={() => applyDrop({ kind: 'spell', uid: item.uid }, { type: 'equip', slot: i })}>
                    {sp.active[i] === item.uid ? '✔' : '→'} {slotKeys[i]} slot
                  </button>
                ))}
                {sp.equipped(item.uid) && <button class="vs-btn" onClick={() => applyDrop({ kind: 'spell', uid: item.uid }, { type: 'unequip' })}>Unequip</button>}
                <button class="vs-btn" onClick={() => applyDrop({ kind: 'spell', uid: item.uid }, { type: 'salvage' })}>♻ Salvage{!sp.equipped(item.uid) && !item.locked ? ` ${spellValue(item)}g` : ''}</button>
              </div>
              <div class="vs-socks">
                {item.runes.map((r: string | null, i: number) => {
                  const target: DropTarget = { type: 'socket', uid: item.uid, slot: i };
                  return (
                    <button key={i} class={`vs-sock${r ? ' full' : ''}${selRune && canSocket(item, selRune, i).ok ? ' drop' : ''}${dropClass(target)}`}
                      data-drop="socket" data-uid={item.uid} data-slot={i} style={{ touchAction: 'none' }}
                      title={r ? `${RUNES[r].name}: ${RUNES[r].desc} (click to remove, or drag out)` : 'Empty socket'}
                      onPointerDown={(e) => { if (r) beginDrag(e as any, { kind: 'rune', id: r, from: { uid: item.uid, slot: i } }, `${RUNES[r].icon} ${RUNES[r].name}`, () => trySocket(i)); }}
                      onClick={(e) => { if (!r || (e as MouseEvent).detail === 0) trySocket(i); }}>
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
                    <div key={id} class={`vs-rune${selRune === id ? ' sel' : ''}${chk.ok ? '' : ' bad'}`} tabIndex={0} data-rune={id} style={{ touchAction: 'none', borderColor: selRune === id ? undefined : RC[def.rarity] }}
                      title={`${def.name} (${RARITY_NAMES[def.rarity]}) — ${chk.ok ? def.desc : chk.reason}`}
                      onKeyDown={(e) => { if (e.key === 'Enter') setRune(selRune === id ? null : id); }}
                      onPointerDown={(e) => beginDrag(e as any, { kind: 'rune', id, from: 'bag' }, `${def.icon} ${def.name}`, () => setRune(selRune === id ? null : id))}>
                      <span class="ic">{def.icon}</span>{def.name}{runeCounts[id] > 1 ? ` ×${runeCounts[id]}` : ''}
                    </div>
                  );
                })}
              </div>
              {selRune && (
                <div class="vs-acts">
                  <button class="vs-btn" onClick={() => { if (applyDrop({ kind: 'rune', id: selRune, from: 'bag' }, { type: 'salvage' })) setRune(null); }}>♻ Salvage {RUNES[selRune].name} {runeValue(selRune)}g</button>
                  <button class="vs-btn" onClick={() => setRune(null)}>Put it back</button>
                </div>
              )}
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
      <HintBar />
      <Ghost />
    </div>
    {picker !== null && item && <RunePicker item={item} slot={picker} close={closePicker} />}
    </>
  );
}

/** What the buttons do here, for the device in use. */
function HintBar() {
  const pad = onPad();
  const k = (a: string) => <kbd>{a}</kbd>;
  return (
    <div class="vs-hintbar">
      {pad ? (
        <>
          <span>{k(glyph('interact'))} select / open</span>
          <span>{k(glyph('skill1'))} equip · unequip · socket</span>
          <span>{k(glyph('skill2'))} lock</span>
          <span>{k(glyph('prevHero'))}{k(glyph('nextHero'))} hero</span>
          <span>{k(glyph('cancel'))} back</span>
        </>
      ) : (
        <>
          <span>{k('Enter')} select / open</span>
          <span>{k('F')} equip · unequip · socket</span>
          <span>{k('L')} lock</span>
          <span>{k('Tab')} hero</span>
          <span>{k('Esc')} close</span>
          <span class="vs-hint-mouse">or drag with the mouse</span>
        </>
      )}
    </div>
  );
}

/** Runes from the bag that fit one socket, with what each would change. */
function RunePicker({ item, slot, close }: { item: SpellItem; slot: number; close: () => void }) {
  const game = ui.game;
  const sp = game.spells;
  const ids = [...new Set(sp.runes as string[])];
  const fit = ids.filter((id) => canSocket(item, id, slot).ok).sort((a, b) => RUNES[b].rarity - RUNES[a].rarity || a.localeCompare(b));
  const misfit = ids.length - fit.length;
  const count = (id: string) => (sp.runes as string[]).filter((r) => r === id).length;
  const tpl = TEMPLATES[item.tpl];
  return (
    <div class="vs-panel vs-picker hit">
      <button class="vs-btn vs-x" onClick={close}>✕</button>
      <h2>{tpl.icon} {tpl.name} · socket {slot + 1}</h2>
      <div class="sub">Runes that fit this socket. {misfit > 0 ? `${misfit} other rune${misfit > 1 ? 's' : ''} in your bag ${misfit > 1 ? "don't" : "doesn't"} fit.` : ''}</div>
      {!fit.length && <div class="vs-empty">{ids.length ? 'None of your runes fit this spell.' : 'No runes yet. Rare drops from enemies, chests and altars.'}</div>}
      {fit.map((id) => {
        const def = RUNES[id];
        const pv = previewRune(item, id, slot);
        return (
          <button key={id} class="vs-pick" style={{ '--rc': RC[def.rarity] }}
            onClick={() => { sp.socket(item.uid, id, slot); game.audio.play('equip'); close(); }}>
            <span class="ic">{def.icon}</span>
            <span class="tx">
              <b>{def.name}{count(id) > 1 ? ` ×${count(id)}` : ''}</b> <i>{RARITY_NAMES[def.rarity]}</i>
              <small>{def.desc}</small>
              {pv.length > 0 && <small class="pv">{pv.join('  ·  ')}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
export { runeValue };
