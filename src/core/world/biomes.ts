// Shared biome / tile data used by the overworld, interiors, renderer and map.

export const BIOME = {
    DEEP: 0, SHALLOW: 1, SAND: 2, DRY: 3, GRASS: 4, FOREST: 5, HILL: 6, MOUNTAIN: 7, PEAK: 8,
    CAVE_FLOOR: 9, CAVE_WALL: 10, RUIN_FLOOR: 11, RUIN_WALL: 12, CITY_FLOOR: 13, CITY_WALL: 14,
    CITY_STONE: 15, VOID: 16
};

export const BIOME_COLOR = [
    0x15406a, // DEEP
    0x2b82ad, // SHALLOW
    0xe4d49c, // SAND (seashore)
    0xd4a55a, // DRY (desert)
    0x62b447, // GRASS (field)
    0x2a6a38, // FOREST
    0x7d7769, // HILL (mountain foothills)
    0x4d515c, // MOUNTAIN (ground under the block)
    0x4d515c, // PEAK
    0x3a342c, // CAVE_FLOOR
    0x2a2620, // CAVE_WALL
    0x6c675d, // RUIN_FLOOR
    0x47443c, // RUIN_WALL
    0x9a8f7c, // CITY_FLOOR
    0x6b5a46, // CITY_WALL
    0x5a5a62, // CITY_STONE
    0x050507  // VOID
];

// Walls are raised blocks drawn in pseudo-3D
export const WALL_BIOMES = new Set([
    BIOME.MOUNTAIN, BIOME.PEAK, BIOME.CAVE_WALL, BIOME.RUIN_WALL, BIOME.CITY_WALL, BIOME.CITY_STONE
]);

const SOLID_TABLE = new Uint8Array(32);
[BIOME.DEEP, BIOME.MOUNTAIN, BIOME.PEAK, BIOME.CAVE_WALL, BIOME.RUIN_WALL, BIOME.CITY_WALL,
    BIOME.CITY_STONE, BIOME.VOID].forEach((b) => { SOLID_TABLE[b] = 1; });

export const isSolidBiome = (b: number) => SOLID_TABLE[b] === 1;
export const isWaterBiome = (b: number) => b === BIOME.DEEP || b === BIOME.SHALLOW;
export const isWallBiome = (b: number) => WALL_BIOMES.has(b);

// Gameplay "region" a tile belongs to. Drives enemy rosters, fauna and the map.
export const GROUP = {
    FIELD: 'field', FOREST: 'forest', DESERT: 'desert', SHORE: 'shore', MOUNTAIN: 'mountain',
    CAVE: 'cave', RUINS: 'ruins', CITY: 'city'
};

export function groupOf(b: number): string {
    switch (b) {
        case BIOME.DEEP: case BIOME.SHALLOW: case BIOME.SAND: return GROUP.SHORE;
        case BIOME.DRY: return GROUP.DESERT;
        case BIOME.GRASS: return GROUP.FIELD;
        case BIOME.FOREST: return GROUP.FOREST;
        case BIOME.HILL: case BIOME.MOUNTAIN: case BIOME.PEAK: return GROUP.MOUNTAIN;
        case BIOME.CAVE_FLOOR: case BIOME.CAVE_WALL: return GROUP.CAVE;
        case BIOME.RUIN_FLOOR: case BIOME.RUIN_WALL: return GROUP.RUINS;
        default: return GROUP.CITY;
    }
}

export const GROUP_INFO = {
    field: { name: 'Verdant Fields', icon: '🌾', color: 0x62b447 },
    forest: { name: 'Whispering Woods', icon: '🌲', color: 0x2a6a38 },
    desert: { name: 'Scorched Dunes', icon: '🏜️', color: 0xd4a55a },
    shore: { name: 'Salt Shore', icon: '🏖️', color: 0x4fb4d8 },
    mountain: { name: 'Stonecrest Mountains', icon: '⛰️', color: 0x9aa3b4 },
    cave: { name: 'Cave', icon: '🕳️', color: 0x6b5a46 },
    ruins: { name: 'Ruins', icon: '🏛️', color: 0x8a8478 },
    city: { name: 'City', icon: '🏘️', color: 0xd9b66a }
};

export const POI_INFO = {
    cave: { icon: '🕳️', label: 'Cave' },
    ruins: { icon: '🏛️', label: 'Ruins' },
    city: { icon: '🏘️', label: 'Town' }
};

// Which enemies roam each region. `level` is the player level at which they start appearing.
export interface RosterEntry { type: string; level: number; weight: number; group?: [number, number] }

// `level` is the minimum zone level at which a species appears.
export const ROSTERS: Record<string, RosterEntry[]> = {
    field: [
        { type: 'SLIME', level: 1, weight: 6 },
        { type: 'BEE', level: 2, weight: 3, group: [4, 7] },
        { type: 'BOAR', level: 3, weight: 3 }
    ],
    forest: [
        { type: 'WOLF', level: 1, weight: 5, group: [2, 4] },
        { type: 'SPIDER', level: 2, weight: 4 },
        { type: 'TREANT', level: 4, weight: 2 }
    ],
    desert: [
        { type: 'SCORPION', level: 1, weight: 5 },
        { type: 'VULTURE', level: 2, weight: 3 },
        { type: 'MUMMY', level: 4, weight: 3 }
    ],
    shore: [
        { type: 'CRAB', level: 1, weight: 5 },
        { type: 'GULL', level: 2, weight: 4, group: [3, 5] },
        { type: 'JELLY', level: 3, weight: 3 }
    ],
    mountain: [
        { type: 'BAT', level: 1, weight: 5, group: [3, 6] },
        { type: 'GOLEM', level: 3, weight: 3 },
        { type: 'TROLL', level: 4, weight: 3 }
    ]
};

export const WARLORDS: Record<string, string> = {
    field: 'BOAR_KING',
    forest: 'ANCIENT_TREANT',
    desert: 'SAND_PHARAOH',
    shore: 'CRAB_KING',
    mountain: 'STONE_TITAN'
};

// Interior population by place type
export const INTERIOR_ROSTERS: Record<string, string[]> = {
    cave: ['BAT', 'SPIDER', 'GOLEM', 'SCORPION'],
    ruins: ['SKELETON', 'GHOST', 'MUMMY', 'SKELETON'],
    city: []
};
