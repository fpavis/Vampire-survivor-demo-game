import { createInterior } from '../core/world/interiors';
import { encodeSave, toBase64, fromBase64, decodeSave } from '../core/save/codec';
import { buildSave } from './saveManager';
import { tierName } from '../core/world/difficulty';
import { RUNES, TEMPLATES } from '../core/spells/spells';
import * as PIXI from 'pixi.js';
import { EntityManager } from '../render/entities';
import { ENEMY_TYPES } from '../core/config';
import * as towersApi from '../core/world/towers';
import { ui as uiBridge } from '../ui/bridge';
import { setSettings } from './settings';
import { setAccess } from './access';
import { engage } from '../core/ai/ai';
import { BIOME, isWaterBiome } from '../core/world/biomes';
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
  (window as any).__dev = { PIXI, EntityManager, ENEMY_TYPES, game, towersApi, engage, BIOME, createInterior };
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

  // ---- economy and building: materials to test construction without gathering
  const wallet = () => game.state.wallet;
  const syncWallet = () => { uiBridge.wallet.value = { ...wallet() }; };
  // where the party stands on the overworld (inside a place: its door)
  const overworldAt = () => game.mode === 'overworld' ? { x: game.state.player.wx, y: game.state.player.wy } : { x: game.interiorPoi?.ex ?? 0, y: game.interiorPoi?.ey ?? 0 };
  const tools = {
    addGold(n: number) { wallet().gold += n; syncWallet(); },
    addResources(n: number) { const w = wallet(); w.wood += n; w.stone += n; w.iron += n; syncWallet(); },
    buildKit() { const k = towersApi.buildKit(2), w = wallet(); for (const r of towersApi.RES) w[r] += k[r]; syncWallet(); game.ui.toast('Build kit: enough for every tower twice', 'build'); },
    emptyWallet() { const w = wallet(); w.gold = w.wood = w.stone = w.iron = 0; syncWallet(); },
    /** finish the nearest construction site (or every one) as if all its materials had been delivered */
    finishSites(all = false) {
      const p = game.state.player;
      const open = game.towers.recs.filter((r: any) => !r.built).sort((a: any, b: any) => Math.hypot(a.tx * 48 - p.wx, a.ty * 48 - p.wy) - Math.hypot(b.tx * 48 - p.wx, b.ty * 48 - p.wy));
      const todo = all ? open : open.slice(0, 1);
      if (!todo.length) { game.ui.toast('No construction site'); return 0; }
      for (const rec of todo) { rec.delivered = { ...towersApi.TOWER_DEFS[rec.kind as keyof typeof towersApi.TOWER_DEFS].cost }; game.towers.complete(rec); }
      return todo.length;
    },
    /** the nearest discovered-or-not places of a kind: towns ('city') or dungeons */
    nearestPlaces(kind: 'city' | 'dungeon', n = 8) {
      const out: any[] = [], at = overworldAt();
      const ptx = Math.floor(at.x / 48), pty = Math.floor(at.y / 48);
      for (let r = 0; r < 40 && out.length < n; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
        const q = game.overworld.poiForCell(Math.floor(ptx / 16) + cx, Math.floor(pty / 16) + cy);
        if (q && (kind === 'city' ? q.type === 'city' : !!q.dungeon) && !out.includes(q)) out.push(q);
      }
      return out.slice(0, n);
    },
    /** the nearest corrupted ground (heart of a blight patch), searched outward from the party */
    nearestBlight() {
      const at = overworldAt();
      const tx0 = Math.floor(at.x / 48), ty0 = Math.floor(at.y / 48);
      for (let r = 8; r < 1600; r += 8) for (let a = 0; a < 6.283; a += Math.max(0.02, 6 / r)) {
        const tx = Math.round(tx0 + Math.cos(a) * r), ty = Math.round(ty0 + Math.sin(a) * r);
        if (game.overworld.corruptionAt(tx, ty) > 0.9 && !isWaterBiome(game.overworld.biomeAt(tx, ty))) return { tx, ty, x: (tx + 0.5) * 48, y: (ty + 0.5) * 48 };
      }
      return null;
    },
    /** mark everything in the place the party is in as done (every floor, chest and the boss): it is cleared */
    clearPlace() {
      if (!ready() || game.mode !== 'interior' || !game.interiorPoi || game.interiorPoi.type === 'city') { game.ui.toast('Enter a cave, ruin or dungeon first'); return false; }
      const poi = game.interiorPoi, place = game.visited[poi.id], man = game.dungeons.manifest(poi);
      man.forEach((m: any, f: number) => {
        const st = f === 0 ? place : ((place.floors ||= {})[f] ||= { opened: [], cleared: false, altarUsed: false });
        st.cleared = true;
        st.opened = [...new Set([...st.opened, ...Array.from({ length: m.chests }, (_, i) => i), ...(m.vault ? ['vault'] : [])])];
      });
      if (man.some((m: any) => m.boss)) { place.bossDead = true; place.bossChestOpened = true; }
      return game.dungeons.checkComplete();
    },
    /** walk in through the door of a place (anywhere in the world) */
    enter(poi: any) {
      if (!ready()) return;
      if (game.mode === 'overworld') { game.enterPlace(poi); return; }
      game.exitPlace();
      const wait = setInterval(() => { if (!game.busy && game.mode === 'overworld') { clearInterval(wait); game.enterPlace(poi); } }, 50);
    }
  };
  (window as any).__dev.tools = tools;
  (window as any).__dev.setSettings = (patch: any) => setSettings(game, patch);
  (window as any).__dev.setAccess = (patch: any) => setAccess(game, patch);
  (window as any).__dev.ui = uiBridge;

  const eco = section('Economy & building');
  button(eco, '+1000 gold', () => tools.addGold(1000));
  button(eco, '+10000 gold', () => tools.addGold(10000));
  button(eco, '+100 wood/stone/iron', () => tools.addResources(100));
  button(eco, 'Build kit', () => tools.buildKit());
  button(eco, 'Finish nearest site', () => tools.finishSites(false));
  button(eco, 'Finish all sites', () => tools.finishSites(true));
  button(eco, 'Empty wallet', () => tools.emptyWallet());

  const places = section('Places (nearest)');
  const placeList = document.createElement('div');
  placeList.className = 'row';
  panel.insertBefore(placeList, places.nextSibling);
  const listPlaces = (kind: 'city' | 'dungeon') => {
    if (!ready()) return;
    placeList.innerHTML = '';
    for (const q of tools.nearestPlaces(kind)) {
      const at = overworldAt();
      const d = ` ${Math.round(Math.hypot(q.ex - at.x, q.ey - at.y) / 48)}t`;
      button(placeList, `${q.name}${q.dungeon ? ` (${q.dungeon.floors}f)` : ''}${d}`, () => tools.enter(q));
    }
  };
  button(places, 'Towns', () => listPlaces('city'));
  button(places, 'Dungeons', () => listPlaces('dungeon'));
  button(places, 'Clear this place', () => tools.clearPlace());

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
  button(spawn, 'Reveal 300 tiles', () => { if (ready() && game.mode === 'overworld') { const p = game.state.player; game.fog.revealCircle(Math.floor(p.wx / 48), Math.floor(p.wy / 48), 300); } });
  button(spawn, 'Reveal this floor', () => { if (ready() && game.mode === 'interior') { const s = game.interior; game.interiorFog.revealCircle(s.w >> 1, s.h >> 1, Math.max(s.w, s.h)); } });
  button(spawn, 'Visit nearby towns', () => {
    if (!ready()) return;
    for (const q of tools.nearestPlaces('city', 12)) if (!game.session.cities.some((c: any) => c.id === q.id)) game.session.cities.push({ id: q.id, name: q.name, ex: q.ex, ey: q.ey });
    game.map.dirty = true; game.ui.toast('Nearby towns marked as visited');
  });
  button(spawn, 'Go to corrupted land', () => {
    if (!ready() || game.mode !== 'overworld') return;
    const b = tools.nearestBlight();
    if (!b) { game.ui.toast('No corrupted land within reach'); return; }
    const p = game.state.player; p.wx = b.x; p.wy = b.y; game.cam.x = b.x; game.cam.y = b.y; game.lastFogTx = null;
  });
  for (const kind of ['warband', 'swarm', 'hunters']) button(spawn, `Event: ${kind}`, () => { if (ready() && game.mode === 'overworld') game.worldEvents.start(kind); });
  button(spawn, 'Respawn all camps', () => { game.session.clearedCamps = {}; game.ui.toast('Camps will respawn'); });
  button(spawn, 'Kill all nearby', () => { for (const e of [...game.state.enemies]) if (!e.dead) game.damageEnemy(e, 1e9, { noCrit: true }); });

  const save = section('Save');
  button(save, 'Save now', () => { game.requestSave('manual', true); });
  const box = document.createElement('textarea');
  box.rows = 3;
  box.placeholder = 'Export fills this box; paste a save here and press Import';
  box.style.cssText = 'width:100%;box-sizing:border-box;margin-top:4px;background:#0c1222;color:#dfe8ff;border:1px solid #3a4a70;border-radius:6px;font:11px ui-monospace,monospace';
  panel.insertBefore(box, save.nextSibling);
  const note = (t: string) => { box.value = t; };
  button(save, 'Export', () => {
    const text = toBase64(encodeSave(buildSave(game)));
    box.value = text;
    box.select();
    navigator.clipboard?.writeText(text).then(() => game.ui.toast('Save copied to clipboard'), () => game.ui.toast('Save is in the box: copy it from there'));
  });
  button(save, 'Import', async () => {
    const text = box.value.trim();
    if (!text) { game.ui.toast('Paste a save into the box first'); return; }
    try {
      const data = decodeSave(fromBase64(text));
      await game.store.save(game.saveSlot, data);
      location.reload();
    } catch (e) { note(`Not a valid save: ${(e as Error).message}`); }
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
