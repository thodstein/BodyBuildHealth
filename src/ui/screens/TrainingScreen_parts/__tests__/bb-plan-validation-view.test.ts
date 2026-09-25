/**
 * bb-plan-validation-view.test.ts — адаптация валидации плана под настройки
 * пользователя (аудит 2026-09): технические коды скрыты, мышцы по-русски,
 * повторы сгруппированы, акцент специализации объяснён, ошибки/предупреждения
 * имеют действие.
 */
import { describe, expect, it } from 'vitest';
import { buildPlanValidationView, planValidationBadge, planSessionStats } from '../bb-plan-validation-view';

const ex = (muscle: string, name: string, sets = 3, role = 'primary') => ({
  muscle, name, role, sets, rir: 2,
  workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 60 })),
});

const wk = (over: any = {}) => ({
  week: 1,
  phase: 'accumulation',
  sessions: [{
    sessionTag: 'Upper',
    exercises: [
      ex('chest', 'Жим штанги лёжа'),
      ex('back', 'Тяга Т-грифа'),
    ],
  }],
  ...over,
});

const plan = (over: any = {}) => ({
  pattern: { id: 'upper_lower_4', name: 'Верх/Низ' },
  weeks: [wk()],
  level: 'intermediate',
  priorityMuscles: ['back'],
  ...over,
} as any);

const crowdedWeek = () => ({
  week: 1, phase: 'accumulation',
  sessions: [{
    sessionTag: 'Upper',
    exercises: Array.from({ length: 12 }, (_, i) => ex('chest', `Жим ${i}`, 2, 'accessory')),
  }],
});

describe('buildPlanValidationView: адаптация под пользователя', () => {
  it('error сессионного лимита показывается с действием', () => {
    const view = buildPlanValidationView(plan({ weeks: [crowdedWeek()] }));
    expect(view.errors.some(e => e.code === 'session_exercise_cap')).toBe(true);
    expect(view.errors[0].hint).toBeTruthy();
    expect(view.ok).toBe(false);
  });

  it('мышиные ключи движка заменяются русскими подписями', () => {
    const p = plan({
      weeks: [wk()],
      volumeTargets: { back: { mev: 10, mav: 16, mrv: 24, frequency: 1, rotationSets: 10 } },
      weeklyVolume: { 1: { back: { directSets: 4, effectiveSets: 4 } } },
    });
    const view = buildPlanValidationView(p);
    const all = [...view.warnings, ...view.errors, ...view.infos].map(x => x.text).join(' | ');
    expect(all).toContain('Спина');
    expect(all).not.toMatch(/(^|\W)back(\W|$)/);
  });

  it('акцент специализации объясняется и не выглядит как дефект', () => {
    const view = buildPlanValidationView(plan());
    expect(view.accentNote).toBeTruthy();
    expect(view.accentNote).toContain('Спина');
  });

  it('applied plan проверяет фактический порядок, faithful — нет', () => {
    const badOrder = {
      week: 1,
      phase: 'accumulation',
      sessions: [{
        sessionTag: 'Chest',
        exercises: [ex('chest', 'Разводка гантелей', 3, 'accessory'), ex('chest', 'Жим гантелей', 3, 'primary')],
      }],
    };
    const applied = buildPlanValidationView(plan({ methodologyApplied: true, methodology: 'compound_first', weeks: [badOrder] }));
    expect(applied.infos.some(issue => issue.code === 'order_primary_after_accessory')).toBe(true);
    const faithful = buildPlanValidationView(plan({ methodologyApplied: false, methodology: 'compound_first', weeks: [badOrder] }));
    expect(faithful.infos.some(issue => issue.code === 'order_primary_after_accessory')).toBe(false);
  });

  it('badge честно отражает статус', () => {
    const clean = buildPlanValidationView(plan());
    expect(planValidationBadge(clean).ok).toBe(true);
    const bad = buildPlanValidationView(plan({ weeks: [crowdedWeek()] }));
    expect(planValidationBadge(bad).ok).toBe(false);
    expect(planValidationBadge(bad).label).toContain('⛔');
  });

  it('planSessionStats считает максимум по сессиям', () => {
    const stats = planSessionStats(plan({
      weeks: [
        wk(),
        wk({
          week: 2,
          sessions: [{
            sessionTag: 'Lower',
            exercises: [ex('quads', 'Присед', 5), ex('hamstrings', 'RDL', 4), ex('calves', 'Носки', 3, 'accessory')],
          }],
        }),
      ],
    }));
    expect(stats.sessions).toBe(2);
    expect(stats.maxExercises).toBe(3);
    expect(stats.maxSets).toBe(12);
  });

  it('пустой или повреждённый план — явная ошибка', () => {
    const empty = buildPlanValidationView(null);
    expect(empty.ok).toBe(false);
    expect(empty.errors[0].code).toBe('invalid_input');
    const malformed = buildPlanValidationView({ weeks: null } as any);
    expect(malformed.ok).toBe(false);
    expect(malformed.errors[0].code).toBe('invalid_input');
    expect(planSessionStats(null).sessions).toBe(0);
  });
});
