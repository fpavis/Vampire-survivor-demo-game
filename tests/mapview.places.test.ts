import { describe, expect, it, vi } from 'vitest';
import { FogOfWar } from '../src/core/world/fog';

// MapView draws into 2d canvases: a stub is enough to test which places it learns about.
const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });

const { MapView } = await import('../src/render/map');

const poi = (id: string, tx: number, ty: number) => ({ id, type: 'city', tx, ty, name: id });
const world = { getChunk: () => ({ cx: 0, cy: 0, biomes: new Uint8Array(32 * 32), pois: [] }) };

describe('the map learns places', () => {
  it('when a revealed tile belongs to a place whose gate is in another chunk', () => {
    const map = new MapView();
    const fog = new FogOfWar();
    const town = poi('3,4', 5, 5);
    const near = { tx: 5, ty: 5, poisNear: () => [town] };
    map.sync(fog, world, null, null, near);
    expect(map.discoveredPois()).toEqual([]);               // nothing revealed yet
    fog.reveal(5, 5);
    map.sync(fog, world, null, null, near);                  // the chunk the gate belongs to is not the one that changed
    expect(map.discoveredPois().map((p) => p.id)).toEqual(['3,4']);
  });

  it('only when the tile has been seen', () => {
    const map = new MapView();
    const fog = new FogOfWar();
    const near = { tx: 0, ty: 0, poisNear: () => [poi('far', 30, 30)] };
    fog.reveal(0, 0);
    map.sync(fog, world, null, null, near);
    expect(map.discoveredPois()).toEqual([]);
  });

  it('does not look again while the fog is the same', () => {
    const map = new MapView();
    const fog = new FogOfWar();
    const poisNear = vi.fn(() => []);
    fog.reveal(1, 1);
    map.sync(fog, world, null, null, { tx: 1, ty: 1, poisNear });
    map.sync(fog, world, null, null, { tx: 1, ty: 1, poisNear });
    expect(poisNear).toHaveBeenCalledTimes(1);
  });

  it('a place the party has been inside is known whether or not it was seen', () => {
    const map = new MapView();
    map.know(poi('9,9', 400, 400));
    expect(map.discoveredPois().map((p) => p.id)).toEqual(['9,9']);
    map.reset();
    expect(map.discoveredPois()).toEqual([]);
  });
});
