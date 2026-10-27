// A tiny typed event bus. Systems publish facts; quests, audio, saving and the UI subscribe.

export interface GameEvents {
  EnemyKilled: { type: string; level: number; x: number; y: number; boss: boolean; group?: string | null; dungeon?: boolean };
  CampCleared: { id: string };
  LairDefeated: { id: string; type: string };
  PlaceEntered: { id: string; name: string; kind: string; dungeon?: string | null; group?: string };
  FloorEntered: { id: string; floor: number; floors: number };
  DungeonCleared: { id: string; name: string; type: string; group: string; realm: string };
  DungeonCompleted: { id: string; name: string; type: string };
  WorldEventEnded: { kind: string; won: boolean };
  QuestCompleted: { id: string };
  Collected: { resource: string; count: number };
  TowerBuilt: { kind: string; id: string };
  ZoneClaimed: { id: string; level: number };
  PlaceLeft: { id: string };
  ZoneChanged: { group: string; level: number; tier: number };
  RegionEntered: { id: string; name: string; first: boolean };
  HeroLevelUp: { level: number };
  HeroDied: { respawnAt: string };
  ChestOpened: { placeId: string };
  GameSaved: { slot: string };
  GameLoaded: { slot: string };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<any>>>();

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) { set = new Set(); this.handlers.set(type, set); }
    set.add(handler);
    return () => { set!.delete(handler); };
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of [...set]) h(payload);
  }

  clear(): void { this.handlers.clear(); }
}
