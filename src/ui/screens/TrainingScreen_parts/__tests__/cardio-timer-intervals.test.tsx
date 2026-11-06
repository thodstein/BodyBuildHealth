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
function cycleWithIntervals(durationMin = 20): CardioCycle {
  const base = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'iv-timer' });
  const dow = (new Date().getDay() + 6) % 7;
  const template = base.weeks[0].sessions[0];
  return {
    ...base,
    startDate: todayIso(),
    weeks: base.weeks.map((w, i) => i === 0 ? {
      ...w,
      sessions: [{
        ...template, type: 'hiit', durationMin, dayOfWeek: dow, weeklyFrequency: 1,
        structured: [{ workSec: 60, restSec: 30, reps: 2 }],
      }],
    } : w),
  };
}

/** Цикл с ДВУМЯ разными блоками: подпись и дневник обязаны видеть всю структуру. */
function cycleWithMultiIntervals(): CardioCycle {
  const c = cycleWithIntervals(60);
  const s = c.weeks[0].sessions[0];
  return {
    ...c,
    weeks: c.weeks.map((w, i) => i === 0 ? {
      ...w,
      sessions: [{ ...s, structured: [
        { workSec: 60, restSec: 30, reps: 2 },
        { workSec: 20, restSec: 10, reps: 4 },
      ] }],
    } : w),
  };
}

describe('CardioSessionTimer: интервальный режим', () => {
  beforeEach(() => localStorage.clear());

  it('список «сегодня» предупреждает, что таймер поведёт по подходам', () => {
    render(<CardioSessionTimer cycle={cycleWithIntervals()} />);
    expect(screen.getByText(/2×1 мин\/30 с — таймер ведёт по подходам/)).toBeTruthy();
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

  it('мульти-блочная структура: чип показывает все блоки, дневник не выдумывает один work/rest', () => {
    render(<CardioSessionTimer cycle={cycleWithMultiIntervals()} />);
    expect(screen.getByText(/2×1 мин\/30 с \+ 4×20 с\/10 с — таймер ведёт по подходам/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Старт HIIT' }));
    fireEvent.click(screen.getByRole('button', { name: /завершить/i }));
    fireEvent.click(screen.getByRole('button', { name: /сохранить в дневник/i }));

    const log = loadCardioLog();
    expect(log).toHaveLength(1);
    expect(log[0].intervalsPlanned).toBe(6);
    expect(log[0].workSec).toBeUndefined();
    expect(log[0].restSec).toBeUndefined();
  });

  it('структура короче сессии — честно пишет «по структуре 43 из 60 мин»', () => {
    render(<CardioSessionTimer cycle={cycleWithIntervals(60)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт HIIT' }));
    fireEvent.click(screen.getByRole('button', { name: /завершить/i }));
    // 2×(1/0.5) = 3 мин работы, разминка/заминка по 20 мин → 43 мин таймлайна.
    expect(screen.getByText(/по структуре 43 из 60 мин/)).toBeTruthy();
  });

  it('показывает подходы точками и следующий шаг загодя', () => {
    const { container } = render(<CardioSessionTimer cycle={cycleWithIntervals()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт HIIT' }));

    // Разминка: ни один подход не закрыт, впереди «Работа 1/2».
    const dots = container.querySelector('[data-cardio="interval-dots"]');
    expect(dots?.getAttribute('aria-label')).toBe('Подходы: 0 из 2');
    expect(dots!.querySelectorAll('span')).toHaveLength(2);
    expect(container.querySelector('[data-cardio="interval-next"]')?.textContent).toMatch(/далее: Работа 1\/2/);

    // Разминка → работа 1 → отдых 1: подход 1 закрыт, следующий — работа 2.
    const next = screen.getByRole('button', { name: 'Следующий шаг' });
    fireEvent.click(next);
    fireEvent.click(next);
    expect(container.querySelector('[data-cardio="interval-dots"]')?.getAttribute('aria-label')).toBe('Подходы: 1 из 2');
    expect(container.querySelector('[data-cardio="interval-next"]')?.textContent).toMatch(/далее: Работа 2\/2/);
  });

  it('на последнем шаге не обещает несуществующий следующий', () => {
    const { container } = render(<CardioSessionTimer cycle={cycleWithIntervals()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Старт HIIT' }));
    const next = screen.getByRole('button', { name: 'Следующий шаг' });
    // разминка → 4 шага работы/отдыха → заминка (последний).
    for (let i = 0; i < 5; i++) fireEvent.click(next);
    expect(container.querySelector('[data-cardio="interval-next"]')?.textContent).toBe('последний шаг');
  });

  it('без structure — один отсчёт, без кнопки «Дальше» и без выдуманных подходов', () => {    const base = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'plain-timer' });
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

  it('сводка за 14 дней: подходы и недобор по сессиям', () => {
    const log: CardioLogEntry[] = [
      { id: 'iv-2', date: '2026-11-01', type: 'hiit', durationMin: 40, completed: true, intervalsPlanned: 8, intervalsDone: 8 },
      { id: 'iv-3', date: '2026-11-03', type: 'hiit', durationMin: 40, completed: true, intervalsPlanned: 8, intervalsDone: 6 },
    ];
    const { container } = render(<CardioDiaryPanel cycle={null} log={log} />);
    const block = container.querySelector('[data-cardio="interval-adherence"]');
    expect(block).toBeTruthy();
    expect(block!.textContent).toContain('14 из 16');
    expect(block!.textContent).toContain('88%');
    expect(block!.textContent).toContain('недобрано в 1 из 2');
  });

  it('без интервальных записей сводки нет (не показываем нули)', () => {
    const log: CardioLogEntry[] = [
      { id: 'z2-1', date: '2026-11-01', type: 'zone2', durationMin: 40, completed: true },
    ];
    const { container } = render(<CardioDiaryPanel cycle={null} log={log} />);
    expect(container.querySelector('[data-cardio="interval-adherence"]')).toBeNull();
  });

  it('правка записи не стирает подходы, заметку и длительность работы/отдыха', () => {
    // Дефект: форма собирала запись с нуля, поэтому исправление RPE
    // превращало интервальную сессию в обычную (чип 🔁 исчезал).
    const log: CardioLogEntry[] = [{
      id: 'iv-edit', date: '2026-11-01', type: 'hiit', durationMin: 40, completed: true,
      intervalsPlanned: 8, intervalsDone: 6, workSec: 60, restSec: 90,
      notes: 'интервалы: 6 из 8 · работа 1 мин / отдых 1.5 мин',
    }];
    render(<CardioDiaryPanel cycle={null} log={log} />);

    fireEvent.click(screen.getByRole('button', { name: 'Редактировать 2026-11-01' }));
    expect(screen.getByText(/Подходы 6\/8 и длительность работы\/отдыха сохранятся/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('RPE'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /Обновить/ }));

    const saved = loadCardioLog();
    expect(saved).toHaveLength(1);
    expect(saved[0].rpe).toBe(7);
    expect(saved[0].intervalsPlanned).toBe(8);
    expect(saved[0].intervalsDone).toBe(6);
    expect(saved[0].workSec).toBe(60);
    expect(saved[0].restSec).toBe(90);
    expect(saved[0].notes).toContain('интервалы: 6 из 8');
  });
});
