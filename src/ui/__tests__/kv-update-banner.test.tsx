import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { KvUpdateBanner, KV_BANNER_AUTO_HIDE_MS } from '../KvUpdateBanner';
import {
  initKvSync,
  pullKvNow,
  _resetKvForTests,
  clearKvPendingUpdate,
  type KvRow,
  type KvTransport,
} from '../../core/cloud-kv';
import { chunkValue } from '../../core/cloud-kv';

class FakeTransport implements KvTransport {
  cloud = new Map<string, KvRow[]>();
  async pull(_token: string, onRows: (rows: KvRow[]) => void, onServerNow?: (ms: number) => void): Promise<void> {
    if (onServerNow) onServerNow(Date.now());
    onRows([...this.cloud.values()].flat());
  }
  async replaceKey(rows: KvRow[]): Promise<void> {
    this.cloud.set(rows[0]?.key || '', rows);
  }
  async removeKey(): Promise<void> {}
  keepAlivePush(): void {}
  seed(key: string, value: string, tsMs: number): void {
    const chunks = chunkValue(value);
    this.cloud.set(
      key,
      chunks.map((c, i) => ({
        id: 'tk_test',
        key,
        chunk_index: i,
        chunk_count: i === 0 ? chunks.length : 0,
        value: c,
        updated_at: new Date(tsMs).toISOString(),
      })),
    );
  }
}

beforeEach(() => {
  _resetKvForTests();
  localStorage.clear();
});

describe('KvUpdateBanner', () => {
  it('не показывается без новых данных', async () => {
    const t = new FakeTransport();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });
    render(<KvUpdateBanner />);
    expect(screen.queryByText(/Новые данные/)).toBeNull();
  });

  it('показывается при новых данных с другого устройства и скрывается по ✕', async () => {
    const t = new FakeTransport();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });
    t.seed('he_profile_v2', '{"v":2}', 9000);
    await pullKvNow();

    render(<KvUpdateBanner />);
    expect(screen.getByText(/Новые данные с другого устройства/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Перезагрузить приложение/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Скрыть уведомление/ }));
    expect(screen.queryByText(/Новые данные/)).toBeNull();
    expect(clearKvPendingUpdate).toBeDefined();
  });

  it('кнопка «Обновить» вызывает reloadKvView → перезагрузка страницы', async () => {
    const t = new FakeTransport();
    const reload = vi.fn();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, reloadFn: reload });
    t.seed('he_profile_v2', '{"v":2}', 9000);
    await pullKvNow();

    render(<KvUpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: /Перезагрузить приложение/ }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('авто-скрывается через KV_BANNER_AUTO_HIDE_MS', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });
    t.seed('he_profile_v2', '{"v":2}', 9000);
    await pullKvNow();

    render(<KvUpdateBanner />);
    expect(screen.getByText(/Новые данные с другого устройства/)).toBeTruthy();

    act(() => { vi.advanceTimersByTime(KV_BANNER_AUTO_HIDE_MS); });
    expect(screen.queryByText(/Новые данные/)).toBeNull();
  });
});

afterEach(() => {
  vi.useRealTimers();
});