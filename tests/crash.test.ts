import { describe, expect, it } from 'vitest';
import { crashKey, crashReport, describeError, isNoise, type CrashInfo } from '../src/core/crash';

const info = (o: Partial<CrashInfo> = {}): CrashInfo => ({
  message: 'boom', stack: 'Error: boom\n    at step (game.ts:10:5)\n    at gameLoop (game.ts:20:3)', where: 'loop',
  version: '0.15.0', build: 'abc1234 2026-10-28', agent: 'TestBrowser/1.0', mode: 'overworld', place: 'Hearthvale',
  log: ['Level 3!', 'Game saved'], at: '2026-10-28T12:00:00Z', ...o
});

describe('crash reports', () => {
  it('reads errors, rejections and anything else thrown', () => {
    const e = new TypeError('x is undefined');
    expect(describeError(e).message).toBe('x is undefined');
    expect(describeError(e).stack).toContain('TypeError');
    expect(describeError({ message: 'plain object' })).toEqual({ message: 'plain object', stack: '' });
    expect(describeError('a string')).toEqual({ message: 'a string', stack: '' });
    expect(describeError(42).message).toBe('42');
    expect(describeError(null).message).toBe('null');
  });

  it('says what, where, which version and what the game was doing', () => {
    const r = crashReport(info());
    expect(r).toContain('Error: boom');
    expect(r).toContain('the game loop');
    expect(r).toContain('0.15.0 (abc1234 2026-10-28)');
    expect(r).toContain('overworld · Hearthvale');
    expect(r).toContain('TestBrowser/1.0');
    expect(r).toContain('at step (game.ts:10:5)');
    expect(r).toContain('  Game saved');
  });

  it('keeps the last ten messages and copes with no stack or log', () => {
    const log = Array.from({ length: 25 }, (_, i) => `line ${i}`);
    const r = crashReport(info({ log, stack: '', where: 'promise' }));
    expect(r).toContain('line 24');
    expect(r).toContain('line 15');
    expect(r).not.toContain('line 14');
    expect(r).toContain('(no stack)');
    expect(r).toContain('a background task');
    expect(crashReport(info({ log: [] }))).toContain('(none)');
  });

  it('treats the same error from the same place as one crash', () => {
    const a = info(), b = info({ stack: a.stack.replace('10:5', '10:5') });
    expect(crashKey(a.message, a.stack)).toBe(crashKey(b.message, b.stack));
    expect(crashKey('boom', 'Error\n    at other (x.ts:1:1)')).not.toBe(crashKey(a.message, a.stack));
  });

  it('ignores the browser\'s own noise', () => {
    expect(isNoise('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(isNoise('Script error.')).toBe(true);
    expect(isNoise('Cannot read properties of undefined')).toBe(false);
  });
});
