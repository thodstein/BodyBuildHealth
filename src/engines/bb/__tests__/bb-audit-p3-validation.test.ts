/**
 * Аудит 2026-11, проход 9 — валидация/финализация (P3-1 и P3-3).
 *
 * P3-1. Финализатор добавлял строки «⚠/🚫 Валидация» из ПРОМЕЖУТОЧНОЙ валидации
 * (до гардов головок рук, гейта уровней, реализма сессии и пост-финального трима),
 * а финальный снимок обновлял `plan.validation`, но не rationale: в тексте
 * оставались предупреждения, которых в итоговом плане уже нет (и не появлялись
 * новые). Замер на сценарии «день с трапециями»: кап/порядок срезал упражнение на
 * трапеции (2 эффективных сета → 0), а в rationale стояло «2 ниже минимума MEV 5».
 *
 * P3-3. `TRANSIENT_VALIDATION_CODES` (`target_volume_deficit`,
 * `effective_mrv_overflow`) вычитались из списка предупреждений на ВСЕХ вызовах
 * снимка, хотя каждый вызов терминальный: дефицит объёма до MEV и перебор MRV в
 * готовом плане — настоящие предупреждения, а не промежуточные.
 */
import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';
import { refreshBBPlanSnapshots } from '../bb-plan-snapshot.engine';

const ex = (name: string, muscle: string, sets = 3, role: 'primary' | 'accessory' = 'accessory') => ({
  muscle,
  name,
  role,
  character: 'тяж' as const,
  sets,
  repsRange: [8, 10] as [number, number],
  rir: 2,
  workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 50 })),
});

const planWith = (exercises: any[], sessionTag = 'Push') => ({
  pattern: {},
  weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж' as const, sessionTag, exercises }] }],
  rotationMuscleVolume: {},
  rationale: [],
} as any);

const validationLines = (plan: any, prefix: string) => ((plan.rationale || []) as string[])
  .filter((line: string) => String(line).startsWith(prefix));

describe('P3-1: строки валидации в rationale описывают итоговый план', () => {
  it('устаревшее предупреждение о трапециях не остаётся после финального капа', () => {
    // День перегружен: финальный проход срезает упражнения по капу мышц, объём
    // трапеций падает с 2 до 0 эффективных сетов — предупреждение обязано быть
    // тем, которое даёт ВАЛИДАЦИЯ ИТОГОВОГО плана.
    const plan = planWith([
      ex('Жим штанги лёжа', 'chest', 5, 'primary'),
      ex('Разводка гантелей лёжа', 'chest', 4),
      ex('Кроссовер', 'chest', 4),
      ex('Французский жим', 'triceps', 4),
      ex('Трицепс на блоке', 'triceps', 4),
      ex('Подъём штанги на бицепс стоя', 'arms', 4),
      ex('Молотковые сгибания', 'arms', 4),
      ex('Тяга штанги в наклоне (прямой хват)', 'back', 5, 'primary'),
      ex('Подтягивания (прямой хват)', 'back', 4),
      ex('Шраги со штангой', 'traps', 4),
    ]);
    const result: any = finalizeBBPlan(plan, { reorder: true, level: 'intermediate' });

    const warnings = ((result.validation?.issues || []) as any[])
      .filter((issue: any) => issue.level === 'warning')
      .slice(0, 20)
      .map((issue: any) => `⚠ Валидация: ${issue.message}`);
    const expected = new Set(warnings);
    const actual = new Set(validationLines(result, '⚠ Валидация:'));

    expect([...actual].filter(line => !expected.has(line)), 'фантомные строки (предупреждения нет в итоговой валидации)').toEqual([]);
    expect([...expected].filter(line => !actual.has(line)), 'пропущенные строки (предупреждение есть в итоговой валидации)').toEqual([]);
    // Именно этот сценарий давал расхождение до правки.
    expect([...actual].some(line => /Трапеции: эффективных сетов 2 ниже минимума MEV 5/.test(line))).toBe(false);
  });
});

describe('P3-3: дефицит объёма и перебор MRV не вычитаются из предупреждений', () => {
  it('строки ⚠ строятся по всем предупреждениям снимка', () => {
    const plan: any = planWith([ex('Жим штанги лёжа', 'chest', 5, 'primary')], 'Chest');
    plan.validation = {
      valid: true,
      issues: [
        { level: 'warning', code: 'target_volume_deficit', message: 'Грудь: эффективных сетов 4 ниже минимума MEV 8 (50%).' },
        { level: 'warning', code: 'effective_mrv_overflow', message: 'Неделя 2: Спина: эффективных сетов 25 > MRV 20.' },
        { level: 'warning', code: 'low_training_frequency', message: 'Частота 0.5/нед по спине.' },
      ],
    };

    refreshBBPlanSnapshots(plan, { refreshValidationRationale: true });

    expect(validationLines(plan, '⚠ Валидация:')).toEqual([
      '⚠ Валидация: Грудь: эффективных сетов 4 ниже минимума MEV 8 (50%).',
      '⚠ Валидация: Неделя 2: Спина: эффективных сетов 25 > MRV 20.',
      '⚠ Валидация: Частота 0.5/нед по спине.',
    ]);
  });

  it('повторный снимок не плодит дубли (идемпотентность строк)', () => {
    const plan: any = planWith([ex('Жим штанги лёжа', 'chest', 5, 'primary')], 'Chest');
    plan.validation = {
      valid: true,
      issues: [{ level: 'warning', code: 'target_volume_deficit', message: 'Грудь: дефицит 4/8.' }],
    };
    refreshBBPlanSnapshots(plan, { refreshValidationRationale: true });
    refreshBBPlanSnapshots(plan, { refreshValidationRationale: true });
    expect(validationLines(plan, '⚠ Валидация:')).toEqual(['⚠ Валидация: Грудь: дефицит 4/8.']);
  });
});
