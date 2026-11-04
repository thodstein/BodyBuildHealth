/**
 * profile-athlete-log-tab.test.tsx — журнал атлета (UI).
 *
 * Проверяем то, что видит тренер: записи подходов и веса тела сохраняются,
 * сводка считает только арифметику (без веса — не в тоннаже), «лучший подход»
 * подписан как максимум среди записей, удаление — через подтверждение.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfileAthleteLogTab } from '../ProfileAthleteLogTab';
import { localIsoDate } from '../../../../core/local-date';
import {
  addCoachAthlete,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';
import { readCoachLog, writeCoachLog, emptyCoachLog } from '../../../../engines/coach/coach-athlete-log.engine';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const seedAthletes = () => {
  let s = setCoachEnabled(emptyCoachState(), true);
  s = addCoachAthlete(s, { name: 'Иван' }, { id: 'a1' }).state;
  s = addCoachAthlete(s, { name: 'Пётр' }, { id: 'a2' }).state;
  writeCoachState(localStorage, s);
};

const items = (c: HTMLElement): NodeListOf<HTMLElement> => c.querySelectorAll('[data-log="item"]');

const set = (c: HTMLElement, key: string, value: string) =>
  fireEvent.change(c.querySelector(`[data-log="${key}"]`) as HTMLInputElement, { target: { value } });

const addLift = (c: HTMLElement, exercise: string, sets: string, reps: string, weight: string, rpe = '') => {
  set(c, 'exercise', exercise);
  set(c, 'sets', sets);
  set(c, 'reps', reps);
  set(c, 'weight', weight);
  if (rpe) set(c, 'rpe', rpe);
  fireEvent.click(c.querySelector('[data-log="save"]') as HTMLElement);
};

describe('пустые состояния', () => {
  it('без атлетов журнал честно говорит, что вести его не по кому', () => {
    const { container } = render(<ProfileAthleteLogTab />);
    expect(container.querySelector('[data-log="no-athletes"]')).not.toBeNull();
    expect(container.querySelector('[data-log="form"]')).toBeNull();
  });

  it('у атлета без записей — подсказка, а не пустой экран', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    expect(container.querySelector('[data-log="empty"]')?.textContent).toContain('Записей нет');
    expect(items(container)).toHaveLength(0);
  });
});

describe('запись подхода', () => {
  it('сохраняется, показывается и попадает в хранилище', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    addLift(container, 'Присед', '3', '5', '120', '8');

    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Присед');
    expect(items(container)[0].textContent).toContain('3×5 × 120 кг');
    expect(items(container)[0].textContent).toContain('RPE 8');
    const saved = readCoachLog(localStorage);
    expect(saved.items[0]).toMatchObject({
      athleteId: 'a1',
      exercise: 'Присед',
      sets: 3,
      reps: 5,
      weightKg: 120,
      rpe: 8,
      date: localIsoDate(),
    });
  });

  it('пустое упражнение — ошибка, запись не создаётся', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    fireEvent.click(container.querySelector('[data-log="save"]') as HTMLElement);
    expect(container.querySelector('[data-log="error"]')?.textContent).toContain('Укажите упражнение');
    expect(items(container)).toHaveLength(0);
  });

  it('нечисловые подходы отклоняются с понятным текстом', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    addLift(container, 'Жим', '0', '5', '80');
    expect(container.querySelector('[data-log="error"]')?.textContent).toContain('Подходов');
    expect(items(container)).toHaveLength(0);
  });

  it('тоннаж = подходы × повторы × вес; запись без веса в тоннаж не входит', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    const summaryText = () =>
      (container.querySelector('[data-log="summary"]')?.textContent ?? '').replace(/\u00A0/g, ' ');
    addLift(container, 'Присед', '3', '5', '100'); // 1500
    expect(summaryText()).toContain('1 500 кг');

    addLift(container, 'Подтягивания', '3', '8', ''); // без веса
    expect(items(container)).toHaveLength(2);
    expect(summaryText()).toContain('1 500 кг');
  });

  it('«лучший подход» — максимум среди записей и подписан честно', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    addLift(container, 'Присед', '5', '5', '100');
    addLift(container, 'Присед', '1', '1', '120');
    const best = container.querySelector('[data-log="best"]')?.textContent ?? '';
    expect(best).toContain('120 кг');
    expect(best).toContain('не расчётный максимум');
  });
});

describe('вес тела', () => {
  it('без веса — ошибка (нет бессмысленных записей)', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    fireEvent.click(container.querySelector('[data-log="kind"][data-kind="bodyweight"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-log="save"]') as HTMLElement);
    expect(container.querySelector('[data-log="error"]')?.textContent).toContain('Вес');
    expect(items(container)).toHaveLength(0);
  });

  it('две записи — тренд считается; одна — «мало данных»', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    fireEvent.click(container.querySelector('[data-log="kind"][data-kind="bodyweight"]') as HTMLElement);
    set(container, 'weight', '84');
    fireEvent.click(container.querySelector('[data-log="save"]') as HTMLElement);
    expect(container.querySelector('[data-log="summary"]')?.textContent).toContain('мало данных');

    set(container, 'weight', '82');
    fireEvent.click(container.querySelector('[data-log="save"]') as HTMLElement);
    const summary = container.querySelector('[data-log="summary"]')?.textContent ?? '';
    expect(summary).toContain('82 кг');
    expect(summary).toContain('-2 кг');
  });
});

describe('список и удаление', () => {
  it('удаление требует подтверждения', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab />);
    addLift(container, 'Присед', '3', '5', '100');
    const del = container.querySelector('[data-log="delete"]') as HTMLElement;
    fireEvent.click(del);
    expect(readCoachLog(localStorage).items).toHaveLength(1);
    fireEvent.click(container.querySelector('[data-log="delete"]') as HTMLElement);
    expect(readCoachLog(localStorage).items).toHaveLength(0);
    expect(items(container)).toHaveLength(0);
  });

  it('переключение атлета показывает только его записи', () => {
    seedAthletes();
    let log = emptyCoachLog();
    log = {
      version: 1,
      items: [
        {
          id: 'l1', athleteId: 'a1', date: '2026-11-04', kind: 'lift', exercise: 'Присед',
          sets: 3, reps: 5, weightKg: 100, rpe: null, note: '', createdAt: 'x', updatedAt: 'x',
        },
        {
          id: 'l2', athleteId: 'a2', date: '2026-11-04', kind: 'lift', exercise: 'Жим',
          sets: 3, reps: 5, weightKg: 80, rpe: null, note: '', createdAt: 'x', updatedAt: 'x',
        },
      ],
    };
    writeCoachLog(localStorage, log);

    const { container } = render(<ProfileAthleteLogTab />);
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Присед');

    fireEvent.change(container.querySelector('[data-log="athlete"]') as HTMLSelectElement, { target: { value: 'a2' } });
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Жим');
  });

  it('пришли из карточки — атлет уже выбран; удалённый — не подставляем', () => {
    seedAthletes();
    const { container } = render(<ProfileAthleteLogTab initialAthleteId="a2" />);
    expect((container.querySelector('[data-log="athlete"]') as HTMLSelectElement).value).toBe('a2');
    cleanup();
    const { container: ghost } = render(<ProfileAthleteLogTab initialAthleteId="ghost" />);
    expect((ghost.querySelector('[data-log="athlete"]') as HTMLSelectElement).value).toBe('a1');
  });
});
