/**
 * planner-day-mods-wiring.test.tsx — §4.2 интеграция: Context.dayModsByOffset
 * действительно видит женскую фазу цикла и дневниковую компенсацию.
 *
 * Дефект (docs/NUTRITION-PLANNER-PRO-AUDIT-2026-10.md §4.2): ожидание недели и
 * карточка периодизации не знали менструальных модов и дневниковой компенсации —
 * «показано ≠ сгенерируется» (женщина, лютеиновая фаза: мод ×1.08 = ±8%).
 *
 * Проверяем живой контур: профиль (sex/cyclePhase) → Provider → dayModsByOffset,
 * и что компенсация недобора вчера доезжает до callback'а.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { IndividualPlanProvider, usePlanCtx } from '../IndividualPlanContext';
import { getMenstrualPhaseNutrition } from '../planner-female-cycle';

let ctxCapture: any = null;

const Probe = () => {
  const c = usePlanCtx();
  ctxCapture = c;
  return null;
};

const seedProfile = (over: any = {}) => {
  localStorage.setItem('he_planner_mode', 'pro');
  localStorage.setItem('he_profile_v2', JSON.stringify({
    settings: {
      personal: { weight: 62, height: 168, age: 29, sex: 'female', bodyFat: 24, ...(over.personal || {}) },
      training: { primaryGoal: 'maintenance', ...(over.training || {}) },
      pharma: { phase: 'none' },
      nutrition: {},
    },
  }));
  const prefs: any = { cyclePhase: over.cyclePhase || 'none', ...(over.prefs || {}) };
  localStorage.setItem('he_planner_prefs', JSON.stringify(prefs));
};

const boot = () => {
  ctxCapture = null;
  render(
    <IndividualPlanProvider profile={null} course={[]} labs={[]} labAnalysis={null}>
      <Probe />
    </IndividualPlanProvider>,
  );
};

const isoYesterday = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

describe('§4.2 Context.dayModsByOffset — проводка фаз/компенсации', () => {
  it('женщина + лютеиновая фаза → ккал-мод из менструального движка (×1.08)', async () => {
    seedProfile({ cyclePhase: 'luteal', personal: { sex: 'female', weight: 62, bodyFat: 24 } });
    boot();
    await waitFor(() => { expect(ctxCapture).toBeTruthy(); });
    const dm = ctxCapture.dayModsByOffset(0, false);
    const expected = getMenstrualPhaseNutrition('luteal').kcalMod;
    // Лютеиновая фаза: BMR +100–300 ккал — генератор ПОВЫШАЕТ цель (именно этот
    // мод раньше не видело ожидание недели → расхождение 8%).
    expect(expected).toBeGreaterThan(1);
    expect(dm.kcalMod).toBeCloseTo(expected, 5);
  });

  it('мужчина → мод нейтрален (фолбэк 1)', () => {
    seedProfile({ cyclePhase: 'none', personal: { sex: 'male', weight: 88, bodyFat: 16 } });
    boot();
    const dm = ctxCapture.dayModsByOffset(0, false);
    expect(dm.kcalMod).toBe(1);
    expect(dm.kcalDelta).toBe(0);
  });

  it('фолликулярная фаза → иной мод, чем лютеиновая (контраст фаз)', () => {
    seedProfile({ cyclePhase: 'follicular', personal: { sex: 'female', weight: 62, bodyFat: 22 } });
    boot();
    const dm = ctxCapture.dayModsByOffset(0, false);
    const luteal = getMenstrualPhaseNutrition('luteal').kcalMod;
    expect(dm.kcalMod).not.toBeCloseTo(luteal, 3);
  });

  it('дневниковая компенсация доезжает до мода (недобор вчера → +ккал сегодня)', () => {
    // Вчерашний день съел на ~1000 ккал меньше цели — компенсация = 50% дефицита.
    localStorage.setItem('nutrition_diary_v2', JSON.stringify({
      [isoYesterday()]: { meals: { lunch: [{ name: 'Тест', kcal: 800, p: 60, f: 25, c: 90 }] } },
    }));
    seedProfile({
      cyclePhase: 'none',
      personal: { sex: 'female', weight: 62, bodyFat: 22 },
      prefs: { diaryAdaptation: true },
    });
    boot();
    const dm = ctxCapture.dayModsByOffset(0, false);
    expect(dm.kcalDelta, `kcalDelta=${dm.kcalDelta}`).toBeGreaterThan(0);
  });

  it('без дневника компенсации нет (kcalDelta = 0)', () => {
    seedProfile({
      cyclePhase: 'none',
      personal: { sex: 'female', weight: 62, bodyFat: 22 },
      prefs: { diaryAdaptation: true },
    });
    boot();
    const dm = ctxCapture.dayModsByOffset(0, false);
    expect(dm.kcalDelta).toBe(0);
  });
});
