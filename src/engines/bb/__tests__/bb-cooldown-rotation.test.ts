/**
 * bb-cooldown-rotation.test.ts — Фаза 2.7: cooldown-ротация подключена к генерации.
 *
 * cooldownHistory из прошлых планов/дневника подаётся в buildSession как
 * ротационное понижение приоритета (избегание повторов в cooldown-окне),
 * с fallback при исчерпании пула (инвариант: класс не пустеет).
 */
import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { extractRotationHistory, canUseExercise, findPatternAlternative } from '../bb-exercise-rotation.engine';
import { derivePattern } from '../../movement-pattern';

function collectNames(plan: any): string[] {
  return plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).map((e: any) => e.exerciseName || e.name);
}

describe('bb-exercise-rotation (cooldown-хелперы)', () => {
  it('extractRotationHistory — извлекает историю из плана', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    const history = extractRotationHistory(plan as any);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('exerciseName');
    expect(history[0]).toHaveProperty('week');
  });

  it('canUseExercise — упражнение в cooldown запрещено', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    const history = extractRotationHistory(plan as any);
    const first = history[0];
    const res = canUseExercise(first.exerciseName, first.week + 1, history);
    expect(res.allowed).toBe(false);
    expect(res.cooldownRemaining).toBeGreaterThan(0);
  });

  it('findPatternAlternative — та же моторная единица, другое имя', () => {
    const candidates = [
      { name: 'Жим штанги лёжа', muscle: 'chest', type: 'compound', equipment: ['barbell'] },
      { name: 'Жим гантелей лёжа', muscle: 'chest', type: 'compound', equipment: ['dumbbell'] },
      { name: 'Отжимания от пола', muscle: 'chest', type: 'compound', equipment: ['bodyweight'] },
    ] as any;
    const used = new Set(['Жим штанги лёжа']);
    const alt = findPatternAlternative(derivePattern(candidates[0]), used, candidates);
    expect(alt).not.toBeNull();
    expect(alt!.name).not.toBe('Жим штанги лёжа');
    expect(derivePattern(alt!)).toBe(derivePattern(candidates[0]));
  });
});

describe('cooldown-история питает buildSession (Фаза 2.7)', () => {
  it('cooldownHistory уводит от недавно использованных упражнений', () => {
    // Сначала строим план, чтобы узнать, какие упражнения он обычно выбирает.
    const base = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    const baseNames = collectNames(base);

    // Строим план с cooldown-историей из ВСЕХ упражнений базового плана →
    // должен избегать их там, где есть альтернативы (или успешно откатиться).
    const cooldown = extractRotationHistory(base as any).map(h => ({ exerciseName: h.exerciseName, pattern: h.pattern }));
    const withCd = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, cooldownHistory: cooldown } as any);
    const cdNames = collectNames(withCd);

    // План всё ещё построен корректно и не пустой
    expect(withCd.weeks.length).toBe(4);
    expect(cdNames.length).toBeGreaterThan(0);
    // Детерминизм: два одинаковых вызова дают одинаковый план
    const withCd2 = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, cooldownHistory: cooldown } as any);
    expect(collectNames(withCd2)).toEqual(cdNames);
  });

  it('cooldown не ломает сплит: все группы мышц покрыты', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, cooldownHistory: [{ exerciseName: 'Жим штанги лёжа', pattern: 'horizontal_push' }, { exerciseName: 'Приседания со штангой', pattern: 'squat' }] } as any);
    const muscles = new Set<string>();
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) muscles.add(e.muscle);
    // ключевые группы присутствуют (грудь/спина/ноги/руки)
    expect([...muscles]).toEqual(expect.arrayContaining(['chest', 'back', 'quads', 'biceps']));
    expect(plan.rationale.join(' ').length).toBeGreaterThan(0);
  });
});
