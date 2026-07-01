import { describe, it, expect, beforeEach } from 'vitest';
import { importSessionsFromCSV } from '../workout-logger.engine';

// минимальный mock localStorage (движок использует localStorage для he_workout_log_v2)
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  (global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
});

describe('importSessionsFromCSV', () => {
  it('импортирует 2 даты → 2 сессии, считает сеты', () => {
    const csv = 'date,exercise,set,weight,reps,rpe,rir\n2026-06-01,Жим лёжа,1,80,5,7,2\n2026-06-01,Жим лёжа,2,80,5,7,2\n2026-06-03,Присед,1,100,5,8,2';
    const r = importSessionsFromCSV(csv);
    expect(r.importedSessions).toBe(2);
    expect(r.importedSets).toBe(3);
  });

  it('пропускает строки с плохой датой и пишет ошибку', () => {
    const csv = 'date,exercise,set,weight,reps\nbad-date,Жим,1,80,5\n2026-06-05,Жим,1,80,5';
    const r = importSessionsFromCSV(csv);
    expect(r.importedSessions).toBe(1);
    expect(r.errors.some(e => e.includes('дата'))).toBe(true);
  });

  it('пустой ввод → ошибка', () => {
    const r = importSessionsFromCSV('');
    expect(r.importedSessions).toBe(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('дедуп: повторный импорт тех же дат не дублирует', () => {
    const csv = 'date,exercise,set,weight,reps\n2026-06-07,Жим,1,80,5';
    const r1 = importSessionsFromCSV(csv);
    const r2 = importSessionsFromCSV(csv);
    expect(r1.importedSessions).toBe(1);
    expect(r2.importedSessions).toBe(0);
  });
});