// The world map: a full-screen panel over the paused game that can be panned and zoomed to look over everything
// already explored, without walking there. Fog stays as it is: only revealed land is ever drawn.
// Mouse: drag to pan, wheel to zoom about the cursor, right-click to pin. Keys: WASD / arrows pan, + and - zoom,
// C recentres, Q / E step through the places on the map, P pins the middle. Pad: left stick pans, LB / RB zoom,
// X recentres, the d-pad steps through the places, Y pins the middle. M, Esc or B closes it.
// Pins (overworld only): a press drops a gold one; pressing on it again turns it red, then blue, then takes it off.
// In travel mode (opened from a town teleporter or a waypoint) it shows the overworld with every destination ringed:
// gold for town teleporters, violet for waypoints. Pick one on the map or in the list, then Travel.
import { useEffect, useRef, useState } from 'preact/hooks';
import { ui } from './bridge';
import { Icon } from './Icon';
import { glyph, onPad } from './hints';
import { WORLD_CONFIG } from '../core/config';
import {
  DEFAULT_ZOOM, MAP_ZOOMS, MAX_PINS, PIN_HEX, boundsOfChunks, clampCenter, markAt, markKey, markOrder, pixelOf, stepMark, tileAt, togglePin, zoomAt,
  type MapCam
} from '../core/world/mapView';
import type { TravelNode } from '../core/world/travel';
import { FONT_UI } from './fonts';

const T = WORLD_CONFIG.tile, CT = WORLD_CONFIG.chunkTiles;
const PAN_PX = 9;                 // pixels a held key or a full stick moves the map each frame
const RING = { town: '#ffd070', waypoint: '#c48af5' };
type Dest = { node: TravelNode; fare: number; tiles: number };
type Card = { label: string; detail: string; n?: number; total?: number };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function WorldMap() {
  const st = ui.worldMap.value;
  if (!st || !ui.game) return null;
  return <MapPanel mode={st.mode} from={st.from ?? null} />;
}

function MapPanel({ mode, from }: { mode: 'view' | 'travel'; from: string | null }) {
  const g = ui.game;
  // travel always looks over the overworld, also from a town's teleporter
  const here: TravelNode | null = mode === 'travel' && from ? g.travel.node(from) : null;
  const dests: Dest[] = here ? g.travel.from(here.id) : [];
  const where: 'overworld' | 'interior' = here ? 'overworld' : g.world.bounded ? 'interior' : 'overworld';
  const zooms = MAP_ZOOMS[where];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const p = g.state.player;
  const home = () => (here ? { cx: here.tx + 0.5, cy: here.ty + 0.5 } : { cx: p.wx / T, cy: p.wy / T });
  const cam = useRef({ ...home(), z: DEFAULT_ZOOM[where] as number });
  const [sel, setSel] = useState<string | null>(null);
  const selRef = useRef<string | null>(null);
  const dirty = useRef(true);
  const held = useRef(new Set<string>());
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const [hover, setHover] = useState<{ label: string; detail: string; x: number; y: number } | null>(null);
  const [zoomIx, setZoomIx] = useState(cam.current.z);
  // stepping through the places: the one in focus, where the stepping started, where the camera is easing to
  const focusRef = useRef<string | null>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const ease = useRef<{ cx: number; cy: number } | null>(null);
  const [card, setCard] = useState<Card | null>(null);

  const size = () => { const c = canvasRef.current; return c ? { w: c.width, h: c.height } : { w: 1, h: 1 }; };
  const view = (): MapCam => ({ cx: cam.current.cx, cy: cam.current.cy, ppt: zooms[cam.current.z] });
  const place = (c: MapCam) => {
    // the land this map shows: travel from a town's teleporter looks over the overworld, not the town
    const cl = clampCenter(c, boundsOfChunks(g.map.maps[where].keys(), CT), 40);
    cam.current.cx = cl.cx; cam.current.cy = cl.cy;
    dirty.current = true;
  };
  const zoom = (d: number, px?: number, py?: number) => {
    const z = Math.max(0, Math.min(zooms.length - 1, cam.current.z + d));
    if (z === cam.current.z) return;
    const { w, h } = size();
    const next = zoomAt(view(), zooms[z], px ?? w / 2, py ?? h / 2, w, h);
    cam.current.z = z;
    setZoomIx(z);
    place(next);
  };
  // the player takes the map somewhere: stepping starts afresh from there
  const lookAround = () => {
    if (focusRef.current || anchor.current || ease.current) { focusRef.current = null; anchor.current = null; ease.current = null; setCard(null); dirty.current = true; }
  };
  const pan = (cx: number, cy: number) => { lookAround(); place({ ...view(), cx, cy }); };
  const recenter = () => { lookAround(); place({ ...home(), ppt: zooms[cam.current.z] }); };

  // view: step through everything named on the map, nearest the starting point first, then outward
  const stepMarks = (dir: 1 | -1) => {
    if (!anchor.current) anchor.current = { x: cam.current.cx, y: cam.current.cy };
    const order = markOrder(g.map.marks(where), anchor.current.x, anchor.current.y);
    const m = stepMark(order, focusRef.current, dir);
    if (!m) { setCard({ label: 'Nothing on the map yet', detail: 'Places join it as you find them' }); return; }
    focusRef.current = markKey(m);
    if (ui.reducedMotion.value) place({ ...view(), cx: m.tx, cy: m.ty });
    else ease.current = { cx: m.tx, cy: m.ty };
    setCard({ label: m.label, detail: m.detail || '', n: order.indexOf(m) + 1, total: order.length });
    g.audio?.play('uiMove');
    dirty.current = true;
  };

  // pins: at a tile (the cursor's), or at the middle of the map
  const canPin = !here && where === 'overworld';
  const pinAt = (x: number, y: number) => {
    if (!canPin) return;
    const r = togglePin(g.session.pins, x, y, Math.max(0.6, 12 / zooms[cam.current.z]));
    g.session.pins = r.pins;
    g.map.dirty = true;
    dirty.current = true;
    focusRef.current = null;
    const name = r.pin ? `${cap(r.pin.color)} pin` : '';
    setCard(r.did === 'full' ? { label: `${MAX_PINS} pins at most`, detail: 'Take one off first: press on it until it goes' }
      : r.did === 'removed' ? { label: 'Pin taken off', detail: '' }
      : { label: r.did === 'added' ? `${name} placed` : `Now a ${name.toLowerCase()}`, detail: 'Press on it again to change its colour, or to take it off' });
    g.audio?.play(r.did === 'full' ? 'uiBack' : 'uiOk');
  };
  const pinMiddle = () => pinAt(cam.current.cx, cam.current.cy);

  // travel: pick a destination (and look at it), then go
  const select = (id: string | null) => {
    selRef.current = id;
    setSel(id);
    const d = dests.find((x) => x.node.id === id);
    if (d) place({ cx: d.node.tx + 0.5, cy: d.node.ty + 0.5, ppt: zooms[cam.current.z] });
    dirty.current = true;
  };
  const step = (dir: number) => {
    if (!dests.length) return;
    const i = dests.findIndex((x) => x.node.id === selRef.current);
    select(dests[(i < 0 ? (dir > 0 ? 0 : dests.length - 1) : (i + dir + dests.length) % dests.length)].node.id);
  };
  const go = () => { if (here && selRef.current) g.travel.go(here.id, selRef.current); };

  const ring = (ctx: CanvasRenderingContext2D, v: MapCam, w: number, h: number, tx: number, ty: number, color: string, r: number, lw: number, dash = false) => {
    const at = pixelOf(v, tx + 0.5, ty + 0.5, w, h);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = lw + 3; ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = lw; if (dash) ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };
  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const v = view();
    g.map.render(c, v.cx, v.cy, v.ppt, { big: true, labels: v.ppt >= 3, mode: where });
    if (here) {
      const ctx = c.getContext('2d')!;
      ring(ctx, v, c.width, c.height, here.tx, here.ty, '#ffffff', 15, 2, true);
      for (const d of dests) {
        const on = d.node.id === selRef.current;
        ring(ctx, v, c.width, c.height, d.node.tx, d.node.ty, RING[d.node.kind], on ? 19 : 14, on ? 4 : 2.5);
        // towns carry their names on the map already; the party's waypoints get theirs here
        if (d.node.kind === 'waypoint' && (on || v.ppt >= 3)) {
          const at = pixelOf(v, d.node.tx + 0.5, d.node.ty + 0.5, c.width, c.height);
          ctx.save();
          ctx.font = `800 12px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#e2c8ff';
          ctx.strokeText(d.node.name, at.x, at.y + 30); ctx.fillText(d.node.name, at.x, at.y + 30);
          ctx.restore();
        }
      }
    } else {
      g.map.drawPlayer(c, p.wx, p.wy, v.ppt, v.cx, v.cy, 1, g.frame);
      const ctx = c.getContext('2d')!;
      const f = focusRef.current && g.map.marks(where).find((m: { tx: number; ty: number; label: string }) => markKey(m) === focusRef.current);
      if (f) ring(ctx, v, c.width, c.height, f.tx - 0.5, f.ty - 0.5, '#ffffff', 18, 2.5, true);
      // where a pin would go, for the pad and the keys
      if (canPin && g.input?.device !== 'mouse' && g.input?.device !== 'touch') {
        const x = c.width / 2, y = c.height / 2;
        ctx.save();
        for (const [col, lw] of [['rgba(0,0,0,.7)', 4], ['#ffffff', 1.5]] as const) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
          ctx.moveTo(x - 9, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 9, y);
          ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 9);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    dirty.current = false;
  };

  // the pad and tests reach the map through the bridge
  useEffect(() => {
    ui.mapCtl = {
      zoom, recenter,
      pan: (dx: number, dy: number) => pan(cam.current.cx + dx, cam.current.cy + dy),
      view: () => ({ ...view(), z: cam.current.z }),
      confirm: go,
      select, step,
      selected: () => selRef.current,
      stepMark: stepMarks,
      focused: () => focusRef.current,
      pin: pinMiddle,
      pinAt
    };
    return () => { ui.mapCtl = null; };
  }, []);

  // size the canvas to its box, and keep it so when the window changes
  useEffect(() => {
    const wrap = wrapRef.current, c = canvasRef.current;
    if (!wrap || !c) return;
    const fit = () => { c.width = Math.max(64, wrap.clientWidth); c.height = Math.max(64, wrap.clientHeight); dirty.current = true; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // pan with held keys and the left stick; redraw only when something changed
  useEffect(() => {
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;
      let vx = 0, vy = 0;
      const h = held.current;
      if (h.has('a') || h.has('arrowleft')) vx -= 1;
      if (h.has('d') || h.has('arrowright')) vx += 1;
      if (h.has('w') || h.has('arrowup')) vy -= 1;
      if (h.has('s') || h.has('arrowdown')) vy += 1;
      const m = g.input?.frame?.move;
      if (m && Math.hypot(m.x, m.y) > 0.2) { vx += m.x; vy += m.y; }
      if (vx || vy) {
        const ppt = zooms[cam.current.z];
        pan(cam.current.cx + (vx * PAN_PX * dt) / ppt, cam.current.cy + (vy * PAN_PX * dt) / ppt);
      } else if (ease.current) {
        // glide to the place in focus
        const e = ease.current, k = 1 - Math.pow(0.75, dt), x0 = cam.current.cx, y0 = cam.current.cy;
        place({ ...view(), cx: x0 + (e.cx - x0) * k, cy: y0 + (e.cy - y0) * k });
        if (Math.hypot(e.cx - cam.current.cx, e.cy - cam.current.cy) < 0.05 || Math.hypot(cam.current.cx - x0, cam.current.cy - y0) < 0.002) {
          place({ ...view(), cx: e.cx, cy: e.cy });
          ease.current = null;
        }
      }
      if (dirty.current || g.map.dirty) { g.map.dirty = false; draw(); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // keys: pan while held, zoom, recentre, step through places, pin (M and Esc close the map through the game's own handlers)
  useEffect(() => {
    const PAN = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (g.input?.keys?.actionFor(e.key) === 'map') return;
      if (PAN.includes(k)) { held.current.add(k); e.preventDefault(); }
      else if (k === '+' || k === '=') zoom(1);
      else if (k === '-' || k === '_') zoom(-1);
      else if (k === 'c' || k === 'home') recenter();
      else if (!here && (k === 'q' || k === 'e') && !e.repeat) stepMarks(k === 'q' ? -1 : 1);
      else if (k === 'p' && !e.repeat) pinMiddle();
    };
    const up = (e: KeyboardEvent) => { held.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // a pointer in canvas pixels (the canvas may be a frame behind a change of its box's size, and stretched to fit)
  const local = (e: PointerEvent | WheelEvent) => {
    const c = canvasRef.current!, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / (r.width || 1), y: ((e.clientY - r.top) * c.height) / (r.height || 1) };
  };
  const onDown = (e: PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.current.cx, cy: cam.current.cy, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) { const ppt = zooms[cam.current.z]; pan(d.cx - dx / ppt, d.cy - dy / ppt); setHover(null); }
      return;
    }
    const at = local(e), { w, h } = size(), r = canvasRef.current!.getBoundingClientRect();
    const m = markAt(g.map.marks(where), view(), at.x, at.y, w, h, 16);
    setHover(m ? { label: m.label, detail: m.detail || '', x: e.clientX - r.left, y: e.clientY - r.top } : null);
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    // a click (not a drag) on a ringed destination picks it
    if (!here || !d || d.moved) return;
    const at = local(e), { w, h } = size(), v = view();
    let best: string | null = null, bd = 22;
    for (const x of dests) {
      const px = pixelOf(v, x.node.tx + 0.5, x.node.ty + 0.5, w, h), dd = Math.hypot(px.x - at.x, px.y - at.y);
      if (dd < bd) { bd = dd; best = x.node.id; }
    }
    if (best) select(best);
  };
  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    const at = local(e as PointerEvent), { w, h } = size(), t = tileAt(view(), at.x, at.y, w, h);
    pinAt(t.tx, t.ty);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const at = local(e);
    zoom(e.deltaY < 0 ? 1 : -1, at.x, at.y);
  };

  const title = here ? `Travel from ${here.name}` : g.world.bounded ? g.interiorName : 'World map';
  const legend: [string, string][] = here
    ? [['teleporter', 'Town teleporter: a fare by distance'], ['tower-waypoint', 'Waypoint: free to another waypoint']]
    : g.world.bounded
    ? (g.interiorPoi?.type === 'city'
      ? [['door', 'Gate'], ['teleporter', 'Teleporter'], ['healer', 'Healer'], ['merchant', 'Merchant'], ['innkeeper', 'Inn'], ['elder', 'Elder'], ['board', 'Bounties'], ['dummy', 'Training ground']]
      : [['door', 'Exit'], ['chest', 'Treasure'], ['stairs-down', 'Stairs down']])
    : [['place-town', 'Town'], ['place-cave', 'Cave'], ['place-ruins', 'Ruins'], ['dungeon', 'Dungeon'], ['lair', 'Warlord lair'], ['flag', 'Visited'], ['check', 'Cleared']];
  const hint = here
    ? (onPad() ? `D-pad to pick a destination · ${glyph('interact')} travel · ${glyph('cancel')} stay` : 'Click a ringed place or pick from the list, then Travel · Esc to stay')
    : onPad()
    ? `Left stick to look around · D-pad: from place to place${canPin ? ` · ${glyph('skill2')} pin` : ''} · ${glyph('prevHero')} ${glyph('nextHero')} zoom · ${glyph('skill1')} back to you · ${glyph('cancel')} close`
    : `Drag or WASD to look around · Q E: from place to place${canPin ? ' · P or right-click: pin' : ''} · wheel or + - to zoom · C back to you · M or Esc to close`;
  const gold = ui.wallet.value.gold;
  const picked = dests.find((d) => d.node.id === sel) ?? null;
  return (
    <div class={`vs-panel vs-worldmap hit${here ? ' travel' : ''}`} role="dialog" aria-label={title}>
      <div class="top">
        <h2><Icon name="map" /> {title}</h2>
        <div class="tools">
          <button class="vs-btn vs-ico" onClick={() => zoom(-1)} aria-label="Zoom out" disabled={zoomIx === 0}><Icon name="minus" /></button>
          <span class="z">{zooms[zoomIx]}×</span>
          <button class="vs-btn vs-ico" onClick={() => zoom(1)} aria-label="Zoom in" disabled={zoomIx === zooms.length - 1}><Icon name="plus" /></button>
          <button class="vs-btn vs-ico" onClick={recenter} aria-label="Back to the party" title="Back to the party (C)"><Icon name="target" /></button>
          <button class="vs-btn vs-ico" onClick={() => g.ui.toggleMap(g)} aria-label="Close the map"><Icon name="close" /></button>
        </div>
      </div>
      <div class="view" ref={wrapRef}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)} onWheel={onWheel} onContextMenu={onContext} />
        {hover && <div class="tip" style={{ left: `${hover.x + 14}px`, top: `${hover.y + 10}px` }}><b>{hover.label}</b>{hover.detail && <small>{hover.detail}</small>}</div>}
        {card && !here && (
          <div class="card" aria-live="polite">
            <b>{card.label}</b>{card.detail && <small>{card.detail}</small>}
            {!!card.total && <span class="n">{card.n} of {card.total}</span>}
          </div>
        )}
        {here && (
          <div class="dests" aria-label="Destinations">
            {!dests.length && <div class="vs-empty">No other teleporter yet. Every town you enter joins the network, and so does every waypoint you build.</div>}
            {dests.map(({ node, fare, tiles }) => (
              <button key={node.id} type="button" class={`vs-btn dest ${node.kind}${sel === node.id ? ' on' : ''}`} data-dest={node.id} aria-pressed={sel === node.id} onClick={() => select(node.id)}>
                <Icon name={node.kind === 'town' ? 'teleporter' : 'tower-waypoint'} />
                <span class="tx"><b>{node.name}</b><small>{tiles} tiles · {fare ? `${fare} gold` : 'free'}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
      {picked && (
        <div class="confirm">
          <span>Travel to <b>{picked.node.name}</b> · {picked.fare ? <><Icon name="res-gold" /> {picked.fare} gold</> : 'free between waypoints'}{gold < picked.fare && <em> · you have {gold}</em>}</span>
          <button type="button" class="vs-btn go" disabled={gold < picked.fare} onClick={go}>Travel</button>
        </div>
      )}
      <div class="foot">
        <div class="legend">
          {legend.map(([ic, tx]) => <span key={tx}><Icon name={ic} /> {tx}</span>)}
          {canPin && <span><i class="pin" style={{ background: PIN_HEX.gold }} /> Your pins</span>}
        </div>
        <div class="hint">{hint}</div>
      </div>
    </div>
  );
}
