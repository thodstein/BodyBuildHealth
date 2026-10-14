import { describe, it, expect } from 'vitest';
import { planArmliftAttempts, attemptStepFor } from '../armlift-attempt-plan.engine';

describe('PRO-6 M7: план попыток', () => {
  it('без замера — null', () => {
    expect(planArmliftAttempts(0)).toBeNull();
    expect(planArmliftAttempts(NaN)).toBeNull();
  });
  it('шаг по величине: RT 2.5, Hub 0.5', () => {
    expect(attemptStepFor(120)).toBe(2.5);
    expect(attemptStepFor(60)).toBe(1);
    expect(attemptStepFor(15)).toBe(0.5);
  });
  // Аудит 2026-10 было→стало: 92.5/97.5/102.5 (своя лесенка 92/98) → 90/96/102.
  // Проценты теперь канон ATTEMPT_LADDER_PCT — тот же источник, что у строчек
  // отчёта и помоста: один спортсметр не видит две разные лестницы в одном приложении.
  it('RT 100: opener 90 / вторая 95 / третья 102.5', () => {
    const p = planArmliftAttempts(100, 'rolling_thunder', 'RT');
    expect(p?.opener).toBe(90);
    expect(p?.second).toBe(95); // шаг RT 2.5 кг: 96% = 95
    expect(p?.third).toBe(102.5); // 102% = 102.5
    expect(p?.note).toContain('60 сек');
    expect(p?.note).toContain('90/96/102');
  });
  it('монотонность: opener < second < third', () => {
    for (const w of [12.5, 30, 77.5, 150]) {
      const p = planArmliftAttempts(w)!;
      expect(p.opener).toBeLessThanOrEqual(p.second);
      expect(p.second).toBeLessThanOrEqual(p.third);
    }
  });
  it('Hub 30: шаг 1', () => {
    const p = planArmliftAttempts(30, 'hub', 'Hub');
    expect(p?.opener).toBe(27);
    expect(p?.third).toBe(31);
  });
});
