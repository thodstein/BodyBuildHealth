/**
 * planner-prefs.test.ts — P1-fix: he_planner_prefs пишется merge-patch'ем.
 *
 * Регресс: массовый эффект 27 настроек планировщика писал объект БЕЗ merge и на каждом
 * маунте стирал ключи чужих писателей (график работы workSchedule*), после чего
 * настройка сбрасывалась при перезагрузках.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readPlannerPrefs, writePlannerPrefsPatch, PLANNER_PREFS_KEY } from '../planner-prefs';

describe('planner-prefs: чтение и merge-запись', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('readPlannerPrefs: пусто/битый JSON/массив/скаляр → {}', () => {
    expect(readPlannerPrefs()).toEqual({});
    localStorage.setItem(PLANNER_PREFS_KEY, '{broken');
    expect(readPlannerPrefs()).toEqual({});
    localStorage.setItem(PLANNER_PREFS_KEY, JSON.stringify([1, 2]));
    expect(readPlannerPrefs()).toEqual({});
    localStorage.setItem(PLANNER_PREFS_KEY, '"строка"');
    expect(readPlannerPrefs()).toEqual({});
    localStorage.setItem(PLANNER_PREFS_KEY, 'null');
    expect(readPlannerPrefs()).toEqual({});
  });

  it('writePlannerPrefsPatch сохраняет чужие ключи (workSchedule* не теряются)', () => {
    localStorage.setItem(PLANNER_PREFS_KEY, JSON.stringify({ workScheduleEnabled: true, workStartTime: '07:00', cookTimeMin: 60 }));
    writePlannerPrefsPatch({ cookTimeMin: 45, cravingMode: true });
    const p = readPlannerPrefs();
    expect(p.workScheduleEnabled).toBe(true);
    expect(p.workStartTime).toBe('07:00');
    expect(p.cookTimeMin).toBe(45);
    expect(p.cravingMode).toBe(true);
  });

  it('patch перезаписывает тот же ключ и не трогает остальные', () => {
    writePlannerPrefsPatch({ varietyLevel: 'low', lazyDayDays: 3 });
    writePlannerPrefsPatch({ varietyLevel: 'high' });
    expect(readPlannerPrefs().varietyLevel).toBe('high');
    expect(readPlannerPrefs().lazyDayDays).toBe(3);
  });

  it('последовательные patch-и накапливают состояние (fake-ключи массива)', () => {
    writePlannerPrefsPatch({ carbPeriodization: 'wave' });
    writePlannerPrefsPatch({ workDays: [true, false, true, true, true, false, false] });
    writePlannerPrefsPatch({ budget: 'max' });
    const p = readPlannerPrefs();
    expect(p.carbPeriodization).toBe('wave');
    expect(Array.isArray(p.workDays)).toBe(true);
    expect(p.budget).toBe('max');
  });
});
