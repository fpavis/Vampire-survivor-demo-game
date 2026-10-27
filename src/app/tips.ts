// Shows each onboarding tip once, when it becomes relevant: listens to game events and checks a few conditions
// twice a second, then puts one tip at a time on a small card that never blocks play.
import { nextTip, openConditions, tipsForCondition, tipsForEvent, type TipCondition } from '../core/onboarding/tips';
import type { GameEvents } from '../core/sim/events';
import { panelOpen, ui as uiBridge } from '../ui/bridge';
import { access } from './access';

const SHOW = 9 * 60;        // frames a tip stays up
const GAP = 4 * 60;         // frames between two tips
const FIRST = 90;           // the first tip waits for the zone banner
const POLL = 30;

const EVENTS: (keyof GameEvents)[] = ['PlaceEntered'];

export class TipSystem {
  seen = new Set<string>();
  private fired = new Set<string>();
  private timer = 0;          // frames left on the current tip
  private wait = FIRST;       // frames until the next tip may show
  private poll = 0;
  private hurtMark: number | undefined;
  private startSpells = 0;

  constructor(private game: any) {
    for (const type of EVENTS) {
      game.events.on(type, (payload: object) => { for (const id of tipsForEvent(type, payload)) this.fired.add(id); });
    }
  }

  /** A new or loaded game: `seen` comes from the save. */
  reset(seen: string[] = []) {
    this.seen = new Set(seen);
    this.fired.clear();
    this.timer = 0;
    this.wait = FIRST;
    this.poll = 0;
    this.hurtMark = this.game.lastHurt;
    this.startSpells = this.game.spells.spells.length;
    uiBridge.tip.value = null;
  }

  /** Show every tip again (from the pause menu). */
  forget() {
    this.seen.clear();
    this.fired.clear();
    this.wait = 30;
  }

  /** Hides the current tip; false when none is shown. */
  dismiss() {
    if (!uiBridge.tip.value) return false;
    uiBridge.tip.value = null;
    this.timer = 0;
    this.wait = GAP;
    return true;
  }

  update(delta: number) {
    if (!access.tips) { if (uiBridge.tip.value) uiBridge.tip.value = null; return; }
    if ((this.poll -= delta) <= 0) {
      this.poll = POLL;
      for (const cond of openConditions(this.seen)) if (this.check(cond)) for (const id of tipsForCondition(cond)) this.fired.add(id);
    }
    if (uiBridge.tip.value) {
      if ((this.timer -= delta) <= 0) this.dismiss();
      return;
    }
    if ((this.wait -= delta) > 0 || this.blocked()) return;
    const tip = nextTip(this.seen, this.fired);
    if (!tip) return;
    this.seen.add(tip.id);
    this.fired.delete(tip.id);
    uiBridge.tip.value = { id: tip.id, icon: tip.icon, text: tip.text };
    this.timer = SHOW;
  }

  private blocked() {
    const g = this.game;
    return panelOpen() || g.busy || g.state.gameOver || !!g.ui.mapOverlay;
  }

  private check(cond: TipCondition): boolean {
    const g = this.game, s = g.state, p = s.player;
    switch (cond) {
      case 'start': return !!p;
      case 'xp': return s.experience > 0 || s.level > 1;
      case 'pending': return uiBridge.pending.value > 0;
      case 'hurt': return g.lastHurt !== this.hurtMark;
      case 'skill': return s.time > 45 && uiBridge.active.value.some(Boolean);
      case 'loot': return g.spells.runes.length > 0 || g.spells.spells.length > this.startSpells;
      case 'door': return g.target?.kind === 'enter';
      case 'road': return uiBridge.surface.value?.name === 'Road';
      case 'materials': { const w = s.wallet; return w.wood + w.stone + w.iron > 0; }
      case 'quest': return !!uiBridge.tracker.value;
      case 'explore': return g.regionsSeen.size >= 2 || s.time > 240;
      case 'party': return s.time > 120;
      case 'boss': return !!p && s.enemies.some((e: any) => e.isBoss && !e.dead && Math.hypot(e.wx - p.wx, e.wy - p.wy) < 700);
    }
  }
}
