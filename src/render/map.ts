// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import { WORLD_CONFIG } from '../core/config';
import { BIOME_COLOR, BIOME, POI_INFO, GROUP_INFO, groupOf, isWaterBiome } from '../core/world/biomes';
import { blightColor } from '../core/world/corruption';
import { SURFACE_NUM } from '../core/world/surfaces';
import { drawIcon } from './icons';
import { FONT_UI, FONT_DISPLAY } from '../ui/fonts';

const ROAD = SURFACE_NUM.road;
const MARKER_NAMES = { chest: 'Treasure', door: 'Exit', 'stairs-up': 'Stairs up', 'stairs-down': 'Stairs down', lair: 'The boss', lock: 'Sealed vault', 'vault-gate': 'Open vault', 'vault-key': 'Vault key', lever: 'Lever', plate: 'Pressure plate',
    healer: 'Healer', merchant: 'Merchant', innkeeper: 'Inn', elder: 'Elder', board: 'Bounty board', dummy: 'Training ground', teleporter: 'Teleporter' };

const CT = WORLD_CONFIG.chunkTiles;
const T = WORLD_CONFIG.tile;

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const SUPER = 8;                     // chunks per side of a super tile
const superKey = (cx, cy) => `${Math.floor(cx / SUPER)},${Math.floor(cy / SUPER)}`;
const BADGE = { visited: { color: '#3d7fd6', icon: 'flag', word: 'Visited' }, cleared: { color: '#2f9e57', icon: 'check', word: 'Cleared' } };

function paintChunk(chunk, fog) {
    const canvas = document.createElement('canvas');
    canvas.width = CT;
    canvas.height = CT;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(CT, CT);
    for (let i = 0; i < CT * CT; i++) {
        const tx = chunk.cx * CT + (i % CT), ty = chunk.cy * CT + Math.floor(i / CT);
        if (fog && !fog.isRevealed(tx, ty)) { img.data[i * 4 + 3] = 0; continue; } // unexplored: stays dark
        const b = chunk.biomes[i];
        let c = BIOME_COLOR[b];
        if (b === BIOME.PEAK) c = 0xf0f4f8;
        else if (b === BIOME.MOUNTAIN) c = 0x8b909c;
        else if (b === BIOME.CITY_WALL) c = 0xb5473b;
        else if (b === BIOME.VOID) c = 0x000000;
        else if (b === BIOME.BRIDGE) c = 0xc89a5a;
        else if (b === BIOME.PLATEAU) c = 0xb8c0a0;
        if (chunk.surf && chunk.surf[i] === ROAD) c = 0xd2b47c;
        if (chunk.corrupt && chunk.corrupt[i] && !isWaterBiome(b)) c = blightColor(c, chunk.corrupt[i] / 255);
        img.data[i * 4] = (c >> 16) & 255;
        img.data[i * 4 + 1] = (c >> 8) & 255;
        img.data[i * 4 + 2] = c & 255;
        img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

// Remembers which chunks the player has seen and renders them as a minimap / world map.
export class MapView {
    constructor() {
        this.maps = { overworld: new Map(), interior: new Map() };
        this.pois = new Map();
        this.lairs = new Map();
        this.lairDefeated = () => false;
        this.siteList = new Map();      // discovered claim zones / ambush plates
        this.siteState = () => 'open';   // (id) => 'open' | 'done'
        this.sitesFor = null;            // (cx, cy) => Site[] near a chunk
        this.extras = () => [];          // () => [{ tx, ty, icon, label, color }] towers, docks, caches
        this.regions = () => [];         // () => [{ tx, ty, name, title, capital }] regions the player has seen
        this.placeBadge = () => null;    // (poi) => 'visited' | 'cleared' | null: a mark on the place's icon
        this.superTiles = new Map();     // 8x8 chunks composited at one pixel per tile, for the zoomed-out world map
        this.markers = [];       // extra markers (chests, exits) for interiors
        this.mode = 'overworld';
        this.minimap = document.createElement('canvas');
        this.minimap.width = 170;
        this.minimap.height = 170;
        this.dirty = true;
    }

    reset() {
        this.superTiles.clear();
        this.maps.overworld.clear();
        this.maps.interior.clear();
        this.pois.clear();
        this.lairs.clear();
        this.siteList.clear();
        this.markers = [];
        this.dirty = true;
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'interior') this.maps.interior.clear();
        this.markers = [];
        this.dirty = true;
    }

    // Repaint chunks whose fog changed, and pick up places / warlord lairs that have been seen.
    sync(fog, world, population, session) {
        if (!fog.dirty.size) return;
        const map = this.maps[this.mode];
        for (const key of fog.dirty) {
            const [cx, cy] = key.split(',').map(Number);
            const chunk = world.getChunk(cx, cy);
            map.set(key, paintChunk(chunk, fog));
            if (this.mode === 'overworld') this.superTiles.delete(superKey(cx, cy));
            if (this.mode === 'overworld') {
                for (const p of chunk.pois) if (fog.isRevealed(p.tx, p.ty)) this.pois.set(p.id, p);
                if (population) {
                    for (const c of population.campsForChunk(cx, cy)) {
                        if (c.lair && fog.isRevealed(c.tx, c.ty)) this.lairs.set(c.id, c);
                    }
                }
                if (this.sitesFor) {
                    for (const st of this.sitesFor(cx, cy)) if (fog.isRevealed(st.tx, st.ty)) this.siteList.set(st.id, st);
                }
            }
        }
        fog.dirty.clear();
        this.dirty = true;
    }

    discoveredPois() { return [...this.pois.values()]; }

    // Draw into any 2d canvas, centred on a tile position (opts.mode: draw that map instead of the current one)
    render(canvas, centerTx, centerTy, ppt, opts = {}) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, w, h);
        const mode = opts.mode || this.mode;      // travel looks over the overworld even from inside a town
        const map = this.maps[mode];
        const cs = CT * ppt;
        const ox = w / 2 - centerTx * ppt, oy = h / 2 - centerTy * ppt;
        if (mode === 'overworld' && ppt <= 2) {
            // zoomed far out: draw composited blocks of 8x8 chunks instead of thousands of small thumbnails
            const ss = cs * SUPER;
            const sx0 = Math.floor(-ox / ss), sx1 = Math.floor((w - ox) / ss), sy0 = Math.floor(-oy / ss), sy1 = Math.floor((h - oy) / ss);
            for (let sy = sy0; sy <= sy1; sy++) for (let sx = sx0; sx <= sx1; sx++) {
                const tile = this.superTile(sx, sy);
                if (tile) ctx.drawImage(tile, ox + sx * ss, oy + sy * ss, ss + 0.5, ss + 0.5);
            }
        } else {
            for (const [key, thumb] of map) {
                const [cx, cy] = key.split(',').map(Number);
                const x = ox + cx * cs, y = oy + cy * cs;
                if (x > w || y > h || x + cs < 0 || y + cs < 0) continue;
                ctx.drawImage(thumb, x, y, cs + 0.5, cs + 0.5);
            }
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const iconSize = opts.big ? 22 : 13;
        ctx.font = `${iconSize}px sans-serif`;
        if (mode === 'overworld') {
            for (const p of this.pois.values()) {
                const x = ox + p.tx * ppt, y = oy + p.ty * ppt;
                if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.beginPath(); ctx.arc(x, y, iconSize * 0.62, 0, Math.PI * 2); ctx.fill();
                drawIcon(ctx, p.dungeon ? 'dungeon' : POI_INFO[p.type].icon, x, y, iconSize * 0.95);
                const badge = BADGE[this.placeBadge(p)];
                if (badge && (opts.big || ppt >= 3)) {
                    const bx = x + iconSize * 0.55, by = y - iconSize * 0.55, br = Math.max(4.5, iconSize * 0.36);
                    ctx.fillStyle = badge.color; ctx.strokeStyle = '#0b0f18'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    drawIcon(ctx, badge.icon, bx, by, br * 1.35, 0xffffff);
                }
                if (opts.big && opts.labels !== false) {
                    ctx.font = `800 12px ${FONT_UI}`;
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 3;
                    const name = badge ? `${p.name} · ${badge.word}` : p.name;
                    ctx.strokeText(name, x, y + 24);
                    ctx.fillText(name, x, y + 24);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        if (mode === 'overworld') {
            for (const l of this.lairs.values()) {
                if (this.lairDefeated(l.id)) continue;
                const x = ox + l.tx * ppt, y = oy + l.ty * ppt;
                if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
                ctx.fillStyle = 'rgba(80,0,0,0.65)';
                ctx.beginPath(); ctx.arc(x, y, iconSize * 0.62, 0, Math.PI * 2); ctx.fill();
                drawIcon(ctx, 'lair', x, y, iconSize * 0.95);
                if (opts.big) {
                    ctx.font = `800 12px ${FONT_UI}`;
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
                    ctx.strokeText(`Lv ${l.level}`, x, y + 24);
                    ctx.fillStyle = '#ffb0b0';
                    ctx.fillText(`Lv ${l.level}`, x, y + 24);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        if (mode === 'overworld') {
            for (const st of this.siteList.values()) {
                const done = this.siteState(st.id) === 'done';
                if (st.kind === 'trigger' && done) continue;
                const x = ox + st.tx * ppt, y = oy + st.ty * ppt;
                if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
                const r = iconSize * (opts.big ? 0.55 : 0.42);
                ctx.fillStyle = st.kind === 'claim' ? (done ? '#f3c75a' : '#2a2a30') : '#5a1410';
                ctx.strokeStyle = st.kind === 'claim' ? '#f3c75a' : '#ff6a4a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                if (st.kind === 'claim') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
                else ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                if (opts.big) {
                    ctx.font = `800 11px ${FONT_UI}`;
                    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
                    const label = st.kind === 'claim' ? (done ? 'Claimed' : 'Zone') : 'Ambush';
                    ctx.strokeText(label, x, y + r + 12); ctx.fillText(label, x, y + r + 12);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        if (mode === 'overworld' && opts.big) {
            // region names, written large and faint across the land
            ctx.save();
            for (const r of this.regions()) {
                const x = ox + r.tx * ppt, y = oy + r.ty * ppt;
                if (x < -200 || y < -60 || x > w + 200 || y > h + 60) continue;
                ctx.font = `bold 20px ${FONT_DISPLAY}`;
                ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,8,4,0.75)'; ctx.fillStyle = 'rgba(255,236,190,0.9)';
                ctx.strokeText(r.name.toUpperCase(), x, y - 10); ctx.fillText(r.name.toUpperCase(), x, y - 10);
                ctx.font = `italic 600 12px ${FONT_UI}`;
                ctx.lineWidth = 3; ctx.fillStyle = 'rgba(232,220,190,0.85)';
                ctx.strokeText(r.title, x, y + 10); ctx.fillText(r.title, x, y + 10);
                if (r.capital) {
                    // the capital under the title, behind a crown
                    const cw = ctx.measureText(r.capital).width;
                    drawIcon(ctx, 'crown', x - cw / 2 - 9, y + 26, 13);
                    ctx.strokeText(r.capital, x + 8, y + 26); ctx.fillText(r.capital, x + 8, y + 26);
                }
            }
            ctx.restore();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `${iconSize}px sans-serif`;
        }
        if (mode === 'overworld') {
            for (const ex of this.extras()) {
                const x = ox + ex.tx * ppt, y = oy + ex.ty * ppt;
                if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.beginPath(); ctx.arc(x, y, iconSize * 0.58, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = ex.color || '#ffd070'; ctx.lineWidth = 2; ctx.stroke();
                drawIcon(ctx, ex.icon, x, y, iconSize * 0.85, ex.color ? parseInt(ex.color.slice(1), 16) : undefined);
                if (opts.big && ex.label) {
                    ctx.font = `800 11px ${FONT_UI}`;
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
                    ctx.strokeText(ex.label, x, y + iconSize * 0.6 + 11); ctx.fillStyle = '#ffe9a8'; ctx.fillText(ex.label, x, y + iconSize * 0.6 + 11);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        for (const m of mode === this.mode ? this.markers : []) {
            const x = ox + m.tx * ppt, y = oy + m.ty * ppt;
            drawIcon(ctx, m.icon, x, y, iconSize);
        }
        return { ox, oy };
    }

    /** A block of 8x8 explored chunks at one pixel per tile (built on first use, dropped when one of them repaints). */
    superTile(sx, sy) {
        const key = `${sx},${sy}`;
        if (this.superTiles.has(key)) return this.superTiles.get(key);
        const map = this.maps.overworld;
        let canvas = null;
        for (let j = 0; j < SUPER; j++) for (let i = 0; i < SUPER; i++) {
            const thumb = map.get(`${sx * SUPER + i},${sy * SUPER + j}`);
            if (!thumb) continue;
            if (!canvas) { canvas = document.createElement('canvas'); canvas.width = canvas.height = SUPER * CT; }
            canvas.getContext('2d').drawImage(thumb, i * CT, j * CT);
        }
        this.superTiles.set(key, canvas);
        return canvas;
    }

    /** Everything on the map that has a name, for the world map's hover and selection. */
    marks(mode = this.mode) {
        const out = [];
        if (mode !== 'overworld') {
            for (const m of this.markers) out.push({ tx: m.tx, ty: m.ty, label: MARKER_NAMES[m.icon] || '', detail: '' });
            return out.filter((m) => m.label);
        }
        for (const p of this.pois.values()) {
            const badge = BADGE[this.placeBadge(p)];
            out.push({ tx: p.tx, ty: p.ty, label: p.name, detail: `${p.dungeon ? `Dungeon, ${p.dungeon.floors} floors` : POI_INFO[p.type].label}${badge ? ` · ${badge.word}` : ''}`, poi: p });
        }
        for (const l of this.lairs.values()) if (!this.lairDefeated(l.id)) out.push({ tx: l.tx, ty: l.ty, label: 'Warlord lair', detail: `Level ${l.level}` });
        for (const st of this.siteList.values()) if (!(st.kind === 'trigger' && this.siteState(st.id) === 'done')) out.push({ tx: st.tx, ty: st.ty, label: st.kind === 'claim' ? 'Claimable zone' : 'Ambush', detail: st.kind === 'claim' && this.siteState(st.id) === 'done' ? 'Claimed' : '' });
        for (const ex of this.extras()) if (ex.label || ex.name) out.push({ tx: ex.tx, ty: ex.ty, label: ex.name || ex.label, detail: ex.detail || '', extra: ex });
        return out;
    }

    drawPlayer(canvas, px, py, ppt, centerTx, centerTy, facing, time) {
        const ctx = canvas.getContext('2d');
        const x = canvas.width / 2 + (px / T - centerTx) * ppt;
        const y = canvas.height / 2 + (py / T - centerTy) * ppt;
        const pulse = 4 + Math.sin(time * 0.15) * 1.2;
        ctx.fillStyle = 'rgba(80,160,255,0.35)';
        ctx.beginPath(); ctx.arc(x, y, pulse + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a6aff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    updateMinimap(px, py, time, ppt = 2) {
        this.render(this.minimap, px / T, py / T, ppt);
        this.drawPlayer(this.minimap, px, py, ppt, px / T, py / T, 1, time);
    }
}

export { GROUP_INFO, groupOf };
