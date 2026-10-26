// Game feel rules: how long a hit freezes the action, where the camera looks while walking and when damage
// numbers stack into one. Pure functions; the runtime applies them (app/game.ts, render/effects.ts).

export type StopKind = 'crit' | 'bigKill' | 'bossKill';

/** Frames the simulation holds still for each kind of impact. */
export const HIT_STOP: Record<StopKind, number> = { crit: 2, bigKill: 4, bossKill: 10 };
/** A crit freezes at most this often, so a stream of crits does not stutter. */
export const CRIT_STOP_COOLDOWN = 45;

/** Frames to freeze, scaled by the shake setting (0 turns it off); 0 while a crit stop is cooling down. */
export function hitStopFrames(kind: StopKind, strength: number, frame: number, lastCritStop: number): number {
  if (!(strength > 0)) return 0;
  if (kind === 'crit' && frame - lastCritStop < CRIT_STOP_COOLDOWN) return 0;
  return Math.max(1, Math.round(HIT_STOP[kind] * Math.min(1, strength)));
}

/** How far ahead of the hero the camera looks while walking (world units; less vertically, the ground is tilted). */
export const CAMERA_LEAD = 36;
/** The camera eases toward its target (a fraction per frame, see Game.updateCamera)... */
export const CAMERA_FOLLOW = 1 - Math.pow(0.001, 1 / 60);
/** ...so at a steady walk it trails by `speed * FOLLOW_LAG`; the lead makes up for that to stay ahead. */
export const FOLLOW_LAG = (1 - CAMERA_FOLLOW) / CAMERA_FOLLOW;

/** Where the camera aims, relative to the hero: ahead along the direction of travel, at any walking speed. */
export function cameraLead(dx: number, dy: number, moving: boolean, speed = 0, lead = CAMERA_LEAD): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (!moving || d < 1e-6) return { x: 0, y: 0 };
  const lag = Math.max(0, speed) * FOLLOW_LAG;
  return { x: (dx / d) * (lead + lag), y: (dy / d) * (lead * 0.7 + lag) };
}

/** A damage number joins the live one on the same monster while the last hit is this recent (frames)... */
export const STACK_GAP = 18;
/** ...and the number is younger than this, so a long fight still shows fresh numbers. */
export const STACK_MAX_AGE = 90;

export const canStack = (sinceLastHit: number, age: number) => sinceLastHit <= STACK_GAP && age <= STACK_MAX_AGE;
