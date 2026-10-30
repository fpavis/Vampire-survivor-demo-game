// Every DOM screen of the game, each with a way to open it and a way to close it, for the audits that must see them
// all (accessibility, text). Three groups, because what can be opened depends on where the party is:
//   'title'  on the title screen, before a game is started
//   'game'   in the world with a hero
//   'town'   inside a town (call enterTown first)
//
//   const list = screens(page);
//   for (const s of list.filter((s) => s.where === 'game')) {
//     if (await show(page, s)) { ...look at it... }
//     await hide(page, s);
//   }
// A screen that does not open is reported by its caller by name; it is never skipped silently.

const OPTION_TABS = ['game', 'video', 'audio', 'controls', 'access', 'help'];
const JOURNAL_TABS = ['quests', 'log', 'statistics', 'codex'];
const CODEX_TABS = ['monsters', 'spells', 'runes', 'places'];

export function screens(page) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const click = (selector) => ev((s) => { document.querySelector(s)?.click(); }, selector);
  const list = [];
  const add = (where, name, root, open, close = async () => {}) => list.push({ where, name, root, open, close });
  const signal = (name, value) => ev(([n, v]) => { window.__dev.ui[n].value = v; }, [name, value]);
  const esc = () => page.keyboard.press('Escape');

  // ---- the title screen
  add('title', 'the title screen', '.vs-version', async () => {});
  add('title', 'new game seed', '.vs-seed', () => click('.vs-link'), esc);
  add('title', 'load game', '.vs-slots', () => signal('slotsOpen', 'load'), () => signal('slotsOpen', null));
  for (const tab of OPTION_TABS) {
    add('title', `options, ${tab}`, '.vs-options', async () => { await signal('optionsOpen', true); await page.waitForSelector('.vs-options'); await click(`.vs-options [data-tab="${tab}"]`); }, () => signal('optionsOpen', false));
  }
  add('title', 'credits', '.vs-credits', () => signal('creditsOpen', true), () => signal('creditsOpen', false));
  add('title', 'keys and buttons', '.vs-rebind', () => signal('rebindOpen', true), () => signal('rebindOpen', false));
  add('title', 'storage warning', '.vs-storage', () => signal('storageWarn', 'failed'), () => signal('storageWarn', null));
  add('title', 'crash screen', '.vs-crash', () => signal('crash', { message: 'Test error', report: 'Survival Game 0.0.0\nTest error\n  at test:1:1', fatal: true }), () => signal('crash', null));

  // ---- in the world
  add('game', 'the HUD', '#ui-root', async () => {});
  const menu = (page) => [`game menu, ${page}`, '.vs-menu', async () => { await ev((p) => window.game.ui.openMenu(p), page); }, () => ev(() => window.game.ui.closeMenu())];
  for (const p of ['party', 'spells', 'build', 'save']) add('game', ...menu(p));
  add('game', 'game menu, upgrades waiting', '.vs-upg', async () => { await ev(() => { const g = window.game; g.state.pending = 2; g.ensureCards(); g.ui.openMenu('upgrades'); }); },
    () => ev(() => { const g = window.game; g.state.pending = 0; g.ensureCards(); g.ui.closeMenu(); }));
  add('game', 'game menu, upgrades', '.vs-upg', () => ev(() => window.game.ui.openMenu('upgrades')), () => ev(() => window.game.ui.closeMenu()));
  for (const tab of JOURNAL_TABS) {
    add('game', `journal, ${tab}`, '.vs-journal', async () => { await ev(() => window.game.ui.openMenu('journal')); await page.waitForSelector('.vs-journal'); await click(`[data-jtab="${tab}"]`); }, () => ev(() => window.game.ui.closeMenu()));
  }
  for (const tab of CODEX_TABS) {
    add('game', `codex, ${tab}`, '.vs-codex', async () => { await ev(() => window.game.ui.openMenu('journal')); await page.waitForSelector('.vs-journal'); await click('[data-jtab="codex"]'); await page.waitForSelector('.vs-codex'); await click(`[data-ctab="${tab}"]`); }, () => ev(() => window.game.ui.closeMenu()));
  }
  for (const tab of OPTION_TABS) {
    add('game', `settings, ${tab}`, '.vs-pause', async () => { await ev(() => window.game.ui.openMenu('settings')); await page.waitForSelector('.vs-pause'); await click(`.vs-pause [data-tab="${tab}"]`); }, () => ev(() => window.game.ui.closeMenu()));
  }
  add('game', 'world map', '.vs-worldmap', () => ev(() => window.game.ui.toggleMap(window.game)), () => ev(() => { if (window.__dev.ui.worldMap.value) window.game.ui.toggleMap(window.game); }));
  add('game', 'controller setup', '.vs-padsetup', () => signal('padSetup', { name: 'Test controller', step: 3, total: 17, prompt: 'Press the top face button' }), () => signal('padSetup', null));
  add('game', 'a tip', '.vs-coach', () => ev(() => { window.game.tips.timer = 1e9; window.__dev.ui.tip.value = { id: 'audit', icon: 'bulb', text: 'Gems are experience: walk over them to collect them.' }; }), () => signal('tip', null));
  add('game', 'a story scene', '.vs-scene', () => ev(() => { const g = window.game; g.story.play([g.story.elderLine('The sky has been wrong since the spring.'), g.story.elderLine('Will you stand against them?')], {}); }),
    () => ev(() => { const g = window.game; for (let i = 0; i < 4 && window.__dev.ui.scene.value; i++) g.story.advance(); window.__dev.ui.scene.value = null; }));
  add('game', 'a boss card', '.vs-story-card', () => ev(() => window.game.story.card({ kind: 'boss', name: 'Morwen', title: 'the Hollow Queen', text: 'She hollows the harvest.' }, 600000)), () => signal('card', null));
  add('game', 'the ending', '.vs-ending', () => ev(() => window.game.story.ending()), () => ev(() => window.game.story.endEnding()));
  add('game', 'the death screen', '.vs-death', () => ev(() => window.game.story.showDeath({ label: 'Hearthvale' })), () => ev(() => { window.__dev.ui.death.value = null; window.game.state.paused = false; }));

  // ---- in a town
  const npc = (kind) => () => ev((k) => {
    const g = window.game, it = g.interactables.find((i) => i.kind === k);
    const p = g.state.player; p.wx = it.x; p.wy = it.y + 30; g.cam.x = p.wx; g.cam.y = p.wy;
    g.updateInteraction();
    if (k === 'board') g.quests.openBoard(); else if (k === 'elder') g.quests.talkToElder(); else g.openNpc(k);
  }, kind);
  const leaveNpc = async () => { await esc(); await ev(() => { const u = window.__dev.ui; u.shopOpen.value = false; u.innOpen.value = false; u.healerOpen.value = false; u.boardOpen.value = false; u.dialog.value = null; }); };
  add('town', 'the merchant', '.vs-shop', npc('merchant'), leaveNpc);
  add('town', 'the inn', '.vs-inn', npc('innkeeper'), leaveNpc);
  add('town', 'the healer', '.vs-heal', npc('healer'), leaveNpc);
  add('town', 'the bounty board', '.vs-board', npc('board'), leaveNpc);
  add('town', 'the Elder', '.vs-dialog', npc('elder'), leaveNpc);
  return list;
}

/** Wait for panels to finish easing in (a half-faded panel has half the contrast). Endless animations are left alone. */
export function settled(page) {
  return page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 1500))
  ])).then(() => page.waitForTimeout(60));
}

/** Open a screen and wait for its root to appear. Returns whether it did. */
export async function show(page, screen, timeout = 4000) {
  try {
    await screen.open();
    await page.waitForSelector(screen.root, { state: 'attached', timeout });
    await settled(page);
    return true;
  } catch { return false; }
}

export async function hide(page, screen) {
  try { await screen.close(); await page.waitForTimeout(80); } catch { /* the next screen resets what it needs */ }
}

/** Go into the nearest town (the party is put there with the world loaded). */
export async function enterTown(page) {
  const [town] = await page.evaluate(() => window.__dev.tools.nearestPlaces('city', 1));
  await page.evaluate((q) => window.game.enterPlace(q), town);
  await page.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 15000 });
  return town;
}
