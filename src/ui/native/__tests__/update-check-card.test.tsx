/**
 * update-check-card.test.tsx — «Проверить обновления» в настройках APK.
 *
 * Контракт: карточка показывает установленную версию и по нажатию просит
 * баннер обновления проверить фид (сам поток скачивания не дублируется).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const requestUpdateCheck = vi.hoisted(() => vi.fn());

vi.mock('../../../core/app-updater', () => ({
  requestUpdateCheck,
}));

vi.mock('../../../core/native-bridge', () => ({
  getDeviceInfo: vi.fn(async () => ({ appVersion: '3.0.4' })),
}));

import { UpdateCheckCard } from '../UpdateCheckCard';

beforeEach(() => {
  requestUpdateCheck.mockClear();
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
});
