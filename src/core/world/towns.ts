// Town layouts with controlled randomness: size, street plan and houses vary from town to town, while the
// services (healer, merchant, inn, elder, bounty board, training dummy, teleporter) always stand somewhere that
// makes sense and can be walked to. Pure and seeded; verifyTown proves every service is reachable from the gate.
import { makeRng } from './noise';

export type TownSize = 'hamlet' | 'town' | 'city';
export type TownLayout = 'square' | 'market' | 'twin';
export type ServiceId = 'fountain' | 'altar' | 'healer' | 'merchant' | 'innkeeper' | 'elder' | 'board' | 'dummy' | 'teleporter';
export const SERVICES: ServiceId[] = ['fountain', 'altar', 'healer', 'merchant', 'innkeeper', 'elder', 'board', 'dummy', 'teleporter'];
/** Services that are a person (or a post) standing there, rather than a big prop: nothing solid may crowd them. */
const STANDING: ServiceId[] = ['healer', 'merchant', 'innkeeper', 'elder', 'board', 'dummy'];

/** Tile kinds of a town plan (mapped to biomes by the interior generator). */
export const TILE = { FLOOR: 0, WALL: 1, BUILDING: 2 } as const;

export interface Rect { x: number; y: number; w: number; h: number }
/** Positions are in tiles, as centres (world position = value x tile size). */
export interface TownSpot { x: number; y: number }
export interface TownDecor { type: string; x: number; y: number; variant: number }
export interface TownPlan {
  w: number; h: number;
  size: TownSize; layout: TownLayout;
  tiles: Uint8Array;                         // TILE values
  buildings: Rect[];
  hall: Rect;
  start: TownSpot; exit: TownSpot; gateX: number;
  services: Record<ServiceId, TownSpot>;
  decor: TownDecor[];
  villagers: (TownSpot & { hue: number })[];
}

const SIZES: Record<TownSize, [number, number]> = { hamlet: [46, 38], town: [60, 48], city: [72, 56] };
/** Collision radius of solid town props, in tiles (from the decor art: fountain 38 px, altar 28 ... at 48 px a tile). */
export const SOLID_RADIUS: Record<string, number> = { fountain: 0.8, altar: 0.6, stall: 0.67, well: 0.46, planter: 0.21, crate: 0.3, barrel: 0.23 };

/**
 * A town for this seed, or null if no valid layout came out in a few tries (the caller then keeps the classic
 * template). `capital` towns tend to be bigger. `gateVariant` picks the gate art for the region.
 */
export function planTown(seed: number, opts: { capital?: boolean; gateVariant?: number } = {}): TownPlan | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const plan = buildTown((seed + attempt * 7919) >>> 0, opts);
    if (plan && verifyTown(plan).ok) return plan;
  }
  return null;
}

function buildTown(seed: number, opts: { capital?: boolean; gateVariant?: number }): TownPlan | null {
  const rng = makeRng(seed);
  const r0 = rng();
  const size: TownSize = opts.capital ? (r0 < 0.6 ? 'city' : r0 < 0.9 ? 'town' : 'hamlet') : (r0 < 0.25 ? 'hamlet' : r0 < 0.75 ? 'town' : 'city');
  const layouts: TownLayout[] = size === 'hamlet' ? ['square', 'market'] : ['square', 'market', 'twin'];
  const layout = layouts[Math.floor(rng() * layouts.length)];
  const [w, h] = SIZES[size];
  const tiles = new Uint8Array(w * h);
  const open = new Uint8Array(w * h);        // streets, squares and the hall's forecourt: never built on
  const at = (x: number, y: number) => y * w + x;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) tiles[at(x, y)] = TILE.WALL;
  const keepOpen = (r: Rect) => { for (let y = Math.max(2, r.y); y < Math.min(h - 2, r.y + r.h); y++) for (let x = Math.max(2, r.x); x < Math.min(w - 2, r.x + r.w); x++) open[at(x, y)] = 1; };
  const build = (r: Rect) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[at(x, y)] = TILE.BUILDING; };

  // the gate in the south wall, a square inside it, and the avenue north
  const cx = Math.floor(w / 2);
  for (let y = h - 2; y < h; y++) for (let x = cx - 2; x <= cx + 2; x++) tiles[at(x, y)] = TILE.FLOOR;
  const gateSq: Rect = { x: cx - 6, y: h - 9, w: 13, h: 7 };
  keepOpen(gateSq);
  const small = size === 'hamlet';
  const plazaOf = (pcx: number, pcy: number, pw: number, ph: number): Rect => ({ x: Math.round(pcx - pw / 2), y: Math.round(pcy - ph / 2), w: pw, h: ph });
  const pw = (small ? 11 : 14) + Math.floor(rng() * 4), ph = (small ? 9 : 11) + Math.floor(rng() * 3);
  let main: Rect, market: Rect;
  if (layout === 'twin') {
    main = plazaOf(cx, Math.floor(h * 0.3), pw - 2, ph - 2);
    market = plazaOf(cx, Math.floor(h * 0.63), pw, ph - 3);
    keepOpen(main); keepOpen(market);
    keepOpen({ x: cx - 3, y: main.y, w: 6, h: gateSq.y - main.y + 1 });
  } else if (layout === 'market') {
    const side = rng() < 0.5 ? -1 : 1;
    const pcy = Math.floor(h * 0.45);
    main = plazaOf(cx + side * Math.floor(w * 0.2), pcy, pw - 2, ph);
    market = main;
    keepOpen(main);
    keepOpen({ x: 3, y: pcy - 2, w: w - 6, h: 5 });                         // the cross street
    keepOpen({ x: cx - 3, y: pcy - 2, w: 6, h: gateSq.y - pcy + 3 });       // the avenue up from the gate
  } else {
    main = plazaOf(cx, Math.floor(h * 0.43), pw, ph);
    market = main;
    keepOpen(main);
    keepOpen({ x: cx - 3, y: main.y + main.h - 1, w: 6, h: gateSq.y - main.y - main.h + 2 });
  }
  // the town hall stands north of the main square, with a forecourt between them
  const hw = (small ? 9 : 12) + Math.floor(rng() * 4), hh = 6 + Math.floor(rng() * 2);
  const hall: Rect = { x: Math.round(main.x + main.w / 2 - hw / 2), y: main.y - hh - 2, w: hw, h: hh };
  if (hall.y < 3) return null;
  build(hall);
  keepOpen({ x: hall.x - 1, y: hall.y + hall.h, w: hall.w + 2, h: 2 });

  // houses on the remaining ground, with alleys of at least two tiles between them
  const buildings: Rect[] = [hall];
  const free = (r: Rect) => {
    if (r.x < 3 || r.y < 3 || r.x + r.w > w - 3 || r.y + r.h > h - 3) return false;
    for (let y = r.y - 2; y < r.y + r.h + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (tiles[at(x, y)] === TILE.BUILDING) return false;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && open[at(x, y)]) return false;
    }
    return true;
  };
  for (let y = 3; y < h - 5; y++) for (let x = 3; x < w - 5; x++) {
    if (rng() < 0.35) continue;
    const r: Rect = { x, y, w: (small ? 4 : 5) + Math.floor(rng() * 5), h: 4 + Math.floor(rng() * 4) };
    if (!free(r)) continue;
    build(r);
    buildings.push(r);
    x += r.w + 1;
  }
  if (buildings.length < (small ? 5 : 8)) return null;

  // services, each where it belongs
  const mid = (r: Rect): TownSpot => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const fountain = mid(main);
  const altar = { x: hall.x + hall.w / 2, y: hall.y + hall.h + 0.9 };
  // the inn: the largest house whose south side faces open ground, its keeper at the door
  const doorOf = (b: Rect): TownSpot => ({ x: b.x + b.w / 2, y: b.y + b.h + 0.6 });
  const walkable = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && tiles[at(Math.floor(x), Math.floor(y))] === TILE.FLOOR;
  const houses = buildings.slice(1).filter((b) => walkable(b.x + b.w / 2, b.y + b.h + 0.6) && walkable(b.x + b.w / 2, b.y + b.h + 1.6)).sort((a, b) => b.w * b.h - a.w * a.h);
  const inn = houses[0] ? doorOf(houses[0]) : { x: main.x + 1.5, y: main.y + main.h - 1.5 };
  // which side each one takes changes from town to town; what it stands beside does not
  const hs = rng() < 0.5 ? 1 : -1;                         // the healer's side of the fountain (the market takes the other)
  const es = rng() < 0.5 ? 1 : -1;                         // the elder's side of the hall door
  const bs = rng() < 0.5 ? 1 : -1;                         // the board's corner of the square
  const ds = rng() < 0.5 ? 1 : -1;                         // the training yard's corner
  const ts = rng() < 0.5 ? 1 : -1;                         // the teleporter's side of the gate square
  const edge = (r: Rect, side: number, inset: number) => (side > 0 ? r.x + r.w - inset : r.x + inset);
  const services: Record<ServiceId, TownSpot> = {
    fountain,
    altar,
    elder: { x: altar.x + es * 3.5, y: altar.y + 0.4 },
    healer: { x: fountain.x + hs * 3.6, y: fountain.y + 0.4 },
    board: { x: edge(main, bs, 1.6), y: main.y + 1.6 },
    merchant: market === main ? { x: edge(main, -hs, 2.2), y: fountain.y + 0.4 } : { x: edge(market, -hs, 3), y: market.y + market.h / 2 },
    dummy: market === main ? { x: edge(main, ds, 1.8), y: main.y + main.h - 1.6 } : { x: edge(market, hs, 2.2), y: market.y + market.h / 2 },
    innkeeper: inn,
    teleporter: { x: cx + 0.5 + ts * 3.7, y: h - 5.4 }
  };
  for (const id of SERVICES) if (!walkable(services[id].x, services[id].y)) return null;
  for (let i = 0; i < SERVICES.length; i++) for (let j = i + 1; j < SERVICES.length; j++) {
    const a = services[SERVICES[i]], b = services[SERVICES[j]];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 2.4) return null;
  }

  const start = { x: cx + 0.5, y: h - 6 };
  const exit = { x: cx + 0.5, y: h - 4.4 };
  const plan: TownPlan = { w, h, size, layout, tiles, buildings, hall, start, exit, gateX: cx, services, decor: [], villagers: [] };

  // paths from the gate to every service stay clear of props
  const clear = clearance(plan);
  const nearService = (x: number, y: number, d: number) => SERVICES.some((id) => Math.hypot(services[id].x - x, services[id].y - y) < d);
  const decor = plan.decor;
  const put = (type: string, x: number, y: number, variant = 0) => {
    const solid = SOLID_RADIUS[type] !== undefined;
    if (solid && (clear[at(Math.floor(x), Math.floor(y))] || nearService(x, y, 2.2) || !walkable(x, y))) return false;
    if (solid && decor.some((d) => SOLID_RADIUS[d.type] !== undefined && Math.hypot(d.x - x, d.y - y) < 1.6)) return false;
    decor.push({ type, x, y, variant });
    return true;
  };
  decor.push({ type: 'fountain', x: fountain.x, y: fountain.y, variant: 0 });
  decor.push({ type: 'altar', x: altar.x, y: altar.y - 0.4, variant: 0 });
  decor.push({ type: 'gate', x: cx + 0.5, y: h - 1.1, variant: opts.gateVariant ?? 0 });
  // the teleporter's dais is walked onto (not solid); it is lit, since being here attunes it
  decor.push({ type: 'teleporter', x: services.teleporter.x, y: services.teleporter.y, variant: 1 });
  decor.push({ type: 'banner', x: hall.x + 1.5, y: hall.y + hall.h + 0.4, variant: 0 });
  decor.push({ type: 'banner', x: hall.x + hall.w - 1.5, y: hall.y + hall.h + 0.4, variant: 1 });
  // the market: stalls behind the merchant (on the far side from the fountain)
  const m = services.merchant;
  for (const [dx, dy] of [[-2.6, -1.5], [-2.6, 1.6], [0.4, -2.8], [0.4, 3]]) put('stall', m.x + hs * dx, m.y + dy, Math.floor(rng() * 3));
  // lamps along the avenue and round the squares (they do not block)
  for (let y = gateSq.y - 2; y > main.y + main.h; y -= 5) { put('lamp', cx - 3.6, y); put('lamp', cx + 3.6, y); }
  for (const p of [main, market]) {
    put('planter', p.x + 0.8, p.y + 0.8); put('planter', p.x + p.w - 0.8, p.y + 0.8);
    put('lamp', p.x + 0.8, p.y + p.h - 0.6); put('lamp', p.x + p.w - 0.8, p.y + p.h - 0.6);
  }
  // a well in a yard, barrels and crates against the houses
  for (let i = 0; i < 30; i++) {
    const x = 3 + rng() * (w - 6), y = 3 + rng() * (h - 6);
    if (!open[at(Math.floor(x), Math.floor(y))] && put('well', x, y)) break;
  }
  let props = 0;
  for (let i = 0; i < 200 && props < (small ? 7 : 12); i++) {
    const b = buildings[1 + Math.floor(rng() * (buildings.length - 1))];
    const side = rng() < 0.5 ? b.x - 0.6 : b.x + b.w + 0.6;
    const y = b.y + 0.5 + rng() * (b.h - 1);
    if (put(rng() < 0.5 ? 'barrel' : 'crate', side, y)) props++;
  }

  // ordinary townsfolk wander the streets and squares
  const folk = (size === 'hamlet' ? 7 : size === 'town' ? 9 : 12) + Math.floor(rng() * 3);
  for (let i = 0; i < 400 && plan.villagers.length < folk; i++) {
    const x = 3 + rng() * (w - 6), y = 3 + rng() * (h - 6);
    if (!open[at(Math.floor(x), Math.floor(y))] || !walkable(x, y) || nearService(x, y, 2)) continue;
    if (decor.some((d) => SOLID_RADIUS[d.type] !== undefined && Math.hypot(d.x - x, d.y - y) < SOLID_RADIUS[d.type] + 0.6)) continue;
    plan.villagers.push({ x, y, hue: Math.floor(rng() * 6) });
  }
  return plan;
}

/** Tiles on the shortest walk from the gate to each service, widened by one tile: props never go there. */
function clearance(plan: TownPlan): Uint8Array {
  const { w, h, tiles } = plan;
  const prev = new Int32Array(w * h).fill(-1);
  const sx = Math.floor(plan.start.x), sy = Math.floor(plan.start.y);
  const q = [sy * w + sx];
  prev[q[0]] = q[0];
  for (let head = 0; head < q.length; head++) {
    const c = q[head], x = c % w, y = (c / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (prev[n] !== -1 || tiles[n] !== TILE.FLOOR) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  const out = new Uint8Array(w * h);
  for (const id of SERVICES) {
    let c = Math.floor(plan.services[id].y) * w + Math.floor(plan.services[id].x);
    for (let guard = 0; prev[c] !== -1 && guard < w * h; guard++) {
      const x = c % w, y = (c / w) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
      }
      if (prev[c] === c) break;
      c = prev[c];
    }
  }
  return out;
}

/**
 * The accessibility proof: walking from the gate (4 directions, around houses and solid props), every service
 * and the exit can be reached, and nothing solid crowds the people who offer them.
 */
export function verifyTown(plan: TownPlan): { ok: boolean; reason?: string } {
  const { w, h, tiles } = plan;
  const blocked = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (tiles[i] !== TILE.FLOOR) blocked[i] = 1;
  for (const d of plan.decor) {
    const r = SOLID_RADIUS[d.type];
    if (r === undefined) continue;
    for (let y = Math.floor(d.y - r - 1); y <= Math.floor(d.y + r + 1); y++) for (let x = Math.floor(d.x - r - 1); x <= Math.floor(d.x + r + 1); x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      // a tile is blocked when the prop covers its centre
      if (Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) < r + 0.25) blocked[y * w + x] = 1;
    }
  }
  const seen = new Uint8Array(w * h);
  const sx = Math.floor(plan.start.x), sy = Math.floor(plan.start.y);
  if (blocked[sy * w + sx]) return { ok: false, reason: 'start blocked' };
  const q = [sy * w + sx];
  seen[q[0]] = 1;
  for (let head = 0; head < q.length; head++) {
    const c = q[head], x = c % w, y = (c / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (seen[n] || blocked[n]) continue;
      seen[n] = 1;
      q.push(n);
    }
  }
  // a spot counts as reached when a tile next to it (or under it) was reached
  const reached = (s: TownSpot) => {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const x = Math.floor(s.x) + ox, y = Math.floor(s.y) + oy;
      if (x >= 0 && y >= 0 && x < w && y < h && seen[y * w + x]) return true;
    }
    return false;
  };
  if (!reached(plan.exit)) return { ok: false, reason: 'exit unreachable' };
  for (const id of SERVICES) {
    const s = plan.services[id];
    if (tiles[Math.floor(s.y) * w + Math.floor(s.x)] !== TILE.FLOOR) return { ok: false, reason: `${id} inside a wall` };
    if (!reached(s)) return { ok: false, reason: `${id} unreachable` };
  }
  for (const id of STANDING) {
    const s = plan.services[id];
    for (const d of plan.decor) {
      const r = SOLID_RADIUS[d.type];
      if (r !== undefined && Math.hypot(d.x - s.x, d.y - s.y) < r + 1.2) return { ok: false, reason: `${id} crowded by ${d.type}` };
    }
  }
  return { ok: true };
}
