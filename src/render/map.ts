// @ts-nocheck -- legacy JS, typed progressively as modules are rewritten (see docs/IMPLEMENTATION_PLAN.md)
import { WORLD_CONFIG } from '../core/config';
import { BIOME_COLOR, BIOME, POI_INFO, GROUP_INFO, groupOf } from '../core/world/biomes';

const CT = WORLD_CONFIG.chunkTiles;
const T = WORLD_CONFIG.tile;

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

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
        this.markers = [];       // extra markers (chests, exits) for interiors
        this.mode = 'overworld';
        this.minimap = document.createElement('canvas');
        this.minimap.width = 170;
        this.minimap.height = 170;
        this.dirty = true;
    }

    reset() {
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

    // Draw into any 2d canvas, centred on a tile position
    render(canvas, centerTx, centerTy, ppt, opts = {}) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, w, h);
        const map = this.maps[this.mode];
        const cs = CT * ppt;
        const ox = w / 2 - centerTx * ppt, oy = h / 2 - centerTy * ppt;
        for (const [key, thumb] of map) {
            const [cx, cy] = key.split(',').map(Number);
            const x = ox + cx * cs, y = oy + cy * cs;
            if (x > w || y > h || x + cs < 0 || y + cs < 0) continue;
            ctx.drawImage(thumb, x, y, cs + 0.5, cs + 0.5);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const iconSize = opts.big ? 22 : 13;
        ctx.font = `${iconSize}px sans-serif`;
        if (this.mode === 'overworld') {
            for (const p of this.pois.values()) {
                const x = ox + p.tx * ppt, y = oy + p.ty * ppt;
                if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.beginPath(); ctx.arc(x, y, iconSize * 0.62, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillText(p.dungeon ? '🗝️' : POI_INFO[p.type].icon, x, y + 1);
                if (opts.big) {
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 3;
                    ctx.strokeText(p.name, x, y + 24);
                    ctx.fillText(p.name, x, y + 24);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        if (this.mode === 'overworld') {
            for (const l of this.lairs.values()) {
                if (this.lairDefeated(l.id)) continue;
                const x = ox + l.tx * ppt, y = oy + l.ty * ppt;
                if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
                ctx.fillStyle = 'rgba(80,0,0,0.65)';
                ctx.beginPath(); ctx.arc(x, y, iconSize * 0.62, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillText('💀', x, y + 1);
                if (opts.big) {
                    ctx.font = 'bold 12px sans-serif';
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
                    ctx.strokeText(`Lv ${l.level}`, x, y + 24);
                    ctx.fillStyle = '#ffb0b0';
                    ctx.fillText(`Lv ${l.level}`, x, y + 24);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        if (this.mode === 'overworld') {
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
                    ctx.font = 'bold 11px sans-serif';
                    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
                    const label = st.kind === 'claim' ? (done ? 'Claimed' : 'Zone') : 'Ambush';
                    ctx.strokeText(label, x, y + r + 12); ctx.fillText(label, x, y + r + 12);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        if (this.mode === 'overworld') {
            for (const ex of this.extras()) {
                const x = ox + ex.tx * ppt, y = oy + ex.ty * ppt;
                if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.beginPath(); ctx.arc(x, y, iconSize * 0.58, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = ex.color || '#ffd070'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.fillText(ex.icon, x, y + 1);
                if (opts.big && ex.label) {
                    ctx.font = 'bold 11px sans-serif';
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
                    ctx.strokeText(ex.label, x, y + iconSize * 0.6 + 11); ctx.fillStyle = '#ffe9a8'; ctx.fillText(ex.label, x, y + iconSize * 0.6 + 11);
                    ctx.font = `${iconSize}px sans-serif`;
                }
            }
        }
        for (const m of this.markers) {
            const x = ox + m.tx * ppt, y = oy + m.ty * ppt;
            ctx.fillStyle = '#fff';
            ctx.fillText(m.icon, x, y + 1);
        }
        return { ox, oy };
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
