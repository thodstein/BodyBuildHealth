import { describe, expect, it, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';
import StickingPointAnalysisCard from '../StickingPointAnalysisCard';

afterEach(cleanup);

function wl(date: string, exercises: Array<{ name: string; sets: Array<{ weight: number; reps: number; rir: number; rpe?: number }> }>): any {
  return {
    id: date, date, duration: 60, overallRPE: 8, recoveryBefore: 5, split: 'fullbody',
    exercises: exercises.map(e => ({
      id: e.name, date, exerciseId: e.name, exerciseName: e.name, sets: e.sets,
      totalVolume: 0, estimated1RM: 0, isCompound: true,
    })),
  };
}

describe('StickingPointAnalysisCard (полный инструмент по дневнику)', () => {
  it('пустое состояние без данных', () => {
    render(<StickingPointAnalysisCard sessions={[]} />);
    expect(screen.getByText(/Нет данных по приседу/)).toBeTruthy();
  });

  it('присед reps ≤ 2 → каноническая фаза «Яма (нижняя точка)»', () => {
    const sessions = [wl('2026-08-10', [{ name: 'Приседания со штангой', sets: [
      { weight: 140, reps: 2, rir: 1, rpe: 9 },
    ] }])];
    render(<StickingPointAnalysisCard sessions={sessions} />);
    expect(screen.getByText(/Вероятная слабая фаза: Яма \(нижняя точка\)/)).toBeTruthy();
  });

  it('жим reps 3-5 → «Середина амплитуды»', () => {
    const sessions = [wl('2026-08-10', [{ name: 'Жим штанги лёжа', sets: [
      { weight: 100, reps: 4, rir: 2, rpe: 8 },
    ] }])];
    render(<StickingPointAnalysisCard sessions={sessions} />);
    expect(screen.getByText(/Вероятная слабая фаза: Середина амплитуды/)).toBeTruthy();
  });

  it('reps ≥ 6 → фаза не определяется (тяжёлый подход есть, фазы нет)', () => {
    const sessions = [wl('2026-08-10', [{ name: 'Приседания со штангой', sets: [
      { weight: 100, reps: 8, rir: 1, rpe: 9 },
    ] }])];
    render(<StickingPointAnalysisCard sessions={sessions} />);
    expect(screen.getByText(/Тяжёлых подходов \(RPE≥8\):/)).toBeTruthy();
    expect(screen.queryByText(/Вероятная слабая фаза/)).toBeNull();
  });

  it('все 7 движений доступны вкладками (жим стоя и др.)', () => {
    const sessions = [
      wl('2026-08-10', [
        { name: 'Приседания со штангой', sets: [{ weight: 140, reps: 2, rir: 1, rpe: 9 }] },
        { name: 'Жим штанги лёжа', sets: [{ weight: 100, reps: 2, rir: 1, rpe: 9 }] },
        { name: 'Становая тяга', sets: [{ weight: 180, reps: 2, rir: 1, rpe: 9 }] },
        { name: 'Жим стоя', sets: [{ weight: 60, reps: 3, rir: 2, rpe: 8 }] },
        { name: 'Тяга в наклоне', sets: [{ weight: 80, reps: 5, rir: 2, rpe: 8 }] },
        { name: 'Тяга верхнего блока', sets: [{ weight: 70, reps: 5, rir: 2, rpe: 8 }] },
        { name: 'Жим на наклонной', sets: [{ weight: 80, reps: 4, rir: 2, rpe: 8 }] },
      ]),
    ];
    render(<StickingPointAnalysisCard sessions={sessions} />);
    expect(screen.getByText('Жим стоя')).toBeTruthy();
    expect(screen.getByText('Тяга в наклоне')).toBeTruthy();
    expect(screen.getByText('Тяга верхнего блока')).toBeTruthy();
    expect(screen.getByText('Жим на наклонной')).toBeTruthy();
  });

  it('сумо-тяга → фаза «Сумо: старт» и блок сумо', () => {
    const sessions = [wl('2026-08-10', [{ name: 'Становая тяга сумо', sets: [
      { weight: 180, reps: 2, rir: 1, rpe: 9 },
    ] }])];
    render(<StickingPointAnalysisCard sessions={sessions} />);
    expect(screen.getByText(/Сумо-тяга: 1 тяжёлых подходов/)).toBeTruthy();
    expect(screen.getByText(/Вероятная слабая фаза: Сумо: старт \(срыв\)/)).toBeTruthy();
  });

  it('«Слабые мышцы → планировщик» отправляет группы (присед → legs)', () => {
    const dispatched: any[] = [];
    const orig = window.dispatchEvent.bind(window);
    window.dispatchEvent = (e: Event) => { if (e instanceof CustomEvent && e.type === 'planner-apply') dispatched.push(e.detail); return orig(e); };
    try {
      const sessions = [wl('2026-08-10', [{ name: 'Приседания со штангой', sets: [
        { weight: 140, reps: 2, rir: 1, rpe: 9 },
      ] }])];
      render(<StickingPointAnalysisCard sessions={sessions} />);
      fireEvent.click(screen.getByText(/Слабые мышцы → планировщик/));
      const payload = dispatched.find((d: any) => d?.kind === 'weakpoints');
      expect(payload).toBeTruthy();
      expect(payload.data.groups).toEqual(['legs']);
    } finally {
      window.dispatchEvent = orig;
    }
  });
});
