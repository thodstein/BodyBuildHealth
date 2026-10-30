/**
 * planner-input-bounds.test.ts — B27 (аудит 2026-10).
 *
 * Находка: инпут возраста в настройках допускал `max={120}`, а валидация перед
 * генерацией отклоняла всё >100. Пользователь вводил 110, нажимал «Сгенерировать»
 * и получал ошибку на значении, которое интерфейс считал допустимым.
 *
 * Замок: границы объявлены один раз (`PLANNER_BOUNDS`), и любое значение, которое
 * интерфейс позволяет ввести, проходит проверку границ.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLANNER_BOUNDS, validatePlannerInputs } from '../planner-input-validation';

const base = {
  weight: 80,
  height: 180,
  age: 30,
  sex: 'male' as const,
  bodyFatPct: 15,
  lifeStage: 'adult',
  goal: 'maintenance',
  sleepHours: 8,
};

describe('B27: границы ввода и валидация согласованы', () => {
  it('возраст: верхняя граница 100 (не 120, как было в инпуте)', () => {
    expect(PLANNER_BOUNDS.age.max).toBe(100);
    expect(PLANNER_BOUNDS.age.min).toBe(14);
  });

  it('любой возраст внутри границ проходит валидацию', () => {
    for (let a = PLANNER_BOUNDS.age.min; a <= PLANNER_BOUNDS.age.max; a++) {
      expect(validatePlannerInputs({ ...base, age: a })).toBeNull();
    }
  });

  it('возраст за границами отклоняется с понятным текстом', () => {
    expect(validatePlannerInputs({ ...base, age: PLANNER_BOUNDS.age.max + 1 })).toMatch(/Возраст/);
    // значение, которое раньше спокойно вводилось в инпут (120)
    expect(validatePlannerInputs({ ...base, age: 120 })).toMatch(/Возраст/);
    expect(validatePlannerInputs({ ...base, age: 13 })).toMatch(/14 лет/);
  });

  it('вес и рост: значения на границах допустимы (при правдоподобном BMI), за границами — нет', () => {
    expect(validatePlannerInputs({ ...base, weight: PLANNER_BOUNDS.weight.max, height: 250 })).toBeNull();
    expect(validatePlannerInputs({ ...base, weight: PLANNER_BOUNDS.weight.max + 1 })).toMatch(/Вес/);
    expect(validatePlannerInputs({ ...base, weight: PLANNER_BOUNDS.weight.min - 1 })).toMatch(/Вес/);
    expect(validatePlannerInputs({ ...base, height: PLANNER_BOUNDS.height.min - 1 })).toMatch(/Рост/);
    // Отдельная клиническая защита сильнее границ ввода: 250 кг при 180 см → BMI 77.
    expect(validatePlannerInputs({ ...base, weight: PLANNER_BOUNDS.weight.max })).toMatch(/BMI/);
  });

  it('инпуты настроек не содержат собственных «магических» границ возраста', () => {
    const src = readFileSync(join(__dirname, '..', 'IndividualPlanSettings.tsx'), 'utf8');
    expect(src).not.toMatch(/label="🎂 Возраст"[^>]*max=\{120\}/);
    expect(src).not.toMatch(/label="Возраст"[^>]*max=\{120\}/);
    expect(src).toMatch(/label="🎂 Возраст"[^>]*max=\{PLANNER_BOUNDS\.age\.max\}/);
  });

  it('клинически опасные значения по-прежнему блокируются', () => {
    expect(validatePlannerInputs({ ...base, weight: 40 })).toMatch(/BMI/);
    expect(validatePlannerInputs({ ...base, sex: 'female', bodyFatPct: 5 })).toMatch(/% жира/);
    expect(validatePlannerInputs({ ...base, sleepHours: 3 })).toMatch(/Сон/);
    expect(validatePlannerInputs({
      ...base, sex: 'female', lifeStage: 'pregnancy', goal: 'cutting',
    })).toMatch(/беременности/);
  });

  it('здоровый профиль проходит без ошибок', () => {
    expect(validatePlannerInputs(base)).toBeNull();
  });
});
