// 9f end-to-end checks: towers that rise in levels, sieges, building on claimed ground (and later steps: quests
// and story scenes). Sections can be picked with ONLY=towers,siege,...; SHOTS=<dir> saves screenshots;
// THROTTLE=n slows the CPU like a busy CI runner.
import { suite } from './harness.mjs';

const h = await suite('phase9f', { viewport: { width: 1280, height: 720 }, args: ['--autoplay-policy=no-user-gesture-required'] });
const { check, want } = h;
const SHOTS = process.env.SHOTS || null;
const page = await h.newPage();
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const logHas = (re) => ev((src) => window.__dev.ui.log.value.some((l) => new RegExp(src).test(l.text)), re.source);

await page.goto(h.url);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player && window.__dev);
await ev(() => {
  const g = window.game, T = 48;
  g.godMode = true; g.state.nextLevel = 1e12;
  const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 99999;
  window.__dev.ui.wallet.value = { ...w };              // the panels read the wallet the game publishes
  // a free spot for a tower, spiralling out from (cx, cy); the hero is put beside it with the world loaded
  window.findSpot = (kind, cx = 0, cy = 0, from = 14, to = 300) => {
    for (let r = from; r < to; r += 2) for (let a = 0; a < 6.28; a += 0.05) {
      const tx = Math.round(cx + Math.cos(a) * r), ty = Math.round(cy + Math.sin(a) * r);
      window.goTo((tx + 0.5) * T, (ty + 4) * T);
      const res = g.towers.check(kind, tx, ty);
      if (res.ok) return { tx, ty };
    }
    return null;
  };
  window.goTo = (x, y) => { const p = g.state.player; p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.lastFogTx = null; g.world.update(x, y, 1400, 900, true); };
  // a finished tower at once (as the test tools do)
  window.raise = (kind, spot) => {
    const rec = { id: `t${spot.tx},${spot.ty}`, kind, tx: spot.tx, ty: spot.ty, dir: 0, len: 0, delivered: { gold: 0, wood: 0, stone: 0, iron: 0 }, built: false, spell: null, siege: null };
    g.towers.recs.push(rec);
    rec.delivered = { ...window.__dev.towersApi.towerCost(rec) };
    g.towers.complete(rec);
    return rec.id;
  };
  // every hit a tower lands, with its amount before crits
  window.__towerHits = [];
  const orig = g.damageEnemy.bind(g);
  g.damageEnemy = (e, amount, opts = {}) => { if (opts.source && opts.source.kind === 'tower') window.__towerHits.push(amount); return orig(e, amount, opts); };
});

// ---- 9f.1: spires, obelisks and beacons rise to level 3
if (want('towers')) {
  const spot = await ev(() => window.findSpot('spire'));
  const shot = await ev((spot) => {
    const g = window.game, T = 48;
    const id = window.raise('spire', spot);
    const bolt = g.spells.addSpell('bolt', 3);
    g.towers.arm(id, bolt.uid);
    window.__spire = id;
    // a dummy target for it: a slime held in place near the tower
    const fire = (n) => {
      window.__towerHits = [];
      for (const e of g.state.enemies) if (!e.dead) { e.dead = true; e.silent = true; }
      g.reap();
      const e = g.makeEnemy('SLIME', (spot.tx + 3.5) * T, (spot.ty + 0.5) * T, { level: 1 });
      e.health = e.maxHealth = 1e9;
      for (let i = 0; i < n && window.__towerHits.length < 3; i++) { e.wx = (spot.tx + 3.5) * T; e.wy = (spot.ty + 0.5) * T; g.gameLoop(1); }
      return window.__towerHits.slice();
    };
    window.__fire = fire;
    return fire(900);
  }, spot);
  check('an armed spire fires at what comes near', shot.length > 0, JSON.stringify(shot));
  // stand at the tower (the panel closes when the hero walks off) and open it
  await ev((id) => { const g = window.game, rec = g.towers.byId(id); window.goTo((rec.tx + 0.5) * 48, (rec.ty + 0.5) * 48 + 90); g.updateInteraction(); g.towers.interact({ kind: 'tower', rec }); }, await ev(() => window.__spire));
  await until(() => !!document.querySelector('.vs-tpanel [data-act="upgrade"]'));
  const panel = await ev(() => ({ pips: document.querySelectorAll('.vs-tpanel .vs-tlv i.on').length, text: document.querySelector('.vs-tpanel').innerText }));
  check('its panel shows level 1 and what level 2 would do', panel.pips === 1 && /Level 2/.test(panel.text) && /Damage ×1\.4/.test(panel.text), JSON.stringify(panel));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tower-panel.png` });
  const before = await ev(() => window.game.state.wallet.gold);
  await ev(() => document.querySelector('.vs-tpanel [data-act="upgrade"]').click());
  await until(() => window.game.towers.byId(window.__spire).level === 2);
  await ev(() => document.querySelector('.vs-tpanel [data-act="upgrade"]').click());
  await until(() => window.game.towers.byId(window.__spire).level === 3);
  const top = await ev(() => ({ level: window.game.towers.byId(window.__spire).level, button: !!document.querySelector('.vs-tpanel [data-act="upgrade"]'), gold: window.game.state.wallet.gold, text: document.querySelector('.vs-tpanel').innerText }));
  check('raising it twice takes it to level 3, paid from the wallet, and no further', top.level === 3 && !top.button && top.gold < before && /highest/i.test(top.text), JSON.stringify({ ...top, before }));
  await ev(() => { window.__dev.ui.towerPanel.value = null; });
  const shot3 = await ev(() => window.__fire(900));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  check('a level 3 spire hits much harder', shot3.length > 0 && mean(shot3) > mean(shot) * 1.7, JSON.stringify({ l1: mean(shot), l3: mean(shot3) }));

  // a ward's dome grows: a monster 9 tiles out is pushed only once it is raised
  const ward = await ev(() => window.findSpot('ward', 0, 0, 40));
  const dome = await ev((spot) => {
    const g = window.game, T = 48;
    const id = window.raise('ward', spot), rec = g.towers.byId(id);
    for (const e of g.state.enemies) if (!e.dead) { e.dead = true; e.silent = true; }
    g.reap();
    const at = (lvl) => {
      rec.level = lvl;
      const e = g.makeEnemy('SLIME', (spot.tx + 0.5) * T + 9 * T, (spot.ty + 0.5) * T, { level: 1 });
      e.kvx = e.kvy = 0;
      g.towers.update(1);
      const pushed = Math.abs(e.kvx) + Math.abs(e.kvy);
      e.dead = true; e.silent = true; g.reap();
      return pushed;
    };
    return { l1: at(1), l3: at(3) };
  }, ward);
  check('a level 3 obelisk holds monsters off further out', dome.l1 === 0 && dome.l3 > 0, JSON.stringify(dome));

  // a beacon lights more of the map when raised
  const bspot = await ev(() => window.findSpot('beacon', 0, 0, 80));
  const lit = await ev((spot) => {
    const g = window.game;
    const id = window.raise('beacon', spot);
    const n1 = g.fog.revealedTileCount();
    const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 99999;
    g.towers.upgrade(id);
    return { n1, n2: g.fog.revealedTileCount(), level: g.towers.byId(id).level };
  }, bspot);
  check('a raised beacon reveals more of the land', lit.level === 2 && lit.n2 > lit.n1, JSON.stringify(lit));

  // a site laid on claimed ground costs a quarter less
  const claimed = await ev(() => {
    const g = window.game, T = 48;
    const site = g.sites.sites.near(0, 0, 400).filter((s) => s.kind === 'claim').sort((a, b) => Math.hypot(a.tx, a.ty) - Math.hypot(b.tx, b.ty))[0];
    if (!site) return { site: false };
    g.session.claimed[site.id] = 1;
    let spot = null;
    for (let r = 2; r < 8 && !spot; r++) for (let a = 0; a < 6.28 && !spot; a += 0.2) {
      const tx = Math.round(site.tx + Math.cos(a) * r), ty = Math.round(site.ty + Math.sin(a) * r);
      window.goTo((tx + 0.5) * T, (ty + 3) * T);
      if (g.towers.check('beacon', tx, ty).ok && g.towers.claimedAt(tx, ty)) spot = { tx, ty };
    }
    if (!spot) return { site: true, spot: false };
    g.towers.startBuild('beacon');
    const b = g.towers.build;
    b.tx = spot.tx; b.ty = spot.ty; b.valid = true; b.plan = null; b.last = 'locked';
    g.towers.ghostTile = () => spot;
    g.towers.confirmBuild();
    delete g.towers.ghostTile;
    const rec = g.towers.recs[g.towers.recs.length - 1];
    const full = window.__dev.towersApi.towerCost({ kind: 'beacon' }), cost = window.__dev.towersApi.towerCost(rec);
    return { site: true, spot: true, claimed: rec.claimed, full: full.gold + full.wood + full.stone + full.iron, cost: cost.gold + cost.wood + cost.stone + cost.iron };
  });
  check('a tower laid on claimed ground costs a quarter less', claimed.claimed === true && claimed.cost < claimed.full * 0.8, JSON.stringify(claimed));
  const saved = await ev(async () => { const g = window.game; await g.requestSave('test', true); const d = await g.store.load('autosave'); return d.world.towers.map((t) => ({ kind: t.kind, level: t.level, claimed: t.claimed })); });
  check('levels and claimed ground are saved', saved.some((t) => t.kind === 'spire' && t.level === 3) && saved.some((t) => t.claimed), JSON.stringify(saved));
}

// ---- 9f.1: sieges silence a tower until the besiegers are beaten
if (want('siege')) {
  const spot = await ev(() => window.findSpot('spire', 0, 0, 120));
  const start = await ev((spot) => {
    const g = window.game, T = 48;
    const id = window.raise('spire', spot);
    const bolt = g.spells.addSpell('bolt', 3);
    g.towers.arm(id, bolt.uid);
    window.__siegeTower = id;
    for (const e of g.state.enemies) if (!e.dead) { e.dead = true; e.silent = true; }
    g.reap();
    window.goTo((spot.tx + 0.5) * T, (spot.ty + 9) * T);
    const a = g.worldEvents.start('siege', g.towers.byId(id));
    return { kind: a && a.kind, n: a ? a.members.length : 0, silenced: g.towers.byId(id).siege === (a && a.id) };
  }, spot);
  check('a siege gathers round a tower and silences it', start.kind === 'siege' && start.n >= 6 && start.silenced, JSON.stringify(start));
  check('a banner says which tower is under siege', await logHas(/besiege your Arcane Spire/), '');
  const quiet = await ev(() => {
    const g = window.game;
    window.__towerHits = [];
    for (let i = 0; i < 400; i++) g.gameLoop(1);
    return { hits: window.__towerHits.length, prompt: g.towers.targetFor({ wx: (g.towers.byId(window.__siegeTower).tx + 0.5) * 48, wy: (g.towers.byId(window.__siegeTower).ty + 0.5) * 48 })?.text || '' };
  });
  check('a besieged spire never fires', quiet.hits === 0 && /silenced/.test(quiet.prompt), JSON.stringify(quiet));
  const won = await ev(() => {
    const g = window.game, a = g.worldEvents.active;
    for (const e of a.members) if (!e.dead) g.damageEnemy(e, 1e9, { noCrit: true });
    for (let i = 0; i < 600 && g.worldEvents.active; i++) g.gameLoop(1);
    return { over: !g.worldEvents.active, free: g.towers.byId(window.__siegeTower).siege === null };
  });
  check('beating the besiegers frees the tower', won.over && won.free && await logHas(/THE SIEGE IS BROKEN/), JSON.stringify(won));
  const again = await ev(() => {
    const g = window.game, T = 48, rec = g.towers.byId(window.__siegeTower);
    window.__towerHits = [];
    const e = g.makeEnemy('SLIME', (rec.tx + 3.5) * T, (rec.ty + 0.5) * T, { level: 1 });
    e.health = e.maxHealth = 1e9;
    for (let i = 0; i < 900 && !window.__towerHits.length; i++) { e.wx = (rec.tx + 3.5) * T; e.wy = (rec.ty + 0.5) * T; g.gameLoop(1); }
    e.dead = true; e.silent = true; g.reap();
    return window.__towerHits.length;
  });
  check('...and it fires again', again > 0, String(again));
  const lost = await ev(() => {
    const g = window.game, T = 48, rec = g.towers.byId(window.__siegeTower);
    g.worldEvents.start('siege', rec);
    window.goTo((rec.tx + 0.5) * T + 2600, (rec.ty + 0.5) * T);
    for (let i = 0; i < 900 && g.worldEvents.active; i++) g.gameLoop(1);
    return { over: !g.worldEvents.active, free: rec.siege === null };
  });
  check('walking far away makes the besiegers give up and the tower wakes', lost.over && lost.free && await logHas(/gave up on your Arcane Spire/), JSON.stringify(lost));
}

// ---- 9f.2: townsfolk jobs, escorts, inn rumours and standing
const inside = () => page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 15000 });
const outside = () => page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 15000 });
const enter = async (q) => { await ev((q) => window.game.enterPlace(q), q); await inside(); };
const leave = async () => { await ev(() => window.game.exitPlace()); await outside(); };
const goOut = async () => { if (await ev(() => window.game.mode === 'interior')) await leave(); };
/** In the town the party stands in, the first rotation whose townsfolk job is of this type (the clock is set to it). */
const jobOfType = (type) => ev((type) => {
  const g = window.game, poi = g.interiorPoi;
  for (let e = 0; e < 80; e++) {
    g.state.time = e * 1200 + 5;
    const j = g.quests.jobHere(poi);
    if (j && !j.taken && j.def.objectives[0].type === type) { g.quests.publish(); return { epoch: e, slot: j.def.npc, id: j.def.id, def: j.def, town: poi.id }; }
  }
  return null;
}, type);
/** Stand on a villager (held still) and use it, as pressing E would. */
const talkTo = (slot) => ev((slot) => {
  const g = window.game, c = g.critters.list.find((v) => v.kind === 'villager' && v.slot === slot);
  if (!c) return 'no villager';
  c.wait = 1e9; c.tx = c.wx; c.ty = c.wy;
  const p = g.state.player; p.wx = c.wx; p.wy = c.wy + 4; g.cam.x = p.wx; g.cam.y = p.wy;
  g.updateInteraction();
  if (!g.target || g.target.kind !== 'npc' || g.target.c !== c) return `target ${g.target && g.target.kind}`;
  g.interact();
  return 'ok';
}, slot);
/** Stand at a town's innkeeper, board, ... (panels close when the hero is not at them) and open it. */
const useNpc = (kind) => ev((kind) => {
  const g = window.game, it = g.interactables.find((i) => i.kind === kind);
  const p = g.state.player; p.wx = it.x; p.wy = it.y + 30; g.cam.x = p.wx; g.cam.y = p.wy;
  g.updateInteraction();
  if (kind === 'board') g.quests.openBoard(); else g.openNpc(kind);
  return g.target && g.target.kind;
}, kind);
const markState = () => ev(() => { const m = window.game.quests.mark; return m ? m.key.split(':').pop() : null; });

if (want('townsfolk')) {
  const [town] = await ev(() => window.__dev.tools.nearestPlaces('city', 1));
  await enter(town);
  const job = await jobOfType('fetch');
  check('in some rotation a townsperson of the town has a fetch job', !!job, JSON.stringify(job && job.def.title));
  const marked = await ev((slot) => {
    const g = window.game, m = g.quests.mark, c = g.critters.list.find((v) => v.kind === 'villager' && v.slot === slot);
    return { onHead: !!m && m.sprite.parent === c, onMap: g.map.markers.includes(m && m.marker), state: m && m.key.split(':').pop() };
  }, job.slot);
  check('...who wears a quest marker, on the head and on the map', marked.onHead && marked.onMap && marked.state === 'offer', JSON.stringify(marked));
  if (SHOTS) { await ev((slot) => { const g = window.game, c = g.critters.list.find((v) => v.slot === slot); g.cam.x = c.wx; g.cam.y = c.wy; }, job.slot); await page.screenshot({ path: `${SHOTS}/townsfolk-marker.png` }); }
  check('talking to them offers the job', (await talkTo(job.slot)) === 'ok' && await until(() => !!document.querySelector('.vs-dialog [data-choice="0"]')));
  const offer = await ev(() => document.querySelector('.vs-dialog').innerText);
  check('...naming the place and the reward', !offer.includes('{place}') && /Accept/.test(offer) && /gold/.test(offer), offer.slice(0, 160));
  await page.click('.vs-dialog [data-choice="0"]');
  const taken = await ev((id) => ({ active: !!window.game.quests.state.active[id], dialog: !!window.__dev.ui.dialog.value }), job.id);
  check('Accept takes it on', taken.active && !taken.dialog, JSON.stringify(taken));
  check('...and the marker turns grey while it is under way', (await markState()) === 'taken');
  check('asking again gives a reminder that points the way', (await talkTo(job.slot)) === 'ok' && /Any luck\? Recover .+ from .+:/.test(await ev(() => window.__dev.ui.dialog.value?.text || '')), await ev(() => window.__dev.ui.dialog.value?.text));
  await ev(() => { window.__dev.ui.dialog.value = null; });
  const target = await ev((id) => { const g = window.game, q = g.quests.state.active[id]; return g.quests.poiById(q.targets[0]); }, job.id);
  await leave();
  const toPlace = await ev((id) => { const g = window.game; g.quests.refreshAim(); const a = window.__dev.ui.aims.value[id]; return a && { ...a, want: g.quests.poiById(g.quests.state.active[id].targets[0]).name }; }, job.id);
  check('outside, the job points at the place it names, with a distance', !!toPlace && toPlace.name === toPlace.want && toPlace.why === 'objective' && toPlace.tiles > 4, JSON.stringify(toPlace));
  await enter(target);
  const relic = await ev(() => {
    const g = window.game, it = g.interactables.find((i) => i.kind === 'relic');
    if (!it) return null;
    const src = g.interior, far = Math.max(...(src.chests.length ? src.chests : [src.exit]).map((c) => Math.hypot(c.x - src.start.x, c.y - src.start.y)));
    const p = g.state.player; p.wx = it.x; p.wy = it.y + 6; g.cam.x = p.wx; g.cam.y = p.wy;
    g.updateInteraction();
    const prompt = g.target && g.target.kind === 'relic' ? g.target.text : null;
    return { prompt, away: Math.round(Math.hypot(it.x - src.start.x, it.y - src.start.y)), far: Math.round(far), marker: g.map.markers.includes(it.marker) };
  });
  check('inside the place the thing lies far from the gate, marked on the map', !!relic && relic.away > relic.far * 0.6 && relic.marker, JSON.stringify(relic));
  check('...and can be picked up', !!relic && /Pick up/.test(relic.prompt || ''), JSON.stringify(relic));
  const picked = await ev((id) => { const g = window.game; g.interact(); const q = g.quests.state.active[id]; return { got: q.progress[0], left: g.interactables.some((i) => i.kind === 'relic') }; }, job.id);
  check('picking it up meets the objective', picked.got === 1 && !picked.left, JSON.stringify(picked));
  check('...and says where to take it', await logHas(/all done\. Return to /));
  await leave();
  const toTown = await ev((a) => { const g = window.game; g.quests.refreshAim(); const v = window.__dev.ui.aims.value[a.id]; return v && { ...v, want: g.quests.townName(a.town) }; }, { id: job.id, town: job.town });
  check('once picked up it points back at the town that asked', !!toTown && toTown.why === 'hand-in' && toTown.name === toTown.want, JSON.stringify(toTown));
  await enter(target);
  check('it is not there a second time', !(await ev(() => window.game.interactables.some((i) => i.kind === 'relic'))));
  await leave();
  await enter(town);
  await ev((t) => { window.game.quests.state.rep[t] = 2; window.game.quests.publish(); }, job.town);
  check('back in town the marker is green', (await markState()) === 'ready');
  const gold0 = await ev(() => window.game.state.wallet.gold);
  check('talking to them hands it in', (await talkTo(job.slot)) === 'ok');
  const paid = await ev((a) => { const g = window.game; return { done: g.quests.state.done.includes(a.id), gold: g.state.wallet.gold - a.gold0, rep: g.quests.state.rep[a.town], mark: g.quests.mark, thanks: window.__dev.ui.dialog.value?.text || '' }; }, { id: job.id, gold0, town: job.town });
  check('...paid, with thanks, and the marker gone', paid.done && paid.gold >= job.def.rewards.gold && /thanks/.test(paid.thanks) && paid.mark === null, JSON.stringify(paid));
  check('the town thinks better of the party: Known', paid.rep === 3 && await logHas(/now knows you as Known/), JSON.stringify(paid.rep));
  await ev(() => { window.__dev.ui.dialog.value = null; });
  // the perks: market prices at Trusted, a free bed for the Hero of the town
  const perks = await ev((t) => {
    const g = window.game, q = g.quests.state;
    q.rep[t] = 0; g.refreshShop(); const base = window.__dev.ui.shop.value.items.map((i) => i.price);
    q.rep[t] = 8; g.refreshShop(); const trusted = window.__dev.ui.shop.value.items.map((i) => i.price);
    const bedTrusted = g.innQuote();
    q.rep[t] = 15; const bedHero = g.innQuote();
    q.rep[t] = 3;
    return { base, trusted, bedTrusted, bedHero };
  }, job.town);
  check('a town that trusts the party sells for less', perks.trusted.every((p, i) => p < perks.base[i] && p >= Math.round(perks.base[i] * 0.94)), JSON.stringify(perks));
  check('...and its Hero sleeps for free', perks.bedTrusted > 0 && perks.bedHero === 0, JSON.stringify(perks));
  await leave();
}

if (want('escort')) {
  const [town] = await ev(() => window.__dev.tools.nearestPlaces('city', 1));
  await goOut();
  await enter(town);
  const job = await jobOfType('escort');
  check('in some rotation a townsperson wants walking to another town', !!job, JSON.stringify(job && job.def.title));
  await ev((def) => window.game.quests.start(def), job.def);
  const dest = await ev((id) => { const g = window.game, q = g.quests.state.active[id]; return g.quests.poiById(q.targets[0]); }, job.id);
  check('...the nearest other town', !!dest && dest.id !== town.id, JSON.stringify(dest && dest.name));
  await leave();
  const npc = job.def.objectives[0].npc;
  const near = await ev(() => { const g = window.game; for (let i = 0; i < 5; i++) g.gameLoop(1); const c = g.escort.c, p = g.state.player; return c ? { d: Math.round(Math.hypot(c.wx - p.wx, c.wy - p.wy)), bar: !!g.escort.bar, hp: g.escort.hp, max: g.escort.max, listed: g.critters.list.includes(c) } : null; });
  check('outside, the traveller walks beside the hero with a health bar', !!near && near.d < 140 && near.bar && near.hp === near.max && near.listed, JSON.stringify(near));
  const follow = await ev(() => {
    const g = window.game, p = g.state.player, c = g.escort.c;
    window.goTo(p.wx + 420, p.wy);
    const d0 = Math.hypot(c.wx - p.wx, c.wy - p.wy);
    for (let i = 0; i < 240; i++) g.gameLoop(1);
    return { d0: Math.round(d0), d1: Math.round(Math.hypot(c.wx - p.wx, c.wy - p.wy)) };
  });
  check('...and follows when the hero walks off', follow.d1 < 120 && follow.d1 < follow.d0, JSON.stringify(follow));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/escort.png` });
  const refused = await ev((dest) => {
    const g = window.game, from = g.travel.nodes()[0];
    const extra = !g.session.cities.some((c) => c.id === dest.id);
    if (extra) g.session.cities.push({ id: dest.id, name: dest.name, ex: dest.ex, ey: dest.ey });
    const ok = g.travel.go(from.id, g.travel.nodes().find((n) => n.poiId === dest.id).id);
    if (extra) g.session.cities = g.session.cities.filter((c) => c.id !== dest.id);
    return { ok, mode: g.mode, busy: g.busy };
  }, dest);
  check('a teleporter will not take the traveller', !refused.ok && refused.mode === 'overworld' && await logHas(/will not step into a teleporter/), JSON.stringify(refused));
  const fell = await ev(() => {
    const g = window.game, c = g.escort.c;
    g.godMode = false;
    g.escort.hp = 4;
    const e = g.makeEnemy('SLIME', c.wx + 4, c.wy, {});
    e.health = e.maxHealth = 1e9;
    let i = 0;
    for (; i < 600 && g.escort.job(); i++) { e.wx = c.wx + 4; e.wy = c.wy; g.gameLoop(1); }
    g.godMode = true;
    e.dead = true; e.silent = true; g.reap();
    const s = g.state; s.health = s.maxHealth;
    return { frames: i, lost: !g.escort.job(), gone: !g.escort.c };
  });
  check('a monster on the traveller can kill them, and the job is lost', fell.lost && fell.gone && await logHas(new RegExp(`${npc.toUpperCase()} HAS FALLEN`)), JSON.stringify(fell));
  await enter(town);
  const again = await ev((id) => { const g = window.game, j = g.quests.jobHere(g.interiorPoi); return j && j.def.id === id && !j.taken ? j.def : null; }, job.id);
  check('...and can be asked for again', !!again);
  await ev((def) => window.game.quests.start(def), again);
  await leave();
  const before = await ev((t) => ({ gold: window.game.state.wallet.gold, rep: window.game.quests.state.rep[t] || 0 }), town.id);
  await enter(dest);
  await until((id) => window.game.quests.state.done.includes(id), job.id);
  const arrived = await ev((a) => { const g = window.game; return { done: g.quests.state.done.includes(a.id), gold: g.state.wallet.gold - a.gold, rep: (g.quests.state.rep[a.town] || 0) - a.rep }; }, { id: job.id, town: town.id, ...before });
  check('walking into the town they were bound for pays, and the town that asked thinks better of the party', arrived.done && arrived.gold >= job.def.rewards.gold && arrived.rep === 1 && await logHas(new RegExp(`${npc}: “`)), JSON.stringify(arrived));
  await leave();
}

if (want('rumour')) {
  const [town] = await ev(() => window.__dev.tools.nearestPlaces('city', 1));
  await goOut();
  await enter(town);
  await ev(() => { window.game.state.time = 90 * 1200 + 5; });
  await useNpc('innkeeper');
  await until(() => !!document.querySelector('.vs-inn [data-act="ask"]'));
  await page.click('.vs-inn [data-act="ask"]');
  const told = await until(() => !!document.querySelector('.vs-inn .vs-rumour [data-act="take"]'));
  const r = await ev(() => { const g = window.game, r = g.quests.rumourHere(), p = g.quests.poiById(r.place); return { id: p.id, name: p.name, tx: p.tx, ty: p.ty, dungeon: !!p.dungeon, type: p.type, text: document.querySelector('.vs-rumour').innerText }; });
  check('the innkeeper names a place nearby', told && r.text.includes(r.name), JSON.stringify(r).slice(0, 220));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/inn-rumour.png` });
  const gold0 = await ev(() => window.game.state.wallet.gold);
  await page.click('.vs-inn [data-act="mark"]');
  const mark = await ev((r) => { const g = window.game; return { paid: window.game.quests.innView().rumour.fee, spent: 0, on: g.map.pois.has(r.id), fog: g.fog.isRevealed(r.tx, r.ty), marked: g.quests.rumourHere().marked }; }, r);
  mark.spent = gold0 - await ev(() => window.game.state.wallet.gold);
  check('marking it costs a fee and puts it on the map', mark.spent === mark.paid && mark.on && mark.fog && mark.marked, JSON.stringify(mark));
  await page.click('.vs-inn [data-act="take"]');
  const q = await ev(() => { const g = window.game; const id = Object.keys(g.quests.state.active).find((k) => k.startsWith('r:')); return id ? { id, target: g.quests.state.active[id].targets[0], text: g.quests.questView(id).objectives[0].text } : null; });
  check('taking it on starts a job to clear exactly that place', !!q && q.target === r.id && q.text === `Clear ${r.name}`, JSON.stringify(q));
  await ev(() => window.game.closeNpcPanels());
  await leave();
  const place = await ev((id) => window.game.quests.poiById(id), r.id);
  await enter(place);
  const cleared = await ev((r) => {
    const g = window.game;
    if (r.dungeon) { g.events.emit('DungeonCleared', { id: r.id, name: r.name, type: r.type, group: g.interiorPoi.group, realm: 'land' }); return 'dungeon'; }
    for (let i = 0; i < 900 && !g.interiorState.cleared; i++) {
      for (const e of g.state.enemies) if (!e.dead) { e.untargetable = false; g.damageEnemy(e, e.health * 4 + 1, {}); }   // burrowed ones too
      g.gameLoop(1);
    }
    return g.interiorState.cleared ? 'cleared' : 'not cleared';
  }, r);
  const ready = await ev((id) => window.game.quests.questView(id).ready, q.id);
  check('clearing it finishes the job', ready && cleared !== 'not cleared', cleared);
  check('...which is claimed at any inn', await logHas(/Claim it at any inn/));
  await leave();
  await enter(town);
  await useNpc('innkeeper');
  await until(() => !!document.querySelector('.vs-inn [data-act="claim"]:not([disabled])'));
  const g0 = await ev(() => window.game.state.wallet.gold);
  await page.click('.vs-inn [data-act="claim"]');
  const claimed = await ev((a) => { const g = window.game; return { done: g.quests.state.done.includes(a.id), gold: g.state.wallet.gold - a.g0 }; }, { id: q.id, g0 });
  check('the innkeeper pays it out', claimed.done && claimed.gold > 0, JSON.stringify(claimed));
  check('...and the inn will not tell the same rumour twice in a rotation', await ev(() => !document.querySelector('.vs-inn [data-act="ask"]') && /Done/.test(document.querySelector('.vs-rumour [data-act="take"]').innerText)));
  await ev(() => window.game.closeNpcPanels());
  // standing shows on the board and in the journal
  await useNpc('board');
  const board = await until(() => /Known|Stranger|Trusted|Hero/.test(document.querySelector('.vs-board .vs-standing')?.innerText || ''));
  check('the board shows what the town thinks of the party', board, await ev(() => document.querySelector('.vs-board .vs-standing')?.innerText));
  await ev(() => window.game.closeNpcPanels());
  await ev(() => window.game.ui.openMenu('journal'));
  const journal = await until((name) => { const t = document.querySelector('.vs-journal')?.innerText || ''; return /STANDING/i.test(t) && t.includes(name); }, town.name);
  check('...and so does the journal, town by town', journal, await ev(() => (document.querySelector('.vs-journal')?.innerText || '').slice(0, 200)));
  await ev(() => window.game.ui.closeMenu());
  await leave();
  // a cave or ruins counts as cleared once its monsters are down, now or for a job taken later
  const cave = await ev(() => {
    const g = window.game;
    for (let r = 0; r < 14; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) {
      if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
      const p = g.overworld.poiForCell(cx, cy);
      if (p && (p.type === 'cave' || p.type === 'ruins') && !p.dungeon && !(g.visited[p.id] && g.visited[p.id].cleared)) return p;
    }
    return null;
  });
  await enter(cave);
  const caveRun = await ev((cave) => {
    const g = window.game, seen = [];
    g.events.on('PlaceCleared', (e) => seen.push(e.id));
    for (let i = 0; i < 900 && !g.interiorState.cleared; i++) {
      for (const e of g.state.enemies) if (!e.dead) { e.untargetable = false; g.damageEnemy(e, e.health * 4 + 1, {}); }   // burrowed ones too
      g.gameLoop(1);
    }
    const def = { id: 'r:test', kind: 'job', giver: 'inn', town: 'x', title: 'Test rumour', summary: '', objectives: [{ type: 'clear', target: { kind: cave.type } }], rewards: { gold: 5 } };
    g.quests.start(def, () => cave.id);
    g.quests.syncVisited();
    const ready = g.quests.questView('r:test').ready;
    g.quests.abandon('r:test');
    return { seen: seen.includes(cave.id), ready };
  }, cave);
  check('clearing a cave or ruins counts for a clear objective, then and later', caveRun.seen && caveRun.ready, JSON.stringify({ ...caveRun, place: cave && cave.name }));
  await leave();
}

// ---- 9f.3: a demon lord speaks in a scene (bars, portrait, typed lines, the camera on it); cards only on request
if (want('scene')) {
  await goOut();
  await ev(() => window.__dev.setSettings({ storyScenes: 'full' }));
  const intro = await ev(() => {
    const g = window.game, p = g.state.player;
    const e = g.makeEnemy('SLIME', p.wx + 300, p.wy + 40, {});
    e.introduced = true; e.lord = 'field'; e.health = e.maxHealth = 1e9;
    window.__lord = e;
    const cam0 = Math.hypot(g.cam.x - e.wx, g.cam.y - e.wy);
    g.story.bossIntro(e);
    const at = { x: e.wx, y: e.wy };
    for (let i = 0; i < 4; i++) g.gameLoop(1);
    const early = window.__dev.ui.scene.value.shown;
    for (let i = 0; i < 36; i++) g.gameLoop(1);
    const sc = window.__dev.ui.scene.value;
    return { paused: g.state.paused, sc, early, held: Math.round(Math.hypot(e.wx - at.x, e.wy - at.y)), cam0: Math.round(cam0), cam1: Math.round(Math.hypot(g.cam.x - e.wx, g.cam.y - e.wy)) };
  });
  check('a demon lord noticing the party plays a scene, and the world holds', !!intro.sc && intro.paused && intro.held === 0 && intro.sc.speaker === 'Morwen' && intro.sc.count === 2, JSON.stringify({ ...intro, sc: intro.sc && { ...intro.sc, portrait: !!intro.sc.portrait } }));
  check('...its line typed out a little at a time', !!intro.sc && intro.early > 0 && intro.early < intro.sc.shown && intro.sc.shown <= intro.sc.text.length, JSON.stringify(intro.sc && [intro.early, intro.sc.shown, intro.sc.text.length]));
  check('...and the camera turns to it', intro.cam1 < intro.cam0 * 0.6, JSON.stringify([intro.cam0, intro.cam1]));
  const dom = await until(() => !!document.querySelector('.vs-scene .bar.top') && !!document.querySelector('.vs-scene .bar.bottom') && /^data:image/.test(document.querySelector('.vs-scene .pic img')?.src || '') && /Morwen/.test(document.querySelector('.vs-scene .who')?.innerText || ''));
  check('...letterbox bars, the lord\'s portrait and name on screen', dom);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/scene-lord.png` });
  await ev(() => { window.game.story.current.shown = 5; window.game.story.publishScene(); });     // as if still typing
  await page.keyboard.press('Enter');
  const full = await ev(() => { const s = window.__dev.ui.scene.value; return s && s.index === 0 && s.shown === s.text.length; });
  check('Enter shows the whole line first', full);
  await page.keyboard.press('Enter');
  const second = await ev(() => window.__dev.ui.scene.value?.index);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const after = await ev(() => ({ scene: !!window.__dev.ui.scene.value, paused: window.game.state.paused, dom: !!document.querySelector('.vs-scene') }));
  check('...then the next line, and the scene ends and play resumes', second === 1 && !after.scene && !after.paused, JSON.stringify({ second, ...after }));
  await until(() => !document.querySelector('.vs-scene'));
  const fall = await ev(() => {
    const g = window.game, e = window.__lord;
    g.story.victory(e);
    const s = window.__dev.ui.scene.value;
    return { lines: s && s.count, who: s && s.speaker, paused: g.state.paused };
  });
  check('when the lord falls it has last words before the narrator closes the chapter', fall.lines === 2 && fall.who === 'Morwen' && fall.paused, JSON.stringify(fall));
  await ev(() => window.game.story.advance());
  await ev(() => window.game.story.advance());
  const narr = await until(() => !!document.querySelector('.vs-scene.narrator') && /harvest will come in/.test(document.querySelector('.vs-scene')?.innerText || ''));
  check('...the narrator speaks without a portrait', narr);
  await page.keyboard.press('Escape');
  const skipped = await ev(() => ({ scene: !!window.__dev.ui.scene.value, paused: window.game.state.paused, menu: window.__dev.ui.pauseOpen.value }));
  check('Esc skips the rest of a scene (and does not open the menu)', !skipped.scene && !skipped.paused && !skipped.menu, JSON.stringify(skipped));
  // the Elder's interlude, the first time in a town after a chapter closes
  const [town] = await ev(() => window.__dev.tools.nearestPlaces('city', 1));
  await ev(() => { const q = window.game.quests.state; if (!q.done.includes('m0_omen')) q.done.push('m0_omen'); delete q.flags['interlude.ch0']; });
  await enter(town);
  const inter = await until(() => /The Elder/.test(document.querySelector('.vs-scene .who')?.innerText || '') && /travellers cleared the roads/.test(document.querySelector('.vs-scene')?.innerText || ''));
  check('back in town after a chapter closes, the Elder has a word', inter);
  await page.keyboard.press('Escape');
  await leave();
  await enter(town);
  const once = await ev(() => { for (let i = 0; i < 10; i++) window.game.gameLoop(1); return { scene: !!window.__dev.ui.scene.value, flag: !!window.game.quests.state.flags['interlude.ch0'] }; });
  check('...once', !once.scene && once.flag, JSON.stringify(once));
  await leave();
  // the last chapter: the Elder's last word first, and the ending only once it has been read (or skipped)
  await ev(() => window.game.events.emit('QuestCompleted', { id: 'm6_sovereign' }));
  const lastWord = await until(() => /The Elder/.test(document.querySelector('.vs-scene .who')?.innerText || '') && /Sit with me a while/.test(document.querySelector('.vs-scene')?.innerText || ''));
  const waiting = await ev(() => ({ ending: !!window.__dev.ui.ending.value, paused: window.game.state.paused }));
  check('the Sovereign falling brings the Elder\'s last word, and the ending waits for it', lastWord && !waiting.ending && waiting.paused, JSON.stringify(waiting));
  await ev(() => window.game.story.advance());
  await ev(() => window.game.story.advance());
  const rolled = await until(() => !!document.querySelector('.vs-ending .vs-roll') && !document.querySelector('.vs-scene'));
  check('...and reading it leads into the ending', rolled);
  await page.keyboard.press('Escape');
  check('...which can be skipped, and play goes on', await until(() => !document.querySelector('.vs-ending') && !window.game.state.paused));
  await ev(() => window.game.events.emit('QuestCompleted', { id: 'm6_sovereign' }));
  await until(() => !!document.querySelector('.vs-scene'));
  await page.keyboard.press('Escape');
  check('skipping the Elder\'s last word with Esc still leads into the ending', await until(() => !!document.querySelector('.vs-ending .vs-roll')));
  await page.keyboard.press('Escape');
  await until(() => !document.querySelector('.vs-ending') && !window.game.state.paused);
  // cards only: a card over play instead, and nothing holds
  await ev(() => window.__dev.setSettings({ storyScenes: 'cards' }));
  const cards = await ev(() => { const g = window.game; g.story.bossIntro(window.__lord); return { scene: !!window.__dev.ui.scene.value, paused: g.state.paused }; });
  const card = await until(() => /Morwen/.test(document.querySelector('[data-card="boss"]')?.innerText || ''));
  check('"Story scenes: Cards only" shows the card instead and play goes on', card && !cards.scene && !cards.paused, JSON.stringify(cards));
  await ev(() => { const e = window.__lord; e.dead = true; e.silent = true; window.game.reap(); window.__dev.setSettings({ storyScenes: 'full' }); });
}

await h.finish();
