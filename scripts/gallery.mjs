// Visual check: screenshots of the menu, every biome, combat, far regions, interiors and a boss.
// Usage: npm run build && node scripts/gallery.mjs <out-dir> [tag]   (CHROMIUM_PATH may point at a Chromium binary)
import { chromium } from 'playwright-core';
import { findChromium } from './lib/browser.mjs';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const OUT = process.argv[2] || 'gallery-out'; const TAG = process.argv[3] || 'shot';
mkdirSync(OUT, { recursive: true });
const pv = spawn('npx', ['vite', 'preview', '--port', '4195', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4195/'); await p.waitForFunction(() => !!window.game);
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/${TAG}-0-menu.png` });
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.game.state.player);
await p.evaluate(() => { const g = window.game; g.godMode = true; g.state.nextLevel = 1e12; });
const shot = async (name, setup, frames = 90) => {
  await p.evaluate(({ setup, frames }) => {
    const g = window.game; const f = new Function('g', setup); f(g);
    for (let i = 0; i < frames; i++) g.gameLoop(1);
  }, { setup, frames });
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
};
const goto = (group, minD = 0) => `
  const want='${group}'; const T=48; let found=null;
  for (let r=${minD}; r<4000 && !found; r+=6) for (let a=0;a<6.28 && !found;a+=0.35) {
    const x=Math.cos(a)*r*T, y=Math.sin(a)*r*T;
    if (g.world.groupAtPos(x,y)===want) { const f=g.world.findFree(x,y,14); if (g.world.groupAtPos(f.x,f.y)===want) found=f; }
  }
  if (!found) return;
  const p=g.state.player; p.wx=found.x; p.wy=found.y; g.cam.x=p.wx; g.cam.y=p.wy; g.lastFogTx=null;
  g.world.update(p.wx,p.wy,g.app.screen.width,g.app.screen.height,true);
  for (const e of [...g.state.enemies]) e.dead=true; g.reap();`;
await shot('1-field', goto('field', 2), 60);
await shot('2-combat', `
  const p=g.state.player; for (const id of ['orbit','lightning','meteor','nova']) { const s=g.spells.addSpell(id); g.spells.auto.push(s.uid);} g.spells.touch();
  for (let i=0;i<26;i++){const a=i*0.5; g.makeEnemy(['SLIME','BEE','BOAR'][i%3], p.wx+Math.cos(a)*(200+i*8), p.wy+Math.sin(a)*(160+i*6), {level:3});}`, 140);
await shot('3-forest', goto('forest', 10));
await shot('4-desert', goto('desert', 10));
await shot('5-shore', goto('shore', 10));
await shot('6-mountain', `
  let found=null; const T=48;
  for (let r=10;r<2000&&!found;r+=4) for (let a=0;a<6.28&&!found;a+=0.3){ const tx=Math.round(Math.cos(a)*r), ty=Math.round(Math.sin(a)*r);
    if (g.world.biomeAt(tx,ty)===7 && g.world.biomeAt(tx,ty+3)!==7) found={x:tx*T, y:(ty+4)*T}; }
  if(!found) return; const f=g.world.findFree(found.x,found.y,14); const p=g.state.player; p.wx=f.x; p.wy=f.y; g.cam.x=p.wx; g.cam.y=p.wy; g.lastFogTx=null;
  g.world.update(p.wx,p.wy,g.app.screen.width,g.app.screen.height,true); for (const e of [...g.state.enemies]) e.dead=true; g.reap();`);
await shot('7-far-tier', goto('field', 900) + `;`, 60);
await shot('8-farther', goto('forest', 1800) + `;`, 60);
// interiors
const poiOf = (type) => `
  const src=g.overworld; let poi=null;
  for (let r=0;r<80&&!poi;r++) for (let cy=-r;cy<=r&&!poi;cy++) for (let cx=-r;cx<=r&&!poi;cx++){ if (Math.max(Math.abs(cx),Math.abs(cy))!==r) continue; const q=src.poiForCell(cx,cy); if(q&&q.type==='${type}') poi=q; }
  window.__poi=poi;`;
for (const [i, type] of [['9', 'city'], ['10', 'cave'], ['11', 'ruins']]) {
  await p.evaluate(({ s }) => { const g = window.game; if (g.mode === 'interior') { g.applyOverworld(0, 0); g.mode = 'overworld'; } new Function('g', s)(g); g.enterPlace(window.__poi); }, { s: poiOf(type) });
  await p.waitForFunction(() => window.game.mode === 'interior' && !window.game.busy, null, { timeout: 8000 });
  await shot(`${i}-${type}`, type === 'city' ? `const it=g.interactables.find(x=>x.kind==='healer'); if(it){g.state.player.wx=it.x-60; g.state.player.wy=it.y+20; g.cam.x=it.x; g.cam.y=it.y;}` : `for (const e of g.state.enemies){ e.dormant=false; }`, 60);
  await p.evaluate(() => { const g = window.game; g.busy = false; g.exitPlace(); });
  await p.waitForFunction(() => window.game.mode === 'overworld' && !window.game.busy, null, { timeout: 8000 });
}
await shot('12-boss', goto('field', 30) + `; g.spawnBoss(); const e=g.state.enemies.find(x=>x.isBoss); if(e){e.wx=g.state.player.wx+220; e.wy=g.state.player.wy-40;}`, 120);
await b.close(); process.kill(-pv.pid);
