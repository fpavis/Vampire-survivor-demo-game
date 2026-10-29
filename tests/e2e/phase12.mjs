// Phase 12 end-to-end checks: the second round of playtest fixes (hero switching and timers, building,
// reach and walls, the travel map, mountain outlines). Sections can be picked with ONLY=party,building,...;
// SHOTS=<dir> saves screenshots; THROTTLE=n slows the CPU like a busy CI runner.
import { suite } from './harness.mjs';

const h = await suite('phase12', { viewport: { width: 1280, height: 720 }, args: ['--autoplay-policy=no-user-gesture-required'] });
const { check, want } = h;
const SHOTS = process.env.SHOTS || null;
const page = await h.newPage();
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

await page.goto(h.url);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player && window.__dev);
await ev(() => {
  const g = window.game;
  g.godMode = true; g.state.nextLevel = 1e12;
  const w = g.state.wallet; w.gold = w.wood = w.stone = w.iron = 99999;
  window.__dev.ui.wallet.value = { ...w };
  window.goTo = (x, y) => { const p = g.state.player; p.wx = x; p.wy = y; g.cam.x = x; g.cam.y = y; g.lastFogTx = null; g.world.update(x, y, 1400, 900, true); };
});

// ---- 12a: a hero switching in keeps their own health and mana; a loaded save does not keep old timers
if (want('party')) {
  const sw = await ev(() => {
    const g = window.game, pr = g.party;
    pr.cdUntil = 0;
    if (pr.active !== 0) pr.switchTo(0, true);
    pr.cdUntil = 0;
    g.state.health = 7; g.spells.mana.value = 3;                // the active hero is hurt and drained
    const next = pr.heroes[1]; next.health = 80; next.mana = 50;  // the next one is not
    pr.switchTo(1);
    return { hp: Math.round(g.state.health), mana: Math.round(g.spells.mana.value), left: Math.round(pr.heroes[0].health), leftMana: Math.round(pr.heroes[0].mana), active: pr.active };
  });
  check('switching in, a hero keeps their own health and mana', sw.active === 1 && sw.hp === 80 && sw.mana === 50, JSON.stringify(sw));
  check('...and the hero switching out keeps theirs', sw.left === 7 && sw.leftMana === 3, JSON.stringify(sw));
  const back = await ev(() => {
    const g = window.game, pr = g.party;
    pr.cdUntil = 0; pr.switchTo(0);
    return { hp: Math.round(g.state.health), mana: Math.round(g.spells.mana.value), other: Math.round(pr.heroes[1].health) };
  });
  check('switching back finds both as they were', back.hp === 7 && back.mana === 3 && back.other === 80, JSON.stringify(back));
  const refuse = await ev(() => { const g = window.game; g.party.switchTo(1); return window.__dev.ui.log.value.slice(-1)[0]?.text || ''; });
  check('switching again at once says how long it has left', /Switching recharges in \ds/.test(refuse), refuse);
  // a long session, then a save is loaded in place: the old frame count must not leave the cooldown far ahead
  await ev(() => {
    const g = window.game;
    g.frame = 400000; g.party.cdUntil = 0; g.party.switchTo(1);
    g.invulnUntil = g.frame + 999; g.spells.barrierUntil = g.frame + 999;
    window.__save = window.__dev.buildSave();
    g.loadSave(window.__save);
  });
  await page.waitForFunction(() => window.game.frame < 5000 && !window.game.busy && window.game.state.player, null, { timeout: 15000 });
  const after = await ev(() => {
    const g = window.game;
    for (let i = 0; i < 200; i++) g.gameLoop(1);
    const barrier = g.spells.barrierActive, invuln = g.frame < (g.invulnUntil || 0);
    const from = g.party.active;
    const ok = g.party.switchTo(from === 0 ? 1 : 0);
    return { ok, cd: Math.round(g.party.cdUntil - g.frame), barrier, invuln };
  });
  check('after loading a save, switching works within the normal cooldown', after.ok, JSON.stringify(after));
  check('...and no barrier or invulnerability carries over', !after.barrier && !after.invuln, JSON.stringify(after));
}

const inside = () => page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 15000 });
const outside = () => page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 15000 });
const goOut = async () => { if (await ev(() => window.game.mode === 'interior')) { await ev(() => window.game.exitPlace()); await outside(); } };

// ---- 12b: the Expedition Mine, no plaque, a bridge walked across, a site laid on the hero
if (want('building')) {
  await goOut();
  await ev(() => window.game.ui.openMenu('build'));
  const named = await until(() => /Expedition Mine/.test(document.querySelector('.vs-build')?.innerText || ''));
  const buildText = await ev(() => document.querySelector('.vs-build')?.innerText || '');
  check('the climbing tower is the Expedition Mine', named && !/Climbing Tower/i.test(buildText));
  await ev(() => window.game.ui.closeMenu());
  // a bridge, finished at once
  const br = await ev(() => {
    const g = window.game, T = 48, tw = g.towers, api = window.__dev.towersApi;
    let spot = null;
    for (let r = 8; r < 420 && !spot; r += 2) for (let a = 0; a < 6.28 && !spot; a += 0.05) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      const res = tw.check('bridge', tx, ty);
      if (res.ok) spot = { tx, ty, plan: res.plan };
    }
    if (!spot) return null;
    const rec = api.newTower('bridge', spot.tx, spot.ty, spot.plan);
    rec.siege = null;
    tw.recs.push(rec);
    rec.delivered = { ...api.towerCost(rec) };
    tw.complete(rec);
    const [dx, dy] = api.DIRS[rec.dir];
    // the hero on the land behind the gatehouse, walking out over the water
    window.goTo((rec.tx - dx + 0.5) * T, (rec.ty - dy + 0.5) * T);
    const p = g.state.player, x0 = p.wx, y0 = p.wy;
    g.updateInteraction();
    const prompt = g.target ? g.target.text : null;
    for (const e of g.state.enemies) { e.dead = true; e.silent = true; }
    g.reap();
    g.state.keys = { [dx > 0 ? 'd' : dx < 0 ? 'a' : dy > 0 ? 's' : 'w']: true };
    let best = 0;
    for (let i = 0; i < 260; i++) { g.gameLoop(1); best = Math.max(best, ((p.wx - x0) * dx + (p.wy - y0) * dy) / T); }
    g.state.keys = {};
    window.goTo((rec.tx + 0.5) * T, (rec.ty + 1.5) * T);
    const near = tw.targetFor(g.state.player);
    return { len: rec.len, dir: rec.dir, best: Math.round(best * 10) / 10, prompt, near: near ? near.text : null };
  });
  check('a bridge can be walked across from its gatehouse', !!br && br.best >= Math.min(br.len, 4), JSON.stringify(br));
  check('...and has no "Read the plaque" prompt', !!br && !/plaque/i.test(`${br.prompt} ${br.near}`), JSON.stringify(br));
  const laid = await ev(() => {
    const g = window.game, T = 48, tw = g.towers, p = g.state.player;
    let spot = null;
    for (let r = 6; r < 300 && !spot; r += 2) for (let a = 0; a < 6.28 && !spot; a += 0.1) {
      const tx = Math.round(p.wx / T + Math.cos(a) * r), ty = Math.round(p.wy / T + Math.sin(a) * r);
      if (tw.check('spire', tx, ty).ok) spot = { tx, ty };
    }
    window.goTo((spot.tx + 0.5) * T, (spot.ty + 0.5) * T);            // the hero stands right on the spot
    tw.startBuild('spire');
    tw.ghostTile = () => ({ tx: spot.tx, ty: spot.ty });
    tw.build.last = null;
    tw.updateBuild();
    const ok = tw.confirmBuild();
    delete tw.ghostTile;
    for (let i = 0; i < 3; i++) g.gameLoop(1);
    const free = !g.world.blocked(p.wx, p.wy, p.radius);
    // walk straight away from the site
    const sx = (spot.tx + 0.5) * T, sy = (spot.ty + 0.5) * T, ax = p.wx - sx, ay = p.wy - sy;
    g.state.keys = Math.abs(ax) > Math.abs(ay) ? { [ax > 0 ? 'd' : 'a']: true } : { [ay > 0 ? 's' : 'w']: true };
    const x0 = p.wx, y0 = p.wy;
    for (let i = 0; i < 30; i++) g.gameLoop(1);
    g.state.keys = {};
    return { ok, free, walked: Math.round(Math.hypot(p.wx - x0, p.wy - y0)) };
  });
  check('a site laid where the hero stands leaves them free to walk away', laid.ok && laid.free && laid.walked > 20, JSON.stringify(laid));
}

// ---- 12c: spells look for targets on screen, not across it, and never through a wall
if (want('reach')) {
  await goOut();
  // a wall with open ground on both sides, in a straight line
  const site = await ev(() => {
    const g = window.game, T = 48, w = g.world, B = window.__dev.BIOME;
    const open = (tx, ty) => { const b = w.biomeAt(tx, ty); return !w.shotTile(tx, ty) && b !== B.DEEP && b !== B.SHALLOW && !w.blocked((tx + 0.5) * T, (ty + 0.5) * T, 14); };
    for (let r = 6; r < 220; r++) for (let a = 0; a < 6.28; a += 0.05) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      if (!w.shotTile(tx, ty) || !w.shotTile(tx, ty + 1)) continue;
      // west of the wall and east of it, four tiles apart in all, open and walkable
      if (open(tx - 2, ty) && open(tx - 3, ty) && open(tx + 2, ty) && open(tx + 3, ty) && w.shotTile(tx + 1, ty) === false) return { tx, ty, wide: 1 };
      if (open(tx - 2, ty) && open(tx + 3, ty) && w.shotTile(tx + 1, ty) && open(tx + 4, ty)) return { tx, ty, wide: 2 };
    }
    return null;
  });
  check('found a wall with open ground on both sides', !!site, JSON.stringify(site));
  const res = await ev((site) => {
    const g = window.game, sp = g.spells, T = 48, p = g.state.player;
    const bolt = sp.addSpell('bolt', 3);
    sp.setLoadout([bolt.uid], sp.active.map(() => null));
    sp.touch();
    const clear = () => { for (const e of g.state.enemies) { e.dead = true; e.silent = true; } g.reap(); for (const b of sp.bullets) b.life = 0; };
    const run = (ex, ey, frames) => {
      clear();
      const e = g.makeEnemy('SLIME', ex, ey, {});
      e.health = e.maxHealth = 1e9; e.dormant = true; e.speed = 0;
      let inWall = 0, shots = 0, seen = new Set();
      for (let i = 0; i < frames; i++) {
        e.wx = ex; e.wy = ey;
        // only the planted monster may be a target: anything the world spawns meanwhile is cleared
        let other = false;
        for (const o of g.state.enemies) if (o !== e && !o.dead) { o.dead = true; o.silent = true; other = true; }
        if (other) g.reap();
        g.gameLoop(1);
        for (const b of sp.bullets) { if (!seen.has(b)) { seen.add(b); shots++; } if (g.world.shotBlocked(b.sprite.wx, b.sprite.wy)) inWall++; }
      }
      const hurt = e.health < e.maxHealth;
      e.dead = true; e.silent = true; g.reap();
      return { shots, inWall, hurt };
    };
    // the hero west of the wall, a monster east of it: hidden
    window.goTo((site.tx - 2 + 0.5) * T, (site.ty + 0.5) * T);
    const behind = run((site.tx + 1 + site.wide + 0.5) * T, (site.ty + 0.5) * T, 240);
    // the same distance in the open (straight north or south where nothing stands between)
    const open = run(p.wx, p.wy - 160, 240);
    // far away, in the open: out of reach
    const far = run(p.wx + 560, p.wy, 240);
    return { behind, open, far, reach: window.__dev.game.spells.constructor.REACH ?? null };
  }, site);
  check('a monster behind a wall is not shot at', res.behind.shots === 0 && !res.behind.hurt, JSON.stringify(res.behind));
  check('a monster in the open nearby is', res.open.shots > 0 && res.open.hurt, JSON.stringify(res.open));
  check('a monster across the screen is out of reach', res.far.shots === 0 && !res.far.hurt, JSON.stringify(res.far));
  const wall = await ev((site) => {
    // fire straight at the wall: the bolt stops at it, never inside it
    const g = window.game, sp = g.spells, T = 48;
    window.goTo((site.tx - 2 + 0.5) * T, (site.ty + 0.5) * T);
    const p = g.state.player;
    const r = sp.resolved(sp.spells.find((s) => s.tpl === 'bolt'));
    const ex = (site.tx + 1 + site.wide + 0.5) * T;
    const e = g.makeEnemy('SLIME', ex, p.wy, {});
    e.health = e.maxHealth = 1e9; e.dormant = true;
    // aim at the monster behind the wall regardless of sight, so the bolt has to cross the wall
    const pick = sp.nearestEnemies;
    sp.nearestEnemies = () => [e];
    const ok = sp.fireBolt(r);
    sp.nearestEnemies = pick;
    let inWall = 0, alive = 0;
    let left = -1;
    for (let i = 0; i < 90; i++) { e.wx = ex; e.wy = p.wy; g.gameLoop(1); for (const b of sp.bullets) { alive++; if (g.world.shotBlocked(b.sprite.wx, b.sprite.wy)) inWall++; } if (left < 0 && !sp.bullets.length) left = i; }
    const hurt = e.health < e.maxHealth;
    e.dead = true; e.silent = true; g.reap();
    return { ok, inWall, alive, left, hurt };
  }, site);
  check('a bolt aimed through a wall stops at it and never reaches the monster behind', wall.ok && wall.inWall === 0 && wall.left >= 0 && !wall.hurt, JSON.stringify(wall));
}

// ---- 12d: from a town's teleporter the travel map reaches explored land far away
if (want('travel')) {
  await goOut();
  const far = await ev(() => {
    const g = window.game, T = 48, tw = g.towers, api = window.__dev.towersApi, p = g.state.player;
    let spot = null;
    for (let r = 300; r < 420 && !spot; r += 3) for (let a = 0; a < 6.28 && !spot; a += 0.1) {
      const tx = Math.round(p.wx / T + Math.cos(a) * r), ty = Math.round(p.wy / T + Math.sin(a) * r);
      if (tw.check('waypoint', tx, ty).ok) spot = { tx, ty };
    }
    const rec = api.newTower('waypoint', spot.tx, spot.ty);
    rec.siege = null; tw.recs.push(rec);
    rec.delivered = { ...api.towerCost(rec) };
    tw.complete(rec);
    g.fog.revealCircle(spot.tx, spot.ty, 14);
    window.goTo((spot.tx + 0.5) * T, (spot.ty + 3.5) * T);
    for (let i = 0; i < 4; i++) g.gameLoop(1);
    g.syncMap();
    return { id: rec.id, tx: spot.tx, ty: spot.ty };
  });
  const [town] = await ev(() => window.__dev.tools.nearestPlaces('city', 1));
  await ev((q) => window.game.enterPlace(q), town);
  await inside();
  await ev((id) => window.game.travel.open(`town:${id}`), town.id);
  await until(() => !!window.__dev.ui.mapCtl && !!document.querySelector('.vs-worldmap.travel'));
  const view = await ev((id) => { const c = window.__dev.ui.mapCtl; c.select(id); return c.view(); }, far.id);
  check('from a town teleporter the travel map pans to a waypoint far away', Math.abs(view.cx - (far.tx + 0.5)) < 3 && Math.abs(view.cy - (far.ty + 0.5)) < 3, JSON.stringify({ view, far }));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/travel-far.png` });
  await page.keyboard.press('Escape');
  await until(() => !document.querySelector('.vs-worldmap'));
  await goOut();
}


// ---- 12e: mountains have round outer corners, and the hero can stand where the old square corner was
if (want('mountains')) {
  await goOut();
  const corner = await ev(() => {
    const g = window.game, w = g.world, B = window.__dev.BIOME, T = 48;
    const rock = (tx, ty) => { const b = w.biomeAt(tx, ty); return b === B.MOUNTAIN || b === B.PEAK; };
    const open = (tx, ty) => !w.shotTile(tx, ty) && w.biomeAt(tx, ty) !== B.DEEP && w.biomeAt(tx, ty) !== B.SHALLOW;
    for (let r = 8; r < 260; r += 1) for (let a = 0; a < 6.28; a += 0.04) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      // a north-west outer corner: rock here, open to the north, west and north-west
      if (!rock(tx, ty) || !open(tx, ty - 1) || !open(tx - 1, ty) || !open(tx - 1, ty - 1)) continue;
      // diagonally off the corner: a square tile reaches this circle, a rounded one does not
      const x = tx * T - 3, y = ty * T - 3, rr = 8;
      if (w.blocked(x, y, 2)) continue;                                   // something else stands there
      const free = !w.blocked(x, y, rr);
      const edge = w.blocked(tx * T + T / 2, ty * T - 3, rr);            // the middle of the north edge still blocks
      return { tx, ty, free, edge };
    }
    return null;
  });
  check('a mountain\'s outer corner is round: the hero can stand where the square used to be', !!corner && corner.free && corner.edge, JSON.stringify(corner));
  // the tops of the rock are baked per chunk into one smooth texture (one sprite per tile row), with snow on the peaks
  const bake = await ev(() => {
    const g = window.game, w = g.world, B = window.__dev.BIOME;
    const is = (tx, ty, b) => w.biomeAt(tx, ty) === b;
    const all = (tx, ty, b, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (!is(tx + i, ty + j, b)) return false; return true; };
    const none = (tx, ty, b, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (is(tx + i, ty + j, b)) return false; return true; };
    let peak = null, rock = null;
    for (let r = 6; r < 300 && !(peak && rock); r++) for (let a = 0; a < 6.28 && !(peak && rock); a += 0.03) {
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r);
      if (!peak && is(tx, ty, B.PEAK) && all(tx, ty, B.PEAK, 1)) peak = { tx, ty };
      if (!rock && is(tx, ty, B.MOUNTAIN) && all(tx, ty, B.MOUNTAIN, 1) && none(tx, ty, B.PEAK, 2)) rock = { tx, ty };
    }
    if (!peak || !rock) return { peak: !!peak, rock: !!rock };
    const T = 48, n = 12;                                    // a tile in world units; tiles per chunk edge
    const look = (spot) => {
      window.goTo((spot.tx + 0.5) * T, (spot.ty + 4) * T);
      const cx = Math.floor(spot.tx / n), cy = Math.floor(spot.ty / n);
      const view = [...w.views.values()].find((v) => v.cx === cx && v.cy === cy);
      if (!view || !view.rockTex) return null;
      const tex = view.rockTex, SZ = tex.width / n, ctx = tex.baseTexture.resource.source.getContext('2d');   // SZ: texels per tile
      const px = (tx, ty) => { const d = ctx.getImageData(Math.floor(((tx - cx * n) + 0.5) * SZ), Math.floor(((ty - cy * n) + 0.5) * SZ), 1, 1).data; return { rgb: [d[0], d[1], d[2]], a: d[3], lum: 0.3 * d[0] + 0.59 * d[1] + 0.11 * d[2] }; };
      let open = null;
      for (let j = 0; j < n && !open; j++) for (let i = 0; i < n && !open; i++) if (![B.MOUNTAIN, B.PEAK].includes(w.biomeAt(cx * n + i, cy * n + j))) open = { tx: cx * n + i, ty: cy * n + j };
      let rows = 0;
      for (let j = 0; j < n; j++) { let any = false; for (let i = 0; i < n; i++) if ([B.MOUNTAIN, B.PEAK].includes(w.biomeAt(cx * n + i, cy * n + j))) any = true; if (any) rows++; }
      const sprites = view.objects.filter((o) => o.texture && o.texture.baseTexture === tex.baseTexture);
      return {
        size: [tex.width, tex.height], square: tex.width === tex.height && Number.isInteger(SZ), at: px(spot.tx, spot.ty), openAlpha: open ? px(open.tx, open.ty).a : null, rows, sprites: sprites.length,
        frames: sprites.every((o) => o.texture.frame.width === tex.width && o.texture.frame.height === SZ)
      };
    };
    return { peak: look(peak), rock: look(rock) };
  });
  check('a chunk of mountains bakes its rock tops into one square texture', !!bake.peak && !!bake.rock && bake.peak.square && bake.rock.square, JSON.stringify([bake.peak && bake.peak.size, bake.rock && bake.rock.size]));
  check('...a sprite for each tile row that has rock, each a slice of it', !!bake.peak && bake.peak.sprites === bake.peak.rows && bake.peak.frames && bake.rock.sprites === bake.rock.rows && bake.rock.frames, JSON.stringify([bake.peak && [bake.peak.sprites, bake.peak.rows], bake.rock && [bake.rock.sprites, bake.rock.rows]]));
  check('...opaque where there is rock and clear on open ground', !!bake.peak && bake.peak.at.a === 255 && bake.rock.at.a === 255 && (bake.peak.openAlpha === null || bake.peak.openAlpha === 0) && (bake.rock.openAlpha === null || bake.rock.openAlpha === 0), JSON.stringify([bake.peak && [bake.peak.at.a, bake.peak.openAlpha], bake.rock && [bake.rock.at.a, bake.rock.openAlpha]]));
  check('...snow on the peaks, bare grey rock below', !!bake.peak && bake.peak.at.lum > bake.rock.at.lum + 40, JSON.stringify([bake.peak && bake.peak.at, bake.rock && bake.rock.at]));
  if (SHOTS) {
    await ev((c) => { const g = window.game, T = 48, p = g.state.player; p.wx = (c.tx + 0.5) * T; p.wy = (c.ty + 4) * T; g.cam.x = p.wx; g.cam.y = p.wy - 2 * T; g.world.update(g.cam.x, g.cam.y, 1600, 1000, true); for (let i = 0; i < 4; i++) g.gameLoop(1); }, corner);
    await page.screenshot({ path: `${SHOTS}/mountains.png` });
  }
}

await h.finish();
