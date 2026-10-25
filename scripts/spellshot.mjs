// Visual check: close-ups of every spell effect in action.
// Usage: npm run build && node scripts/spellshot.mjs <out-dir> [tag]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'spells';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4198', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4198/'); await p.waitForFunction(() => !!window.game);
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.game.state.player);
const scene = async (name, setup, frames) => {
  await p.evaluate(({ setup, frames }) => {
    const g = window.game; g.godMode = true; g.state.nextLevel = 1e12;
    for (const e of [...g.state.enemies]) e.dead = true; g.reap();
    new Function('g', setup)(g);
    for (let i = 0; i < frames; i++) g.gameLoop(1);
  }, { setup, frames });
  await p.waitForTimeout(120);
  await p.screenshot({ path: `${OUT}/${TAG}-${name}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } });
};
const ring = `const p=g.state.player; for(let i=0;i<14;i++){const a=i*0.45; const e=g.makeEnemy('SLIME', p.wx+Math.cos(a)*(130+i*6), p.wy+Math.sin(a)*(110+i*5), {level:1}); e.health=e.maxHealth=1e6; e.speed=0.2;}`;
const only = (tpl) => `g.spells.auto=[]; let s=g.spells.spells.find(x=>x.tpl==='${tpl}') || g.spells.addSpell('${tpl}'); s.level=5; g.spells.auto=[s.uid]; g.spells.timers={}; g.spells.touch();`;
await scene('bolt', only('bolt') + ring, 50);
await scene('orbit', only('orbit') + ring, 50);
await scene('chain', only('lightning') + ring, 34);
await scene('nova', only('nova') + ring, 32);
await scene('meteor', only('meteor') + ring, 58);
await scene('meteor-hit', '', 12);
await scene('dash', `g.spells.auto=[]; g.spells.touch(); g.spells.mana.value=99; g.spells.timers={}; g.lastMove={x:1,y:0}; g.spells.cast(0);`, 4);
await scene('barrier', `g.party.cdUntil=0; g.party.switchTo(1); g.spells.auto=[]; g.spells.touch(); g.spells.mana.value=99; g.spells.timers={}; g.spells.cast(0);`, 20);
await scene('blink', `g.party.cdUntil=0; g.party.switchTo(2); g.spells.auto=[]; g.spells.touch(); g.spells.mana.value=99; g.spells.timers={}; g.lastMove={x:1,y:0}; g.spells.cast(0);`, 3);
// Phase 8 spells
const active = (tpl) => `g.spells.auto=[]; const s=g.spells.addSpell('${tpl}'); s.level=3; g.spells.active=[s.uid,null,null]; g.spells.touch(); g.spells.mana.value=200; g.spells.timers={};`;
await scene('trail', only('trail') + `{ const q=g.state.player; for(let i=0;i<40;i++){ q.wx+=4; g.gameLoop(1); } q.wx-=40; }` + ring, 6);
await scene('wisp', only('wisp') + ring, 70);
await scene('glaive', only('glaive') + ring, 40);
await scene('cloud', only('cloud') + ring, 60);
await scene('slam', active('slam') + ring + `g.spells.cast(0);`, 8);
await scene('heal', active('heal') + `g.state.health=g.state.maxHealth*0.5; g.spells.cast(0);`, 30);
await b.close(); process.kill(-pv.pid);
