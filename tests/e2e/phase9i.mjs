// Phase 9i end-to-end checks: accessibility of every DOM screen. One walk opens each screen in turn (title, world,
// town) and measures it; the sections only differ in what they ask of the measurements:
//   names     axe-core: roles, names, ARIA, landmarks, target size; no violations on any screen
//   contrast  every visible text against what is behind it (4.5:1, 3:1 for large text)
//   dialogs   every panel is a dialog with a name
//   focus     a modal panel takes focus, Tab walks all of its controls and never leaves it, the ring is visible
//   text140   text size 140% on a phone held sideways and on a desktop: nothing cut off, covered or off screen
//   page      the page itself: language, title, one main landmark, one heading, a label on the canvas
// Sections can be picked with ONLY=names,contrast,...; SHOTS=<dir> saves screenshots; THROTTLE=n slows the CPU.
import { suite } from './harness.mjs';
import { screens, show, hide, enterTown } from './screens.mjs';
import { injectAxe, axeViolations, contrastReport, AXE_OFF } from './a11y.mjs';

const h = await suite('phase9i', { viewport: { width: 1280, height: 720 } });
const { check, want } = h;
const SHOTS = process.env.SHOTS || null;
const WALK = ['names', 'contrast', 'dialogs', 'focus'].some(want);
// a modal panel is walked with Tab; these are the ones the focus section looks at
const FOCUS_ON = new Set(['options, game', 'options, video', 'credits', 'game menu, party', 'game menu, build', 'game menu, save', 'settings, video', 'settings, access', 'journal, quests', 'journal, codex', 'world map', 'the merchant', 'the inn', 'the healer', 'the bounty board', 'the Elder']);
const unopened = [];

/** The element a screen is measured inside: the whole interface for screens that are not one panel. */
const scopeOf = (s) => (s.root === '.vs-version' || s.name === 'the HUD' ? '#ui-root' : s.root);

async function boot(context = null, viewport = null) {
  const page = await h.newPage(context ?? undefined);
  await page.goto(h.url);
  await page.waitForFunction(() => !!window.game);
  return page;
}
const startGame = async (page) => {
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player && window.__dev);
  await page.evaluate(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 99999; });
};

// ---- the walk: every screen once, measured for the sections that were asked for
async function walk(page, missed, measure) {
  const list = screens(page);
  const phases = [['title', async () => {}], ['game', async () => { await startGame(page); }], ['town', async () => { await enterTown(page); }]];
  for (const [where, enter] of phases) {
    await enter();
    for (const s of list.filter((x) => x.where === where)) {
      if (await show(page, s)) await measure(s);
      else missed.push(s.name);
      await hide(page, s);
    }
  }
}

if (WALK) {
  const page = await boot();
  await injectAxe(page);
  const rows = [];
  const seenRules = new Set();
  await walk(page, unopened, async (s) => {
    const scope = scopeOf(s);
    const row = { name: s.name };
    if (want('names')) { const r = await axeViolations(page, scope); row.axe = r.violations; r.ran.forEach((id) => seenRules.add(id)); }
    if (want('contrast')) row.contrast = (await contrastReport(page, scope)).filter((t) => t.ratio < t.need && !(t.floating && t.shadow));
    if (want('dialogs')) {
      row.dialogs = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .vs-panel, ${sel}.vs-panel`)].filter((p) => p.getClientRects().length).map((p) => {
        const d = p.closest('[role="dialog"],[role="alertdialog"]');           // the panel, or the dialog that holds it
        const role = d && d.getAttribute('role'), name = d ? (d.getAttribute('aria-label') || '').trim() || (d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby'))?.innerText.trim()) || '' : '';
        return { cls: p.className.split(' ').slice(0, 2).join('.'), role, name };
      }), scope);
    }
    if (want('focus') && FOCUS_ON.has(s.name)) {
      row.focus = await page.evaluate(() => {
        const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        const panels = [...document.querySelectorAll('#ui-root .vs-panel')].filter(visible);
        const scope = panels[panels.length - 1];
        if (!scope) return { scope: false };
        const items = [...scope.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), select:not([disabled]), input:not([disabled]):not([type=hidden]), [tabindex="0"]')].filter(visible);
        const a = document.activeElement;
        return { scope: true, items: items.length, inside: !!a && scope.contains(a) };
      });
      if (row.focus.scope && row.focus.items) {
        const visited = new Set(), outside = [], noRing = [];
        for (let i = 0; i < row.focus.items + 2; i++) {
          await page.keyboard.press('Tab');
          const step = await page.evaluate(() => {
            const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
            const panels = [...document.querySelectorAll('#ui-root .vs-panel')].filter(visible);
            const scope = panels[panels.length - 1], a = document.activeElement;
            const cs = a && a !== document.body ? getComputedStyle(a) : null;
            const ring = !!cs && ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none');
            const all = [...scope.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), select:not([disabled]), input:not([disabled]):not([type=hidden]), [tabindex="0"]')].filter(visible);
            return { inside: !!a && scope.contains(a), index: all.indexOf(a), ring, label: a ? `${a.tagName.toLowerCase()}.${String(a.className).split(' ')[0]}` : 'none' };
          });
          if (!step.inside) outside.push(step.label);
          if (step.index >= 0) visited.add(step.index);
          if (!step.ring) noRing.push(step.label);
        }
        row.focus.visited = visited.size; row.focus.outside = outside; row.focus.noRing = noRing;
      }
    }
    rows.push(row);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/a11y-${s.name.replace(/[^a-z0-9]+/gi, '-')}.png` });
  });

  check('every screen could be opened for the audit', unopened.length === 0, unopened.join(', '));
  check(`the audit covered ${rows.length} screens`, rows.length >= 46, String(rows.length));

  if (want('names')) {
    check('axe-core ran the rules this audit relies on (names, roles, ARIA, target size)',
      ['button-name', 'aria-allowed-attr', 'aria-valid-attr-value', 'label', 'duplicate-id-aria', 'target-size', 'nested-interactive'].every((id) => seenRules.has(id)),
      ['button-name', 'aria-allowed-attr', 'aria-valid-attr-value', 'label', 'duplicate-id-aria', 'target-size', 'nested-interactive'].filter((id) => !seenRules.has(id)).join(','));
    for (const r of rows) check(`${r.name}: no accessibility violations`, r.axe.length === 0, r.axe.map((v) => `${v.id} x${v.nodes} ${v.example}`).join(' | '));
  }
  if (want('contrast')) {
    for (const r of rows) check(`${r.name}: text has enough contrast`, r.contrast.length === 0,
      r.contrast.slice(0, 4).map((t) => `${t.ratio}<${t.need} ${t.tag}.${t.cls} "${t.text}"`).join(' | '));
  }
  if (want('dialogs')) {
    for (const r of rows) {
      const bad = r.dialogs.filter((d) => !/^(?:alert)?dialog$/.test(d.role || '') || !d.name);
      check(`${r.name}: every panel is a dialog with a name`, bad.length === 0, JSON.stringify(bad));
    }
  }
  if (want('focus')) {
    const looked = rows.filter((r) => r.focus);
    check(`focus was looked at on ${looked.length} modal screens`, looked.length >= 14, String(looked.length));
    for (const r of looked) {
      check(`${r.name}: the panel has the focus`, r.focus.scope && r.focus.inside, JSON.stringify(r.focus));
      check(`${r.name}: Tab reaches every control and never leaves the panel`, r.focus.visited === r.focus.items && r.focus.outside.length === 0, `visited ${r.focus.visited}/${r.focus.items}, outside: ${(r.focus.outside || []).join(',')}`);
      check(`${r.name}: the focused control shows a ring`, r.focus.noRing.length === 0, (r.focus.noRing || []).slice(0, 3).join(','));
    }
  }
}

// ---- text at 140%, on a phone held sideways and on a desktop
if (want('text140')) {
  const sizes = [{ width: 844, height: 390 }, { width: 1280, height: 720 }];
  // the two window sizes are played side by side: each is slow on its own, and they do not share anything
  const runs = await Promise.all(sizes.map(async (vp) => {
    const label = `${vp.width}x${vp.height}`;
    const ctx = await h.newContext(vp);
    await ctx.addInitScript(() => { try { localStorage.setItem('vs.access.v1', JSON.stringify({ textScale: 1.4, palette: 'default', reducedMotion: false, tips: true })); } catch { /* ignore */ } });
    const page = await boot(ctx);
    const problems = [];
    const missed = [];
    let looked = 0;
    await walk(page, missed, async (s) => {
      looked++;
      const r = await page.evaluate((scopeSel) => {
        const scope = document.querySelector(scopeSel) || document.body;
        const issues = [];
        const W = innerWidth, H = innerHeight;
        // text cut off by a clipping ancestor (an ellipsis is an honest cut; a hard clip is not)
        const range = document.createRange();
        for (const el of scope.querySelectorAll('*')) {
          if (el.closest('svg, .vs-sr, .vs-roll-view')) continue;          // the credits roll scrolls past on purpose
          const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own.length) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          let box = null;
          for (const n of own) { range.selectNodeContents(n); const b = range.getBoundingClientRect(); if (b.width) box = box ? { left: Math.min(box.left, b.left), right: Math.max(box.right, b.right), top: Math.min(box.top, b.top), bottom: Math.max(box.bottom, b.bottom) } : b; }
          if (!box) continue;
          // climb until the text is inside something that scrolls (reachable) or something that clips it (not)
          let doneX = false, doneY = false;
          const tol = Math.max(2, 0.25 * parseFloat(cs.fontSize));      // the box of a line is taller than its letters
          for (let a = el; a && a !== document.body && !(doneX && doneY); a = a.parentElement) {
            const s = getComputedStyle(a), r = a.getBoundingClientRect();
            if (r.width < 1) continue;
            if (!doneX) {
              if (s.overflowX === 'auto' || s.overflowX === 'scroll') doneX = true;
              else if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && s.textOverflow !== 'ellipsis' && (box.right > r.right + 2 || box.left < r.left - 2)) { issues.push(`cut off sideways: "${own[0].textContent.trim().slice(0, 30)}" in ${a.className || a.tagName}`); break; }
            }
            if (!doneY) {
              if (s.overflowY === 'auto' || s.overflowY === 'scroll') doneY = true;
              else if ((s.overflowY === 'hidden' || s.overflowY === 'clip') && (box.bottom > r.bottom + tol || box.top < r.top - tol)) { issues.push(`cut off below: "${own[0].textContent.trim().slice(0, 30)}" in ${a.className || a.tagName}`); break; }
            }
          }
        }
        // panels inside the window, with nothing scrolling sideways
        for (const p of scope.querySelectorAll('.vs-panel, .vs-page')) {
          if (!p.getClientRects().length) continue;
          const b = p.getBoundingClientRect();
          if (b.left < -1 || b.right > W + 1) issues.push(`panel off screen sideways: ${p.className}`);
          if (p.scrollWidth > p.clientWidth + 2 && getComputedStyle(p).overflowX !== 'visible') issues.push(`panel scrolls sideways: ${p.className}`);
        }
        // controls that something else sits on (after scrolling them into view)
        for (const c of scope.querySelectorAll('button:not([disabled]), select, input:not([type=hidden]), [tabindex="0"]')) {
          const cs = getComputedStyle(c);
          if (cs.visibility === 'hidden' || cs.display === 'none' || !c.getClientRects().length || c.closest('.vs-sr')) continue;
          c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          const b = c.getBoundingClientRect();
          if (b.width < 1 || b.height < 1) continue;
          const x = Math.min(W - 1, Math.max(0, b.left + b.width / 2)), y = Math.min(H - 1, Math.max(0, b.top + b.height / 2));
          const top = document.elementFromPoint(x, y);
          if (top && !(c === top || c.contains(top) || top.contains(c) || top.closest('label') === c.closest('label') && c.closest('label'))) issues.push(`covered: ${c.tagName.toLowerCase()}.${String(c.className).split(' ')[0]} "${(c.innerText || c.getAttribute('aria-label') || '').slice(0, 24).replace(/\s+/g, ' ')}" by ${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]} (${Math.round(b.top)}-${Math.round(b.bottom)} of ${H})`);
          if (b.right < 0 || b.left > W) issues.push(`control off screen: ${c.className}`);
        }
        return issues;
      }, scopeOf(s));
      for (const issue of r) problems.push(`${s.name}: ${issue}`);
      if (SHOTS && vp.width < 900) await page.screenshot({ path: `${SHOTS}/text140-${s.name.replace(/[^a-z0-9]+/gi, '-')}.png` });
    });
    await ctx.close();
    return { label, looked, problems, missed };
  }));
  for (const { label, looked, problems, missed } of runs) {
    check(`${label}: text size 140% was checked on ${looked} screens`, missed.length === 0 && looked >= 46, missed.join(', ') || String(looked));
    check(`${label}: at 140% nothing is cut off, covered or off screen`, problems.length === 0, (process.env.VERBOSE ? problems : problems.slice(0, 6)).join(' | '));
  }
}

// ---- the page itself
if (want('page')) {
  const page = await boot();
  await injectAxe(page);
  const facts = async () => page.evaluate(() => ({
    lang: document.documentElement.lang, title: document.title, mains: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length, canvasRole: document.querySelector('canvas')?.getAttribute('role'),
    canvasLabel: document.querySelector('canvas')?.getAttribute('aria-label') || '', canvasInMain: !!document.querySelector('main canvas'), uiInMain: !!document.querySelector('main #ui-root'),
    viewport: document.querySelector('meta[name=viewport]')?.content || ''
  }));
  const f = await facts();
  check('the page has a language, a title, one main landmark and one heading', f.lang === 'en' && f.title.length > 2 && f.mains === 1 && f.h1 === 1, JSON.stringify(f));
  check('the canvas says what it is, and sits in the main landmark with the interface', f.canvasRole === 'img' && f.canvasLabel.length > 10 && f.canvasInMain && f.uiInMain, JSON.stringify(f));
  const title = await axeViolations(page, null);
  check('the title screen page has no accessibility violations', title.violations.length === 0, title.violations.map((v) => `${v.id} ${v.example}`).join(' | '));
  await startGame(page);
  const world = await axeViolations(page, null);
  check('the page in the world has no accessibility violations', world.violations.length === 0, world.violations.map((v) => `${v.id} ${v.example}`).join(' | '));
  check('zoom is off on purpose (two-thumb play), and the text size setting stands in for it', /user-scalable=no/.test((await facts()).viewport) && AXE_OFF.includes('meta-viewport'));
}

await h.finish();
