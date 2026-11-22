/**
 * async-timeout.test.ts — «обещание не вечно».
 * Зависший нативный вызов не должен вешать проверку обновлений.
 */
import { describe, it, expect, vi } from 'vitest';
import { TimeoutError, withTimeout, withTimeoutOr } from '../async-timeout';

describe('withTimeout', () => {
  it('1. быстрый промис отдаётся как есть', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'fast')).resolves.toBe('ok');
  });

  it('2. висяк → TimeoutError с меткой', async () => {
    vi.useFakeTimers();
    try {
      const call = withTimeout(new Promise<string>(() => {}), 50, 'LiveUpdate.getCurrentBundle');
      const assertion = expect(call).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(60);
      await assertion;
      await expect(call.catch((e: TimeoutError) => e.message)).resolves.toContain('LiveUpdate.getCurrentBundle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('3. отказ плагина пробрасывается (не маскируется таймаутом)', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });
});

describe('withTimeoutOr', () => {
  it('4. сбой и таймаут → fallback, вызывающий продолжает работу', async () => {
    vi.useFakeTimers();
    try {
      await expect(withTimeoutOr(Promise.reject(new Error('no plugin')), 10, null)).resolves.toBeNull();
      const hang = withTimeoutOr(new Promise<string>(() => {}), 40, null);
      await vi.advanceTimersByTimeAsync(50);
      await expect(hang).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('5. поздний отказ «проигравшего» не даёт unhandledrejection', async () => {
    vi.useFakeTimers();
    const seen: unknown[] = [];
    const onUnhandled = (e: unknown) => seen.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      let rejectLate: (e: Error) => void = () => {};
      const late = new Promise<string>((_, rej) => {
        rejectLate = rej;
      });
      const raced = withTimeoutOr(late, 20, 'fallback');
      await vi.advanceTimersByTimeAsync(30);
      await expect(raced).resolves.toBe('fallback');
      rejectLate(new Error('поздно'));
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      expect(seen).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      vi.useRealTimers();
    }
  });
});
