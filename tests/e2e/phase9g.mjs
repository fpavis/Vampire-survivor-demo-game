// Phase 9g end-to-end checks: the input deferrals. A controller the browser cannot lay out is set up by hand
// and then works like a standard pad. Sections can be picked with ONLY=profile,haptics,map; THROTTLE=n slows the CPU
// like a busy CI runner.
import { suite } from './harness.mjs';

const PAD_ID = 'Generic USB Joystick (Vendor: 0079 Product: 0006)';
const h = await suite('phase9g', {
  viewport: { width: 1280, height: 720 },
  // a controller with no standard mapping: twelve buttons and the d-pad on a hat (axes 4 and 5)
  initArg: PAD_ID,
  init: (id) => {
    window.__pad = {
      id, index: 0, connected: true, mapping: '',
      axes: [0, 0, 0, 0, 0, 0], buttons: Array.from({ length: 12 }, () => ({ pressed: false, value: 0 })),
      vibrationActuator: { playEffect: (...a) => { (window.__rumble = window.__rumble || []).push(a); return Promise.resolve('complete'); } }
    };
    window.__padOn = false;
    navigator.getGamepads = () => (window.__padOn ? [window.__pad, null, null, null] : [null, null, null, null]);
  }
});
const { check, want } = h;
let page = await h.newPage();
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

// the raw pad: buttons by raw index, axes as given
const pad = (o = {}) => ev((o) => {
  const p = window.__pad; window.__padOn = true;
  p.axes = o.axes || [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < p.buttons.length; i++) { const on = (o.down || []).includes(i); p.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }
}, o);
// once the real ticker has seen everything let go (during the setup: it is ready for the next button), press until
// it has polled the press (seen in the given predicate), then let go until it has polled that too
const released = () => { const i = window.game.input; return i.setup ? i.setup.armed : i.frame.held.size === 0; };
const press = async (o, seen, arg) => { await until(released); await pad(o); const ok = await until(seen, arg); await pad(); await until(released); return ok; };

await page.goto(h.url);
await page.waitForFunction(() => !!window.game);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.state.player && window.__dev);

// ---- 9g.1: a controller the browser does not lay out is set up one button at a time
if (want('profile')) {
  // how this pad's buttons really sit: A is raw 2, B raw 1, X raw 3, Y raw 0; the d-pad is the hat
  const RAW = { A: 2, B: 1, X: 3, Y: 0, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9 };
  const HAT = { up: [5, -1], down: [5, 1], left: [4, -1], right: [4, 1] };
  const hat = (d) => { const a = [0, 0, 0, 0, 0, 0]; a[HAT[d][0]] = HAT[d][1]; return a; };

  await pad({ down: [5] });
  await until(() => window.__dev.ui.padName.value !== '');
  await pad();
  const warn = await ev(() => window.__dev.ui.log.value.map((l) => l.text).filter((t) => /not recognised/.test(t)));
  check('an unknown controller is pointed at the setup, once', warn.length === 1, JSON.stringify(warn));

  await ev(() => window.game.ui.openMenu('settings'));
  await until(() => !!document.querySelector('.vs-pause [data-tab="controls"]'));
  await ev(() => document.querySelector('.vs-pause [data-tab="controls"]').click());
  await until(() => !!document.querySelector('[data-act="pad-setup"]'));
  const row = await ev(() => document.querySelector('.vs-padrow')?.innerText || '');
  check('Controls offers to set up the controller in hand', /Set up this controller/.test(row) && !/Forget/.test(row), row);

  // Esc walks away from a setup half done and keeps nothing
  await ev(() => document.querySelector('[data-act="pad-setup"]').click());
  const open = await until(() => !!document.querySelector('.vs-padsetup'));
  const first = await ev(() => document.querySelector('.vs-padsetup')?.innerText || '');
  check('the setup opens on the first button, naming the controller', open && /Generic USB Joystick/.test(first) && /Step 1 of 14/.test(first) && /bottom face button/.test(first), first.replace(/\n/g, ' | '));
  await press({ down: [RAW.A] }, () => window.__dev.ui.padSetup.value?.step === 1);
  await page.keyboard.press('Escape');
  const cancelled = await ev(() => ({ open: !!document.querySelector('.vs-padsetup'), setup: window.__dev.ui.padSetup.value, menu: window.__dev.ui.pauseOpen.value, saved: JSON.parse(localStorage.getItem('vs.input.v1') || '{}').profiles || {} }));
  check('Esc cancels the setup, keeps nothing and leaves the menu open', !cancelled.open && !cancelled.setup && cancelled.menu && !cancelled.saved[PAD_ID], JSON.stringify(cancelled));

  // the whole walk: faces, shoulders, triggers, Back and Start, then the hat for the d-pad; Back is skipped
  await ev(() => document.querySelector('[data-act="pad-setup"]').click());
  await until(() => !!document.querySelector('.vs-padsetup'));
  const order = [RAW.A, RAW.B, RAW.X, RAW.Y, RAW.LB, RAW.RB, RAW.LT, RAW.RT, 'skip', RAW.START, 'up', 'down', 'left', 'right'];
  let walked = 0;
  for (let k = 0; k < order.length; k++) {
    const o = order[k];
    const next = (n) => (window.__dev.ui.padSetup.value?.step ?? 99) >= n;
    let ok;
    if (o === 'skip') { await ev(() => document.querySelector('[data-act="pad-skip"]').click()); ok = await until(next, k + 1); }
    else if (typeof o === 'string') ok = await press({ axes: hat(o) }, next, k + 1);
    else ok = await press({ down: [o] }, next, k + 1);
    if (!ok) break;
    walked++;
  }
  check('every step takes the button pressed (or a hat direction, or a skip)', walked === order.length, `${walked}/${order.length}`);
  const done = await ev((id) => ({
    open: !!document.querySelector('.vs-padsetup'),
    prof: (JSON.parse(localStorage.getItem('vs.input.v1') || '{}').profiles || {})[id] || null,
    flag: window.__dev.ui.padProfile.value,
    row: document.querySelector('.vs-padrow')?.innerText || '',
    toast: window.__dev.ui.log.value.slice(-1)[0]?.text || ''
  }), PAD_ID);
  const b = done.prof?.buttons || [];
  check('the setup is saved for this controller', !done.open && done.flag && b[0] === RAW.A && b[1] === RAW.B && b[3] === RAW.Y && b[9] === RAW.START && b[8] === null, JSON.stringify(done.prof));
  check('...the d-pad as hat directions', JSON.stringify(b.slice(12, 16)) === JSON.stringify([{ axis: 5, dir: -1 }, { axis: 5, dir: 1 }, { axis: 4, dir: -1 }, { axis: 4, dir: 1 }]), JSON.stringify(b.slice(12, 16)));
  check('...and the page says so', /set up by you/.test(done.row) && /Forget/.test(done.row) && /Controller set up/.test(done.toast), `${done.row} / ${done.toast}`);

  // now the pad works as a standard one: the hat moves through the menu, A presses, B backs out
  await ev(() => { const t = document.querySelector('.vs-pause [data-tab="controls"]'); t.click(); t.focus(); });
  const focusText = () => ev(() => (document.activeElement?.innerText || document.activeElement?.type || '').slice(0, 40));
  const f0 = await focusText();
  await press({ axes: hat('down') }, (f) => (document.activeElement?.innerText || document.activeElement?.type || '').slice(0, 40) !== f, f0);
  const f1 = await focusText();
  check('the hat moves through the menu as the d-pad', f1 !== f0, `${f0} -> ${f1}`);
  let vib = null;
  for (let i = 0; i < 12; i++) {
    const t = await focusText();
    if (/Vibration is/.test(t)) { vib = t; break; }
    const before = t;
    await press({ axes: hat('down') }, (f) => (document.activeElement?.innerText || document.activeElement?.type || '').slice(0, 40) !== f, before);
  }
  const v0 = await ev(() => window.__dev.ui.vibration.value);
  await press({ down: [RAW.A] }, (v) => window.__dev.ui.vibration.value !== v, v0);
  const v1 = await ev(() => window.__dev.ui.vibration.value);
  check('A (raw button 2) presses the focused button', !!vib && v1 !== v0, `${vib}: ${v0} -> ${v1}`);
  await ev(() => { window.__dev.ui.vibration.value = true; window.game.input.savePrefs(); });
  // raw 0, where a standard pad has A, is Y on this one: it reads as Y and presses nothing
  const asY = await press({ down: [RAW.Y] }, () => window.game.input.frame.held.has('skill2'));
  const after = await ev(() => ({ open: window.__dev.ui.pauseOpen.value, vib: window.__dev.ui.vibration.value }));
  check('raw button 0 reads as Y here, not A', asY && after.open && after.vib === true, JSON.stringify(after));

  // the profile survives a reload, and Forget puts the standard reading back
  await page.reload();
  await page.waitForFunction(() => !!window.game && window.game.titleReady, null, { timeout: 15000 });
  const kept = await ev((id) => !!window.game.input.profiles[id], PAD_ID);
  check('the setup is remembered after a reload', kept);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player && window.__dev);
  await pad({ down: [RAW.START] });
  await until(() => window.__dev.ui.padName.value !== '');
  await pad();
  const warn2 = await ev(() => window.__dev.ui.log.value.map((l) => l.text).filter((t) => /not recognised/.test(t)).length);
  check('a controller already set up is not flagged again', warn2 === 0, String(warn2));
  await until(() => window.__dev.ui.pauseOpen.value, null, 3000);
  const startOpens = await ev(() => window.__dev.ui.pauseOpen.value);
  check('Start (raw button 9) opens the game menu', startOpens);
  await ev(() => window.game.ui.openMenu('settings'));
  await until(() => !!document.querySelector('.vs-pause [data-tab="controls"]'));
  await ev(() => document.querySelector('.vs-pause [data-tab="controls"]').click());
  await until(() => !!document.querySelector('[data-act="pad-forget"]'));
  await ev(() => document.querySelector('[data-act="pad-forget"]').click());
  const forgot = await ev((id) => ({
    saved: !!(JSON.parse(localStorage.getItem('vs.input.v1') || '{}').profiles || {})[id],
    flag: window.__dev.ui.padProfile.value,
    forget: !!document.querySelector('[data-act="pad-forget"]')
  }), PAD_ID);
  check('Forget drops the setup', !forgot.saved && !forgot.flag && !forgot.forget, JSON.stringify(forgot));
  await ev(() => window.game.ui.closeMenu());
}

// ---- 9g.2: haptics have their own strength, named patterns and cooldowns
if (want('haptics')) {
  const rumbles = () => ev(() => (window.__rumble || []).map(([, o]) => ({ s: Math.round(o.strongMagnitude * 1000) / 1000, w: Math.round(o.weakMagnitude * 1000) / 1000, ms: o.duration })));
  const near = (a, b) => Math.abs(a - b) < 0.002;
  // play on the pad: a push of the stick
  await press({ axes: [0.9, 0, 0, 0, 0, 0] }, () => window.game.input.device === 'pad');
  await ev(() => { window.__rumble = []; window.__dev.ui.vibration.value = true; });
  const strength0 = await ev(() => window.__dev.ui.vibrationStrength.value);
  check('vibration strength starts at 70%', near(strength0, 0.7), String(strength0));

  // a real moment: switching heroes, felt at 70% of its pattern
  await ev(() => { const pr = window.game.party; pr.cdUntil = 0; pr.switchTo(pr.active === 0 ? 1 : 0, true); });
  let r = await rumbles();
  check('switching heroes is felt, scaled by the strength', r.length === 1 && near(r[0].s, 0.2 * 0.7) && near(r[0].w, 0.45 * 0.7) && r[0].ms === 110, JSON.stringify(r));

  // a hurt hero, through the real hook
  await ev(() => { window.__rumble = []; const g = window.game; g.godMode = false; g.state.health = g.state.maxHealth = 500; g.invulnUntil = 0; g.lastHurt = -99; g.hurtPlayer(1); g.godMode = true; });
  r = await rumbles();
  check('being hurt is felt', r.length === 1 && near(r[0].s, 0.55 * 0.7) && r[0].ms === 150, JSON.stringify(r));

  // a stream of crits is one short tick, not a buzz
  await ev(() => { window.__rumble = []; for (let i = 0; i < 5; i++) window.game.input.haptic('crit'); });
  r = await rumbles();
  check('five crits at once are felt once, on the light motor', r.length === 1 && r[0].s === 0 && r[0].w > 0, JSON.stringify(r));

  // the setting: a slider beside the toggle, with a test
  await ev(() => window.game.ui.openMenu('settings'));
  await until(() => !!document.querySelector('.vs-pause [data-tab="controls"]'));
  await ev(() => document.querySelector('.vs-pause [data-tab="controls"]').click());
  await until(() => [...document.querySelectorAll('.vs-pause input[type=range]')].some((x) => /Vibration strength/.test(x.closest('label').innerText)));
  const setStrength = (v) => ev((v) => {
    const el = [...document.querySelectorAll('.vs-pause input[type=range]')].find((x) => /Vibration strength/.test(x.closest('label').innerText));
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await ev(() => { window.__rumble = []; });
  await page.waitForTimeout(300);
  await setStrength(0.3);
  r = await rumbles();
  const saved = await ev(() => JSON.parse(localStorage.getItem('vs.input.v1') || '{}').vibrationStrength);
  check('moving the slider plays the test at the new strength and is remembered', r.length === 1 && near(r[0].s, 0.18) && near(r[0].w, 0.18) && near(saved, 0.3), `${JSON.stringify(r)} saved ${saved}`);
  await page.waitForTimeout(300);
  await ev(() => document.querySelector('[data-act="rumble-test"]').click());
  r = await rumbles();
  check('"Test the vibration" plays one', r.length === 2, JSON.stringify(r));

  await page.waitForTimeout(300);
  await ev(() => { window.__rumble = []; });
  await setStrength(0);
  await ev(() => { const g = window.game; g.input.haptic('hurt'); g.input.haptic('levelUp'); g.input.haptic('wipe'); });
  r = await rumbles();
  check('at strength 0 nothing is sent', r.length === 0, JSON.stringify(r));

  await setStrength(0.7);
  await ev(() => { window.__rumble = []; const b = [...document.querySelectorAll('.vs-pause .vs-btn')].find((x) => /Vibration is on/.test(x.innerText)); b.click(); });
  await page.waitForTimeout(150);
  const hidden = await ev(() => !document.querySelector('[data-act="rumble-test"]'));
  await ev(() => { const g = window.game; g.input.haptic('bossKill'); g.input.haptic('test'); });
  r = await rumbles();
  check('with vibration off: no rumble, and the strength and test are hidden', r.length === 0 && hidden, JSON.stringify(r));
  await ev(() => { window.__dev.ui.vibration.value = true; window.game.input.savePrefs(); window.game.ui.closeMenu(); });
}

// ---- 9g.3: on the world map the d-pad (or Q / E) goes from place to place, and Y (P, right-click) pins
if (want('map')) {
  const S = { A: 0, B: 1, X: 2, Y: 3, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  // a standard controller for this part
  await ev(() => {
    window.__pad = { id: 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)', index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: () => Promise.resolve('complete') } };
    window.__padOn = true;
    const g = window.game, p = g.state.player;
    g.fog.revealCircle(Math.floor(p.wx / 48), Math.floor(p.wy / 48), 70);
  });
  const enough = await until(() => window.game.map.marks('overworld').length >= 3, null, 20000);
  check('a revealed stretch of land has places on the map', enough, String(await ev(() => window.game.map.marks('overworld').length)));
  await ev(() => window.game.ui.toggleMap(window.game));
  await until(() => !!window.__dev.ui.mapCtl);

  // the d-pad: the nearest place first, the camera glides there and a card names it
  const expect = await ev(() => {
    const g = window.game, c = window.__dev.ui.mapCtl.view();
    const marks = g.map.marks('overworld').map((m) => ({ k: `${m.tx},${m.ty},${m.label}`, d: Math.hypot(m.tx - c.cx, m.ty - c.cy), label: m.label, tx: m.tx, ty: m.ty }));
    marks.sort((a, b) => a.d - b.d || a.label.localeCompare(b.label) || a.tx - b.tx || a.ty - b.ty);
    return marks;
  });
  const focused = () => ev(() => window.__dev.ui.mapCtl.focused());
  await press({ down: [S.DOWN] }, () => !!window.__dev.ui.mapCtl.focused());
  const f1 = await focused();
  const glided = await until((m) => { const v = window.__dev.ui.mapCtl.view(); return Math.hypot(v.cx - m.tx, v.cy - m.ty) < 0.1; }, expect[0]);
  const card1 = await ev(() => document.querySelector('.vs-worldmap .card')?.innerText || '');
  check('the d-pad goes to the nearest place first', f1 === expect[0].k, `${f1} vs ${expect[0].k}`);
  check('...the map glides there', glided, JSON.stringify(await ev(() => window.__dev.ui.mapCtl.view())));
  check('...and a card names it', card1.includes(expect[0].label) && card1.includes(`1 of ${expect.length}`), card1.replace(/\n/g, ' | '));
  await press({ down: [S.DOWN] }, (k) => window.__dev.ui.mapCtl.focused() !== k, f1);
  const f2 = await focused();
  check('the next press goes one further out', f2 === expect[1].k && expect[1].d >= expect[0].d, `${f2} vs ${expect[1].k}`);
  await press({ down: [S.UP] }, (k) => window.__dev.ui.mapCtl.focused() !== k, f2);
  check('up goes back in', (await focused()) === expect[0].k);
  await press({ down: [S.UP] }, (k) => window.__dev.ui.mapCtl.focused() !== k, expect[0].k);
  check('...and round to the farthest', (await focused()) === expect[expect.length - 1].k);
  // the keys: E on, Q back
  await page.keyboard.press('e');
  const ke = await focused();
  await page.keyboard.press('q');
  const kq = await focused();
  check('E and Q step through the places from the keyboard', ke === expect[0].k && kq === expect[expect.length - 1].k, `${ke} / ${kq}`);
  // looking around by hand lets go of the place
  await ev(() => window.__dev.ui.mapCtl.pan(3, 0));
  const let_go = await ev(() => ({ f: window.__dev.ui.mapCtl.focused(), card: !!document.querySelector('.vs-worldmap .card') }));
  check('panning lets go of the place and its card', !let_go.f && !let_go.card, JSON.stringify(let_go));

  // pins: X back to the party, then twelve tiles east, Y
  await press({ down: [S.X] }, () => { const v = window.__dev.ui.mapCtl.view(), p = window.game.state.player; return Math.hypot(v.cx - p.wx / 48, v.cy - p.wy / 48) < 0.5; });
  await ev(() => window.__dev.ui.mapCtl.pan(12, 0));
  const at = await ev(() => { const v = window.__dev.ui.mapCtl.view(); return { tx: Math.floor(v.cx), ty: Math.floor(v.cy) }; });
  await press({ down: [S.Y] }, () => (window.game.session.pins || []).length === 1);
  let pins = await ev(() => window.game.session.pins);
  const cardPin = await ev(() => document.querySelector('.vs-worldmap .card')?.innerText || '');
  check('Y drops a gold pin at the middle of the map', pins.length === 1 && pins[0].tx === at.tx && pins[0].ty === at.ty && pins[0].color === 'gold' && /Gold pin placed/.test(cardPin), `${JSON.stringify(pins)} ${cardPin}`);
  const pinMark = await ev(() => window.game.map.marks('overworld').some((m) => /Gold pin/.test(m.label)));
  check('...and it is a place the d-pad can go to', pinMark);
  await press({ down: [S.Y] }, () => window.game.session.pins[0]?.color === 'red');
  await press({ down: [S.Y] }, () => window.game.session.pins[0]?.color === 'blue');
  pins = await ev(() => window.game.session.pins);
  check('Y on it again turns it red, then blue', pins.length === 1 && pins[0].color === 'blue', JSON.stringify(pins));
  await press({ down: [S.Y] }, () => window.game.session.pins.length === 0);
  check('...and once more takes it off', (await ev(() => window.game.session.pins.length)) === 0);
  await press({ down: [S.Y] }, () => window.game.session.pins.length === 1);
  // P from the keyboard, three tiles further east
  await ev(() => window.__dev.ui.mapCtl.pan(-24, 0));
  await page.keyboard.press('p');
  check('P drops one from the keyboard', (await ev(() => window.game.session.pins.length)) === 2);
  // a right-click, at the cursor: on the middle of a tile left of and below the middle of the map
  const box = await ev(() => { const r = document.querySelector('.vs-worldmap canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const want3 = await ev(() => { const v = window.__dev.ui.mapCtl.view(); return { tx: Math.floor(v.cx) - 40, ty: Math.floor(v.cy) + 6 }; });
  const click = await ev(([b, t]) => { const v = window.__dev.ui.mapCtl.view(); return { x: b.x + b.w / 2 + (t.tx + 0.5 - v.cx) * v.ppt, y: b.y + b.h / 2 + (t.ty + 0.5 - v.cy) * v.ppt }; }, [box, want3]);
  await page.mouse.click(click.x, click.y, { button: 'right' });
  pins = await ev(() => window.game.session.pins);
  check('a right-click pins the tile under the cursor', pins.length === 3 && pins.some((q) => q.tx === want3.tx && q.ty === want3.ty), `${JSON.stringify(pins)} want ${JSON.stringify(want3)}`);

  // the minimap shows the gold pin twelve tiles east of the party
  await press({ down: [S.B] }, () => !window.__dev.ui.worldMap.value);
  const mini = await ev(() => {
    const g = window.game, p = g.state.player, pin = g.session.pins[0], ppt = 2;
    g.map.updateMinimap(p.wx, p.wy, g.frame, ppt);
    const c = g.map.minimap, x = Math.round(c.width / 2 + (pin.tx + 0.5 - p.wx / 48) * ppt), y = Math.round(c.height / 2 + (pin.ty + 0.5 - p.wy / 48) * ppt - 3.5 * 1.7);
    const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
    return { x, y, rgb: [d[0], d[1], d[2]] };
  });
  check('the minimap shows the pin', Math.abs(mini.rgb[0] - 255) < 30 && Math.abs(mini.rgb[1] - 210) < 30 && Math.abs(mini.rgb[2] - 74) < 40, JSON.stringify(mini));

  // pins are saved with the world
  await ev(() => window.game.requestSave('pins', true));
  const before = await ev(() => JSON.stringify(window.game.session.pins));
  await page.reload();
  await page.waitForFunction(() => !!window.game && window.game.titleReady, null, { timeout: 15000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.state.player && window.__dev);
  const after = await ev(() => JSON.stringify(window.game.session.pins));
  check('pins come back with the save', after === before, `${before} -> ${after}`);
}

await h.finish();
