import { describe, expect, it } from 'vitest';
import { getPattern, validateSplitPatterns } from '../bb-split-patterns';
import { rankBBSplits } from '../bb-selector.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';

/**
 * M2 (план §8.2): женские сплиты в выборе — состав, инварианты, сборка, sex-скоринг.
 */
const WM = { chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100, glutes: 120, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 40 };
const FEMALE_IDS = ['female_glute_3', 'female_glute_5', 'female_glute_6', 'female_lower_upper_4', 'female_bikini_5', 'female_wellness_5', 'female_upper_glute_4'];

describe('M2: женские сплиты', () => {
  it('все женские сплиты присутствуют; инварианты паттернов чисты', () => {
    for (const id of FEMALE_IDS) expect(getPattern(id), id).toBeDefined();
    expect(validateSplitPatterns()).toEqual([]);
  });

  it('каждый женский сплит собирается без error-уровня валидатора (female)', () => {
    for (const id of FEMALE_IDS) {
      const plan = buildBBPlan({ patternId: id, level: 'intermediate', goal: 'mass', weeks: 6, workMax: WM, sex: 'female', trainingYears: 3 } as never);
      const r = validateBBPlan(plan as never, { level: 'intermediate' });
      expect(r.issues.filter((i: { level?: string }) => i.level === 'error').map((i: { message: string }) => i.message), id).toHaveLength(0);
    }
  }, 180000);

  it('selector: female — женский сплит в топ-3; male — не женский топ', () => {
    const fem = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5, sex: 'female' });
    const male = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5, sex: 'male' });
    expect(fem.slice(0, 3).some(r => r.pattern.id.startsWith('female_'))).toBe(true);
    expect(male[0].pattern.id.startsWith('female_')).toBe(false);
  });

  it('базовые женские сплиты действительно glute-heavy (сессии Glutes/GlutesHams/Lower)', () => {
    for (const id of ['female_glute_3', 'female_glute_6', 'female_lower_upper_4', 'female_bikini_5', 'female_wellness_5']) {
      const p = getPattern(id)!;
      const gluteish = p.schedule.filter(d => d.kind === 'тренировка' && ['Glutes', 'GlutesHams', 'Lower', 'Legs'].includes(String(d.sessionTag))).length;
      expect(gluteish, id).toBeGreaterThanOrEqual(2);
    }
  });
});

/**
 * Аудит женского слоя: glute-сплиты должны попадать в рекомендацию женщине
 * БЕЗ явной специализации (раньше на 4 днях женский сплит был #6 за
 * upper_lower_4, т.е. фактически не рекомендовался), и не должны попадать
 * мужчине/профилю без пола.
 */
describe('аудит женского слоя: glute-сплит в рекомендации', () => {
  it('female 4 дня → female_lower_upper_4 топ-1 (beginner/intermediate/advanced)', () => {
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      const top = rankBBSplits({ level, goal: 'mass', daysPerWeek: 4, sex: 'female' })[0];
      expect(top.pattern.id, level).toBe('female_lower_upper_4');
      expect(top.rationale.join(' ')).toContain('glute-приоритет');
    }
  });

  it('female 5 дней → female_glute_5 топ-1 на intermediate/advanced/enhanced', () => {
    for (const level of ['intermediate', 'advanced', 'enhanced'] as const) {
      const top = rankBBSplits({ level, goal: 'mass', daysPerWeek: 5, sex: 'female' })[0];
      expect(top.pattern.id, level).toBe('female_glute_5');
    }
  });

  it('female: glute-сплит рекомендуется и для сушки/recomp/maintenance', () => {
    for (const goal of ['cut', 'recomp', 'maintenance', 'strength_mass'] as const) {
      expect(rankBBSplits({ level: 'intermediate', goal, daysPerWeek: 5, sex: 'female' })[0].pattern.id, goal).toBe('female_glute_5');
      expect(rankBBSplits({ level: 'intermediate', goal, daysPerWeek: 4, sex: 'female' })[0].pattern.id, goal).toBe('female_lower_upper_4');
    }
  });

  it('female 3 дня → female_glute_3 топ-1 (все уровни)', () => {
    for (const level of ['beginner', 'intermediate', 'advanced', 'enhanced'] as const) {
      const top = rankBBSplits({ level, goal: 'mass', daysPerWeek: 3, sex: 'female' })[0];
      expect(top.pattern.id, level).toBe('female_glute_3');
    }
  });

  it('female 6 дней → female_glute_6 топ-1 (в т.ч. advanced, где раньше выигрывал ppl_6)', () => {
    for (const level of ['intermediate', 'advanced', 'enhanced'] as const) {
      const top = rankBBSplits({ level, goal: 'mass', daysPerWeek: 6, sex: 'female' })[0];
      expect(top.pattern.id, level).toBe('female_glute_6');
    }
  });

  it('female новичок 5 дней → женский сплит топ-1 (4-дневный: 5-дневки новичку нет по политике уровней)', () => {
    const top = rankBBSplits({ level: 'beginner', goal: 'mass', daysPerWeek: 5, sex: 'female' })[0];
    expect(top.pattern.id.startsWith('female_')).toBe(true);
    expect(top.pattern.id).toBe('female_lower_upper_4');
  });

  it('day-fit важнее glute-бонуса: 5 дней не отдаются 3-дневному женскому сплиту', () => {
    const ranked = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5, sex: 'female' });
    const g3 = ranked.find(r => r.pattern.id === 'female_glute_3')!;
    const g5 = ranked.find(r => r.pattern.id === 'female_glute_5')!;
    expect(g5.score).toBeGreaterThan(g3.score);
  });

  it('male и профиль без пола не получают женский сплит топ-1 (все уровни × дни)', () => {
    for (const level of ['beginner', 'intermediate', 'advanced', 'enhanced'] as const) {
      for (const days of [3, 4, 5, 6]) {
        for (const sex of ['male', undefined] as const) {
          const top = rankBBSplits({ level, goal: 'mass', daysPerWeek: days, sex } as never)[0];
          expect(top.pattern.id.startsWith('female_'), `${sex}/${level}/${days}`).toBe(false);
        }
      }
    }
  });

  it('без пола женский сплит получает предупреждение «укажите пол»', () => {
    const ranked = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5 });
    const fem = ranked.find(r => r.pattern.id === 'female_glute_5')!;
    expect(fem.warnings.join(' ')).toMatch(/укажите пол/i);
  });

  it('женские цели (cut/recomp/maintenance/strength_mass) на 3 и 6 днях — тоже glute-сплит', () => {
    for (const goal of ['cut', 'recomp', 'maintenance', 'strength_mass'] as const) {
      expect(rankBBSplits({ level: 'advanced', goal, daysPerWeek: 3, sex: 'female' })[0].pattern.id, goal).toBe('female_glute_3');
      expect(rankBBSplits({ level: 'advanced', goal, daysPerWeek: 6, sex: 'female' })[0].pattern.id, goal).toBe('female_glute_6');
    }
  });

  it('явная специализация на другую группу отключает glute-дефолт (+22)', () => {
    const base = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5, sex: 'female' });
    const spec = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 5, sex: 'female', focusGroup: 'back' });
    const g5base = base.find(r => r.pattern.id === 'female_glute_5')!;
    const g5spec = spec.find(r => r.pattern.id === 'female_glute_5')!;
    expect(g5spec.score).toBe(g5base.score - 22);
    expect(g5spec.rationale.join(' ')).not.toContain('glute-приоритет профиля');
  });

  it('female_glute_3 / female_glute_6 собираются: ягодичные ≥2 сессий, валидатор без ошибок', () => {
    for (const id of ['female_glute_3', 'female_glute_6']) {
      const plan = buildBBPlan({ patternId: id, level: 'intermediate', goal: 'mass', weeks: 4, workMax: WM, sex: 'female', trainingYears: 3 } as never);
      const planAny = plan as unknown as { weeks: Array<{ sessions: Array<{ sessionTag?: string; exercises?: Array<{ muscle?: string }> }> }> };
      const week = planAny.weeks[planAny.weeks.length - 1];
      const gluteSessions = week.sessions.filter(s => (s.exercises || []).some(e => e.muscle === 'glutes')).length;
      expect(gluteSessions, id).toBeGreaterThanOrEqual(2);
      const r = validateBBPlan(plan as never, { level: 'intermediate' });
      expect(r.issues.filter((i: { level?: string }) => i.level === 'error').map((i: { message: string }) => i.message), id).toHaveLength(0);
    }
  }, 180000);
});
