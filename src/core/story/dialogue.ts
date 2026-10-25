// Data-driven dialogue: scripts are nodes with lines, choices, conditions and effects. A runner walks them.
export type Cond =
  | { flag: string }
  | { noFlag: string }
  | { quest: string; is: 'none' | 'active' | 'ready' | 'done' }
  | { gold: number };

export type Effect =
  | { flag: string; value?: number | boolean }
  | { start: string }
  | { turnIn: string }
  | { gold: number }
  | { loot: number }
  | { talk: string }
  | { say: string };

export interface Choice { text: string; next?: string; if?: Cond[]; effects?: Effect[] }

export interface DialogueNode {
  speaker: string;
  icon?: string;
  text: string;
  next?: string;
  choices?: Choice[];
  effects?: Effect[];              // run when the node is reached
}

export interface DialogueScript { id: string; start: string; nodes: Record<string, DialogueNode> }

export interface DialogueContext {
  check(c: Cond): boolean;
  apply(e: Effect): void;
  vars(name: string): string;
}

export interface DialogueView {
  speaker: string;
  icon: string;
  text: string;
  choices: { text: string; index: number }[];
  last: boolean;                   // nothing follows: the next press ends it
}

export const fillVars = (text: string, vars: (name: string) => string): string => text.replace(/\{([\w.:-]+)\}/g, (_, n) => vars(n));

export class DialogueRunner {
  node: string;
  done = false;

  constructor(readonly script: DialogueScript, private ctx: DialogueContext) {
    this.node = script.start;
    this.enter(script.start);
  }

  private enter(id: string): void {
    const n = this.script.nodes[id];
    if (!n) { this.done = true; return; }
    this.node = id;
    for (const e of n.effects ?? []) this.ctx.apply(e);
  }

  view(): DialogueView {
    const n = this.script.nodes[this.node];
    const choices = (n.choices ?? [])
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => (c.if ?? []).every((k) => this.ctx.check(k)))
      .map(({ c, index }) => ({ text: fillVars(c.text, this.ctx.vars), index }));
    return { speaker: n.speaker, icon: n.icon ?? '🧓', text: fillVars(n.text, this.ctx.vars), choices, last: !n.next && !choices.length };
  }

  /** Move on (a click, or a chosen answer). Returns true while the conversation continues. */
  advance(choice?: number): boolean {
    if (this.done) return false;
    const n = this.script.nodes[this.node];
    const visible = this.view().choices;
    if (visible.length) {
      const pick = visible.find((c) => c.index === choice);
      if (!pick) return true;                                       // an answer is required
      const c = n.choices![pick.index];
      for (const e of c.effects ?? []) this.ctx.apply(e);
      if (!c.next) { this.done = true; return false; }
      this.enter(c.next);
      return !this.done;
    }
    if (!n.next) { this.done = true; return false; }
    this.enter(n.next);
    return !this.done;
  }
}
