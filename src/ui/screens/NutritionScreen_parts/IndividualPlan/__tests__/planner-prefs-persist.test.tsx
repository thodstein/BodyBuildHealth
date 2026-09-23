/**
 * planner-prefs-persist.test.tsx — P1-регресс: график работы (workSchedule*) переживает
 * монтирование планировщика.
 *
 * До фикса массовый эффект 27 настроек перезаписывал he_planner_prefs ЦЕЛИКОМ на каждом
 * маунте и стирал work-ключи (у них нет своего mount-восстановителя) — настройка жила
 * один релиз и молча сбрасывалась. Теперь запись идёт merge-patch'ем.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';
import { PLANNER_PREFS_KEY } from '../planner-prefs';

const readPrefs = (): Record<string, any> => {
  try { return JSON.parse(localStorage.getItem(PLANNER_PREFS_KEY) || '{}'); } catch { return {}; }
};

describe('planner prefs persist: merge не теряет workSchedule*', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('после монтирования workScheduleEnabled/Start/Type остаются в he_planner_prefs', async () => {
    localStorage.setItem('he_planner_schema_version', '7');
    localStorage.setItem(PLANNER_PREFS_KEY, JSON.stringify({
      workScheduleEnabled: true, workStartTime: '07:00', workScheduleType: 'shift_2_2', cookTimeMin: 90,
    }));
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    // Массовый patch-эффект отрабатывает на маунте и пишет cookTimeMin — ждём его запись,
    // затем проверяем, что work-ключи не были стёрты этим проходом.
    await waitFor(() => { expect(readPrefs().cookTimeMin).toBe(90); }, { timeout: 15000 });
    const p = readPrefs();
    expect(p.workScheduleEnabled).toBe(true);
    expect(p.workStartTime).toBe('07:00');
    expect(p.workScheduleType).toBe('shift_2_2');
  }, 30000);
});
