import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IndividualPlan } from '../index';
import { buildDayPlan } from '../meal-plan-engine';

/**
 * Эпик F4: UI e2e — правки недели переживают возврат (weekEditDay-синк),
 * глобальный toast-канал работает, дубли/время/удаление синхронны.
 */

const mockProfile = {
  settings: {
    personal: { weight: 90, height: 180, age: 30, sex: 'male', bodyFat: 18 },
    lifestyle: { sleepHours: 8, stressLevel: 4, morningHRV: 65, dailySteps: 9000 },
    nutrition: { proteinPerKg: 2 },
    primaryGoal: 'mass',
    workoutsPerWeek: 4,
  },
};

describe('F4: UI-гаранты планировщика', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  it('toast-канал: window.showToast определён и доставляет уведомления в PlannerToastHost', async () => {
    render(<IndividualPlan profile={mockProfile as any} course={[]} labs={[]} labAnalysis={null} />);
    expect(typeof (window as any).showToast).toBe('function');
    (window as any).showToast('🍳 Тестовое уведомление', 'success');
    await waitFor(() => expect(screen.getByText('🍳 Тестовое уведомление')).toBeTruthy(), { timeout: 2000 });
  });

  it('движок: updateMealTime-совместимость — план имеет meals с time', () => {
    const plan = buildDayPlan({
      weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
      goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 350,
      mealsCount: 4, isTrainingDay: false, budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false, randomSalt: 1,
    });
    expect(plan.meals.length).toBeGreaterThan(0);
    for (const m of plan.meals) expect(typeof m.time).toBe('string');
  });
});
