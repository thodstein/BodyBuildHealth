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
  setActiveSpace,
  touchSpaceOpened,
  upsertSpace,
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

  it('в списке «Сменить» последние открытые идут первыми', () => {
    // Порядок задаём явными отметками времени: три подряд activation могли бы
    // попасть в одну миллисекунду, и тест стал бы флейком.
    let reg = emptyRegistry();
    reg = upsertSpace(reg, { id: athleteSpaceId('a1'), athleteId: 'a1', label: 'Иван' }).registry;
    reg = upsertSpace(reg, { id: athleteSpaceId('a2'), athleteId: 'a2', label: 'Пётр' }).registry;
    reg = upsertSpace(reg, { id: athleteSpaceId('a3'), athleteId: 'a3', label: 'Олег' }).registry;
    reg = touchSpaceOpened(reg, athleteSpaceId('a1'), '2026-11-01T09:00:00.000Z');
    reg = touchSpaceOpened(reg, athleteSpaceId('a3'), '2026-11-03T09:00:00.000Z');
    reg = touchSpaceOpened(reg, athleteSpaceId('a2'), '2026-11-04T09:00:00.000Z');
    writeRegistryToStorage(setActiveSpace(reg, athleteSpaceId('a2')));
    _resetDataSpaceCache();

    const { container } = render(<DataSpaceBanner />);
    fireEvent.click(container.querySelector('[data-space="switch"]') as HTMLElement);
    const ids = Array.from(container.querySelectorAll('[data-space="switch-to"]')).map(
      el => el.getAttribute('data-space-id'),
    );
    // активный (a2) в списке не дублируется; остальные — от свежих к старым
    expect(ids).toEqual([athleteSpaceId('a3'), athleteSpaceId('a1')]);
  });

  it('текст не уезжает под плавающие кнопки синка/языка, а кнопки — отдельной строкой', () => {
    // В App.tsx кнопки синка и языка висят absolute top-8 right-8 поверх верха
    // экрана. Если полоса займёт ту же строку, «К своим данным» окажется под ними.
    activateAthleteSpace('a1', 'Иван');
    _resetDataSpaceCache();
    const { container } = render(<DataSpaceBanner />);
    const banner = container.querySelector('[data-space="banner"]') as HTMLElement;
    const firstRow = banner.firstElementChild as HTMLElement;
    const textCol = firstRow.lastElementChild as HTMLElement;
    expect(Number.parseInt(textCol.style.paddingRight || '0', 10)).toBeGreaterThanOrEqual(80);
    expect(firstRow.querySelector('[data-space="return"]')).toBeNull();
  });

  it('список атлетов прокручивается внутри полосы, а не растягивает экран', () => {
    // Лимит — 20 атлетов: 19 пилюль в четыре ряда сдвинули бы весь экран вниз,
    // и на телефоне кнопка «К своим данным» уехала бы из виду.
    let reg = emptyRegistry();
    for (let i = 1; i <= 19; i++) {
      reg = upsertSpace(reg, { id: athleteSpaceId(`a${i}`), athleteId: `a${i}`, label: `Атлет ${i}` }).registry;
    }
    writeRegistryToStorage(reg);
    _resetDataSpaceCache();
    activateAthleteSpace('a1', 'Атлет 1');
    _resetDataSpaceCache();

    const { container } = render(<DataSpaceBanner />);
    fireEvent.click(container.querySelector('[data-space="switch"]') as HTMLElement);
    const list = container.querySelector('[data-space="switch-list"]') as HTMLElement;
    expect(Number.parseInt(list.style.maxHeight || '0', 10)).toBeGreaterThan(0);
    expect(list.style.overflowY).toBe('auto');
    expect(container.querySelectorAll('[data-space="switch-to"]').length).toBe(18);
    // пилюля — не меньше 32 px по высоте: иначе по ней тяжело попасть пальцем
    const pill = container.querySelector('[data-space="switch-to"]') as HTMLElement;
    expect(Number.parseInt(pill.style.minHeight || '0', 10)).toBeGreaterThanOrEqual(32);
  });
});
