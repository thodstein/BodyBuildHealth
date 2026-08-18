import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { KvSyncButton } from '../KvSyncButton';
import { initKvSync, _resetKvForTests, getKvSyncState, type KvRow, type KvTransport } from '../../core/cloud-kv';
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

afterEach(() => {
  vi.useRealTimers();
});

describe('KvSyncButton', () => {
  it('не показывается, когда синк выключен', () => {
    render(<KvSyncButton />);
    expect(screen.queryByRole('button', { name: /Синхронизировать/ })).toBeNull();
  });

  it('показывается при включённом синке и подтягивает данные по клику', async () => {
    const t = new FakeTransport();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });
    expect(getKvSyncState().status).not.toBe('off');

    render(<KvSyncButton />);
    const btn = screen.getByRole('button', { name: /Синхронизировать/ });
    expect(btn).toBeTruthy();

    // другое устройство добавило данные в облако → клик по кнопке подтягивает их
    t.seed('he_weight_log', '[{"w":82}]', Date.now());
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(localStorage.getItem('he_weight_log')).toBe('[{"w":82}]');
  });
});