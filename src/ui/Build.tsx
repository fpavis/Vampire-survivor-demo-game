import { ui } from './bridge';
import { glyph, onPad } from './hints';
import { Icon } from './Icon';
import { TOWER_DEFS, TOWER_KINDS, totalOf } from '../core/world/towers';
import { CORE_INFO, TEMPLATES, describeSpell, resolveSpell } from '../core/spells/spells';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const RES: [keyof typeof TOWER_DEFS.spire.cost, string][] = [['gold', 'res-gold'], ['wood', 'res-wood'], ['stone', 'res-stone'], ['iron', 'res-iron']];

/** The Build page of the game menu: choosing a tower closes the menu and starts placing its site. */
export function BuildPage() {
  const game = ui.game;
  if (!game) return null;
  const w = ui.wallet.value;
  const where = game.mode !== 'overworld' ? 'Towers stand out in the open: step outside to build.' : game.boat ? 'Nothing can be built at sea: go ashore first.' : '';
  return (
    <div class="vs-page vs-build">
      <h2><Icon name="hammer" /> Build</h2>
      <div class="sub">Towers are monumental and permanent. Lay a site, then haul in the materials and press {glyph('interact')} at the site. No limit on how many, only on what you can gather.</div>
      {where && <div class="vs-note"><Icon name="warning" /> {where}</div>}
      <div class="vs-goods">
        {TOWER_KINDS.map((k) => {
          const d = TOWER_DEFS[k];
          return (
            <div key={k} class="vs-good" style={{ '--gc': hex(d.color) }}>
              <span class="ic"><Icon name={d.icon} /></span>
              <span class="tx">
                <b>{d.name}</b>
                <small>{d.blurb}</small>
                <small class="cost">{RES.map(([r, ic]) => <span key={r} class={w[r] >= d.cost[r] ? 'ok' : ''}><Icon name={ic} /> {d.cost[r]}{'  '}</span>)}</small>
              </span>
              <button class="vs-btn" disabled={!!where} onClick={() => game.towers.startBuild(k)}>Place</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BuildHud() {
  const b = ui.build.value;
  if (!b) return null;
  const game = ui.game;
  return (
    <div class={`vs-buildhud${b.valid ? ' ok' : ' bad'}`}>
      <div class="t"><Icon name={b.icon} /> Placing {b.name}</div>
      <div class="r">{b.valid ? (onPad() ? `Walk to move the ghost, ${glyph('interact')} lays the site, ${glyph('cancel')} cancels.` : 'Click (or press Enter) to lay the site. Esc cancels.') : <><Icon name="close" /> {b.reason}</>}</div>
      <div class="b hit">
        <button class="vs-btn" disabled={!b.valid} onClick={() => game?.towers.confirmBuild()}>Place here</button>
        <button class="vs-btn" onClick={() => game?.towers.cancelBuild()}>Cancel</button>
      </div>
    </div>
  );
}

export function TowerPanel() {
  ui.version.value;
  const id = ui.towerPanel.value;
  if (!id || !ui.game) return null;
  const game = ui.game;
  const rec = game.towers.byId(id);
  if (!rec) return null;
  const armed = rec.spell ? game.spells.item(rec.spell) : null;
  const cands = game.towers.candidates();
  const row = (s: any, action: string, fn: () => void) => {
    const t = TEMPLATES[s.tpl];
    const r = resolveSpell(s);
    return (
      <div key={s.uid} class="vs-good" style={{ '--gc': hex(CORE_INFO[t.core].color) }}>
        <span class="ic"><Icon name={t.icon} /></span>
        <span class="tx"><b>{t.name} · Lv {s.level}</b><small>{describeSpell(r).join(' · ')}</small><small>{s.runes.map((x: string | null) => (x ? '◆' : '◇')).join(' ')} runes</small></span>
        <button class="vs-btn" onClick={fn}>{action}</button>
      </div>
    );
  };
  return (
    <div class="vs-panel vs-tpanel hit">
      <button class="vs-btn vs-x" onClick={() => (ui.towerPanel.value = null)} aria-label="Close"><Icon name="close" /></button>
      <h2><Icon name="tower-spire" /> Arcane Spire</h2>
      <div class="sub">Arm it with an auto-cast spell. It fires from here at anything nearby, using the spell’s own level and runes (socket runes on the Spells page, I). Spells in a tower are not available to your heroes.</div>
      <div class="vs-sec">ARMED</div>
      {armed ? row(armed, 'Disarm', () => { game.towers.arm(id, null); ui.version.value++; }) : <div class="vs-empty">Nothing armed.</div>}
      <div class="vs-sec">SPARE SPELLS IN YOUR BAG</div>
      {!cands.length && <div class="vs-empty">No spare auto-cast spells. Unequip one from a hero, or find another.</div>}
      {cands.map((s: any) => row(s, armed ? 'Swap in' : 'Arm', () => { game.towers.arm(id, s.uid); ui.version.value++; }))}
    </div>
  );
}

export function SailingHint() {
  if (!ui.sailing.value) return null;
  return <div class="vs-sailing"><Icon name="sail" /> Sailing — {onPad() ? 'left stick' : 'WASD'} to steer · {glyph('interact')} near a shore to step off · spells still work</div>;
}

export { totalOf };
