import { encodeSave, toBase64, fromBase64, decodeSave } from '../core/save/codec';
import { buildSave } from './saveManager';
import { tierName } from '../core/world/difficulty';
import { RUNES, TEMPLATES } from '../core/spells/spells';
import * as PIXI from 'pixi.js';
import { EntityManager } from '../render/entities';
import { ENEMY_TYPES } from '../core/config';
import * as towersApi from '../core/world/towers';
import { engage } from '../core/ai/ai';
import { BIOME } from '../core/world/biomes';
import { iconDef } from '../core/icons/icons';

declare const __BUILD_INFO__: string;
declare const __DEVTOOLS_BUTTON__: boolean;

const css = `
#devtools{position:fixed;top:8px;left:8px;z-index:99999;width:292px;max-height:calc(100vh - 16px);overflow:auto;
 background:rgba(8,12,22,.94);color:#dfe8ff;font:12px/1.35 system-ui,sans-serif;border:1px solid #3a4a70;border-radius:10px;padding:10px;display:none}
#devtools h4{margin:8px 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8fb6ff}
#devtools button{background:#1d2a4a;color:#e8f0ff;border:1px solid #3a4a70;border-radius:6px;padding:4px 7px;margin:2px 2px 0 0;cursor:pointer;font:inherit}
#devtools button:hover{background:#2c4070}
#devtools .info{white-space:pre;font-family:ui-monospace,monospace;font-size:11px;color:#b8c8e8}
#devtools .row{display:flex;flex-wrap:wrap}
#devtoggle{position:fixed;right:10px;bottom:10px;z-index:99998;background:rgba(8,12,22,.85);color:#fff;border:1px solid #3a4a70;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer}
`;

export function installDevTools(game: any): void {
  // handles for scripted visual checks (scripts/artsheet.mjs)
  (window as any).__dev = { PIXI, EntityManager, ENEMY_TYPES, game, towersApi, engage, BIOME };
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'devtools';
  document.body.appendChild(panel);

  const info = document.createElement('div');
  info.className = 'info';
  panel.appendChild(info);

  const section = (title: string) => {
    const h = document.createElement('h4');
    h.textContent = title;
    panel.appendChild(h);
    const row = document.createElement('div');
    row.className = 'row';
    panel.appendChild(row);
    return row;
  };
  const button = (row: HTMLElement, label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = (ev) => { ev.stopPropagation(); fn(); (b as any).blur(); };
    row.appendChild(b);
  };
  const ready = () => !!game.state.player && !game.busy;

  let angle = 0.7;
  const teleportTiles = (tiles: number) => {
    if (!ready()) return;
    if (game.mode !== 'overworld') { game.ui.toast('Leave the place first'); return; }
    angle += 2.399;   // golden angle: different direction every time
    const p = game.state.player;
    const x = p.wx + Math.cos(angle) * tiles * 48, y = p.wy + Math.sin(angle) * tiles * 48;
    const f = game.world.findFree(x, y, 14);
    p.wx = f.x; p.wy = f.y;
    game.cam.x = p.wx; game.cam.y = p.wy;
    game.world.update(p.wx, p.wy, game.app.screen.width, game.app.screen.height, true);
    game.lastFogTx = null;
  };
  const toDistance = (tiles: number) => {
    if (!ready() || game.mode !== 'overworld') return;
    angle += 2.399;
    const x = Math.cos(angle) * tiles * 48, y = Math.sin(angle) * tiles * 48;
    const f = game.world.findFree(x, y, 14);
    const p = game.state.player;
    p.wx = f.x; p.wy = f.y; game.cam.x = p.wx; game.cam.y = p.wy;
    game.world.update(p.wx, p.wy, game.app.screen.width, game.app.screen.height, true);
    game.lastFogTx = null;
  };

  const tp = section('Travel (distance from start, in tiles)');
  for (const d of [100, 400, 900, 2200, 5000, 13000]) button(tp, `${d}`, () => toDistance(d));
  button(tp, 'Home', () => toDistance(0));
  const nearest = (kind: 'poi' | 'lair') => {
    if (!ready() || game.mode !== 'overworld') return;
    const p = game.state.player;
    const ptx = Math.floor(p.wx / 48), pty = Math.floor(p.wy / 48);
    let best: any = null, bd = Infinity;
    for (let r = 0; r < 60; r++) {
      for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
        if (kind === 'poi') {
          const q = game.overworld.poiForCell(Math.floor(ptx / 16) + cx, Math.floor(pty / 16) + cy);
          if (q) { const d = Math.hypot(q.ex - p.wx, q.ey - p.wy); if (d < bd && d > 200) { bd = d; best = { x: q.ex, y: q.ey + 20 }; } }
        } else {
          const l = game.popRuntime.population.lairForCell(Math.floor(ptx / 64) + cx, Math.floor(pty / 64) + cy);
          if (l && !game.session.defeatedLairs[l.id]) { const d = Math.hypot(l.x - p.wx, l.y - p.wy); if (d < bd) { bd = d; best = { x: l.x - 360, y: l.y }; } }
        }
      }
      if (best) break;
    }
    if (!best) { game.ui.toast('None found nearby'); return; }
    const f = game.world.findFree(best.x, best.y, 14);
    p.wx = f.x; p.wy = f.y; game.cam.x = p.wx; game.cam.y = p.wy;
    game.world.update(p.wx, p.wy, game.app.screen.width, game.app.screen.height, true);
    game.lastFogTx = null;
  };
  button(tp, 'Nearest place', () => nearest('poi'));
  button(tp, 'Nearest warlord lair', () => nearest('lair'));

  const hero = section('Hero');
  button(hero, 'Heal', () => { if (ready()) game.state.health = game.state.maxHealth; });
  button(hero, '+1000 XP', () => { if (ready()) game.gainExp(1000); });
  button(hero, 'God mode', () => { game.godMode = !game.godMode; game.ui.toast(game.godMode ? 'God mode ON' : 'God mode off'); });
  button(hero, 'Speed x1', () => { game.timeScale = 1; });
  button(hero, 'x2', () => { game.timeScale = 2; });
  button(hero, 'x4', () => { game.timeScale = 4; });

  const loot = section('Spells & runes');
  button(loot, 'All spells', () => { if (ready()) for (const id of Object.keys(TEMPLATES)) if (!game.spells.spells.some((x: any) => x.tpl === id)) game.spells.addSpell(id); });
  button(loot, 'All runes', () => { if (ready()) for (const id of Object.keys(RUNES)) game.spells.addRune(id); });
  button(loot, 'Spell lv max', () => { for (const it of game.spells.spells) it.level = TEMPLATES[it.tpl].max; game.spells.touch(); });
  button(loot, '+Mana', () => { game.spells.mana.value = game.stats.maxMana; });
  button(loot, '+3 level-ups', () => { game.state.experience += game.state.nextLevel * 3; game.checkLevelUp(); });
  button(loot, 'Loot (chest)', () => { if (ready()) game.grantLoot(1); });
  const spawn = section('World');
  button(spawn, 'Warlord here', () => { if (ready() && game.mode === 'overworld') game.spawnBoss(); });
  button(spawn, 'Reveal map (60 tiles)', () => { if (ready()) { const p = game.state.player; (game.mode === 'overworld' ? game.fog : game.interiorFog).revealCircle(Math.floor(p.wx / 48), Math.floor(p.wy / 48), 60); } });
  button(spawn, 'Respawn all camps', () => { game.session.clearedCamps = {}; game.ui.toast('Camps will respawn'); });
  button(spawn, 'Kill all nearby', () => { for (const e of [...game.state.enemies]) if (!e.dead) game.damageEnemy(e, 1e9, { noCrit: true }); });

  const save = section('Save');
  button(save, 'Save now', () => { game.requestSave('manual', true); });
  button(save, 'Export', () => {
    const text = toBase64(encodeSave(buildSave(game)));
    navigator.clipboard?.writeText(text).then(() => game.ui.toast('Save copied to clipboard'), () => window.prompt('Copy your save:', text));
  });
  button(save, 'Import', async () => {
    const text = window.prompt('Paste a save:');
    if (!text) return;
    try {
      const data = decodeSave(fromBase64(text));
      await game.store.save(game.saveSlot, data);
      location.reload();
    } catch (e) { window.alert(`Not a valid save: ${(e as Error).message}`); }
  });
  button(save, 'Delete save + reload', async () => { await game.store.remove(game.saveSlot); location.reload(); });

  let timer = 0;
  const update = () => {
    if (panel.style.display === 'none') return;
    const g = game;
    if (!g.state.player) { info.textContent = `build ${__BUILD_INFO__}\n(start a game)`; return; }
    const p = g.state.player;
    const tx = Math.floor(p.wx / 48), ty = Math.floor(p.wy / 48);
    const lvl = g.mode === 'overworld' ? g.overworld.levelAt(tx, ty) : g.zoneLevelNow;
    const tier = tierName(Math.floor((lvl - 1) / 12));
    info.textContent = [
      `build ${__BUILD_INFO__}`,
      `seed ${g.overworld ? g.overworld.seed : '-'}   mode ${g.mode}`,
      `pos ${tx},${ty}  dist ${Math.round(Math.hypot(tx, ty))} tiles`,
      `zone Lv ${lvl}  ${tier || 'normal'}   hero Lv ${g.state.level}`,
      `enemies ${g.state.enemies.length}  camps ${g.popRuntime.active.size}  roamers ${g.popRuntime.roamers.length}`,
      `fog tiles ${g.fog.revealedTileCount()}`,
      `fps ${Math.round(g.app.ticker.FPS)}   storage ${g.store ? g.store.kind + (g.store.persistent ? '' : ' (NOT persistent)') : '...'}`
    ].join('\n');
  };
  game.app.ticker.add((d: number) => { timer += d; if (timer > 15) { timer = 0; update(); } });

  const toggle = () => { panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; update(); };
  window.addEventListener('keydown', (e) => { if (e.key === '`') toggle(); });
  if (__DEVTOOLS_BUTTON__) {
    const b = document.createElement('button');
    b.id = 'devtoggle';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="' + iconDef('flask').d + '"/></svg>';
    b.title = 'Test tools (or press `)';
    b.onclick = (e) => { e.stopPropagation(); toggle(); };
    document.body.appendChild(b);
  }
}
