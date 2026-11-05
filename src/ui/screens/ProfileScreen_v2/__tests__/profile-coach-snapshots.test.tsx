/**
 * profile-coach-snapshots.test.tsx — сводка по атлету на карточке тренера.
 *
 * Проверяем пользовательский сценарий:
 *  • карточки рисуются сразу, сводки подставляются асинхронно;
 *  • «тренировка сегодня / план есть» — из ДАННЫХ атлета, а не из ручного журнала;
 *  • пустое пространство честно говорит «нет данных», а не «0 дней»;
 *  • фильтр «требуют внимания» оставляет только тех, кому есть что смотреть;
 *  • сортировка «давно не тренировался» ставит «нет данных» наверх.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

const spaceStores = vi.hoisted(() => ({
  bySpace: {} as Record<string, Record<string, unknown[]>>,
  failFor: new Set<string>(),
}));

vi.mock('../../../../core/db', () => ({
  readSpaceStores: vi.fn(async (sid: string) => {
    if (spaceStores.failFor.has(sid)) throw new Error('boom');
    return spaceStores.bySpace[sid] ?? {};
  }),
  spaceDbRecordCount: vi.fn(async () => 0),
  listSpaceDatabaseIds: vi.fn(async () => null),
}));

import { ProfileCoachTab } from '../ProfileCoachTab';
import {
  addCoachAthlete,
  coachToday,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';
import {
  _resetDataSpaceCache,
  athleteSpaceId,
  toPhysicalKey,
} from '../../../../core/data-space';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  spaceStores.bySpace = {};
  spaceStores.failFor = new Set();
  _resetDataSpaceCache();
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});

const seed = (names: string[]) => {
  let s = setCoachEnabled(emptyCoachState(), true);
  names.forEach((name, i) => {
    s = addCoachAthlete(s, { name }, { id: `a${i + 1}`, now: '2026-11-05T10:00:00.000Z' }).state;
  });
  writeCoachState(localStorage, s);
};

const cards = (c: HTMLElement) => c.querySelectorAll('[data-coach="athlete"]');
const cardByName = (c: HTMLElement, name: string): HTMLElement | null => {
  for (const card of Array.from(cards(c))) {
    if (card.textContent?.includes(name)) return card as HTMLElement;
  }
  return null;
};

describe('сводка из данных атлета', () => {
  it('тренировка и план видны, пустое пространство — «нет данных»', async () => {
    seed(['Иван', 'Пётр']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = {
      training_log: [
        { id: 'l1', date: coachToday(), exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5, rir: 2 }] },
      ],
    };
    localStorage.setItem(toPhysicalKey(sid1, 'he_pl_macro'), JSON.stringify({ v: 7, b: ['присед'], t: 12 }));
    localStorage.setItem(
      toPhysicalKey(sid1, 'he_weight_log'),
      JSON.stringify([{ date: coachToday(), weight: 82.5 }]),
    );

    const { container } = render(<ProfileCoachTab />);

    await waitFor(() => {
      const ivan = cardByName(container, 'Иван');
      expect(ivan?.querySelector('[data-coach="snapshot"]')?.textContent).toContain('тренировка сегодня');
    });
    const ivan = cardByName(container, 'Иван')!;
    expect(ivan.querySelector('[data-coach="snapshot"]')?.textContent).toContain('план есть');
    expect(ivan.querySelector('[data-coach="snapshot"]')?.textContent).toContain('вес 82,5 кг');
    expect(ivan.querySelector('[data-coach="attention"]')).toBeNull();

    await waitFor(() => {
      const petr = cardByName(container, 'Пётр');
      expect(petr?.querySelector('[data-coach="snapshot"]')?.textContent).toBe('нет данных в приложении');
    });
    const petr = cardByName(container, 'Пётр')!;
    expect(petr.querySelector('[data-coach="attention"]')?.textContent).toContain('нет сохранённой программы');
    expect(petr.querySelector('[data-coach="snapshot"]')?.textContent).not.toContain('0 дн.');
  });

  it('ошибка чтения одного пространства не рушит остальные', async () => {
    seed(['Иван', 'Пётр']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = {
      training_log: [{ date: coachToday(), sets: [{ weight: 50, reps: 10 }] }],
    };
    const db = await import('../../../../core/db');
    const original = db.readSpaceStores;
    spaceStores.failFor = new Set([athleteSpaceId('a2')]);
    expect(typeof original).toBe('function');

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toContain(
        'тренировка сегодня',
      );
    });
    // Пётр не «завис» — получил пустую сводку
    await waitFor(() => {
      expect(cardByName(container, 'Пётр')?.querySelector('[data-coach="snapshot"]')?.textContent).toBe(
        'нет данных в приложении',
      );
    });
    spaceStores.failFor = new Set();
  });
});

describe('фильтр и сортировка', () => {
  it('«Требуют внимания» оставляет только проблемные карточки', async () => {
    seed(['Иван', 'Пётр']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = { training_log: [{ date: coachToday(), sets: [{ weight: 100, reps: 5 }] }] };
    localStorage.setItem(toPhysicalKey(sid1, 'he_bb_macro'), JSON.stringify({ a: 1 }));

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(container.querySelector('[data-coach="attention-filter"]')?.textContent).toContain('(1)');
    });
    fireEvent.click(container.querySelector('[data-coach="attention-filter"]') as HTMLElement);
    await waitFor(() => expect(cards(container)).toHaveLength(1));
    expect(cards(container)[0].textContent).toContain('Пётр');

    fireEvent.click(container.querySelector('[data-coach="attention-filter"]') as HTMLElement);
    await waitFor(() => expect(cards(container)).toHaveLength(2));
  });

  it('«Давно не тренировался» ставит «нет данных» наверх, затем большее число дней', async () => {
    seed(['Иван', 'Пётр', 'Анна']);
    spaceStores.bySpace[athleteSpaceId('a1')] = {
      training_log: [{ date: coachToday(), sets: [{ weight: 100, reps: 5 }] }],
    };
    spaceStores.bySpace[athleteSpaceId('a2')] = {};

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toContain(
        'тренировка сегодня',
      );
    });
    fireEvent.change(container.querySelector('[data-coach="athlete-sort"]') as HTMLSelectElement, {
      target: { value: 'inactive' },
    });
    await waitFor(() => {
      const names = Array.from(cards(container)).map(c => c.textContent ?? '');
      // без данных — наверх (Пётр и Анна), затем Иван
      expect(names[2]).toContain('Иван');
    });
  });

  it('«Обновить сводки» перечитывает данные, а не показывает старые', async () => {
    seed(['Иван']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = {};
    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toBe(
        'нет данных в приложении',
      );
    });

    spaceStores.bySpace[sid1] = { training_log: [{ date: coachToday(), sets: [{ weight: 60, reps: 5 }] }] };
    fireEvent.click(container.querySelector('[data-coach="snapshots-refresh"]') as HTMLElement);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toContain(
        'тренировка сегодня',
      );
    });
  });
});
