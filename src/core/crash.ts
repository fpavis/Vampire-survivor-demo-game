// What a crash report says: the error, where it happened and enough about the game and browser to find the
// cause. Pure, so the report's shape is tested without a browser.

export type CrashWhere = 'loop' | 'event' | 'promise';

export interface CrashInfo {
  message: string;
  stack: string;
  where: CrashWhere;
  version: string;
  build: string;
  agent: string;
  /** what the game was doing: the title, the overworld, a place, and its name */
  mode: string;
  place: string;
  /** the last lines of the message log, oldest first */
  log: string[];
  at: string;
}

/** An error, a rejection's reason, or anything else thrown, as a message and a stack (either may be empty). */
export function describeError(err: unknown): { message: string; stack: string } {
  if (err instanceof Error) return { message: err.message || err.name || 'Error', stack: err.stack || '' };
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; stack?: unknown };
    if (typeof o.message === 'string') return { message: o.message, stack: typeof o.stack === 'string' ? o.stack : '' };
    try { return { message: JSON.stringify(err).slice(0, 300), stack: '' }; } catch { /* circular */ }
  }
  return { message: String(err), stack: '' };
}

/** The same error thrown again and again (every frame, say) is one crash: the message and the top of the stack. */
export function crashKey(message: string, stack: string): string {
  const top = stack.split('\n').map((l) => l.trim()).find((l) => l.startsWith('at ') || l.includes('@')) || '';
  return `${message}|${top}`;
}

/** Errors that are the browser's own noise, not the game's: never worth stopping for. */
export function isNoise(message: string): boolean {
  return /ResizeObserver loop|Script error\.?$|^Load failed$|AbortError|The play\(\) request was interrupted/i.test(message);
}

const LINES = 10;

/** The text the player copies and sends. */
export function crashReport(c: CrashInfo): string {
  const where = c.where === 'loop' ? 'the game loop (the game stopped)' : c.where === 'promise' ? 'a background task' : 'an event handler';
  const stack = c.stack ? c.stack.split('\n').slice(0, 14).join('\n') : '(no stack)';
  return [
    `Error: ${c.message}`,
    `Where: ${where}`,
    `Version: ${c.version} (${c.build})`,
    `When: ${c.at}`,
    `Playing: ${c.mode}${c.place ? ` · ${c.place}` : ''}`,
    `Browser: ${c.agent}`,
    '',
    'Stack:',
    stack,
    '',
    `Last messages (${Math.min(LINES, c.log.length)}):`,
    ...(c.log.length ? c.log.slice(-LINES).map((l) => `  ${l}`) : ['  (none)'])
  ].join('\n');
}
