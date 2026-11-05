/**
 * kv-error-banner.test.tsx — видимая ошибка облака.
 *
 * Контракт: сбой не показывается мгновенно (короткий обрыв сети — норма),
 * появляется после 15 c непрерывной ошибки, убирается при восстановлении.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

const listeners: Array<(s: { status: string; error?: string }) => void> = [];

vi.mock('../../core/cloud-kv', () => ({
  isKvCloudConfigured: () => true,
  getKvSyncState: () => ({ status: 'idle' }),
  onKvSyncStatus: (cb: (s: { status: string; error?: string }) => void) => {
    listeners.push(cb);
    return () => {};
  },
  syncKvNow: vi.fn(async () => 0),
}));

import { KvErrorBanner } from '../KvErrorBanner';

const BANNER = '[aria-label="Облако недоступно"]';

beforeEach(() => {
  listeners.length = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('KvErrorBanner', () => {
  it('сразу после сбоя не появляется', () => {
    const { container } = render(<KvErrorBanner />);
    act(() => listeners.forEach((cb) => cb({ status: 'error', error: 'нет сети' })));
    expect(container.querySelector(BANNER)).toBeNull();
  });

  it('после 15 c непрерывной ошибки — показывает текст и кнопку «Повторить»', () => {
    const { container, getByText } = render(<KvErrorBanner />);
    act(() => listeners.forEach((cb) => cb({ status: 'error', error: 'нет сети' })));
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(container.querySelector(BANNER)).not.toBeNull();
    expect(getByText('⚠️ Облако недоступно')).not.toBeNull();
    expect(getByText('Повторить')).not.toBeNull();
  });

  it('восстановление синка убирает баннер', () => {
    const { container } = render(<KvErrorBanner />);
    act(() => listeners.forEach((cb) => cb({ status: 'error', error: 'нет сети' })));
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(container.querySelector(BANNER)).not.toBeNull();

    act(() => listeners.forEach((cb) => cb({ status: 'idle' })));
    expect(container.querySelector(BANNER)).toBeNull();
  });

  it('короткий сбой, закончившийся до 15 c, баннер не показывает', () => {
    const { container } = render(<KvErrorBanner />);
    act(() => listeners.forEach((cb) => cb({ status: 'error' })));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    act(() => listeners.forEach((cb) => cb({ status: 'idle' })));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(container.querySelector(BANNER)).toBeNull();
  });
});
