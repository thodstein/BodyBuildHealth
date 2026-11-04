/**
 * data-space-banner.test.tsx — полоса «вы в данных атлета».
 *
 * Это не декор: полоса — единственное, что не даёт тренеру править чужой профиль,
 * думая, что это его собственный. Тесты держат три вещи:
 *  1) в домашнем пространстве баннера НЕТ (обычный пользователь его не видит);
 *  2) в пространстве атлета видно имя и честное объяснение, чьи данные открыты;
 *  3) «К своим данным» возвращает домашнее пространство и перезагружает приложение.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { DataSpaceBanner } from '../DataSpaceBanner';
import {
  DATA_SPACE_KEY,
  _resetDataSpaceCache,
  activateAthleteSpace,
  activateHomeSpace,
  athleteSpaceId,
  emptyRegistry,
  readRegistryFromStorage,
  writeRegistryToStorage,
} from '../../core/data-space';

const stubReload = () => {
  const reload = vi.fn();
  const original = window.location.reload;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
  return {
    reload,
    restore: () =>
      Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: original } }),
  };
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
  writeRegistryToStorage(emptyRegistry());
});

afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});

describe('полоса пространства данных', () => {
  it('в домашнем пространстве ничего не рисуется', () => {
    const { container } = render(<DataSpaceBanner />);
    expect(container.querySelector('[data-space="banner"]')).toBeNull();
  });

  it('в пространстве атлета видно имя и что именно открыто', () => {
    activateAthleteSpace('a1', 'Иван Петров');
    _resetDataSpaceCache();
    const { container } = render(<DataSpaceBanner />);
    const banner = container.querySelector('[data-space="banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Иван Петров');
    expect(banner?.textContent).toContain('Данные атлета');
    // честно: заметки и планер тренера — по-прежнему общие
    expect(banner?.textContent).toContain('Заметки и планер тренера общие');
  });

  it('«К своим данным» переключает на home и перезагружает приложение', () => {
    activateAthleteSpace('a1', 'Иван');
    _resetDataSpaceCache();
    const { reload, restore } = stubReload();
    try {
      const { container } = render(<DataSpaceBanner />);
      fireEvent.click(container.querySelector('[data-space="return"]') as HTMLElement);
      expect(reload).toHaveBeenCalledTimes(1);
      const reg = readRegistryFromStorage();
      expect(reg.active).toBe('home');
      expect(JSON.parse(localStorage.getItem(DATA_SPACE_KEY) as string).active).toBe('home');
    } finally {
      restore();
    }
  });

  it('после возврата баннер больше не показывается', () => {
    activateAthleteSpace('a1', 'Иван');
    activateHomeSpace();
    cleanup();
    const { container } = render(<DataSpaceBanner />);
    expect(container.querySelector('[data-space="banner"]')).toBeNull();
  });

  it('можно перейти сразу к другому атлету, не возвращаясь в home', () => {
    activateAthleteSpace('a1', 'Иван');
    activateAthleteSpace('a2', 'Пётр');
    _resetDataSpaceCache();
    const { reload, restore } = stubReload();
    try {
      const { container } = render(<DataSpaceBanner />);
      // в полосе показан текущий, а в списке — остальные
      expect(container.querySelector('[data-space="banner"]')?.textContent).toContain('Пётр');
      fireEvent.click(container.querySelector('[data-space="switch"]') as HTMLElement);
      const target = container.querySelector(
        `[data-space="switch-to"][data-space-id="${athleteSpaceId('a1')}"]`,
      ) as HTMLElement;
      expect(target).toBeTruthy();
      fireEvent.click(target);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(readRegistryFromStorage().active).toBe(athleteSpaceId('a1'));
    } finally {
      restore();
    }
  });

  it('если пространств только одно — предлагать «Сменить» нечего', () => {
    activateAthleteSpace('a1', 'Иван');
    _resetDataSpaceCache();
    const { container } = render(<DataSpaceBanner />);
    expect(container.querySelector('[data-space="switch"]')).toBeNull();
  });
});
