/**
 * cardio-timer-intervals.test.tsx — интервальный режим таймера (аудит 2026-11, ч.2).
 *
 * Дефект: таймер знал только один обратный отсчёт. Текст сессии обещал
 * «8×1 мин / 1 мин отдыха», а на тренировке атлет видел «40:00» и считал
 * подходы в голове; записать «сделал 6 из 8» было некуда.
 *
 * Контракт: структура сессии → пошаговый режим (разминка → работа/отдых →
 * заминка), кнопка «Дальше» пропускает шаг, а дневник получает план и факт
 * по подходам. Без структуры — прежний одиночный отсчёт (ничего не выдумываем).
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioSessionTimer } from '../CardioSessionTimer';
import { CardioDiaryPanel } from '../CardioDiaryPanel';
import { buildCardioCycle, type CardioCycle } from '../../../../engines/lms/cardio.engine';
import { loadCardioLog, type CardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';

const pad = (n: number) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Цикл, у которого сегодняшняя сессия несёт структуру 2×(1 мин / 30 с). */
function cycleWithIntervals(): CardioCycle {
  const base = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'iv-timer' });
  const dow = (new Date().getDay() + 6) % 7;
  const template = base.weeks[0].sessions[0];
  return {
    ...base,
    startDate: todayIso(),
    weeks: base.weeks.map((w, i) => i === 0 ? {
      ...w,
      sessions: [{
        ...template, type: 'hiit', durationMin: 20, dayOfWeek: dow, weeklyFrequency: 1,
        structured: [{ workSec: 60, restSec: 30, reps: 2 }],
      }],
    } : w),
  };
}

describe('CardioSessionTimer: интервальный режим', () => {
  beforeEach(() => localStorage.clear());

  it('список «сегодня» предупреждает, что таймер поведёт по подходам', () => {
    render(<CardioSessionTimer cycle={cycleWithIntervals()} />);
    expect(screen.getByText(/2×01:00 \/ 00:30 — таймер ведёт по подходам/)).toBeTruthy();
  });

  it('ведёт по шагам: разминка → работа → отдых → работа', () => {
    render(<CardioSessionTimer cycle={cycleWithIntervals()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт HIIT' }));

    expect(screen.getByText('Разминка')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Следующий шаг' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Следующий шаг' }));
    expect(screen.getByText('Работа 1/2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Следующий шаг' }));
    expect(screen.getByText('Отдых 1/2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Следующий шаг' }));
    expect(screen.getByText('Работа 2/2')).toBeTruthy();
  });

  it('досрочное завершение пишет факт по подходам, а не «всё сделано»', () => {
    render(<CardioSessionTimer cycle={cycleWithIntervals()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт HIIT' }));
    // разминка → работа 1 → отдых 1 → начало работы 2 (второй подход не закрыт)
    const next = screen.getByRole('button', { name: 'Следующий шаг' });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(screen.getByRole('button', { name: /завершить/i }));

    expect(screen.getByText(/Интервалы: 1 из 2 подходов/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /сохранить в дневник/i }));
    const log = loadCardioLog();
    expect(log).toHaveLength(1);
    expect(log[0].intervalsPlanned).toBe(2);
    expect(log[0].intervalsDone).toBe(1);
    expect(log[0].workSec).toBe(60);
    expect(log[0].restSec).toBe(30);
    expect(log[0].notes).toContain('интервалы: 1 из 2');
  });

  it('без structure — один отсчёт, без кнопки «Дальше» и без выдуманных подходов', () => {
    const base = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'plain-timer' });
    const dow = (new Date().getDay() + 6) % 7;
    const cycle: CardioCycle = {
      ...base,
      startDate: todayIso(),
      weeks: base.weeks.map((w, i) => i === 0 ? {
        ...w,
        sessions: [{ ...base.weeks[0].sessions[0], type: 'zone2', durationMin: 30, dayOfWeek: dow, weeklyFrequency: 1, structured: undefined }],
      } : w),
    };
    render(<CardioSessionTimer cycle={cycle} />);
    expect(screen.queryByText(/таймер ведёт по подходам/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Старт Zone 2' }));
    expect(screen.queryByRole('button', { name: 'Следующий шаг' })).toBeNull();
    expect(screen.getByRole('timer')).toBeTruthy();
  });
});

describe('CardioDiaryPanel: факт по подходам виден в журнале', () => {
  beforeEach(() => localStorage.clear());

  it('показывает «6/8» и подсказку с длительностью работы/отдыха', () => {
    const log: CardioLogEntry[] = [{
      id: 'iv-1', date: '2026-11-01', type: 'hiit', durationMin: 40, completed: true,
      intervalsPlanned: 8, intervalsDone: 6, workSec: 60, restSec: 90,
    }];
    const { container } = render(<CardioDiaryPanel cycle={null} log={log} />);
    const chip = container.querySelector('[data-cardio="diary-intervals"]');
    expect(chip).toBeTruthy();
    expect(chip!.textContent).toContain('6/8');
    expect(chip!.getAttribute('title')).toMatch(/работа 1 мин/i);
  });
});
