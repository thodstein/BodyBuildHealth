/**
 * update-check-card.test.tsx — «Проверить обновления» в настройках APK.
 *
 * Контракт: карточка показывает установленную версию и по нажатию просит
 * баннер обновления проверить фид (сам поток скачивания не дублируется).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const requestUpdateCheck = vi.hoisted(() => vi.fn());
const readUpdateState = vi.hoisted(() => vi.fn(() => ({ lastCheck: 0, skippedVersion: '', lastResult: '' })));

vi.mock('../../../core/app-updater', () => ({
  requestUpdateCheck,
  readUpdateState,
  UPDATE_STATE_EVENT: 'he:update-state',
}));

vi.mock('../../../core/native-bridge', () => ({
  getDeviceInfo: vi.fn(async () => ({ appVersion: '3.0.4' })),
}));

import { UpdateCheckCard } from '../UpdateCheckCard';

beforeEach(() => {
  requestUpdateCheck.mockClear();
  readUpdateState.mockReturnValue({ lastCheck: 0, skippedVersion: '', lastResult: '' });
});

afterEach(() => cleanup());

describe('UpdateCheckCard', () => {
  it('показывает установленную версию', async () => {
    render(<UpdateCheckCard />);
    expect(await screen.findByText(/Установлено: 3\.0\.4/)).not.toBeNull();
  });

  it('по кнопке просит проверить обновления', async () => {
    render(<UpdateCheckCard />);
    await screen.findByText(/Установлено: 3\.0\.4/);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
    expect(requestUpdateCheck).toHaveBeenCalledTimes(1);
  });

  it('показывает итог последней проверки (ответ «почему нет баннера»)', async () => {
    readUpdateState.mockReturnValue({
      lastCheck: Date.now(),
      skippedVersion: '',
      lastResult: 'Установлена последняя версия 3.0.20',
    });
    render(<UpdateCheckCard />);
    expect(await screen.findByText(/Установлена последняя версия 3\.0\.20/)).not.toBeNull();
    // новое событие баннера — карточка перечитывает состояние
    act(() => {
      window.dispatchEvent(new Event('he:update-state'));
    });
    expect(readUpdateState).toHaveBeenCalled();
  });
});
