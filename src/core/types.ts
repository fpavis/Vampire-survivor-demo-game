// Shared data shapes for the deterministic core (no DOM, no Pixi).

export interface Vec2 { x: number; y: number }

export type PoiType = 'cave' | 'ruins' | 'city';

export interface Poi {
    id: string;
    type: PoiType;
    group: string;
    tx: number; ty: number;       // entrance landmark tile
    x: number; y: number;         // landmark position (world units)
    ex: number; ey: number;       // where the player stands to enter
    seed: number;
    name: string;
}

export interface DecorItem {
    type: string;
    variant: number;
    x: number; y: number;
    r: number;
    solid: boolean;
    flip: boolean;
}

export interface ChunkLike {
    cx: number; cy: number;
    x0: number; y0: number;
    size: number;
    biomes: Uint8Array;
    hard: Uint8Array;
    decor: DecorItem[];
    solids: DecorItem[];
    pois: Poi[];
}

export interface InteriorTheme {
    top: number;
    front: number;
    ambient: number;
    roofs?: number[];
    floor?: number;
}

// Anything that can supply terrain to the world renderer: the infinite overworld or a bounded interior.
export interface TerrainSource {
    bounded: boolean;
    seed: number;
    theme: InteriorTheme | null;
    w?: number;
    h?: number;
    biomeAt(tx: number, ty: number): number;
    decorForChunk(chunk: ChunkLike): void;
}

// Minimal world surface the navigation code needs (lets tests use a fake grid).
export interface SolidQuery {
    tileBlocked(tx: number, ty: number): boolean;
}
