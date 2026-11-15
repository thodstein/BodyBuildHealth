/**
 * coach-corner-button.test.tsx — угловая кнопка «в свой профиль» в режиме тренера.
 *
 * Проверяем ровно то, ради чего она сделана:
 *  1) пока режим выключен — кнопки нет (обычный пользователь её не видит);
 *  2) в домашнем пространстве она открывает профиль → «Режим тренера»;
 *  3) в данных атлета она сначала возвращает СВОИ данные (иначе профиль открылся
 *     бы в чужом пространстве), и точка возврата после reload — режим тренера;
 *  4) на самой вкладке тренера кнопка скрыта.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CoachCornerButton } from '../CoachCornerButton';
import { addCoachAthlete, emptyCoachState, setCoachEnabled, writeCoachState } from '../../engines/coach/coach-mode.engine';
import {
  HOME_SPACE_ID,
  _resetDataSpaceCache,
  activateAthleteSpace,
  emptyRegistry,
  readRegistryFromStorage,
  writeRegistryToStorage,
} from '../../core/data-space';
import { SPACE_RETURN_KEY } from '../../core/space-return';

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

const seedCoach = (enabled = true, athletes = true) => {
  let s = setCoachEnabled(emptyCoachState(), enabled);
  if (athletes) s = addCoachAthlete(s, { name: 'Иван' }, { id: 'a1' }).state;
  writeCoachState(localStorage, s);
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

describe('CoachCornerButton', () => {
  it('режим выключен → кнопки нет', () => {
    seedCoach(false);
    const { container } = render(<CoachCornerButton onOpenCoach={() => {}} />);
    expect(container.querySelector('[data-coach="corner"]')).toBeNull();
  });

  it('режим включён → в углу видно «Режим тренера» и активного атлета', () => {
    seedCoach(true);
    const { container } = render(<CoachCornerButton onOpenCoach={() => {}} />);
    const btn = container.querySelector('[data-coach="corner"]') as HTMLElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('data-mode')).toBe('profile');
    expect(btn?.textContent).toContain('Режим тренера');
    expect(btn?.textContent).toContain('Иван');
  });

  it('в домашнем пространстве кнопка открывает профиль тренера', () => {
    seedCoach(true);
    const open = vi.fn();
    const { container } = render(<CoachCornerButton onOpenCoach={open} />);
    fireEvent.click(container.querySelector('[data-coach="corner"]') as HTMLElement);
    expect(open).toHaveBeenCalledTimes(1);
    // Пространство не менялось: мы и так были в своих данных.
    expect(readRegistryFromStorage().spaces).toHaveLength(1);
  });

  it('в данных атлета сначала возвращает свои данные и точку возврата — режим тренера', () => {
    seedCoach(true);
    activateAthleteSpace('a1', 'Иван');
    _resetDataSpaceCache();
    const stub = stubReload();
    try {
      const open = vi.fn();
      const { container } = render(<CoachCornerButton onOpenCoach={open} />);
      const btn = container.querySelector('[data-coach="corner"]') as HTMLElement | null;
      expect(btn?.getAttribute('data-mode')).toBe('space');
      expect(btn?.textContent).toContain('Мой профиль');
      fireEvent.click(btn as HTMLElement);
      // В чужом профиле не остаёмся: домашнее пространство активно до reload.
      expect(readRegistryFromStorage().active).toBe(HOME_SPACE_ID);
      expect(stub.reload).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
      // После перезагрузки App вернёт в профиль → «Режим тренера».
      const raw = localStorage.getItem(SPACE_RETURN_KEY);
      expect(raw).toBeTruthy();
      const target = JSON.parse(String(raw)) as { tab: string; subTab: string | null };
      expect(target.tab).toBe('profile');
      expect(target.subTab).toBe('coach');
    } finally {
      stub.restore();
    }
  });

  it('на самой вкладке тренера кнопка скрыта', () => {
    seedCoach(true);
    const { container } = render(<CoachCornerButton hidden onOpenCoach={() => {}} />);
    expect(container.querySelector('[data-coach="corner"]')).toBeNull();
  });
});
