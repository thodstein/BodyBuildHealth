/**
 * planner-ea-missing-bodyfat.test.ts — B16 (аудит 2026-10).
 *
 * Находка: при отсутствии % жира в расчёт EA уходила ВЫДУМАННАЯ тощая масса
 * (15% для мужчин / 22% для женщин). У пользователя с реальными 30% жира FFM
 * завышалась, EA получалась завышенной → статус «optimal» при фактическом
 * дефиците. Это ложно-отрицательный скрининг RED-S.
 *
 * Замок: без % жира EA считается консервативно (FFM = вес ⇒ нижняя граница EA),
 * и результат всегда помечен как оценка, а не как измеренный факт.
 */
import { describe, it, expect } from 'vitest';
import { computeEA } from '../planner-ea.engine';
import { computeEnergyAvailability } from '../planner-female-cycle';

const base = {
  intakeKcal: 2200,
  weightKg: 80,
  lbmKg: 0,
  isTrainingDay: true,
  trainDurationMin: 60,
  trainIntensity: 'medium' as const,
  sex: 'male' as const,
};

describe('B16: отсутствующий % жира не выдаётся за реальную LBM', () => {
  it('оценка без % жира строго консервативнее фиктивных 15%', () => {
    const estimated = computeEA({ ...base, bodyFatEstimated: true });
    const assumed15 = computeEA({ ...base, bodyFatPct: 15 });
    // FFM больше (FFM = вес) ⇒ EA меньше ⇒ раньше ловим дефицит.
    expect(estimated.ffm).toBeGreaterThan(assumed15.ffm);
    expect(estimated.ea).toBeLessThan(assumed15.ea);
  });

  it('FFM при оценке равен весу (никакой выдуманной тощей массы)', () => {
    const r = computeEA({ ...base, bodyFatEstimated: true });
    expect(r.ffm).toBe(Math.round(base.weightKg));
  });

  it('статус «optimal» без данных не молчит: есть пометка «оценка»', () => {
    // Много ккал → зона optimal
    const r = computeEA({ ...base, intakeKcal: 5000, bodyFatEstimated: true });
    expect(r.status).toBe('optimal');
    expect(r.note).toBeTruthy();
    expect(r.note).toMatch(/оценк|Оценк|% жира/i);
    expect(r.zoneLabel).toMatch(/оценк/i);
  });

  it('с известным % жира пометки-оценки НЕТ', () => {
    const r = computeEA({ ...base, lbmKg: 68, bodyFatPct: 15 });
    expect(r.ffm).toBe(68);
    expect(r.note || '').not.toMatch(/оценка КОНСЕРВАТИВНАЯ/i);
    expect(r.zoneLabel).not.toMatch(/оценк/i);
  });

  it('мягкий сценарий становится дефицитом при честной FFM (ложное «optimal» устранено)', () => {
    // 2400 ккал, 80 кг, тренировка 60 мин: EEE ≈ 480 → EI-EEE = 1920.
    // С FFM = 68 кг (15%) EA ≈ 28 → уже risk; с FFM = 80 кг EA = 24 → severe/risk.
    const assumed = computeEA({ ...base, intakeKcal: 2400, bodyFatPct: 15 });
    const estimated = computeEA({ ...base, intakeKcal: 2400, bodyFatEstimated: true });
    expect(estimated.ea).toBeLessThan(assumed.ea);
    expect(['risk', 'severe']).toContain(estimated.status);
  });

  it('обёртка computeEnergyAvailability пробрасывает флаг и сохраняет пометку', () => {
    const r = computeEnergyAvailability(2200, 80, 0, true, 60, 'medium', 'female', true);
    expect(r.note).toMatch(/% жира/);
    expect(Number.isFinite(r.ea)).toBe(true);
  });

  it('без флага поведение прежнее (обратная совместимость вызовов)', () => {
    const legacy = computeEA({ ...base, bodyFatPct: 15 });
    expect(legacy.ffm).toBe(68);
    expect(legacy.note || '').not.toMatch(/оценка КОНСЕРВАТИВНАЯ/i);
  });
});
