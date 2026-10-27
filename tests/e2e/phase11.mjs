// Phase 11 end-to-end checks: balance (experience against the hero's level, small card steps, mastery, the
// refund of old picks), the game menu, the training ground and per-skill DPS. Sections can be picked with
// ONLY=balance,menu,yard,dps; SHOTS=<dir> saves screenshots; THROTTLE=n slows the CPU like a busy CI runner.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4193;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-preview.pid); } catch { /* ignore */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 250)); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (section) => !ONLY || ONLY.includes(section);
const SHOTS = process.env.SHOTS || null;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => { window.__forceSeed = 2024; });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
if (process.env.THROTTLE) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
const ev = (fn, arg) => page.evaluate(fn, arg);
// panels follow the game's own ticker, slow on a software GPU: wait for the state, never a fixed time
const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const logHas = (re) => ev((src) => window.__dev.ui.log.value.some((l) => new RegExp(src).test(l.text)), re.source);

await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player && window.__dev);
await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });

// ---- 11b: experience against the hero's level, the new cards, mastery, the refund
if (want('balance')) {
  // a gem is collected by walking into it: drop one on the hero and step until it is gone (hit-stop can hold frames)
  const collect = (value, lvl, kind = 'gem') => ev(([value, lvl, kind]) => {
    const g = window.game, s = g.state, p = s.player;
    const xp0 = s.experience, gold0 = s.wallet.gold, bench0 = g.party.heroes.map((h) => h.experience);
    g.dropGem(p.wx, p.wy, value, kind, lvl);
    const gem = s.gems[s.gems.length - 1];
    for (let i = 0; i < 120 && s.gems.includes(gem); i++) g.gameLoop(1);
    return { xp: s.experience - xp0, gold: s.wallet.gold - gold0, bench: g.party.heroes.map((h, i) => h.experience - bench0[i]), growth: g.stats.growth, gone: !s.gems.includes(gem) };
  }, [value, lvl, kind]);

  await ev(() => { const s = window.game.state; s.level = 40; s.experience = 0; s.nextLevel = 1e12; });
  const high = await collect(100, 10);
  check('a hero far above a monster gets next to nothing from its gem', high.gone && high.xp > 0 && Math.abs(high.xp - 100 * high.growth * 0.01) < 0.01, JSON.stringify(high));
  await ev(() => { const s = window.game.state; s.level = 5; s.experience = 0; });
  const low = await collect(100, 10);
  check('a hero below it catches up (+4% a level)', Math.abs(low.xp - 100 * low.growth * 1.2) < 0.01, JSON.stringify(low));
  const even = await collect(100, 5);
  check('a hero at its level gets the full amount', Math.abs(even.xp - 100 * even.growth) < 0.01, JSON.stringify(even));
  const plain = await collect(100, null);
  check('a gem with no level (a reward) is as it was', Math.abs(plain.xp - 100 * plain.growth) < 0.01, JSON.stringify(plain));

  const bench = await ev(() => {
    const g = window.game, h = g.party.heroes;
    h[1].level = 1; h[1].experience = 0; h[2].level = 60; h[2].experience = 0;
    g.addXp(100, 20);
    return { low: h[1].experience, high: h[2].experience };
  });
  check('resting heroes are weighed by their own level too', Math.abs(bench.low - 100 * 0.5 * 1.5) < 0.01 && bench.high < 1, JSON.stringify(bench));

  const kill = await ev(() => {
    const g = window.game, p = g.state.player;
    const e = g.makeEnemy('SLIME', p.wx + 400, p.wy, { level: 17 });
    const n = g.state.gems.length;
    g.killEnemy(e, null);
    const mine = g.state.gems.slice(n).filter((x) => x.kind === 'gem');
    return { n: mine.length, lvl: mine.map((x) => x.lvl) };
  });
  check('a slain monster\'s gem remembers its level', kill.n >= 1 && kill.lvl.every((l) => l === 17), JSON.stringify(kill));

  await ev(() => { const g = window.game; g.state.picks = { greed: 10 }; g.recalcStats(); });
  const coin = await collect(10, null, 'coin');
  check('Greed: a 10-gold coin is worth 18', coin.gold === 18, JSON.stringify(coin));

  const reach = await ev(() => {
    const g = window.game, sp = g.spells;
    const nova = sp.spells.find((s) => s.tpl === 'nova') || sp.addSpell('nova');
    const base = sp.resolved(nova, true).p.radius;
    g.state.picks = { reach: 10 }; g.recalcStats();
    return { base, hero: sp.resolved(nova).p.radius, tower: sp.resolved(nova, true).p.radius, area: g.stats.area };
  });
  check('Reach widens the hero\'s novas, not a tower\'s', Math.abs(reach.hero - reach.base * 1.5) < 0.01 && reach.tower === reach.base && reach.area === 1.5, JSON.stringify(reach));

  // every ordinary card complete: the upgrades on offer are endless mastery, and picking one works
  const mastery = await ev(() => {
    const g = window.game, s = g.state, ui = window.__dev.ui;
    const ids = ['might', 'haste', 'crit', 'reach', 'vitality', 'recovery', 'armor', 'swift', 'magnet', 'growth', 'fortune', 'greed', 'reservoir', 'wellspring', 'thrift', 'persistence'];
    s.picks = Object.fromEntries(ids.map((id) => [id, 10]));
    s.pending = 2; ui.cards.value = []; g.recalcStats(); g.ensureCards();
    const offered = ui.cards.value.map((c) => c.id);
    g.pickCard(0);
    const taken = Object.keys(s.picks).filter((k) => k.startsWith('mastery-'));
    g.ui.shown.slots = ''; g.ui.updateSlots(g);
    const texts = g.ui.slotsContainer.children.filter((c) => c.text !== undefined).map((c) => c.text);
    return { offered, taken, pending: s.pending, more: texts, kids: g.ui.slotsContainer.children.length, autos: g.spells.auto.length };
  });
  check('with every card complete, mastery is offered', mastery.offered.length === 3 && mastery.offered.every((id) => id.startsWith('mastery-')), JSON.stringify(mastery.offered));
  check('and picking one takes a mastery rank', mastery.taken.length === 1 && mastery.pending === 1, JSON.stringify(mastery));
  check('the HUD shows eight cards and "+N" for the rest', mastery.kids === mastery.autos + 8 + 1 && mastery.more.includes('+9'), JSON.stringify(mastery));

  // an old (v9) save: every pick comes back as an upgrade to spend again, and a notice says so
  const refund = await ev(async () => {
    const g = window.game;
    g.state.picks = { might: 5, haste: 5 }; g.state.pending = 0; g.state.level = 11; g.recalcStats();
    await g.requestSave('test', true);
    const d = await g.store.load('autosave');
    d.version = 9;
    delete d.notices;
    await g.store.save('slot3', d);
    const back = await g.store.load('slot3');
    return { version: back.version, picks: back.party.heroes[back.party.active].picks, pending: back.party.heroes[back.party.active].pending, notices: back.notices };
  });
  check('a v9 save is migrated: picks refunded as pending upgrades', refund.version >= 10 && Object.keys(refund.picks).length === 0 && refund.pending === 10 && refund.notices.length === 1, JSON.stringify(refund));
  await ev(async () => { const g = window.game; g.loadSave(await g.store.load('slot3')); });
  await until(() => window.game.state.player && window.game.state.pending === 10 && !window.game.busy);
  check('loading it says the passives were rebalanced', await logHas(/Passives were rebalanced/), '');
  const after = await ev(() => ({ pending: window.game.state.pending, picks: Object.keys(window.game.state.picks).length, pill: window.__dev.ui.pending.value }));
  check('and the upgrades are ready to spend', after.pending === 10 && after.picks === 0 && after.pill === 10, JSON.stringify(after));
  const resaved = await ev(async () => { const g = window.game; await g.requestSave('test', true); return (await g.store.load('autosave')).notices; });
  check('the notice is said once (not saved back)', !resaved || resaved.length === 0, JSON.stringify(resaved));
  await ev(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });
}

// ---- 11c: one game menu (Esc / Start) with the party's stats and passives, and every other screen as a page
if (want('menu')) {
  const EMOJI = /\p{Extended_Pictographic}/u;
  await ev(() => {
    const g = window.game, h = g.party.heroes;
    g.ui.closeMenu();
    g.state.picks = { might: 3, reach: 2, vitality: 1 }; g.state.pending = 0;
    h[1].picks = { might: 4, armor: 2 }; h[1].dead = false;
    h[2].picks = {}; h[2].dead = false;
    g.recalcStats(); g.ensureCards();
  });
  await page.keyboard.press('c');
  const opened = await until(() => !!document.querySelector('.vs-menu .vs-partyp'));
  const st = await ev(() => ({ paused: window.game.state.paused, page: window.__dev.ui.menuPage.value }));
  check('C opens the game menu on the Party page, and the game waits', opened && st.paused && st.page === 'party', JSON.stringify(st));
  const cell = (stat, i) => ev(([stat, i]) => document.querySelector(`.vs-partyp [data-stat="${stat}"]`)?.children[i]?.innerText.trim(), [stat, i]);
  const party = await ev(() => ({
    pips: document.querySelectorAll('.vs-partyp [data-card="might"] .pips i.on').length,
    reach: document.querySelectorAll('.vs-partyp [data-card="reach"] .pips i.on').length,
    none: document.querySelector('.vs-partyp [data-card="crit"]')?.classList.contains('none'),
    ranks: /6 ranks/i.test(document.querySelector('.vs-partyp')?.innerText || '')
  }));
  check('the Party page shows every passive with its ranks', party.pips === 3 && party.reach === 2 && party.none && party.ranks, JSON.stringify(party));
  const might = [await cell('might', 1), await cell('might', 2), await cell('might', 3)];
  const want = await ev(() => { const g = window.game; return { own: Math.round((g.state.picks.might * 0.08) * 100), total: Math.round((g.stats.might - 1) * 100) }; });
  check('its stats match the hero\'s own cards and the party\'s auras', might[0] === `+${want.own}%` && might[1] === '+8%' && might[2] === `+${want.total}%` && want.total === 32, JSON.stringify({ might, want }));
  check('...area from Reach and armour from a resting hero\'s aura', (await cell('area', 1)) === '+10%' && (await cell('armor', 2)) === '-2%', JSON.stringify([await cell('area', 1), await cell('armor', 2)]));
  await ev(() => document.querySelector('.vs-partyp [data-hero="1"]').click());
  await until(() => /resting/.test(document.querySelector('.vs-partyp .vs-phead')?.innerText || ''));
  const rest = await ev(() => ({ head: [...document.querySelectorAll('.vs-partyp .vs-stats th')].map((t) => t.innerText), lend: document.querySelector('.vs-partyp [data-stat="might"]')?.children[2]?.innerText.trim(), make: !!document.querySelector('.vs-partyp [data-act="make-active"]') }));
  check('a resting hero shows what they lend the party', rest.head.includes('Lends') && rest.lend === '+8%' && rest.make, JSON.stringify(rest));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/menu-party.png` });
  // every page renders, with no emoji anywhere
  const pages = ['party', 'spells', 'upgrades', 'journal', 'build', 'save', 'settings'];
  const seen = {};
  for (const p of pages) {
    await ev((p) => document.querySelector(`.vs-menu [data-page="${p}"]`).click(), p);
    await until((p) => window.__dev.ui.menuPage.value === p && document.querySelector('.vs-mbody .vs-page'), p);
    seen[p] = await ev(() => { const t = document.querySelector('.vs-menu').innerText; return { len: document.querySelector('.vs-mbody').innerText.length, emoji: (t.match(/\p{Extended_Pictographic}/gu) || []).join('') }; });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/menu-${p}.png` });
  }
  check('every page of the menu renders', pages.every((p) => seen[p].len > 40), JSON.stringify(Object.fromEntries(pages.map((p) => [p, seen[p].len]))));
  check('...and shows no emoji', pages.every((p) => !seen[p].emoji && !EMOJI.test(seen[p].emoji)), JSON.stringify(seen));
  await ev(() => document.querySelector('.vs-menu [data-page="upgrades"]').click());
  const empty = await ev(() => document.querySelector('.vs-upg')?.innerText || '');
  check('Upgrades with none waiting says so and still lists the passives', /No upgrades waiting/.test(empty) && /ARCANE/.test(empty), empty.slice(0, 80));
  // a page hotkey jumps; pressed on its own page it closes the menu and the game runs on
  await page.keyboard.press('j');
  await until(() => window.__dev.ui.menuPage.value === 'journal');
  await page.keyboard.press('j');
  const shut = await until(() => !document.querySelector('.vs-menu') && !window.game.state.paused);
  check('J jumps to the journal, and again closes the menu', shut);
  // Esc opens it again where it was left; the World map entry closes it and opens the map
  await page.keyboard.press('Escape');
  await until(() => !!document.querySelector('.vs-menu'));
  const again = await ev(() => window.__dev.ui.menuPage.value);
  await ev(() => document.querySelector('.vs-menu [data-page="map"]').click());
  const map = await until(() => !document.querySelector('.vs-menu') && !!window.__dev.ui.worldMap.value);
  check('Esc reopens the menu on its last page; World map swaps it for the map', again === 'journal' && map, again);
  await page.keyboard.press('Escape');
  await until(() => !window.__dev.ui.worldMap.value && !window.game.state.paused);
  // the upgrades pill opens the menu on Upgrades
  await ev(() => { const g = window.game; g.state.pending = 2; g.ensureCards(); g.state.nextLevel = 1e12; });
  await until(() => !!document.querySelector('.vs-pill'));
  await page.click('.vs-pill', { force: true });      // it pulses: never "stable" for a normal click
  const pill = await until(() => window.__dev.ui.menuPage.value === 'upgrades' && document.querySelectorAll('.vs-menu .vs-card').length === 3);
  check('the upgrades pill opens the Upgrades page with three cards', pill);
  await ev(() => { const g = window.game; g.state.pending = 0; g.ensureCards(); g.ui.closeMenu(); });
}

// ---- 11d: every town's training ground, far from its centre, with three dummies that can be walked to
const inside = () => page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 15000 });
const outside = () => page.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 15000 });
if (want('yard')) {
  const towns = await ev(() => window.__dev.tools.nearestPlaces('city', 3));
  const seen = [];
  for (const q of towns) {
    await ev((q) => window.game.enterPlace(q), q);
    await inside();
    seen.push(await ev(() => {
      const g = window.game, src = g.interior, T = 48, p = g.state.player, W = src.w, H = src.h;
      const fits = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && !g.world.blocked((tx + 0.5) * T, (ty + 0.5) * T, p.radius);
      const open = new Uint8Array(W * H), stack = [[Math.floor(p.wx / T), Math.floor(p.wy / T)]];
      open[stack[0][1] * W + stack[0][0]] = 1;
      while (stack.length) {
        const [x, y] = stack.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (fits(nx, ny) && !open[ny * W + nx]) { open[ny * W + nx] = 1; stack.push([nx, ny]); } }
      }
      const nearest = (x, y) => { let bd = Infinity; for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (open[ty * W + tx]) bd = Math.min(bd, Math.hypot((tx + 0.5) * T - x, (ty + 0.5) * T - y)); return Math.round(bd); };
      const ds = g.dummy.list;
      const f = src.fountain;
      return {
        n: ds.length,
        reach: ds.map((e) => nearest(e.wx, e.wy)),
        away: Math.round(Math.min(...ds.map((e) => Math.hypot(e.wx - f.x, e.wy - f.y))) / T),
        width: W,
        gaps: ds.slice(1).map((e, i) => Math.round(Math.hypot(e.wx - ds[i].wx, e.wy - ds[i].wy))),
        fence: src.decor.filter((d) => d.type === 'fence').length,
        markers: g.map.markers.filter((m) => m.icon === 'dummy').length
      };
    }));
    if (SHOTS && seen.length === 1) {
      await ev(() => { const g = window.game, e = g.dummy.list[1], p = g.state.player; p.wx = e.wx; p.wy = e.wy + 140; g.cam.x = p.wx; g.cam.y = p.wy; for (let i = 0; i < 4; i++) g.gameLoop(1); });
      await page.screenshot({ path: `${SHOTS}/yard.png` });
    }
    await ev(() => window.game.exitPlace());
    await outside();
  }
  check('every town has three training dummies in a fenced yard, marked once on the map', seen.every((t) => t.n === 3 && t.fence > 8 && t.markers === 1), JSON.stringify(seen));
  check('...far from the fountain (a third of the town across, or near it)', seen.every((t) => t.away >= Math.floor(t.width * 0.3) - 4), JSON.stringify(seen.map((t) => [t.away, t.width])));
  check('...each one walked up to', seen.every((t) => t.reach.every((d) => d < 70)), JSON.stringify(seen.map((t) => t.reach)));
  check('...close enough for a chain to jump between them', seen.every((t) => t.gaps.every((d) => d > 100 && d < 240)), JSON.stringify(seen.map((t) => t.gaps)));
}

// ---- 11d: the meter splits damage per skill, and spells that hit several targets show it
if (want('dps')) {
  const [q] = await ev(() => window.__dev.tools.nearestPlaces('city', 1));
  await ev((q) => window.game.enterPlace(q), q);
  await inside();
  const run = await ev(() => {
    const g = window.game, sp = g.spells, p = g.state.player, ds = g.dummy.list;
    const cx = ds.reduce((s, e) => s + e.wx, 0) / ds.length, cy = ds.reduce((s, e) => s + e.wy, 0) / ds.length;
    p.wx = cx; p.wy = cy + 120; g.cam.x = p.wx; g.cam.y = p.wy;
    for (const c of g.critters.list) { c.wx = c.tx = p.wx + 3000; c.wy = c.ty = p.wy; c.wait = 9999; }
    const bolt = sp.addSpell('bolt', 4); bolt.runes = ['ignite', null];
    const chain = sp.addSpell('lightning', 4);
    sp.addRune('ignite');
    sp.setLoadout([chain.uid, bolt.uid], sp.active);
    sp.touch();
    g.dummy.reset();
    // which dummies each spell reached
    const by = {};
    const orig = g.dummy.hit.bind(g.dummy);
    g.dummy.hit = (e, v, src) => { const k = src ? `${src.tpl}:${src.kind}` : 'other'; (by[k] = by[k] || new Set()).add(e.uid); orig(e, v, src); };
    for (let i = 0; i < 1500; i++) {
      g.gameLoop(1);
      const rows = g.dummy.meter.breakdown(g.frame / 60);
      if (i > 600 && rows.some((r) => r.kind === 'burn') && rows.some((r) => r.tpl === 'lightning') && rows.some((r) => r.tpl === 'bolt' && r.kind === 'hit')) break;
    }
    g.dummy.hit = orig;
    const now = g.frame / 60, rows = g.dummy.meter.breakdown(now);
    return {
      rows: rows.map((r) => ({ tpl: r.tpl, kind: r.kind, dps: Math.round(r.dps), share: +r.share.toFixed(3) })),
      shares: rows.reduce((s, r) => s + r.share, 0),
      sum: Math.round(rows.reduce((s, r) => s + r.dps, 0)), total: Math.round(g.dummy.meter.dps(now)),
      reached: Object.fromEntries(Object.entries(by).map(([k, s]) => [k, s.size]))
    };
  });
  check('the meter lists each spell on its own row', run.rows.some((r) => r.tpl === 'lightning') && run.rows.some((r) => r.tpl === 'bolt' && r.kind === 'hit'), JSON.stringify(run.rows));
  check('...a burn as its own row under the spell that set it', run.rows.some((r) => r.tpl === 'bolt' && r.kind === 'burn'), JSON.stringify(run.rows));
  check('...and the rows add up to the whole', Math.abs(run.shares - 1) < 0.01 && Math.abs(run.sum - run.total) <= run.rows.length, JSON.stringify({ shares: run.shares, sum: run.sum, total: run.total }));
  check('Chain Lightning reaches more than one dummy', (run.reached['lightning:hit'] || 0) >= 2, JSON.stringify(run.reached));
  await until(() => (window.__dev.ui.dummy.value?.rows || []).length >= 2);
  const ui = await ev(() => ({ text: document.querySelector('.vs-meter')?.innerText || '', rows: document.querySelectorAll('.vs-meter .vs-mrow').length }));
  check('the training ground meter shows a row per skill', /Training ground/.test(ui.text) && /Chain Lightning/.test(ui.text) && /Arcane Bolt/.test(ui.text) && /burn/i.test(ui.text) && ui.rows >= 3, JSON.stringify(ui));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dps-meter.png` });
  await ev(() => document.querySelector('.vs-meter [data-act="reset"]').click());
  const reset = await ev(() => ({ total: window.game.dummy.meter.total, rows: window.game.dummy.meter.breakdown(window.game.frame / 60).length }));
  check('Reset clears the meter', reset.total === 0 && reset.rows === 0, JSON.stringify(reset));
  await ev(() => window.game.exitPlace());
  await outside();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
